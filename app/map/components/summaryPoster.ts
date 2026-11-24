// app/map/components/summaryPoster.ts — ภาพสรุป "ทำแล้วที่ไหนบ้าง" ของภาคที่เลือก (ปุ่มดาวน์โหลดในโหมดสรุปจังหวัดบน /map)
// วาดเวกเตอร์ลง canvas เอง (ไม่จับภาพหน้าจอ — ไม่มี tile ไม่เบลอ ไม่ติดการ์ดที่ลอยทับ) ความละเอียด 2 เท่า ตัวหนังสือคม
// ซ้าย: แผนที่เฉพาะจังหวัดในภาคที่เลือก + วงเหลืองจำนวนนโยบาย + ชื่อทุกจังหวัด · ขวา: พายระดับนโยบาย + รูปแบบ + จังหวัดที่มีมากสุด
import thailandGeo from '@/app/data/thailand.json';
import { SHORT, SLICE, policyBreakdown } from './PolicySummaryCard';

type Geometry = { type: string; coordinates: number[][][] | number[][][][] };
const FEATURES = (thailandGeo as unknown as { features: { properties: Record<string, string>; geometry: Geometry }[] }).features;
const ringsOf = (g: Geometry) => (g.type === 'Polygon' ? (g.coordinates as number[][][]) : (g.coordinates as number[][][][]).flat());

export type PosterInput = {
  /** เช่น "อีสานล่าง" / "เหนือบน + อีสานล่าง" / "ภาคเหนือ + ภาคอีสาน" */
  title: string;
  provinces: Set<string>;
  counts: Map<string, number>;
  centers: Map<string, [number, number]>;
  policies: { level: string; type: string | null }[];
};

/** โลโก้ภาคีมุมขวาบน สีเทา (ผู้ใช้ขอ 24 พ.ย. 2026): งานศพปลอดเหล้า · สสส. · สคล. · CivicSpace — public/brand/partners/ (ต้นฉบับ brand-assets/partners/) */
const PARTNER_LOGOS = ['rip', 'thaihealth', 'skl', 'civic'].map((n) => `/brand/partners/${n}.png`);
const loadImg = (src: string) =>
  new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });

const W = 1600;
const H = 1040;
const K = 2;

export async function drawSummaryPoster(input: PosterInput): Promise<Blob> {
  await document.fonts?.ready;
  const font = getComputedStyle(document.body).fontFamily;
  const c = document.createElement('canvas');
  c.width = W * K;
  c.height = H * K;
  const ctx = c.getContext('2d')!;
  ctx.scale(K, K);
  ctx.textBaseline = 'alphabetic';
  const f = (size: number, weight = 400) => `${weight} ${size}px ${font}`;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  const { provinces, counts, centers, policies, title } = input;
  const shownCounts = [...provinces].map((p) => [p, counts.get(p) ?? 0] as const);
  const total = policies.length;
  const withPolicy = shownCounts.filter(([, n]) => n > 0);

  // ── หัว
  ctx.fillStyle = '#facc15';
  ctx.fillRect(56, 44, 56, 8);
  ctx.fillStyle = '#6b7280';
  ctx.font = f(20, 500);
  ctx.fillText('นโยบาย/ข้อตกลงงานศพปลอดเหล้า', 56, 86);
  ctx.fillStyle = '#111827';
  ctx.font = f(46, 700);
  ctx.fillText(`ทำแล้วที่ไหนบ้าง · ${title}`, 56, 140);
  ctx.fillStyle = '#374151';
  ctx.font = f(22, 500);
  const date = new Intl.DateTimeFormat('th-TH', { dateStyle: 'long' }).format(new Date());
  ctx.fillText(`${total.toLocaleString('th-TH')} นโยบาย · ${withPolicy.length} จาก ${provinces.size} จังหวัด · ข้อมูล ณ ${date}`, 56, 178);

  // โลโก้ภาคี ชิดขวาบน สีเทา (scripts/build-partner-logos.mjs) — ขนาดตาม "พื้นที่" เท่ากัน ไม่ใช่สูงเท่ากัน
  // (โลโก้แนวนอนอย่าง CivicSpace สูงเท่าตัวอื่นจะดูใหญ่เกิน) · เรียงกลางแนวตั้งที่ y = 97
  {
    const logos = (await Promise.all(PARTNER_LOGOS.map(loadImg))).filter((x): x is HTMLImageElement => !!x);
    const AREA = 5600;
    const gap = 30;
    let x = W - 48;
    for (const img of [...logos].reverse()) {
      const aspect = img.naturalWidth / img.naturalHeight;
      const h = Math.min(68, Math.max(40, Math.sqrt(AREA / aspect)));
      const w = h * aspect;
      x -= w;
      ctx.drawImage(img, x, 97 - h / 2, w, h);
      x -= gap;
    }
  }

  // ── แผนที่ (ซ้าย)
  const box = { x: 40, y: 210, w: 960, h: 760 };
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, latSum = 0, latN = 0;
  for (const ft of FEATURES) {
    if (!provinces.has(ft.properties?.name_th)) continue;
    for (const ring of ringsOf(ft.geometry))
      for (const [lng, lat] of ring) {
        latSum += lat;
        latN++;
        minX = Math.min(minX, lng); maxX = Math.max(maxX, lng);
        minY = Math.min(minY, lat); maxY = Math.max(maxY, lat);
      }
  }
  const cosLat = Math.cos(((latN ? latSum / latN : 15) * Math.PI) / 180);
  const pad = 40;
  const scale = Math.min((box.w - pad * 2) / ((maxX - minX) * cosLat || 1), (box.h - pad * 2) / (maxY - minY || 1));
  const ox = box.x + (box.w - (maxX - minX) * cosLat * scale) / 2;
  const oy = box.y + (box.h - (maxY - minY) * scale) / 2;
  const pt = (lat: number, lng: number) => [ox + (lng - minX) * cosLat * scale, oy + (maxY - lat) * scale] as const;

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(box.x, box.y, box.w, box.h, 24);
  ctx.fillStyle = '#f8fafc';
  ctx.fill();
  ctx.clip();
  ctx.lineJoin = 'round';
  // จังหวัดรอบข้าง (บริบท) จางก่อน แล้วค่อยจังหวัดในภาคทับ
  for (const pass of [false, true]) {
    for (const ft of FEATURES) {
      const name = ft.properties?.name_th;
      if (!name || provinces.has(name) !== pass) continue;
      ctx.beginPath();
      for (const ring of ringsOf(ft.geometry)) {
        ring.forEach(([lng, lat], i) => {
          const [x, y] = pt(lat, lng);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.closePath();
      }
      const has = (counts.get(name) ?? 0) > 0;
      ctx.fillStyle = !pass ? '#eef0f3' : has ? '#3f3f46' : '#ffffff';
      ctx.fill();
      ctx.strokeStyle = !pass ? '#dfe3e8' : has ? '#ffffff' : '#9ca3af';
      ctx.lineWidth = pass ? 1.4 : 1;
      ctx.stroke();
    }
  }

  // วงตัวเลข + ชื่อจังหวัด — ขนาดตามสเกลแผนที่ (ทั้งประเทศ = แผนที่เล็ก → วง/ตัวหนังสือเล็กลง, ไม่โชว์ชื่อจังหวัดที่ยังไม่มีนโยบาย)
  const max = Math.max(1, ...withPolicy.map(([, n]) => n));
  const zoomK = Math.min(1.5, Math.max(0.5, scale / 140));
  const txtK = Math.min(1, Math.max(0.72, zoomK));
  const showEmptyNames = zoomK >= 0.8;
  const bubbles: { x: number; y: number; d: number; n: number; name: string }[] = [];
  const empties: { x: number; y: number; name: string }[] = [];
  for (const [name, n] of shownCounts) {
    const center = centers.get(name);
    if (!center) continue;
    const [x, y] = pt(center[0], center[1]);
    if (n > 0) bubbles.push({ x, y, d: Math.max(20, (24 + Math.sqrt(n / max) * 28) * zoomK), n, name });
    else if (showEmptyNames) empties.push({ x, y, name });
  }
  ctx.textAlign = 'center';
  // วงใหญ่ก่อน วงเล็กทับข้างบน (ไม่โดนวงใหญ่บังมิด)
  for (const { x, y, d, n } of [...bubbles].sort((p, q) => q.d - p.d)) {
    ctx.beginPath();
    ctx.arc(x, y, d / 2, 0, Math.PI * 2);
    ctx.fillStyle = '#facc15';
    ctx.shadowColor = 'rgba(0,0,0,.25)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 2;
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.lineWidth = d < 30 ? 1.8 : 2.5;
    ctx.strokeStyle = '#111827';
    ctx.stroke();
    ctx.fillStyle = '#111827';
    ctx.font = f(Math.max(11, Math.round(d * 0.48)), 800);
    ctx.textBaseline = 'middle';
    ctx.fillText(String(n), x, y + 1);
    ctx.textBaseline = 'alphabetic';
  }

  // ป้ายชื่อ: วงทุกวงเป็นสิ่งกีดขวาง · ลอง ใต้วง → ซ้าย/ขวา → เหนือวง → ลงอีกบรรทัด · ไม่มีที่ลง = ไม่วาด (ดีกว่าทับกันอ่านไม่ออก)
  type Box = { x0: number; x1: number; y0: number; y1: number };
  const placed: Box[] = bubbles.map((q) => ({ x0: q.x - q.d / 2, x1: q.x + q.d / 2, y0: q.y - q.d / 2, y1: q.y + q.d / 2 }));
  const hit = (r: Box) => placed.some((q) => r.x0 < q.x1 && r.x1 > q.x0 && r.y0 < q.y1 && r.y1 > q.y0);
  const labelFont = (has: boolean) => f(Math.round((has ? 16 : 15) * txtK), has ? 700 : 500);
  const lh = 18 * txtK;
  const drawn: { x: number; y: number; name: string; has: boolean }[] = [];
  const place = (name: string, has: boolean, tries: [number, number][]) => {
    ctx.font = labelFont(has);
    const w = ctx.measureText(name).width;
    for (const [x, y] of tries) {
      const r = { x0: x - w / 2 - 2, x1: x + w / 2 + 2, y0: y - lh * 0.8, y1: y + lh * 0.25 };
      if (!hit(r)) {
        placed.push(r);
        drawn.push({ x, y, name, has });
        return;
      }
    }
  };
  for (const b of [...bubbles].sort((p, q) => q.n - p.n)) {
    ctx.font = labelFont(true);
    const w = ctx.measureText(b.name).width;
    const r = b.d / 2;
    const side = b.y + lh * 0.3;
    place(b.name, true, [
      [b.x, b.y + r + lh * 0.95],
      [b.x - r - w / 2 - 5, side],
      [b.x + r + w / 2 + 5, side],
      [b.x, b.y - r - lh * 0.35],
      [b.x, b.y + r + lh * 1.95],
    ]);
  }
  for (const e of empties) place(e.name, false, [[e.x, e.y + 6], [e.x, e.y + 6 + lh], [e.x, e.y + 6 - lh]]);
  for (const l of drawn) {
    ctx.font = labelFont(l.has);
    ctx.lineJoin = 'round';
    ctx.lineWidth = (l.has ? 4 : 3.5) * txtK;
    ctx.strokeStyle = l.has ? '#111827' : '#ffffff';
    ctx.strokeText(l.name, l.x, l.y);
    ctx.fillStyle = l.has ? '#ffffff' : '#4b5563';
    ctx.fillText(l.name, l.x, l.y);
  }
  ctx.restore();
  ctx.textAlign = 'left';

  // คำอธิบายวง (มุมล่างซ้ายของแผนที่)
  {
    const bx = box.x + 20;
    const by = box.y + box.h - 22;
    let x = bx;
    ctx.font = f(14, 500);
    for (const [d, n] of [[18, 1], [24, 3], [30, 8]] as const) {
      ctx.beginPath();
      ctx.arc(x + d / 2, by - 8, d / 2, 0, Math.PI * 2);
      ctx.fillStyle = '#facc15';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#111827';
      ctx.stroke();
      ctx.fillStyle = '#111827';
      ctx.font = f(d * 0.46, 800);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(n), x + d / 2, by - 7);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      x += d + 6;
    }
    ctx.font = f(15, 500);
    ctx.fillStyle = '#374151';
    const legend = '= จำนวนนโยบายในจังหวัด';
    ctx.fillText(legend, x + 4, by - 2);
    x += 4 + ctx.measureText(legend).width + 28;
    for (const [fill, stroke, label] of [
      ['#3f3f46', '#3f3f46', 'มีนโยบาย'],
      ['#ffffff', '#9ca3af', 'ยังไม่มี'],
    ] as const) {
      ctx.fillStyle = fill;
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(x, by - 18, 18, 18, 4);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#374151';
      ctx.font = f(15, 500);
      ctx.fillText(label, x + 26, by - 3);
      x += 26 + ctx.measureText(label).width + 22;
    }
  }

  // ── แผงขวา: พายระดับ + รูปแบบ + จังหวัดที่มีมากสุด
  const px = 1040;
  const pw = 520;
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#e5e7eb';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(px, box.y, pw, box.h, 24);
  ctx.fill();
  ctx.stroke();

  const { levels, types, untyped, pct } = policyBreakdown(policies);
  let y = box.y + 50;
  ctx.fillStyle = '#111827';
  ctx.font = f(24, 700);
  ctx.fillText('มีนโยบาย/ข้อตกลง ระดับไหนบ้าง', px + 32, y);

  // พาย
  const R = 96;
  const cx = px + 32 + R;
  const cy = y + 30 + R;
  let a = -Math.PI / 2;
  for (const l of levels) {
    const a1 = a + (l.n / (total || 1)) * Math.PI * 2;
    ctx.beginPath();
    if (levels.length === 1) ctx.arc(cx, cy, R, 0, Math.PI * 2);
    else {
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, R, a, a1);
      ctx.closePath();
    }
    ctx.fillStyle = SLICE[l.value]?.fill ?? '#e5e7eb';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#111827';
    ctx.stroke();
    if (l.n / (total || 1) >= 0.08) {
      const mid = (a + a1) / 2;
      const tx = levels.length === 1 ? cx : cx + R * 0.62 * Math.cos(mid);
      const ty = levels.length === 1 ? cy : cy + R * 0.62 * Math.sin(mid);
      ctx.fillStyle = SLICE[l.value]?.ink ?? '#111827';
      ctx.font = f(20, 800);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${pct(l.n)}%`, tx, ty);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    }
    a = a1;
  }
  // คำอธิบายพาย
  let ly = cy - R + 18;
  for (const l of [...levels].sort((p, q) => q.n - p.n)) {
    const lx = cx + R + 32;
    ctx.beginPath();
    ctx.arc(lx + 8, ly - 6, 8, 0, Math.PI * 2);
    ctx.fillStyle = SLICE[l.value]?.fill ?? '#e5e7eb';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#111827';
    ctx.stroke();
    ctx.fillStyle = '#111827';
    ctx.font = f(18, 700);
    ctx.fillText(`ระดับ${l.label}`, lx + 24, ly);
    ctx.fillStyle = '#6b7280';
    ctx.font = f(15, 500);
    ctx.fillText(`${l.n} นโยบาย (${pct(l.n)}%)`, lx + 24, ly + 21);
    ly += 50;
  }

  y = cy + R + 50;
  const row = (label: string, n: number, bold = false) => {
    ctx.fillStyle = bold ? '#111827' : '#374151';
    ctx.font = f(17, bold ? 700 : 500);
    ctx.fillText(label, px + 32, y);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#111827';
    ctx.font = f(17, 700);
    ctx.fillText(n.toLocaleString('th-TH'), px + pw - 32, y);
    ctx.textAlign = 'left';
    y += 29;
  };
  const section = (label: string) => {
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px + 32, y - 28);
    ctx.lineTo(px + pw - 32, y - 28);
    ctx.stroke();
    ctx.fillStyle = '#111827';
    ctx.font = f(20, 700);
    ctx.fillText(label, px + 32, y);
    y += 34;
  };

  const top = [...withPolicy].sort((p, q) => q[1] - p[1]).slice(0, 5);
  if (top.length) {
    section('จังหวัดที่มีมากที่สุด');
    top.forEach(([name, n]) => row(`จ.${name}`, n));
    y += 22;
  }
  if (types.length) {
    section('รูปแบบที่ระบุไว้');
    const room = Math.max(1, Math.floor((box.y + box.h - 40 - y) / 29));
    const list = types.slice(0, room);
    list.forEach(([t, n]) => row(SHORT[t] ?? t, n));
    const rest = untyped + types.slice(room).reduce((s, [, n]) => s + n, 0);
    if (rest > 0 && y < box.y + box.h - 20) {
      ctx.fillStyle = '#6b7280';
      ctx.font = f(15, 500);
      ctx.fillText(`(อีก ${rest} นโยบายยังไม่ได้ระบุรูปแบบ)`, px + 32, y);
    }
  }

  // ── ท้ายภาพ
  ctx.fillStyle = '#111827';
  ctx.font = f(18, 700);
  ctx.fillText('network.sdnthailand.com', 56, H - 28);
  ctx.fillStyle = '#6b7280';
  ctx.font = f(15, 500);
  ctx.textAlign = 'right';
  ctx.fillText('งานศพปลอดเหล้า · ข้อมูลจากการบันทึกงานของเครือข่าย', W - 40, H - 28);
  ctx.textAlign = 'left';

  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png'));
}
