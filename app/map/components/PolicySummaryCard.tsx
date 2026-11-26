'use client';
// การ์ด "มีนโยบาย/ข้อตกลง ระดับไหนบ้าง" มุมขวาของ /map โหมดสรุปจังหวัด (แบบอินโฟกราฟิกที่ผู้ใช้ส่ง 24 พ.ย. 2026)
// พาย SVG ตามระดับ (ตัวเลข = จำนวนนโยบาย) + รายการรูปแบบนโยบาย — นับตามตัวกรองและขอบเขต (เหนือ+อีสาน/ทั้งประเทศ) เดียวกับแผนที่
import { ArrowLeft, Download, List } from 'lucide-react';
import { useCountUp } from '@/app/lib/useCountUp';
import { POLICY_LEVELS } from '@/app/lib/activityMeta';
import { LEVEL_FILL, LEVEL_ON_FILL } from '@/app/lib/policyLevelColors';

/** สีชิ้นพาย — แหล่งเดียวกับแดชบอร์ด (lib/policyLevelColors.ts ชุดเหลือง·เทา·ดำ·ขาว) */
export const SLICE: Record<string, { fill: string; ink: string }> = Object.fromEntries(
  Object.entries(LEVEL_FILL).map(([k, fill]) => [k, { fill, ink: LEVEL_ON_FILL[k as keyof typeof LEVEL_ON_FILL] }]),
);

/** ชื่อสั้นของรูปแบบนโยบาย (POLICY_TYPES ใน activityMeta) ให้พอดีการ์ด */
export const SHORT: Record<string, string> = {
  'ธรรมนูญตำบล/ธรรมนูญสุขภาพ': 'ธรรมนูญตำบล',
  'กติกาชุมชน/ข้อตกลงหมู่บ้าน': 'กติกาชุมชน/ข้อตกลงหมู่บ้าน',
  ข้อตกลงระดับตำบล: 'ข้อตกลงตำบล',
  'MOU/บันทึกข้อตกลง': 'MOU',
  'นโยบายท้องถิ่น (อบต./เทศบาล)': 'นโยบาย อปท.',
  'นโยบาย พชอ.': 'นโยบาย พชอ.',
  'ประกาศ/คำสั่งจังหวัด': 'ประกาศจังหวัด',
  โครงการ: 'โครงการของ อปท./หน่วยงาน', // ผู้ใช้ขอ 24 พ.ย. 2026 — "โครงการ" เฉย ๆ ในภาพสรุปไม่ชัด
  'อื่น ๆ': 'อื่น ๆ',
};

/** แยกนโยบายตามระดับ + รูปแบบ — ใช้ร่วมการ์ดบนจอและภาพสรุปที่ดาวน์โหลด (summaryPoster.ts) */
export function policyBreakdown(policies: { level: string; type: string | null }[]) {
  const total = policies.length;
  const levels = POLICY_LEVELS.map((l) => ({ ...l, n: policies.filter((p) => p.level === l.value).length })).filter((l) => l.n > 0);
  const typeCounts = new Map<string, number>();
  for (const p of policies) if (p.type) typeCounts.set(p.type, (typeCounts.get(p.type) ?? 0) + 1);
  const types = [...typeCounts.entries()].sort((a, b) => b[1] - a[1]);
  const untyped = total - types.reduce((s, [, n]) => s + n, 0);
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);
  return { total, levels, types, untyped, pct };
}

export default function PolicySummaryCard({
  policies,
  province = null,
  areas = [],
  workCount = 0,
  onClear,
  onList,
  title = null,
  onDownload,
  downloading = false,
}: {
  policies: { level: string; type: string | null }[];
  /** จังหวัดที่จิ้ม (null = ภาพรวมทั้งขอบเขต) */
  province?: string | null;
  /** อำเภอ → จำนวนนโยบาย (เฉพาะเมื่อเลือกจังหวัด) */
  areas?: [string, number][];
  workCount?: number;
  onClear?: () => void;
  onList?: () => void;
  /** ภาคที่เลือก (เช่น "อีสานล่าง") — null = ทุกภาคในขอบเขต */
  title?: string | null;
  onDownload?: () => void;
  downloading?: boolean;
}) {
  const { total, levels, types, untyped, pct } = policyBreakdown(policies);
  const shownTotal = useCountUp(total);
  if (!total && !province) return null;

  // ชิ้นพาย: เริ่มที่ 12 นาฬิกา ทวนเข็ม→ตามเข็ม · ชิ้นเดียว = วงกลมเต็ม
  const R = 70;
  const C = 80;
  const starts = levels.map((_, i) => levels.slice(0, i).reduce((sum, l) => sum + l.n, 0));
  const slices = levels.map((l, i) => {
    const a0 = -Math.PI / 2 + (starts[i] / total) * Math.PI * 2;
    const a1 = a0 + (l.n / total) * Math.PI * 2;
    const mid = (a0 + a1) / 2;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const p = (a: number) => `${C + R * Math.cos(a)} ${C + R * Math.sin(a)}`;
    const d = levels.length === 1 ? null : `M ${C} ${C} L ${p(a0)} A ${R} ${R} 0 ${large} 1 ${p(a1)} Z`;
    return { ...l, d, lx: C + R * 0.62 * Math.cos(mid), ly: C + R * 0.62 * Math.sin(mid) };
  });

  return (
    <aside
      aria-label="นโยบายแยกตามระดับ"
      className="absolute right-4 top-16 z-[1000] hidden max-h-[calc(100%-6rem)] w-[300px] overflow-y-auto rounded-2xl border border-gray-200 bg-white/95 p-4 shadow-lg backdrop-blur md:block"
    >
      {province ? (
        <>
          <button
            type="button"
            onClick={onClear}
            className="-ml-1 inline-flex min-h-8 items-center gap-1 rounded-full px-1 text-xs text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> ดูทั้งหมด
          </button>
          <p className="text-lg font-bold leading-snug text-gray-900">จ.{province}</p>
          <p className="text-xs text-gray-500">
            {shownTotal.toLocaleString('th-TH')} นโยบาย · {workCount} งาน
          </p>
        </>
      ) : (
        <>
          {title && <p className="text-lg font-bold leading-snug text-gray-900">{title}</p>}
          <p className={title ? 'text-sm font-semibold text-gray-900' : 'text-base font-bold leading-snug text-gray-900'}>มีนโยบาย/ข้อตกลง ระดับไหนบ้าง</p>
          <p className="text-xs text-gray-500">จาก {shownTotal.toLocaleString('th-TH')} นโยบาย · จิ้มจังหวัดเพื่อดูรายจังหวัด</p>
        </>
      )}
      {province && !total && <p className="mt-3 rounded-xl bg-gray-50 p-3 text-sm text-gray-600">จังหวัดนี้ยังไม่มีนโยบาย/ข้อตกลงที่บันทึกไว้</p>}

      {total > 0 && (
        <div className="mt-2 flex items-center gap-3">
          {/* key ตามข้อมูล = พายหมุนเข้าใหม่ทุกครั้งที่เปลี่ยนภาค/จังหวัด (motion — globals.css .sdn-pie-in) */}
          <svg key={levels.map((l) => `${l.value}${l.n}`).join('|')} viewBox="0 0 160 160" className="sdn-pie-in h-32 w-32 shrink-0" role="img" aria-label="สัดส่วนนโยบายตามระดับ">
            {slices.map((s) =>
              s.d ? (
                <path key={s.value} d={s.d} fill={SLICE[s.value].fill} stroke="#111827" strokeWidth={1.5} />
              ) : (
                <circle key={s.value} cx={C} cy={C} r={R} fill={SLICE[s.value].fill} stroke="#111827" strokeWidth={1.5} />
              ),
            )}
            {slices
              .filter((s) => s.n / total >= 0.08)
              .map((s) => (
                <text
                  key={s.value}
                  x={s.d ? s.lx : C}
                  y={s.d ? s.ly : C}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={15}
                  fontWeight={800}
                  fill={SLICE[s.value].ink}
                >
                  {pct(s.n)}%
                </text>
              ))}
          </svg>
          <ul className="min-w-0 space-y-1.5 text-xs">
            {[...levels]
              .sort((a, b) => b.n - a.n)
              .map((l) => (
                <li key={l.value} className="flex items-start gap-1.5">
                  <span className="mt-0.5 h-3 w-3 shrink-0 rounded-full ring-1 ring-gray-900" style={{ background: SLICE[l.value].fill }} />
                  <span>
                    <span className="font-semibold text-gray-900">ระดับ{l.label}</span>
                    <span className="block tabular-nums text-gray-500">
                      {l.n} นโยบาย ({pct(l.n)}%)
                    </span>
                  </span>
                </li>
              ))}
          </ul>
        </div>
      )}

      {areas.length > 0 && (
        <div className="mt-3 border-t border-gray-100 pt-3">
          <p className="text-sm font-semibold text-gray-900">อำเภอที่มีนโยบาย</p>
          <ul className="mt-1 space-y-0.5 text-xs text-gray-700">
            {areas.map(([a, n]) => (
              <li key={a} className="flex justify-between gap-2">
                <span className="truncate">อ.{a}</span>
                <span className="shrink-0 tabular-nums font-medium text-gray-900">{n}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {types.length > 0 && (
        <div className="mt-3 border-t border-gray-100 pt-3">
          <p className="text-sm font-semibold text-gray-900">รูปแบบที่ระบุไว้</p>
          <ul className="mt-1 space-y-0.5 text-xs text-gray-700">
            {types.map(([t, n]) => (
              <li key={t} className="flex justify-between gap-2">
                <span className="truncate">{SHORT[t] ?? t}</span>
                <span className="shrink-0 tabular-nums font-medium text-gray-900">{n}</span>
              </li>
            ))}
          </ul>
          {untyped > 0 && <p className="mt-1 text-xs text-gray-500">(อีก {untyped} นโยบายยังไม่ได้ระบุรูปแบบ)</p>}
        </div>
      )}

      {!province && onDownload && total > 0 && (
        <button
          type="button"
          onClick={onDownload}
          disabled={downloading}
          className="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-full bg-gray-900 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-60"
        >
          <Download className="w-4 h-4" /> {downloading ? 'กำลังสร้างภาพ…' : `ดาวน์โหลดภาพสรุป${title ? ` ${title}` : ''}`}
        </button>
      )}

      {province && workCount > 0 && (
        <button
          type="button"
          onClick={onList}
          className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-full border border-gray-300 text-sm text-gray-900 hover:bg-gray-50"
        >
          <List className="w-4 h-4" /> ดูรายชื่องาน ({workCount})
        </button>
      )}
    </aside>
  );
}
