// app/dashboard/policies/page.tsx — นโยบาย/ข้อตกลงงานศพปลอดเหล้า แยกระดับ รายจังหวัด (แอดมิน)
// ตอบคำถามแบบ "จังหวัดนี้มีนโยบายระดับตำบลกี่ที่ ระดับอำเภอกี่ที่" (ผู้ใช้ขอ 30 ต.ค. 2026)
// เฉพาะประเด็นย่อย "งานศพปลอดเหล้า" (FUNERAL_SUB) — ไม่รวมงาน Civic Space/ประเด็นอื่น · โทนขาวดำ + โลโก้ประเด็นย่อยงานศพ
// สถิติ (ผู้ใช้ขอ 3 พ.ย. 2026 — แบบชีตสถิติใน Excel): ตัวเลขสรุป + แยกภาค/ประเภท/ปี (คลิก = กรอง) + ข้อมูลที่ควรแก้
// การนับ: ตำบล/อำเภอ = จำนวนพื้นที่ไม่ซ้ำ (หลายงานในตำบลเดียวนับ 1) เทียบกับทั้งจังหวัด ·
//   หมู่บ้าน/จังหวัด/ประเทศ = จำนวนนโยบาย · นับจากพื้นที่หลักของงานเท่านั้น (ไม่รวม ActivityArea) · ไม่นับงานในถังขยะ
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ExternalLink } from 'lucide-react';
import prisma, { ACTIVE_ACTIVITY } from '@/app/lib/db';
import { getAdminUser } from '@/app/lib/adminAuth';
import { POLICY_LEVELS, POLICY_TYPES } from '@/app/lib/activityMeta';
import { provinceAreaTotals } from '@/app/lib/areaCoverage';
import { FUNERAL_SUB } from '@/app/lib/farewellAgreements';
import { getRegionLabel, getAllHealthZones, type HealthZone } from '@/app/utils/healthZones';
import PolicyPie, { LEVEL_FILL, LEVEL_TINT, LEVEL_INK } from '../components/PolicyPie';
import AutoFilterForm from '../components/AutoFilterForm';

const selCls =
  'px-3 py-2 text-sm text-gray-900 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-300';

type Level = (typeof POLICY_LEVELS)[number]['value'];

const NO_TYPE = '__none'; // ตัวกรอง "ยังไม่ระบุประเภท"
const VILLAGE_TYPE = 'กติกาชุมชน/ข้อตกลงหมู่บ้าน';

interface Place {
  activityId: number;
  title: string;
  where: string; // ต./อ. หรือชื่อสถานที่ ตามระดับ
  name: string | null;
  type: string | null;
  year: number | null;
}

interface ProvinceRow {
  province: string;
  region: string;
  village: number;
  tambon: Set<string>;
  amphoe: Set<string>;
  province_: number;
  national: number;
  places: Record<Level, Place[]>;
}

const emptyPlaces = (): Record<Level, Place[]> => ({ VILLAGE: [], SUBDISTRICT: [], DISTRICT: [], PROVINCE: [], NATIONAL: [] });

export default async function PoliciesByAreaPage({
  searchParams,
}: {
  searchParams: Promise<{ region?: string; province?: string; type?: string; year?: string; level?: string }>;
}) {
  const admin = await getAdminUser();
  if (!admin) redirect('/dashboard');

  const sp = await searchParams;
  const region = getAllHealthZones().find((z) => z === sp.region) ?? '';
  const province = sp.province ?? '';
  const type = sp.type === NO_TYPE ? NO_TYPE : (POLICY_TYPES.find((t) => t === sp.type) ?? '');
  const year = Number(sp.year) || 0; // พ.ศ. ของนโยบาย
  const level = POLICY_LEVELS.find((l) => l.value === sp.level)?.value ?? null; // ชิ้นพายที่เลือก

  // ActivityPolicy ไม่ผ่านตัวกรองถังขยะอัตโนมัติ (relation ซ้อน) — ต้องใส่ ACTIVE_ACTIVITY เอง
  const funeral = { ...ACTIVE_ACTIVITY, subCategory: { name: FUNERAL_SUB } };
  const [policies, yearOptions, funeralSub] = await Promise.all([
    prisma.activityPolicy.findMany({
      where: {
        ...(type === NO_TYPE ? { OR: [{ type: null }, { type: '' }] } : type ? { type } : {}),
        ...(year ? { year } : {}),
        activity: { ...funeral, ...(region ? { region } : {}), ...(province ? { province } : {}) },
      },
      select: {
        level: true,
        name: true,
        type: true,
        year: true,
        activity: {
          select: {
            id: true, title: true, province: true, amphoe: true, district: true, areaName: true, region: true,
            attachments: { where: { policyLevel: { not: null } }, select: { policyLevel: true } },
          },
        },
      },
    }),
    prisma.activityPolicy.findMany({
      where: { year: { not: null }, activity: funeral },
      select: { year: true },
      distinct: ['year'],
      orderBy: { year: 'desc' },
    }),
    prisma.workSubCategory.findFirst({ where: { name: FUNERAL_SUB }, select: { id: true, logo: true } }),
  ]);
  // โลโก้ประเด็นย่อยงานศพ (ชุดเดียวกับหมุดบนแผนที่/การ์ดกรณีศึกษา) ผ่าน route สาธารณะ
  const logoUrl = funeralSub?.logo
    ? `/api/public-logo/sub/${funeralSub.id}?v=${encodeURIComponent(funeralSub.logo.split('/').pop()!)}`
    : null;

  const byProvince = new Map<string, ProvinceRow>();
  for (const p of policies) {
    const a = p.activity;
    const row =
      byProvince.get(a.province) ??
      {
        province: a.province,
        region: a.region,
        village: 0,
        tambon: new Set<string>(),
        amphoe: new Set<string>(),
        province_: 0,
        national: 0,
        places: emptyPlaces(),
      };
    const level = p.level as Level;
    if (level === 'VILLAGE') row.village++;
    if (level === 'SUBDISTRICT') row.tambon.add(`${a.amphoe}|${a.district}`);
    if (level === 'DISTRICT') row.amphoe.add(a.amphoe);
    if (level === 'PROVINCE') row.province_++;
    if (level === 'NATIONAL') row.national++;
    const where =
      level === 'VILLAGE'
        ? [a.areaName, `ต.${a.district} อ.${a.amphoe}`].filter(Boolean).join(' · ')
        : level === 'SUBDISTRICT'
          ? `ต.${a.district} อ.${a.amphoe}`
          : level === 'DISTRICT'
            ? `อ.${a.amphoe}`
            : `จ.${a.province}`;
    row.places[level].push({ activityId: a.id, title: a.title, where, name: p.name, type: p.type, year: p.year });
    byProvince.set(a.province, row);
  }

  const rows = [...byProvince.values()]
    .map((r) => ({ ...r, totals: provinceAreaTotals(r.province) }))
    .sort(
      (a, b) =>
        b.tambon.size + b.amphoe.size + b.village + b.province_ - (a.tambon.size + a.amphoe.size + a.village + a.province_) ||
        a.province.localeCompare(b.province, 'th'),
    );

  // สรุปทั้งประเทศ (ตามตัวกรอง)
  const sum = {
    VILLAGE: rows.reduce((n, r) => n + r.village, 0),
    SUBDISTRICT: rows.reduce((n, r) => n + r.tambon.size, 0),
    DISTRICT: rows.reduce((n, r) => n + r.amphoe.size, 0),
    PROVINCE: rows.filter((r) => r.province_ > 0).length,
    NATIONAL: rows.reduce((n, r) => n + r.national, 0),
  };
  // ขนาดชิ้นพาย = จำนวนนโยบาย (หน่วยเดียวกันทุกระดับ) · จำนวนพื้นที่ไม่ซ้ำแสดงในคำอธิบาย
  const policyCount = Object.fromEntries(
    POLICY_LEVELS.map(({ value }) => [value, rows.reduce((n, r) => n + r.places[value].length, 0)]),
  ) as Record<Level, number>;
  const levelHref = (l: Level | null) => {
    const q = new URLSearchParams();
    if (region) q.set('region', region);
    if (province) q.set('province', province);
    if (type) q.set('type', type);
    if (year) q.set('year', String(year));
    if (l) q.set('level', l);
    const qs = q.toString();
    return `/dashboard/policies${qs ? `?${qs}` : ''}#by-level`;
  };
  // รายการทั้งหมดของระดับที่เลือก เรียงตามจังหวัด แล้วพื้นที่
  const levelPlaces = level
    ? rows
        .flatMap((r) => r.places[level].map((pl) => ({ ...pl, province: r.province })))
        .sort((a, b) => a.province.localeCompare(b.province, 'th') || a.where.localeCompare(b.where, 'th'))
    : [];
  const totalPolicies = POLICY_LEVELS.reduce((n, { value }) => n + policyCount[value], 0);
  const UNIT: Record<Level, string> = { VILLAGE: 'นโยบาย', SUBDISTRICT: 'ตำบล', DISTRICT: 'อำเภอ', PROVINCE: 'จังหวัด', NATIONAL: 'นโยบาย' };

  // ── สถิติ (ตามตัวกรอง) ──
  const countBy = (key: (p: (typeof policies)[number]) => string) => {
    const m = new Map<string, number>();
    for (const p of policies) m.set(key(p), (m.get(key(p)) ?? 0) + 1);
    return [...m];
  };
  const hasFile = (p: (typeof policies)[number]) => p.activity.attachments.some((t) => t.policyLevel === p.level);
  const filterHref = (patch: Record<string, string>) => {
    const q = new URLSearchParams();
    const cur: Record<string, string> = { region, province, type, year: year ? String(year) : '', ...patch };
    for (const [k, v] of Object.entries(cur)) if (v) q.set(k, v);
    const qs = q.toString();
    return `/dashboard/policies${qs ? `?${qs}` : ''}`;
  };
  const regionStats = countBy((p) => p.activity.region)
    .map(([z, n]) => ({
      label: getRegionLabel(z as HealthZone),
      sub: `${new Set(policies.filter((p) => p.activity.region === z).map((p) => p.activity.province)).size} จังหวัด`,
      n,
      href: filterHref({ region: region === z ? '' : z, province: '' }),
      active: region === z,
    }))
    .sort((a, b) => b.n - a.n);
  const typeStats = countBy((p) => p.type || NO_TYPE)
    .map(([t, n]) => ({
      label: t === NO_TYPE ? 'ยังไม่ระบุประเภท' : t,
      n,
      href: filterHref({ type: type === t ? '' : t }),
      active: type === t,
      muted: t === NO_TYPE,
    }))
    .sort((a, b) => b.n - a.n);
  const yearStats = countBy((p) => (p.year ? String(p.year) : ''))
    .map(([y, n]) => ({
      label: y ? `พ.ศ. ${y}` : 'ไม่ระบุปี',
      n,
      href: y ? filterHref({ year: String(year) === y ? '' : y }) : null,
      active: String(year) === y,
      muted: !y,
    }))
    .sort((a, b) => (a.label < b.label ? -1 : 1));
  const withFile = policies.filter(hasFile).length;
  // ข้อมูลที่ควรแก้: ไม่ระบุประเภท · ประเภทข้อตกลงหมู่บ้านแต่ระดับไม่ใช่หมู่บ้าน (ไม่นับ "ไม่มีไฟล์" — แทบทุกแถว ดูจากตัวเลขสรุปแทน)
  const issues = policies
    .map((p) => ({
      p,
      why: [
        !p.type && 'ยังไม่ระบุประเภท',
        p.type === VILLAGE_TYPE && p.level !== 'VILLAGE' &&
          `ประเภทเป็นข้อตกลงหมู่บ้าน แต่ระดับเป็น${POLICY_LEVELS.find((l) => l.value === p.level)?.label}`,
        !p.year && 'ไม่ระบุปี',
      ].filter(Boolean) as string[],
    }))
    .filter((x) => x.why.length)
    .sort((a, b) => a.p.activity.province.localeCompare(b.p.activity.province, 'th') || a.p.activity.id - b.p.activity.id);

  const provinceOptions = [...new Set(policies.map((p) => p.activity.province))].sort((a, b) => a.localeCompare(b, 'th'));
  if (province && !provinceOptions.includes(province)) provinceOptions.unshift(province);
  const filtered = Boolean(region || province || type || year);

  return (
    <div className="max-w-6xl mx-auto px-5 py-8 space-y-6">
      <div className="flex items-center gap-4">
        {logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- โลโก้จาก route ภายใน ขนาดเล็ก ไม่ต้องผ่าน next/image
          <img src={logoUrl} alt="งานศพปลอดเหล้า" className="h-14 w-14 shrink-0 rounded-full border border-gray-200 bg-white object-contain p-1.5" />
        )}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">นโยบายงานศพปลอดเหล้า รายพื้นที่</h1>
          <p className="mt-1 text-sm text-gray-500">
            แยกระดับรายจังหวัด · ตำบลและอำเภอนับเป็นจำนวนพื้นที่ (หลายงานในพื้นที่เดียวนับครั้งเดียว) เทียบกับทั้งจังหวัด ·
            คลิกจังหวัดเพื่อดูรายชื่อพื้นที่
          </p>
        </div>
      </div>

      {/* ตัวกรอง — เลือกแล้วกรองทันที (GET params แชร์ได้) · key ให้ select ตามทันเมื่อกดแถบสถิติด้านล่าง */}
      <AutoFilterForm
        key={`${region}|${province}|${type}|${year}`}
        showClear={filtered}
        className="flex flex-wrap items-end gap-x-2 gap-y-3 rounded-2xl border border-gray-200 bg-white p-4"
      >
        <label className="text-xs text-gray-500">
          <span className="block mb-1">ภาค</span>
          <select name="region" defaultValue={region} className={selCls}>
            <option value="">ทุกภาค</option>
            {getAllHealthZones().map((z) => (
              <option key={z} value={z}>{getRegionLabel(z)}</option>
            ))}
          </select>
        </label>
        <label className="text-xs text-gray-500">
          <span className="block mb-1">จังหวัด</span>
          <select name="province" defaultValue={province} className={selCls}>
            <option value="">ทุกจังหวัด</option>
            {provinceOptions.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <label className="text-xs text-gray-500">
          <span className="block mb-1">ประเภทนโยบาย</span>
          <select name="type" defaultValue={type} className={selCls}>
            <option value="">ทุกประเภท</option>
            {POLICY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            <option value={NO_TYPE}>ยังไม่ระบุประเภท</option>
          </select>
        </label>
        <label className="text-xs text-gray-500">
          <span className="block mb-1">ปีที่ประกาศ (พ.ศ.)</span>
          <select name="year" defaultValue={year || ''} className={selCls}>
            <option value="">ทุกปี</option>
            {yearOptions.map((y) => y.year && <option key={y.year} value={y.year}>{y.year}</option>)}
          </select>
        </label>
      </AutoFilterForm>

      {/* ตัวเลขสรุป (ตามตัวกรอง) */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Kpi label="นโยบายทั้งหมด" value={totalPolicies} accent />
        <Kpi label="จังหวัด" value={rows.length} />
        <Kpi label="ภาค" value={new Set(rows.map((r) => r.region)).size} unit="จาก 10 ภาค" />
        <Kpi label="ตำบลที่มีนโยบายระดับตำบล" value={sum.SUBDISTRICT} />
        <Kpi label="มีไฟล์เอกสารนโยบาย" value={withFile} unit={`จาก ${totalPolicies} นโยบาย`} />
      </div>

      {/* สรุปรวมรายระดับ: พาย (ขนาด = จำนวนนโยบาย) — จิ้มชิ้นหรือคำอธิบาย = รายการทั้งหมดของระดับนั้น (?level=) */}
      <section id="by-level" className="rounded-2xl border border-gray-200 bg-white p-5 scroll-mt-20">
        <h2 className="text-sm font-semibold text-gray-900">นโยบายแยกตามระดับ</h2>
        <p className="text-xs text-gray-500">ขนาดชิ้น = จำนวนนโยบาย · จิ้มชิ้นหรือรายการด้านขวาเพื่อดูพื้นที่ทั้งหมดของระดับนั้น</p>
        <div className="mt-4 grid items-center gap-6 md:grid-cols-[260px_minmax(0,1fr)]">
          <PolicyPie counts={policyCount} selected={level} href={levelHref} />
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {POLICY_LEVELS.map(({ value, label }) => {
              const active = level === value;
              const n = policyCount[value];
              return (
                <li key={value}>
                  <Link
                    href={levelHref(active ? null : value)}
                    scroll={false}
                    aria-current={active ? 'true' : undefined}
                    // ขอบบางเส้นเดียวสีของระดับ (ผู้ใช้ไม่เอาแถบหนาด้านซ้าย/วงดำ — "เหมือน AI") · เลือกอยู่ = พื้นสีเข้มขึ้น
                    className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
                      n === 0 ? 'pointer-events-none opacity-50' : ''
                    }`}
                    style={{ background: active ? LEVEL_FILL[value] : LEVEL_TINT[value], borderColor: LEVEL_FILL[value] }}
                  >
                    <span className="h-4 w-4 shrink-0 rounded-full" style={{ background: active ? LEVEL_INK[value] : LEVEL_FILL[value] }} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-gray-900">ระดับ{label}</span>
                      <span className="block text-xs text-gray-500">
                        {n.toLocaleString('th-TH')} นโยบาย
                        {value === 'SUBDISTRICT' || value === 'DISTRICT' || value === 'PROVINCE'
                          ? ` · ${sum[value].toLocaleString('th-TH')} ${UNIT[value]}`
                          : ''}
                      </span>
                    </span>
                    <span className="text-base font-semibold tabular-nums" style={{ color: LEVEL_INK[value] }}>
                      {totalPolicies ? `${Math.round((n / totalPolicies) * 100)}%` : '—'}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        {level && (
          <div className="mt-5 rounded-xl border p-4" style={{ background: LEVEL_TINT[level], borderColor: LEVEL_FILL[level] }}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-base font-semibold" style={{ color: LEVEL_INK[level] }}>
                นโยบายระดับ{POLICY_LEVELS.find((l) => l.value === level)?.label}
                <span className="ml-2 text-sm font-normal text-gray-500">
                  {levelPlaces.length.toLocaleString('th-TH')} นโยบาย ·{' '}
                  {new Set(levelPlaces.map((p) => p.province)).size} จังหวัด
                </span>
              </h3>
              <Link href={levelHref(null)} scroll={false} className="text-xs text-gray-500 underline underline-offset-2 hover:text-gray-900">
                ปิดรายการ
              </Link>
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-900 text-xs text-gray-500">
                    <th className="py-2 pr-3 font-medium">จังหวัด</th>
                    <th className="py-2 pr-3 font-medium">พื้นที่</th>
                    <th className="py-2 pr-3 font-medium">ชื่อนโยบาย / ประเภท</th>
                    <th className="py-2 pr-3 font-medium text-right">ปี</th>
                    <th className="py-2 font-medium"><span className="sr-only">เปิดงาน</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {levelPlaces.map((pl) => (
                    <tr key={`${pl.activityId}`} className="align-top">
                      <td className="py-2 pr-3 whitespace-nowrap text-gray-900">{pl.province}</td>
                      <td className="py-2 pr-3 text-gray-900">{pl.where}</td>
                      <td className="py-2 pr-3 text-gray-600">
                        {pl.name ?? '—'}
                        {pl.type && <span className="block text-xs text-gray-400">{pl.type}</span>}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums text-gray-600">{pl.year ?? '—'}</td>
                      <td className="py-2">
                        <Link href={`/activity/${pl.activityId}`} className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-gray-500 hover:text-gray-900">
                          เปิดงาน <ExternalLink className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* แยกตามภาค / ประเภท / ปี — คลิกแถว = กรองทั้งหน้า (คลิกซ้ำ = เลิกกรอง) */}
      {policies.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-3">
          <BarList title="แยกตามภาค" items={regionStats} total={totalPolicies} />
          <BarList title="แยกตามประเภทนโยบาย" items={typeStats} total={totalPolicies} />
          <BarList title="แยกตามปีที่ประกาศ" items={yearStats} total={totalPolicies} />
        </div>
      )}

      {/* ตารางรายจังหวัด */}
      {rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-gray-300 p-10 text-center text-sm text-gray-500">
          ไม่พบนโยบายตามตัวกรองนี้
        </p>
      ) : (
        <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
          <div className="hidden md:grid grid-cols-[minmax(0,1.6fr)_repeat(5,minmax(0,1fr))] gap-2 px-4 py-2.5 bg-gray-900 text-xs font-medium text-white">
            <span>จังหวัด</span>
            <LevelHead level="VILLAGE" label="หมู่บ้าน" />
            <LevelHead level="SUBDISTRICT" label="ตำบล" />
            <LevelHead level="DISTRICT" label="อำเภอ" />
            <LevelHead level="PROVINCE" label="จังหวัด" />
            <LevelHead level="NATIONAL" label="ประเทศ" />
          </div>
          <ul className="divide-y divide-gray-100">
            {rows.map((r) => (
              <li key={r.province}>
                <details className="group">
                  <summary className="grid grid-cols-2 md:grid-cols-[minmax(0,1.6fr)_repeat(5,minmax(0,1fr))] gap-2 px-4 py-3 cursor-pointer list-none hover:bg-gray-50 group-open:bg-gray-50 [&::-webkit-details-marker]:hidden">
                    <span className="col-span-2 md:col-span-1 min-w-0">
                      <span className="font-medium text-gray-900">{r.province}</span>
                      <span className="ml-2 text-xs text-gray-400">{getRegionLabel(r.region as HealthZone)}</span>
                      <span className="ml-2 text-xs text-gray-500 underline underline-offset-2 group-open:hidden">ดูพื้นที่</span>
                      <span className="ml-2 text-xs text-gray-500 underline underline-offset-2 hidden group-open:inline">ซ่อน</span>
                    </span>
                    <Cell level="VILLAGE" label="หมู่บ้าน" value={r.village} />
                    <Cell level="SUBDISTRICT" label="ตำบล" value={r.tambon.size} of={r.totals.tambon} />
                    <Cell level="DISTRICT" label="อำเภอ" value={r.amphoe.size} of={r.totals.amphoe} />
                    <Cell level="PROVINCE" label="จังหวัด" value={r.province_} text={r.province_ ? 'มี' : undefined} />
                    <Cell level="NATIONAL" label="ประเทศ" value={r.national} />
                  </summary>
                  <div className="px-4 pb-4 pt-1 grid gap-4 md:grid-cols-2 bg-gray-50">
                    {POLICY_LEVELS.filter(({ value }) => r.places[value].length > 0).map(({ value, label }) => (
                      <div key={value}>
                        <p className="mb-1.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ background: LEVEL_TINT[value], color: LEVEL_INK[value] }}>
                          <span className="h-2 w-2 rounded-full" style={{ background: LEVEL_FILL[value] }} />
                          ระดับ{label} <span className="font-normal text-gray-400">({r.places[value].length} นโยบาย)</span>
                        </p>
                        <ul className="space-y-1.5">
                          {r.places[value]
                            .sort((x, y) => x.where.localeCompare(y.where, 'th'))
                            .map((pl) => (
                              <li key={`${value}-${pl.activityId}`} className="text-sm">
                                <Link
                                  href={`/activity/${pl.activityId}`}
                                  className="group/link inline-flex items-start gap-1 text-gray-800 hover:text-gray-500"
                                >
                                  <span>
                                    <span className="font-medium">{pl.where}</span>
                                    {(pl.name || pl.type || pl.year) && (
                                      <span className="block text-xs text-gray-500">
                                        {[pl.name, pl.type, pl.year ? `ปี ${pl.year}` : null].filter(Boolean).join(' · ')}
                                      </span>
                                    )}
                                  </span>
                                  <ExternalLink className="mt-1 w-3 h-3 shrink-0 text-gray-300 group-hover/link:text-gray-600" />
                                </Link>
                              </li>
                            ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </div>
      )}

      {issues.length > 0 && (
        <details className="group rounded-2xl border border-gray-200 bg-white">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
            <span>
              <span className="text-sm font-semibold text-gray-900">ข้อมูลที่ควรแก้ {issues.length} รายการ</span>
              <span className="block text-xs text-gray-500">นโยบายที่ยังไม่ระบุประเภท/ปี หรือประเภทไม่ตรงกับระดับ — กดแก้ไขงานเพื่อเติมข้อมูล</span>
            </span>
            <span className="text-xs text-gray-500 underline underline-offset-2 group-open:hidden">ดูรายการ</span>
            <span className="hidden text-xs text-gray-500 underline underline-offset-2 group-open:inline">ซ่อน</span>
          </summary>
          <div className="overflow-x-auto border-t border-gray-200 px-5 pb-4">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-900 text-xs text-gray-500">
                  <th className="py-2 pr-3 font-medium">จังหวัด</th>
                  <th className="py-2 pr-3 font-medium">พื้นที่</th>
                  <th className="py-2 pr-3 font-medium">ระดับ / ชื่อนโยบาย</th>
                  <th className="py-2 pr-3 font-medium">ที่ควรแก้</th>
                  <th className="py-2 font-medium"><span className="sr-only">แก้ไข</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {issues.map(({ p, why }) => (
                  <tr key={`${p.activity.id}-${p.level}`} className="align-top">
                    <td className="py-2 pr-3 whitespace-nowrap text-gray-900">{p.activity.province}</td>
                    <td className="py-2 pr-3 text-gray-900">
                      {[p.activity.areaName, `ต.${p.activity.district} อ.${p.activity.amphoe}`].filter(Boolean).join(' · ')}
                    </td>
                    <td className="py-2 pr-3 text-gray-600">
                      ระดับ{POLICY_LEVELS.find((l) => l.value === p.level)?.label}
                      {p.name && <span className="block text-xs text-gray-400">{p.name}</span>}
                    </td>
                    <td className="py-2 pr-3 text-gray-900">{why.join(' · ')}</td>
                    <td className="py-2">
                      <Link href={`/activity/${p.activity.id}/edit`} className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-gray-500 hover:text-gray-900">
                        แก้ไขงาน <ExternalLink className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}

function Kpi({ label, value, unit, accent }: { label: string; value: number; unit?: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`mt-1 text-3xl font-bold tabular-nums ${accent ? 'text-orange-600' : 'text-gray-900'}`}>
        {value.toLocaleString('th-TH')}
      </p>
      {unit && <p className="text-xs text-gray-400">{unit}</p>}
    </div>
  );
}

// แถบแนวนอนแบบเดียวกับชีตสถิติใน Excel: ชื่อ · จำนวน · % · แท่ง (ยาวเทียบค่ามากสุดในกลุ่ม)
function BarList({
  title,
  items,
  total,
}: {
  title: string;
  items: { label: string; sub?: string; n: number; href: string | null; active?: boolean; muted?: boolean }[];
  total: number;
}) {
  const max = Math.max(1, ...items.map((i) => i.n));
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
      <ul className="mt-3 space-y-1">
        {items.map((it) => {
          const body = (
            <>
              <span className="flex items-baseline justify-between gap-3 text-sm">
                <span className={`min-w-0 truncate ${it.muted ? 'text-gray-400' : 'text-gray-900'}`}>
                  {it.label}
                  {it.sub && <span className="ml-1.5 text-xs text-gray-400">{it.sub}</span>}
                </span>
                <span className="shrink-0 tabular-nums">
                  <span className="font-semibold text-gray-900">{it.n.toLocaleString('th-TH')}</span>
                  <span className="ml-2 inline-block w-9 text-right text-xs text-gray-400">{Math.round((it.n / total) * 100)}%</span>
                </span>
              </span>
              <span className="mt-1 block h-1.5 rounded-full bg-gray-100">
                <span className={`block h-full rounded-full ${it.muted ? 'bg-gray-300' : 'bg-gray-900'}`} style={{ width: `${(it.n / max) * 100}%` }} />
              </span>
            </>
          );
          return (
            <li key={it.label}>
              {it.href ? (
                <Link
                  href={it.href}
                  scroll={false}
                  aria-current={it.active ? 'true' : undefined}
                  className={`block rounded-lg px-2 py-1.5 transition-colors ${it.active ? 'bg-gray-100 ring-1 ring-gray-900' : 'hover:bg-gray-50'}`}
                >
                  {body}
                </Link>
              ) : (
                <div className="px-2 py-1.5">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function LevelHead({ level, label }: { level: Level; label: string }) {
  return (
    <span className="flex items-center justify-end gap-1.5">
      <span className="h-2.5 w-2.5 rounded-full ring-1 ring-white/60" style={{ background: LEVEL_FILL[level] }} />
      {label}
    </span>
  );
}

// ตัวเลขรายระดับเป็นชิปสีอ่อนของระดับนั้น (ผู้ใช้ขอ 11 พ.ย. 2026 — ขาวดำล้วนอ่านยาก)
function Cell({ level, label, value, of, text }: { level: Level; label: string; value: number; of?: number; text?: string }) {
  return (
    <span className="flex items-baseline justify-between md:justify-end gap-2 text-sm tabular-nums">
      <span className="md:hidden text-xs text-gray-400">{label}</span>
      {value === 0 ? (
        <span className="text-gray-300">—</span>
      ) : (
        <span className="rounded-md px-2 py-0.5 font-semibold" style={{ background: LEVEL_TINT[level], color: LEVEL_INK[level] }}>
          {text ?? value.toLocaleString('th-TH')}
          {of ? <span className="ml-1 text-xs font-normal text-gray-400">/ {of}</span> : null}
        </span>
      )}
    </span>
  );
}
