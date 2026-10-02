// app/farewell/journey/components/StageCard.tsx
// การ์ดข้อความของแต่ละขั้น ใช้ทั้งบนภาพ 3D และในหน้าสำรอง (ไม่มี WebGL)
import { ArrowDown, ArrowRight } from 'lucide-react';
import Image from 'next/image';
import type { StageCopy } from '../content';
import styles from './StageCard.module.css';

const POSTER_LINES = [
  ['เส้นทาง', 'สุดท้าย'],
  ['ปิดฝา', 'ด้วยความเคารพ'],
  ['ไม่ได้อยากจัดใหญ่', 'แต่กลัว', 'สายตาคน'],
  ['เหล้าคือต้นทุน', 'ที่ตัดได้', 'โดยไม่เสียน้ำใจ'],
  ['ส่งคนที่รัก', 'ด้วยใจ', 'ไม่ใช่ด้วยหนี้'],
  ['ความสูญเสีย', 'ครั้งเดียว', 'ไม่ควรกลายเป็นหนี้', 'ของคนที่ยังอยู่'],
];

interface StageCardProps {
  copy: StageCopy;
  index: number;
  dark?: boolean;
  /** การ์ดที่วางทับภาพ 3D ซ่อนจาก screen reader (มีรายการข้อความแยกให้แล้ว) */
  overlay?: boolean;
}

export default function StageCard({ copy, index, dark = false, overlay = false }: StageCardProps) {
  const Heading = index === 0 && !overlay ? 'h1' : 'h2';
  const tab = overlay && index !== 5 ? -1 : undefined;

  return (
    <div
      className={overlay ? `${styles.poster} ${index === 5 ? styles.finale : ''}` : `rounded-2xl border px-5 py-4 sm:px-7 sm:py-7 shadow-[0_16px_60px_-30px_rgba(40,30,20,0.35)] backdrop-blur-xl transition-colors duration-500 ${
        dark ? 'bg-[#24221f]/95 border-white/10 text-white' : 'bg-[#fffdf8]/95 border-white/70 text-[#302d28]'
      }`}
    >
      {overlay && <div className={styles.masthead}>
        <p>ส่งด้วยใจ · 0{index + 1} / 06</p>
        <Image src="/logo/logorip.png" alt="งานศพปลอดเหล้า" width={48} height={41} className="rounded bg-white p-1" />
      </div>}
      {copy.eyebrow && !overlay && (
        <p className={`text-xs font-medium mb-2 ${dark ? 'text-orange-300' : 'text-orange-700'}`}>{copy.eyebrow}</p>
      )}
      <Heading className={overlay ? styles.headline : `font-bold leading-snug text-balance ${index === 0 ? 'text-3xl sm:text-4xl mb-3' : 'text-lg sm:text-2xl mb-3'}`}>
        {overlay ? POSTER_LINES[index].map((line, i) => <span key={line} className={i === 1 ? styles.accent : undefined}>{line}</span>) : copy.title}
      </Heading>
      {copy.body && (
        <p className={overlay ? styles.body : `text-[15px] sm:text-base leading-relaxed ${dark ? 'text-gray-100' : 'text-gray-700'}`}>{copy.body}</p>
      )}
      {copy.quote && (
        <blockquote className={overlay ? styles.quote : `mt-3 border-l-2 pl-3 text-[15px] ${dark ? 'border-orange-400' : 'border-orange-600'}`}>
          “{copy.quote.text}”
          <footer className={overlay ? styles.note : `mt-1 text-xs ${dark ? 'text-gray-300' : 'text-gray-500'}`}>{copy.quote.by}</footer>
        </blockquote>
      )}
      {copy.note && <p className={overlay ? styles.note : `mt-3 text-xs ${dark ? 'text-gray-300' : 'text-gray-500'}`}>{copy.note}</p>}
      {index === 0 && overlay && (
        <p data-hint className="mt-4 inline-flex items-center gap-2 text-sm text-gray-600 transition-opacity duration-300">
          <ArrowDown className="w-4 h-4 motion-safe:animate-bounce" />
          เลื่อนลงช้าๆ เพื่อเดินไปส่งด้วยกัน
        </p>
      )}
      {index === 5 && (
        <a
          href="/farewell/plan"
          tabIndex={tab}
          className="mt-4 inline-flex items-center gap-2 min-h-11 px-5 rounded-full bg-orange-600 text-sm font-semibold text-white hover:bg-orange-700"
        >
          เริ่มวางแผนงานศพ
          <ArrowRight className="w-4 h-4" />
        </a>
      )}
    </div>
  );
}
