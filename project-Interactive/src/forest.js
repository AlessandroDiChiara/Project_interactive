import * as THREE from 'three';



// trunk for each three
const TRUNK_H = 3;
const TRUNK_R = 0.15;
const trunkGeometry = new THREE.CylinderGeometry(TRUNK_R, TRUNK_R * 1.5, TRUNK_H, 6);
trunkGeometry.translate(0, TRUNK_H / 2, 0); // Base a Y=0
// material for each three and bush
const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.9 });
const crownMaterialDark = new THREE.MeshStandardMaterial({ color: 0x156540, roughness: 0.5 }); // Verde scuro (Alberi Tondi)
const crownMaterialPine = new THREE.MeshStandardMaterial({ color: 0x388E3C, roughness: 0.5 }); // Verde medio (Pini)
const bushMaterial = new THREE.MeshStandardMaterial({ color: 0x4CAF50, roughness: 0.7 }); // Verde brillante (Cespugli)


function createSphereCrownGeometry() {
    // crown for the threes
    const CROWN_R = 2.0; 
    const crown = new THREE.SphereGeometry(CROWN_R, 12, 12);
    crown.translate(0, TRUNK_H + CROWN_R, 0);
    return crown;
}

// sphere
const crownGeometryRound = createSphereCrownGeometry();
const CROWN_ROUND_EFFECTIVE_R = 2.0; 

// pine whit a cone
const PINE_CROWN_H = 8;
const PINE_CROWN_R = 2.5;
const crownGeometryPine = new THREE.ConeGeometry(PINE_CROWN_R, PINE_CROWN_H, 8);
crownGeometryPine.translate(0, TRUNK_H + PINE_CROWN_H / 2, 0);

// 3. bush 
const BUSH_R = 1.5;
const bushGeometry = new THREE.SphereGeometry(BUSH_R, 12, 12);
bushGeometry.translate(0, BUSH_R, 0); 
const BUSH_EFFECTIVE_R = 1.5;



// function to add the forest
export function addProceduralForest(scene, { groundSize, exclusionHalfW, exclusionHalfL, count = 600, minDist = 4.0 }) {
   // add a plane where we can add the thress and creatre the size
    const backgroundSize = groundSize * 2;
    const groundGeometry = new THREE.PlaneGeometry(backgroundSize, backgroundSize);
    const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x4CAF50, roughness: 0.8, metalness: 0.1 });
    const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.position.y = -0.01;
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    // create the  asset for each three
    const assetDefinitions = [
        // 40%
        { 
            name: "RoundTree",
            trunk: new THREE.InstancedMesh(trunkGeometry, trunkMaterial, count),
            crown: new THREE.InstancedMesh(crownGeometryRound, crownMaterialDark, count),
            ratio: 0.4, 
            minScale: 0.8, maxScale: 1.2,
            //radius to avoid collision
            effectiveRadius: CROWN_ROUND_EFFECTIVE_R,
        },
        //40%
        { 
            name: "PineTree",
            trunk: new THREE.InstancedMesh(trunkGeometry, trunkMaterial, count),
            crown: new THREE.InstancedMesh(crownGeometryPine, crownMaterialPine, count),
            ratio: 0.4, 
            minScale: 0.9, maxScale: 1.1,
            // radius to avoid collision
            effectiveRadius: PINE_CROWN_R, 
        },
        // 20%
        { 
            name: "Bush",
            bush: new THREE.InstancedMesh(bushGeometry, bushMaterial, count),
            ratio: 0.2, 
            minScale: 0.5, maxScale: 1.2,
            // radius to avoid collision
            effectiveRadius: BUSH_EFFECTIVE_R,
        }
    ];

    // add trunk crwon and bush to the scene
    assetDefinitions.forEach(def => {
        if (def.trunk) { 
            scene.add(def.trunk); scene.add(def.crown); 
            def.trunk.castShadow = def.trunk.receiveShadow = true; 
            def.crown.castShadow = def.crown.receiveShadow = true; 
        }
        if (def.bush) { 
            scene.add(def.bush); 
            def.bush.castShadow = def.bush.receiveShadow = true; 
        }
        def.currentCount = 0;
    });

    const totalTrees = Math.floor(count * assetDefinitions.filter(d => d.ratio).reduce((sum, d) => sum + d.ratio, 0));
    
    // 3. 
    const matrix = new THREE.Matrix4();
    const dummy = new THREE.Object3D(); 
    // max trial
    const MAX_ATTEMPTS = 100;
    let addedCount = 0;
    
    const placedAssets = []; 
    // loop to save the asset and de raidus 
for (let i = 0; i < totalTrees && addedCount < totalTrees; i++) {
    let x, z, attempts = 0;
    let isValidPosition = false;
    
    // choose the asset type
    const rand = Math.random();
    let cumulativeRatio = 0;
    let assetDef = null;

    for (const def of assetDefinitions) {
        cumulativeRatio += def.ratio;
        if (rand <= cumulativeRatio) {
            assetDef = def;
            break;
        }
    }
    if (!assetDef) continue;

    // compute the dimension of each object 
    const scaleFactor = assetDef.minScale + Math.random() * (assetDef.maxScale - assetDef.minScale);
    const minAssetDist = assetDef.effectiveRadius; 
    const scaledMinAssetRadius = minAssetDist * scaleFactor;

    while (!isValidPosition && attempts < MAX_ATTEMPTS) {
        attempts++;
        
        // loop to place the assets in a uniform way
        if (attempts > MAX_ATTEMPTS / 2 && placedAssets.length > 0 && Math.random() < 0.7) { 
            const placed = placedAssets[Math.floor(Math.random() * placedAssets.length)];
            const angle = Math.random() * Math.PI * 2;
            // distance to avoid overlap between assets
            const distance = (0.5 + Math.random() * 1.5) * scaledMinAssetRadius;
            x = placed.x + Math.cos(angle) * distance;
            z = placed.z + Math.sin(angle) * distance;

        
            if (x * x + z * z > (groundSize * groundSize * 1.1)) continue; 
            // random positionig
        } else {
          
            const angle = Math.random() * Math.PI * 2;
            const radius = Math.sqrt(Math.random()) * groundSize; 
            x = Math.cos(angle) * radius;
            z = Math.sin(angle) * radius;
        }

        // check position outside the central field
        let isInsideExclusion = (x >= -exclusionHalfW && x <= exclusionHalfW && z >= -exclusionHalfL && z <= exclusionHalfL);
        if (isInsideExclusion) continue;

        // check the radius 
        let isTooClose = false;
        for (const placed of placedAssets) {
            const distanceSq = (x - placed.x) * (x - placed.x) + (z - placed.z) * (z - placed.z);
            
            // minimum distance 
            const requiredMinDist = (scaledMinAssetRadius + placed.radius); 

            if (distanceSq < requiredMinDist * requiredMinDist) {
                isTooClose = true;
                break;
            }
        }
        if (isTooClose) continue;

        isValidPosition = true;
    }
// when find a valid position 
    if (isValidPosition) {
        // final dimensin of the assets in the scene
        dummy.scale.set(scaleFactor, scaleFactor, scaleFactor);
        dummy.rotation.y = Math.random() * Math.PI * 2; 
        // place the three in position y=0
        dummy.position.set(x, 0, z);

        dummy.updateMatrix();
        const instanceIndex = assetDef.currentCount;
        
        if (assetDef.trunk) {
            // transformation matric posiyion rotation scale 
            // we use transformtion matrix to speed up the process instaed of create each mesh
            assetDef.trunk.setMatrixAt(instanceIndex, dummy.matrix);
            assetDef.crown.setMatrixAt(instanceIndex, dummy.matrix);
        } else if (assetDef.bush) {
            assetDef.bush.setMatrixAt(instanceIndex, dummy.matrix);
        }

        assetDef.currentCount++;
        addedCount++;
        
       
        placedAssets.push({
            x: x,
            z: z,
            radius: scaledMinAssetRadius 
        });
    }
}

// update the counter and collision 
    assetDefinitions.forEach(def => {
        if (def.trunk) {
            def.trunk.count = def.currentCount; def.crown.count = def.currentCount;
            def.trunk.instanceMatrix.needsUpdate = true; def.crown.instanceMatrix.needsUpdate = true;
        }
        if (def.bush) {
            def.bush.count = def.currentCount;
            def.bush.instanceMatrix.needsUpdate = true;
        }
    });
}