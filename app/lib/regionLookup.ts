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

const matchTokens = (tokens: string[], limit: number) => {
  const hits: { r: RegionData; score: number }[] = [];
  for (let i = 0; i < regions.length; i++) {
    if (!tokens.every((t) => haystack[i].includes(t))) continue;
    const r = regions[i];
    const score = r.district === tokens[0] ? 0 : r.district.startsWith(tokens[0]) ? 1 : 2;
    hits.push({ r, score });
  }
  return hits.sort((a, b) => a.score - b.score).slice(0, limit).map((h) => h.r);
};
const strip = (t: string) => t.replace(PREFIX, '');
const ADMIN_MARK = /(ตำบล|ต\.|แขวง|อำเภอ|อ\.|จังหวัด|จ\.)/g;

/**
 * ค้นตำบล — ทุกคำต้องอยู่ใน "ตำบล อำเภอ จังหวัด" · ไม่เจอ → ลองแบบ "ชื่อหมู่บ้าน + ที่อยู่"
 * (ผู้ใช้แจ้ง 24 พ.ย. 2026: "บ้านโนนสิน ต.ส้มป่อย" ไม่เจอ เพราะ "บ้านโนนสิน" ไม่ใช่ชื่อตำบล — หมู่บ้านเล็กที่ GISTDA ไม่มีก็จบแค่นั้น)
 *   มี ต./อ./จ. → ใช้เฉพาะส่วนที่อยู่ค้น ส่วนหน้า = ชื่อสถานที่ (areaNameHint) · ไม่มี → ตัดคำที่ไม่ตรงตำบลไหนเลยทิ้งแล้วค้นใหม่
 */
export function searchRegionsLoose(q: string, limit = 5): { regions: RegionData[]; areaNameHint: string | null } {
  const tokens = q.trim().split(/\s+/).map(strip).filter(Boolean);
  if (tokens.length === 0) return { regions: [], areaNameHint: null };
  const strict = matchTokens(tokens, limit);
  if (strict.length) return { regions: strict, areaNameHint: null };

  // แยก "ต./อ./จ." แม้พิมพ์ติดกัน (บ้านโนนสินต.ส้มป่อย)
  const spaced = q.replace(ADMIN_MARK, ' $1').trim();
  const at = spaced.search(/(^|\s)(ตำบล|ต\.|แขวง|อำเภอ|อ\.|จังหวัด|จ\.)/);
  if (at > 0) {
    const name = spaced.slice(0, at).trim();
    const area = spaced.slice(at).split(/\s+/).map(strip).filter(Boolean);
    const hit = area.length ? matchTokens(area, limit) : [];
    if (hit.length) return { regions: hit, areaNameHint: name || null };
  }
  const known = tokens.filter((t) => haystack.some((h) => h.includes(t)));
  if (known.length && known.length < tokens.length) {
    const hit = matchTokens(known, limit);
    if (hit.length) return { regions: hit, areaNameHint: tokens.filter((t) => !known.includes(t)).join(' ') || null };
  }
  return { regions: [], areaNameHint: null };
}

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
  // มี ต./อ./จ. ตรงไหนก็ได้ (เช่น "บ้านโนนสิน ต.ส้มป่อย") = มีที่อยู่ในคำค้น → ตำบลขึ้นก่อน
  return PREFIX.test(first) || /(^|\s|[ก-๙])(ต\.|ตำบล|อ\.|อำเภอ|จ\.|จังหวัด)/.test(q) || regions.some((r) => r.district === first);
};
