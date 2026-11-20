// app/dashboard/policies/page.tsx — นโยบาย/ข้อตกลงงานศพปลอดเหล้า แยกระดับ รายจังหวัด (แอดมิน)
// ตอบคำถามแบบ "จังหวัดนี้มีนโยบายระดับตำบลกี่ที่ ระดับอำเภอกี่ที่" (ผู้ใช้ขอ 30 ต.ค. 2026)
// เฉพาะประเด็นย่อย "งานศพปลอดเหล้า" (FUNERAL_SUB) — ไม่รวมงาน Civic Space/ประเด็นอื่น · โทนขาวดำ + โลโก้ประเด็นย่อยงานศพ
// สถิติ: ตัวเลขสรุป + พายรายระดับ + ข้อมูลที่ควรแก้ (แถบแยกภาค/ประเภท/ปี เอาออก 11 พ.ย. 2026 — ผู้ใช้ว่าเยอะจนงง)
// การนับ: ตำบล/อำเภอ = จำนวนพื้นที่ไม่ซ้ำ (หลายงานในตำบลเดียวนับ 1) เทียบกับทั้งจังหวัด ·
//   หมู่บ้าน/จังหวัด/ประเทศ = จำนวนนโยบาย · นับจากพื้นที่หลักของงานเท่านั้น (ไม่รวม ActivityArea) · ไม่นับงานในถังขยะ
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ExternalLink, Search } from 'lucide-react';
import prisma, { ACTIVE_ACTIVITY } from '@/app/lib/db';
import { getAdminUser } from '@/app/lib/adminAuth';
import { POLICY_LEVELS, POLICY_TYPES } from '@/app/lib/activityMeta';
import { provinceAreaTotals } from '@/app/lib/areaCoverage';
import { FUNERAL_SUB } from '@/app/lib/farewellAgreements';
import { getRegionLabel, getAllHealthZones } from '@/app/utils/healthZones';
import PolicyPie, { LEVEL_FILL, LEVEL_TINT, LEVEL_INK } from '../components/PolicyPie';
import AutoFilterForm from '../components/AutoFilterForm';

const selCls =
  'w-full h-10 px-3 text-sm text-gray-900 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-300';
// ป้ายช่องตัวกรอง — เข้มพอ (gray-600) ไม่ใช่เทาจาง · ช่องเท่ากันทุกช่องบนกริด (15 พ.ย. 2026)
const labelCls = 'block text-xs font-medium text-gray-600';

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
  searchParams: Promise<{
    region?: string; province?: string; amphoe?: string; district?: string; q?: string;
    type?: string; year?: string; level?: string;
  }>;
}) {
  const admin = await getAdminUser();
  if (!admin) redirect('/dashboard');

  const sp = await searchParams;
  const region = getAllHealthZones().find((z) => z === sp.region) ?? '';
  const province = sp.province ?? '';
  // อำเภอ/ตำบล ชื่อซ้ำข้ามจังหวัดได้ (อ.เมือง) → ใช้ได้เมื่อเลือกชั้นบนแล้วเท่านั้น (ผู้ใช้แนะนำ 18 พ.ย. 2026)
  const amphoe = province ? (sp.amphoe ?? '') : '';
  const district = amphoe ? (sp.district ?? '') : '';
  // ช่องค้นหา: หมู่บ้าน/ชุมชน/สถานที่ (areaName) + ตำบล/อำเภอ/จังหวัด + ชื่องาน/ชื่อนโยบาย — ผลขึ้นใต้ตัวกรองทันที (ผู้ใช้ขอ 20 พ.ย. 2026)
  const q = (sp.q ?? '').trim().slice(0, 100);
  const type = sp.type === NO_TYPE ? NO_TYPE : (POLICY_TYPES.find((t) => t === sp.type) ?? '');
  const year = Number(sp.year) || 0; // พ.ศ. ของนโยบาย
  const level = POLICY_LEVELS.find((l) => l.value === sp.level)?.value ?? null; // ชิ้นพายที่เลือก

  // ActivityPolicy ไม่ผ่านตัวกรองถังขยะอัตโนมัติ (relation ซ้อน) — ต้องใส่ ACTIVE_ACTIVITY เอง
  const funeral = { ...ACTIVE_ACTIVITY, subCategory: { name: FUNERAL_SUB } };
  const areaWhere = {
    ...(region ? { region } : {}),
    ...(province ? { province } : {}),
    ...(amphoe ? { amphoe } : {}),
    ...(district ? { district } : {}),
  };
  const [policies, yearOptions, funeralSub, areaOptions, provinceRows] = await Promise.all([
    prisma.activityPolicy.findMany({
      where: {
        AND: [
          type === NO_TYPE ? { OR: [{ type: null }, { type: '' }] } : type ? { type } : {},
          q
            ? {
                OR: [
                  { name: { contains: q } },
                  { activity: { areaName: { contains: q } } },
                  { activity: { district: { contains: q } } },
                  { activity: { amphoe: { contains: q } } },
                  { activity: { province: { contains: q } } },
                  { activity: { title: { contains: q } } },
                ],
              }
            : {},
        ],
        ...(year ? { year } : {}),
        activity: { ...funeral, ...areaWhere },
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
    // ตัวเลือกอำเภอ/ตำบล = พื้นที่ที่มีนโยบายจริงในจังหวัดที่เลือก (ไม่ขึ้นกับตัวกรองอำเภอ/ตำบล/หมู่บ้านเอง)
    province
      ? prisma.activityPolicy.findMany({
          where: { activity: { ...funeral, province } },
          select: { activity: { select: { amphoe: true, district: true } } },
        })
      : Promise.resolve([]),
    // ตัวเลือกจังหวัด = ทุกจังหวัดที่มีนโยบายในภาคที่เลือก (เดิมดึงจากผลที่กรองจังหวัดแล้ว → เลือกแล้วเหลือตัวเลือกเดียว)
    prisma.activityPolicy.findMany({
      where: { activity: { ...funeral, ...(region ? { region } : {}) } },
      select: { activity: { select: { province: true } } },
    }),
  ]);
  const amphoeOptions = [...new Set(areaOptions.map((o) => o.activity.amphoe))].sort((a, b) => a.localeCompare(b, 'th'));
  if (amphoe && !amphoeOptions.includes(amphoe)) amphoeOptions.unshift(amphoe);
  const districtOptions = [
    ...new Set(areaOptions.filter((o) => o.activity.amphoe === amphoe).map((o) => o.activity.district)),
  ].sort((a, b) => a.localeCompare(b, 'th'));
  if (district && !districtOptions.includes(district)) districtOptions.unshift(district);
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
    const sp2 = new URLSearchParams();
    if (region) sp2.set('region', region);
    if (province) sp2.set('province', province);
    if (amphoe) sp2.set('amphoe', amphoe);
    if (district) sp2.set('district', district);
    if (q) sp2.set('q', q);
    if (type) sp2.set('type', type);
    if (year) sp2.set('year', String(year));
    if (l) sp2.set('level', l);
    const qs = sp2.toString();
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

  const hasFile = (p: (typeof policies)[number]) => p.activity.attachments.some((t) => t.policyLevel === p.level);
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

  const searchResults: SearchHit[] = q
    ? policies
        .map((p) => ({
          activityId: p.activity.id,
          title: p.activity.title,
          areaName: p.activity.areaName,
          district: p.activity.district,
          amphoe: p.activity.amphoe,
          province: p.activity.province,
          level: p.level as Level,
          name: p.name,
          type: p.type,
          year: p.year,
          file: hasFile(p),
        }))
        // ชื่อสถานที่/ตำบลที่ตรงคำค้นขึ้นก่อน แล้วเรียงตามจังหวัด
        .sort(
          (a, b) =>
            hitRank(a, q) - hitRank(b, q) ||
            a.province.localeCompare(b.province, 'th') ||
            a.amphoe.localeCompare(b.amphoe, 'th') ||
            a.district.localeCompare(b.district, 'th'),
        )
    : [];

  const provinceOptions = [...new Set(provinceRows.map((p) => p.activity.province))].sort((a, b) => a.localeCompare(b, 'th'));
  if (province && !provinceOptions.includes(province)) provinceOptions.unshift(province);

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
            ตำบลและอำเภอนับเป็นจำนวนพื้นที่ (หลายงานในพื้นที่เดียวนับครั้งเดียว) · จิ้มระดับในพายเพื่อดูรายชื่อพื้นที่
          </p>
        </div>
      </div>

      {/* ตัวกรอง — เลือกแล้วกรองทันที (GET params แชร์ได้) · key ให้ select ตามทันเมื่อกดแถบสถิติด้านล่าง */}
      <AutoFilterForm
        key={`${region}|${province}|${amphoe}|${district}|${type}|${year}`}
        hideStatus
        className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 items-end gap-x-3 gap-y-3 rounded-2xl border border-gray-200 bg-white p-4"
      >
        <label className={labelCls}>
          <span className="block mb-1.5">ภาค</span>
          <select name="region" defaultValue={region} data-resets="province amphoe district" className={selCls}>
            <option value="">ทุกภาค</option>
            {getAllHealthZones().map((z) => (
              <option key={z} value={z}>{getRegionLabel(z)}</option>
            ))}
          </select>
        </label>
        <label className={labelCls}>
          <span className="block mb-1.5">จังหวัด</span>
          <select name="province" defaultValue={province} data-resets="amphoe district" className={selCls}>
            <option value="">ทุกจังหวัด</option>
            {provinceOptions.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <label className={labelCls}>
          <span className="block mb-1.5">อำเภอ</span>
          <select
            name="amphoe"
            defaultValue={amphoe}
            disabled={!province}
            data-resets="district"
            className={`${selCls} disabled:bg-gray-50 disabled:text-gray-500`}
          >
            <option value="">{province ? 'ทุกอำเภอ' : 'เลือกจังหวัดก่อน'}</option>
            {amphoeOptions.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        <label className={labelCls}>
          <span className="block mb-1.5">ตำบล</span>
          <select
            name="district"
            defaultValue={district}
            disabled={!amphoe}
            className={`${selCls} disabled:bg-gray-50 disabled:text-gray-500`}
          >
            <option value="">{amphoe ? 'ทุกตำบล' : 'เลือกอำเภอก่อน'}</option>
            {districtOptions.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </label>
        <label className={labelCls}>
          <span className="block mb-1.5">ประเภทนโยบาย</span>
          <select name="type" defaultValue={type} className={selCls}>
            <option value="">ทุกประเภท</option>
            {POLICY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            <option value={NO_TYPE}>ยังไม่ระบุประเภท</option>
          </select>
        </label>
        <label className={labelCls}>
          <span className="block mb-1.5">ปีที่ประกาศ (พ.ศ.)</span>
          <select name="year" defaultValue={year || ''} className={selCls}>
            <option value="">ทุกปี</option>
            {yearOptions.map((y) => y.year && <option key={y.year} value={y.year}>{y.year}</option>)}
          </select>
        </label>
        {/* ช่องค้นหาแบบแคปซูลเต็มแถว ขอบดำ (ผู้ใช้ส่งแบบมา 20 พ.ย. 2026) — ตัวเลือก 6 ช่องอยู่ด้านบน */}
        <label className="col-span-full block">
          <span className="sr-only">ค้นหาพื้นที่</span>
          <span className="sdn-search-ring rounded-full">
            <Search className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-900" />
            <input
              type="search"
              name="q"
              defaultValue={q}
              autoComplete="off"
              placeholder="ค้นหาหมู่บ้าน ตำบล อำเภอ"
              className="block h-12 w-full rounded-full border-2 border-gray-900 bg-white pl-12 pr-5 text-base text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-4 focus:ring-gray-200"
            />
          </span>
        </label>
      </AutoFilterForm>

      {/* ผลการค้นหา — ขึ้นใต้ตัวกรองทันทีแบบหน้าผลค้นหา (ผู้ใช้ขอ 20 พ.ย. 2026) · ลบคำค้นออก = หายเอง (ไม่ต้องกดล้าง) */}
      {q && <SearchResults q={q} results={searchResults} />}

      {/* ตัวเลขสรุป (ตามตัวกรอง) */}
      {/* มือถือ: ตัวเลขหลักเต็มแถว + 4 ใบ 2×2 (เดิมใบที่ 5 ค้างแถวเดียว) · ทุกใบมีบรรทัดหน่วย สูงเท่ากัน */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Kpi label="นโยบายทั้งหมด" value={totalPolicies} unit="ทุกระดับ" wide />
        <Kpi label="จังหวัด" value={rows.length} unit="จาก 77 จังหวัด" />
        <Kpi label="ภาค" value={new Set(rows.map((r) => r.region)).size} unit="จาก 10 ภาค" />
        <Kpi label="ตำบลที่มีนโยบาย" value={sum.SUBDISTRICT} unit="ระดับตำบล" />
        <Kpi label="มีไฟล์เอกสาร" value={withFile} unit={`จาก ${totalPolicies} นโยบาย`} />
      </div>

      {/* สรุปรวมรายระดับ: พาย (ขนาด = จำนวนนโยบาย) — จิ้มชิ้นหรือคำอธิบาย = รายการทั้งหมดของระดับนั้น (?level=) */}
      <section id="by-level" className="rounded-2xl border border-gray-200 bg-white p-5 scroll-mt-20">
        <h2 className="text-sm font-semibold text-gray-900">นโยบายแยกตามระดับ</h2>
        <p className="text-xs text-gray-500">ขนาดชิ้น = จำนวนนโยบาย · จิ้มชิ้นหรือรายการเพื่อดูพื้นที่ทั้งหมดของระดับนั้น</p>
        <div className="mt-4 grid items-center gap-6 md:grid-cols-[240px_minmax(0,1fr)] md:gap-10">
          <PolicyPie counts={policyCount} selected={level} href={levelHref} />
          {/* รายการแบบรายงาน: แถวละระดับ + แถบสัดส่วนสีประจำระดับ (เดิมกล่องพื้นสีทุกใบ ดูรก + ใบสุดท้ายค้าง) ·
              ไม่มีแถบหนาด้านซ้าย/วงดำ (ผู้ใช้ไม่เอา) · เลือกอยู่ = พื้นสีอ่อนของระดับ */}
          <ul className="divide-y divide-gray-100 border-y border-gray-100">
            {POLICY_LEVELS.map(({ value, label }) => {
              const active = level === value;
              const n = policyCount[value];
              const pct = totalPolicies ? Math.round((n / totalPolicies) * 100) : 0;
              return (
                <li key={value}>
                  <Link
                    href={levelHref(active ? null : value)}
                    scroll={false}
                    aria-current={active ? 'true' : undefined}
                    className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 rounded-lg px-3 py-3 transition-colors sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)_3.5rem] ${
                      n === 0 ? 'pointer-events-none opacity-45' : 'hover:bg-gray-50'
                    }`}
                    style={active ? { background: LEVEL_TINT[value] } : undefined}
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: LEVEL_FILL[value] }} />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-gray-900">ระดับ{label}</span>
                        <span className="block text-xs text-gray-500 tabular-nums">
                          {n.toLocaleString('th-TH')} นโยบาย
                          {value === 'SUBDISTRICT' || value === 'DISTRICT' || value === 'PROVINCE'
                            ? ` · ${sum[value].toLocaleString('th-TH')} ${UNIT[value]}`
                            : ''}
                        </span>
                      </span>
                    </span>
                    <span className="order-last col-span-2 h-2 overflow-hidden rounded-full bg-gray-100 sm:order-none sm:col-span-1">
                      <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: LEVEL_FILL[value] }} />
                    </span>
                    <span className="text-right text-base font-semibold tabular-nums" style={{ color: n ? LEVEL_INK[value] : undefined }}>
                      {totalPolicies ? `${pct}%` : '—'}
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
                        {pl.type && <span className="block text-xs text-gray-500">{pl.type}</span>}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums text-gray-600">{pl.year ?? '—'}</td>
                      <td className="py-2">
                        <Link href={`/activity/${pl.activityId}`} className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-gray-500 hover:text-gray-900">
                          เปิดงาน <ExternalLink className="w-3.5 h-3.5" />
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

      {/* แถบแยกตามภาค/ประเภท/ปี เอาออกแล้ว (ผู้ใช้ 11 พ.ย. 2026 — ข้อมูลเยอะจนงง) · กรองด้วยตัวเลือกด้านบนแทน */}
      {/* ตารางรายจังหวัดเอาออกแล้ว (ผู้ใช้ 11 พ.ย. 2026 — ข้อมูลเยอะจนงง) · ดูรายชื่อพื้นที่ได้จากการจิ้มชิ้นพาย/การ์ดระดับด้านบน */}
      {rows.length === 0 && (
        <p className="rounded-2xl border border-dashed border-gray-300 p-10 text-center text-sm text-gray-500">
          ไม่พบนโยบายตามตัวกรองนี้
        </p>
      )}

      {issues.length > 0 && (
        <details className="group rounded-2xl border border-gray-200 bg-white">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
            <span>
              <span className="text-sm font-semibold text-gray-900">ข้อมูลที่ควรแก้ {issues.length} รายการ</span>
              <span className="block text-xs text-gray-500">นโยบายที่ยังไม่ระบุประเภท/ปี หรือประเภทไม่ตรงกับระดับ — กดแก้ไขงานเพื่อเติมข้อมูล</span>
            </span>
            <span className="shrink-0 whitespace-nowrap text-xs text-gray-500 underline underline-offset-2 group-open:hidden">ดูรายการ</span>
            <span className="hidden shrink-0 whitespace-nowrap text-xs text-gray-500 underline underline-offset-2 group-open:inline">ซ่อน</span>
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
                      {p.name && <span className="block text-xs text-gray-500">{p.name}</span>}
                    </td>
                    <td className="py-2 pr-3 text-gray-900">{why.join(' · ')}</td>
                    <td className="py-2">
                      <Link href={`/activity/${p.activity.id}/edit`} className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-gray-500 hover:text-gray-900">
                        แก้ไขงาน <ExternalLink className="w-3.5 h-3.5" />
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

function Kpi({ label, value, unit, wide }: { label: string; value: number; unit?: string; wide?: boolean }) {
  // ตัวเลขดำทุกใบ — ส้มสงวนให้หมุด/โลโก้ (CLAUDE.md) · wide = เต็มแถวบนมือถือ
  return (
    <div className={`rounded-2xl border border-gray-200 bg-white px-4 py-3.5 ${wide ? 'col-span-2 md:col-span-1' : ''}`}>
      <p className="text-xs font-medium text-gray-600">{label}</p>
      <p className="mt-1 text-3xl font-bold tabular-nums text-gray-900">{value.toLocaleString('th-TH')}</p>
      {unit && <p className="mt-0.5 text-xs text-gray-500">{unit}</p>}
    </div>
  );
}

interface SearchHit {
  activityId: number;
  title: string;
  areaName: string | null;
  district: string;
  amphoe: string;
  province: string;
  level: Level;
  name: string | null;
  type: string | null;
  year: number | null;
  file: boolean;
}

// ลำดับความตรง: ชื่อสถานที่ขึ้นต้นด้วยคำค้น > ตำบลตรง > อำเภอตรง > อื่น ๆ
function hitRank(h: SearchHit, q: string) {
  if (h.areaName?.startsWith(q)) return 0;
  if (h.district === q || h.district.startsWith(q)) return 1;
  if (h.areaName?.includes(q)) return 2;
  if (h.amphoe === q || h.amphoe.startsWith(q)) return 3;
  return 4;
}

// ตัวหนาเฉพาะส่วนที่ตรงคำค้น (แบบหน้าผลค้นหา Google) — ไม่ใช้สีพื้น
function Hl({ text, q }: { text: string; q: string }) {
  const i = text.indexOf(q);
  if (!q || i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <b className="font-bold">{text.slice(i, i + q.length)}</b>
      {text.slice(i + q.length)}
    </>
  );
}

const MAX_HITS = 30;

function SearchResults({ q, results }: { q: string; results: SearchHit[] }) {
  const places = new Set(results.map((r) => `${r.province}|${r.amphoe}|${r.district}|${r.areaName ?? ''}`)).size;
  return (
    <section aria-live="polite" className="rounded-2xl border border-gray-200 bg-white">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-gray-200 px-5 py-3.5">
        <h2 className="text-sm font-semibold text-gray-900">
          ผลการค้นหา “{q}”
        </h2>
        <p className="text-xs text-gray-500 tabular-nums">
          {results.length
            ? `พบ ${results.length.toLocaleString('th-TH')} นโยบาย · ${places.toLocaleString('th-TH')} พื้นที่`
            : 'ไม่พบ'}
        </p>
      </div>
      {results.length === 0 ? (
        <p className="px-5 py-6 text-sm text-gray-600">
          ไม่พบนโยบายที่ตรงกับ “{q}” — ลองพิมพ์ชื่อตำบลหรืออำเภอ หรือคำที่สั้นลง
        </p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {results.slice(0, MAX_HITS).map((r) => {
            const label = POLICY_LEVELS.find((l) => l.value === r.level)?.label;
            return (
              <li key={`${r.activityId}-${r.level}`}>
                <Link
                  href={`/activity/${r.activityId}`}
                  className="group grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 px-5 py-3 hover:bg-gray-50"
                >
                  <span className="min-w-0">
                    <span className="block text-sm text-gray-700 group-hover:underline underline-offset-2">
                      <Hl text={r.areaName || `ต.${r.district}`} q={q} />
                    </span>
                    {/* ตำบล/จังหวัด เป็นชิปสีประจำระดับ (ตำบล emerald · จังหวัด violet ชุดเดียวกับพาย) ให้กวาดตาเจอเร็ว */}
                    <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
                      <span className="rounded px-1.5 py-0.5 font-medium" style={{ background: LEVEL_TINT.SUBDISTRICT, color: LEVEL_INK.SUBDISTRICT }}>
                        <Hl text={`ต.${r.district}`} q={q} />
                      </span>
                      <span><Hl text={`อ.${r.amphoe}`} q={q} /></span>
                      <span className="rounded px-1.5 py-0.5 font-medium" style={{ background: LEVEL_TINT.PROVINCE, color: LEVEL_INK.PROVINCE }}>
                        <Hl text={`จ.${r.province}`} q={q} />
                      </span>
                    </span>
                    <span className="mt-1 block truncate text-xs text-gray-600">
                      {r.name ? <Hl text={r.name} q={q} /> : <span className="text-gray-500">ยังไม่มีชื่อนโยบาย</span>}
                      {r.type && ` · ${r.type}`}
                      {r.year && ` · ปี ${r.year}`}
                      {r.file && ' · มีไฟล์'}
                    </span>
                  </span>
                  <span
                    className="shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium"
                    style={{ background: LEVEL_TINT[r.level], color: LEVEL_INK[r.level] }}
                  >
                    ระดับ{label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {results.length > MAX_HITS && (
        <p className="border-t border-gray-100 px-5 py-3 text-xs text-gray-500">
          แสดง {MAX_HITS} รายการแรก — พิมพ์คำให้เจาะจงขึ้น หรือเลือกจังหวัด/อำเภอเพื่อกรองเพิ่ม
        </p>
      )}
    </section>
  );
}
