// app/lib/areaCoverage.ts — ตัวหารสำหรับคิด "% ความครอบคลุมพื้นที่"
// นับจำนวนอำเภอ/ตำบลจริงของแต่ละจังหวัดจาก app/data/tambon.json (สร้าง index ครั้งเดียวตอนโหลดโมดูล)
import tambonData from '@/app/data/tambon.json';

interface TambonRow {
  TAMBON_T: string;
  AMPHOE_T: string;
  CHANGWAT_T: string;
}

const rows = (tambonData as { data: TambonRow[] }).data;

const amphoeSet = new Map<string, Set<string>>();
const tambonCount = new Map<string, number>();

for (const r of rows) {
  if (!amphoeSet.has(r.CHANGWAT_T)) amphoeSet.set(r.CHANGWAT_T, new Set());
  amphoeSet.get(r.CHANGWAT_T)!.add(r.AMPHOE_T);
  tambonCount.set(r.CHANGWAT_T, (tambonCount.get(r.CHANGWAT_T) ?? 0) + 1);
}

export const TOTAL_PROVINCES = amphoeSet.size; // 77

/** จำนวนอำเภอและตำบลทั้งหมดของจังหวัด (ตัวหารของ % ความครอบคลุม) */
export function provinceAreaTotals(province: string) {
  return {
    amphoe: amphoeSet.get(province)?.size ?? 0,
    tambon: tambonCount.get(province) ?? 0,
  };
}
