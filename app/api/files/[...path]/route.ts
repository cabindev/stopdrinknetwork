// app/api/files/[...path]/route.ts — serve ไฟล์แนบจากโฟลเดอร์ uploads/ (นอก public/)
// เก็บนอก public เพราะ production build จะไม่ serve ไฟล์ที่เพิ่มหลัง build
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import path from 'path';
import fs from 'fs/promises';
import authOptions from '@/app/lib/configs/auth/authOptions';
import { isStaffRole } from '@/app/lib/activityMeta';
import { NO_STORE } from '@/app/lib/activityFiles';
import prisma from '@/app/lib/db';
import { imageVariant, VARIANTS } from '@/app/lib/imageVariant';
import type { Variant } from '@/app/lib/imageVariant';

const UPLOAD_ROOT = path.join(process.cwd(), 'uploads');

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401, headers: NO_STORE });
  }

  const { path: segments } = await params;
  // บัญชีรออนุมัติ: เปิดได้แค่รูปโปรไฟล์ (avatars/) — ไฟล์แนบของงานเป็นข้อมูลภายใน
  if (!isStaffRole(session.user.role) && segments[0] !== 'avatars') {
    return NextResponse.json({ error: 'บัญชีรอผู้ดูแลระบบอนุมัติ' }, { status: 403, headers: NO_STORE });
  }
  const filePath = path.join(UPLOAD_ROOT, ...segments);

  // กัน path traversal — ไฟล์ที่ resolve แล้วต้องอยู่ใต้ uploads/ เท่านั้น
  if (!path.resolve(filePath).startsWith(path.resolve(UPLOAD_ROOT) + path.sep)) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400, headers: NO_STORE });
  }

  try {
    // ?v=card|cover → รูปย่อ 16:9 WebP (lib/imageVariant.ts, cache uploads/.cache/) สำหรับการ์ด/แถบรูป —
    // ต้นฉบับ ~1MB ต่อรูป ไม่ต้องโหลดมาแสดงแค่ 160px · ต้องเป็นรูปของงาน (หา id จาก filePath เป็นชื่อ cache)
    const v = request.nextUrl.searchParams.get('v') as Variant | null;
    if (v && v in VARIANTS && segments[0] === 'activities') {
      const rel = segments.join('/');
      const att = await prisma.activityAttachment.findFirst({ where: { filePath: rel, kind: 'IMAGE' }, select: { id: true } });
      if (att) {
        const out = await imageVariant(filePath, att.id, v);
        return new NextResponse(new Uint8Array(out), {
          headers: { 'Content-Type': 'image/webp', 'Cache-Control': 'private, max-age=86400', 'X-Content-Type-Options': 'nosniff' },
        });
      }
    }
    const buffer = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mime: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': mime[ext] || 'application/octet-stream',
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch {
    return NextResponse.json({ error: 'ไม่พบไฟล์' }, { status: 404, headers: NO_STORE });
  }
}
