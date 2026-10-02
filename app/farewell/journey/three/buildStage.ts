// app/farewell/journey/three/buildStage.ts
// พื้นกระเบื้อง แท่นหมุนใต้หีบ รางเหล็กคู่วิ่งเข้าเตา (ref 07) และแสง
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { JourneyTextures } from './textures';
import { FURNACE_Z } from './buildFurnace';

export interface StageParts {
  group: THREE.Group;
  hemi: THREE.HemisphereLight;
  key: THREE.DirectionalLight;
  rim: THREE.DirectionalLight;
}

/** รางห่างกัน 0.62 ตรงกับล้อรถเข็น */
const RAIL_X = 0.31;

export function buildStage(tex: JourneyTextures): StageParts {
  const group = new THREE.Group();

  const size = 30;
  tex.floor.repeat.set(size / 2.4, size / 2.4);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshStandardMaterial({ map: tex.floor, roughness: 0.85 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.z = -4;
  floor.receiveShadow = true;
  group.add(floor);

  // รางเหล็กฝังในร่องพื้นจากแท่นหมุนเข้าไปในเตา
  const start = -0.9;
  const end = FURNACE_Z - 2.8;
  const len = start - end;
  const mid = (start + end) / 2;
  const groove = new THREE.Mesh(
    mergeGeometries([
      new THREE.BoxGeometry(0.12, 0.004, len).translate(RAIL_X, 0.002, mid),
      new THREE.BoxGeometry(0.12, 0.004, len).translate(-RAIL_X, 0.002, mid),
    ]),
    new THREE.MeshStandardMaterial({ color: '#1f1c19', roughness: 1 }),
  );
  const rails = new THREE.Mesh(
    mergeGeometries([
      new THREE.BoxGeometry(0.04, 0.012, len).translate(RAIL_X, 0.006, mid),
      new THREE.BoxGeometry(0.04, 0.012, len).translate(-RAIL_X, 0.006, mid),
    ]),
    new THREE.MeshStandardMaterial({ color: '#3c3934', metalness: 0.8, roughness: 0.4 }),
  );
  group.add(groove, rails);

  const hemi = new THREE.HemisphereLight('#c4d5e3', '#302720', 0.45);
  const key = new THREE.DirectionalLight('#ffe0ac', 3.5);
  key.position.set(-3.5, 4.5, 2.5);
  const rim = new THREE.DirectionalLight('#a6cce8', 2.4);
  rim.position.set(3, 3, -5);
  rim.target.position.set(0, 0.8, -1.5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -4;
  key.shadow.camera.right = 4;
  key.shadow.camera.top = 4;
  key.shadow.camera.bottom = -7;
  key.shadow.camera.far = 20;
  key.shadow.normalBias = 0.025;
  key.shadow.bias = -0.0002;
  key.shadow.radius = 4;
  group.add(hemi, key, rim, rim.target);

  return { group, hemi, key, rim };
}
