// app/api/public-files/[id]/route.ts — ไฟล์สำหรับหน้าเผยแพร่สาธารณะ (ไม่ต้อง login)
// ให้เฉพาะไฟล์ที่แอดมินติ๊ก isPublic และงานที่ isPublished เท่านั้น — ไฟล์อื่นยังต้องผ่าน /api/files (login)
// อ้างด้วย id ของ attachment ไม่ใช่ path → เดา path ไฟล์อื่นไม่ได้
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import prisma from '@/app/lib/db';
import { NO_STORE } from '@/app/lib/activityFiles';
import { imageVariant, VARIANTS } from '@/app/lib/imageVariant';
import type { Variant } from '@/app/lib/imageVariant';

const UPLOAD_ROOT = path.join(process.cwd(), 'uploads');

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return new NextResponse(null, { status: 404, headers: NO_STORE });
  const file = await prisma.activityAttachment.findFirst({
    where: { id, isPublic: true, activity: { isPublished: true, deletedAt: null } },
    select: { filePath: true, mimeType: true, fileName: true },
  });
  if (!file) return new NextResponse(null, { status: 404, headers: NO_STORE });

  const abs = path.join(UPLOAD_ROOT, file.filePath);
  if (!path.resolve(abs).startsWith(path.resolve(UPLOAD_ROOT) + path.sep)) {
    return new NextResponse(null, { status: 404, headers: NO_STORE });
  }
  try {
    // ?v=card|cover → รูปตัดขอบ + ครอบ 16:9 (lib/imageVariant.ts) — เฉพาะไฟล์รูป
    const v = request.nextUrl.searchParams.get('v') as Variant | null;
    if (v && v in VARIANTS && file.mimeType.startsWith('image/')) {
      const out = await imageVariant(abs, id, v);
      return new NextResponse(new Uint8Array(out), {
        headers: { 'Content-Type': 'image/webp', 'Cache-Control': 'public, max-age=86400', 'X-Content-Type-Options': 'nosniff' },
      });
    }
    const buf = await fs.readFile(abs);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': file.mimeType,
        // เอกสารเปิดในแท็บ/ดาวน์โหลดด้วยชื่อเดิม (ภาษาไทยต้อง encode)
        'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
        'Cache-Control': 'public, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return new NextResponse(null, { status: 404, headers: NO_STORE });
  }
}
