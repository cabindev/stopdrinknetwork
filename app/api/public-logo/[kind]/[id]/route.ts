// app/api/public-logo/[kind]/[id]/route.ts — โลโก้ประเด็นงาน/ประเด็นย่อย สำหรับหน้าสาธารณะ (ไม่ต้อง login)
// kind = category | sub · ใช้แทนรูปปกของกรณีศึกษาที่ยังไม่มีรูปเปิดเผย — โลโก้ไม่ใช่ข้อมูลส่วนตัว
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import prisma from '@/app/lib/db';

const UPLOAD_ROOT = path.join(process.cwd(), 'uploads');
const TYPES: Record<string, string> = { '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg' };

export async function GET(_request: NextRequest, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const { kind, id: idRaw } = await params;
  const id = Number(idRaw);
  if (!Number.isInteger(id) || !['category', 'sub'].includes(kind)) return new NextResponse(null, { status: 404 });
  const row =
    kind === 'sub'
      ? await prisma.workSubCategory.findUnique({ where: { id }, select: { logo: true } })
      : await prisma.workCategory.findUnique({ where: { id }, select: { logo: true } });
  const rel = row?.logo;
  if (!rel?.startsWith('category-logos/')) return new NextResponse(null, { status: 404 });
  const abs = path.join(UPLOAD_ROOT, rel);
  if (!path.resolve(abs).startsWith(path.resolve(UPLOAD_ROOT) + path.sep)) return new NextResponse(null, { status: 404 });
  try {
    const buf = await fs.readFile(abs);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': TYPES[path.extname(abs).toLowerCase()] ?? 'application/octet-stream',
        'Cache-Control': 'public, max-age=86400', // ชื่อไฟล์โลโก้มี timestamp — เปลี่ยนโลโก้แล้ว URL ใหม่ในหน้า
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
