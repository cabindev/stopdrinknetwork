// app/lib/activityAreas.ts — พื้นที่ที่เกี่ยวข้องของงาน (ActivityArea) ใช้ร่วม POST/PATCH
// งานเดียวที่ยกหลายพื้นที่ (เช่น งานสื่อสารที่เล่าต้นแบบหลายจังหวัด) — หมุดรองบนแผนที่ + รายการในหน้างาน/กรณีศึกษา
// สถิติ ภาค และพื้นที่ทับซ้อนยังนับจากพื้นที่หลักของ Activity เท่านั้น
// ถ้าแต่ละพื้นที่มีกิจกรรมของตัวเอง ให้บันทึกแยกรายการ (ปุ่ม "คัดลอกงานนี้") ไม่ใช่ใส่ที่นี่
import { findRegion } from '@/app/lib/regionLookup';
import { provinceHealthZones } from '@/app/utils/healthZones';
import { resolveCoords } from '@/app/lib/provinceGeo';
import { MAX_EXTRA_AREAS } from '@/app/lib/activityMeta';

// รูปที่ฟอร์มส่งมา (formData `extraAreas` = JSON array) และที่ฟอร์มรับตอนแก้ไข
export interface ExtraAreaInput {
  areaName: string;
  district: string;
  amphoe: string;
  province: string;
  zipcode: string;
  lat: number | null;
  lng: number | null;
  source: string; // TAMBON | PIN | GPS | LINK | PLACE
  note: string;
}

const clip = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

// ไม่ส่งมา = ไม่แตะของเดิม (null) · ตำบลต้องมีใน regions.ts · หมุดต้องอยู่ในจังหวัด · พื้นที่ซ้ำกันตัดทิ้ง
export function parseExtraAreas(fd: FormData) {
  const raw = fd.get('extraAreas');
  if (raw === null) return { areas: null } as const;
  let list: unknown;
  try {
    list = JSON.parse(String(raw));
  } catch {
    return { error: 'รายการพื้นที่ที่เกี่ยวข้องไม่ถูกต้อง' } as const;
  }
  if (!Array.isArray(list)) return { error: 'รายการพื้นที่ที่เกี่ยวข้องไม่ถูกต้อง' } as const;
  if (list.length > MAX_EXTRA_AREAS) return { error: `พื้นที่ที่เกี่ยวข้องได้ไม่เกิน ${MAX_EXTRA_AREAS} แห่ง` } as const;

  const seen = new Set<string>();
  const areas = [];
  for (const item of list as Record<string, unknown>[]) {
    const district = clip(item?.district, 100);
    const amphoe = clip(item?.amphoe, 100);
    const province = clip(item?.province, 100);
    const where = `ต.${district} อ.${amphoe} จ.${province}`;
    if (!findRegion(district, amphoe, province)) return { error: `ไม่พบพื้นที่ ${where} — เลือกจากช่องค้นหาอีกครั้ง` } as const;
    const region = provinceHealthZones[province];
    if (!region) return { error: `ไม่รู้จักจังหวัด "${province}"` } as const;
    const coords = resolveCoords({ source: clip(item?.source, 10), lat: item?.lat ?? null, lng: item?.lng ?? null }, district, amphoe, province);
    if ('error' in coords) return { error: `พื้นที่ที่เกี่ยวข้อง ${where}: ${coords.error}` } as const;
    const areaName = clip(item?.areaName, 200) || null;
    const key = `${district}|${amphoe}|${province}|${areaName ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    areas.push({
      areaName,
      district,
      amphoe,
      province,
      region,
      zipcode: clip(item?.zipcode, 10) || null,
      ...coords,
      note: clip(item?.note, 200) || null,
      sortOrder: areas.length,
    });
  }
  return { areas } as const;
}

// ข้อความสำหรับ audit log — เทียบทั้งชุด
export const areasText = (l: { areaName: string | null; district: string; amphoe: string; province: string; note: string | null }[]) =>
  l.map((a) => [a.areaName, `ต.${a.district} อ.${a.amphoe} จ.${a.province}`, a.note && `(${a.note})`].filter(Boolean).join(' ')).join(' · ') || null;

// แถว DB → รูปที่ฟอร์มใช้ (หน้าแก้ไข)
export const toExtraAreaInput = (a: {
  areaName: string | null;
  district: string;
  amphoe: string;
  province: string;
  zipcode: string | null;
  latitude: number | null;
  longitude: number | null;
  locationSource: string;
  note: string | null;
}): ExtraAreaInput => ({
  areaName: a.areaName ?? '',
  district: a.district,
  amphoe: a.amphoe,
  province: a.province,
  zipcode: a.zipcode ?? '',
  lat: a.locationSource !== 'TAMBON' ? a.latitude : null,
  lng: a.locationSource !== 'TAMBON' ? a.longitude : null,
  source: a.locationSource,
  note: a.note ?? '',
});
