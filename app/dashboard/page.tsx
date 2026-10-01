// app/dashboard/page.tsx
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import authOptions from '../lib/configs/auth/authOptions';
import QuickActions from './components/QuickActions';
import StatsOverview from './components/StatsOverview';
import Link from 'next/link';
import { Clock } from 'lucide-react';
import prisma from '../lib/db';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/auth/signin?callbackUrl=/dashboard');
  }

  const { year } = await searchParams;
  const yearNum = Number(year) || undefined;
  const isAdmin = ['admin', 'superadmin'].includes(session.user.role);
  const user = session.user;
  const buddhistYear = new Date().getFullYear() + 543;
  // บัญชีสมัครใหม่ที่รออนุมัติ — แจ้งเตือนบนแดชบอร์ดให้แอดมินเห็นทันที
  const pendingCount = isAdmin ? await prisma.user.count({ where: { role: 'pending' } }) : 0;

  const today = new Date().toLocaleDateString('th-TH', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
  });

  return (
    <div className="min-h-screen">
      <div className="max-w-6xl mx-auto px-5 py-8 space-y-8">

        {/* Greeting */}
        <div>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-[11px] tracking-[0.2em] text-orange-600 uppercase mb-2">
                Stop Drink Network · พ.ศ. {buddhistYear}
              </p>
              <h1 className="text-3xl font-bold text-gray-900">
                สวัสดี, {user.firstName}
              </h1>
              <p className="text-sm text-gray-400 mt-1">
                {isAdmin ? 'แดชบอร์ดผู้ดูแลระบบ' : 'แดชบอร์ดผู้ใช้งาน'} · เครือข่ายงดเหล้า
              </p>
            </div>
            <div className="text-right">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                isAdmin ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isAdmin ? 'bg-orange-500' : 'bg-gray-400'}`} />
                {isAdmin ? 'ผู้ดูแลระบบ' : 'ผู้ใช้งาน'}
              </span>
              <p className="text-xs text-gray-400 mt-2">{today}</p>
            </div>
          </div>
        </div>

        {pendingCount > 0 && (
          <Link
            href="/dashboard/setting/admin"
            className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-orange-200 bg-orange-50 text-sm text-gray-800 hover:bg-orange-100 transition-colors"
          >
            <Clock className="w-5 h-5 text-orange-600 shrink-0" />
            <span className="flex-1">
              มีบัญชีสมัครใหม่ <b>{pendingCount}</b> บัญชีรออนุมัติ — ยังเห็นแค่ข้อมูลสาธารณะจนกว่าจะอนุมัติ
            </span>
            <span className="text-orange-700 font-medium">ตรวจสอบ →</span>
          </Link>
        )}

        {/* สถิติภาพรวมทั้งเครือข่าย */}
        <StatsOverview year={yearNum} />

        {/* Quick Actions */}
        <QuickActions isAdmin={isAdmin} />

        {/* Footer */}
        <p className="text-center text-[11px] text-gray-300 pt-4">
          © {buddhistYear} Stop Drink Network · เครือข่ายงดเหล้า
        </p>
      </div>
    </div>
  );
}
