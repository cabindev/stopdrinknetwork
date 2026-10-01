// app/dashboard/components/StatsOverview.tsx — สถิติภาพรวมทั้งเครือข่ายสำหรับผู้บริหาร (server component)
import Link from 'next/link';
import {
  ClipboardList,
  MapPin,
  Users,
  Layers,
  Users2,
  MapPinOff,
  TrendingUp,
  Map as MapIcon,
  Table2,
  FileSpreadsheet,
} from 'lucide-react';
import prisma from '@/app/lib/db';
import { categoryColor } from '@/app/lib/categoryColors';
import { getThaiZoneName, getAllHealthZones } from '@/app/utils/healthZones';
import { provinceAreaTotals, TOTAL_PROVINCES } from '@/app/lib/areaCoverage';
const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

const STATUS_META: Record<string, { text: string; cls: string }> = {
  ACTIVE: { text: 'กำลังดำเนินการ', cls: 'bg-orange-100 text-orange-700' },
  PLANNING: { text: 'วางแผน', cls: 'bg-gray-100 text-gray-600' },
  COMPLETED: { text: 'เสร็จสิ้น', cls: 'bg-green-50 text-green-700' },
};

export default async function StatsOverview({ year }: { year?: number }) {
  const rows = await prisma.activity.findMany({
    select: {
      userId: true,
      province: true,
      amphoe: true,
      district: true,
      region: true,
      status: true,
      startDate: true,
      createdAt: true,
      category: { select: { name: true } },
      _count: { select: { attachments: true } },
    },
  });

  // วันอ้างอิงของงาน = วันเริ่มดำเนินการ ถ้าไม่ระบุใช้วันที่บันทึก
  const dateOf = (r: (typeof rows)[number]) => r.startDate ?? r.createdAt;
  const years = [...new Set(rows.map((r) => dateOf(r).getFullYear()))].sort((a, b) => b - a);
  const scoped = year ? rows.filter((r) => dateOf(r).getFullYear() === year) : rows;

  const provinces = new Map<string, Set<number>>();
  // ความครอบคลุมรายจังหวัด: อำเภอ/ตำบลที่มีงาน เทียบกับที่มีอยู่จริงทั้งจังหวัด
  const coverage = new Map<
    string,
    { activities: number; amphoe: Set<string>; tambon: Set<string>; users: Set<number> }
  >();
  const byCategory = new Map<string, number>();
  const byZone = new Map<string, number>();
  const byStatus: Record<string, number> = {};
  let files = 0;
  for (const r of scoped) {
    const set = provinces.get(r.province) ?? new Set<number>();
    set.add(r.userId);
    provinces.set(r.province, set);
    const cov =
      coverage.get(r.province) ??
      { activities: 0, amphoe: new Set<string>(), tambon: new Set<string>(), users: new Set<number>() };
    cov.activities++;
    cov.amphoe.add(r.amphoe);
    cov.tambon.add(`${r.amphoe}|${r.district}`);
    cov.users.add(r.userId);
    coverage.set(r.province, cov);
    byCategory.set(r.category.name, (byCategory.get(r.category.name) ?? 0) + 1);
    byZone.set(r.region, (byZone.get(r.region) ?? 0) + 1);
    byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
    files += r._count.attachments;
  }
  const overlapProvinces = [...provinces.entries()]
    .filter(([, users]) => users.size > 1)
    .sort((a, b) => b[1].size - a[1].size);

  // แนวโน้ม 12 เดือนล่าสุด (นับตามวันอ้างอิงของงาน)
  const now = new Date();
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
    return { y: d.getFullYear(), m: d.getMonth(), count: 0 };
  });
  for (const r of rows) {
    const d = dateOf(r);
    const slot = months.find((s) => s.y === d.getFullYear() && s.m === d.getMonth());
    if (slot) slot.count++;
  }
  const maxMonth = Math.max(1, ...months.map((m) => m.count));

  // เทียบปีต่อปี
  const perYear = new Map<number, number>();
  for (const r of rows) {
    const y = dateOf(r).getFullYear();
    perYear.set(y, (perYear.get(y) ?? 0) + 1);
  }
  const thisYearCount = perYear.get(now.getFullYear()) ?? 0;
  const lastYearCount = perYear.get(now.getFullYear() - 1) ?? 0;
  const yoy = lastYearCount > 0 ? Math.round(((thisYearCount - lastYearCount) / lastYearCount) * 100) : null;

  const coverageRows = [...coverage.entries()]
    .map(([province, c]) => {
      const totals = provinceAreaTotals(province);
      return {
        province,
        activities: c.activities,
        people: c.users.size,
        amphoeDone: c.amphoe.size,
        amphoeTotal: totals.amphoe,
        amphoePct: totals.amphoe ? (c.amphoe.size / totals.amphoe) * 100 : 0,
        tambonDone: c.tambon.size,
        tambonTotal: totals.tambon,
        sharePct: scoped.length ? (c.activities / scoped.length) * 100 : 0,
      };
    })
    .sort((a, b) => b.activities - a.activities || b.amphoePct - a.amphoePct);
  const maxProvinceActivities = Math.max(1, ...coverageRows.map((c) => c.activities));
  const nationalProvincePct = (provinces.size / TOTAL_PROVINCES) * 100;

  const catRows = [...byCategory.entries()].sort((a, b) => b[1] - a[1]);
  const maxCat = Math.max(1, ...catRows.map(([, n]) => n));
  const zoneRows = getAllHealthZones()
    .map((z) => ({ zone: z, label: getThaiZoneName(z), count: byZone.get(z) ?? 0 }))
    .sort((a, b) => b.count - a.count);
  const maxZone = Math.max(1, ...zoneRows.map((z) => z.count));

  const stats = [
    { icon: ClipboardList, label: 'งานทั้งหมด', value: scoped.length, sub: year ? `ปี พ.ศ. ${year + 543}` : 'ทุกปี' },
    { icon: MapPin, label: 'จังหวัดที่มีงาน', value: provinces.size, sub: `จาก ${TOTAL_PROVINCES} จังหวัด` },
    { icon: Users, label: 'เจ้าหน้าที่ที่บันทึกงาน', value: new Set(scoped.map((r) => r.userId)).size, sub: 'คน' },
    { icon: Layers, label: 'ประเด็นงานที่ใช้จริง', value: byCategory.size, sub: 'หมวด' },
  ];

  const yearHref = (y?: number) => (y ? `/dashboard?year=${y}` : '/dashboard');

  return (
    <div className="space-y-5">
      {/* ตัวกรองปี */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-gray-500">ช่วงเวลา:</span>
        <Link
          href={yearHref()}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
            !year ? 'bg-orange-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-orange-50'
          }`}
        >
          ทุกปี
        </Link>
        {years.map((y) => (
          <Link
            key={y}
            href={yearHref(y)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              year === y ? 'bg-orange-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-orange-50'
            }`}
          >
            พ.ศ. {y + 543}
          </Link>
        ))}
      </div>

      {/* ตัวเลขรวม */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map(({ icon: Icon, label, value, sub }) => (
          <div key={label} className="bg-white rounded-2xl border border-orange-100 p-4">
            <Icon className="w-5 h-5 text-orange-500" />
            <p className="mt-2 text-3xl font-bold text-gray-800">{value}</p>
            <p className="text-xs text-gray-600">{label}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* สัญญาณที่ผู้บริหารต้องเห็น */}
      <div className="grid sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl border border-orange-100 p-4">
          <p className="flex items-center gap-1.5 text-xs text-gray-500">
            <MapPinOff className="w-4 h-4 text-gray-400" /> ช่องว่างพื้นที่
          </p>
          <p className="mt-1 text-2xl font-bold text-gray-800">
            {TOTAL_PROVINCES - provinces.size} <span className="text-sm font-normal text-gray-500">จังหวัด</span>
          </p>
          <p className="text-[11px] text-gray-400">
            ยังไม่มีงานในระบบเลย · ครอบคลุมแล้ว {nationalProvincePct.toFixed(0)}% ของประเทศ
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-orange-100 p-4">
          <p className="flex items-center gap-1.5 text-xs text-gray-500">
            <Users2 className="w-4 h-4 text-orange-500" /> พื้นที่ทำงานทับซ้อน
          </p>
          <p className="mt-1 text-2xl font-bold text-gray-800">
            {overlapProvinces.length} <span className="text-sm font-normal text-gray-500">จังหวัด</span>
          </p>
          <p className="text-[11px] text-gray-400 truncate">
            {overlapProvinces.slice(0, 3).map(([p, u]) => `${p} ${u.size} คน`).join(' · ') || 'ยังไม่มี'}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-orange-100 p-4">
          <p className="flex items-center gap-1.5 text-xs text-gray-500">
            <TrendingUp className="w-4 h-4 text-orange-500" /> เทียบปีก่อน
          </p>
          <p className="mt-1 text-2xl font-bold text-gray-800">
            {thisYearCount}
            {yoy !== null && (
              <span className={`ml-2 text-sm font-medium ${yoy >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {yoy >= 0 ? '+' : ''}
                {yoy}%
              </span>
            )}
          </p>
          <p className="text-[11px] text-gray-400">
            พ.ศ. {now.getFullYear() + 543} · ปีก่อน {lastYearCount} งาน
          </p>
        </div>
      </div>

      {/* แนวโน้มรายเดือน */}
      <section className="bg-white rounded-2xl border border-orange-100 p-5">
        <h2 className="text-sm font-semibold text-gray-800">แนวโน้มการบันทึกงาน 12 เดือนล่าสุด</h2>
        <p className="text-[11px] text-gray-400 mb-4">นับตามวันเริ่มดำเนินการ (ถ้าไม่ระบุใช้วันที่บันทึก)</p>
        <div className="flex items-end gap-1.5 h-32">
          {months.map((m, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[10px] text-gray-500">{m.count || ''}</span>
              <div
                className="w-full rounded-t bg-orange-500"
                style={{ height: `${Math.max(2, (m.count / maxMonth) * 88)}px` }}
                title={`${THAI_MONTHS[m.m]} ${m.y + 543}: ${m.count} งาน`}
              />
              <span className="text-[9px] text-gray-400">{THAI_MONTHS[m.m]}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ประเด็นงาน + ภาค */}
      <div className="grid lg:grid-cols-2 gap-3">
        <section className="bg-white rounded-2xl border border-orange-100 p-5">
          <h2 className="text-sm font-semibold text-gray-800 mb-3">งานรายประเด็น</h2>
          {catRows.length === 0 ? (
            <p className="text-sm text-gray-400">ยังไม่มีข้อมูล</p>
          ) : (
            <ul className="space-y-2">
              {catRows.map(([name, count]) => (
                <li key={name} className="flex items-center gap-3">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: categoryColor(name) }} />
                  <span className="text-xs text-gray-700 w-40 truncate">{name}</span>
                  <span className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <span
                      className="block h-full rounded-full"
                      style={{ width: `${(count / maxCat) * 100}%`, backgroundColor: categoryColor(name) }}
                    />
                  </span>
                  <span className="text-xs text-gray-500 w-6 text-right">{count}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="bg-white rounded-2xl border border-orange-100 p-5">
          <h2 className="text-sm font-semibold text-gray-800 mb-3">งานรายภาค</h2>
          <ul className="space-y-2">
            {zoneRows.map((z) => (
              <li key={z.zone} className="flex items-center gap-3">
                <span className="text-xs text-gray-700 w-20 truncate">{z.label}</span>
                <span className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <span
                    className="block h-full rounded-full bg-orange-500"
                    style={{ width: `${(z.count / maxZone) * 100}%` }}
                  />
                </span>
                <span className="text-xs text-gray-500 w-6 text-right">{z.count}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* ความหนาแน่นการทำงานรายจังหวัด */}
      <section className="bg-white rounded-2xl border border-orange-100 p-5">
        <h2 className="text-sm font-semibold text-gray-800">ความหนาแน่นการทำงานรายจังหวัด</h2>
        <p className="text-[11px] text-gray-400 mb-4">
          เรียงจากจังหวัดที่มีงานมากที่สุด — คอลัมน์ท้ายบอกว่าภายในจังหวัดนั้นลงลึกกี่อำเภอแล้ว
        </p>
        {coverageRows.length === 0 ? (
          <p className="text-sm text-gray-400">ยังไม่มีข้อมูล</p>
        ) : (
          <div className="max-h-[420px] overflow-y-auto -mx-1 px-1">
            <table className="w-full text-xs">
              <thead className="text-gray-500">
                <tr>
                  <th className="text-left font-medium pb-2 w-8">#</th>
                  <th className="text-left font-medium pb-2">จังหวัด</th>
                  <th className="text-left font-medium pb-2 w-[42%]">จำนวนงาน</th>
                  <th className="text-right font-medium pb-2 whitespace-nowrap">สัดส่วน</th>
                  <th className="text-right font-medium pb-2 whitespace-nowrap">เจ้าหน้าที่</th>
                  <th className="text-right font-medium pb-2 whitespace-nowrap text-gray-400">
                    อำเภอที่มีงาน / ทั้งหมด
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-orange-50">
                {coverageRows.map((c, i) => (
                  <tr key={c.province}>
                    <td className="py-2 text-gray-400 tabular-nums">{i + 1}</td>
                    <td className="py-2 text-gray-700 whitespace-nowrap font-medium">{c.province}</td>
                    <td className="py-2">
                      <span className="flex items-center gap-2">
                        <span className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                          <span
                            className="block h-full rounded-full bg-orange-500"
                            style={{ width: `${Math.max(3, (c.activities / maxProvinceActivities) * 100)}%` }}
                          />
                        </span>
                        <span className="text-gray-700 tabular-nums w-6 text-right">{c.activities}</span>
                      </span>
                    </td>
                    <td className="py-2 text-right text-gray-500 tabular-nums">
                      {c.sharePct.toFixed(1)}%
                    </td>
                    <td className="py-2 text-right text-gray-500 tabular-nums">{c.people}</td>
                    <td className="py-2 text-right text-gray-400 tabular-nums whitespace-nowrap">
                      {c.amphoeDone}/{c.amphoeTotal} ({c.amphoePct.toFixed(0)}%)
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* สถานะ + ทางลัด */}
      <section className="bg-white rounded-2xl border border-orange-100 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {Object.entries(STATUS_META).map(([key, s]) => (
              <span key={key} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${s.cls}`}>
                {s.text} <span className="font-bold">{byStatus[key] ?? 0}</span>
              </span>
            ))}
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs bg-gray-50 text-gray-500">
              ไฟล์แนบ <span className="font-bold">{files}</span>
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/activities"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-orange-600 text-white text-xs font-medium hover:bg-orange-700 transition-colors"
            >
              <Table2 className="w-4 h-4" /> ตารางงานทั้งหมด
            </Link>
            <Link
              href="/map"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-orange-200 text-orange-700 text-xs font-medium hover:bg-orange-50 transition-colors"
            >
              <MapIcon className="w-4 h-4" /> แผนที่รวม
            </Link>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- ดาวน์โหลดไฟล์จาก API ต้องเป็น <a> ไม่ใช่ <Link> */}
            <a
              href="/api/activities/export"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-orange-200 text-orange-700 text-xs font-medium hover:bg-orange-50 transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4" /> Excel
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
