// app/page.tsx — หน้าแรก (สาธารณะ — คนที่ login แล้วถูก proxy.ts ส่งไป /map)
// แผนที่จุด halftone ประเทศไทย (แนวเดียวกับ parliament) + จุดส้ม = พื้นที่ที่เครือข่ายมีงานจริง ดึงสดจาก DB
// ข้อมูลที่ออกหน้านี้: จำนวนรวม + จุดที่ปัดเข้าตาราง ~18 กม. เท่านั้น (ไม่มีชื่องาน/คน/พิกัดจริง)
import Link from 'next/link';
import { ArrowRight, BookOpen, Map as MapIcon } from 'lucide-react';
import prisma from '@/app/lib/db';
import { HALFTONE_VIEWBOX, RECENT_DAYS, toSpots } from '@/app/lib/halftoneMap';

export const dynamic = 'force-dynamic';

/** จุดที่มีวงกระเพื่อม (งานใหม่) ไม่เกินเท่านี้ — มากกว่านี้แผนที่ดูวุ่น */
const MAX_PULSES = 6;

async function getNetworkMap() {
  const [rows, tambons] = await Promise.all([
    prisma.activity.findMany({ select: { latitude: true, longitude: true, createdAt: true, province: true } }),
    prisma.activity.groupBy({ by: ['province', 'district'] }),
  ]);
  const spots = toSpots(rows);
  const pulses = spots
    .filter((s) => s.recent)
    .sort((a, b) => b.count - a.count)
    .slice(0, MAX_PULSES);
  return {
    spots,
    pulses,
    activities: rows.length,
    provinces: new Set(rows.map((r) => r.province)).size,
    tambons: tambons.length,
  };
}

const spotRadius = (count: number) => Math.min(13, 6.5 + Math.sqrt(count - 1) * 2);

export default async function HomePage() {
  const { spots, pulses, activities, provinces, tambons } = await getNetworkMap();
  const stats = [
    { value: activities, label: 'งาน' },
    { value: provinces, label: 'จังหวัด' },
    { value: tambons, label: 'ตำบล' },
  ];

  return (
    <main className="min-h-screen bg-white flex flex-col pt-16">
      <section className="w-full max-w-6xl mx-auto px-4 pt-8 pb-12 sm:pt-12 grid items-center gap-6 md:grid-cols-[1fr_minmax(0,1.05fr)] md:gap-10">
        {/* ข้อความ — ขนาดเล็ก/กลาง/ใหญ่ สลับกันแบบโปสเตอร์ */}
        <div className="order-2 md:order-1 text-center md:text-left">
          {/* ขนาดเล็ก/ใหญ่/แถบดำ แบบโปสเตอร์ (เหมือนหน้า 3D ส่งด้วยใจ) */}
          <h1 className="font-extrabold text-gray-900 leading-[1.05] tracking-tight">
            <span className="block text-3xl sm:text-5xl">Intervention</span>
            <span className="block text-5xl sm:text-7xl text-orange-600">Areas</span>
            <span className="mt-3 inline-block rounded-lg bg-black px-3 pt-1.5 pb-2 text-lg sm:text-2xl font-bold tracking-normal text-white">
              Stop Drink Network
            </span>
          </h1>

          <dl className="mt-7 flex justify-center md:justify-start divide-x divide-orange-100">
            {stats.map(({ value, label }) => (
              <div key={label} className="px-5 first:pl-0 last:pr-0">
                <dt className="sr-only">{label}</dt>
                <dd className="text-3xl sm:text-4xl font-extrabold tabular-nums text-gray-900">{value.toLocaleString('th-TH')}</dd>
                <dd className="text-sm text-gray-500">{label}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center md:justify-start gap-3">
            <Link
              href="/map"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-orange-600 text-white text-sm font-medium hover:bg-orange-700 transition-colors"
            >
              <MapIcon className="w-4 h-4" /> ดูแผนที่งานทั่วประเทศ
            </Link>
            <Link
              href="/stories"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-orange-200 text-orange-700 text-sm font-medium hover:bg-orange-50 transition-colors"
            >
              <BookOpen className="w-4 h-4" /> อ่านกรณีศึกษา
            </Link>
          </div>
          <p className="mt-6 text-sm text-gray-500">
            เจ้าหน้าที่เครือข่าย{' '}
            <Link href="/auth/signin" className="font-medium text-orange-700 hover:text-orange-800">
              เข้าสู่ระบบ
            </Link>{' '}
            หรือ{' '}
            <Link href="/auth/signup" className="font-medium text-orange-700 hover:text-orange-800">
              สมัครสมาชิก
            </Link>
          </p>
        </div>

        {/* แผนที่ — ฐาน (SVG นิ่ง cache ได้) + ชั้นจุดงาน viewBox เดียวกัน วางทับพอดี */}
        <Link
          href="/map"
          aria-label={`แผนที่งานของเครือข่าย ${activities} งานใน ${provinces} จังหวัด — เปิดแผนที่เต็ม`}
          className="group order-1 md:order-2 relative mx-auto block w-full max-w-[300px] sm:max-w-[420px] md:max-w-[520px]"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- SVG ตกแต่งไฟล์เดียว ไม่ต้องผ่าน next/image */}
          <img src="/maps/thailand-halftone.svg" alt="" className="block w-full h-auto select-none" />
          <svg viewBox={HALFTONE_VIEWBOX} className="absolute inset-0 w-full h-full" aria-hidden="true">
            <style>{`
              .sdn-ring{fill:none;stroke:#ea580c;stroke-width:2.4;transform-box:fill-box;transform-origin:center;opacity:0;animation:sdn-ring 3.6s cubic-bezier(.2,.6,.3,1) infinite}
              @keyframes sdn-ring{0%{transform:scale(.8);opacity:.85}100%{transform:scale(4);opacity:0}}
              @media (prefers-reduced-motion:reduce){.sdn-ring{animation:none}}
            `}</style>
            {spots.map((s) => (
              <circle key={`${s.x},${s.y}`} cx={s.x} cy={s.y} r={spotRadius(s.count)} fill="#ea580c" stroke="#fff" strokeWidth={1.5} />
            ))}
            {pulses.map((s, i) => (
              <circle
                key={`p${s.x},${s.y}`}
                className="sdn-ring"
                cx={s.x}
                cy={s.y}
                r={spotRadius(s.count)}
                style={{ animationDelay: `${(i * 0.6).toFixed(1)}s` }}
              />
            ))}
          </svg>
          <span className="absolute bottom-2 right-0 inline-flex items-center gap-1 rounded-full bg-white/95 border border-orange-100 px-3 py-1.5 text-xs font-medium text-gray-700 group-hover:text-orange-700">
            เปิดแผนที่เต็ม <ArrowRight className="w-3.5 h-3.5" />
          </span>
        </Link>
      </section>

      <p className="w-full max-w-6xl mx-auto px-4 -mt-6 pb-8 text-center md:text-right text-xs text-gray-400">
        <span className="inline-block w-2 h-2 rounded-full bg-orange-600 align-middle mr-1.5" aria-hidden="true" />
        พื้นที่ที่มีงาน (ตำแหน่งโดยประมาณ){pulses.length > 0 && <> · วงกระเพื่อม = มีงานใหม่ใน {RECENT_DAYS} วัน</>}
      </p>

      <footer className="mt-auto border-t border-orange-100 py-6">
        <p className="text-center text-xs text-gray-400">
          &copy; {new Date().getFullYear()} Stop Drink Network — เครือข่ายงดเหล้า
        </p>
      </footer>
    </main>
  );
}
