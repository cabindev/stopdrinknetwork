// app/farewell/plan/page.tsx — วางแผนงานศพทีละขั้น (สาธารณะ ไม่ต้อง login ข้อมูลอยู่ในเครื่องผู้ใช้)
// เลย์เอาต์: ฟอร์มทีละขั้น + ใบสรุปข้าง ๆ (จอใหญ่) / แถบยอดรวมติดล่าง กดเปิดใบสรุป (มือถือ) — ดู PlanWizard
// หัวข้อหน้า (h1) อยู่ใน PlanWizard แสดงเฉพาะขั้นแรก — ขั้นอื่นการ์ดขึ้นบนสุด ไม่ต้องเลื่อน
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
    <main className="min-h-screen bg-white pt-20 pb-16 px-4">
      <div className="max-w-5xl mx-auto">
        <Link href="/farewell" className="inline-flex items-center gap-1.5 min-h-10 text-sm text-gray-500 hover:text-gray-900">
          <ArrowLeft className="w-4 h-4" /> ส่งด้วยใจ
        </Link>
        <PlanWizard />
      </div>
    </main>
  );
}
