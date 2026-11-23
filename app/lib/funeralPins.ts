export const PIN_KINDS = { FAMILY: 'ครอบครัว', VILLAGE: 'หมู่บ้าน/ชุมชน', TEMPLE: 'วัด', SUBDISTRICT: 'ตำบล/เทศบาล', OTHER: 'อื่น ๆ' } as const;
export const PIN_PRACTICES = {
  no_alcohol: 'ไม่เลี้ยงเหล้า',
  fewer_days: 'ลดจำนวนวัน',
  no_takeaway: 'งด/ลดของห่อกลับ',
  monks_no_fee: 'พระสวดไม่รับซอง',
  simple_coffin: 'หีบ/ดอกไม้เรียบง่าย',
  potluck: 'ญาติและเพื่อนบ้านช่วยกันทำอาหาร',
  community_rule: 'มีข้อตกลงชุมชน',
} as const;
export const PIN_SOURCE = 'ubon-2026-11-27';
export const PIN_WINDOW = { from: '2026-11-27T00:00:00+07:00', to: '2026-11-28T00:00:00+07:00' };
export function pinsOpen(now = new Date()): boolean {
  return (
    process.env.NODE_ENV !== 'production' ||
    process.env.PINS_FORCE_OPEN === '1' ||
    (now >= new Date(PIN_WINDOW.from) && now < new Date(PIN_WINDOW.to))
  );
}
export interface PublicPin {
  id: number;
  kind: string;
  displayName: string | null;
  district: string;
  amphoe: string;
  province: string;
  latitude: number;
  longitude: number;
  yearBE: number | null;
  practices: string[];
  savedAmount: number | null;
  story: string | null;
  createdAt: string;
}
export const PUBLIC_PIN_SELECT = {
  id: true,
  kind: true,
  displayName: true,
  district: true,
  amphoe: true,
  province: true,
  latitude: true,
  longitude: true,
  yearBE: true,
  practices: true,
  savedAmount: true,
  story: true,
  createdAt: true,
} as const;
export function toPublicPin(row: {
  id: number;
  kind: string;
  displayName: string | null;
  district: string;
  amphoe: string;
  province: string;
  latitude: number;
  longitude: number;
  yearBE: number | null;
  practices: unknown;
  savedAmount: number | null;
  story: string | null;
  createdAt: Date;
}): PublicPin {
  return {
    ...row,
    practices: Array.isArray(row.practices) ? row.practices.filter((x): x is string => typeof x === 'string') : [],
    createdAt: row.createdAt.toISOString(),
  };
}
export function pinTitle(p: Pick<PublicPin, 'displayName' | 'kind'>): string {
  return p.displayName || `${PIN_KINDS[p.kind as keyof typeof PIN_KINDS] ?? 'ชุมชน'}หนึ่ง`;
}
