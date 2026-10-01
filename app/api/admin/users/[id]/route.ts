// app/api/admin/users/[id]/route.ts — DELETE = ปฏิเสธบัญชีที่สมัครใหม่ (role pending) แอดมินเท่านั้น
// ลบได้เฉพาะ pending ที่ไม่มีงาน/ทีม/ประวัติ — บัญชีที่เคยอนุมัติแล้วห้ามลบที่นี่ (ข้อมูลงานผูกอยู่)
// _count ของ relation ไม่ผ่านตัวกรองถังขยะใน db.ts → นับงานในถังขยะด้วย (ตั้งใจ)
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import prisma from '@/app/lib/db';
import { getAdminUser } from '@/app/lib/adminAuth';

const AVATAR_DIR = path.join(process.cwd(), 'uploads', 'avatars');

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: 'เฉพาะผู้ดูแลระบบ' }, { status: 403 });

  const id = Number((await params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'ไม่พบผู้ใช้' }, { status: 404 });
  const user = await prisma.user.findUnique({
    where: { id },
    select: { role: true, image: true, _count: { select: { activities: true, teamWorks: true, auditLogs: true } } },
  });
  if (!user) return NextResponse.json({ error: 'ไม่พบผู้ใช้' }, { status: 404 });
  if (user.role !== 'pending') {
    return NextResponse.json({ error: 'ปฏิเสธได้เฉพาะบัญชีที่รออนุมัติ' }, { status: 400 });
  }
  const { activities, teamWorks, auditLogs } = user._count;
  if (activities + teamWorks + auditLogs > 0) {
    return NextResponse.json({ error: 'บัญชีนี้มีข้อมูลงานผูกอยู่ ลบไม่ได้' }, { status: 400 });
  }

  await prisma.user.delete({ where: { id } });
  // รูปโปรไฟล์ที่อัปตอนสมัคร (uploads/avatars/) — ลบตามไปด้วย ไม่ให้ไฟล์ค้าง
  const name = user.image?.startsWith('/api/files/avatars/') ? path.basename(user.image) : null;
  if (name) await fs.rm(path.join(AVATAR_DIR, name)).catch(() => {});

  return NextResponse.json({ message: 'ปฏิเสธบัญชีแล้ว' });
}
