"""Jazzy/Harmonic demo: official Nav2 TurtleBot3 with the FE hospital world."""
from pathlib import Path
import os
import tempfile
import yaml
import json
from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument, ExecuteProcess, IncludeLaunchDescription, OpaqueFunction, RegisterEventHandler
from launch.conditions import UnlessCondition
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
    model = json.loads((folder / 'hospital.gazebo.json').read_text())
    spawn = model['spawn']
    if spawn['conservativeClearanceM'] < .3:
        raise RuntimeError('No spawn with enough clearance for TurtleBot3 Waffle')
    amcl = params['amcl']['ros__parameters']
    amcl.update(set_initial_pose=True, always_reset_initial_pose=True,
                initial_pose={'x': spawn['x'], 'y': spawn['y'], 'z': 0.0, 'yaw': spawn['yaw']})
    descriptor, name = tempfile.mkstemp(prefix='mar-nav2-', suffix='.yaml')
    with os.fdopen(descriptor, 'w') as stream:
        yaml.safe_dump(params, stream)

    return [
        # 1. Headless Gazebo Harmonic physics server
        ExecuteProcess(cmd=['gz', 'sim', '-r', '-s', str(folder / 'hospital.sdf')], output='screen'),
        
        # 2. Gazebo GUI client running on Display :98 (Web port 6080)
        IncludeLaunchDescription(
            PythonLaunchDescriptionSource(str(Path(get_package_share_directory('ros_gz_sim')) / 'launch/gz_sim.launch.py')),
            condition=UnlessCondition(LaunchConfiguration('headless')),
            launch_arguments={'gz_args': '-v4 -g'}.items()),
        
        # 3. Nav2 TurtleBot3 stack (without rviz)
        IncludeLaunchDescription(
            PythonLaunchDescriptionSource(str(bringup / 'launch/tb3_simulation_launch.py')),
            launch_arguments={'world': str(folder / 'hospital.sdf'), 'map': str(folder / 'hospital.yaml'),
                              'params_file': name, 'use_sim_time': 'true', 'x_pose': str(spawn['x']), 'y_pose': str(spawn['y']),
                              'yaw': str(spawn['yaw']), 'headless': LaunchConfiguration('headless'),
                              'use_rviz': 'False', 'use_simulator': 'False'}.items()),

        RegisterEventHandler(OnShutdown(on_shutdown=[OpaqueFunction(function=lambda _: Path(name).unlink(missing_ok=True) or [])])),
    ]


def generate_launch_description():
    return LaunchDescription([
        DeclareLaunchArgument('map_dir', default_value=str(Path(__file__).parent / 'generated')),
        DeclareLaunchArgument('headless', default_value='false'),
        OpaqueFunction(function=start),
    ])
