'use client';
// app/farewell/plan/PlanWizard.tsx — วางแผนงานศพทีละขั้น
// ทุกข้อข้ามได้ บันทึกอัตโนมัติในเครื่องทุกครั้งที่เลือก (planStore) กลับมาทำต่อได้
// เลย์เอาต์ (ออกแบบใหม่ 28 ต.ค. 2026 — ผู้ใช้ขอ "ดูเป็นทางการ ไม่เอา icon"): แบบฟอร์มขาว-ดำ ไม่มีไอคอนทั้งหน้า ·
//   จอใหญ่ = 3 คอลัมน์ รายการขั้นตอนมีเลขกำกับ (กดข้ามขั้นได้) | ฟอร์ม | ใบสรุปติดข้าง (กดแถวกลับไปแก้ขั้นนั้น) ·
//   จอเล็กกว่า lg = แถบความคืบหน้าบนฟอร์ม · มือถือ = แถบยอดรวมติดล่าง กด "ใบสรุป" เปิดแผ่นล่าง
import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { DEFAULT_COST_NOTE, QUESTIONS, type Question } from '../content';
import { baht, planBudget, usePlan, type Plan } from '../planStore';
import AreaPicker from '../components/AreaPicker';
import AgreementList from '../components/AgreementList';
import Receipt from './Receipt';
import { trackOncePerTab } from '../track';

const STEPS = ['start', ...QUESTIONS.map((q) => q.key), 'budget'] as const;
type Step = (typeof STEPS)[number];
const STEP_LABEL: Record<Step, string> = {
  start: 'ข้อมูลเบื้องต้น',
  ...Object.fromEntries(QUESTIONS.map((q) => [q.key, q.short])),
  budget: 'งบประมาณ',
} as Record<Step, string>;

const isDone = (plan: Plan, s: Step) =>
  s === 'start' ? !!(plan.deceasedName || plan.area) : s === 'budget' ? planBudget(plan).filled : !!plan.answers[s];

const pad2 = (n: number) => String(n).padStart(2, '0');

// ── รายการขั้นตอน (จอใหญ่) ───────────────────────────────────────────────────────────
function StepList({ plan, step, onGo }: { plan: Plan; step: Step; onGo: (s: Step) => void }) {
  return (
    <nav aria-label="ขั้นตอนการวางแผน" className="lg:sticky lg:top-24">
      <p className="px-3 text-xs font-medium text-gray-500">ขั้นตอน</p>
      <ol className="mt-2 space-y-0.5">
        {STEPS.map((s, i) => {
          const current = s === step;
          const done = isDone(plan, s);
          return (
            <li key={s}>
              <button
                type="button"
                onClick={() => onGo(s)}
                aria-current={current ? 'step' : undefined}
                aria-label={`ขั้นที่ ${i + 1} ${STEP_LABEL[s]}${done ? ' (ทำแล้ว)' : ''}`}
                className={`flex w-full items-baseline gap-3 rounded-md px-3 py-2 text-left transition-colors ${
                  current ? 'bg-gray-900 text-white' : 'hover:bg-gray-100'
                }`}
              >
                <span className={`w-5 shrink-0 text-xs tabular-nums ${current ? 'text-gray-300' : 'text-gray-400'}`}>{pad2(i + 1)}</span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-sm ${current ? 'font-medium' : done ? 'text-gray-900' : 'text-gray-500'}`}>
                    {STEP_LABEL[s]}
                  </span>
                  {done && <span className={`block text-[11px] ${current ? 'text-gray-300' : 'text-gray-400'}`}>เลือกแล้ว</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <p className="mt-4 border-t border-gray-100 px-3 pt-3 text-xs leading-relaxed text-gray-500">
        บันทึกในเครื่องนี้อัตโนมัติ ไม่ส่งข้อมูลขึ้นเซิร์ฟเวอร์ ปิดแล้วกลับมาทำต่อได้
      </p>
    </nav>
  );
}

// ── แถบความคืบหน้า (จอเล็กกว่า lg) ───────────────────────────────────────────────────
function StepBar({ plan, step, onGo }: { plan: Plan; step: Step; onGo: (s: Step) => void }) {
  return (
    <div className="mb-6 lg:hidden">
      <ol className="grid gap-1" style={{ gridTemplateColumns: `repeat(${STEPS.length}, minmax(0, 1fr))` }}>
        {STEPS.map((s, i) => {
          const current = s === step;
          const done = isDone(plan, s);
          return (
            <li key={s}>
              <button
                type="button"
                onClick={() => onGo(s)}
                aria-label={`ขั้นที่ ${i + 1} ${STEP_LABEL[s]}${done ? ' (ทำแล้ว)' : ''}`}
                aria-current={current ? 'step' : undefined}
                title={STEP_LABEL[s]}
                className="group block w-full py-1.5"
              >
                <span
                  className={`block h-1 rounded-full transition-colors ${
                    current ? 'bg-gray-900' : done ? 'bg-gray-400 group-hover:bg-gray-500' : 'bg-gray-200 group-hover:bg-gray-300'
                  }`}
                />
              </button>
            </li>
          );
        })}
      </ol>
      <p className="mt-1 text-right text-[11px] text-gray-500">บันทึกในเครื่องนี้อัตโนมัติ</p>
    </div>
  );
}

// หัวของแต่ละขั้น: "ขั้นที่ n จาก N · ชื่อขั้น" + หัวข้อ + คำอธิบาย
function StepHeading({ step, title, lead }: { step: Step; title: string; lead: ReactNode }) {
  const i = STEPS.indexOf(step);
  return (
    <div className="border-b border-gray-100 pb-5">
      <p className="text-xs font-medium text-gray-500">
        ขั้นที่ {i + 1} จาก {STEPS.length}
        <span className="text-gray-300"> · </span>
        {STEP_LABEL[step]}
      </p>
      <h2 tabIndex={-1} className="mt-1.5 text-xl sm:text-2xl font-semibold leading-snug text-gray-900 outline-none">
        {title}
      </h2>
      <div className="mt-2 text-[15px] leading-relaxed text-gray-600">{lead}</div>
    </div>
  );
}

// ── ข้อมูลประกอบการตัดสินใจ ─────────────────────────────────────────────────────────────
// พับไว้เป็นค่าตั้งต้น — ตัวเลือกกับปุ่มถัดไปต้องเห็นได้โดยไม่ต้องเลื่อน (ผู้ใช้ขอ 3 ต.ค. 2026)
function Facts({ q }: { q: Question }) {
  if (q.facts.length === 0 && !q.tip) return null;
  return (
    <div className="mt-5 space-y-3">
      {q.tip && (
        <div className="border-l-2 border-gray-900 pl-4">
          <p className="text-xs font-semibold text-gray-900">ข้อแนะนำ</p>
          <p className="mt-0.5 text-sm leading-relaxed text-gray-700">{q.tip}</p>
        </div>
      )}
      {q.facts.length > 0 && (
        <details className="group rounded-lg border border-gray-200">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-gray-900 hover:bg-gray-50 [&::-webkit-details-marker]:hidden">
            <span>
              ข้อมูลประกอบการตัดสินใจ <span className="font-normal text-gray-500">{q.facts.length} ข้อ</span>
            </span>
            <span className="text-xs font-normal text-gray-500 underline underline-offset-4 group-open:hidden">แสดง</span>
            <span className="hidden text-xs font-normal text-gray-500 underline underline-offset-4 group-open:inline">ซ่อน</span>
          </summary>
          <ol className="space-y-4 border-t border-gray-100 px-4 py-4">
            {q.facts.map((f, i) => (
              <li key={f.text} className="flex gap-3">
                <span className="w-4 shrink-0 text-xs tabular-nums text-gray-400">{i + 1}.</span>
                <span className="min-w-0">
                  <span className="block text-sm leading-relaxed text-gray-800">{f.text}</span>
                  <span className="mt-1 block text-xs text-gray-500">ที่มา: {f.source}</span>
                </span>
              </li>
            ))}
          </ol>
        </details>
      )}
    </div>
  );
}

// ── คำถามแบบเลือกตอบ ───────────────────────────────────────────────────────────────
function QuestionStep({ q, plan, onPick }: { q: Question; plan: Plan; onPick: (id: string) => void }) {
  const chosen = plan.answers[q.key];
  return (
    <div>
      <StepHeading step={q.key} title={q.title} lead={q.why} />
      <div role="radiogroup" aria-label={q.title} className="mt-5 grid gap-2.5">
        {q.options.map((o) => {
          const active = chosen === o.id;
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onPick(o.id)}
              className={`flex w-full items-start gap-4 rounded-lg border px-4 py-3.5 text-left transition-[border-color,background-color,box-shadow] ${
                active
                  ? 'border-gray-900 bg-gray-50 shadow-[0_0_0_1px_#111827]'
                  : 'border-gray-200 bg-white hover:border-gray-400'
              }`}
            >
              {/* ปุ่มเลือกแบบวงกลม (ตัวควบคุมฟอร์ม ไม่ใช่ไอคอน) */}
              <span
                className={`mt-0.5 flex w-[18px] h-[18px] shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors ${
                  active ? 'border-gray-900' : 'border-gray-300'
                }`}
                aria-hidden="true"
              >
                {active && <span className="h-2 w-2 rounded-full bg-gray-900" />}
              </span>
              <span className="flex-1 min-w-0">
                <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                  <span className="text-[15px] font-medium text-gray-900">{o.label}</span>
                  {o.lighter && (
                    <span className="rounded border border-gray-300 px-1.5 py-px text-[11px] text-gray-700">ช่วยลดภาระ</span>
                  )}
                </span>
                <span className="mt-0.5 block text-[13px] leading-relaxed text-gray-500">{o.detail}</span>
              </span>
            </button>
          );
        })}
      </div>
      <Facts q={q} />
    </div>
  );
}

// ── งบประมาณ ──────────────────────────────────────────────────────────────────────
function MoneyInput({
  id,
  value,
  muted = false,
  onChange,
}: {
  id: string;
  value: number | undefined;
  muted?: boolean; // ยังเป็นค่าเริ่มต้น → ตัวเลขสีเทา
  onChange: (n: number | undefined) => void;
}) {
  return (
    <div className="flex h-10 items-center rounded-md border border-gray-300 bg-white transition-colors focus-within:border-gray-900 focus-within:ring-2 focus-within:ring-gray-200">
      <input
        id={id}
        type="text"
        inputMode="numeric"
        value={value ? value.toLocaleString('th-TH') : ''}
        onChange={(e) => {
          const digits = e.target.value.replace(/[^\d]/g, '').slice(0, 9);
          onChange(digits ? Number(digits) : undefined);
        }}
        placeholder="0"
        className={`h-full w-full min-w-0 bg-transparent px-3 text-right text-base sm:text-sm tabular-nums outline-none ${muted ? 'text-gray-500' : 'text-gray-900'}`}
      />
      <span className="pr-3 text-sm text-gray-500">บาท</span>
    </div>
  );
}

function BudgetStep({ plan, update }: { plan: Plan; update: ReturnType<typeof usePlan>['update'] }) {
  const b = planBudget(plan);
  // แก้เอง = เก็บค่าใน costs (ช่องว่าง = 0 ตั้งใจ) · ใช้ค่าเริ่มต้น = ลบค่าออกจาก costs
  const setCost = (id: string, n: number | undefined) => update((p) => ({ costs: { ...p.costs, [id]: n ?? 0 } }));
  const resetCost = (id: string) =>
    update((p) => {
      const costs = { ...p.costs };
      delete costs[id];
      return { costs };
    });

  return (
    <div>
      <StepHeading
        step="budget"
        title="ประมาณงบประมาณ"
        lead={
          <>
            ใส่ตัวเลขเริ่มต้นให้แล้วตามที่เลือก แก้ได้ทุกช่องตามราคาที่ได้จากวัดหรือร้านในพื้นที่
            <span className="mt-2 block text-xs text-gray-500">
              <span className="text-gray-400">*</span> {DEFAULT_COST_NOTE}
            </span>
            <span className="mt-1 block text-xs text-gray-500">
              จัดงาน {b.days === 1 ? 'วันเดียว' : `${b.days} วัน`} — รายการที่คิด &ldquo;ต่อวัน&rdquo; ระบบคูณจำนวนวันให้
            </span>
          </>
        }
      />

      <table className="mt-2 w-full text-left">
        <caption className="sr-only">รายการค่าใช้จ่าย</caption>
        <thead>
          <tr className="border-b border-gray-200 text-xs text-gray-500">
            <th scope="col" className="py-2.5 font-medium">รายการ</th>
            <th scope="col" className="w-40 py-2.5 text-right font-medium">จำนวนเงิน</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {b.lines.map((l) => (
            <tr key={l.id} className="align-top">
              <td className="py-3 pr-3">
                <label htmlFor={`cost-${l.id}`} className="block">
                  <span className="block text-sm font-medium text-gray-900">{l.label}</span>
                  <span className="block text-xs text-gray-500">
                    {l.hint}
                    {l.perDay && l.amount > 0 && b.days > 1 && <> · รวม {baht(l.total)}</>}
                  </span>
                  {l.isDefault && <span className="mt-0.5 block text-[11px] text-gray-500">* ค่าเริ่มต้น</span>}
                </label>
              </td>
              <td className="w-40 py-3">
                <MoneyInput id={`cost-${l.id}`} value={l.amount} muted={l.isDefault} onChange={(n) => setCost(l.id, n)} />
                {l.custom && l.fallback != null && l.fallback !== l.amount && (
                  <button
                    type="button"
                    onClick={() => resetCost(l.id)}
                    className="mt-1 block w-full text-right text-[11px] text-gray-500 underline underline-offset-2 hover:text-gray-900"
                  >
                    ใช้ค่าเริ่มต้น {l.fallback.toLocaleString('th-TH')}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-2 border-t-2 border-gray-900 pt-4 space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm font-medium text-gray-900">รวมค่าใช้จ่ายโดยประมาณ</span>
          <span className="text-xl font-semibold tabular-nums text-gray-900">{baht(b.total)}</span>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr),10rem] items-center gap-3 border-t border-gray-100 pt-3">
          <label htmlFor="cost-support">
            <span className="block text-sm font-medium text-gray-900">เงินช่วยงานที่คาดว่าจะได้รับ</span>
            <span className="block text-xs text-gray-500">ไม่ใส่ก็ได้</span>
          </label>
          <MoneyInput id="cost-support" value={plan.support ?? undefined} onChange={(n) => update({ support: n ?? null })} />
        </div>
        {b.net != null && (
          <div className="flex items-baseline justify-between gap-3 border-t border-gray-100 pt-3">
            <span className="text-sm text-gray-700">{b.net > 0 ? 'ครอบครัวต้องออกเพิ่ม' : 'เหลือหลังหักค่าใช้จ่าย'}</span>
            <span className="text-base font-semibold tabular-nums text-gray-900">{baht(Math.abs(b.net))}</span>
          </div>
        )}
      </div>

      {(b.savedIfOneDay > 0 || b.alcohol > 0) && (
        <section aria-label="ส่วนที่ปรับได้" className="mt-6 rounded-lg bg-gray-50 px-4 py-4 space-y-1.5">
          <p className="text-xs font-semibold text-gray-900">คำนวณจากตัวเลขในแผนนี้</p>
          {b.savedIfOneDay > 0 && (
            <p className="text-sm text-gray-800">
              ถ้าจัดวันเดียว รายการที่คิดต่อวันจะลดลง <strong className="tabular-nums">{baht(b.savedIfOneDay)}</strong>
            </p>
          )}
          {b.alcohol > 0 && (
            <p className="text-sm text-gray-800">
              ถ้าไม่เลี้ยงเหล้าเบียร์ จะลดลง <strong className="tabular-nums">{baht(b.alcohol)}</strong>
            </p>
          )}
        </section>
      )}
    </div>
  );
}

const BTN_PRIMARY =
  'inline-flex h-11 items-center rounded-md bg-gray-900 px-6 text-sm font-medium text-white transition-colors hover:bg-gray-700';
const BTN_SECONDARY =
  'inline-flex h-11 items-center rounded-md border border-gray-300 bg-white px-5 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-50';

// ── ตัวหลัก ────────────────────────────────────────────────────────────────────────
export default function PlanWizard() {
  const { plan, update } = usePlan();
  const [step, setStep] = useState<Step>('start');
  const [sheet, setSheet] = useState(false); // ใบสรุปแบบแผ่นล่าง (มือถือ)
  const topRef = useRef<HTMLDivElement>(null);
  const index = STEPS.indexOf(step);

  // เปลี่ยนขั้น → กลับบนสุด (หัวข้อหน้ามีแค่ขั้นแรก การ์ดจึงอยู่บนสุด) คำถาม ตัวเลือก และปุ่มถัดไปอยู่ในจอโดยไม่ต้องเลื่อน
  // (ผู้ใช้ขอ 3 ต.ค. 2026) · ข้ามรอบแรกที่เปิดหน้า · โฟกัสหัวข้อขั้นใหม่ให้โปรแกรมอ่านหน้าจออ่านต่อจากตรงนั้น
  const firstRender = useRef(true);
  const autoNext = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (autoNext.current) clearTimeout(autoNext.current);
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    window.scrollTo({ top: 0 });
    topRef.current?.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true });
  }, [step]);
  useEffect(() => () => {
    if (autoNext.current) clearTimeout(autoNext.current);
  }, []);

  // แผ่นใบสรุป: Esc ปิด + ล็อกการเลื่อนหน้าด้านหลัง
  useEffect(() => {
    if (!sheet) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setSheet(false);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [sheet]);

  if (!plan) {
    return <div className="min-h-[60vh]" aria-busy="true" />;
  }

  const goTo = (s: Step) => {
    if (index === 0 && STEPS.indexOf(s) > 0) trackOncePerTab('plan-start', 'PLAN_START', { province: plan.area?.province });
    setStep(s);
  };
  const go = (d: number) => goTo(STEPS[Math.min(STEPS.length - 1, Math.max(0, index + d))]);
  const q = QUESTIONS.find((x) => x.key === step);
  const isLast = step === 'budget';
  const b = planBudget(plan);
  const answered = QUESTIONS.filter((x) => plan.answers[x.key]).length;
  const nextLabel = q && !plan.answers[q.key] ? 'ข้ามข้อนี้' : 'ถัดไป';

  const nav = (
    <div className="flex items-center gap-2.5">
      {index > 0 && (
        <button type="button" onClick={() => go(-1)} className={BTN_SECONDARY}>
          ย้อนกลับ
        </button>
      )}
      {isLast ? (
        <Link href="/farewell/plan/summary" className={`ml-auto ${BTN_PRIMARY}`}>
          ดูสรุปแผน
        </Link>
      ) : (
        <button type="button" onClick={() => go(1)} className={`ml-auto ${nextLabel === 'ถัดไป' ? BTN_PRIMARY : BTN_SECONDARY}`}>
          {nextLabel}
        </button>
      )}
    </div>
  );

  return (
    <>
    {step === 'start' ? (
      // หัวหน้าจัดกลาง (ผู้ใช้ขอ 3 ต.ค. 2026 — กระชับ) · เส้นคั่นใต้หัวเรื่องแบบเอกสารทางการ
      <header className="mx-auto mt-2 mb-8 max-w-2xl text-center">
        <p className="text-sm text-gray-500">ส่งด้วยใจ — แบบวางแผนงานศพสำหรับครอบครัว</p>
        <h1 className="mt-2 text-2xl sm:text-3xl font-semibold leading-tight text-gray-900">ทุกการเตรียมพร้อม คือความใส่ใจ</h1>
        <div className="mx-auto mt-4 h-px w-16 bg-gray-900" aria-hidden="true" />
        <p className="mt-4 text-[15px] leading-relaxed text-gray-600">
          ตัดสินใจทีละเรื่อง {STEPS.length} ขั้นตอน ข้ามได้ทุกข้อ ตัวเลขในใบสรุปแก้ได้ภายหลัง
        </p>
      </header>
    ) : (
      <h1 className="sr-only">วางแผนงานศพ</h1>
    )}
    {/* ไม่ใส่ overflow-hidden ที่กรอบนี้ — จะทำให้ sticky ข้างใน (ใบสรุป/ปุ่มถัดไป) ติดกับกรอบแทนหน้าจอ · มุมโค้งใส่ที่แผงเทาแทน */}
    <section
      aria-label="วางแผนงานศพ"
      className="mt-2 grid rounded-xl border border-gray-200 bg-white lg:grid-cols-[200px,minmax(0,1fr),300px]"
    >
      {/* รายการขั้นตอน (จอใหญ่) */}
      <div className="hidden border-r border-gray-100 p-4 lg:block">
        <StepList plan={plan} step={step} onGo={goTo} />
      </div>

      <div ref={topRef} className="min-w-0 p-5 sm:p-8 sm:pb-0">
        <StepBar plan={plan} step={step} onGo={goTo} />

        {step === 'start' && (
          <div>
            <StepHeading
              step="start"
              title="เริ่มจากเรื่องที่รู้แล้ว"
              lead="ทั้งสองข้อไม่บังคับ ชื่อใช้แสดงบนใบสรุปและป้ายหน้างาน ส่วนตำบลใช้ค้นว่าชุมชนของคุณมีข้อตกลงงานศพปลอดเหล้าอยู่แล้วหรือไม่"
            />

            <label htmlFor="deceased" className="mt-6 block text-sm font-medium text-gray-900">
              ชื่อผู้วายชนม์ <span className="text-xs font-normal text-gray-400">(ไม่บังคับ)</span>
            </label>
            <input
              id="deceased"
              type="text"
              value={plan.deceasedName}
              onChange={(e) => update({ deceasedName: e.target.value.slice(0, 120) })}
              placeholder="เช่น คุณแม่สมศรี ใจดี"
              className="mt-2 h-11 w-full rounded-md border border-gray-300 px-3 text-base sm:text-sm outline-none transition-colors focus:border-gray-900 focus:ring-2 focus:ring-gray-200"
            />

            <p className="mt-6 text-sm font-medium text-gray-900">
              ตำบลที่จะจัดงาน <span className="text-xs font-normal text-gray-400">(ไม่บังคับ)</span>
            </p>
            <div className="mt-2">
              <AreaPicker plain value={plan.area} onChange={(area) => update({ area })} />
              {plan.area && <AgreementList plain brief area={plan.area} onDetails={() => goTo('alcohol')} />}
            </div>
          </div>
        )}

        {q && (
          <>
            <QuestionStep
              q={q}
              plan={plan}
              onPick={(id) => {
                update((p) => ({ answers: { ...p.answers, [q.key]: id } }));
                // เลือกแล้วไปข้อถัดไปเอง (เห็นตัวเลือกที่กดก่อนแวบหนึ่ง) — ยกเว้นขั้นเหล้า
                // ที่มีข้อตกลงในพื้นที่และลิงก์ทำป้ายให้อ่านต่อด้านล่าง
                if (q.key === 'alcohol') return;
                if (autoNext.current) clearTimeout(autoNext.current);
                autoNext.current = setTimeout(() => go(1), 380);
              }}
            />
            {q.key === 'alcohol' && (
              <section aria-label="ข้อตกลงในพื้นที่" className="mt-8 border-t border-gray-100 pt-6">
                <h3 className="text-base font-semibold text-gray-900">ข้อตกลงในพื้นที่ของคุณ</h3>
                <div className="mt-3">
                  {plan.area ? (
                    <AgreementList plain area={plan.area} />
                  ) : (
                    <div className="space-y-2">
                      <p className="text-sm text-gray-600">เลือกตำบลเพื่อดูว่าชุมชนของคุณมีข้อตกลงงานศพปลอดเหล้าแล้วหรือไม่</p>
                      <AreaPicker plain value={null} onChange={(area) => update({ area })} />
                    </div>
                  )}
                </div>
                {plan.answers.alcohol === 'none' && (
                  <Link href="/farewell/signs" className={`mt-5 ${BTN_SECONDARY}`}>
                    ทำป้ายหน้างาน &ldquo;ไม่เลี้ยงเหล้า&rdquo;
                  </Link>
                )}
              </section>
            )}
          </>
        )}

        {step === 'budget' && <BudgetStep plan={plan} update={update} />}

        {/* ปุ่มเดินหน้า/ย้อนกลับ — จอใหญ่อยู่ท้ายการ์ด · มือถือติดล่างจอพร้อมยอดรวม */}
        <div className="sticky bottom-0 z-10 -mx-5 mt-8 hidden border-t border-gray-100 bg-white/95 px-5 py-4 backdrop-blur sm:-mx-8 sm:block sm:px-8">
          {nav}
        </div>
      </div>

      {/* ใบสรุป (จอใหญ่) */}
      <aside className="hidden rounded-r-xl border-l border-gray-100 bg-gray-50 p-5 lg:block" aria-label="ใบสรุปของครอบครัว">
        <div className="lg:sticky lg:top-24">
          <div className="mb-3 flex items-baseline justify-between text-xs text-gray-500">
            <span className="font-medium text-gray-900">ใบสรุปของครอบครัว</span>
            <span>กดแต่ละแถวเพื่อแก้</span>
          </div>
          <Receipt plan={plan} current={step} onJump={(k) => goTo(k)} />
          <p className="mt-4 text-center text-xs leading-relaxed text-gray-500">
            ครบแล้วกด &ldquo;ดูสรุปแผน&rdquo; เพื่อบันทึกเป็นรูป พิมพ์ หรือส่งให้ญาติ
          </p>
        </div>
      </aside>

      {/* มือถือ: แถบล่าง = ความคืบหน้า + ยอดรวม + ปุ่ม */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2.5 backdrop-blur sm:hidden">
        <button
          type="button"
          onClick={() => setSheet(true)}
          className="mb-2.5 flex w-full items-center justify-between gap-3 rounded-md border border-gray-200 px-3 py-2 text-left"
        >
          <span className="text-[13px] text-gray-800">
            <span className="font-medium">ใบสรุป</span> · เลือกแล้ว {answered}/{QUESTIONS.length} เรื่อง
          </span>
          <span className="text-sm tabular-nums text-gray-900 underline underline-offset-2">{b.filled ? baht(b.total) : 'เปิดดู'}</span>
        </button>
        {nav}
      </div>

      {/* แท็บเล็ต (sm–lg): ใบสรุปใต้ฟอร์ม */}
      <div className="hidden rounded-b-xl border-t border-gray-100 bg-gray-50 p-5 sm:block lg:hidden">
        <p className="mb-3 text-xs font-medium text-gray-900">ใบสรุปของครอบครัว</p>
        <Receipt plan={plan} current={step} onJump={(k) => goTo(k)} />
      </div>

      {sheet && (
        <div className="fixed inset-0 z-50 sm:hidden" role="dialog" aria-modal="true" aria-label="ใบสรุปของครอบครัว">
          <button type="button" aria-label="ปิดใบสรุป" className="absolute inset-0 bg-black/40" onClick={() => setSheet(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-xl bg-white px-4 pb-6 pt-3">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-900">ใบสรุปของครอบครัว</span>
              <button
                type="button"
                onClick={() => setSheet(false)}
                className="min-h-10 rounded-md px-3 text-sm text-gray-600 underline underline-offset-2 hover:bg-gray-100"
              >
                ปิด
              </button>
            </div>
            <Receipt
              plan={plan}
              current={step}
              onJump={(k) => {
                setSheet(false);
                goTo(k);
              }}
            />
          </div>
        </div>
      )}
    </section>
    <div className="h-36 sm:hidden" aria-hidden="true" />
    </>
  );
}
