'use client';
// app/farewell/plan/Receipt.tsx — "ใบสรุปแผน" ของครอบครัว (ข้างฟอร์มวางแผน + หน้าสรุป + บันทึกเป็นรูป PNG)
// ค่อย ๆ เติมทีละแถวตามที่เลือก (ผู้ใช้ขอ 3 ต.ค. 2026) — แต่ละแถว = เรื่อง + ตัวเลือก + ค่าใช้จ่ายของเรื่องนั้น
// ตัวเลขมาจากค่าเริ่มต้นตามตัวเลือก (DEFAULT_COST) หรือที่ครอบครัวแก้เอง · ธีมส้ม-ขาว-ดำ กระดาษขาวแถบส้ม
// ข้อมูลทั้งหมดอยู่ในเครื่องผู้ใช้ ไม่ส่งขึ้นเซิร์ฟเวอร์
import { QUESTIONS, type QuestionKey } from '../content';
import { planBudget, type Plan } from '../planStore';
import { areaText } from '../components/AreaPicker';
import ChanFlowerIcon from '../components/ChanFlowerIcon';
import styles from './plan.module.css';

const num = (n: number) => n.toLocaleString('th-TH');

export interface ReceiptLine {
  key: string; // QuestionKey หรือ id ของรายการค่าใช้จ่ายที่ไม่ผูกกับคำถาม (cremation/other)
  label: string;
  value: string | null; // ตัวเลือกที่เลือก
  cost: number | null; // ยอดของเรื่องนี้ (คูณวันแล้ว)
  note: string; // เช่น "6,000 × 3 วัน"
  isDefault: boolean; // ยังเป็นค่าเริ่มต้น (ไม่ได้แก้เอง)
}

/** แถวในใบสรุป เรียงตามลำดับคำถาม — เฉพาะเรื่องที่เลือกแล้ว + ค่าใช้จ่ายอื่นที่มียอด */
export function receiptLines(plan: Plan): ReceiptLine[] {
  const b = planBudget(plan);
  const byId = new Map(b.lines.map((l) => [l.id, l]));
  const out: ReceiptLine[] = [];
  for (const q of QUESTIONS) {
    const opt = q.options.find((o) => o.id === plan.answers[q.key]);
    if (!opt) continue;
    const l = byId.get(q.key);
    out.push({
      key: q.key,
      label: q.short,
      value: opt.label,
      cost: l && l.total > 0 ? l.total : null,
      note: l && l.perDay && l.amount > 0 && b.days > 1 ? `${num(l.amount)} × ${b.days} วัน` : '',
      isDefault: !!l?.isDefault,
    });
  }
  for (const l of b.lines) {
    if (QUESTIONS.some((q) => q.key === l.id) || l.total <= 0) continue;
    out.push({ key: l.id, label: l.label, value: null, cost: l.total, note: '', isDefault: l.isDefault });
  }
  return out;
}

const dateText = (iso: string) =>
  iso ? new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

// ── รูป PNG ของใบสรุป (วาดลง canvas เอง ไม่พึ่งไลบรารีจับภาพ — กติกาเดียวกับแผนที่) ──────────────────────
export async function receiptImage(plan: Plan): Promise<Blob> {
  await document.fonts.ready;
  const W = 900;
  const PAD = 64;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = 4000;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('ไม่สามารถสร้างรูปภาพได้');
  const family = getComputedStyle(document.querySelector('[data-receipt]') || document.body).fontFamily;
  const INK = '#1f2937';
  const MUTED = '#6b7280';
  const LINE = '#e5e7eb';
  const ACCENT = '#111827'; // งานศพ = ขาว-ดำ

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, 4000);
  ctx.fillStyle = ACCENT;
  ctx.fillRect(0, 0, W, 10);
  let y = 70;

  const text = (s: string, x: number, size: number, opts: { color?: string; weight?: number; align?: CanvasTextAlign } = {}) => {
    ctx.font = `${opts.weight ?? 400} ${size}px ${family}`;
    ctx.fillStyle = opts.color ?? INK;
    ctx.textAlign = opts.align ?? 'left';
    ctx.fillText(s, x, y);
  };
  const rule = (dashed = false, color = LINE) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.setLineDash(dashed ? [8, 8] : []);
    ctx.beginPath();
    ctx.moveTo(PAD, y);
    ctx.lineTo(W - PAD, y);
    ctx.stroke();
    ctx.setLineDash([]);
  };

  text('ส่งด้วยใจ', PAD, 26, { color: ACCENT, weight: 700 });
  text('สำเนาครอบครัว', W - PAD, 22, { color: MUTED, align: 'right' });
  y += 34;
  rule(true);
  y += 74;
  text('ใบสรุปแผน', W / 2, 52, { weight: 700, align: 'center' });
  y += 40;
  text('ประมาณการค่าใช้จ่าย', W / 2, 24, { color: MUTED, align: 'center' });
  y += 56;
  text(plan.deceasedName || 'แผนงานของครอบครัว', PAD, 32, { weight: 700 });
  y += 38;
  if (plan.area) {
    text(areaText(plan.area), PAD, 24, { color: MUTED });
    y += 34;
  }
  if (plan.updatedAt) {
    text(`วันที่ ${dateText(plan.updatedAt)}`, PAD, 22, { color: MUTED });
    y += 30;
  }
  y += 12;
  rule();
  y += 50;

  for (const r of receiptLines(plan)) {
    text(r.label, PAD, 22, { color: MUTED });
    if (r.cost != null) text(`${num(r.cost)} บาท`, W - PAD, 28, { weight: 700, align: 'right' });
    y += 36;
    const sub = [r.value, r.note].filter(Boolean).join(' · ');
    if (sub) {
      text(sub, PAD, 26);
      y += 30;
    }
    y += 6;
    rule();
    y += 44;
  }

  const b = planBudget(plan);
  if (b.filled) {
    text('รวมประมาณการ', PAD, 30, { weight: 700 });
    text(`${num(b.total)} บาท`, W - PAD, 40, { weight: 700, align: 'right' });
    y += 30;
    rule(false, INK);
    y += 8;
    rule(false, INK);
    y += 48;
    if (b.net != null) {
      text('เงินช่วยงานที่คาดว่าจะได้รับ', PAD, 24, { color: MUTED });
      text(`${num(plan.support ?? 0)} บาท`, W - PAD, 24, { align: 'right' });
      y += 40;
      text(b.net > 0 ? 'ครอบครัวต้องออกเพิ่ม' : 'เหลือหลังหักค่าใช้จ่าย', PAD, 26, { weight: 700 });
      text(`${num(Math.abs(b.net))} บาท`, W - PAD, 26, { weight: 700, align: 'right' });
      y += 50;
    }
  }

  y += 10;
  rule(true);
  y += 50;
  text('ตัวเลขประมาณการ แก้ได้ตามราคาจริงในพื้นที่ · ไม่ใช่หลักฐานการชำระเงิน', W / 2, 20, { color: MUTED, align: 'center' });
  y += 40;
  text('ด้วยความใส่ใจ จากคนในครอบครัว · ส่งด้วยใจ เครือข่ายงดเหล้า', W / 2, 22, { color: INK, align: 'center' });
  y += 50;

  const out = document.createElement('canvas');
  out.width = W;
  out.height = y;
  out.getContext('2d')!.drawImage(canvas, 0, 0);
  return new Promise((resolve, reject) =>
    out.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('บันทึกรูปไม่สำเร็จ'))), 'image/png'),
  );
}

// ── ใบสรุปบนหน้าเว็บ ────────────────────────────────────────────────────────────────
export default function Receipt({
  plan,
  current,
  onJump,
}: {
  plan: Plan;
  /** ขั้นที่กำลังทำ (เน้นแถวนั้น) */
  current?: string;
  /** กดแถวเพื่อกลับไปแก้ขั้นนั้น (เฉพาะหน้าวางแผน) — รายการค่าใช้จ่ายอื่นพาไปขั้นงบประมาณ */
  onJump?: (key: QuestionKey | 'budget') => void;
}) {
  const b = planBudget(plan);
  const lines = receiptLines(plan);
  const anyDefault = lines.some((l) => l.isDefault && l.cost != null);

  return (
    <article data-receipt className={styles.receipt} aria-label="ใบสรุปแผนและประมาณการค่าใช้จ่าย" aria-live="polite">
      <div className="flex items-center justify-between text-xs">
        <span className="inline-flex items-center gap-1.5 font-medium text-gray-900">
          <ChanFlowerIcon className="w-4 h-4" /> ส่งด้วยใจ
        </span>
        <span className="text-gray-500">สำเนาครอบครัว</span>
      </div>
      <div className={styles.dash} />
      <h2 className="text-center text-lg font-semibold text-gray-900">ใบสรุปแผน</h2>
      <p className="text-center text-xs text-gray-500">ประมาณการค่าใช้จ่าย</p>

      <div className="mt-3">
        <p className={`text-sm font-semibold ${plan.deceasedName ? 'text-gray-900' : 'text-gray-400'}`}>
          {plan.deceasedName || 'แผนงานของครอบครัว'}
        </p>
        {plan.area && <p className="text-xs text-gray-500">{areaText(plan.area)}</p>}
        {plan.updatedAt && <p className="text-xs text-gray-500">วันที่ {dateText(plan.updatedAt)}</p>}
      </div>

      {lines.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-gray-200 px-3 py-5 text-center text-xs leading-relaxed text-gray-400">
          เลือกทีละเรื่อง
          <br />
          รายการจะค่อย ๆ เติมลงตรงนี้
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-gray-100 border-y border-gray-100">
          {lines.map((r) => {
            const isQuestion = QUESTIONS.some((q) => q.key === r.key);
            const body = (
              <>
                <span className="min-w-0">
                  <span className="block text-xs text-gray-500">{r.label}</span>
                  {r.value && <span className="block text-[13px] leading-snug text-gray-900">{r.value}</span>}
                  {r.note && <span className="block text-[11px] text-gray-400">{r.note}</span>}
                </span>
                <span className="shrink-0 text-right text-[13px] tabular-nums text-gray-900">
                  {r.cost != null ? num(r.cost) : ''}
                  {r.cost != null && r.isDefault && <span className="ml-0.5 text-gray-400" title="ค่าเริ่มต้น แก้ได้ในขั้นงบประมาณ">*</span>}
                </span>
              </>
            );
            const active = current === r.key;
            const cls = `flex w-full items-start justify-between gap-3 px-1.5 py-2 text-left ${styles.rowIn}`;
            return (
              <li key={r.key}>
                {onJump ? (
                  <button
                    type="button"
                    onClick={() => onJump(isQuestion ? (r.key as QuestionKey) : 'budget')}
                    aria-label={`แก้เรื่อง${r.label}`}
                    aria-current={active ? 'step' : undefined}
                    className={`${cls} transition-colors hover:bg-gray-100 ${active ? 'bg-gray-100 shadow-[inset_3px_0_0_#111827]' : ''}`}
                  >
                    {body}
                  </button>
                ) : (
                  <div className={cls}>{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className={styles.total}>
        <span className="text-[13px] font-medium text-gray-900">รวมประมาณการ</span>
        <span className="tabular-nums">
          <strong className={`text-lg font-semibold ${b.filled ? 'text-gray-900' : 'text-gray-300'}`}>{b.filled ? num(b.total) : '—'}</strong>
          <span className="ml-1 text-xs text-gray-500">บาท</span>
        </span>
      </div>
      {b.net != null && (
        <div className="mt-2 space-y-1 text-[13px]">
          <p className="flex justify-between gap-3 text-gray-500">
            เงินช่วยงาน <span className="tabular-nums">{num(plan.support ?? 0)} บาท</span>
          </p>
          <p className="flex justify-between gap-3 font-medium text-gray-900">
            {b.net > 0 ? 'ครอบครัวต้องออกเพิ่ม' : 'เหลือหลังหักค่าใช้จ่าย'}
            <span className="tabular-nums">{num(Math.abs(b.net))} บาท</span>
          </p>
        </div>
      )}

      <div className={styles.dash} />
      <p className="text-center text-[11px] leading-relaxed text-gray-500">
        {anyDefault && (
          <>
            <span className="text-gray-400">*</span> ค่าเริ่มต้นโดยประมาณ แก้ได้ในขั้นงบประมาณ
            <br />
          </>
        )}
        เอกสารประมาณการ ไม่ใช่หลักฐานการชำระเงิน
      </p>
    </article>
  );
}
