import copy
import json
import tempfile
import unittest
from pathlib import Path
import xml.etree.ElementTree as ET
from map_processing import load_local_map, pixel_to_ros, ros_to_pixel
from prepare_map import prepare, world_xml
from bridge_contract import validate_run, expected_grid, free_pose

class MapTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source = Path('/input/map.yaml') if Path('/input/map.yaml').exists() else Path(__file__).parent.parent/'public/mock-map-4b43a4f2/map.yaml'
        cls.config = Path(__file__).parent/'geometry-config.json'
        cls.data = load_local_map(cls.source,json.loads(cls.config.read_text()))

    def body(self):
        d=self.data
        return dict(mapId=d['mapId'],mapKey=d['mapVersion'],runId='test-run',steps=[dict(endpointId='spawn',name='Spawn',speed=.15,**{k:d['spawn'][k] for k in ('x','y','yaw')})])

    def test_original_image_preserved_and_sdf_collision_matches(self):
        with tempfile.TemporaryDirectory() as folder:
            d=prepare(self.source,self.config,folder)
            self.assertEqual((Path(folder)/'hospital.pgm').read_bytes(),(self.source.parent/'map.pgm').read_bytes())
            root=ET.parse(Path(folder)/'hospital.sdf')
            collision=root.findall('.//model[@name="local_lidar_occupied"]/link/collision')
            self.assertEqual(len(collision),len(d['obstacleGeometry']))
            for node,ob in zip(collision,d['obstacleGeometry']):
                pose=list(map(float,node.findtext('pose').split()))
                self.assertEqual(pose[:2],ob['position'])
                self.assertEqual(list(map(float,node.findtext('geometry/box/size').split())),[ob['width'],ob['depth'],ob['height']])
            self.assertEqual(len(root.findall('.//model')),2)

    def test_ros_grid_rows_and_round_trip(self):
        d=copy.deepcopy(self.data);d['origin']=[-3,4,.73]
        for p in [(0,0),(235,207),(149.5,143.5)]:
            result=ros_to_pixel(*pixel_to_ros(*p,d),d)
            for a,b in zip(p,result):self.assertAlmostEqual(a,b)
        grid=expected_grid(d);w=d['width']
        self.assertEqual(grid[:w],d['occupancyGrid'][-w:])
        self.assertEqual(grid[-w:],d['occupancyGrid'][:w])

    def test_spawn_and_invalid_goals(self):
        d=self.data;b=self.body()
        self.assertEqual(validate_run(b,{},d)[0]['endpointId'],'spawn')
        self.assertTrue(free_pose(d['spawn']['x'],d['spawn']['y'],d))
        for patch in [dict(mapKey='other'),dict(steps=[]),dict(steps=[{**b['steps'][0],'speed':.3}]),dict(steps=[{**b['steps'][0],'x':float('nan')}]),dict(steps=[{**b['steps'][0],'x':True}]),dict(steps=[{**b['steps'][0],'x':-999}])]:
            with self.subTest(patch=patch),self.assertRaises(ValueError):validate_run({**b,**patch},{},d)

    def test_unknown_blocked_and_configuration_required(self):
        d=copy.deepcopy(self.data);i=d['occupancyGrid'].index(-1)
        self.assertFalse(free_pose(*pixel_to_ros(i%d['width']+.5,i//d['width']+.5,d),d))
        d['status']='NEEDS_CONFIGURATION'
        with self.assertRaises(ValueError):world_xml(d)

if __name__=='__main__':unittest.main()
