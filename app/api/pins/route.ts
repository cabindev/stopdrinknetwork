// app/api/pins/route.ts — หมุดงานศพปลอดเหล้าของครอบครัว
// GET  = สาธารณะ: หมุดที่ไม่ถูกซ่อน (ไม่มีผู้ปัก/เบอร์/ชื่อผู้วายชนม์ที่ไม่อนุญาตให้แสดง) · ?since=<id> สำหรับดึงหมุดใหม่บนจอแผนที่
// POST = ต้อง login (ทุก role รวม pending — ไม่ต้องเป็นแอดมิน) · ขึ้นแผนที่ทันที แอดมินซ่อน/ลบทีหลังที่ /dashboard/pins
//        multipart: `data` = JSON ของฟอร์ม + ไฟล์ `photos` (≤5) / `bills` (≤10) — หรือส่ง JSON ล้วนถ้าไม่มีไฟล์
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/lib/configs/auth/authOptions';
import prisma from '@/app/lib/db';
import { findRegion } from '@/app/lib/regionLookup';
import { getTambonCoords } from '@/app/lib/tambonCoords';
import { provinceHealthZones } from '@/app/utils/healthZones';
import { removePinDir, savePinFile, validatePinFiles } from '@/app/lib/funeralPinFiles';
import { filesFrom } from '@/app/lib/activityFiles';
import { PIN_PLACES, PIN_RELATIONS, PIN_SOURCE, PUBLIC_PIN_SELECT, cleanAnswers, toPublicPin } from '@/app/lib/funeralPins';

const headers = { 'Cache-Control': 'no-store' };

/** กันกดส่งรัว: ต่อบัญชีไม่เกิน RATE_MAX หมุดใน 1 ชั่วโมง */
const RATE_MAX = 10;
const recentByUser = new Map<number, number[]>();

export async function GET(req: NextRequest) {
  const since = Number(req.nextUrl.searchParams.get('since') || 0);
  const rows = await prisma.funeralPin.findMany({
    where: { hidden: false, ...(since > 0 ? { id: { gt: since } } : {}) },
    select: PUBLIC_PIN_SELECT,
    orderBy: { createdAt: 'asc' },
  });
  return NextResponse.json({ pins: rows.map(toPublicPin) }, { headers });
}

class InputError extends Error {}
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) || null : null);

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = Number(session?.user?.id ?? 0);
  if (!userId) return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อนปักหมุด' }, { status: 401, headers });

  const now = Date.now();
  const recent = (recentByUser.get(userId) ?? []).filter((t) => now - t < 3_600_000);
  if (recent.length >= RATE_MAX) return NextResponse.json({ error: 'ปักหมุดถี่เกินไป ลองใหม่ภายหลัง' }, { status: 429, headers });

  try {
    let b: Record<string, unknown> | null = null;
    let photos: File[] = [];
    let bills: File[] = [];
    if ((req.headers.get('content-type') ?? '').includes('multipart/form-data')) {
      const fd = await req.formData();
      try {
        b = JSON.parse(String(fd.get('data') ?? ''));
      } catch {
        b = null;
      }
      photos = filesFrom(fd, 'photos');
      bills = filesFrom(fd, 'bills');
    } else {
      b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    }
    if (!b || typeof b !== 'object') throw new InputError('ข้อมูลไม่ถูกต้อง');
    const fileError = validatePinFiles(photos, bills);
    if (fileError) throw new InputError(fileError);

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

    // วันที่จัดงาน (ไม่บังคับ) — ห้ามเป็นวันในอนาคต และไม่เก่ากว่า พ.ศ. 2540
    let funeralDate: Date | null = null;
    if (typeof b.funeralDate === 'string' && b.funeralDate) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(b.funeralDate)) throw new InputError('วันที่จัดงานไม่ถูกต้อง');
      funeralDate = new Date(`${b.funeralDate}T00:00:00Z`);
      if (Number.isNaN(funeralDate.getTime()) || funeralDate.getTime() > now + 86_400_000 || funeralDate.getUTCFullYear() < 1997)
        throw new InputError('วันที่จัดงานไม่ถูกต้อง');
    }

    const totalCost = b.totalCost === '' || b.totalCost == null ? null : Number(b.totalCost);
    if (totalCost !== null && (!Number.isInteger(totalCost) || totalCost < 0 || totalCost > 10_000_000))
      throw new InputError('ค่าใช้จ่ายไม่ถูกต้อง');

    const story = str(b.story, 4000);
    if (story && story.length > 1000) throw new InputError('เรื่องเล่ายาวเกิน 1,000 ตัวอักษร');

    const coords = getTambonCoords(district, amphoe, province);
    if (!coords) throw new InputError('ไม่พบพิกัดตำบล กรุณาเลือกพื้นที่ใหม่');

    recent.push(now);
    recentByUser.set(userId, recent);

    const row = await prisma.funeralPin.create({
      data: {
        userId,
        kind: 'FAMILY',
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
        // จุดกลางตำบล + กระจาย ~±900 ม. — หมุดในตำบลเดียวกันไม่ซ้อน และไม่ใช่ตำแหน่งบ้าน
        latitude: coords.lat + (Math.random() - 0.5) * 0.016,
        longitude: coords.lng + (Math.random() - 0.5) * 0.016,
        yearBE: funeralDate ? funeralDate.getUTCFullYear() + 543 : null,
        story,
        source: PIN_SOURCE,
      },
      select: { id: true },
    });
    // ไฟล์แนบ — บันทึกไม่สำเร็จ = ยกเลิกทั้งหมุด (ไม่ทิ้งหมุดครึ่ง ๆ กลาง ๆ ไว้บนแผนที่)
    try {
      for (const f of photos) await savePinFile(row.id, f, 'PHOTO');
      for (const f of bills) await savePinFile(row.id, f, 'BILL');
    } catch (err) {
      await prisma.funeralPin.delete({ where: { id: row.id } }).catch(() => {});
      await removePinDir(row.id);
      throw new InputError((err as Error).message || 'บันทึกไฟล์แนบไม่สำเร็จ');
    }
    const pin = await prisma.funeralPin.findUniqueOrThrow({ where: { id: row.id }, select: PUBLIC_PIN_SELECT });
    return NextResponse.json({ ok: true, pin: toPublicPin(pin) }, { headers });
  } catch (e) {
    if (e instanceof InputError) return NextResponse.json({ error: e.message }, { status: 400, headers });
    console.error('[api/pins] create failed', e);
    return NextResponse.json({ error: 'บันทึกไม่สำเร็จ ลองอีกครั้ง' }, { status: 500, headers });
  }
}
