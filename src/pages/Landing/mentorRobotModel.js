// Detailed procedural Hiwonder MentorPi M1 3D model for Three.js.
// +Z is forward, +Y is up, wheel axles lie along X.
// Returns { group, wheels, lidar } so the scene can spin wheels and the LiDAR turret.
export function createMentorRobot(THREE) {
  const group = new THREE.Group();
  group.name = 'MentorPi M1';
  const wheels = [];

  const mat = (color, roughness = 0.4, metalness = 0.3, extra = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });

  const anodized = mat('#1d2229', 0.38, 0.78);
  const darkMetal = mat('#14181e', 0.44, 0.7);
  const plateTop = mat('#272e37', 0.34, 0.76);
  const edgeMetal = mat('#4a5564', 0.28, 0.84);
  const silver = mat('#d2d9e2', 0.22, 0.88);
  const silverHub = mat('#bcc6d2', 0.26, 0.84);
  const brass = mat('#c8a762', 0.28, 0.85);
  const rubber = mat('#15191f', 0.82, 0.06);
  const holeDark = mat('#080b0f', 0.9, 0.05);
  const pcbGreen = mat('#1c523c', 0.5, 0.16);
  const pcbCream = mat('#d9d4be', 0.52, 0.1);
  const jstWhite = mat('#eef3f8', 0.42, 0.05);
  const chipBlack = mat('#151920', 0.48, 0.3);
  const usbBlue = mat('#1f74db', 0.3, 0.25);
  const lidarGloss = mat('#13171d', 0.15, 0.72);
  const camFace = mat('#11151b', 0.22, 0.35);
  const lensGlass = mat('#081e2c', 0.05, 0.92, { envMapIntensity: 1.8 });
  const irAmber = mat('#3d2a12', 0.12, 0.7, { emissive: '#6e4514', emissiveIntensity: 0.4 });
  const ledCyan = mat('#5eead4', 0.2, 0.2, { emissive: '#2dd4bf', emissiveIntensity: 1.6 });
  const ledGreen = mat('#4ade80', 0.25, 0.15, { emissive: '#22c55e', emissiveIntensity: 1.5 });

  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  const boltGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.012, 8);
  const holeGeo = new THREE.CylinderGeometry(0.017, 0.017, 0.014, 10);

  const addMesh = (geo, surface, parent, pos = [0, 0, 0], cast = true) => {
    const m = new THREE.Mesh(geo, surface);
    m.position.set(...pos);
    m.castShadow = cast;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };

  const addBox = (parent, surface, dim, pos, cast = true) => {
    const m = addMesh(unitBox, surface, parent, pos, cast);
    m.scale.set(...dim);
    return m;
  };

  const addBolt = (parent, x, y, z) => addMesh(boltGeo, silver, parent, [x, y, z], false);

  // Helper: rounded stadium / pill shape for the Orbbec 3D depth camera
  const createStadiumShape = (w, h) => {
    const r = h / 2;
    const half = w / 2 - r;
    const s = new THREE.Shape();
    s.absarc(-half, 0, r, Math.PI / 2, (Math.PI * 3) / 2, false);
    s.absarc(half, 0, r, -Math.PI / 2, Math.PI / 2, false);
    s.closePath();
    return s;
  };

  // ==================== 1. LOWER ANODIZED ALUMINUM CHASSIS ====================
  addBox(group, anodized, [0.84, 0.22, 0.96], [0, 0.32, -0.04]);
  addBox(group, plateTop, [0.88, 0.036, 1.0], [0, 0.445, -0.04]);
  addBox(group, edgeMetal, [0.85, 0.014, 0.97], [0, 0.212, -0.04]);

  // Iconic sloped front nose plate with mounting holes
  const nose = new THREE.Group();
  nose.position.set(0, 0.315, 0.49);
  nose.rotation.x = -0.26;
  group.add(nose);
  addBox(nose, anodized, [0.76, 0.23, 0.042], [0, 0, 0]);
  addBox(nose, edgeMetal, [0.76, 0.012, 0.046], [0, 0.114, 0]);
  for (const x of [-0.26, -0.19, 0.19, 0.26]) {
    for (const y of [-0.045, 0.035]) {
      const h = addMesh(holeGeo, holeDark, nose, [x, y, 0.019], false);
      h.rotation.x = Math.PI / 2;
    }
  }
  // Subtle front status strip under the nose lip
  addBox(group, ledCyan, [0.28, 0.012, 0.014], [0, 0.436, 0.47], false);

  // Rear bumper plate
  addBox(group, darkMetal, [0.78, 0.19, 0.035], [0, 0.31, -0.53]);

  // ==================== 2. FOUR MECANUM WHEELS ====================
  const wheelRadius = 0.252;
  const rollerCount = 9;
  const wheelCoreGeo = new THREE.CylinderGeometry(0.168, 0.168, 0.145, 22);
  const wheelRimGeo = new THREE.TorusGeometry(0.156, 0.022, 8, 24);
  const wheelHubGeo = new THREE.CylinderGeometry(0.088, 0.088, 0.03, 18);
  const wheelCapGeo = new THREE.CylinderGeometry(0.034, 0.034, 0.04, 12);
  const axleGeo = new THREE.CylinderGeometry(0.034, 0.034, 0.23, 12);
  const rollerGeo = new THREE.CapsuleGeometry(0.045, 0.135, 4, 10);
  const petalGeo = new THREE.BoxGeometry(0.018, 0.075, 0.042);
  const up = new THREE.Vector3(0, 1, 0);

  for (const side of [-1, 1]) {
    for (const front of [-1, 1]) {
      const wheel = new THREE.Group();
      wheel.name = `${front > 0 ? 'Front' : 'Rear'} ${side < 0 ? 'left' : 'right'} mecanum wheel`;
      wheel.position.set(side * 0.495, wheelRadius + 0.002, front * 0.41);
      group.add(wheel);
      wheels.push(wheel);

      const core = addMesh(wheelCoreGeo, darkMetal, wheel);
      core.rotation.z = Math.PI / 2;
      const shaft = addMesh(axleGeo, silver, wheel);
      shaft.rotation.z = Math.PI / 2;

      for (const face of [-1, 1]) {
        const ring = addMesh(wheelRimGeo, silverHub, wheel, [face * 0.08, 0, 0]);
        ring.rotation.y = Math.PI / 2;
        const hub = addMesh(wheelHubGeo, silver, wheel, [face * 0.09, 0, 0]);
        hub.rotation.z = Math.PI / 2;
        const cap = addMesh(wheelCapGeo, edgeMetal, wheel, [face * 0.098, 0, 0], false);
        cap.rotation.z = Math.PI / 2;

        // 6 inner spokes
        for (let s = 0; s < 6; s++) {
          const a = (s * Math.PI) / 3;
          const spoke = addBox(
            wheel,
            silverHub,
            [0.02, 0.135, 0.024],
            [face * 0.088, Math.cos(a) * 0.082, Math.sin(a) * 0.082],
            false
          );
          spoke.rotation.x = a;
        }
        // 9 outer scalloped silver petals that hold the roller pins
        for (let p = 0; p < rollerCount; p++) {
          const a = (p * Math.PI * 2) / rollerCount;
          const petal = addMesh(
            petalGeo,
            silver,
            wheel,
            [face * 0.082, Math.cos(a) * 0.172, Math.sin(a) * 0.172],
            false
          );
          petal.rotation.x = a;
        }
      }

      // 9 angled rubber rollers
      for (let i = 0; i < rollerCount; i++) {
        const a = (i * Math.PI * 2) / rollerCount;
        const roller = addMesh(
          rollerGeo,
          rubber,
          wheel,
          [0, Math.cos(a) * 0.188, Math.sin(a) * 0.188]
        );
        const dir = new THREE.Vector3(0.86 * side * front, -Math.sin(a), Math.cos(a)).normalize();
        roller.quaternion.setFromUnitVectors(up, dir);
      }
    }
  }

  // ==================== 3. FRONT STEP BRACKET & 3D DEPTH CAMERA ====================
  // Bent metal riser under the depth camera
  addBox(group, anodized, [0.66, 0.15, 0.03], [0, 0.535, 0.37]);
  addBox(group, plateTop, [0.66, 0.026, 0.24], [0, 0.612, 0.28]);
  addBolt(group, -0.26, 0.63, 0.34);
  addBolt(group, 0.26, 0.63, 0.34);

  // Pill-shaped brushed-silver depth camera body (Orbbec Dabai style)
  const camGroup = new THREE.Group();
  camGroup.position.set(0, 0.705, 0.33);
  group.add(camGroup);

  const outerBezelGeo = new THREE.ExtrudeGeometry(createStadiumShape(0.74, 0.155), {
    depth: 0.11,
    bevelEnabled: true,
    bevelThickness: 0.012,
    bevelSize: 0.01,
    bevelSegments: 3,
    curveSegments: 16,
  });
  outerBezelGeo.center();
  addMesh(outerBezelGeo, silver, camGroup, [0, 0, 0]);

  const innerFaceGeo = new THREE.ExtrudeGeometry(createStadiumShape(0.69, 0.118), {
    depth: 0.016,
    bevelEnabled: false,
    curveSegments: 14,
  });
  innerFaceGeo.center();
  addMesh(innerFaceGeo, camFace, camGroup, [0, 0, 0.064], false);

  // 4 realistic optical lenses inside the recessed face
  const ringGeo = new THREE.TorusGeometry(0.029, 0.005, 8, 18);
  const glassGeo = new THREE.CylinderGeometry(0.024, 0.024, 0.012, 16);
  const lensPositions = [-0.245, -0.055, 0.125, 0.245];
  lensPositions.forEach((lx, idx) => {
    addMesh(ringGeo, edgeMetal, camGroup, [lx, 0, 0.074], false);
    const lens = addMesh(glassGeo, idx === 0 ? irAmber : lensGlass, camGroup, [lx, 0, 0.071], false);
    lens.rotation.x = Math.PI / 2;
  });

  // ==================== 4. RASPBERRY PI 5 + EXPANSION BOARD STACK ====================
  const standoffGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.24, 8);
  for (const x of [-0.31, 0.31]) {
    for (const z of [-0.31, 0.12]) {
      addMesh(standoffGeo, brass, group, [x, 0.58, z], false);
    }
  }

  // Lower Raspberry Pi 5 PCB
  addBox(group, pcbGreen, [0.58, 0.022, 0.44], [0.02, 0.57, -0.08]);
  // Heatsink + fins on Pi 5
  addBox(group, chipBlack, [0.22, 0.052, 0.22], [-0.08, 0.606, -0.08]);
  for (let i = 0; i < 6; i++) {
    addBox(group, silver, [0.015, 0.048, 0.21], [-0.165 + i * 0.033, 0.642, -0.08], false);
  }
  // Ethernet & USB 3.0 / 2.0 ports on the right (+X) edge of Pi 5
  addBox(group, silver, [0.13, 0.095, 0.125], [0.26, 0.625, 0.04]);
  addBox(group, holeDark, [0.014, 0.068, 0.088], [0.326, 0.625, 0.04], false);
  for (const [pz, isBlue] of [[-0.08, true], [-0.2, false]]) {
    addBox(group, silver, [0.115, 0.092, 0.098], [0.265, 0.624, pz]);
    addBox(group, isBlue ? usbBlue : chipBlack, [0.012, 0.026, 0.064], [0.324, 0.646, pz], false);
    addBox(group, isBlue ? usbBlue : chipBlack, [0.012, 0.026, 0.064], [0.324, 0.602, pz], false);
  }

  // Upper Hiwonder expansion board
  addBox(group, pcbCream, [0.58, 0.02, 0.43], [0.02, 0.695, -0.08]);
  // White JST connectors along top board edges
  for (let i = 0; i < 5; i++) {
    addBox(group, jstWhite, [0.065, 0.052, 0.048], [-0.18 + i * 0.09, 0.73, -0.25], false);
  }
  for (let i = 0; i < 3; i++) {
    addBox(group, jstWhite, [0.05, 0.048, 0.072], [0.27, 0.728, -0.2 + i * 0.12], false);
  }
  // Power LED & buzzer
  addMesh(new THREE.SphereGeometry(0.012, 8, 6), ledGreen, group, [0.22, 0.715, 0.11], false);
  addMesh(new THREE.CylinderGeometry(0.032, 0.032, 0.036, 12), chipBlack, group, [-0.14, 0.722, 0.04], false);

  // ==================== 5. ICONIC SLANTED SHEET-METAL GANTRY ====================
  // Front slanted A-frame legs (forming a trapezoidal window over the Pi 5)
  for (const side of [-1, 1]) {
    const frontLeg = addBox(group, anodized, [0.075, 0.46, 0.028], [side * 0.31, 0.74, 0.14]);
    frontLeg.rotation.x = -0.34;
    frontLeg.rotation.z = side * 0.12;
  }
  // Front upper crossbar of the slanted arch
  const archBar = addBox(group, anodized, [0.62, 0.065, 0.028], [0, 0.905, 0.085]);
  archBar.rotation.x = -0.34;

  // Rear vertical sheet-metal walls
  for (const side of [-1, 1]) {
    addBox(group, anodized, [0.03, 0.46, 0.24], [side * 0.35, 0.71, -0.26]);
  }
  addBox(group, anodized, [0.7, 0.24, 0.026], [0, 0.82, -0.37]);

  // Flat top LiDAR deck with bolts
  addBox(group, plateTop, [0.74, 0.028, 0.52], [0, 0.955, -0.13]);
  addBox(group, edgeMetal, [0.74, 0.008, 0.52], [0, 0.971, -0.13], false);
  for (const x of [-0.31, 0.31]) {
    for (const z of [-0.33, 0.06]) addBolt(group, x, 0.978, z);
  }

  // ==================== 6. TOP TOF LIDAR (LD19 / STL-19P) ====================
  // Square matte-black base housing
  addBox(group, anodized, [0.3, 0.125, 0.3], [0, 1.032, -0.12]);
  addBox(group, darkMetal, [0.27, 0.024, 0.27], [0, 1.106, -0.12]);

  // Rotating glossy cylindrical turret
  const lidar = new THREE.Group();
  lidar.name = 'Rotating lidar';
  lidar.position.set(0, 1.175, -0.12);
  group.add(lidar);

  addMesh(new THREE.CylinderGeometry(0.136, 0.14, 0.105, 28), lidarGloss, lidar);
  addMesh(new THREE.CylinderGeometry(0.122, 0.136, 0.016, 28), plateTop, lidar, [0, 0.06, 0], false);
  addMesh(new THREE.CylinderGeometry(0.141, 0.141, 0.01, 28), edgeMetal, lidar, [0, -0.052, 0], false);
  // Optical scan window + subtle cyan laser indicator
  addBox(lidar, lensGlass, [0.076, 0.028, 0.012], [0, -0.004, 0.136], false);
  addBox(lidar, ledCyan, [0.036, 0.007, 0.012], [0, -0.018, 0.142], false);

  return { group, wheels, lidar };
}
