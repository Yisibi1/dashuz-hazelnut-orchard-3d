import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// --- Global Variables ---
let scene, camera, renderer, controls;
let container = document.getElementById('canvas-container');
let trees = [];
let pollinatorTrees = [];
let irrigationGroup, dimensionsGroup, pollenParticles, boundaryGroup, mountainsGroup, riverGroup;
let waterPulses = [];
let selectedTreeMesh = null;
let highlightRing = null;
let hemiLight, sunLight, fillLight;
let skyMesh;

const clock = new THREE.Clock();

let isIrrigationOn = true;
let isPollinatorsHighlighted = false;
let isWindOn = false;
let isDimensionsOn = true;
let currentTimeMode = 'day';

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// Layout Parameters: 84.54 sot (26.5m x 320m)
const PLOT_WIDTH = 26.5;
const PLOT_LENGTH = 320.0;
const ROWS_COUNT = 5;
const TREES_PER_ROW = 60;
const ROW_SPACING = 5.0; // 5 rows centered: -10, -5, 0, 5, 10
const TREE_SPACING = (PLOT_LENGTH - 24) / (TREES_PER_ROW - 1); // ~5.02m spacing

// Camera View Presets
const CAM_PRESETS = {
  orbit: { pos: new THREE.Vector3(55, 42, 60), target: new THREE.Vector3(0, 0, 0) },
  top: { pos: new THREE.Vector3(0, 240, 0.1), target: new THREE.Vector3(0, 0, 0) },
  walk: { pos: new THREE.Vector3(0, 1.8, -135), target: new THREE.Vector3(0, 1.8, 80) },
  river: { pos: new THREE.Vector3(25, 70, -130), target: new THREE.Vector3(-40, 0, -190) }
};

// Lighting / Atmosphere Themes
const TIME_THEMES = {
  day: {
    skyTop: 0x38bdf8,
    skyBottom: 0xdcfce7,
    fogColor: 0x93c5fd,
    sunColor: 0xfff7ed,
    sunIntensity: 2.4,
    hemiSky: 0xe0f2fe,
    hemiGround: 0x2e4a3d,
    hemiIntensity: 0.95,
    exposure: 1.15
  },
  sunset: {
    skyTop: 0x6366f1,
    skyBottom: 0xf97316,
    fogColor: 0xfb923c,
    sunColor: 0xfdba74,
    sunIntensity: 2.8,
    hemiSky: 0xfbbf24,
    hemiGround: 0x3d1a24,
    hemiIntensity: 0.7,
    exposure: 1.25
  },
  night: {
    skyTop: 0x030712,
    skyBottom: 0x0f172a,
    fogColor: 0x0b132b,
    sunColor: 0x93c5fd,
    sunIntensity: 0.6,
    hemiSky: 0x1e293b,
    hemiGround: 0x080f0c,
    hemiIntensity: 0.4,
    exposure: 0.95
  }
};

init();
animate();

function init() {
  // 1. Scene & Setup
  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.5, 1500);
  camera.position.copy(CAM_PRESETS.orbit.pos);

  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  container.appendChild(renderer.domElement);

  // 2. Controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.maxPolarAngle = Math.PI / 2 - 0.01;
  controls.minDistance = 2;
  controls.maxDistance = 550;
  controls.target.copy(CAM_PRESETS.orbit.target);

  // 3. Atmosphere & Sky
  createAtmosphericSky();
  createCaucasusMountains();
  setupLights();

  // 4. Ground & Cadastral Boundaries
  createTerrain();
  createCadastralBoundary();
  createDimensions();

  // 5. Realistic Hazelnut Trees
  createTrees();

  // 6. Drip Irrigation System with Pump & Filter
  createIrrigationSystem();

  // 6b. Ayrichay River & Intake Pipeline
  createAyrichayRiver();

  // 7. Pollen & Wind Particle System
  createPollenParticles();

  // 8. Selection Highlight Ring
  createHighlightRing();

  // 9. Event Listeners & UI
  window.addEventListener('resize', onWindowResize);
  renderer.domElement.addEventListener('pointerdown', onPointerDown);

  setupUI();
  applyTimeTheme('day');
}

function createAtmosphericSky() {
  // Giant Sky Dome with procedural gradient
  const skyGeom = new THREE.SphereGeometry(700, 32, 24);
  const vertexShader = `
    varying vec3 vWorldPosition;
    void main() {
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPosition.xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;
  const fragmentShader = `
    uniform vec3 topColor;
    uniform vec3 bottomColor;
    varying vec3 vWorldPosition;
    void main() {
      float h = normalize(vWorldPosition).y;
      gl_FragColor = vec4(mix(bottomColor, topColor, max(h, 0.0)), 1.0);
    }
  `;

  const uniforms = {
    topColor: { value: new THREE.Color(TIME_THEMES.day.skyTop) },
    bottomColor: { value: new THREE.Color(TIME_THEMES.day.skyBottom) }
  };

  const skyMat = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms,
    side: THREE.BackSide
  });

  skyMesh = new THREE.Mesh(skyGeom, skyMat);
  scene.add(skyMesh);

  scene.fog = new THREE.FogExp2(TIME_THEMES.day.fogColor, 0.0018);
}

function createCaucasusMountains() {
  mountainsGroup = new THREE.Group();

  // Mountain ridge in the north (Daşüz is near the foothills)
  const mountainCount = 18;
  const mountainGeom = new THREE.ConeGeometry(55, 85, 5);
  const mountainMat = new THREE.MeshStandardMaterial({
    color: 0x223a30,
    roughness: 0.95,
    flatShading: true
  });

  for (let i = 0; i < mountainCount; i++) {
    const m = new THREE.Mesh(mountainGeom, mountainMat);
    const x = (i - mountainCount / 2) * 45 + (Math.random() - 0.5) * 20;
    const z = -280 - Math.random() * 80;
    const scale = 0.8 + Math.random() * 0.7;
    m.scale.set(scale, scale * (1 + Math.random() * 0.4), scale);
    m.position.set(x, 30 * scale, z);
    m.rotation.y = Math.random() * Math.PI;
    mountainsGroup.add(m);
  }

  scene.add(mountainsGroup);
}

function setupLights() {
  hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0x2e4a3d, 0.95);
  scene.add(hemiLight);

  sunLight = new THREE.DirectionalLight(0xfff7ed, 2.4);
  sunLight.position.set(130, 180, -90);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 2048;
  sunLight.shadow.mapSize.height = 2048;
  sunLight.shadow.camera.near = 10;
  sunLight.shadow.camera.far = 500;
  sunLight.shadow.camera.left = -170;
  sunLight.shadow.camera.right = 170;
  sunLight.shadow.camera.top = 170;
  sunLight.shadow.camera.bottom = -170;
  sunLight.shadow.bias = -0.0004;
  scene.add(sunLight);

  fillLight = new THREE.DirectionalLight(0x6ee7b7, 0.45);
  fillLight.position.set(-100, 60, 90);
  scene.add(fillLight);
}

function createTerrain() {
  // Main Plot (26.5m x 320m)
  const geom = new THREE.PlaneGeometry(PLOT_WIDTH, PLOT_LENGTH, 64, 256);
  geom.rotateX(-Math.PI / 2);

  // High-Resolution Procedural Soil Texture
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 2048;
  const ctx = canvas.getContext('2d');

  // Base grass meadow
  ctx.fillStyle = '#2d4734';
  ctx.fillRect(0, 0, 1024, 2048);

  // Tilled, rich loam soil along the 5 rows
  for (let i = 0; i < 5; i++) {
    const x = (1024 / 6) * (i + 1);

    // Deep fertile dark soil bed
    ctx.fillStyle = '#1c261e';
    ctx.fillRect(x - 52, 0, 104, 2048);

    // Raised soil ridge center
    ctx.fillStyle = '#221e17';
    ctx.fillRect(x - 30, 0, 60, 2048);

    // Drip moistened circular spots along rows
    for (let j = 0; j < 60; j++) {
      const y = (2048 / 62) * (j + 1);
      ctx.beginPath();
      ctx.arc(x, y, 22, 0, Math.PI * 2);
      ctx.fillStyle = '#111812';
      ctx.fill();
    }
  }

  // Natural texture noise
  for (let i = 0; i < 9000; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? '#243b2a' : '#182b20';
    ctx.fillRect(Math.random() * 1024, Math.random() * 2048, 2, 2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 1);

  const mat = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.85,
    metalness: 0.05
  });

  const ground = new THREE.Mesh(geom, mat);
  ground.receiveShadow = true;
  scene.add(ground);

  // Surrounding vast landscape
  const outerGeom = new THREE.PlaneGeometry(900, 900);
  outerGeom.rotateX(-Math.PI / 2);
  const outerMat = new THREE.MeshStandardMaterial({
    color: 0x1e3325,
    roughness: 0.95
  });
  const outerGround = new THREE.Mesh(outerGeom, outerMat);
  outerGround.position.y = -0.08;
  outerGround.receiveShadow = true;
  scene.add(outerGround);
}

function createCadastralBoundary() {
  boundaryGroup = new THREE.Group();

  const halfW = PLOT_WIDTH / 2;
  const halfL = PLOT_LENGTH / 2;
  const points = [
    new THREE.Vector3(-halfW, 0.15, -halfL),
    new THREE.Vector3(halfW, 0.15, -halfL),
    new THREE.Vector3(halfW, 0.15, halfL),
    new THREE.Vector3(-halfW, 0.15, halfL),
    new THREE.Vector3(-halfW, 0.15, -halfL)
  ];

  // Neon-red dashed boundary line
  const lineGeom = new THREE.BufferGeometry().setFromPoints(points);
  const lineMat = new THREE.LineDashedMaterial({
    color: 0xef4444,
    dashSize: 2.5,
    gapSize: 1.2,
    linewidth: 2
  });
  const borderLine = new THREE.Line(lineGeom, lineMat);
  borderLine.computeLineDistances();
  boundaryGroup.add(borderLine);

  // Cadastral Corner Boundary Pillars
  const postGeom = new THREE.CylinderGeometry(0.14, 0.18, 1.4, 8);
  const postMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.35 });

  points.slice(0, 4).forEach((pt) => {
    const post = new THREE.Mesh(postGeom, postMat);
    post.position.set(pt.x, 0.7, pt.z);
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
    new THREE.Vector3(-halfW, 0.2, -halfL - 4.5),
    new THREE.Vector3(halfW, 0.2, -halfL - 4.5)
  );

  // Length ruler label line (320m)
  createDimensionLine(
    new THREE.Vector3(halfW + 4.5, 0.2, -halfL),
    new THREE.Vector3(halfW + 4.5, 0.2, halfL)
  );

  scene.add(dimensionsGroup);
}

function createDimensionLine(start, end) {
  const lineGeom = new THREE.BufferGeometry().setFromPoints([start, end]);
  const lineMat = new THREE.LineBasicMaterial({ color: 0x38bdf8 });
  const line = new THREE.Line(lineGeom, lineMat);
  dimensionsGroup.add(line);

  // End ticks
  const tickGeom = new THREE.CylinderGeometry(0.04, 0.04, 1.8, 6);
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
  // Realistic Hazelnut Tree Geometry:
  // Tapered trunk + flared base
  const trunkGeom = new THREE.CylinderGeometry(0.07, 0.16, 1.6, 8);
  const trunkMat = new THREE.MeshStandardMaterial({
    color: 0x4a3222,
    roughness: 0.9,
    metalness: 0.05
  });

  // Base root flare
  const rootGeom = new THREE.CylinderGeometry(0.16, 0.28, 0.35, 8);

  // Foliage cluster geometry
  const foliageClusterGeom = new THREE.DodecahedronGeometry(0.85, 2);

  const mainLeafMat = new THREE.MeshStandardMaterial({
    color: 0x2d6a4f,
    roughness: 0.72,
    metalness: 0.08,
    flatShading: true
  });

  const mainLeafMatAccent = new THREE.MeshStandardMaterial({
    color: 0x40916c,
    roughness: 0.7,
    flatShading: true
  });

  const pollinizerLeafMat = new THREE.MeshStandardMaterial({
    color: 0x74a822,
    roughness: 0.65,
    flatShading: true
  });

  const catkinMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    roughness: 0.5
  });

  // Identification Stake for Pollinizers
  const stakeGeom = new THREE.CylinderGeometry(0.03, 0.03, 1.9, 6);
  const stakeMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.3 });

  let treeCounter = 1;
  const startZ = -(PLOT_LENGTH / 2) + 12;

  for (let r = 0; r < ROWS_COUNT; r++) {
    const rowX = (r - 2) * ROW_SPACING;

    for (let c = 0; c < TREES_PER_ROW; c++) {
      const treeZ = startZ + c * TREE_SPACING;

      // Determine if pollinizer (Staggered chess pattern every 10 trees)
      let isPollinizer = false;
      let variety = 'Tonda di Giffoni (Əsas İntensiv)';

      if (r % 2 === 0 && (c % 10 === 4)) {
        isPollinizer = true;
      } else if (r % 2 === 1 && (c % 10 === 9)) {
        isPollinizer = true;
      }

      if (isPollinizer) {
        variety = (treeCounter % 2 === 0) ? 'Nocchione (Tozlayıcı)' : 'Mortarella (Tozlayıcı)';
      }

      const treeGroup = new THREE.Group();
      treeGroup.position.set(rowX, 0, treeZ);

      const naturalScale = 0.92 + Math.random() * 0.16;

      // 1. Trunk & Roots
      const trunk = new THREE.Mesh(trunkGeom, trunkMat);
      trunk.position.y = 0.8;
      trunk.rotation.z = (Math.random() - 0.5) * 0.08;
      trunk.castShadow = true;
      trunk.receiveShadow = true;
      treeGroup.add(trunk);

      const roots = new THREE.Mesh(rootGeom, trunkMat);
      roots.position.y = 0.17;
      roots.castShadow = true;
      roots.receiveShadow = true;
      treeGroup.add(roots);

      // 2. Multi-Cluster Organic Canopy (3-4 intersecting clusters)
      const canopyGroup = new THREE.Group();
      canopyGroup.position.y = 1.9;

      const clusterOffsets = [
        { x: 0, y: 0.25, z: 0, s: 1.15 },
        { x: 0.45, y: -0.1, z: 0.2, s: 0.85 },
        { x: -0.4, y: -0.05, z: -0.25, s: 0.88 },
        { x: 0.15, y: -0.15, z: -0.38, s: 0.78 }
      ];

      const currentMat = isPollinizer ? pollinizerLeafMat : mainLeafMat;

      clusterOffsets.forEach((off, idx) => {
        const cluster = new THREE.Mesh(
          foliageClusterGeom,
          (idx % 2 === 1 && !isPollinizer) ? mainLeafMatAccent : currentMat
        );
        cluster.position.set(off.x, off.y, off.z);
        cluster.scale.setScalar(off.s * naturalScale);
        cluster.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
        cluster.castShadow = true;
        cluster.receiveShadow = true;
        canopyGroup.add(cluster);
      });

      // Pollinizer Golden Catkin Accents & Stake
      if (isPollinizer) {
        // Golden catkin tassels hanging from canopy
        for (let k = 0; k < 3; k++) {
          const catkin = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.35, 6), catkinMat);
          catkin.position.set((k - 1) * 0.4, -0.45, (Math.random() - 0.5) * 0.3);
          canopyGroup.add(catkin);
        }

        // Orange identification stake
        const stake = new THREE.Mesh(stakeGeom, stakeMat);
        stake.position.set(0.3, 0.95, 0.15);
        stake.rotation.z = 0.06;
        treeGroup.add(stake);

        // Marker indicator flag
        const flagGeom = new THREE.BoxGeometry(0.2, 0.15, 0.02);
        const flagMat = new THREE.MeshBasicMaterial({ color: 0xf97316 });
        const flag = new THREE.Mesh(flagGeom, flagMat);
        flag.position.set(0.42, 1.8, 0.15);
        treeGroup.add(flag);

        pollinatorTrees.push(treeGroup);
      }

      treeGroup.add(canopyGroup);

      // Metadata for Inspector
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

  const pipeMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.5 });
  const waterDropMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });

  // 1. Main Header Distribution Pipe (across width)
  const mainPipeGeom = new THREE.CylinderGeometry(0.07, 0.07, PLOT_WIDTH - 3.5, 12);
  const mainPipe = new THREE.Mesh(mainPipeGeom, pipeMat);
  mainPipe.rotation.z = Math.PI / 2;
  mainPipe.position.set(0, 0.07, -(PLOT_LENGTH / 2) + 8);
  irrigationGroup.add(mainPipe);

  // 2. Filtration & Fertigation Station
  const pumpStation = new THREE.Group();
  pumpStation.position.set(-PLOT_WIDTH / 2 + 2, 0, -(PLOT_LENGTH / 2) + 7);

  // Base platform
  const baseGeom = new THREE.BoxGeometry(2.4, 0.15, 1.8);
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x374151, roughness: 0.7 });
  const baseMesh = new THREE.Mesh(baseGeom, baseMat);
  baseMesh.position.y = 0.08;
  pumpStation.add(baseMesh);

  // Disc filter cylinder (Industrial Blue)
  const filterGeom = new THREE.CylinderGeometry(0.32, 0.32, 1.2, 16);
  const filterMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.35 });
  const filterMesh = new THREE.Mesh(filterGeom, filterMat);
  filterMesh.position.set(-0.5, 0.7, 0);
  filterMesh.castShadow = true;
  pumpStation.add(filterMesh);

  // Pressure gauge on filter
  const gaugeGeom = new THREE.CylinderGeometry(0.09, 0.09, 0.05, 12);
  const gaugeMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.3 });
  const gaugeMesh = new THREE.Mesh(gaugeGeom, gaugeMat);
  gaugeMesh.rotation.x = Math.PI / 2;
  gaugeMesh.position.set(-0.5, 1.35, 0.25);
  pumpStation.add(gaugeMesh);

  // Venturi Fertilizer Tank (Clean White)
  const fertGeom = new THREE.CylinderGeometry(0.38, 0.38, 1.0, 16);
  const fertMat = new THREE.MeshStandardMaterial({ color: 0xf3f4f6, roughness: 0.3 });
  const fertMesh = new THREE.Mesh(fertGeom, fertMat);
  fertMesh.position.set(0.65, 0.6, 0);
  fertMesh.castShadow = true;
  pumpStation.add(fertMesh);

  irrigationGroup.add(pumpStation);

  // 3. 5 Lateral Drip lines running down each row
  const lineLength = PLOT_LENGTH - 16;
  const lineGeom = new THREE.CylinderGeometry(0.025, 0.025, lineLength, 6);

  for (let r = 0; r < ROWS_COUNT; r++) {
    const rowX = (r - 2) * ROW_SPACING;
    const dripLine = new THREE.Mesh(lineGeom, pipeMat);
    dripLine.rotation.x = Math.PI / 2;
    dripLine.position.set(rowX, 0.04, 0);
    irrigationGroup.add(dripLine);

    // Emitters / Water Droplets under trees
    const dropGeom = new THREE.SphereGeometry(0.045, 6, 6);
    const startZ = -(PLOT_LENGTH / 2) + 12;
    for (let c = 0; c < TREES_PER_ROW; c++) {
      const tz = startZ + c * TREE_SPACING;
      const drop = new THREE.Mesh(dropGeom, waterDropMat);
      drop.position.set(rowX + 0.16, 0.05, tz);
      drop.userData = { isDripper: true, baseY: 0.05, phase: Math.random() * Math.PI };
      irrigationGroup.add(drop);
    }
  }

  scene.add(irrigationGroup);
}

function createAyrichayRiver() {
  riverGroup = new THREE.Group();

  // 1. Winding River Course directly at the HEAD of the field (Z < -160)
  // Perfectly matching the user's satellite drawing:
  // River enters from the west, loops directly in front of the field's short head, then turns south!
  const riverCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-140, -0.2, -165),
    new THREE.Vector3(-95, -0.2, -180),
    new THREE.Vector3(-55, -0.2, -195), // Apex loop directly off field head!
    new THREE.Vector3(-45, -0.2, -225),
    new THREE.Vector3(-30, -0.2, -280)
  ]);

  // River water ribbon
  const riverTubeGeom = new THREE.TubeGeometry(riverCurve, 64, 14, 8, false);
  const riverWaterMat = new THREE.MeshStandardMaterial({
    color: 0x0284c7,
    roughness: 0.12,
    metalness: 0.75,
    transparent: true,
    opacity: 0.94
  });
  const riverMesh = new THREE.Mesh(riverTubeGeom, riverWaterMat);
  riverMesh.scale.set(1, 0.08, 1);
  riverMesh.position.y = -0.22;
  riverGroup.add(riverMesh);

  // Riverbed gravel bank
  const riverBedMat = new THREE.MeshStandardMaterial({ color: 0x473f33, roughness: 0.95 });
  const riverBedMesh = new THREE.Mesh(new THREE.TubeGeometry(riverCurve, 64, 18, 6, false), riverBedMat);
  riverBedMesh.scale.set(1, 0.05, 1);
  riverBedMesh.position.y = -0.34;
  riverGroup.add(riverBedMesh);

  // Riparian Trees & Shrubs along the river bend
  const bushGeom = new THREE.DodecahedronGeometry(2.6, 1);
  const bushMat = new THREE.MeshStandardMaterial({ color: 0x1b4d32, roughness: 0.8, flatShading: true });
  const bushMat2 = new THREE.MeshStandardMaterial({ color: 0x276743, roughness: 0.75, flatShading: true });

  const points = riverCurve.getPoints(24);
  points.forEach((pt, idx) => {
    // Outer bank bush
    const b1 = new THREE.Mesh(bushGeom, idx % 2 === 0 ? bushMat : bushMat2);
    b1.position.set(pt.x - 14 - Math.random() * 6, 1.2, pt.z - 8 + (Math.random() - 0.5) * 6);
    b1.scale.setScalar(0.85 + Math.random() * 0.5);
    riverGroup.add(b1);

    // Inner bank bush (towards plot head)
    const b2 = new THREE.Mesh(bushGeom, idx % 2 === 1 ? bushMat : bushMat2);
    b2.position.set(pt.x + 12 + Math.random() * 5, 1.2, pt.z + 8 + (Math.random() - 0.5) * 6);
    b2.scale.setScalar(0.8 + Math.random() * 0.5);
    riverGroup.add(b2);
  });

  // 2. Dirt Farm Road curling around the field head
  const roadCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-PLOT_WIDTH / 2 - 2, 0.05, -(PLOT_LENGTH / 2) + 20),
    new THREE.Vector3(-PLOT_WIDTH / 2 - 2, 0.05, -(PLOT_LENGTH / 2) - 5),
    new THREE.Vector3(-PLOT_WIDTH / 2 + 10, 0.05, -(PLOT_LENGTH / 2) - 15),
    new THREE.Vector3(PLOT_WIDTH / 2 + 6, 0.05, -(PLOT_LENGTH / 2) - 18)
  ]);
  const roadTube = new THREE.TubeGeometry(roadCurve, 32, 2.2, 4, false);
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x544738, roughness: 0.95 });
  const roadMesh = new THREE.Mesh(roadTube, roadMat);
  roadMesh.scale.set(1, 0.02, 1);
  roadMesh.position.y = 0.02;
  riverGroup.add(roadMesh);

  // 3. Riverside Intake Pumping Station at the river loop apex
  const intakePos = new THREE.Vector3(-55, 0.1, -195);
  const intakeStation = new THREE.Group();
  intakeStation.position.copy(intakePos);

  const platGeom = new THREE.BoxGeometry(3.5, 0.25, 3);
  const platMat = new THREE.MeshStandardMaterial({ color: 0x4b5563, roughness: 0.7 });
  const platform = new THREE.Mesh(platGeom, platMat);
  platform.position.y = 0.12;
  intakeStation.add(platform);

  const pumpGeom = new THREE.BoxGeometry(1.6, 1.2, 1.2);
  const pumpMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.4 });
  const pump = new THREE.Mesh(pumpGeom, pumpMat);
  pump.position.set(0, 0.75, 0);
  pump.castShadow = true;
  intakeStation.add(pump);

  // Suction pipe into river
  const suctionGeom = new THREE.CylinderGeometry(0.12, 0.12, 8, 8);
  const suctionPipe = new THREE.Mesh(suctionGeom, new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 }));
  suctionPipe.position.set(-3.5, -0.1, 0);
  suctionPipe.rotation.z = Math.PI / 2.3;
  intakeStation.add(suctionPipe);

  riverGroup.add(intakeStation);

  // 4. Short Connecting Pipe from Ayrichay Apex to Orchard Filtration Station
  const filterStationPos = new THREE.Vector3(-PLOT_WIDTH / 2 + 2, 0.1, -(PLOT_LENGTH / 2) + 7);
  const pipeLength = intakePos.distanceTo(filterStationPos);

  const mainSupplyPipeGeom = new THREE.CylinderGeometry(0.08, 0.08, pipeLength, 8);
  const mainSupplyPipeMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.4 });
  const mainSupplyPipe = new THREE.Mesh(mainSupplyPipeGeom, mainSupplyPipeMat);

  const midPoint = new THREE.Vector3().addVectors(intakePos, filterStationPos).multiplyScalar(0.5);
  mainSupplyPipe.position.copy(midPoint);
  mainSupplyPipe.position.y = 0.08;
  mainSupplyPipe.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    filterStationPos.clone().sub(intakePos).normalize()
  );
  riverGroup.add(mainSupplyPipe);

  // 5. Water Flow Pulse Spheres along the supply pipe
  waterPulses = [];
  const pulseGeom = new THREE.SphereGeometry(0.25, 8, 8);
  const pulseMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
  for (let i = 0; i < 6; i++) {
    const pulse = new THREE.Mesh(pulseGeom, pulseMat);
    pulse.userData = {
      start: intakePos.clone(),
      end: filterStationPos.clone(),
      progress: i / 6
    };
    pulse.position.lerpVectors(intakePos, filterStationPos, pulse.userData.progress);
    pulse.position.y = 0.25;
    waterPulses.push(pulse);
    riverGroup.add(pulse);
  }

  scene.add(riverGroup);
}

function createPollenParticles() {
  const particleCount = 450;
  const geom = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);

  for (let i = 0; i < particleCount; i++) {
    positions[i * 3] = (Math.random() - 0.5) * PLOT_WIDTH;
    positions[i * 3 + 1] = 1.0 + Math.random() * 3.2;
    positions[i * 3 + 2] = (Math.random() - 0.5) * PLOT_LENGTH;
  }

  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const mat = new THREE.PointsMaterial({
    color: 0xfacc15,
    size: 0.3,
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending
  });

  pollenParticles = new THREE.Points(geom, mat);
  scene.add(pollenParticles);
}

function createHighlightRing() {
  const ringGeom = new THREE.RingGeometry(1.2, 1.45, 32);
  ringGeom.rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x34d399,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.9
  });
  highlightRing = new THREE.Mesh(ringGeom, ringMat);
  highlightRing.position.y = 0.06;
  highlightRing.visible = false;
  scene.add(highlightRing);
}

function onPointerDown(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);

  const intersectObjects = [];
  trees.forEach(t => {
    t.children.forEach(child => {
      if (child.isGroup) {
        child.children.forEach(c => intersectObjects.push(c));
      } else {
        intersectObjects.push(child);
      }
    });
  });

  const intersects = raycaster.intersectObjects(intersectObjects);

  if (intersects.length > 0) {
    let hit = intersects[0].object;
    while (hit.parent && !hit.userData.id) {
      hit = hit.parent;
    }
    if (hit && hit.userData && hit.userData.id) {
      selectTree(hit);
    }
  }
}

function selectTree(tree) {
  selectedTreeMesh = tree;

  highlightRing.position.set(tree.position.x, 0.06, tree.position.z);
  highlightRing.visible = true;

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

  // Time of Day buttons
  document.querySelectorAll('.time-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const time = btn.dataset.time;
      applyTimeTheme(time);
    });
  });

  // Left Panel Collapse / Expand
  const leftPanel = document.getElementById('left-panel');
  const togglePanelBtn = document.getElementById('toggle-panel-btn');
  const openPanelBtn = document.getElementById('open-panel-btn');

  togglePanelBtn.addEventListener('click', () => {
    leftPanel.classList.add('collapsed');
    openPanelBtn.classList.remove('hidden');
  });

  openPanelBtn.addEventListener('click', () => {
    leftPanel.classList.remove('collapsed');
    openPanelBtn.classList.add('hidden');
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
    pollenParticles.material.opacity = isWindOn ? 0.8 : 0.0;
  });

  // Toggle Dimensions
  const dimBtn = document.getElementById('toggle-dimensions-btn');
  dimBtn.addEventListener('click', () => {
    isDimensionsOn = !isDimensionsOn;
    dimensionsGroup.visible = isDimensionsOn;
    dimBtn.classList.toggle('active', isDimensionsOn);
  });
}

function applyTimeTheme(themeName) {
  currentTimeMode = themeName;
  const theme = TIME_THEMES[themeName];
  if (!theme) return;

  // Sky shader colors
  if (skyMesh && skyMesh.material.uniforms) {
    skyMesh.material.uniforms.topColor.value.setHex(theme.skyTop);
    skyMesh.material.uniforms.bottomColor.value.setHex(theme.skyBottom);
  }

  // Fog & Lights
  scene.fog.color.setHex(theme.fogColor);
  sunLight.color.setHex(theme.sunColor);
  sunLight.intensity = theme.sunIntensity;
  hemiLight.color.setHex(theme.hemiSky);
  hemiLight.groundColor.setHex(theme.hemiGround);
  hemiLight.intensity = theme.hemiIntensity;
  renderer.toneMappingExposure = theme.exposure;
}

function switchCameraMode(mode) {
  const target = CAM_PRESETS[mode];
  if (!target) return;

  const startPos = camera.position.clone();
  const startTarget = controls.target.clone();
  const duration = 1200;
  const startTime = performance.now();

  function step(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1.0);
    const ease = 0.5 - Math.cos(progress * Math.PI) / 2;

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
function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();
  const time = clock.getElapsedTime();

  controls.update();

  // Selection ring rotation
  if (highlightRing && highlightRing.visible) {
    highlightRing.rotation.z += 0.02;
  }

  // Animate Water drops
  if (isIrrigationOn && irrigationGroup.visible) {
    irrigationGroup.children.forEach(child => {
      if (child.userData && child.userData.isDripper) {
        child.position.y = child.userData.baseY + Math.sin(time * 6 + child.userData.phase) * 0.025;
      }
    });
  }

  // Animate Water pulses along the Ayrichay supply pipe
  if (isIrrigationOn && waterPulses.length > 0) {
    waterPulses.forEach(p => {
      p.userData.progress += 0.003;
      if (p.userData.progress > 1.0) p.userData.progress = 0.0;
      p.position.lerpVectors(p.userData.start, p.userData.end, p.userData.progress);
      p.position.y = 0.25;
    });
  }

  // Animate Pollen Drift
  if (isWindOn && pollenParticles) {
    const positions = pollenParticles.geometry.attributes.position.array;
    for (let i = 0; i < positions.length; i += 3) {
      positions[i] += Math.sin(time + positions[i + 2]) * 0.035;
      positions[i + 2] += 0.4;

      if (positions[i + 2] > PLOT_LENGTH / 2) {
        positions[i + 2] = -PLOT_LENGTH / 2;
      }
    }
    pollenParticles.geometry.attributes.position.needsUpdate = true;
  }

  renderer.render(scene, camera);
}
