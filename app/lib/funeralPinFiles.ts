// app/lib/funeralPinFiles.ts — ไฟล์แนบของหมุดครอบครัว (server เท่านั้น)
// รูป (PHOTO ≤5, สาธารณะ) และบิล/ใบเสร็จ (BILL ≤10, แอดมิน+ผู้ปัก) เก็บที่ uploads/funeral-pins/<pinId>/
// รูปทุกไฟล์ (รวมบิลที่เป็นรูป) เข้ารหัสใหม่ด้วย sharp: หมุนตาม EXIF แล้ว**ลบ metadata ทั้งหมด** — รูปจากมือถือมีพิกัด GPS ของบ้าน
// และเป็นการยืนยันว่าเป็นรูปจริง (ชนิดไฟล์จาก browser ปลอมได้) · PDF ตรวจหัวไฟล์ %PDF
import path from 'path';
import fs from 'fs/promises';
import sharp from 'sharp';
import prisma from '@/app/lib/db';
import { UPLOAD_ROOT } from '@/app/lib/activityFiles';
import { PIN_FILE_LIMITS } from '@/app/lib/funeralPins';

export type PinFileKind = 'PHOTO' | 'BILL';

const IMAGE_IN = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'];

/** ตรวจจำนวน/ชนิด/ขนาดก่อนสร้างหมุด — คืนข้อความ error หรือ null */
export function validatePinFiles(photos: File[], bills: File[]): string | null {
  const L = PIN_FILE_LIMITS;
  if (photos.length > L.photos) return `แนบรูปได้ไม่เกิน ${L.photos} รูป`;
  if (bills.length > L.bills) return `แนบบิลได้ไม่เกิน ${L.bills} ไฟล์`;
  for (const f of photos) if (!IMAGE_IN.includes(f.type)) return `"${f.name}" ไม่ใช่ไฟล์รูป`;
  for (const f of bills) if (!IMAGE_IN.includes(f.type) && f.type !== 'application/pdf') return `บิล "${f.name}" ต้องเป็นรูปหรือ PDF`;
  for (const f of [...photos, ...bills]) if (f.size > L.fileMB * 1024 * 1024) return `"${f.name}" ใหญ่เกิน ${L.fileMB}MB`;
  const total = [...photos, ...bills].reduce((s, f) => s + f.size, 0);
  if (total > L.totalMB * 1024 * 1024) return `ไฟล์รวมกันเกิน ${L.totalMB}MB`;
  return null;
}

/** บันทึกไฟล์หนึ่งไฟล์ (รูป = เข้ารหัสใหม่เป็น JPEG ≤2000px ไม่มี metadata · PDF = ตรวจหัวไฟล์) */
export async function savePinFile(pinId: number, file: File, kind: PinFileKind) {
  const input = Buffer.from(await file.arrayBuffer());
  let out: Buffer;
  let mimeType: string;
  let ext: string;
  if (file.type === 'application/pdf') {
    if (input.subarray(0, 5).toString('latin1') !== '%PDF-') throw new Error(`"${file.name}" ไม่ใช่ไฟล์ PDF ที่ถูกต้อง`);
    out = input;
    mimeType = 'application/pdf';
    ext = '.pdf';
  } else {
    try {
      out = await sharp(input, { failOn: 'error' })
        .rotate()
        .resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 82, mozjpeg: true })
        .toBuffer();
    } catch {
      throw new Error(`เปิดรูป "${file.name}" ไม่ได้ ลองส่งเป็น JPG หรือ PNG`);
    }
    mimeType = 'image/jpeg';
    ext = '.jpg';
  }
  const name = `${kind.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
  const rel = ['funeral-pins', String(pinId), name].join('/');
  const abs = path.join(UPLOAD_ROOT, rel);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, out);
  return prisma.funeralPinFile.create({
    data: { pinId, kind, filePath: rel, fileName: file.name.slice(0, 255) || name, mimeType, size: out.length },
  });
}

/** ลบโฟลเดอร์ไฟล์ของหมุด (ลบหมุด / สร้างหมุดไม่สำเร็จ) */
export async function removePinDir(pinId: number) {
  await fs.rm(path.join(UPLOAD_ROOT, 'funeral-pins', String(pinId)), { recursive: true, force: true }).catch(() => {});
}

export const pinFileAbs = (rel: string) => {
  const abs = path.join(UPLOAD_ROOT, rel);
  // กัน path traversal — ต้องอยู่ใต้ uploads/funeral-pins เท่านั้น
  if (!abs.startsWith(path.join(UPLOAD_ROOT, 'funeral-pins') + path.sep)) throw new Error('bad path');
  return abs;
};
