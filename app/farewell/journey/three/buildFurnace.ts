// app/farewell/journey/three/buildFurnace.ts
// เตาเผา (เมรุ) ตามรูปอ้างอิง civicspace/docs/last-journey/ref/04–07
// หน้าประตูอยู่ที่ z = FURNACE_Z หันหน้าไป +Z บานพับอยู่ขวา เปิดออกมาทางขวา
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { JourneyTextures } from './textures';

export const FURNACE_Z = -4;

const OPEN_W = 0.92;
const OPEN_H = 1.55;
const DOOR_W = 0.98;
const DOOR_H = 1.6;
const WALL_W = 16;
const WALL_H = 4;
const WALL_D = 0.5;
const TUNNEL_D = 2.9;

export interface FurnaceParts {
  group: THREE.Group;
  /** บานพับขวา หมุนรอบแกน Y */
  doorHinge: THREE.Group;
  /** กลอนฝั่งซ้าย เลื่อนตามแกน X ตอนล็อก */
  latches: THREE.Group;
  /** วัสดุเรืองแสงของช่องมอง (ใช้ร่วมกันทั้งด้านนอกและด้านใน) */
  peephole: THREE.MeshStandardMaterial;
  interiorLight: THREE.PointLight;
  /** ไฟในเตาหลังปิดประตู = แสงลอดขอบบาน + ช่องมอง (peephole) เท่านั้น — ผู้ใช้ไม่เอาประกายไฟลอย/แสงสาดพื้น (3 ต.ค. 2026) */
  fire: {
    seam: THREE.MeshBasicMaterial; // แสงลอดขอบประตู (texture ซุ้มเบลอขอบ)
  };
}

/** เส้นรอบช่องโค้งบน: ด้านล่างตรง ด้านบนครึ่งวงกลม */
function archPath(path: THREE.Path, w: number, h: number, x0 = 0, y0 = 0) {
  const r = w / 2;
  path.moveTo(x0 - r, y0);
  path.lineTo(x0 + r, y0);
  path.lineTo(x0 + r, y0 + h - r);
  path.absarc(x0, y0 + h - r, r, 0, Math.PI, false);
  path.lineTo(x0 - r, y0);
  return path;
}

function archShape(w: number, h: number, x0 = 0, y0 = 0) {
  return archPath(new THREE.Shape(), w, h, x0, y0) as THREE.Shape;
}

/** แหวนโค้ง (กรอบประตู) ระหว่างช่องในกับช่องนอก */
function archRing(innerW: number, innerH: number, band: number, depth: number) {
  const outer = archShape(innerW + band * 2, innerH + band, 0, -0.001);
  outer.holes.push(archPath(new THREE.Path(), innerW, innerH, 0, -0.002));
  return new THREE.ExtrudeGeometry(outer, { depth, bevelEnabled: false, curveSegments: 24 });
}

function box(w: number, h: number, d: number, x: number, y: number, z: number) {
  const geo = new THREE.BoxGeometry(w, h, d);
  geo.translate(x, y, z);
  return geo;
}

export function buildFurnace(tex: JourneyTextures): FurnaceParts {
  const group = new THREE.Group();
  group.position.z = FURNACE_Z;

  const darkSteel = new THREE.MeshStandardMaterial({ color: '#2b2826', metalness: 0.55, roughness: 0.7 });
  const paleSteel = new THREE.MeshStandardMaterial({ color: '#b9b6ae', metalness: 0.35, roughness: 0.75 });
  const brass = new THREE.MeshStandardMaterial({ color: '#8a6a3a', metalness: 0.8, roughness: 0.45 });
  const iron = new THREE.MeshStandardMaterial({ color: '#5d5b57', metalness: 0.7, roughness: 0.55 });

  // ---------- ผนังปูนมีช่องโค้ง ----------
  const wallShape = new THREE.Shape();
  wallShape.moveTo(-WALL_W / 2, -0.05);
  wallShape.lineTo(WALL_W / 2, -0.05);
  wallShape.lineTo(WALL_W / 2, WALL_H - 0.05);
  wallShape.lineTo(-WALL_W / 2, WALL_H - 0.05);
  wallShape.lineTo(-WALL_W / 2, -0.05);
  wallShape.holes.push(archPath(new THREE.Path(), OPEN_W + 0.28, OPEN_H + 0.14, 0, -0.06));
  const wallGeo = new THREE.ExtrudeGeometry(wallShape, { depth: WALL_D, bevelEnabled: false, curveSegments: 24 });
  // UV ของ ExtrudeGeometry เป็นพิกัดเมตร: แปลงเป็น 0–1 ให้ตรงกับ texture ผนัง 8×4 ม.
  tex.plaster.repeat.set(1 / WALL_W, 1 / WALL_H);
  tex.plaster.offset.set(0.5, 0.05 / WALL_H);
  const wall = new THREE.Mesh(wallGeo, new THREE.MeshStandardMaterial({ map: tex.plaster, roughness: 0.95 }));
  wall.position.z = -WALL_D;
  group.add(wall);

  // ---------- กรอบประตู (ref 06): แถบเหล็กไหม้ + แผ่นเหล็กหม่นรอบนอก ----------
  const innerFrame = new THREE.Mesh(archRing(OPEN_W, OPEN_H, 0.08, 0.05), darkSteel);
  innerFrame.position.z = -0.01;
  const outerFrame = new THREE.Mesh(archRing(OPEN_W + 0.16, OPEN_H + 0.08, 0.06, 0.03), paleSteel);
  outerFrame.position.z = -0.01;
  group.add(innerFrame, outerFrame);

  // หมุดตามกรอบนอก + ขอรับกลอนทองเหลืองฝั่งซ้าย
  const rivets: THREE.BufferGeometry[] = [];
  const rivet = new THREE.SphereGeometry(0.012, 8, 6);
  const rr = (OPEN_W + 0.16) / 2 + 0.03;
  const cy = OPEN_H + 0.08 - (OPEN_W + 0.16) / 2;
  for (let i = 0; i <= 10; i++) {
    const a = (Math.PI * i) / 10;
    rivets.push(rivet.clone().translate(Math.cos(a) * rr, cy + Math.sin(a) * rr, 0.025));
  }
  for (let y = 0.15; y < cy; y += 0.25) {
    rivets.push(rivet.clone().translate(rr, y, 0.025), rivet.clone().translate(-rr, y, 0.025));
  }
  group.add(new THREE.Mesh(mergeGeometries(rivets), iron));
  rivets.forEach((g) => g.dispose());
  rivet.dispose();
  const receivers = [0.3, 0.65, 1.0, 1.25].map((y) => box(0.05, 0.06, 0.05, -OPEN_W / 2 - 0.13, y, 0.03));
  group.add(new THREE.Mesh(mergeGeometries(receivers), brass));
  receivers.forEach((g) => g.dispose());

  // ---------- อุโมงค์อิฐด้านใน ----------
  tex.brick.repeat.set(1.6, 1.6);
  const brickMat = new THREE.MeshStandardMaterial({ map: tex.brick, roughness: 0.95 });
  const tunnel = new THREE.Mesh(archRing(OPEN_W + 0.1, OPEN_H + 0.05, 0.25, TUNNEL_D - WALL_D), brickMat);
  tunnel.position.z = -TUNNEL_D;
  group.add(tunnel);
  const backWall = new THREE.Mesh(new THREE.ShapeGeometry(archShape(OPEN_W + 0.1, OPEN_H + 0.05), 24), brickMat);
  backWall.position.z = -TUNNEL_D + 0.001;
  group.add(backWall);
  const hearth = new THREE.Mesh(
    new THREE.PlaneGeometry(OPEN_W + 0.1, TUNNEL_D),
    new THREE.MeshStandardMaterial({ color: '#1d1a17', roughness: 1 }),
  );
  hearth.rotation.x = -Math.PI / 2;
  hearth.position.set(0, 0.003, -TUNNEL_D / 2);
  group.add(hearth);

  const interiorLight = new THREE.PointLight('#ff8a3d', 0, 3.6, 2);
  interiorLight.position.set(0, 1.0, -1.8);
  group.add(interiorLight);

  // ---------- ประตู ----------
  const doorHinge = new THREE.Group();
  doorHinge.position.set(DOOR_W / 2, 0.01, 0.045);
  group.add(doorHinge);

  // แผ่นประตูวาดโดยให้ขอบขวาอยู่ที่ x = 0 (แกนบานพับ)
  const doorShape = archShape(DOOR_W, DOOR_H, -DOOR_W / 2, 0);
  tex.steel.repeat.set(1 / DOOR_W, 1 / DOOR_H);
  tex.steel.offset.set(1, 0);
  const doorPlate = new THREE.Mesh(new THREE.ExtrudeGeometry(doorShape, { depth: 0.06, bevelEnabled: false, curveSegments: 24 }), [
    new THREE.MeshStandardMaterial({ map: tex.steel, metalness: 0.6, roughness: 0.65 }),
    darkSteel,
  ]);
  doorHinge.add(doorPlate);

  // ด้านในบาน: แผ่นทนไฟ (เห็นตอนเปิด ref 06)
  const innerShape = archShape(DOOR_W - 0.08, DOOR_H - 0.06, -DOOR_W / 2, 0.03);
  const innerGeo = new THREE.ShapeGeometry(innerShape, 24);
  // map พิกัดเมตรของ shape ให้เป็น 0–1
  const uv = innerGeo.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) + DOOR_W) / DOOR_W, uv.getY(i) / DOOR_H);
  const inner = new THREE.Mesh(innerGeo, new THREE.MeshStandardMaterial({ map: tex.refractory, roughness: 0.95 }));
  inner.rotation.y = Math.PI;
  inner.position.set(-DOOR_W, 0, -0.002);
  doorHinge.add(inner);

  const cx = -DOOR_W / 2;
  const front = 0.06;

  // ตราเทพพนมทองบนสุด (ref 07)
  const emblem = new THREE.Mesh(
    new THREE.PlaneGeometry(0.16, 0.18),
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
  emblem.position.set(cx, DOOR_H - 0.17, front + 0.002);
  doorHinge.add(emblem);

  // กล่องช่องมอง แถบเหล็กคาด มือจับกลอน บานพับ
  const fittings = [
    box(0.26, 0.2, 0.04, cx, 1.0, front + 0.02),
    box(0.1, 0.06, 0.012, cx - 0.04, 1.06, front + 0.046),
    box(DOOR_W - 0.02, 0.07, 0.012, cx, 0.83, front + 0.006),
  ];
  for (const y of [0.3, 0.65, 1.0, 1.25]) {
    // บานพับแบบบล็อกซ้อนฝั่งขวา
    fittings.push(box(0.12, 0.035, 0.05, -0.06, y - 0.025, front + 0.02), box(0.12, 0.035, 0.05, -0.06, y + 0.025, front + 0.02));
  }
  doorHinge.add(new THREE.Mesh(mergeGeometries(fittings), iron));
  fittings.forEach((g) => g.dispose());

  // กลอนฝั่งซ้าย: สลักกลมมีด้าม (ref 07) เลื่อนเข้าขอรับตอนปิด
  const latches = new THREE.Group();
  const latchParts: THREE.BufferGeometry[] = [];
  const pin = new THREE.CylinderGeometry(0.018, 0.018, 0.16, 12);
  pin.rotateZ(Math.PI / 2);
  for (const y of [0.3, 0.65, 1.0, 1.25]) {
    latchParts.push(pin.clone().translate(-DOOR_W + 0.06, y, front + 0.03));
    latchParts.push(box(0.025, 0.09, 0.025, -DOOR_W + 0.12, y - 0.04, front + 0.05));
  }
  latches.add(new THREE.Mesh(mergeGeometries(latchParts), iron));
  latchParts.forEach((g) => g.dispose());
  pin.dispose();
  doorHinge.add(latches);

  // รูช่องมอง ทั้งด้านนอกและด้านใน ใช้วัสดุเรืองแสงเดียวกัน
  const peephole = new THREE.MeshStandardMaterial({ color: '#1a1410', emissive: '#ff8a3d', emissiveIntensity: 0 });
  const hole = new THREE.CircleGeometry(0.022, 20);
  const outerHole = new THREE.Mesh(hole, peephole);
  outerHole.position.set(cx + 0.05, 0.98, front + 0.041);
  const innerHole = new THREE.Mesh(hole, peephole);
  innerHole.position.set(cx, 1.0, -0.004);
  innerHole.rotation.y = Math.PI;
  const innerFrameBox = new THREE.Mesh(
    new THREE.PlaneGeometry(0.22, 0.2),
    new THREE.MeshStandardMaterial({ color: '#4a2a1c', roughness: 0.8, metalness: 0.3 }),
  );
  innerFrameBox.position.set(cx, 1.0, -0.003);
  innerFrameBox.rotation.y = Math.PI;
  doorHinge.add(outerHole, innerHole, innerFrameBox);

  // ---------- ไฟในเตา (เปิดหลังประตูปิดสนิท) ----------
  // แสงลอดขอบประตู: texture รูปซุ้มประตูที่เบลอขอบ (ใช้ shadowBlur ของ canvas — รองรับทุก browser)
  // วางบนแผ่นหน้ากรอบเหล็ก (z 0.042) แต่หลังบาน → บานบังตรงกลาง เห็นแค่แสงฟุ้งรอบขอบ
  // แผ่นเรขาคณิตแข็งหลายชั้นเคยลองแล้ว เห็นเป็นแถบโค้งบนผนัง ดูไม่เป็นไฟ
  const PAD = 0.32;
  const GW = DOOR_W + PAD * 2;
  const GH = DOOR_H + PAD;
  const pxPerM = 200;
  const glowCanvas = document.createElement('canvas');
  glowCanvas.width = Math.round(GW * pxPerM);
  glowCanvas.height = Math.round(GH * pxPerM);
  const gctx = glowCanvas.getContext('2d')!;
  const drawArch = (grow: number, blur: number, color: string) => {
    const w = (DOOR_W + grow * 2) * pxPerM;
    const h = (DOOR_H + grow) * pxPerM;
    const r = w / 2;
    const cx = glowCanvas.width / 2;
    const base = glowCanvas.height; // y ของพื้น (canvas นับจากบนลงล่าง)
    const far = 10000; // วาดรูปจริงนอกจอ แล้วเลื่อนเงากลับมา → เหลือแต่เงาเบลอ
    gctx.save();
    gctx.shadowColor = color;
    gctx.shadowBlur = blur;
    gctx.shadowOffsetX = far;
    gctx.beginPath();
    gctx.moveTo(cx - r - far, base);
    gctx.lineTo(cx - r - far, base - (h - r));
    gctx.arc(cx - far, base - (h - r), r, Math.PI, 0);
    gctx.lineTo(cx + r - far, base);
    gctx.closePath();
    gctx.fillStyle = '#000';
    gctx.fill();
    gctx.restore();
  };
  drawArch(0.06, 70, 'rgba(255,90,10,0.9)');
  drawArch(0.02, 14, 'rgba(255,170,90,1)');
  const glowTex = new THREE.CanvasTexture(glowCanvas);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  const seam = new THREE.MeshBasicMaterial({
    map: glowTex,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const seamMesh = new THREE.Mesh(new THREE.PlaneGeometry(GW, GH), seam);
  seamMesh.position.set(0, GH / 2 - 0.004, 0.042);
  seamMesh.renderOrder = 2;
  group.add(seamMesh);

  return { group, doorHinge, latches, peephole, interiorLight, fire: { seam } };
}
