// player.js
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// === Helpers ===
const lerpAngleShortest = (a, b, t) => {
  const TWO_PI = Math.PI * 2;
  let diff = (b - a + Math.PI) % TWO_PI;
  if (diff < 0) diff += TWO_PI;
  diff -= Math.PI;
  return a + diff * t;
};

const firstClipOrWarn = (animArray, label) => {
  if (!animArray || animArray.length === 0) {
    console.error(`❌ ${label} non contiene animazioni`);
    return null;
  }
  if (animArray.length > 1) {
    console.warn(`ℹ️ ${label} ha ${animArray.length} clip. Uso il primo:`, animArray.map(c => c.name));
  }
  return animArray[0];
};

// Tiene gambe/bacino, elimina Upper-Body e rimuove root-motion (Hips.position)
// Funziona anche con prefissi/suffissi diversi (mixamorig:, Armature|, spazi, ecc.)
const toLowerBodyOnlyNoRootMotion = (clip) => {
  if (!clip) return null;

  const isUpperKeyword = (name) => {
    const UPPER = ['Arm', 'ForeArm', 'Hand', 'Shoulder', 'Clavicle', 'Neck', 'Head', 'Spine', 'Chest', 'Eye'];
    return UPPER.some(k => name.includes(k));
  };

  const keepTrack = (trackName) => {
    const lastDot = trackName.lastIndexOf('.');
    const rawNode = lastDot >= 0 ? trackName.slice(0, lastDot) : trackName;
    const prop    = lastDot >= 0 ? trackName.slice(lastDot + 1) : '';

    const node = rawNode
      .replace(/^mixamorig[:_]?/i, '')
      .replace(/^Armature\|/i, '')
      .replace(/\s+/g, '');

    // 1) scarta Upper-Body (lasciamo libere le braccia)
    if (isUpperKeyword(node)) return false;

    // 2) scarta root-motion: posizione dei fianchi
    if ((node === 'Hips' || node.endsWith(':Hips') || node.endsWith('|Hips')) && prop === 'position') return false;

    // 3) tieni gambe/piedi + rotazione di Hips
    return true;
  };

  const c = clip.clone();
  c.tracks = c.tracks.filter(t => keepTrack(t.name));
  if (c.tracks.length === 0) {
    console.warn('⚠️ lower-body filter ha rimosso tutto — fallback al clip completo');
    return clip;
  }
  c.optimize();
  return c;
};

export class TennisPlayer {
  constructor(scene, input) {
    this.scene = scene;
    this.input = input; // { keys: Set(), shift: boolean }
    this.mixer = null;
    this.model = null;
    this.actions = {};
    this.activeAction = null;

    // velocità realistiche
    this.speedWalk = 1.6;  // m/s
    this.speedRun  = 4.8;  // m/s
    this.turnDamp  = 5.0;  // smoothing rotazione (↑ più reattivo)

    // se il GLB guarda lungo +X invece che +Z, prova ±Math.PI/2
    this.initialYaw = 0;

    this.lowerBodyBones = [
      'Hips','LeftUpLeg','LeftLeg','LeftFoot','LeftToeBase',
      'RightUpLeg','RightLeg','RightFoot','RightToeBase'
    ];

    this.armBase = null; // postura neutra upper-body
  }

  async load() {
    const loader = new GLTFLoader();

    // === 1) IDLE (mesh + rig) ===
    const base = await loader.loadAsync('./assets/Idle.glb');
    this.model = base.scene;
    this.model.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }});
    this.model.position.set(0, 0, 0);
    this.model.scale.set(1, 1, 1);
    this.model.rotation.y = this.initialYaw;
    this.scene.add(this.model);

    this.mixer = new THREE.AnimationMixer(this.model);

    // === 2) Azioni con filtro lower-body + no root-motion ===
    const idleClipFull = firstClipOrWarn(base.animations, 'Idle.glb');
    const idleClip     = toLowerBodyOnlyNoRootMotion(idleClipFull);
    if (idleClip) {
      this.actions.idle = this.mixer.clipAction(idleClip);
      this.actions.idle.setEffectiveWeight(1.0).setEffectiveTimeScale(1.0).play();
      this.activeAction = this.actions.idle;
    }

    const walkGLB = await loader.loadAsync('./assets/Walking.glb');
    const runGLB  = await loader.loadAsync('./assets/Running.glb');

    const walkClipFull = firstClipOrWarn(walkGLB.animations, 'Walking.glb');
    const runClipFull  = firstClipOrWarn(runGLB.animations,  'Running.glb');

    this.actions.walk = this.mixer.clipAction(toLowerBodyOnlyNoRootMotion(walkClipFull) || walkClipFull);
    this.actions.run  = this.mixer.clipAction(toLowerBodyOnlyNoRootMotion(runClipFull)  || runClipFull);

    Object.values(this.actions).forEach(a => {
      if (!a) return;
      a.reset();
      a.setLoop(THREE.LoopRepeat, Infinity);
      a.enabled = true;
      a.setEffectiveTimeScale(1.0);
    });

    // Cache ossa + posa neutra braccia
    this._cacheArmBones();
    this._setNeutralUpperPose(); // abbassa braccia
  }

  _cacheArmBones() {
  const byName = (n) => this.model.getObjectByName(n) || this.model.getObjectByName(`mixamorig:${n}`);

  // helper fuzzy: trova un osso che contiene tutte le parole (case-insensitive)
  const findFuzzy = (...words) => {
    let found = null;
    this.model.traverse(o => {
      if (found || !o.isBone) return;
      const name = o.name.toLowerCase();
      if (words.every(w => name.includes(w.toLowerCase()))) found = o;
    });
    return found;
  };

  this.bones = {
    // spalle (importantissime per abbassare le braccia dalla T-pose)
    lShoulder: byName('LeftShoulder')  || findFuzzy('left','shoulder')  || findFuzzy('l','shoulder'),
    rShoulder: byName('RightShoulder') || findFuzzy('right','shoulder') || findFuzzy('r','shoulder'),

    // braccia
    lArm: byName('LeftArm')   || findFuzzy('left','upper','arm')  || findFuzzy('left','arm'),
    rArm: byName('RightArm')  || findFuzzy('right','upper','arm') || findFuzzy('right','arm'),
    lForeArm: byName('LeftForeArm') || findFuzzy('left','forearm') || findFuzzy('left','lower','arm'),
    rForeArm: byName('RightForeArm')|| findFuzzy('right','forearm')|| findFuzzy('right','lower','arm'),
    lHand: byName('LeftHand') || findFuzzy('left','hand'),
    rHand: byName('RightHand')|| findFuzzy('right','hand'),

    // opzionale
    spine: byName('Spine') || findFuzzy('spine'),
    spine1: byName('Spine1') || findFuzzy('spine1'),
    spine2: byName('Spine2') || findFuzzy('spine2'),
    neck: byName('Neck') || findFuzzy('neck'),
    head: byName('Head') || findFuzzy('head'),
  };
}


 _setNeutralUpperPose() {
  const b = this.bones;
  if (!b?.lShoulder || !b?.rShoulder) return;

  // ↓↓ abbassa le spalle dalla T-pose (asse Z di solito alza/abbassa in Mixamo)
  // se vedi rotazioni “strane”, prova a spostare l’angolo su X invece che su Z.
  b.lShoulder.rotation.set(0.00, 0.00, -1.45); // ~ -83°
  b.rShoulder.rotation.set(0.00, 0.00,  1.45); // ~ +83°

  // piccolo pitch in avanti del braccio (naturale)
  if (b.lArm) b.lArm.rotation.x = -0.15;
  if (b.rArm) b.rArm.rotation.x = -0.15;

  // leggera flessione gomiti (facoltativa)
  if (b.lForeArm) b.lForeArm.rotation.x = -0.05;
  if (b.rForeArm) b.rForeArm.rotation.x = -0.05;

  // salva baseline per swing procedurale
  this.armBase = {
    lShoulder: b.lShoulder.rotation.clone(),
    rShoulder: b.rShoulder.rotation.clone(),
    lArm: (b.lArm ? b.lArm.rotation.clone() : null),
    rArm: (b.rArm ? b.rArm.rotation.clone() : null),
  };
}


  update(delta, groundY = 0) {
    if (!this.model) return;

    // === 1) Input direzione ===
    const dir = new THREE.Vector3(0, 0, 0);
    if (this.input.keys.has('KeyW') || this.input.keys.has('ArrowUp'))    dir.z -= 1;
    if (this.input.keys.has('KeyS') || this.input.keys.has('ArrowDown'))  dir.z += 1;
    if (this.input.keys.has('KeyA') || this.input.keys.has('ArrowLeft'))  dir.x -= 1;
    if (this.input.keys.has('KeyD') || this.input.keys.has('ArrowRight')) dir.x += 1;
    dir.normalize();

    // === 2) Stato + velocità ===
    const isMoving = dir.lengthSq() > 0.0001;
    const wantRun  = this.input.shift === true;
    const speed    = wantRun ? this.speedRun : this.speedWalk;

    // === 3) Crossfade animazioni ===
    const targetAction = !isMoving ? this.actions.idle : (wantRun ? this.actions.run : this.actions.walk);
    if (targetAction && targetAction !== this.activeAction) {
      targetAction.reset().fadeIn(0.25).play();
      this.activeAction?.fadeOut(0.25);
      this.activeAction = targetAction;
    }

    // === 4) Movimento robusto ===
    // === 4) Movimento: ruota SEMPRE verso la direzione di marcia ===
if (isMoving) {
  // direzione desiderata in spazio MONDO: W = avanti (-Z), S = indietro (+Z), A/D su X
  const moveDirWorld = new THREE.Vector3(dir.x, 0, -dir.z).normalize();

  // yaw target dall'effettiva direzione
  const targetYaw  = Math.atan2(moveDirWorld.x, moveDirWorld.z);
  const currentYaw = this.model.rotation.y;
  const s          = 1 - Math.exp(-this.turnDamp * delta); // smoothing
  this.model.rotation.y = lerpAngleShortest(currentYaw, targetYaw, s);

  // muovi nella direzione scelta
  this.model.position.addScaledVector(moveDirWorld, speed * delta);

  // limiti campo
  this.model.position.x = Math.max(Math.min(this.model.position.x, 9), -9);
  this.model.position.z = Math.max(Math.min(this.model.position.z, 5), -5);
}

    // === 5) A terra ===
    this.model.position.y = groundY;

    // === 6) Mixer PRIMA degli override procedurali ===
    this.mixer?.update(delta);

    // === 7) Braccia procedurali (swing leggero) ===
    this._proceduralArms(delta, isMoving, wantRun);
  }

  _proceduralArms(delta, isMoving, fast) {
  const b = this.bones;
  if (!b?.lShoulder || !b?.rShoulder || !this.armBase) return;

  const t = performance.now() * 0.003;
  const ampX = isMoving ? (fast ? 0.55 : 0.28) : 0.04; // avanti/indietro
  const ampZ = isMoving ? (fast ? 0.18 : 0.10) : 0.02; // apertura laterale

  // reset a baseline ogni frame (evita “braccia alzate” che rimangono)
  b.lShoulder.rotation.copy(this.armBase.lShoulder);
  b.rShoulder.rotation.copy(this.armBase.rShoulder);
  if (b.lArm && this.armBase.lArm) b.lArm.rotation.copy(this.armBase.lArm);
  if (b.rArm && this.armBase.rArm) b.rArm.rotation.copy(this.armBase.rArm);

  // swing morbido principalmente dalle SPALLE (più naturale)
  b.lShoulder.rotation.x += Math.sin(t) * ampX;
  b.rShoulder.rotation.x += Math.sin(t + Math.PI) * ampX;

  // un filo di apertura/chiusura
  b.lShoulder.rotation.z += Math.cos(t * 0.9) * ampZ * 0.4;
  b.rShoulder.rotation.z += Math.cos(t * 0.9 + Math.PI) * ampZ * 0.4;

  // piccolo contributo anche dall’upper arm
  if (b.lArm) b.lArm.rotation.x += Math.sin(t) * ampX * 0.4;
  if (b.rArm) b.rArm.rotation.x += Math.sin(t + Math.PI) * ampX * 0.4;
}

}
