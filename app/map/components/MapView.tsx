'use client';

// แผนที่รวมการดำเนินงานทั้งองค์กร — เต็มความสูงจอ ควบคุมด้วยแผงลอยบนแผนที่
// ใช้ Leaflet ล้วน (โหลดใน useEffect เพื่อเลี่ยง SSR)

import { useEffect, useMemo, useRef, useState } from 'react';
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
} from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import thailandGeo from '@/app/data/thailand.json';
// เส้นขอบประเทศ (รวม 77 จังหวัดไว้ล่วงหน้า — scripts/build-thailand-outline.mjs) ใช้วาดขอบเข้ม + ฉากจางนอกประเทศ
import thailandOutline from '@/app/data/thailand-outline.json';
import { getRegionLabel } from '@/app/utils/healthZones';
import { makeColorOf } from '@/app/lib/categoryColors';
import type { HealthZone } from '@/app/utils/healthZones';
import { navigationUrl } from '@/app/lib/geoLink';

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
// หมุดโลโก้ (หมวดที่แอดมินใส่โลโก้ไว้) — วงกลมขาวเปล่าใส่โลโก้ (ไม่มีขอบสี) ใหญ่กว่าหมุดสีให้พอดูออก
const LOGO_PIN = 36;
interface LogoSpec {
  kind: 'logo';
  color: string;
  approx: boolean;
}
// เส้นขอบประเทศบาง ๆ สีเกือบดำ — แค่พอสังเกตขอบเขต ไม่ให้หน้าตาแผนที่ต่างจากเดิม (ผู้ใช้ไม่เอาฉากจางนอกประเทศ)
// ไม่ใช้ส้ม — ส้มสงวนไว้ให้ข้อมูล (หมุด/ความหนาแน่น/จังหวัดที่เลือก)
const COUNTRY_LINE = { color: '#1c1917', weight: 1.2, opacity: 0.55 };
const PROVINCE_LINE = { color: '#d1d5db', weight: 1 };
// วงนอกของแผ่นดินใหญ่ + เกาะ ([lng, lat]) — ใช้วาดเส้นขอบประเทศใน PNG
const OUTLINE_RINGS = (thailandOutline.geometry.coordinates as number[][][][]).map((p) => p[0]);

const logoPinHtml = (src: string, color: string, approx: boolean) =>
  `<div class="sdn-logo-pin${approx ? ' sdn-logo-pin--approx' : ''}" style="--c:${color}"><img src="${esc(src)}" alt="" draggable="false"></div>`;

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

export default function MapView({ activities, categories, categoryLogos, subCategoryLogos, publicView = false }: MapViewProps) {
  // โลโก้ของงาน: ประเด็นย่อย → ประเด็นหลัก → ไม่มี (ใช้หมุดสี)
  const logoOf = (a: MapActivity) =>
    (a.subCategory && subCategoryLogos[`${a.category}|${a.subCategory}`]) || categoryLogos[a.category];
  const mapElRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const geoLayerRef = useRef<GeoJSONLayer | null>(null);
  const markersRef = useRef<(CircleMarker | Marker)[]>([]);
  const centersRef = useRef<Map<string, [number, number]>>(new Map());
  const boundsRef = useRef<Map<string, LatLngBounds>>(new Map());
  const fullBoundsRef = useRef<LatLngBounds | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [selectedProvince, setSelectedProvince] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [subFilter, setSubFilter] = useState(''); // ประเด็นย่อย — ใช้ได้เมื่อเลือกประเด็นแล้ว
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false); // เปิดเมื่อคลิกไอคอนหมวดหมู่
  const [mapMode, setMapMode] = useState<'markers' | 'heat'>('markers');
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
        if (search) {
          const hay =
            `${a.title} ${a.province} ${a.amphoe} ${a.district} ${a.areaName ?? ''} ${a.userName} ${a.category} ${a.subCategory ?? ''} ${a.extraAreas
              .map((x) => `${x.province} ${x.amphoe} ${x.district} ${x.areaName ?? ''}`)
              .join(' ')}`.toLowerCase();
          if (!hay.includes(search.toLowerCase())) return false;
        }
        return true;
      }),
    [activities, categoryFilter, subFilter, statusFilter, search, newOnly, newIds]
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
      }).setView([13.5, 101], 6);
      L.control.zoom({ position: 'bottomright' }).addTo(map);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
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
      const L = (await import('leaflet')).default;
      const map = mapRef.current!;

      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      sitesByProvince.forEach((list, province) => {
        const center = centersRef.current.get(province);
        if (!center) return;

        // ทุกงานเป็นหมุดของตัวเองตามตำแหน่งจริง สีตามประเด็น (ไม่รวมเป็นวงรายจังหวัด — ผู้ใช้อยากเห็นพื้นที่จริง)
        // งานที่พิกัดเดียวกันกระจายรอบจุดเล็กน้อยให้เห็นครบ · โหมดความหนาแน่นแสดงหมุดเฉพาะจังหวัดที่เลือก
        if (mapMode === 'markers' || province === selectedProvince) {
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
              const a = site.a;
              // กระจายหมุดที่จุดเดียวกันเป็นวงรอบ ๆ ให้เห็นครบทุกงาน
              // (หมุดตำแหน่งจริงกระจายวงเล็ก ~50 ม. ไม่ให้หลุดจากที่ตั้งจริงไกล)
              const offset = group.length > 1 ? (key.startsWith('pin:') ? 0.0005 : 0.012) : 0;
              const angle = (2 * Math.PI * i) / group.length;
              const pos: [number, number] = [
                base[0] + offset * Math.sin(angle),
                base[1] + offset * Math.cos(angle),
              ];
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
                marker = L.marker(pos, {
                  icon: L.divIcon({
                    html: logoPinHtml(logo, color, !precise),
                    className: '',
                    iconSize: [LOGO_PIN, LOGO_PIN],
                    iconAnchor: [LOGO_PIN / 2, LOGO_PIN / 2],
                    popupAnchor: [0, -LOGO_PIN / 2],
                    tooltipAnchor: [0, -LOGO_PIN / 2],
                  }),
                  riseOnHover: true,
                  alt: a.category,
                }).addTo(map);
                (marker.options as { sdn?: LogoSpec }).sdn = { kind: 'logo', color, approx: !precise };
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
                autoPanPadding: [24, 24],
                maxWidth: 260,
              });
              markersRef.current.push(marker);
            });
          });
        }
      });

      geoLayerRef.current?.setStyle((feature) => {
        const name = feature?.properties?.name_th as string;
        const isSelected = name === selectedProvince;

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

        return {
          fillColor: isSelected ? '#ea580c' : '#ffffff',
          fillOpacity: isSelected ? 0.12 : 0.02,
          color: isSelected ? '#ea580c' : PROVINCE_LINE.color,
          weight: isSelected ? 2 : PROVINCE_LINE.weight,
        };
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
        } else {
          layer.getTooltip()?.setContent(name);
        }
      });
    })();
  }, [mapReady, byProvince, sitesByProvince, selectedProvince, categoryFilter, colorOf, mapMode, heatMetric, heatData, heatMax, newIds, categoryLogos, subCategoryLogos, publicView]);

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
      map.flyToBounds(corners, { padding: [56, 56], maxZoom: 9, duration: 0.6 });
    } else if (fullBoundsRef.current) {
      map.flyToBounds(fullBoundsRef.current, { padding: [16, 16], duration: 0.6 });
    }
    // ตั้งใจไม่ผูกกับ search เพื่อไม่ให้แผนที่ขยับทุกครั้งที่พิมพ์
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, selectedProvince, categoryFilter, subFilter, statusFilter, newOnly]);

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
        const fill =
          mapMode === 'heat' ? heatColor(heatValue, heatMax) : isSelected ? '#ea580c' : null;
        if (!fill && !isSelected) continue;

        ctx.beginPath();
        for (const ring of ringsOf(f.geometry)) {
          ring.forEach(([lng, lat], i) => {
            const { x, y } = pt(lat, lng);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          });
          ctx.closePath();
        }
        if (fill) {
          ctx.globalAlpha = mapMode === 'heat' ? 0.75 : 0.12;
          ctx.fillStyle = fill;
          ctx.fill();
          ctx.globalAlpha = 1;
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
        const sdn = (layer.options as { sdn?: PulseSpec | LogoSpec }).sdn;

        if (sdn?.kind === 'logo') {
          // วาดจาก <img> ที่โหลดอยู่บนแผนที่แล้ว (same-origin ผ่าน /api/files — canvas ไม่โดน taint)
          const img = (layer as Marker).getElement()?.querySelector('img');
          const R = (LOGO_PIN / 2) * k;
          ctx.save();
          ctx.globalAlpha = sdn.approx ? 0.75 : 1;
          ctx.shadowColor = 'rgba(0,0,0,.35)';
          ctx.shadowBlur = 4 * k;
          ctx.shadowOffsetY = 1 * k;
          ctx.beginPath();
          ctx.arc(x, y, R, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
          ctx.shadowColor = 'transparent';
          if (img?.complete && img.naturalWidth > 0) {
            ctx.save();
            ctx.clip();
            const inner = R * 2 - 4 * k;
            ctx.drawImage(img, x - inner / 2, y - inner / 2, inner, inner);
            ctx.restore();
          }
          ctx.restore();
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
      ctx.font = `bold ${20 * k}px "Segoe UI", Tahoma, sans-serif`;
      const scope = selectedProvince ? `จ.${selectedProvince}` : 'ทั่วประเทศ';
      ctx.fillText(`แผนที่การดำเนินงาน — ${scope}`, 16 * k, 30 * k);

      ctx.fillStyle = '#6b7280';
      ctx.font = `${13 * k}px "Segoe UI", Tahoma, sans-serif`;
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
      ctx.font = `${11 * k}px "Segoe UI", Tahoma, sans-serif`;
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

  const hasFilter = !!(categoryFilter || subFilter || statusFilter || search || newOnly);
  const clearFilters = () => {
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
      active ? 'bg-orange-50 text-orange-600' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
    }`;

  return (
    <div className="relative h-screen">
      <div ref={mapElRef} className="absolute inset-0 z-0" />

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
          onClick={() => setSidebarOpen((o) => !o)}
          title="ตัวกรอง: สถานะและประเด็นงาน"
          className={railBtnCls(sidebarOpen)}
        >
          <span className="relative">
            <Layers className="w-5 h-5" />
            {hasFilter && (
              <span className="absolute -top-0.5 -right-1 w-2 h-2 rounded-full bg-orange-600 ring-2 ring-white" />
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
            <span className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          ) : (
            <ImageDown className="w-5 h-5" />
          )}
          <span className="text-[9px] leading-tight text-center px-0.5">
            {capturing ? 'กำลังบันทึก' : 'ภาพแผนที่'}
          </span>
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
                        active ? 'bg-orange-50 text-gray-900 font-medium' : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <Icon className={`w-3.5 h-3.5 shrink-0 ${active ? 'text-orange-600' : 'text-gray-400'}`} />
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
                        className="accent-orange-600"
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
                              ? 'bg-orange-50 text-gray-900 font-medium'
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
                          <ul className="ml-5 mt-0.5 mb-1 pl-2 border-l border-orange-100 space-y-0.5">
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
                                        on ? 'bg-orange-100 text-gray-900 font-medium' : 'text-gray-500 hover:bg-gray-50'
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
                <MapLegend publicView={publicView} />
                {hasFilter && (
                  <button
                    onClick={clearFilters}
                    className="mt-2 w-full py-1.5 rounded-lg text-[11px] text-gray-500 hover:bg-gray-50 hover:text-orange-700 transition-colors"
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
                : 'bg-white text-orange-700 border-orange-200 hover:bg-orange-50'
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
      {selectedProvince && (
        <aside className="absolute z-[1000] bg-white rounded-2xl border border-orange-100 shadow-xl overflow-auto sm:top-16 sm:right-4 sm:bottom-4 sm:w-[340px] max-sm:inset-x-2 max-sm:bottom-2 max-sm:max-h-[45%]">
        <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-orange-100 p-4 flex items-start justify-between gap-2">
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
              onClick={() => setSelectedProvince('')}
              className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"
              aria-label="ปิด"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-4 pt-3">
          {!publicView && selectedUserCount > 1 && (
            <div className="mb-3 flex items-center gap-2 text-xs bg-orange-50 border border-orange-100 text-orange-700 rounded-lg px-3 py-2">
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
                          <span className="px-1.5 py-px rounded-full bg-orange-600 text-white text-[10px] font-bold">
                            ใหม่
                          </span>
                        )}
                        {STATUS_LABEL[a.status] ?? a.status}
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm font-medium text-gray-800">{a.title}</p>
                    <p className="mt-1 text-xs text-gray-500">
                      <MapPin className="inline w-3 h-3 mr-0.5 text-orange-500" />
                      {a.areaName ? `${a.areaName} · ` : ''}ต.{a.district} อ.{a.amphoe}
                    </p>
                    {publicView ? (
                      a.published && (
                        <p className="mt-1.5 text-xs font-semibold text-orange-600">อ่านกรณีศึกษา →</p>
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

      {/* คำอธิบายสัญลักษณ์ (เดสก์ท็อป) — โหมดหมุดเท่านั้น, โหมดความหนาแน่นมีสเกลสีในแผงหมวดหมู่ */}
      {mapMode === 'markers' && !sidebarOpen && (
        <div className="absolute bottom-4 left-3 z-[1000] hidden sm:flex items-center gap-3 bg-white/95 backdrop-blur rounded-full border border-gray-200 shadow-lg px-4 py-2 text-[11px] text-gray-600">
          {!publicView && (
            <>
              <LegendDot solid /> ตำแหน่งจริง
            </>
          )}
          <LegendDot /> {publicView ? 'ตำแหน่งระดับตำบล' : 'โดยประมาณ'}
          <span className="text-gray-400">· สีตามประเด็น — คลิกหมุดดูรายละเอียด</span>
          {newIds.size > 0 && (
            <>
              <span className="w-px h-3.5 bg-gray-200" />
              <span className="relative inline-flex w-3 h-3 items-center justify-center">
                <span className="absolute inset-0 rounded-full border-2 border-orange-500 motion-safe:animate-ping" />
                <span className="w-1.5 h-1.5 rounded-full bg-orange-600" />
              </span>
              งานใหม่
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── คำอธิบายสัญลักษณ์บนแผนที่ (ใช้ทั้งแผงหมวดหมู่และแถบล่างซ้าย)
function LegendDot({ solid = false }: { solid?: boolean }) {
  return solid ? (
    <span className="w-3 h-3 rounded-full shrink-0 bg-gray-600 ring-2 ring-white shadow" />
  ) : (
    <span className="w-3 h-3 rounded-full shrink-0 bg-gray-600/60 border-2 border-dashed border-gray-600" />
  );
}

function MapLegend({ publicView }: { publicView: boolean }) {
  return (
    <div className="mt-4 pt-3 border-t border-gray-100 space-y-2 text-[11px] text-gray-500 leading-snug">
      <p>หมุดสีตามประเด็นงาน — คลิกหมุดดูรายละเอียด คลิกจังหวัดดูรายการทั้งหมด</p>
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
          <span className="absolute inset-0 rounded-full border-2 border-orange-500" />
          <span className="w-1.5 h-1.5 rounded-full bg-orange-600" />
        </span>
        <span>งานใหม่ตั้งแต่เข้าชมครั้งก่อน</span>
      </p>
    </div>
  );
}

// การ์ดงานในแผงจังหวัด — มีที่ไป = ลิงก์ · สาธารณะที่ยังไม่มีกรณีศึกษา = การ์ดเฉย ๆ
function PanelItem({ href, children }: { href: string | null; children: ReactNode }) {
  const cls = 'block border border-orange-100 rounded-xl p-3';
  return href ? (
    <a href={href} className={`${cls} hover:border-orange-300 hover:bg-orange-50/40 transition-colors`}>
      {children}
    </a>
  ) : (
    <div className={cls}>{children}</div>
  );
}
