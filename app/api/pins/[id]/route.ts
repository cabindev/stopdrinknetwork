// app/api/pins/[id]/route.ts — ผู้ปักแก้ไข/ลบหมุดของตัวเอง (แอดมินทำได้ทุกหมุด)
// PATCH multipart: `data` = ฟอร์มทั้งชุด (แทนค่าเดิม) + ไฟล์ใหม่ `photos`/`bills` + `removeFiles` = id ไฟล์เดิมที่ลบ
//   เปลี่ยนตำบล = ย้ายหมุดไปจุดกลางตำบลใหม่ · ตำบลเดิม = หมุดอยู่ที่เดิม
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/app/lib/db';
import { getTambonCoords } from '@/app/lib/tambonCoords';
import { PIN_FILE_LIMITS, PUBLIC_PIN_SELECT, toPublicPin } from '@/app/lib/funeralPins';
import { pinFileAbs, removePinDir, savePinFile, validatePinFiles } from '@/app/lib/funeralPinFiles';
import { InputError, parsePinFields, pinViewer, readPinRequest } from '@/app/lib/funeralPinInput';
import { removeFile } from '@/app/lib/activityFiles';

const headers = { 'Cache-Control': 'no-store' };
type Ctx = { params: Promise<{ id: string }> };

async function ownedPin(params: Ctx['params']) {
  const { id } = await params;
  const n = Number(id);
  const { userId, admin } = await pinViewer();
  if (!userId) return { error: NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401, headers }) };
  const pin =
    Number.isInteger(n) && n > 0
      ? await prisma.funeralPin.findUnique({
          where: { id: n },
          select: {
            id: true,
            userId: true,
            district: true,
            amphoe: true,
            province: true,
            files: { select: { id: true, kind: true, filePath: true } },
          },
        })
      : null;
  if (!pin) return { error: NextResponse.json({ error: 'ไม่พบหมุด' }, { status: 404, headers }) };
  if (!admin && pin.userId !== userId) return { error: NextResponse.json({ error: 'แก้ได้เฉพาะหมุดของตัวเอง' }, { status: 403, headers }) };
  return { pin };
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { pin, error } = await ownedPin(params);
  if (error) return error;
  try {
    const { body, photos, bills, removeFiles } = await readPinRequest(req);
    const fileError = validatePinFiles(photos, bills);
    if (fileError) throw new InputError(fileError);
    const removing = pin.files.filter((f) => removeFiles.includes(f.id));
    const keep = pin.files.filter((f) => !removeFiles.includes(f.id));
    if (keep.filter((f) => f.kind === 'PHOTO').length + photos.length > PIN_FILE_LIMITS.photos)
      throw new InputError(`แนบรูปได้ไม่เกิน ${PIN_FILE_LIMITS.photos} รูป`);
    if (keep.filter((f) => f.kind === 'BILL').length + bills.length > PIN_FILE_LIMITS.bills)
      throw new InputError(`แนบบิลได้ไม่เกิน ${PIN_FILE_LIMITS.bills} ไฟล์`);

    const fields = parsePinFields(body);
    const moved = fields.district !== pin.district || fields.amphoe !== pin.amphoe || fields.province !== pin.province;
    const coords = moved ? getTambonCoords(fields.district, fields.amphoe, fields.province) : null;
    if (moved && !coords) throw new InputError('ไม่พบพิกัดตำบล กรุณาเลือกพื้นที่ใหม่');

    // ไฟล์ใหม่ก่อน — ถ้าบันทึกไม่ได้ ข้อมูลเดิมยังอยู่ครบ
    const added: number[] = [];
    try {
      for (const f of photos) added.push((await savePinFile(pin.id, f, 'PHOTO')).id);
      for (const f of bills) added.push((await savePinFile(pin.id, f, 'BILL')).id);
    } catch (err) {
      const rows = await prisma.funeralPinFile.findMany({ where: { id: { in: added } }, select: { filePath: true } });
      await prisma.funeralPinFile.deleteMany({ where: { id: { in: added } } });
      for (const r of rows) await removeFile(r.filePath);
      throw new InputError((err as Error).message || 'บันทึกไฟล์แนบไม่สำเร็จ');
    }

    await prisma.funeralPin.update({
      where: { id: pin.id },
      data: {
        ...fields,
        ...(coords ? { latitude: coords.lat + (Math.random() - 0.5) * 0.016, longitude: coords.lng + (Math.random() - 0.5) * 0.016 } : {}),
      },
    });
    if (removing.length) {
      await prisma.funeralPinFile.deleteMany({ where: { id: { in: removing.map((f) => f.id) }, pinId: pin.id } });
      for (const f of removing) {
        pinFileAbs(f.filePath); // ตรวจ path ก่อนลบ
        await removeFile(f.filePath);
      }
    }
    const row = await prisma.funeralPin.findUniqueOrThrow({ where: { id: pin.id }, select: PUBLIC_PIN_SELECT });
    return NextResponse.json({ ok: true, pin: toPublicPin(row) }, { headers });
  } catch (e) {
    if (e instanceof InputError) return NextResponse.json({ error: e.message }, { status: 400, headers });
    console.error('[api/pins/:id] update failed', e);
    return NextResponse.json({ error: 'บันทึกไม่สำเร็จ ลองอีกครั้ง' }, { status: 500, headers });
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { pin, error } = await ownedPin(params);
  if (error) return error;
  await prisma.funeralPin.delete({ where: { id: pin.id } });
  await removePinDir(pin.id);
  return NextResponse.json({ ok: true }, { headers });
}
