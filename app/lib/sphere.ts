// app/lib/sphere.ts — เรียก GISTDA Sphere ฝั่ง server (คีย์ GISTDA_API_KEY ไม่ส่งถึง browser)
// เอกสาร: https://sphere.gistda.or.th/docs/web-service/
import { data as regions } from '@/app/data/regions';
import type { RegionData } from '@/app/types/region';

// ชื่อตัวแปรเดียวกับ sdn-mapportal (NEXT_PUBLIC_GISTDA_API_KEY) — ใช้ฝั่ง server เท่านั้น
// อย่าอ้างถึงใน client component ไม่งั้น Next จะฝังคีย์ลง bundle
const API = `${process.env.GISTDA_API_BASE_URL || 'https://api.sphere.gistda.or.th'}/services`;
export const sphereKey = () =>
  process.env.GISTDA_API_KEY || process.env.NEXT_PUBLIC_GISTDA_API_KEY || '';

// geocode ของ Sphere = รหัสตำบลกรมการปกครอง ตรงกับ district_code ใน regions.ts เป็นส่วนใหญ่ (550101 = ในเวียง น่าน)
// แต่ regions.ts ใช้รหัสชุดเก่า: ตำบลที่ย้ายไปอำเภอตั้งใหม่รหัสไม่ตรง (ท่าน้าว 550112 → 551406 อ.ภูเพียง)
// และ 114 แถวไม่มีรหัส → จับคู่ด้วยรหัสก่อน ไม่เจอค่อยใช้ชื่อ ตำบล|อำเภอ|จังหวัด
const byDistrictCode = new Map<number, RegionData>();
const byName = new Map<string, RegionData>();
for (const r of regions) {
  if (typeof r.district_code === 'number') byDistrictCode.set(r.district_code, r);
  byName.set(`${r.district}|${r.amphoe}|${r.province}`, r);
}
const stripPrefix = (s = '') => s.trim().replace(/^(ตำบล|แขวง|อำเภอ|เขต|จังหวัด)\s*/, '');

// พิกัด → ตำบลจริง (Reverse geocoding) — ไม่มีคีย์/เรียกไม่สำเร็จ/นอกประเทศ = null
export async function reverseGeocode(lat: number, lng: number): Promise<RegionData | null> {
  const key = sphereKey();
  if (!key) return null;
  try {
    const url = new URL(`${API}/geo/address`);
    url.search = new URLSearchParams({ lat: String(lat), lon: String(lng), locale: 't', key }).toString();
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const d = (await res.json()) as {
      geocode?: number;
      subdistrict?: string;
      district?: string;
      province?: string;
    };
    const byCode = d.geocode ? byDistrictCode.get(Number(d.geocode)) : undefined;
    const name = `${stripPrefix(d.subdistrict)}|${stripPrefix(d.district)}|${stripPrefix(d.province)}`;
    // รหัสตรงแต่ชื่ออำเภอไม่ตรง = รหัสชุดเก่าชนกับตำบลอื่น → เชื่อชื่อมากกว่า
    return byName.get(name) ?? byCode ?? null;
  } catch {
    return null;
  }
}

export interface SphereItem {
  id?: string;
  name?: string;
  lat?: number;
  lon?: number;
  address?: string;
  obsoleted?: boolean;
}

// ค้นหาสถานที่ — ส่ง near มาแล้ว Sphere จะเรียงผลที่ใกล้จุดนั้นขึ้นก่อน
export async function searchPlaces(keyword: string, near?: { lat: number; lng: number } | null) {
  const params = new URLSearchParams({ keyword, limit: '20', key: sphereKey() });
  if (near) {
    params.set('lat', String(near.lat));
    params.set('lon', String(near.lng));
  }
  const url = new URL(`${API}/search/search`);
  url.search = params.toString();
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`GISTDA ${res.status}`);
  return ((await res.json()) as { data?: SphereItem[] }).data ?? [];
}

// ชั้นข้อมูลแผนที่พื้นหลัง (Raster tiles) ที่เปิดให้ใช้ — นามสกุลไฟล์ต่างกันตามชั้น (streets = png)
export const SPHERE_LAYERS: Record<string, 'jpeg' | 'png'> = {
  sphere_hybrid: 'jpeg', // ภาพถ่ายดาวเทียม + ชื่อถนน/สถานที่
  thailand_images: 'jpeg', // ภาพถ่ายดาวเทียมล้วน
  sphere_streets: 'png',
};

export const sphereTileUrl = (layer: string, z: number, x: number, y: number) =>
  `https://basemap.sphere.gistda.or.th/tiles/${layer}/EPSG3857/${z}/${x}/${y}.${SPHERE_LAYERS[layer]}?key=${sphereKey()}`;

// สถานที่ใกล้พิกัด (Nearby POI) — ใช้หลังกด GPS/วางลิงก์/แตะแผนที่ ให้ผู้ใช้แตะเลือกชื่อสถานที่
// ผลดิบ (เรียงตามระยะ) มีอาคารซ้ำชื่อ + ถนน/ทางน้ำ + "ที่พักอาศัย" → ตัดทิ้ง แล้วดันประเภทที่เครือข่ายทำงานด้วย
// (โรงเรียน วัด ราชการ สาธารณสุข/ศูนย์เด็กเล็ก หมู่บ้าน) ขึ้นก่อน — ร้านค้ายังเก็บไว้ท้าย (งานเฝ้าระวังร้านเหล้า)
const SKIP_TAG = /^(ถนน|Road|ซอย|Alley|ทางหลวง.*|.*Highways?|ทางรถไฟ|Railway|ทางน้ำ|Waterway|โครงสร้างพื้นฐาน.*|Infrastructure.*)$/i;
const PRIORITY_TAG = /^(การศึกษา|ศาสนา|วัด|ราชการ|โรงพยาบาล.*|ศูนย์พัฒนาเด็กเล็ก|หมู่บ้าน|หมู่บ่าน|ชุมชน|ศูนย์กลางเมือง)$/;
const GENERIC_NAME = /^(ที่พักอาศัย|บ้าน|อาคาร|สิ่งปลูกสร้าง)$/;
export async function nearbyPlaces(lat: number, lng: number, limit = 6) {
  const key = sphereKey();
  if (!key) return [];
  try {
    const url = new URL(`${API}/poi/search`);
    url.search = new URLSearchParams({ lat: String(lat), lon: String(lng), limit: '40', locale: 'th', key }).toString();
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return [];
    const data = ((await res.json()) as { data?: (SphereItem & { tag?: string[] })[] }).data ?? [];
    const seen = new Set<string>();
    const out: { name: string; lat: number; lng: number; rank: number }[] = [];
    for (const it of data) {
      if (!it.name || it.obsoleted || typeof it.lat !== 'number' || typeof it.lon !== 'number') continue;
      const tags = it.tag ?? [];
      if (tags.some((t) => SKIP_TAG.test(t)) || GENERIC_NAME.test(it.name.trim()) || seen.has(it.name)) continue;
      seen.add(it.name);
      out.push({
        name: it.name,
        lat: Math.round(it.lat * 1e6) / 1e6,
        lng: Math.round(it.lon * 1e6) / 1e6,
        rank: tags.some((t) => PRIORITY_TAG.test(t)) ? 0 : 1,
      });
    }
    // sort เสถียร — ภายในกลุ่มเดียวกันยังเรียงตามระยะเดิม
    return out
      .sort((a, b) => a.rank - b.rank)
      .slice(0, limit)
      .map(({ name, lat, lng }) => ({ name, lat, lng }));
  } catch {
    return [];
  }
}

// ค้นด้วยคำ + เรียงตามระยะจากจุด (poi/search รับ keyword ได้ แม้เอกสารไม่ได้ระบุ — ทดสอบแล้ว ก.ย. 2026)
// ใช้กับ "ประเภท + พื้นที่" เช่น "โรงเรียน เมืองน่าน": search/search ให้น้ำหนักความตรงของชื่อมากกว่าระยะ
// คำกว้างอย่าง "โรงเรียน" จึงได้ผลทั้งประเทศ ส่วนตัวนี้ได้โรงเรียนที่ใกล้จุดกลางอำเภอจริง
export async function searchNearby(keyword: string, lat: number, lng: number): Promise<SphereItem[]> {
  const url = new URL(`${API}/poi/search`);
  url.search = new URLSearchParams({
    keyword,
    lat: String(lat),
    lon: String(lng),
    limit: '50',
    locale: 'th',
    key: sphereKey(),
  }).toString();
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`GISTDA ${res.status}`);
  return ((await res.json()) as { data?: SphereItem[] }).data ?? [];
}
