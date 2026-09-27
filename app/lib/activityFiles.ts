// app/lib/activityFiles.ts — กติกาไฟล์แนบ + บันทึกไฟล์ลง uploads/ (ใช้ร่วมระหว่าง POST/PATCH activity)
import path from 'path';
import fs from 'fs/promises';
import prisma from '@/app/lib/db';

export const UPLOAD_ROOT = path.join(process.cwd(), 'uploads');

// รูป: HEIC/HEIF จาก iPhone ถูกแปลงเป็น JPEG ตั้งแต่ฝั่ง browser (เบราว์เซอร์ส่วนใหญ่แสดง HEIC ไม่ได้)
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
export const DOC_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
];
export const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB ต่อไฟล์
export const MAX_TOTAL_SIZE = 60 * 1024 * 1024; // 60MB ต่อการอัปโหลดหนึ่งครั้ง

const mb = (b: number) => Math.round(b / 1024 / 1024);

// ดึงไฟล์จาก formData แล้วตรวจชนิด/ขนาด — คืน error message ถ้าไม่ผ่าน
export function validateFiles(documents: File[], images: File[], extra: File[] = []): string | null {
  for (const f of documents) {
    if (!DOC_TYPES.includes(f.type))
      return `ไฟล์เอกสาร "${f.name}" ต้องเป็น PDF, Word, Excel หรือ PowerPoint`;
    if (f.size > MAX_FILE_SIZE) return `ไฟล์ "${f.name}" เกิน ${mb(MAX_FILE_SIZE)}MB`;
  }
  for (const f of images) {
    if (!IMAGE_TYPES.includes(f.type))
      return `ไฟล์รูป "${f.name}" ต้องเป็น JPG, PNG, WebP หรือ GIF (รูป HEIC จาก iPhone ระบบจะแปลงให้เองเมื่ออัปโหลดผ่านฟอร์ม)`;
    if (f.size > MAX_FILE_SIZE) return `ไฟล์ "${f.name}" เกิน ${mb(MAX_FILE_SIZE)}MB`;
  }
  const total = [...documents, ...images, ...extra].reduce((sum, f) => sum + f.size, 0);
  if (total > MAX_TOTAL_SIZE)
    return `ไฟล์แนบรวมกัน ${mb(total)}MB เกินเพดาน ${mb(MAX_TOTAL_SIZE)}MB ต่อการบันทึกหนึ่งครั้ง`;
  return null;
}

export function filesFrom(formData: FormData, field: string): File[] {
  return formData.getAll(field).filter((f): f is File => f instanceof File && f.size > 0);
}

export async function saveAttachment(
  activityId: number,
  file: File,
  kind: 'DOCUMENT' | 'IMAGE',
  policyLevel: 'VILLAGE' | 'SUBDISTRICT' | 'DISTRICT' | 'PROVINCE' | 'NATIONAL' | null = null
) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = path.extname(file.name) || '';
  const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
  const relPath = path.join('activities', String(activityId), safeName);
  const absPath = path.join(UPLOAD_ROOT, relPath);

  await fs.mkdir(path.dirname(absPath), { recursive: true });
  await fs.writeFile(absPath, buffer);

  return prisma.activityAttachment.create({
    data: {
      activityId,
      kind,
      filePath: relPath.split(path.sep).join('/'),
      fileName: file.name,
      mimeType: file.type,
      size: file.size,
      policyLevel,
    },
  });
}

// ลบไฟล์จริงบนดิสก์ (เงียบ ๆ ถ้าไฟล์หายไปแล้ว)
export async function removeFile(relPath: string) {
  try {
    await fs.rm(path.join(UPLOAD_ROOT, relPath));
  } catch {
    /* ไฟล์ไม่อยู่แล้วก็ไม่เป็นไร */
  }
}

export async function removeActivityDir(activityId: number) {
  try {
    await fs.rm(path.join(UPLOAD_ROOT, 'activities', String(activityId)), {
      recursive: true,
      force: true,
    });
  } catch {
    /* ไม่มีโฟลเดอร์ก็ข้าม */
  }
}
