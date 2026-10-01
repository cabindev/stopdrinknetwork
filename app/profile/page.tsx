// app/profile/page.tsx — โปรไฟล์ + พอร์ตงานของฉัน (ต้อง login)
import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
  User,
  ClipboardList,
  MapPin,
  Layers,
  Paperclip,
  FileSpreadsheet,
  Plus,
  CalendarDays,
  Map as MapIcon,
  Phone,
  SquarePen,
} from 'lucide-react';
import authOptions from '@/app/lib/configs/auth/authOptions';
import { involvedWhere } from '@/app/lib/activityAccess';
import { canCreateActivity } from '@/app/lib/activityMeta';
import prisma from '@/app/lib/db';
import { getRegionLabel } from '@/app/utils/healthZones';
import type { HealthZone } from '@/app/utils/healthZones';
import { categoryColor } from '@/app/lib/categoryColors';

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  PLANNING: { text: 'วางแผน', cls: 'bg-gray-100 text-gray-600' },
  ACTIVE: { text: 'กำลังดำเนินการ', cls: 'bg-orange-100 text-orange-700' },
  COMPLETED: { text: 'เสร็จสิ้น', cls: 'bg-green-50 text-green-700' },
};

const ROLE_LABEL: Record<string, string> = {
  member: 'เจ้าหน้าที่',
  admin: 'ผู้ดูแลระบบ',
  superadmin: 'ผู้ดูแลระบบสูงสุด',
};

const fmtDate = (d: Date | null) =>
  d ? new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium' }).format(d) : null;

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/auth/signin');
  const userId = Number(session.user.id);
  const canCreate = canCreateActivity(session.user.role); // เพิ่มงานได้เฉพาะแอดมิน

  const [user, activities] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        firstName: true,
        lastName: true,
        email: true,
        image: true,
        role: true,
        createdAt: true,
        phone: true,
        organization: true,
        position: true,
      },
    }),
    prisma.activity.findMany({
      where: involvedWhere(userId), // ผู้เขียน + งานที่อยู่ในทีม
      include: {
        category: { select: { name: true } },
        attachments: { select: { kind: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);
  if (!user) redirect('/auth/signin');

  // สรุปพอร์ตงาน
  const total = activities.length;
  const byStatus: Record<string, number> = {};
  const byCategory = new Map<string, number>();
  const byProvince = new Map<string, { count: number; zone: string }>();
  let fileCount = 0;
  for (const a of activities) {
    byStatus[a.status] = (byStatus[a.status] ?? 0) + 1;
    byCategory.set(a.category.name, (byCategory.get(a.category.name) ?? 0) + 1);
    const p =
      byProvince.get(a.province) ?? { count: 0, zone: getRegionLabel(a.region as HealthZone) };
    p.count += 1;
    byProvince.set(a.province, p);
    fileCount += a.attachments.length;
  }
  const categoryRows = [...byCategory.entries()].sort((a, b) => b[1] - a[1]);
  const provinceRows = [...byProvince.entries()].sort((a, b) => b[1].count - a[1].count);
  const zones = new Set([...byProvince.values()].map((p) => p.zone));
  const maxCat = Math.max(1, ...categoryRows.map(([, n]) => n));
  const latest = activities[0];
  const earliest = activities[activities.length - 1];

  const stats = [
    { icon: ClipboardList, label: 'งานทั้งหมด', value: total },
    { icon: MapPin, label: 'จังหวัดที่ลงพื้นที่', value: byProvince.size },
    { icon: Layers, label: 'ประเด็นงาน', value: byCategory.size },
    { icon: Paperclip, label: 'ไฟล์แนบ', value: fileCount },
  ];

  return (
    <main className="min-h-screen bg-white pt-20 pb-12 px-4">
      <div className="max-w-3xl mx-auto">
        {/* หัวโปรไฟล์ */}
        <section className="bg-white rounded-2xl border border-orange-100 p-6">
          <div className="flex flex-wrap items-center gap-4">
            {user.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.image}
                alt=""
                className="w-20 h-20 rounded-full object-cover border-2 border-orange-100"
              />
            ) : (
              <span className="flex w-20 h-20 rounded-full bg-orange-50 border-2 border-orange-100 items-center justify-center">
                <User className="w-9 h-9 text-orange-600" />
              </span>
            )}

            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-bold text-gray-800">
                {user.firstName} {user.lastName}
              </h1>
              <p className="text-sm text-gray-500">{user.email}</p>
              {(user.position || user.organization) && (
                <p className="text-sm text-gray-600 mt-0.5">
                  {[user.position, user.organization].filter(Boolean).join(' · ')}
                </p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="inline-flex px-2.5 py-0.5 rounded-full bg-orange-50 text-orange-700 text-xs font-medium">
                  {ROLE_LABEL[user.role] ?? user.role}
                </span>
                {user.phone && (
                  <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                    <Phone className="w-3.5 h-3.5" />
                    {user.phone}
                  </span>
                )}
                <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                  <CalendarDays className="w-3.5 h-3.5" />
                  เข้าร่วมเมื่อ {fmtDate(user.createdAt)}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/profile/edit"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-600 text-white text-sm font-medium hover:bg-orange-700 transition-colors"
              >
                <SquarePen className="w-4 h-4" /> แก้ไขโปรไฟล์
              </Link>
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- ดาวน์โหลดไฟล์จาก API ต้องเป็น <a> ไม่ใช่ <Link> */}
              <a
                href="/api/activities/export?mine=1"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-orange-200 text-orange-700 text-sm font-medium hover:bg-orange-50 transition-colors"
              >
                <FileSpreadsheet className="w-4 h-4" /> ส่งออกงานของฉัน
              </a>
            </div>
          </div>
          <p className="mt-3 text-xs text-gray-400">
            ไฟล์ Excel มี 2 ชีต (รายการงาน + สรุป) และมีเฉพาะงานที่คุณบันทึกเท่านั้น
          </p>
        </section>

        {total === 0 ? (
          <section className="mt-6 bg-white rounded-2xl border border-orange-100 p-12 text-center">
            <ClipboardList className="w-12 h-12 text-orange-200 mx-auto mb-4" />
            <p className="text-gray-600 font-medium">ยังไม่มีผลงานในระบบ</p>
            <p className="mt-1 text-sm text-gray-400">
              {canCreate
                ? 'เริ่มบันทึกงานแรกเพื่อสร้างพอร์ตของคุณ และให้พื้นที่ของคุณปรากฏบนแผนที่รวม'
                : 'ผลงานจะขึ้นที่นี่เมื่อผู้ดูแลระบบบันทึกงานที่มีคุณเป็นผู้รับผิดชอบหรือทีมงาน'}
            </p>
            {canCreate && (
              <Link
                href="/activity/new"
                className="mt-5 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-600 text-white text-sm font-medium hover:bg-orange-700 transition-colors"
              >
                <Plus className="w-4 h-4" /> บันทึกงานใหม่
              </Link>
            )}
          </section>
        ) : (
          <>
            {/* ตัวเลขรวม */}
            <section className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {stats.map(({ icon: Icon, label, value }) => (
                <div key={label} className="bg-white rounded-2xl border border-orange-100 p-4">
                  <Icon className="w-5 h-5 text-orange-500" />
                  <p className="mt-2 text-2xl font-bold text-gray-800">{value}</p>
                  <p className="text-xs text-gray-500">{label}</p>
                </div>
              ))}
            </section>

            {/* สถานะงาน */}
            <section className="mt-4 bg-white rounded-2xl border border-orange-100 p-5">
              <h2 className="text-sm font-semibold text-gray-800 mb-3">สถานะงาน</h2>
              <div className="flex flex-wrap gap-2">
                {Object.entries(STATUS_LABEL).map(([key, s]) => (
                  <span
                    key={key}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${s.cls}`}
                  >
                    {s.text}
                    <span className="font-bold">{byStatus[key] ?? 0}</span>
                  </span>
                ))}
              </div>
              <p className="mt-3 text-xs text-gray-400">
                งานแรก {fmtDate(earliest.createdAt)} · ล่าสุด {fmtDate(latest.createdAt)}
              </p>
            </section>

            {/* ประเด็นงานที่ทำ */}
            <section className="mt-4 bg-white rounded-2xl border border-orange-100 p-5">
              <h2 className="text-sm font-semibold text-gray-800 mb-3">
                ประเด็นงานที่คุณทำ ({byCategory.size} หมวด)
              </h2>
              <ul className="space-y-2">
                {categoryRows.map(([name, count]) => (
                  <li key={name} className="flex items-center gap-3">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: categoryColor(name) }}
                    />
                    <span className="text-sm text-gray-700 w-40 sm:w-56 truncate">{name}</span>
                    <span className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <span
                        className="block h-full rounded-full"
                        style={{
                          width: `${(count / maxCat) * 100}%`,
                          backgroundColor: categoryColor(name),
                        }}
                      />
                    </span>
                    <span className="text-xs text-gray-500 w-6 text-right">{count}</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* พื้นที่ที่ลงไป */}
            <section className="mt-4 bg-white rounded-2xl border border-orange-100 p-5">
              <div className="flex items-center justify-between gap-2 mb-3">
                <h2 className="text-sm font-semibold text-gray-800">
                  พื้นที่ที่คุณลงไป ({byProvince.size} จังหวัด · {zones.size} ภาค)
                </h2>
                <Link
                  href="/map"
                  className="inline-flex items-center gap-1 text-xs text-orange-700 hover:text-orange-800"
                >
                  <MapIcon className="w-3.5 h-3.5" /> ดูบนแผนที่
                </Link>
              </div>
              <div className="flex flex-wrap gap-2">
                {provinceRows.map(([province, { count, zone }]) => (
                  <span
                    key={province}
                    title={zone}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-50 border border-orange-100 text-xs text-gray-700"
                  >
                    {province}
                    <span className="text-orange-700 font-semibold">{count}</span>
                  </span>
                ))}
              </div>
            </section>

            {/* งานล่าสุด */}
            <section className="mt-4 bg-white rounded-2xl border border-orange-100 p-5">
              <div className="flex items-center justify-between gap-2 mb-3">
                <h2 className="text-sm font-semibold text-gray-800">งานล่าสุด</h2>
                <Link
                  href="/activity"
                  className="inline-flex items-center gap-1 text-xs text-orange-700 hover:text-orange-800"
                >
                  ดูทั้งหมด
                </Link>
              </div>
              <ul className="space-y-2">
                {activities.slice(0, 5).map((a) => {
                  const s = STATUS_LABEL[a.status] ?? STATUS_LABEL.ACTIVE;
                  return (
                    <li key={a.id}>
                      <Link
                        href={`/activity/${a.id}`}
                        className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border border-orange-100 hover:bg-orange-50/50 transition-colors"
                      >
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-gray-800 truncate">
                            {a.title}
                          </span>
                          <span className="block text-xs text-gray-400 truncate">
                            {a.category.name} · ต.{a.district} อ.{a.amphoe} จ.{a.province}
                          </span>
                        </span>
                        <span
                          className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium ${s.cls}`}
                        >
                          {s.text}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>

            <div className="mt-6 flex flex-wrap gap-2">
              {canCreate && (
                <Link
                  href="/activity/new"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-600 text-white text-sm font-medium hover:bg-orange-700 transition-colors"
                >
                  <Plus className="w-4 h-4" /> บันทึกงานใหม่
                </Link>
              )}
              <Link
                href="/activity"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-orange-200 text-orange-700 text-sm font-medium hover:bg-orange-50 transition-colors"
              >
                <ClipboardList className="w-4 h-4" /> งานของฉัน
              </Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
