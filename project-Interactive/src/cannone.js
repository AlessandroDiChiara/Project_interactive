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
    this.speedSettings = {
      slow:   10 * this.VS,
      medium: 15 * this.VS,
      fast:   22 * this.VS
    };
    this.currentSpeedName = 'medium';
    this.speed = this.speedSettings[this.currentSpeedName];
    this.gravity = new THREE.Vector3(0, -9.81, 0);
    this.ballRadius = 0.1 * this.S;
    //limita
    const MARGIN = 0.5; 
    this.minXLimit = -14.25 + MARGIN; 
    this.maxXLimit = 14.25 - MARGIN;
     this.minZLimit = 12.0 + MARGIN; 
    this.maxZLimit = 17.83 - MARGIN; 
    
    
    this.ballMass   = 0.057;
    this.restitution     = 0.55;// C
    this.groundFriction  = 0.82;// horizontal friction 
    this.airDrag         = 0.998; 
    this.spinFactor      = 2.0;
    this.physicsSubsteps = 4; 
    //limits for the balls
    this.bounds = { x: 25 * this.S, z: 20 * this.S, yMin: -2 * this.S };
    this.drive = {
      forward: 0,
      turn: 0,
      maxSpeed: 5 * this.S,
      turnRate: 2
    };
    this.acceleration = 105;
    this.currentSpeed = 0; //
    this.colliders = [];
    this._charging  = false;
    this._charge    = 0;
    this.chargeMin  = 8  * this.VS; //minimum velocity
    this.chargeMax  = 28 * this.VS; //maximum avelocity 
    this.chargeRate = 1.6;
    this.ballMaterial = new THREE.MeshStandardMaterial({
      color: 0x99ff00, roughness: 0.8, metalness: 0.0,
      emissive: 0xffff00, emissiveIntensity: 1.0
    });

    this.createMachine();
    /*
    const laserMat = new THREE.LineBasicMaterial({ color: 0xff0000 });
    const laserGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    this.laserSight = new THREE.Line(laserGeo, laserMat);
    this.scene.add(this.laserSight);*/
    
    const INITIAL_PITCH_RAD = -0.025; // circa -1.4 gradi punta dello sparapalline
    this.setPitch(INITIAL_PITCH_RAD);
  }

   createMachine() {
    this.group = new THREE.Group(); // principal group 
    this.scene.add(this.group);
    // cylinder
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x404040, metalness: 0.1, roughness: 0.7 });
    const baseGeo = new THREE.CylinderGeometry(0.45 * this.S, 0.55 * this.S, 0.5 * this.S, 32);
    this.baseMesh = new THREE.Mesh(baseGeo, baseMat);
    this.baseMesh.position.set(0, 0.25 * this.S, 0);// positioned on the plane 
    this.baseMesh.castShadow = true;
    this.baseMesh.receiveShadow = true;
    this.group.add(this.baseMesh);
    // orizontal and vertical rotation
    this.yawGroup = new THREE.Group();
    this.yawGroup.position.y = 0.5 * this.S;
    this.group.add(this.yawGroup);

    this.pitchGroup = new THREE.Group();
    this.pitchGroup.position.y = 0.2 * this.S;
    this.yawGroup.add(this.pitchGroup);
    // creation trunnion 
    const trunnionGeo = new THREE.CylinderGeometry(0.12 * this.S, 0.12 * this.S, 0.3 * this.S, 16);
    const trunnionMat = new THREE.MeshStandardMaterial({ color: 0x4a4a4a, metalness: 0.1, roughness: 0.7 });
    const trunnions = new THREE.Mesh(trunnionGeo, trunnionMat);
    trunnions.rotation.z = Math.PI / 2;
    trunnions.castShadow = true;
    trunnions.receiveShadow = true;
    this.pitchGroup.add(trunnions);
    
    //creazione barrell 
    this.barrelLen = 0.8 * this.S;
    const outerRadius = 0.10 * this.S;
    const cannonGeo = new THREE.CylinderGeometry(0.08 * this.S, outerRadius, this.barrelLen, 32, 1, true);
    const cannonMat = new THREE.MeshStandardMaterial({ color: 0x5c5c5c, metalness: 0.2, roughness: 0.6, side: THREE.DoubleSide });
    this.cannonMesh = new THREE.Mesh(cannonGeo, cannonMat);
    // barrel position
    this.cannonMesh.position.z = this.barrelLen / 2; 
    this.cannonMesh.rotation.x = -Math.PI / 2;
    this.cannonMesh.castShadow = true;
    this.cannonMesh.receiveShadow = true;
    this.pitchGroup.add(this.cannonMesh);
    // cilinder to create an empty space
    const innerCannonGeo = new THREE.CylinderGeometry(0.09 * this.S * 0.75, outerRadius * 0.75, this.barrelLen, 32, 1, true);
    const innerCannonMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
    const innerCannonMesh = new THREE.Mesh(innerCannonGeo, innerCannonMat);
    this.cannonMesh.add(innerCannonMesh);

    // position and orientation 
    this.baseAnchor = new THREE.Object3D();
    this.pitchGroup.add(this.baseAnchor);
    this.tipAnchor = new THREE.Object3D();
    this.tipAnchor.position.set(0, this.barrelLen * 0.01,0);
    this.cannonMesh.add(this.tipAnchor);

    //crea container balls
    const containerGeo = new THREE.CylinderGeometry(0.35 * this.S, 0.35 * this.S, 0.7 * this.S, 20);
    const containerMat = new THREE.MeshStandardMaterial({ color: 0x2c5234, opacity: 0.95, roughness: 0.5 });
    this.containerMesh = new THREE.Mesh(containerGeo, containerMat);
    this.containerMesh.position.set(-0.7 * this.S, 0.55 * this.S, 0);
    this.containerMesh.castShadow = true;
    this.group.add(this.containerMesh);

    this.group.position.copy(this.position);
    this.group.rotation.y = Math.PI;
  }
  // function to get position and orientation of the ball 
  getNozzleTipAndDir() {
    // matrici di trasformazione globali
    this.group.updateWorldMatrix(true, true);
    const worldTip = new THREE.Vector3();
    // TipAnchor position 
    this.tipAnchor.getWorldPosition(worldTip);
    // global rotatio 
    const worldQuaternion = new THREE.Quaternion();
    this.pitchGroup.getWorldQuaternion(worldQuaternion);
    // directional vettor
    const worldDir = new THREE.Vector3(0, 0, 1).applyQuaternion(worldQuaternion);
    //initial pose and direction 
    return { worldTip, worldDir };
  }

  createBall() {
    const r = this.ballRadius;
    const ballGeo = new THREE.SphereGeometry(r, 24, 24);
    const mesh = new THREE.Mesh(ballGeo, this.ballMaterial);
    mesh.castShadow = true;
    // trova posizione e direzione della canna
    const { worldTip, worldDir } = this.getNozzleTipAndDir();
    // fa uscire la palla leggermente fuori dalla canna per evitare collisioni immediate
   const MINIMUM_SPAWN_OFFSET = 4.0; 

const spawnPos = worldTip.clone().add(
    worldDir.clone().multiplyScalar(this.ballRadius * MINIMUM_SPAWN_OFFSET)
); 
//velocita iniziale della palla 
    const vel = worldDir.clone().multiplyScalar(this.speed);
    
    // Aggiungiamo un array per contenere i "fantasmi" della scia
    const ball = { mesh, pos: spawnPos.clone(), prevPos: spawnPos.clone(), vel, age: 0, trailMeshes: [] };

    const TRAIL_LENGTH = 5; // Numero di elementi nella scia
    for (let i = 0; i < TRAIL_LENGTH; i++) {
        const trailMaterial = this.ballMaterial.clone();
        trailMaterial.transparent = true;
        trailMaterial.opacity = 0; // L'opacità verrà impostata nell'update
        
        const trailMesh = new THREE.Mesh(ballGeo, trailMaterial);
        // Rendiamo ogni pezzo della scia progressivamente più piccolo
        trailMesh.scale.setScalar(0.8 - (i / TRAIL_LENGTH) * 0.5);
        this.scene.add(trailMesh);
        ball.trailMeshes.push(trailMesh);
    }


    this.scene.add(mesh);
    this.balls.push(ball);
    return ball;
  }
// frequency
  shoot() {
    if (this._shotCooldown > 0) return null;
    //limit the frequencyt
    this._shotCooldown = 0.08;
    
    if (this.containerBalls && this.containerBalls.length > 0) {
      
      this.group.remove(this.containerBalls.pop());
      this.onShoot();
  
      return this.createBall();
    }
    return null;
  }
  // limit barrell movement
  setPitch(rad) {
    const min = -0.3;
    const max = 1.6;
    this.pitchGroup.rotation.x = THREE.MathUtils.clamp(rad, min, max);
  }
  changePitch(delta) { this.setPitch(this.pitchGroup.rotation.x + delta); }
  // limit orientatin
   setYaw(rad) {
    const min = -0.5;
    const max = Math.PI / 2;
    this.yawGroup.rotation.y = THREE.MathUtils.clamp(rad, min, max);
  }
  changeYaw(delta) { this.setYaw(this.yawGroup.rotation.y - delta); }
  
  // change initial velcoty 
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
// check if the system is charging and if so, shoot with the charged speed
  endCharge() {
    if (!this._charging) return null;
    this._charging = false;
    // how compute the speed based on the charge level
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
    // check if we have to remove existing balls
    if (this.containerBalls?.length) {
      for (const m of this.containerBalls) this.group.remove(m);
    }
    // how create container and balls inside it 
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
    // balls positioning algorithm inside the container 
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
    // now create the meshes and add them to the group
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
  // add collider AABB Axis Aligned Bounding Box
  // releve a collision and push the ball outside the collider
  addCollider(aabb) { this.colliders.push(aabb); }
  clearColliders() { this.colliders = []; }

  collideSphereAABB(ball) {
    if (this.colliders.length === 0) return;
    const p = ball.pos; // center of the sphere
    const r = this.ballRadius;
    // loop to check collision with each collider inside the array created before
    for (const c of this.colliders) {
      // compute the closest point from the sphere center to the collider
      const closestPoint = new THREE.Vector3(
        THREE.MathUtils.clamp(p.x, c.min.x, c.max.x),
        THREE.MathUtils.clamp(p.y, c.min.y, c.max.y),
        THREE.MathUtils.clamp(p.z, c.min.z, c.max.z)
      );
        // compute the vector from the closest point to the sphere center
      const d = new THREE.Vector3().subVectors(p, closestPoint);
      // compute distance squared
      const distSq = d.lengthSq();
      // if the distance is less than the radius we have a collision
      // if the squared distance is smaller than the squared radius we have a collision 
      if (distSq < r * r) {
        // compute the effective distance 
        const dist = Math.sqrt(distSq);
        // compute the normal (if dist is zero we use an arbitrary normal)
        const normal = dist > 1e-6 ? d.clone().multiplyScalar(1 / dist) : new THREE.Vector3(0, 1, 0);
        // compute how much we have to push the sphere outside the AABB
        const penetration = r - dist;
        p.addScaledVector(normal, penetration + 1e-4);
// compute the velocity component along the normal with the scalar product 
        const velNormalComponent = ball.vel.dot(normal);
        // if the velocity is separating we do not have to apply an impulse
        // if it's already greater than 0 the ball is moving far from the collider 
        if (velNormalComponent > 0) {
            continue;
        }
          // compute the impulse vector to push the ball away from the xollider 
        const impulseVec = normal.clone().multiplyScalar(-(1 + this.restitution) * velNormalComponent);
        // compute the tangential velocity (velocity without the normal component)
        const tangentVel = ball.vel.clone().addScaledVector(normal, -velNormalComponent);
        tangentVel.multiplyScalar(this.groundFriction);
        ball.vel.copy(tangentVel).add(impulseVec);
      }
    }
  }
// spatial hashing for broadphase collision detection
// we divide the world in cubic cells of size h and we assign each ball to a cell based on its position
  _hashKey(p, h) {
    const x = Math.floor(p.x / h);
    const y = Math.floor(p.y / h);
    const z = Math.floor(p.z / h);
    return `${x},${y},${z}`;
  }

  _broadphasePairs() {
    // we use a map to store the balls in each cell
    // then we create pairs of balls for each cell
    // finally we return the list of pairs
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
    // ray-spaher and normal vector 
    const r = this.ballRadius;
    const n = new THREE.Vector3().subVectors(b.pos, a.pos);
    const dist2 = n.lengthSq();
    const minDist = 2 * r;
    if (dist2 >= minDist * minDist || dist2 === 0) return;
// compute the distance and normalize the normal vector between the two balls
    const dist = Math.sqrt(dist2);
    n.multiplyScalar(1 / dist);
    const penetration = minDist - dist;

    const corr = Math.max(penetration - 1e-4, 0) * 0.5;
    // the ball a is pushed back along the normal direction
    a.pos.addScaledVector(n, -corr);
    // the ball b is pushed forward along the normal direction
    b.pos.addScaledVector(n, corr);
    // compute the relative velocity
    const relVel = new THREE.Vector3().subVectors(b.vel, a.vel);
    const vn = relVel.dot(n);
    if (vn > 0) return;
    // compute impulse scalar considering the two balls have the same mass
    const e = this.restitution;
    const invM = 1 / this.ballMass;
    const jn = -(1 + e) * vn / (2 * invM);
    const impulse = n.clone().multiplyScalar(jn);
      // apply the impulse to the two balls
    a.vel.addScaledVector(impulse, -invM);
    b.vel.addScaledVector(impulse, invM);
  }

  update(deltaTime) {
    this.updatePhysics(deltaTime);
    this.updateMeshes(deltaTime);
  }

  updatePhysics(deltaTime) {
    this._shotCooldown = Math.max(0, this._shotCooldown - deltaTime);
// check if we are charging
    if (this._charging) {
      // increase the charge level with a value between 0 and 1 1 means fully charged 
      // we use chagerate and deltaTime to compute the charge level
      this._charge = Math.min(1, this._charge + this.chargeRate * deltaTime);
    }
  // update the movement of the machine based on the drive input
    const yawDelta = this.drive.turn * this.drive.turnRate * deltaTime;
    // rotation around the y axis
    this.group.rotation.y += yawDelta;
    // compute the target speed based on the drive input
    const targetSpeed = this.drive.forward * this.drive.maxSpeed;
    // compute how much we can change the speed in this frame
    const speedChange = this.acceleration * deltaTime;
    // damping towards the target speed
    this.currentSpeed = THREE.MathUtils.damp(this.currentSpeed, targetSpeed, speedChange, deltaTime);
    // move the machine forward based on its current speed and orientation
    const dirLocal = new THREE.Vector3(0, 0, 1).applyQuaternion(this.group.quaternion);
    this.group.position.addScaledVector(dirLocal, this.currentSpeed * deltaTime);

// limit the movement within the defined boundaries
    let clampedX = false;
    let clampedZ = false;
    // check the x limit
    if (this.group.position.x < this.minXLimit || this.group.position.x > this.maxXLimit) {
        this.group.position.x = THREE.MathUtils.clamp(this.group.position.x, this.minXLimit, this.maxXLimit);
        clampedX = true;
    }
    
    // check the z limit
    if (this.group.position.z < this.minZLimit || this.group.position.z > this.maxZLimit) {
        this.group.position.z = THREE.MathUtils.clamp(this.group.position.z, this.minZLimit, this.maxZLimit);
        clampedZ = true;
    }
    // if we are clamped in any direction and we are moving, stop the movement
    // not allow to slide along the walls
    if ((clampedX || clampedZ) && Math.abs(this.currentSpeed) > 0.01) {
        this.currentSpeed = 0;
    }

    
  // store position to create a trail effect
    for (const b of this.balls) {
      if (!b.prevPos) b.prevPos = b.pos.clone();
      else b.prevPos.copy(b.pos);
    }

    const steps = this.physicsSubsteps;
    const subDt = deltaTime / steps;
    for (let s = 0; s < steps; s++) {
      for (const ball of this.balls) {
        // apply gravity and air drag to the ball
        const gdt = this.gravity.clone().multiplyScalar(subDt);
        ball.vel.multiplyScalar(this.airDrag);
        ball.vel.add(gdt);
        // update the ball position based on its velocity
        ball.pos.addScaledVector(ball.vel, subDt);
      
        // check collision with the ground plane at y=0
        // if the ball is below the ground plane we have a collision
        // we push the ball back to y=radius and we invert its y velocity
        // we also apply ground friction to the x and z velocity

        const r = this.ballRadius;
        if (ball.pos.y < r) {
          // return ball to
          ball.pos.y = r;
          ball.vel.y = -ball.vel.y * this.restitution;
          ball.vel.x *= this.groundFriction;
          ball.vel.z *= this.groundFriction;
          // if the y velocity is very small we set it to zero to avoid bouncing forever
          if (Math.abs(ball.vel.y) < 0.25) ball.vel.y = 0;
          // if the ball is almost stopped on the ground we set its velocity to zero
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
    for (let i = this.balls.length - 1; i >= 0; i--) {
      const ball = this.balls[i];
      // function to update the age and position of the ball mesh
      ball.age += deltaTime;
      ball.mesh.position.copy(ball.pos);
      
      // create a trail effect using the previous positions
      if (ball.trailMeshes && ball.prevPos) {
        const trailLength = ball.trailMeshes.length;
        for (let j = 0; j < trailLength; j++) {
            const trailMesh = ball.trailMeshes[j];
            // compute the fraction of the trail length 
            const fraction = (j + 1) / (trailLength + 1);
            // interpolate the position between the current and previous position using the fraction
            trailMesh.position.lerpVectors(ball.prevPos, ball.pos, 1 - fraction);
            trailMesh.material.opacity = 0.4 * (1 - fraction);
            trailMesh.visible = ball.vel.lengthSq() > 2.0;
        }
      }
      
      // rotate the ball based on its velocity to simulate spin its only a visual effect not i
      if (ball.vel.lengthSq() > 1e-6) {
        const axis = ball.vel.clone().normalize();
        const angle = this.spinFactor * ball.vel.length() * deltaTime / this.ballRadius;
        ball.mesh.rotateOnWorldAxis(axis, angle);
      }
      // remove the ball if it goes out of bounds out the green fie
      const out =
        (ball.pos.y < this.bounds.yMin) ||
        (Math.abs(ball.pos.x) > this.bounds.x) ||
        (Math.abs(ball.pos.z) > this.bounds.z);

      if (out) {
        if (ball.trailMeshes) {
            ball.trailMeshes.forEach(tm => this.scene.remove(tm));
        }
        
        
        this.scene.remove(ball.mesh);
        this.balls.splice(i, 1);
      }
    }

    /*if (this.laserSight) {
      const { worldTip, worldDir } = this.getNozzleTipAndDir();
      const endPoint = new THREE.Vector3().addVectors(worldTip, worldDir.clone().multiplyScalar(50));
    
      const positions = this.laserSight.geometry.attributes.position;
      positions.setXYZ(0, worldTip.x, worldTip.y, worldTip.z);
      positions.setXYZ(1, endPoint.x, endPoint.y, endPoint.z);
      positions.needsUpdate = true;
    }*/
  }
// remove all balls from the scene and clear the array
  clearBalls() {
    this.balls.forEach(b => {
      if (b.trailMeshes) {
        b.trailMeshes.forEach(tm => this.scene.remove(tm));
      }
      this.scene.remove(b.mesh);
    });
    this.balls = [];
  }

  dispose() {
    this.clearBalls();
    if (this.ballMaterial) this.ballMaterial.dispose();
  }
}