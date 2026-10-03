// app/farewell/signs/page.tsx — ป้ายหน้างาน "ไม่เลี้ยงเหล้า" ดาวน์โหลด/พิมพ์ได้
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import SignMaker from './SignMaker';
import fontStyles from '../farewell.module.css';

export const metadata: Metadata = {
  title: 'ป้ายหน้างานศพ ไม่เลี้ยงเหล้า — ส่งด้วยใจ',
  description: 'ทำป้ายหน้างานศพ “เจ้าภาพขออภัย ไม่เลี้ยงเหล้าในงาน” ใส่ชื่อผู้วายชนม์ แล้วดาวน์โหลดไปพิมพ์ได้ทันที',
};

export default function SignsPage() {
  return (
    <main className={`${fontStyles.sao} min-h-screen bg-white pt-20 pb-16 px-4 print:p-0`}>
      <div className="max-w-3xl mx-auto print:max-w-none">
        <div className="print:hidden">
          <Link href="/farewell" className="inline-flex items-center gap-1 min-h-10 text-sm text-gray-500 hover:text-gray-800">
            <ArrowLeft className="w-4 h-4" /> ส่งด้วยใจ
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">ป้ายหน้างาน</h1>
          <p className="mt-2 text-sm sm:text-base leading-relaxed text-gray-600">
            ป้ายช่วยให้เจ้าภาพสื่อสารกับแขกได้โดยไม่ต้องอธิบายเองทีละคน ขนาด A4 แนวนอน
          </p>
        </div>
        <div className="mt-6 print:mt-0">
          <SignMaker />
        </div>
      </div>
    </main>
  );
}
