// app/farewell/journey/components/JourneyFallback.tsx
// แสดงเมื่อเครื่องไม่รองรับ WebGL หรือ context หาย: รูปหีบ + ข้อความทุกขั้นเรียงลงตามปกติ
import Image from 'next/image';
import { STAGE_COPY } from '../content';
import StageCard from './StageCard';

export default function JourneyFallback() {
  return (
    <section className="bg-[#f3eee6]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-6">
        <div className="relative aspect-[14/9] rounded-xl overflow-hidden bg-gray-200">
          <Image
            src="/farewell/fallback-coffin.png"
            alt="หีบศพสีขาวลายทองแบบไทย"
            fill
            priority
            sizes="(max-width: 768px) 100vw, 768px"
            className="object-cover"
          />
        </div>
        {STAGE_COPY.map((copy, index) => (
          <StageCard key={copy.label} copy={copy} index={index} />
        ))}
      </div>
    </section>
  );
}
