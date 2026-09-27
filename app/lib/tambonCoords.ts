// app/lib/tambonCoords.ts — หาพิกัด lat/lng จากตำบล/อำเภอ/จังหวัด (ใช้ฝั่ง server ตอนบันทึก Activity)
// แหล่งข้อมูล: app/data/tambon.json (รายตำบลทั้งประเทศ จาก sdn-mapportal)
// ลำดับการหา: ตำบลตรงตัว → ค่าเฉลี่ยของอำเภอ → null (ให้แผนที่ fallback เป็นจุดกลางจังหวัด)
import tambonData from '@/app/data/tambon.json';

interface TambonRow {
  TAMBON_T: string;
  AMPHOE_T: string;
  CHANGWAT_T: string;
  LAT: number;
  LONG: number;
}

const rows = (tambonData as { data: TambonRow[] }).data;

const tambonKey = (d: string, a: string, p: string) => `${d}|${a}|${p}`;
const amphoeKey = (a: string, p: string) => `${a}|${p}`;

// สร้าง index ครั้งเดียวตอนโหลดโมดูล (module scope — อยู่ยาวตลอดอายุ process)
const byTambon = new Map<string, { lat: number; lng: number }>();
const amphoeAgg = new Map<string, { latSum: number; lngSum: number; n: number }>();

for (const r of rows) {
  if (typeof r.LAT !== 'number' || typeof r.LONG !== 'number') continue;
  byTambon.set(tambonKey(r.TAMBON_T, r.AMPHOE_T, r.CHANGWAT_T), { lat: r.LAT, lng: r.LONG });
  const k = amphoeKey(r.AMPHOE_T, r.CHANGWAT_T);
  const agg = amphoeAgg.get(k) ?? { latSum: 0, lngSum: 0, n: 0 };
  agg.latSum += r.LAT;
  agg.lngSum += r.LONG;
  agg.n += 1;
  amphoeAgg.set(k, agg);
}

export function getTambonCoords(
  district: string,
  amphoe: string,
  province: string
): { lat: number; lng: number } | null {
  const exact = byTambon.get(tambonKey(district, amphoe, province));
  if (exact) return exact;

  const agg = amphoeAgg.get(amphoeKey(amphoe, province));
  if (agg && agg.n > 0) {
    return { lat: agg.latSum / agg.n, lng: agg.lngSum / agg.n };
  }
  return null;
}

// ตำบลที่จุดกลางใกล้พิกัดนี้ที่สุด (จำกัดในจังหวัดที่ระบุ) — ใช้เดาตำบลเมื่อผลค้นหาสถานที่ไม่มีที่อยู่
// เป็นการประมาณ: ตำบลที่ใหญ่ติดกับตำบลเล็กอาจเดาผิด ผู้ใช้แก้ในฟอร์มได้
export function nearestTambon(lat: number, lng: number, province: string) {
  let best: TambonRow | null = null;
  let bestD = Infinity;
  for (const r of rows) {
    if (r.CHANGWAT_T !== province || typeof r.LAT !== 'number') continue;
    const d = (r.LAT - lat) ** 2 + (r.LONG - lng) ** 2;
    if (d < bestD) {
      bestD = d;
      best = r;
    }
  }
  return best ? { district: best.TAMBON_T, amphoe: best.AMPHOE_T, province: best.CHANGWAT_T } : null;
}

// จุดกลางของจังหวัด/อำเภอตามชื่อ (เฉลี่ยจุดกลางตำบล) — ใช้กับคำค้นแบบ "สถานีตำรวจ น่าน"
const provinceAgg = new Map<string, { latSum: number; lngSum: number; n: number }>();
const amphoeByName = new Map<string, { province: string; latSum: number; lngSum: number; n: number }>();
for (const r of rows) {
  if (typeof r.LAT !== 'number' || typeof r.LONG !== 'number') continue;
  const p = provinceAgg.get(r.CHANGWAT_T) ?? { latSum: 0, lngSum: 0, n: 0 };
  p.latSum += r.LAT;
  p.lngSum += r.LONG;
  p.n += 1;
  provinceAgg.set(r.CHANGWAT_T, p);
  const a = amphoeByName.get(r.AMPHOE_T) ?? { province: r.CHANGWAT_T, latSum: 0, lngSum: 0, n: 0 };
  a.latSum += r.LAT;
  a.lngSum += r.LONG;
  a.n += 1;
  amphoeByName.set(r.AMPHOE_T, a);
}

// คืนพื้นที่ที่ชื่อตรง (จังหวัดก่อน แล้วอำเภอ) — อำเภอชื่อซ้ำข้ามจังหวัดได้ จึงใช้แค่ตัวแรกที่เจอเป็นจุดอ้างอิง
export function areaByName(name: string) {
  const n = name.replace(/^(จังหวัด|จ\.|อำเภอ|อ\.|เขต)/, '');
  const alias = n === 'กทม' || n === 'กทม.' || n === 'กรุงเทพ' || n === 'กรุงเทพฯ' ? 'กรุงเทพมหานคร' : n;
  const p = provinceAgg.get(alias);
  if (p) return { kind: 'province' as const, province: alias, lat: p.latSum / p.n, lng: p.lngSum / p.n };
  const a = amphoeByName.get(alias);
  if (a) return { kind: 'amphoe' as const, amphoe: alias, province: a.province, lat: a.latSum / a.n, lng: a.lngSum / a.n };
  return null;
}
