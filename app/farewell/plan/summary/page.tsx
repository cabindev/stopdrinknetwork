// app/farewell/plan/summary/page.tsx — สรุปแผนงานศพ พิมพ์/ส่งให้ญาติ
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import PlanSummary from './PlanSummary';

export const metadata: Metadata = {
  title: 'สรุปแผนงานศพ — ส่งด้วยใจ',
  robots: { index: false },
};

export default function PlanSummaryPage() {
  return (
    <main className="min-h-screen bg-white pt-20 pb-16 px-4 print:pt-0">
      <div className="max-w-2xl mx-auto">
        <Link
          href="/farewell/plan"
          className="inline-flex items-center gap-1.5 min-h-10 text-sm text-gray-500 hover:text-gray-900 print:hidden"
        >
          <ArrowLeft className="w-4 h-4" /> กลับไปแก้แผน
        </Link>
        <h1 className="mt-2 text-3xl font-bold text-gray-900 print:hidden">สรุปแผน</h1>
        <p className="mt-1 text-base text-gray-600 print:hidden">บันทึกใบสรุปเป็นรูปแล้วส่งในกลุ่มครอบครัว หรือพิมพ์ติดไว้ให้ทุกคนเห็นตรงกัน</p>
        <div className="mt-6 print:mt-0">
          <PlanSummary />
        </div>
      </div>
    </main>
  );
}
