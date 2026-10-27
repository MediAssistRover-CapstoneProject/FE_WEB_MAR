#!/usr/bin/env bash
set -eo pipefail
source /opt/ros/jazzy/setup.bash
set -u

if [[ ! -s /input/map.yaml ]]; then
  echo 'Thiếu YAML/PGM gốc trong /input.' >&2
  exit 2
fi

python3 /app/prepare_map.py /input/map.yaml --config /app/geometry-config.json --output /app/generated

headless=True
use_rviz=False
if [[ "${SIM_GUI:-false}" == "true" ]]; then
  export DISPLAY=:99
  # A Docker restart can leave only Xvfb's socket/lock behind.  It prevents a
  # fresh virtual desktop and would otherwise stop Gazebo and RViz before ROS
  # receives /clock. These are container-local, ephemeral display files.
  rm -f /tmp/.X99-lock /tmp/.X11-unix/X99
  Xvfb :99 -screen 0 1600x900x24 -nolisten tcp +extension GLX &
  sleep 2
  fluxbox -display :99 >/tmp/fluxbox.log 2>&1 &
  x11vnc -display :99 -listen 127.0.0.1 -rfbport 5900 -nopw -forever -shared >/tmp/x11vnc.log 2>&1 &
  websockify --web=/usr/share/novnc 6080 127.0.0.1:5900 >/tmp/websockify.log 2>&1 &
  headless=False
  use_rviz=True
  echo 'Giao diện Gazebo/RViz2: http://localhost:6080/vnc.html'
fi

ros2 launch /app/hospital.launch.py map_dir:=/app/generated headless:="$headless" use_rviz:="$use_rviz" &
sim_pid=$!
python3 /app/bridge.py --map /app/generated/hospital.gazebo.json --bind 0.0.0.0 --origin "${FE_ORIGIN:-http://localhost:5173}" &
bridge_pid=$!

shutdown() {
  kill -INT "$bridge_pid" 2>/dev/null || true
  kill -INT "$sim_pid" 2>/dev/null || true
  wait "$bridge_pid" 2>/dev/null || true
  wait "$sim_pid" 2>/dev/null || true
}
trap shutdown INT TERM
wait -n "$sim_pid" "$bridge_pid" || true
shutdown
