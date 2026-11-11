// app/lib/policyLevelColors.ts — สีประจำระดับนโยบาย แหล่งเดียว ใช้ทั้งแดชบอร์ด (พาย/การ์ด/ตาราง) และหมุดบนแผนที่
// (ผู้ใช้ขอ 11 พ.ย. 2026 — เดิมแดชบอร์ดไล่เทา→ดำ "ดูยาก" และหมุดแผนที่ใช้ชุดเหลือง→แดงเลือดหมูคนละชุด)
// 5 เฉดต่างกัน: หมู่บ้าน amber · ตำบล emerald · อำเภอ sky · จังหวัด violet · ประเทศ rose
//   FILL = พาสเทล (ชิ้นพาย/จุดสี) · TINT = พื้นอ่อน (การ์ด/ชิป) · INK = ตัวอักษรเข้ม (อ่านบน TINT)
//   PIN  = เฉดกลางของสีเดียวกัน (Tailwind 600) — พาสเทลบนแผนที่ OSM จางจนมองไม่เห็น จึงใช้เข้มกว่าแต่สีเดียวกัน
import type { PolicyLevelValue } from './activityMeta';

export const LEVEL_FILL: Record<PolicyLevelValue, string> = {
  VILLAGE: '#fcd34d',
  SUBDISTRICT: '#6ee7b7',
  DISTRICT: '#7dd3fc',
  PROVINCE: '#c4b5fd',
  NATIONAL: '#fda4af',
};
export const LEVEL_TINT: Record<PolicyLevelValue, string> = {
  VILLAGE: '#fffbeb',
  SUBDISTRICT: '#ecfdf5',
  DISTRICT: '#f0f9ff',
  PROVINCE: '#f5f3ff',
  NATIONAL: '#fff1f2',
};
export const LEVEL_INK: Record<PolicyLevelValue, string> = {
  VILLAGE: '#92400e',
  SUBDISTRICT: '#065f46',
  DISTRICT: '#075985',
  PROVINCE: '#5b21b6',
  NATIONAL: '#9f1239',
};
export const LEVEL_PIN_COLOR: Record<PolicyLevelValue, string> = {
  VILLAGE: '#d97706',
  SUBDISTRICT: '#059669',
  DISTRICT: '#0284c7',
  PROVINCE: '#7c3aed',
  NATIONAL: '#e11d48',
};
