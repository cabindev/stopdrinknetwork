'use client';
// app/farewell/plan/summary/PlanSummary.tsx — สรุปแผนงานศพ พิมพ์/ส่งให้ญาติได้
// ส่งต่อด้วย Web Share (มือถือ) หรือคัดลอกข้อความ/LINE — ข้อมูลออกจากเครื่องเมื่อผู้ใช้กดส่งเองเท่านั้น
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, ClipboardCopy, Download, ListChecks, MessageCircle, Pencil, Printer, Share2, Trash2 } from 'lucide-react';
import { QUESTIONS, buildChecklist } from '../../content';
import { baht, planBudget, usePlan, type Plan } from '../../planStore';
import { areaText } from '../../components/AreaPicker';
import Receipt, { receiptImage } from '../Receipt';
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
  const [imageStatus, setImageStatus] = useState('');
  const [imageBusy, setImageBusy] = useState(false);
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
      <div className="rounded-2xl border border-gray-200 bg-gray-100 p-6 text-center">
        <p className="text-base text-gray-800">ยังไม่มีแผนที่บันทึกไว้ในเครื่องนี้</p>
        <Link
          href="/farewell/plan"
          className="mt-4 inline-flex items-center gap-2 min-h-12 px-5 rounded-full bg-gray-900 text-sm font-semibold text-white hover:bg-gray-700"
        >
          เริ่มวางแผน
        </Link>
      </div>
    );
  }

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

  const saveImage = async () => {
    setImageBusy(true);
    setImageStatus('');
    try {
      const blob = await receiptImage(plan);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ใบสรุปแผน${plan.deceasedName ? '-' + plan.deceasedName : ''}.png`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      setImageStatus('บันทึกรูปแล้ว พร้อมส่งต่อให้ครอบครัว');
    } catch { setImageStatus('สร้างรูปไม่สำเร็จ กรุณาลองอีกครั้ง'); }
    finally { setImageBusy(false); }
  };

  const btn =
    'inline-flex items-center justify-center gap-2 min-h-12 px-4 rounded-full border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50';

  return (
    <div>
      {/* ส่วนพิมพ์ */}
      <div className="mx-auto max-w-md">
        <Receipt plan={plan} />
      </div>

      {/* ปุ่ม (ไม่พิมพ์) — บันทึกเป็นรูปคือทางที่ครอบครัวใช้มากที่สุด (ส่งในกลุ่ม LINE) จึงเป็นปุ่มหลัก */}
      <div className="mt-6 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-center print:hidden">
        <button type="button" onClick={saveImage} disabled={imageBusy} className={`${btn} col-span-2 border-gray-900 bg-gray-900 text-white hover:bg-gray-700 disabled:opacity-60`}>
          <Download className="w-4 h-4" /> {imageBusy ? 'กำลังสร้างรูป…' : 'บันทึกใบสรุปเป็นรูป'}
        </button>
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
          <MessageCircle className="w-4 h-4" /> ส่งทาง LINE
        </a>
        <button type="button" onClick={copy} className={btn}>
          {copied ? <Check className="w-4 h-4 text-gray-900" /> : <ClipboardCopy className="w-4 h-4" />}
          {copied ? 'คัดลอกแล้ว' : 'คัดลอกข้อความ'}
        </button>
      </div>
      <p role="status" className="mt-3 min-h-5 text-center text-sm text-gray-600 print:hidden">{imageStatus}</p>

      <article className="mt-8 rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 print:hidden">
        <section>
          <h3 className="flex items-center gap-2 text-base font-bold text-gray-900">
            <ListChecks className="w-5 h-5 text-gray-900" /> สิ่งที่ต้องทำ
          </h3>
          <ul className="mt-3 space-y-1">
            {checklist.map((c) => {
              const done = !!plan.done[c.id];
              return (
                <li key={c.id}>
                  <label className="flex items-start gap-3 rounded-xl px-2 py-2 hover:bg-gray-100 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={done}
                      onChange={() => update((p) => ({ done: { ...p.done, [c.id]: !done } }))}
                      className="mt-1 h-5 w-5 shrink-0 accent-gray-900"
                    />
                    <span className={`text-sm leading-relaxed ${done ? 'text-gray-400 line-through' : 'text-gray-800'}`}>{c.text}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </section>
      </article>

      <div className="mt-4 print:hidden">
        <Link href="/farewell/plan" className="inline-flex items-center gap-1.5 min-h-11 text-sm font-bold text-gray-800 hover:text-gray-900">
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
              <Trash2 className="w-4 h-4" /> ลบเลย
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
             ล้างข้อมูลแผนในเครื่องนี้
          </button>
        )}
      </div>
    </div>
  );
}
