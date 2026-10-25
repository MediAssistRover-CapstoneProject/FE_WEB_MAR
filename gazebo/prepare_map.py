"""Generate a Gazebo Harmonic world and Nav2 occupancy map from the FE export."""
import argparse
import hashlib
import json
import math
from pathlib import Path
import xml.etree.ElementTree as ET
from PIL import Image, ImageDraw


def load_manifest(path):
    envelope = json.loads(Path(path).read_text(encoding='utf-8'))
    if envelope.get('format') != 'mar-gazebo-v1':
        raise ValueError('Export the map using Tai ban do cho Gazebo in the FE.')
    content = envelope['content']
    if hashlib.sha256(content.encode()).hexdigest() != envelope['mapKey']:
        raise ValueError('Map fingerprint mismatch.')
    data = json.loads(content)
    if data['geometry'] != 'mar-hospital-v1' or data['map'] != {'width': 1200, 'height': 680, 'resolution': 0.05}:
        raise ValueError('Unsupported geometry/version.')
    return envelope, data


def ros_point(point, spec):
    return ((point['x'] - spec['width'] / 2) * spec['resolution'],
            (spec['height'] / 2 - point['y']) * spec['resolution'])


def occupancy(data):
    spec = data['map']
    image = Image.new('L', (spec['width'], spec['height']), 205)
    draw = ImageDraw.Draw(image)
    xy = lambda points: [(p['x'], p['y']) for p in points]
    draw.polygon(xy(data['floor']), fill=254)
    for wall in data['walls']:
        draw.line(xy(wall), fill=0, width=3)
    for ob in data['obstacles']:
        draw.rectangle((ob['x'], ob['y'], ob['x'] + ob['w'], ob['y'] + ob['h']), fill=0)
    for zone in data['zones']:
        if zone.get('enabled') is not False and zone['type'] == 'KEEP_OUT' and len(zone['points']) >= 3:
            draw.polygon(xy(zone['points']), fill=0)
    return image


def element(parent, tag, text=None, **attributes):
    node = ET.SubElement(parent, tag, attributes)
    if text is not None:
        node.text = str(text)
    return node


def box(world, name, x, y, z, width, depth, height, yaw=0, color='0.82 0.88 0.92 1'):
    model = element(world, 'model', name=name)
    element(model, 'static', 'true')
    element(model, 'pose', f'{x} {y} {z} 0 0 {yaw}')
    link = element(model, 'link', name='body')
    for kind in ('collision', 'visual'):
        node = element(link, kind, name=kind)
        shape = element(element(node, 'geometry'), 'box')
        element(shape, 'size', f'{width} {depth} {height}')
        if kind == 'visual':
            material = element(node, 'material')
            element(material, 'ambient', color)
            element(material, 'diffuse', color)


def world_xml(data):
    root = ET.Element('sdf', version='1.8')
    world = element(root, 'world', name='default')
    physics = element(world, 'physics', name='physics', type='ignored')
    element(physics, 'max_step_size', .001)
    element(physics, 'real_time_factor', 1)
    for library, system in [('physics', 'Physics'), ('user-commands', 'UserCommands'), ('scene-broadcaster', 'SceneBroadcaster'), ('sensors', 'Sensors'), ('imu', 'Imu')]:
        plugin = element(world, 'plugin', filename=f'gz-sim-{library}-system', name=f'gz::sim::systems::{system}')
        if system == 'Sensors':
            element(plugin, 'render_engine', 'ogre2')
    scene = element(world, 'scene')
    element(scene, 'ambient', '0.6 0.6 0.6 1')
    element(scene, 'background', '0.16 0.22 0.30 1')
    light = element(world, 'light', name='sun', type='directional')
    element(light, 'pose', '0 0 20 0 0 0')
    element(light, 'diffuse', '0.9 0.9 0.9 1')
    element(light, 'direction', '-0.5 0.2 -1')
    element(light, 'cast_shadows', 'true')
    box(world, 'ground', 0, 0, -.1, 80, 55, .2, color='0.50 0.58 0.64 1')
    spec = data['map']
    for i, (a, b) in enumerate(data['walls']):
        ax, ay = ros_point(a, spec)
        bx, by = ros_point(b, spec)
        box(world, f'wall_{i}', (ax+bx)/2, (ay+by)/2, 1.15, math.hypot(bx-ax, by-ay), .15, 2.3, math.atan2(by-ay, bx-ax))
    for i, ob in enumerate(data['obstacles']):
        x, y = ros_point({'x': ob['x']+ob['w']/2, 'y': ob['y']+ob['h']/2}, spec)
        box(world, f'obstacle_{i}', x, y, .325, ob['w']*spec['resolution'], ob['h']*spec['resolution'], .65, color='0.3 0.42 0.55 1')
    ET.indent(root)
    return ET.tostring(root, encoding='unicode')


def prepare(source, destination):
    envelope, data = load_manifest(source)
    folder = Path(destination)
    folder.mkdir(parents=True, exist_ok=True)
    image = occupancy(data)
    image.save(folder / 'hospital.pgm')
    spec = data['map']
    (folder / 'hospital.yaml').write_text(
        f"image: hospital.pgm\nmode: trinary\nresolution: {spec['resolution']}\n"
        f"origin: [{-spec['width']*spec['resolution']/2}, {-spec['height']*spec['resolution']/2}, 0.0]\n"
        'negate: 0\noccupied_thresh: 0.65\nfree_thresh: 0.196\n', encoding='utf-8')
    (folder / 'hospital.sdf').write_text(world_xml(data), encoding='utf-8')
    (folder / 'hospital.gazebo.json').write_text(json.dumps(envelope, ensure_ascii=False), encoding='utf-8')
    print(f'Prepared {folder.resolve()} | map key {envelope["mapKey"][:12]}')
    print('ROS map: 60 x 34 m, origin (-30, -17), resolution 0.05 m/pixel.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('manifest')
    parser.add_argument('--output', default='generated')
    args = parser.parse_args()
    prepare(args.manifest, args.output)
