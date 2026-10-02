// app/farewell/journey/three/camera.ts
// กล้องของแต่ละขั้น คำนวณตามสัดส่วนจอ เพื่อให้หีบยาว 2.05 ม. ไม่ล้นจอมือถือแนวตั้ง
// หน่วยเป็นเมตร แกน Y ชี้ขึ้น หีบเริ่มที่จุดกำเนิด เตาเผาอยู่ที่ z = -4

export type Vec3 = [number, number, number];

export interface CameraKey {
  pos: Vec3;
  target: Vec3;
  fov: number;
}

export type ViewportKind = 'desktop' | 'portrait' | 'short';

export interface ViewportRig {
  kind: ViewportKind;
  /** เลื่อนภาพ (สัดส่วนของจอ) ให้วัตถุหลบการ์ดข้อความ: x บวก = วัตถุไปทางขวา, y บวก = วัตถุขึ้นบน */
  shift: [number, number];
  /** ระยะกล้องขั้นแรก ใช้คำนวณหมอกที่ซ่อนเตาไว้ช่วงต้น */
  distanceA: number;
  /** กล้องขั้นแรก รับมุมกวาดรอบหีบ (เรเดียน) */
  a: (azimuth: number) => CameraKey;
  b: CameraKey;
  b2: CameraKey;
  c: CameraKey;
  c2: CameraKey;
}

const deg = Math.PI / 180;

/** ระยะที่ทำให้วัตถุกว้าง w เมตร กินพื้นที่ fill ของความกว้างจอ */
export function fitDistance(w: number, fovDeg: number, aspect: number, fill: number) {
  const halfH = Math.atan(Math.tan((fovDeg * deg) / 2) * aspect);
  return w / 2 / Math.tan(halfH) / fill;
}

/** ระยะที่ทำให้วัตถุสูง h เมตร กินพื้นที่ fill ของความสูงจอ */
function fitHeight(h: number, fovDeg: number, fill: number) {
  return h / 2 / Math.tan((fovDeg * deg) / 2) / fill;
}

export function viewportKind(width: number, height: number): ViewportKind {
  const aspect = width / height;
  if (aspect < 0.9) return 'portrait';
  if (height < 500) return 'short';
  return 'desktop';
}

export function getRig(width: number, height: number): ViewportRig {
  const aspect = width / Math.max(1, height);
  const kind = viewportKind(width, height);
  const portrait = kind === 'portrait';

  const fovA = portrait ? 40 : kind === 'short' ? 38 : 32;
  // หีบกว้าง ~2.3 ม. (รวมมุมมอง 3/4) สูงรวมฝาที่เปิด ~1.7 ม.
  const distanceA = portrait
    ? Math.max(fitDistance(2.3, fovA, aspect, 0.88), fitHeight(1.7, fovA, 0.45))
    : Math.max(fitDistance(2.3, fovA, aspect, 0.5), fitHeight(1.7, fovA, 0.5));

  const targetA: Vec3 = [0, 0.66, 0];
  const elevation = (portrait ? 30 : 27) * deg;
  const a = (azimuth: number): CameraKey => ({
    pos: [
      targetA[0] + Math.sin(azimuth) * Math.cos(elevation) * distanceA,
      targetA[1] + Math.sin(elevation) * distanceA,
      targetA[2] + Math.cos(azimuth) * Math.cos(elevation) * distanceA,
    ],
    target: targetA,
    fov: fovA,
  });

  if (portrait) {
    return {
      kind,
      shift: [0, 0.12],
      distanceA,
      a,
      b: { pos: [-0.6, 2.8, 5.6], target: [0, 0.85, -4.3], fov: 52 },
      b2: { pos: [-0.35, 1.9, 1.7], target: [0, 0.9, -4.6], fov: 50 },
      c: { pos: [0, 1.35, 1.3], target: [0, 0.95, -4], fov: 44 },
      c2: { pos: [0, 1.3, 1.1], target: [0, 0.95, -4], fov: 44 },
    };
  }

  return {
    kind,
    shift: [kind === 'short' ? 0.18 : 0.15, 0],
    distanceA,
    a,
    b: { pos: [-0.9, 2.4, 4.4], target: [0, 0.85, -4.3], fov: 34 },
    b2: { pos: [-0.55, 1.6, 0.5], target: [0, 0.9, -4.6], fov: 34 },
    c: { pos: [-0.1, 1.3, 0], target: [0, 0.9, -4], fov: 36 },
    c2: { pos: [0, 1.25, -0.25], target: [0, 0.9, -4], fov: 36 },
  };
}
