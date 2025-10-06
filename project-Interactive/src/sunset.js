// src/sunset.js
import * as THREE from 'three';

export class SunsetController {
  constructor(scene, sun, hemi, renderer, {
    azStart = 135, azEnd = 250,
    elStart = 28,  elEnd = 2,
    durationSec = 30,
    autoStart = true,
    fillIntensity = 0.28
  } = {}) {
    this.scene = scene;
    this.sun = sun;
    this.hemi = hemi;
    this.renderer = renderer;
    this.fillIntensity = fillIntensity;

    this.scene.background = new THREE.Color(0x87ceeb);
    if (!this.scene.fog) this.scene.fog = new THREE.Fog(new THREE.Color(0xb7d5ff), 260, 1200);

    this.fill = new THREE.DirectionalLight(0xffffff, this.fillIntensity);
    this.fill.castShadow = false;
    this.scene.add(this.fill);

    this.azStart = azStart; this.azEnd = azEnd;
    this.elStart = elStart; this.elEnd = elEnd;
    this.duration = Math.max(1, durationSec);

    this.t = 0;
    this.running = !!autoStart;

    // NEW: stato elevazione + riferimento ai lampioni
    this.currentEl = this.elStart;   // gradi
    this.lamps = null;               // StadiumLamps opzionale

    this.applyAt(0);
  }

  // NEW: collega il manager lampioni
  attachLamps(lampsManager) { this.lamps = lampsManager; }

  // NEW: fattore notte 0..1 (inizia ad accendere sotto 10° di elevazione)
 getNightFactor() {
  const thStart = 35; // inizio accensione
  const thEnd   = 0;  // piena notte
  let k = (thStart - this.currentEl) / (thStart - thEnd);
  k = THREE.MathUtils.clamp(k, 0, 1);
  // curva morbida
  return k * k * (3 - 2 * k);
}

  setSun(azimuthDeg, elevationDeg) {
    const phi = THREE.MathUtils.degToRad(90 - elevationDeg);
    const theta = THREE.MathUtils.degToRad(azimuthDeg);
    const dir = new THREE.Vector3().setFromSphericalCoords(1, phi, theta);

    const dist = 300;
    this.sun.position.set(dir.x * dist, dir.y * dist, dir.z * dist);
    this.sun.target.position.set(0, 0, 0);
    this.sun.target.updateMatrixWorld();

    const fDist = 250;
    this.fill.position.set(-dir.x * fDist, Math.max(100, dir.y * fDist * 0.8), -dir.z * fDist);

    // NEW: salva elevazione corrente
    this.currentEl = elevationDeg;
  }

  applyAt(t) {
    const e = t * t * (3 - 2 * t); // smoothstep
    const az = THREE.MathUtils.lerp(this.azStart, this.azEnd, e);
    const el = THREE.MathUtils.lerp(this.elStart, this.elEnd, e);
    this.setSun(az, el);

    const daySun  = new THREE.Color(0xffffff);
    const duskSun = new THREE.Color(0xffa56e);
    this.sun.color.lerpColors(daySun, duskSun, e);
    this.sun.intensity = THREE.MathUtils.lerp(1.3, 0.9, e);
    this.sun.shadow.radius = THREE.MathUtils.lerp(2.0, 3.0, e);

    this.fill.intensity = THREE.MathUtils.lerp(this.fillIntensity, this.fillIntensity * 0.7, e);

    const daySky     = new THREE.Color(0xbbe1ff);
    const dayGround  = new THREE.Color(0x2e4b2e);
    const duskSky    = new THREE.Color(0xfc8d6d);
    const duskGround = new THREE.Color(0x3a3a2a);
    this.hemi.color.lerpColors(daySky, duskSky, e);
    this.hemi.groundColor.lerpColors(dayGround, duskGround, e);
    this.hemi.intensity = THREE.MathUtils.lerp(0.5, 0.35, e);

    const fogDay  = new THREE.Color(0xb7d5ff);
    const fogDusk = new THREE.Color(0xffe2c2);
    this.scene.fog.color.lerpColors(fogDay, fogDusk, e);
    this.scene.fog.near = THREE.MathUtils.lerp(320, 260, e);
    this.scene.fog.far  = THREE.MathUtils.lerp(1500, 1100, e);
    this.scene.background.lerpColors(fogDay, fogDusk, e);

    this.renderer.toneMappingExposure = THREE.MathUtils.lerp(1.35, 1.45, e);

    // NEW: aggiorna i lampioni con il fattore notte
    if (this.lamps) this.lamps.setIntensity(this.getNightFactor());
  }

  update(delta) {
    if (!this.running) return;
    this.t += delta / this.duration;
    if (this.t >= 1) { this.t = 1; this.running = false; }
    this.applyAt(this.t);
  }
  start() { this.running = true; }
  pause() { this.running = false; }
  reset() { this.t = 0; this.applyAt(0); }
}
