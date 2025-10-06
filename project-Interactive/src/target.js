// src/target.js (Versione Corretta e Pronta)
import * as THREE from 'three';

const _inv = new THREE.Matrix4();
const _p0L = new THREE.Vector3();
const _p1L = new THREE.Vector3();
const _hitL = new THREE.Vector3();
const _hitW = new THREE.Vector3();
const _nW   = new THREE.Vector3();
const _tmp  = new THREE.Vector3();
const _bbL  = new THREE.Box3();
// Vettori temporanei per evitare di crearne di nuovi a ogni chiamata
const _vn = new THREE.Vector3(); // Componente normale della velocità
const _vt = new THREE.Vector3(); // Componente tangenziale della velocità


export class TargetManager {
  constructor(scene, ballsArray, ballRadius, { onScore = () => {} } = {}) {
    this.scene = scene;
    this.balls = ballsArray;
    this.ballRadius = ballRadius;
    this.onScore = onScore;

    this.targets = [];
    this.hitboxHelpers = [];

    this.ballRestitution = 0.6;
    this.targetRestitutionDefault = 0.55;
    this.tangentialFrictionDefault = 0.15;
    this._pushOut = 1e-4;
    this.bounceScatter = 0.15;
  }

  createArcheryTargetTexture() {
    const canvas = document.createElement('canvas');
    const size = 256; canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    const centerX = size / 2, centerY = size / 2;
    const colors = ['#0077be', '#d72828', '#f5d415'];
    const radiuses = [size / 2, size / 2.5, size / 4];
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < colors.length; i++) {
      ctx.beginPath(); ctx.arc(centerX, centerY, radiuses[i], 0, 2 * Math.PI, false);
      ctx.fillStyle = colors[i]; ctx.fill();
    }
    return new THREE.CanvasTexture(canvas);
  }

  createPanelTargetTexture(text) {
    const canvas = document.createElement('canvas');
    const size = 256; canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#e9ecef'; ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = '#343a40'; ctx.lineWidth = size * 0.08; ctx.strokeRect(0, 0, size, size);
    ctx.fillStyle = '#343a40'; ctx.font = `bold ${size * 0.5}px Arial`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, size / 2, size / 2);
    return new THREE.CanvasTexture(canvas);
  }

  createAllTargets() {
    this.createArcheryTarget(new THREE.Vector3(0, 0, -15));
    this.createKnockDownTarget(new THREE.Vector3(-8, 0, -12));
    this.createMovingTarget(new THREE.Vector3(8, 0, -12));
  }

// In target.js - SOSTITUISCI QUESTA FUNZIONE

 // In target.js - SOSTITUISCI QUESTA FUNZIONE

  // In target.js - SOSTITUISCI QUESTA FUNZIONE

// In target.js - SOSTITUISCI QUESTA FUNZIONE

// In target.js - SOSTITUISCI QUESTA FUNZIONE

  createArcheryTarget(position) {
    const radius = 1.0; 
    const mainGroup = new THREE.Group();

    const centerPosition = position.clone();
    centerPosition.y = 5.0; 
    
    mainGroup.position.copy(centerPosition);
    this.scene.add(mainGroup);

    const mesh = new THREE.Mesh(
      new THREE.CircleGeometry(radius, 64),
      new THREE.MeshStandardMaterial({ map: this.createPanelTargetTexture("150") })
    );
    
    mainGroup.add(mesh);

    mesh.userData.restitution = 0.8;
    mesh.userData.friction = 0.12;

    this.targets.push({
      type: 'circular-moving',
      group: mainGroup, 
      hitZone: mesh, 
      isHit: false, 
      hitCooldown: 0,
      moveData: {
        center: centerPosition, 
        radius: 3.0,
        speed: 1.0,               
        angle: 0
      },
      onHit: function(ball, manager) {
        const hitZone = this.hitZone;
        
        // Effetto luminoso
        const originalEmissive = hitZone.material.emissive.getHex();
        // --- MODIFICA COLORE: Da giallo a VERDE ---
        hitZone.material.emissive.set(0x00ff00); 
        hitZone.material.emissiveIntensity = 2.0;
        
        setTimeout(() => {
          hitZone.material.emissive.setHex(originalEmissive);
        }, 150);

        // Mostra punteggio fluttuante (già verde)
        const worldPos = new THREE.Vector3();
        this.group.getWorldPosition(worldPos);
        worldPos.y += radius; 
        manager.showScorePopup(worldPos, "+150", "#00ff00");
        manager.onScore(150);
      }
    });
    this.addHitboxHelper(mesh);
  }
// In target.js - SOSTITUISCI QUESTA FUNZIONE

  createKnockDownTarget(position) {
    const size = { w: 1.8, h: 2.0, d: 0.1 }, baseHeight = 0.4;
    const panelMesh = new THREE.Mesh(
      new THREE.BoxGeometry(size.w, size.h, size.d),
      new THREE.MeshStandardMaterial({ map: this.createPanelTargetTexture("50") }).clone()
    );
    panelMesh.position.y = size.h / 2;
    const pivotGroup = new THREE.Group();
    pivotGroup.position.y = baseHeight;
    pivotGroup.add(panelMesh);
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(size.w / 1.5, size.w / 1.5, baseHeight, 24),
      new THREE.MeshStandardMaterial({ color: 0x495057 })
    );
    base.position.y = baseHeight / 2;
    const mainGroup = new THREE.Group();
    mainGroup.position.copy(position);
    mainGroup.rotation.y = Math.PI;
    mainGroup.add(base, pivotGroup);
    this.scene.add(mainGroup);

    panelMesh.userData.restitution = 0.3;
    panelMesh.userData.friction = 0.2;

    this.targets.push({
      type: 'knockdown', 
      group: mainGroup, 
      pivot: pivotGroup, 
      hitZone: panelMesh, 
      hitCooldown: 0,
      onHit: function(ball, manager) {
        const hitZone = this.hitZone;
        
        // Effetto luminoso
        const originalEmissive = hitZone.material.emissive.getHex();
        hitZone.material.emissive.set(0xffff00);
        hitZone.material.emissiveIntensity = 2.0;
        
        setTimeout(() => {
          hitZone.material.emissive.setHex(originalEmissive);
          hitZone.material.emissiveIntensity = 0;
        }, 200);

        // --- INIZIO LOGICA POSIZIONE MODIFICATA ---
        // 1. Prendi la posizione del centro del bersaglio nel mondo
        const targetCenterPos = new THREE.Vector3();
        this.group.getWorldPosition(targetCenterPos); // Usiamo 'this.group' per la posizione base

        // 2. Definisci una posizione fissa sopra il bersaglio per il popup
        const popupPosition = targetCenterPos.clone();
        popupPosition.y += 2.5; // Regola questa altezza se necessario

        // 3. Mostra il punteggio in quella posizione calcolata
        manager.showScorePopup(popupPosition, "+50", "#f5d415");
        // --- FINE LOGICA POSIZIONE MODIFICATA ---
        manager.onScore(50);
        
      }
    });
    this.addHitboxHelper(panelMesh);
  }
// In target.js - SOSTITUISCI ANCHE QUESTA FUNZIONE

  showScorePopup(position, text = "+50", color = 'yellow') {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 128;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = color;
    ctx.font = 'bold 90px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 8;
    
    ctx.strokeText(text, 128, 64);
    ctx.fillText(text, 128, 64);

    const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ 
      map: texture, 
      transparent: true,
      // Dice al testo di disegnarsi sempre sopra gli altri oggetti
      depthTest: false, 
      // Impedisce al testo di "interferire" con la profondità degli oggetti dietro di lui
      depthWrite: false 
    });
    const sprite = new THREE.Sprite(material);

    // --- MODIFICA CHIAVE ---
    // Lo sprite viene posizionato ESATTAMENTE dove specificato, senza offset aggiuntivi.
    sprite.position.copy(position);
    sprite.scale.set(2.5, 1.25, 1);
    this.scene.add(sprite);

    // Animazione (invariata)
    const duration = 1200;
    const startTime = Date.now();

    const animateInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = elapsed / duration;

      if (progress >= 1) {
        clearInterval(animateInterval);
        this.scene.remove(sprite);
        sprite.material.map.dispose();
        sprite.material.dispose();
      } else {
        sprite.position.y += 0.02;
        sprite.material.opacity = 1.0 - progress;
      }
    }, 16);
  }
// In target.js - SOSTITUISCI QUESTA FUNZIONE

// In target.js - SOSTITUISCI ANCHE QUESTA FUNZIONE

  createMovingTarget(position) {
    const size = { w: 2.5, h: 1.5, d: 0.1 }, poleHeight = 1.8;
    const mainGroup = new THREE.Group();
    mainGroup.position.copy(position);
    mainGroup.rotation.y = Math.PI;
    this.scene.add(mainGroup);

    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, poleHeight, 16),
      new THREE.MeshStandardMaterial({ color: 0x6c757d })
    );
    pole.position.y = poleHeight / 2;
    mainGroup.add(pole);

    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(size.w, size.h, size.d),
      new THREE.MeshStandardMaterial({ map: this.createPanelTargetTexture("100") }).clone()
    );
    mesh.position.y = poleHeight + size.h / 2;
    mainGroup.add(mesh);

    mesh.userData.restitution = 0.65;
    mesh.userData.friction = 0.12;

    this.targets.push({
      type: 'moving', 
      group: mainGroup, 
      hitZone: mesh, 
      hitCooldown: 0,
      moveData: { speed: 2.5, range: 2.5, direction: 1, startX: position.x },
      onHit: function(ball, manager) {
        const hitZone = this.hitZone;

        // Effetto luminoso
        const originalEmissive = hitZone.material.emissive.getHex();
        // --- MODIFICA COLORE: Da giallo a ROSSO ---
        hitZone.material.emissive.set(0xd72828);
        hitZone.material.emissiveIntensity = 2.5;
        setTimeout(() => {
          hitZone.material.emissive.setHex(originalEmissive);
        }, 150);

        // Mostra punteggio fluttuante (già rosso)
        const worldPos = new THREE.Vector3();
        hitZone.getWorldPosition(worldPos);
        manager.showScorePopup(worldPos, "+100", "#d72828");
        manager.onScore(100);

        // Animazione originale del "sobbalzo"
        const startY = this.group.position.y;
        this.group.position.y = startY - 0.1;
        setTimeout(() => (this.group.position.y = startY), 100);
      }
    });
    this.addHitboxHelper(mesh);
  }

  addHitboxHelper(targetMesh) {
    const helper = new THREE.Box3Helper(new THREE.Box3(), 0xffff00);
    this.scene.add(helper);
    this.hitboxHelpers.push(helper);
  }

  _segmentHitMeshPlane(hitZoneMesh, p0World, p1World, ballRadius) {
    _inv.copy(hitZoneMesh.matrixWorld).invert();
    _p0L.copy(p0World).applyMatrix4(_inv);
    _p1L.copy(p1World).applyMatrix4(_inv);

    const geom = hitZoneMesh.geometry;
    if (!geom.boundingBox) geom.computeBoundingBox();
    _bbL.copy(geom.boundingBox);
    const halfX = (_bbL.max.x - _bbL.min.x) * 0.5;
    const halfY = (_bbL.max.y - _bbL.min.y) * 0.5;
    const halfZ = (_bbL.max.z - _bbL.min.z) * 0.5;

    const z0 = _p0L.z, z1 = _p1L.z;
    const thicknessEff = Math.max(halfZ + ballRadius, ballRadius);
    if ((z0 >  thicknessEff && z1 >  thicknessEff) ||
        (z0 < -thicknessEff && z1 < -thicknessEff)) {
      return null;
    }

   const dz = z1 - z0;
// Se il movimento è parallelo al piano del bersaglio, non c'è collisione
if (Math.abs(dz) < 1e-9) { 
  return null; 
}

const t = (0 - z0) / dz;

// Se il punto di intersezione non è all'interno del segmento di movimento
// del fotogramma corrente (tra 0 e 1), allora non c'è stata collisione.
if (t < 0 || t > 1) {
  return null;
}

    _hitL.copy(_p0L).lerp(_p1L, t);

    const isCircle = (geom.type === 'CircleGeometry' || geom.type === 'CircleBufferGeometry');

    if (isCircle) {
      const rad = Math.max(halfX, halfY);
      const Rsum = rad + ballRadius;
      if ((_hitL.x * _hitL.x + _hitL.y * _hitL.y) > (Rsum * Rsum)) return null;
    } else {
      const marginX = halfX + ballRadius;
      const marginY = halfY + ballRadius;
      if (Math.abs(_hitL.x) > marginX || Math.abs(_hitL.y) > marginY) return null;
    }

    _hitW.copy(_hitL).applyMatrix4(hitZoneMesh.matrixWorld);
    const m = hitZoneMesh.matrixWorld.elements;
    _nW.set(m[8], m[9], m[10]).normalize();

    return { hitPointWorld: _hitW.clone(), hitNormalWorld: _nW.clone(), t: t };
  }

  _bounceBall(ball, normalW, restitution, muTangential) {
  // 1. Calcola la velocità scalare lungo la normale (quanto "forte" la palla sta andando CONTRO la superficie)
  const v_dot_n = ball.vel.dot(normalW);

  // 2. Separa la velocità nelle sue due componenti: normale e tangenziale
  // Componente normale (perpendicolare alla superficie)
  _vn.copy(normalW).multiplyScalar(v_dot_n);
  // Componente tangenziale (parallela alla superficie)
  _vt.copy(ball.vel).sub(_vn);

  // 3. Applica la restituzione (rimbalzo) SOLO alla componente normale
  // La invertiamo e la smorziamo in base al coefficiente di restituzione
  _vn.multiplyScalar(-restitution);

  // 4. Applica l'attrito SOLO alla componente tangenziale
  // Smorziamo la velocità di "scivolamento"
  // Un valore di muTangential = 0 non ha attrito, 1 ferma completamente lo scivolamento.
  const frictionFactor = Math.max(0, 1.0 - muTangential);
  _vt.multiplyScalar(frictionFactor);

  // 5. Ricombina le due componenti per ottenere la nuova velocità finale
  ball.vel.copy(_vn).add(_vt);
}

// In src/target.js - SOSTITUISCI TUTTA LA FUNZIONE
// In target.js - SOSTITUISCI ANCHE QUESTA FUNZIONE

// In target.js - SOSTITUISCI ANCHE QUESTA FUNZIONE

update(deltaTime) {
  // --- 1. Aggiorna l'animazione dei bersagli (movimento, ecc.) ---
  this.targets.forEach(target => {
    target.hitCooldown = Math.max(0, target.hitCooldown - deltaTime);

   if (target.type === 'moving') {
      const { group, moveData } = target;
      // Il bersaglio si muove come prima
      group.position.x += moveData.direction * moveData.speed * deltaTime;

      // Controlliamo se ha superato il limite destro
      if (group.position.x > moveData.startX + moveData.range) {
        group.position.x = moveData.startX + moveData.range; // <-- NUOVA RIGA: Blocca la posizione al limite
        moveData.direction = -1; // Inverti la direzione
      } 
      // Controlliamo se ha superato il limite sinistro
      else if (group.position.x < moveData.startX - moveData.range) {
        group.position.x = moveData.startX - moveData.range; // <-- NUOVA RIGA: Blocca la posizione al limite
        moveData.direction = 1; // Inverti la direzione
      }
    } 
    // --- INIZIO LOGICA MOVIMENTO VERTICALE ---
    else if (target.type === 'circular-moving') {
      const { group, moveData } = target;
      moveData.angle += moveData.speed * deltaTime;

      // Aggiorniamo le coordinate X e Y per creare un cerchio sul piano verticale
      group.position.x = moveData.center.x + moveData.radius * Math.cos(moveData.angle);
      group.position.y = moveData.center.y + moveData.radius * Math.sin(moveData.angle);
      // La posizione Z rimane costante
    }
    // --- FINE LOGICA MOVIMENTO VERTICALE ---
  });

  // --- 2. Aggiorna le hitbox visive (per debug) ---
  this.targets.forEach((target, i) => {
    if (this.hitboxHelpers[i]) {
      target.hitZone.updateWorldMatrix(true);
      const targetBBoxWorld = new THREE.Box3().setFromObject(target.hitZone);
      this.hitboxHelpers[i].box.copy(targetBBoxWorld);
    }
  });

  // --- 3. Loop di collisione (invariato) ---
  for (const ball of this.balls) {
    if (!ball?.pos || !ball?.prevPos || !ball?.vel) continue;

    for (const target of this.targets) {
      if (target.hitCooldown > 0) continue;

      const contact = this._segmentHitMeshPlane(target.hitZone, ball.prevPos, ball.pos, this.ballRadius);
      
      if (contact) {
        const eBall = this.ballRestitution;
        const eTarget = (typeof target.hitZone.userData?.restitution === 'number') ? target.hitZone.userData.restitution : this.targetRestitutionDefault;
        const restitutionEff = Math.max(0, Math.min(1, (eBall + eTarget) * 0.5));
        const mu = (typeof target.hitZone.userData?.friction === 'number') ? target.hitZone.userData.friction : this.tangentialFrictionDefault;
        const normal = contact.hitNormalWorld;
        
        if (this.bounceScatter > 0) {
            const scatter = this.bounceScatter;
            normal.x += (Math.random() - 0.5) * scatter;
            normal.y += (Math.random() - 0.5) * scatter;
            normal.z += (Math.random() - 0.5) * scatter;
            normal.normalize();
        }
        
        this._bounceBall(ball, contact.hitNormalWorld, restitutionEff, mu);
        ball.pos.copy(contact.hitPointWorld);
        
        const remainingTime = (1.0 - contact.t) * deltaTime;
        if (remainingTime > 1e-6) {
          ball.pos.addScaledVector(ball.vel, remainingTime);
        }

        target.hitCooldown = 0.2;
        if (typeof target.onHit === 'function') {
          target.onHit.call(target, ball, this);
        }

        break; 
      }
    }
  }
}
}