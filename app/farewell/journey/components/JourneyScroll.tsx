'use client';

// app/farewell/journey/components/JourneyScroll.tsx
// ส่วน 3D ที่ขับด้วยการเลื่อน: section สูงหลายจอ ข้างในเป็น canvas แบบ sticky
// ไม่ยึดการเลื่อนของ browser (ไม่มี scroll-jacking) แค่อ่านตำแหน่งแล้ววาดตาม
// วาดเฉพาะตอน progress ยังขยับ พอนิ่งแล้วหยุด loop เพื่อประหยัดแบตมือถือ
import { useEffect, useRef, useState } from 'react';
import { STAGE_COPY } from '../content';
import { STAGES, clamp01, snapToStage, stageAt } from '../three/timeline';
import type { JourneyScene } from '../three/scene';
import StageCard from './StageCard';
import JourneyFallback from './JourneyFallback';

type Status = 'loading' | 'ready' | 'failed';

/** ขั้นที่ฉากมืดแล้ว การ์ดเปลี่ยนเป็นพื้นเข้ม */
const DARK_FROM = 3;

export default function JourneyScroll() {
  const sectionRef = useRef<HTMLElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [status, setStatus] = useState<Status>('loading');
  const [stage, setStage] = useState(0);
  const failed = status === 'failed';

  useEffect(() => {
    const section = sectionRef.current;
    const sticky = stickyRef.current;
    const canvas = canvasRef.current;
    if (failed || !section || !sticky || !canvas) return;

    let disposed = false;
    let scene: JourneyScene | null = null;
    const reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let reduce = reduceQuery.matches;
    const mobile = window.matchMedia('(max-width: 767px)').matches;
    let ratio = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2);

    const progressOf = () => {
      const rect = section.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      return total > 0 ? clamp01(-rect.top / total) : 0;
    };

    let target = progressOf();
    let p = target;
    let raf = 0;
    let last = 0;
    let visible = true;
    let frames = 0;
    let slowFrames = 0;
    let currentStage = -1;
    const hint = sticky.querySelector<HTMLElement>('[data-hint]');

    const updateOverlay = () => {
      cardRefs.current.forEach((el, i) => {
        if (!el) return;
        const { start, end } = STAGES[i];
        const fade = (end - start) * 0.12;
        const fadeIn = i === 0 ? 1 : clamp01((p - start) / fade);
        const fadeOut = i === STAGES.length - 1 ? 1 : clamp01((end - p) / fade);
        const o = Math.min(fadeIn, fadeOut);
        el.style.opacity = String(o);
        el.style.transform = reduce ? 'none' : `translateY(${(1 - o) * 12}px)`;
        el.style.visibility = o < 0.01 ? 'hidden' : 'visible';
      });
      if (hint) hint.style.opacity = p > 0.03 ? '0' : '1';
      const s = stageAt(p);
      if (s !== currentStage) {
        currentStage = s;
        setStage(s);
      }
    };

    const tick = (now: number) => {
      raf = 0;
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 1 / 60;
      last = now;

      if (reduce) p = target;
      else {
        p += (target - p) * (1 - Math.exp(-dt * 8));
        if (Math.abs(target - p) < 0.0005) p = target;
      }

      // reduced-motion: ไม่ไหลต่อเนื่อง กระโดดไปท่าสุดท้ายของขั้นปัจจุบัน
      if (scene && visible) scene.render(reduce ? snapToStage(p) : p);
      updateOverlay();

      // เครื่องที่วาดไม่ทัน (เกิน 24ms ต่อเฟรมเกือบตลอด) ลดความละเอียดลงเหลือ 1x
      if (scene && ratio > 1) {
        frames++;
        if (dt > 0.024) slowFrames++;
        if (frames >= 30) {
          if (slowFrames > 20) {
            ratio = 1;
            scene.setPixelRatio(1);
          }
          frames = 0;
          slowFrames = 0;
        }
      }

      if (p !== target) raf = requestAnimationFrame(tick);
      else last = 0;
    };

    const kick = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };

    const onScroll = () => {
      target = progressOf();
      kick();
    };

    const onReduceChange = (event: MediaQueryListEvent) => {
      reduce = event.matches;
      kick();
    };

    let resizeTimer: ReturnType<typeof setTimeout> | undefined;
    const resizeObserver = new ResizeObserver(() => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        const rect = sticky.getBoundingClientRect();
        scene?.resize(rect.width, rect.height);
        target = progressOf();
        kick();
      }, 150);
    });

    const visibilityObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) kick();
    });

    window.addEventListener('scroll', onScroll, { passive: true });
    reduceQuery.addEventListener('change', onReduceChange);
    resizeObserver.observe(sticky);
    visibilityObserver.observe(section);
    kick();

    // three โหลดแยก chunk เฉพาะหน้านี้
    import('../three/scene')
      .then(({ createJourneyScene }) =>
        createJourneyScene(canvas, { pixelRatio: ratio, onContextLost: () => setStatus('failed') }),
      )
      .then((created) => {
        if (disposed) {
          created.dispose();
          return;
        }
        scene = created;
        const rect = sticky.getBoundingClientRect();
        created.resize(rect.width, rect.height);
        created.render(reduce ? snapToStage(p) : p);
        setStatus('ready');
      })
      .catch((error) => {
        console.error('[farewell/journey] 3D scene failed', error);
        if (!disposed) setStatus('failed');
      });

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      clearTimeout(resizeTimer);
      window.removeEventListener('scroll', onScroll);
      reduceQuery.removeEventListener('change', onReduceChange);
      resizeObserver.disconnect();
      visibilityObserver.disconnect();
      scene?.dispose();
      scene = null;
    };
  }, [failed]);

  const goTo = (index: number) => {
    const section = sectionRef.current;
    if (!section) return;
    const top = section.getBoundingClientRect().top + window.scrollY;
    const total = section.offsetHeight - window.innerHeight;
    const { start, end } = STAGES[index];
    const at = index === 0 ? 0 : start + (end - start) * 0.3;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: top + total * at, behavior: reduce ? 'auto' : 'smooth' });
  };

  if (failed) return <JourneyFallback />;

  const dark = stage >= DARK_FROM;

  return (
    <>
      {/* ข้อความทั้งหมดสำหรับ screen reader (การ์ดบนภาพ 3D ซ่อนไว้เพราะแสดงทีละใบ) */}
      <div className="sr-only">
        <h1>{STAGE_COPY[0].title}</h1>
        <ol>
          {STAGE_COPY.map((copy) => (
            <li key={copy.label}>
              <h2>{copy.title}</h2>
              {copy.body && <p>{copy.body}</p>}
              {copy.quote && (
                <p>
                  “{copy.quote.text}” {copy.quote.by}
                </p>
              )}
              {copy.note && <p>{copy.note}</p>}
            </li>
          ))}
        </ol>
      </div>

      <section ref={sectionRef} aria-label="เส้นทางสุดท้าย ภาพเคลื่อนไหวตามการเลื่อนหน้า" className="relative h-[520svh] md:h-[600svh]">
        <a
          href="#learn"
          className="sr-only focus:not-sr-only focus:absolute focus:top-20 focus:left-3 focus:z-30 focus:px-4 focus:py-2 focus:rounded-md focus:bg-orange-600 focus:text-white focus:text-sm"
        >
          ข้ามไปอ่านเนื้อหา
        </a>

        <div ref={stickyRef} className="sticky top-0 h-[100svh] overflow-hidden bg-[#f3eee6]">
          {/* ระหว่างรอ 3D โหลด (ไม่ใช้ภาพนิ่งหีบปิดฝา เพราะขั้นแรกเป็นหีบเปิด ภาพจะกระโดด) */}
          <p
            aria-hidden="true"
            className={`absolute right-6 bottom-6 md:right-10 text-xs text-gray-500 transition-opacity duration-500 max-md:top-28 max-md:bottom-auto max-md:inset-x-0 max-md:text-center ${
              status === 'ready' ? 'opacity-0' : 'opacity-100 motion-safe:animate-pulse'
            }`}
          >
            กำลังโหลดภาพ 3D…
          </p>
          <canvas
            ref={canvasRef}
            role="img"
            aria-label={STAGE_COPY[stage].scene}
            className={`absolute inset-0 w-full h-full pointer-events-none transition-opacity duration-700 ${
              status === 'ready' ? 'opacity-100' : 'opacity-0'
            }`}
          />

          <div aria-hidden="true" className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_62%_38%,transparent_30%,rgba(35,26,18,0.28)_100%)]" />
          {/* ข้อความโปสเตอร์: มือถืออยู่ล่าง จอใหญ่อยู่ซ้าย */}
          <div
            aria-hidden="true"
            className="absolute inset-x-6 bottom-[max(20px,env(safe-area-inset-bottom))] md:inset-x-auto md:bottom-auto md:left-[4vw] md:top-1/2 md:-translate-y-1/2 md:w-[39vw] md:max-w-[580px] grid items-end md:items-center before:absolute before:-inset-x-6 before:-top-10 before:-bottom-6 before:bg-gradient-to-t before:from-[#e9e4dc] before:via-[#e9e4dc]/95 before:to-transparent before:pointer-events-none md:before:hidden"
          >
            {STAGE_COPY.slice(0, 5).map((copy, index) => (
              <div
                key={copy.label}
                ref={(el) => {
                  cardRefs.current[index] = el;
                }}
                className="[grid-area:1/1] will-change-[opacity,transform]"
                style={{ opacity: index === 0 ? 1 : 0, visibility: index === 0 ? 'visible' : 'hidden' }}
              >
                <StageCard copy={copy} index={index} dark={dark} overlay />
              </div>
            ))}
          </div>

          <div
            ref={(el) => { cardRefs.current[5] = el; }}
            className="absolute inset-0 flex items-center justify-center px-6 pt-20 pb-8 bg-[#141515]/75 text-center will-change-[opacity,transform]"
            style={{ opacity: 0, visibility: 'hidden' }}
          >
            <StageCard copy={STAGE_COPY[5]} index={5} dark overlay />
          </div>

          {/* จุดบอกขั้น: มือถืออยู่บน จอใหญ่อยู่ขวา */}
          <nav
            aria-label="ขั้นของเส้นทาง"
            className="absolute top-[64px] inset-x-0 flex justify-center gap-0 md:inset-x-auto md:top-1/2 md:right-3 md:-translate-y-1/2 md:flex-col"
          >
            {STAGE_COPY.map((copy, index) => (
              <button
                key={copy.label}
                type="button"
                onClick={() => goTo(index)}
                aria-label={`ขั้นที่ ${index + 1}: ${copy.label}`}
                aria-current={stage === index ? 'step' : undefined}
                title={copy.label}
                className="group w-11 h-11 flex items-center justify-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-500"
              >
                <span
                  className={`block rounded-full transition-all duration-300 ${
                    stage === index
                      ? `w-2.5 h-2.5 ${dark ? 'bg-orange-400' : 'bg-orange-600'}`
                      : `w-2 h-2 ${dark ? 'bg-white/40 group-hover:bg-white/70' : 'bg-gray-900/25 group-hover:bg-gray-900/50'}`
                  }`}
                />
              </button>
            ))}
          </nav>
        </div>
      </section>
    </>
  );
}
