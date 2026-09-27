// app/activity/components/OverlapSection.tsx — "เพื่อนร่วมพื้นที่ของคุณ" (server component)
// เทียบพื้นที่งานของผู้ใช้กับงานของคนอื่น 3 ระดับ: ตำบล > อำเภอ > จังหวัด
import Link from 'next/link';
import { Users, MapPin } from 'lucide-react';
import { involvedWhere } from '@/app/lib/activityAccess';
import prisma from '@/app/lib/db';

interface MyArea {
  province: string;
  amphoe: string;
  district: string;
}

type MatchLevel = 'tambon' | 'amphoe' | 'province';

const LEVEL_ORDER: Record<MatchLevel, number> = { tambon: 0, amphoe: 1, province: 2 };
const LEVEL_BADGE: Record<MatchLevel, { text: string; cls: string }> = {
  tambon: { text: 'ตำบลเดียวกับคุณ', cls: 'bg-orange-600 text-white' },
  amphoe: { text: 'อำเภอเดียวกับคุณ', cls: 'bg-orange-100 text-orange-700' },
  province: { text: 'จังหวัดเดียวกับคุณ', cls: 'bg-gray-100 text-gray-600' },
};

export default async function OverlapSection({
  userId,
  myAreas,
}: {
  userId: number;
  myAreas: MyArea[];
}) {
  const provinces = [...new Set(myAreas.map((m) => m.province))];
  if (provinces.length === 0) return null;

  const others = await prisma.activity.findMany({
    where: { province: { in: provinces }, NOT: involvedWhere(userId) },
    include: {
      category: { select: { name: true } },
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          organization: true,
          position: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
  if (others.length === 0) return null;

  const levelOf = (o: { province: string; amphoe: string; district: string }): MatchLevel => {
    if (
      myAreas.some(
        (m) => m.province === o.province && m.amphoe === o.amphoe && m.district === o.district
      )
    )
      return 'tambon';
    if (myAreas.some((m) => m.province === o.province && m.amphoe === o.amphoe)) return 'amphoe';
    return 'province';
  };

  // จัดกลุ่ม: จังหวัด → เพื่อน 1 คน → งานของเขา + ระดับทับซ้อนที่ลึกที่สุด
  type PersonEntry = {
    name: string;
    phone: string | null;
    contact: string | null; // ตำแหน่ง · หน่วยงาน
    best: MatchLevel;
    items: { activity: (typeof others)[number]; level: MatchLevel }[];
  };
  const byProvince = new Map<string, Map<number, PersonEntry>>();
  for (const o of others) {
    const level = levelOf(o);
    const provinceMap = byProvince.get(o.province) ?? new Map<number, PersonEntry>();
    const entry: PersonEntry = provinceMap.get(o.user.id) ?? {
      name: `${o.user.firstName} ${o.user.lastName}`,
      phone: o.user.phone,
      contact: [o.user.position, o.user.organization].filter(Boolean).join(' · ') || null,
      best: level,
      items: [],
    };
    entry.items.push({ activity: o, level });
    if (LEVEL_ORDER[level] < LEVEL_ORDER[entry.best]) entry.best = level;
    provinceMap.set(o.user.id, entry);
    byProvince.set(o.province, provinceMap);
  }

  // เรียงจังหวัด/เพื่อน ตามความลึกของการทับซ้อน (ตำบลมาก่อน)
  const provinceBlocks = [...byProvince.entries()]
    .map(([province, users]) => {
      const people = [...users.values()].sort(
        (a, b) => LEVEL_ORDER[a.best] - LEVEL_ORDER[b.best]
      );
      return { province, people, best: Math.min(...people.map((p) => LEVEL_ORDER[p.best])) };
    })
    .sort((a, b) => a.best - b.best);

  const totalPeople = new Set(others.map((o) => o.user.id)).size;

  return (
    <section className="mt-10">
      <div className="flex items-center gap-2 mb-1">
        <Users className="w-5 h-5 text-orange-600" />
        <h2 className="text-lg font-bold text-gray-800">เพื่อนร่วมพื้นที่ของคุณ</h2>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        มีเพื่อน {totalPeople} คนทำงานในพื้นที่เดียวกับคุณ — ต้นทุนเครือข่ายที่ชวนกันต่อยอดได้
      </p>

      <div className="space-y-4">
        {provinceBlocks.map(({ province, people }) => (
          <div key={province} className="bg-white rounded-2xl border border-orange-100 p-5">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-gray-800 mb-3">
              <MapPin className="w-4 h-4 text-orange-500" /> จ.{province}
            </h3>
            <div className="space-y-4">
              {people.map((p) => {
                const badge = LEVEL_BADGE[p.best];
                return (
                  <div key={p.name} className="border-t border-orange-50 pt-3 first:border-t-0 first:pt-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-gray-800">{p.name}</span>
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ${badge.cls}`}>
                        {badge.text}
                      </span>
                      <span className="text-xs text-gray-400">{p.items.length} งาน</span>
                    </div>
                    {(p.contact || p.phone) && (
                      <p className="mt-0.5 text-xs text-gray-400">
                        {p.contact}
                        {p.contact && p.phone && ' · '}
                        {p.phone && (
                          <a href={`tel:${p.phone}`} className="text-orange-700 hover:underline">
                            {p.phone}
                          </a>
                        )}
                      </p>
                    )}
                    <ul className="mt-2 space-y-1">
                      {p.items.map(({ activity: a, level }) => (
                        <li key={a.id}>
                          <Link
                            href={`/activity/${a.id}`}
                            className="flex flex-wrap items-baseline gap-x-2 text-xs rounded-lg px-2 py-1.5 -mx-2 hover:bg-orange-50 transition-colors"
                          >
                            <span className="text-gray-700 font-medium">{a.title}</span>
                            <span className="text-gray-400">
                              {a.category.name} · ต.{a.district} อ.{a.amphoe}
                              {level === 'tambon' && ' ★'}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
