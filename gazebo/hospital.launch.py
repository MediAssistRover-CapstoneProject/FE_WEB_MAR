"""Jazzy/Harmonic demo: official Nav2 TurtleBot3 with the FE hospital world."""
from pathlib import Path
import os
import tempfile
import yaml
from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument, IncludeLaunchDescription, OpaqueFunction, RegisterEventHandler
from launch.event_handlers import OnShutdown
from launch.launch_description_sources import PythonLaunchDescriptionSource
from launch.substitutions import LaunchConfiguration


def start(context):
    folder = Path(LaunchConfiguration('map_dir').perform(context)).resolve()
    for name in ('hospital.sdf', 'hospital.yaml', 'hospital.pgm'):
        if not (folder / name).is_file():
            raise RuntimeError(f'Missing {folder / name}; run prepare_map.py first.')
    bringup = Path(get_package_share_directory('nav2_bringup'))
    params = yaml.safe_load((bringup / 'params/nav2_params.yaml').read_text())
    amcl = params['amcl']['ros__parameters']
    amcl.update(set_initial_pose=True, always_reset_initial_pose=True,
                initial_pose={'x': 0.0, 'y': -0.5, 'z': 0.0, 'yaw': 0.0})
    descriptor, name = tempfile.mkstemp(prefix='mar-nav2-', suffix='.yaml')
    with os.fdopen(descriptor, 'w') as stream:
        yaml.safe_dump(params, stream)
    return [
        IncludeLaunchDescription(PythonLaunchDescriptionSource(str(bringup / 'launch/tb3_simulation_launch.py')),
            launch_arguments={'world': str(folder / 'hospital.sdf'), 'map': str(folder / 'hospital.yaml'),
                              'params_file': name, 'use_sim_time': 'true', 'x_pose': '0.0', 'y_pose': '-0.5',
                              'yaw': '0.0', 'headless': LaunchConfiguration('headless'),
                              'use_rviz': 'True'}.items()),
        RegisterEventHandler(OnShutdown(on_shutdown=[OpaqueFunction(function=lambda _: Path(name).unlink(missing_ok=True) or [])])),
    ]


def generate_launch_description():
    return LaunchDescription([
        DeclareLaunchArgument('map_dir', default_value=str(Path(__file__).parent / 'generated')),
        DeclareLaunchArgument('headless', default_value='False'),
        OpaqueFunction(function=start),
    ])
