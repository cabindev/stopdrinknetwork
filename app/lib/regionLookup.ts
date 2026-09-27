// app/lib/regionLookup.ts — ค้นหา/จับคู่ตำบลจาก regions.ts ฝั่ง server
// (ย้ายมาจาก TambonSearch ฝั่ง client — ไม่ต้องส่งข้อมูล 7,498 ตำบลไปกับหน้าเว็บ)
import { data as regions } from '@/app/data/regions';
import type { RegionData } from '@/app/types/region';

const key = (d: string, a: string, p: string) => `${d}|${a}|${p}`;
const index = new Map<string, RegionData>(regions.map((r) => [key(r.district, r.amphoe, r.province), r]));

export const findRegion = (district: string, amphoe: string, province: string) =>
  index.get(key(district, amphoe, province)) ?? null;

const PREFIX = /^(ตำบล|ต\.|แขวง|อำเภอ|อ\.|เขต|จังหวัด|จ\.)/;
const haystack = regions.map((r) => `${r.district} ${r.amphoe} ${r.province}`);

// ทุกคำที่พิมพ์ต้องอยู่ใน "ตำบล อำเภอ จังหวัด" — ชื่อตำบลขึ้นต้นด้วยคำแรกเรียงก่อน
export function searchRegions(q: string, limit = 5): RegionData[] {
  const tokens = q
    .trim()
    .split(/\s+/)
    .map((t) => t.replace(PREFIX, ''))
    .filter(Boolean);
  if (tokens.length === 0) return [];
  const hits: { r: RegionData; score: number }[] = [];
  for (let i = 0; i < regions.length; i++) {
    if (!tokens.every((t) => haystack[i].includes(t))) continue;
    const r = regions[i];
    const score = r.district === tokens[0] ? 0 : r.district.startsWith(tokens[0]) ? 1 : 2;
    hits.push({ r, score });
  }
  return hits.sort((a, b) => a.score - b.score).slice(0, limit).map((h) => h.r);
}

// ผู้ใช้พิมพ์ชื่อตำบลตรงตัว (เช่น "ต.ในเวียง") → ควรขึ้นกลุ่มตำบลก่อนกลุ่มสถานที่
export const looksLikeRegionQuery = (q: string) => {
  const first = q.trim().split(/\s+/)[0] ?? '';
  return PREFIX.test(first) || regions.some((r) => r.district === first);
};
