import copy
import tempfile
import unittest
from pathlib import Path
import xml.etree.ElementTree as ET
from PIL import Image
from prepare_map import load_manifest, occupancy, prepare, ros_point, world_xml
from bridge_contract import validate_run, expected_grid, grid_digest


class MapTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source = Path(__file__).parent.parent / '.workstation-build/gazebo/test-map.json'
        cls.envelope, cls.data = load_manifest(cls.source)

    def body(self):
        return {'runId': 'test-run', 'mapKey': self.envelope['mapKey'], 'steps': [{'endpointId': 'a', 'speed': .3}, {'endpointId': 'b', 'speed': .3}]}

    def test_export_geometry_and_ros_grid(self):
        with tempfile.TemporaryDirectory() as directory:
            prepare(self.source, directory)
            with Image.open(Path(directory) / 'hospital.pgm') as image:
                self.assertEqual(image.size, (1200, 680))
            self.assertIn('origin: [-30.0, -17.0, 0.0]', (Path(directory) / 'hospital.yaml').read_text())
            root = ET.parse(Path(directory) / 'hospital.sdf')
            self.assertEqual(len(root.findall('.//model')), 1 + len(self.data['walls']) + len(self.data['obstacles']))
        self.assertEqual(ros_point({'x': 600, 'y': 350}, self.data['map']), (0, -.5))
        grid = expected_grid(self.data)
        image = occupancy(self.data)
        self.assertEqual(len(grid), 1200 * 680)
        self.assertEqual(grid[(679-330)*1200 + 580], 0)
        self.assertEqual(image.getpixel((580, 330)), 254)
        self.assertEqual(len(grid_digest(grid)), 64)

    def test_endpoint_order_and_conservative_speed(self):
        data = copy.deepcopy(self.data)
        data['zones'] = [{'type': 'SPEED', 'speed': .2, 'points': []}]
        steps = validate_run(self.body(), self.envelope, data)
        self.assertEqual([step['endpointId'] for step in steps], ['a', 'b'])
        self.assertEqual(steps[0]['x'], -1)
        self.assertEqual(steps[0]['y'], .5)
        self.assertEqual(steps[0]['speed'], .2)

    def test_reject_map_unknown_disabled_and_invalid_speed(self):
        for change in [{'mapKey': 'other'}, {'steps': []}, {'steps': [{'endpointId': 'unknown', 'speed': .3}]}, {'steps': [{'endpointId': 'a', 'speed': float('nan')}]}, {'steps': [{'endpointId': 'a', 'speed': True}]}]:
            with self.subTest(change=change), self.assertRaises(ValueError):
                validate_run({**self.body(), **change}, self.envelope, self.data)
        data = copy.deepcopy(self.data)
        data['endpoints'][0]['enabled'] = False
        with self.assertRaises(ValueError):
            validate_run(self.body(), self.envelope, data)

    def test_keepout_and_wall_clearance(self):
        data = copy.deepcopy(self.data)
        data['zones'] = [{'type': 'KEEP_OUT', 'points': [{'x': 570, 'y': 320}, {'x': 590, 'y': 320}, {'x': 590, 'y': 340}, {'x': 570, 'y': 340}]}]
        with self.assertRaises(ValueError):
            validate_run(self.body(), self.envelope, data)
        data['zones'] = []
        data['endpoints'][0].update(x=90, y=250)
        with self.assertRaises(ValueError):
            validate_run(self.body(), self.envelope, data)

    def test_tamper_rejected(self):
        import json
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'bad.json'
            path.write_text(json.dumps({**self.envelope, 'content': self.envelope['content'] + ' '}))
            with self.assertRaises(ValueError):
                load_manifest(path)


if __name__ == '__main__':
    unittest.main()
