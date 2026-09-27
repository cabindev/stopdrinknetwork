'use client';

// แผนที่ปักหมุดตำแหน่งจริงของงาน (ส่วนหนึ่งของ LocationField) — คลิกหรือลากหมุดเพื่อปรับตำแหน่ง
// ยังไม่มีพื้นที่ = ซูมทั้งประเทศ คลิกแล้ว LocationField หาตำบลจากพิกัดให้
// มีพื้นที่แต่ไม่มีหมุด = วงประสีเทาที่จุดกลางตำบล (server ใช้จุดนี้แทน, locationSource = TAMBON)
import { useEffect, useRef, useState } from 'react';
import type { Map as LeafletMap, Marker, CircleMarker, TileLayer } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { AlertTriangle, Satellite, Map as MapIcon } from 'lucide-react';
import type { RegionData } from '@/app/types/region';

export type PinSource = 'PIN' | 'GPS' | 'LINK' | 'PLACE';
export interface PinValue {
  lat: number;
  lng: number;
  source: PinSource;
}

interface Props {
  location: RegionData | null;
  value: PinValue | null;
  onChange: (v: PinValue) => void;
  // หมุดตกตำบลอื่น → ผู้ใช้กด "ใช้ตำบลนี้" เพื่อเปลี่ยนพื้นที่ตามหมุด (ไม่ล้างหมุด)
  onRegionChange: (region: RegionData) => void;
}

// แผนที่พื้นหลัง: OSM (ถนน) / ภาพดาวเทียม GISTDA ผ่าน proxy ของเรา (คีย์ไม่หลุดถึง browser)
const BASEMAPS = {
  streets: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
    maxNativeZoom: 19,
  },
  satellite: {
    url: '/api/geo/tiles/sphere_hybrid/{z}/{x}/{y}',
    attribution: '&copy; GISTDA sphere',
    maxNativeZoom: 18, // ภาพถ่ายคมถึง z18 — เกินนั้นขยายภาพเดิม
  },
} as const;
type Basemap = keyof typeof BASEMAPS;

// หมุดทรงหยดน้ำสีส้ม (divIcon — ไม่พึ่งรูป marker ของ Leaflet ที่ bundler หาไม่เจอ)
const PIN_HTML = `<svg width="30" height="40" viewBox="0 0 30 40" xmlns="http://www.w3.org/2000/svg">
  <path d="M15 1C7.3 1 1 7.2 1 14.9 1 25.3 15 39 15 39s14-13.7 14-24.1C29 7.2 22.7 1 15 1z"
        fill="#ea580c" stroke="#fff" stroke-width="2"/>
  <circle cx="15" cy="15" r="5" fill="#fff"/></svg>`;

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

export default function LocationPicker({ location, value, onChange, onRegionChange }: Props) {
  const mapElRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const pinRef = useRef<Marker | null>(null);
  const centerMarkRef = useRef<CircleMarker | null>(null);
  const tileRef = useRef<TileLayer | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const [mapReady, setMapReady] = useState(false);
  const [center, setCenter] = useState<[number, number] | null>(null);
  const [inside, setInside] = useState<boolean | null>(null);
  const [pinRegion, setPinRegion] = useState<RegionData | null>(null);
  const [basemap, setBasemap] = useState<Basemap>('streets');

  const district = location?.district ?? '';
  const amphoe = location?.amphoe ?? '';
  const province = location?.province ?? '';

  // สร้างแผนที่ครั้งเดียว (import leaflet ใน effect กัน SSR)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !mapElRef.current || mapRef.current) return;
      const map = L.map(mapElRef.current, { scrollWheelZoom: false, maxZoom: 19 }).setView([13.5, 101], 5);
      // คลิกที่ไหนก็ปักหมุดที่นั่น
      map.on('click', (e) =>
        onChangeRef.current({ lat: round6(e.latlng.lat), lng: round6(e.latlng.lng), source: 'PIN' })
      );
      mapRef.current = map;
      setMapReady(true);
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // สลับแผนที่พื้นหลัง
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    (async () => {
      const L = (await import('leaflet')).default;
      tileRef.current?.remove();
      const b = BASEMAPS[basemap];
      tileRef.current = L.tileLayer(b.url, {
        maxZoom: 19,
        maxNativeZoom: b.maxNativeZoom,
        attribution: b.attribution,
      }).addTo(mapRef.current!);
    })();
  }, [mapReady, basemap]);

  // เปลี่ยนตำบล → หาจุดกลางตำบลใหม่
  useEffect(() => {
    if (!province) {
      setCenter(null);
      return;
    }
    const q = new URLSearchParams({ district, amphoe, province });
    fetch(`/api/geo/tambon?${q}`)
      .then((r) => r.json())
      .then((d) => setCenter(d.center ? [d.center.lat, d.center.lng] : null))
      .catch(() => setCenter(null));
  }, [district, amphoe, province]);

  // วาดจุดกลางตำบล (วงประ) + ซูมไปหา — ถ้ามีหมุดอยู่แล้วให้ซูมไปที่หมุดแทน
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    (async () => {
      const L = (await import('leaflet')).default;
      const map = mapRef.current!;
      centerMarkRef.current?.remove();
      centerMarkRef.current = null;
      if (center) {
        centerMarkRef.current = L.circleMarker(center, {
          radius: 7,
          color: '#9ca3af',
          weight: 2,
          dashArray: '3 3',
          fillColor: '#ffffff',
          fillOpacity: 0.8,
          interactive: false,
        }).addTo(map);
      }
      if (value) map.setView([value.lat, value.lng], Math.max(map.getZoom(), 16));
      else if (center) map.setView(center, 14);
    })();
    // ซูมตาม value เฉพาะตอนเปลี่ยนตำบล — ตอนลากหมุดไม่ต้องกระโดด
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, center]);

  // วาด/ย้ายหมุดตาม value
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    (async () => {
      const L = (await import('leaflet')).default;
      const map = mapRef.current!;
      if (!value) {
        pinRef.current?.remove();
        pinRef.current = null;
        return;
      }
      if (!pinRef.current) {
        const pin = L.marker([value.lat, value.lng], {
          draggable: true,
          icon: L.divIcon({ html: PIN_HTML, className: '', iconSize: [30, 40], iconAnchor: [15, 39] }),
        }).addTo(map);
        pin.on('dragend', () => {
          const p = pin.getLatLng();
          onChangeRef.current({ lat: round6(p.lat), lng: round6(p.lng), source: 'PIN' });
        });
        pinRef.current = pin;
      } else {
        pinRef.current.setLatLng([value.lat, value.lng]);
      }
      if (map.getZoom() < 12 || !map.getBounds().pad(-0.1).contains([value.lat, value.lng])) {
        map.setView([value.lat, value.lng], Math.max(map.getZoom(), 16));
      }
    })();
  }, [mapReady, value]);

  // เช็คว่าหมุดอยู่ในจังหวัดที่เลือก (server ตรวจซ้ำตอนบันทึกอีกชั้น) + หมุดตกตำบลไหนจริง
  useEffect(() => {
    if (!value || !province) {
      setInside(null);
      setPinRegion(null);
      return;
    }
    const q = new URLSearchParams({
      district,
      amphoe,
      province,
      lat: String(value.lat),
      lng: String(value.lng),
    });
    const ctrl = new AbortController();
    fetch(`/api/geo/tambon?${q}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d) => {
        setInside(d.inside);
        setPinRegion(d.pinRegion ?? null);
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, [value, district, amphoe, province]);

  // ไม่เตือนหมุดจากผลค้นหาสถานที่: ตำบลมาจากที่อยู่ของสถานที่นั้นเอง ซึ่งแม่นกว่าขอบเขตตำบลของ
  // reverse geocoding ตามแนวเขา/ขอบตำบล (เช่น วัดพระธาตุดอยสุเทพ ที่อยู่ ต.สุเทพ แต่ขอบเขตบอก ต.ช้างเผือก)
  const mismatch =
    value &&
    value.source !== 'PLACE' &&
    pinRegion &&
    location &&
    (pinRegion.district !== location.district ||
      pinRegion.amphoe !== location.amphoe ||
      pinRegion.province !== location.province);

  return (
    <div>
      <div className="relative">
        <div
          ref={mapElRef}
          data-testid="location-picker-map"
          className="h-64 sm:h-80 w-full rounded-xl border border-orange-100 overflow-hidden z-0"
        />
        <button
          type="button"
          onClick={() => setBasemap((b) => (b === 'streets' ? 'satellite' : 'streets'))}
          className="absolute top-2.5 right-2.5 z-[400] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/95 border border-gray-200 shadow-sm text-xs font-medium text-gray-700 hover:bg-orange-50"
        >
          {basemap === 'streets' ? (
            <>
              <Satellite className="w-3.5 h-3.5 text-orange-600" /> ภาพดาวเทียม
            </>
          ) : (
            <>
              <MapIcon className="w-3.5 h-3.5 text-orange-600" /> แผนที่ถนน
            </>
          )}
        </button>
        {!value && (
          <p className="absolute bottom-2.5 left-1/2 -translate-x-1/2 z-[400] px-3 py-1.5 rounded-full bg-white/95 border border-gray-200 shadow-sm text-xs text-gray-600 whitespace-nowrap pointer-events-none">
            แตะแผนที่เพื่อปักหมุดตำแหน่งจริง (ไม่บังคับ)
          </p>
        )}
      </div>

      {value && inside === false && (
        <div className="mt-2 flex items-start gap-2 text-xs rounded-lg px-3 py-2 border bg-amber-50 border-amber-200 text-amber-800">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
          <span>
            หมุดอยู่นอกจังหวัด{province} — ตรวจสอบตำแหน่งหรือพื้นที่อีกครั้ง (บันทึกไม่ได้จนกว่าจะแก้)
          </span>
        </div>
      )}

      {mismatch && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs rounded-lg px-3 py-2 border bg-amber-50 border-amber-200 text-amber-800">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
          <span className="flex-1 min-w-0">
            หมุดอยู่ใน ต.{pinRegion!.district} อ.{pinRegion!.amphoe} จ.{pinRegion!.province} — ไม่ตรงกับพื้นที่ที่เลือก
          </span>
          <button
            type="button"
            onClick={() => onRegionChange(pinRegion!)}
            className="px-2.5 py-1 rounded-lg bg-orange-600 text-white font-medium hover:bg-orange-700"
          >
            ใช้ตำบลนี้
          </button>
        </div>
      )}
    </div>
  );
}
