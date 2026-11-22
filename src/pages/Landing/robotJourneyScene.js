import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createMentorRobot } from './mentorRobotModel.js';

export const JOURNEY_STATIONS = ['Khoa Dược', 'Phòng khám', 'Khu điều trị', 'Xét nghiệm'];

// Closed rounded corridor loop keeping all rooms outside the robot's swept path.
function hospitalRoute() {
  const route = new THREE.CurvePath();
  const at = (x, z) => new THREE.Vector3(x, 0.025, z);
  const line = (a, b) => route.add(new THREE.LineCurve3(at(...a), at(...b)));
  const corner = (a, b, c) => route.add(new THREE.QuadraticBezierCurve3(at(...a), at(...b), at(...c)));
  line([0, 2.05], [1.9, 2.05]); corner([1.9, 2.05], [2.55, 2.05], [2.55, 1.4]);
  line([2.55, 1.4], [2.55, -1.4]); corner([2.55, -1.4], [2.55, -2.05], [1.9, -2.05]);
  line([1.9, -2.05], [-1.9, -2.05]); corner([-1.9, -2.05], [-2.55, -2.05], [-2.55, -1.4]);
  line([-2.55, -1.4], [-2.55, 1.4]); corner([-2.55, 1.4], [-2.55, 2.05], [-1.9, 2.05]);
  line([-1.9, 2.05], [0, 2.05]);
  return route;
}

// Procedural tiled hospital epoxy floor texture with subtle architectural sheen.
function createFloorTexture() {
  const size = 512;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');

  // Soft cool-slate epoxy base
  const grad = ctx.createRadialGradient(size / 2, size / 2, 20, size / 2, size / 2, size * 0.72);
  grad.addColorStop(0, '#1e4661');
  grad.addColorStop(0.65, '#173850');
  grad.addColorStop(1, '#10293d');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Subtle terrazzo speckles
  ctx.fillStyle = 'rgba(180, 230, 255, 0.035)';
  for (let i = 0; i < 420; i++) {
    const x = (i * 197.3) % size;
    const y = (i * 311.7) % size;
    ctx.fillRect(x, y, 2, 2);
  }

  // Tile grout lines
  const step = size / 16;
  ctx.strokeStyle = 'rgba(125, 211, 252, 0.11)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 16; i++) {
    const p = Math.round(i * step) + 0.5;
    ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(size, p); ctx.stroke();
  }

  // Subtle corridor lane outline
  ctx.strokeStyle = 'rgba(94, 234, 212, 0.14)';
  ctx.lineWidth = 2;
  ctx.strokeRect(size * 0.15, size * 0.16, size * 0.7, size * 0.68);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// Soft radial shadow/glow texture for contact shadows and floor light projection.
function createRadialTexture(innerColor, outerColor) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  g.addColorStop(0, innerColor);
  g.addColorStop(0.5, innerColor.replace(/[\d.]+\)$/, '0.35)'));
  g.addColorStop(1, outerColor);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

function disposeScene(scene) {
  const resources = new Set();
  scene.traverse(object => {
    if (object.geometry) resources.add(object.geometry);
    const materials = object.material ? [].concat(object.material) : [];
    materials.forEach(material => {
      Object.values(material).forEach(value => { if (value?.isTexture) resources.add(value); });
      resources.add(material);
    });
  });
  resources.forEach(resource => resource.dispose());
}

export function createRobotJourney(host, { paused = false, onStatus, onReady, onUnavailable } = {}) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('webgl2', { alpha: true, antialias: true, powerPreference: 'high-performance' });
  if (!context) { onUnavailable?.(); return { dispose() {}, setPaused() {}, reset() {}, setViewMode() {} }; }

  let renderer, controls, pmrem, envRT, roomEnv, resizeObserver, intersectionObserver, frame = 0;
  let removeListeners = () => {};
  let disposed = false, visible = true, simulationTime = 0, lastTime = 0, lastStatus = '', lastTelemetry = -1;
  let viewMode = 'overview'; // 'overview' | 'follow'
  const scene = new THREE.Scene();
  const labels = [];

  const floorTex = createFloorTexture();
  const shadowTex = createRadialTexture('rgba(3, 12, 24, 0.72)', 'rgba(3, 12, 24, 0)');
  const glowTex = createRadialTexture('rgba(94, 234, 212, 0.65)', 'rgba(94, 234, 212, 0)');

  const materials = {
    floor: new THREE.MeshStandardMaterial({ map: floorTex, metalness: 0.18, roughness: 0.34 }),
    base: new THREE.MeshStandardMaterial({ color: '#0a1d30', metalness: 0.45, roughness: 0.45 }),
    wall: new THREE.MeshStandardMaterial({ color: '#c8dce9', metalness: 0.08, roughness: 0.48 }),
    wallAccent: new THREE.MeshStandardMaterial({ color: '#7ea2b8', metalness: 0.22, roughness: 0.42 }),
    roof: new THREE.MeshStandardMaterial({ color: '#e4f0f7', metalness: 0.1, roughness: 0.42 }),
    roofInset: new THREE.MeshStandardMaterial({ color: '#335269', metalness: 0.28, roughness: 0.55 }),
    glass: new THREE.MeshStandardMaterial({
      color: '#7cd8e0', emissive: '#1e6e7d', emissiveIntensity: 0.28,
      metalness: 0.65, roughness: 0.12, transparent: true, opacity: 0.82,
    }),
    warmInterior: new THREE.MeshStandardMaterial({
      color: '#ffefc8', emissive: '#ffcf7d', emissiveIntensity: 0.85, roughness: 0.6,
    }),
    mullion: new THREE.MeshStandardMaterial({ color: '#2b475d', metalness: 0.5, roughness: 0.35 }),
    crossWhite: new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#7efce5', emissiveIntensity: 0.55, roughness: 0.2 }),
    trimTeal: new THREE.MeshStandardMaterial({ color: '#5eead4', emissive: '#2dd4bf', emissiveIntensity: 0.9, roughness: 0.25 }),
    wood: new THREE.MeshStandardMaterial({ color: '#b48a5f', roughness: 0.65, metalness: 0.05 }),
    pot: new THREE.MeshStandardMaterial({ color: '#dce8f0', roughness: 0.5, metalness: 0.1 }),
    leaf: new THREE.MeshStandardMaterial({ color: '#2e8f6e', roughness: 0.62, metalness: 0.05 }),
    leafLight: new THREE.MeshStandardMaterial({ color: '#45b288', roughness: 0.58, metalness: 0.05 }),
  };

  const addBox = (w, h, d, x, y, z, mat, parent = scene, cast = true) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.receiveShadow = true;
    m.castShadow = cast;
    parent.add(m);
    return m;
  };

  const addPlant = (x, z) => {
    const g = new THREE.Group();
    g.position.set(x, 0.02, z);
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.085, 0.16, 12), materials.pot);
    pot.position.y = 0.08; pot.castShadow = true; pot.receiveShadow = true; g.add(pot);
    const crown1 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.14, 1), materials.leaf);
    crown1.position.set(0, 0.25, 0); crown1.castShadow = true; g.add(crown1);
    const crown2 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.095, 1), materials.leafLight);
    crown2.position.set(0.06, 0.34, 0.04); crown2.castShadow = true; g.add(crown2);
    scene.add(g);
  };

  const addBench = (x, z, rotY = 0) => {
    const g = new THREE.Group();
    g.position.set(x, 0.02, z);
    g.rotation.y = rotY;
    addBox(0.56, 0.04, 0.2, 0, 0.14, 0, materials.wood, g);
    addBox(0.04, 0.12, 0.16, -0.22, 0.06, 0, materials.mullion, g);
    addBox(0.04, 0.12, 0.16, 0.22, 0.06, 0, materials.mullion, g);
    scene.add(g);
  };

  const makeLabel = (text, position) => {
    const element = document.createElement('span');
    element.className = 'lp-journey-map-label';
    element.textContent = text;
    element.setAttribute('aria-hidden', 'true');
    host.appendChild(element);
    labels.push({ element, position: new THREE.Vector3(...position) });
  };

  try {
    renderer = new THREE.WebGLRenderer({ canvas, context, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    canvas.setAttribute('aria-label', 'Robot MediAssistRover di chuyển trên bản đồ bệnh viện 3D');
    canvas.setAttribute('role', 'img');
    host.appendChild(canvas);

    // Physically-based IBL environment for realistic metal, glass and epoxy reflections
    pmrem = new THREE.PMREMGenerator(renderer);
    roomEnv = new RoomEnvironment();
    envRT = pmrem.fromScene(roomEnv, 0.04);
    scene.environment = envRT.texture;
    scene.environmentIntensity = 0.85;

    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 80);
    const overviewPos = new THREE.Vector3(7.6, 7.5, 9.2);
    const overviewTarget = new THREE.Vector3(0, 0.22, 0.1);
    camera.position.copy(overviewPos);

    controls = new OrbitControls(camera, canvas);
    controls.target.copy(overviewTarget);
    controls.enablePan = false;
    controls.enableZoom = false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.minPolarAngle = 0.38;
    controls.maxPolarAngle = 1.18;
    controls.rotateSpeed = 0.55;
    controls.touches.ONE = null;
    controls.touches.TWO = null;
    canvas.style.touchAction = 'pan-y';

    // Balanced architectural studio lighting
    scene.add(new THREE.HemisphereLight('#e4f7ff', '#1b3852', 1.45));

    const key = new THREE.DirectionalLight('#fff6e6', 2.4);
    key.position.set(-4.5, 11, 7);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -6.2; key.shadow.camera.right = 6.2;
    key.shadow.camera.top = 6.2; key.shadow.camera.bottom = -6.2;
    key.shadow.bias = -0.0005;
    key.shadow.normalBias = 0.03;
    scene.add(key);

    const rim = new THREE.DirectionalLight('#5eead4', 1.35);
    rim.position.set(6, 5, -5);
    scene.add(rim);

    // ==================== HOSPITAL FLOOR & PLINTH ====================
    addBox(9.3, 0.28, 8.1, 0, -0.17, 0, materials.base);
    addBox(9.18, 0.06, 7.98, 0, -0.005, 0, materials.floor, scene, false);
    // Subtle glowing architectural perimeter strip
    const perimeter = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(9.22, 0.07, 8.02)),
      new THREE.LineBasicMaterial({ color: '#5eead4', transparent: true, opacity: 0.42 })
    );
    perimeter.position.y = 0.005;
    scene.add(perimeter);

    // ==================== CENTRAL CARE HUB ====================
    const hub = new THREE.Group();
    scene.add(hub);
    addBox(3.1, 0.58, 2.0, 0, 0.31, 0, materials.wall, hub);
    // Recessed roof parapet & skylight
    addBox(3.22, 0.08, 2.12, 0, 0.63, 0, materials.roof, hub);
    addBox(2.86, 0.05, 1.76, 0, 0.66, 0, materials.roofInset, hub, false);
    // Glowing medical cross emblem on the roof
    addBox(0.2, 0.035, 0.72, 0, 0.705, 0, materials.crossWhite, hub, false);
    addBox(0.72, 0.035, 0.2, 0, 0.705, 0, materials.crossWhite, hub, false);
    // Subtle cyan accent bars on parapet
    addBox(1.2, 0.025, 0.04, -0.82, 0.685, -0.82, materials.trimTeal, hub, false);
    addBox(1.2, 0.025, 0.04, 0.82, 0.685, 0.82, materials.trimTeal, hub, false);

    // Floor-to-ceiling glass bays with warm glowing interior
    for (const zSide of [-1, 1]) {
      for (const x of [-1.02, 0, 1.02]) {
        addBox(0.72, 0.34, 0.02, x, 0.33, zSide * 0.995, materials.warmInterior, hub, false);
        addBox(0.76, 0.38, 0.03, x, 0.33, zSide * 1.01, materials.glass, hub, false);
        addBox(0.035, 0.4, 0.04, x - 0.39, 0.33, zSide * 1.015, materials.mullion, hub, false);
      }
    }
    for (const xSide of [-1, 1]) {
      addBox(0.02, 0.34, 1.12, xSide * 1.545, 0.33, 0, materials.warmInterior, hub, false);
      addBox(0.03, 0.38, 1.18, xSide * 1.56, 0.33, 0, materials.glass, hub, false);
    }

    // ==================== SURROUNDING DEPARTMENT WINGS ====================
    const addWing = (x, z, w, d, faceAxis = 'z', faceDir = 1) => {
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      scene.add(g);
      addBox(w, 0.54, d, 0, 0.29, 0, materials.wall, g);
      addBox(w + 0.09, 0.065, d + 0.09, 0, 0.59, 0, materials.roof, g);
      addBox(w - 0.16, 0.03, d - 0.16, 0, 0.62, 0, materials.roofInset, g, false);

      // Architectural glass facade + warm interior facing the corridor
      if (faceAxis === 'z') {
        addBox(w * 0.68, 0.28, 0.02, 0, 0.31, faceDir * (d / 2 - 0.005), materials.warmInterior, g, false);
        addBox(w * 0.72, 0.31, 0.03, 0, 0.31, faceDir * (d / 2 + 0.012), materials.glass, g, false);
        addBox(w * 0.76, 0.03, 0.04, 0, 0.48, faceDir * (d / 2 + 0.018), materials.wallAccent, g, false);
      } else {
        addBox(0.02, 0.28, d * 0.68, faceDir * (w / 2 - 0.005), 0.31, 0, materials.warmInterior, g, false);
        addBox(0.03, 0.31, d * 0.72, faceDir * (w / 2 + 0.012), 0.31, 0, materials.glass, g, false);
        addBox(0.04, 0.03, d * 0.76, faceDir * (w / 2 + 0.018), 0.48, 0, materials.wallAccent, g, false);
      }
    };

    // North (Khu điều trị), South (Khoa Dược), West (Xét nghiệm), East (Phòng khám)
    addWing(-1.85, -3.42, 2.25, 0.68, 'z', 1);
    addWing(1.55, -3.42, 2.25, 0.68, 'z', 1);
    addWing(-1.75, 3.42, 2.25, 0.68, 'z', -1);
    addWing(1.75, 3.42, 2.25, 0.68, 'z', -1);
    addWing(-3.98, -0.5, 0.62, 2.35, 'x', 1);
    addWing(3.98, 0.5, 0.62, 2.35, 'x', -1);

    // Hospital greenery & benches for warmth and realism
    addPlant(-3.45, 2.68);
    addPlant(3.45, -2.68);
    addPlant(-3.45, -2.68);
    addPlant(3.45, 2.68);
    addBench(-3.4, 1.55, Math.PI / 2);
    addBench(3.4, -1.55, Math.PI / 2);

    // ==================== NAVIGATION TRACK & STATIONS ====================
    const route = hospitalRoute();
    scene.add(new THREE.Mesh(
      new THREE.TubeGeometry(route, 200, 0.028, 8, false),
      new THREE.MeshBasicMaterial({ color: '#5eead4' })
    ));
    const routeGlow = new THREE.Mesh(
      new THREE.TubeGeometry(route, 160, 0.11, 8, false),
      new THREE.MeshBasicMaterial({ color: '#2dd4bf', transparent: true, opacity: 0.12, depthWrite: false })
    );
    routeGlow.position.y = -0.01;
    scene.add(routeGlow);

    const stations = [];
    const labelPositions = [[0, 0.85, 3.35], [3.75, 1.05, 0.25], [0, 1.05, -3.32], [-3.75, 1.05, -0.25]];
    for (let i = 0; i < 4; i++) {
      const pt = route.getPointAt(i / 4);
      const pad = new THREE.Group();
      pad.position.set(pt.x, 0.035, pt.z);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.24, 0.024, 10, 36),
        new THREE.MeshBasicMaterial({ color: i === 0 ? '#7efce5' : '#4a88a3' })
      );
      ring.rotation.x = -Math.PI / 2;
      pad.add(ring);

      const disc = new THREE.Mesh(
        new THREE.CircleGeometry(0.22, 28),
        new THREE.MeshBasicMaterial({ color: '#5eead4', transparent: true, opacity: 0.14, depthWrite: false })
      );
      disc.rotation.x = -Math.PI / 2;
      disc.position.y = -0.005;
      pad.add(disc);
      scene.add(pad);
      stations.push({ ring, disc });
      makeLabel(JOURNEY_STATIONS[i], labelPositions[i]);
    }

    // ==================== MENTORPI M1 ROBOT & DYNAMIC FX ====================
    const { group: robot, wheels, lidar } = createMentorRobot(THREE);
    robot.scale.setScalar(1.24);
    scene.add(robot);

    // Soft contact shadow directly under the robot
    const contactShadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.55, 1.75),
      new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false })
    );
    contactShadow.rotation.x = -Math.PI / 2;
    contactShadow.position.y = 0.032;
    scene.add(contactShadow);

    // Subtle floor glow & LiDAR scan ring around the robot
    const floorGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(2.0, 2.0),
      new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, opacity: 0.34, depthWrite: false })
    );
    floorGlow.rotation.x = -Math.PI / 2;
    floorGlow.position.y = 0.036;
    scene.add(floorGlow);

    const beacon = new THREE.Mesh(
      new THREE.RingGeometry(0.76, 0.79, 48),
      new THREE.MeshBasicMaterial({ color: '#5eead4', transparent: true, opacity: 0.42, side: THREE.DoubleSide, depthWrite: false })
    );
    beacon.rotation.x = -Math.PI / 2;
    beacon.position.y = 0.04;
    scene.add(beacon);

    // Live cyan point light riding with the robot to reflect on nearby glass & walls
    const robotLight = new THREE.PointLight('#67e8f9', 1.2, 3.6, 2);
    robotLight.position.set(0, 0.9, 0);
    scene.add(robotLight);

    // Animated directional light pulses trailing behind the robot
    const dotGeo = new THREE.SphereGeometry(0.038, 8, 6);
    const dots = Array.from({ length: 7 }, (_, i) => {
      const m = new THREE.Mesh(
        dotGeo,
        new THREE.MeshBasicMaterial({ color: '#7efce5', transparent: true, opacity: 0.95 - i * 0.12 })
      );
      scene.add(m);
      return m;
    });

    let previousDistance = 0;
    const followPos = new THREE.Vector3();
    const followTarget = new THREE.Vector3();
    const smoothstep = t => t * t * (3 - 2 * t);

    const update = (force = false) => {
      const duration = 7;
      const leg = Math.floor(simulationTime / duration) % 4;
      const local = simulationTime % duration;
      const travelling = local < 5.7;
      const rawFraction = Math.min(local / 5.7, 1);
      // Gentle ease-in/ease-out at each hospital station
      const fraction = rawFraction * 0.35 + smoothstep(rawFraction) * 0.65;
      const progress = ((leg + fraction) / 4) % 1;
      const position = route.getPointAt(progress);
      const tangent = route.getTangentAt(progress);
      const heading = Math.atan2(tangent.x, tangent.z);

      robot.position.set(position.x, position.y + (travelling ? Math.sin(simulationTime * 14) * 0.004 : 0), position.z);
      robot.rotation.y = heading;

      const distance = (Math.floor(simulationTime / duration) + fraction) * route.getLength() / 4;
      const rolled = distance - previousDistance;
      previousDistance = distance;
      wheels.forEach(w => { w.rotation.x += rolled / (0.252 * robot.scale.x); });
      lidar.rotation.y = simulationTime * 2.4;

      contactShadow.position.set(position.x, 0.032, position.z);
      contactShadow.rotation.z = -heading;
      floorGlow.position.set(position.x, 0.036, position.z);
      beacon.position.set(position.x, 0.04, position.z);
      beacon.scale.setScalar(travelling ? 0.96 + Math.sin(simulationTime * 3.2) * 0.05 : 1.02 + Math.sin(simulationTime * 6) * 0.1);
      robotLight.position.set(position.x, 0.85, position.z);

      dots.forEach((dot, i) => {
        const pt = route.getPointAt((progress - 0.016 * (i + 1) + 1) % 1);
        dot.position.set(pt.x, 0.065, pt.z);
      });

      const destination = (leg + 1) % 4;
      stations.forEach(({ ring, disc }, idx) => {
        const active = idx === destination;
        ring.material.color.set(active ? '#8dffe3' : '#3d748d');
        disc.material.opacity = active ? 0.24 + Math.sin(simulationTime * 4) * 0.08 : 0.08;
      });

      // Camera mode transitions
      if (viewMode === 'follow') {
        const backX = position.x - tangent.x * 2.7 + 1.5;
        const backZ = position.z - tangent.z * 2.7 + 1.5;
        followPos.set(backX, 2.35, backZ);
        followTarget.set(position.x, 0.65, position.z);
        camera.position.lerp(followPos, force ? 1 : 0.06);
        controls.target.lerp(followTarget, force ? 1 : 0.08);
      }

      const statusKey = `${destination}:${travelling}`;
      if (force || statusKey !== lastStatus) {
        lastStatus = statusKey;
        onStatus?.({ stationIndex: destination, name: JOURNEY_STATIONS[destination], moving: travelling });
      }
      if (force || simulationTime - lastTelemetry > 0.1) {
        canvas.dataset.robotX = position.x.toFixed(4);
        canvas.dataset.robotZ = position.z.toFixed(4);
        canvas.dataset.simulationTime = simulationTime.toFixed(3);
        lastTelemetry = simulationTime;
      }
    };

    const canRun = () => !disposed && !paused && visible && !document.hidden;
    let dampingFrames = 0;

    const draw = now => {
      frame = 0;
      if (disposed) return;
      if (canRun() && lastTime) simulationTime += Math.min((now - lastTime) / 1000, 0.08);
      lastTime = now;
      update();
      controls.update();
      renderer.render(scene, camera);

      labels.forEach(({ element, position }) => {
        if (viewMode === 'follow') {
          element.style.opacity = '0';
          return;
        }
        const pt = position.clone().project(camera);
        const inFront = pt.z < 1;
        element.style.opacity = inFront ? '1' : '0';
        element.style.left = `${((pt.x + 1) * host.clientWidth) / 2}px`;
        element.style.top = `${((1 - pt.y) * host.clientHeight) / 2}px`;
      });

      if (canRun()) {
        frame = requestAnimationFrame(draw);
      } else if (dampingFrames > 0) {
        dampingFrames--;
        frame = requestAnimationFrame(draw);
      }
    };

    const wake = (extraFrames = 0) => {
      if (extraFrames > dampingFrames) dampingFrames = extraFrames;
      if (!frame && !disposed) {
        lastTime = 0;
        frame = requestAnimationFrame(draw);
      }
    };

    const resize = () => {
      const width = host.clientWidth;
      const height = host.clientHeight;
      if (!width || !height) return;
      camera.aspect = width / height;
      // Slightly wider FOV on narrow mobile viewports so the full floor fits nicely
      camera.fov = width < 440 ? 44 : 34;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
      wake(2);
    };

    const onControlsChange = () => wake(12);
    const onVisibility = () => wake(2);
    controls.addEventListener('change', onControlsChange);
    document.addEventListener('visibilitychange', onVisibility);
    const lostContext = event => { event.preventDefault(); onUnavailable?.(); cleanup(); };
    canvas.addEventListener('webglcontextlost', lostContext);
    removeListeners = () => {
      controls.removeEventListener('change', onControlsChange);
      document.removeEventListener('visibilitychange', onVisibility);
      canvas.removeEventListener('webglcontextlost', lostContext);
    };

    resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    if ('IntersectionObserver' in window) {
      intersectionObserver = new IntersectionObserver(entries => {
        visible = entries[0].isIntersecting;
        wake(2);
      });
      intersectionObserver.observe(host);
    }

    const cleanup = () => {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      intersectionObserver?.disconnect();
      removeListeners();
      controls.dispose();
      envRT?.dispose();
      roomEnv?.dispose();
      pmrem?.dispose();
      disposeScene(scene);
      renderer.dispose();
      canvas.remove();
      labels.forEach(l => l.element.remove());
    };

    update(true);
    controls.update();
    resize();
    onReady?.();

    return {
      setPaused(value) { paused = value; update(true); wake(2); },
      setViewMode(mode) {
        viewMode = mode === 'follow' ? 'follow' : 'overview';
        if (viewMode === 'overview') {
          camera.position.copy(overviewPos);
          controls.target.copy(overviewTarget);
          controls.update();
        }
        update(true);
        wake(20);
      },
      reset() {
        simulationTime = 0;
        previousDistance = 0;
        lastTelemetry = -1;
        if (viewMode === 'overview') {
          camera.position.copy(overviewPos);
          controls.target.copy(overviewTarget);
          controls.update();
        }
        update(true);
        wake(4);
      },
      dispose: cleanup,
    };
  } catch {
    disposed = true;
    cancelAnimationFrame(frame);
    resizeObserver?.disconnect();
    intersectionObserver?.disconnect();
    removeListeners();
    controls?.dispose();
    envRT?.dispose();
    roomEnv?.dispose();
    pmrem?.dispose();
    disposeScene(scene);
    renderer?.dispose();
    canvas.remove();
    labels.forEach(l => l.element.remove());
    onUnavailable?.();
    return { dispose() {}, setPaused() {}, reset() {}, setViewMode() {} };
  }
}
