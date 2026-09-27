// app/api/admin/activities/transfer/route.ts — แอดมินโอนงานให้เจ้าของที่ถูกต้อง (เปลี่ยน Activity.userId)
// ใช้ตอนนำเข้าข้อมูลด้วยบัญชีแอดมินแล้วต้องส่งต่อให้เจ้าหน้าที่ภาค — ผู้รับต้องมีบัญชีในระบบก่อน
// เฉพาะ superadmin (ผู้ใช้ตัดสินใจ ก.ย. 2026) — ใช้ทั้งโอนหลายงานในตาราง และช่อง "ผู้เขียน" ในหน้าแก้ไข
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/app/lib/db';
import { getAdminUser } from '@/app/lib/adminAuth';
import { writeAuditLog } from '@/app/lib/audit';

const MAX_IDS = 500;
const fullName = (u: { firstName: string | null; lastName: string | null; email: string }) =>
  [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email;

export async function POST(request: NextRequest) {
  const admin = await getAdminUser();
  if (admin?.role !== 'superadmin') {
    return NextResponse.json({ error: 'เปลี่ยนผู้เขียนได้เฉพาะ superadmin' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const ids: number[] = Array.isArray(body?.ids)
    ? [...new Set<number>(body.ids.map(Number).filter((n: number) => Number.isInteger(n) && n > 0))]
    : [];
  const toUserId = Number(body?.userId);
  if (ids.length === 0) return NextResponse.json({ error: 'ยังไม่ได้เลือกงาน' }, { status: 400 });
  if (ids.length > MAX_IDS) return NextResponse.json({ error: `โอนได้ครั้งละไม่เกิน ${MAX_IDS} งาน` }, { status: 400 });

  const to = Number.isInteger(toUserId)
    ? await prisma.user.findUnique({ where: { id: toUserId }, select: { id: true, firstName: true, lastName: true, email: true } })
    : null;
  if (!to) return NextResponse.json({ error: 'ไม่พบผู้รับในระบบ' }, { status: 400 });

  const rows = await prisma.activity.findMany({
    where: { id: { in: ids }, NOT: { userId: to.id } }, // งานที่เป็นของผู้รับอยู่แล้ว = ข้าม
    select: { id: true, title: true, user: { select: { firstName: true, lastName: true, email: true } } },
  });
  if (rows.length > 0) {
    await prisma.activity.updateMany({ where: { id: { in: rows.map((r) => r.id) } }, data: { userId: to.id } });
    // ผู้เขียนใหม่เคยอยู่ในทีม → เอาออกจากทีม (เป็นผู้เขียนแล้ว)
    await prisma.activityMember.deleteMany({ where: { activityId: { in: rows.map((r) => r.id) }, userId: to.id } });
    await Promise.all(
      rows.map((r) =>
        writeAuditLog({
          action: 'UPDATE',
          entityId: r.id,
          entityName: r.title,
          userId: admin.id,
          changes: [{ field: 'userId', label: 'ผู้รับผิดชอบ', from: fullName(r.user), to: fullName(to) }],
        })
      )
    );
  }
  return NextResponse.json({ moved: rows.length, skipped: ids.length - rows.length, to: fullName(to) });
}
