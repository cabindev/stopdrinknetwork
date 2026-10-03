// app/farewell/page.tsx — "ส่งด้วยใจ" เครื่องมือให้ครอบครัวที่เพิ่งสูญเสียวางแผนงานศพได้เอง (สาธารณะ ไม่ต้อง login)
// ประกอบด้วย: วางแผนทีละขั้น (/plan) · ข้อตกลงในพื้นที่ (/local) · ป้ายหน้างาน (/signs) · เส้นทางสุดท้าย 3D (/journey)
// ข้อมูลแผนของครอบครัวเก็บในเครื่องผู้ใช้เท่านั้น (planStore.ts)
import type { Metadata } from 'next';
import Link from 'next/link';
import { BookOpen, ClipboardList, Landmark, Megaphone, ShieldCheck, Sparkles } from 'lucide-react';
import ChanFlowerIcon from './components/ChanFlowerIcon';
import { SITE_NAME, SITE_TAGLINE } from './content';
import StartButton from './components/StartButton';
import AgreementMapSection from './components/AgreementMapSection';
import TrackView from './components/TrackView';
import fontStyles from './farewell.module.css';

export const metadata: Metadata = {
  title: `${SITE_NAME} — วางแผนงานศพด้วยตัวเอง`,
  description: 'เครื่องมือให้ครอบครัววางแผนงานศพทีละเรื่อง พร้อมข้อมูลจากพื้นที่ที่ทำได้จริง ข้อตกลงงานศพปลอดเหล้าในตำบล และป้ายหน้างานพิมพ์ได้',
};

const TOOLS = [
  {
    href: '/farewell/plan',
    icon: ClipboardList,
    title: 'วางแผนทีละขั้น',
    text: 'ตอบทีละเรื่อง ข้ามได้ทุกข้อ แต่ละข้อมีข้อมูลประกอบการตัดสินใจ แล้วได้สรุปแผนไว้พิมพ์หรือส่งให้ญาติ',
  },
  {
    href: '/farewell/local',
    icon: Landmark,
    title: 'ข้อตกลงในพื้นที่',
    text: 'ค้นว่าตำบลของคุณมีกติกาหรือธรรมนูญงานศพปลอดเหล้าแล้วหรือยัง',
  },
  {
    href: '/farewell/signs',
    icon: Megaphone,
    title: 'ป้ายหน้างาน',
    text: 'ป้าย “เจ้าภาพขออภัย ไม่เลี้ยงเหล้าในงาน” ใส่ชื่อผู้วายชนม์ ดาวน์โหลดไปพิมพ์ได้ทันที',
  },
];
// หน้า 3D "เส้นทางสุดท้าย" ไม่อยู่ในการ์ดเครื่องมือ (ผู้ใช้ตัดสินใจ 2 ต.ค. 2026): หน้านี้สำหรับครอบครัวที่เพิ่งสูญเสีย
// ภาพหีบเข้าเตาเผาอาจกระทบใจ + หนักบนมือถือ → เหลือลิงก์เล็กท้ายหน้า (สื่อรณรงค์สำหรับคนทั่วไป ลิงก์จากกรณีศึกษา/โซเชียล)

const FACTS = [
  { value: '35,000 บาท', text: 'งบทั้งงานของเจ้าภาพที่จัดงานศพแม่แบบวันเดียวเผา' },
  { value: '40 จาก 60', text: 'คอมเมนต์ยอดนิยมเห็นด้วยกับการจัดงานให้เรียบง่ายและประหยัด' },
];

export default function FarewellPage() {
  return (
    <main className={`${fontStyles.sao} min-h-screen bg-white pt-20 pb-16 px-4`}>
      <TrackView type="VISIT" />
      <div className="max-w-3xl mx-auto">
        {/* เปิดหน้า */}
        <section className="pt-4 sm:pt-10">
          <span className="flex w-12 h-12 rounded-2xl bg-orange-50 border border-orange-100 items-center justify-center">
            <ChanFlowerIcon className="w-7 h-7 text-orange-600" />
          </span>
          <h1 className="mt-5 text-3xl sm:text-4xl font-bold text-gray-900">{SITE_NAME}</h1>
          <p className="mt-2 text-lg text-gray-700">{SITE_TAGLINE}</p>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-gray-600">
            ขอแสดงความเสียใจกับการสูญเสียของคุณ ช่วงนี้มีเรื่องต้องตัดสินใจหลายเรื่องในเวลาสั้น ๆ
            เครื่องมือนี้ช่วยให้ครอบครัวคิดทีละเรื่อง เห็นข้อมูลก่อนตัดสินใจ และเลือกงานที่สมเกียรติโดยไม่ต้องเป็นหนี้
          </p>
          <div className="mt-6">
            <StartButton />
          </div>
          <p className="mt-4 inline-flex items-center gap-1.5 text-xs text-gray-500">
            <ShieldCheck className="w-4 h-4 text-orange-600" />
            ไม่ต้องสมัครสมาชิก ชื่อและตัวเลขในแผนเก็บในเครื่องนี้เท่านั้น
          </p>
        </section>

        {/* เครื่องมือ */}
        <section aria-label="เครื่องมือ" className="mt-12 grid gap-3 sm:grid-cols-3">
          {TOOLS.map(({ href, icon: Icon, title, text }) => (
            <Link
              key={href}
              href={href}
              className="flex items-start gap-3 rounded-2xl border border-orange-100 p-5 hover:border-orange-300 transition-colors"
            >
              <span className="flex w-10 h-10 shrink-0 items-center justify-center rounded-xl bg-orange-50">
                <Icon className="w-5 h-5 text-orange-600" />
              </span>
              <span>
                <span className="block text-base font-semibold text-gray-900">{title}</span>
                <span className="mt-1 block text-sm leading-relaxed text-gray-600">{text}</span>
              </span>
            </Link>
          ))}
        </section>

        {/* ชุมชนที่ทำจริง — สร้างความมั่นใจก่อนตัวเลขจากกรณีศึกษา */}
        <AgreementMapSection className="mt-14" />

        {/* ข้อมูลจากพื้นที่จริง */}
        <section className="mt-14">
          <h2 className="text-xl font-bold text-gray-900">ความอาลัยไม่เคยแพง แต่ค่านิยมต่างหากที่ทำให้มันแพง</h2>
          <p className="mt-2 text-sm sm:text-base leading-relaxed text-gray-600">
            หลายครอบครัวไม่ได้อยากจัดใหญ่ แต่กลัวสายตาคน พื้นที่ที่เปลี่ยนได้สำเร็จทุกแห่งมีข้อตกลงร่วมของชุมชน
            และมีผู้นำที่เริ่มทำก่อน
          </p>
          <dl className="mt-6 grid gap-3 sm:grid-cols-2">
            {FACTS.map((f) => (
              <div key={f.value} className="rounded-2xl bg-orange-50 p-4">
                <dt className="text-2xl font-bold text-gray-900">{f.value}</dt>
                <dd className="mt-1 text-sm leading-relaxed text-gray-700">{f.text}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-gray-500">
            ที่มา: กรณีศึกษางานศพ Civic Space 2569 · การจัดกลุ่มคอมเมนต์เป็นการตีความของทีม ไม่ใช่ตัวเลขจาก Facebook
          </p>
          <Link
            href="/stories?sub=งานศพปลอดเหล้า"
            className="mt-5 inline-flex items-center gap-2 min-h-11 text-sm font-medium text-orange-700 hover:text-orange-800"
          >
            <BookOpen className="w-4 h-4" /> อ่านเรื่องเล่าจากพื้นที่ที่ทำได้จริง
          </Link>
        </section>

        {/* สื่อรณรงค์ — ลิงก์เล็ก ไม่ดึงความสนใจจากเครื่องมือของครอบครัว */}
        <p className="mt-12 border-t border-gray-100 pt-6 text-sm text-gray-500">
          สื่อรณรงค์สำหรับคนทั่วไป:{' '}
          <Link href="/farewell/journey" className="inline-flex items-center gap-1 font-medium text-orange-700 hover:text-orange-800">
            <Sparkles className="w-4 h-4" /> เส้นทางสุดท้าย (ภาพ 3D)
          </Link>
        </p>
      </div>
    </main>
  );
}
