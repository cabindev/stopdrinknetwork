'use client';
// app/farewell/plan/summary/PlanSummary.tsx — สรุปแผนงานศพ พิมพ์/ส่งให้ญาติได้
// ส่งต่อด้วย Web Share (มือถือ) หรือคัดลอกข้อความ/LINE — ข้อมูลออกจากเครื่องเมื่อผู้ใช้กดส่งเองเท่านั้น
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, ClipboardCopy, Pencil, Printer, Share2, Trash2 } from 'lucide-react';
import { QUESTIONS, buildChecklist } from '../../content';
import { baht, planBudget, usePlan, type Plan } from '../../planStore';
import { areaText } from '../../components/AreaPicker';
import { track } from '../../track';

// ส่ง PLAN_COMPLETE แล้ว (ต่อแผน — ล้างตอนผู้ใช้กดลบแผน จะได้นับแผนใหม่)
const COMPLETE_KEY = 'sdn-farewell-complete-sent';

function summaryText(plan: Plan) {
  const b = planBudget(plan);
  const lines = [
    `แผนงานศพ${plan.deceasedName ? ` ${plan.deceasedName}` : ''}`,
    ...(plan.area ? [`พื้นที่: ${areaText(plan.area)}`] : []),
    '',
    ...QUESTIONS.flatMap((q) => {
      const o = q.options.find((x) => x.id === plan.answers[q.key]);
      return o ? [`• ${q.title}: ${o.label}`] : [];
    }),
  ];
  if (b.filled) {
    lines.push('', 'งบประมาณโดยประมาณ');
    for (const l of b.lines) if (l.total > 0) lines.push(`• ${l.label}: ${baht(l.total)}`);
    lines.push(`รวม ${baht(b.total)}`);
  }
  lines.push('', 'ทำแผนด้วย “ส่งด้วยใจ” เครือข่ายงดเหล้า');
  return lines.join('\n');
}

export default function PlanSummary() {
  const { plan, update, reset } = usePlan();
  const [copied, setCopied] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  // สถิติไม่ระบุตัวตน: จังหวัด + รหัสตัวเลือก (ไม่ส่งชื่อ/ตำบล/ราคา) — ครั้งเดียวต่อแผน
  useEffect(() => {
    if (!plan || Object.keys(plan.answers).length === 0) return;
    try {
      if (localStorage.getItem(COMPLETE_KEY)) return;
      localStorage.setItem(COMPLETE_KEY, '1');
    } catch {
      return; // storage ปิด → ไม่ส่ง กันนับซ้ำทุกครั้งที่เปิด
    }
    track('PLAN_COMPLETE', { province: plan.area?.province, answers: plan.answers as Record<string, string> });
  }, [plan]);

  if (!plan) return <div className="min-h-[60vh]" aria-busy="true" />;

  const answered = QUESTIONS.filter((q) => plan.answers[q.key]);
  if (answered.length === 0 && !plan.deceasedName && !plan.area) {
    return (
      <div className="rounded-2xl border border-orange-100 bg-orange-50 p-6 text-center">
        <p className="text-base text-gray-800">ยังไม่มีแผนที่บันทึกไว้ในเครื่องนี้</p>
        <Link
          href="/farewell/plan"
          className="mt-4 inline-flex items-center gap-2 min-h-12 px-5 rounded-full bg-orange-600 text-sm font-semibold text-white hover:bg-orange-700"
        >
          เริ่มวางแผน
        </Link>
      </div>
    );
  }

  const b = planBudget(plan);
  const checklist = buildChecklist(plan.answers);
  const text = summaryText(plan);

  const share = async () => {
    track('SHARE');
    if (navigator.share) {
      try {
        await navigator.share({ title: 'แผนงานศพ', text });
        return;
      } catch {
        // ผู้ใช้กดยกเลิก — ไม่ต้องทำอะไร
        return;
      }
    }
    await copy();
  };
  const copy = async () => {
    track('COPY');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  const btn =
    'inline-flex items-center justify-center gap-2 min-h-12 px-4 rounded-full border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50';

  return (
    <div>
      {/* ส่วนพิมพ์ */}
      <article className="rounded-2xl border border-orange-100 p-5 sm:p-7 print:border-0 print:p-0">
        <p className="text-xs font-medium text-orange-700">แผนงานศพ</p>
        <h2 className="mt-1 text-2xl font-bold text-gray-900">{plan.deceasedName || 'ของครอบครัว'}</h2>
        {plan.area && <p className="mt-1 text-sm text-gray-600">{areaText(plan.area)}</p>}

        <dl className="mt-6 divide-y divide-gray-100 border-y border-gray-100">
          {QUESTIONS.map((q) => {
            const o = q.options.find((x) => x.id === plan.answers[q.key]);
            return (
              <div key={q.key} className="grid grid-cols-[8rem,1fr] sm:grid-cols-[11rem,1fr] gap-3 py-3">
                <dt className="text-sm text-gray-500">{q.title}</dt>
                <dd className="text-sm text-gray-900">{o ? o.label : <span className="text-gray-400">ยังไม่ได้เลือก</span>}</dd>
              </div>
            );
          })}
        </dl>

        {b.filled && (
          <section className="mt-6">
            <h3 className="text-sm font-semibold text-gray-900">งบประมาณโดยประมาณ (จากราคาที่ครอบครัวกรอก)</h3>
            <table className="mt-3 w-full text-sm">
              <tbody>
                {b.lines
                  .filter((l) => l.total > 0)
                  .map((l) => (
                    <tr key={l.id} className="border-b border-gray-100">
                      <td className="py-2 text-gray-700">
                        {l.label}
                        {l.perDay && b.days > 1 && (
                          <span className="text-xs text-gray-500"> ({baht(l.amount)} × {b.days} วัน)</span>
                        )}
                      </td>
                      <td className="py-2 text-right text-gray-900">{baht(l.total)}</td>
                    </tr>
                  ))}
                <tr>
                  <td className="pt-3 font-semibold text-gray-900">รวม</td>
                  <td className="pt-3 text-right text-lg font-bold text-gray-900">{baht(b.total)}</td>
                </tr>
                {b.net != null && (
                  <tr>
                    <td className="pt-1 text-gray-600">{b.net > 0 ? 'หักเงินช่วยงานแล้ว ครอบครัวออกเพิ่ม' : 'หักเงินช่วยงานแล้ว เหลือ'}</td>
                    <td className="pt-1 text-right text-gray-900">{baht(Math.abs(b.net))}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        )}

        <section className="mt-6">
          <h3 className="text-sm font-semibold text-gray-900">สิ่งที่ต้องทำ</h3>
          <ul className="mt-3 space-y-1">
            {checklist.map((c) => {
              const done = !!plan.done[c.id];
              return (
                <li key={c.id}>
                  <label className="flex items-start gap-3 rounded-xl px-2 py-2 hover:bg-orange-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={done}
                      onChange={() => update((p) => ({ done: { ...p.done, [c.id]: !done } }))}
                      className="mt-1 h-5 w-5 shrink-0 accent-orange-600"
                    />
                    <span className={`text-sm leading-relaxed ${done ? 'text-gray-400 line-through' : 'text-gray-800'}`}>{c.text}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </section>
      </article>

      {/* ปุ่ม (ไม่พิมพ์) */}
      <div className="mt-6 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap print:hidden">
        <button
          type="button"
          onClick={() => {
            track('PRINT');
            window.print();
          }}
          className={btn}
        >
          <Printer className="w-4 h-4" /> พิมพ์
        </button>
        <button type="button" onClick={share} className={btn}>
          <Share2 className="w-4 h-4" /> ส่งให้ญาติ
        </button>
        <a
          href={`https://line.me/R/share?text=${encodeURIComponent(text)}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => track('LINE')}
          className={btn}
        >
          ส่งทาง LINE
        </a>
        <button type="button" onClick={copy} className={btn}>
          {copied ? <Check className="w-4 h-4 text-orange-600" /> : <ClipboardCopy className="w-4 h-4" />}
          {copied ? 'คัดลอกแล้ว' : 'คัดลอกข้อความ'}
        </button>
        <Link href="/farewell/plan" className={btn}>
          <Pencil className="w-4 h-4" /> แก้ไขแผน
        </Link>
      </div>

      <div className="mt-10 border-t border-gray-100 pt-6 print:hidden">
        <p className="text-xs text-gray-500">ชื่อ ตำบล และตัวเลขในแผนนี้อยู่ในเครื่องนี้เท่านั้น เราเก็บแค่สถิติรวมแบบไม่ระบุตัวตน (จังหวัดและตัวเลือกที่เลือก)</p>
        {confirmClear ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-700">ลบแผนทั้งหมดออกจากเครื่องนี้?</span>
            <button
              type="button"
              onClick={() => {
                reset();
                try {
                  localStorage.removeItem(COMPLETE_KEY);
                } catch {
                  /* ไม่เป็นไร */
                }
                setConfirmClear(false);
              }}
              className="inline-flex items-center gap-1.5 min-h-10 px-4 rounded-full bg-gray-900 text-sm text-white hover:bg-gray-700"
            >
              ลบเลย
            </button>
            <button type="button" onClick={() => setConfirmClear(false)} className="min-h-10 px-4 rounded-full text-sm text-gray-600 hover:bg-gray-100">
              ยกเลิก
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmClear(true)}
            className="mt-2 inline-flex items-center gap-1.5 min-h-10 text-sm text-gray-500 hover:text-gray-800"
          >
            <Trash2 className="w-4 h-4" /> ล้างข้อมูลแผนในเครื่องนี้
          </button>
        )}
      </div>
    </div>
  );
}
