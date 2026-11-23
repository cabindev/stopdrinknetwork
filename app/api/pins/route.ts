// app/api/pins/route.ts — หมุดงานศพปลอดเหล้าของครอบครัว
// GET  = สาธารณะ: หมุดที่ไม่ถูกซ่อน (ไม่มีผู้ปัก/เบอร์/ชื่อผู้วายชนม์ที่ไม่อนุญาตให้แสดง) · ?since=<id> สำหรับดึงหมุดใหม่บนจอแผนที่
// POST = ต้อง login (ทุก role รวม pending — ไม่ต้องเป็นแอดมิน) · ขึ้นแผนที่ทันที แอดมินซ่อน/ลบทีหลังที่ /dashboard/pins
//        multipart: `data` = JSON ของฟอร์ม + ไฟล์ `photos` (≤5) / `bills` (≤10) — หรือส่ง JSON ล้วนถ้าไม่มีไฟล์
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/app/lib/db';
import { getTambonCoords } from '@/app/lib/tambonCoords';
import { removePinDir, savePinFile, validatePinFiles } from '@/app/lib/funeralPinFiles';
import { InputError, parsePinFields, pinViewer, readPinRequest } from '@/app/lib/funeralPinInput';
import { PIN_SOURCE, PUBLIC_PIN_SELECT, toPublicPin } from '@/app/lib/funeralPins';

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

export async function POST(req: NextRequest) {
  const { userId } = await pinViewer();
  if (!userId) return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อนปักหมุด' }, { status: 401, headers });

  const now = Date.now();
  const recent = (recentByUser.get(userId) ?? []).filter((t) => now - t < 3_600_000);
  if (recent.length >= RATE_MAX) return NextResponse.json({ error: 'ปักหมุดถี่เกินไป ลองใหม่ภายหลัง' }, { status: 429, headers });

  try {
    const { body, photos, bills } = await readPinRequest(req);
    const fileError = validatePinFiles(photos, bills);
    if (fileError) throw new InputError(fileError);
    const fields = parsePinFields(body);
    const coords = getTambonCoords(fields.district, fields.amphoe, fields.province);
    if (!coords) throw new InputError('ไม่พบพิกัดตำบล กรุณาเลือกพื้นที่ใหม่');

    recent.push(now);
    recentByUser.set(userId, recent);

    const row = await prisma.funeralPin.create({
      data: {
        ...fields,
        userId,
        kind: 'FAMILY',
        // จุดกลางตำบล + กระจาย ~±900 ม. — หมุดในตำบลเดียวกันไม่ซ้อน และไม่ใช่ตำแหน่งบ้าน
        latitude: coords.lat + (Math.random() - 0.5) * 0.016,
        longitude: coords.lng + (Math.random() - 0.5) * 0.016,
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
