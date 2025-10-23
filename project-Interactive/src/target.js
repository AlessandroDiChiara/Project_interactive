
import * as THREE from 'three';

//rotation matrix inverse
const _inv = new THREE.Matrix4();
// initial and final point of the segment in local space
const _p0L = new THREE.Vector3();
const _p1L = new THREE.Vector3();
// collision point in local and world space
const _hitL = new THREE.Vector3();
const _hitW = new THREE.Vector3();
// normal vector in global space
const _nW   = new THREE.Vector3();
const _tmp  = new THREE.Vector3();
// bounding box in local space
const _bbL  = new THREE.Box3();
// normal and tangential components of velocity
const _vn = new THREE.Vector3();
const _vt = new THREE.Vector3();
// ray in local space for AABB intersection test
const _localRay = new THREE.Ray();


export class TargetManager {
  constructor(scene, ballsArray, ballRadius, { onScore = () => {} } = {}) {
    this.scene = scene;
    this.balls = ballsArray;
    this.ballRadius = ballRadius;
    // fucntion to call when a target is hit
    this.onScore = onScore;
    // array of target objects
    this.targets = [];

    this.hitboxHelpers = [];
    this.ballRestitution = 0.6;
    this.targetRestitutionDefault = 0.55;
    // default tangential friction when not specified on the target
    this.tangentialFrictionDefault = 0.15;
    //parameters used to avoid ball sticking in the target
    this._pushOut = 1e-4;

  }
// function to create a texture for the target panels with given text
  createPanelTargetTexture(text) {
    const canvas = document.createElement('canvas');
    const size = 256; canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    // background: Rosso
    ctx.fillStyle = '#5745f8ff'; ctx.fillRect(0, 0, size, size); 
    // bounder: Giallo
    ctx.strokeStyle = '#f8f8f8ff'; ctx.lineWidth = size * 0.06; ctx.strokeRect(0, 0, size, size);
    // text: Bianco
    ctx.fillStyle = '#edf0f1ff'; ctx.font = `bold ${size * 0.5}px Impact`; 
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, size / 2, size / 2);
    return new THREE.CanvasTexture(canvas);
  }

  createAllTargets() {
    this.createArcheryTarget(new THREE.Vector3(0, 0, -15));
    this.createKnockDownTarget(new THREE.Vector3(-8, 0, -12));
    this.createMovingTarget(new THREE.Vector3(8, 0, -12));       
  }
// function to create a circular archery target
  createArcheryTarget(position) {
    const radius = 1.3; 
    const mainGroup = new THREE.Group();
    const centerPosition = position.clone();
    // Raise the target to be above the ground
    centerPosition.y = 5.0; 
    mainGroup.position.copy(centerPosition);
  
    this.scene.add(mainGroup);
    // Create the circular target mesh
   const targetGeometry = new THREE.CircleGeometry(radius, 64);
    const texture = this.createPanelTargetTexture("150");
    const frontMaterial = new THREE.MeshStandardMaterial({ 
        map: texture,
        side: THREE.FrontSide // Vede solo la faccia anteriore
    });
    // back material
    const backMaterial = frontMaterial.clone();
    const frontMesh = new THREE.Mesh(targetGeometry, frontMaterial);
    frontMesh.castShadow = true;
    frontMesh.receiveShadow = true;
    mainGroup.add(frontMesh);
    const backMesh = new THREE.Mesh(targetGeometry, backMaterial);
    backMesh.rotation.y = Math.PI; 
    backMesh.castShadow = true;
    backMesh.receiveShadow = true;
    mainGroup.add(backMesh);
    const hitZoneMesh = frontMesh;
   hitZoneMesh.userData.restitution = 0.8;
    hitZoneMesh.userData.friction = 0.4;
    mainGroup.add(hitZoneMesh);

    // pyshics properties
  
    // Add the target to the list with movement data
    this.targets.push({
      type: 'circular-moving',
      group: mainGroup, 
      hitZone: hitZoneMesh, 
      hitCooldown: 0,
      // data for circular motion initial position speed and radius
      moveData: { center: centerPosition, radius: 3.0, speed: 1.0, angle: 0 },
      onHit: function(ball, manager) {
        const hitZone = this.hitZone;
        const originalEmissive = hitZone.material.emissive.getHex();
        // flash the target green to indicate a hit 
        hitZone.material.emissive.set(0x00ff00); 
        hitZone.material.emissiveIntensity = 2.0;
        // reset the emissive color after a short delay
        setTimeout(() => { hitZone.material.emissive.setHex(originalEmissive); }, 150);
        const worldPos = new THREE.Vector3();
        // get the world position of the target center
        this.group.getWorldPosition(worldPos);
        worldPos.y += radius; 
        // show a score popup above the target
        manager.showScorePopup(worldPos, "+150", "#00ff00");
        manager.onScore(150);
      }
    });
    this.addHitboxHelper(hitZoneMesh);
  }
// create a knockdown target with a base and a panel that can be knocked down
  createKnockDownTarget(position) {
    // create the vertical panel 
    const size = { w: 2.2, h: 2.8, d: 0.1 }, baseHeight = 0.4;
    const panelMesh = new THREE.Mesh(
      new THREE.BoxGeometry(size.w, size.h, size.d),
      new THREE.MeshStandardMaterial({ map: this.createPanelTargetTexture("50") }).clone()
    );
    // position the panel above the base
    panelMesh.position.y = size.h / 2;
    panelMesh.castShadow = true;
    panelMesh.receiveShadow = true;
    panelMesh.userData.restitution = 0.3;
    panelMesh.userData.friction = 0.2;
    const pivotGroup = new THREE.Group();
    pivotGroup.position.y = baseHeight;
    pivotGroup.add(panelMesh);
// create the base of the target 
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(size.w / 1.7, size.w / 1.7, baseHeight, 24),
      new THREE.MeshStandardMaterial({ color: 0x495057 })
    );
    base.castShadow = true;
    base.receiveShadow = true;
    base.position.y = baseHeight / 2;
    base.userData.restitution = 0.4;
    base.userData.friction = 0.8;

    const mainGroup = new THREE.Group();
    mainGroup.position.copy(position);
    mainGroup.rotation.y = Math.PI;
    mainGroup.add(base, pivotGroup);
    this.scene.add(mainGroup);
// add the target to the list 
    this.targets.push({
      type: 'static_base',
      group: mainGroup,
      hitZone: base,
      hitCooldown: 0,
    });
    this.addHitboxHelper(base);
// add the knockdown panel as a separate target with its own hit logic
    this.targets.push({
      type: 'knockdown', 
      group: mainGroup, 
      pivot: pivotGroup, 
      hitZone: panelMesh, 
      hitCooldown: 0,
      onHit: function(ball, manager) {
     
        const hitZone = this.hitZone;
        // flash the panel yellow to indicate a hit
        const originalEmissive = hitZone.material.emissive.getHex();
        hitZone.material.emissive.set(0xffff00);
        hitZone.material.emissiveIntensity = 2.0;
        // reset the emissive color after a short delay
        setTimeout(() => { hitZone.material.emissive.setHex(originalEmissive); hitZone.material.emissiveIntensity = 0; }, 200);
        const targetCenterPos = new THREE.Vector3();
        // get the world position of the target center
        this.group.getWorldPosition(targetCenterPos);
        const popupPosition = targetCenterPos.clone();
        popupPosition.y += 2.5;
        // show a score popup above the target
        manager.showScorePopup(popupPosition, "+50", "#f5d415");
        manager.onScore(50);
      }
    });
    this.addHitboxHelper(panelMesh);
  }

  createMovingTarget(position) {
    // create a target on a pole that moves horizontally
    const size = { w: 2.5, h: 1.5, d: 0.1 }, poleHeight = 1.8;
    const mainGroup = new THREE.Group();
    mainGroup.position.copy(position);
    mainGroup.rotation.y = Math.PI;
    this.scene.add(mainGroup);
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, poleHeight, 16),
      new THREE.MeshStandardMaterial({ color: 0x6c757d })
    );
    pole.castShadow = true;
    pole.receiveShadow = true; 
    pole.position.y = poleHeight / 2;
    mainGroup.add(pole);
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(size.w, size.h, size.d),
      new THREE.MeshStandardMaterial({ map: this.createPanelTargetTexture("100") }).clone()
    );
    // position the target above the pole
    mesh.position.y = poleHeight + size.h / 2;
    mainGroup.add(mesh);
    mesh.castShadow = true;
    mesh.receiveShadow = true; 
    mesh.userData.restitution = 0.65;
    mesh.userData.friction = 0.12;
    // Add the target to the list with movement data
    this.targets.push({
      type: 'moving', 
      group: mainGroup, 
      hitZone: mesh, 
      hitCooldown: 0,
      // data for horizontal motion
      moveData: { speed: 2.5, range: 2.5, direction: 1, startX: position.x },
      onHit: function(ball, manager) {
        const hitZone = this.hitZone;
        const originalEmissive = hitZone.material.emissive.getHex();
        hitZone.material.emissive.set(0xd72828);
        hitZone.material.emissiveIntensity = 2.5;
        // reset the emissive color after a short delay
        setTimeout(() => { hitZone.material.emissive.setHex(originalEmissive); }, 150);
        const worldPos = new THREE.Vector3();
        hitZone.getWorldPosition(worldPos);
        // show a score popup above the target
        manager.showScorePopup(worldPos, "+100", "#FF8C00");
        manager.onScore(100);
        const startY = this.group.position.y;
        this.group.position.y = startY - 0.1;s
        setTimeout(() => (this.group.position.y = startY), 100);
      }
    });
    this.addHitboxHelper(mesh);
  }

  // function to show a score popup at a given position with specified text and color
  showScorePopup(position, text, color) {
    // create a canvas texture with the score text
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
    // create a sprite to display the texture
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false });
    const sprite = new THREE.Sprite(material);
    sprite.position.copy(position);
    sprite.scale.set(2.5, 1.25, 1);
    this.scene.add(sprite);
    const duration = 1200;
    const startTime = Date.now();
    const animateInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = elapsed / duration;
      // move the sprite upward and fade it out over time
      if (progress >= 1) {
        clearInterval(animateInterval);
        this.scene.remove(sprite);
        sprite.material.map.dispose();
        sprite.material.dispose();
      } else {
        // position on the target 
        sprite.position.y += 0.02;
        sprite.material.opacity = 1.0 - progress;
      }
    }, 16);
  }
// function to add a box helper to visualize the hitbox of a target mesh is not visible 
  addHitboxHelper(targetMesh) {
    const helper = new THREE.Box3Helper(new THREE.Box3(), 0xffff00);
    helper.visible = false;
    this.scene.add(helper);
    this.hitboxHelpers.push({mesh: targetMesh, helper: helper});
  }


  // functio to compute the ball velocity after the hit
  // we conider normal and tangential velocity
  // ball, normal vector, coeffficient friction 
  _bounceBall(ball, normalW, restitution, muTangential) {
    // compute the scalar product of velocity and normal, tis represent the ball velocity 
    const v_dot_n = ball.vel.dot(normalW);
    // normale component of velocity
    _vn.copy(normalW).multiplyScalar(v_dot_n);
    // tangential component of velocity
    _vt.copy(ball.vel).sub(_vn);
    //invert the normal velocity
    // apply restitution and friction
    _vn.multiplyScalar(-restitution);
    // reduce the tangential velocity 
    // compute friction factor to reduce tangential velocity
    const frictionFactor = Math.max(0, 1.0 - muTangential);
    // compute new velocity
    _vt.multiplyScalar(frictionFactor);
    ball.vel.copy(_vn).add(_vt);
  }
  
  //for each frame if the segment intersects the target's surface, the exact point of contact is found by using interpolation (t)
  //  and is used to calculate a realistic bounce velocity based on the target's physical properties
// function to check for segment-mesh intersection using plane approximation
    _segmentHitMeshPlane(hitZoneMesh, p0World, p1World, ballRadius) {
      // change the segment to local space of the mesh
      // local space is the space of the mesh itself
      // the target is centered in Z=0
    _inv.copy(hitZoneMesh.matrixWorld).invert();
    _p0L.copy(p0World).applyMatrix4(_inv);
    _p1L.copy(p1World).applyMatrix4(_inv);
// compute the bounding box of the mesh in local space
    const geom = hitZoneMesh.geometry;
    if (!geom.boundingBox) geom.computeBoundingBox();
    _bbL.copy(geom.boundingBox);
    // compute the distance from the center of the bounding box to its sides
    const halfX = (_bbL.max.x - _bbL.min.x) * 0.5;
    const halfY = (_bbL.max.y - _bbL.min.y) * 0.5;
    const halfZ = (_bbL.max.z - _bbL.min.z) * 0.5;
// z coordinate of the initial and final point 
    const z0 = _p0L.z, z1 = _p1L.z;
    // the ball hit the taget only if it crosses the plane of the mesh
    // define the boundary for the plane check considering the ball radius
    const thicknessEff = Math.max(halfZ + ballRadius, ballRadius);
    // chekc if the segment is gone through the plane of the mesh
    
    if ((z0 >  thicknessEff && z1 >  thicknessEff) ||
        (z0 < -thicknessEff && z1 < -thicknessEff)) {
      return null;
    }
// compuyte the intesection point with the plane of the mesh
    const dz = z1 - z0;
    if (Math.abs(dz) < 1e-9) { 
      return null; 
    }
// value where the segment intersects the plane z = 0 of the mesh t=0 intersecition at p0 t=1 intersection at p1
    const t = (0 - z0) / dz;
    if (t < 0 || t > 1) {
      return null;
    }
// final interpolation to find the specific contact point  
    _hitL.copy(_p0L).lerp(_p1L, t);
// check if the intersection point is within the bounds of the mesh plus the ball radius
    // for circular targets we check within a circle, for rectangular targets we check within a rectangle
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
// vector with all information about the hit point in world space, normal in world space and t value
    return { hitPointWorld: _hitW.clone(), hitNormalWorld: _nW.clone(), t: t };
  }
// rayca
  _segmentHitMeshAABB(hitZoneMesh, p0World, p1World, ballRadius) {
    const geom = hitZoneMesh.geometry;
    // compute the bounding box if not already computed
    if (!geom.boundingBox) geom.computeBoundingBox();

    const localAABB = geom.boundingBox.clone();
    localAABB.expandByScalar(ballRadius);
// compute the local space of the mesh
    _inv.copy(hitZoneMesh.matrixWorld).invert();
    _p0L.copy(p0World).applyMatrix4(_inv);
    _p1L.copy(p1World).applyMatrix4(_inv);
// vector from p0 to p1
    const segmentDirection = _tmp.subVectors(_p1L, _p0L);
    const segmentLengthSq = segmentDirection.lengthSq();
    // check if the segment has a valid length
    if (segmentLengthSq < 1e-9) return null;
// set up the ray in local space
//raycasting three.js
    _localRay.origin.copy(_p0L);
    _localRay.direction.copy(segmentDirection).normalize();
// check if the ray intersects the target 
    const hitPointLocal = new THREE.Vector3();
    //three.js method that verify if the segment intersect the object bounding box 
    const hit = _localRay.intersectBox(localAABB, hitPointLocal);
    // check if the collision is valid 
if (hit && _p0L.distanceToSquared(hitPointLocal) <= segmentLengthSq) {
      const hitNormalLocal = new THREE.Vector3();
      const boxCenter = new THREE.Vector3();
      localAABB.getCenter(boxCenter);
      const boxSize = new THREE.Vector3();
      localAABB.getSize(boxSize);
      // compute distances from the hit point to each face of the AABB
      const dists = {
          px: localAABB.max.x - hitPointLocal.x,
          nx: hitPointLocal.x - localAABB.min.x,
          py: localAABB.max.y - hitPointLocal.y,
          ny: hitPointLocal.y - localAABB.min.y,
          pz: localAABB.max.z - hitPointLocal.z,
          nz: hitPointLocal.z - localAABB.min.z,
      };
      
      let minDist = Infinity;
      
  
      const epsilon = 0.05; 
      // hit the top face
      if (dists.py < minDist) { 
        minDist = dists.py; 
        hitNormalLocal.set( 0, 1, 0);
      }
      // compute which face is the closest to the hit point
      if (dists.ny < minDist) { minDist = dists.ny; hitNormalLocal.set( 0, -1, 0); }
      if (dists.px < minDist) { minDist = dists.px; hitNormalLocal.set(-1, 0, 0); }
      if (dists.nx < minDist) { minDist = dists.nx; hitNormalLocal.set( 1, 0, 0); }
      if (dists.pz < minDist) { minDist = dists.pz; hitNormalLocal.set( 0, 0, -1); }
      if (dists.nz < minDist) { minDist = dists.nz; hitNormalLocal.set( 0, 0,  1); }
      
  
      const segmentDir = new THREE.Vector3().subVectors(_p1L, _p0L).normalize();
      // ensure the normal of the plane is facing against the segment direction
      if (hitNormalLocal.dot(segmentDir) > 0) {
          
          hitNormalLocal.negate();
      }
      
      
      hitNormalLocal.normalize();
    

      const hitPointWorld = hitPointLocal.clone().applyMatrix4(hitZoneMesh.matrixWorld);
      // normal in world space
      const hitNormalWorld = hitNormalLocal.clone().transformDirection(hitZoneMesh.matrixWorld);
      const t = Math.sqrt(_p0L.distanceToSquared(hitPointLocal) / segmentLengthSq);
      
      return { hitPointWorld, hitNormalWorld, t };
    }
    return null;
  }

  update(deltaTime) {
    this.targets.forEach(target => {
      target.hitCooldown = Math.max(0, target.hitCooldown - deltaTime);
      if (target.type === 'moving') {
        // horizontal back and forth motion
        const { group, moveData } = target;
        // update position based on speed and direction
        group.position.x += moveData.direction * moveData.speed * deltaTime;
        // check to change direction at the boundaries
        if (group.position.x > moveData.startX + moveData.range) {
          group.position.x = moveData.startX + moveData.range;
          moveData.direction = -1;
        } else if (group.position.x < moveData.startX - moveData.range) {
          group.position.x = moveData.startX - moveData.range;
          moveData.direction = 1;
        }
      } else if (target.type === 'circular-moving') {
        const { group, moveData } = target;
        moveData.angle += moveData.speed * deltaTime;
        // move in a circular path
        group.position.x = moveData.center.x + moveData.radius * Math.cos(moveData.angle);
        group.position.y = moveData.center.y + moveData.radius * Math.sin(moveData.angle);
      }
    });

    this.hitboxHelpers.forEach(item => {
      item.mesh.updateWorldMatrix(true, false);
      const targetBBoxWorld = new THREE.Box3().setFromObject(item.mesh);
      item.helper.box.copy(targetBBoxWorld);
    });
// check for collisions between balls and targets
    for (const ball of this.balls) {
      // skip balls that are not active or do not have position/velocity
      if (!ball?.pos || !ball?.prevPos || !ball?.vel) continue;
      // check each target for a possible hit
      for (const target of this.targets) {
        if (target.hitCooldown > 0) continue;

        let contact;
        // choose collision detection method based on target type
        if (target.type === 'static_base' ) { 
    contact = this._segmentHitMeshAABB(target.hitZone, ball.prevPos, ball.pos, this.ballRadius);
} else {
    contact = this._segmentHitMeshPlane(target.hitZone, ball.prevPos, ball.pos, this.ballRadius);
}

        if (contact) {
          // compute effective restitution and friction
          const eBall = this.ballRestitution;
          const eTarget = (typeof target.hitZone.userData?.restitution === 'number') ? target.hitZone.userData.restitution : this.targetRestitutionDefault;
          // effective restitution is the average of ball and target restitution
          const restitutionEff = Math.max(0, Math.min(1, (eBall + eTarget) * 0.5));
          // effective tangential friction
          const mu = (typeof target.hitZone.userData?.friction === 'number') ? target.hitZone.userData.friction : this.tangentialFrictionDefault;
          // compute the new ball velocity after the bounce
          this._bounceBall(ball, contact.hitNormalWorld, restitutionEff, mu);
          ball.pos.copy(contact.hitPointWorld).addScaledVector(ball.vel, this._pushOut);
          // set a short cooldown to avoid multiple hits in quick succession
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