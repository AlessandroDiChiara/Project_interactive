// cannone.js - Tappo della canna invertito
import * as THREE from 'three';

export class BallMachine {
  constructor(scene, position = new THREE.Vector3(-6, 0, 8), worldScale = 1.6, { onShoot = () => {} } = {}) {
    this.scene = scene;
    this.onShoot = onShoot;
    this.position = position.clone();
    this.S  = worldScale;
    this.VS = Math.sqrt(this.S);
    this.balls = [];
    this.containerBalls = [];
    this._shotCooldown = 0;
    this.autoShoot = false;
    this._shotAcc = 0;
    this.shotIntervalSec = 3.0;
    this.speedSettings = {
      slow:   10 * this.VS,
      medium: 15 * this.VS,
      fast:   22 * this.VS
    };
    this.currentSpeedName = 'medium';
    this.speed = this.speedSettings[this.currentSpeedName];
    this.gravity = new THREE.Vector3(0, -9.81, 0);
    this.ballRadius = 0.1 * this.S;
    this.ballMass   = 0.057;
    this.restitution     = 0.55;
    this.groundFriction  = 0.82;
    this.airDrag         = 0.998;
    this.spinFactor      = 2.0;
    this.physicsSubsteps = 4;
    this.bounds = { x: 25 * this.S, z: 20 * this.S, yMin: -2 * this.S };
    this.drive = {
      forward: 0,
      turn: 0,
      maxSpeed: 2.5 * this.S,
      turnRate: 1.6
    };
    this.colliders = [];
    this._charging  = false;
    this._charge    = 0;
    this.chargeMin  = 8  * this.VS;
    this.chargeMax  = 28 * this.VS;
    this.chargeRate = 1.6;
    this.ballMaterial = new THREE.MeshStandardMaterial({
      color: 0x99ff00, roughness: 0.8, metalness: 0.0,
      emissive: 0xffff00, emissiveIntensity: 1.0
    });

    this.createMachine();
    
    const laserMat = new THREE.LineBasicMaterial({ color: 0xff0000 });
// Creiamo una geometria con due punti che aggiorneremo in seguito
const laserGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
this.laserSight = new THREE.Line(laserGeo, laserMat);
this.scene.add(this.laserSight);
    console.log('🎾 BallMachine (tappo invertito) posizione:', this.position, 'scale=', this.S);
  }

  createMachine() {
    this.group = new THREE.Group();
    this.scene.add(this.group);

    const baseGeo = new THREE.CylinderGeometry(0.45 * this.S, 0.55 * this.S, 0.5 * this.S, 20);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x404040, metalness: 0.1, roughness: 0.7 });
    this.baseMesh = new THREE.Mesh(baseGeo, baseMat);
    this.baseMesh.position.set(0, 0.25 * this.S, 0);
    this.baseMesh.castShadow = true;
    this.group.add(this.baseMesh);

    this.wheels = [];
    const addWheel = (x, z) => {
      const g = new THREE.CylinderGeometry(0.18 * this.S, 0.18 * this.S, 0.08 * this.S, 20);
      const m = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.4, metalness: 0.1 });
      const w = new THREE.Mesh(g, m);
      w.rotation.z = Math.PI / 2;
      w.position.set(x * this.S, 0.18 * this.S, z * this.S);
      w.castShadow = true;
      this.group.add(w);
      this.wheels.push(w);
    };
    addWheel( 0.35,  0.35); addWheel(-0.35,  0.35);
    addWheel( 0.35, -0.35); addWheel(-0.35, -0.35);

    this.yawGroup = new THREE.Group();
    this.yawGroup.position.y = 0.5 * this.S;
    this.group.add(this.yawGroup);

    this.pitchGroup = new THREE.Group();
    this.yawGroup.add(this.pitchGroup);

    this.barrelLen = 1.1 * this.S;
    const outerRadius = 0.10 * this.S;
    const cannonGeo = new THREE.CylinderGeometry(0.08 * this.S, outerRadius, this.barrelLen, 32, 1, true);
    const cannonMat = new THREE.MeshStandardMaterial({ color: 0x5c5c5c, metalness: 0.2, roughness: 0.6, side: THREE.DoubleSide });
    this.cannonMesh = new THREE.Mesh(cannonGeo, cannonMat);

    const innerRadius = outerRadius * 0.75; 
    const innerCannonGeo = new THREE.CylinderGeometry(innerRadius * 0.8, innerRadius, this.barrelLen, 32, 1, true);
    const innerCannonMat = new THREE.MeshBasicMaterial({ color: 0x111111 }); 
    const innerCannonMesh = new THREE.Mesh(innerCannonGeo, innerCannonMat);
    this.cannonMesh.add(innerCannonMesh); 

    const capGeo = new THREE.CircleGeometry(outerRadius, 32);
    const capMesh = new THREE.Mesh(capGeo, cannonMat);
    capMesh.position.y = this.barrelLen * 0.5; // <<< TAPPO SPOSTATO SUL DAVANTI
    capMesh.rotation.x = -Math.PI / 2;
    this.cannonMesh.add(capMesh);

    this.cannonMesh.rotation.x = -Math.PI / 2;
    this.cannonMesh.position.y = outerRadius;
    this.cannonMesh.castShadow = true;
    this.pitchGroup.add(this.cannonMesh);

    const halfLen = this.barrelLen * 0.5;
    this.tipAnchor = new THREE.Object3D();
    this.tipAnchor.position.set(0, halfLen, 0);
    this.cannonMesh.add(this.tipAnchor);
    
    this.baseAnchor = new THREE.Object3D();
    this.cannonMesh.add(this.baseAnchor);
    
    const containerGeo = new THREE.CylinderGeometry(0.35 * this.S, 0.35 * this.S, 0.7 * this.S, 20);
    const containerMat = new THREE.MeshStandardMaterial({ color: 0x2c5234, opacity: 0.95, roughness: 0.5 });
    this.containerMesh = new THREE.Mesh(containerGeo, containerMat);
    this.containerMesh.position.set(-0.7 * this.S, 0.55 * this.S, 0);
    this.containerMesh.castShadow = true;
    this.group.add(this.containerMesh);

    this.group.position.copy(this.position);
  }

  getNozzleTipAndDir() {
    this.group.updateWorldMatrix(true, true);
    
    const worldTip = new THREE.Vector3();
    const worldBase = new THREE.Vector3();

    this.tipAnchor.getWorldPosition(worldTip);
    this.baseAnchor.getWorldPosition(worldBase);

    const worldDir = worldTip.clone().sub(worldBase).normalize();
    
    return { worldTip, worldDir };
  }

  createBall() {
    const r = this.ballRadius;
    const ballGeo = new THREE.SphereGeometry(r, 24, 24);
    const mesh = new THREE.Mesh(ballGeo, this.ballMaterial);
    mesh.castShadow = true;

    const { worldTip, worldDir } = this.getNozzleTipAndDir();
    const spawnPos = worldTip.clone().add(worldDir.clone().multiplyScalar(r));
    mesh.position.copy(spawnPos);

    const vel = worldDir.clone().multiplyScalar(this.speed);

    const ball = { mesh, pos: spawnPos.clone(), prevPos: spawnPos.clone(), vel, age: 0 };
  
    this.scene.add(mesh);
    this.balls.push(ball);
    return ball;
  }

  shoot() {
    if (this._shotCooldown > 0) return null;
    this._shotCooldown = 0.08;

    if (this.containerBalls && this.containerBalls.length > 0) {
      this.group.remove(this.containerBalls.pop());
      this.onShoot();

    return this.createBall();
    }
    return null;
  }
  
  setPitch(rad) {
    const min = -0.2;
    const max = 0.6;
    this.pitchGroup.rotation.x = THREE.MathUtils.clamp(rad, min, max);
  }
  changePitch(delta) { this.setPitch(this.pitchGroup.rotation.x + delta); }

  setYaw(rad) {
    this.yawGroup.rotation.y = rad;
  }
  changeYaw(delta) { this.setYaw(this.yawGroup.rotation.y + delta); }
  
  setSpeed(speedName) {
    if (this.speedSettings[speedName]) {
      this.speed = this.speedSettings[speedName];
      this.currentSpeedName = speedName;
    }
  }

  beginCharge() {
    if (this._charging) return;
    this._charging = true;
    this._charge = 0;
    this._shotAcc = 0;
  }

  endCharge() {
    if (!this._charging) return null;
    this._charging = false;
    const v = this.chargeMin + (this.chargeMax - this.chargeMin) * this._charge;
    this.speed = v;
    this._shotAcc = 0;
    return this.shoot();
  }

  enableKeyboard() {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      if (e.code === 'KeyW') { this.driveForward(1); e.preventDefault(); }
      if (e.code === 'KeyS') { this.driveForward(-1); e.preventDefault(); }
      if (e.code === 'KeyA') { this.driveTurn(1); e.preventDefault(); }
      if (e.code === 'KeyD') { this.driveTurn(-1); e.preventDefault(); }
    });
    window.addEventListener('keyup', (e) => {
      if (e.code === 'KeyW' || e.code === 'KeyS') { this.driveForward(0); }
      if (e.code === 'KeyA' || e.code === 'KeyD') { this.driveTurn(0); }
    });
  }
  
  driveForward(v) { this.drive.forward = THREE.MathUtils.clamp(v, -1, 1); }
  driveTurn(v)    { this.drive.turn    = THREE.MathUtils.clamp(v, -1, 1); }

  initContainerBalls(count = 20) {
    if (this.containerBalls?.length) {
      for (const m of this.containerBalls) this.group.remove(m);
    }
    this.containerBalls = [];
    const containerWorldY = this.containerMesh.position.y;
    const contH = 0.7 * this.S, contR = 0.35 * this.S, margin = 0.01 * this.S;
    const r = 0.033 * this.S;
    const ballGeo = new THREE.SphereGeometry(r, 16, 16);
    const ballMat = new THREE.MeshStandardMaterial({
      color: 0xccff00, roughness: 0.6, emissive: 0x7fbf00, emissiveIntensity: 0.2
    });
    const innerR = Math.max(0, contR - margin - r);
    const innerH = Math.max(0, contH - 2*margin - 2*r);
    const bottomY = containerWorldY - contH * 0.5 + margin + r;
    const topY    = bottomY + innerH;
    const hStep   = Math.max(2*r, 2*r * 0.95);
    const numLayers = Math.max(1, Math.floor(innerH / hStep) + 1);
    const ringStep = 2*r * 0.98;
    const positions = [];
    let produced = 0;
    for (let li = 0; li < numLayers && produced < count; li++) {
      const y = Math.min(topY, bottomY + li * hStep);
      positions.push(new THREE.Vector3(-0.7 * this.S, y, 0));
      produced++;
      if (produced >= count) break;
      for (let k = 1; ; k++) {
        const rk = k * ringStep;
        if (rk > innerR) break;
        const circumference = 2 * Math.PI * rk;
        let nOnRing = Math.max(6, Math.floor(circumference / (2*r)));
        const phase = Math.random() * Math.PI * 2;
        for (let i = 0; i < nOnRing && produced < count; i++) {
          const ang = phase + (i / nOnRing) * Math.PI * 2;
          const x = -0.7 * this.S + rk * Math.cos(ang);
          const z = rk * Math.sin(ang);
          positions.push(new THREE.Vector3(x, y, z));
          produced++;
        }
        if (produced >= count) break;
      }
    }
    for (const p of positions) {
      const ballMesh = new THREE.Mesh(ballGeo, ballMat);
      ballMesh.castShadow = true;
      ballMesh.position.copy(p);
      ballMesh.position.x += (Math.random()-0.5) * 0.006 * this.S;
      ballMesh.position.z += (Math.random()-0.5) * 0.006 * this.S;
      ballMesh.rotation.y = Math.random() * Math.PI * 2;
      this.group.add(ballMesh);
      this.containerBalls.push(ballMesh);
    }
  }
  
  addCollider(aabb) { this.colliders.push(aabb); }
  clearColliders() { this.colliders = []; }

 collideSphereAABB(ball) {
    if (this.colliders.length === 0) return;
    const p = ball.pos;
    const r = this.ballRadius;

    for (const c of this.colliders) {
      // Trova il punto più vicino sull'AABB al centro della palla
      const closestPoint = new THREE.Vector3(
        THREE.MathUtils.clamp(p.x, c.min.x, c.max.x),
        THREE.MathUtils.clamp(p.y, c.min.y, c.max.y),
        THREE.MathUtils.clamp(p.z, c.min.z, c.max.z)
      );

      // Vettore dal punto più vicino al centro della palla
      const d = new THREE.Vector3().subVectors(p, closestPoint);
      const distSq = d.lengthSq();

      // Controlla se c'è una collisione (la distanza è minore del raggio)
      if (distSq < r * r) {
        // 1. Risoluzione della compenetrazione
        const dist = Math.sqrt(distSq);
        const normal = dist > 1e-6 ? d.clone().multiplyScalar(1 / dist) : new THREE.Vector3(0, 1, 0);
        const penetration = r - dist;
        p.addScaledVector(normal, penetration + 1e-4); // Sposta la palla fuori dal collider

        // 2. Calcolo della risposta all'impulso (rimbalzo e attrito)
        const velNormalComponent = ball.vel.dot(normal);

        // Se la palla si sta già allontanando, non fare nulla
        if (velNormalComponent > 0) {
            continue; // Passa al prossimo collider
        }

        // Calcola la componente normale della velocità (il rimbalzo)
        const impulseVec = normal.clone().multiplyScalar(-(1 + this.restitution) * velNormalComponent);

        // Calcola la componente tangenziale della velocità (lo scivolamento)
        const tangentVel = ball.vel.clone().addScaledVector(normal, -velNormalComponent);
        
        // Applica l'attrito alla componente tangenziale
        tangentVel.multiplyScalar(this.groundFriction);

        // 3. Imposta la nuova velocità finale della palla
        // Combinando la nuova componente normale (rimbalzo) e quella tangenziale (attrito)
        ball.vel.copy(tangentVel).add(impulseVec);
      }
    }
  }

  _hashKey(p, h) {
    const x = Math.floor(p.x / h);
    const y = Math.floor(p.y / h);
    const z = Math.floor(p.z / h);
    return `${x},${y},${z}`;
  }

  _broadphasePairs() {
    const h = this.ballRadius * 2.5;
    const map = new Map();
    for (let i = 0; i < this.balls.length; i++) {
      const key = this._hashKey(this.balls[i].pos, h);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(i);
    }
    const pairs = [];
    for (const [, idxs] of map) {
      for (let i = 0; i < idxs.length; i++) {
        for (let j = i + 1; j < idxs.length; j++) {
          pairs.push([idxs[i], idxs[j]]);
        }
      }
    }
    return pairs;
  }

  _resolveBallBall(a, b) {
    const r = this.ballRadius;
    const n = new THREE.Vector3().subVectors(b.pos, a.pos);
    const dist2 = n.lengthSq();
    const minDist = 2 * r;
    if (dist2 >= minDist * minDist || dist2 === 0) return;

    const dist = Math.sqrt(dist2);
    n.multiplyScalar(1 / dist);
    const penetration = minDist - dist;

    const corr = Math.max(penetration - 1e-4, 0) * 0.5;
    a.pos.addScaledVector(n, -corr);
    b.pos.addScaledVector(n, corr);

    const relVel = new THREE.Vector3().subVectors(b.vel, a.vel);
    const vn = relVel.dot(n);
    if (vn > 0) return;

    const e = this.restitution;
    const invM = 1 / this.ballMass;
    const jn = -(1 + e) * vn / (2 * invM);
    const impulse = n.clone().multiplyScalar(jn);

    a.vel.addScaledVector(impulse, -invM);
    b.vel.addScaledVector(impulse, invM);
  }

// Inserisci queste tre funzioni al posto della vecchia funzione update()

update(deltaTime) {
  // La vecchia funzione ora chiama semplicemente le due nuove.
  this.updatePhysics(deltaTime);
  this.updateMeshes(deltaTime);
}

updatePhysics(deltaTime) {
  this._shotCooldown = Math.max(0, this._shotCooldown - deltaTime);

  if (this.autoShoot && !this._charging) {
    this._shotAcc += deltaTime;
    if (this._shotAcc >= this.shotIntervalSec) {
      this._shotAcc -= this.shotIntervalSec;
      this.shoot();
    }
  }

  if (this._charging) {
    this._charge = Math.min(1, this._charge + this.chargeRate * deltaTime);
  }
  
  const yawDelta = this.drive.turn * this.drive.turnRate * deltaTime;
  this.group.rotation.y += yawDelta;
  const dirLocal = new THREE.Vector3(0, 0, 1).applyQuaternion(this.group.quaternion);
  const step = this.drive.forward * this.drive.maxSpeed * deltaTime;
  this.group.position.addScaledVector(dirLocal, step);

  const wheelRadius = 0.18 * this.S;
  const spin = -(this.drive.forward * this.drive.maxSpeed / wheelRadius) * deltaTime;
  this.wheels.forEach(w => { w.rotation.x += spin; });
  
  for (const b of this.balls) {
    if (!b.prevPos) b.prevPos = b.pos.clone();
    else b.prevPos.copy(b.pos);
  }

  const steps = this.physicsSubsteps;
  const subDt = deltaTime / steps;
  for (let s = 0; s < steps; s++) {
    for (const ball of this.balls) {
      const gdt = this.gravity.clone().multiplyScalar(subDt);
      ball.vel.multiplyScalar(this.airDrag);
      ball.vel.add(gdt);
      ball.pos.addScaledVector(ball.vel, subDt);
      
      const r = this.ballRadius;
      if (ball.pos.y < r) {
        ball.pos.y = r;
        ball.vel.y = -ball.vel.y * this.restitution;
        ball.vel.x *= this.groundFriction;
        ball.vel.z *= this.groundFriction;
        if (Math.abs(ball.vel.y) < 0.25) ball.vel.y = 0;
        if (ball.pos.y === r && Math.hypot(ball.vel.x, ball.vel.z) < 0.02) ball.vel.set(0,0,0);
      }
      this.collideSphereAABB(ball);
    }
    
    const pairs = this._broadphasePairs();
    for (const [i, j] of pairs) {
      if (this.balls[i] && this.balls[j]) {
        this._resolveBallBall(this.balls[i], this.balls[j]);
      }
    }
  }
}

updateMeshes(deltaTime) {
  // Questo ciclo aggiorna le mesh (la parte visiva)
  for (let i = this.balls.length - 1; i >= 0; i--) {
    const ball = this.balls[i];
    ball.age += deltaTime;
    ball.mesh.position.copy(ball.pos);

    if (ball.vel.lengthSq() > 1e-6) {
      const axis = ball.vel.clone().normalize();
      const angle = this.spinFactor * ball.vel.length() * deltaTime / this.ballRadius;
      ball.mesh.rotateOnWorldAxis(axis, angle);
    }

    const out =
      (ball.pos.y < this.bounds.yMin) ||
      (Math.abs(ball.pos.x) > this.bounds.x) ||
      (Math.abs(ball.pos.z) > this.bounds.z);

    if (out) {
      this.scene.remove(ball.mesh);
      this.balls.splice(i, 1);
    }
  }

  // Anche l'aggiornamento del mirino laser è visivo, quindi va qui
  if (this.laserSight) {
    const { worldTip, worldDir } = this.getNozzleTipAndDir();
    const endPoint = new THREE.Vector3().addVectors(worldTip, worldDir.clone().multiplyScalar(50));
    
    const positions = this.laserSight.geometry.attributes.position;
    positions.setXYZ(0, worldTip.x, worldTip.y, worldTip.z);
    positions.setXYZ(1, endPoint.x, endPoint.y, endPoint.z);
    positions.needsUpdate = true;
  }
}

  clearBalls() {
    this.balls.forEach(b => this.scene.remove(b.mesh));
    this.balls = [];
  }

  dispose() {
    this.clearBalls();
    if (this.ballMaterial) this.ballMaterial.dispose();
  }
}