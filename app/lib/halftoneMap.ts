// app/lib/halftoneMap.ts — ปักงานลงแผนที่จุด halftone ของหน้าแรก (public/maps/thailand-halftone.svg)
// พิกัดงานถูกปัดเข้าจุดตาราง (~18 กม.) ไม่ใช่ตำแหน่งจริง — หน้าแรกเป็นหน้าสาธารณะ
import grid from '@/app/data/halftoneGrid.json';

export const HALFTONE_VIEWBOX = `0 0 ${grid.W} ${grid.H}`;

/** ลองจิจูด/ละติจูด → จุดตารางหกเหลี่ยมที่ใกล้ที่สุด (สูตรเดียวกับ scripts/build-halftone-map.mjs) */
export function snapToGrid(lon: number, lat: number): { x: number; y: number } | null {
  const { W, H, S, LON0, LON1, LAT0, LAT1 } = grid;
  const px = ((lon - LON0) / (LON1 - LON0)) * W;
  const py = ((LAT1 - lat) / (LAT1 - LAT0)) * H;
  if (px < 0 || px > W || py < 0 || py > H) return null;
  const row = Math.max(0, Math.round((py - S / 2) / (S * 0.866)));
  const offset = (row % 2 ? S / 2 : 0) + S / 2;
  const col = Math.max(0, Math.round((px - offset) / S));
  return { x: +(offset + col * S).toFixed(1), y: +(S / 2 + row * S * 0.866).toFixed(1) };
}

export interface HalftoneSpot {
  x: number;
  y: number;
  count: number;
  /** มีงานที่บันทึกภายใน RECENT_DAYS วัน */
  recent: boolean;
}

export const RECENT_DAYS = 30;

/** รวมงานที่ตกจุดเดียวกัน */
export function toSpots(rows: { latitude: number | null; longitude: number | null; createdAt: Date }[], now = new Date()): HalftoneSpot[] {
  const since = now.getTime() - RECENT_DAYS * 864e5;
  const spots = new Map<string, HalftoneSpot>();
  for (const r of rows) {
    if (r.latitude == null || r.longitude == null) continue;
    const p = snapToGrid(r.longitude, r.latitude);
    if (!p) continue;
    const key = `${p.x},${p.y}`;
    const s = spots.get(key) ?? { ...p, count: 0, recent: false };
    s.count++;
    if (r.createdAt.getTime() >= since) s.recent = true;
    spots.set(key, s);
  }
  return [...spots.values()];
}
