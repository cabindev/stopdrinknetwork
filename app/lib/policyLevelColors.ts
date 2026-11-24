// app/lib/policyLevelColors.ts — สีประจำระดับนโยบาย แหล่งเดียว ใช้ทั้งแดชบอร์ด (พาย/การ์ด/ตาราง), การ์ดพาย+ภาพสรุปบน /map และหมุดบนแผนที่
// ชุด เหลือง·เทา·ดำ·ขาว (ผู้ใช้เลือก 24 พ.ย. 2026 ให้เหมือนกันทั้งเว็บ — ตามแผนที่สรุปจังหวัด)
// (ประวัติ: 11 พ.ย. 2026 ใช้พาสเทล 5 สี เพราะไล่เทา→ดำล้วน "ดูยาก" — ชุดนี้มีเหลืองช่วยแยก + ขอบดำทุกชิ้น)
//   ตำบล = เหลืองเข้ม · หมู่บ้าน = ขาวเทา · อำเภอ = เทา · จังหวัด = เหลืองอ่อน · ประเทศ = ดำ
//   FILL = ชิ้นพาย/จุดสี (ต้องมีขอบ #111827 — หมู่บ้านเกือบขาว) · ON_FILL = ตัวอักษรบน FILL
//   TINT = พื้นอ่อน (การ์ด/ชิป) · INK = ตัวอักษรบน TINT
//   PIN  = สีหมุดบนแผนที่ OSM — เข้มกว่า FILL (ขาว/เหลืองอ่อนบนแผนที่มองไม่เห็น) แต่โทนเดียวกัน
import type { PolicyLevelValue } from './activityMeta';

export const LEVEL_STROKE = '#111827';
export const LEVEL_FILL: Record<PolicyLevelValue, string> = {
  VILLAGE: '#f3f4f6',
  SUBDISTRICT: '#facc15',
  DISTRICT: '#6b7280',
  PROVINCE: '#fde68a',
  NATIONAL: '#111827',
};
export const LEVEL_ON_FILL: Record<PolicyLevelValue, string> = {
  VILLAGE: '#111827',
  SUBDISTRICT: '#111827',
  DISTRICT: '#ffffff',
  PROVINCE: '#111827',
  NATIONAL: '#ffffff',
};
export const LEVEL_TINT: Record<PolicyLevelValue, string> = {
  VILLAGE: '#f9fafb',
  SUBDISTRICT: '#fefce8',
  DISTRICT: '#f3f4f6',
  PROVINCE: '#fffbeb',
  NATIONAL: '#f3f4f6',
};
export const LEVEL_INK: Record<PolicyLevelValue, string> = {
  VILLAGE: '#111827',
  SUBDISTRICT: '#713f12',
  DISTRICT: '#111827',
  PROVINCE: '#78350f',
  NATIONAL: '#111827',
};
export const LEVEL_PIN_COLOR: Record<PolicyLevelValue, string> = {
  VILLAGE: '#9ca3af',
  SUBDISTRICT: '#eab308',
  DISTRICT: '#4b5563',
  PROVINCE: '#ca8a04',
  NATIONAL: '#111827',
};
