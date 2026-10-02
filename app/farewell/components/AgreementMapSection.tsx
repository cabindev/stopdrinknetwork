// app/farewell/components/AgreementMapSection.tsx — "คุณไม่ได้เริ่มคนเดียว" แผนที่ภาพนิ่ง (SVG วาดฝั่ง server จากข้อมูลจริง)
// ให้ครอบครัวมั่นใจว่ามีชุมชนทำงานศพปลอดเหล้าจริง ไม่ได้ต้องเริ่มคนเดียว
// ภาพนิ่งแทน Leaflet (ผู้ใช้ขอ "แบบง่าย"): เบา ไม่โหลด tile ไม่ดักการเลื่อนหน้า และอัปเดตเองเมื่อมีพื้นที่ใหม่
// ซูมพอดีกับจุดที่มีจริง (ตอนนี้ = ภาคเหนือ + อีสาน, ผู้ใช้ขอให้เห็นชัด) — มีชุมชนภาคอื่นเพิ่มเมื่อไร กรอบขยายครอบให้เอง
// จุดอยู่ที่จุดกลางตำบล (getAgreementMapData) — ไม่มีชื่อคน/สถานที่ · จุดของงานที่เผยแพร่แล้วกดไปอ่านเรื่องเล่าได้
import Link from 'next/link';
import { MapPin } from 'lucide-react';
import thailandOutline from '@/app/data/thailand-outline.json';
import thailandProvinces from '@/app/data/thailand.json';
import { getAgreementMapData } from '@/app/lib/farewellAgreements';

// ── ฉายพิกัดแบบง่าย (equirectangular ปรับด้วย cos ของละติจูดกลาง) — ระดับประเทศคลาดเคลื่อนน้อยพอสำหรับภาพประกอบ
type Ring = number[][];
const OUTLINE_RINGS = (thailandOutline.geometry.coordinates as number[][][][]).map((poly) => poly[0]);
const ALL = OUTLINE_RINGS.flat();
const MIN_LNG = Math.min(...ALL.map((c) => c[0]));
const MAX_LNG = Math.max(...ALL.map((c) => c[0]));
const MIN_LAT = Math.min(...ALL.map((c) => c[1]));
const MAX_LAT = Math.max(...ALL.map((c) => c[1]));
const K = Math.cos((((MIN_LAT + MAX_LAT) / 2) * Math.PI) / 180);
const FULL_W = 300;
const SCALE = FULL_W / ((MAX_LNG - MIN_LNG) * K);
const FULL_H = (MAX_LAT - MIN_LAT) * SCALE;
const px = (lng: number, lat: number): [number, number] => [(lng - MIN_LNG) * K * SCALE, (MAX_LAT - lat) * SCALE];

interface Box { x0: number; y0: number; x1: number; y1: number }

// แปลงวงพิกัดเป็น path — ตัดจุดที่ห่างกันไม่ถึง minStep (ภาพเล็ก ไม่ต้องละเอียด) · คืน bbox ไว้เลือกเฉพาะจังหวัดในกรอบ
function ringPath(ring: Ring, minStep: number) {
  const pts: [number, number][] = [];
  for (const [lng, lat] of ring) {
    const p = px(lng, lat);
    const last = pts[pts.length - 1];
    if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) >= minStep) pts.push(p);
  }
  if (pts.length < 3) return { d: '', box: null };
  const box: Box = {
    x0: Math.min(...pts.map((p) => p[0])), y0: Math.min(...pts.map((p) => p[1])),
    x1: Math.max(...pts.map((p) => p[0])), y1: Math.max(...pts.map((p) => p[1])),
  };
  // พิกัดสัมพัทธ์ (l dx dy) — ปัดเป็นทศนิยม 1 ตำแหน่ง "ก่อน" หาระยะ ไม่งั้นเศษสะสมจนเส้นเบี้ยว
  // สั้นกว่าพิกัดสัมบูรณ์มาก (path ถูกส่งทั้งใน HTML และ RSC payload)
  const q = pts.map(([x, y]) => [Math.round(x * 10), Math.round(y * 10)]);
  const n = (v: number) => (v / 10).toString().replace(/^(-?)0\./, '$1.');
  const rel = q.slice(1).map((p, i) => `${n(p[0] - q[i][0])} ${n(p[1] - q[i][1])}`);
  return { d: `M${n(q[0][0])} ${n(q[0][1])}l${rel.join(' ')}z`, box };
}

// ทำครั้งเดียวตอนโหลดโมดูล
const OUTLINE_PATH = OUTLINE_RINGS.map((r) => ringPath(r, 1.0).d).join('');
type ProvinceFeature = { geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: unknown } };
const PROVINCES = (thailandProvinces as { features: ProvinceFeature[] }).features.map((f) => {
  const rings: Ring[] =
    f.geometry.type === 'Polygon'
      ? [(f.geometry.coordinates as Ring[])[0]]
      : (f.geometry.coordinates as Ring[][]).map((p) => p[0]);
  const parts = rings.map((r) => ringPath(r, 1.8)).filter((p) => p.box);
  return {
    d: parts.map((p) => p.d).join(''),
    box: parts.reduce<Box>(
      (b, p) => ({ x0: Math.min(b.x0, p.box!.x0), y0: Math.min(b.y0, p.box!.y0), x1: Math.max(b.x1, p.box!.x1), y1: Math.max(b.y1, p.box!.y1) }),
      { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity },
    ),
  };
});

const overlaps = (a: Box, b: Box) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;

export default async function AgreementMapSection({ className = '' }: { className?: string }) {
  const { points, provinces, byRegion } = await getAgreementMapData();
  if (points.length === 0) return null;

  // กรอบภาพ = ขอบเขตของจุด + ขอบเผื่อ แล้วปรับสัดส่วนไม่ให้แคบ/ยาวเกิน (0.75–1.25) และไม่เกินขอบประเทศ
  const xy = points.map((p) => px(p.lng, p.lat));
  const pad = 14;
  let box: Box = {
    x0: Math.min(...xy.map((p) => p[0])) - pad, y0: Math.min(...xy.map((p) => p[1])) - pad,
    x1: Math.max(...xy.map((p) => p[0])) + pad, y1: Math.max(...xy.map((p) => p[1])) + pad,
  };
  const grow = (b: Box, axis: 'x' | 'y', size: number): Box => {
    const [a0, a1] = axis === 'x' ? [b.x0, b.x1] : [b.y0, b.y1];
    const extra = (size - (a1 - a0)) / 2;
    return axis === 'x' ? { ...b, x0: a0 - extra, x1: a1 + extra } : { ...b, y0: a0 - extra, y1: a1 + extra };
  };
  const w0 = box.x1 - box.x0;
  const h0 = box.y1 - box.y0;
  if (w0 / h0 < 0.75) box = grow(box, 'x', h0 * 0.75);
  else if (w0 / h0 > 1.25) box = grow(box, 'y', w0 / 1.25);
  box = { x0: Math.max(-2, box.x0), y0: Math.max(-2, box.y0), x1: Math.min(FULL_W + 2, box.x1), y1: Math.min(FULL_H + 2, box.y1) };
  const vbW = box.x1 - box.x0;
  const r = vbW * 0.013; // ขนาดจุดตามกรอบ (ซูมมาก จุดไม่บวม)
  const shown = PROVINCES.filter((p) => p.d && overlaps(p.box, box));

  // ป้ายชื่อภาค วางที่จุดกึ่งกลางของจุดในภาคนั้น (เลื่อนขึ้นเหนือกลุ่มจุดเล็กน้อย)
  const labels = byRegion
    .filter((g) => g.label !== 'ภาคอื่น')
    .map((g) => {
      const ps = points.filter((p) => p.regionGroup === g.label).map((p) => px(p.lng, p.lat));
      const cx = ps.reduce((s, p) => s + p[0], 0) / ps.length;
      const top = Math.min(...ps.map((p) => p[1]));
      const bottom = Math.max(...ps.map((p) => p[1]));
      // เหนือกลุ่มจุดถ้ามีที่ว่าง ไม่งั้นวางใต้กลุ่ม (ภาคเหนือชิดขอบบนของภาพ ป้ายจะทับจุด)
      const above = top - vbW * 0.035;
      return { text: `${g.label} ${g.count}`, x: cx, y: above > box.y0 + vbW * 0.05 ? above : bottom + vbW * 0.065 };
    });

  return (
    <section aria-labelledby="real-areas" className={className}>
      <h2 id="real-areas" className="text-xl sm:text-2xl font-bold text-gray-900">
        คุณไม่ได้เริ่มคนเดียว
      </h2>
      <p className="mt-2 text-sm sm:text-base leading-relaxed text-gray-600">
        <strong className="text-gray-900">{points.length} ชุมชนใน {provinces} จังหวัด</strong> มีข้อตกลงงานศพปลอดเหล้าแล้ว
        {byRegion.length > 0 && <> — {byRegion.map((g) => `${g.label} ${g.count}`).join(' · ')}</>}
      </p>

      <div className="mt-5 rounded-2xl border border-orange-100 bg-orange-50/50 p-3 sm:p-5">
        <svg
          viewBox={`${box.x0.toFixed(1)} ${box.y0.toFixed(1)} ${vbW.toFixed(1)} ${(box.y1 - box.y0).toFixed(1)}`}
          role="img"
          aria-label={`แผนที่ภาคเหนือและภาคอีสาน จุดสีส้ม ${points.length} จุด คือชุมชนที่มีข้อตกลงงานศพปลอดเหล้า`}
          className="mx-auto block w-full max-w-[560px] h-auto"
        >
          {/* แผ่นดินขาว + เส้นแบ่งจังหวัดจาง ๆ + เส้นขอบประเทศ (นอกกรอบถูกตัดเองด้วย viewBox) */}
          <path d={OUTLINE_PATH} fill="#ffffff" stroke="none" />
          {shown.map((p, i) => (
            <path key={i} d={p.d} fill="none" stroke="#d6d3d1" strokeWidth={0.8} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
          ))}
          <path d={OUTLINE_PATH} fill="none" stroke="#1c1917" strokeOpacity={0.5} strokeWidth={1.2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
          {labels.map((l) => (
            <text
              key={l.text}
              x={l.x}
              y={l.y}
              textAnchor="middle"
              fontSize={vbW * 0.042}
              fontWeight={700}
              fill="#9a3412"
              stroke="#ffffff"
              strokeWidth={vbW * 0.012}
              paintOrder="stroke"
            >
              {l.text}
            </text>
          ))}
          {points.map((p) => {
            const [x, y] = px(p.lng, p.lat);
            const dot = (
              <circle cx={x.toFixed(2)} cy={y.toFixed(2)} r={r} fill="#ea580c" fillOpacity={0.88} stroke="#ffffff" strokeWidth={1.2} vectorEffect="non-scaling-stroke">
                <title>{`${p.title} · ต.${p.district} จ.${p.province}`}</title>
              </circle>
            );
            return p.storyId ? (
              <a key={p.id} href={`/stories/${p.storyId}`} aria-label={`อ่านเรื่องเล่า ${p.title}`}>
                {dot}
              </a>
            ) : (
              <g key={p.id}>{dot}</g>
            );
          })}
        </svg>
        <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-gray-500">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-orange-600" /> ชุมชนที่มีข้อตกลงงานศพปลอดเหล้า (ตำแหน่งระดับตำบล)
        </p>
      </div>

      <Link
        href="/farewell/local"
        className="mt-4 inline-flex items-center gap-2 min-h-11 text-sm font-medium text-orange-700 hover:text-orange-800"
      >
        <MapPin className="w-4 h-4" /> ดูว่าตำบลของคุณมีข้อตกลงแล้วหรือยัง
      </Link>
    </section>
  );
}
