// app/api/pin-files/[id]/route.ts — เสิร์ฟไฟล์แนบของหมุดครอบครัว
// PHOTO ของหมุดที่ไม่ถูกซ่อน = สาธารณะ · BILL / หมุดที่ซ่อน = แอดมินหรือผู้ปักเท่านั้น
import fs from 'fs/promises';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/lib/configs/auth/authOptions';
import prisma from '@/app/lib/db';
import { NO_STORE } from '@/app/lib/activityFiles';
import { ADMIN_ROLES } from '@/app/lib/adminAuth';
import { pinFileAbs } from '@/app/lib/funeralPinFiles';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) return NextResponse.json({ error: 'ไม่พบไฟล์' }, { status: 404, headers: NO_STORE });
  const file = await prisma.funeralPinFile.findUnique({
    where: { id: n },
    select: { filePath: true, fileName: true, mimeType: true, kind: true, pin: { select: { hidden: true, userId: true } } },
  });
  if (!file) return NextResponse.json({ error: 'ไม่พบไฟล์' }, { status: 404, headers: NO_STORE });

  const isPublic = file.kind === 'PHOTO' && !file.pin.hidden;
  if (!isPublic) {
    const session = await getServerSession(authOptions);
    const uid = Number(session?.user?.id ?? 0);
    const admin = (ADMIN_ROLES as readonly string[]).includes(String(session?.user?.role ?? ''));
    if (!admin && (!uid || uid !== file.pin.userId)) return NextResponse.json({ error: 'ไม่มีสิทธิ์' }, { status: 403, headers: NO_STORE });
  }

  let buf: Buffer;
  try {
    buf = await fs.readFile(pinFileAbs(file.filePath));
  } catch {
    return NextResponse.json({ error: 'ไม่พบไฟล์' }, { status: 404, headers: NO_STORE });
  }
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': file.mimeType,
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
      // รูปสาธารณะ cache ได้ · ไฟล์ที่ต้องมีสิทธิ์ห้าม cache ร่วม (Cloudflare)
      'Cache-Control': isPublic ? 'public, max-age=86400' : 'private, no-store',
    },
  });
}
