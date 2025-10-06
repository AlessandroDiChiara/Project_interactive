// src/lamps.js
import * as THREE from 'three';

export class StadiumLamps {
  constructor(scene, {
    positions = [],               // array di THREE.Vector3
    poleHeight = 7.5,             // altezza palo
    armLength = 1.2,              // sbalzo della testa
    color = 0xfff6d5,             // luce calda
    spotMaxIntensity = 2.2,       // intensità massima a “notte piena”
    glowMaxIntensity = 0.6,       // piccola point light per alone
    shadow = true
  } = {}) {
    this.scene = scene;
    this.lamps = [];      // { group, spotA, spotB, spotC, glow, headMat, maxI, maxGlow }
    this.k = 0;           // intensità attuale 0..1
    this.kTarget = 0;     // intensità desiderata (segue con smoothing)
    this.smooth = 6.0;    // [1..10] più alto = più veloce

    positions.forEach(pos => this._addLamp(pos, {
      poleHeight, armLength, color, spotMaxIntensity, glowMaxIntensity, shadow
    }));
  }

  tuneForCourt({ cx=0, cz=0, halfW=5.5, halfL=12.0, aim=0.85 } = {}) {
    for (const L of this.lamps) {
      const { spotA, spotB, spotC } = L;
      if (!spotA || !spotB || !spotC) continue;

      // --- LOGICA DI PUNTAMENTO TRIPLA ---

      // 1. Faretto A (Away): punta al lato OPPOSTO del campo
      const zSignA = (L.group.position.z > cz) ? -1 : +1;
      const targetA = new THREE.Vector3(cx, 0.0, cz + zSignA * (halfL * aim));
      
      // 2. Faretto B (Base): punta allo STESSO lato del campo
      const zSignB = Math.sign(L.group.position.z - cz);
      const targetB = new THREE.Vector3(cx, 0.0, cz + zSignB * (halfL * aim));

      // 3. Faretto C (Center): punta esattamente al CENTRO del campo
      const targetC = new THREE.Vector3(cx, 0.0, cz);

      // Calcoliamo l'angolo del cono di luce per una buona copertura
      const dir = targetA.clone().sub(L.group.position).normalize();
      const corners = [
        new THREE.Vector3(cx - halfW, 0, cz - halfL),
        new THREE.Vector3(cx + halfW, 0, cz - halfL),
        new THREE.Vector3(cx - halfW, 0, cz + halfL),
        new THREE.Vector3(cx + halfW, 0, cz + halfL),
      ];
      let maxAngle = 0;
      for (const p of corners) {
        const v = p.clone().sub(L.group.position).normalize();
        const ang = Math.acos(THREE.MathUtils.clamp(dir.dot(v), -1, 1));
        if (ang > maxAngle) maxAngle = ang;
      }
      const finalAngle = Math.min(THREE.MathUtils.degToRad(55), maxAngle);
      
      // Applichiamo i settaggi a TUTTI E TRE i faretti
      [spotA, spotB, spotC].forEach((spot, index) => {
        let target;
        if (index === 0) target = targetA;
        else if (index === 1) target = targetB;
        else target = targetC;

        if (!spot.target.parent) this.scene.add(spot.target);
        spot.target.position.copy(target);

        spot.distance = 0;
        spot.decay = 1.5;
        spot.angle = finalAngle;
        spot.penumbra = 1.0; // Bordi molto sfumati per una fusione ottimale
        if (spot.castShadow) {
          spot.shadow.bias = -0.0003;
        }
      });
    }
  }

  _addLamp(basePos, opt) {
    const { poleHeight, armLength, color, spotMaxIntensity, glowMaxIntensity, shadow } = opt;

    const group = new THREE.Group();
    group.position.copy(basePos);
    
    // --- Geometria del palo (invariata) ---
    const sign = -Math.sign(basePos.x);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.8, roughness: 0.4 });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, poleHeight, 16), poleMat);
    pole.position.y = poleHeight / 2;
    group.add(pole);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(armLength, 0.06, 0.06), poleMat);
    arm.position.set(sign * armLength / 2, poleHeight, 0);
    group.add(arm);
    const headMat = new THREE.MeshStandardMaterial({
      color: 0xffffff, emissive: new THREE.Color(color), emissiveIntensity: 0.0,
    });
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 12), headMat);
    head.position.set(sign * (armLength + 0.05), poleHeight, 0);
    group.add(head);
    
    // --- CREAZIONE DEI TRE FARETTI ---

    // Faretto A (lontano)
    const spotA = new THREE.SpotLight(color, 0, 0, 1, 1, 1);
    spotA.distance = 50;
    spotA.position.copy(head.position);
    spotA.castShadow = !!shadow; // Ombra solo dal faretto principale
    
    // Faretto B (vicino)
    const spotB = new THREE.SpotLight(color, 0, 0, 1, 1, 1);
    spotB.distance = 50;
    spotB.position.copy(head.position);
    spotB.castShadow = false;

    // Faretto C (al centro)
    const spotC = new THREE.SpotLight(color, 0, 0, 1, 1, 1);
    spotC.distance = 50;
    spotC.position.copy(head.position);
    spotC.castShadow = false;

    // Aggiungiamo i faretti e i loro target al gruppo
    group.add(spotA, spotB, spotC);
    group.add(spotA.target, spotB.target, spotC.target);

    // Luce per l'effetto alone (invariata)
    const glow = new THREE.PointLight(color, 0, 4, 2.0);
    glow.position.copy(head.position);
    group.add(glow);

    this.scene.add(group);

    this.lamps.push({
      group,
      spotA,
      spotB,
      spotC, // Salviamo il riferimento al terzo faretto
      glow,
      headMat,
      maxI: spotMaxIntensity,
      maxGlow: glowMaxIntensity
    });
  }

  setIntensity(k01) {
    this.kTarget = THREE.MathUtils.clamp(k01, 0, 1);
  }

  update(delta) {
    const a = 1 - Math.exp(-this.smooth * delta);
    this.k = THREE.MathUtils.lerp(this.k, this.kTarget, a);

    for (const L of this.lamps) {
      // Calcoliamo l'intensità e la dividiamo per i tre faretti.
      // Un moltiplicatore di 0.5 darà una luminosità totale 1.5x (0.5 * 3)
      const intensity = this.k * (L.maxI || 8) * 0.5;

      // Aggiorniamo l'intensità di TUTTI E TRE i faretti
      if (L.spotA) L.spotA.intensity = intensity;
      if (L.spotB) L.spotB.intensity = intensity;
      if (L.spotC) L.spotC.intensity = intensity;

      // Logica per alone e materiale emissivo (invariata)
      L.glow.intensity = this.k * (L.maxGlow || 1);
      L.headMat.emissiveIntensity = 1.5 * this.k;
    }
  }
}