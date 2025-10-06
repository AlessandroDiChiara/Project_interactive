// src/forest.js
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const gltfLoader = new GLTFLoader();
const texLoader  = new THREE.TextureLoader();

// --- Costante: file in millimetri, mondo in metri
const MM_TO_M = 0.001;

/* =============== UTIL =============== */

export function rectFromObject(obj, { padX = 0.4, padZ = 0.4 } = {}) {
  const box = new THREE.Box3().setFromObject(obj);
  const size = new THREE.Vector3(), center = new THREE.Vector3();
  box.getSize(size); box.getCenter(center);
  return { cx: center.x, cz: center.z, halfW: size.x * 0.5 + padX, halfL: size.z * 0.5 + padZ };
}

function inRect(x, z, r) {
  return (x >= r.cx - r.halfW && x <= r.cx + r.halfW &&
          z >= r.cz - r.halfL && z <= r.cz + r.halfL);
}
function inAnyExclusion(x, z, rects) { for (const r of rects) if (inRect(x,z,r)) return true; return false; }
const randRange = (a, b) => a + Math.random() * (b - a);

/* =============== MATERIALI =============== */

function sanitizeMaterials(root, {
  removeNormalMap = true,
  forceDoubleSide = false,
} = {}) {
  root.traverse((o) => {
    if (!o.isMesh) return;

    const m = o.material;
    if (!m) return;

    // map in sRGB + nitidezza distanza
    if (m.map) {
      m.map.colorSpace = THREE.SRGBColorSpace;
      m.map.anisotropy = 8;                 // ↑ nitidezza in lontananza
      m.map.needsUpdate = true;
    }

    // PBR neutro
    if ('roughness' in m) m.roughness = Math.min(0.98, m.roughness ?? 0.95);
    if ('metalness' in m) m.metalness = 0.0;
    m.envMapIntensity = 0;

    const name = (o.name || '').toLowerCase();
    const isFoliage =
      name.includes('leaf') || name.includes('leaves') ||
      name.includes('grass') || name.includes('bush')  ||
      name.includes('foliage');

    if (isFoliage) {
      // ✨ chiave: niente auto-ombre sulle foglie → evita macchie nere
      o.castShadow = false;
      o.receiveShadow = true;

      m.alphaTest = 0.35;
      m.transparent = false;
      m.depthWrite = true;
      m.side = THREE.DoubleSide;

      // anti-jag sugli edge (richiede antialias nel renderer)
      m.alphaToCoverage = true;

      // solleva un filo il valore (le foglie non restano nere)
      if (m.color) m.color.multiplyScalar(2);
    } else {
      // mesh non-foglia
      o.castShadow = true;
      o.receiveShadow = true;
      if (forceDoubleSide) m.side = THREE.DoubleSide;
    }

    if (removeNormalMap && m.normalMap) m.normalMap = null;
    if (m.emissive) m.emissive.setHex(0x000000);
    if (typeof m.emissiveIntensity === 'number') m.emissiveIntensity = 0.0;

    m.toneMapped = true;
    m.needsUpdate = true;
  });
}



async function loadCleanGLB(url, { forceDoubleSide = false } = {}) {
  const gltf = await gltfLoader.loadAsync(url);
  sanitizeMaterials(gltf.scene, { forceDoubleSide });
  return gltf.scene;
}

/* =============== SCATTER (MM-ONLY) =============== */
/**
 * item (MM-only):
 *  - url: string
 *  - targetHeightMm?: number        // prioritaria
 *  - targetMaxDimMm?: number        // alternativa
 *  - count: number
 *  - minScale?: number, maxScale?: number   (jitter attorno alla scala base)
 *  - yJitter?: number                       (m, spostamento SOLO verso l’alto)
 *  - minDist?: number
 *  - rotYRandom?: boolean
 *  - instanced?: boolean
 *  - doubleSideLeaves?: boolean
 */
function makeCarpetPositions({ groundHalf, exclusions, spacing = 2.5, jitterFrac = 0.35 }) {
  // spacing in metri, jitterFrac ∈ [0..1]
  const positions = [];
  const step = spacing;
  const jitterAmp = step * jitterFrac;

  for (let x = -groundHalf; x <= groundHalf; x += step) {
    for (let z = -groundHalf; z <= groundHalf; z += step) {
      const px = x + (Math.random() * 2 - 1) * jitterAmp;
      const pz = z + (Math.random() * 2 - 1) * jitterAmp;
      if (inAnyExclusion(px, pz, exclusions)) continue;
      positions.push({ x: px, z: pz });
    }
  }
  return positions;
}
// MM-only scatter (con groundY, scaleBoost, e modalità "carpet")
async function scatterGLB({ scene, groundHalf, groundY = 0, exclusions, item }) {
  const root = await loadCleanGLB(item.url, { forceDoubleSide: !!item.doubleSideLeaves });

  // --- Box nelle unità del file (mm) ---
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3(); box.getSize(size);

  // --- Scala base (mm) ---
  let baseScale;
  if (item.targetHeightMm && size.y > 0) {
    baseScale = item.targetHeightMm / size.y;            // mm/mm
  } else if (item.targetMaxDimMm) {
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    baseScale = item.targetMaxDimMm / maxDim;            // mm/mm
  } else {
    baseScale = MM_TO_M;                                  // fallback: porta 1:1 mm→m
  }

  // boost opzionale (sempre applicato)
  

  // clamp di sicurezza


  // offset per “appoggiare” a terra (mm * scale → m)
  const baseOffsetY_m = (-box.min.y * baseScale) * MM_TO_M;

  // --- Posizioni ---
  const yJitter  = Math.max(0, item.yJitter ?? 0.0);      // solo verso l’alto
  const rotYRand = item.rotYRandom !== false;
  let positions = [];

  if (item.mode === 'carpet') {
    // Copertura completa del ground con griglia + jitter
    let spacing = item.spacing ?? 2.5;                     // metri tra ciuffi
    if (item.densityPerSqm && item.densityPerSqm > 0) {
      spacing = Math.sqrt(1 / item.densityPerSqm);         // densità alternativa
    }
    const jitterFrac = item.jitterFrac ?? 0.35;
    positions = makeCarpetPositions({ groundHalf, exclusions, spacing, jitterFrac });

    // limite massimo (salva GPU)
    const cap = item.maxInstances ?? Infinity;
    if (positions.length > cap) positions.length = cap;
  } else {
    // modalità random con distanza minima
    const positionsTmp = [];
    const triesMax = Math.max(500, (item.count ?? 0) * 20);
    let tries = 0;

    const need    = item.count ?? 0;
    const minDist = item.minDist ?? 1.0;

    while (positionsTmp.length < need && tries < triesMax) {
      tries++;
      const x = randRange(-groundHalf, groundHalf);
      const z = randRange(-groundHalf, groundHalf);
      if (inAnyExclusion(x, z, exclusions)) continue;

      let ok = true;
      for (const p of positionsTmp) {
        const dx = x - p.x, dz = z - p.z;
        if (dx*dx + dz*dz < minDist * minDist) { ok = false; break; }
      }
      if (!ok) continue;

      positionsTmp.push({ x, z });
    }
    positions = positionsTmp;
  }

  console.log('[forest] placed', positions.length, 'items for', item.url);

  // --- InstancedMesh se possibile ---
  const meshes = [];
  root.traverse(o => { if (o.isMesh) meshes.push(o); });

  if (item.instanced && meshes.length) {
    const base = meshes[0];
    const inst = new THREE.InstancedMesh(base.geometry.clone(), base.material.clone(), positions.length);
    const dummy = new THREE.Object3D();

    for (let i = 0; i < positions.length; i++) {
      const p = positions[i];
      const sRand = randRange(item.minScale ?? 1.0, item.maxScale ?? 1.0);
      const sMeters = (baseScale * sRand) * MM_TO_M;       // scala assoluta in metri
      const jitter = yJitter ? randRange(0, yJitter) : 0;

      dummy.position.set(p.x, groundY + baseOffsetY_m + jitter, p.z);
      dummy.rotation.set(0, rotYRand ? randRange(0, Math.PI * 2) : 0, 0);
      dummy.scale.setScalar(sMeters);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    }
    inst.castShadow = inst.receiveShadow = true;
    scene.add(inst);
    return;
  }

  // --- Cloni normali ---
  positions.forEach(p => {
    const clone = root.clone(true);
    const sRand = randRange(item.minScale ?? 1.0, item.maxScale ?? 1.0);
    const scaleMeters = (baseScale * sRand) * MM_TO_M;

    clone.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

    const jitter = yJitter ? randRange(0, yJitter) : 0;
    clone.position.set(p.x, groundY + baseOffsetY_m + jitter, p.z);
    clone.rotation.y = rotYRand ? randRange(0, Math.PI * 2) : 0;
    clone.scale.setScalar(scaleMeters);
    scene.add(clone);
  });
}

/* =============== API PRINCIPALE =============== */

export async function addForest(scene, {
  groundSize = 320,
  innerRect = { halfW: 24, halfL: 32 },
  exclusions = [],
  grassTextureUrl = null,
  items = []
} = {}) {

  const groundHalf = groundSize * 0.5;

  // (1) mega-prato
  let groundMat;
  if (grassTextureUrl) {
    const tex = texLoader.load(grassTextureUrl);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(groundSize / 8, groundSize / 8);
    groundMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 });
  } else {
    groundMat = new THREE.MeshStandardMaterial({ color: 0x6ab36a, roughness: 0.95 });
  }

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(groundSize, groundSize), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.02;  // la tua quota prato
  ground.receiveShadow = true;
  ground.castShadow = false;
  ground.renderOrder = 0;
  scene.add(ground);

  // (2) esclusioni: campo+apron + extra
  const allExclusions = [
    { cx: 0, cz: 0, halfW: innerRect.halfW, halfL: innerRect.halfL },
    ...exclusions
  ];

  // (3) scatter
  const groundY = ground.position.y;
  for (const it of items) {
    // Rimuovi campi legacy se presenti (unit/target in m)
    if ('unit' in it && it.unit !== 'mm') {
      console.warn('[forest] ignorata "unit" (mm-only). Forzato a millimetri per', it.url);
    }
    if ('targetHeight' in it || 'targetMaxDim' in it) {
      console.warn('[forest] usa targetHeightMm/targetMaxDimMm (mm-only).', it.url);
    }
    await scatterGLB({ scene, groundHalf, groundY, exclusions: allExclusions, item: it });
  }
}
