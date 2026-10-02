// app/farewell/plan/page.tsx — วางแผนงานศพทีละขั้น (สาธารณะ ไม่ต้อง login ข้อมูลอยู่ในเครื่องผู้ใช้)
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import PlanWizard from './PlanWizard';

export const metadata: Metadata = {
  title: 'วางแผนงานศพ — ส่งด้วยใจ',
  description: 'ตัดสินใจทีละเรื่อง ตั้งแต่จำนวนวัน อาหาร พระและพิธี ถึงงบประมาณ พร้อมข้อมูลจากพื้นที่ที่ทำได้จริง',
};

export default function PlanPage() {
  return (
    <main className="min-h-screen bg-white pt-20 pb-8 px-4">
      <div className="max-w-2xl mx-auto">
        <Link href="/farewell" className="inline-flex items-center gap-1 min-h-10 text-sm text-gray-500 hover:text-gray-800">
          <ArrowLeft className="w-4 h-4" /> ส่งด้วยใจ
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">วางแผนงานศพ</h1>
        <div className="mt-6">
          <PlanWizard />
        </div>
      </div>
    </main>
  );
}
