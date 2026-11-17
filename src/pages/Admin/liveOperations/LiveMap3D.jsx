import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const WALL_HEIGHT = 1.2;
const OCCUPIED_SHADE = 89;
const ZONE_COLORS = { KEEP_OUT: '#e11d48', SPEED: '#2563eb', NO_STOP: '#d97706' };

function endpointLabel(name, size) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 80;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#142235';
  ctx.fillRect(0, 0, 512, 80);
  ctx.font = '36px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'white';
  ctx.fillText(name, 256, 40, 480);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture }));
  sprite.scale.set(size * 8, size * 1.25, 1);
  return sprite;
}

function disposeLayer(group) {
  group.traverse(object => {
    object.geometry?.dispose();
    object.material?.map?.dispose();
    object.material?.dispose();
  });
  group.clear();
}

function wallGeometry(data, width, height, scale) {
  const occupied = new Uint8Array(width * height);
  for (let i = 0; i < occupied.length; i += 1) {
    occupied[i] = Number(data[i * 4 + 3] === 255 && data[i * 4] <= OCCUPIED_SHADE);
  }
  const cell = (col, row) => col >= 0 && col < width && row >= 0 && row < height ? occupied[row * width + col] : 0;
  const x = col => (col - width / 2) * scale;
  const z = row => (row - height / 2) * scale;
  const positions = [];
  const indices = [];
  const quad = (a, b, c, d, reverse = false) => {
    const i = positions.length / 3;
    positions.push(...a, ...b, ...c, ...d);
    if (reverse) indices.push(i, i + 2, i + 1, i, i + 3, i + 2);
    else indices.push(i, i + 1, i + 2, i, i + 2, i + 3);
  };
  // Merge consecutive exposed edges, omitting all internal wall faces.
  const spans = (length, read, draw) => {
    let start = 0;
    let value = 0;
    for (let i = 0; i <= length; i += 1) {
      const next = i < length ? read(i) : 0;
      if (next !== value) {
        if (value) draw(start, i, value);
        start = i;
        value = next;
      }
    }
  };
  for (let row = 0; row <= height; row += 1) {
    const depth = z(row);
    spans(width, col => cell(col, row) - cell(col, row - 1), (start, end, side) => {
      quad([x(start), 0, depth], [x(start), WALL_HEIGHT, depth],
        [x(end), WALL_HEIGHT, depth], [x(end), 0, depth], side < 0);
    });
    if (row < height) spans(width, col => cell(col, row), (start, end) => {
      quad([x(start), WALL_HEIGHT, depth], [x(start), WALL_HEIGHT, z(row + 1)],
        [x(end), WALL_HEIGHT, z(row + 1)], [x(end), WALL_HEIGHT, depth]);
    });
  }
  for (let col = 0; col <= width; col += 1) {
    const offset = x(col);
    spans(height, row => cell(col, row) - cell(col - 1, row), (start, end, side) => {
      quad([offset, 0, z(start)], [offset, 0, z(end)],
        [offset, WALL_HEIGHT, z(end)], [offset, WALL_HEIGHT, z(start)], side < 0);
    });
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export default function LiveMap3D({ asset, position, heading, live, path, destination, endpoints, zones }) {
  const host = useRef(null);
  const sceneRef = useRef(null);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    let disposed = false;
    let renderer, controls, observer, scene, texture;
    setStatus('loading');
    const element = host.current;
    const { width_px: width, height_px: height, resolution_m_per_pixel: scale } = asset.metadata;
    const span = Math.max(width * scale, height * scale);
    const paint = async () => {
      const bitmap = new Image();
      bitmap.src = asset.url;
      await bitmap.decode();
      if (disposed) return;
      if (bitmap.naturalWidth !== width || bitmap.naturalHeight !== height) throw new Error('Invalid map dimensions');
      const raster = document.createElement('canvas');
      raster.width = width;
      raster.height = height;
      const context = raster.getContext('2d');
      context.drawImage(bitmap, 0, 0);
      const pixels = context.getImageData(0, 0, width, height).data;

      scene = new THREE.Scene();
      scene.background = new THREE.Color('#142235');
      const camera = new THREE.PerspectiveCamera(45, 1, Math.max(.005, span / 10000), span * 20 + 20);
      camera.position.set(span * .65, span * 1.05 + WALL_HEIGHT, span * .85);
      renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      element.appendChild(renderer.domElement);
      controls = new OrbitControls(camera, renderer.domElement);
      controls.maxPolarAngle = Math.PI / 2 - .02;
      controls.maxDistance = span * 8 + 5;
      const draw = () => renderer.render(scene, camera);
      controls.addEventListener('change', draw);
      scene.add(new THREE.HemisphereLight('#edf5ff', '#5d6d84', 2));
      const sun = new THREE.DirectionalLight('#fff7ea', 2);
      sun.position.set(-span, span + 2, span);
      scene.add(sun);

      texture = new THREE.CanvasTexture(raster);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.magFilter = THREE.NearestFilter;
      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(width * scale, height * scale),
        new THREE.MeshBasicMaterial({ map: texture }),
      );
      floor.rotation.x = -Math.PI / 2;
      scene.add(floor);
      const walls = new THREE.Mesh(
        wallGeometry(pixels, width, height, scale),
        new THREE.MeshStandardMaterial({ color: '#d5dfeb', roughness: .9 }),
      );
      scene.add(walls);

      const markerSize = Math.max(.1, span * .015);
      const marker = new THREE.Mesh(new THREE.ConeGeometry(markerSize, markerSize * 2, 3), new THREE.MeshBasicMaterial({ color: '#2563eb' }));
      marker.geometry.rotateZ(-Math.PI / 2);
      const goal = new THREE.Mesh(new THREE.SphereGeometry(markerSize * .65), new THREE.MeshBasicMaterial({ color: '#f59e0b' }));
      const route = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: '#2563eb' }));
      marker.visible = goal.visible = route.visible = false;
      const annotations = new THREE.Group();
      scene.add(marker, goal, route, annotations);
      sceneRef.current = { marker, goal, route, draw, markerSize, annotations };
      observer = new ResizeObserver(() => {
        const w = element.clientWidth;
        const h = element.clientHeight;
        if (!w || !h) return;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
        draw();
      });
      observer.observe(element);
      controls.update();
      setStatus('ready');
    };
    paint().catch(() => { if (!disposed) setStatus('error'); });
    return () => {
      disposed = true;
      sceneRef.current = null;
      observer?.disconnect();
      controls?.dispose();
      scene?.traverse(object => {
        object.geometry?.dispose();
        if (object.isSprite) object.material.map?.dispose();
        object.material?.dispose();
      });
      texture?.dispose();
      renderer?.dispose();
      renderer?.domElement.remove();
    };
  }, [asset]);

  useEffect(() => {
    const layer = sceneRef.current;
    if (status !== 'ready' || !layer) return;
    const { annotations, draw, markerSize } = layer;
    const { width_px: width, height_px: height, resolution_m_per_pixel: scale } = asset.metadata;
    const x = point => (point.x - width / 2) * scale;
    const z = point => (point.y - height / 2) * scale;
    for (const zone of zones) {
      const shape = new THREE.Shape(zone.points.map(point => new THREE.Vector2(x(point), -z(point))));
      const color = ZONE_COLORS[zone.type] || '#7c3aed';
      const area = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshBasicMaterial({
        color, opacity: .34, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      }));
      area.rotation.x = -Math.PI / 2;
      area.position.y = .008;
      const border = new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints(zone.points.map(point => new THREE.Vector3(x(point), .013, z(point)))),
        new THREE.LineBasicMaterial({ color }),
      );
      annotations.add(area, border);
    }
    for (const { point, name } of endpoints) {
      const pin = new THREE.Mesh(new THREE.SphereGeometry(markerSize * .48, 12, 8), new THREE.MeshBasicMaterial({ color: '#078b83' }));
      pin.position.set(x(point), markerSize * .52, z(point));
      annotations.add(pin);
      if (name) {
        const label = endpointLabel(name, markerSize);
        label.position.set(x(point), markerSize * 2.3, z(point));
        annotations.add(label);
      }
    }
    draw();
    return () => disposeLayer(annotations);
  }, [asset, status, endpoints, zones]);

  useEffect(() => {
    const layer = sceneRef.current;
    if (status !== 'ready' || !layer) return;
    const { width_px: width, height_px: height, resolution_m_per_pixel: scale } = asset.metadata;
    const at = point => new THREE.Vector3((point.x - width / 2) * scale, layer.markerSize, (point.y - height / 2) * scale);
    const { marker, goal, route, draw } = layer;
    marker.visible = Boolean(position);
    if (position) {
      marker.position.copy(at(position));
      marker.rotation.y = Number.isFinite(heading) ? heading : 0;
      marker.material.color.set(live ? '#2563eb' : '#94a3b8');
    }
    goal.visible = Boolean(destination);
    if (destination) goal.position.copy(at(destination));
    route.geometry.dispose();
    route.geometry = new THREE.BufferGeometry().setFromPoints(path ? path.map(at) : []);
    route.visible = Boolean(path?.length);
    draw();
  }, [asset, status, position, heading, live, path, destination]);

  return <div className="rm-map-3d">
    <div className="rm-map-3d-scene" ref={host} aria-label="Mặt bằng 3D và vị trí robot" />
    {status === 'loading' && <p role="status">Đang dựng bản đồ 3D…</p>}
    {status === 'error' && <p role="alert">Không mở được bản đồ 3D. Hãy dùng chế độ 2D.</p>}
  </div>;
}
