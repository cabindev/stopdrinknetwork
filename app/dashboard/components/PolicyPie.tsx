// app/dashboard/components/PolicyPie.tsx — พายนโยบายงานศพแยกระดับ (server component, SVG ล้วน ไม่ต้องใช้ JS)
// ใช้ทั้งหน้า /dashboard/policies และหน้าแรกแดชบอร์ด · ขนาดชิ้น = จำนวนนโยบาย · แต่ละชิ้นเป็นลิงก์ (href ของผู้เรียก)
import { POLICY_LEVELS } from '@/app/lib/activityMeta';

export type Level = (typeof POLICY_LEVELS)[number]['value'];

// สีชิ้นพาย: ไล่โทนเทา→ดำตามขนาดพื้นที่ (ระดับมีลำดับ — สีไล่โทนสื่อลำดับ ไม่ใช่สีแยกกลุ่ม) ตามธีมขาวดำของหน้านี้
// ชิ้นสีอ่อนตัดพื้นขาวน้อย (validator: contrast WARN) → ชดเชยด้วยเส้นขาวคั่นชิ้น + คำอธิบายมีตัวเลข + ตารางรายการ
export const LEVEL_FILL: Record<Level, string> = {
  VILLAGE: '#d4d4d4',
  SUBDISTRICT: '#a3a3a3',
  DISTRICT: '#737373',
  PROVINCE: '#404040',
  NATIONAL: '#141413',
};

// พาย SVG ฝั่ง server — แต่ละชิ้นเป็นลิงก์ ?level= · ชิ้นที่เลือกดันออกจากวง · <title> = คำอธิบายเมื่อชี้
export default function PolicyPie({
  counts,
  selected,
  href,
  detail,
}: {
  counts: Record<Level, number>;
  selected: Level | null;
  href: (l: Level | null) => string;
  /** โหมดเต็ม (แดชบอร์ด — ไม่มีกล่องคำอธิบายข้าง ๆ): เขียนชื่อระดับ/จำนวน/พื้นที่ลงในพายเลย
   *  ค่า = บรรทัดพื้นที่ของระดับนั้น เช่น "21 ตำบล" (ว่างได้) · ชิ้นเล็กเขียนนอกวงพร้อมเส้นชี้ */
  detail?: Partial<Record<Level, string>>;
}) {
  const total = POLICY_LEVELS.reduce((n, { value }) => n + counts[value], 0);
  const R = 100;
  const C = 120;
  if (total === 0) {
    return (
      <svg viewBox="0 0 240 240" className="mx-auto w-full max-w-[260px]" role="img" aria-label="ยังไม่มีนโยบาย">
        <circle cx={C} cy={C} r={R} fill="#f5f5f5" />
      </svg>
    );
  }
  // มุมเริ่มของแต่ละชิ้น = ผลรวมสะสมของชิ้นก่อนหน้า (คำนวณล่วงหน้า ไม่แก้ตัวแปรระหว่าง render)
  const present = POLICY_LEVELS.filter(({ value }) => counts[value] > 0);
  const starts = present.map((_, i) =>
    -Math.PI / 2 + (present.slice(0, i).reduce((n, { value }) => n + counts[value], 0) / total) * Math.PI * 2,
  );
  const slices = present.map(({ value, label }, i) => {
    const a0 = starts[i];
    const a1 = a0 + (counts[value] / total) * Math.PI * 2;
    const mid = (a0 + a1) / 2;
    const push = selected === value ? 8 : 0;
    const ox = Math.cos(mid) * push;
    const oy = Math.sin(mid) * push;
    const pt = (a: number) => `${(C + ox + Math.cos(a) * R).toFixed(2)},${(C + oy + Math.sin(a) * R).toFixed(2)}`;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const d =
      counts[value] === total
        ? `M${C + R},${C}A${R},${R} 0 1 1 ${C - R},${C}A${R},${R} 0 1 1 ${C + R},${C}Z`
        : `M${(C + ox).toFixed(2)},${(C + oy).toFixed(2)}L${pt(a0)}A${R},${R} 0 ${large} 1 ${pt(a1)}Z`;
    // ป้ายเปอร์เซ็นต์บนชิ้นที่ใหญ่พอ — สีตัวอักษรตามความเข้มของชิ้น
    const pct = Math.round((counts[value] / total) * 100);
    const lx = C + ox + Math.cos(mid) * R * 0.62;
    const ly = C + oy + Math.sin(mid) * R * 0.62;
    const dark = value === 'DISTRICT' || value === 'PROVINCE' || value === 'NATIONAL';
    // โหมดเต็ม: ชิ้นกว้างพอ (> ~45°) เขียนข้างใน · ชิ้นแคบเขียนนอกวง (เส้นชี้จากขอบวง)
    const inside = a1 - a0 > 0.8;
    const cos = Math.cos(mid);
    const sin = Math.sin(mid);
    const out = {
      x0: C + ox + cos * (R + 2),
      y0: C + oy + sin * (R + 2),
      x1: C + ox + cos * (R + 14),
      y1: C + oy + sin * (R + 14),
      // ชิ้นที่อยู่เกือบบน/ล่างสุด: ข้อความจัดกึ่งกลางเหนือ/ใต้ปลายเส้นชี้ (ไม่ทับเส้น)
      vertical: Math.abs(cos) < 0.4,
      anchor: (Math.abs(cos) < 0.4 ? 'middle' : cos >= 0 ? 'start' : 'end') as 'start' | 'end' | 'middle',
      tx: C + ox + cos * (R + 14) + (Math.abs(cos) < 0.4 ? 0 : cos >= 0 ? 4 : -4),
      up: sin < 0,
    };
    const ix = C + ox + cos * R * 0.58;
    const iy = C + oy + sin * R * 0.58;
    return { value, label, d, pct, lx, ly, dark, show: a1 - a0 > 0.35, inside, out, ix, iy };
  });
  if (detail) {
    // กรอบภาพเผื่อที่เฉพาะด้านที่มีป้ายนอกวง (ป้ายสูงสุด 3 บรรทัด ≈ 36 หน่วย) — ไม่มีป้ายก็ไม่มีที่ว่างเกิน
    const outside = slices.filter((x) => !x.inside);
    const top = Math.min(10, ...outside.map((x) => (x.out.vertical && x.out.up ? x.out.y1 - 46 : x.out.y1 - 22)));
    const bottom = Math.max(230, ...outside.map((x) => (x.out.vertical && !x.out.up ? x.out.y1 + 44 : x.out.y1 + 22)));
    return (
      <svg
        viewBox={`-80 ${top.toFixed(0)} 400 ${(bottom - top).toFixed(0)}`}
        className="mx-auto w-full max-w-[420px]"
        role="img"
        aria-label="สัดส่วนนโยบายแยกตามระดับ"
      >
        {slices.map((s) => {
          const lines = [`${s.label} ${s.pct}%`, `${counts[s.value]} นโยบาย`, detail[s.value]].filter(Boolean) as string[];
          return (
            <a key={s.value} href={href(s.value)} aria-label={`ระดับ${s.label} ${counts[s.value]} นโยบาย`}>
              <path d={s.d} fill={LEVEL_FILL[s.value]} stroke="#ffffff" strokeWidth={2} className="cursor-pointer transition-opacity hover:opacity-85">
                <title>{`ระดับ${s.label}: ${lines.slice(1).join(' · ')} (${s.pct}%) — จิ้มเพื่อดูพื้นที่ทั้งหมด`}</title>
              </path>
              {s.inside ? (
                <text x={s.ix} y={s.iy - (lines.length - 1) * 7} textAnchor="middle" className="pointer-events-none" fill={s.dark ? '#ffffff' : '#141413'}>
                  {lines.map((t, i) => (
                    <tspan key={i} x={s.ix} dy={i === 0 ? 0 : 14} className={i === 0 ? 'text-[12px] font-semibold' : 'text-[10.5px]'}>
                      {t}
                    </tspan>
                  ))}
                </text>
              ) : (
                <>
                  <line x1={s.out.x0} y1={s.out.y0} x2={s.out.x1} y2={s.out.y1} stroke="#737373" strokeWidth={1} />
                  <text
                    x={s.out.tx}
                    y={s.out.vertical ? (s.out.up ? s.out.y1 - 6 - (lines.length - 1) * 12 : s.out.y1 + 14) : s.out.y1 - (lines.length - 1) * 6}
                    textAnchor={s.out.anchor}
                    className="pointer-events-none"
                    fill="#141413"
                  >
                    {lines.map((t, i) => (
                      <tspan key={i} x={s.out.tx} dy={i === 0 ? 0 : 12} className={i === 0 ? 'text-[11px] font-semibold' : 'text-[10px]'} fill={i === 0 ? '#141413' : '#525252'}>
                        {t}
                      </tspan>
                    ))}
                  </text>
                </>
              )}
            </a>
          );
        })}
      </svg>
    );
  }
  return (
    <svg viewBox="-10 -10 260 260" className="mx-auto w-full max-w-[260px]" role="img" aria-label="สัดส่วนนโยบายแยกตามระดับ">
      {slices.map((s) => (
        <a key={s.value} href={href(selected === s.value ? null : s.value)} aria-label={`ระดับ${s.label} ${counts[s.value]} นโยบาย`}>
          <path
            d={s.d}
            fill={LEVEL_FILL[s.value]}
            stroke="#ffffff"
            strokeWidth={2}
            className="cursor-pointer transition-opacity hover:opacity-85"
            opacity={selected && selected !== s.value ? 0.45 : 1}
          >
            <title>{`ระดับ${s.label}: ${counts[s.value]} นโยบาย (${s.pct}%)`}</title>
          </path>
          {s.show && (
            <text
              x={s.lx}
              y={s.ly}
              textAnchor="middle"
              dominantBaseline="middle"
              className="pointer-events-none text-[13px] font-semibold"
              fill={s.dark ? '#ffffff' : '#141413'}
            >
              {s.pct}%
            </text>
          )}
        </a>
      ))}
    </svg>
  );
}
