'use client';

// app/farewell/board/BoardBuilder.tsx — กระดานจัดงาน (หน้าแรก /)
// ผัง (ออกแบบใหม่ 22 พ.ย. 2026 — ผู้ใช้: "ดูแล้วเข้าใจเลย อยู่ในหน้าเดียว · เลือกแล้วไม่รู้ว่าจ่ายไปเท่าไหร่"):
//   จอใหญ่ = เมนูตัวเลือก (ซ้าย) · กระดาน (กลาง) · ใบรายการค่าใช้จ่ายสด (ขวา) อยู่ในจอเดียว
//   มือถือ = กระดาน → ตัวเลือก → ใบรายการ + แถบยอดรวมติดล่างจอตลอด
// คำตอบเขียนลง planStore ตัวเดียวกับหน้าวางแผน (/farewell/plan) · "สถานที่" ยังไม่มีในแผน เก็บในหน้านี้อย่างเดียว
// ของบนกระดาน = ตกลงมาวางแบบเด้ง (เดิมใช้ layoutId ลอยจากการ์ด — การ์ดถูก render 2 ชุด (จอใหญ่/มือถือ)
//   layoutId ซ้ำกันทำให้บางครั้งของไม่ขึ้นในช่อง ผู้ใช้เจอ 22 พ.ย. 2026)
import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Check, Download, Eye, FileImage, Quote, RotateCcw, Share2, X } from 'lucide-react';
import { type ExtraKey, type QuestionKey } from '../content';
import { track } from '../track';
import { EMPTY_PLAN, baht, nightly, planBudget, planSaving, usePlan } from '../planStore';
import { priceOf } from '../planText';
import {
  BOARD_TAGS,
  EXTRAS,
  CATEGORIES,
  SAMPLE,
  type BoardOption,
  type Category,
  type CategoryKey,
  type Mark,
  type Visual,
} from './items';
import type { Plan } from '../planStore';
import fontStyles from '../farewell.module.css';

const PAPER = '#efe7da';

function ItemVisual({ visual, size = 'board' }: { visual: Visual; size?: 'board' | 'card' }) {
  if (visual.kind === 'calendar') {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="flex aspect-[4/5] h-full max-h-full flex-col overflow-hidden rounded-lg bg-white shadow-[0_6px_14px_rgba(60,40,20,0.18)]">
          <div className="h-[22%] bg-gray-900" /> {/* แถบหัวปฏิทินสีดำทุกใบ คุมโทนกับกระดาน (ผู้ใช้ขอ 21 พ.ย. 2026) */}
          <div className="flex flex-1 flex-col items-center justify-center leading-none">
            <span className={`font-bold tabular-nums text-gray-900 ${size === 'card' ? 'text-xl' : 'text-[clamp(20px,3.4vw,36px)]'}`}>{visual.n}</span>
            {size === 'board' && <span className="mt-1 text-xs text-gray-500">{visual.n === 1 ? 'วันเดียว' : 'คืน'}</span>}
          </div>
        </div>
      </div>
    );
  }
  if (visual.kind === 'sign') {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="relative aspect-[3/4] h-full">
          <Image src="/farewell/signs/rip-sign-black.png" alt="ป้ายงานศพปลอดเหล้า" fill sizes="160px" loading="eager" className="object-contain" />
        </div>
      </div>
    );
  }
  if (visual.kind === 'card') {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="flex aspect-[4/3] max-h-full w-full max-w-[220px] -rotate-2 items-center justify-center rounded-md bg-white p-3 text-center shadow-[0_6px_14px_rgba(60,40,20,0.18)]">
          <span className="text-xs leading-snug text-gray-700">{visual.text}</span>
        </div>
      </div>
    );
  }
  const n = visual.stack ?? 1;
  return (
    <div
      className={`relative h-full w-full ${visual.mark && visual.mark !== 'soft-none' ? '[&_img]:opacity-40 [&_img]:grayscale-[60%]' : ''}`}
      style={visual.label ? { containerType: 'size' } : undefined}
    >
      {Array.from({ length: n }).map((_, i) => (
        <div
          key={i}
          className="absolute inset-0"
          style={n > 1 ? { transform: `translate(${(i - (n - 1) / 2) * 14}%, ${(i - (n - 1) / 2) * -6}%) scale(${0.82})` } : undefined}
        >
          <Image
            src={visual.src}
            alt={i === 0 ? visual.alt : ''}
            fill
            loading="eager"
            sizes={size === 'card' ? '120px' : '(max-width: 768px) 60vw, 400px'}
            unoptimized={visual.src.endsWith('.svg')}
            className="object-contain drop-shadow-[0_8px_10px_rgba(60,40,20,0.22)]"
          />
        </div>
      ))}
      {visual.mark && <MarkBadge mark={visual.mark} />}
      {visual.label && (
        <span className="absolute inset-x-0 top-[62%] -translate-y-1/2 text-center font-bold leading-none text-gray-900" style={{ fontSize: '17cqh' }}>
          {visual.label}
        </span>
      )}
    </div>
  );
}

/** วงห้าม/เครื่องหมายคำถามสีดำทับของ — ภาษาภาพเดียวกับป้ายงานศพปลอดเหล้า */
function MarkBadge({ mark }: { mark: Mark }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={`absolute left-1/2 top-1/2 h-[78%] max-h-full -translate-x-1/2 -translate-y-1/2 ${mark === 'soft-none' ? 'opacity-30' : ''}`}
      aria-hidden="true"
    >
      {mark !== 'maybe' ? (
        <>
          <circle cx="50" cy="50" r="40" fill="none" stroke="#111827" strokeWidth="9" />
          <line x1="22" y1="22" x2="78" y2="78" stroke="#111827" strokeWidth="9" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="50" cy="50" r="30" fill="#111827" />
          <text x="50" y="64" textAnchor="middle" fontSize="42" fontWeight="700" fill="#fff" fontFamily="inherit">?</text>
        </>
      )}
    </svg>
  );
}

/** ตำแหน่งป้ายของภาพตัวเลือกย่อย — คนล้างจานวางป้ายใต้ช่อง (ช่องว่างเหนือแถวล่าง) ไม่งั้นชนป้ายแม่ครัวบนมือถือ */
const EXTRA_TAG_POS: Record<string, string> = {
  brahmin: '-bottom-1 right-0',
  cook: '-bottom-1 left-1/2 -translate-x-1/2',
  dishwash: 'top-full mt-1.5 left-1/2 -translate-x-1/2',
};

/** แถวตัวเลือก: รูปเล็ก + ชื่อ + ราคา + ส่วนต่างจากตัวที่เลือกอยู่ */
function OptionRow({
  cat,
  option,
  selected,
  delta,
  onPick,
}: {
  cat: Category;
  option: BoardOption;
  selected: boolean;
  delta: number | null;
  onPick: () => void;
}) {
  const price = priceOf(cat.key, option.id);
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={selected}
      className={`flex w-full items-center gap-3 rounded-2xl border bg-white p-2.5 text-left transition-colors hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gray-900 ${
        selected ? 'border-gray-900 ring-1 ring-gray-900' : 'border-gray-200'
      }`}
    >
      <span className="relative h-14 w-20 shrink-0 rounded-xl p-1.5" style={{ backgroundColor: PAPER }}>
        <ItemVisual visual={option.visual} size="card" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="font-semibold text-gray-900">{option.label}</span>
          {option.lighter && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-800">ภาระเบา</span>}
        </span>
        <span className="mt-0.5 block truncate text-xs text-gray-600">{option.detail}</span>
        {(price || (delta != null && !selected && delta !== 0)) && (
          <span className="mt-0.5 flex flex-wrap gap-x-2 text-xs tabular-nums">
            {price && <span className="text-gray-500">~{price}</span>}
            {delta != null && !selected && delta !== 0 && (
              <span className={`font-medium ${delta < 0 ? 'text-emerald-700' : 'text-gray-900'}`}>
                {/* บอกให้ชัดว่าเทียบกับตัวที่เลือกอยู่ (เดิม "เพิ่ม 7,500" ผู้ใช้งงว่าทำไมบุฟเฟ่ต์เพิ่ม — ผู้ใช้ถาม 22 พ.ย. 2026) */}
                {delta < 0 ? `ถูกกว่าที่เลือกอยู่ ${baht(-delta)}` : `แพงกว่าที่เลือกอยู่ ${baht(delta)}`}
              </span>
            )}
          </span>
        )}
      </span>
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
          selected ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-300 text-transparent'
        }`}
        aria-hidden="true"
      >
        <Check className="w-3.5 h-3.5" />
      </span>
    </button>
  );
}

/** จอที่บูธ: ไม่มีคนแตะนานเท่านี้ = ล้างแผน (คนถัดไปไม่เห็นแผน/ชื่อของคนก่อน) แล้วกลับหน้าจอชวนลอง */
const BOOTH_IDLE_MS = 60_000;
/** จอที่บูธ สาธิตตัวเอง: เลือกตัวอย่างทีละเรื่องห่างกันเท่านี้ · จบแล้วโชว์ยอดประหยัดค้างไว้เท่านี้ก่อนเริ่มรอบใหม่ */
const DEMO_STEP_MS = 1_500;
const DEMO_HOLD_MS = 9_000;

export default function BoardBuilder({
  title = 'จัดงานของบ้านเรา',
  booth = false,
  intro = false,
}: {
  title?: string;
  /** โหมดจอที่บูธ (?booth=1) */
  booth?: boolean;
  /** มาจาก QR ที่บูธ (?from=qr) — แถบต้อนรับก่อนเริ่มเลือก */
  intro?: boolean;
}) {
  const { plan, update, reset } = usePlan();
  const router = useRouter();
  const reduce = useReducedMotion();
  const [active, setActive] = useState<CategoryKey>('place');
  /** ยอดรวมขยับเท่าไรจากการเลือกครั้งล่าสุด (k = ให้ชิปเล่นอนิเมชันใหม่ทุกครั้ง) */
  const [bump, setBump] = useState<{ v: number; k: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const receiptRef = useRef<HTMLElement>(null);
  const tabsRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** รูปใบสรุปที่เปิดให้กดค้างบันทึก (เบราว์เซอร์ในแอป LINE/Facebook ดาวน์โหลดไฟล์ไม่ได้) */
  const [preview, setPreview] = useState<{ url: string; file: File } | null>(null);
  /** จอที่บูธ: หน้าจอชวนลอง (เริ่มต้นเปิดอยู่) */
  const [attract, setAttract] = useState(booth);
  /** หน้าจอชวนลอง: 'play' = กำลังเลือกตัวอย่างทีละเรื่อง · 'result' = จบรอบ โชว์ยอดประหยัดตัวใหญ่ */
  const [demo, setDemo] = useState<'play' | 'result'>('play');
  const demoTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const attractRef = useRef(booth);
  /** ทางออกของทีมงาน: แตะมุมซ้ายบนค้าง 3 วิ (ผู้ใช้ขอ 22 พ.ย. 2026) */
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [exiting, setExiting] = useState(false);
  const started = useRef(false);
  const completed = useRef(false);

  const answers = plan?.answers ?? {};
  const place = plan?.place ?? null;
  const setPlace = (v: string | null) => update({ place: v });
  const choiceOf = (key: CategoryKey) => (key === 'place' ? place : (answers[key as QuestionKey] ?? null));
  const cat = CATEGORIES.find((c) => c.key === active)!;
  const chosenCount = CATEGORIES.filter((c) => choiceOf(c.key)).length;
  const base: Plan = { ...(plan ?? EMPTY_PLAN), answers };
  const budget = planBudget(base);
  const totalWith = (key: string, id: string) =>
    key === 'place' ? budget.total : planBudget({ ...base, answers: { ...answers, [key]: id } }).total;
  /** ส่วนต่างจากตัวที่เลือกอยู่ — ยังไม่ได้เลือกเรื่องนี้ = ไม่มีอะไรให้เทียบ */
  const deltaOf = (key: CategoryKey, id: string) => (key === 'place' || !choiceOf(key) ? null : totalWith(key, id) - budget.total);

  const showBump = (key: string, id: string) => {
    const v = totalWith(key, id) - budget.total;
    if (v !== 0) setBump((b) => ({ v, k: (b?.k ?? 0) + 1 }));
  };

  /** ผู้ใช้กดเลือกหมวดเอง = ยกเลิกการเลื่อนหมวดอัตโนมัติที่ค้างอยู่ (ไม่งั้นโดนดึงไปหมวดอื่นหลังกด ~0.5 วิ) */
  const goTo = (key: CategoryKey) => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    setActive(key);
  };

  /** ไปหมวดถัดไปที่ยังไม่ได้เลือก หลังของตกลงกระดานแล้ว */
  const advanceFrom = (key: CategoryKey) => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    const next = CATEGORIES.find((c) => c.key !== key && !choiceOf(c.key));
    if (next) advanceTimer.current = setTimeout(() => setActive(next.key), reduce ? 0 : 550);
  };

  const pick = (key: CategoryKey, id: string) => {
    if (!started.current) {
      started.current = true;
      track('PLAN_START');
    }
    showBump(key, id);
    if (key === 'place') setPlace(id);
    else update((p) => ({ answers: { ...p.answers, [key]: id } }));
    // หมวดที่มีตัวเลือกย่อย (พราหมณ์ / แม่ครัว / คนล้างจาน): รอให้ตอบครบก่อนค่อยไปต่อ
    if (EXTRAS.some((e) => e.parent === key && !answers[e.key])) return;
    advanceFrom(key);
  };

  const pickExtra = (key: ExtraKey, parent: CategoryKey, id: string) => {
    showBump(key, id);
    update((p) => ({ answers: { ...p.answers, [key]: id } }));
    const rest = EXTRAS.filter((e) => e.parent === parent && e.key !== key);
    if (choiceOf(parent) && rest.every((e) => answers[e.key])) advanceFrom(parent);
  };
  /** ช่องของหมวดบนกระดาน — หดลงเมื่อมีภาพตัวเลือกย่อยวางข้าง ๆ */
  const slotOf = (c: Category) =>
    c.slotCompact && EXTRAS.some((e) => e.parent === c.key && e.visual && answers[e.key] === 'yes') ? c.slotCompact : c.slot;
  /** ชื่อตัวเลือก + ตัวเลือกย่อยที่ตอบ "มี" เช่น "บุฟเฟ่ต์ + แม่ครัว" (ภาพที่มีภาพของตัวเองไม่ต่อท้ายบนกระดาน) */
  const withExtras = (parent: CategoryKey, text: string, onBoard = false) => {
    const on = EXTRAS.filter((e) => e.parent === parent && answers[e.key] === 'yes' && !(onBoard && e.visual));
    return on.length ? `${text} + ${on.map((e) => e.tag).join(' + ')}` : text;
  };

  const fillSample = () => {
    setPlace(SAMPLE.place ?? null);
    update((p) => {
      const a = { ...p.answers, brahmin: 'no', cook: 'no', dishwash: 'no' };
      for (const [k, v] of Object.entries(SAMPLE)) if (k !== 'place' && v) a[k as QuestionKey] = v;
      return { answers: a };
    });
    setBump(null);
  };
  const clearAll = () => {
    setPlace(null);
    update((p) => {
      const a = { ...p.answers };
      for (const c of CATEGORIES) if (c.key !== 'place') delete a[c.key as QuestionKey];
      for (const e of EXTRAS) delete a[e.key];
      return { answers: a };
    });
    setBump(null);
    setActive('place');
  };

  // วาดใบสรุปเป็นรูปแล้วเปิดดูใน popup (ดาวน์โหลด/แชร์จากใน popup)
  const saveImage = async () => {
    setSaving(true);
    try {
      const { renderBoardImage } = await import('./exportImage');
      const items = CATEGORIES.flatMap((c) => {
        const o = c.options.find((x) => x.id === choiceOf(c.key));
        if (!o) return [];
        const tag = BOARD_TAGS[c.key]?.[o.id];
        return [{ cat: { ...c, slot: slotOf(c) }, option: o, tag: tag && withExtras(c.key, tag, true) }];
      });
      // ตัวเลือกย่อยที่มีภาพ (พราหมณ์ แม่ครัว คนล้างจาน) วางในช่องของตัวเอง
      const extras = EXTRAS.flatMap((e) =>
        answers[e.key] === 'yes' && e.visual && e.slot ? [{ slot: e.slot, visual: e.visual, tag: e.tag, tagBelow: e.key === 'dishwash' }] : [],
      );
      const rows = CATEGORIES.map((c) => {
        const o = c.options.find((x) => x.id === choiceOf(c.key));
        return { label: c.label, value: o ? withExtras(c.key, o.label) : null };
      });
      const costLines = lines.map((l) => ({
        label: l.label,
        detail: l.perDay && budget.days > 1 ? `${l.amount.toLocaleString('th-TH')} × ${budget.days} ${nightly(l.id) ? 'คืน' : 'วัน'}` : undefined,
        total: l.total,
      }));
      const family = getComputedStyle(document.body).fontFamily || 'sans-serif';
      const display = (titleRef.current && getComputedStyle(titleRef.current).fontFamily) || family;
      const host = window.location.host;
      const siteUrl = /localhost|127\.0\.0\.1/.test(host) ? 'network.sdnthailand.com' : host;
      const blob = await renderBoardImage({
        items,
        extras,
        rows,
        lines: costLines,
        total: totalText,
        days: answers.days ? budget.days : null,
        deceasedName: plan?.deceasedName?.trim() || undefined,
        alcoholFree: answers.alcohol === 'none',
        saving: saved > 0 ? { saved, typical: TYPICAL_TOTAL, alcohol: alcoholSaved } : null,
        display,
        family,
        siteUrl,
      });
      const file = new File([blob], 'แผนงานของบ้านเรา.png', { type: 'image/png' });
      // เปิดดูใบสรุปก่อนเสมอ — ปุ่มดาวน์โหลด/แชร์อยู่ใน popup (ผู้ใช้ขอ 22 พ.ย. 2026)
      setPreview({ url: URL.createObjectURL(blob), file });
    } catch (e) {
      console.error('[farewell/board] export failed', e);
      toast.error('บันทึกรูปไม่สำเร็จ ลองอีกครั้ง');
    } finally {
      setSaving(false);
    }
  };

  const closePreview = () => {
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null);
  };
  const downloadPreview = () => {
    if (!preview) return;
    track('SHARE');
    const a = document.createElement('a');
    a.href = preview.url;
    a.download = preview.file.name;
    a.click();
    toast.success('บันทึกรูปแล้ว ส่งให้ญาติทาง LINE ได้เลย');
  };
  const sharePreview = async () => {
    if (!preview) return;
    try {
      await navigator.share({ files: [preview.file], title: 'แผนงานของบ้านเรา' });
      track('SHARE');
    } catch (e) {
      if ((e as Error).name !== 'AbortError') downloadPreview();
    }
  };
  /** เบราว์เซอร์ในแอป (LINE/Facebook/IG) ดาวน์โหลด/แชร์ไฟล์ไม่ได้ → บอกให้กดค้างที่รูป */
  const inApp = typeof navigator !== 'undefined' && /\bLine\/|FBAN|FBAV|Instagram/i.test(navigator.userAgent);
  const canShareFile = !!preview && typeof navigator !== 'undefined' && !!navigator.canShare?.({ files: [preview.file] });

  // มือถือ: แถบหมวดยาวเกินจอ — เลื่อนหมวดที่เปิดอยู่มาไว้กลางแถบ (เลื่อนเฉพาะแนวนอน ไม่ดึงหน้า)
  useEffect(() => {
    const nav = tabsRef.current;
    const btn = nav?.querySelector<HTMLElement>('[aria-current="step"]');
    if (!nav || !btn || nav.scrollWidth <= nav.clientWidth) return;
    nav.scrollTo({ left: btn.offsetLeft - (nav.clientWidth - btn.offsetWidth) / 2, behavior: reduce ? 'auto' : 'smooth' });
  }, [active, reduce]);

  const fact = cat.facts[0];
  const lines = budget.lines.filter((l) => l.total > 0);
  const totalText = baht(budget.total);
  // ประหยัดได้เมื่อเทียบงานแบบที่นิยม — ตัวคำนวณเดียวกับหน้าวางแผน (planSaving)
  const { ready: savingReady, saved, typical: TYPICAL_TOTAL, alcohol: alcoholSaved } = planSaving(base);

  // สถิติ: ครบ 8 เรื่องครั้งแรก = PLAN_COMPLETE (รหัสตัวเลือกเท่านั้น ไม่มีชื่อ/ราคา)
  // นับเฉพาะคนที่เลือกเองอย่างน้อย 1 ครั้ง — "ดูตัวอย่าง" / ตัวอย่างบนจอบูธ ไม่นับ
  useEffect(() => {
    if (chosenCount === CATEGORIES.length && started.current && !completed.current) {
      completed.current = true;
      track('PLAN_COMPLETE', { answers: { ...((plan?.answers ?? {}) as Record<string, string>), ...(plan?.place ? { place: plan.place } : {}) } });
    }
  }, [chosenCount, plan]);

  const stopDemo = () => {
    for (const t of demoTimers.current) clearTimeout(t);
    demoTimers.current = [];
  };

  /** จอที่บูธ: ล้างแผนของคนก่อน แล้วสาธิตตัวเอง — เลือกตัวอย่างงานเรียบง่ายทีละเรื่อง (ของเด้งลงกระดาน ยอดวิ่ง)
   *  จบรอบ = ยอดประหยัดตัวใหญ่ + QR ค้างไว้ แล้ววนใหม่ · ไม่นับสถิติ (ไม่ผ่าน pick) */
  const enterAttract = () => {
    stopDemo();
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    reset();
    started.current = false;
    completed.current = false;
    setBump(null);
    setActive('place');
    setAttract(true);
    attractRef.current = true;
    setDemo('play');
    window.scrollTo(0, 0);
    // ตัวเลือกย่อยตอบ "ไม่มี" ไว้ก่อน (ไม่ต้องรอตอบ) แล้วค่อยเลือกหมวดหลักทีละเรื่อง
    update(() => ({ place: null, answers: { brahmin: 'no', cook: 'no', dishwash: 'no' } }));
    const steps = CATEGORIES.filter((c) => SAMPLE[c.key]);
    steps.forEach((c, i) => {
      demoTimers.current.push(
        setTimeout(() => {
          const id = SAMPLE[c.key]!;
          setActive(c.key);
          if (c.key === 'place') update({ place: id });
          else {
            update((p) => {
              const before = planBudget({ ...p, answers: p.answers }).total;
              const answers = { ...p.answers, [c.key]: id };
              const v = planBudget({ ...p, answers }).total - before;
              if (v !== 0) setBump((b) => ({ v, k: (b?.k ?? 0) + 1 }));
              return { answers };
            });
          }
        }, 900 + i * DEMO_STEP_MS),
      );
    });
    const end = 900 + steps.length * DEMO_STEP_MS;
    demoTimers.current.push(setTimeout(() => setDemo('result'), end));
    demoTimers.current.push(setTimeout(() => enterAttractRef.current(), end + DEMO_HOLD_MS));
  };
  const enterAttractRef = useRef(enterAttract);
  useEffect(() => {
    enterAttractRef.current = enterAttract;
  });

  // จอที่บูธ: เปิดมา = หน้าจอชวนลอง · ไม่มีคนแตะ 60 วิ = กลับหน้าจอชวนลอง (ล้างแผน)
  useEffect(() => {
    if (!booth) return;
    let last = Date.now();
    const touch = () => {
      last = Date.now();
      // แตะครั้งแรก = เข้าโหมดเต็มจอของเบราว์เซอร์ (ต้องมาจากการแตะของคน เรียกเองตอนโหลดหน้าไม่ได้)
      if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
    };
    const opts = { passive: true, capture: true } as const;
    window.addEventListener('pointerdown', touch, opts);
    window.addEventListener('keydown', touch, opts);
    window.addEventListener('scroll', touch, opts);
    const first = setTimeout(() => enterAttractRef.current(), 0);
    const t = setInterval(() => {
      // ระหว่างหน้าจอชวนลองวนสาธิตเองอยู่แล้ว ไม่ต้องล้าง
      if (!attractRef.current && Date.now() - last > BOOTH_IDLE_MS) {
        last = Date.now();
        enterAttractRef.current();
      }
    }, 5_000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
      for (const d of demoTimers.current) clearTimeout(d);
      window.removeEventListener('pointerdown', touch, opts);
      window.removeEventListener('keydown', touch, opts);
      window.removeEventListener('scroll', touch, opts);
    };
  }, [booth]);

  const holdExit = () => {
    setExiting(true);
    exitTimer.current = setTimeout(() => {
      stopDemo();
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      setExiting(false);
      router.push('/');
    }, 3000);
  };
  const cancelExit = () => {
    if (exitTimer.current) clearTimeout(exitTimer.current);
    exitTimer.current = null;
    setExiting(false);
  };

  /** แตะหน้าจอชวนลอง = เริ่มกระดานเปล่าให้คนนี้ */
  const startFromAttract = () => {
    stopDemo();
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    attractRef.current = false;
    reset();
    started.current = false;
    completed.current = false;
    setBump(null);
    setActive('place');
    setAttract(false);
  };

  const bumpChip = bump && (
    <motion.span
      key={bump.k}
      initial={reduce ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ${bump.v < 0 ? 'bg-emerald-50 text-emerald-800' : 'bg-gray-100 text-gray-900'}`}
    >
      {bump.v < 0 ? '−' : '+'}
      {baht(Math.abs(bump.v))}
    </motion.span>
  );

  return (
    // จอที่บูธ (จอใหญ่ในห้าง): ขยายทั้งหน้า ให้มองเห็นจากระยะยืน — zoom ไม่กระทบผังของมือถือ/หน้าปกติ
    <div className={`mx-auto max-w-6xl ${booth ? 'lg:[zoom:1.25]' : ''}`}>
      {/* หัวเรื่องบนหน้าตัดออก (ผู้ใช้ขอ 22 พ.ย. 2026) เหลือ h1 ซ่อนไว้ให้โปรแกรมอ่านหน้าจอ และใช้อ่านฟอนต์หัวเรื่องให้ใบสรุป */}
      <h1 ref={titleRef} className={`sr-only ${fontStyles.sao}`}>{title}</h1>

      {/* มาจาก QR ที่บูธ: แถบต้อนรับก่อนเริ่มเลือก */}
      {intro && chosenCount === 0 && (
        <div className="mb-4 flex flex-col gap-3 rounded-2xl bg-gray-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-lg font-bold text-gray-900">ถ้าวันหนึ่งต้องจัดงานให้คนที่รัก ต้องใช้เงินเท่าไร?</p>
            <p className="mt-0.5 text-sm text-gray-600">ลองจัดทีละเรื่อง ราว 1 นาที แล้วบันทึกเป็นรูปส่งเข้า LINE ครอบครัวได้</p>
          </div>
          <button
            type="button"
            onClick={fillSample}
            className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-full border border-gray-300 bg-white px-4 text-sm font-medium text-gray-900 hover:bg-gray-50"
          >
            <Eye className="w-4 h-4" /> ดูตัวอย่างงานเรียบง่าย
          </button>
        </div>
      )}

      {/* แถบหมวด */}
      {/* อยู่กลางจอ · มือถือย่อขนาด (ผู้ใช้ขอ 22 พ.ย. 2026) — ยาวเกินจอ = เลื่อนข้าง และเลื่อนหมวดที่เปิดอยู่มาไว้กลางให้เอง */}
      <nav ref={tabsRef} aria-label="หมวด" className="relative -mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
        <ol className="mx-auto flex w-max gap-0.5 rounded-full border border-gray-200 bg-white p-1 sm:gap-1.5">
          {CATEGORIES.map((c) => {
            const done = !!choiceOf(c.key);
            const on = c.key === active;
            return (
              <li key={c.key}>
                <button
                  type="button"
                  onClick={() => goTo(c.key)}
                  aria-current={on ? 'step' : undefined}
                  className={`inline-flex h-8 items-center gap-1 whitespace-nowrap rounded-full px-2.5 text-xs transition-colors sm:h-9 sm:gap-1.5 sm:px-3 sm:text-sm ${
                    on ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {/* วงกลมแบบเดียวกับการ์ดตัวเลือก (ผู้ใช้ขอ 22 พ.ย. 2026): ยังไม่เลือก = วงเปล่า · เลือกแล้ว = วงทึบมีถูก */}
                  <span
                    aria-hidden="true"
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border sm:h-5 sm:w-5 ${
                      done
                        ? on
                          ? 'border-white bg-white text-gray-900'
                          : 'border-gray-900 bg-gray-900 text-white'
                        : on
                          ? 'border-white/60'
                          : 'border-gray-300'
                    }`}
                  >
                    {done && <Check className="w-3.5 h-3.5" />}
                  </span>
                  {c.label}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* grid-cols-[minmax(0,1fr)] บนมือถือ: คอลัมน์ไม่ขยายตามข้อความบรรทัดเดียว (truncate) จนจอล้นแนวนอน */}
      <div className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)_minmax(0,280px)] lg:items-start lg:gap-6">
        {/* ตัวเลือกของหมวดนี้ (มือถืออยู่ใต้กระดาน) */}
        <section aria-label={cat.title} className="order-2 lg:order-1">
          <h2 className="text-lg font-semibold text-gray-900">{cat.title}</h2>
          <p className="mt-0.5 text-sm leading-relaxed text-gray-600">{cat.why}</p>
          <div className="mt-3 space-y-2">
            {cat.options.map((o) => (
              <OptionRow
                key={o.id}
                cat={cat}
                option={o}
                selected={choiceOf(cat.key) === o.id}
                delta={deltaOf(cat.key, o.id)}
                onPick={() => pick(cat.key, o.id)}
              />
            ))}
          </div>

          {/* ตัวเลือกย่อย มี/ไม่มี: พราหมณ์ (พิธี) · แม่ครัว คนล้างจาน (อาหาร) */}
          {EXTRAS.filter((e) => e.parent === cat.key).map((e) => (
            <div key={e.key} className="mt-3 rounded-2xl bg-gray-50 p-3">
              <p className="text-sm font-medium text-gray-900">
                {e.title} <span className="font-normal text-gray-500">· ~{priceOf(e.key, 'yes')}</span>
              </p>
              <div className={`grid grid-cols-2 gap-2 ${e.visual ? 'mt-5' : 'mt-2'}`}>
                {[
                  { id: 'no', label: 'ไม่มี' },
                  { id: 'yes', label: e.yes },
                ].map((o) => {
                  const on = answers[e.key] === o.id;
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => pickExtra(e.key, e.parent, o.id)}
                      aria-pressed={on}
                      className={`relative inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border px-3 text-sm ${o.id === 'yes' && e.visual ? 'pl-16' : ''} ${
                        on ? 'border-gray-900 bg-white font-medium text-gray-900 ring-1 ring-gray-900' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {/* คนล้นขึ้นเหนือปุ่ม ให้เห็นชัด (ผู้ใช้ขอ 22 พ.ย. 2026) */}
                      {o.id === 'yes' && e.visual && (
                        <span className="pointer-events-none absolute bottom-0 left-1.5 h-[76px] w-14">
                          <ItemVisual visual={e.visual} size="card" />
                        </span>
                      )}
                      {on && <Check className="w-3.5 h-3.5" />}
                      {o.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {fact && (
            <figure className="mt-4 rounded-2xl p-3" style={{ backgroundColor: PAPER }}>
              <p className="flex items-center gap-1.5 text-xs font-medium text-gray-700">
                <Quote className="w-3.5 h-3.5" /> เรื่องจริง
              </p>
              <blockquote className="mt-1 text-sm leading-relaxed text-gray-900">{fact.text}</blockquote>
              <figcaption className="mt-1 text-xs text-gray-600">{fact.source}</figcaption>
            </figure>
          )}
        </section>

        {/* กระดาน */}
        <div className="order-1 mx-auto w-full max-w-[320px] sm:max-w-[380px] lg:order-2 lg:max-w-[min(380px,calc((100svh-230px)*0.75))]">
          <div
            className="relative aspect-[3/4] w-full overflow-hidden rounded-[28px] border border-[#e2d7c5] shadow-[inset_0_2px_10px_rgba(80,60,30,0.06)]"
            style={{ backgroundColor: PAPER }}
          >
            {CATEGORIES.map((c) => {
              const id = choiceOf(c.key);
              const opt = c.options.find((o) => o.id === id);
              const s = slotOf(c);
              const baseTag = opt ? BOARD_TAGS[c.key]?.[opt.id] : undefined;
              const tag = baseTag && withExtras(c.key, baseTag, true);
              const tagPos = c.tagAlign === 'end' ? 'right-0' : c.tagAlign === 'start' ? 'left-0' : 'left-1/2 -translate-x-1/2';
              return (
                <div key={c.key} className="absolute" style={{ left: `${s.x}%`, top: `${s.y}%`, width: `${s.w}%`, height: `${s.h}%` }}>
                  {opt ? (
                    <motion.button
                      key={opt.id}
                      type="button"
                      initial={reduce ? false : { opacity: 0, y: -18, scale: 0.92 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 320, damping: 24 }}
                      onClick={() => goTo(c.key)}
                      aria-label={`${c.label}: ${opt.label} (แตะเพื่อเปลี่ยน)`}
                      className={`relative h-full w-full rounded-2xl ${c.key === active ? 'outline-dashed outline-2 outline-offset-2 outline-gray-900/40' : ''}`}
                    >
                      <ItemVisual visual={opt.visual} />
                      {tag && (
                        <span
                          className={`pointer-events-none absolute -bottom-1 ${tagPos} whitespace-nowrap rounded-full bg-white/90 px-2 py-0.5 text-xs leading-tight text-gray-700 shadow-[0_1px_3px_rgba(60,40,20,0.15)]`}
                        >
                          {tag}
                        </span>
                      )}
                    </motion.button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => goTo(c.key)}
                      className={`flex h-full w-full items-center justify-center rounded-2xl border-2 border-dashed text-xs transition-colors ${
                        c.key === active ? 'border-gray-900/60 bg-white/50 font-medium text-gray-900' : 'border-[#d3c5ae] text-[#7a6a52] hover:border-gray-900/40'
                      }`}
                    >
                      {c.label}
                    </button>
                  )}
                </div>
              );
            })}
            {EXTRAS.map((e) =>
              answers[e.key] === 'yes' && e.visual && e.slot ? (
                <div
                  key={e.key}
                  className="absolute"
                  style={{ left: `${e.slot.x}%`, top: `${e.slot.y}%`, width: `${e.slot.w}%`, height: `${e.slot.h}%` }}
                >
                  <motion.button
                    type="button"
                    initial={reduce ? false : { opacity: 0, y: -18, scale: 0.92 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 320, damping: 24 }}
                    onClick={() => goTo(e.parent)}
                    aria-label={`${e.title} (แตะเพื่อเปลี่ยน)`}
                    className="relative h-full w-full"
                  >
                    <ItemVisual visual={e.visual} />
                    <span className={`pointer-events-none absolute whitespace-nowrap ${EXTRA_TAG_POS[e.key]} rounded-full bg-white/90 px-2 py-0.5 text-xs leading-tight text-gray-700 shadow-[0_1px_3px_rgba(60,40,20,0.15)]`}>
                      {e.tag}
                    </span>
                  </motion.button>
                </div>
              ) : null,
            )}
          </div>
          <p className="mt-2 text-center text-xs text-gray-500">แตะช่องบนกระดานเพื่อเลือกหรือเปลี่ยนเรื่องนั้น</p>
        </div>

        {/* ใบรายการค่าใช้จ่าย (สด) */}
        <aside
          ref={receiptRef}
          aria-label="ค่าใช้จ่ายโดยประมาณ"
          className="order-3 scroll-mt-24 rounded-2xl border border-gray-200 bg-white p-4 lg:sticky lg:top-20"
        >
          <p className="text-xs text-gray-500">ค่าใช้จ่ายโดยประมาณ</p>
          <p className="mt-0.5 flex flex-wrap items-baseline gap-2" aria-live="polite">
            <span className="text-3xl font-bold tabular-nums text-gray-900">{totalText}</span>
            {bumpChip}
          </p>
          <p className="mt-0.5 text-xs text-gray-500">
            เลือกแล้ว {chosenCount} จาก {CATEGORIES.length} เรื่อง{answers.days && budget.days > 1 ? ` · งาน ${budget.days} คืน` : ''}
          </p>

          {/* ปุ่มหลักอยู่ใต้ยอดรวม — จอบูธ/จอเตี้ยต้องเห็นโดยไม่ต้องเลื่อน (ผู้ใช้ขอ 22 พ.ย. 2026) */}
          <div className="mt-3 grid gap-2">
            <button
              type="button"
              onClick={saveImage}
              disabled={saving || chosenCount === 0}
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full bg-gray-900 px-4 text-sm font-medium text-white hover:bg-gray-700 disabled:bg-gray-200 disabled:text-gray-500"
            >
              <FileImage className="w-4 h-4" /> {saving ? 'กำลังทำใบสรุป…' : 'เปิดดูใบสรุป ส่งให้ญาติ'}
            </button>
            <Link
              href="/farewell/plan?step=budget"
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full border border-gray-300 px-4 text-sm text-gray-900 hover:bg-gray-50"
            >
              ปรับราคาเอง <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          {lines.length > 0 ? (
            <ul className="mt-3 divide-y divide-gray-100 border-t border-gray-100 text-sm">
              {lines.map((l) => (
                <li key={l.id} className="flex items-baseline justify-between gap-3 py-1.5">
                  <span className="min-w-0 text-gray-700">
                    {l.label}
                    {l.perDay && budget.days > 1 && (
                      <span className="block text-xs tabular-nums text-gray-500">
                        {l.amount.toLocaleString('th-TH')} × {budget.days} {nightly(l.id) ? 'คืน' : 'วัน'}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 tabular-nums text-gray-900">{l.total.toLocaleString('th-TH')}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 rounded-xl bg-gray-50 p-3 text-sm text-gray-600">ยังไม่มีรายการ เลือกจำนวนวัน หีบ หรืออาหาร แล้วยอดจะขึ้นตรงนี้</p>
          )}
          {budget.alcohol > 0 && <p className="mt-2 text-xs text-gray-600">ในนี้เป็นค่าเหล้าเบียร์ {baht(budget.alcohol)}</p>}

          {/* ประหยัดได้เท่าไร เมื่อเทียบงานแบบที่นิยม — ตัวเลขที่คนจะเล่าต่อ (เตรียมเวทีอุบล 27 พ.ย. 2026) */}
          {saved > 0 ? (
            <div className="mt-3 rounded-xl bg-emerald-50 p-3" aria-live="polite">
              <p className="text-xs text-emerald-800">เทียบงานแบบที่นิยม 5 คืน เลี้ยงเหล้า (~{baht(TYPICAL_TOTAL)})</p>
              <p className="mt-0.5 text-lg font-bold tabular-nums text-emerald-800">
                ประหยัดได้ <span className="whitespace-nowrap">~{baht(saved)}</span>
              </p>
              {alcoholSaved > 0 && (
                <p className="mt-1 text-xs text-emerald-800">ไม่เลี้ยงเหล้า ไม่ต้องจ่ายค่าเหล้าราว {baht(alcoholSaved)}</p>
              )}
            </div>
          ) : (
            !savingReady && (
              <p className="mt-3 rounded-xl bg-gray-50 p-3 text-xs leading-relaxed text-gray-600">
                เลือกจำนวนวัน หีบ พระและพิธี อาหาร และเรื่องเหล้าเบียร์ครบ จะเห็นว่าประหยัดได้เท่าไรเมื่อเทียบงานแบบที่นิยม
              </p>
            )
          )}

          <div className="mt-3">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={fillSample}
                className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full px-3 text-sm text-gray-700 hover:bg-gray-50"
              >
                <Eye className="w-4 h-4" /> ดูตัวอย่าง
              </button>
              <button
                type="button"
                onClick={clearAll}
                disabled={chosenCount === 0}
                className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full px-3 text-sm text-gray-700 hover:bg-gray-50 disabled:text-gray-400 disabled:hover:bg-transparent"
              >
                <RotateCcw className="w-4 h-4" /> ล้างกระดาน
              </button>
            </div>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-gray-500">ราคาประมาณจากกรณีศึกษา ราคาจริงแต่ละพื้นที่ต่างกัน · แผนเก็บในเครื่องนี้เท่านั้น</p>
        </aside>
      </div>

      {/* มือถือ: แถบยอดรวมติดล่างจอ แตะ = เลื่อนไปดูรายการ */}
      <button
        type="button"
        onClick={() => receiptRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' })}
        className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 border-t border-gray-200 bg-white px-4 py-3 text-left lg:hidden"
      >
        <span>
          <span className="block text-xs text-gray-500">
            ค่าใช้จ่ายโดยประมาณ · เลือกแล้ว {chosenCount}/{CATEGORIES.length}
          </span>
          <span className="flex items-baseline gap-2">
            {/* จอแคบ (360) ต้องอยู่บรรทัดเดียว: ทุกชิ้น nowrap · ชิปไม่มีคำว่าบาท · "ดูรายการ" เหลือลูกศรเมื่อจอ < 380 */}
            <span className="whitespace-nowrap text-xl font-bold tabular-nums text-gray-900">{totalText}</span>
            {saved > 0 ? (
              <span className="whitespace-nowrap rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium tabular-nums text-emerald-800">
                ประหยัด ~{Math.round(saved).toLocaleString('th-TH')}
              </span>
            ) : (
              bumpChip
            )}
          </span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-sm font-medium text-gray-900">
          <span className="max-[379px]:sr-only">ดูรายการ</span> <ArrowRight className="w-4 h-4" />
        </span>
      </button>

      {/* รูปใบสรุปให้กดค้างบันทึก (มือถือที่แชร์ไฟล์ไม่ได้ / เบราว์เซอร์ในแอป LINE) */}
      {preview && (
        <div className="fixed inset-0 z-[2100] flex flex-col items-center justify-center gap-3 bg-black/80 p-4" role="dialog" aria-modal="true" aria-label="ใบสรุป">
          {/* eslint-disable-next-line @next/next/no-img-element -- blob URL ที่เพิ่งวาดในเครื่อง */}
          <img src={preview.url} alt="ใบสรุปแผนงานของบ้านเรา" className="max-h-[72svh] w-auto rounded-xl bg-white" />
          {inApp ? (
            <p className="text-center text-sm text-white">กดค้างที่รูป แล้วเลือก “บันทึกรูป” หรือ “แชร์” ส่งให้ญาติ</p>
          ) : booth ? (
            <p className="text-center text-sm text-white">สแกน QR ที่บูธเพื่อจัดงานและบันทึกใบสรุปในมือถือของคุณ</p>
          ) : null}
          <div className="flex flex-wrap items-center justify-center gap-2">
            {!inApp && !booth && (
              <button
                type="button"
                onClick={downloadPreview}
                className="inline-flex h-11 items-center gap-1.5 rounded-full bg-white px-5 text-sm font-medium text-gray-900 hover:bg-gray-100"
              >
                <Download className="w-4 h-4" /> ดาวน์โหลดรูป
              </button>
            )}
            {!inApp && !booth && canShareFile && (
              <button
                type="button"
                onClick={sharePreview}
                className="inline-flex h-11 items-center gap-1.5 rounded-full bg-white px-5 text-sm font-medium text-gray-900 hover:bg-gray-100"
              >
                <Share2 className="w-4 h-4" /> แชร์ / ส่ง LINE
              </button>
            )}
            <button
              type="button"
              onClick={closePreview}
              className="inline-flex h-11 items-center gap-1.5 rounded-full border border-white/40 px-5 text-sm font-medium text-white hover:bg-white/10"
            >
              <X className="w-4 h-4" /> ปิด
            </button>
          </div>
        </div>
      )}

      {/* จอที่บูธ: ทางออกของทีมงาน — มุมซ้ายบน มองไม่เห็น แตะ/กดค้าง 3 วิ = ออกเต็มจอ แล้วกลับหน้าแรกปกติ (วงจะค่อย ๆ เต็มระหว่างค้าง) */}
      {booth && (
        <button
          type="button"
          aria-label="ทีมงาน: กดค้าง 3 วินาทีเพื่อออกจากโหมดจัดแสดง"
          onPointerDown={holdExit}
          onPointerUp={cancelExit}
          onPointerLeave={cancelExit}
          onPointerCancel={cancelExit}
          onContextMenu={(e) => e.preventDefault()}
          className="fixed left-0 top-0 z-[60] flex h-20 w-20 touch-none select-none items-center justify-center"
        >
          {exiting && (
            <svg viewBox="0 0 36 36" className="h-10 w-10 -rotate-90" aria-hidden="true">
              <circle cx="18" cy="18" r="15" fill="white" stroke="#e5e7eb" strokeWidth="3" />
              <motion.circle
                cx="18"
                cy="18"
                r="15"
                fill="none"
                stroke="#111827"
                strokeWidth="3"
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 3, ease: 'linear' }}
              />
            </svg>
          )}
        </button>
      )}

      {/* จอที่บูธ: หน้าจอชวนลอง — กระดานด้านหลังเป็นตัวอย่างงานเรียบง่าย แตะที่ไหนก็ได้ = เริ่มจัดเอง */}
      {booth && attract && (
        <button
          type="button"
          onClick={startFromAttract}
          className={`fixed inset-0 z-40 flex items-end justify-center p-4 pb-6 text-left transition-colors sm:p-6 ${demo === 'result' ? 'bg-white/60' : 'bg-transparent'}`}
          aria-label="แตะเพื่อเริ่มจัดงานของคุณ"
        >
          {demo === 'play' ? (
            // ระหว่างสาธิต: แถบเล็กด้านล่าง ไม่บังกระดาน ให้เห็นของเด้งลงและยอดวิ่ง
            // แถบเล็กกลางจอ (ผู้ใช้ขอ 22 พ.ย. 2026)
            // จอแคบ = สองบรรทัดกลาง (แต่ละท่อนไม่ตัดกลางคำ)
            <span className="inline-flex flex-col items-center gap-0.5 rounded-3xl bg-gray-900 px-5 py-2.5 text-center text-white shadow-xl sm:flex-row sm:gap-3 sm:rounded-full">
              <span className="whitespace-nowrap text-sm font-medium sm:text-base">ตัวอย่าง: จัดงานเรียบง่าย ใช้เงินเท่าไร?</span>
              <span aria-hidden="true" className="hidden text-white/40 sm:inline">·</span>
              <span className="whitespace-nowrap text-xs text-white/80 sm:text-base">แตะเพื่อลองจัดเอง</span>
            </span>
          ) : (
            <motion.span
              initial={reduce ? false : { opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex w-full max-w-4xl items-center gap-6 rounded-3xl bg-gray-900 p-5 text-white shadow-2xl sm:p-8"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm text-white/80 sm:text-2xl">
                  งานเรียบง่ายแบบนี้ <span className="whitespace-nowrap">~{totalText}</span> · เทียบงานแบบที่นิยม
                </span>
                <span className="mt-1 block text-2xl font-bold leading-tight text-emerald-300 sm:text-5xl">
                  ประหยัดได้ <span className="whitespace-nowrap">~{baht(saved)}</span>
                </span>
                <span className="mt-2 block text-sm text-white/80 sm:mt-3 sm:text-xl">แตะหน้าจอเพื่อลองจัดงานของคุณเอง</span>
              </span>
              <span className="hidden shrink-0 flex-col items-center gap-2 sm:flex">
                <span className="rounded-2xl bg-white p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element -- SVG QR คงที่ */}
                  <img src="/farewell/qr-home.svg" alt="QR ลองในมือถือ" className="h-32 w-32" />
                </span>
                <span className="text-sm text-white/80">หรือสแกนลองในมือถือ</span>
              </span>
            </motion.span>
          )}
        </button>
      )}
    </div>
  );
}
