// app/lib/audit.ts — บันทึก audit log ของ Activity (ใคร แก้อะไร เมื่อไหร่)
import prisma from '@/app/lib/db';

export interface FieldChange {
  field: string;
  label: string;
  from: string;
  to: string;
}

// ฟิลด์ที่ติดตาม + ชื่อภาษาไทยสำหรับแสดงผล
const TRACKED: { field: string; label: string }[] = [
  { field: 'title', label: 'ชื่อกิจกรรม' },
  { field: 'description', label: 'รายละเอียด' },
  { field: 'categoryName', label: 'ประเด็นงาน' },
  { field: 'subCategoryName', label: 'ประเด็นย่อย' },
  { field: 'statusLabel', label: 'สถานะ' },
  { field: 'areaName', label: 'ชื่อชุมชน/พื้นที่' },
  { field: 'pinLabel', label: 'ตำแหน่งหมุด' },
  { field: 'district', label: 'ตำบล' },
  { field: 'amphoe', label: 'อำเภอ' },
  { field: 'province', label: 'จังหวัด' },
  { field: 'participantCount', label: 'จำนวนผู้เข้าร่วม' },
  { field: 'partnersText', label: 'ภาคีที่ร่วม' },
  { field: 'policyText', label: 'นโยบาย/ข้อตกลง (ระดับ)' },
  { field: 'policyDetailsText', label: 'รายละเอียดนโยบาย' },
  { field: 'teamText', label: 'ทีมงานร่วม' },
  { field: 'areaScopeLabel', label: 'ขอบเขตพื้นที่' },
  { field: 'coverageText', label: 'ความครอบคลุม' },
  { field: 'coordinatorName', label: 'ผู้ประสานงาน' },
  // ประวัติการแก้ไขสมาชิกทุกคนเห็น → เก็บแค่ว่ามี/ไม่มีช่องทางติดต่อ ไม่เก็บเบอร์/LINE จริง
  { field: 'coordinatorContact', label: 'ช่องทางติดต่อผู้ประสานงาน' },
  { field: 'startDate', label: 'วันเริ่ม' },
  { field: 'endDate', label: 'วันสิ้นสุด' },
];

export const STATUS_LABEL: Record<string, string> = {
  PLANNING: 'วางแผน',
  ACTIVE: 'กำลังดำเนินการ',
  COMPLETED: 'เสร็จสิ้น',
};

const asText = (v: unknown): string => {
  if (v === null || v === undefined || v === '') return '—';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v);
};

// เทียบค่าเก่า-ใหม่ คืนเฉพาะฟิลด์ที่เปลี่ยนจริง
export function diffFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>
): FieldChange[] {
  const changes: FieldChange[] = [];
  for (const { field, label } of TRACKED) {
    const from = asText(before[field]);
    const to = asText(after[field]);
    if (from !== to) changes.push({ field, label, from, to });
  }
  return changes;
}

export async function writeAuditLog(params: {
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  entityId: number;
  entityName: string;
  userId: number;
  changes?: (FieldChange | string)[]; // string = โน้ตอิสระ เช่น "เพิ่มไฟล์แนบ 2 ไฟล์"
}) {
  const { action, entityId, entityName, userId, changes } = params;
  try {
    await prisma.auditLog.create({
      data: {
        action,
        entityType: 'Activity',
        entityId,
        entityName,
        userId,
        changes: changes && changes.length > 0 ? JSON.stringify(changes) : null,
      },
    });
  } catch (error) {
    // audit ต้องไม่ทำให้การทำงานหลักล้มเหลว — log ไว้แล้วปล่อยผ่าน
    console.error('writeAuditLog failed:', error);
  }
}

// แปลง changes ที่เก็บเป็น JSON string กลับเป็น object (ทนต่อข้อมูลเสีย)
export function parseChanges(raw: string | null): (FieldChange | string)[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
