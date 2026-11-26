'use client';
// app/lib/useCountUp.ts — ตัวเลขนับขึ้น/ลงจากค่าเดิมไปค่าใหม่ (motion ดึงสายตาบน /map — ผู้ใช้ขอ 26 พ.ย. 2026)
// ผู้ชมที่ตั้ง prefers-reduced-motion = เปลี่ยนทันที
import { useEffect, useRef, useState } from 'react';

export function useCountUp(value: number, ms = 700) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = from.current;
    from.current = value;
    if (start === value) return;
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setShown(value);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      const e = 1 - Math.pow(1 - k, 3); // ease-out
      setShown(Math.round(start + (value - start) * e));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return shown;
}
