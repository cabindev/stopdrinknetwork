// app/lib/logoStorage.ts — เก็บ/ลบไฟล์โลโก้ (ประเด็นงาน + ประเด็นย่อย) ใต้ uploads/category-logos/
// browser ตัดขอบว่าง + ย่อเป็น WebP 256px มาแล้ว (lib/logoImage.ts) — ที่นี่ตรวจชนิด/ขนาดซ้ำ
// ไม่รับ SVG: เปิดตรงผ่าน /api/files ได้ = มีสคริปต์ฝังได้ (XSS)
import path from 'path';
import fs from 'fs/promises';

const UPLOAD_ROOT = path.join(process.cwd(), 'uploads');
const DIR = 'category-logos';
const MAX_BYTES = 1024 * 1024; // หลังบีบอัดเหลือหลัก KB — เกิน 1MB แปลว่าไม่ได้ผ่านการบีบอัด
const EXT: Record<string, string> = { 'image/webp': '.webp', 'image/png': '.png', 'image/jpeg': '.jpg' };

export async function saveLogo(file: unknown, prefix: string) {
  if (!(file instanceof File) || file.size === 0) return { error: 'กรุณาเลือกไฟล์โลโก้' } as const;
  const ext = EXT[file.type];
  if (!ext) return { error: 'รองรับเฉพาะ WebP, PNG, JPG' } as const;
  if (file.size > MAX_BYTES) return { error: 'ไฟล์โลโก้ใหญ่เกิน 1MB' } as const;
  await fs.mkdir(path.join(UPLOAD_ROOT, DIR), { recursive: true });
  // ชื่อไฟล์มี timestamp — เปลี่ยนโลโก้แล้ว cache ของ browser (max-age 1 ชม.) ไม่ค้างรูปเก่า
  const rel = `${DIR}/${prefix}-${Date.now()}${ext}`;
  await fs.writeFile(path.join(UPLOAD_ROOT, rel), Buffer.from(await file.arrayBuffer()));
  return { rel } as const;
}

export async function removeLogoFile(rel: string | null) {
  if (!rel?.startsWith(`${DIR}/`)) return;
  await fs.unlink(path.join(UPLOAD_ROOT, rel)).catch(() => {});
}
