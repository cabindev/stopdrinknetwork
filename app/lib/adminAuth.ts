// app/lib/adminAuth.ts — ตรวจสิทธิ์ admin/superadmin สำหรับ API ฝั่งจัดการระบบ
import { getServerSession } from 'next-auth';
import authOptions from '@/app/lib/configs/auth/authOptions';
import prisma from '@/app/lib/db';

export const ADMIN_ROLES = ['admin', 'superadmin'] as const;

// คืนข้อมูล user ปัจจุบันถ้ามีสิทธิ์ระดับแอดมิน — ไม่งั้นคืน null
export async function getAdminUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, role: true },
  });

  if (!user || !ADMIN_ROLES.includes(user.role as (typeof ADMIN_ROLES)[number])) {
    return null;
  }
  return user;
}
