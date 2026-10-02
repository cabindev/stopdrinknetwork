// app/lib/provinceGeo.ts — เช็คว่าพิกัดอยู่ในจังหวัดที่เลือกหรือไม่ (ใช้ฝั่ง server ตอนรับหมุดจากผู้ใช้)
// แหล่งข้อมูล: app/data/thailand.json (polygon 77 จังหวัด ชุดเดียวกับแผนที่)
// polygon ถูก simplify มา ขอบจังหวัดจึงคลาดได้หลายร้อยเมตร — ยอมให้หลุดขอบได้ BORDER_TOLERANCE
import thailandGeo from '@/app/data/thailand.json';
import { getTambonCoords, areaByName } from '@/app/lib/tambonCoords';

type Ring = [number, number][]; // [lng, lat]
type Polygon = Ring[];

const BORDER_TOLERANCE_DEG = 0.02; // ~2 กม.

const polygonsByProvince = new Map<string, Polygon[]>();
for (const f of (thailandGeo as { features: { properties: { name_th: string }; geometry: { type: string; coordinates: unknown } }[] }).features) {
  const g = f.geometry;
  const polys = g.type === 'Polygon' ? [g.coordinates as Polygon] : (g.coordinates as Polygon[]);
  polygonsByProvince.set(f.properties.name_th, polys);
}

// ray casting — จุดอยู่ใน ring หรือไม่
function inRing(lng: number, lat: number, ring: Ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function distToSegment(px: number, py: number, [ax, ay]: [number, number], [bx, by]: [number, number]) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

export function isInProvince(lat: number, lng: number, province: string): boolean {
  const polys = polygonsByProvince.get(province);
  if (!polys) return false;

  for (const [outer, ...holes] of polys) {
    if (inRing(lng, lat, outer) && !holes.some((h) => inRing(lng, lat, h))) return true;
  }
  // นอก polygon แต่ชิดขอบมาก → ถือว่าอยู่ในจังหวัด (ชดเชยการ simplify)
  for (const poly of polys) {
    for (const ring of poly) {
      for (let i = 1; i < ring.length; i++) {
        if (distToSegment(lng, lat, ring[i - 1], ring[i]) <= BORDER_TOLERANCE_DEG) return true;
      }
    }
  }
  return false;
}

const PIN_SOURCES = ['PIN', 'GPS', 'LINK', 'PLACE'] as const;
type PinSource = (typeof PIN_SOURCES)[number];

// พิกัดของ Activity ตอนบันทึก/แก้ไข:
// มีหมุดจากผู้ใช้ (latitude/longitude/locationSource) และอยู่ในจังหวัดที่เลือก → ใช้หมุด
// ไม่มีหมุด → จุดกลางตำบล (ตำบลตรงตัว → เฉลี่ยอำเภอ → null ให้แผนที่ใช้จุดกลางจังหวัด)
export function resolveActivityCoords(
  formData: FormData,
  district: string,
  amphoe: string,
  province: string,
  scope: AreaScopeArg = 'SUBDISTRICT'
) {
  return resolveCoords(
    { source: String(formData.get('locationSource') ?? ''), lat: formData.get('latitude'), lng: formData.get('longitude') },
    district,
    amphoe,
    province,
    scope
  );
}

type AreaScopeArg = 'VILLAGE' | 'SUBDISTRICT' | 'DISTRICT' | 'PROVINCE';

// แกนเดียวกันสำหรับพื้นที่หลัก (formData) และพื้นที่ที่เกี่ยวข้อง (JSON ใน ActivityArea)
export function resolveCoords(
  pin: { source: string; lat: unknown; lng: unknown },
  district: string,
  amphoe: string,
  province: string,
  scope: AreaScopeArg = 'SUBDISTRICT'
):
  | { latitude: number | null; longitude: number | null; locationSource: 'TAMBON' | PinSource }
  | { error: string } {
  if (PIN_SOURCES.includes(pin.source as PinSource)) {
    const lat = Number(pin.lat);
    const lng = Number(pin.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || pin.lat === null || pin.lat === '' || pin.lng === null || pin.lng === '') {
      return { error: 'พิกัดหมุดไม่ถูกต้อง' };
    }
    if (!isInProvince(lat, lng, province)) {
      return { error: `หมุดที่ปักอยู่นอกจังหวัด${province} — ตรวจสอบตำแหน่งหรือพื้นที่ที่เลือกอีกครั้ง` };
    }
    return {
      latitude: Math.round(lat * 1e6) / 1e6,
      longitude: Math.round(lng * 1e6) / 1e6,
      locationSource: pin.source as PinSource,
    };
  }
  // ไม่มีหมุด: งานระดับอำเภอ/จังหวัด → จุดกลางอำเภอ/จังหวัด (ไม่ใช่จุดกลางตำบลอ้างอิง ที่ทำให้ดูเหมือนงานเล็ก)
  const c =
    scope === 'PROVINCE'
      ? areaByName(province)
      : scope === 'DISTRICT'
        ? getTambonCoords('', amphoe, province) // ไม่มีตำบลชื่อว่าง → ได้ค่าเฉลี่ยทั้งอำเภอ
        : getTambonCoords(district, amphoe, province);
  return { latitude: c?.lat ?? null, longitude: c?.lng ?? null, locationSource: 'TAMBON' };
}

// จังหวัดที่พิกัดนี้ตกอยู่ (ไม่ใช้ tolerance — ขอบจังหวัดอาจได้ null)
export function provinceAt(lat: number, lng: number): string | null {
  for (const [name, polys] of polygonsByProvince) {
    for (const [outer, ...holes] of polys) {
      if (inRing(lng, lat, outer) && !holes.some((h) => inRing(lng, lat, h))) return name;
    }
  }
  return null;
}
