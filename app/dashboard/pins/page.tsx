// app/dashboard/pins/page.tsx — หมุดงานศพปลอดเหล้าของครอบครัว (แอดมิน): ดูทุกหมุดรวมที่ซ่อน · ซ่อน/แสดง/ลบ
// แอดมินเห็นผู้ปักและชื่อผู้วายชนม์เต็ม (สาธารณะเห็นชื่อเฉพาะที่ครอบครัวอนุญาต)
import prisma from '@/app/lib/db';
import { PIN_PLACES, PIN_PRACTICES, PIN_RELATIONS, answerLabel, cleanAnswers } from '@/app/lib/funeralPins';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import PinsTable from './PinsTable';

export const metadata = { title: 'หมุดงานศพของครอบครัว' };

export default async function PinsPage() {
  const rows = await prisma.funeralPin.findMany({
    include: {
      user: { select: { firstName: true, lastName: true, email: true } },
      files: { select: { id: true, kind: true }, orderBy: { id: 'asc' } },
    },
    orderBy: { createdAt: 'desc' },
  });
  const pins = rows.map((p) => {
    const a = cleanAnswers(p.answers);
    const practices = Array.isArray(p.practices) ? p.practices.filter((x): x is string => typeof x === 'string') : [];
    return {
      id: p.id,
      hidden: p.hidden,
      who: p.user ? `${p.user.firstName} ${p.user.lastName}`.trim() : p.contactName || 'ไม่ได้ล็อกอิน (หมุดรุ่นแรก)',
      whoSub: p.user?.email ?? p.contactPhone ?? null,
      relation: p.relation ? PIN_RELATIONS[p.relation as keyof typeof PIN_RELATIONS] ?? p.relation : null,
      deceased: [p.deceasedFirstName, p.deceasedLastName].filter(Boolean).join(' ') || p.displayName || null,
      showName: p.showDeceasedName,
      area: `ต.${p.district} อ.${p.amphoe} จ.${p.province}`,
      when: p.funeralDate
        ? p.funeralDate.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
        : p.yearBE
          ? `ปี ${p.yearBE}`
          : null,
      summary: [
        p.place ? PIN_PLACES[p.place as keyof typeof PIN_PLACES] : null,
        answerLabel('days', a.days),
        answerLabel('alcohol', a.alcohol),
        answerLabel('food', a.food),
        ...practices.map((x) => PIN_PRACTICES[x as keyof typeof PIN_PRACTICES] ?? x),
      ]
        .filter(Boolean)
        .join(' · '),
      cost: p.totalCost ?? p.savedAmount,
      story: p.story,
      photos: p.files.filter((f) => f.kind === 'PHOTO').map((f) => f.id),
      bills: p.files.filter((f) => f.kind === 'BILL').map((f) => f.id),
      createdAt: p.createdAt.toISOString(),
    };
  });
  return (
    <main className="p-4 sm:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">หมุดงานศพของครอบครัว</h1>
          <p className="mt-1 text-sm text-gray-500">ประชาชนปักเองจากหน้า /pin · ขึ้นแผนที่ทันที — แก้ไข ซ่อน หรือลบหมุดได้ที่นี่ ({pins.length} หมุด)</p>
        </div>
        {/* แอดมินปักแทนครอบครัวได้ (หมุดเป็นของบัญชีแอดมิน) — ผู้ใช้ขอ 24 พ.ย. 2026 */}
        <Link href="/pin" className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-gray-900 px-4 text-sm font-medium text-white hover:bg-gray-700">
          <Plus className="w-4 h-4" /> ปักหมุดใหม่
        </Link>
      </div>
      <PinsTable pins={pins} />
    </main>
  );
}
