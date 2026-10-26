FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl \
    && curl -fL --retry 5 -o /tmp/ros2-apt-source.deb https://github.com/ros-infrastructure/ros-apt-source/releases/download/1.3.0/ros2-apt-source_1.3.0.noble_all.deb \
    && dpkg -i /tmp/ros2-apt-source.deb \
    && apt-get update && apt-get install -y --no-install-recommends \
    ros-jazzy-desktop \
    ros-jazzy-navigation2 \
    ros-jazzy-nav2-bringup \
    ros-jazzy-nav2-minimal-tb3-sim \
    python3-pil python3-yaml \
    xvfb x11vnc fluxbox novnc websockify \
    libgl1-mesa-dri mesa-utils \
    && rm -rf /var/lib/apt/lists/* /tmp/ros2-apt-source.deb

WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3-paho-mqtt && rm -rf /var/lib/apt/lists/*
COPY prepare_map.py map_processing.py geometry-config.json bridge.py bridge_contract.py mqtt_adapter.py hospital.launch.py entrypoint.sh ./
RUN chmod +x /app/entrypoint.sh && mkdir -p /app/generated

ENV ROS_DOMAIN_ID=77 \
    ROS_AUTOMATIC_DISCOVERY_RANGE=LOCALHOST \
    PYTHONUNBUFFERED=1 \
    LIBGL_ALWAYS_SOFTWARE=1 \
    QT_X11_NO_MITSHM=1

EXPOSE 8765 6080
ENTRYPOINT ["/app/entrypoint.sh"]
