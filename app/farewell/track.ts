'use client';
// app/farewell/track.ts — ส่งสถิติการใช้ "ส่งด้วยใจ" แบบไม่ระบุตัวตนไป /api/farewell/event
// ส่งได้แค่: ชนิดเหตุการณ์ + จังหวัด + รหัสตัวเลือกในแผน — ห้ามส่งชื่อผู้วายชนม์/ตำบล/ราคา
// เคารพ Do Not Track · พังเงียบ ๆ (สถิติต้องไม่ทำให้เครื่องมือใช้ไม่ได้)
export type FarewellEvent =
  | 'VISIT'
  | 'JOURNEY_VIEW'
  | 'PLAN_START'
  | 'PLAN_COMPLETE'
  | 'PRINT'
  | 'SHARE'
  | 'LINE'
  | 'COPY'
  | 'SIGN_DOWNLOAD'
  | 'SIGN_PRINT'
  | 'LOCAL_LOOKUP';

interface Extra {
  province?: string | null;
  answers?: Record<string, string>;
  found?: boolean;
}

export function track(type: FarewellEvent, extra: Extra = {}) {
  try {
    if (navigator.doNotTrack === '1') return;
    const body = JSON.stringify({ type, province: extra.province ?? undefined, answers: extra.answers, found: extra.found });
    const blob = new Blob([body], { type: 'application/json' });
    if (!navigator.sendBeacon?.('/api/farewell/event', blob)) {
      void fetch('/api/farewell/event', { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'application/json' } });
    }
  } catch {
    /* สถิติไม่สำคัญกว่าการใช้งาน */
  }
}

/** ส่งครั้งเดียวต่อแท็บ (sessionStorage) — กันรีเฟรช/ย้อนกลับแล้วนับซ้ำ */
export function trackOncePerTab(key: string, type: FarewellEvent, extra: Extra = {}) {
  try {
    const k = `sdn-farewell-sent:${key}`;
    if (sessionStorage.getItem(k)) return;
    sessionStorage.setItem(k, '1');
  } catch {
    /* storage ถูกปิด → ส่งตามปกติ */
  }
  track(type, extra);
}
