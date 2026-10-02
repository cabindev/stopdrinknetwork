// app/farewell/journey/page.tsx — เส้นทางสุดท้าย: 3D เลื่อนตาม (หีบปิดฝา → หันเข้าเมรุ → เข้าเตา → ปิดเตา)
// ยกมาจาก civicspace/app/last-journey (แบบละเอียดอยู่ที่ civicspace/docs/last-journey/BRIEF.md)
// Navbar ของเว็บนี้ลอย (fixed) ไม่กินพื้นที่ ส่วน 3D จึงเริ่มที่บนสุดของจอได้เลย
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, BookOpen, ClipboardList, Landmark, Megaphone } from 'lucide-react';
import JourneyScroll from './components/JourneyScroll';
import AgreementMapSection from '../components/AgreementMapSection';
import TrackView from '../components/TrackView';

// หัวข้อโปสเตอร์ใช้ฟอนต์เสาชิงช้า Bold จาก app/farewell/layout.tsx (--font-sao) — ฟอนต์ต้องเป็นของที่มีสิทธิ์ใช้ในเว็บ

export const metadata: Metadata = {
  title: 'เส้นทางสุดท้าย — ส่งด้วยใจ',
  description: 'เดินไปส่งหีบศพหนึ่งใบตั้งแต่ปิดฝาจนเข้าเตา พร้อมบทเรียนงานศพที่เรียบง่าย ประหยัด ไม่เลี้ยงเหล้า',
};

const NEXT = [
  { href: '/farewell/plan', icon: ClipboardList, title: 'วางแผนงานศพทีละขั้น', text: 'จำนวนวัน อาหาร พระและพิธี จนถึงงบประมาณ' },
  { href: '/farewell/local', icon: Landmark, title: 'ข้อตกลงในพื้นที่', text: 'ตำบลของคุณมีข้อตกลงงานศพปลอดเหล้าแล้วหรือยัง' },
  { href: '/farewell/signs', icon: Megaphone, title: 'ป้ายหน้างาน', text: 'ป้าย “ไม่เลี้ยงเหล้า” ดาวน์โหลดไปพิมพ์ได้' },
  { href: '/stories?sub=งานศพปลอดเหล้า', icon: BookOpen, title: 'กรณีศึกษา', text: 'เรื่องเล่าจากพื้นที่ที่ทำได้จริง' },
];

export default function JourneyPage() {
  return (
    <main className="bg-white">
      <TrackView type="JOURNEY_VIEW" />
      <JourneyScroll />
      {/* ต่อจากฉากสุดท้าย "ความสูญเสียครั้งเดียว…" — ให้เห็นว่ามีชุมชนทำจริง ไม่ใช่แค่ข้อความรณรงค์ */}
      <div className="px-4 pt-14 sm:pt-20">
        <AgreementMapSection className="max-w-3xl mx-auto" />
      </div>
      <section id="learn" className="scroll-mt-16 px-4 py-14 sm:py-20">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs font-medium text-orange-700">ส่งด้วยใจ</p>
          <h2 className="mt-1 text-2xl font-bold text-gray-900">ครอบครัวเลือกเองได้</h2>
          <p className="mt-2 text-sm sm:text-base leading-relaxed text-gray-600">
            การเปลี่ยนค่านิยมงานศพไม่ใช่การลดความอาลัย แต่คือการคืนความหมายของงานบุญ เริ่มจากเรื่องที่ครอบครัวตัดสินใจได้เอง
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {NEXT.map(({ href, icon: Icon, title, text }) => (
              <Link
                key={href}
                href={href}
                className="group flex items-start gap-3 rounded-2xl border border-orange-100 p-4 hover:border-orange-300 transition-colors"
              >
                <span className="flex w-10 h-10 shrink-0 items-center justify-center rounded-xl bg-orange-50">
                  <Icon className="w-5 h-5 text-orange-600" />
                </span>
                <span className="flex-1">
                  <span className="flex items-center gap-1 text-base font-semibold text-gray-900">
                    {title}
                    <ArrowRight className="w-4 h-4 text-orange-600 opacity-0 transition-opacity group-hover:opacity-100" />
                  </span>
                  <span className="mt-0.5 block text-sm text-gray-600">{text}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
