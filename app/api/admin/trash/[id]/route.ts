// app/api/admin/trash/[id]/route.ts — ถังขยะ (แอดมิน): POST = กู้คืน, DELETE = ลบถาวรทันที (พร้อมไฟล์)
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/app/lib/db';
import { getAdminUser } from '@/app/lib/adminAuth';
import { writeAuditLog } from '@/app/lib/audit';
import { removeActivityDir } from '@/app/lib/activityFiles';

async function findTrashed(idRaw: string) {
  const id = Number(idRaw);
  if (!Number.isInteger(id)) return null;
  // ระบุ deletedAt เอง → ตัวกรองอัตโนมัติใน db.ts ไม่ทับ
  return prisma.activity.findFirst({ where: { id, deletedAt: { not: null } }, select: { id: true, title: true } });
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: 'เฉพาะแอดมินเท่านั้น' }, { status: 403 });
  const a = await findTrashed((await params).id);
  if (!a) return NextResponse.json({ error: 'ไม่พบงานในถังขยะ' }, { status: 404 });

  await prisma.activity.update({ where: { id: a.id }, data: { deletedAt: null, deletedById: null } });
  await writeAuditLog({ action: 'UPDATE', entityId: a.id, entityName: a.title, userId: admin.id, changes: ['กู้คืนจากถังขยะ'] });
  return NextResponse.json({ message: 'กู้คืนแล้ว' });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: 'เฉพาะแอดมินเท่านั้น' }, { status: 403 });
  const a = await findTrashed((await params).id);
  if (!a) return NextResponse.json({ error: 'ไม่พบงานในถังขยะ' }, { status: 404 });

  await prisma.activity.delete({ where: { id: a.id } }); // ไฟล์/นโยบาย/ทีม cascade
  await removeActivityDir(a.id);
  await writeAuditLog({ action: 'DELETE', entityId: a.id, entityName: a.title, userId: admin.id, changes: ['ลบถาวรจากถังขยะ (รวมไฟล์แนบ)'] });
  return NextResponse.json({ message: 'ลบถาวรแล้ว' });
}
