// app/farewell/local/page.tsx — ข้อตกลงงานศพปลอดเหล้าในพื้นที่ (สาธารณะ)
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import LocalLookup from './LocalLookup';
import fontStyles from '../farewell.module.css';

export const metadata: Metadata = {
  title: 'ข้อตกลงงานศพในพื้นที่ — ส่งด้วยใจ',
  description: 'ค้นว่าตำบลของคุณมีข้อตกลงหรือธรรมนูญงานศพปลอดเหล้าแล้วหรือไม่ จากข้อมูลของเครือข่ายงดเหล้า',
};

export default function LocalPage() {
  return (
    <main className={`${fontStyles.sao} min-h-screen bg-white pt-20 pb-16 px-4`}>
      <div className="max-w-2xl mx-auto">
        <Link href="/farewell" className="inline-flex items-center gap-1 min-h-10 text-sm text-gray-500 hover:text-gray-800">
          <ArrowLeft className="w-4 h-4" /> ส่งด้วยใจ
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">ข้อตกลงงานศพในพื้นที่</h1>
        <p className="mt-2 text-sm sm:text-base leading-relaxed text-gray-600">
          ทุกพื้นที่ที่จัดงานศพแบบเรียบง่ายได้สำเร็จมีข้อตกลงร่วมของชุมชน เจ้าภาพจึงไม่ต้องรับแรงกดดันอยู่คนเดียว ลองค้นดูว่าตำบลของคุณมีแล้วหรือยัง
        </p>
        <div className="mt-6">
          <LocalLookup />
        </div>
      </div>
    </main>
  );
}
