"""Private-LAN HTTP bridge to a dedicated Gazebo/Nav2 simulation (ROS_DOMAIN_ID=77).

Commands arrive through the existing MQTT broker via the authenticated BE. A lost UI
lease cancels the owned Nav2 goal; only its result can complete a MOVE step.
"""
import argparse
import copy
import json
import math
import os
import queue
import secrets
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import rclpy
from rclpy.action import ActionClient
from rclpy.clock import Clock as RosClock, ClockType
from rclpy.signals import SignalHandlerOptions
from rclpy.node import Node
from rclpy.parameter import Parameter
from rclpy.qos import QoSProfile, DurabilityPolicy, ReliabilityPolicy
from rclpy.time import Time
from action_msgs.msg import GoalStatus
from nav2_msgs.action import NavigateToPose
from nav2_msgs.msg import SpeedLimit
from nav_msgs.msg import OccupancyGrid, Path as RosPath
from rosgraph_msgs.msg import Clock
from tf2_ros import Buffer, TransformListener

from prepare_map import load_manifest
from bridge_contract import expected_grid, grid_digest, validate_run

ACTIVE = {'STARTING', 'RUNNING', 'CANCELING'}


class SimulationBridge(Node):
    def __init__(self, manifest):
        super().__init__('mar_gazebo_bridge', parameter_overrides=[Parameter('use_sim_time', value=True)])
        self.envelope, self.data = load_manifest(manifest)
        self.grid_hash = grid_digest(expected_grid(self.data))
        self.commands = queue.Queue(maxsize=16)
        self.lock = threading.Lock()
        self.last_ui = 0
        self.clock_seen = 0
        self.last_clock = None
        self.map_ok = False
        self.goal = None
        self.pending_goal = False
        self.stopping = False
        self.steps = []
        self.seen_runs = set()
        self.run_id = None
        self.queued_run = None
        self.state = dict(protocol='mar-gazebo-v1', simulation=True, mapKey=self.envelope['mapKey'],
                          ready=False, status='IDLE', completed=0, total=0, pose=None,
                          poseFresh=False, targetName=None, runId=None, message='', path=[], reason='Đang chờ ROS.')
        self.nav = ActionClient(self, NavigateToPose, '/navigate_to_pose')
        self.speed_pub = self.create_publisher(SpeedLimit, '/speed_limit', 10)
        self.tf = Buffer()
        self.listener = TransformListener(self.tf, self)
        self.create_subscription(Clock, '/clock', self.on_clock, 10)
        qos = QoSProfile(depth=1, durability=DurabilityPolicy.TRANSIENT_LOCAL, reliability=ReliabilityPolicy.RELIABLE)
        self.create_subscription(OccupancyGrid, '/map', self.on_map, qos)
        self.create_subscription(RosPath, '/plan', self.on_path, 1)
        self.create_timer(.2, self.tick, clock=RosClock(clock_type=ClockType.STEADY_TIME))

    def update(self, **fields):
        with self.lock:
            self.state.update(fields)

    def snapshot(self):
        with self.lock:
            return copy.deepcopy(self.state)

    def on_clock(self, msg):
        value = msg.clock.sec * 1_000_000_000 + msg.clock.nanosec
        if value != self.last_clock:
            self.clock_seen = time.monotonic()
            self.last_clock = value

    def on_map(self, msg):
        spec = self.data
        origin = msg.info.origin
        self.map_ok = (msg.header.frame_id.lstrip('/') == 'map' and msg.info.width == spec['width']
                       and msg.info.height == spec['height'] and abs(msg.info.resolution-spec['resolution']) < 1e-6
                       and abs(origin.position.x-spec['origin'][0]) < 1e-5 and abs(origin.position.y-spec['origin'][1]) < 1e-5
                       and abs(origin.orientation.z-math.sin(spec['origin'][2]/2)) < 1e-5
                       and abs(origin.orientation.w-math.cos(spec['origin'][2]/2)) < 1e-5
                       and grid_digest(msg.data) == self.grid_hash)

    def on_path(self, msg):
        if msg.header.frame_id.lstrip('/') == 'map' and self.state['status'] in ACTIVE:
            self.update(path=[dict(x=p.pose.position.x, y=p.pose.position.y, yaw=0) for p in msg.poses[::max(1, len(msg.poses)//1000)]])

    def readiness(self):
        pose = None
        fresh = False
        try:
            transform = self.tf.lookup_transform('map', 'base_link', Time())
            age = (self.get_clock().now() - Time.from_msg(transform.header.stamp)).nanoseconds / 1e9
            p, q = transform.transform.translation, transform.transform.rotation
            pose = dict(x=p.x, y=p.y, yaw=math.atan2(2*(q.w*q.z+q.x*q.y), 1-2*(q.y*q.y+q.z*q.z)))
            fresh = -.2 <= age <= 1.5 and all(math.isfinite(v) for v in pose.values())
        except Exception:
            pass
        if time.monotonic() - self.clock_seen > 2:
            reason = 'Chờ Gazebo chạy /clock (hoặc đang Pause).'
        elif not self.map_ok:
            reason = 'Map ROS chưa khớp gói bản đồ. Chạy hospital.launch.py với đúng thư mục generated.'
        elif not fresh:
            reason = 'Chờ định vị map → base_link. Kiểm tra vị trí ban đầu trong RViz.'
        elif not self.nav.server_is_ready():
            reason = 'Chờ Nav2 /navigate_to_pose.'
        else:
            reason = ''
        self.update(ready=not reason, reason=reason, pose=pose, poseFresh=fresh and not reason)
        return not reason

    def tick(self):
        ready = self.readiness()
        while not self.commands.empty():
            operation, body = self.commands.get_nowait()
            if operation == '/cancel':
                if body.get('runId') == self.run_id:
                    self.cancel('Người dùng yêu cầu dừng.')
                continue
            if body['runId'] in self.seen_runs:
                with self.lock:
                    self.queued_run = None
                continue
            if self.state['status'] in ACTIVE:
                continue
            self.run_id = body['runId']
            self.update(runId=self.run_id, status='STARTING')
            with self.lock:
                self.queued_run = None
            self.seen_runs.add(body['runId'])
            if len(self.seen_runs) > 10000:
                self.seen_runs = {body['runId']}
            if not ready:
                self.update(status='FAILED', message='Gazebo chưa sẵn sàng. Kiểm tra trạng thái rồi chạy lại.')
                continue
            self.steps = body['validatedSteps']
            self.stopping = False
            self.update(completed=0, total=len(self.steps), status='STARTING', message='', path=[])
            self.next_goal()
        if self.state['status'] in ACTIVE and not self.stopping:
            if time.monotonic() - self.last_ui > 4:
                self.cancel('Mất kết nối FE; đã yêu cầu hủy mục tiêu Nav2.')
            elif not ready:
                self.cancel('Mất dữ liệu mô phỏng; đã yêu cầu hủy mục tiêu Nav2.')
        if hasattr(self,'mqtt'):
            self.mqtt.tick()

    def next_goal(self):
        if self.stopping:
            return
        index = self.state['completed']
        if index == len(self.steps):
            self.update(status='SUCCEEDED', targetName=None, message='Nav2 đã xác nhận hoàn thành từng điểm MOVE.')
            return
        step = self.steps[index]
        limit = SpeedLimit()
        limit.header.stamp = self.get_clock().now().to_msg()
        limit.percentage = False
        limit.speed_limit = float(step['speed'])
        self.speed_pub.publish(limit)
        goal = NavigateToPose.Goal()
        goal.pose.header.frame_id = 'map'
        goal.pose.header.stamp = self.get_clock().now().to_msg()
        goal.pose.pose.position.x, goal.pose.pose.position.y = step['x'], step['y']
        goal.pose.pose.orientation.z = math.sin(step['yaw']/2)
        goal.pose.pose.orientation.w = math.cos(step['yaw']/2)
        self.pending_goal = True
        self.update(status='STARTING', targetName=step['name'], path=[])
        self.nav.send_goal_async(goal).add_done_callback(self.accepted)

    def accepted(self, future):
        self.pending_goal = False
        try:
            handle = future.result()
            if not handle.accepted:
                self.update(status='CANCELED' if self.stopping else 'FAILED', message='Nav2 không nhận mục tiêu.')
                return
            self.goal = handle
            handle.get_result_async().add_done_callback(self.finished)
            if self.stopping:
                handle.cancel_goal_async()
            else:
                self.update(status='RUNNING')
        except Exception as error:
            self.update(status='FAILED', message=f'Lỗi nhận mục tiêu Nav2: {error}')

    def finished(self, future):
        self.goal = None
        try:
            result = future.result()
            if self.stopping or result.status == GoalStatus.STATUS_CANCELED:
                self.update(status='CANCELED', targetName=None)
            elif result.status == GoalStatus.STATUS_SUCCEEDED:
                self.update(completed=self.state['completed']+1)
                self.next_goal()
            else:
                self.update(status='FAILED', message=f'Nav2 dừng với trạng thái {result.status}. Kiểm tra đường đi và định vị.')
        except Exception as error:
            self.update(status='FAILED', message=f'Không đọc được kết quả Nav2: {error}')

    def cancel(self, message):
        if self.state['status'] not in ACTIVE or self.stopping:
            return
        self.stopping = True
        self.update(status='CANCELING', message=message)
        if self.goal:
            self.goal.cancel_goal_async()
        elif not self.pending_goal:
            self.update(status='CANCELED')


def handler(node, key, origin):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_):
            pass  # Never log the pairing secret or route body.

        def reply(self, status, value):
            payload = json.dumps(value, ensure_ascii=False, allow_nan=False).encode()
            self.send_response(status)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(payload)))
            self.send_header('Cache-Control', 'no-store')
            self.send_header('Access-Control-Allow-Origin', origin)
            self.send_header('Vary', 'Origin')
            self.end_headers()
            self.wfile.write(payload)

        def authorized(self):
            return self.headers.get('Origin') == origin and secrets.compare_digest(self.headers.get('X-Simulation-Key', ''), key)

        def do_OPTIONS(self):
            if self.headers.get('Origin') != origin:
                return self.reply(403, {'error': 'Origin không được phép.'})
            self.send_response(204)
            self.send_header('Access-Control-Allow-Origin', origin)
            self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', 'Content-Type, X-Simulation-Key, X-Simulation-Run')
            self.end_headers()

        def do_GET(self):
            if not self.authorized():
                return self.reply(403, {'error': 'Sai mã kết nối hoặc địa chỉ FE (origin).'})
            if self.path != '/state':
                return self.reply(404, {'error': 'Không có API này.'})
            self.reply(200, node.snapshot())

        def do_POST(self):
            # Motion exclusively uses authenticated BE -> MQTT, not browser HTTP.
            return self.reply(410, {'error': 'Dùng /api/v1/simulation/commands trên BE.'})
    return Handler


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--map', default=str(Path(__file__).parent / 'generated/hospital.gazebo.json'))
    parser.add_argument('--bind', default='127.0.0.1')
    parser.add_argument('--port', type=int, default=8765)
    parser.add_argument('--origin', default='http://localhost:5173')
    args = parser.parse_args()
    if os.environ.get('ROS_DOMAIN_ID') != '77':
        parser.error('Use ROS_DOMAIN_ID=77 for this dedicated simulation; do not join the physical robot domain.')
    rclpy.init(signal_handler_options=SignalHandlerOptions.NO)
    node = SimulationBridge(args.map)
    if os.environ.get('SIM_MQTT_ENABLED') == 'true':
        from mqtt_adapter import SimulationMqttAdapter
        node.mqtt = SimulationMqttAdapter(node)
    key = secrets.token_urlsafe(24)
    server = ThreadingHTTPServer((args.bind, args.port), handler(node, key, args.origin))
    server.daemon_threads = True
    threading.Thread(target=server.serve_forever, daemon=True).start()
    print(f'Gazebo bridge: http://{args.bind}:{args.port}\nFE origin: {args.origin}\nMa ket noi: {key}', flush=True)
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        node.cancel('Cầu nối đang tắt; yêu cầu hủy mục tiêu.')
        deadline = time.monotonic() + 3
        while rclpy.ok() and node.state['status'] in ACTIVE and time.monotonic() < deadline:
            rclpy.spin_once(node, timeout_sec=.1)
    finally:
        if hasattr(node,'mqtt'): node.mqtt.close()
        server.shutdown()
        node.destroy_node()
        if rclpy.ok():
            rclpy.shutdown()


if __name__ == '__main__':
    main()
