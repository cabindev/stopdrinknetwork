// app/farewell/plan/page.tsx — วางแผนงานศพทีละขั้น (สาธารณะ ไม่ต้อง login ข้อมูลอยู่ในเครื่องผู้ใช้)
// เลย์เอาต์: ฟอร์มทีละขั้น + ใบสรุปข้าง ๆ (จอใหญ่) / แถบยอดรวมติดล่าง กดเปิดใบสรุป (มือถือ) — ดู PlanWizard
// หัวข้อหน้า (h1) อยู่ใน PlanWizard (ซ่อนไว้ให้โปรแกรมอ่านหน้าจอ) — การ์ดฟอร์มขึ้นบนสุดทุกขั้น
import type { Metadata } from 'next';
import { Suspense } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import PlanWizard from './PlanWizard';

export const metadata: Metadata = {
  title: 'วางแผนงานศพ — ส่งด้วยใจ',
  description: 'ตัดสินใจทีละเรื่อง ตั้งแต่จำนวนวัน อาหาร พระและพิธี ถึงงบประมาณ พร้อมข้อมูลจากพื้นที่ที่ทำได้จริง',
};

export default function PlanPage() {
  return (
    <main className="min-h-screen bg-white pt-20 pb-16 px-4">
      <div className="max-w-6xl mx-auto">
        {/* กลับไปกระดานจัดงาน (หน้าแรก — 22 พ.ย. 2026) */}
        <Link href="/" className="inline-flex items-center gap-1 min-h-10 text-sm text-gray-600 underline-offset-4 hover:text-gray-900 hover:underline">
          <ArrowLeft className="w-4 h-4" /> กลับไปกระดานจัดงาน
        </Link>
        {/* PlanWizard อ่าน ?step= ด้วย useSearchParams → ต้องอยู่ใน Suspense ให้หน้ายัง prerender ได้ */}
        <Suspense fallback={<div className="min-h-[60vh]" aria-busy="true" />}>
          <PlanWizard />
        </Suspense>
      </div>
    </main>
  );
}
