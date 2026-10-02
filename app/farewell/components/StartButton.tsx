'use client';
// ปุ่มเริ่ม/ทำต่อ — ถ้ามีแผนค้างในเครื่อง พาไปทำต่อ และมีลิงก์ไปดูสรุป
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { usePlan } from '../planStore';

export default function StartButton() {
  const { plan, hasSaved } = usePlan();
  const resume = plan && hasSaved;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Link
        href="/farewell/plan"
        className="inline-flex items-center gap-2 min-h-12 px-6 rounded-full bg-orange-600 text-base font-semibold text-white hover:bg-orange-700"
      >
        {resume ? 'ทำแผนต่อ' : 'เริ่มวางแผน'} <ArrowRight className="w-4 h-4" />
      </Link>
      {resume && (
        <Link href="/farewell/plan/summary" className="inline-flex items-center min-h-12 px-4 rounded-full text-sm font-medium text-gray-700 hover:bg-orange-50">
          ดูสรุปแผนที่ทำไว้
        </Link>
      )}
    </div>
  );
}
