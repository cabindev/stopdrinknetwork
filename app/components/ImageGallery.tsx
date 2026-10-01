'use client';

// แกลเลอรีรูป + หน้าพรีวิวเต็มจอ (lightbox) — ใช้ทั้งหน้ารายละเอียดงานและหน้ากรณีศึกษาสาธารณะ
// ในหน้า: แถบรูปเลื่อนซ้าย-ขวา (ปัด/ลากแทร็กแพด, ปุ่ม ‹ › บนจอใหญ่) snap ทีละรูป — รูปถัดไปโผล่ขอบให้รู้ว่าเลื่อนได้
// เปิด: คลิกรูป · เลื่อน: ปุ่ม ‹ › / ลูกศรซ้าย-ขวา / ปัดบนมือถือ · ปิด: Esc / ปุ่ม × / คลิกพื้นหลัง
// ไม่พึ่งไลบรารีเพิ่ม — รูปมีไม่เกิน 5 รูปต่องาน
import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, X, ExternalLink } from 'lucide-react';

export interface GalleryImage {
  id: number;
  thumb: string; // รูปในกริด (อาจเป็นเวอร์ชันย่อ/ครอบ 16:9)
  full: string; // รูปเต็มไม่ตัด (แสดงในพรีวิว + เปิดต้นฉบับ)
  alt: string;
  caption?: string | null;
  badge?: string | null; // เช่น "รูปปก"
}

export default function ImageGallery({
  images,
  thumbClassName = 'w-full h-44 sm:h-48 object-cover',
}: {
  images: GalleryImage[];
  thumbClassName?: string;
}) {
  const [index, setIndex] = useState<number | null>(null);
  const open = index !== null;
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);
  const touchX = useRef<number | null>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const [canScroll, setCanScroll] = useState({ left: false, right: false });

  // แสดงปุ่ม ‹ › เฉพาะฝั่งที่ยังเลื่อนไปได้
  const updateScroll = useCallback(() => {
    const el = stripRef.current;
    if (!el) return;
    setCanScroll({
      left: el.scrollLeft > 4,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
    });
  }, []);
  useEffect(() => {
    updateScroll();
    window.addEventListener('resize', updateScroll);
    return () => window.removeEventListener('resize', updateScroll);
  }, [updateScroll, images.length]);
  const scrollStrip = (dir: number) => {
    const el = stripRef.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' });
  };

  const go = useCallback(
    (delta: number) => setIndex((i) => (i === null ? i : (i + delta + images.length) % images.length)),
    [images.length]
  );
  const close = useCallback(() => setIndex(null), []);

  // คีย์บอร์ด + ล็อกการเลื่อนหน้า + คืนโฟกัสเมื่อปิด
  useEffect(() => {
    if (!open) return;
    lastFocus.current = document.activeElement as HTMLElement | null;
    closeBtnRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      lastFocus.current?.focus();
    };
  }, [open, go, close]);

  // โหลดรูปก่อน-หลังไว้ล่วงหน้า กดเลื่อนแล้วขึ้นทันที
  useEffect(() => {
    if (index === null || images.length < 2) return;
    for (const d of [1, -1]) {
      const img = new Image();
      img.src = images[(index + d + images.length) % images.length].full;
    }
  }, [index, images]);

  const cur = index !== null ? images[index] : null;

  return (
    <>
      <div className="relative">
      <div
        ref={stripRef}
        onScroll={updateScroll}
        className="flex gap-3 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2 [scrollbar-width:thin]"
        data-testid="image-gallery"
      >
        {images.map((img, i) => (
          <figure key={img.id} className="shrink-0 snap-start w-[80%] sm:w-[calc((100%-1.5rem)/3)]">
            <button
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`ดูรูปขนาดใหญ่: ${img.caption || img.alt}`}
              className="block w-full group focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 rounded-xl"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.thumb}
                alt={img.alt}
                loading="lazy"
                className={`${thumbClassName} rounded-xl border border-orange-100 bg-orange-50 group-hover:opacity-90 transition-opacity cursor-zoom-in`}
              />
            </button>
            {img.caption && <figcaption className="mt-1 text-xs text-gray-600 leading-snug">{img.caption}</figcaption>}
            {img.badge && <p className="mt-0.5 text-[10px] font-semibold text-orange-600">{img.badge}</p>}
          </figure>
        ))}
      </div>
      {/* ปุ่มเลื่อน — อยู่นอกแถบรูป (มือถือปัดเอา) */}
      {canScroll.left && (
        <button
          type="button"
          onClick={() => scrollStrip(-1)}
          aria-label="เลื่อนดูรูปก่อนหน้า"
          className="hidden sm:flex absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/95 border border-orange-100 shadow text-gray-800 hover:bg-orange-50"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      )}
      {canScroll.right && (
        <button
          type="button"
          onClick={() => scrollStrip(1)}
          aria-label="เลื่อนดูรูปถัดไป"
          className="hidden sm:flex absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/95 border border-orange-100 shadow text-gray-800 hover:bg-orange-50"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      )}
      </div>

      {cur && index !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`รูปที่ ${index + 1} จาก ${images.length}`}
          data-testid="lightbox"
          className="fixed inset-0 z-[3000] bg-stone-950 flex flex-col"
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
          onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
          onTouchEnd={(e) => {
            if (touchX.current === null) return;
            const dx = e.changedTouches[0].clientX - touchX.current;
            if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
            touchX.current = null;
          }}
        >
          {/* แถบบน: ลำดับ · เปิดต้นฉบับ · ปิด */}
          <div className="flex items-center justify-between gap-3 px-4 py-3 text-white/90 text-sm">
            <span className="tabular-nums" data-testid="lightbox-counter">
              {index + 1} / {images.length}
            </span>
            <div className="flex items-center gap-1">
              <a
                href={cur.full}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-white/10"
              >
                <ExternalLink className="w-4 h-4" /> <span className="hidden sm:inline">เปิดรูปต้นฉบับ</span>
              </a>
              <button
                ref={closeBtnRef}
                type="button"
                onClick={close}
                aria-label="ปิด"
                className="p-2 rounded-full hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* รูป — เต็มพื้นที่แต่ไม่ตัด (object-contain) */}
          <div
            className="relative flex-1 min-h-0 flex items-center justify-center px-2 sm:px-16"
            onClick={(e) => {
              if (e.target === e.currentTarget) close();
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={cur.id}
              src={cur.full}
              alt={cur.alt}
              data-testid="lightbox-image"
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl select-none"
              draggable={false}
            />
            {images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => go(-1)}
                  aria-label="รูปก่อนหน้า"
                  className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 p-2 sm:p-3 rounded-full bg-black/40 text-white hover:bg-black/60"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  type="button"
                  onClick={() => go(1)}
                  aria-label="รูปถัดไป"
                  className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 p-2 sm:p-3 rounded-full bg-black/40 text-white hover:bg-black/60"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </>
            )}
          </div>

          {/* คำบรรยาย + แถบรูปย่อ */}
          <div className="px-4 pt-3 pb-4 text-center">
            {cur.caption && <p className="text-sm text-white/90 max-w-2xl mx-auto mb-3">{cur.caption}</p>}
            {images.length > 1 && (
              <div className="flex justify-center gap-2 overflow-x-auto">
                {images.map((img, i) => (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => setIndex(i)}
                    aria-label={`ไปรูปที่ ${i + 1}`}
                    aria-current={i === index}
                    className={`shrink-0 rounded-md overflow-hidden border-2 ${
                      i === index ? 'border-orange-500' : 'border-transparent opacity-60 hover:opacity-100'
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.thumb} alt="" className="w-14 h-10 object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
