import type { Metadata } from 'next';
import Link from 'next/link';
import { pinsOpen, PIN_KINDS, PIN_PRACTICES } from '@/app/lib/funeralPins';
import PinForm from './PinForm';
export const metadata: Metadata = { title: 'ปักหมุดงานศพปลอดเหล้า' };
export default function PinPage() {
  if (!pinsOpen())
    return (
      <main className="min-h-screen bg-white px-4 pt-20">
        <section className="mx-auto max-w-lg rounded-2xl border border-gray-200 p-6 text-center">
          <h1 className="text-xl font-semibold text-gray-900">ปิดรับการปักหมุดแล้ว</h1>
          <p className="mt-3 text-sm text-gray-600">เปิดให้ปักหมุดเฉพาะวันที่ 27 พ.ย. 2569 ที่เวทีอุบลราชธานี</p>
          <Link
            className="mt-5 inline-flex min-h-11 items-center rounded-full border border-gray-300 px-5 text-sm hover:bg-gray-50"
            href="/map"
          >
            ดูแผนที่
          </Link>
        </section>
      </main>
    );
  return (
    <main className="min-h-screen bg-white px-4 pb-12 pt-20">
      <div className="mx-auto max-w-lg">
        <h1 className="text-2xl font-semibold text-gray-900">ปักหมุดงานศพปลอดเหล้า</h1>
        <p className="mt-2 text-sm leading-6 text-gray-600">บ้านคุณ ชุมชนคุณ เคยจัดงานศพไม่เลี้ยงเหล้าไหม? ปักหมุดให้ทุกคนเห็นว่าทำได้จริง</p>
        <PinForm kinds={PIN_KINDS} practices={PIN_PRACTICES} />
      </div>
    </main>
  );
}
