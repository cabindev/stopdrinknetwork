// app/auth/pending/page.tsx — แจ้งบัญชีรอผู้ดูแลระบบอนุมัติ (role pending)
// สมัครใหม่ (ฟอร์ม/Google) ได้ pending เสมอ → เห็นแค่แผนที่สาธารณะ + กรณีศึกษา จนกว่าแอดมินอนุมัติ
// อ่าน role จาก DB (cookie อาจยังเป็น pending หลังอนุมัติ) — อนุมัติแล้วกดปุ่มเพื่อรีเฟรช session
import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Clock, CheckCircle2 } from 'lucide-react';
import authOptions from '@/app/lib/configs/auth/authOptions';
import prisma from '@/app/lib/db';
import { isStaffRole } from '@/app/lib/activityMeta';
import RefreshSessionButton from './RefreshSessionButton';

export const metadata = { title: 'รออนุมัติบัญชี — Stop Drink Network' };

export default async function PendingPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/auth/signin');
  const user = await prisma.user.findUnique({ where: { id: Number(session.user.id) }, select: { role: true, email: true } });
  const approved = isStaffRole(user?.role);

  return (
    <main className="min-h-screen bg-white pt-24 pb-10 px-4">
      <div className="max-w-md mx-auto text-center">
        {approved ? (
          <>
            <CheckCircle2 className="w-12 h-12 text-orange-600 mx-auto" />
            <h1 className="mt-4 text-xl font-bold text-gray-800">บัญชีได้รับอนุมัติแล้ว</h1>
            <p className="mt-2 text-sm text-gray-500">เข้าใช้งานส่วนของทีมได้แล้ว</p>
            <RefreshSessionButton />
          </>
        ) : (
          <>
            <Clock className="w-12 h-12 text-orange-600 mx-auto" />
            <h1 className="mt-4 text-xl font-bold text-gray-800">บัญชีรอผู้ดูแลระบบอนุมัติ</h1>
            <p className="mt-2 text-sm text-gray-500 leading-relaxed">
              บัญชี <span className="font-medium text-gray-700">{user?.email}</span> สมัครเรียบร้อยแล้ว
              เมื่อผู้ดูแลระบบอนุมัติ คุณจะเห็นงานของเครือข่ายและข้อมูลส่วนของทีม
              ระหว่างนี้ดูแผนที่และกรณีศึกษาที่เผยแพร่ได้ตามปกติ
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <Link href="/map" className="px-4 py-2.5 rounded-xl bg-orange-600 text-white text-sm font-medium hover:bg-orange-700">
                ดูแผนที่
              </Link>
              <Link href="/stories" className="px-4 py-2.5 rounded-xl border border-orange-200 text-orange-700 text-sm font-medium hover:bg-orange-50">
                อ่านกรณีศึกษา
              </Link>
              <Link href="/profile/edit" className="px-4 py-2.5 rounded-xl border border-orange-200 text-orange-700 text-sm font-medium hover:bg-orange-50">
                กรอกข้อมูลโปรไฟล์
              </Link>
            </div>
            <p className="mt-4 text-xs text-gray-400">กรอกหน่วยงานและตำแหน่งในโปรไฟล์ ช่วยให้ผู้ดูแลระบบอนุมัติได้เร็วขึ้น</p>
          </>
        )}
      </div>
    </main>
  );
}
