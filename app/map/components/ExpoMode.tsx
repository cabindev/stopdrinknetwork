'use client';
// app/map/components/ExpoMode.tsx — "จอจัดแสดง" ของ /map (?expo=1 หรือปุ่มในแถบซ้าย) สำหรับจอใหญ่ที่บูธ/นิทรรศการ
// ผู้ใช้ขอ 26 พ.ย. 2026 (ก่อนเวทีอุบล 27 พ.ย.): แผนที่ที่มี QR ต้องเปิดแบบจัดแสดงได้ ดู "ว้าว"
// · กล้องบินทัวร์เอง: ภาพรวมประเทศ → ทีละพื้นที่ (ซูม 10 = แยกหมุด) พร้อมการ์ดเล่าเรื่อง + วงกระเพื่อมส้มรอบหมุด
// · QR ใหญ่ "สแกน → หมุดของคุณขึ้นจอนี้ทันที" · หมุดครอบครัวใหม่ (ดึงทุก 5 วิ ใน MapView) = แบนเนอร์ฉลอง + บินไปหาทันที
// · แตะ/เลื่อนแผนที่ = หยุดวน 30 วิ แล้ววนต่อเอง · UI ปกติของแผนที่ซ่อนด้วย .sdn-expo (globals.css)
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { Map as LeafletMap, Marker } from 'leaflet';
import NextImage from 'next/image';
import { Maximize, X } from 'lucide-react';
import type { MapActivity } from './MapView';
import type { PublicPin } from '@/app/lib/funeralPins';
import { pinTitle, answerLabel, PIN_PRACTICES } from '@/app/lib/funeralPins';
import { POLICY_LEVELS, POLICY_LABEL } from '@/app/lib/activityMeta';
import { LEVEL_FILL, LEVEL_STROKE } from '@/app/lib/policyLevelColors';
import { getRegionLabel, provinceHealthZones } from '@/app/utils/healthZones';
import thailandGeo from '@/app/data/thailand.json';
import type { HealthZone } from '@/app/utils/healthZones';
import { useCountUp } from '@/app/lib/useCountUp';

type Stop =
  | { kind: 'overview' }
  | { kind: 'site'; a: MapActivity }
  | { kind: 'pin'; p: PublicPin; fresh: boolean };

const HOLD_OVERVIEW = 6000;
const HOLD_SITE = 8000;
const HOLD_FRESH = 14000;
const PAUSE_MS = 30000;
const PANEL_W = 400; // แผงซ้าย (md+) — กล้องเลี่ยงไม่ให้หมุดไปอยู่ใต้แผง
const THAILAND: [[number, number], [number, number]] = [[5.6, 97.3], [20.5, 105.7]];

/** กรอบของจังหวัดในภาคที่เลือก (จาก GeoJSON 77 จังหวัด) — ภาพรวมของทัวร์ */
function zoneBounds(zones: HealthZone[] | null): [[number, number], [number, number]] {
  if (!zones) return THAILAND;
  let s = 90, w = 180, n = -90, e = -180;
  const walk = (c: unknown): void => {
    if (Array.isArray(c) && typeof c[0] === 'number') {
      const [lng, lat] = c as number[];
      s = Math.min(s, lat); n = Math.max(n, lat); w = Math.min(w, lng); e = Math.max(e, lng);
    } else if (Array.isArray(c)) c.forEach(walk);
  };
  for (const f of (thailandGeo as GeoJSON.FeatureCollection).features) {
    const z = provinceHealthZones[f.properties?.name_th as string];
    if (z && zones.includes(z)) walk((f.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon).coordinates);
  }
  return n > s ? [[s, w], [n, e]] : THAILAND;
}

const shuffle = <T,>(xs: T[]) => {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

interface Props {
  mapRef: RefObject<LeafletMap | null>;
  mapReady: boolean;
  activities: MapActivity[];
  pins: PublicPin[];
  /** ภาคที่เน้น (ทัวร์ + ตัวเลขพื้นที่/จังหวัด) · null = ทั้งประเทศ */
  zones: HealthZone[] | null;
  onExit: () => void;
}

export default function ExpoMode({ mapRef, mapReady, activities: allActivities, pins, zones, onExit }: Props) {
  // เน้นภาคที่เลือก: ตัวเลขพื้นที่/จังหวัด สีหมุด และจุดที่กล้องพาไปดู = เฉพาะภาคนี้
  // (หมุดครอบครัว = นับ/ฉลองทุกหมุด — คนที่บูธอาจปักบ้านจากภาคอื่น ต้องเห็นตัวเลขขยับ)
  const zoneKey = zones?.join(',') ?? 'all';
  const activities = useMemo(
    () => (zones ? allActivities.filter((a) => zones.includes(provinceHealthZones[a.province])) : allActivities),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allActivities, zoneKey],
  );
  const overview = useMemo(() => zoneBounds(zones), [zoneKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const zoneName = zones ? 'ภาค' + zones.map((z) => getRegionLabel(z).replace(/^ภาค/, '')).join(' + ') : 'ทั่วประเทศ';
  const provinces = useMemo(() => new Set(activities.map((a) => a.province)).size, [activities]);
  const nAreas = useCountUp(activities.length, 1400);
  const nProv = useCountUp(provinces, 1400);
  const nPins = useCountUp(pins.length, 1400);
  const levelCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of activities) m.set(a.policyLevel ?? '', (m.get(a.policyLevel ?? '') ?? 0) + 1);
    return m;
  }, [activities]);

  // ล่าสุดบนแผนที่ (งาน + หมุดครอบครัว ใหม่สุดก่อน) — เติมที่ว่างของแผงตามความสูงจอ
  const recent = useMemo(
    () =>
      [
        ...activities.map((a) => ({ key: `a${a.id}`, t: Date.parse(a.createdAt), title: a.title, province: a.province, level: a.policyLevel, pin: false })),
        ...pins.map((p) => ({ key: `p${p.id}`, t: Date.parse(p.createdAt), title: pinTitle(p), province: p.province, level: null, pin: true })),
      ]
        .sort((x, y) => y.t - x.t)
        .slice(0, 8),
    [activities, pins],
  );

  const [stop, setStop] = useState<Stop>({ kind: 'overview' });
  const [stepKey, setStepKey] = useState(0);
  const [hold, setHold] = useState(HOLD_OVERVIEW);
  const [paused, setPaused] = useState(false);
  const [clock, setClock] = useState('');
  const [fullscreen, setFullscreen] = useState(false);

  // ข้อมูลล่าสุดสำหรับลูปทัวร์ (อ่านผ่าน ref ไม่ต้องเริ่มลูปใหม่ทุกครั้งที่ข้อมูลเปลี่ยน)
  const dataRef = useRef({ activities, pins });
  useEffect(() => {
    dataRef.current = { activities, pins };
  }, [activities, pins]);
  const queueRef = useRef<Stop[]>([]);
  const priorityRef = useRef<Stop[]>([]);
  const timerRef = useRef<number | null>(null);
  const pausedUntil = useRef(0);
  const spotRef = useRef<Marker | null>(null);
  const spotToken = useRef(0); // ขั้นใหม่เริ่มก่อนกล้องหยุด = วงของขั้นเก่าไม่ต้องวาง
  const seenPins = useRef<Set<number> | null>(null);

  const buildLoop = useCallback((): Stop[] => {
    const { activities: acts, pins: allPins } = dataRef.current;
    const ps = zones ? allPins.filter((p) => zones.includes(provinceHealthZones[p.province])) : allPins;
    // ทุกหมุดในภาคได้ขึ้นจอครบ 1 รอบ (สุ่มลำดับ ไม่ซ้ำ) แล้วค่อยสุ่มรอบใหม่
    // ลำดับ: ภาพรวมภาค → เจาะหมุด 1 → ภาพรวม → เจาะหมุดถัดไป → … (ผู้ใช้ขอ 26 พ.ย. 2026)
    const items: Stop[] = shuffle([
      ...acts.filter((a) => a.latitude != null && a.longitude != null).map((a): Stop => ({ kind: 'site', a })),
      ...ps.map((p): Stop => ({ kind: 'pin', p, fresh: false })),
    ]);
    const out: Stop[] = items.flatMap((it) => [{ kind: 'overview' } as Stop, it]);
    if (!out.length) out.push({ kind: 'overview' });
    return out;
  }, [zones]);

  /** จุดกลางที่ทำให้หมุดไปอยู่กลาง "พื้นที่ว่าง" ขวาของแผง (ไม่ใช่กลางจอ) */
  const centerFor = useCallback(
    async (lat: number, lng: number, z: number) => {
      const L = (await import('leaflet')).default;
      const map = mapRef.current;
      if (!map) return L.latLng(lat, lng);
      const size = map.getSize();
      const wide = size.x >= 768;
      const want = L.point(wide ? (PANEL_W + 24 + size.x) / 2 : size.x / 2, size.y * (wide ? 0.42 : 0.36));
      const p = map.project(L.latLng(lat, lng), z).subtract(want.subtract(size.divideBy(2)));
      return map.unproject(p, z);
    },
    [mapRef],
  );

  const placeSpot = useCallback(
    async (lat: number | null, lng: number | null, burst: boolean) => {
      const map = mapRef.current;
      if (!map) return;
      spotRef.current?.remove();
      spotRef.current = null;
      if (lat == null || lng == null) return;
      const L = (await import('leaflet')).default;
      spotRef.current = L.marker([lat, lng], {
        icon: L.divIcon({
          className: '',
          html: `<div class="sdn-spot${burst ? ' sdn-spot--burst' : ''}"><i></i><i></i><i></i></div>`,
          iconSize: [0, 0],
        }),
        interactive: false,
        keyboard: false,
        pane: 'shadowPane',
      }).addTo(map);
    },
    [mapRef],
  );

  const show = useCallback(
    async (s: Stop) => {
      const map = mapRef.current;
      if (!map) return;
      setStop(s);
      setStepKey((k) => k + 1);
      const ms = s.kind === 'overview' ? HOLD_OVERVIEW : s.kind === 'pin' && s.fresh ? HOLD_FRESH : HOLD_SITE;
      setHold(ms);
      const L = (await import('leaflet')).default;
      if (s.kind === 'overview') {
        spotToken.current++;
        placeSpot(null, null, false);
        const wide = map.getSize().x >= 768;
        map.flyToBounds(L.latLngBounds(overview), {
          paddingTopLeft: [wide ? PANEL_W + 40 : 16, wide ? 32 : 150],
          paddingBottomRight: [wide ? 32 : 16, wide ? 32 : 170],
          duration: 2.2,
        });
        return ms;
      }
      const lat = s.kind === 'site' ? s.a.latitude! : s.p.latitude;
      const lng = s.kind === 'site' ? s.a.longitude! : s.p.longitude;
      const z = s.kind === 'pin' ? 11 : 10;
      // วงส้มขึ้นหลังกล้องหยุด + หมุดแยกจากวงตัวเลขแล้ว (MapView วาดหมุดใหม่ตอน zoomend) — เดิมวางตั้งแต่เริ่มบิน
      // คนดูเห็นวงวิ้ง ๆ ก่อนหมุดราว 3 วิ (ผู้ใช้ทักบนเว็บจริง 26 พ.ย. 2026)
      placeSpot(null, null, false);
      const token = ++spotToken.current;
      const center = await centerFor(lat, lng, z);
      map.flyTo(center, z, { duration: s.kind === 'pin' && s.fresh ? 2.4 : 3 });
      map.once('moveend', () => {
        window.setTimeout(() => {
          if (token === spotToken.current) placeSpot(lat, lng, s.kind === 'pin' && s.fresh);
        }, 250);
      });
      return ms;
    },
    [mapRef, centerFor, placeSpot, overview],
  );

  const nextRef = useRef<() => void>(() => {});
  const next = useCallback(async () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    // ผู้ชมกำลังเล่นแผนที่อยู่ = รอก่อน (หมุดใหม่ก็รอ — ไม่ดึงแผนที่หนีมือคน)
    if (Date.now() < pausedUntil.current) {
      timerRef.current = window.setTimeout(() => nextRef.current(), 1000);
      return;
    }
    setPaused(false);
    let s = priorityRef.current.shift();
    if (!s) {
      if (!queueRef.current.length) queueRef.current = buildLoop();
      s = queueRef.current.shift()!;
    }
    const ms = (await show(s)) ?? HOLD_SITE;
    timerRef.current = window.setTimeout(() => nextRef.current(), ms);
  }, [buildLoop, show]);
  useEffect(() => {
    nextRef.current = next;
  }, [next]);

  // เริ่มทัวร์ (หลังหมุดชุดแรกหล่นเสร็จ)
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    timerRef.current = window.setTimeout(next, 2500);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      spotRef.current?.remove();
      spotRef.current = null;
    };
  }, [mapReady, mapRef, next]);

  // หมุดครอบครัวใหม่ = แทรกคิวหน้าสุด แล้วบินไปทันที
  useEffect(() => {
    if (!seenPins.current) {
      seenPins.current = new Set(pins.map((p) => p.id));
      return;
    }
    const fresh = pins.filter((p) => !seenPins.current!.has(p.id));
    if (!fresh.length) return;
    for (const p of fresh) {
      seenPins.current.add(p.id);
      priorityRef.current.push({ kind: 'pin', p, fresh: true });
    }
    // ฉลองเสร็จ = กลับภาพรวมก่อน แล้วค่อยเจาะหมุดที่เหลือในรอบนี้ต่อ
    if (queueRef.current[0]?.kind !== 'overview') priorityRef.current.push({ kind: 'overview' });
    next();
  }, [pins, next]);

  // แตะ/ลาก/เลื่อนล้อ = หยุดวน 30 วิ
  useEffect(() => {
    const pause = () => {
      pausedUntil.current = Date.now() + PAUSE_MS;
      setPaused(true);
    };
    window.addEventListener('pointerdown', pause);
    window.addEventListener('wheel', pause, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', pause);
      window.removeEventListener('wheel', pause);
    };
  }, []);

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }));
    tick();
    const t = window.setInterval(tick, 10000);
    const fs = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', fs);
    fs();
    return () => {
      clearInterval(t);
      document.removeEventListener('fullscreenchange', fs);
    };
  }, []);

  const freshPin = stop.kind === 'pin' && stop.fresh ? stop.p : null;

  return (
    <div className="sdn-expo-keep pointer-events-none absolute inset-0 z-[1200]">
      {/* แผงซ้าย: หัวเรื่อง + ตัวเลขสด + ความหมายสีหมุด + QR ใหญ่ */}
      <aside className="pointer-events-auto absolute bottom-6 left-6 top-6 hidden w-[400px] flex-col overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl md:flex">
        <div className="flex items-center gap-2 px-6 pt-5">
          <NextImage src="/brand/network-logo-horizontal-color.svg" alt="Network" width={120} height={28} unoptimized className="h-7 w-auto" />
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-gray-900 px-2.5 py-1 text-xs font-semibold text-white">
            <span className="sdn-live-dot h-2 w-2 rounded-full bg-orange-500" /> แผนที่สด
          </span>
          <span className="text-xs tabular-nums text-gray-500">{clock}</span>
          <button type="button" onClick={onExit} aria-label="ออกจากจอจัดแสดง" className="-mr-2 rounded-full p-1.5 text-gray-400 hover:bg-gray-50 hover:text-gray-700">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 pt-5">
          <h1 className="text-[32px] font-bold leading-tight text-gray-900">งานศพแบบไหน<br />ที่เราอยากให้เป็น?</h1>
          <p className="mt-2 text-base text-gray-600">ชุมชน<b className="font-semibold text-gray-900">{zoneName}</b> ตกลงกันแล้ว</p>
          <p className="mt-0.5 text-base font-semibold text-gray-900">ลดเหล้า · ลดของห่อ · ลดรายจ่าย</p>
        </div>

        <div className="mx-6 mt-5 grid grid-cols-3 divide-x divide-gray-200 rounded-2xl border border-gray-200">
          {[
            [nAreas, 'พื้นที่'],
            [nProv, 'จังหวัด'],
            [nPins, 'ครอบครัวปักหมุด'],
          ].map(([n, label]) => (
            <div key={label} className="px-3 py-3">
              <p className="text-[32px] font-bold leading-none tabular-nums text-gray-900">{n}</p>
              <p className="mt-1.5 text-xs leading-tight text-gray-600">{label}</p>
            </div>
          ))}
        </div>

        <div className="px-6 pt-5">
          <p className="text-xs font-semibold text-gray-900">สีหมุด = ข้อตกลงของชุมชนระดับ</p>
          <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5">
            {[...POLICY_LEVELS.map((l) => l.value as string), ''].map((l) => {
              const n = levelCounts.get(l) ?? 0;
              return (
                <div key={l || 'none'} className={`flex items-center gap-2 text-sm ${n ? 'text-gray-700' : 'text-gray-400'}`}>
                  <span
                    className="h-3.5 w-3.5 shrink-0 rounded-full"
                    style={{
                      background: l ? LEVEL_FILL[l as keyof typeof LEVEL_FILL] : '#fff',
                      border: `1.5px ${l ? 'solid' : 'dashed'} ${LEVEL_STROKE}`,
                    }}
                  />
                  <span className="truncate">{l ? POLICY_LABEL[l] ?? l : 'ยังไม่มีข้อตกลง'}</span>
                  <span className="ml-auto tabular-nums text-gray-500">{n}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-5 min-h-0 flex-1 overflow-hidden px-6">
          <p className="text-xs font-semibold text-gray-900">ล่าสุดบนแผนที่</p>
          <ul className="mt-2 space-y-2">
            {recent.map((r) => (
              <li key={r.key} className="flex items-center gap-2 text-sm">
                {r.pin ? (
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-orange-600">
                    <svg viewBox="0 0 24 24" width="10" height="10" aria-hidden="true"><path fill="white" d="M3 11.2 12 4l9 7.2-1.4 1.7-1.6-1.3V20h-5v-5h-2v5H8v-8.4l-1.6 1.3z" /></svg>
                  </span>
                ) : (
                  <LevelDot level={r.level} />
                )}
                <span className="min-w-0 flex-1 truncate text-gray-800">{r.title}</span>
                <span className="shrink-0 text-xs text-gray-500">จ.{r.province}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* QR — หัวใจของจอ: คนดูเปลี่ยนเป็นคนร่วม แล้วเห็นหมุดตัวเองขึ้นจอ */}
        <div className="mx-4 mb-4 mt-4 flex shrink-0 items-center gap-4 rounded-2xl bg-gray-900 p-4 text-white">
          <div className="sdn-qr-glow shrink-0 rounded-xl bg-white p-2">
            <NextImage src="/farewell/qr-pin.svg" alt="QR ปักหมุดงานศพของครอบครัว" width={136} height={136} unoptimized />
          </div>
          <div className="min-w-0">
            <p className="text-lg font-bold leading-snug">บ้านคุณจัดงานศพแบบไหน?</p>
            <ol className="mt-2 space-y-1 text-sm text-white/80">
              <li><span className="font-semibold text-white">1</span> · สแกน QR</li>
              <li><span className="font-semibold text-white">2</span> · ปักหมุดบ้านคุณ</li>
              <li><span className="font-semibold text-white">3</span> · <span className="font-semibold text-orange-400">หมุดขึ้นจอนี้ทันที</span></li>
            </ol>
          </div>
        </div>
      </aside>

      {/* มือถือ/จอแคบ: หัวเรื่องย่อด้านบน */}
      <div className="pointer-events-auto absolute inset-x-3 top-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-xl md:hidden">
        <div className="flex items-center gap-2">
          <span className="sdn-live-dot h-2 w-2 rounded-full bg-orange-500" />
          <p className="truncate text-base font-bold text-gray-900">งานศพแบบไหนที่เราอยากให้เป็น?</p>
          <button type="button" onClick={onExit} aria-label="ออกจากจอจัดแสดง" className="ml-auto -mr-1 rounded-full p-1 text-gray-400">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1 text-sm text-gray-600">
          <b className="tabular-nums text-gray-900">{nAreas}</b> พื้นที่ · <b className="tabular-nums text-gray-900">{nProv}</b> จังหวัด · <b className="tabular-nums text-gray-900">{nPins}</b> ครอบครัว
        </p>
      </div>

      {/* แบนเนอร์ฉลองหมุดใหม่ */}
      {freshPin && (
        <div key={`b${stepKey}`} className="sdn-expo-banner absolute left-1/2 top-6 flex items-center gap-3 rounded-full bg-gray-900 py-2.5 pl-3 pr-6 text-white shadow-2xl md:left-[calc(50%+212px)] max-md:top-28">
          <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-orange-600">
            <span className="absolute inset-0 animate-ping rounded-full bg-orange-500/60" />
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" className="relative"><path fill="white" d="M3 11.2 12 4l9 7.2-1.4 1.7-1.6-1.3V20h-5v-5h-2v5H8v-8.4l-1.6 1.3z" /></svg>
          </span>
          <span className="text-lg font-bold md:text-xl">มีครอบครัวใหม่เพิ่งปักหมุด!</span>
        </div>
      )}

      {/* การ์ดเล่าเรื่องของจุดที่กล้องกำลังดู */}
      {stop.kind !== 'overview' && (
        <div key={stepKey} className="sdn-expo-card pointer-events-auto absolute bottom-6 right-6 w-[440px] max-w-[calc(100vw-24px)] overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl max-md:bottom-3 max-md:right-3">
          <div className="p-5">
            {stop.kind === 'site' ? <SiteStory a={stop.a} /> : <PinStory p={stop.p} fresh={stop.fresh} />}
          </div>
          <div className="h-1 bg-gray-100">
            <div className="sdn-expo-progress h-full bg-gray-900" style={{ animationDuration: `${hold}ms`, animationPlayState: paused ? 'paused' : 'running' }} />
          </div>
        </div>
      )}

      {stop.kind === 'overview' && (
        <div key={stepKey} className="sdn-expo-card absolute bottom-6 right-6 rounded-full border border-gray-200 bg-white px-5 py-3 text-base text-gray-900 shadow-xl max-md:inset-x-3 max-md:bottom-3 max-md:text-center max-md:text-sm">
          {zoneName} · ทุกวงคือชุมชนที่มี<b>ข้อตกลงเรื่องงานศพ</b>ร่วมกัน
        </div>
      )}

      <div className="absolute right-6 top-6 flex items-center gap-2 max-md:hidden">
        {paused && (
          <span className="pointer-events-auto rounded-full bg-white/95 px-3 py-1.5 text-xs text-gray-700 shadow">หยุดวนชั่วคราว · กลับมาเองใน 30 วิ</span>
        )}
        {!fullscreen && (
          <button
            type="button"
            onClick={() => document.documentElement.requestFullscreen?.().catch(() => {})}
            className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-900 shadow hover:bg-gray-50"
          >
            <Maximize className="h-3.5 w-3.5" /> เต็มจอ
          </button>
        )}
      </div>
    </div>
  );
}

function LevelDot({ level }: { level: string | null }) {
  return (
    <span
      className="h-4 w-4 shrink-0 rounded-full"
      style={{
        background: level ? LEVEL_FILL[level as keyof typeof LEVEL_FILL] : '#fff',
        border: `1.5px ${level ? 'solid' : 'dashed'} ${LEVEL_STROKE}`,
      }}
    />
  );
}

function SiteStory({ a }: { a: MapActivity }) {
  return (
    <>
      <div className="flex items-center gap-2 text-sm text-gray-700">
        <LevelDot level={a.policyLevel} />
        <span className="font-semibold">{a.policyLevel ? `ข้อตกลงระดับ${POLICY_LABEL[a.policyLevel] ?? a.policyLevel}` : 'งานศพในชุมชน'}</span>
        <span className="ml-auto text-xs text-gray-500">{getRegionLabel(a.region as HealthZone)}</span>
      </div>
      <p className="mt-2 line-clamp-2 text-xl font-bold leading-snug text-gray-900">{a.title}</p>
      <p className="mt-1.5 text-base text-gray-600">
        ต.{a.district} อ.{a.amphoe} <b className="text-gray-900">จ.{a.province}</b>
      </p>
    </>
  );
}

function PinStory({ p, fresh }: { p: PublicPin; fresh: boolean }) {
  const chips = [
    p.answers.alcohol === 'none' || p.practices.includes('no_alcohol') ? 'ไม่เลี้ยงเหล้า' : null,
    answerLabel('days', p.answers.days),
    ...p.practices.filter((x) => x !== 'no_alcohol').slice(0, 2).map((x) => PIN_PRACTICES[x as keyof typeof PIN_PRACTICES] ?? null),
  ].filter((x): x is string => !!x).slice(0, 3);
  const money = p.savedAmount ?? null;
  return (
    <>
      <div className="flex items-center gap-2 text-sm text-gray-700">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-orange-600">
          <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path fill="white" d="M3 11.2 12 4l9 7.2-1.4 1.7-1.6-1.3V20h-5v-5h-2v5H8v-8.4l-1.6 1.3z" /></svg>
        </span>
        <span className="font-semibold">ครอบครัวปักหมุด</span>
        {fresh && <span className="rounded-full bg-orange-600 px-2 py-0.5 text-xs font-bold text-white">ใหม่</span>}
        {p.yearBE && <span className="ml-auto text-xs text-gray-500">ปี {p.yearBE}</span>}
      </div>
      <p className="mt-2 line-clamp-2 text-xl font-bold leading-snug text-gray-900">{pinTitle(p)}</p>
      <p className="mt-1.5 text-base text-gray-600">
        ต.{p.district} อ.{p.amphoe} <b className="text-gray-900">จ.{p.province}</b>
      </p>
      {(chips.length > 0 || money) && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {chips.map((c) => (
            <span key={c} className="rounded-full border border-gray-300 px-2.5 py-0.5 text-sm text-gray-800">{c}</span>
          ))}
          {money ? <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-sm font-semibold text-emerald-800">ประหยัดได้ {money.toLocaleString('th-TH')} บาท</span> : null}
        </div>
      )}
    </>
  );
}
