// app/dashboard/setting/trash/page.tsx — ถังขยะ: งานที่ถูกลบ กู้คืนได้ภายใน 30 วัน (admin/superadmin)
import { redirect } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import prisma from '@/app/lib/db';
import { getAdminUser } from '@/app/lib/adminAuth';
import { purgeExpiredTrash, TRASH_DAYS } from '@/app/lib/activityAccess';
import TrashActions from './TrashActions';

const fmt = (d: Date) =>
  new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'medium', timeStyle: 'short' }).format(d);

export default async function TrashPage() {
  const admin = await getAdminUser();
  if (!admin) redirect('/dashboard');

  await purgeExpiredTrash(); // เก็บกวาดของที่เกิน 30 วันทุกครั้งที่เปิดหน้า
  const rows = await prisma.activity.findMany({
    where: { deletedAt: { not: null } },
    select: {
      id: true,
      title: true,
      district: true,
      province: true,
      deletedAt: true,
      deletedById: true,
      category: { select: { name: true } },
      user: { select: { firstName: true, lastName: true } },
      _count: { select: { attachments: true } },
    },
    orderBy: { deletedAt: 'desc' },
  });
  const deleters = await prisma.user.findMany({
    where: { id: { in: rows.map((r) => r.deletedById).filter((x): x is number => x != null) } },
    select: { id: true, firstName: true, lastName: true },
  });
  const nameOf = (id: number | null) => {
    const u = deleters.find((d) => d.id === id);
    return u ? `${u.firstName} ${u.lastName}` : '—';
  };
  const now = Date.now();

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center gap-3 mb-1">
        <span className="flex w-10 h-10 rounded-xl bg-orange-50 border border-orange-100 items-center justify-center">
          <Trash2 className="w-5 h-5 text-orange-600" />
        </span>
        <div>
          <h1 className="text-xl font-bold text-gray-800">ถังขยะ</h1>
          <p className="text-sm text-gray-500">
            งานที่ถูกลบจะอยู่ที่นี่ {TRASH_DAYS} วัน กู้คืนได้ครบทั้งข้อมูลและไฟล์ — จากนั้นระบบลบถาวรอัตโนมัติ
          </p>
        </div>
      </div>

      <div className="mt-5 bg-white rounded-2xl border border-orange-100 overflow-hidden">
        {rows.length === 0 ? (
          <p className="px-4 py-12 text-center text-gray-400">ถังขยะว่าง</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-orange-50/60 text-gray-600">
              <tr>
                <th className="text-left font-medium px-4 py-3">งาน</th>
                <th className="text-left font-medium px-4 py-3 whitespace-nowrap">ผู้เขียน</th>
                <th className="text-left font-medium px-4 py-3 whitespace-nowrap">ลบเมื่อ / โดย</th>
                <th className="text-left font-medium px-4 py-3 whitespace-nowrap">เหลือเวลา</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-orange-50">
              {rows.map((r) => {
                const daysLeft = Math.max(0, TRASH_DAYS - Math.floor((now - r.deletedAt!.getTime()) / 86_400_000));
                return (
                  <tr key={r.id} data-testid="trash-row">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">{r.title}</p>
                      <p className="text-xs text-gray-400">
                        {r.category.name} · ต.{r.district} จ.{r.province}
                        {r._count.attachments > 0 && ` · ${r._count.attachments} ไฟล์`}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                      {r.user.firstName} {r.user.lastName}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                      {fmt(r.deletedAt!)}
                      <br />
                      <span className="text-gray-400">{nameOf(r.deletedById)}</span>
                    </td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap">
                      <span className={daysLeft <= 3 ? 'text-red-600 font-medium' : 'text-gray-600'}>{daysLeft} วัน</span>
                    </td>
                    <td className="px-4 py-3">
                      <TrashActions id={r.id} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
