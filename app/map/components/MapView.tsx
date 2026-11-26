'use client';

// แผนที่รวมการดำเนินงานทั้งองค์กร — เต็มความสูงจอ ควบคุมด้วยแผงลอยบนแผนที่
// ใช้ Leaflet ล้วน (โหลดใน useEffect เพื่อเลี่ยง SSR)

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type {
  Map as LeafletMap,
  GeoJSON as GeoJSONLayer,
  CircleMarker,
  Marker,
  LatLngBounds,
} from 'leaflet';
import {
  MapPin,
  Users,
  Layers,
  ImageDown,
  X,
  FileSpreadsheet,
  Search,
  Flame,
  LayoutGrid,
  Play,
  CalendarClock,
  CheckCircle2,
  Sparkles,
  CircleDot,
  Check,
  Download,
  MonitorPlay,
} from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import thailandGeo from '@/app/data/thailand.json';
// เส้นขอบประเทศ (รวม 77 จังหวัดไว้ล่วงหน้า — scripts/build-thailand-outline.mjs) ใช้วาดขอบเข้ม + ฉากจางนอกประเทศ
import thailandOutline from '@/app/data/thailand-outline.json';
import { getRegionLabel, provinceHealthZones } from '@/app/utils/healthZones';
import { makeColorOf } from '@/app/lib/categoryColors';
import type { HealthZone } from '@/app/utils/healthZones';
import { navigationUrl } from '@/app/lib/geoLink';
import { POLICY_LEVELS, POLICY_LABEL } from '@/app/lib/activityMeta';
import { LEVEL_FILL, LEVEL_ON_FILL, LEVEL_STROKE } from '@/app/lib/policyLevelColors';
import { pinTitle } from '@/app/lib/funeralPins';
import FamilyPinPanel from './FamilyPinPanel';
import ExpoMode from './ExpoMode';
import PolicySummaryCard from './PolicySummaryCard';
import { useCountUp } from '@/app/lib/useCountUp';
import { drawSummaryPoster } from './summaryPoster';
import type { PublicPin } from '@/app/lib/funeralPins';
import { toast } from 'react-hot-toast';
import NextImage from 'next/image';

export interface MapActivity {
  id: number;
  title: string;
  status: string;
  category: string;
  subCategory: string | null; // ประเด็นย่อย เช่น งานศพปลอดเหล้า
  userName: string;
  areaName: string | null;
  district: string;
  amphoe: string;
  province: string;
  region: string;
  latitude: number | null;
  longitude: number | null;
  locationSource: string; // TAMBON = จุดกลางตำบล (โดยประมาณ)
  createdAt: string; // ISO
  mine: boolean; // งานของผู้ที่กำลังดู — ไม่นับเป็น "งานใหม่"
  published: boolean; // เผยแพร่เป็นกรณีศึกษาแล้ว → มีหน้า /stories/[id]
  policyCount?: number; // จำนวนนโยบาย/ข้อตกลงของงาน (โหมดสรุปรายจังหวัด)
  policies?: { level: string; type: string | null }[];
  policyLevel: string | null; // ระดับนโยบายสูงสุด (VILLAGE…NATIONAL) — null = ยังไม่มีนโยบาย
  // พื้นที่ที่เกี่ยวข้อง (ActivityArea) — หมุดรองของงานเดียวกัน ไม่นับในสถิติ/ความหนาแน่น/แผงจังหวัด
  extraAreas: MapArea[];
}

export interface MapArea {
  areaName: string | null;
  district: string;
  amphoe: string;
  province: string;
  latitude: number | null;
  longitude: number | null;
  locationSource: string;
  note: string | null;
}

// จุดที่วาดหมุด 1 จุด: พื้นที่หลักของงาน หรือพื้นที่ที่เกี่ยวข้อง (extra)
interface MapSite {
  a: MapActivity;
  latitude: number | null;
  longitude: number | null;
  locationSource: string;
  extra: MapArea | null;
}

interface MapViewProps {
  activities: MapActivity[];
  pins?: PublicPin[];
  /** หมุดครอบครัวที่ผู้ชมแก้ได้ (ของตัวเอง) — แอดมินแก้ได้ทุกหมุดผ่าน canManagePins */
  myPinIds?: number[];
  canManagePins?: boolean;
  categories: string[];
  categoryLogos: Record<string, string>; // ชื่อหมวด → URL โลโก้ (เฉพาะหมวดที่มี)
  subCategoryLogos: Record<string, string>; // "หมวด|ประเด็นย่อย" → URL โลโก้ (ใช้ก่อนโลโก้หมวด)
  // ไม่ได้ล็อกอิน: ข้อมูลถูกกรองจาก server แล้ว (ไม่มีชื่อคน/หมุดจริง) — ซ่อน UI ที่อิงข้อมูลเหล่านั้น
  // + คลิกงาน → กรณีศึกษา (ไม่มีหน้า /activity ให้คนทั่วไป)
  publicView?: boolean;
}

const STATUS_LABEL: Record<string, string> = {
  PLANNING: 'วางแผน',
  ACTIVE: 'กำลังดำเนินการ',
  COMPLETED: 'เสร็จสิ้น',
};

const PROVINCE_COLOR = '#ea580c'; // orange-600 — หมุดรวมรายจังหวัด

// โหมดความหนาแน่น (choropleth) — ไล่เฉดส้ม 5 ขั้น, 0 = เทาอ่อน (เห็น "ช่องว่าง" ชัด)
const HEAT_RAMP = ['#ffedd5', '#fed7aa', '#fb923c', '#f97316', '#c2410c'];
const HEAT_EMPTY = '#f3f4f6';

// ชิปกรองสถานะบนแถบค้นหา (แบบ Google Maps)
const STATUS_CHIPS = [
  { value: '', label: 'ทั้งหมด', Icon: LayoutGrid },
  { value: 'ACTIVE', label: 'กำลังดำเนินการ', Icon: Play },
  { value: 'PLANNING', label: 'วางแผน', Icon: CalendarClock },
  { value: 'COMPLETED', label: 'เสร็จสิ้น', Icon: CheckCircle2 },
] as const;
function heatColor(value: number, max: number) {
  if (value <= 0) return HEAT_EMPTY;
  const idx = Math.min(HEAT_RAMP.length - 1, Math.ceil((value / max) * HEAT_RAMP.length) - 1);
  return HEAT_RAMP[Math.max(0, idx)];
}


// ── งานใหม่: นับจาก "ครั้งก่อนที่คนนี้เปิดแผนที่" (เก็บใน localStorage ของแต่ละเครื่อง)
// baseline ของแท็บเก็บใน sessionStorage — รีเฟรชหน้าแล้วงานใหม่ยังไฮไลต์อยู่ ไม่หายทันที
// ครั้งแรกที่เปิด = งาน 7 วันล่าสุด · เพดาน 14 วัน (หายไปนานไม่ให้ทั้งแผนที่กลายเป็น "ใหม่")
const SEEN_KEY = 'sdn:map:lastSeen';
const BASELINE_KEY = 'sdn:map:baseline';
const DAY = 24 * 60 * 60 * 1000;
function readNewBaseline(): number {
  const now = Date.now();
  let baseline = now - 7 * DAY;
  try {
    const session = Number(sessionStorage.getItem(BASELINE_KEY));
    if (session) return Math.max(session, now - 14 * DAY);
    const lastSeen = Number(localStorage.getItem(SEEN_KEY));
    if (lastSeen) baseline = lastSeen;
    sessionStorage.setItem(BASELINE_KEY, String(baseline));
    localStorage.setItem(SEEN_KEY, String(now));
  } catch {
    // storage ถูกปิด (โหมดส่วนตัว ฯลฯ) → ใช้ 7 วันล่าสุด
  }
  return Math.max(baseline, now - 14 * DAY);
}

// วงกระเพื่อมรอบหมุดงานใหม่ — เก็บไว้ใน options.sdn ให้ตอนส่งออก PNG วาดวงแทนอนิเมชัน
interface PulseSpec {
  kind: 'pulse';
}
// หมุดโลโก้ (หมวดที่แอดมินใส่โลโก้ไว้) — วงกลมขาวใส่โลโก้ สี/ขนาดตามระดับนโยบาย (LEVEL_PIN)
interface LogoSpec {
  kind: 'logo';
  color: string;
  approx: boolean;
  fill: string;
  dashed: boolean;
  size: number;
}
// วงตัวเลขรวมหมุดที่ทับกัน (export PNG วาดจาก spec นี้)
interface ClusterSpec {
  kind: 'cluster';
  n: number;
  size: number;
}
/** ระยะบนจอ (px) ที่ถือว่าหมุดทับกัน → รวมเป็นวงตัวเลข · ซูมตั้งแต่ระดับนี้ไม่รวมแล้ว (เห็นทุกงานแยกกัน) */
const CLUSTER_RADIUS = 26;
const CLUSTER_OFF_ZOOM = 10;
// หมุดโลโก้แยกตามระดับนโยบาย = วงกลมทึบสีระดับ ขอบดำ + สัญลักษณ์ข้างใน (26 พ.ย. 2026 — ผู้ใช้เห็นด้วยหลังตรวจหน้าเว็บจริง)
// เดิม (4 พ.ย.) เป็นโลโก้ล้วนระบายสี: ย่อ 28px แล้วอ่านเป็น "ป้ายห้าม/กากบาท", ตำบล↔จังหวัด และ อำเภอ↔ไม่มีนโยบาย แยกไม่ออก
// สีพื้น = LEVEL_FILL ชุดเดียวกับแดชบอร์ด (หมู่บ้าน ขาวเทา · ตำบล เหลือง · อำเภอ เทา · จังหวัด เหลืองอ่อน · ประเทศ ดำ) · ink = สีสัญลักษณ์บนพื้น
// ขนาดโตขึ้นตามระดับ (อ่านลำดับได้แม้ตาบอดสี) · ยังไม่มีนโยบาย = วงขาวขอบประ (กลวง)
const LEVEL_SIZE: Record<string, number> = { VILLAGE: 22, SUBDISTRICT: 25, DISTRICT: 28, PROVINCE: 32, NATIONAL: 36 };
type LevelPinStyle = { fill: string; ink: string; size: number; dashed: boolean };
const LEVEL_PIN: Record<string, LevelPinStyle> = Object.fromEntries(
  Object.entries(LEVEL_FILL).map(([lv, fill]) => [lv, { fill, ink: LEVEL_ON_FILL[lv as keyof typeof LEVEL_ON_FILL], size: LEVEL_SIZE[lv], dashed: false }])
);
const NO_POLICY_PIN: LevelPinStyle = { fill: '#ffffff', ink: '#374151', size: 20, dashed: true };
const NO_POLICY = '__none';
const levelPin = (level: string | null) => (level && LEVEL_PIN[level]) || NO_POLICY_PIN;
// เส้นขอบประเทศบาง ๆ สีเกือบดำ — แค่พอสังเกตขอบเขต ไม่ให้หน้าตาแผนที่ต่างจากเดิม (ผู้ใช้ไม่เอาฉากจางนอกประเทศ)
// ไม่ใช้ส้ม — ส้มสงวนไว้ให้ข้อมูล (หมุด/ความหนาแน่น/จังหวัดที่เลือก)
const COUNTRY_LINE = { color: '#1c1917', weight: 1.2, opacity: 0.55 };
const PROVINCE_LINE = { color: '#d1d5db', weight: 1 };
// โหมดหมุด: เส้นขอบบาง สีเทาปกติ ไม่ระบายพื้น (ผู้ใช้เลือก 4 พ.ย. 2026 — ลองพื้นเทาไล่ขั้น/เส้นไล่หนา/เส้นพาสเทลประจำภาคแล้วไม่เอา "ดูยาก")
// มีงาน = เทาเข้มกว่าเล็กน้อย · เลือกอยู่ = พื้นส้มอ่อน+เส้นส้ม (ผู้ใช้ชอบ) · fillOpacity 0 แต่ยัง fill ไว้ให้คลิก/tooltip ทั้งพื้นที่ได้ · ใช้ทั้งบนจอและ PNG
/** ภาคที่เน้นในโหมดสรุปรายจังหวัด (ผู้ใช้ขอ 24 พ.ย. 2026 — งานส่วนใหญ่อยู่เหนือ+อีสาน) */
const FOCUS_ZONES = new Set(['north-upper', 'north-lower', 'northeast-upper', 'northeast-lower']);
/** ปุ่มภาคบนแผนที่ (โหมดสรุป ขอบเขตเหนือ+อีสาน) — วางนอกเส้นเขตแดน: เหนือ = ฝั่งพม่า ชิดขวา, อีสานบน = ฝั่งลาว, อีสานล่าง = ฝั่งกัมพูชา */
const ZONE_BUTTONS: { zone: HealthZone; at: [number, number]; align: 'end' | 'center' }[] = [
  { zone: 'north-upper', at: [19.05, 97.3], align: 'end' },
  { zone: 'north-lower', at: [16.25, 98.45], align: 'end' },
  { zone: 'northeast-upper', at: [18.7, 103.0], align: 'center' },
  { zone: 'northeast-lower', at: [13.9, 104.3], align: 'center' },
];
const ALL_ZONES: HealthZone[] = ['north-upper', 'north-lower', 'northeast-upper', 'northeast-lower', 'central', 'east', 'west', 'south-upper', 'south-lower', 'bangkok'];
/** โหมดสรุป: ชื่อจังหวัดที่ชนกัน (จังหวัดเล็กติดกัน เช่น ยโสธร/อำนาจเจริญ) → เลื่อนป้ายหลังลงทีละบรรทัด
 *  ใช้ top (ตำแหน่งเต็มพิกเซล) ไม่ใช้ transform ให้ตัวหนังสือคม · เรียกหลังวาดและทุกครั้งที่ซูมเสร็จ */
function declutterSumNames(container: HTMLElement) {
  const els = [...container.querySelectorAll<HTMLElement>('.sdn-sum-name')];
  for (const el of els) {
    el.style.top = '0px';
    el.style.left = '0px';
  }
  // จังหวัดที่มีนโยบายได้ที่ก่อน
  els.sort((a, b) => Number(b.classList.contains('sdn-sum-on')) - Number(a.classList.contains('sdn-sum-on')));
  // วงตัวเลขเป็นสิ่งกีดขวางด้วย (ชื่อไม่ไปมุดใต้วงของจังหวัดข้าง ๆ) — ชื่อเลื่อนลงได้ 4 บรรทัด
  // ใช้ขนาดจริงของวง (offsetWidth) รอบจุดกลาง — ระหว่างแอนิเมชันเด้ง (scale 0→1) getBoundingClientRect ยังเล็กเกือบศูนย์
  const placed: { left: number; right: number; top: number; bottom: number }[] = [...container.querySelectorAll<HTMLElement>('.sdn-sum-pin')].map((e) => {
    const r = e.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const h = e.offsetWidth / 2;
    return { left: cx - h, right: cx + h, top: cy - h, bottom: cy + h };
  });
  for (const el of els) {
    if (el.offsetParent === null) continue; // ซ่อนอยู่ (มือถือยังไม่ซูม)
    // ตำแหน่งที่ลอง: ใต้วง (เดิม) → ข้างวง ซ้าย/ขวา (กลางแนววง — อ่านชัดว่าเป็นของวงไหน) → เหนือวง → ลงทีละบรรทัด
    const box = el.getBoundingClientRect();
    const h = Math.round(box.height) + 1;
    const pin = el.previousElementSibling as HTMLElement | null;
    const pw = pin?.offsetWidth ?? 0;
    const ph = pin?.offsetHeight ?? 0;
    const side = -Math.round(ph / 2 + 2 + box.height / 2);
    const dx = Math.round(pw / 2 + box.width / 2 + 4);
    const tries: [number, number][] = pin
      ? [[0, 0], [-dx, side], [dx, side], [0, -(ph + h + 3)], [0, h], [0, 2 * h]]
      : [[0, 0], [0, h], [0, -h], [0, 2 * h]];
    for (const [x, y] of tries) {
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      const r = el.getBoundingClientRect();
      if (!placed.some((q) => r.left < q.right - 1 && r.right > q.left + 1 && r.top < q.bottom - 1 && r.bottom > q.top + 1)) break;
    }
    placed.push(el.getBoundingClientRect());
  }
}
/** ลำดับวนของจอบูธ (/map?mode=summary&booth=1): ภาพรวม → ทีละภาคที่มีนโยบาย */
const BOOTH_STEP_MS = 9000;
/** จอจัดแสดง (?expo=1) เน้นภาคไหนเมื่อไม่ระบุ &zones= */
const EXPO_DEFAULT_ZONES: HealthZone[] = ['northeast-upper', 'northeast-lower'];
const BOOTH_PAUSE_MS = 30000;
const zoneShort = (z: HealthZone) => getRegionLabel(z).replace(/^ภาค/, '');

function provinceStyle(hasData: boolean, isSelected: boolean) {
  if (isSelected) return { fillColor: '#ea580c', fillOpacity: 0.12, color: '#ea580c', weight: 2.5 };
  return hasData
    ? { fillColor: '#ffffff', fillOpacity: 0, color: '#78716c', weight: 1 }
    : { fillColor: '#ffffff', fillOpacity: 0, color: '#d6d3d1', weight: 0.8 };
}
// วงนอกของแผ่นดินใหญ่ + เกาะ ([lng, lat]) — ใช้วาดเส้นขอบประเทศใน PNG
const OUTLINE_RINGS = (thailandOutline.geometry.coordinates as number[][][][]).map((p) => p[0]);

// delay = มิลลิวินาที (หมุดทยอยหล่นลงจากเหนือลงใต้ — globals.css .sdn-anim) · null = ไม่เล่นแอนิเมชัน
const logoPinHtml = (src: string, pin: LevelPinStyle, approx: boolean, size: number, delay: number | null = null) =>
  `<div class="sdn-logo-pin${pin.dashed ? ' sdn-logo-pin--none' : ''}${approx ? ' sdn-logo-pin--approx' : ''}${delay != null ? ' sdn-anim' : ''}" style="--fill:${pin.fill};--stroke:${LEVEL_STROKE};width:${size}px;height:${size}px${delay != null ? `;--d:${delay}ms` : ''}"><img src="${esc(src)}" alt="" draggable="false"></div>`;
/** หน่วงตามละติจูด: เหนือสุด (~20.5) ขึ้นก่อน ใต้สุด (~5.6) หลังสุด ~1 วิ + กระจายเล็กน้อยไม่ให้ขึ้นเป็นแถว */
const waveDelay = (lat: number, i: number) => Math.round(Math.max(0, Math.min(1, (20.6 - lat) / 15)) * 1000 + (i % 7) * 18);

// ระบายสีโลโก้ (โลโก้ขาวดำ): สูตร screen ทีละพิกเซล → ดำ = สี, ขาว = ขาว, โปร่งใสคงโปร่งใส · ได้ data URL (cache ต่อโลโก้+สี)
// โลโก้มาจาก /api/files หรือ /api/public-logo (same-origin) จึงอ่านพิกเซลได้ · โหลดพลาด = ใช้โลโก้เดิม
const tintCache = new Map<string, Promise<string>>();
function tintLogo(src: string, color: string): Promise<string> {
  const key = `${src}|${color}`;
  let p = tintCache.get(key);
  if (!p) {
    p = new Promise<string>((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const c = document.createElement('canvas');
          c.width = img.naturalWidth;
          c.height = img.naturalHeight;
          const ctx = c.getContext('2d')!;
          ctx.drawImage(img, 0, 0);
          const data = ctx.getImageData(0, 0, c.width, c.height);
          const t = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
          const px = data.data;
          for (let i = 0; i < px.length; i += 4) {
            for (let j = 0; j < 3; j++) px[i + j] = 255 - ((255 - px[i + j]) * (255 - t[j])) / 255;
          }
          ctx.putImageData(data, 0, 0);
          resolve(c.toDataURL());
        } catch {
          resolve(src);
        }
      };
      img.onerror = () => resolve(src);
      img.src = src;
    });
    tintCache.set(key, p);
  }
  return p;
}

// escape ข้อความจากผู้ใช้ก่อนใส่ลง HTML ของ popup (กัน XSS)
const esc = (v: unknown) =>
  String(v ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string
  );

// เนื้อหา popup ของหมุดรายงาน
function activityPopupHtml(a: MapActivity, color: string, isNew: boolean, publicView: boolean, extra: MapArea | null = null) {
  // หมุดรอง: บอกตำแหน่งของพื้นที่นั้น + บทบาท แล้วลิงก์ไปงานเดียวกัน
  const place = extra ?? a;
  const area = place.areaName ? `${esc(place.areaName)} · ` : '';
  const extraLine = extra
    ? `<div style="font-size:11px;color:#c2410c;margin-top:4px">พื้นที่ที่เกี่ยวข้องของงานนี้${extra.note ? ` · ${esc(extra.note)}` : ''}</div>`
    : a.extraAreas.length > 0
      ? `<div style="font-size:11px;color:#c2410c;margin-top:4px">และพื้นที่ที่เกี่ยวข้องอีก ${a.extraAreas.length} แห่ง</div>`
      : '';
  const newBadge = isNew
    ? '<span style="font-size:10px;font-weight:700;color:#fff;background:#ea580c;border-radius:9999px;padding:1px 7px">ใหม่</span>'
    : '';
  return `
    <div style="min-width:190px;font-family:inherit">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
        <span style="width:9px;height:9px;border-radius:50%;background:${color};flex:none"></span>
        <span style="font-size:11px;color:#4b5563;font-weight:600">${esc(a.category)}${a.subCategory ? ` › ${esc(a.subCategory)}` : ''}</span>
        ${newBadge}
        <span style="margin-left:auto;font-size:11px;color:#9ca3af">${esc(
          STATUS_LABEL[a.status] ?? a.status
        )}</span>
      </div>
      <div style="font-size:13px;font-weight:600;color:#1f2937;line-height:1.4">${esc(a.title)}</div>
      <div style="font-size:11px;color:#6b7280;margin-top:5px">${area}ต.${esc(place.district)} อ.${esc(
        place.amphoe
      )} จ.${esc(place.province)}</div>
      ${extraLine}
      ${a.policyLevel ? `<div style="display:flex;align-items:center;gap:5px;font-size:11px;color:#374151;margin-top:4px"><span style="width:10px;height:10px;box-sizing:border-box;border-radius:50%;background:${levelPin(a.policyLevel).fill};border:1.5px solid ${LEVEL_STROKE};flex:none"></span>ข้อตกลงระดับ${esc(POLICY_LABEL[a.policyLevel] ?? a.policyLevel)}</div>` : ''}
      ${publicView ? '' : `<div style="font-size:11px;color:#9ca3af;margin-top:2px">โดย ${esc(a.userName)}</div>`}
      ${publicView ? publicPopupFooter(a) : `
      <div style="display:flex;align-items:center;gap:12px;margin-top:8px">
        <a href="/activity/${a.id}"
           style="font-size:11px;font-weight:600;color:#c2410c;text-decoration:none">
          ดูรายละเอียดเต็ม →
        </a>
        <a href="${esc(navigationUrl(place))}" target="_blank" rel="noopener noreferrer"
           style="margin-left:auto;font-size:11px;font-weight:600;color:#ffffff;background:#ea580c;padding:3px 9px;border-radius:9999px;text-decoration:none">
          นำทาง
        </a>
      </div>`}
    </div>`;
}

// สาธารณะ: งานที่เผยแพร่แล้วมีปุ่มไปกรณีศึกษา · ยังไม่เผยแพร่ = บอกตรง ๆ ว่ายังไม่มีเรื่องเล่า
function publicPopupFooter(a: MapActivity) {
  return a.published
    ? `<a href="/stories/${a.id}"
         style="display:inline-block;margin-top:8px;font-size:11px;font-weight:600;color:#ffffff;background:#ea580c;padding:4px 11px;border-radius:9999px;text-decoration:none">
        อ่านกรณีศึกษา →
      </a>`
    : '<div style="font-size:11px;color:#9ca3af;margin-top:6px">ยังไม่มีกรณีศึกษาเผยแพร่</div>';
}

export default function MapView({ activities, categories, categoryLogos, subCategoryLogos, publicView = false, pins: initialPins = [], myPinIds = [], canManagePins = false }: MapViewProps) {
  // โลโก้ของงาน: ประเด็นย่อย → ประเด็นหลัก → ไม่มี (ใช้หมุดสี)
  const logoOf = (a: MapActivity) =>
    (a.subCategory && subCategoryLogos[`${a.category}|${a.subCategory}`]) || categoryLogos[a.category];
  const mapElRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const pinLayerRef = useRef<import('leaflet').LayerGroup | null>(null);
  const tileRef = useRef<import('leaflet').TileLayer | null>(null);
  const [pins, setPins] = useState(initialPins);
  const maxPinIdRef = useRef(Math.max(0, ...initialPins.map((pin) => pin.id)));
  const pinQueryHandledRef = useRef(false);
  const [pinCardOpen, setPinCardOpen] = useState(true);
  const [selectedPinId, setSelectedPinId] = useState<number | null>(null);
  const geoLayerRef = useRef<GeoJSONLayer | null>(null);
  const markersRef = useRef<(CircleMarker | Marker)[]>([]);
  const drawRunRef = useRef(0);
  /** ตำแหน่งที่วาดหมุดหลักจริง (หลังกางหมุดที่ทับกัน) — จอจัดแสดงวางวงส้มตรงนี้ */
  const shownPosRef = useRef<Map<number, [number, number]>>(new Map());
  /** motion: เล่นแอนิเมชันหมุดเฉพาะตอนเปิด/เปลี่ยนโหมด-ตัวกรอง-ภาค (จิ้มจังหวัดไม่เล่นซ้ำ) */
  const lastAnimKeyRef = useRef(''); // นับรอบวาดหมุด — รอบเก่าที่ยังรอโลโก้ระบายสีอยู่จะไม่วาดทับ
  const centersRef = useRef<Map<string, [number, number]>>(new Map());
  const boundsRef = useRef<Map<string, LatLngBounds>>(new Map());
  const fullBoundsRef = useRef<LatLngBounds | null>(null);
  const [mapReady, setMapReady] = useState(false);
  // ระดับซูม (ปัดลง, ไม่เกิน CLUSTER_OFF_ZOOM) — เปลี่ยนแล้ววาดหมุดใหม่เพื่อจัดกลุ่มวงตัวเลขตามระยะบนจอ
  const [zoomBucket, setZoomBucket] = useState(6);
  const [selectedProvince, setSelectedProvince] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [subFilter, setSubFilter] = useState(''); // ประเด็นย่อย — ใช้ได้เมื่อเลือกประเด็นแล้ว
  const [statusFilter, setStatusFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState(''); // ระดับนโยบาย · NO_POLICY = ยังไม่มีนโยบาย
  const [search, setSearch] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false); // เปิดเมื่อคลิกไอคอนหมวดหมู่
  const [mapMode, setMapMode] = useState<'markers' | 'heat' | 'summary'>('markers');
  /** โหมดสรุปรายจังหวัด: เน้นภาคเหนือ+อีสาน (จังหวัดภาคอื่นจาง ไม่มีวงตัวเลข) หรือทั้งประเทศ */
  const [summaryScope, setSummaryScope] = useState<'focus' | 'all'>('focus');
  /** โหมดสรุป: จิ้มจังหวัด = การ์ดขวาเปลี่ยนเป็นข้อมูลจังหวัดนั้น · กด "ดูรายชื่องาน" ถึงเปิดแผงรายชื่อ */
  const [summaryList, setSummaryList] = useState(false);
  /** โหมดสรุป: ภาคที่เลือก (เลือกได้หลายภาค) · ว่าง = ทุกภาคในขอบเขต */
  const [summaryZones, setSummaryZones] = useState<HealthZone[]>([]);
  const [posterBusy, setPosterBusy] = useState(false);
  /** จอบูธ: วนภาคอัตโนมัติ (?booth=1) · แตะจอ = หยุดชั่วคราว 30 วิ */
  const [booth, setBooth] = useState(false);
  const boothPausedUntil = useRef(0);
  // ลิงก์เปิดตรงโหมด/ภาค: ?mode=summary&zones=northeast-lower,northeast-upper&scope=all&booth=1
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    if (sp.get('mode') !== 'summary' && sp.get('booth') !== '1') return;
    setMapMode('summary');
    if (sp.get('scope') === 'all') setSummaryScope('all');
    const zs = (sp.get('zones') ?? '').split(',').filter((z): z is HealthZone => (ALL_ZONES as string[]).includes(z));
    if (zs.length) setSummaryZones(zs);
    if (sp.get('booth') === '1') setBooth(true);
  }, []);
  /** จอจัดแสดง (ExpoMode): ?expo=1 หรือปุ่มในแถบซ้าย · ซ่อน UI ปกติ + navbar · ดึงหมุดใหม่ถี่ขึ้น */
  const [expo, setExpo] = useState(false);
  // ภาคที่จอจัดแสดงเน้น: ค่าเริ่มต้น อีสานบน+อีสานล่าง (เวทีอุบล 27 พ.ย. 2026) · &zones=all = ทั้งประเทศ · &zones=north-upper,... = เลือกเอง
  const [expoZones, setExpoZones] = useState<HealthZone[] | null>(EXPO_DEFAULT_ZONES);
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    if (sp.get('expo') !== '1') return;
    setExpo(true);
    const raw = sp.get('zones');
    if (raw === 'all') setExpoZones(null);
    else if (raw) {
      const zs = raw.split(',').filter((z): z is HealthZone => (ALL_ZONES as string[]).includes(z));
      if (zs.length) setExpoZones(zs);
    }
  }, []);
  useEffect(() => {
    if (!expo) return;
    setMapMode('markers');
    setSelectedProvince('');
    setSelectedPinId(null);
    setSidebarOpen(false);
    document.documentElement.classList.add('sdn-expo-on');
    return () => document.documentElement.classList.remove('sdn-expo-on');
  }, [expo]);
  const enterExpo = () => {
    const u = new URL(window.location.href);
    u.searchParams.set('expo', '1');
    window.history.replaceState(null, '', u);
    setExpo(true);
    document.documentElement.requestFullscreen?.().catch(() => {});
  };
  const exitExpo = () => {
    const u = new URL(window.location.href);
    u.searchParams.delete('expo');
    window.history.replaceState(null, '', u);
    setExpo(false);
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  };
  const [heatMetric, setHeatMetric] = useState<'activities' | 'people'>('activities');
  const [newOnly, setNewOnly] = useState(false);
  // null = ยังไม่รู้ (ก่อน mount อ่าน storage ไม่ได้) — ระหว่างนั้นไม่ไฮไลต์อะไร
  const [newBaseline, setNewBaseline] = useState<number | null>(null);
  // สาธารณะไม่มีป้าย "ใหม่" (ฟีเจอร์ไว้ให้ทีมงานตามงานของเพื่อน)
  useEffect(() => {
    if (!publicView) setNewBaseline(readNewBaseline());
  }, [publicView]);
  const newIds = useMemo(() => {
    const ids = new Set<number>();
    if (newBaseline == null) return ids;
    for (const a of activities) if (!a.mine && Date.parse(a.createdAt) > newBaseline) ids.add(a.id);
    return ids;
  }, [activities, newBaseline]);

  const filtered = useMemo(
    () =>
      activities.filter((a) => {
        if (newOnly && !newIds.has(a.id)) return false;
        if (categoryFilter && a.category !== categoryFilter) return false;
        if (subFilter && a.subCategory !== subFilter) return false;
        if (statusFilter && a.status !== statusFilter) return false;
        if (levelFilter && (a.policyLevel ?? NO_POLICY) !== levelFilter) return false;
        if (search) {
          const hay =
            `${a.title} ${a.province} ${a.amphoe} ${a.district} ${a.areaName ?? ''} ${a.userName} ${a.category} ${a.subCategory ?? ''} ${a.extraAreas
              .map((x) => `${x.province} ${x.amphoe} ${x.district} ${x.areaName ?? ''}`)
              .join(' ')}`.toLowerCase();
          if (!hay.includes(search.toLowerCase())) return false;
        }
        return true;
      }),
    [activities, categoryFilter, subFilter, statusFilter, levelFilter, search, newOnly, newIds]
  );

  const byProvince = useMemo(() => {
    const m = new Map<string, MapActivity[]>();
    for (const a of filtered) {
      const list = m.get(a.province) ?? [];
      list.push(a);
      m.set(a.province, list);
    }
    return m;
  }, [filtered]);

  // จุดที่วาดหมุด: พื้นที่หลัก + พื้นที่ที่เกี่ยวข้อง (หมุดรอง) จัดกลุ่มตามจังหวัดของจุดนั้น
  const sitesByProvince = useMemo(() => {
    const m = new Map<string, MapSite[]>();
    const push = (province: string, site: MapSite) => m.set(province, [...(m.get(province) ?? []), site]);
    for (const a of filtered) {
      push(a.province, { a, latitude: a.latitude, longitude: a.longitude, locationSource: a.locationSource, extra: null });
      for (const x of a.extraAreas) {
        push(x.province, { a, latitude: x.latitude, longitude: x.longitude, locationSource: x.locationSource, extra: x });
      }
    }
    return m;
  }, [filtered]);

  const selectedActivities = selectedProvince ? byProvince.get(selectedProvince) ?? [] : [];
  const selectedUserCount = new Set(selectedActivities.map((a) => a.userName)).size;

  // ค่าความเข้มรายจังหวัดสำหรับโหมด heat: จำนวนงาน + จำนวนเจ้าหน้าที่ (ไม่ซ้ำคน)
  const heatData = useMemo(() => {
    const m = new Map<string, { activities: number; people: number }>();
    byProvince.forEach((list, province) =>
      m.set(province, {
        activities: list.length,
        people: new Set(list.map((a) => a.userName)).size,
      })
    );
    return m;
  }, [byProvince]);
  const heatMax = useMemo(
    () => Math.max(1, ...[...heatData.values()].map((v) => v[heatMetric])),
    [heatData, heatMetric]
  );

  // โหมดสรุปรายจังหวัด (แบบอินโฟกราฟิก "ทำแล้วที่ไหนบ้าง"): จำนวนนโยบาย/ข้อตกลงต่อจังหวัด ตามตัวกรองที่เลือก
  const summary = useMemo(() => {
    const m = new Map<string, number>();
    byProvince.forEach((list, province) => {
      const n = list.reduce((s, a) => s + (a.policyCount ?? 0), 0);
      if (n > 0) m.set(province, n);
    });
    return m;
  }, [byProvince]);
  /** จังหวัดนี้อยู่ในสิ่งที่กำลังดูในโหมดสรุปไหม (ขอบเขต + ภาคที่เลือก) */
  const zoneOk = useCallback(
    (province: string) => {
      const z = provinceHealthZones[province];
      if (!z) return false;
      if (summaryScope === 'focus' && !FOCUS_ZONES.has(z)) return false;
      return summaryZones.length === 0 || summaryZones.includes(z);
    },
    [summaryScope, summaryZones],
  );
  const summaryShown = useMemo(() => [...summary.entries()].filter(([p]) => zoneOk(p)), [summary, zoneOk]);
  /** จำนวนนโยบายต่อภาค (ตามขอบเขต ไม่สนภาคที่เลือก) → ตัวเลขบนปุ่มภาค */
  const zoneTotals = useMemo(() => {
    const m = new Map<HealthZone, number>();
    summary.forEach((n, p) => {
      const z = provinceHealthZones[p];
      if (z) m.set(z, (m.get(z) ?? 0) + n);
    });
    return m;
  }, [summary]);
  const scopeZones = summaryScope === 'focus' ? ALL_ZONES.filter((z) => FOCUS_ZONES.has(z)) : ALL_ZONES;
  // จอบูธ: ภาพรวม → เหนือบน → อีสานบน → อีสานล่าง … (ข้ามภาคที่ยังไม่มีนโยบาย) ทุก 9 วิ
  const boothSteps = useMemo(
    () => [[] as HealthZone[], ...(summaryScope === 'focus' ? ALL_ZONES.filter((z) => FOCUS_ZONES.has(z)) : ALL_ZONES).filter((z) => (zoneTotals.get(z) ?? 0) > 0).map((z) => [z])],
    [summaryScope, zoneTotals],
  );
  useEffect(() => {
    if (!booth || mapMode !== 'summary') return;
    const pause = () => {
      boothPausedUntil.current = Date.now() + BOOTH_PAUSE_MS;
    };
    window.addEventListener('pointerdown', pause);
    let i = 0;
    const timer = window.setInterval(() => {
      if (Date.now() < boothPausedUntil.current) return;
      i = (i + 1) % boothSteps.length;
      setSelectedProvince('');
      setSummaryList(false);
      setSummaryZones(boothSteps[i]);
    }, BOOTH_STEP_MS);
    return () => {
      window.removeEventListener('pointerdown', pause);
      clearInterval(timer);
    };
  }, [booth, mapMode, boothSteps]);
  const zoneTitle = summaryZones.length
    ? ALL_ZONES.filter((z) => summaryZones.includes(z)).map(zoneShort).join(' + ')
    : null;
  const toggleZone = (z: HealthZone) => {
    setSelectedProvince('');
    setSummaryZones((prev) => (prev.includes(z) ? prev.filter((x) => x !== z) : [...prev, z]));
  };
  const summaryTotal = summaryShown.reduce((s, [, n]) => s + n, 0);
  const countTotal = useCountUp(summaryTotal);
  const countProv = useCountUp(summaryShown.length);
  // นโยบายทุกชิ้นในขอบเขตเดียวกับแผนที่สรุป → พายระดับ + รูปแบบ (การ์ดมุมขวา)
  const summaryPolicies = useMemo(() => {
    const out: { level: string; type: string | null }[] = [];
    byProvince.forEach((list, province) => {
      if (!zoneOk(province)) return;
      for (const a of list) out.push(...(a.policies ?? []));
    });
    return out;
  }, [byProvince, zoneOk]);

  // สีประจำประเด็น (นิยามรวมที่ lib/categoryColors.ts เพื่อให้หน้าอื่นใช้สีเดียวกัน)
  const colorOf = useMemo(() => makeColorOf(categories), [categories]);

  // สร้างแผนที่ครั้งเดียว
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !mapElRef.current || mapRef.current) return;

      const map = L.map(mapElRef.current, {
        zoomControl: false,
        scrollWheelZoom: true,
        // ซูมพอดีกรอบได้ละเอียดขึ้น (เดิมปัดเป็นเลขเต็ม → มือถือได้ภาพเล็กเกิน) · ปุ่ม +/− ยังทีละ 1 ขั้น
        zoomSnap: 0.25,
      }).setView([13.5, 101], 6);
      L.control.zoom({ position: 'bottomright' }).addTo(map);
      // โหมดสรุปบนมือถือ: ชื่อจังหวัดขึ้นเมื่อซูมเข้าพอ (ซูมไกลแล้วชื่อทับกันอ่านไม่ออก) — CSS .sdn-sum-zoomed ใน globals.css
      const markZoom = () => {
        map.getContainer().classList.toggle('sdn-sum-zoomed', map.getZoom() >= 6.75);
        setZoomBucket(Math.min(Math.floor(map.getZoom()), CLUSTER_OFF_ZOOM));
        declutterSumNames(map.getContainer());
      };
      map.on('zoomend', markZoom);
      markZoom();
      tileRef.current = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '&copy; OpenStreetMap contributors',
        crossOrigin: 'anonymous', // จำเป็นต่อการบันทึกภาพแผนที่เป็น PNG (ไม่ให้ canvas ถูก taint)
      }).addTo(map);

      const geoLayer = L.geoJSON(thailandGeo as GeoJSON.GeoJsonObject, {
        style: { fillColor: '#ffffff', fillOpacity: 0.02, ...PROVINCE_LINE },
        onEachFeature: (feature, layer) => {
          const name = feature?.properties?.name_th as string;
          if (!name) return;
          const bounds = (layer as GeoJSONLayer).getBounds();
          centersRef.current.set(name, [bounds.getCenter().lat, bounds.getCenter().lng]);
          boundsRef.current.set(name, bounds);
          layer.bindTooltip(name, { sticky: true });
          layer.on('click', () => setSelectedProvince((prev) => (prev === name ? '' : name)));
        },
      }).addTo(map);
      // เส้นขอบประเทศ — วางทับชั้นจังหวัด (จังหวัดที่เลือกยังเห็นขอบส้ม/ดำของตัวเองด้านใน) ไม่รับคลิก
      L.geoJSON(thailandOutline as GeoJSON.GeoJsonObject, {
        style: { ...COUNTRY_LINE, fill: false },
        interactive: false,
      }).addTo(map);
      fullBoundsRef.current = geoLayer.getBounds();
      map.fitBounds(fullBoundsRef.current, { padding: [16, 16] });

      mapRef.current = map;
      geoLayerRef.current = geoLayer;
      pinLayerRef.current = L.layerGroup().addTo(map);
      setMapReady(true);
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      geoLayerRef.current = null;
    };
  }, []);

  // วาดหมุด + ไฮไลต์ ทุกครั้งที่ข้อมูล/ฟิลเตอร์/จังหวัดที่เลือกเปลี่ยน
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    (async () => {
      const run = ++drawRunRef.current;
      const L = (await import('leaflet')).default;
      // เตรียมโลโก้ระบายสีตามระดับนโยบายก่อนล้างหมุดเดิม (รอบที่ถูกแทนแล้วหยุด ไม่ให้หมุดซ้อน 2 ชุด)
      const tinted = new Map<string, string>();
      await Promise.all(
        filtered.map(async (a) => {
          const src = logoOf(a);
          if (!src) return;
          const key = `${src}|${levelPin(a.policyLevel).ink}`;
          if (!tinted.has(key)) tinted.set(key, src);
          tinted.set(key, await tintLogo(src, levelPin(a.policyLevel).ink));
        })
      );
      if (run !== drawRunRef.current || !mapRef.current) return;
      const map = mapRef.current;

      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      const animKey = [mapMode, categoryFilter, subFilter, statusFilter, levelFilter, newOnly, summaryScope, summaryZones.join(','), filtered.length].join('|');
      const animate = animKey !== lastAnimKeyRef.current;
      lastAnimKeyRef.current = animKey;
      let animIndex = 0;
      const items: { site: MapSite; pos: [number, number] }[] = [];

      sitesByProvince.forEach((list, province) => {
        const center = centersRef.current.get(province);
        if (!center) return;

        // ทุกงานเป็นหมุดของตัวเองตามตำแหน่งจริง สีตามประเด็น (ไม่รวมเป็นวงรายจังหวัด — ผู้ใช้อยากเห็นพื้นที่จริง)
        // งานที่พิกัดเดียวกันกระจายรอบจุดเล็กน้อยให้เห็นครบ · โหมดความหนาแน่นแสดงหมุดเฉพาะจังหวัดที่เลือก
        if (mapMode === 'markers' || (mapMode === 'heat' && province === selectedProvince)) {
          const byLocation = new Map<string, MapSite[]>();
          for (const site of list) {
            // หมุดที่ปักตำแหน่งจริงแยกกลุ่มกันเอง (ละเอียด ~1 ม.) ไม่ปนกับจุดกลางตำบล
            const precise = site.locationSource !== 'TAMBON';
            const key =
              site.latitude != null && site.longitude != null
                ? precise
                  ? `pin:${site.latitude.toFixed(5)},${site.longitude.toFixed(5)}`
                  : `${site.latitude.toFixed(3)},${site.longitude.toFixed(3)}`
                : 'province-center';
            const group = byLocation.get(key) ?? [];
            group.push(site);
            byLocation.set(key, group);
          }
          byLocation.forEach((group, key) => {
            const base: [number, number] =
              key === 'province-center'
                ? center
                : [group[0].latitude!, group[0].longitude!];
            group.forEach((site, i) => {
              // กระจายหมุดที่จุดเดียวกันเป็นวงรอบ ๆ ให้เห็นครบทุกงาน
              // (หมุดตำแหน่งจริงกระจายวงเล็ก ~50 ม. ไม่ให้หลุดจากที่ตั้งจริงไกล)
              const offset = group.length > 1 ? (key.startsWith('pin:') ? 0.0005 : 0.012) : 0;
              const angle = (2 * Math.PI * i) / group.length;
              const pos: [number, number] = [
                base[0] + offset * Math.sin(angle),
                base[1] + offset * Math.cos(angle),
              ];
              items.push({ site, pos });
            });
          });
        }
      });

      // วาดหมุดเดี่ยว 1 งาน (สี/ขนาดตามระดับนโยบาย + popup)
      const drawPin = (site: MapSite, pos: [number, number]) => {
        const a = site.a;
        const isNew = newIds.has(a.id) && !site.extra; // วงกระเพื่อมเฉพาะหมุดหลัก
        // งานใหม่: วงกระเพื่อมสีส้มรอบหมุด (divIcon อยู่ marker pane เหนือหมุด — pointer-events ปิดไว้)
        if (isNew) {
          const pulse = L.marker(pos, {
            icon: L.divIcon({ html: '<span class="sdn-pulse"></span>', className: '', iconSize: [34, 34], iconAnchor: [17, 17] }),
            interactive: false,
            keyboard: false,
          }).addTo(map);
          (pulse.options as { sdn?: PulseSpec }).sdn = { kind: 'pulse' };
          markersRef.current.push(pulse);
        }
        // ปักตำแหน่งจริง = สีทึบขอบขาว · จุดกลางตำบล (โดยประมาณ) = สีจางขอบประ (0.6 — จางกว่านี้มองไม่เห็นในมุมทั้งประเทศ)
        const color = colorOf(a.category);
        const precise = site.locationSource !== 'TAMBON' && site.latitude != null;
        const logo = logoOf(a);
        let marker: CircleMarker | Marker;
        if (logo) {
          // สีโลโก้+ขนาดตามระดับนโยบาย · หมุดรองเล็กลง 6px · ระดับสูงวางบนสุด (zIndexOffset) ไม่ให้หมุดเล็กบัง
          const pinStyle = levelPin(a.policyLevel);
          const size = site.extra ? pinStyle.size - 4 : pinStyle.size;
          marker = L.marker(pos, {
            icon: L.divIcon({
              html: logoPinHtml(tinted.get(`${logo}|${pinStyle.ink}`) ?? logo, pinStyle, !precise, size, animate ? waveDelay(pos[0], animIndex++) : null),
              className: '',
              iconSize: [size, size],
              iconAnchor: [size / 2, size / 2],
              popupAnchor: [0, -size / 2],
              tooltipAnchor: [0, -size / 2],
            }),
            riseOnHover: true,
            zIndexOffset: size * 10,
            alt: a.category,
          }).addTo(map);
          (marker.options as { sdn?: LogoSpec }).sdn = { kind: 'logo', color, approx: !precise, fill: pinStyle.fill, dashed: pinStyle.dashed, size };
        } else {
          // หมุดรอง (พื้นที่ที่เกี่ยวข้อง) เล็กกว่าหมุดหลักเล็กน้อย
          const r = site.extra ? 2 : 0;
          marker = L.circleMarker(
            pos,
            precise
              ? { radius: 8 - r, color: '#ffffff', weight: 2, fillColor: color, fillOpacity: 1 }
              : { radius: 7 - r, color, weight: 2, dashArray: '3 3', fillColor: color, fillOpacity: 0.6 }
          ).addTo(map);
        }
        marker.bindTooltip(`${isNew ? '🆕 ' : ''}${site.extra ? 'พื้นที่ที่เกี่ยวข้อง: ' : ''}${esc(a.title)}`, { direction: 'top' });
        // คลิกหมุด = เปิด popup ตรงจุดนั้น (ไม่เด้งออกจากหน้าแผนที่)
        marker.bindPopup(activityPopupHtml(a, color, isNew, publicView, site.extra), {
          closeButton: true,
          // เว้นช่องค้นหา (บน) และการ์ดคำอธิบาย (ล่าง) — มือถือ popup เคยโดนช่องค้นหาบังชื่องาน
          autoPanPaddingTopLeft: [88, 124],
          autoPanPaddingBottomRight: [16, 100],
          maxWidth: 260,
        });
        markersRef.current.push(marker);
      };

      // ── รวมหมุดที่ทับกันบนจอเป็นวงตัวเลข (26 พ.ย. 2026 — ผู้ใช้ขอ: อุบล/อำนาจเจริญ/ยโสธร กองเป็นก้อน นับ/กดแยกไม่ได้ โดยเฉพาะมือถือ)
      // จัดกลุ่มตามระยะบนจอที่ซูมปัจจุบัน (ไม่ใช่รายจังหวัด) · ซูม ≥ CLUSTER_OFF_ZOOM = ทุกงานเป็นหมุดของตัวเองตามกฎเดิม
      // ระดับสูงจับกลุ่มก่อน (เป็นจุดกลางของกลุ่ม) · คลิกวง = ซูมเข้าพอดีสมาชิก
      const clusters: { pos: [number, number]; px: { x: number; y: number }; members: { site: MapSite; pos: [number, number] }[] }[] = [];
      const zoomNow = map.getZoom();
      const rank = (site: MapSite) => LEVEL_SIZE[site.a.policyLevel ?? ''] ?? 0;
      // ซูม ≥ CLUSTER_OFF_ZOOM: หมุดที่ยังทับกันบนจอ (จุดกลางตำบลเดียวกัน/หมู่บ้านห่างกันไม่กี่ร้อยเมตร) กางเป็นวงรอบจุดกลางกลุ่ม
      // ระยะเป็นพิกเซลตามขนาดหมุด (จอจัดแสดงหมุดใหญ่ 1.4 เท่า) — ผู้ใช้ทัก 26 พ.ย. 2026 "หมุดมีหลายชั้น ดูซ้อน"
      // จอจัดแสดงตอนภาพรวม (ซูม < 10) = จุดสีเล็กตำแหน่งจริงทุกงาน ไม่รวมวงตัวเลข ไม่ขยับตำแหน่ง (ผู้ใช้เลือก "แบบที่นิยม" 26 พ.ย. 2026
      // หลังลองกางหมุดแยกทุกอันแล้วหมุดหลุดจากตำแหน่งจริง) · ซูมเจาะ = หมุดเต็ม กางเฉพาะที่ทับกัน
      const dots = expo && zoomNow < CLUSTER_OFF_ZOOM;
      const fanOut = dots || zoomNow >= CLUSTER_OFF_ZOOM;
      if (zoomNow >= CLUSTER_OFF_ZOOM) {
        const gap = expo ? 46 : 32;
        const groups: { x: number; y: number; members: typeof items }[] = [];
        for (const it of items) {
          const p = map.project(it.pos, zoomNow);
          const g = groups.find((gr) => Math.hypot(gr.x - p.x, gr.y - p.y) < gap);
          if (g) {
            g.members.push(it);
            g.x += (p.x - g.x) / g.members.length;
            g.y += (p.y - g.y) / g.members.length;
          } else groups.push({ x: p.x, y: p.y, members: [it] });
        }
        // วางวงเริ่มต้นเป็นพิกเซล แล้วดันคู่ที่ยังชนกัน (วงของกลุ่มข้าง ๆ) ออกจากกันทีละนิดจนห่างพอ
        const pts = new Map<(typeof items)[number], { x: number; y: number }>();
        for (const g of groups) {
          const n = g.members.length;
          const r = n < 2 ? 0 : gap / (2 * Math.sin(Math.PI / n));
          g.members.forEach((it, i) => {
            const ang = -Math.PI / 2 + (2 * Math.PI * i) / n;
            pts.set(it, { x: g.x + r * Math.cos(ang), y: g.y + r * Math.sin(ang) });
          });
        }
        const all = [...pts.values()];
        for (let iter = 0; iter < 30; iter++) {
          let moved = false;
          for (let i = 0; i < all.length; i++) {
            for (let j = i + 1; j < all.length; j++) {
              const a = all[i], b = all[j];
              const dx = b.x - a.x, dy = b.y - a.y;
              const d = Math.hypot(dx, dy);
              if (d >= gap * 0.9) continue;
              const push = (gap * 0.9 - d) / 2 + 0.5;
              const ux = d > 0.01 ? dx / d : Math.cos(i + j), uy = d > 0.01 ? dy / d : Math.sin(i + j);
              a.x -= ux * push; a.y -= uy * push;
              b.x += ux * push; b.y += uy * push;
              moved = true;
            }
          }
          if (!moved) break;
        }
        pts.forEach((p, it) => {
          const ll = map.unproject(L.point(p.x, p.y), zoomNow);
          it.pos = [ll.lat, ll.lng];
        });
      }
      shownPosRef.current = new Map(items.filter((it) => !it.site.extra).map((it) => [it.site.a.id, it.pos]));
      const sorted = fanOut ? items : [...items].sort((x, y) => rank(y.site) - rank(x.site));
      for (const it of sorted) {
        const px = map.project(it.pos, zoomNow);
        const hit = fanOut ? undefined : clusters.find((c) => Math.hypot(c.px.x - px.x, c.px.y - px.y) < (expo ? CLUSTER_RADIUS * 1.5 : CLUSTER_RADIUS));
        if (hit) hit.members.push(it);
        else clusters.push({ pos: it.pos, px, members: [it] });
      }
      for (const c of clusters) {
        if (dots) {
          const { site, pos } = c.members[0];
          const lp = levelPin(site.a.policyLevel);
          const dot = L.circleMarker(pos, {
            radius: site.extra ? 5 : 7.5, // จอบูธมองจากไกล
            fillColor: lp.fill,
            fillOpacity: 1,
            color: LEVEL_STROKE,
            weight: 1.5,
            dashArray: lp.dashed ? '2 2' : undefined,
            interactive: false,
          }).addTo(map);
          markersRef.current.push(dot);
          continue;
        }
        if (c.members.length === 1) {
          drawPin(c.members[0].site, c.members[0].pos);
          continue;
        }
        // จุดกลางของกลุ่ม = เฉลี่ยตำแหน่งสมาชิก
        const lat = c.members.reduce((t, m) => t + m.pos[0], 0) / c.members.length;
        const lng = c.members.reduce((t, m) => t + m.pos[1], 0) / c.members.length;
        const n = c.members.length;
        const size = Math.round(28 + Math.min(16, Math.sqrt(n) * 3));
        if (c.members.some((m) => newIds.has(m.site.a.id) && !m.site.extra)) {
          const pulse = L.marker([lat, lng], {
            icon: L.divIcon({ html: '<span class="sdn-pulse"></span>', className: '', iconSize: [size + 6, size + 6], iconAnchor: [(size + 6) / 2, (size + 6) / 2] }),
            interactive: false,
            keyboard: false,
          }).addTo(map);
          (pulse.options as { sdn?: PulseSpec }).sdn = { kind: 'pulse' };
          markersRef.current.push(pulse);
        }
        const delay = animate ? waveDelay(lat, animIndex++) : null;
        const m = L.marker([lat, lng], {
          icon: L.divIcon({
            html: `<div class="sdn-cluster${delay != null ? ' sdn-anim' : ''}" style="width:${size}px;height:${size}px;font-size:${size >= 36 ? 14 : 12}px${delay != null ? `;--d:${delay}ms` : ''}"><span>${n}</span></div>`,
            className: '',
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2],
          }),
          riseOnHover: true,
          zIndexOffset: 1000,
          alt: `${n} พื้นที่`,
        }).addTo(map);
        (m.options as { sdn?: ClusterSpec }).sdn = { kind: 'cluster', n, size };
        // tooltip บอกว่ากลุ่มนี้มีระดับไหนกี่งาน
        const levels = new Map<string, number>();
        for (const mm of c.members) {
          const lv = mm.site.a.policyLevel ? `ข้อตกลงระดับ${POLICY_LABEL[mm.site.a.policyLevel] ?? mm.site.a.policyLevel}` : 'ยังไม่มีข้อตกลง';
          levels.set(lv, (levels.get(lv) ?? 0) + 1);
        }
        m.bindTooltip(`<b>${n} พื้นที่</b><br>${[...levels].map(([k, v]) => `${esc(k)} ${v}`).join(' · ')}<br><span style="color:#6b7280">คลิกเพื่อซูมเข้า</span>`, { direction: 'top', offset: [0, -size / 2] });
        m.on('click', () => {
          const b = L.latLngBounds(c.members.map((mm) => mm.pos));
          map.flyToBounds(b, { padding: [60, 60], maxZoom: Math.max(CLUSTER_OFF_ZOOM, Math.ceil(zoomNow) + 2), duration: 0.6 });
        });
        markersRef.current.push(m);
      }

      // โหมดสรุป (อินโฟกราฟิก "ทำแล้วที่ไหนบ้าง"): **ชื่อทุกจังหวัด** ในขอบเขต + วงเหลืองตัวเลข = จำนวนนโยบาย (ยิ่งมากยิ่งใหญ่)
      // มีนโยบาย = ชื่อขาวบนพื้นเข้ม · ยังไม่มี = ชื่อเทาบนพื้นขาว · ป้ายภาคตัวเอียงแบบอินโฟกราฟิก
      if (mapMode === 'summary') {
        const max = Math.max(1, ...summaryShown.map(([, n]) => n));
        const top3 = new Set([...summaryShown].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([p]) => p));
        const k = window.innerWidth < 640 ? 0.6 : 1; // มือถือซูมได้น้อย — วงเล็กลง
        centersRef.current.forEach((center, province) => {
          if (!zoneOk(province)) return;
          const n = summary.get(province) ?? 0;
          const size = n ? Math.round((22 + Math.sqrt(n / max) * 26) * k) : 0;
          // motion: วงเด้งทีละวงไล่เหนือ→ใต้ ชื่อค่อย ๆ ขึ้นตาม · 3 จังหวัดมากสุดมีวงกระเพื่อมตลอด
          const d = animate ? Math.round(Math.max(0, Math.min(1, (20.6 - center[0]) / 15)) * 900) : null;
          const pop = d != null ? ` sdn-anim-pop" style="--d:${d}ms;` : '" style="';
          const fade = d != null ? ` sdn-anim-fade" style="--d:${d + 180}ms"` : '"';
          const topCls = top3.has(province) ? ' sdn-sum-top' : '';
          const html = n
            ? `<div class="sdn-sum"><div class="sdn-sum-pin${topCls}${pop}--r:${(animIndex++ % 3) * 0.8}s;width:${size}px;height:${size}px;font-size:${Math.round(size * 0.44)}px">${n}</div><div class="sdn-sum-name sdn-sum-on${fade}>${esc(province)}</div></div>`
            : `<div class="sdn-sum"><div class="sdn-sum-name sdn-sum-off${fade}>${esc(province)}</div></div>`;
          const icon = L.divIcon({ className: '', iconSize: [0, 0], iconAnchor: [0, n ? 0 : -2], html });
          const m = L.marker(center, { icon, keyboard: false, interactive: n > 0, zIndexOffset: n ? 600 : 400 }).addTo(map);
          if (n) m.on('click', () => setSelectedProvince((prev) => (prev === province ? '' : province)));
          markersRef.current.push(m);
        });
        // ปุ่มภาค: จิ้ม = เลือก/เลิกเลือกภาคนั้น (เลือกได้หลายภาค) — ตัวเลข = จำนวนนโยบายในภาค
        requestAnimationFrame(() => declutterSumNames(map.getContainer()));
        if (summaryScope === 'focus') {
          for (const { zone, at, align } of ZONE_BUTTONS) {
            const on = summaryZones.includes(zone);
            const html = `<div class="sdn-zone sdn-zone-${align}"><span class="sdn-zone-btn${on ? ' is-on' : ''}${animate ? ' sdn-anim-fade" style="--d:300ms' : ''}" role="button" aria-pressed="${on}">${esc(zoneShort(zone))}<b>${zoneTotals.get(zone) ?? 0}</b></span></div>`;
            const m = L.marker(at, {
              icon: L.divIcon({ className: '', iconSize: [0, 0], html }),
              keyboard: false,
              zIndexOffset: 700,
            }).addTo(map);
            m.on('click', () => toggleZone(zone));
            markersRef.current.push(m);
          }
        }
      }

      geoLayerRef.current?.setStyle((feature) => {
        const name = feature?.properties?.name_th as string;
        const isSelected = name === selectedProvince;

        // โหมดสรุป: มีนโยบาย = เทาเข้ม · ไม่มี = ขาว · นอกภาคที่เน้น = จาง
        if (mapMode === 'summary') {
          const outside = !zoneOk(name);
          const has = summary.has(name) && !outside;
          return {
            fillColor: outside ? '#e5e7eb' : has ? '#3f3f46' : '#ffffff',
            fillOpacity: outside ? 0.55 : 0.92,
            color: isSelected ? '#facc15' : outside ? '#d1d5db' : has ? '#ffffff' : '#9ca3af',
            weight: isSelected ? 3 : has ? 1.5 : 1,
          };
        }

        // โหมดความหนาแน่น: ระบายสีจังหวัดตามค่าเกณฑ์ที่เลือก
        if (mapMode === 'heat') {
          const value = heatData.get(name)?.[heatMetric] ?? 0;
          return {
            fillColor: heatColor(value, heatMax),
            fillOpacity: 0.75,
            color: isSelected ? '#1c1917' : '#ffffff',
            weight: isSelected ? 2.5 : 1,
          };
        }

        return provinceStyle(byProvince.has(name), isSelected);
      });

      // tooltip จังหวัด: โหมด heat โชว์ตัวเลขประกอบ
      geoLayerRef.current?.eachLayer((layer) => {
        const feature = (layer as GeoJSONLayer & { feature?: GeoJSON.Feature }).feature;
        const name = feature?.properties?.name_th as string;
        if (!name) return;
        if (mapMode === 'heat') {
          const v = heatData.get(name);
          layer
            .getTooltip()
            ?.setContent(
              v
                ? `${name} — ${v.activities} งาน${publicView ? '' : ` · เจ้าหน้าที่ ${v.people} คน`}`
                : `${name} — ยังไม่มีงาน`
            );
        } else if (mapMode === 'summary') {
          const n = summary.get(name);
          layer.getTooltip()?.setContent(n ? `${name} — ${n} นโยบาย/ข้อตกลง` : `${name} — ยังไม่มีนโยบาย`);
        } else {
          layer.getTooltip()?.setContent(name);
        }
      });
    })();
  }, [mapReady, byProvince, sitesByProvince, selectedProvince, categoryFilter, colorOf, mapMode, heatMetric, heatData, heatMax, newIds, categoryLogos, subCategoryLogos, publicView, summary, summaryShown, summaryScope, summaryZones, zoneOk, zoneTotals, zoomBucket, expo]);

  // วาดหมุดงานศพจากแขกแยกชั้นจากข้อมูลกิจกรรม
  useEffect(() => {
    if (!mapReady || !pinLayerRef.current) return;
    let cancelled = false;
    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !pinLayerRef.current) return;
      pinLayerRef.current.clearLayers();
      for (const p of pins) {
        const fresh = Date.now() - Date.parse(p.createdAt) < 10 * 60 * 1000;
        const html = `<span class="sdn-family-pin${fresh ? ' sdn-family-new' : ''}"><i class="sdn-family-pulse${fresh ? '' : ' sdn-family-pulse--soft'}"></i><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="white" d="M3 11.2 12 4l9 7.2-1.4 1.7-1.6-1.3V20h-5v-5h-2v5H8v-8.4l-1.6 1.3z"/></svg></span>`;
        const marker = L.marker([p.latitude,p.longitude], { icon:L.divIcon({html,className:'',iconSize:[30,30],iconAnchor:[15,15],popupAnchor:[0,-14]}), riseOnHover:true }).addTo(pinLayerRef.current);
        // คลิก = เปิดแผงข้าง (FamilyPinPanel) แทน popup · ชื่อบน hover
        marker.bindTooltip(esc(pinTitle(p)), { direction: 'top', offset: [0, -14] });
        marker.on('click', () => {
          setSelectedProvince('');
          setSelectedPinId(p.id);
        });
      }
    })();
    return ()=>{cancelled=true};
  }, [mapReady,pins]);

  // โหมดสรุป: ซ่อนหมุดบ้าน (ให้ภาพสรุปอ่านง่าย) + ซูมพอดีภาคเหนือ+อีสาน หรือทั้งประเทศ
  useEffect(() => {
    const map = mapRef.current;
    const pinLayer = pinLayerRef.current;
    if (!mapReady || !map || !pinLayer) return;
    // แผนที่ฐานจางลงในโหมดสรุป ให้จังหวัด+วงตัวเลขเด่นแบบอินโฟกราฟิก
    tileRef.current?.setOpacity(mapMode === 'summary' ? 0.3 : 1);
    if (mapMode === 'summary') {
      pinLayer.remove();
      let bounds: import('leaflet').LatLngBounds | null = null;
      geoLayerRef.current?.eachLayer((layer) => {
        const name = (layer as GeoJSONLayer & { feature?: GeoJSON.Feature }).feature?.properties?.name_th as string;
        if (!zoneOk(name)) return;
        const b = (layer as unknown as { getBounds: () => import('leaflet').LatLngBounds }).getBounds();
        bounds = bounds ? bounds.extend(b) : b;
      });
      // เว้นด้านบนให้หัวการ์ด "ทำแล้วที่ไหนบ้าง"
      // จอกว้าง: เว้นขวาให้การ์ดพายระดับนโยบาย (PolicySummaryCard กว้าง 300)
      // เว้นซ้ายให้ปุ่มภาคเหนือ (ฝั่งพม่า) และล่างให้ปุ่มอีสานล่าง
      const wide = window.innerWidth >= 768;
      const right = wide ? 330 : 20;
      if (bounds)
        map.flyToBounds(bounds, {
          paddingTopLeft: [wide ? 150 : 20, wide ? 170 : 150],
          paddingBottomRight: [right, wide ? 60 : 20],
          duration: 0.8,
        });
    } else if (!map.hasLayer(pinLayer)) {
      pinLayer.addTo(map);
    }
  }, [mapReady, mapMode, zoneOk]);

  // ?pin=<id> (หลังปักหมุด/แก้ไข หรือจากลิงก์ "ดูบนแผนที่") = บินไปหมุดแล้วเปิดแผงข้าง · &saved=1 = ขึ้นข้อความขอบคุณ
  useEffect(() => {
    if (!mapReady || pinQueryHandledRef.current) return;
    const sp = new URLSearchParams(window.location.search);
    const pin = pins.find((p) => String(p.id) === sp.get('pin'));
    if (!pin) return;
    pinQueryHandledRef.current = true;
    const timer = setTimeout(() => {
      mapRef.current?.flyTo([pin.latitude, pin.longitude], 11, { duration: 1 });
      setSelectedProvince('');
      setSelectedPinId(pin.id);
      if (sp.get('saved') === '1') toast.success('บันทึกหมุดแล้ว ขอบคุณที่ร่วมแบ่งปัน');
    }, 450);
    return () => clearTimeout(timer);
  }, [mapReady, pins]);

  useEffect(() => {
    maxPinIdRef.current=Math.max(maxPinIdRef.current,...pins.map(p=>p.id)); let stopped=false;
    const poll=async()=>{if(stopped||document.visibilityState!=='visible')return;try{const r=await fetch(`/api/pins?since=${maxPinIdRef.current}`,{cache:'no-store'});if(!r.ok)return;const data=await r.json() as {pins:PublicPin[]};if(data.pins.length){maxPinIdRef.current=Math.max(maxPinIdRef.current,...data.pins.map(p=>p.id));setPins(prev=>{const ids=new Set(prev.map(x=>x.id));return [...prev,...data.pins.filter(x=>!ids.has(x.id))]});if(!expo)for(const p of data.pins)toast(`${pinTitle(p)} · ต.${p.district} จ.${p.province} ปักหมุดแล้ว`);}}catch{/* retry next interval */}};
    const timer=window.setInterval(poll,expo?5000:15000);return()=>{stopped=true;clearInterval(timer)};
  },[pins,expo]);

  // เปิด/ปิด sidebar ทำให้ container กว้างเปลี่ยน — ต้องบอก Leaflet ให้คำนวณขนาดใหม่
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const t = setTimeout(() => mapRef.current?.invalidateSize(), 250);
    return () => clearTimeout(t);
  }, [mapReady, sidebarOpen]);

  // เปลี่ยนฟิลเตอร์แล้วจังหวัดที่เลือกไม่มีงานเหลือ → ยกเลิกการเลือก
  // (ไม่งั้นแผนที่จะค้างอยู่ที่จังหวัดที่ว่างเปล่า มองไม่เห็นว่าผลลัพธ์ใหม่อยู่ตรงไหน)
  useEffect(() => {
    if (selectedProvince && !byProvince.has(selectedProvince)) setSelectedProvince('');
  }, [byProvince, selectedProvince]);

  // ซูมตามสิ่งที่กำลังดู: จังหวัดที่เลือก → ขอบเขตของผลลัพธ์ที่กรองอยู่ → ทั้งประเทศ
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    // โหมดสรุป: แผนที่นิ่งที่ภาพรวมภาค จิ้มจังหวัด = เปลี่ยนข้อมูลในการ์ดขวาอย่างเดียว (เหมาะกับนำเสนอบนจอ)
    if (mapMode === 'summary') return;
    const map = mapRef.current;

    if (selectedProvince) {
      const bounds = boundsRef.current.get(selectedProvince);
      if (bounds) map.flyToBounds(bounds, { padding: [48, 48], maxZoom: 10, duration: 0.6 });
      return;
    }

    // รวมขอบเขตของทุกจังหวัดที่มีผลลัพธ์ (รวมจังหวัดของพื้นที่ที่เกี่ยวข้อง) แล้วซูมให้เห็นครบ
    const corners: [number, number][] = [];
    for (const province of sitesByProvince.keys()) {
      const b = boundsRef.current.get(province);
      if (!b) continue;
      corners.push([b.getSouth(), b.getWest()], [b.getNorth(), b.getEast()]);
    }
    if (corners.length > 0) {
      // เว้นที่ให้ UI ที่ลอยทับ: แถบไอคอนซ้าย+ช่องค้นหาบน, แถบคำอธิบายล่าง, การ์ด QR ขวาล่าง (จอ md+) — ไม่ให้หมุดไปอยู่ใต้การ์ด
      const md = map.getContainer().clientWidth >= 768;
      map.flyToBounds(corners, {
        paddingTopLeft: md ? [96, 110] : [16, 120],
        paddingBottomRight: md ? [pinCardOpen ? 340 : 64, 56] : [16, 70],
        maxZoom: 9,
        duration: 0.6,
      });
    } else if (fullBoundsRef.current) {
      map.flyToBounds(fullBoundsRef.current, { padding: [16, 16], duration: 0.6 });
    }
    // ตั้งใจไม่ผูกกับ search เพื่อไม่ให้แผนที่ขยับทุกครั้งที่พิมพ์
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, selectedProvince, categoryFilter, subFilter, statusFilter, newOnly]);

  // โหมดสรุป: ดาวน์โหลดภาพสรุปของภาคที่เลือก (วาดเวกเตอร์ใหม่ทั้งภาพ — summaryPoster.ts)
  const downloadPoster = async () => {
    if (posterBusy) return;
    setPosterBusy(true);
    try {
      const provinces = new Set(
        (thailandGeo as unknown as { features: { properties: Record<string, string> }[] }).features
          .map((ft) => ft.properties?.name_th)
          .filter((n) => n && zoneOk(n)),
      );
      const title = zoneTitle ?? (summaryScope === 'focus' ? 'ภาคเหนือ + ภาคอีสาน' : 'ทั้งประเทศ');
      const blob = await drawSummaryPoster({ title, provinces, counts: summary, centers: centersRef.current, policies: summaryPolicies });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `นโยบายงานศพปลอดเหล้า-${title.replace(/[\s+]+/g, '-')}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (e) {
      console.error('[summary poster]', e);
      toast.error('สร้างภาพไม่สำเร็จ ลองอีกครั้ง');
    } finally {
      setPosterBusy(false);
    }
  };

  // บันทึกมุมมองแผนที่ปัจจุบันเป็นภาพ PNG (ใส่แถบหัวเรื่องให้พร้อมแปะรายงาน)
  const [capturing, setCapturing] = useState(false);
  const exportMapImage = async () => {
    if (!mapElRef.current || capturing) return;
    setCapturing(true);
    try {
      const map = mapRef.current;
      const mapEl = mapElRef.current;
      if (!map) return;
      // หยุดอนิเมชันการเลื่อน/ซูมก่อน ไม่งั้นตำแหน่ง tile กับพิกัดที่คำนวณจะไม่ตรงกัน
      map.stop();
      await new Promise((r) => setTimeout(r, 600)); // รอ tile ที่ค้างโหลด

      // วาดทุกชั้นเองลง canvas (แม่นยำกว่าการ snapshot DOM ซึ่งอ่าน transform ของ Leaflet ผิด)
      const contRect = mapEl.getBoundingClientRect();
      const k = 2; // ความละเอียด 2 เท่าให้ภาพคมเวลานำไปพิมพ์
      const headerH = 64;
      const out = document.createElement('canvas');
      out.width = contRect.width * k;
      out.height = contRect.height * k + headerH * k;
      const ctx = out.getContext('2d');
      if (!ctx) return;
      const offsetY = headerH * k;

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, out.width, out.height);

      // ชั้นแผนที่พื้นหลัง (tile) — จำกัดพื้นที่วาดไม่ให้ล้นขึ้นไปทับแถบหัวเรื่อง
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, offsetY, out.width, out.height - offsetY);
      ctx.clip();
      const tiles = [...mapEl.querySelectorAll<HTMLImageElement>('img.leaflet-tile')].filter(
        (t) => t.complete && t.naturalWidth > 0
      );
      for (const t of tiles) {
        const r = t.getBoundingClientRect();
        try {
          ctx.drawImage(
            t,
            (r.left - contRect.left) * k,
            (r.top - contRect.top) * k + offsetY,
            r.width * k,
            r.height * k
          );
        } catch {
          /* ข้าม tile ที่วาดไม่ได้ */
        }
      }
      ctx.restore();

      // ── วาดชั้นข้อมูลเองจากพิกัดจริง (ตรงตำแหน่งเสมอ)
      const pt = (lat: number, lng: number) => {
        const p = map.latLngToContainerPoint([lat, lng]);
        return { x: p.x * k, y: p.y * k + offsetY };
      };
      const geoAll = thailandGeo as unknown as {
        features: {
          properties: Record<string, string>;
          geometry: { type: string; coordinates: number[][][] | number[][][][] };
        }[];
      };
      const ringsOf = (g: { type: string; coordinates: number[][][] | number[][][][] }) =>
        g.type === 'Polygon'
          ? (g.coordinates as number[][][])
          : (g.coordinates as number[][][][]).flat();

      ctx.save();
      ctx.beginPath();
      ctx.rect(0, offsetY, out.width, out.height - offsetY);
      ctx.clip();

      const tracePath = (ring: number[][]) => {
        ring.forEach(([lng, lat], i) => {
          const { x, y } = pt(lat, lng);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.closePath();
      };

      for (const f of geoAll.features) {
        const name = f.properties?.name_th;
        if (!name) continue;
        const isSelected = name === selectedProvince;
        const heatValue = heatData.get(name)?.[heatMetric] ?? 0;
        const ps = provinceStyle(byProvince.has(name), isSelected);
        const fill = mapMode === 'heat' ? heatColor(heatValue, heatMax) : ps.fillColor;

        ctx.beginPath();
        for (const ring of ringsOf(f.geometry)) {
          ring.forEach(([lng, lat], i) => {
            const { x, y } = pt(lat, lng);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          });
          ctx.closePath();
        }
        ctx.globalAlpha = mapMode === 'heat' ? 0.75 : ps.fillOpacity;
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.globalAlpha = 1;
        if (mapMode !== 'heat' && !isSelected) {
          ctx.strokeStyle = ps.color;
          ctx.lineWidth = ps.weight * k;
          ctx.stroke();
        }
        if (isSelected) {
          ctx.strokeStyle = mapMode === 'heat' ? '#1c1917' : '#ea580c';
          ctx.lineWidth = 2 * k;
          ctx.stroke();
        }
      }

      // เส้นขอบประเทศ — ทับจังหวัด ใต้หมุด (ลำดับเดียวกับบนจอ)
      ctx.beginPath();
      for (const ring of OUTLINE_RINGS) tracePath(ring);
      ctx.globalAlpha = COUNTRY_LINE.opacity;
      ctx.strokeStyle = COUNTRY_LINE.color;
      ctx.lineWidth = COUNTRY_LINE.weight * k;
      ctx.lineJoin = 'round';
      ctx.stroke();
      ctx.globalAlpha = 1;

      // หมุด — อ่านตำแหน่ง/สี/ขนาดจาก layer ที่อยู่บนแผนที่จริง (วงงานใหม่อ่านจาก options.sdn)
      for (const layer of markersRef.current) {
        const ll = (layer as CircleMarker).getLatLng?.();
        if (!ll) continue;
        const { x, y } = pt(ll.lat, ll.lng);
        const sdn = (layer.options as { sdn?: PulseSpec | LogoSpec | ClusterSpec }).sdn;

        if (sdn?.kind === 'cluster') {
          // วงตัวเลข: พื้นดำ ขอบขาว ตัวเลขขาว — เหมือน .sdn-cluster บนจอ
          const R = (sdn.size / 2) * k;
          ctx.save();
          ctx.shadowColor = 'rgba(0,0,0,.3)';
          ctx.shadowBlur = 3 * k;
          ctx.shadowOffsetY = 1 * k;
          ctx.beginPath();
          ctx.arc(x, y, R - 1 * k, 0, Math.PI * 2);
          ctx.fillStyle = '#111827';
          ctx.fill();
          ctx.restore();
          ctx.lineWidth = 2 * k;
          ctx.strokeStyle = '#ffffff';
          ctx.stroke();
          ctx.fillStyle = '#ffffff';
          ctx.font = `600 ${(sdn.size >= 36 ? 14 : 12) * k}px ${getComputedStyle(document.body).fontFamily}`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(sdn.n), x, y + 0.5 * k);
          continue;
        }

        if (sdn?.kind === 'logo') {
          // วาดจาก <img> ที่โหลดอยู่บนแผนที่แล้ว (same-origin ผ่าน /api/files — canvas ไม่โดน taint)
          const img = (layer as Marker).getElement()?.querySelector('img');
          const R = (sdn.size / 2) * k;
          // วงพื้นสีระดับ + ขอบดำ (ประ = ยังไม่มีนโยบาย) แล้ววางสัญลักษณ์ 62% ของวง — เหมือน .sdn-logo-pin บนจอ
          ctx.save();
          ctx.shadowColor = 'rgba(0,0,0,.3)';
          ctx.shadowBlur = 2 * k;
          ctx.shadowOffsetY = 1 * k;
          ctx.beginPath();
          ctx.arc(x, y, R - 0.75 * k, 0, Math.PI * 2);
          ctx.fillStyle = sdn.fill;
          ctx.fill();
          ctx.restore();
          ctx.lineWidth = 1.5 * k;
          ctx.strokeStyle = LEVEL_STROKE;
          if (sdn.dashed) ctx.setLineDash([3 * k, 2 * k]);
          ctx.stroke();
          ctx.setLineDash([]);
          if (img?.complete && img.naturalWidth > 0) {
            ctx.save();
            // object-fit: contain เหมือนบนจอ — โลโก้ไม่จำเป็นต้องจัตุรัส (สัญลักษณ์งานศพเป็นแนวตั้ง)
            const f = Math.min((R * 1.24) / img.naturalWidth, (R * 1.24) / img.naturalHeight);
            const w = img.naturalWidth * f;
            const h = img.naturalHeight * f;
            ctx.drawImage(img, x - w / 2, y - h / 2, w, h);
            ctx.restore();
          }
          continue;
        }

        if (sdn?.kind === 'pulse') {
          // ภาพนิ่งทำอนิเมชันไม่ได้ → วงส้มโปร่งรอบหมุดแทน
          ctx.beginPath();
          ctx.arc(x, y, 13 * k, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(234,88,12,.7)';
          ctx.lineWidth = 2.5 * k;
          ctx.stroke();
          continue;
        }
        const o = (layer as CircleMarker).options as {
          radius?: number;
          fillColor?: string;
          fillOpacity?: number;
          color?: string;
          weight?: number;
          dashArray?: string;
        };
        ctx.beginPath();
        ctx.arc(x, y, (o.radius ?? 8) * k, 0, Math.PI * 2);
        ctx.globalAlpha = o.fillOpacity ?? 1;
        ctx.fillStyle = o.fillColor ?? PROVINCE_COLOR;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.lineWidth = (o.weight ?? 2) * k;
        ctx.strokeStyle = o.color ?? '#ffffff';
        if (o.dashArray) ctx.setLineDash(o.dashArray.split(' ').map((n) => Number(n) * k));
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.restore();

      // แถบหัวเรื่อง
      ctx.fillStyle = '#ea580c';
      ctx.fillRect(0, 0, out.width, 4 * k);
      ctx.fillStyle = '#1c1917';
      ctx.font = `bold ${20 * k}px ${getComputedStyle(document.body).fontFamily}`;
      const scope = selectedProvince ? `จ.${selectedProvince}` : 'ทั่วประเทศ';
      ctx.fillText(`แผนที่การดำเนินงาน — ${scope}`, 16 * k, 30 * k);

      ctx.fillStyle = '#6b7280';
      ctx.font = `${13 * k}px ${getComputedStyle(document.body).fontFamily}`;
      const parts = [
        `${(selectedProvince ? selectedActivities : filtered).length} งาน`,
        selectedProvince
          ? getRegionLabel((selectedActivities[0]?.region ?? 'central') as HealthZone)
          : `${byProvince.size} จังหวัด`,
        categoryFilter ? `ประเด็น: ${categoryFilter}` : '',
        statusFilter ? `สถานะ: ${STATUS_LABEL[statusFilter]}` : '',
        `ส่งออก ${new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium' }).format(new Date())}`,
      ].filter(Boolean);
      ctx.fillText(parts.join('  ·  '), 16 * k, 50 * k);

      // เครดิตแผนที่ (ต้องแสดงตามเงื่อนไขการใช้งาน OpenStreetMap)
      ctx.font = `${11 * k}px ${getComputedStyle(document.body).fontFamily}`;
      ctx.fillStyle = '#374151';
      const credit = '© OpenStreetMap contributors';
      const cw = ctx.measureText(credit).width;
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      ctx.fillRect(out.width - cw - 12 * k, out.height - 20 * k, cw + 12 * k, 20 * k);
      ctx.fillStyle = '#374151';
      ctx.fillText(credit, out.width - cw - 6 * k, out.height - 6 * k);

      const url = out.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `sdn-แผนที่-${selectedProvince || 'ทั่วประเทศ'}-${new Date()
        .toISOString()
        .slice(0, 10)}.png`;
      a.click();
    } finally {
      setCapturing(false);
    }
  };

  // จำนวนงานรายประเด็น (ตามฟิลเตอร์อื่นที่เลือกอยู่) สำหรับ sidebar
  const countByCategory = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of activities) {
      if (newOnly && !newIds.has(a.id)) continue;
      if (statusFilter && a.status !== statusFilter) continue;
      if (search) {
        const hay =
          `${a.title} ${a.province} ${a.amphoe} ${a.district} ${a.areaName ?? ''} ${a.userName} ${a.category}`.toLowerCase();
        if (!hay.includes(search.toLowerCase())) continue;
      }
      m.set(a.category, (m.get(a.category) ?? 0) + 1);
    }
    return m;
  }, [activities, statusFilter, search, newOnly, newIds]);

  // จำนวนงานรายสถานะ (ตามฟิลเตอร์อื่นที่เลือกอยู่) — '' = ทั้งหมด
  const countByStatus = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of activities) {
      if (newOnly && !newIds.has(a.id)) continue;
      if (categoryFilter && a.category !== categoryFilter) continue;
      if (search) {
        const hay =
          `${a.title} ${a.province} ${a.amphoe} ${a.district} ${a.areaName ?? ''} ${a.userName} ${a.category}`.toLowerCase();
        if (!hay.includes(search.toLowerCase())) continue;
      }
      m.set(a.status, (m.get(a.status) ?? 0) + 1);
      m.set('', (m.get('') ?? 0) + 1);
    }
    return m;
  }, [activities, categoryFilter, search, newOnly, newIds]);

  // จำนวนงานรายประเด็นย่อยของประเด็นที่เลือก (ตามสถานะ/คำค้น/งานใหม่ที่เลือกอยู่)
  const countBySub = useMemo(() => {
    const m = new Map<string, number>();
    if (!categoryFilter) return m;
    for (const a of activities) {
      if (a.category !== categoryFilter || !a.subCategory) continue;
      if (newOnly && !newIds.has(a.id)) continue;
      if (statusFilter && a.status !== statusFilter) continue;
      m.set(a.subCategory, (m.get(a.subCategory) ?? 0) + 1);
    }
    return m;
  }, [activities, categoryFilter, statusFilter, newOnly, newIds]);

  const hasFilter = !!(categoryFilter || subFilter || statusFilter || levelFilter || search || newOnly);
  // จำนวนงานรายระดับนโยบาย — นับจากผลตัวกรองอื่นทั้งหมด ยกเว้นตัวกรองระดับเอง
  const countByLevel = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of activities) {
      if (newOnly && !newIds.has(a.id)) continue;
      if (categoryFilter && a.category !== categoryFilter) continue;
      if (subFilter && a.subCategory !== subFilter) continue;
      if (statusFilter && a.status !== statusFilter) continue;
      const k = a.policyLevel ?? NO_POLICY;
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  }, [activities, categoryFilter, subFilter, statusFilter, newOnly, newIds]);
  const clearFilters = () => {
    setLevelFilter('');
    setSubFilter('');
    setCategoryFilter('');
    setStatusFilter('');
    setSearch('');
    setNewOnly(false);
  };
  // แผงขวา: งานใหม่ขึ้นก่อน
  const panelActivities = [...selectedActivities].sort(
    (a, b) => Number(newIds.has(b.id)) - Number(newIds.has(a.id))
  );
  const railBtnCls = (active: boolean) =>
    `flex flex-col items-center justify-center gap-1 w-full py-3 transition-colors ${
      active ? 'bg-gray-50 text-gray-900' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
    }`;

  return (
    <div className={`relative h-screen${expo ? ` sdn-expo${zoomBucket >= CLUSTER_OFF_ZOOM ? ' sdn-expo-near' : ''}` : ''}`}>
      <div ref={mapElRef} className="sdn-expo-keep absolute inset-0 z-0" />
      {expo && <ExpoMode mapRef={mapRef} shownPosRef={shownPosRef} mapReady={mapReady} activities={activities} pins={pins} zones={expoZones} onExit={exitExpo} />}

      {/* แถบไอคอนลอยด้านซ้าย (การ์ดเดี่ยว ไม่กินพื้นที่แผนที่) */}
      <nav className="absolute top-28 left-3 z-[1100] w-16 bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden divide-y divide-gray-100">
        <button
          onClick={() => setMapMode((m) => (m === 'markers' ? 'heat' : 'markers'))}
          title={mapMode === 'markers' ? 'ดูความหนาแน่น' : 'ดูหมุด'}
          className={railBtnCls(mapMode === 'heat')}
        >
          {mapMode === 'markers' ? <Flame className="w-5 h-5" /> : <MapPin className="w-5 h-5" />}
          <span className="text-[9px] leading-tight text-center px-0.5">
            {mapMode === 'markers' ? 'ความหนาแน่น' : 'หมุด'}
          </span>
        </button>

        <button
          onClick={() => {
            setSelectedPinId(null); // แผงหมุดบ้านปิด — โหมดสรุปซ่อนหมุดบ้าน
            setMapMode((m) => (m === 'summary' ? 'markers' : 'summary'));
          }}
          title="สรุปรายจังหวัด: จำนวนนโยบาย เน้นภาคเหนือและอีสาน"
          className={railBtnCls(mapMode === 'summary')}
        >
          <CircleDot className="w-5 h-5" />
          <span className="text-[9px] leading-tight text-center px-0.5">สรุปจังหวัด</span>
        </button>

        <button
          onClick={() => setSidebarOpen((o) => !o)}
          title="ตัวกรอง: สถานะและประเด็นงาน"
          className={railBtnCls(sidebarOpen)}
        >
          <span className="relative">
            <Layers className="w-5 h-5" />
            {hasFilter && (
              <span className="absolute -top-0.5 -right-1 w-2 h-2 rounded-full bg-gray-900 ring-2 ring-white" />
            )}
          </span>
          <span className="text-[9px] leading-tight text-center px-0.5">ตัวกรอง</span>
        </button>

        <button
          onClick={exportMapImage}
          disabled={capturing}
          title="บันทึกภาพแผนที่ (PNG) พร้อมหัวเรื่องสำหรับแปะรายงาน"
          className={railBtnCls(false)}
        >
          {capturing ? (
            <span className="w-5 h-5 border-2 border-gray-700 border-t-transparent rounded-full animate-spin" />
          ) : (
            <ImageDown className="w-5 h-5" />
          )}
          <span className="text-[9px] leading-tight text-center px-0.5">
            {capturing ? 'กำลังบันทึก' : 'ภาพแผนที่'}
          </span>
        </button>

        <button onClick={enterExpo} title="จอจัดแสดง: วนชมพื้นที่อัตโนมัติ + QR ใหญ่ สำหรับจอบูธ/นิทรรศการ" className={railBtnCls(false)}>
          <MonitorPlay className="w-5 h-5" />
          <span className="text-[9px] leading-tight text-center px-0.5">จอจัดแสดง</span>
        </button>

        {/* Excel ต้องล็อกอิน (API ตอบ 401) — สาธารณะไม่แสดงปุ่ม */}
        {!publicView && (
          <a
            href={`/api/activities/export?${new URLSearchParams({
              ...(categoryFilter ? { category: categoryFilter } : {}),
              ...(statusFilter ? { status: statusFilter } : {}),
              ...(search ? { q: search } : {}),
            }).toString()}`}
            title={`ส่งออก Excel (${filtered.length} งาน)`}
            className={railBtnCls(false)}
          >
            <FileSpreadsheet className="w-5 h-5" />
            <span className="text-[9px] leading-tight text-center px-0.5">Excel</span>
          </a>
        )}
      </nav>

      {/* แผงหมวดหมู่ — ลอยถัดจากแถบไอคอน */}
      {sidebarOpen && (
        <aside className="absolute top-28 left-[88px] z-[1100] w-60 max-w-[calc(100vw-7rem)] max-h-[calc(100%-9rem)] overflow-y-auto bg-white rounded-2xl shadow-xl border border-gray-100">
          <div className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-gray-800">
                  ตัวกรอง
                </h2>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {filtered.length} งาน · {byProvince.size} จังหวัด
                </p>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                aria-label="ปิดแผงหมวดหมู่"
                className="-mr-1 p-1 rounded text-gray-300 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {/* สถานะ — ย้ายมาจากชิปบนแผนที่ (เดิมบังการมองแผนที่) ใช้ได้ทั้งโหมดหมุดและความหนาแน่น */}
            <p className="mt-4 mb-1.5 text-[11px] font-semibold text-gray-500">สถานะ</p>
            <ul className="space-y-0.5">
              {STATUS_CHIPS.map(({ value, label, Icon }) => {
                const active = statusFilter === value;
                const count = value ? countByStatus.get(value) ?? 0 : countByStatus.get('') ?? 0;
                return (
                  <li key={value || 'all'}>
                    <button
                      onClick={() => setStatusFilter(value)}
                      aria-pressed={active}
                      className={`flex items-center gap-2 w-full text-left text-xs rounded-lg px-2 py-1.5 transition-colors ${
                        active ? 'bg-gray-50 text-gray-900 font-medium' : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <Icon className={`w-3.5 h-3.5 shrink-0 ${active ? 'text-gray-900' : 'text-gray-400'}`} />
                      <span className="flex-1 truncate">{label}</span>
                      <span className="text-[10px] text-gray-400">{count}</span>
                    </button>
                  </li>
                );
              })}
            </ul>

            <p className="mt-4 mb-1 text-[11px] font-semibold text-gray-500">
              {mapMode === 'heat' ? 'ความหนาแน่น' : 'ประเด็นงาน'}
            </p>
            {mapMode === 'heat' ? (
              <div>
                <div className={publicView ? 'hidden' : 'space-y-1.5'}>
                  {(
                    [
                      ['activities', 'ตามจำนวนงาน'],
                      ['people', 'ตามจำนวนเจ้าหน้าที่'],
                    ] as const
                  ).map(([metric, label]) => (
                    <label
                      key={metric}
                      className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer"
                    >
                      <input
                        type="radio"
                        name="heatMetric"
                        checked={heatMetric === metric}
                        onChange={() => setHeatMetric(metric)}
                        className="accent-gray-900"
                      />
                      {label}
                    </label>
                  ))}
                </div>
                <div className="mt-4 flex items-center gap-0.5">
                  <span
                    className="flex-1 h-3 rounded-sm border border-gray-200"
                    style={{ backgroundColor: HEAT_EMPTY }}
                  />
                  {HEAT_RAMP.map((c) => (
                    <span key={c} className="flex-1 h-3 rounded-sm" style={{ backgroundColor: c }} />
                  ))}
                </div>
                <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                  <span>ไม่มีงาน</span>
                  <span>มาก ({heatMax})</span>
                </div>
                <p className={publicView ? 'hidden' : 'mt-4 text-[11px] text-gray-400 leading-relaxed'}>
                  เกณฑ์ &quot;จำนวนเจ้าหน้าที่&quot; ช่วยให้เห็นพื้นที่ที่หลายคนลงทำงานทับกัน
                </p>
              </div>
            ) : (
              <>
                <ul className="space-y-0.5">
                  {categories.map((c) => {
                    const active = categoryFilter === c;
                    const count = countByCategory.get(c) ?? 0;
                    return (
                      <li key={c}>
                        <button
                          onClick={() => {
                            setCategoryFilter(active ? '' : c);
                            setSubFilter('');
                          }}
                          className={`flex items-center gap-2 w-full text-left text-xs rounded-lg px-2 py-1.5 transition-colors ${
                            active
                              ? 'bg-gray-50 text-gray-900 font-medium'
                              : 'text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          {categoryLogos[c] ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={categoryLogos[c]}
                              alt=""
                              className="w-5 h-5 -my-1 rounded-full bg-white shadow object-contain p-px shrink-0"
                            />
                          ) : (
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: colorOf(c) }}
                            />
                          )}
                          <span className="flex-1 truncate">{c}</span>
                          <span className="text-[10px] text-gray-400">{count}</span>
                        </button>
                        {/* ประเด็นย่อย — กางเมื่อเลือกประเด็นนี้และมีงานที่ระบุประเด็นย่อย */}
                        {active && countBySub.size > 0 && (
                          <ul className="ml-5 mt-0.5 mb-1 pl-2 border-l border-gray-200 space-y-0.5">
                            {[...countBySub.entries()]
                              .sort((x, y) => y[1] - x[1])
                              .map(([sub, n]) => {
                                const on = subFilter === sub;
                                return (
                                  <li key={sub}>
                                    <button
                                      onClick={() => setSubFilter(on ? '' : sub)}
                                      aria-pressed={on}
                                      className={`flex items-center gap-2 w-full text-left text-[11px] rounded-md px-2 py-1 transition-colors ${
                                        on ? 'bg-gray-100 text-gray-900 font-medium' : 'text-gray-500 hover:bg-gray-50'
                                      }`}
                                    >
                                      {subCategoryLogos[`${c}|${sub}`] && (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                          src={subCategoryLogos[`${c}|${sub}`]}
                                          alt=""
                                          className="w-4 h-4 rounded-full bg-white shadow object-contain shrink-0"
                                        />
                                      )}
                                      <span className="flex-1 truncate">{sub}</span>
                                      <span className="text-[10px] text-gray-400">{n}</span>
                                    </button>
                                  </li>
                                );
                              })}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
                {/* ระดับนโยบาย = คำอธิบายสี/ขนาดหมุด + กดกรองได้ */}
                <p className="mt-4 mb-1.5 text-[11px] font-semibold text-gray-500">ข้อตกลงระดับ (สีหมุด)</p>
                <ul className="space-y-0.5">
                  {[...POLICY_LEVELS.map((l) => ({ value: l.value as string, label: `ระดับ${l.label}` })), { value: NO_POLICY, label: 'ยังไม่มีข้อตกลง' }]
                    .filter(({ value }) => (countByLevel.get(value) ?? 0) > 0 || levelFilter === value)
                    .map(({ value, label }) => {
                      const on = levelFilter === value;
                      const pin = levelPin(value === NO_POLICY ? null : value);
                      const d = Math.round(pin.size / 2.2); // ย่อขนาดจริงลงในรายการ แต่ยังเห็นเล็ก→ใหญ่
                      return (
                        <li key={value}>
                          <button
                            onClick={() => setLevelFilter(on ? '' : value)}
                            aria-pressed={on}
                            className={`flex items-center gap-2 w-full text-left text-xs rounded-lg px-2 py-1.5 transition-colors ${
                              on ? 'bg-gray-50 text-gray-900 font-medium' : 'text-gray-600 hover:bg-gray-50'
                            }`}
                          >
                            <span className="w-5 flex justify-center shrink-0">
                              <LevelSwatch pin={pin} size={d} />
                            </span>
                            <span className="flex-1 truncate">{label}</span>
                            <span className="text-[10px] text-gray-400">{countByLevel.get(value) ?? 0}</span>
                          </button>
                        </li>
                      );
                    })}
                </ul>
                <MapLegend publicView={publicView} />
                {hasFilter && (
                  <button
                    onClick={clearFilters}
                    className="mt-2 w-full py-1.5 rounded-lg text-[11px] text-gray-500 hover:bg-gray-50 hover:text-gray-600 transition-colors"
                  >
                    ล้างตัวกรองทั้งหมด
                  </button>
                )}
              </>
            )}
          </div>
        </aside>
      )}

      {/* แถบค้นหา + ชิปสถานะ (แบบ Google) */}
      <div className="absolute top-16 left-3 right-3 z-[1000] flex items-start gap-2 pointer-events-none ">
        <div className="pointer-events-auto flex items-center gap-2 bg-white rounded-full shadow-lg border border-gray-200 pl-4 pr-2 h-11 w-[240px] sm:w-[300px]">
          <Search className="w-4 h-4 text-gray-400 shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={publicView ? "ค้นหางาน หรือพื้นที่" : "ค้นหางาน พื้นที่ หรือชื่อคน"}
            className="flex-1 min-w-0 text-sm text-gray-800 bg-transparent focus:outline-none placeholder:text-gray-400"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              aria-label="ล้างคำค้นหา"
              className="p-1 rounded-full text-gray-400 hover:bg-gray-100"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* ชิปงานใหม่ — แสดงบนมือถือด้วย (ชิปสถานะซ่อนบนจอเล็ก) */}
        {newIds.size > 0 && (
          <button
            onClick={() => setNewOnly((v) => !v)}
            aria-pressed={newOnly}
            title={newOnly ? 'แสดงงานทั้งหมด' : 'ดูเฉพาะงานใหม่ตั้งแต่เข้าชมครั้งก่อน'}
            className={`pointer-events-auto shrink-0 inline-flex items-center gap-1.5 h-11 px-4 rounded-full text-xs font-semibold whitespace-nowrap border shadow-lg transition-colors ${
              newOnly
                ? 'bg-orange-600 text-white border-orange-600'
                : 'bg-white text-gray-900 border-gray-300 hover:bg-gray-50'
            }`}
          >
            {newOnly ? (
              <Sparkles className="w-3.5 h-3.5" />
            ) : (
              <span className="relative flex w-2 h-2">
                <span className="absolute inset-0 rounded-full bg-orange-500 motion-safe:animate-ping" />
                <span className="relative w-2 h-2 rounded-full bg-orange-600" />
              </span>
            )}
            ใหม่ {newIds.size} งาน
          </button>
        )}

      </div>

      {/* แผงรายละเอียดจังหวัด — ลอยขวา (จอเล็ก: ชิดล่าง) */}
      {/* โหมดสรุป: หัวการ์ด "ทำแล้วที่ไหนบ้าง" + เลือกขอบเขต + คำอธิบายวง (แบบอินโฟกราฟิกที่ผู้ใช้ชอบ 24 พ.ย. 2026) */}
      {mapMode === 'summary' && !(selectedProvince && summaryList) && (
        <PolicySummaryCard
          policies={selectedProvince ? selectedActivities.flatMap((a) => a.policies ?? []) : summaryPolicies}
          province={selectedProvince || null}
          areas={
            selectedProvince
              ? Object.entries(
                  selectedActivities.reduce<Record<string, number>>((m, a) => {
                    if (a.policyCount) m[a.amphoe] = (m[a.amphoe] ?? 0) + a.policyCount;
                    return m;
                  }, {}),
                ).sort((a, b) => b[1] - a[1])
              : []
          }
          workCount={selectedActivities.length}
          onClear={() => setSelectedProvince('')}
          onList={() => setSummaryList(true)}
          title={zoneTitle}
          onDownload={downloadPoster}
          downloading={posterBusy}
        />
      )}
      {mapMode === 'summary' && (
        <div className="absolute left-1/2 top-16 z-[1000] w-[min(480px,calc(100vw-7rem))] -translate-x-1/2 rounded-2xl border border-gray-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur max-sm:left-[88px] max-sm:translate-x-0 max-sm:w-[calc(100vw-100px)]">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <p className="text-base font-bold text-gray-900">
              ทำแล้วที่ไหนบ้าง{zoneTitle && <span className="text-gray-900"> · {zoneTitle}</span>}
            </p>
            {booth && (
              <button
                type="button"
                onClick={() => setBooth(false)}
                className="order-last inline-flex min-h-7 items-center gap-1.5 rounded-full bg-yellow-100 px-2.5 text-xs font-medium text-gray-900 hover:bg-yellow-200"
                title="หยุดวนอัตโนมัติ"
              >
                <span className="h-2 w-2 animate-pulse rounded-full bg-yellow-500" aria-hidden="true" /> วนภาคอัตโนมัติ · หยุด
              </button>
            )}
            <p className="text-sm font-semibold tabular-nums text-gray-900">
              {countTotal.toLocaleString('th-TH')} นโยบาย · {countProv} จังหวัด
            </p>
          </div>
          <div className="mt-2 flex items-center gap-1.5">
            {(
              [
                ['focus', 'เหนือ + อีสาน'],
                ['all', 'ทั้งประเทศ'],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => {
                  setSummaryScope(k);
                  setSummaryZones([]);
                  setSelectedProvince('');
                }}
                aria-pressed={summaryScope === k}
                className={`min-h-8 whitespace-nowrap rounded-full px-3 text-xs font-medium ${summaryScope === k ? 'bg-gray-900 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
              >
                {label}
              </button>
            ))}
            {/* คำอธิบายวง: ตัวเลข = จำนวนนโยบายในจังหวัด · วงใหญ่ = มีมาก */}
            <span className="ml-auto hidden items-center gap-1.5 text-xs text-gray-500 sm:flex">
              {[16, 21, 27].map((d, i) => (
                <span
                  key={d}
                  className="inline-flex items-center justify-center rounded-full bg-yellow-400 font-bold text-gray-900 ring-2 ring-gray-900"
                  style={{ width: d, height: d, fontSize: 9 + i * 2 }}
                  aria-hidden="true"
                >
                  {[1, 3, 8][i]}
                </span>
              ))}
              <span>= จำนวนนโยบาย</span>
            </span>
          </div>
          {/* เลือกภาค (หลายภาคได้) — ชุดเดียวกับปุ่มภาคบนแผนที่ · มือถือใช้แถวนี้ (ปุ่มบนแผนที่ซ่อน) */}
          <div className="-mx-1 mt-2 flex items-center gap-1.5 overflow-x-auto border-t border-gray-100 px-1 pt-2">
            <button
              type="button"
              onClick={() => {
                setSummaryZones([]);
                setSelectedProvince('');
              }}
              aria-pressed={summaryZones.length === 0}
              className={`min-h-8 shrink-0 whitespace-nowrap rounded-full px-3 text-xs font-medium ${summaryZones.length === 0 ? 'bg-yellow-400 text-gray-900' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
            >
              ทุกภาค
            </button>
            {scopeZones.map((z) => {
              const on = summaryZones.includes(z);
              return (
                <button
                  key={z}
                  type="button"
                  onClick={() => toggleZone(z)}
                  aria-pressed={on}
                  className={`inline-flex min-h-8 shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-3 text-xs font-medium ${on ? 'bg-gray-900 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                >
                  {on && <Check className="w-3.5 h-3.5" />}
                  {zoneShort(z)}
                  <span className={`tabular-nums ${on ? 'text-yellow-300' : 'text-gray-500'}`}>{zoneTotals.get(z) ?? 0}</span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={downloadPoster}
              disabled={posterBusy || summaryTotal === 0}
              className="ml-auto inline-flex min-h-8 shrink-0 items-center gap-1 rounded-full border border-gray-300 px-3 text-xs font-medium text-gray-900 hover:bg-gray-50 disabled:opacity-50 md:hidden"
              aria-label="ดาวน์โหลดภาพสรุป"
            >
              <Download className="w-3.5 h-3.5" /> ภาพ
            </button>
          </div>
        </div>
      )}

      {selectedPinId != null && !selectedProvince && (() => {
        const pin = pins.find((p) => p.id === selectedPinId);
        return pin ? (
          <FamilyPinPanel pin={pin} canEdit={canManagePins || myPinIds.includes(pin.id)} onClose={() => setSelectedPinId(null)} />
        ) : null;
      })()}

      {selectedProvince && (mapMode !== 'summary' || summaryList) && (
        <aside className="absolute z-[1000] bg-white rounded-2xl border border-gray-200 shadow-xl overflow-auto sm:top-16 sm:right-4 sm:bottom-4 sm:w-[340px] max-sm:inset-x-2 max-sm:bottom-2 max-sm:max-h-[45%]">
        <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-gray-200 p-4 flex items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-gray-800">จ.{selectedProvince}</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {selectedActivities.length > 0 && (
                <>{getRegionLabel(selectedActivities[0].region as HealthZone)} · </>
              )}
              {selectedActivities.length} งาน
            </p>
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              onClick={() => {
                setSelectedProvince('');
                setSummaryList(false);
              }}
              className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"
              aria-label="ปิด"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-4 pt-3">
          {!publicView && selectedUserCount > 1 && (
            <div className="mb-3 flex items-center gap-2 text-xs bg-gray-50 border border-gray-200 text-gray-900 rounded-lg px-3 py-2">
              <Users className="w-4 h-4 shrink-0" />
              จังหวัดนี้มีเพื่อนร่วมงานหลายคน — ต้นทุนเครือข่ายที่ต่อยอดร่วมกันได้
            </div>
          )}

          {selectedActivities.length === 0 ? (
            <p className="py-6 text-sm text-gray-400 text-center">
              ไม่มีงานที่ตรงกับฟิลเตอร์ในจังหวัดนี้
            </p>
          ) : (
            <ul className="space-y-3">
              {panelActivities.map((a) => (
                <li key={a.id}>
                  <PanelItem
                    href={publicView ? (a.published ? `/stories/${a.id}` : null) : `/activity/${a.id}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-gray-50 text-gray-700 text-[11px] font-medium">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: colorOf(a.category) }}
                        />
                        {a.category}
                      </span>
                      <span className="flex items-center gap-1.5 text-[11px] text-gray-400">
                        {newIds.has(a.id) && (
                          <span className="px-1.5 py-px rounded-full bg-gray-900 text-white text-[10px] font-bold">
                            ใหม่
                          </span>
                        )}
                        {STATUS_LABEL[a.status] ?? a.status}
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm font-medium text-gray-800">{a.title}</p>
                    <p className="mt-1 text-xs text-gray-500">
                      <MapPin className="inline w-3.5 h-3.5 mr-0.5 text-gray-600" />
                      {a.areaName ? `${a.areaName} · ` : ''}ต.{a.district} อ.{a.amphoe}
                    </p>
                    {publicView ? (
                      a.published && (
                        <p className="mt-1.5 text-xs font-semibold text-gray-900">อ่านกรณีศึกษา →</p>
                      )
                    ) : (
                      <p className="mt-0.5 text-xs text-gray-400">
                        โดย {a.userName}
                        {a.locationSource === 'TAMBON' && ' · ตำแหน่งโดยประมาณ'}
                      </p>
                    )}
                  </PanelItem>
                </li>
              ))}
            </ul>
          )}
        </div>
        </aside>
      )}

      {/* ชวนครอบครัวปักหมุดงานศพปลอดเหล้า — จอใหญ่ = QR (ย่อเก็บได้) · มือถือ = ปุ่มไปฟอร์ม · ซ่อนเมื่อแผงข้างเปิด (ไม่ให้ทับกัน) */}
      {selectedPinId == null && !selectedProvince && mapMode !== 'summary' && (
        <div className="absolute bottom-24 right-3 z-[900] sm:right-14 md:bottom-16">
          {pinCardOpen ? (
            <div className="sdn-nudge hidden items-center gap-3 rounded-2xl border border-gray-200 bg-white p-3 shadow-lg md:flex">
              <NextImage src="/farewell/qr-pin.svg" alt="QR ปักหมุดงานศพปลอดเหล้า" width={88} height={88} unoptimized />
              <div className="max-w-40">
                <p className="text-sm font-semibold leading-snug text-gray-900">บ้านคุณเคยจัดงานศพปลอดเหล้า? สแกนปักหมุด</p>
                <p className="mt-1.5 text-xs text-gray-600">
                  ปักหมุดแล้ว <span className="font-semibold tabular-nums text-gray-900">{pins.length}</span> แห่ง
                </p>
              </div>
              <button type="button" onClick={() => setPinCardOpen(false)} aria-label="ย่อการ์ด" className="self-start rounded-full p-2 text-gray-500 hover:bg-gray-50">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setPinCardOpen(true)} className="hidden rounded-full border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 shadow-lg md:block">
              ปักหมุด · {pins.length} แห่ง
            </button>
          )}
          <a href="/pin" className="sdn-nudge inline-flex h-11 items-center gap-2 rounded-full bg-gray-900 px-5 text-sm font-medium text-white shadow-lg md:hidden">
            ปักหมุดของบ้านคุณ <span className="tabular-nums text-white/70">· {pins.length}</span>
          </a>
        </div>
      )}

      {/* การ์ดล่างซ้าย (โหมดหมุด, ทุกจอ): บรรทัดบน = แผนที่นี้คืออะไร + จำนวน (ตัวเลขในวงมีหน่วย) · บรรทัดล่าง = สีหมุด = ข้อตกลงระดับ… กดกรองได้ + หมุดบ้าน
          (26 พ.ย. 2026 ผู้ใช้ตรวจแล้วคนทั่วไปงง "40 คืออะไร", "หมู่บ้าน 64 = จำนวนหมู่บ้าน?" — บนแผนที่ใช้คำ "ข้อตกลง" แทน "นโยบาย") */}
      {mapMode === 'markers' && !sidebarOpen && (
        <div className="absolute bottom-4 left-3 right-14 sm:right-auto sm:max-w-[calc(100vw-120px)] md:max-w-[calc(100vw-440px)] z-[1000] flex">
          <div className="min-w-0 max-w-full rounded-2xl border border-gray-200 bg-white/95 px-3 py-2 text-xs text-gray-700 shadow-lg backdrop-blur">
          <p className="truncate font-semibold text-gray-900">
            งานศพปลอดเหล้า <span className="tabular-nums">{filtered.length}</span> พื้นที่ · <span className="tabular-nums">{byProvince.size}</span> จังหวัด
            <span className="hidden font-normal text-gray-500 sm:inline"> · วงตัวเลข = หลายพื้นที่ใกล้กัน คลิกเพื่อซูม</span>
          </p>
          <div className="-mx-1 mt-1 flex items-center gap-1 overflow-x-auto whitespace-nowrap [scrollbar-width:none]">
            <span className="shrink-0 px-1 text-gray-500">ข้อตกลงระดับ</span>
            {[...POLICY_LEVELS.map((l) => ({ value: l.value as string, label: l.label })), { value: NO_POLICY, label: 'ยังไม่มีข้อตกลง' }]
              .filter(({ value }) => (countByLevel.get(value) ?? 0) > 0)
              .map(({ value, label }) => {
                const on = levelFilter === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setLevelFilter(on ? '' : value)}
                    aria-pressed={on}
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-1 transition-colors ${
                      on ? 'bg-gray-900 text-white' : 'hover:bg-gray-100'
                    }`}
                  >
                    <LevelSwatch pin={levelPin(value === NO_POLICY ? null : value)} size={12} />
                    {label}
                    <span className={`tabular-nums ${on ? 'text-white/70' : 'text-gray-500'}`}>{countByLevel.get(value) ?? 0}</span>
                  </button>
                );
              })}
            {pins.length > 0 && (
              <>
                <span className="mx-1 h-3.5 w-px shrink-0 bg-gray-200" />
                <span className="inline-flex shrink-0 items-center gap-1.5 px-1">
                  <HouseDot size={14} />
                  ครอบครัวปักหมุด <span className="tabular-nums text-gray-500">{pins.length}</span>
                </span>
              </>
            )}
            {newIds.size > 0 && (
              <>
                <span className="mx-1 h-3.5 w-px shrink-0 bg-gray-200" />
                <span className="inline-flex shrink-0 items-center gap-1.5 pr-2">
                  <span className="relative inline-flex w-3 h-3 items-center justify-center">
                    <span className="absolute inset-0 rounded-full border-2 border-gray-700 motion-safe:animate-ping" />
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-900" />
                  </span>
                  งานใหม่
                </span>
              </>
            )}
          </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── คำอธิบายสัญลักษณ์บนแผนที่ (ใช้ทั้งแผงหมวดหมู่และแถบล่างซ้าย)
/** จุดตัวอย่างสีระดับนโยบาย — หน้าตาเดียวกับหมุด (พื้นสีระดับ ขอบดำ · ประ = ยังไม่มีนโยบาย) */
function LevelSwatch({ pin, size }: { pin: LevelPinStyle; size: number }) {
  return (
    <span
      className="inline-block shrink-0 rounded-full"
      style={{ width: size, height: size, backgroundColor: pin.fill, border: `1.5px ${pin.dashed ? 'dashed' : 'solid'} ${LEVEL_STROKE}` }}
    />
  );
}
function LegendDot({ solid = false }: { solid?: boolean }) {
  return solid ? (
    <span className="w-3 h-3 rounded-full shrink-0 bg-gray-600 ring-2 ring-white shadow" />
  ) : (
    <span className="w-3 h-3 rounded-full shrink-0 bg-gray-600/60 border-2 border-dashed border-gray-600" />
  );
}

/** หมุดบ้าน (ครอบครัวปักหมุด) ย่อส่วน — หน้าตาเดียวกับ .sdn-family-pin บนแผนที่ */
function HouseDot({ size }: { size: number }) {
  return (
    <span className="inline-flex shrink-0 items-center justify-center rounded-full border-2 border-white bg-orange-600 shadow" style={{ width: size + 4, height: size + 4 }}>
      <svg viewBox="0 0 24 24" style={{ width: size * 0.65, height: size * 0.65 }} aria-hidden="true"><path fill="white" d="M3 11.2 12 4l9 7.2-1.4 1.7-1.6-1.3V20h-5v-5h-2v5H8v-8.4l-1.6 1.3z" /></svg>
    </span>
  );
}

function MapLegend({ publicView }: { publicView: boolean }) {
  return (
    <div className="mt-4 pt-3 border-t border-gray-100 space-y-2 text-[11px] text-gray-500 leading-snug">
      <p className="flex items-center gap-2"><HouseDot size={16} /><span>ครอบครัว/ชุมชนที่ปักหมุด</span></p>
      <p>สีและขนาดวง = ข้อตกลงระดับไหน (วงเล็ก = หมู่บ้าน → วงใหญ่ = จังหวัด/ประเทศ) · วงดำตัวเลข = หลายพื้นที่ใกล้กัน คลิกเพื่อซูม — คลิกหมุดดูรายละเอียด คลิกจังหวัดดูรายการทั้งหมด</p>
      <p className={publicView ? 'hidden' : 'flex items-center gap-2'}>
        <LegendDot solid />
        <span>ปักหมุดตำแหน่งจริง</span>
      </p>
      <p className="flex items-center gap-2">
        <LegendDot />
        <span>ตำแหน่งโดยประมาณ (จุดกลางตำบล)</span>
      </p>
      <p className="flex items-center gap-2">
        <span className="relative inline-flex w-3 h-3 shrink-0 items-center justify-center">
          <span className="absolute inset-0 rounded-full border-2 border-gray-700" />
          <span className="w-1.5 h-1.5 rounded-full bg-gray-900" />
        </span>
        <span>งานใหม่ตั้งแต่เข้าชมครั้งก่อน</span>
      </p>
    </div>
  );
}

// การ์ดงานในแผงจังหวัด — มีที่ไป = ลิงก์ · สาธารณะที่ยังไม่มีกรณีศึกษา = การ์ดเฉย ๆ
function PanelItem({ href, children }: { href: string | null; children: ReactNode }) {
  const cls = 'block border border-gray-200 rounded-xl p-3';
  return href ? (
    <a href={href} className={`${cls} hover:border-gray-400 hover:bg-gray-50/40 transition-colors`}>
      {children}
    </a>
  ) : (
    <div className={cls}>{children}</div>
  );
}
