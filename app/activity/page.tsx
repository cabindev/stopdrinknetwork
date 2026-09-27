// app/activity/page.tsx — รายการการดำเนินงานของฉัน (ต้อง login)
// สถิติย่อ + แท็บสถานะ (?status=) + รายการจัดกลุ่มตามเดือนที่บันทึก + การ์ดมีรูปปก/โลโก้และวันที่บันทึก
import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
  Plus,
  MapPin,
  Paperclip,
  ImageIcon,
  ClipboardList,
  FileSpreadsheet,
  CalendarDays,
  Clock,
  Globe,
  Layers,
  Activity as ActivityIcon,
  Map as MapIcon,
  Sparkles,
} from 'lucide-react';
import authOptions from '@/app/lib/configs/auth/authOptions';
import { involvedWhere } from '@/app/lib/activityAccess';
import prisma from '@/app/lib/db';
import { getRegionLabel } from '@/app/utils/healthZones';
import type { HealthZone } from '@/app/utils/healthZones';
import { formatStartDate } from '@/app/lib/activityMeta';
import { categoryColor } from '@/app/lib/categoryColors';
import OverlapSection from './components/OverlapSection';
import Pagination from '@/app/components/Pagination';

const STATUS_LABEL: Record<string, { text: string; cls: string; dot: string }> = {
  PLANNING: { text: 'วางแผน', cls: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400' },
  ACTIVE: { text: 'กำลังดำเนินการ', cls: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500' },
  COMPLETED: { text: 'เสร็จสิ้น', cls: 'bg-green-50 text-green-700', dot: 'bg-green-600' },
};
const STATUSES = ['ACTIVE', 'PLANNING', 'COMPLETED'] as const;

const PER_PAGE = 10;
const TZ = 'Asia/Bangkok';

const fmtDate = new Intl.DateTimeFormat('th-TH', { timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric' });
const fmtTime = new Intl.DateTimeFormat('th-TH', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
const fmtMonth = new Intl.DateTimeFormat('th-TH', { timeZone: TZ, month: 'long', year: 'numeric' });

// "เมื่อสักครู่ / 5 นาทีที่แล้ว / 3 วันที่แล้ว" — เกิน 30 วันไม่แสดง (มีวันที่เต็มอยู่แล้ว)
function timeAgo(d: Date, now: number): string | null {
  const min = Math.floor((now - d.getTime()) / 60000);
  if (min < 1) return 'เมื่อสักครู่';
  if (min < 60) return `${min} นาทีที่แล้ว`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} ชั่วโมงที่แล้ว`;
  const day = Math.floor(hr / 24);
  if (day === 1) return 'เมื่อวาน';
  if (day <= 30) return `${day} วันที่แล้ว`;
  return null;
}

export default async function MyActivitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect('/auth/signin');
  }
  const userId = Number(session.user.id);

  const { page, status: statusRaw } = await searchParams;
  const status = STATUSES.find((s) => s === statusRaw);
  const requestedPage = Math.max(1, Number(page) || 1);

  // งานของฉัน = เป็นผู้เขียนหรืออยู่ในทีม
  const mine = involvedWhere(userId);
  const where = { ...mine, ...(status && { status }) };
  const [totalCount, byStatus, myAreas, publishedCount] = await Promise.all([
    prisma.activity.count({ where }),
    prisma.activity.groupBy({ by: ['status'], where: mine, _count: { _all: true } }),
    // พื้นที่ทั้งหมดของผู้ใช้ (ไม่จำกัดหน้า/สถานะ) — ใช้ทั้งสถิติและวิเคราะห์ทับซ้อน
    prisma.activity.findMany({
      where: mine,
      select: { province: true, amphoe: true, district: true },
    }),
    prisma.activity.count({ where: { ...mine, isPublished: true } }),
  ]);
  const totalPages = Math.max(1, Math.ceil(totalCount / PER_PAGE));
  const currentPage = Math.min(requestedPage, totalPages); // เลขหน้าเกินช่วง → หน้าสุดท้าย

  const activities = await prisma.activity.findMany({
    where,
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      areaName: true,
      district: true,
      amphoe: true,
      province: true,
      region: true,
      startDate: true,
      startDatePrecision: true,
      isPublished: true,
      createdAt: true,
      updatedAt: true,
      category: { select: { name: true, logo: true } },
      subCategory: { select: { name: true, logo: true } },
      attachments: {
        where: { policyLevel: null },
        select: { kind: true, filePath: true, isCover: true },
        orderBy: { id: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
    skip: (currentPage - 1) * PER_PAGE,
    take: PER_PAGE,
  });

  const countOf = (s: string) => byStatus.find((b) => b.status === s)?._count._all ?? 0;
  const allCount = byStatus.reduce((n, b) => n + b._count._all, 0);
  const provinceCount = new Set(myAreas.map((a) => a.province)).size;
  const now = Date.now();

  // จัดกลุ่มตามเดือนที่บันทึก (เรียงใหม่→เก่าอยู่แล้ว)
  const groups: { month: string; items: typeof activities }[] = [];
  for (const a of activities) {
    const month = fmtMonth.format(a.createdAt);
    const last = groups[groups.length - 1];
    if (last?.month === month) last.items.push(a);
    else groups.push({ month, items: [a] });
  }

  const stats = [
    { label: 'งานทั้งหมด', value: allCount, icon: ClipboardList },
    { label: 'กำลังดำเนินการ', value: countOf('ACTIVE'), icon: ActivityIcon },
    { label: 'จังหวัด', value: provinceCount, icon: MapIcon },
    { label: 'เผยแพร่เป็นกรณีศึกษา', value: publishedCount, icon: Globe },
  ];
  const tabs = [
    { key: undefined, label: 'ทั้งหมด', count: allCount },
    ...STATUSES.map((s) => ({ key: s, label: STATUS_LABEL[s].text, count: countOf(s) })),
  ];

  return (
    <main className="min-h-screen bg-white pt-20 pb-10 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">งานของฉัน</h1>
            <p className="mt-1 text-sm text-gray-500">
              สวัสดี {session.user.firstName ?? ''} — บันทึกงานไว้ที่นี่ แล้วงานจะขึ้นบนแผนที่รวมของเครือข่าย
            </p>
          </div>
          <div className="flex items-center gap-2">
            {allCount > 0 && (
              <a
                href="/api/activities/export?mine=1"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-orange-200 text-orange-700 text-sm font-medium hover:bg-orange-50 transition-colors"
              >
                <FileSpreadsheet className="w-4 h-4" /> Excel
              </a>
            )}
            <Link
              href="/activity/new"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-600 text-white text-sm font-medium hover:bg-orange-700 shadow-lg shadow-orange-500/30 transition-all"
            >
              <Plus className="w-4 h-4" /> บันทึกงานใหม่
            </Link>
          </div>
        </div>

        {allCount > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {stats.map(({ label, value, icon: Icon }) => (
              <div key={label} className="rounded-2xl border border-orange-100 bg-orange-50/60 px-4 py-3">
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <Icon className="w-3.5 h-3.5 text-orange-500" /> {label}
                </div>
                <div className="mt-1 text-2xl font-bold text-gray-800 tabular-nums">{value.toLocaleString('th-TH')}</div>
              </div>
            ))}
          </div>
        )}

        {allCount > 0 && (
          <nav className="flex gap-1.5 overflow-x-auto pb-1 mb-2" aria-label="กรองตามสถานะ">
            {tabs.map((t) => {
              const active = t.key === status;
              return (
                <Link
                  key={t.label}
                  href={t.key ? `/activity?status=${t.key}` : '/activity'}
                  className={`shrink-0 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm border transition-colors ${
                    active
                      ? 'bg-orange-600 border-orange-600 text-white'
                      : 'bg-white border-orange-100 text-gray-600 hover:border-orange-300'
                  }`}
                >
                  {t.key && <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-white' : STATUS_LABEL[t.key].dot}`} />}
                  {t.label}
                  <span className={`tabular-nums ${active ? 'text-orange-100' : 'text-gray-400'}`}>{t.count}</span>
                </Link>
              );
            })}
          </nav>
        )}

        {totalPages > 1 && (
          <p className="text-xs text-gray-400 mb-2">
            แสดง {(currentPage - 1) * PER_PAGE + 1}–{(currentPage - 1) * PER_PAGE + activities.length} จาก {totalCount} รายการ
          </p>
        )}

        {activities.length === 0 ? (
          <div className="bg-white rounded-2xl border border-orange-100 p-12 text-center mt-4">
            <ClipboardList className="w-12 h-12 text-orange-200 mx-auto mb-4" />
            {allCount === 0 ? (
              <>
                <p className="text-gray-600 font-medium">ยังไม่มีการดำเนินงานที่บันทึกไว้</p>
                <p className="mt-1 text-sm text-gray-400">
                  เริ่มบันทึกงานแรกของคุณเพื่อให้พื้นที่ดำเนินงานปรากฏบนแผนที่รวม
                </p>
              </>
            ) : (
              <p className="text-gray-600 font-medium">ไม่มีงานในสถานะนี้</p>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {groups.map((g) => (
              <section key={g.month}>
                <h2 className="sticky top-16 z-10 -mx-1 px-1 py-2 bg-white/95 backdrop-blur text-sm font-semibold text-gray-800 flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-orange-500" /> {g.month}
                  <span className="text-xs font-normal text-gray-400">{g.items.length} งาน</span>
                </h2>
                <ul className="space-y-3">
                  {g.items.map((a) => {
                    const st = STATUS_LABEL[a.status] ?? STATUS_LABEL.ACTIVE;
                    const images = a.attachments.filter((x) => x.kind === 'IMAGE');
                    const docs = a.attachments.length - images.length;
                    const cover = images.find((x) => x.isCover) ?? images[0];
                    const logo = a.subCategory?.logo ?? a.category.logo;
                    const color = categoryColor(a.category.name);
                    const ago = timeAgo(a.createdAt, now);
                    const isNew = now - a.createdAt.getTime() < 86_400_000;
                    // แก้หลังบันทึกเกิน 1 นาที = ถือว่ามีการแก้ไข
                    const edited = a.updatedAt.getTime() - a.createdAt.getTime() > 60_000;
                    const start = formatStartDate(a.startDate, a.startDatePrecision);
                    return (
                      <li key={a.id}>
                        <Link
                          href={`/activity/${a.id}`}
                          className="group flex gap-4 p-3 sm:p-4 bg-white rounded-2xl border border-orange-100 hover:border-orange-300 hover:shadow-md hover:shadow-orange-100 transition-all"
                        >
                          {/* ภาพประจำงาน: รูปปก → โลโก้ประเด็น → ตัวอักษรแรกบนสีประจำประเด็น */}
                          <div className="relative shrink-0 w-24 sm:w-36 aspect-[4/3] rounded-xl overflow-hidden bg-orange-50 flex items-center justify-center">
                            {cover ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={`/api/files/${cover.filePath}`}
                                alt=""
                                loading="lazy"
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                            ) : logo ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={`/api/files/${logo}`}
                                alt=""
                                loading="lazy"
                                className="w-3/5 aspect-square object-contain rounded-full bg-white p-1.5"
                              />
                            ) : (
                              <span
                                className="w-12 h-12 rounded-full text-white text-lg font-bold flex items-center justify-center"
                                style={{ backgroundColor: color }}
                              >
                                {a.category.name.slice(0, 1)}
                              </span>
                            )}
                            {images.length > 1 && (
                              <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded-md bg-black/60 text-white text-[10px] inline-flex items-center gap-0.5">
                                <ImageIcon className="w-3 h-3" /> {images.length}
                              </span>
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                                <span className="inline-flex items-center gap-1 font-medium" style={{ color }}>
                                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                                  {a.category.name}
                                </span>
                                {a.subCategory && <span className="text-gray-400">› {a.subCategory.name}</span>}
                              </div>
                              <span className={`shrink-0 inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ${st.cls}`}>
                                {st.text}
                              </span>
                            </div>

                            <h3 className="mt-1 font-semibold text-gray-800 leading-snug line-clamp-2 group-hover:text-orange-700 transition-colors">
                              {isNew && (
                                <span className="mr-1.5 align-middle inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-orange-600 text-white text-[10px] font-semibold">
                                  <Sparkles className="w-3 h-3" /> ใหม่
                                </span>
                              )}
                              {a.title}
                            </h3>

                            <p className="mt-1 text-sm text-gray-500 line-clamp-1 sm:line-clamp-2">{a.description}</p>

                            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                              <span className="inline-flex items-center gap-1 min-w-0">
                                <MapPin className="w-3.5 h-3.5 shrink-0 text-orange-500" />
                                <span className="truncate">
                                  {a.areaName ? `${a.areaName} · ` : ''}ต.{a.district} จ.{a.province}
                                  <span className="hidden sm:inline"> ({getRegionLabel(a.region as HealthZone)})</span>
                                </span>
                              </span>
                              {start && (
                                <span className="inline-flex items-center gap-1">
                                  <CalendarDays className="w-3.5 h-3.5" /> เริ่ม {start}
                                </span>
                              )}
                              {docs > 0 && (
                                <span className="inline-flex items-center gap-1">
                                  <Paperclip className="w-3.5 h-3.5" /> {docs} เอกสาร
                                </span>
                              )}
                              {a.isPublished && (
                                <span className="inline-flex items-center gap-1 text-orange-700">
                                  <Globe className="w-3.5 h-3.5" /> เผยแพร่แล้ว
                                </span>
                              )}
                            </div>

                            <div className="mt-2 pt-2 border-t border-dashed border-orange-100 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-gray-400">
                              <span className="inline-flex items-center gap-1" title={a.createdAt.toISOString()}>
                                <Clock className="w-3 h-3" />
                                บันทึกเมื่อ {fmtDate.format(a.createdAt)} {fmtTime.format(a.createdAt)} น.
                                {ago && <span className="text-gray-500">· {ago}</span>}
                              </span>
                              {edited && (
                                <span className="inline-flex items-center gap-1">
                                  <Layers className="w-3 h-3" /> แก้ไขล่าสุด {fmtDate.format(a.updatedAt)}
                                </span>
                              )}
                            </div>
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          basePath="/activity"
          extraParams={status ? { status } : {}}
        />

        <OverlapSection userId={userId} myAreas={myAreas} />
      </div>
    </main>
  );
}
