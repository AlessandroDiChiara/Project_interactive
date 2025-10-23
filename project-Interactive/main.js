import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import * as CANNON from 'https://cdn.jsdelivr.net/npm/cannon-es@0.20.0/dist/cannon-es.js';
import { BallMachine } from './src/cannone.js';
import { addProceduralForest } from './src/forest.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { SunsetController } from './src/sunset.js';
import { StadiumLamps } from './src/lamp.js';
import { TargetManager } from './src/target.js';
import { GhostBallManager } from './src/GhostBallManager.js';
import { ShatterEffect } from './src/ShatterEffect.js'; 


// starr screen with button 
const startScreen = document.getElementById('start-screen');
const easyBtn = document.getElementById('easy-btn');
const hardBtn = document.getElementById('hard-btn');
const buttonContainer = document.getElementById('button-container');
const countdownText = document.getElementById('countdown-text');
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const rulesBtn = document.getElementById('rules-btn');
const rulesScreen = document.getElementById('rules-screen');
const backToStartBtn = document.getElementById('back-to-start-btn');

function initializeGame(ballCount) {
  
  
  startScreen.style.opacity = '0';

  setTimeout(() => {
    startScreen.style.display = 'none';
  }, 500); 

  // start the game
  startGame(ballCount);
}

easyBtn.addEventListener('click', () => {
  initializeGame(40); // easy modality
});

hardBtn.addEventListener('click', () => {
  initializeGame(10); // hard modalitu 
});
rulesBtn.addEventListener('click', () => {
  if(startScreen) startScreen.style.display = 'none';
  if(rulesScreen) rulesScreen.style.display = 'flex';
});

// 
backToStartBtn.addEventListener('click', () => {
  if(rulesScreen) rulesScreen.style.display = 'none';
  if(startScreen) startScreen.style.display = 'flex';
});
// play again if yu win or lose
const playAgainWinBtn = document.getElementById('play-again-win');
const playAgainLoseBtn = document.getElementById('play-again-lose');

function restartGame() {
  location.reload();
}

if(playAgainWinBtn) playAgainWinBtn.addEventListener('click', restartGame);
if(playAgainLoseBtn) playAgainLoseBtn.addEventListener('click', restartGame);

// game logic
async function startGame(initialBallCount) {
   // initial state
  let score = 0;
  let remainingBalls = initialBallCount;
  const targetScore = 600;
  let isGameOver = false;
  const scoreEl = document.getElementById('score');
  const ballsEl = document.getElementById('balls');
  const winScreen = document.getElementById('win-screen');

  // charge bar
  const chargeContainer = document.getElementById('charge-container');
  const chargeBar = document.getElementById('charge-bar');



  // function tu update the number in ui
  function updateUI() {
    if(scoreEl) scoreEl.textContent = score;
    if(ballsEl) ballsEl.textContent = remainingBalls;
  }

  // hit the target
  function handleScoreUpdate(points) {
    if (isGameOver) return;
    score += points;
    updateUI(); //update the score

    // chekc if the player win
    if (score >= targetScore) {
      if(winScreen) winScreen.style.display = 'flex';
    }
  }

  // manage shoot
  function onBallShot() {
    if (isGameOver) return;
    if (remainingBalls > 0) {
      remainingBalls--;
      updateUI();

      // check if lose
      if (remainingBalls === 0 && score < targetScore) {
        isGameOver = true;
        document.getElementById('game-over-screen').style.display = 'flex';
      }
    }
  }

  updateUI();


//  SCENE, CAMERA, RENDERER ===
const scene = new THREE.Scene();
let controls;
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

// initial position
camera.position.set(0, 25, 30);
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
// initial target at the filed center
controls.target.set(0, 0, 0);
controls.minDistance = 5;
controls.maxDistance = 60;

controls.minPolarAngle = 0.1; 
controls.maxPolarAngle = Math.PI / 2 - 0.05; //  can't go under y=0
controls.enablePan = true;
controls.enableRotate = true;
controls.enableZoom = true;

document.addEventListener('keydown', (e) => {
  const step = 0.3;

  if (e.key === 'ArrowRight') { 
    camera.position.x += step; 
    controls.target.x += step; 
  }
  if (e.key === 'ArrowLeft')  { 
    camera.position.x -= step; 
    controls.target.x -= step; 
  }
  if (e.key === 'ArrowUp') { 
    camera.position.y += step; 
    controls.target.y += step; 
  }
  if (e.key === 'ArrowDown')  { 
    camera.position.y -= step; 
    controls.target.y -= step; 
  }
});
controls.addEventListener('change', () => {
  if (controls.target.y < TARGET_MIN_Y) controls.target.y = TARGET_MIN_Y;
  if (camera.position.y < CAM_MIN_Y)    camera.position.y = CAM_MIN_Y;
});

document.body.appendChild(renderer.domElement);

scene.background = null;
renderer.setClearColor(0xb7d5ff, 1);
scene.fog = new THREE.Fog(0xb7d5ff, 180, 650);
renderer.physicallyCorrectLights = true;

// light
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
  durationSec: 130, autoStart: true
});
// lamo positioning 
const lampPositions = [
  new THREE.Vector3(-13, 0, -19), new THREE.Vector3( 13, 0, -19),
  new THREE.Vector3(-13, 0, 19), new THREE.Vector3( 13, 0,  19),
   // lamp on the center
  new THREE.Vector3(0, 0, -19),  
  new THREE.Vector3(0, 0, 19),   
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

// tennis field with a texture
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
field.position.y = 0.01;
field.receiveShadow = true;
scene.add(field);

const sideRunoff = 12.0;
const backRunoff = 9.0;
// red field
const apronWidth  = fieldWidth  + sideRunoff * 2;
const apronLength = fieldLength + backRunoff * 2;
const apronMat = new THREE.MeshStandardMaterial({ color: 0xc6463f, roughness: 0.98, metalness: 0.05 });
const apron = new THREE.Mesh(new THREE.PlaneGeometry(apronWidth, apronLength), apronMat);
apron.rotation.x = -Math.PI / 2;
apron.position.y = 0.003;
apron.receiveShadow = true;
scene.add(apron);

// line for tennis court
function addLine(x, z, width, depth) {
  const g = new THREE.PlaneGeometry(width, depth);
  const m = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const mesh = new THREE.Mesh(g, m);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, 0.03, z);
  scene.add(mesh);
}
const servizio = 6.40; const W_singolo = 8.23; const W_singolo_half = W_singolo / 2; const margin = 0.8; const lineThickness = 0.05;
addLine(-fieldHalfWidth + margin, 0, lineThickness, fieldLength - 2 * margin); addLine(+fieldHalfWidth - margin, 0, lineThickness, fieldLength - 2 * margin);
addLine(0, -fieldHalfLength + margin, fieldWidth - 2 * margin, lineThickness); addLine(0, +fieldHalfLength + -margin, fieldWidth - 2 * margin, lineThickness);
addLine(-W_singolo_half, 0, lineThickness, fieldLength - 2 * margin); addLine(+W_singolo_half, 0, lineThickness, fieldLength - 2 * margin);
addLine(0, +servizio, W_singolo + lineThickness, lineThickness); addLine(0, -servizio, W_singolo + lineThickness, lineThickness);
addLine(0, 0, lineThickness, servizio * 2);

// === 4) word  is a paralleliped
const WORLD_WIDTH  = 260;
const WORLD_DEPTH  = 260;
const WORLD_HEIGHT = 1.0; 
const GROUND_Y = -0.1; 
const CAM_MIN_Y = GROUND_Y + 0.15; 
const TARGET_MIN_Y = GROUND_Y + 0.10;

// material
const worldMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x8BC34A, 
    roughness: 0.8, 
    metalness: 0.1 
});

// geometry wolrd
const worldGeometry = new THREE.BoxGeometry(WORLD_WIDTH, WORLD_HEIGHT, WORLD_DEPTH);

// mesh
const worldMesh = new THREE.Mesh(worldGeometry, worldMaterial);

// positon 
worldMesh.position.y = GROUND_Y - WORLD_HEIGHT / 2;
worldMesh.receiveShadow = true;
worldMesh.name = 'WorldGroundBox'; 

// add word to the scene
scene.add(worldMesh);

// benhc
function makeBench() {
  // create the material for laterla bench
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
// function to add bench to the scene
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

//funciton to create bleacher
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
const forestGroundSize = 130;
const exclusionHalfW = (fieldWidth + sideRunoff * 2) / 2 + 1.0;
const exclusionHalfL = (fieldLength + backRunoff * 2) / 2 + 1.0;

//funciot to add the forest with 600 three andh bush 
addProceduralForest(scene, {
    groundSize: forestGroundSize,
    exclusionHalfW: exclusionHalfW,
    exclusionHalfL: exclusionHalfL,
    count: 730
});

//  BALL MACHINE ===
// add collider to the ball machje
const S = 1.6;
const ballMachine = new BallMachine(scene, new THREE.Vector3(0 *S, 0, 3*S), S, { onShoot: onBallShot });
lamps.colliders.forEach(collider => {
  ballMachine.addCollider(collider);
});
ballMachine.initContainerBalls(initialBallCount);
ballMachine.autoShoot = false;

ballMachine.enableKeyboard();
// set balls speed
ballMachine.setSpeed('medium');
if (typeof ballMachine.setPitch === 'function') ballMachine.setPitch(0);
const PITCH_STEP = 0.04; const YAW_STEP = 0.06;
// move the 
window.addEventListener('keydown', (e) => {
  switch (e.key.toLowerCase()) {
    case 'i': ballMachine.changePitch(-PITCH_STEP); break;
    case 'k': ballMachine.changePitch(+PITCH_STEP); break;
    case 'j': ballMachine.changeYaw(+YAW_STEP); break;
    case 'l': ballMachine.changeYaw(-YAW_STEP); break;
  
  }
});
const targetManager = new TargetManager(scene, ballMachine.balls, ballMachine.ballRadius, { onScore: handleScoreUpdate });

targetManager.createAllTargets();

// change the view
let isShootingView = false;

window.addEventListener('keydown', e => {
  if (e.repeat) return;


  if (['KeyC','Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) {
    e.preventDefault();
  }

  // shoot
  if (e.code === 'Space' && !ballMachine._charging && !isGameOver) {
      ballMachine.beginCharge();
      // show the charge bar
      if (chargeContainer) chargeContainer.style.display = 'block';
  }

  // how to change the view
  if (e.code === 'KeyC') {
    isShootingView = !isShootingView;
    controls.enabled = !isShootingView;
  }
});

window.addEventListener('keyup', e => {
  if (e.code === 'Space') {
    ballMachine.endCharge();
    if (chargeContainer) chargeContainer.style.display = 'none';
    if (chargeBar) chargeBar.style.width = '0%';
  }
});






// === 8) LOOP ===
const clock = new THREE.Clock();
 const shatterEffect = new ShatterEffect(scene);
 const ghostBallManager = new GhostBallManager(scene, clock, shatterEffect);
const FIXED = 1 / 120;
let acc = 0;
const MAX_STEPS = 3;

function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();

  acc += dt;
  let steps = 0;
  while (acc >= FIXED && steps < MAX_STEPS) {
    
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
  shatterEffect.update(dt);

  
  if (ballMachine._charging && chargeBar) {
    // show the perentge 
    const chargePercentage = ballMachine._charge * 100;
    chargeBar.style.width = `${chargePercentage}%`;
  }

  
  if (isShootingView) {
    controls.enabled = false;

    // camera position when is in first persone
    const cameraOffset = new THREE.Vector3(0, 2.2, -2.0);
    cameraOffset.applyQuaternion(ballMachine.group.quaternion);
    const targetCameraPos = ballMachine.group.position.clone().add(cameraOffset);

    // poit to look
    const lookAtPoint = new THREE.Vector3(0, 1.0, 20);
    lookAtPoint.applyQuaternion(ballMachine.group.quaternion);
    lookAtPoint.add(ballMachine.group.position);

    // Aggiorna dolcemente la posizione della camera
    camera.position.lerp(targetCameraPos, 0.1);
    camera.lookAt(lookAtPoint);

  } else {
    // panoramic modality you can move the camera with mouese
    controls.enabled = true;
    controls.update();
     const maxPanX = 30;
    const maxPanZ = 35;

    
    controls.target.x = THREE.MathUtils.clamp(controls.target.x, -maxPanX, maxPanX);
    controls.target.z = THREE.MathUtils.clamp(controls.target.z, -maxPanZ, maxPanZ);

   
    camera.position.x = THREE.MathUtils.clamp(camera.position.x, -maxPanX - 10, maxPanX + 10);
    camera.position.z = THREE.MathUtils.clamp(camera.position.z, -maxPanZ - 10, maxPanZ + 10)
  }

  renderer.render(scene, camera);
}

animate();
}