import * as THREE from 'three';

export class ShatterEffect {
  constructor(scene, fragmentCount = 100) {
    this.scene = scene;
    this.GRAVITY = -9.8;
    // all the fragment
    this.fragmentPool = [];
    // active fragment
    this.activeFragments = [];

    // create a number of fragment at the start that we put inside a "pool"
    const fragmentGeometry = new THREE.IcosahedronGeometry(0.15, 0); 
    for (let i = 0; i < fragmentCount; i++) {
      const material = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.7,
        metalness: 0.5,
        transparent: true
      });
      const mesh = new THREE.Mesh(fragmentGeometry, material);
      this.fragmentPool.push(mesh);
    }
  }

  explode(position, color) {
    // number of fragment to spawn
    const fragmentsToSpawn = 30 + Math.floor(Math.random() * 20);

    for (let i = 0; i < fragmentsToSpawn; i++) {
      
      const mesh = this.fragmentPool.pop();
      if (!mesh) break; 

      mesh.position.copy(position);
      mesh.material.color.copy(color);
      mesh.material.emissive.copy(color).multiplyScalar(0.3);
      mesh.material.opacity = 1.0;
      mesh.scale.set(1, 1, 1).multiplyScalar(0.5 + Math.random() * 0.8);
// speed and velocity of each fragment
      const speed = 4.0 + Math.random() * 6.0;
      const velocity = new THREE.Vector3(
        Math.random() - 0.5,
        Math.random() - 0.5,
        Math.random() - 0.5
      ).normalize().multiplyScalar(speed);
// information about each fragment
      const fragment = {
        mesh: mesh,
        velocity: velocity,
        life: 1.5 + Math.random() * 1.0, // life of the fragment
        age: 0,
        rotationAxis: new THREE.Vector3().randomDirection(),
        rotationSpeed: Math.random() * 4
      };

      this.activeFragments.push(fragment);
      this.scene.add(mesh);
    }
  }

  update(dt) {
  
    for (let i = this.activeFragments.length - 1; i >= 0; i--) {
      const frag = this.activeFragments[i];
      frag.age += dt;

      // movement of each fragemnt
      frag.velocity.y += this.GRAVITY * dt;
      frag.mesh.position.addScaledVector(frag.velocity, dt);
      frag.mesh.rotateOnAxis(frag.rotationAxis, frag.rotationSpeed * dt);

      //fade out
      const lifeLeft = 1.0 - (frag.age / frag.life);
      frag.mesh.material.opacity = lifeLeft;

      // at the end we put again the fragment inside the initial pool 
      if (frag.age >= frag.life) {
        this.scene.remove(frag.mesh);
        this.fragmentPool.push(frag.mesh);
        this.activeFragments.splice(i, 1);
      }
    }
  }
}