// app/lib/geoLink.ts — แปลงข้อความที่ผู้ใช้วาง (ลิงก์ Google Maps / พิกัดดิบ) เป็น lat/lng
// ใช้ได้ทั้ง client และ server — ลิงก์ย่อ maps.app.goo.gl ต้องให้ server ตามต่อ (/api/geo/resolve-link)

export interface LatLng {
  lat: number;
  lng: number;
}

// กรอบประเทศไทยแบบหลวม ๆ — กันสลับ lat/lng หรือวางพิกัดประเทศอื่น
export const isInThailandBox = (lat: number, lng: number) =>
  lat >= 5 && lat <= 21 && lng >= 97 && lng <= 106.5;

const valid = (lat: number, lng: number): LatLng | null =>
  Number.isFinite(lat) && Number.isFinite(lng) && isInThailandBox(lat, lng) ? { lat, lng } : null;

// ลำดับความแม่นยำ: !3d!4d (ตำแหน่งสถานที่จริง) > q/query/destination/ll > @ (จุดกลางจอ) > เลขพิกัดดิบ
const PATTERNS: RegExp[] = [
  /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,
  /[?&](?:q|query|destination|ll|center)=(-?\d+\.\d+)(?:,|%2C)\s*(-?\d+\.\d+)/i,
  /@(-?\d+\.\d+),(-?\d+\.\d+)/,
  /^\s*\(?\s*(-?\d{1,2}\.\d+)\s*[,\s]\s*(-?\d{2,3}\.\d+)\s*\)?\s*$/,
];

export function parseLatLng(text: string): LatLng | null {
  let s = text.trim();
  try {
    s = decodeURIComponent(s);
  } catch {
    // ข้อความที่ decode ไม่ได้ ใช้ตามเดิม
  }
  for (const re of PATTERNS) {
    const m = s.match(re);
    if (m) {
      const hit = valid(Number(m[1]), Number(m[2]));
      if (hit) return hit;
    }
  }
  return null;
}

// ลิงก์ย่อที่ต้องให้ server ตาม redirect ก่อนถึงจะเห็นพิกัด
export const isShortMapsLink = (text: string) =>
  /^https?:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps)\//i.test(text.trim());

// ลิงก์นำทางของ Google Maps (เปิดแอปบนมือถือได้ ไม่ต้องใช้ API key)
// พิกัดโดยประมาณ (จุดกลางตำบล) + มีชื่อสถานที่ → ค้นด้วยชื่อ ให้ Google หาตำแหน่งจริงแทน
export function navigationUrl(a: {
  latitude: number | null;
  longitude: number | null;
  locationSource: string;
  areaName: string | null;
  district: string;
  amphoe: string;
  province: string;
}): string {
  const base = 'https://www.google.com/maps/dir/?api=1&destination=';
  const precise = a.locationSource !== 'TAMBON' && a.latitude != null && a.longitude != null;
  if (precise) return base + `${a.latitude},${a.longitude}`;
  const place = [a.areaName, `ต.${a.district}`, `อ.${a.amphoe}`, `จ.${a.province}`]
    .filter(Boolean)
    .join(' ');
  if (a.areaName || a.latitude == null || a.longitude == null) return base + encodeURIComponent(place);
  return base + `${a.latitude},${a.longitude}`;
}
