'use client';
// app/farewell/plan/PlanWizard.tsx — วางแผนงานศพทีละขั้น
// ทุกข้อข้ามได้ บันทึกอัตโนมัติในเครื่องทุกครั้งที่เลือก (planStore) กลับมาทำต่อได้
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Check, Feather, Info, Lightbulb, ShieldCheck } from 'lucide-react';
import { QUESTIONS, type Question } from '../content';
import { baht, planBudget, usePlan, type Plan } from '../planStore';
import AreaPicker from '../components/AreaPicker';
import AgreementList from '../components/AgreementList';
import { trackOncePerTab } from '../track';

const STEPS = ['start', ...QUESTIONS.map((q) => q.key), 'budget'] as const;
type Step = (typeof STEPS)[number];

function Facts({ q }: { q: Question }) {
  if (q.facts.length === 0 && !q.tip) return null;
  return (
    <div className="mt-6 space-y-3">
      {q.facts.length > 0 && (
        <section aria-label="ข้อมูลประกอบการตัดสินใจ" className="rounded-2xl bg-orange-50 border border-orange-100 p-4 sm:p-5">
          <p className="flex items-center gap-2 text-xs font-semibold text-orange-800">
            <Info className="w-4 h-4" /> ข้อมูลประกอบการตัดสินใจ
          </p>
          <ul className="mt-3 space-y-3">
            {q.facts.map((f) => (
              <li key={f.text}>
                <p className="text-sm leading-relaxed text-gray-800">{f.text}</p>
                <p className="mt-0.5 text-[11px] text-gray-500">ที่มา: {f.source}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
      {q.tip && (
        <p className="flex items-start gap-2 rounded-2xl border border-gray-200 p-4 text-sm text-gray-700">
          <Lightbulb className="w-4 h-4 mt-0.5 shrink-0 text-orange-600" />
          {q.tip}
        </p>
      )}
    </div>
  );
}

function QuestionStep({ q, plan, onPick }: { q: Question; plan: Plan; onPick: (id: string) => void }) {
  const chosen = plan.answers[q.key];
  return (
    <div>
      <h2 tabIndex={-1} className="text-xl sm:text-2xl font-bold text-gray-900 outline-none">{q.title}</h2>
      <p className="mt-2 text-sm sm:text-base leading-relaxed text-gray-600">{q.why}</p>
      <div role="radiogroup" aria-label={q.title} className="mt-5 space-y-2.5">
        {q.options.map((o) => {
          const active = chosen === o.id;
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onPick(o.id)}
              className={`w-full flex items-start gap-3 text-left rounded-2xl border px-4 py-3.5 transition-colors ${
                active ? 'border-orange-600 bg-orange-50' : 'border-gray-200 bg-white hover:border-orange-300'
              }`}
            >
              <span
                className={`mt-0.5 flex w-5 h-5 shrink-0 items-center justify-center rounded-full border ${
                  active ? 'border-orange-600 bg-orange-600 text-white' : 'border-gray-300'
                }`}
              >
                {active && <Check className="w-3.5 h-3.5" />}
              </span>
              <span className="flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-base font-medium text-gray-900">{o.label}</span>
                  {o.lighter && (
                    <span className="rounded-full bg-white border border-orange-200 px-2 py-0.5 text-[11px] text-orange-700">
                      ช่วยลดภาระ
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block text-sm text-gray-600">{o.detail}</span>
              </span>
            </button>
          );
        })}
      </div>
      <Facts q={q} />
    </div>
  );
}

function MoneyInput({ id, value, onChange }: { id: string; value: number | undefined; onChange: (n: number | undefined) => void }) {
  return (
    <div className="flex items-center rounded-xl border border-gray-300 bg-white focus-within:border-orange-500 focus-within:ring-2 focus-within:ring-orange-100">
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
        className="w-full h-11 bg-transparent px-3 text-right text-base outline-none"
      />
      <span className="pr-3 text-sm text-gray-500">บาท</span>
    </div>
  );
}

function BudgetStep({ plan, update }: { plan: Plan; update: ReturnType<typeof usePlan>['update'] }) {
  const b = planBudget(plan);
  const setCost = (id: string, n: number | undefined) =>
    update((p) => {
      const costs = { ...p.costs };
      if (n) costs[id] = n;
      else delete costs[id];
      return { costs };
    });

  return (
    <div>
      <h2 tabIndex={-1} className="text-xl sm:text-2xl font-bold text-gray-900 outline-none">ประมาณงบประมาณ</h2>
      <p className="mt-2 text-sm sm:text-base leading-relaxed text-gray-600">
        ใส่ราคาที่ได้จากวัดหรือร้านในพื้นที่ ไม่รู้ข้อไหนเว้นไว้ก่อนได้ ระบบไม่มีราคาตั้งต้นให้ เพราะราคาแต่ละพื้นที่ต่างกันมาก
      </p>
      <p className="mt-3 inline-flex rounded-full bg-orange-50 px-3 py-1 text-xs text-orange-800">
        จัดงาน {b.days === 1 ? 'วันเดียว' : `${b.days} วัน`} · รายการ “ต่อวัน” จะคูณจำนวนวันให้
      </p>

      <ul className="mt-5 space-y-3">
        {b.lines.map((l) => (
          <li key={l.id} className="grid grid-cols-[1fr,minmax(0,9.5rem)] items-center gap-3">
            <label htmlFor={`cost-${l.id}`}>
              <span className="block text-sm font-medium text-gray-900">{l.label}</span>
              <span className="block text-xs text-gray-500">
                {l.hint}
                {l.perDay && l.amount > 0 && b.days > 1 && <> · รวม {baht(l.total)}</>}
              </span>
            </label>
            <MoneyInput id={`cost-${l.id}`} value={plan.costs[l.id]} onChange={(n) => setCost(l.id, n)} />
          </li>
        ))}
      </ul>

      <div className="mt-6 rounded-2xl border border-gray-200 p-4 sm:p-5 space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm text-gray-600">รวมค่าใช้จ่ายโดยประมาณ</span>
          <span className="text-2xl font-bold text-gray-900">{baht(b.total)}</span>
        </div>
        <div className="grid grid-cols-[1fr,minmax(0,9.5rem)] items-center gap-3 border-t border-gray-100 pt-3">
          <label htmlFor="cost-support">
            <span className="block text-sm font-medium text-gray-900">เงินช่วยงานที่คาดว่าจะได้รับ</span>
            <span className="block text-xs text-gray-500">ไม่ใส่ก็ได้</span>
          </label>
          <MoneyInput
            id="cost-support"
            value={plan.support ?? undefined}
            onChange={(n) => update({ support: n ?? null })}
          />
        </div>
        {b.net != null && (
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm text-gray-600">{b.net > 0 ? 'ครอบครัวต้องออกเพิ่ม' : 'เหลือหลังหักค่าใช้จ่าย'}</span>
            <span className="text-lg font-semibold text-gray-900">{baht(Math.abs(b.net))}</span>
          </div>
        )}
      </div>

      {(b.savedIfOneDay > 0 || b.alcohol > 0) && (
        <section aria-label="ส่วนที่ปรับได้" className="mt-4 rounded-2xl bg-orange-50 border border-orange-100 p-4 sm:p-5 space-y-2">
          <p className="text-xs font-semibold text-orange-800">จากตัวเลขของคุณเอง</p>
          {b.savedIfOneDay > 0 && (
            <p className="text-sm text-gray-800">
              ถ้าจัดวันเดียว รายการที่คิดต่อวันจะลดลง <strong>{baht(b.savedIfOneDay)}</strong>
            </p>
          )}
          {b.alcohol > 0 && (
            <p className="text-sm text-gray-800">
              ถ้าไม่เลี้ยงเหล้าเบียร์ จะลดลง <strong>{baht(b.alcohol)}</strong>
            </p>
          )}
        </section>
      )}
    </div>
  );
}

export default function PlanWizard() {
  const { plan, update } = usePlan();
  const [step, setStep] = useState<Step>('start');
  const topRef = useRef<HTMLDivElement>(null);
  const index = STEPS.indexOf(step);

  // เปลี่ยนขั้น → กลับไปบนสุดของหน้า (เดิม scrollIntoView แถบความคืบหน้า หัวข้อ "วางแผนงานศพ" ด้านบนจึงโดน Navbar ลอยบัง)
  // ข้ามรอบแรกที่เปิดหน้า · โฟกัสหัวข้อขั้นใหม่ให้โปรแกรมอ่านหน้าจออ่านต่อจากตรงนั้น
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    window.scrollTo({ top: 0 });
    topRef.current?.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true });
  }, [step]);

  if (!plan) {
    return <div className="min-h-[60vh]" aria-busy="true" />;
  }

  const go = (d: number) => {
    if (index === 0 && d > 0 && plan) trackOncePerTab('plan-start', 'PLAN_START', { province: plan.area?.province });
    setStep(STEPS[Math.min(STEPS.length - 1, Math.max(0, index + d))]);
  };
  const q = QUESTIONS.find((x) => x.key === step);
  const isLast = step === 'budget';

  return (
    <div ref={topRef} className="scroll-mt-20">
      {/* ความคืบหน้า */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>
          ขั้นที่ {index + 1} จาก {STEPS.length}
        </span>
        <span className="inline-flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-orange-600" /> บันทึกในเครื่องนี้อัตโนมัติ
        </span>
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-orange-100" aria-hidden="true">
        <div className="h-full rounded-full bg-orange-600 transition-[width] duration-300" style={{ width: `${((index + 1) / STEPS.length) * 100}%` }} />
      </div>

      <div className="mt-8">
        {step === 'start' && (
          <div>
            <span className="flex w-12 h-12 rounded-2xl bg-orange-50 border border-orange-100 items-center justify-center">
              <Feather className="w-6 h-6 text-orange-600" />
            </span>
            <h2 className="mt-4 text-xl sm:text-2xl font-bold text-gray-900">เริ่มจากเรื่องที่รู้แล้ว</h2>
            <p className="mt-2 text-sm sm:text-base leading-relaxed text-gray-600">
              ทั้งสองข้อไม่บังคับ ชื่อใช้แสดงบนแผนที่พิมพ์ส่งญาติและบนป้ายหน้างาน ส่วนตำบลใช้ค้นว่าชุมชนของคุณมีข้อตกลงงานศพปลอดเหล้าอยู่แล้วหรือไม่
            </p>

            <label htmlFor="deceased" className="mt-6 block text-sm font-medium text-gray-900">
              ชื่อผู้วายชนม์
            </label>
            <input
              id="deceased"
              type="text"
              value={plan.deceasedName}
              onChange={(e) => update({ deceasedName: e.target.value.slice(0, 120) })}
              placeholder="เช่น คุณแม่สมศรี ใจดี"
              className="mt-2 w-full h-12 rounded-2xl border border-gray-300 px-4 text-base outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
            />

            <p className="mt-6 text-sm font-medium text-gray-900">ตำบลที่จะจัดงาน</p>
            <div className="mt-2">
              <AreaPicker value={plan.area} onChange={(area) => update({ area })} />
            </div>
          </div>
        )}

        {q && (
          <>
            <QuestionStep
              q={q}
              plan={plan}
              onPick={(id) => update((p) => ({ answers: { ...p.answers, [q.key]: id } }))}
            />
            {q.key === 'alcohol' && (
              <section aria-label="ข้อตกลงในพื้นที่" className="mt-6">
                <h3 className="text-sm font-semibold text-gray-900">ข้อตกลงในพื้นที่ของคุณ</h3>
                <div className="mt-3">
                  {plan.area ? (
                    <AgreementList area={plan.area} />
                  ) : (
                    <div className="space-y-2">
                      <p className="text-sm text-gray-600">เลือกตำบลเพื่อดูว่าชุมชนของคุณมีข้อตกลงงานศพปลอดเหล้าแล้วหรือไม่</p>
                      <AreaPicker value={null} onChange={(area) => update({ area })} />
                    </div>
                  )}
                </div>
                {plan.answers.alcohol === 'none' && (
                  <Link
                    href="/farewell/signs"
                    className="mt-4 inline-flex items-center gap-2 min-h-11 px-4 rounded-full border border-orange-200 text-sm font-medium text-orange-700 hover:bg-orange-50"
                  >
                    ทำป้ายหน้างาน “ไม่เลี้ยงเหล้า” <ArrowRight className="w-4 h-4" />
                  </Link>
                )}
              </section>
            )}
          </>
        )}

        {step === 'budget' && <BudgetStep plan={plan} update={update} />}
      </div>

      {/* ปุ่มเดินหน้า/ย้อนกลับ ติดล่างจอบนมือถือ */}
      <div className="sticky bottom-0 -mx-4 mt-10 border-t border-gray-100 bg-white/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:backdrop-blur-none">
        <div className="flex items-center gap-3">
          {index > 0 && (
            <button
              type="button"
              onClick={() => go(-1)}
              className="inline-flex items-center gap-1.5 min-h-12 px-4 rounded-full border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <ArrowLeft className="w-4 h-4" /> ย้อนกลับ
            </button>
          )}
          {isLast ? (
            <Link
              href="/farewell/plan/summary"
              className="ml-auto inline-flex items-center gap-1.5 min-h-12 px-5 rounded-full bg-orange-600 text-sm font-semibold text-white hover:bg-orange-700"
            >
              ดูสรุปแผน <ArrowRight className="w-4 h-4" />
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => go(1)}
              className="ml-auto inline-flex items-center gap-1.5 min-h-12 px-5 rounded-full bg-orange-600 text-sm font-semibold text-white hover:bg-orange-700"
            >
              {q && !plan.answers[q.key] ? 'ข้ามข้อนี้' : 'ถัดไป'} <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
