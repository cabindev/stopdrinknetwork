'use client';
// app/farewell/signs/SignMaker.tsx — ป้ายหน้างาน "ไม่เลี้ยงเหล้า" A4 แนวนอน วาดลง canvas แล้วดาวน์โหลด PNG/พิมพ์
// ข้อความ 3 แบบจากทีม Civic Space · สีส้ม–ขาว–ดำ พื้นล้วน (ตามธีมเว็บ ห้าม gradient)
// ไม่ใช้ html2canvas (กติกาโปรเจกต์) วาดเองทั้งหมด
import { useEffect, useRef, useState } from 'react';
import { Check, Download, Printer } from 'lucide-react';
import { SIGN_MESSAGES } from '../content';
import { usePlan } from '../planStore';
import { track } from '../track';

// A4 แนวนอน ~212 dpi พิมพ์ได้คมพอ ไฟล์ไม่ใหญ่เกินไปบนมือถือ
const W = 2480;
const H = 1754;
const ORANGE = '#ea580c'; // orange-600
const INK = '#111827'; // gray-900
const MUTED = '#4b5563'; // gray-600
const DEFAULT_FOOTER = 'ขอบพระคุณทุกท่านที่มาร่วมส่งด้วยใจ';

/** ตัดคำภาษาไทยด้วย Intl.Segmenter (ไม่มีช่องว่างระหว่างคำ) แล้วจัดบรรทัดให้ไม่เกินความกว้าง */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words =
    typeof Intl !== 'undefined' && 'Segmenter' in Intl
      ? [...new Intl.Segmenter('th', { granularity: 'word' }).segment(text)].map((s) => s.segment)
      : [...text];
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const next = line + w;
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line.trim());
      line = w.trimStart();
    } else line = next;
  }
  if (line.trim()) lines.push(line.trim());
  return lines;
}

/**
 * หาขนาดตัวอักษรใหญ่ที่สุดที่ข้อความลงได้ไม่เกิน maxLines บรรทัด
 * ลองตัดบรรทัดตามช่องว่างที่ข้อความมีอยู่แล้วก่อน (เช่น "เจ้าภาพขออภัย | ไม่เลี้ยงเหล้าในงาน")
 * ไม่งั้นการตัดตามความกว้างจะทิ้งคำสั้น ๆ อย่าง "งาน" ไว้บรรทัดสุดท้ายคำเดียว
 */
function fit(ctx: CanvasRenderingContext2D, text: string, family: string, maxWidth: number, maxSize: number, maxLines: number) {
  const phrases = text.split(/\s+/).filter(Boolean);
  if (phrases.length > 1 && phrases.length <= maxLines) {
    for (let size = maxSize; size >= 150; size -= 8) {
      ctx.font = `700 ${size}px ${family}`;
      if (phrases.every((p) => ctx.measureText(p).width <= maxWidth)) return { size, lines: phrases };
    }
  }
  for (let size = maxSize; size > 60; size -= 8) {
    ctx.font = `700 ${size}px ${family}`;
    const lines = wrap(ctx, text, maxWidth);
    if (lines.length <= maxLines) return { size, lines };
  }
  ctx.font = `700 60px ${family}`;
  return { size: 60, lines: wrap(ctx, text, maxWidth) };
}

function draw(canvas: HTMLCanvasElement, message: string, name: string, footer: string) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const family = getComputedStyle(document.body).fontFamily || 'sans-serif';

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  // กรอบส้มทึบ
  const inset = 70;
  ctx.strokeStyle = ORANGE;
  ctx.lineWidth = 26;
  ctx.strokeRect(inset, inset, W - inset * 2, H - inset * 2);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const maxWidth = W - 2 * 260;

  // บรรทัดบน: ชื่อผู้วายชนม์ (ถ้ามี)
  let top = 330;
  if (name.trim()) {
    ctx.fillStyle = MUTED;
    ctx.font = `400 92px ${family}`;
    const nameLines = wrap(ctx, `งานบำเพ็ญกุศลศพ ${name.trim()}`, maxWidth).slice(0, 2);
    nameLines.forEach((l, i) => ctx.fillText(l, W / 2, top + i * 120));
    top += nameLines.length * 120 + 40;
  }

  // ข้อความหลัก
  const { size, lines } = fit(ctx, message, family, maxWidth, 250, 3);
  const lineH = size * 1.32;
  const footerTop = H - 330;
  const centerY = (top + footerTop) / 2;
  ctx.fillStyle = INK;
  ctx.font = `700 ${size}px ${family}`;
  lines.forEach((l, i) => ctx.fillText(l, W / 2, centerY + (i - (lines.length - 1) / 2) * lineH));

  // เส้นคั่นส้ม + บรรทัดล่าง
  if (footer.trim()) {
    ctx.fillStyle = ORANGE;
    ctx.fillRect(W / 2 - 160, footerTop - 70, 320, 12);
    ctx.fillStyle = MUTED;
    ctx.font = `400 84px ${family}`;
    wrap(ctx, footer.trim(), maxWidth)
      .slice(0, 1)
      .forEach((l) => ctx.fillText(l, W / 2, footerTop + 40));
  }
}

export default function SignMaker() {
  const { plan } = usePlan();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [message, setMessage] = useState<string>(SIGN_MESSAGES[0]);
  // undefined = ยังไม่ได้แก้เอง → ใช้ชื่อจากแผนในเครื่อง
  const [nameEdit, setNameEdit] = useState<string | undefined>(undefined);
  const [footer, setFooter] = useState(DEFAULT_FOOTER);
  const [printUrl, setPrintUrl] = useState('');
  const name = nameEdit ?? plan?.deceasedName ?? '';

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    // รอฟอนต์ไทยโหลดก่อนวาด ไม่งั้นตัวอักษรอาจออกมาเป็นฟอนต์สำรอง
    document.fonts.ready.then(() => {
      if (cancelled) return;
      draw(canvas, message, name, footer);
      setPrintUrl(canvas.toDataURL('image/png'));
    });
    return () => {
      cancelled = true;
    };
  }, [message, name, footer]);

  const download = () => {
    track('SIGN_DOWNLOAD');
    canvasRef.current?.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ป้ายงานศพไม่เลี้ยงเหล้า.png';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, 'image/png');
  };

  return (
    <div>
      {/* พิมพ์แค่ป้าย เต็มหน้า A4 แนวนอน */}
      <style>{`@media print { @page { size: A4 landscape; margin: 0; } }`}</style>
      {printUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- data URL จาก canvas ใช้ next/image ไม่ได้
        <img src={printUrl} alt="" className="hidden print:block print:w-full" />
      )}

      <div className="print:hidden">
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          role="img"
          aria-label={`ตัวอย่างป้าย: ${message}`}
          className="w-full h-auto rounded-2xl border border-gray-200 shadow-sm"
        />

        <fieldset className="mt-6">
          <legend className="text-sm font-medium text-gray-900">ข้อความบนป้าย</legend>
          <div className="mt-2 space-y-2">
            {SIGN_MESSAGES.map((m) => {
              const active = m === message;
              return (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setMessage(m)}
                  className={`w-full flex items-center gap-3 rounded-2xl border px-4 py-3 text-left text-base transition-colors ${
                    active ? 'border-orange-600 bg-orange-50 text-gray-900' : 'border-gray-200 text-gray-700 hover:border-orange-300'
                  }`}
                >
                  <span
                    className={`flex w-5 h-5 shrink-0 items-center justify-center rounded-full border ${
                      active ? 'border-orange-600 bg-orange-600 text-white' : 'border-gray-300'
                    }`}
                  >
                    {active && <Check className="w-3.5 h-3.5" />}
                  </span>
                  {m}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="sign-name" className="text-sm font-medium text-gray-900">
              ชื่อผู้วายชนม์ <span className="font-normal text-gray-500">(ไม่ใส่ก็ได้)</span>
            </label>
            <input
              id="sign-name"
              type="text"
              value={name}
              onChange={(e) => setNameEdit(e.target.value.slice(0, 80))}
              className="mt-2 w-full h-12 rounded-2xl border border-gray-300 px-4 text-base outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
            />
          </div>
          <div>
            <label htmlFor="sign-footer" className="text-sm font-medium text-gray-900">
              บรรทัดล่าง
            </label>
            <input
              id="sign-footer"
              type="text"
              value={footer}
              onChange={(e) => setFooter(e.target.value.slice(0, 60))}
              className="mt-2 w-full h-12 rounded-2xl border border-gray-300 px-4 text-base outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
            />
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-2 sm:flex">
          <button
            type="button"
            onClick={download}
            className="inline-flex items-center justify-center gap-2 min-h-12 px-5 rounded-full bg-orange-600 text-sm font-semibold text-white hover:bg-orange-700"
          >
            <Download className="w-4 h-4" /> ดาวน์โหลด PNG
          </button>
          <button
            type="button"
            onClick={() => {
              track('SIGN_PRINT');
              window.print();
            }}
            className="inline-flex items-center justify-center gap-2 min-h-12 px-5 rounded-full border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Printer className="w-4 h-4" /> พิมพ์
          </button>
        </div>
      </div>
    </div>
  );
}
