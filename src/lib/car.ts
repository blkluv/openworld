import * as THREE from 'three';

/**
 * Builds a small low-poly car sized in METRES, centred at the origin with its
 * wheels on the ground plane (y... actually z=0, the model is Z-up to match
 * mercator world space) and facing +Y in local space. The avatar layer rotates
 * the group around the vertical (Z) axis to steer, and spins the wheels.
 */
export function buildCar(): THREE.Group {
  const car = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xff5a36, roughness: 0.35, metalness: 0.4 });
  const cabinMat = new THREE.MeshStandardMaterial({ color: 0xe8edf2, roughness: 0.4, metalness: 0.2 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x1c2530, roughness: 0.15, metalness: 0.6 });
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x111418, roughness: 0.9 });
  const hubMat = new THREE.MeshStandardMaterial({ color: 0xcfd6dd, roughness: 0.3, metalness: 0.7 });
  const lightF = new THREE.MeshStandardMaterial({ color: 0xfff4c2, emissive: 0xfff0b0, emissiveIntensity: 0.6 });
  const lightR = new THREE.MeshStandardMaterial({ color: 0xff2a2a, emissive: 0xff0000, emissiveIntensity: 0.5 });

  const LEN = 4.2; // along +Y (travel)
  const WID = 1.9; // along X
  const wheelR = 0.36;

  // Lower body — slightly inset from the wheels, sitting just above ground.
  const lower = new THREE.Mesh(new THREE.BoxGeometry(WID, LEN, 0.7), bodyMat);
  lower.position.set(0, 0, wheelR + 0.15);
  car.add(lower);

  // Bonnet/boot taper: a thinner top slab.
  const hood = new THREE.Mesh(new THREE.BoxGeometry(WID - 0.15, LEN - 0.4, 0.25), bodyMat);
  hood.position.set(0, 0, wheelR + 0.55);
  car.add(hood);

  // Cabin (greenhouse), pushed slightly back from centre.
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(WID - 0.35, LEN * 0.42, 0.55), cabinMat);
  cabin.position.set(0, -0.15, wheelR + 0.85);
  car.add(cabin);

  // Windows wrapping the cabin.
  const windows = new THREE.Mesh(new THREE.BoxGeometry(WID - 0.3, LEN * 0.42 - 0.05, 0.4), glassMat);
  windows.position.set(0, -0.15, wheelR + 0.88);
  car.add(windows);

  // Lights.
  const headL = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.12, 0.18), lightF);
  headL.position.set(WID / 2 - 0.35, LEN / 2 - 0.02, wheelR + 0.2);
  const headR = headL.clone();
  headR.position.x = -(WID / 2 - 0.35);
  car.add(headL, headR);

  const tailL = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.1, 0.16), lightR);
  tailL.position.set(WID / 2 - 0.35, -(LEN / 2 - 0.02), wheelR + 0.25);
  const tailR = tailL.clone();
  tailR.position.x = -(WID / 2 - 0.35);
  car.add(tailL, tailR);

  // Wheels: cylinder oriented with its axle along X. Each lives in a group so
  // the avatar layer can spin the group about X to roll it forward.
  const wheelGeo = new THREE.CylinderGeometry(wheelR, wheelR, 0.28, 16);
  const hubGeo = new THREE.CylinderGeometry(wheelR * 0.45, wheelR * 0.45, 0.3, 10);
  const offX = WID / 2 - 0.05;
  const offY = LEN / 2 - 0.95;
  for (const [sx, sy] of [
    [1, 1],
    [-1, 1],
    [1, -1],
    [-1, -1],
  ] as const) {
    const wheel = new THREE.Group();
    wheel.name = 'wheel';
    const tire = new THREE.Mesh(wheelGeo, tireMat);
    tire.rotation.z = Math.PI / 2; // axle along X
    const hub = new THREE.Mesh(hubGeo, hubMat);
    hub.rotation.z = Math.PI / 2;
    wheel.add(tire, hub);
    wheel.position.set(sx * offX, sy * offY, wheelR);
    car.add(wheel);
  }

  car.traverse((o) => {
    o.castShadow = true;
    o.receiveShadow = true;
  });

  return car;
}
