// src/lamps.js
import * as THREE from 'three';

export class StadiumLamps {
  constructor(scene, {
    // constructor for lamps 
    positions = [],               
    poleHeight = 7.5,             
    armLength = 1.2,              
    color = 0xfff6d5,             
    spotMaxIntensity = 2.2,       
    glowMaxIntensity = 0.6,       
    shadow = true
  } = {}) {
    this.scene = scene;
    this.lamps = [];      // { group, spotA, spotB, spotC, glow, headMat, maxI, maxGlow }
    this.k = 0;           // intensità attuale 0..1
    this.kTarget = 0;     // target intensity
    this.smooth = 6.0;    // [1..10] più alto = più veloce
this.colliders = [];
// add a lamp 
    positions.forEach(pos => this._addLamp(pos, {
      poleHeight, armLength, color, spotMaxIntensity, glowMaxIntensity, shadow
    }));
  }

  tuneForCourt({ cx=0, cz=0, halfW=5.5, halfL=12.0, aim=0.85 } = {}) {
    for (const L of this.lamps) {
      const { spotA, spotB, spotC } = L;
      if (!spotA || !spotB || !spotC) continue;

// each lamp is composed by three SpotLights: the first targets the opposite side of the field
// the second the near sideline, the third points to the center 
      const zSignA = (L.group.position.z > cz) ? -1 : +1;
      const targetA = new THREE.Vector3(cx, 0.0, cz + zSignA * (halfL * aim));
   
      const zSignB = Math.sign(L.group.position.z - cz);
      const targetB = new THREE.Vector3(cx, 0.0, cz + zSignB * (halfL * aim));

      const targetC = new THREE.Vector3(cx, 0.0, cz);

      const dir = targetA.clone().sub(L.group.position).normalize();
      // compute the four field corners 
      const corners = [
        new THREE.Vector3(cx - halfW, 0, cz - halfL),
        new THREE.Vector3(cx + halfW, 0, cz - halfL),
        new THREE.Vector3(cx - halfW, 0, cz + halfL),
        new THREE.Vector3(cx + halfW, 0, cz + halfL),
      ];
      // compute the angle for the lamps necessary for the entire illumination 
      let maxAngle = 0;
      for (const p of corners) {
        const v = p.clone().sub(L.group.position).normalize();
        const ang = Math.acos(THREE.MathUtils.clamp(dir.dot(v), -1, 1));
        if (ang > maxAngle) maxAngle = ang;
      }
      const finalAngle = Math.min(THREE.MathUtils.degToRad(65), maxAngle);
      
   // for each spot assing the correct target 
      [spotA, spotB, spotC].forEach((spot, index) => {
        let target;
        if (index === 0) target = targetA;
        else if (index === 1) target = targetB;
        else target = targetC;

        if (!spot.target.parent) this.scene.add(spot.target);
        spot.target.position.copy(target);
// parameters for the light 
        spot.distance = 0;
        spot.decay = 1.3;
        spot.angle = finalAngle;
        spot.penumbra = 1.0; 
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
    const poleRadius = 0.1;
    pole.position.y = poleHeight / 2;
    pole.castShadow = true; 
    group.add(pole);

const poleAABB = new THREE.Box3();
    poleAABB.setFromCenterAndSize(
      new THREE.Vector3(basePos.x, poleHeight / 2, basePos.z), // Centro del palo nel mondo
      new THREE.Vector3(poleRadius * 2, poleHeight, poleRadius * 2) // Dimensioni della scatola
    );
    this.colliders.push(poleAABB);

    const arm = new THREE.Mesh(new THREE.BoxGeometry(armLength, 0.06, 0.06), poleMat);
    arm.position.set(sign * armLength / 2, poleHeight, 0);
    group.add(arm);
    const headMat = new THREE.MeshStandardMaterial({
      color: 0xffffff, emissive: new THREE.Color(color), emissiveIntensity: 0.0,
    });
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 12), headMat);
    head.position.set(sign * (armLength + 0.05), poleHeight, 0);
    group.add(head);
    

    // lamp A
    const spotA = new THREE.SpotLight(color, 0, 0, 1, 1, 1);
    spotA.distance = 50;
    spotA.castShadow = true
    spotA.position.copy(head.position);
    spotA.castShadow = !!shadow; 
    
    // Lamp b
    const spotB = new THREE.SpotLight(color, 0, 0, 1, 1, 1);
    spotB.distance = 50;
    spotB.castShadow = true
    spotB.position.copy(head.position);
    spotB.castShadow = false;

    // lamp C
    const spotC = new THREE.SpotLight(color, 0, 0, 1, 1, 1);
    spotC.distance = 50;
    spotC.castShadow = true
    spotC.position.copy(head.position);
    spotC.castShadow = false;

    //add spot to the group
    group.add(spotA, spotB, spotC);
    group.add(spotA.target, spotB.target, spotC.target);

    // create loight 4 is the distance
    const glow = new THREE.PointLight(color, 0, 4, 2.0);
    // create the light in correspondnce of head lamp, is only a visual effect
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
// intensity from 0 to 1
  setIntensity(k01) {
    this.kTarget = THREE.MathUtils.clamp(k01, 0, 1);
  }

  update(delta) {
  // Calculate the smoothing factor ('a') based on time elapsed ('delta') and smoothness setting.
// This exponential decay formula ensures a realistic, gradual transition towards the target intensity.
    const a = 1 - Math.exp(-this.smooth * delta);
    // Linearly interpolate (LERP) the current intensity ('this.k') towards the target intensity ('this.kTarget'),
// using 'a' as the step amount for this frame. This creates the smooth fade-in/fade-out effect.
    this.k = THREE.MathUtils.lerp(this.k, this.kTarget, a);

    for (const L of this.lamps) {
      // compute final intensity
      const intensity = this.k * (L.maxI || 8) * 0.5;

      // Aggiorniamo l'intensità di TUTTI E TRE i faretti
      if (L.spotA) L.spotA.intensity = intensity;
      if (L.spotB) L.spotB.intensity = intensity;
      if (L.spotC) L.spotC.intensity = intensity;

      // intensiity for visual effect
      L.glow.intensity = this.k * (L.maxGlow || 1);
      L.headMat.emissiveIntensity = 1.5 * this.k;
    }
  }
}