// app/page.tsx — หน้าแรก = กระดานจัดงาน "ส่งด้วยใจ" (ผู้ใช้ตัดสินใจ 21 พ.ย. 2026) · สาธารณะ ไม่ต้อง login · ฟอนต์ IBM (หัวใบสรุปในรูปยังเป็นเสาชิงช้า)
// หน้าแรกเดิม (แผนที่จุด halftone ของเครือข่าย) ย้ายไป /network · แผนเก็บในเครื่องผู้ใช้เท่านั้น (farewell/planStore.ts)
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, ClipboardList, Landmark, Megaphone, MonitorPlay } from 'lucide-react';
import { SITE_NAME } from './farewell/content';
import BoardBuilder from './farewell/board/BoardBuilder';
import TrackView from './farewell/components/TrackView';
import { sao } from './farewell/saoFont';

export const metadata: Metadata = {
  title: `${SITE_NAME} — วางแผนงานศพด้วยตัวเอง`,
  description: 'เลือกทีละเรื่อง ตั้งศพที่วัดหรือบ้าน จัดกี่คืน อาหาร ดอกไม้ ไม่เลี้ยงเหล้า แล้วเห็นภาพรวมงานและงบบนกระดานเดียว ส่งให้ญาติได้',
};

const MORE = [
  {
    href: '/farewell/plan',
    icon: ClipboardList,
    title: 'วางแผนละเอียด',
    text: 'แก้ราคาเองได้ทุกช่อง ได้ใบสรุปไว้พิมพ์',
  },
  {
    href: '/farewell/local',
    icon: Landmark,
    title: 'ข้อตกลงในพื้นที่',
    text: 'ตำบลของคุณมีธรรมนูญงานศพปลอดเหล้าหรือยัง',
  },
  {
    href: '/farewell/signs',
    icon: Megaphone,
    title: 'ป้ายหน้างาน',
    text: 'ป้ายไม่เลี้ยงเหล้า ใส่ชื่อแล้วพิมพ์ได้ทันที',
  },
];

// ?booth=1 = จอที่บูธ (ล้างแผนเองเมื่อไม่มีคนแตะ 60 วิ + หน้าจอชวนลอง + QR) · ?from=qr = มาจาก QR ที่บูธ (แถบต้อนรับ)
export default async function HomePage({ searchParams }: { searchParams: Promise<{ booth?: string; from?: string }> }) {
  const sp = await searchParams;
  const booth = sp.booth === '1';
  return (
    <main className={`${sao.variable} min-h-screen bg-white px-4 sm:px-6 ${booth ? 'py-6' : 'pt-20 pb-32 lg:pb-16'}`}>
      {/* จอที่บูธ = เต็มจอ ไม่มีเมนูด้านบน (คนที่บูธไม่ควรกดออกไปหน้าอื่น) */}
      {booth && <style>{'.sdn-nav{display:none}'}</style>}
      {/* pb-32 บนมือถือ = เผื่อแถบยอดรวมติดล่างจอของกระดาน */}
      {/* ฟอนต์ IBM ทั้งหน้า (ผู้ใช้เลือก 22 พ.ย. 2026 — ตัวเลข/ตัวเล็กอ่านง่ายกว่า) · --font-sao โหลดไว้ให้หัวใบสรุปที่บันทึกเป็นรูปเท่านั้น */}
      <TrackView type="VISIT" />
      <BoardBuilder title="เมื่อมีคนที่เรารักจากไป" booth={booth} intro={sp.from === 'qr'} />

      {!booth && (
        <section className="mx-auto mt-10 max-w-3xl">
          <h2 className="text-base font-semibold text-gray-900">เครื่องมืออื่นใน{SITE_NAME}</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {MORE.map((t) => (
              <Link
                key={t.href}
                href={t.href}
                className="flex h-full flex-col rounded-2xl border border-gray-200 bg-white p-4 hover:bg-gray-50"
              >
                <span className="flex items-center gap-2 font-medium text-gray-900">
                  <t.icon className="w-4 h-4" /> {t.title}
                </span>
                <span className="mt-1 text-sm leading-relaxed text-gray-600">{t.text}</span>
              </Link>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4">
            <Link
              href="/farewell"
              className="inline-flex min-h-10 items-center gap-1 text-sm font-medium text-gray-900 underline-offset-4 hover:underline"
            >
              ดูเครื่องมือและข้อมูลทั้งหมด <ArrowRight className="w-4 h-4" />
            </Link>
            {/* ทางเข้าจอในงาน (?booth=1) — ตัวเล็กสีเทา ให้ทีมงานหาเจอ คนทั่วไปไม่สะดุด (ผู้ใช้เลือกคำ "โหมดจัดแสดง" 22 พ.ย. 2026) */}
            <Link
              href="/?booth=1"
              className="inline-flex min-h-10 items-center gap-1.5 text-xs text-gray-500 underline-offset-4 hover:text-gray-900 hover:underline"
            >
              <MonitorPlay className="w-3.5 h-3.5" /> เปิดโหมดจัดแสดง (สำหรับจอในงาน)
            </Link>
          </div>
        </section>
      )}
    </main>
  );
}
