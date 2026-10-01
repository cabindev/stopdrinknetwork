// app/lib/imageVariant.ts — รูปขนาดสำเร็จรูปสำหรับหน้าสาธารณะ (/api/public-files/[id]?v=card|cover)
// ตัดขอบพื้นเรียบ (ขาว/สีเดียว เช่น รูปที่ทำเป็นแผ่นโปสเตอร์มีขอบขาว) แล้วครอบเป็น 16:9 เต็มกรอบ
// cache ไว้ใน uploads/.cache/ — ถ้าไฟล์ต้นฉบับใหม่กว่า cache ทำใหม่
import path from 'path';
import fs from 'fs/promises';
import sharp from 'sharp';

export const VARIANTS = {
  card: { width: 640, height: 360 }, // การ์ดในหน้ารายการ
  cover: { width: 1280, height: 720 }, // รูปปก/แกลเลอรี/og:image
} as const;
export type Variant = keyof typeof VARIANTS;

const CACHE_DIR = path.join(process.cwd(), 'uploads', '.cache');

// รูปที่เป็น 16:9 อยู่แล้ว (สไลด์/ปกที่ออกแบบจาก Canva) ย่ออย่างเดียว ไม่ตัดขอบ ไม่ครอบ —
// ตัดขอบพื้นเรียบบนสไลด์จะกินแถบว่างบน-ล่าง ภาพจึงกว้างเกิน 16:9 แล้วถูกครอบซ้ายขวาทิ้ง
// ตัวหนังสือชิดขอบหาย (เจอกับปกงานช้าง ต.ค. 2026)
const ASPECT_TOLERANCE = 0.03;

export function isNearAspect(width: number, height: number, target: number): boolean {
  if (!width || !height) return false;
  return Math.abs(width / height - target) / target < ASPECT_TOLERANCE;
}

export async function imageVariant(srcAbs: string, attachmentId: number, variant: Variant): Promise<Buffer> {
  // -v2: เปลี่ยนวิธีครอบเมื่อ ต.ค. 2026 — ชื่อใหม่ให้ไฟล์ cache ที่ครอบแบบเก่าถูกสร้างใหม่
  const out = path.join(CACHE_DIR, `${attachmentId}-${variant}-v2.webp`);
  const [src, cached] = await Promise.all([fs.stat(srcAbs), fs.stat(out).catch(() => null)]);
  if (cached && cached.mtimeMs >= src.mtimeMs) return fs.readFile(out);

  const { width, height } = VARIANTS[variant];
  const input = await fs.readFile(srcAbs);
  const meta = await sharp(input).metadata();
  // metadata() ไม่หมุนตาม EXIF — orientation 5-8 คือรูปตะแคง ต้องสลับกว้าง/สูงเอง
  const turned = (meta.orientation ?? 1) >= 5;
  const [w, h] = turned ? [meta.height ?? 0, meta.width ?? 0] : [meta.width ?? 0, meta.height ?? 0];
  if (isNearAspect(w, h, width / height)) {
    const buf = await sharp(input)
      .rotate()
      .resize(width, height, { fit: 'cover', position: 'centre' })
      .webp({ quality: 82 })
      .toBuffer();
    await fs.mkdir(CACHE_DIR, { recursive: true });
    await fs.writeFile(out, buf);
    return buf;
  }
  // ตัดขอบพื้นเรียบ — ถ้าตัดแล้วเหลือไม่ถึงครึ่งของภาพเดิม (ภาพท้องฟ้า/ผนังสีเดียว) ใช้ภาพเดิม
  let base: Buffer = input;
  try {
    const trimmed = await sharp(input).rotate().trim({ threshold: 25 }).toBuffer({ resolveWithObject: true });
    const kept = (trimmed.info.width * trimmed.info.height) / ((meta.width ?? 1) * (meta.height ?? 1));
    if (kept >= 0.5) base = trimmed.data;
  } catch {
    // ตัดขอบไม่ได้ (ภาพสีเดียวทั้งภาพ ฯลฯ) ใช้ภาพเดิม
  }
  const buf = await sharp(base)
    .rotate() // หมุนตาม EXIF (รูปมือถือ)
    .resize(width, height, { fit: 'cover', position: 'attention' }) // ครอบ 16:9 เลือกจุดที่มีรายละเอียด
    .webp({ quality: 82 })
    .toBuffer();
  await fs.mkdir(CACHE_DIR, { recursive: true });
  await fs.writeFile(out, buf);
  return buf;
}
