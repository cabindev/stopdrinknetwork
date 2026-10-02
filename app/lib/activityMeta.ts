// app/lib/activityMeta.ts — ค่าคงที่ของข้อมูลงานที่ใช้ร่วมกันทั้ง client/server
// (ห้าม import prisma/fs ในไฟล์นี้ — ActivityForm ฝั่ง browser ใช้ด้วย)

export const MAX_IMAGES = 10; // รูปต่องาน (รวมรูปเดิม) — 5 (ก.ย. 2026) → 10 (ผู้ใช้ขอ 1 ต.ค. 2026)
// พื้นที่ที่เกี่ยวข้อง (ActivityArea) ต่องาน — ใช้ทั้งฟอร์มและ server (lib/activityAreas.ts)
export const MAX_EXTRA_AREAS = 20;

// ภาคีที่ร่วมงาน — รายการให้เลือก ไม่พิมพ์อิสระ เพื่อสรุปได้ว่าพื้นที่ไหนภาคีครบ/ขาดใคร
export const PARTNER_OPTIONS = [
  'อบต./เทศบาล',
  'อำเภอ/ฝ่ายปกครอง',
  'ผู้ใหญ่บ้าน/กำนัน/ผู้นำชุมชน',
  'วัด/พระสงฆ์',
  'โรงเรียน/สถานศึกษา',
  'รพ.สต./สาธารณสุข',
  'อสม.',
  'ตำรวจ',
  'กลุ่มเยาวชน',
  'กลุ่มสตรี/ผู้สูงอายุ',
  'ภาคเอกชน/ร้านค้า',
  'องค์กรภาคประชาสังคม',
] as const;

export function parsePartners(v: unknown): string[] {
  const list = Array.isArray(v) ? v : [];
  return list.filter((x): x is string => typeof x === 'string' && (PARTNER_OPTIONS as readonly string[]).includes(x));
}

// ทีมงานของงาน = ผู้เขียน (userId) + สมาชิกทีม (ActivityMember) — ใช้ได้ทั้ง client/server
export type TeamRef = { userId: number; members?: { userId: number }[] };
export const isTeamMember = (a: TeamRef, uid: number) =>
  a.userId === uid || !!a.members?.some((m) => m.userId === uid);
export const isAdminRole = (role: string | undefined) => role === 'admin' || role === 'superadmin';
// ทีมงานที่อนุมัติแล้ว — เห็นข้อมูลภายใน (ชื่อเจ้าหน้าที่/หมุดจริง/ไฟล์) · `pending` (สมัครใหม่รออนุมัติ) เห็นแค่ข้อมูลสาธารณะ
export const isStaffRole = (role: string | undefined) => role === 'member' || isAdminRole(role);
// เพิ่ม/แก้ไข/ลบงาน: admin/superadmin เท่านั้น (ผู้ใช้ตัดสินใจ ต.ค. 2026 — สมาชิกดูได้อย่างเดียว)
// uid/a คงไว้ในลายเซ็นเผื่อกลับไปให้ทีมงานแก้ได้อีก
export const canCreateActivity = (role: string | undefined) => isAdminRole(role);
export const canEditActivity = (role: string | undefined, _uid: number, _a: TeamRef) => isAdminRole(role);

// ใครเห็นเบอร์/LINE ผู้ประสานงาน: แอดมิน (ผู้ใช้ตัดสินใจ) + ทีมงานของงานนั้น
export const canSeeCoordinatorContact = (role: string | undefined, uid: number, a: TeamRef) =>
  isAdminRole(role) || isTeamMember(a, uid);

// รายละเอียดการดำเนินงาน — DB เป็น MySQL TEXT = 65,535 ไบต์ (ไทย 3 ไบต์/ตัว ≈ 21,800 ตัว)
// เพดาน 20,000 ตัวเผื่อระยะ · ไม่ใช้ maxLength ใน textarea (วางข้อความยาวแล้ว browser ตัดท้ายเงียบ ๆ)
export const MAX_DESCRIPTION = 20_000;
export const DESCRIPTION_WARN_AT = 18_000; // ตัวนับเปลี่ยนเป็นสีส้ม
export const DESCRIPTION_SUGGEST_FILE_AT = 3_000; // ยาวกว่านี้ แนะนำแนบรายงานฉบับเต็มเป็นไฟล์
const DESCRIPTION_MAX_BYTES = 65_000; // กันอีโมจิ/อักขระ 4 ไบต์ที่นับตัวอักษรไม่เกินแต่ไบต์เกิน

export function descriptionError(text: string): string | null {
  if (text.length > MAX_DESCRIPTION) {
    return `รายละเอียดยาว ${text.length.toLocaleString('th-TH')} ตัวอักษร เกินเพดาน ${MAX_DESCRIPTION.toLocaleString('th-TH')} ตัว (เกิน ${(text.length - MAX_DESCRIPTION).toLocaleString('th-TH')} ตัว) — สรุปให้สั้นลง แล้วแนบรายงานฉบับเต็มเป็นไฟล์แทน`;
  }
  if (new TextEncoder().encode(text).length > DESCRIPTION_MAX_BYTES) {
    return 'รายละเอียดมีอักขระพิเศษ/อีโมจิมากเกินไปจนเก็บไม่ได้ — ลดความยาวลง หรือแนบเป็นไฟล์แทน';
  }
  return null;
}

// ระดับนโยบาย/ข้อตกลงที่เกิดจากงาน — ค่า = enum PolicyLevel ใน schema
export const POLICY_LEVELS = [
  { value: 'VILLAGE', label: 'หมู่บ้าน' },
  { value: 'SUBDISTRICT', label: 'ตำบล' },
  { value: 'DISTRICT', label: 'อำเภอ' },
  { value: 'PROVINCE', label: 'จังหวัด' },
  { value: 'NATIONAL', label: 'ประเทศ' },
] as const;
export type PolicyLevelValue = (typeof POLICY_LEVELS)[number]['value'];
export const POLICY_LABEL: Record<string, string> = Object.fromEntries(
  POLICY_LEVELS.map((p) => [p.value, p.label])
);

// คืนระดับที่ถูกต้องเรียงตามลำดับ หมู่บ้าน → ประเทศ
export function parsePolicyLevels(v: unknown): PolicyLevelValue[] {
  const set = new Set(Array.isArray(v) ? v : []);
  return POLICY_LEVELS.map((p) => p.value).filter((x) => set.has(x));
}

// ประเภทนโยบาย/ข้อตกลง — จากคำตอบจริงในแบบสำรวจงานศพปลอดเหล้า (ก.ย. 2026)
export const POLICY_TYPES = [
  'ธรรมนูญตำบล/ธรรมนูญสุขภาพ',
  'กติกาชุมชน/ข้อตกลงหมู่บ้าน',
  'ข้อตกลงระดับตำบล',
  'MOU/บันทึกข้อตกลง',
  'นโยบายท้องถิ่น (อบต./เทศบาล)',
  'นโยบาย พชอ.',
  'ประกาศ/คำสั่งจังหวัด',
  'โครงการ',
  'อื่น ๆ',
] as const;

// type (ไม่ใช่ interface) — Prisma รับเป็น Json ได้
export type PolicyDetail = {
  name?: string; // ชื่อนโยบาย เช่น "บุญเมืองยศ งานศพปลอดเหล้า"
  type?: string; // จาก POLICY_TYPES
  year?: number; // ปีที่เริ่มประกาศ (พ.ศ.)
};

// { LEVEL: {name,type,year} } เก็บเฉพาะระดับที่ติ๊ก + ตัดค่าแปลก ๆ ทิ้ง
export function parsePolicyDetails(v: unknown, levels: string[]): Record<string, PolicyDetail> {
  const src = v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
  const out: Record<string, PolicyDetail> = {};
  for (const level of levels) {
    const d = src[level] as Record<string, unknown> | undefined;
    if (!d || typeof d !== 'object') continue;
    const name = typeof d.name === 'string' ? d.name.trim().slice(0, 200) : '';
    const type = typeof d.type === 'string' && (POLICY_TYPES as readonly string[]).includes(d.type) ? d.type : '';
    const yearN = Number(d.year);
    const year = Number.isInteger(yearN) && yearN >= 2400 && yearN <= 2700 ? yearN : undefined;
    if (name || type || year) out[level] = { ...(name && { name }), ...(type && { type }), ...(year && { year }) };
  }
  return out;
}

// แถว ActivityPolicy (DB) → { levels เรียงหมู่บ้าน→ประเทศ, details } รูปเดียวกับที่ฟอร์ม/หน้าแสดงผลใช้
export type PolicyRow = { level: string; name: string | null; type: string | null; year: number | null };
export function policyShape(rows: PolicyRow[] | null | undefined) {
  const list = rows ?? [];
  const levels = parsePolicyLevels(list.map((r) => r.level));
  const details: Record<string, PolicyDetail> = {};
  for (const r of list) {
    const d: PolicyDetail = { ...(r.name && { name: r.name }), ...(r.type && { type: r.type }), ...(r.year != null && { year: r.year }) };
    if (Object.keys(d).length > 0) details[r.level] = d;
  }
  return { levels, details };
}

export const policyDetailText = (d?: PolicyDetail) =>
  d ? [d.name, d.type && `(${d.type})`, d.year && `ปี ${d.year}`].filter(Boolean).join(' ') : '';

// ขอบเขตพื้นที่ — ค่า = enum AreaScope
export const AREA_SCOPES = [
  { value: 'VILLAGE', label: 'หมู่บ้าน/ชุมชน' },
  { value: 'SUBDISTRICT', label: 'ตำบล' },
  { value: 'DISTRICT', label: 'ทั้งอำเภอ' },
  { value: 'PROVINCE', label: 'ทั้งจังหวัด' },
] as const;
export type AreaScopeValue = (typeof AREA_SCOPES)[number]['value'];
export const AREA_SCOPE_LABEL: Record<string, string> = Object.fromEntries(AREA_SCOPES.map((a) => [a.value, a.label]));

// วันเริ่ม: precision YEAR = รู้แค่ปี (เก็บ 1 ม.ค.) → แสดง "ปี 2562" ไม่ใช่ "1 ม.ค. 2562"
// วันที่ → 'YYYY-MM-DD' ตามเวลาไทย (UTC+7) — ห้ามใช้ toISOString().slice(0, 10) ตรง ๆ:
// งานที่นำเข้าด้วยสคริปต์เก็บเที่ยงคืนเวลาไทย (= 17:00 UTC วันก่อน) → อ่านแบบ UTC ได้วันก่อนหน้า 1 วัน
// (หน้าแก้ไขเคยโชว์วันถอยหลัง แล้วกดบันทึกก็เซฟวันผิดทับ) · ค่าที่ฟอร์มบันทึก (เที่ยงคืน UTC) +7 ชม. ยังเป็นวันเดิม
export const toThaiDateInput = (d: Date | null) =>
  d ? new Date(d.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10) : null;

export function formatStartDate(d: Date | string | null, precision: string = 'DAY'): string | null {
  if (!d) return null;
  const date = typeof d === 'string' ? new Date(d) : d;
  if (precision === 'YEAR') return `ปี ${date.getUTCFullYear() + 543}`; // เก็บเป็น 1 ม.ค. UTC
  return new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium' }).format(date);
}
