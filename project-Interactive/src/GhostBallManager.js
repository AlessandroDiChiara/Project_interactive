import * as THREE from 'three';
// manager for the large ghost balls 
export class GhostBallManager {
  constructor(scene, clock, shatterEffect) {
    this.scene = scene;
    this.clock = clock;
    this.shatterEffect = shatterEffect;
    this.activeBalls = [];
    this.eventTimer = 0;
    this.nextEventTime = this.getRandomNextEventTime();

    this.LIFETIME = 10.0;
    this.RADIUS = 1.5;
    this.GRAVITY = new THREE.Vector3(0, -5.0, 0);
    this.RESTITUTION = 0.4;
    this.GROUND_FRICTION = 0.95;

    this.geometry = new THREE.SphereGeometry(this.RADIUS, 32, 32);
    
    this.baseMaterial = new THREE.MeshStandardMaterial({
        metalness: 0.3,
        roughness: 0.7,
        emissiveIntensity: 0.5,
    });
  }
// frequency of mega balls
  getRandomNextEventTime() {
    return 2 + Math.random() * 10;
  }

  spawnMegaBall() {
    // create a new large ghost ball with random color and initial velocity
    const randomColor = new THREE.Color().setHSL(Math.random(), 0.9, 0.6);
    const instanceMaterial = this.baseMaterial.clone();
    
    instanceMaterial.color.copy(randomColor);
    instanceMaterial.emissive.copy(randomColor).multiplyScalar(0.4);
// create a me
    const mesh = new THREE.Mesh(this.geometry, instanceMaterial);
    mesh.castShadow = true;
// initial position 
    const spawnX = -15;
    const spawnY = 4;
    const spawnZ = -5;
    const pos = new THREE.Vector3(spawnX, spawnY, spawnZ);
    mesh.position.copy(pos);
    
    this.scene.add(mesh);
    // initial velocity
    const velX = 3.0 + Math.random() * 3.0;
    const velY = 1.0 + Math.random() * 2.0;
    const velZ = 0;

    const initialVelocity = new THREE.Vector3(velX, velY, velZ);

    this.activeBalls.push({
      mesh: mesh,
      pos: pos,
      vel: initialVelocity,
      createdAt: this.clock.getElapsedTime()
    });
  }

  update(dt, playerBalls, playerBallRadius) {
    // spawn a new mega ball if there are no active ones
    if (this.activeBalls.length === 0) {
      this.eventTimer += dt;
      if (this.eventTimer > this.nextEventTime) {
        this.spawnMegaBall();
        this.eventTimer = 0;
        this.nextEventTime = this.getRandomNextEventTime();
      }
    }
// update all active mega balls
    for (let i = this.activeBalls.length - 1; i >= 0; i--) {
      const ball = this.activeBalls[i];
      
      ball.vel.addScaledVector(this.GRAVITY, dt);
      ball.pos.addScaledVector(ball.vel, dt);
      // check for ground collision
      if (ball.pos.y < this.RADIUS) {
        // correct position and invert Y velocity with restitution
        ball.pos.y = this.RADIUS;
        ball.vel.y *= -this.RESTITUTION;
        // x velocity friction
        ball.vel.x *= this.GROUND_FRICTION;
      }
      
      let wasHitByPlayer = false;
      // minimum balls velocity for the impact 
      const MIN_IMPACT_SPEED_SQ = 1.0;
// check for collisions with player balls
// consider all the active player balls 
      for (const playerBall of playerBalls) {
        // check distance to see if they hit
        const distSq = ball.pos.distanceToSquared(playerBall.pos);
        const minDIst = this.RADIUS + playerBallRadius;
        
      // check if the distance is less than the sum of the radii and if the player ball is moving fast enough
        if (distSq < minDIst * minDIst && playerBall.vel.lengthSq() > MIN_IMPACT_SPEED_SQ) {
          wasHitByPlayer = true;
          break;
        }
     
      }
// remove the ball if it was hit or if its lifetime is over
      const age = this.clock.getElapsedTime() - ball.createdAt;
      const isOutOfLifetime = age > this.LIFETIME || Math.abs(ball.pos.x) > 20;
// if hit by player, trigger shatter effect and remove ball
      if (wasHitByPlayer) {
        this.shatterEffect.explode(ball.pos, ball.mesh.material.color);
        this.scene.remove(ball.mesh);
        this.activeBalls.splice(i, 1);
      } 
      // if out of lifetime, just remove ball
      else if (isOutOfLifetime) {
        this.scene.remove(ball.mesh);
        this.activeBalls.splice(i, 1);
      } 
      // otherwise, update ball position
      else {
        ball.mesh.position.copy(ball.pos);
      }
    }
  }

  clear() {
    this.activeBalls.forEach(b => this.scene.remove(b.mesh));
    this.activeBalls.length = 0;
  }
}