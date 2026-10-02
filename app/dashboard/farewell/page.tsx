// app/dashboard/farewell/page.tsx — สถิติการใช้ "ส่งด้วยใจ" (แอดมินเท่านั้น)
// มาจากตาราง FarewellEvent ที่เก็บแบบไม่ระบุตัวตน: ชนิดเหตุการณ์ + จังหวัด/ภาค + รหัสตัวเลือกในแผน
// ไม่มีข้อมูลรายครอบครัวให้ดู — ทุกตัวเลขเป็นยอดรวม
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ClipboardCheck, Eye, Landmark, Megaphone, Printer, Play } from 'lucide-react';
import prisma from '@/app/lib/db';
import { getAdminUser } from '@/app/lib/adminAuth';
import { QUESTIONS } from '@/app/farewell/content';
import ChanFlowerIcon from '@/app/farewell/components/ChanFlowerIcon';

const PERIODS = [
  { key: '30', label: '30 วัน', days: 30 },
  { key: '90', label: '90 วัน', days: 90 },
  { key: 'all', label: 'ทั้งหมด', days: 0 },
] as const;

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);
const num = (n: number) => n.toLocaleString('th-TH');
const regionGroup = (zone: string | null) =>
  !zone ? null : zone.startsWith('north-') ? 'ภาคเหนือ' : zone.startsWith('northeast-') ? 'ภาคอีสาน' : 'ภาคอื่น';

export default async function FarewellStatsPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const admin = await getAdminUser();
  if (!admin) redirect('/dashboard');

  const { p } = await searchParams;
  const period = PERIODS.find((x) => x.key === p) ?? PERIODS[0];
  const since = period.days ? new Date(Date.now() - period.days * 86_400_000) : undefined;
  const where = since ? { createdAt: { gte: since } } : {};

  const [byType, completes, lookups, provinceRows] = await Promise.all([
    prisma.farewellEvent.groupBy({ by: ['type'], where, _count: { _all: true } }),
    prisma.farewellEvent.findMany({ where: { ...where, type: 'PLAN_COMPLETE' }, select: { answers: true } }),
    prisma.farewellEvent.groupBy({ by: ['found'], where: { ...where, type: 'LOCAL_LOOKUP' }, _count: { _all: true } }),
    prisma.farewellEvent.groupBy({
      by: ['province', 'region'],
      where: { ...where, province: { not: null }, type: { in: ['PLAN_START', 'PLAN_COMPLETE', 'LOCAL_LOOKUP'] } },
      _count: { _all: true },
    }),
  ]);
  const count = (t: string) => byType.find((x) => x.type === t)?._count._all ?? 0;

  const visits = count('VISIT');
  const starts = count('PLAN_START');
  const done = count('PLAN_COMPLETE');
  const shared = count('PRINT') + count('SHARE') + count('LINE') + count('COPY');
  const signs = count('SIGN_DOWNLOAD') + count('SIGN_PRINT');
  const lookupTotal = lookups.reduce((s, x) => s + x._count._all, 0);
  const lookupFound = lookups.find((x) => x.found === true)?._count._all ?? 0;

  // ตัวเลือกในแผน — นับจากแผนที่ทำจนถึงหน้าสรุป
  const choice = QUESTIONS.map((q) => {
    const tally = new Map<string, number>();
    let answered = 0;
    for (const c of completes) {
      const v = (c.answers as Record<string, string> | null)?.[q.key];
      if (!v) continue;
      answered += 1;
      tally.set(v, (tally.get(v) ?? 0) + 1);
    }
    return { q, answered, options: q.options.map((o) => ({ o, n: tally.get(o.id) ?? 0 })) };
  });

  const provinces = provinceRows
    .map((r) => ({ province: r.province!, n: r._count._all }))
    .sort((a, b) => b.n - a.n)
    .slice(0, 10);
  const regions = new Map<string, number>();
  for (const r of provinceRows) {
    const g = regionGroup(r.region);
    if (g) regions.set(g, (regions.get(g) ?? 0) + r._count._all);
  }

  const cards = [
    { icon: Eye, label: 'เปิดหน้าส่งด้วยใจ', value: num(visits), sub: `หน้า 3D ${num(count('JOURNEY_VIEW'))} ครั้ง` },
    { icon: Play, label: 'เริ่มวางแผน', value: num(starts), sub: visits ? `${pct(starts, visits)}% ของคนที่เปิดหน้า` : '' },
    { icon: ClipboardCheck, label: 'ทำแผนจนถึงสรุป', value: num(done), sub: starts ? `${pct(done, starts)}% ของคนที่เริ่ม` : '' },
    { icon: Printer, label: 'พิมพ์ / ส่งให้ญาติ', value: num(shared), sub: `LINE ${num(count('LINE'))} · พิมพ์ ${num(count('PRINT'))}` },
    { icon: Megaphone, label: 'ป้ายหน้างาน', value: num(signs), sub: `ดาวน์โหลด ${num(count('SIGN_DOWNLOAD'))} · พิมพ์ ${num(count('SIGN_PRINT'))}` },
    { icon: Landmark, label: 'ค้นข้อตกลงในพื้นที่', value: num(lookupTotal), sub: lookupTotal ? `พบข้อตกลง ${pct(lookupFound, lookupTotal)}%` : '' },
  ];

  return (
    <div className="max-w-6xl mx-auto px-5 py-8 space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <ChanFlowerIcon className="w-7 h-7 text-orange-600" /> สถิติส่งด้วยใจ
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            ยอดรวมแบบไม่ระบุตัวตน — ไม่มีชื่อ ตำบล หรือตัวเลขงบของครอบครัวใดในระบบ
          </p>
        </div>
        <nav aria-label="ช่วงเวลา" className="flex gap-1 rounded-full border border-orange-100 p-1 bg-white">
          {PERIODS.map((p) => (
            <Link
              key={p.key}
              href={`/dashboard/farewell?p=${p.key}`}
              aria-current={p.key === period.key ? 'page' : undefined}
              className={`px-3 py-1.5 rounded-full text-sm ${p.key === period.key ? 'bg-orange-600 text-white' : 'text-gray-600 hover:bg-orange-50'}`}
            >
              {p.label}
            </Link>
          ))}
        </nav>
      </div>

      <section className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {cards.map(({ icon: Icon, label, value, sub }) => (
          <div key={label} className="rounded-2xl border border-orange-100 bg-white p-4">
            <p className="flex items-center gap-1.5 text-xs text-gray-500">
              <Icon className="w-4 h-4 text-orange-600" /> {label}
            </p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
            {sub && <p className="mt-0.5 text-xs text-gray-500">{sub}</p>}
          </div>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2 rounded-2xl border border-orange-100 bg-white p-5">
          <h2 className="text-base font-semibold text-gray-900">ครอบครัวเลือกอะไร</h2>
          <p className="mt-0.5 text-xs text-gray-500">จากแผนที่ทำจนถึงหน้าสรุป {num(done)} แผน · ข้อที่ข้ามไม่นับ</p>
          {done === 0 ? (
            <p className="mt-6 text-sm text-gray-400">ยังไม่มีแผนที่ทำจนถึงหน้าสรุปในช่วงนี้</p>
          ) : (
            <div className="mt-4 space-y-5">
              {choice.map(({ q, answered, options }) => (
                <div key={q.key}>
                  <p className="text-sm font-medium text-gray-800">
                    {q.title} <span className="text-xs font-normal text-gray-400">({num(answered)} แผน)</span>
                  </p>
                  <ul className="mt-1.5 space-y-1">
                    {options.map(({ o, n }) => (
                      <li key={o.id} className="grid grid-cols-[minmax(0,10rem)_1fr_3rem] items-center gap-2 text-xs">
                        <span className="truncate text-gray-600" title={o.label}>
                          {o.label}
                        </span>
                        <span className="h-2.5 rounded-full bg-orange-50 overflow-hidden">
                          <span className={`block h-full rounded-full ${o.lighter ? 'bg-orange-600' : 'bg-gray-400'}`} style={{ width: `${pct(n, answered)}%` }} />
                        </span>
                        <span className="text-right tabular-nums text-gray-700">{pct(n, answered)}%</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              <p className="text-[11px] text-gray-400">แถบสีส้ม = ตัวเลือกที่ช่วยลดภาระ</p>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-orange-100 bg-white p-5">
          <h2 className="text-base font-semibold text-gray-900">มาจากที่ไหน</h2>
          <p className="mt-0.5 text-xs text-gray-500">จังหวัดที่ครอบครัวเลือก (เริ่มวางแผน/ทำแผน/ค้นข้อตกลง)</p>
          {provinces.length === 0 ? (
            <p className="mt-6 text-sm text-gray-400">ยังไม่มีข้อมูลจังหวัด</p>
          ) : (
            <>
              <p className="mt-3 text-sm text-gray-700">
                {[...regions].sort((a, b) => b[1] - a[1]).map(([g, n]) => `${g} ${num(n)}`).join(' · ')}
              </p>
              <ol className="mt-3 space-y-1.5">
                {provinces.map((p, i) => (
                  <li key={p.province} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">
                      <span className="inline-block w-5 text-gray-400 tabular-nums">{i + 1}.</span> {p.province}
                    </span>
                    <span className="tabular-nums text-gray-900">{num(p.n)}</span>
                  </li>
                ))}
              </ol>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
