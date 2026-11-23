// app/lib/funeralPinInput.ts — อ่าน/ตรวจข้อมูลฟอร์มหมุดครอบครัว (server) ใช้ร่วม POST /api/pins และ PATCH /api/pins/[id]
import type { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/lib/configs/auth/authOptions';
import { ADMIN_ROLES } from '@/app/lib/adminAuth';
import { filesFrom } from '@/app/lib/activityFiles';
import { findRegion } from '@/app/lib/regionLookup';
import { provinceHealthZones } from '@/app/utils/healthZones';
import { PIN_PLACES, PIN_RELATIONS, cleanAnswers } from '@/app/lib/funeralPins';

export class InputError extends Error {}
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) || null : null);

/** ผู้ใช้ปัจจุบัน + เป็นแอดมินไหม */
export async function pinViewer() {
  const session = await getServerSession(authOptions);
  const userId = Number(session?.user?.id ?? 0);
  const admin = (ADMIN_ROLES as readonly string[]).includes(String(session?.user?.role ?? ''));
  return { userId, admin };
}

/** อ่าน body: multipart (`data` JSON + `photos`/`bills` + `removeFiles` JSON) หรือ JSON ล้วน */
export async function readPinRequest(req: NextRequest) {
  let body: Record<string, unknown> | null = null;
  let photos: File[] = [];
  let bills: File[] = [];
  let removeFiles: number[] = [];
  if ((req.headers.get('content-type') ?? '').includes('multipart/form-data')) {
    const fd = await req.formData();
    try {
      body = JSON.parse(String(fd.get('data') ?? ''));
    } catch {
      body = null;
    }
    photos = filesFrom(fd, 'photos');
    bills = filesFrom(fd, 'bills');
    try {
      const r = JSON.parse(String(fd.get('removeFiles') ?? '[]'));
      if (Array.isArray(r)) removeFiles = r.map(Number).filter((n) => Number.isInteger(n) && n > 0);
    } catch {
      /* ไม่มีรายการลบ */
    }
  } else {
    body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  }
  if (!body || typeof body !== 'object') throw new InputError('ข้อมูลไม่ถูกต้อง');
  return { body, photos, bills, removeFiles };
}

/** ตรวจและแปลงช่องของฟอร์ม → ข้อมูลที่บันทึกได้ (ไม่รวมพิกัด/ผู้ปัก) */
export function parsePinFields(b: Record<string, unknown>) {
  const district = str(b.district, 100) ?? '';
  const amphoe = str(b.amphoe, 100) ?? '';
  const province = str(b.province, 100) ?? '';
  if (!findRegion(district, amphoe, province)) throw new InputError('กรุณาเลือกตำบลที่จัดงาน');

  const relation = typeof b.relation === 'string' && Object.hasOwn(PIN_RELATIONS, b.relation) ? b.relation : null;
  if (!relation) throw new InputError('กรุณาเลือกว่าจัดงานให้ใคร');
  const place = typeof b.place === 'string' && Object.hasOwn(PIN_PLACES, b.place) ? b.place : null;
  if (!place) throw new InputError('กรุณาเลือกว่าจัดที่วัดหรือที่บ้าน');

  const answers = cleanAnswers(b.answers);
  if (!answers.days) throw new InputError('กรุณาเลือกจำนวนวันที่จัดงาน');
  if (!answers.alcohol) throw new InputError('กรุณาตอบเรื่องเหล้าเบียร์ในงาน');

  // วันที่จัดงาน (ไม่บังคับ) — ห้ามเป็นวันในอนาคต และไม่เก่ากว่า ค.ศ. 1997 (พ.ศ. 2540)
  let funeralDate: Date | null = null;
  if (typeof b.funeralDate === 'string' && b.funeralDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(b.funeralDate)) throw new InputError('วันที่จัดงานไม่ถูกต้อง');
    funeralDate = new Date(`${b.funeralDate}T00:00:00Z`);
    if (Number.isNaN(funeralDate.getTime()) || funeralDate.getTime() > Date.now() + 86_400_000 || funeralDate.getUTCFullYear() < 1997)
      throw new InputError('วันที่จัดงานไม่ถูกต้อง');
  }

  const totalCost = b.totalCost === '' || b.totalCost == null ? null : Number(b.totalCost);
  if (totalCost !== null && (!Number.isInteger(totalCost) || totalCost < 0 || totalCost > 10_000_000))
    throw new InputError('ค่าใช้จ่ายไม่ถูกต้อง');

  const story = str(b.story, 4000);
  if (story && story.length > 1000) throw new InputError('เรื่องเล่ายาวเกิน 1,000 ตัวอักษร');

  return {
    relation,
    deceasedFirstName: str(b.deceasedFirstName, 100),
    deceasedLastName: str(b.deceasedLastName, 100),
    showDeceasedName: b.showDeceasedName === true,
    funeralDate,
    place,
    answers,
    totalCost,
    district,
    amphoe,
    province,
    region: provinceHealthZones[province] ?? null,
    yearBE: funeralDate ? funeralDate.getUTCFullYear() + 543 : null,
    story,
  };
}
