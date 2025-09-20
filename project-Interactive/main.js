import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import * as CANNON from 'https://cdn.jsdelivr.net/npm/cannon-es@0.20.0/dist/cannon-es.js';
import { TennisPlayer } from './src/player.js';


// === 1. SCENA E RENDERER ===
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x222222);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 6, 10);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;     // movimento fluido
controls.dampingFactor = 0.05;

controls.minDistance = 5;
controls.maxDistance = 50;

controls.minPolarAngle = 0;           // guarda anche da sotto
controls.maxPolarAngle = Math.PI;     // permette di ruotare tutto attorno
controls.enablePan = true;            // puoi trascinare
controls.enableRotate = true;         // puoi ruotare liberamente
controls.enableZoom = true;       

document.body.appendChild(renderer.domElement);
document.addEventListener("keydown", (e) => {
  const step = 0.3;
  if (e.key === "ArrowRight") {
    camera.position.x += step;
    controls.target.x += step;
  }
  if (e.key === "ArrowLeft" ) {
    camera.position.x -= step;
    controls.target.x -= step;
  }
});

// === 2. LUCI ===
scene.add(new THREE.AmbientLight(0x404040, 1.5));
const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(10, 20, 10); // angolazione più obliqua e naturale
directionalLight.castShadow = true;

directionalLight.shadow.mapSize.width = 1024;
directionalLight.shadow.mapSize.height = 1024;

directionalLight.shadow.camera.near = 0.5;
directionalLight.shadow.camera.far = 50;

const d = 15; // estensione della shadow camera
directionalLight.shadow.camera.left = -d;
directionalLight.shadow.camera.right = d;
directionalLight.shadow.camera.top = d;
directionalLight.shadow.camera.bottom = -d;

scene.add(directionalLight);

const lightSphere = new THREE.Mesh(
  new THREE.SphereGeometry(0.3),
  new THREE.MeshBasicMaterial({ color: 0xffff00 })
);
lightSphere.position.copy(directionalLight.position);
scene.add(lightSphere);

// === 3. CAMPO ===
// === TEXTURE ERBA ===
const loader = new THREE.TextureLoader();
const grassTexture = loader.load("assets/Grass005_1K-JPG_Color.jpg");
const normalMap = loader.load("assets/Grass005_1K-JPG_NormalGL.jpg");


grassTexture.wrapS = THREE.RepeatWrapping;
grassTexture.wrapT = THREE.RepeatWrapping;
normalMap.wrapS = THREE.RepeatWrapping;
normalMap.wrapT = THREE.RepeatWrapping;

grassTexture.repeat.set(4, 2);
normalMap.repeat.set(4, 2);

const fieldMaterial = new THREE.MeshStandardMaterial({
  map: grassTexture,
  normalMap: normalMap,
  roughness: 0.8
});

const fieldWidth = 19;
const fieldLength = 23.77;
const fieldHalfWidth = fieldWidth / 2;
const fieldHalfLength = fieldLength / 2;

const fieldGeometry = new THREE.PlaneGeometry(fieldWidth, fieldLength);
const field = new THREE.Mesh(fieldGeometry, fieldMaterial);
field.rotation.x = -Math.PI / 2;
scene.add(field);
field.receiveShadow = true;
// === LINEE CAMPO TENNIS ===
// Campo: 30 x 15 → x ∈ [-15, 15], z ∈ [-7.5, 7.5]

const lineMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });

function addLine(x, z, width, depth) {
  if (width <= 0 || depth <= 0 || isNaN(width) || isNaN(depth)) {
    console.warn("❌ Linea saltata: dimensioni non valide", width, depth);
    return;
  }

  const geometry = new THREE.PlaneGeometry(width, depth);
  const line = new THREE.Mesh(geometry, lineMaterial);
  line.rotation.x = -Math.PI / 2;
  line.position.set(x, 0.01, z); // 0.01 per evitare z-fighting
  scene.add(line);
}
// === LINEE TENNIS ===
// tutte le unità in metri, origin at center
const servizio = 6.40; // ✅ AGGIUNGI QUESTA RIGA

const W_singolo = 8.23;
const W_singolo_half = W_singolo / 2;

const margin = 0.8; // quanto rientrare rispetto al bordo vero
const lineThickness = 0.05;  // sottile ma visibile

// === BORDI campo doppio (ben rientrati)
addLine(-fieldHalfWidth + margin, 0, lineThickness, fieldLength - 2 * margin); // bordo sinistro
addLine(+fieldHalfWidth - margin, 0, lineThickness, fieldLength - 2 * margin); // bordo destro
addLine(0, -fieldHalfLength + margin, fieldWidth - 2 * margin, lineThickness); // fondo basso
addLine(0, +fieldHalfLength - margin, fieldWidth - 2 * margin, lineThickness); // fondo alto

// === LINEE campo singolo (centrate)
addLine(-W_singolo_half, 0, lineThickness, fieldLength - 2 * margin); // sinistra singolo
addLine(+W_singolo_half, 0, lineThickness, fieldLength - 2 * margin); // destra singolo

// === LINEE di servizio (orizzontali)
addLine(0, +servizio, W_singolo + lineThickness, lineThickness);
addLine(0, -servizio, W_singolo + lineThickness, lineThickness);

// === LINEA centrale di servizio
addLine(0, 0, lineThickness, servizio * 2); // da -6.4 a +6.4

// === LINEA della rete (opzionale)
addLine(0, 0, fieldWidth - 2 * margin, lineThickness);


// === INIZIALIZZA CANNON.JS ===
const world = new CANNON.World();
world.gravity.set(0, -9.82, 0);
world.broadphase = new CANNON.NaiveBroadphase();
world.solver.iterations = 10;

// === PARAMETRI RETE ===
const netHeight = 0.9;
const netSegmentsW = 50; // 🔁 maglie più strette
const netSegmentsH = 16; // 🔁 maglie più strette
const paliOffset = 0.1;
const netWidth = fieldWidth - 2 * margin + 2 * paliOffset;
const netSpacingX = netWidth / (netSegmentsW - 1);
const netSpacingY = netHeight / (netSegmentsH - 1);

const netParticles = [];
const netConstraints = [];

// === MESH SUPPORTO (visiva) ===
const sphereGeo = new THREE.SphereGeometry(0.01); // 🔁 più piccolo
const sphereMat = new THREE.MeshStandardMaterial({ color: 0xffffff });

// === CREA PARTICELLE (sfere con massa) ===
for (let y = 0; y < netSegmentsH; y++) {
  for (let x = 0; x < netSegmentsW; x++) {
    const px = -netWidth / 2 + x * netSpacingX;
    const py = netHeight - y * netSpacingY;

    const isFixed = (y === 0 && (x === 0 || x === netSegmentsW - 1));

    const body = new CANNON.Body({
      mass: isFixed ? 0 : 0.02,
      position: new CANNON.Vec3(px, py, 0),
      shape: new CANNON.Sphere(0.025), // 🔁 più piccolo
    });
    world.addBody(body);

    const mesh = new THREE.Mesh(sphereGeo, sphereMat);
    mesh.visible = false; // 🔁 non mostrare le sfere
    scene.add(mesh);

    netParticles.push({ body, mesh });
  }
}

// === CREA CONSTRAINTS TRA LE SFERE ===
function getIndex(x, y) {
  return y * netSegmentsW + x;
}

for (let y = 0; y < netSegmentsH; y++) {
  for (let x = 0; x < netSegmentsW; x++) {
    const i = getIndex(x, y);

    if (x < netSegmentsW - 1) {
      const c = new CANNON.DistanceConstraint(
        netParticles[i].body,
        netParticles[getIndex(x + 1, y)].body,
        netSpacingX
      );
      world.addConstraint(c);
      netConstraints.push(c);
    }

    if (y < netSegmentsH - 1) {
      const c = new CANNON.DistanceConstraint(
        netParticles[i].body,
        netParticles[getIndex(x, y + 1)].body,
        netSpacingY
      );
      world.addConstraint(c);
      netConstraints.push(c);
    }
  }
}

// === GEOMETRIA VISIVA DELLA RETE (LineSegments) ===
const netLineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });
const netLineGeometry = new THREE.BufferGeometry();
const netLinePositions = new Float32Array(netConstraints.length * 2 * 3);
netLineGeometry.setAttribute('position', new THREE.BufferAttribute(netLinePositions, 3));
const netLines = new THREE.LineSegments(netLineGeometry, netLineMaterial);
scene.add(netLines);

// === AGGIORNA MESH IN ANIMATE ===
function updateNetCannon() {
  for (let p of netParticles) {
    p.mesh.position.copy(p.body.position);
  }

  const positions = netLineGeometry.attributes.position.array;
  let idx = 0;
  for (let c of netConstraints) {
    const posA = c.bodyA.position;
    const posB = c.bodyB.position;
    positions[idx++] = posA.x;
    positions[idx++] = posA.y;
    positions[idx++] = posA.z;
    positions[idx++] = posB.x;
    positions[idx++] = posB.y;
    positions[idx++] = posB.z;
  }
  netLineGeometry.attributes.position.needsUpdate = true;
}

// === PALI RETE FISICI ===
const postRadius = 0.05;
const postHeight = 1.1;
const postShape = new CANNON.Cylinder(postRadius, postRadius, postHeight, 8);
const postGeo = new THREE.CylinderGeometry(postRadius, postRadius, postHeight, 16);
const postMat = new THREE.MeshStandardMaterial({ color: 0x555555 });

// LEFT POST
const leftPostBody = new CANNON.Body({
  mass: 0,
  position: new CANNON.Vec3(-netWidth / 2 - paliOffset, postHeight / 2, 0),
  shape: postShape,
});
world.addBody(leftPostBody);

const leftPostMesh = new THREE.Mesh(postGeo, postMat);
leftPostMesh.position.copy(leftPostBody.position);
scene.add(leftPostMesh);

// RIGHT POST
const rightPostBody = new CANNON.Body({
  mass: 0,
  position: new CANNON.Vec3(netWidth / 2 + paliOffset, postHeight / 2, 0),
  shape: postShape,
});
world.addBody(rightPostBody);

const rightPostMesh = new THREE.Mesh(postGeo, postMat);
rightPostMesh.position.copy(rightPostBody.position);
scene.add(rightPostMesh);

// === AGGIORNA MESH PALI IN ANIMATE ===
function updatePosts() {
  leftPostMesh.position.copy(leftPostBody.position);
  rightPostMesh.position.copy(rightPostBody.position);
}

// === MESH TRIANGOLARI PER LA RETE ===
const netGeometry = new THREE.BufferGeometry();
const vertices = [];
const indices = [];

for (let y = 0; y < netSegmentsH; y++) {
  for (let x = 0; x < netSegmentsW; x++) {
    vertices.push(0, 0, 0);
  }
}

for (let y = 0; y < netSegmentsH - 1; y++) {
  for (let x = 0; x < netSegmentsW - 1; x++) {
    const a = getIndex(x, y);
    const b = getIndex(x + 1, y);
    const c = getIndex(x, y + 1);
    const d = getIndex(x + 1, y + 1);

    indices.push(a, b, d);
    indices.push(a, d, c);
  }
}

netGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
netGeometry.setIndex(indices);
netGeometry.computeVertexNormals();
const netMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0.3 }); // 🔁 più trasparente
const netMesh = new THREE.Mesh(netGeometry, netMaterial);
scene.add(netMesh);

// === AGGIORNA MESH TRIANGOLARE NEL LOOP ===
function updateNetMesh() {
  const verts = netGeometry.attributes.position.array;
  for (let i = 0; i < netParticles.length; i++) {
    verts[i * 3 + 0] = netParticles[i].body.position.x;
    verts[i * 3 + 1] = netParticles[i].body.position.y;
    verts[i * 3 + 2] = netParticles[i].body.position.z;
  }
  netGeometry.attributes.position.needsUpdate = true;
  netGeometry.computeVertexNormals();
}
 //giocatore

const input = { keys: new Set(), shift: false };
addEventListener('keydown', e => {
  input.keys.add(e.code);
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') input.shift = true;
});
addEventListener('keyup', e => {
  input.keys.delete(e.code);
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') input.shift = false;
});
const clock = new THREE.Clock();

const player = new TennisPlayer(scene, input);
player.load().then(() => {
  animate(); // avvia il render loop quando il modello è pronto
});
// === 6. ANIMATE ===

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();

  // aggiorna tutto il resto
  updateNetCannon();
  updateNetMesh();
  updatePosts();

  // aggiorna player (gambe animate + movimento & braccia procedurali)
  player.update(delta, 0);

  controls.update();
  renderer.render(scene, camera);
}

animate(); // <-- viene chiamata solo dopo che tutto è stato creato
