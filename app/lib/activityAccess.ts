// app/lib/activityAccess.ts — ฝั่ง server: งานที่ "เกี่ยวข้องกับฉัน" (ผู้เขียนหรือทีมงาน) + ถังขยะ
import prisma from '@/app/lib/db';
import { removeActivityDir } from '@/app/lib/activityFiles';

// where ของงานที่ผู้ใช้เป็นผู้เขียนหรือสมาชิกทีม — ใช้ใน "งานของฉัน", โปรไฟล์, export mine=1
export const involvedWhere = (userId: number) => ({
  OR: [{ userId }, { members: { some: { userId } } }],
});

// ถังขยะเก็บ 30 วัน แล้วลบถาวรพร้อมไฟล์ (เรียกตอนมีการลบงาน/เปิดหน้าถังขยะ — ไม่ต้องมี cron)
export const TRASH_DAYS = 30;
export async function purgeExpiredTrash() {
  const cutoff = new Date(Date.now() - TRASH_DAYS * 86_400_000);
  const expired = await prisma.activity.findMany({
    where: { deletedAt: { lt: cutoff } },
    select: { id: true },
  });
  for (const { id } of expired) {
    await prisma.activity.delete({ where: { id } }); // attachments/policies/members cascade
    await removeActivityDir(id);
  }
  return expired.length;
}

// รายชื่อสำหรับเลือกทีมงาน — ชื่อ/หน่วยงาน/รูปเท่านั้น (ไม่ส่งอีเมล/เบอร์ให้ member ทั่วไป)
export async function teamPeople() {
  const users = await prisma.user.findMany({
    where: { role: { not: 'pending' } }, // บัญชีรออนุมัติยังไม่ใช่ทีมงาน
    select: { id: true, firstName: true, lastName: true, organization: true, image: true },
    orderBy: [{ firstName: 'asc' }],
  });
  return users.map((u) => ({
    id: u.id,
    name: `${u.firstName} ${u.lastName}`.trim(),
    organization: u.organization,
    image: u.image,
  }));
}
