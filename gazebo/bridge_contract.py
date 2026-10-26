"""Pure validation for the local simulation protocol; no ROS/database access."""
import hashlib
import math
from map_processing import ros_to_pixel

def grid_digest(values):
    return hashlib.sha256(bytes(int(v) & 255 for v in values)).hexdigest()

def expected_grid(data):
    w, h = data['width'], data['height']
    return [data['occupancyGrid'][y*w+x] for y in reversed(range(h)) for x in range(w)]

def free_pose(x, y, data, radius=.3):
    px, py = ros_to_pixel(x, y, data)
    r = radius/data['resolution']
    for yy in range(math.floor(py-r), math.floor(py+r)+1):
        for xx in range(math.floor(px-r), math.floor(px+r)+1):
            dx, dy = max(xx-px, 0, px-xx-1), max(yy-py, 0, py-yy-1)
            if math.hypot(dx,dy) <= r:
                if not (0 <= xx < data['width'] and 0 <= yy < data['height']) or data['occupancyGrid'][yy*data['width']+xx] != 0:
                    return False
    return True

def validate_run(body, envelope, data):
    if not isinstance(body, dict) or body.get('mapKey') != data['mapVersion'] or body.get('mapId') != data['mapId']:
        raise ValueError('Bản đồ FE và Gazebo khác nhau.')
    run_id = body.get('runId')
    if not isinstance(run_id,str) or not 1 <= len(run_id) <= 80:
        raise ValueError('Thiếu mã hành trình.')
    steps = body.get('steps')
    if not isinstance(steps,list) or not 1 <= len(steps) <= 100:
        raise ValueError('Cần 1–100 bước MOVE.')
    result = []
    for step in steps:
        if not isinstance(step,dict) or not isinstance(step.get('endpointId'),str):
            raise ValueError('Thiếu điểm đích.')
        values = [step.get(k) for k in ('x','y','yaw','speed')]
        if any(isinstance(v,bool) or not isinstance(v,(int,float)) or not math.isfinite(v) for v in values):
            raise ValueError('Tọa độ/tốc độ phải là số hữu hạn.')
        x,y,yaw,speed = values
        if not .01 <= speed <= .26:
            raise ValueError('TurtleBot3 Waffle mô phỏng hỗ trợ 0,01–0,26 m/s.')
        if not free_pose(x,y,data):
            raise ValueError('Điểm đích trong vật cản, vùng chưa biết hoặc quá gần tường (<0,3 m).')
        result.append(dict(endpointId=step['endpointId'], name=str(step.get('name',step['endpointId']))[:120], x=x,y=y,yaw=yaw,speed=speed))
    return result
