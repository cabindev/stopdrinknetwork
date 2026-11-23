// app/pin/page.tsx — ปักหมุดงานศพปลอดเหล้าของครอบครัว (ต้อง login: Google หรือสมัครปกติ — บัญชีรออนุมัติก็ปักได้ ไม่ต้องเป็นแอดมิน)
// แยกจากฟอร์มบันทึกงานของเจ้าหน้าที่ (/activity/new) · หมุดขึ้น /map ทันทีเป็นรูปบ้าน
import type { Metadata } from 'next';
import Link from 'next/link';
import { getServerSession } from 'next-auth/next';
import { MapPinHouse, Pencil } from 'lucide-react';
import prisma from '@/app/lib/db';
import { PIN_RELATIONS } from '@/app/lib/funeralPins';
import authOptions from '@/app/lib/configs/auth/authOptions';
import GoogleSignInButton from '@/app/components/auth/GoogleSignInButton';
import PinForm from './PinForm';

export const metadata: Metadata = {
  title: 'ปักหมุดงานศพปลอดเหล้าของครอบครัว',
  description: 'บ้านเราเคยจัดงานศพไม่เลี้ยงเหล้า ปักหมุดให้ทุกคนเห็นว่าทำได้จริง',
};

export default async function PinPage() {
  const session = await getServerSession(authOptions);
  const userId = Number(session?.user?.id ?? 0);
  // หมุดของฉัน — กลับมาแก้ไข/ลบได้
  const mine = userId
    ? await prisma.funeralPin.findMany({
        where: { userId },
        select: { id: true, relation: true, deceasedFirstName: true, deceasedLastName: true, district: true, province: true, hidden: true },
        orderBy: { createdAt: 'desc' },
      })
    : [];
  return (
    <main className="min-h-screen bg-white px-4 pb-16 pt-20">
      <div className="mx-auto max-w-lg">
        <h1 className="text-2xl font-semibold text-gray-900">ปักหมุดงานศพปลอดเหล้าของครอบครัว</h1>
        <p className="mt-2 text-sm leading-relaxed text-gray-600">
          บ้านเราเคยจัดงานศพแบบไม่เลี้ยงเหล้า เรียบง่าย ไม่เป็นหนี้ ปักหมุดให้ทุกคนเห็นว่าทำได้จริง
        </p>

        {mine.length > 0 && (
          <section className="mt-6 rounded-2xl border border-gray-200">
            <h2 className="border-b border-gray-100 px-4 py-3 text-sm font-semibold text-gray-900">หมุดของฉัน ({mine.length})</h2>
            <ul className="divide-y divide-gray-100">
              {mine.map((p) => {
                const name = [p.deceasedFirstName, p.deceasedLastName].filter(Boolean).join(' ');
                return (
                  <li key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900">
                        {name || `งานของ${PIN_RELATIONS[p.relation as keyof typeof PIN_RELATIONS] ?? 'ครอบครัว'}`}
                      </p>
                      <p className="text-xs text-gray-500">
                        ต.{p.district} จ.{p.province}
                        {p.hidden && ' · ทีมงานซ่อนจากแผนที่'}
                      </p>
                    </div>
                    <Link href={`/map?pin=${p.id}`} className="inline-flex min-h-9 items-center rounded-full px-3 text-xs text-gray-700 hover:bg-gray-50">
                      ดูบนแผนที่
                    </Link>
                    <Link
                      href={`/pin/${p.id}/edit`}
                      className="inline-flex min-h-9 items-center gap-1 rounded-full border border-gray-300 px-3 text-xs text-gray-900 hover:bg-gray-50"
                    >
                      <Pencil className="w-3.5 h-3.5" /> แก้ไข
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {session?.user ? (
          <>
            {mine.length > 0 && <h2 className="mt-8 text-lg font-semibold text-gray-900">ปักหมุดงานใหม่</h2>}
            <PinForm />
          </>
        ) : (
          <section className="mt-6 rounded-2xl border border-gray-200 p-5">
            <p className="flex items-center gap-2 font-medium text-gray-900">
              <MapPinHouse className="w-5 h-5" /> เข้าสู่ระบบก่อนปักหมุด
            </p>
            <p className="mt-1 text-sm leading-relaxed text-gray-600">
              ใช้บัญชี Google ได้ทันที หรือสมัครด้วยอีเมล เพื่อให้แก้ไขหมุดของตัวเองได้ภายหลัง และกันข้อมูลปลอม
            </p>
            <div className="mt-4">
              <GoogleSignInButton callbackUrl="/pin" />
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm">
              <Link href="/auth/signin?callbackUrl=/pin" className="inline-flex min-h-10 items-center text-gray-900 underline underline-offset-4">
                เข้าสู่ระบบด้วยอีเมล
              </Link>
              <Link href="/auth/signup?callbackUrl=/pin" className="inline-flex min-h-10 items-center text-gray-900 underline underline-offset-4">
                สมัครสมาชิก
              </Link>
            </div>
          </section>
        )}

        <Link href="/map" className="mt-6 inline-flex min-h-10 items-center text-sm text-gray-600 underline-offset-4 hover:underline">
          ดูแผนที่งานศพปลอดเหล้าทั้งหมด
        </Link>
      </div>
    </main>
  );
}
