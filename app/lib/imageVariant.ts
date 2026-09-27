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

export async function imageVariant(srcAbs: string, attachmentId: number, variant: Variant): Promise<Buffer> {
  const out = path.join(CACHE_DIR, `${attachmentId}-${variant}.webp`);
  const [src, cached] = await Promise.all([fs.stat(srcAbs), fs.stat(out).catch(() => null)]);
  if (cached && cached.mtimeMs >= src.mtimeMs) return fs.readFile(out);

  const { width, height } = VARIANTS[variant];
  const input = await fs.readFile(srcAbs);
  const meta = await sharp(input).metadata();
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
