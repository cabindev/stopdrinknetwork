// app/farewell/journey/three/buildCoffin.ts
// หีบศพสีขาวลายทอง ขนาดตามไฟล์ Blender model/white_thai_coffin.blend
// แปลงแกน: three(x, y, z) = blender(x, z, -y) ด้านยาวอยู่บนแกน X
// ต่างจาก Blender: ตัวหีบสร้างให้กลวง เพราะฉากแรกต้องเห็นว่าข้างในว่าง
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { JourneyTextures } from './textures';

/** ความสูงพื้นถาดรถเข็น หีบวางบนนี้ */
export const CART_HEIGHT = 0.32;
/** ฐานฝา (Lid | lower cornice) ใน Blender อยู่ที่ 0.542 */
const LID_BASE = 0.542;
const HALF_W = 0.325;

export interface CoffinParts {
  /** หมุนและเลื่อนทั้งชุด (หีบ + รถเข็น) */
  group: THREE.Group;
  /** บานพับฝาที่ขอบหลังด้านบน หมุนรอบแกน X */
  lidHinge: THREE.Group;
}

function linear(r: number, g: number, b: number) {
  return new THREE.Color().setRGB(r, g, b, THREE.LinearSRGBColorSpace);
}

/** กล่องขอบมนแบบย้ายตำแหน่งแล้ว เอาไว้รวมเป็น mesh เดียว */
function rbox(w: number, h: number, d: number, x: number, y: number, z: number, radius = 0.004) {
  const r = Math.min(radius, w / 2.01, h / 2.01, d / 2.01);
  const geo = new RoundedBoxGeometry(w, h, d, 2, r);
  geo.translate(x, y, z);
  return geo;
}

function box(w: number, h: number, d: number, x: number, y: number, z: number) {
  const geo = new THREE.BoxGeometry(w, h, d);
  geo.translate(x, y, z);
  return geo;
}

/** วงเส้นทองรอบชิ้นสี่เหลี่ยม ที่ความสูง y */
function goldRing(w: number, d: number, y: number, size = 0.006) {
  return [
    box(w + 0.004, size, 0.004, 0, y, d / 2 + 0.001),
    box(w + 0.004, size, 0.004, 0, y, -d / 2 - 0.001),
    box(0.004, size, d + 0.004, w / 2 + 0.001, y, 0),
    box(0.004, size, d + 0.004, -w / 2 - 0.001, y, 0),
  ];
}

export function buildCoffin(tex: JourneyTextures): CoffinParts {
  const white = new THREE.MeshStandardMaterial({ color: linear(0.88, 0.9, 0.92), roughness: 0.32 });
  const gold = new THREE.MeshStandardMaterial({ color: linear(0.65, 0.43, 0.12), metalness: 0.75, roughness: 0.27 });
  const satin = new THREE.MeshStandardMaterial({ color: '#efe7da', roughness: 0.92 });
  const steel = new THREE.MeshStandardMaterial({ color: '#1e1e1e', metalness: 0.6, roughness: 0.55 });
  const rubber = new THREE.MeshStandardMaterial({ color: '#111', roughness: 0.8 });

  const group = new THREE.Group();
  group.name = 'coffin+cart';

  const coffin = new THREE.Group();
  coffin.position.y = CART_HEIGHT;
  group.add(coffin);

  // ---------- ชิ้นสีขาวทั้งหมด รวมเป็น mesh เดียว ----------
  const whites: THREE.BufferGeometry[] = [
    // ฐานขั้นบันได 3 ชั้น
    rbox(2.05, 0.03, 0.65, 0, 0.015, 0),
    rbox(2.025, 0.024, 0.63, 0, 0.042, 0),
    rbox(2.005, 0.026, 0.61, 0, 0.067, 0),
  ];
  // กรอบนูนของแผงลายด้านยาว
  for (const z of [-0.3, 0.3]) {
    for (const x of [-0.985, 0.985]) whites.push(rbox(0.022, 0.47, 0.015, x, 0.317, z, 0.003));
    for (const y of [0.085, 0.547]) whites.push(rbox(1.99, 0.012, 0.015, 0, y, z, 0.003));
  }
  // กรอบนูนด้านหัวท้าย
  for (const x of [-0.998, 0.998]) {
    for (const z of [-0.26, 0.26]) whites.push(rbox(0.01, 0.426, 0.018, x, 0.316, z, 0.003));
    for (const y of [0.106, 0.526]) whites.push(rbox(0.01, 0.018, 0.537, x, y, 0, 0.003));
  }
  const whiteMesh = new THREE.Mesh(mergeGeometries(whites), white);
  coffin.add(whiteMesh);

  // ---------- เส้นทอง ----------
  const golds: THREE.BufferGeometry[] = [
    ...goldRing(2.05, 0.65, 0.03),
    ...goldRing(2.025, 0.63, 0.054),
    ...goldRing(2.005, 0.61, 0.08),
  ];
  for (const x of [-1.004, 1.004]) {
    for (const z of [-0.244, 0.244]) golds.push(box(0.002, 0.395, 0.003, x, 0.316, z));
    for (const y of [0.119, 0.513]) golds.push(box(0.002, 0.003, 0.489, x, y, 0));
  }
  coffin.add(new THREE.Mesh(mergeGeometries(golds), gold));

  // ---------- ตัวหีบกลวง (ผนังมีผิวนอกขาว ผิวในผ้าบุ) ----------
  // ลำดับวัสดุของ BoxGeometry: +x, -x, +y, -y, +z, -z
  const wallH = 0.48;
  const wallY = 0.315;
  const t = 0.03;
  const longWall = (z: number) => {
    const inner = z > 0 ? 5 : 4;
    const mats = Array.from({ length: 6 }, (_, i) => (i === inner ? satin : white));
    const m = new THREE.Mesh(new THREE.BoxGeometry(1.99, wallH, t), mats);
    m.position.set(0, wallY, z);
    return m;
  };
  const endWall = (x: number) => {
    const inner = x > 0 ? 1 : 0;
    const mats = Array.from({ length: 6 }, (_, i) => (i === inner ? satin : white));
    const m = new THREE.Mesh(new THREE.BoxGeometry(t, wallH, 0.59 - 2 * t), mats);
    m.position.set(x, wallY, 0);
    return m;
  };
  coffin.add(longWall(0.295 - t / 2), longWall(-0.295 + t / 2), endWall(0.995 - t / 2), endWall(-0.995 + t / 2));
  const floor = new THREE.Mesh(new THREE.BoxGeometry(1.99 - 2 * t, 0.02, 0.59 - 2 * t), satin);
  floor.position.y = 0.11;
  coffin.add(floor);

  // ---------- แผงลายทองด้านยาว ----------
  // ทองสะท้อนแสงได้เพราะ metalnessMap แยกทองออกจากพื้นขาว
  const panelMat = new THREE.MeshStandardMaterial({
    map: tex.coffinSide,
    roughnessMap: tex.coffinSideOrm,
    metalnessMap: tex.coffinSideOrm,
    roughness: 1,
    metalness: 1,
  });
  const panelGeo = new THREE.PlaneGeometry(1.93, 0.451);
  const front = new THREE.Mesh(panelGeo, panelMat);
  front.position.set(0, 0.3165, 0.2955);
  const back = new THREE.Mesh(panelGeo, panelMat);
  back.position.set(0, 0.3165, -0.2955);
  back.rotation.y = Math.PI;
  coffin.add(front, back);

  // ---------- เทพพนมที่ปลาย +X ด้านเดียว (ตาม Blender) ----------
  const figure = new THREE.Mesh(
    new THREE.PlaneGeometry(0.29, 0.324),
    new THREE.MeshStandardMaterial({
      map: tex.figure,
      alphaMap: tex.figureAlpha,
      alphaTest: 0.5,
      roughnessMap: tex.figureOrm,
      metalnessMap: tex.figureOrm,
      roughness: 1,
      metalness: 1,
    }),
  );
  figure.position.set(1.0, 0.316, 0);
  figure.rotation.y = Math.PI / 2;
  coffin.add(figure);

  // ---------- ฝา: บานพับที่ขอบหลังด้านบน ----------
  const lidHinge = new THREE.Group();
  lidHinge.position.set(0, LID_BASE, -HALF_W);
  const lidWhite = [
    rbox(2.025, 0.022, 0.63, 0, 0.011, HALF_W),
    rbox(2.05, 0.024, 0.65, 0, 0.034, HALF_W),
    rbox(2.01, 0.016, 0.61, 0, 0.05, HALF_W),
  ];
  lidHinge.add(new THREE.Mesh(mergeGeometries(lidWhite), white));
  const lidGold = goldRing(2.05, 0.65, 0.045, 0.005).map((g) => g.translate(0, 0, HALF_W));
  lidHinge.add(new THREE.Mesh(mergeGeometries(lidGold), gold));
  coffin.add(lidHinge);

  // ---------- รถเข็นเหล็ก (ref 04) ล้ออยู่บนรางที่ห่างกัน 0.62 ----------
  const cartParts = [
    box(2.2, 0.03, 0.72, 0, CART_HEIGHT - 0.03, 0), // พื้นถาด
    box(2.2, 0.06, 0.03, 0, CART_HEIGHT - 0.03, 0.345),
    box(2.2, 0.06, 0.03, 0, CART_HEIGHT - 0.03, -0.345),
    box(0.03, 0.06, 0.72, 1.085, CART_HEIGHT - 0.03, 0),
    box(0.03, 0.06, 0.72, -1.085, CART_HEIGHT - 0.03, 0),
    box(1.9, 0.05, 0.05, 0, 0.16, 0.31), // คานล่าง
    box(1.9, 0.05, 0.05, 0, 0.16, -0.31),
  ];
  for (const x of [-0.85, 0.85]) for (const z of [-0.31, 0.31]) cartParts.push(box(0.05, 0.16, 0.05, x, 0.2, z));
  group.add(new THREE.Mesh(mergeGeometries(cartParts), steel));
  const wheelGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.04, 20);
  wheelGeo.rotateX(Math.PI / 2);
  const wheels: THREE.BufferGeometry[] = [];
  for (const x of [-0.85, 0.85]) for (const z of [-0.31, 0.31]) wheels.push(wheelGeo.clone().translate(x, 0.07, z));
  group.add(new THREE.Mesh(mergeGeometries(wheels), rubber));
  wheelGeo.dispose();

  // เงาใต้รถเข็น
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(2.9, 1.3),
    new THREE.MeshBasicMaterial({ map: tex.shadow, transparent: true, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.004;
  shadow.renderOrder = 1;
  group.add(shadow);

  whites.forEach((g) => g.dispose());
  golds.forEach((g) => g.dispose());
  lidWhite.forEach((g) => g.dispose());
  lidGold.forEach((g) => g.dispose());
  cartParts.forEach((g) => g.dispose());
  wheels.forEach((g) => g.dispose());

  return { group, lidHinge };
}
