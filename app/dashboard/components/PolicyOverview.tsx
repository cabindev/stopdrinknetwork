// app/dashboard/components/PolicyOverview.tsx — การ์ดพายนโยบายงานศพบนหน้าแรกแดชบอร์ด (ผู้ใช้ขอ 30 ต.ค. 2026)
// จิ้มชิ้น/รายการ = ไป /dashboard/policies?level=X ซึ่งแสดงรายชื่อพื้นที่ทั้งหมดของระดับนั้น
// นับแบบเดียวกับหน้า policies: ทั้งหมด (ไม่กรองปี) · ตำบล/อำเภอ = พื้นที่ไม่ซ้ำ · ไม่นับงานในถังขยะ
import Link from 'next/link';
import prisma, { ACTIVE_ACTIVITY } from '@/app/lib/db';
import { POLICY_LEVELS } from '@/app/lib/activityMeta';
import { FUNERAL_SUB } from '@/app/lib/farewellAgreements';
import PolicyPie, { type Level } from './PolicyPie';

const href = (l: Level | null) => (l ? `/dashboard/policies?level=${l}#by-level` : '/dashboard/policies');

export default async function PolicyOverview() {
  // ActivityPolicy ไม่ผ่านตัวกรองถังขยะอัตโนมัติ (relation ซ้อน) — ใส่ ACTIVE_ACTIVITY เอง
  const policies = await prisma.activityPolicy.findMany({
    where: { activity: { ...ACTIVE_ACTIVITY, subCategory: { name: FUNERAL_SUB } } },
    select: { level: true, activity: { select: { province: true, amphoe: true, district: true } } },
  });

  const counts = Object.fromEntries(POLICY_LEVELS.map(({ value }) => [value, 0])) as Record<Level, number>;
  const tambon = new Set<string>();
  const amphoe = new Set<string>();
  const province = new Set<string>();
  for (const p of policies) {
    const level = p.level as Level;
    counts[level]++;
    const a = p.activity;
    if (level === 'SUBDISTRICT') tambon.add(`${a.province}|${a.amphoe}|${a.district}`);
    if (level === 'DISTRICT') amphoe.add(`${a.province}|${a.amphoe}`);
    if (level === 'PROVINCE') province.add(a.province);
  }
  const places: Partial<Record<Level, string>> = {
    SUBDISTRICT: `${tambon.size} ตำบล`,
    DISTRICT: `${amphoe.size} อำเภอ`,
    PROVINCE: `${province.size} จังหวัด`,
  };
  const total = policies.length;

  return (
    <section className="rounded-2xl border border-gray-200 bg-white px-5 pt-5 pb-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">นโยบายงานศพปลอดเหล้าแยกตามระดับ</h2>
          <p className="text-xs text-gray-500">
            รวม {total.toLocaleString('th-TH')} นโยบาย · ขนาดชิ้น = จำนวนนโยบาย · จิ้มชิ้นเพื่อดูพื้นที่ทั้งหมดของระดับนั้น
          </p>
        </div>
        <Link href="/dashboard/policies" className="text-xs text-gray-500 underline underline-offset-2 hover:text-gray-900">
          ดูรายจังหวัด
        </Link>
      </div>
      {/* พายอย่างเดียว ข้อมูลเขียนในชิ้น (ผู้ใช้ขอ — ประหยัดเนื้อที่ ไม่มีกล่องคำอธิบาย) */}
      <div className="-mt-2">
        <PolicyPie counts={counts} selected={null} href={href} detail={places} />
      </div>
    </section>
  );
}
