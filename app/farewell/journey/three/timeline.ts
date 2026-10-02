// app/farewell/journey/three/timeline.ts
// แปลง progress ของการเลื่อน (0–1) เป็นสถานะของฉาก
// เป็น pure function ไม่แตะ object ของ three เลื่อนย้อนกลับแล้วทุกอย่างย้อนตามได้ เพราะขึ้นกับ p อย่างเดียว
import { type CameraKey, type Vec3, type ViewportRig } from './camera';

export const STAGES = [
  { start: 0, end: 0.1 }, // 0 หีบเปล่า
  { start: 0.1, end: 0.3 }, // 1 ปิดฝา
  { start: 0.3, end: 0.48 }, // 2 หันสู่เมรุ
  { start: 0.48, end: 0.72 }, // 3 เข้าเตา
  { start: 0.72, end: 0.86 }, // 4 ปิดเตา
  { start: 0.86, end: 1 }, // 5 แสงอุ่น
] as const;

/** มุมฝาตอนเปิด (หมุนรอบบานพับขอบหลัง) */
export const LID_OPEN = 1.92;
/** มุมประตูเตาตอนเปิด (บานพับขวา เปิดออกมาทางขวา) */
export const DOOR_OPEN = 1.75;
/** ระยะที่หีบเคลื่อนเข้าเตา */
export const COFFIN_TRAVEL = -5.45;

export interface SceneState {
  stage: number;
  lidRotX: number;
  lidDip: number;
  coffinRotY: number;
  coffinZ: number;
  doorRotY: number;
  latchX: number;
  /** 0–1 ความสว่างของช่องมอง */
  peephole: number;
  /** 0–1 แสงในเตา */
  interior: number;
  /** 0–1 ความสว่างแสงรวมของฉาก */
  ambient: number;
  /** ซ่อนเตาไว้จนหีบเริ่มหัน (หมอกอย่างเดียวซ่อนบานประตูที่เปิดยื่นออกมาไม่มิด) */
  furnaceVisible: boolean;
  /** 0 = งาช้าง, 1 = ถ่าน */
  darkness: number;
  fogNear: number;
  fogFar: number;
  camera: CameraKey;
}

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const range = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpV = (a: Vec3, b: Vec3, t: number): Vec3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

function blend(a: CameraKey, b: CameraKey, t: number): CameraKey {
  return { pos: lerpV(a.pos, b.pos, t), target: lerpV(a.target, b.target, t), fov: lerp(a.fov, b.fov, t) };
}

export function stageAt(p: number) {
  for (let i = STAGES.length - 1; i >= 0; i--) if (p >= STAGES[i].start) return i;
  return 0;
}

/** โหมด reduced-motion: กระโดดไปท่าสุดท้ายของขั้นปัจจุบัน */
export function snapToStage(p: number) {
  return STAGES[stageAt(p)].end;
}

/** มุมกวาดกล้องช่วงแรก ให้รู้ว่าเป็นภาพ 3D */
const azimuthA = (p: number) => lerp(0.22, 0.1, range(p, 0, 0.3));

export function getSceneState(p: number, rig: ViewportRig): SceneState {
  p = clamp01(p);

  let camera: CameraKey;
  if (p < 0.3) camera = rig.a(azimuthA(p));
  else if (p < 0.48) camera = blend(rig.a(azimuthA(0.3)), rig.b, easeInOut(range(p, 0.3, 0.48)));
  else if (p < 0.72) camera = blend(rig.b, rig.b2, easeInOut(range(p, 0.48, 0.72)));
  else if (p < 0.86) camera = blend(rig.b2, rig.c, easeInOut(range(p, 0.72, 0.86)));
  else camera = blend(rig.c, rig.c2, easeOut(range(p, 0.86, 1)));

  // ช่วงต้นหมอกสีงาช้างซ่อนเตาเผาไว้ด้านหลัง (เตาอยู่ไกลกว่าหีบราว 4 ม.) แล้วค่อยเผยตอนหีบหันเข้าหา
  const reveal = easeInOut(range(p, 0.3, 0.5));
  const settle = range(p, 0.27, 0.3);

  return {
    stage: stageAt(p),
    lidRotX: LID_OPEN * (1 - easeInOut(range(p, 0.1, 0.27))),
    lidDip: -0.003 * Math.sin(Math.PI * settle),
    coffinRotY: (-Math.PI / 2) * easeInOut(range(p, 0.3, 0.48)),
    coffinZ: COFFIN_TRAVEL * easeInOut(range(p, 0.49, 0.72)),
    doorRotY: DOOR_OPEN * (1 - easeOut(range(p, 0.72, 0.82))),
    latchX: -0.06 * easeInOut(range(p, 0.82, 0.86)),
    peephole: easeInOut(range(p, 0.86, 0.97)),
    interior: range(p, 0.5, 0.64) * (1 - range(p, 0.76, 0.82)),
    // แสงรวมหรี่ลงตามเรื่อง: ห้องพิธีสว่าง → หน้าเมรุสลัว → เหลือแสงอุ่นจากช่องมอง
    ambient: lerp(1, 0.5, easeInOut(range(p, 0.3, 0.62))) * lerp(1, 0.55, easeInOut(range(p, 0.84, 1))),
    furnaceVisible: p > 0.3,
    darkness: easeInOut(range(p, 0.3, 0.56)),
    fogNear: lerp(rig.distanceA + 1.2, 14, reveal),
    fogFar: lerp(rig.distanceA + 3.2, 40, reveal),
    camera,
  };
}
