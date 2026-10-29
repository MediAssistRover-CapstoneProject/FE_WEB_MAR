"""Generate SDF from original local LiDAR files. Never re-render the map."""
import argparse
import json
import shutil
from pathlib import Path
import xml.etree.ElementTree as ET
import yaml
from map_processing import load_local_map, pixel_to_ros

def load_manifest(path):
    data = json.loads(Path(path).read_text(encoding='utf-8'))
    if data.get('schema') != 'mar-map-v2' or data.get('sourceType') != 'LOCAL_MOCK':
        raise ValueError('Expected file-based mar-map-v2 model')
    return {'mapKey': data['mapVersion']}, data

def element(parent, tag, text=None, **attrs):
    node = ET.SubElement(parent, tag, attrs)
    if text is not None:
        node.text = str(text)
    return node

def box(link, name, x, y, z, width, depth, height, yaw=0, color='0.82 0.88 0.92 1'):
    for kind in ('collision', 'visual'):
        node = element(link, kind, name=f'{kind}_{name}')
        element(node, 'pose', f'{x} {y} {z} 0 0 {yaw}')
        element(element(element(node, 'geometry'), 'box'), 'size', f'{width} {depth} {height}')
        if kind == 'visual':
            material = element(node, 'material')
            element(material, 'ambient', color)
            element(material, 'diffuse', color)

def world_xml(data):
    if data['status'] != 'READY':
        raise ValueError('NEEDS_CONFIGURATION: approve occupiedHeight and floorThickness first')
    root = ET.Element('sdf', version='1.9')
    world = element(root, 'world', name='default')
    physics = element(world, 'physics', name='physics', type='ignored')
    element(physics, 'max_step_size', .004)
    element(physics, 'real_time_factor', 1)
    for library, system in [('physics','Physics'),('user-commands','UserCommands'),('scene-broadcaster','SceneBroadcaster'),('sensors','Sensors'),('imu','Imu')]:
        plugin = element(world, 'plugin', filename=f'gz-sim-{library}-system', name=f'gz::sim::systems::{system}')
        if system == 'Sensors':
            element(plugin, 'render_engine', 'ogre2')
    scene = element(world, 'scene')
    element(scene, 'ambient', '0.6 0.6 0.6 1')
    element(scene, 'background', '0.16 0.22 0.30 1')
    light = element(world, 'light', name='sun', type='directional')
    element(light, 'pose', '0 0 10 0 0 0')
    element(light, 'diffuse', '0.9 0.9 0.9 1')
    element(light, 'direction', '-0.5 0.2 -1')
    model = element(world, 'model', name='local_lidar_occupied')
    element(model, 'static', 'true')
    link = element(model, 'link', name='occupancy')
    # One static rigid body. Exact merged boxes preserve occupied pixels.
    for ob in data['obstacleGeometry']:
        box(link, ob['id'], *ob['position'], ob['height']/2, ob['width'], ob['depth'], ob['height'], ob['yaw'])
    floor = element(world, 'model', name='assumed_support_floor')
    element(floor, 'static', 'true')
    ground = element(floor, 'link', name='floor')
    x, y = pixel_to_ros(data['width']/2, data['height']/2, data)
    thickness = data['geometryConfig']['floorThickness']
    box(ground, 'floor', x, y, -thickness/2, data['width']*data['resolution'],
        data['height']*data['resolution'], thickness, data['origin'][2], '0.3 0.35 0.4 1')
    ET.indent(root)
    return ET.tostring(root, encoding='unicode')

def prepare(source, config, destination):
    source = Path(source).resolve()
    model = load_local_map(source, json.loads(Path(config).read_text()))
    folder = Path(destination)
    folder.mkdir(parents=True, exist_ok=True)
    meta = yaml.safe_load(source.read_text())
    original = source.parent / meta['image']
    image_name = 'hospital'+original.suffix
    shutil.copyfile(original, folder/image_name)
    meta['image'] = image_name
    (folder/'hospital.yaml').write_text(yaml.safe_dump(meta))
    (folder/'hospital.sdf').write_text(world_xml(model))
    (folder/'hospital.gazebo.json').write_text(json.dumps(model, separators=(',',':')))
    print(json.dumps({k:model[k] for k in ('mapId','mapVersion','width','height','resolution','origin','spawn')}), flush=True)
    return model

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('yaml'); parser.add_argument('--config', required=True); parser.add_argument('--output', default='generated')
    args = parser.parse_args()
    prepare(args.yaml, args.config, args.output)
