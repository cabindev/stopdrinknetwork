// app/farewell/board/exportImage.ts — "ใบสรุปแผนงาน" รูป PNG สำหรับแชร์ให้ญาติ (LINE ฯลฯ)
// ออกแบบใหม่ 22 พ.ย. 2026 (ผู้ใช้: "ทำให้น่าแชร์ ต้องสวย จัดวางแบบมืออาชีพ"):
//   หัว (ชื่องาน + แด่ผู้วายชนม์ + ตราไม่เลี้ยงเหล้า) → กระดาน (ซ้าย) + ภาพรวมงาน (ขวา) → การ์ดค่าใช้จ่ายสีเข้ม → ท้าย (ลิงก์เว็บ)
// วาดเองลง canvas ตามกติกาโปรเจกต์ (ไม่ใช้ html2canvas) · ฟอนต์อ่านจาก getComputedStyle ไม่เขียนชื่อตายตัว
// ผังช่องบนกระดานใช้ slot เดียวกับจอ (items.ts) — ภาพบนจอกับในรูปวางตรงกัน
import type { BoardOption, Category, Visual } from './items';

const W = 1080;
const PAD = 64;
const BG = '#faf7f2';
const PAPER = '#efe7da';
const PAPER_EDGE = '#e2d7c5';
const INK = '#111827';
const MUTED = '#4b5563';
const SOFT = '#6b7280';

export interface ExportItem {
  cat: Category;
  option: BoardOption;
  /** ป้ายใต้ของบนกระดาน */
  tag?: string;
}

export interface ExportExtra {
  slot: Category['slot'];
  visual: Visual;
  tag?: string;
  /** ป้ายวางใต้ช่อง (แทนทับขอบล่าง) */
  tagBelow?: boolean;
}

const cache = new Map<string, Promise<HTMLImageElement>>();
function load(src: string) {
  let p = cache.get(src);
  if (!p) {
    p = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`load ${src}`));
      img.src = src;
    });
    cache.set(src, p);
  }
  return p;
}

function contain(iw: number, ih: number, x: number, y: number, w: number, h: number) {
  const s = Math.min(w / iw, h / ih);
  const dw = iw * s;
  const dh = ih * s;
  return { x: x + (w - dw) / 2, y: y + (h - dh) / 2, w: dw, h: dh };
}

function shadow(ctx: CanvasRenderingContext2D, on: boolean) {
  ctx.shadowColor = on ? 'rgba(60,40,20,0.22)' : 'transparent';
  ctx.shadowBlur = on ? 18 : 0;
  ctx.shadowOffsetY = on ? 8 : 0;
}

function paperCard(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  shadow(ctx, true);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
  shadow(ctx, false);
}

async function drawVisual(ctx: CanvasRenderingContext2D, v: Visual, x: number, y: number, w: number, h: number, family: string) {
  if (v.kind === 'calendar') {
    const ch = h;
    const cw = (ch * 4) / 5;
    const cx = x + (w - cw) / 2;
    paperCard(ctx, cx, y, cw, ch, 14);
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(cx, y, cw, ch, 14);
    ctx.clip();
    ctx.fillStyle = INK;
    ctx.fillRect(cx, y, cw, ch * 0.22);
    ctx.restore();
    ctx.fillStyle = INK;
    ctx.textAlign = 'center';
    ctx.font = `700 ${Math.round(ch * 0.4)}px ${family}`;
    ctx.fillText(String(v.n), cx + cw / 2, y + ch * 0.7);
    ctx.font = `400 ${Math.round(ch * 0.11)}px ${family}`;
    ctx.fillStyle = MUTED;
    ctx.fillText(v.n === 1 ? 'วันเดียว' : 'คืน', cx + cw / 2, y + ch * 0.88);
    ctx.textAlign = 'left';
    return;
  }
  if (v.kind === 'sign') {
    const sh = h;
    const sw = (sh * 3) / 4;
    const sx = x + (w - sw) / 2;
    // โลโก้โปร่ง ไม่มีแผ่นขาวรอง — ตรงกับบนจอ
    const img = await load('/farewell/signs/rip-sign-black.png');
    const r = contain(img.naturalWidth, img.naturalHeight, sx, y, sw, sh);
    ctx.drawImage(img, r.x, r.y, r.w, r.h);
    return;
  }
  if (v.kind === 'card') {
    paperCard(ctx, x, y + h * 0.15, w, h * 0.7, 10);
    ctx.fillStyle = MUTED;
    ctx.textAlign = 'center';
    ctx.font = `400 ${Math.round(h * 0.12)}px ${family}`;
    ctx.fillText(v.text, x + w / 2, y + h / 2 + h * 0.04);
    ctx.textAlign = 'left';
    return;
  }
  const img = await load(v.src);
  const n = v.stack ?? 1;
  ctx.save();
  if (v.mark && v.mark !== 'soft-none') {
    ctx.globalAlpha = 0.4;
    ctx.filter = 'grayscale(60%)';
  }
  for (let i = 0; i < n; i++) {
    // เหมือน CSS บนจอ: ชิ้นซ้อนเลื่อนทแยง + ย่อ 0.82 รอบจุดกลางช่อง
    const off = i - (n - 1) / 2;
    const s = n > 1 ? 0.82 : 1;
    const bw = w * s;
    const bh = h * s;
    const bx = x + (w - bw) / 2 + off * w * 0.14;
    const by = y + (h - bh) / 2 - off * h * 0.06;
    const r = contain(img.naturalWidth || 600, img.naturalHeight || 380, bx, by, bw, bh);
    shadow(ctx, !v.mark || v.mark === 'soft-none');
    ctx.drawImage(img, r.x, r.y, r.w, r.h);
  }
  ctx.restore();
  shadow(ctx, false);
  if (v.mark) {
    // soft-none = วงห้ามจาง ๆ ทับของสีปกติ (วาดก่อนข้อความ label)
    ctx.save();
    if (v.mark === 'soft-none') ctx.globalAlpha = 0.3;
    const d = Math.min(w, h) * 0.78;
    const cx = x + w / 2;
    const cy = y + h / 2;
    ctx.strokeStyle = INK;
    ctx.fillStyle = INK;
    ctx.lineCap = 'round';
    if (v.mark !== 'maybe') {
      ctx.lineWidth = d * 0.09;
      ctx.beginPath();
      ctx.arc(cx, cy, d * 0.4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - d * 0.28, cy - d * 0.28);
      ctx.lineTo(cx + d * 0.28, cy + d * 0.28);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(cx, cy, d * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.font = `700 ${Math.round(d * 0.42)}px ${family}`;
      ctx.fillText('?', cx, cy + d * 0.15);
      ctx.textAlign = 'left';
    }
    ctx.restore();
  }
  if (v.label) {
    // ข้อความพิมพ์บนตัวถุง ตำแหน่ง/ขนาดเดียวกับบนจอ (top 62%, 17% ของความสูงช่อง)
    ctx.fillStyle = INK;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `700 ${Math.round(h * 0.17)}px ${family}`;
    ctx.fillText(v.label, x + w / 2, y + h * 0.62);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }
}

/** ตัดบรรทัดภาษาไทยด้วย Intl.Segmenter (ไม่มีช่องว่างระหว่างคำ) */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines = 2): string[] {
  const words = (t: string) =>
    typeof Intl !== 'undefined' && 'Segmenter' in Intl
      ? [...new Intl.Segmenter('th', { granularity: 'word' }).segment(t)].map((x) => x.segment)
      : t.split('');
  // "บุฟเฟ่ต์ + แม่ครัว + คนล้างจาน": ตัดตรง " + " ก่อน ไม่ฉีกคำอย่าง "คน|ล้างจาน" — ส่วนที่ยาวเกินบรรทัดค่อยตัดเป็นคำ
  const seg = text.includes(' + ')
    ? text.split(' + ').flatMap((part, i) => {
        const p = i ? `+ ${part}` : part;
        const unit = i ? [' ', p] : [p];
        return ctx.measureText(p).width > maxW ? (i ? [' ', ...words(p)] : words(p)) : unit;
      })
    : words(text);
  const lines: string[] = [];
  let cur = '';
  for (const w of seg) {
    if (ctx.measureText(cur + w).width > maxW && cur) {
      lines.push(cur.trim());
      cur = w.trimStart();
    } else cur += w;
  }
  if (cur.trim()) lines.push(cur.trim());
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    let last = kept[maxLines - 1];
    while (ctx.measureText(last + '…').width > maxW && last.length > 1) last = last.slice(0, -1);
    kept[maxLines - 1] = last + '…';
    return kept;
  }
  return lines;
}

function pill(ctx: CanvasRenderingContext2D, text: string, cx: number, cy: number, family: string, minX: number, maxX: number) {
  ctx.font = `500 21px ${family}`;
  const tw = ctx.measureText(text).width;
  const w = tw + 26;
  const h = 36;
  const x = Math.min(Math.max(cx - w / 2, minX), maxX - w);
  ctx.save();
  ctx.shadowColor = 'rgba(60,40,20,0.16)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;
  ctx.fillStyle = 'rgba(255,255,255,0.94)';
  ctx.beginPath();
  ctx.roundRect(x, cy - h / 2, w, h, h / 2);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#374151';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + 13, cy + 1);
  ctx.textBaseline = 'alphabetic';
}

export interface SummaryRow {
  label: string;
  value: string | null;
}

export interface CostLineOut {
  label: string;
  detail?: string;
  total: number;
}

/** สร้างใบสรุปแผนงาน PNG */
export async function renderBoardImage(opts: {
  items: ExportItem[];
  extras?: ExportExtra[];
  rows: SummaryRow[];
  lines: CostLineOut[];
  total: string;
  days: number | null;
  deceasedName?: string;
  alcoholFree: boolean;
  /** ประหยัดได้เมื่อเทียบงานแบบที่นิยม (null = ยังเลือกเรื่องเงินก้อนหลักไม่ครบ) */
  saving?: { saved: number; typical: number; alcohol: number } | null;
  /** ฟอนต์หัวเรื่อง (เสาชิงช้า) + ฟอนต์เนื้อความ */
  display: string;
  family: string;
  siteUrl: string;
}): Promise<Blob> {
  const { items, extras = [], rows, lines, total, days, deceasedName, alcoholFree, saving, display, family, siteUrl } = opts;
  await Promise.all(
    [display, family].flatMap((f) => ['400', '700'].map((w) => document.fonts?.load(`${w} 40px ${f}`, 'กขค').catch(() => undefined))),
  );

  // วัดส่วนต่าง ๆ ก่อน เพื่อรู้ความสูงรวม
  const measure = document.createElement('canvas').getContext('2d')!;
  const BOARD_X = PAD;
  const BOARD_W = 584;
  const BOARD_H = Math.round((BOARD_W * 4) / 3);
  const COL_X = BOARD_X + BOARD_W + 44;
  const COL_W = W - PAD - COL_X;
  measure.font = `700 30px ${family}`;
  const rowLayout = rows.map((r) => ({ ...r, wrapped: r.value ? wrap(measure, r.value, COL_W, 2) : ['ยังไม่เลือก'] }));
  const rowH = (n: number) => 30 + n * 38 + 26;
  const listH = rowLayout.reduce((s, r) => s + rowH(r.wrapped.length), 0) + 44;

  const headerH = deceasedName ? 250 : 210;
  const bodyY = PAD + headerH;
  const bodyH = Math.max(BOARD_H, listH);
  const costY = bodyY + bodyH + 48;
  // การ์ดค่าใช้จ่าย: ยอดรวม → เทียบงานแบบที่นิยม (แท่ง 2 แท่ง) → รายการเรียงจากมากไปน้อย คอลัมน์เดียว
  const LINE_H = 54;
  const savingH = saving ? 40 + (saving.alcohol ? 262 : 222) : 0;
  const costH = 56 + 114 + 40 + savingH + (lines.length ? 52 + 34 + lines.length * LINE_H : 0) + 44;
  const footY = costY + costH + 44;
  const H = footY + 96;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  // ── หัว ──
  let y = PAD;
  ctx.fillStyle = INK;
  ctx.fillRect(PAD, y + 4, 36, 4);
  ctx.font = `500 24px ${family}`;
  ctx.fillStyle = MUTED;
  ctx.fillText('ส่งด้วยใจ · แผนงานศพเรียบง่าย', PAD + 50, y + 14);
  y += 92;
  ctx.font = `700 76px ${display}`;
  ctx.fillStyle = INK;
  ctx.fillText('แผนงานของบ้านเรา', PAD, y);
  y += 52;
  if (deceasedName) {
    ctx.font = `400 34px ${display}`;
    ctx.fillStyle = INK;
    ctx.fillText(`ด้วยรักและอาลัย แด่ ${deceasedName}`, PAD, y);
    y += 44;
  }
  ctx.font = `400 25px ${family}`;
  ctx.fillStyle = SOFT;
  ctx.fillText(
    `${new Date().toLocaleDateString('th-TH', { dateStyle: 'long' })}${days ? ` · งาน ${days === 1 ? 'วันเดียวเผา' : `${days} คืน`}` : ''}`,
    PAD,
    y,
  );
  if (alcoholFree) {
    // ตรางานศพปลอดเหล้า มุมขวาบน
    const sign = await load('/farewell/signs/rip-sign-black.png').catch(() => null);
    const sw = 118;
    const sx = W - PAD - sw;
    if (sign) {
      const r = contain(sign.naturalWidth, sign.naturalHeight, sx, PAD + 6, sw, 140);
      ctx.drawImage(sign, r.x, r.y, r.w, r.h);
    }
    ctx.font = `700 22px ${family}`;
    ctx.fillStyle = INK;
    ctx.textAlign = 'center';
    ctx.fillText('งานนี้ไม่เลี้ยงเหล้า', sx + sw / 2, PAD + 172);
    ctx.textAlign = 'left';
  }

  // ── กระดาน ──
  ctx.save();
  ctx.shadowColor = 'rgba(80,60,30,0.10)';
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 10;
  ctx.fillStyle = PAPER;
  ctx.beginPath();
  ctx.roundRect(BOARD_X, bodyY, BOARD_W, BOARD_H, 40);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = PAPER_EDGE;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(BOARD_X, bodyY, BOARD_W, BOARD_H, 40);
  ctx.stroke();

  const box = (s: Category['slot']) => ({
    x: BOARD_X + (BOARD_W * s.x) / 100,
    y: bodyY + (BOARD_H * s.y) / 100,
    w: (BOARD_W * s.w) / 100,
    h: (BOARD_H * s.h) / 100,
  });
  const placed = [
    ...items.map((it) => ({ slot: it.cat.slot, visual: it.option.visual, tag: it.tag, below: false, align: it.cat.tagAlign })),
    ...extras.map((e) => ({ slot: e.slot, visual: e.visual, tag: e.tag, below: !!e.tagBelow, align: undefined })),
  ];
  for (const p of placed) {
    const b = box(p.slot);
    await drawVisual(ctx, p.visual, b.x, b.y, b.w, b.h, family).catch(() => undefined);
  }
  // ป้ายวาดทีหลังสุด ไม่ให้ภาพชิ้นอื่นทับ
  for (const p of placed) {
    if (!p.tag) continue;
    const b = box(p.slot);
    const cx = p.align === 'end' ? b.x + b.w - 40 : b.x + b.w / 2;
    pill(ctx, p.tag, cx, p.below ? b.y + b.h + 22 : b.y + b.h - 4, family, BOARD_X + 10, BOARD_X + BOARD_W - 10);
  }

  // ── ภาพรวมงาน (ขวา) ──
  let ly = bodyY + 8;
  ctx.font = `700 22px ${family}`;
  ctx.fillStyle = SOFT;
  ctx.fillText('ภาพรวมงาน', COL_X, ly + 18);
  ly += 44;
  for (const r of rowLayout) {
    ctx.fillStyle = '#e5e7eb';
    ctx.fillRect(COL_X, ly, COL_W, 2);
    ctx.font = `400 22px ${family}`;
    ctx.fillStyle = SOFT;
    ctx.fillText(r.label, COL_X, ly + 34);
    ctx.font = `700 30px ${family}`;
    ctx.fillStyle = r.value ? INK : '#9ca3af';
    r.wrapped.forEach((t, i) => ctx.fillText(t, COL_X, ly + 72 + i * 38));
    ly += rowH(r.wrapped.length);
  }

  // ── ค่าใช้จ่าย (การ์ดเข้ม) ──
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.roundRect(PAD, costY, W - PAD * 2, costH, 36);
  ctx.fill();
  const cx0 = PAD + 48;
  const cw = W - PAD * 2 - 96;
  let cy = costY + 56;
  ctx.font = `400 26px ${family}`;
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillText('ค่าใช้จ่ายโดยประมาณทั้งงาน', cx0, cy + 10);
  cy += 34 + 80;
  ctx.font = `700 92px ${family}`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(total, cx0, cy);
  cy += 46;
  ctx.font = `400 22px ${family}`;
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillText('ราคาประมาณจากกรณีศึกษา ราคาจริงแต่ละพื้นที่ต่างกัน', cx0, cy);
  if (saving) {
    // เทียบให้เห็นด้วยแท่ง: งานแบบที่นิยม vs งานนี้ — ส่วนต่างคือ "ประหยัดได้" ตัวเลขที่คนจะเล่าต่อ
    cy += 40;
    const boxH = saving.alcohol ? 262 : 222;
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.beginPath();
    ctx.roundRect(cx0, cy, cw, boxH, 24);
    ctx.fill();
    const bx = cx0 + 32;
    const bw = cw - 64;
    ctx.font = `700 42px ${family}`;
    ctx.fillStyle = '#6ee7b7';
    ctx.fillText(`ประหยัดได้ ~${Math.round(saving.saved).toLocaleString('th-TH')} บาท`, bx, cy + 62);
    const thisTotal = Math.max(0, saving.typical - saving.saved);
    const bars: [string, number, string][] = [
      ['งานแบบที่นิยม 5 คืน เลี้ยงเหล้า', saving.typical, 'rgba(255,255,255,0.28)'],
      ['งานของบ้านเรา', thisTotal, '#ffffff'],
    ];
    bars.forEach(([label, v, color], i) => {
      const by = cy + 118 + i * 58;
      ctx.font = `400 21px ${family}`;
      ctx.fillStyle = 'rgba(255,255,255,0.72)';
      ctx.fillText(label, bx, by);
      ctx.textAlign = 'right';
      ctx.font = `700 21px ${family}`;
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillText(`${Math.round(v).toLocaleString('th-TH')} บาท`, bx + bw, by);
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.beginPath();
      ctx.roundRect(bx, by + 12, bw, 14, 7);
      ctx.fill();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(bx, by + 12, Math.max(14, (bw * v) / saving.typical), 14, 7);
      ctx.fill();
    });
    if (saving.alcohol) {
      ctx.font = `400 20px ${family}`;
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillText(`ไม่เลี้ยงเหล้า ไม่ต้องจ่ายค่าเหล้าราว ${Math.round(saving.alcohol).toLocaleString('th-TH')} บาท`, bx, cy + boxH - 30);
    }
    cy += boxH;
  }
  if (lines.length) {
    cy += 52;
    ctx.font = `500 21px ${family}`;
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText('แยกรายการ', cx0, cy);
    cy += 34;
    // เรียงจากมากไปน้อย คอลัมน์เดียว: ชื่อ (+ ราคาต่อวันตัวเล็กต่อท้าย) ····· ยอด
    [...lines]
      .sort((a, b) => Number(a.label.startsWith('อื่น')) - Number(b.label.startsWith('อื่น')) || b.total - a.total)
      .forEach((l, i) => {
        const ry = cy + i * LINE_H;
        if (i > 0) {
          ctx.fillStyle = 'rgba(255,255,255,0.1)';
          ctx.fillRect(cx0, ry, cw, 1.5);
        }
        const base = ry + 36;
        ctx.font = `400 24px ${family}`;
        ctx.fillStyle = 'rgba(255,255,255,0.88)';
        const label = wrap(ctx, l.label, cw - 330, 1)[0];
        ctx.fillText(label, cx0, base);
        if (l.detail) {
          const lw = ctx.measureText(label).width;
          ctx.font = `400 19px ${family}`;
          ctx.fillStyle = 'rgba(255,255,255,0.5)';
          ctx.fillText(l.detail, cx0 + lw + 14, base);
        }
        ctx.font = `700 26px ${family}`;
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'right';
        ctx.fillText(l.total.toLocaleString('th-TH'), cx0 + cw, base);
        ctx.textAlign = 'left';
      });
  }

  // ── ท้าย ──
  ctx.font = `400 24px ${family}`;
  ctx.fillStyle = MUTED;
  ctx.fillText('วางแผนงานของบ้านคุณได้ที่', PAD, footY + 30);
  ctx.font = `700 30px ${family}`;
  ctx.fillStyle = INK;
  ctx.fillText(siteUrl, PAD, footY + 70);
  ctx.font = `400 22px ${family}`;
  ctx.fillStyle = SOFT;
  ctx.textAlign = 'right';
  ctx.fillText('เรียบง่าย สมเกียรติ ไม่เป็นหนี้', W - PAD, footY + 70);
  ctx.textAlign = 'left';

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob'))), 'image/png'));
}
