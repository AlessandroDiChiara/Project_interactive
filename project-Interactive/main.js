import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import * as CANNON from 'https://cdn.jsdelivr.net/npm/cannon-es@0.20.0/dist/cannon-es.js';   
import { BallMachine } from './src/cannone.js';
import { addForest, rectFromObject } from './src/forest.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { SunsetController } from './src/sunset.js';
import { StadiumLamps } from './src/lamp.js';
import { TargetManager } from './src/target.js'; 
import { GhostBallManager } from './src/GhostBallManager.js'; 

// --- GESTIONE DELLA SCHERMATA DI AVVIO ---
const startScreen = document.getElementById('start-screen');
const easyBtn = document.getElementById('easy-btn');
const hardBtn = document.getElementById('hard-btn');

function initializeGame(ballCount) {
  // Dissolvenza della schermata di avvio
  startScreen.style.opacity = '0';
  
  // Dopo l'animazione, nascondi la schermata per non bloccare i click sul gioco
  setTimeout(() => {
    startScreen.style.display = 'none';
  }, 500); // 500ms, come la transizione CSS

  // Avvia il gioco vero e proprio
  startGame(ballCount);
}

easyBtn.addEventListener('click', () => {
  initializeGame(40); // Modalità facile con 40 palline
});

hardBtn.addEventListener('click', () => {
  initializeGame(15); // Modalità difficile con 15 palline
});
const playAgainWinBtn = document.getElementById('play-again-win');
const playAgainLoseBtn = document.getElementById('play-again-lose');

function restartGame() {
  location.reload();
}

if(playAgainWinBtn) playAgainWinBtn.addEventListener('click', restartGame);
if(playAgainLoseBtn) playAgainLoseBtn.addEventListener('click', restartGame);

// Tutta la logica del gioco viene spostata dentro questa funzione asincrona
async function startGame(initialBallCount) {
   // --- Stato del Gioco e Riferimenti UI ---
  let score = 0;
  let remainingBalls = initialBallCount;
  const targetScore = 750;
let isGameOver = false;
  const scoreEl = document.getElementById('score');
  const ballsEl = document.getElementById('balls');
  const winScreen = document.getElementById('win-screen');

  // --- Funzioni di gestione ---


  // Aggiorna i numeri nell'interfaccia
  function updateUI() {
    if(scoreEl) scoreEl.textContent = score;
    if(ballsEl) ballsEl.textContent = remainingBalls;
  }

  // Chiamata quando un bersaglio viene colpito
  function handleScoreUpdate(points) {
    if (isGameOver) return;
    score += points;
    updateUI(); // Aggiorna il punteggio mostrato
    
    // Controlla se il giocatore ha vinto
    if (score >= targetScore) {
      if(winScreen) winScreen.style.display = 'flex';
    }
  }
  
  // Chiamata quando una palla viene sparata
  function onBallShot() {
    if (isGameOver) return;
    if (remainingBalls > 0) {
      remainingBalls--;
      updateUI();
      
      // Controlla se il giocatore ha perso
      if (remainingBalls === 0 && score < targetScore) {
        isGameOver = true;
        document.getElementById('game-over-screen').style.display = 'flex';
      }
    }
  }

  // Inizializza l'interfaccia con i valori di partenza
  updateUI();


// === 1) SCENA, CAMERA, RENDERER ===
const scene = new THREE.Scene();
let controls;
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 6, 10);
camera.lookAt(0, 0, 0);

// === RESIZE ===
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 2;
controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.target.set(0, 0.6, 0);
controls.minDistance = 5;
controls.maxDistance = 60;
controls.minPolarAngle = Math.PI / 2;
controls.maxPolarAngle = Math.PI / 2;
controls.enablePan = true;
controls.enableRotate = true;
controls.enableZoom = true;

document.addEventListener('keydown', (e) => {
  const step = 0.3;
  if (e.key === 'ArrowRight') { camera.position.x += step; controls.target.x += step; }
  if (e.key === 'ArrowLeft')  { camera.position.x -= step; controls.target.x -= step; }
});

document.body.appendChild(renderer.domElement);

scene.background = null;
renderer.setClearColor(0xb7d5ff, 1);
scene.fog = new THREE.Fog(0xb7d5ff, 180, 650);
renderer.physicallyCorrectLights = true;

// === 2) LUCI ===
const hemi = new THREE.HemisphereLight(0xbbe1ff, 0x334422, 6);
scene.add(hemi);
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);
const sun = new THREE.DirectionalLight(0xffffff, 1.5);
sun.position.set(20, 40, 10);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 1;
sun.shadow.camera.far  = 160;
sun.shadow.camera.left = -80;
sun.shadow.camera.right = 80;
sun.shadow.camera.top = 80;
sun.shadow.camera.bottom = -80;
sun.shadow.radius = 2.5;
scene.add(sun);
const fieldWidth = 28.5;
const fieldLength = 35.66;
const sunset = new SunsetController(scene, sun, hemi, renderer, {
  durationSec: 150, autoStart: true
});
const lampPositions = [
  new THREE.Vector3(-13, 0, -19), new THREE.Vector3( 13, 0, -19),
  new THREE.Vector3(-13, 0, 19), new THREE.Vector3( 13, 0,  19),
   // Pali sui lati corti (NUOVI)
  new THREE.Vector3(0, 0, -19),   // Un palo dietro la linea di fondo
  new THREE.Vector3(0, 0, 19),    // Un palo dietro l'altra linea di fondo
];

const lamps = new StadiumLamps(scene, {
  positions: lampPositions, shadow: true, spotMaxIntensity: 95, glowMaxIntensity: 0.8,
});
lamps.tuneForCourt({
  cx: 0, 
  cz: 0, 
  halfW: fieldWidth / 2, 
  halfL: fieldLength / 2,
  aim: 0.85 
});
window.addEventListener('keydown', e => { if (e.code === 'KeyX') { lamps.setIntensity(1.0); } });
sunset.attachLamps(lamps);

// === 3) CAMPO VISIVO (Three.js) ===
const loader = new THREE.TextureLoader();
const grassTexture = loader.load('assets/Grass005_1K-JPG_Color.jpg');
const normalMap = loader.load('assets/Grass005_1K-JPG_NormalGL.jpg');
grassTexture.wrapS = grassTexture.wrapT = THREE.RepeatWrapping;
normalMap.wrapS = normalMap.wrapT = THREE.RepeatWrapping;
grassTexture.repeat.set(6, 3);
normalMap.repeat.set(6, 3);
const fieldMaterial = new THREE.MeshStandardMaterial({ map: grassTexture, normalMap, roughness: 0.8 });

const fieldHalfWidth = fieldWidth / 2;
const fieldHalfLength = fieldLength / 2;
const fieldGeometry = new THREE.PlaneGeometry(fieldWidth, fieldLength);
const field = new THREE.Mesh(fieldGeometry, fieldMaterial);
field.rotation.x = -Math.PI / 2;
field.position.y = 0.003;
field.receiveShadow = true;
scene.add(field);

const sideRunoff = 12.0;
const backRunoff = 9.0;
const apronWidth  = fieldWidth  + sideRunoff * 2;
const apronLength = fieldLength + backRunoff * 2;
const apronMat = new THREE.MeshStandardMaterial({ color: 0xc6463f, roughness: 0.98, metalness: 0.05 });
const apron = new THREE.Mesh(new THREE.PlaneGeometry(apronWidth, apronLength), apronMat);
apron.rotation.x = -Math.PI / 2;
apron.position.y = 0.000;
apron.receiveShadow = true;
scene.add(apron);

// Linee campo (modificate per rimuovere la linea centrale della rete)
function addLine(x, z, width, depth) {
  const g = new THREE.PlaneGeometry(width, depth);
  const m = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const mesh = new THREE.Mesh(g, m);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, 0.006, z);
  scene.add(mesh);
}
const servizio = 6.40; const W_singolo = 8.23; const W_singolo_half = W_singolo / 2; const margin = 0.8; const lineThickness = 0.05;
addLine(-fieldHalfWidth + margin, 0, lineThickness, fieldLength - 2 * margin); addLine(+fieldHalfWidth - margin, 0, lineThickness, fieldLength - 2 * margin);
addLine(0, -fieldHalfLength + margin, fieldWidth - 2 * margin, lineThickness); addLine(0, +fieldHalfLength + -margin, fieldWidth - 2 * margin, lineThickness);
addLine(-W_singolo_half, 0, lineThickness, fieldLength - 2 * margin); addLine(+W_singolo_half, 0, lineThickness, fieldLength - 2 * margin);
addLine(0, +servizio, W_singolo + lineThickness, lineThickness); addLine(0, -servizio, W_singolo + lineThickness, lineThickness);
addLine(0, 0, lineThickness, servizio * 2);

// === 4) MONDO FISICO (Cannon) ===
const world = new CANNON.World();
world.gravity.set(0, -9.82, 0);
world.broadphase = new CANNON.SAPBroadphase(world);
world.allowSleep = true;
world.defaultContactMaterial.friction = 0.4;
world.defaultContactMaterial.restitution = 0.55;
world.solver.iterations = 40;
world.solver.tolerance = 1e-5;

const groundMat = new CANNON.Material('ground');
const groundBody = new CANNON.Body({ mass: 0, shape: new CANNON.Plane(), material: groundMat });
groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
world.addBody(groundBody);
const GROUND_Y = 0.0; const CAM_MIN_Y = GROUND_Y + 0.15; const TARGET_MIN_Y = GROUND_Y + 0.10;
controls.addEventListener('change', () => {
  if (controls.target.y < TARGET_MIN_Y) controls.target.y = TARGET_MIN_Y;
  if (camera.position.y < CAM_MIN_Y)    camera.position.y = CAM_MIN_Y;
});

// === 5) RETE RIMOSSA ===
// (Tutto il codice per la rete fisica e visiva è stato eliminato da qui)

// --- PANCHINE ---
function makeBench() {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x9a714a, roughness: 0.8 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x6e6e6e, roughness: 0.5, metalness: 0.5 });
  const benchLength = 2.5; const seatDepth = 0.50; const seatHeight = 0.45; const seatThickness = 0.06; const backHeight = 0.45;
  const seat = new THREE.Mesh(new THREE.BoxGeometry(benchLength, seatThickness, seatDepth), wood);
  seat.position.set(0, seatHeight, 0);
  const back = new THREE.Mesh(new THREE.BoxGeometry(benchLength, backHeight, seatThickness), wood);
  back.position.set(0, seatHeight + (backHeight / 2), - (seatDepth / 2) - (seatThickness / 2));
  const legGeo = new THREE.BoxGeometry(0.08, seatHeight, 0.08);
  const legX = benchLength / 2 - 0.1; const legZ = seatDepth / 2 - 0.08;
  const l1 = new THREE.Mesh(legGeo, metal); l1.position.set(-legX, seatHeight / 2, -legZ);
  const l2 = new THREE.Mesh(legGeo, metal); l2.position.set( legX, seatHeight / 2, -legZ);
  const l3 = new THREE.Mesh(legGeo, metal); l3.position.set(-legX, seatHeight / 2,  legZ);
  const l4 = new THREE.Mesh(legGeo, metal); l4.position.set( legX, seatHeight / 2,  legZ);
  [seat, back, l1, l2, l3, l4].forEach(m => { m.castShadow = true; m.receiveShadow = true; g.add(m); });
  return g;
}
function addBenches({ benchOffsetFromSideline = 1.3, zPositions = [-2.5, 2.5] } = {}) {
  const group = new THREE.Group();
  const xLeft  = -(fieldHalfWidth + benchOffsetFromSideline);
  const xRight = +(fieldHalfWidth + benchOffsetFromSideline);
  const faceCenter = (bench, x) => { bench.rotation.y = (x > 0) ? -Math.PI / 2 : +Math.PI / 2; };
  [ [xLeft, +Math.PI/2], [xRight, -Math.PI/2] ].forEach(([x]) => {
    zPositions.forEach(z => { const b = makeBench(); b.position.set(x, 0, z); faceCenter(b, x); group.add(b); });
  });
  scene.add(group); return group;
}
addBenches({ benchOffsetFromSideline: 1, zPositions: [-2.5, 2.5] });

// --- SPALTI E FORESTA --- (Codice invariato)
function makeBleacherZ({ tiers = 6, stepH = 0.3, stepD = 0.6, lengthZ = fieldLength + 2.0 } = {}) {
  const g = new THREE.Group(); const concrete = new THREE.MeshStandardMaterial({ color: 0x9e9e9e, roughness: 0.98, metalness: 0.0, envMapIntensity: 0.1 });
  for (let i = 0; i < tiers; i++) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(stepD, stepH, lengthZ), concrete);
    step.position.set(i * stepD + stepD / 2, (i + 0.5) * stepH, 0);
    step.castShadow = step.receiveShadow = true; g.add(step);
  } return g;
}
function addBleachers({ walkway = 2.0, tiers = 6, stepH = 0.3, stepD = 0.6, lengthZ = fieldLength + 2.0 } = {}) {
  const depth = tiers * stepD; const xInner = fieldHalfWidth + walkway;
  const rightB = makeBleacherZ({ tiers, stepH, stepD, lengthZ }); rightB.position.set(+xInner, 0, 0);
  const leftB  = makeBleacherZ({ tiers, stepH, stepD, lengthZ }); leftB.position.set(-xInner, 0, 0); leftB.rotation.y = Math.PI;
  scene.add(leftB, rightB); return { leftB, rightB };
}
const bleachers = addBleachers({ walkway: 3.0, tiers: 8, stepD: 0.75, lengthZ: fieldLength + 10 });
const extraExclusions = [];
if (bleachers?.leftB)  extraExclusions.push(rectFromObject(bleachers.leftB,  { padX: 0.6, padZ: 0.6 }));
if (bleachers?.rightB) extraExclusions.push(rectFromObject(bleachers.rightB, { padX: 0.6, padZ: 0.6 }));
const urlBush  = new URL('./Model/photorealistic_bush.glb', document.baseURI).href;
const urlTree  = new URL('./Model/stylized_tree.glb', document.baseURI).href;
await addForest(scene, {
  groundSize: 130,
  innerRect: { halfW: (fieldWidth + sideRunoff * 2) / 2 + 1.0, halfL: (fieldLength + backRunoff * 2) / 2 + 1.0 },
  exclusions: extraExclusions,
  grassTextureUrl: null,
  items: [
    { url: urlBush,  unit: 'mm', targetHeightMm: 3000, count: 120, minDist: 1.2,  yJitter: 0.03, instanced: false, doubleSideLeaves: true },
    { url: urlTree,  unit: 'mm', targetHeightMm: 8000, count: 150,  minDist: 2.5,  yJitter: 0.01, instanced: false }
  ]
});

// === 7) BALL MACHINE ===
const S = 1.6;
const ballMachine = new BallMachine(scene, new THREE.Vector3(0 *S, 0, 8*S), S, { onShoot: onBallShot });

ballMachine.initContainerBalls(initialBallCount);
ballMachine.autoShoot = false;
const keys = {};
window.addEventListener('keydown', e => {
  if (e.repeat) return; keys[e.code] = true;
  if (['KeyC','KeyV','KeyB','KeyN','Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault();
   if (e.code === 'Space' && !ballMachine._charging && !isGameOver) { // <-- Aggiungi !isGameOver
      ballMachine.beginCharge();
   }
});
window.addEventListener('keyup', e => {
  keys[e.code] = false;
  if (e.code === 'Space') ballMachine.endCharge();
});
function updateMachineInput() {
  const fwd = (keys['KeyC'] || keys['ArrowUp'] ? 1 : 0) + (keys['KeyV'] || keys['ArrowDown'] ? -1 : 0);
  ballMachine.driveForward(fwd);
}
ballMachine.setSpeed('medium');
if (typeof ballMachine.setPitch === 'function') ballMachine.setPitch(-0.06);
const PITCH_STEP = 0.04; const YAW_STEP = 0.06;
window.addEventListener('keydown', (e) => {
  switch (e.key.toLowerCase()) {
    case 'i': ballMachine.changePitch(-PITCH_STEP); break;
    case 'k': ballMachine.changePitch(+PITCH_STEP); break;
    case 'j': case 'arrowleft': ballMachine.changeYaw(+YAW_STEP); break;
    case 'l': case 'arrowright': ballMachine.changeYaw(-YAW_STEP); break;
  }
});
const targetManager = new TargetManager(scene, ballMachine.balls, ballMachine.ballRadius, { onScore: handleScoreUpdate });

targetManager.createAllTargets();


// === 8) LOOP ===
const clock = new THREE.Clock();
const ghostBallManager = new GhostBallManager(scene, clock); 
const FIXED = 1 / 120;
let acc = 0;
const MAX_STEPS = 3;

function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();

  acc += dt;
  let steps = 0;
  while (acc >= FIXED && steps < MAX_STEPS) {
    world.step(FIXED);
    acc -= FIXED;
    steps++;
  }

  // UPDATES
  ballMachine.updatePhysics(dt);
  targetManager.update(dt);
  ballMachine.updateMeshes(dt);
  ghostBallManager.update(dt, ballMachine.balls, ballMachine.ballRadius);
  lamps.update(dt);
  sunset.update(dt);
  
  controls?.update();
  renderer.render(scene, camera);
}

animate();
}