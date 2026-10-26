"""File-only map provider. Pixel edges use top-left origin; ROS uses bottom-left.

Occupied cells are extruded as UNCLASSIFIED obstacles, not inferred walls/doors.
All boxes retain the exact pixel rectangle that produced them.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import yaml
from PIL import Image


def pixel_to_ros(x, y, model):
    r = model['resolution']
    ox, oy, yaw = model['origin']
    a, b = x*r, (model['height']-y)*r
    return [ox+math.cos(yaw)*a-math.sin(yaw)*b, oy+math.sin(yaw)*a+math.cos(yaw)*b]


def ros_to_pixel(x, y, model):
    ox, oy, yaw = model['origin']
    a, b = x-ox, y-oy
    return [(math.cos(yaw)*a+math.sin(yaw)*b)/model['resolution'],
            model['height']-(-math.sin(yaw)*a+math.cos(yaw)*b)/model['resolution']]


def rectangles(grid, width, height):
    """Exact run-length merge: never fills a free/unknown cell to simplify mesh."""
    result, active = [], {}
    for y in range(height+1):
        runs, x = [], 0
        while y < height and x < width:
            if grid[y*width+x] != 100:
                x += 1
                continue
            start = x
            while x < width and grid[y*width+x] == 100:
                x += 1
            runs.append((start, x-start))
        following = {}
        for run in runs:
            rect = active.pop(run, dict(x=run[0], y=y, width=run[1], height=0))
            rect['height'] += 1
            following[run] = rect
        result.extend(active.values())
        active = following
    return result


def load_local_map(yaml_path, config):
    path = Path(yaml_path).resolve()
    meta = yaml.safe_load(path.read_text())
    for key in ('image', 'resolution', 'origin', 'negate', 'occupied_thresh', 'free_thresh'):
        if key not in meta:
            raise ValueError(f'Missing map metadata: {key}')
    if meta.get('mode', 'trinary') != 'trinary':
        raise ValueError('Only trinary occupancy maps are supported.')
    r, origin = meta['resolution'], meta['origin']
    if not isinstance(r, (float, int)) or not math.isfinite(r) or r <= 0 or len(origin) != 3 or not all(math.isfinite(v) for v in origin):
        raise ValueError('Invalid resolution/origin')
    if not 0 <= meta['free_thresh'] < meta['occupied_thresh'] <= 1 or meta['negate'] not in (0, 1):
        raise ValueError('Invalid occupancy thresholds')
    image_path = (path.parent / meta['image']).resolve()
    if not image_path.is_relative_to(path.parent):
        raise ValueError('Image must be inside map directory')
    with Image.open(image_path) as image:
        if image.mode != 'L':
            raise ValueError('Supply original grayscale PGM/PNG, without overlays')
        width, height = image.size
        pixels = list(image.getdata())
    grid = []
    for value in pixels:
        probability = value/255 if meta['negate'] else (255-value)/255
        grid.append(100 if probability > meta['occupied_thresh'] else 0 if probability < meta['free_thresh'] else -1)
    source_hash = hashlib.sha256(path.read_bytes()+image_path.read_bytes()).hexdigest()
    config_hash = hashlib.sha256(json.dumps(config, sort_keys=True).encode()).hexdigest()
    model = dict(schema='mar-map-v2', mapId='local-lidar-'+source_hash[:16], mapVersion=source_hash,
        sourceType='LOCAL_MOCK', imagePath='/'+path.parent.name+'/'+image_path.name,
        yamlPath='/'+path.parent.name+'/'+path.name, resolution=r, origin=origin, width=width, height=height,
        occupancyGrid=grid, wallGeometry=[], doorGeometry=[], obstacleGeometry=[], geometryConfig=config,
        coordinateTransform=dict(pixelConvention='TOP_LEFT_EDGES_CELL_CENTER_PLUS_HALF', mapFrame='map',
            worldFrame='map', worldFromMap=[0, 0, 0], web3D='ROS_X_Z_NEGATIVE_Y',
            view=dict(width=1200, height=680, padding=25, rotationRad=-math.pi/6)),
        generatedWorldPath='hospital.sdf', geometryVersion=config_hash,
        provenance=dict(measured=['pixels', 'resolution', 'origin'], derived=['occupancyGrid', 'obstacleGeometry'],
            assumed=['occupiedHeight', 'floorThickness'], unclassified=['walls', 'doors', 'ceiling']),
        status='READY' if config.get('approved') and config.get('occupiedHeight', 0)>0 and config.get('floorThickness', 0)>0 else 'NEEDS_CONFIGURATION')
    for i, rect in enumerate(rectangles(grid, width, height)):
        x, y = pixel_to_ros(rect['x']+rect['width']/2, rect['y']+rect['height']/2, model)
        model['obstacleGeometry'].append(dict(id=f'occupied_{i}', classification='OCCUPIED_UNCLASSIFIED',
            sourcePixels=rect, position=[x, y], yaw=origin[2], width=rect['width']*r,
            depth=rect['height']*r, height=config.get('occupiedHeight'), provenance='PGM_OCCUPIED_RECTANGLE_EXACT'))
    model['counts'] = {name: grid.count(value) for name, value in [('free', 0), ('occupied', 100), ('unknown', -1)]}
    # Deterministic maximum-clearance cell derived from this grid. Unknown and
    # boundaries stop clearance. Chebyshev distance conservatively bounds Euclidean.
    from collections import deque
    distances = [0 if v != 0 else width+height for v in grid]
    pending = deque(i for i, v in enumerate(grid) if v != 0)
    for y in range(height):
        for x in range(width):
            if x in (0, width-1) or y in (0, height-1):
                i = y*width+x
                distances[i] = 0
                pending.append(i)
    while pending:
        i = pending.popleft()
        x, y = i % width, i // width
        for dx, dy in ((1,0),(-1,0),(0,1),(0,-1),(1,1),(-1,-1),(1,-1),(-1,1)):
            xx, yy = x+dx, y+dy
            if 0 <= xx < width and 0 <= yy < height:
                j = yy*width+xx
                if distances[j] > distances[i]+1:
                    distances[j] = distances[i]+1
                    pending.append(j)
    best = max(range(len(grid)), key=lambda i: distances[i])
    px, py = best % width+.5, best // width+.5
    sx, sy = pixel_to_ros(px, py, model)
    model['spawn'] = dict(x=sx, y=sy, yaw=origin[2], pixel=[px,py],
        conservativeClearanceM=max(0, distances[best]-1)*r,
        provenance='MAXIMUM_CHEBYSHEV_FREE_CLEARANCE_CELL')
    return model


def write_model(yaml_path, config_path, output):
    model = load_local_map(yaml_path, json.loads(Path(config_path).read_text()))
    Path(output).parent.mkdir(parents=True, exist_ok=True)
    Path(output).write_text(json.dumps(model, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(json.dumps({k: model[k] for k in ('mapId', 'width', 'height', 'resolution', 'origin', 'counts', 'status')}))
    print('Exact occupied rectangles:', len(model['obstacleGeometry']))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('yaml'); parser.add_argument('config'); parser.add_argument('output')
    args = parser.parse_args()
    write_model(args.yaml, args.config, args.output)
