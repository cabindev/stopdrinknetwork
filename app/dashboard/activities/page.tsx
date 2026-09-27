// app/dashboard/activities/page.tsx — ตารางงานทั้งหมดสำหรับแอดมิน (ตรวจสอบ/แก้ไขข้อมูล)
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Table2, SquarePen, FileSpreadsheet, Search, ExternalLink } from 'lucide-react';
import prisma, { ACTIVE_ACTIVITY } from '@/app/lib/db';
import { getAdminUser } from '@/app/lib/adminAuth';
import { categoryColor } from '@/app/lib/categoryColors';
import { getRegionLabel, getAllHealthZones } from '@/app/utils/healthZones';
import { formatStartDate } from '@/app/lib/activityMeta';
import type { HealthZone } from '@/app/utils/healthZones';
import Pagination from '@/app/components/Pagination';
import PublishToggle from './PublishToggle';
import { TransferProvider, RowCheck, PageCheck, TransferBar } from './TransferSelection';

const PER_PAGE = 20;

const STATUS_META: Record<string, { text: string; cls: string }> = {
  PLANNING: { text: 'วางแผน', cls: 'bg-gray-100 text-gray-600' },
  ACTIVE: { text: 'กำลังดำเนินการ', cls: 'bg-orange-100 text-orange-700' },
  COMPLETED: { text: 'เสร็จสิ้น', cls: 'bg-green-50 text-green-700' },
};

const fmt = (d: Date | null) =>
  d ? new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium' }).format(d) : '—';

const selCls =
  'px-3 py-2 text-sm text-gray-800 bg-white border border-orange-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400';

export default async function AllActivitiesPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    q?: string;
    category?: string;
    sub?: string;
    status?: string;
    province?: string;
    year?: string;
    region?: string;
    owner?: string;
  }>;
}) {
  const admin = await getAdminUser();
  if (!admin) redirect('/dashboard');
  const canTransfer = admin.role === 'superadmin'; // เปลี่ยนผู้เขียนได้เฉพาะ superadmin

  const sp = await searchParams;
  const q = (sp.q ?? '').trim();
  const category = sp.category ?? '';
  const sub = sp.sub ?? ''; // ชื่อประเด็นย่อย — ใช้ร่วมกับ category
  const status = sp.status ?? '';
  const province = sp.province ?? '';
  const year = Number(sp.year) || 0;
  const region = getAllHealthZones().find((z) => z === sp.region) ?? '';
  const owner = Number(sp.owner) || 0; // id ผู้รับผิดชอบ

  // คำค้นกับปีต่างใช้ OR — ต้องครอบด้วย AND ไม่งั้น key OR ตัวหลังทับตัวแรก (เคยทำให้คำค้นถูกเพิกเฉยเมื่อเลือกปีด้วย)
  const where = {
    ...(category ? { category: { name: category } } : {}),
    ...(sub ? { subCategory: { name: sub } } : {}),
    ...(status ? { status: status as 'PLANNING' | 'ACTIVE' | 'COMPLETED' } : {}),
    ...(province ? { province } : {}),
    ...(region ? { region } : {}),
    ...(owner ? { userId: owner } : {}),
    AND: [
      q
        ? {
            OR: [
              { title: { contains: q } },
              { description: { contains: q } },
              { areaName: { contains: q } },
              { province: { contains: q } },
              { amphoe: { contains: q } },
              { district: { contains: q } },
            ],
          }
        : {},
      year
        ? {
            OR: [
              { startDate: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) } },
              { startDate: null, createdAt: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) } },
            ],
          }
        : {},
    ],
  };

  const [filteredRows, categories, provinceGroups, yearRows, regionGroups, userRows] = await Promise.all([
    // id ทั้งหมดตามตัวกรอง — ใช้นับ + ปุ่ม "เลือกทั้งหมดตามตัวกรอง" ของการโอนงาน
    prisma.activity.findMany({ where, select: { id: true }, orderBy: { createdAt: 'desc' } }),
    prisma.workCategory.findMany({
      select: {
        name: true,
        subCategories: { select: { name: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.activity.groupBy({ by: ['province'], _count: true, orderBy: { province: 'asc' } }),
    prisma.activity.findMany({ select: { startDate: true, createdAt: true } }),
    prisma.activity.groupBy({ by: ['region'], _count: true }),
    prisma.user.findMany({
      select: { id: true, firstName: true, lastName: true, email: true, _count: { select: { activities: { where: ACTIVE_ACTIVITY } } } },
      orderBy: [{ firstName: 'asc' }],
    }),
  ]);
  const totalCount = filteredRows.length;
  const users = userRows.map((u) => ({
    id: u.id,
    name: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email,
    email: u.email,
    count: u._count.activities,
  }));
  const owners = users.filter((u) => u.count > 0);

  const years = [
    ...new Set(yearRows.map((r) => (r.startDate ?? r.createdAt).getFullYear())),
  ].sort((a, b) => b - a);

  const totalPages = Math.max(1, Math.ceil(totalCount / PER_PAGE));
  const currentPage = Math.min(Math.max(1, Number(sp.page) || 1), totalPages);

  const activities = await prisma.activity.findMany({
    where,
    include: {
      category: { select: { name: true } },
      subCategory: { select: { name: true } },
      user: { select: { firstName: true, lastName: true } },
      _count: { select: { attachments: true } },
    },
    orderBy: { createdAt: 'desc' },
    skip: (currentPage - 1) * PER_PAGE,
    take: PER_PAGE,
  });

  const activeFilters = { q, category, sub, status, province, region, owner: owner ? String(owner) : '', year: year ? String(year) : '' };
  const exportQuery = new URLSearchParams(
    Object.fromEntries(Object.entries({ q, category, sub, status }).filter(([, v]) => v))
  ).toString();
  const subOptions = categories.find((c) => c.name === category)?.subCategories ?? [];

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
        <div className="flex items-center gap-3">
          <span className="flex w-10 h-10 rounded-xl bg-orange-50 border border-orange-100 items-center justify-center">
            <Table2 className="w-5 h-5 text-orange-600" />
          </span>
          <div>
            <h1 className="text-xl font-bold text-gray-800">งานทั้งหมดในระบบ</h1>
            <p className="text-sm text-gray-500">
              พบ {totalCount} รายการ
              {totalPages > 1 && ` · แสดง ${(currentPage - 1) * PER_PAGE + 1}–${(currentPage - 1) * PER_PAGE + activities.length}`}
            </p>
          </div>
        </div>
        <a
          href={`/api/activities/export${exportQuery ? `?${exportQuery}` : ''}`}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-orange-200 text-orange-700 text-sm font-medium hover:bg-orange-50 transition-colors"
        >
          <FileSpreadsheet className="w-4 h-4" /> ส่งออกตามตัวกรอง
        </a>
      </div>

      {/* ตัวกรอง — ใช้ GET form เพื่อให้ URL แชร์/บุ๊กมาร์กได้ */}
      <form method="get" className="mt-5 bg-white rounded-2xl border border-orange-100 p-4">
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-2">
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              name="q"
              defaultValue={q}
              placeholder="ค้นหาชื่องาน พื้นที่ รายละเอียด..."
              className={`${selCls} w-full pl-9`}
            />
          </div>
          <select name="category" defaultValue={category} className={selCls}>
            <option value="">ทุกประเด็นงาน</option>
            {categories.map((c) => (
              <option key={c.name} value={c.name}>{c.name}</option>
            ))}
          </select>
          {/* ประเด็นย่อย: แสดงเมื่อเลือกประเด็นที่มีประเด็นย่อยแล้ว (form GET — กด "กรอง" หลังเลือกประเด็น) */}
          {subOptions.length > 0 && (
            <select name="sub" defaultValue={sub} className={selCls}>
              <option value="">ทุกประเด็นย่อย</option>
              {subOptions.map((sc) => (
                <option key={sc.name} value={sc.name}>{sc.name}</option>
              ))}
            </select>
          )}
          <select name="province" defaultValue={province} className={selCls}>
            <option value="">ทุกจังหวัด</option>
            {provinceGroups.map((p) => (
              <option key={p.province} value={p.province}>
                {p.province} ({p._count})
              </option>
            ))}
          </select>
          <select name="region" defaultValue={region} className={selCls}>
            <option value="">ทุกภาค</option>
            {regionGroups.map((g) => (
              <option key={g.region} value={g.region}>
                {getRegionLabel(g.region as HealthZone)} ({g._count})
              </option>
            ))}
          </select>
          <select name="owner" defaultValue={owner ? String(owner) : ''} className={selCls}>
            <option value="">ทุกผู้รับผิดชอบ</option>
            {owners.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.count})
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <select name="status" defaultValue={status} className={`${selCls} flex-1 min-w-0`}>
              <option value="">ทุกสถานะ</option>
              {Object.entries(STATUS_META).map(([v, s]) => (
                <option key={v} value={v}>{s.text}</option>
              ))}
            </select>
            <select name="year" defaultValue={year ? String(year) : ''} className={`${selCls} w-24`}>
              <option value="">ทุกปี</option>
              {years.map((y) => (
                <option key={y} value={y}>{y + 543}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-orange-600 text-white text-xs font-medium hover:bg-orange-700 transition-colors"
          >
            ค้นหา
          </button>
          {Object.values(activeFilters).some(Boolean) && (
            <Link href="/dashboard/activities" className="px-3 py-2 text-xs text-gray-500 hover:text-orange-700">
              ล้างตัวกรอง
            </Link>
          )}
        </div>
      </form>

      {/* ตาราง — superadmin ติ๊กเลือกแล้วโอนให้ผู้รับผิดชอบคนอื่นได้ (แถบลอยด้านล่าง) */}
      <TransferProvider>
      <div className="mt-4 bg-white rounded-2xl border border-orange-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-orange-50/60 text-gray-600">
              <tr>
                {canTransfer && (
                  <th className="pl-4 py-3 w-8">
                    <PageCheck ids={activities.map((a) => a.id)} />
                  </th>
                )}
                <th className="text-left font-medium px-4 py-3">ชื่องาน</th>
                <th className="text-left font-medium px-4 py-3 whitespace-nowrap">ประเด็น</th>
                <th className="text-left font-medium px-4 py-3 whitespace-nowrap">พื้นที่</th>
                <th className="text-left font-medium px-4 py-3 whitespace-nowrap">ผู้รับผิดชอบ</th>
                <th className="text-left font-medium px-4 py-3 whitespace-nowrap">ช่วงเวลา</th>
                <th className="text-left font-medium px-4 py-3 whitespace-nowrap">สถานะ</th>
                <th className="text-center font-medium px-4 py-3 whitespace-nowrap">เผยแพร่</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-orange-50">
              {activities.length === 0 ? (
                <tr>
                  <td colSpan={canTransfer ? 9 : 8} className="px-4 py-12 text-center text-gray-400">
                    ไม่พบงานที่ตรงกับตัวกรอง
                  </td>
                </tr>
              ) : (
                activities.map((a) => (
                  <tr key={a.id} className="hover:bg-orange-50/40">
                    {canTransfer && (
                      <td className="pl-4 py-3 align-top">
                        <RowCheck id={a.id} />
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <Link
                        href={`/activity/${a.id}`}
                        className="font-medium text-gray-800 hover:text-orange-700 inline-flex items-center gap-1"
                      >
                        {a.title}
                        <ExternalLink className="w-3 h-3 text-gray-300" />
                      </Link>
                      {a._count.attachments > 0 && (
                        <span className="ml-2 text-[11px] text-gray-400">
                          {a._count.attachments} ไฟล์
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 text-xs text-gray-600">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: categoryColor(a.category.name) }}
                        />
                        {a.category.name}
                      </span>
                      {a.subCategory && (
                        <span className="block pl-3.5 text-[11px] text-gray-400">› {a.subCategory.name}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                      ต.{a.district} อ.{a.amphoe}
                      <br />
                      <span className="text-gray-400">
                        จ.{a.province} · {getRegionLabel(a.region as HealthZone)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                      {a.user.firstName} {a.user.lastName}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {formatStartDate(a.startDate, a.startDatePrecision) ?? '—'}
                      <br />
                      <span className="text-gray-400">{a.endDate ? fmt(a.endDate) : 'ต่อเนื่อง'}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-medium ${
                          (STATUS_META[a.status] ?? STATUS_META.ACTIVE).cls
                        }`}
                      >
                        {(STATUS_META[a.status] ?? STATUS_META.ACTIVE).text}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <PublishToggle activityId={a.id} initial={a.isPublished} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/activity/${a.id}/edit`}
                        title="แก้ไข"
                        className="inline-flex p-1.5 rounded-lg text-gray-400 hover:text-orange-700 hover:bg-orange-50"
                      >
                        <SquarePen className="w-4 h-4" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {canTransfer && <TransferBar users={users} filteredIds={filteredRows.map((r) => r.id)} />}
      </TransferProvider>

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        basePath="/dashboard/activities"
        extraParams={Object.fromEntries(Object.entries(activeFilters).filter(([, v]) => v))}
      />
    </div>
  );
}
