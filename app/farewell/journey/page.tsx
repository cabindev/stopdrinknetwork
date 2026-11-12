// app/farewell/journey/page.tsx — เส้นทางสุดท้าย: 3D เลื่อนตาม (หีบปิดฝา → หันเข้าเมรุ → เข้าเตา → ปิดเตา)
// ยกมาจาก civicspace/app/last-journey (แบบละเอียดอยู่ที่ civicspace/docs/last-journey/BRIEF.md)
// Navbar ของเว็บนี้ลอย (fixed) ไม่กินพื้นที่ ส่วน 3D จึงเริ่มที่บนสุดของจอได้เลย
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/lib/configs/auth/authOptions';
import { isAdminRole } from '@/app/lib/activityMeta';
import { JOURNEY_PUBLIC } from '../content';
import JourneyScroll from './components/JourneyScroll';
import TrackView from '../components/TrackView';
import fontStyles from '../farewell.module.css';

// หัวข้อโปสเตอร์ใช้ฟอนต์เสาชิงช้า Bold จาก app/farewell/layout.tsx (--font-sao) — ฟอนต์ต้องเป็นของที่มีสิทธิ์ใช้ในเว็บ

export const metadata: Metadata = {
  title: 'เส้นทางสุดท้าย — ส่งด้วยใจ',
  description: 'เดินไปส่งหีบศพหนึ่งใบตั้งแต่ปิดฝาจนเข้าเตา พร้อมบทเรียนงานศพที่เรียบง่าย ประหยัด ไม่เลี้ยงเหล้า',
  ...(JOURNEY_PUBLIC ? {} : { robots: { index: false, follow: false } }),
};

export default async function JourneyPage() {
  // ยังไม่เผยแพร่: แอดมินดูตัวอย่างได้ คนอื่น 404
  if (!JOURNEY_PUBLIC) {
    const session = await getServerSession(authOptions);
    if (!isAdminRole(session?.user?.role)) notFound();
  }

  return (
    <main className={`${fontStyles.sao} bg-white`}>
      <TrackView type="JOURNEY_VIEW" />
      <JourneyScroll />
      {/* เหลือฉาก 3D section เดียว (ผู้ใช้ขอ 12 พ.ย. 2026 — ตัดแผนที่ข้อตกลง + การ์ด "ครอบครัวเลือกเองได้" ด้านล่างออก) */}
    </main>
  );
}
