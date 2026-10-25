"""Validation independent of ROS; tests run on Windows as well as Ubuntu."""
import hashlib
import math
from prepare_map import occupancy, ros_point


def grid_digest(values):
    return hashlib.sha256(bytes(int(value) & 255 for value in values)).hexdigest()


def expected_grid(data):
    image = occupancy(data)
    # ROS OccupancyGrid row 0 is the lower image row.
    return [100 if p == 0 else 0 if p == 254 else -1
            for y in reversed(range(image.height)) for p in image.crop((0, y, image.width, y+1)).tobytes()]


def validate_run(body, envelope, data):
    if not isinstance(body, dict) or body.get('mapKey') != envelope['mapKey']:
        raise ValueError('Bản đồ FE và Gazebo khác nhau.')
    run_id = body.get('runId')
    if not isinstance(run_id, str) or not 1 <= len(run_id) <= 80:
        raise ValueError('Thiếu mã hành trình.')
    steps = body.get('steps')
    if not isinstance(steps, list) or not 1 <= len(steps) <= 100:
        raise ValueError('Quy trình cần 1–100 bước MOVE.')
    image = occupancy(data)
    endpoints = {p['id']: p for p in data['endpoints']}
    zone_speeds = [float(z['speed']) for z in data['zones']
                   if z.get('enabled') is not False and z['type'] == 'SPEED']
    if any(not math.isfinite(s) or s <= 0 for s in zone_speeds):
        raise ValueError('Vùng tốc độ không hợp lệ.')
    result = []
    for step in steps:
        if not isinstance(step, dict):
            raise ValueError('Bước MOVE không hợp lệ.')
        endpoint = endpoints.get(step.get('endpointId'))
        if not endpoint or endpoint.get('enabled') is False or endpoint.get('accessible') is False:
            raise ValueError('Điểm đích không có hoặc không hoạt động trong bản đồ Gazebo.')
        speed = step.get('speed')
        if isinstance(speed, bool) or not isinstance(speed, (int, float)) or not math.isfinite(speed) or not .01 <= speed <= 1.5:
            raise ValueError('Tốc độ MOVE phải từ 0,01 đến 1,5 m/s; bộ mẫu giới hạn tối đa 0,6 m/s.')
        x, y = endpoint['x'], endpoint['y']
        margin = .3 / data['map']['resolution']
        for i in range(17):
            px = round(x + (margin*math.cos(i*math.pi/8) if i < 16 else 0))
            py = round(y + (margin*math.sin(i*math.pi/8) if i < 16 else 0))
            if not (0 <= px < image.width and 0 <= py < image.height) or image.getpixel((px, py)) != 254:
                raise ValueError(f'Điểm {endpoint.get("name", endpoint["id"])} quá gần tường hoặc trong vùng cấm/chưa biết.')
        rx, ry = ros_point(endpoint, data['map'])
        result.append({'endpointId': endpoint['id'], 'name': endpoint.get('name', endpoint['id']),
                       'x': rx, 'y': ry, 'yaw': math.radians(float(endpoint.get('heading', 0))),
                       'speed': min(speed, .6, *zone_speeds)})
    return result
