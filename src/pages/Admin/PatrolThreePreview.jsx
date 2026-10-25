import { Component, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { MAP, FLOOR, WALLS, OBSTACLES } from './lidarGeometry.js';

const at = point => new THREE.Vector3((point.x - MAP.width / 2) * MAP.resolution, 0, (point.y - MAP.height / 2) * MAP.resolution);

function label(text, color = '#eaf4ff') {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 96;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#101e35df'; ctx.beginPath(); ctx.roundRect(3, 4, 506, 86, 18); ctx.fill();
  ctx.strokeStyle = '#5698dd'; ctx.stroke();
  ctx.fillStyle = color; ctx.font = 'bold 30px Arial'; ctx.textAlign = 'center';
  ctx.fillText(text.slice(0, 28), 256, 60);
  const texture = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false }));
  sprite.scale.set(3.7, .7, 1);
  return sprite;
}

class PreviewBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <div className="patrol-empty" role="alert"><h3>Chưa mở được chế độ 3D</h3><p>Trình duyệt chưa khởi tạo được đồ họa 3D. Bạn có thể tiếp tục bằng Bản đồ 2D hoặc bật tăng tốc đồ họa trong trình duyệt.</p></div> : this.props.children;
  }
}

export default function PatrolThreePreview(props) {
  return <PreviewBoundary><ThreeScene {...props} /></PreviewBoundary>;
}

function ThreeScene({ map, plan, position }) {
  const host = useRef(null);
  const live = useRef(null);
  const routeLayer = useRef(null);
  const fitView = useRef(null);
  useEffect(() => {
    const element = host.current;
    if (!element || !map) return;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#101a2a');
    scene.fog = new THREE.Fog('#101a2a', 42, 95);
    const camera = new THREE.PerspectiveCamera(48, 1, .1, 150);
    camera.position.set(20, 29, 31);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    element.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI / 2.08;
    controls.minDistance = 12; controls.maxDistance = 85;
    scene.add(new THREE.HemisphereLight('#d9efff', '#506173', 2.6));
    const sun = new THREE.DirectionalLight('#ffffff', 2.5);
    sun.position.set(-14, 30, 18); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -40; sun.shadow.camera.right = 40;
    sun.shadow.camera.top = 40; sun.shadow.camera.bottom = -40;
    scene.add(sun);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 55), new THREE.MeshStandardMaterial({ color: '#1e3045', roughness: .9 }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; ground.position.y = -.09; scene.add(ground);
    const floorShape = new THREE.Shape();
    FLOOR.forEach((p, i) => { const v = at(p); i ? floorShape.lineTo(v.x, v.z) : floorShape.moveTo(v.x, v.z); });
    floorShape.closePath();
    const floor = new THREE.Mesh(new THREE.ShapeGeometry(floorShape), new THREE.MeshStandardMaterial({ color: '#a8b9c8', roughness: .86, side: THREE.DoubleSide }));
    floor.rotation.x = Math.PI / 2; floor.position.y = .015; floor.receiveShadow = true; scene.add(floor);
    const wallMaterial = new THREE.MeshStandardMaterial({ color: '#d7e5ed', roughness: .58 });
    WALLS.forEach(([start, end]) => {
      const a = at(start), b = at(end), length = a.distanceTo(b);
      const wall = new THREE.Mesh(new THREE.BoxGeometry(length, 2.3, .14), wallMaterial);
      wall.position.copy(a).add(b).multiplyScalar(.5); wall.position.y = 1.15;
      wall.rotation.y = -Math.atan2(b.z - a.z, b.x - a.x);
      wall.castShadow = true; wall.receiveShadow = true; scene.add(wall);
    });
    const furniture = new THREE.MeshStandardMaterial({ color: '#546b82', roughness: .8 });
    OBSTACLES.forEach(item => {
      const center = at({ x: item.x + item.w / 2, y: item.y + item.h / 2 });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(item.w * MAP.resolution, .65, item.h * MAP.resolution), furniture);
      mesh.position.set(center.x, .33, center.z); mesh.castShadow = true; scene.add(mesh);
    });
    const colors = { KEEP_OUT: '#ef5d76', SPEED: '#efb84b', NO_STOP: '#f97316' };
    map.zones.forEach(zone => {
      if (zone.enabled === false || !zone.points?.length) return;
      const shape = new THREE.Shape();
      zone.points.forEach((p, i) => { const v = at(p); i ? shape.lineTo(v.x, v.z) : shape.moveTo(v.x, v.z); });
      shape.closePath();
      const overlay = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshBasicMaterial({ color: colors[zone.type] || '#4ca3ff', transparent: true, opacity: .43, side: THREE.DoubleSide, depthWrite: false }));
      overlay.rotation.x = Math.PI / 2; overlay.position.y = .035; scene.add(overlay);
    });
    routeLayer.current = new THREE.Group(); scene.add(routeLayer.current);
    const robot = new THREE.Group();
    const chassis = new THREE.Mesh(new THREE.CylinderGeometry(.44, .44, .35, 32), new THREE.MeshStandardMaterial({ color: '#1d65d8', metalness: .28, roughness: .38 }));
    chassis.position.y = .34; chassis.castShadow = true; robot.add(chassis);
    const turret = new THREE.Mesh(new THREE.BoxGeometry(.5, .36, .4), new THREE.MeshStandardMaterial({ color: '#f2f8ff', roughness: .3 }));
    turret.position.y = .7; turret.castShadow = true; robot.add(turret);
    const lens = new THREE.Mesh(new THREE.BoxGeometry(.2, .12, .02), new THREE.MeshStandardMaterial({ color: '#39c9ec', emissive: '#0a7b9e', emissiveIntensity: .5 }));
    lens.position.set(0, .72, -.22); robot.add(lens);
    const robotName = label('MAR-01'); robotName.position.y = 1.7; robot.add(robotName);
    robot.visible = false; scene.add(robot); live.current = robot;
    const fit = () => {
      const vertical = THREE.MathUtils.degToRad(camera.fov / 2);
      const horizontal = Math.atan(Math.tan(vertical) * camera.aspect);
      const radius = 29;
      const distance = radius / Math.sin(Math.min(vertical, horizontal)) * 1.08;
      controls.maxDistance = Math.max(110, distance * 1.5);
      camera.far = Math.max(180, distance * 3); camera.updateProjectionMatrix();
      controls.target.set(0, 0, 0); camera.position.copy(new THREE.Vector3(20, 29, 31).normalize().multiplyScalar(distance));
      scene.fog.near = distance + 40; scene.fog.far = distance + 100;
      controls.update();
    };
    fitView.current = fit;
    const resize = () => { const width = element.clientWidth, height = element.clientHeight; if (!width || !height) return; camera.aspect = width / height; camera.updateProjectionMatrix(); renderer.setSize(width, height); fit(); };
    const observer = new ResizeObserver(resize); observer.observe(element); resize();
    let frame;
    const draw = () => { frame = requestAnimationFrame(draw); controls.update(); renderer.render(scene, camera); };
    draw();
    return () => { live.current = null; cancelAnimationFrame(frame); observer.disconnect(); controls.dispose(); scene.traverse(object => { object.geometry?.dispose(); const materials = object.material ? (Array.isArray(object.material) ? object.material : [object.material]) : []; materials.forEach(material => { material.map?.dispose(); material.dispose(); }); }); renderer.dispose(); element.removeChild(renderer.domElement); };
  }, [map]);
  useEffect(() => {
    const group = routeLayer.current;
    if (!group) return;
    (plan?.points || []).forEach(({ endpoint }, index) => {
      if (!endpoint) return;
      const marker = new THREE.Group();
      const pin = new THREE.Mesh(new THREE.CylinderGeometry(.24, .24, .09, 24), new THREE.MeshStandardMaterial({ color: '#3585ff' }));
      pin.position.y = .12; marker.add(pin);
      const title = label(`${index + 1}. ${endpoint.name}`); title.position.y = 1.3; marker.add(title);
      marker.position.copy(at(endpoint)); group.add(marker);
    });
    if (plan?.path?.length > 1) {
      const points = plan.path.map(p => { const v = at(p); v.y = .11; return v; });
      group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: '#3387ff' })));
    }
    return () => {
      group.traverse(object => { object.geometry?.dispose(); object.material?.map?.dispose(); object.material?.dispose(); });
      group.clear();
    };
  }, [map, plan]);
  useEffect(() => {
    if (!live.current) return;
    live.current.visible = !!position;
    if (!position) return;
    const point = at(position); live.current.position.set(point.x, 0, point.z);
    live.current.rotation.y = (Number(position.heading) || 0) * Math.PI / 180 - Math.PI / 2;
  }, [position, map]);
  return <div className="patrol-three-scene" ref={host} role="group" aria-label="Mô phỏng 3D của robot và tuyến tuần tra"><button className="three-fit" type="button" onClick={() => fitView.current?.()}>Vừa khung 3D</button><span>Kéo để xoay · Cuộn để phóng to</span></div>;
}
