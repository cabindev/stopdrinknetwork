// app/farewell/components/AgreementMapSection.tsx — "เราทำกันจริง" แผนที่ภาพนิ่ง (SVG วาดฝั่ง server จากข้อมูลจริง)
// ให้ครอบครัวมั่นใจว่ามีชุมชนทำงานศพปลอดเหล้าจริง ไม่ได้ต้องเริ่มคนเดียว
// เลือกภาพนิ่งแทน Leaflet (ผู้ใช้ขอ "แบบง่าย"): เบา ไม่โหลด tile ไม่ดักการเลื่อนหน้า และอัปเดตเองเมื่อมีพื้นที่ใหม่
// จุดอยู่ที่จุดกลางตำบล (getAgreementMapData) — ไม่มีชื่อคน/สถานที่ · จุดของงานที่เผยแพร่แล้วกดไปอ่านเรื่องเล่าได้
import Link from 'next/link';
import { MapPin } from 'lucide-react';
import thailandOutline from '@/app/data/thailand-outline.json';
import { getAgreementMapData } from '@/app/lib/farewellAgreements';

// ── ฉายพิกัดแบบง่าย (equirectangular ปรับด้วย cos ของละติจูดกลาง) — ระดับประเทศคลาดเคลื่อนน้อยพอสำหรับภาพประกอบ
const RINGS = (thailandOutline.geometry.coordinates as number[][][][]).map((poly) => poly[0]);
const ALL = RINGS.flat();
const MIN_LNG = Math.min(...ALL.map((c) => c[0]));
const MAX_LNG = Math.max(...ALL.map((c) => c[0]));
const MIN_LAT = Math.min(...ALL.map((c) => c[1]));
const MAX_LAT = Math.max(...ALL.map((c) => c[1]));
const K = Math.cos((((MIN_LAT + MAX_LAT) / 2) * Math.PI) / 180);
const W = 300;
const SCALE = W / ((MAX_LNG - MIN_LNG) * K);
const H = Math.round((MAX_LAT - MIN_LAT) * SCALE);
const PAD = 8;
const px = (lng: number, lat: number): [number, number] => [
  PAD + (lng - MIN_LNG) * K * SCALE,
  PAD + (MAX_LAT - lat) * SCALE,
];

// path ของเส้นขอบ — ตัดจุดที่ห่างกันไม่ถึง 0.8 หน่วย (ภาพเล็ก ไม่ต้องละเอียด) ทำครั้งเดียวตอนโหลดโมดูล
const OUTLINE_PATH = RINGS.map((ring) => {
  const pts: [number, number][] = [];
  for (const [lng, lat] of ring) {
    const p = px(lng, lat);
    const last = pts[pts.length - 1];
    if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) >= 0.8) pts.push(p);
  }
  return pts.length > 2 ? `M${pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join('L')}Z` : '';
}).join('');

export default async function AgreementMapSection({ className = '' }: { className?: string }) {
  const { points, provinces, byRegion } = await getAgreementMapData();
  if (points.length === 0) return null;

  return (
    <section aria-labelledby="real-areas" className={className}>
      <h2 id="real-areas" className="text-xl sm:text-2xl font-bold text-gray-900">
        คุณไม่ได้เริ่มคนเดียว
      </h2>
      <p className="mt-2 text-sm sm:text-base leading-relaxed text-gray-600">
        <strong className="text-gray-900">{points.length} ชุมชนใน {provinces} จังหวัด</strong> มีข้อตกลงงานศพปลอดเหล้าแล้ว
        {byRegion.length > 0 && (
          <> — {byRegion.map((r) => `${r.label} ${r.count}`).join(' · ')}</>
        )}
      </p>

      <div className="mt-5 rounded-2xl border border-orange-100 bg-orange-50/50 p-4 sm:p-6">
        <svg
          viewBox={`0 0 ${W + PAD * 2} ${H + PAD * 2}`}
          role="img"
          aria-label={`แผนที่ประเทศไทย จุดสีส้ม ${points.length} จุด คือชุมชนที่มีข้อตกลงงานศพปลอดเหล้า`}
          className="mx-auto block w-full max-w-[340px] h-auto"
        >
          <path d={OUTLINE_PATH} fill="#ffffff" stroke="#1c1917" strokeOpacity={0.45} strokeWidth={0.8} strokeLinejoin="round" />
          {points.map((p) => {
            const [x, y] = px(p.lng, p.lat);
            const dot = (
              <circle cx={x.toFixed(1)} cy={y.toFixed(1)} r={4} fill="#ea580c" fillOpacity={0.85} stroke="#ffffff" strokeWidth={1.2}>
                <title>{`${p.title} · ต.${p.district} จ.${p.province}`}</title>
              </circle>
            );
            return p.storyId ? (
              <a key={p.id} href={`/stories/${p.storyId}`} aria-label={`อ่านเรื่องเล่า ${p.title}`}>
                {dot}
              </a>
            ) : (
              <g key={p.id}>{dot}</g>
            );
          })}
        </svg>
        <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-gray-500">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-orange-600" /> ชุมชนที่มีข้อตกลงงานศพปลอดเหล้า (ตำแหน่งระดับตำบล)
        </p>
      </div>

      <Link
        href="/farewell/local"
        className="mt-4 inline-flex items-center gap-2 min-h-11 text-sm font-medium text-orange-700 hover:text-orange-800"
      >
        <MapPin className="w-4 h-4" /> ดูว่าตำบลของคุณมีข้อตกลงแล้วหรือยัง
      </Link>
    </section>
  );
}
