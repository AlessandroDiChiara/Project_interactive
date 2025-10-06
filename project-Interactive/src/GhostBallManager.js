import * as THREE from 'three';

export class GhostBallManager {
  constructor(scene, clock) {
    this.scene = scene;
    this.clock = clock;
    this.activeBalls = [];
    this.eventTimer = 0;
    this.nextEventTime = this.getRandomNextEventTime();

    this.LIFETIME = 15.0;
    this.RADIUS = 1.5;
    this.GRAVITY = new THREE.Vector3(0, -5.0, 0);
    this.RESTITUTION = 0.4;
    this.GROUND_FRICTION = 0.95;

    this.geometry = new THREE.SphereGeometry(this.RADIUS, 32, 32);
    this.material = new THREE.MeshStandardMaterial({
        color: 0xff4500,
        metalness: 0.8,
        roughness: 0.2,
        emissive: 0x8B0000,
        emissiveIntensity: 0.5,
    });
  }

  getRandomNextEventTime() {
    return 10 + Math.random() * 10;
  }

  spawnMegaBall() {
    const mesh = new THREE.Mesh(this.geometry, this.material);
    mesh.castShadow = true;

    const spawnX = -15;
    const spawnY = 4;
    const spawnZ = -5;
    const pos = new THREE.Vector3(spawnX, spawnY, spawnZ);
    mesh.position.copy(pos);
    
    this.scene.add(mesh);

    const initialVelocity = new THREE.Vector3(4.0, 0, 0);

    this.activeBalls.push({
      mesh: mesh,
      pos: pos,
      vel: initialVelocity,
      createdAt: this.clock.getElapsedTime()
    });
  }

  update(dt, playerBalls, playerBallRadius) {
    this.eventTimer += dt;
     if (this.activeBalls.length === 0) {
    // Il timer per la prossima palla avanza solo se il campo è libero
    this.eventTimer += dt;
    if (this.eventTimer > this.nextEventTime) {
      this.spawnMegaBall();
      this.eventTimer = 0;
      this.nextEventTime = this.getRandomNextEventTime();
    }
  }

    for (let i = this.activeBalls.length - 1; i >= 0; i--) {
      const ball = this.activeBalls[i];
      
      ball.vel.addScaledVector(this.GRAVITY, dt);
      ball.pos.addScaledVector(ball.vel, dt);
      
      if (ball.pos.y < this.RADIUS) {
        ball.pos.y = this.RADIUS;
        ball.vel.y *= -this.RESTITUTION;
        ball.vel.x *= this.GROUND_FRICTION;
      }
      
      for (const playerBall of playerBalls) {
        const distSq = ball.pos.distanceToSquared(playerBall.pos);
        const minDIst = this.RADIUS + playerBallRadius;
        if (distSq < minDIst * minDIst) {
          const tempVel = ball.vel.clone().multiplyScalar(0.1);
          ball.vel.copy(playerBall.vel);
          playerBall.vel.copy(tempVel);
        }
      }

      ball.mesh.position.copy(ball.pos);
      const age = this.clock.getElapsedTime() - ball.createdAt;
      if (age > this.LIFETIME || Math.abs(ball.pos.x) > 20) {
        this.scene.remove(ball.mesh);
        this.activeBalls.splice(i, 1);
      }
    }
  }

  clear() {
    this.activeBalls.forEach(b => this.scene.remove(b.mesh));
    this.activeBalls.length = 0;
  }
}