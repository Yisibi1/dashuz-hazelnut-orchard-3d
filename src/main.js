import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// --- Global Variables ---
let scene, camera, renderer, controls;
let container = document.getElementById('canvas-container');
let trees = [];
let pollinatorTrees = [];
let irrigationGroup, dimensionsGroup, pollenParticles, boundaryGroup;
let selectedTreeMesh = null;
let highlightRing = null;

let isIrrigationOn = true;
let isPollinatorsHighlighted = false;
let isWindOn = false;
let isDimensionsOn = true;

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// Layout Parameters: 84.54 sot (26.5m x 320m)
const PLOT_WIDTH = 26.5;
const PLOT_LENGTH = 320.0;
const ROWS_COUNT = 5;
const TREES_PER_ROW = 60;
const ROW_SPACING = 5.0; // 5 rows centered
const TREE_SPACING = (PLOT_LENGTH - 24) / (TREES_PER_ROW - 1); // ~5.02m spacing

// Camera View Presets
const CAM_PRESETS = {
  orbit: { pos: new THREE.Vector3(65, 55, 75), target: new THREE.Vector3(0, 0, 0) },
  top: { pos: new THREE.Vector3(0, 220, 0.1), target: new THREE.Vector3(0, 0, 0) },
  walk: { pos: new THREE.Vector3(0, 1.8, -135), target: new THREE.Vector3(0, 1.8, 100) }
};

let currentCamMode = 'orbit';

init();
animate();

function init() {
  // 1. Scene & Atmosphere
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a1410);
  scene.fog = new THREE.FogExp2(0x0d1f18, 0.0035);

  // 2. Camera & Renderer
  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.5, 1200);
  camera.position.copy(CAM_PRESETS.orbit.pos);

  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  container.appendChild(renderer.domElement);

  // 3. Controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.maxPolarAngle = Math.PI / 2 - 0.02; // Don't go below ground
  controls.minDistance = 3;
  controls.maxDistance = 500;
  controls.target.copy(CAM_PRESETS.orbit.target);

  // 4. Lighting (Warm sun + soft ambient sky light)
  setupLights();

  // 5. Environment & Ground
  createTerrain();
  createCadastralBoundary();
  createDimensions();

  // 6. Hazelnut Trees (Main + Pollinizers)
  createTrees();

  // 7. Drip Irrigation System & Pump Station
  createIrrigationSystem();

  // 8. Pollen & Wind Particle System
  createPollenParticles();

  // 9. Highlight Ring for Selection
  createHighlightRing();

  // 10. Event Listeners
  window.addEventListener('resize', onWindowResize);
  renderer.domElement.addEventListener('pointerdown', onPointerDown);

  setupUI();
}

function setupLights() {
  const hemiLight = new THREE.HemisphereLight(0xcdeee1, 0x1b2e25, 0.85);
  scene.add(hemiLight);

  const sunLight = new THREE.DirectionalLight(0xfffaed, 2.2);
  sunLight.position.set(120, 160, -90);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 2048;
  sunLight.shadow.mapSize.height = 2048;
  sunLight.shadow.camera.near = 10;
  sunLight.shadow.camera.far = 400;
  sunLight.shadow.camera.left = -170;
  sunLight.shadow.camera.right = 170;
  sunLight.shadow.camera.top = 170;
  sunLight.shadow.camera.bottom = -170;
  sunLight.shadow.bias = -0.0005;
  scene.add(sunLight);

  const fillLight = new THREE.DirectionalLight(0xa7f3d0, 0.4);
  fillLight.position.set(-80, 50, 80);
  scene.add(fillLight);
}

function createTerrain() {
  // Main Plot (26.5m x 320m)
  const geom = new THREE.PlaneGeometry(PLOT_WIDTH, PLOT_LENGTH, 32, 128);
  geom.rotateX(-Math.PI / 2);

  // Realistic natural ground texture
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#22382b';
  ctx.fillRect(0, 0, 512, 1024);

  // Tilled soil bands along the 5 rows
  ctx.fillStyle = '#1c2f24';
  for (let i = 0; i < 5; i++) {
    const x = (512 / 6) * (i + 1);
    ctx.fillRect(x - 24, 0, 48, 1024);
  }

  // Organic speckles
  for (let i = 0; i < 4000; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? '#17271e' : '#2b4737';
    ctx.fillRect(Math.random() * 512, Math.random() * 1024, 2, 2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 4);

  const mat = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.88,
    metalness: 0.05
  });

  const ground = new THREE.Mesh(geom, mat);
  ground.receiveShadow = true;
  scene.add(ground);

  // Surrounding vast landscape
  const outerGeom = new THREE.PlaneGeometry(800, 800);
  outerGeom.rotateX(-Math.PI / 2);
  const outerMat = new THREE.MeshStandardMaterial({
    color: 0x121e18,
    roughness: 0.95
  });
  const outerGround = new THREE.Mesh(outerGeom, outerMat);
  outerGround.position.y = -0.05;
  outerGround.receiveShadow = true;
  scene.add(outerGround);
}

function createCadastralBoundary() {
  boundaryGroup = new THREE.Group();

  // Red cadastral perimeter line
  const halfW = PLOT_WIDTH / 2;
  const halfL = PLOT_LENGTH / 2;
  const points = [
    new THREE.Vector3(-halfW, 0.1, -halfL),
    new THREE.Vector3(halfW, 0.1, -halfL),
    new THREE.Vector3(halfW, 0.1, halfL),
    new THREE.Vector3(-halfW, 0.1, halfL),
    new THREE.Vector3(-halfW, 0.1, -halfL)
  ];

  const lineGeom = new THREE.BufferGeometry().setFromPoints(points);
  const lineMat = new THREE.LineDashedMaterial({
    color: 0xef4444,
    dashSize: 2,
    gapSize: 1,
    linewidth: 2
  });
  const borderLine = new THREE.Line(lineGeom, lineMat);
  borderLine.computeLineDistances();
  boundaryGroup.add(borderLine);

  // Boundary Corner Posts (5 Cadastral Points)
  const postGeom = new THREE.CylinderGeometry(0.12, 0.15, 1.2, 8);
  const postMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.4 });

  points.slice(0, 4).forEach((pt, i) => {
    const post = new THREE.Mesh(postGeom, postMat);
    post.position.set(pt.x, 0.6, pt.z);
    post.castShadow = true;
    boundaryGroup.add(post);
  });

  scene.add(boundaryGroup);
}

function createDimensions() {
  dimensionsGroup = new THREE.Group();

  const halfW = PLOT_WIDTH / 2;
  const halfL = PLOT_LENGTH / 2;

  // Width ruler label line (26.5m)
  createDimensionLine(
    new THREE.Vector3(-halfW, 0.2, -halfL - 4),
    new THREE.Vector3(halfW, 0.2, -halfL - 4),
    'Eni: 26.5 metr'
  );

  // Length ruler label line (320m)
  createDimensionLine(
    new THREE.Vector3(halfW + 4, 0.2, -halfL),
    new THREE.Vector3(halfW + 4, 0.2, halfL),
    'Uzunluğu: 320 metr (0.8454 Ha / 84.54 Sot)'
  );

  scene.add(dimensionsGroup);
}

function createDimensionLine(start, end, labelText) {
  const lineGeom = new THREE.BufferGeometry().setFromPoints([start, end]);
  const lineMat = new THREE.LineBasicMaterial({ color: 0x38bdf8 });
  const line = new THREE.Line(lineGeom, lineMat);
  dimensionsGroup.add(line);

  // End ticks
  const tickGeom = new THREE.CylinderGeometry(0.04, 0.04, 1.5, 6);
  const tickMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });

  const tick1 = new THREE.Mesh(tickGeom, tickMat);
  tick1.position.copy(start);
  tick1.rotation.z = Math.PI / 2;
  dimensionsGroup.add(tick1);

  const tick2 = new THREE.Mesh(tickGeom, tickMat);
  tick2.position.copy(end);
  tick2.rotation.z = Math.PI / 2;
  dimensionsGroup.add(tick2);
}

function createTrees() {
  const trunkGeom = new THREE.CylinderGeometry(0.08, 0.14, 1.6, 7);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a3e2b, roughness: 0.9 });

  const mainCrownGeom = new THREE.DodecahedronGeometry(1.3, 1);
  const mainCrownMat = new THREE.MeshStandardMaterial({
    color: 0x2e8b57,
    roughness: 0.8,
    metalness: 0.1
  });

  const pollinizerCrownMat = new THREE.MeshStandardMaterial({
    color: 0x65a30d,
    roughness: 0.7,
    metalness: 0.15
  });

  // Pollinizer Identification Stake
  const stakeGeom = new THREE.CylinderGeometry(0.03, 0.03, 1.8, 6);
  const stakeMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.3 });

  let treeCounter = 1;
  const startZ = -(PLOT_LENGTH / 2) + 12;

  for (let r = 0; r < ROWS_COUNT; r++) {
    // 5 rows: X = -10, -5, 0, 5, 10
    const rowX = (r - 2) * ROW_SPACING;

    for (let c = 0; c < TREES_PER_ROW; c++) {
      const treeZ = startZ + c * TREE_SPACING;

      // Determine if pollinizer (Staggered chess pattern every 10 trees)
      // Row 0, 2, 4: indices 4, 14, 24, 34, 44, 54
      // Row 1, 3: indices 9, 19, 29, 39, 49, 59
      let isPollinizer = false;
      let variety = 'Tonda di Giffoni (Əsas İntensiv)';
      let pollinizerVariety = '';

      if (r % 2 === 0 && (c % 10 === 4)) {
        isPollinizer = true;
      } else if (r % 2 === 1 && (c % 10 === 9)) {
        isPollinizer = true;
      }

      if (isPollinizer) {
        pollinizerVariety = (treeCounter % 2 === 0) ? 'Nocchione (Tozlayıcı)' : 'Mortarella (Tozlayıcı)';
        variety = pollinizerVariety;
      }

      // Build Tree Group
      const treeGroup = new THREE.Group();
      treeGroup.position.set(rowX, 0, treeZ);

      // Random gentle scale variation
      const scaleVariation = 0.9 + Math.random() * 0.2;

      // Trunk
      const trunk = new THREE.Mesh(trunkGeom, trunkMat);
      trunk.position.y = 0.8;
      trunk.castShadow = true;
      trunk.receiveShadow = true;
      treeGroup.add(trunk);

      // Crown
      const crown = new THREE.Mesh(
        mainCrownGeom,
        isPollinizer ? pollinizerCrownMat : mainCrownMat
      );
      crown.position.y = 2.0;
      crown.scale.set(scaleVariation, scaleVariation * 1.1, scaleVariation);
      crown.rotation.y = Math.random() * Math.PI;
      crown.castShadow = true;
      crown.receiveShadow = true;
      treeGroup.add(crown);

      // If pollinizer, add identification stake
      if (isPollinizer) {
        const stake = new THREE.Mesh(stakeGeom, stakeMat);
        stake.position.set(0.25, 0.9, 0.1);
        stake.rotation.z = 0.08;
        treeGroup.add(stake);

        // Small indicator glow sphere
        const markerGeom = new THREE.SphereGeometry(0.12, 8, 8);
        const markerMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
        const marker = new THREE.Mesh(markerGeom, markerMat);
        marker.position.set(0.25, 1.85, 0.1);
        treeGroup.add(marker);

        pollinatorTrees.push(treeGroup);
      }

      // Metadata for Raycasting & Inspection
      treeGroup.userData = {
        id: treeCounter++,
        row: r + 1,
        index: c + 1,
        variety: variety,
        isPollinizer: isPollinizer,
        type: 'Tək gövdəli intensiv',
        irrigation: 'Damcı sistemi (2.5 litr/saat)',
        pollinationDistance: isPollinizer ? 'Tozlayıcı mərkəzidir' : '8 – 12 metr (Tam təmin olunub)',
        firstHarvest: '2-ci il (2028)',
        fullYield: '4-cü ildən (2.5 - 3 ton/ha)'
      };

      scene.add(treeGroup);
      trees.push(treeGroup);
    }
  }
}

function createIrrigationSystem() {
  irrigationGroup = new THREE.Group();

  const pipeMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.6 });
  const waterDropMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });

  // 1. Main header pipe across the width at the start
  const mainPipeGeom = new THREE.CylinderGeometry(0.06, 0.06, PLOT_WIDTH - 4, 12);
  const mainPipe = new THREE.Mesh(mainPipeGeom, pipeMat);
  mainPipe.rotation.z = Math.PI / 2;
  mainPipe.position.set(0, 0.05, -(PLOT_LENGTH / 2) + 8);
  irrigationGroup.add(mainPipe);

  // 2. Filtration & Pump Station at north-west corner
  const pumpStation = new THREE.Group();
  pumpStation.position.set(-PLOT_WIDTH / 2 + 2, 0, -(PLOT_LENGTH / 2) + 7);

  // Disc filter cylinder (Blue)
  const filterGeom = new THREE.CylinderGeometry(0.3, 0.3, 1.1, 16);
  const filterMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.4 });
  const filterMesh = new THREE.Mesh(filterGeom, filterMat);
  filterMesh.position.y = 0.55;
  filterMesh.castShadow = true;
  pumpStation.add(filterMesh);

  // Venturi fertilizer tank (White)
  const fertGeom = new THREE.CylinderGeometry(0.35, 0.35, 0.9, 16);
  const fertMat = new THREE.MeshStandardMaterial({ color: 0xf3f4f6, roughness: 0.3 });
  const fertMesh = new THREE.Mesh(fertGeom, fertMat);
  fertMesh.position.set(0.9, 0.45, 0);
  fertMesh.castShadow = true;
  pumpStation.add(fertMesh);

  irrigationGroup.add(pumpStation);

  // 3. 5 Drip lines running down the rows
  const lineLength = PLOT_LENGTH - 16;
  const lineGeom = new THREE.CylinderGeometry(0.02, 0.02, lineLength, 6);

  for (let r = 0; r < ROWS_COUNT; r++) {
    const rowX = (r - 2) * ROW_SPACING;
    const dripLine = new THREE.Mesh(lineGeom, pipeMat);
    dripLine.rotation.x = Math.PI / 2;
    dripLine.position.set(rowX, 0.03, 0);
    irrigationGroup.add(dripLine);

    // Emitters / Water Droplets under trees
    const dropGeom = new THREE.SphereGeometry(0.04, 6, 6);
    const startZ = -(PLOT_LENGTH / 2) + 12;
    for (let c = 0; c < TREES_PER_ROW; c++) {
      const tz = startZ + c * TREE_SPACING;
      const drop = new THREE.Mesh(dropGeom, waterDropMat);
      drop.position.set(rowX + 0.15, 0.04, tz);
      drop.userData = { isDripper: true, baseY: 0.04, phase: Math.random() * Math.PI };
      irrigationGroup.add(drop);
    }
  }

  scene.add(irrigationGroup);
}

function createPollenParticles() {
  const particleCount = 400;
  const geom = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);

  for (let i = 0; i < particleCount; i++) {
    positions[i * 3] = (Math.random() - 0.5) * PLOT_WIDTH;
    positions[i * 3 + 1] = 1.0 + Math.random() * 3.0;
    positions[i * 3 + 2] = (Math.random() - 0.5) * PLOT_LENGTH;
  }

  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const mat = new THREE.PointsMaterial({
    color: 0xfacc15,
    size: 0.25,
    transparent: true,
    opacity: 0.0, // hidden initially
    blending: THREE.AdditiveBlending
  });

  pollenParticles = new THREE.Points(geom, mat);
  scene.add(pollenParticles);
}

function createHighlightRing() {
  const ringGeom = new THREE.RingGeometry(1.2, 1.4, 32);
  ringGeom.rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x34d399,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.85
  });
  highlightRing = new THREE.Mesh(ringGeom, ringMat);
  highlightRing.position.y = 0.05;
  highlightRing.visible = false;
  scene.add(highlightRing);
}

function onPointerDown(event) {
  // Raycast to select trees
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);

  // Check intersection with all tree children
  const intersectObjects = [];
  trees.forEach(t => {
    t.children.forEach(child => intersectObjects.push(child));
  });

  const intersects = raycaster.intersectObjects(intersectObjects);

  if (intersects.length > 0) {
    const hit = intersects[0].object.parent;
    if (hit && hit.userData && hit.userData.id) {
      selectTree(hit);
    }
  }
}

function selectTree(tree) {
  selectedTreeMesh = tree;

  // Position highlight ring under tree
  highlightRing.position.set(tree.position.x, 0.05, tree.position.z);
  highlightRing.visible = true;

  // Show Inspector Panel
  const inspector = document.getElementById('inspector-card');
  const treeTitle = document.getElementById('tree-title');
  const treeBadge = document.getElementById('tree-badge');
  const treePos = document.getElementById('tree-pos');
  const treeVariety = document.getElementById('tree-variety');
  const treeType = document.getElementById('tree-type');
  const treeIrrigation = document.getElementById('tree-irrigation');
  const treePollination = document.getElementById('tree-pollination-status');

  const data = tree.userData;
  treeTitle.textContent = `Ağac № ${data.id}`;
  treePos.textContent = `Cərgə ${data.row}, Ağac ${data.index}`;
  treeVariety.textContent = data.variety;
  treeType.textContent = data.type;
  treeIrrigation.textContent = data.irrigation;
  treePollination.textContent = data.pollinationDistance;

  if (data.isPollinizer) {
    treeBadge.textContent = 'Tozlayıcı Sort ⭐';
    treeBadge.className = 'badge badge-amber';
  } else {
    treeBadge.textContent = 'Əsas İntensiv Sort 🌰';
    treeBadge.className = 'badge badge-emerald';
  }

  inspector.classList.remove('hidden');
}

function setupUI() {
  // Camera buttons
  document.querySelectorAll('.cam-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.cam-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const mode = btn.dataset.cam;
      switchCameraMode(mode);
    });
  });

  // Close inspector
  document.getElementById('close-inspector-btn').addEventListener('click', () => {
    document.getElementById('inspector-card').classList.add('hidden');
    highlightRing.visible = false;
  });

  // Toggle Irrigation
  const irrigationBtn = document.getElementById('toggle-irrigation-btn');
  irrigationBtn.addEventListener('click', () => {
    isIrrigationOn = !isIrrigationOn;
    irrigationGroup.visible = isIrrigationOn;
    irrigationBtn.querySelector('.state-txt').textContent = isIrrigationOn ? 'AÇIQ' : 'BAĞLI';
    irrigationBtn.querySelector('.state-txt').className = `state-txt ${isIrrigationOn ? 'text-emerald' : 'text-amber'}`;
  });

  // Toggle Pollinators Highlight
  const pollinatorsBtn = document.getElementById('toggle-pollinators-btn');
  pollinatorsBtn.addEventListener('click', () => {
    isPollinatorsHighlighted = !isPollinatorsHighlighted;
    pollinatorsBtn.classList.toggle('active', isPollinatorsHighlighted);

    pollinatorTrees.forEach(t => {
      t.scale.setScalar(isPollinatorsHighlighted ? 1.35 : 1.0);
    });
  });

  // Toggle Wind & Pollen
  const windBtn = document.getElementById('toggle-wind-btn');
  windBtn.addEventListener('click', () => {
    isWindOn = !isWindOn;
    windBtn.classList.toggle('active', isWindOn);
    pollenParticles.material.opacity = isWindOn ? 0.75 : 0.0;
  });

  // Toggle Dimensions
  const dimBtn = document.getElementById('toggle-dimensions-btn');
  dimBtn.addEventListener('click', () => {
    isDimensionsOn = !isDimensionsOn;
    dimensionsGroup.visible = isDimensionsOn;
    dimBtn.classList.toggle('active', isDimensionsOn);
  });
}

function switchCameraMode(mode) {
  currentCamMode = mode;
  const target = CAM_PRESETS[mode];
  if (!target) return;

  // Smooth transition
  const startPos = camera.position.clone();
  const startTarget = controls.target.clone();
  const duration = 1200;
  const startTime = performance.now();

  function step(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1.0);
    const ease = 0.5 - Math.cos(progress * Math.PI) / 2; // smooth ease-in-out

    camera.position.lerpVectors(startPos, target.pos, ease);
    controls.target.lerpVectors(startTarget, target.target, ease);
    controls.update();

    if (progress < 1.0) {
      requestAnimationFrame(step);
    }
  }

  requestAnimationFrame(step);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// Animation Loop
let clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();
  const time = clock.getElapsedTime();

  // 1. Controls update
  controls.update();

  // 2. Animate Highlight ring rotation
  if (highlightRing && highlightRing.visible) {
    highlightRing.rotation.z += 0.015;
  }

  // 3. Animate Water drops if irrigation on
  if (isIrrigationOn && irrigationGroup.visible) {
    irrigationGroup.children.forEach(child => {
      if (child.userData && child.userData.isDripper) {
        child.position.y = child.userData.baseY + Math.sin(time * 6 + child.userData.phase) * 0.02;
      }
    });
  }

  // 4. Animate Pollen Drift if Wind ON
  if (isWindOn && pollenParticles) {
    const positions = pollenParticles.geometry.attributes.position.array;
    for (let i = 0; i < positions.length; i += 3) {
      // Wind blowing along Z axis (from north to south) and slightly across X
      positions[i] += Math.sin(time + positions[i + 2]) * 0.03; // slight X drift
      positions[i + 2] += 0.35; // move along row

      if (positions[i + 2] > PLOT_LENGTH / 2) {
        positions[i + 2] = -PLOT_LENGTH / 2;
      }
    }
    pollenParticles.geometry.attributes.position.needsUpdate = true;
  }

  renderer.render(scene, camera);
}
