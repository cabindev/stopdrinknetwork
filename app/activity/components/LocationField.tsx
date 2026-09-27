'use client';

// ช่องเดียวจบเรื่องพื้นที่ดำเนินงาน — แทน TambonSearch + ค้นหาสถานที่ + ช่องชื่อสถานที่ + ช่องวางลิงก์เดิม
// ทุกทางเข้าได้ผลเดียวกัน: ตำบล/อำเภอ/จังหวัด/โซน + ชื่อสถานที่ + หมุด (เติมอัตโนมัติ ไม่ต้องกรอกซ้ำ)
//   พิมพ์ชื่อ → ผลแบ่งกลุ่ม (ที่เคยบันทึกในเครือข่าย / สถานที่ GISTDA / ตำบล) · Enter = เลือกรายการแรก
//   วางลิงก์ Google Maps หรือพิกัด → Enter · กด "ตำแหน่งปัจจุบัน" (อยู่หน้างาน) · แตะแผนที่
//   ช่องว่าง + โฟกัส → "ที่เคยใช้ล่าสุด" แตะเดียวใช้ซ้ำ
// ได้พิกัดโดยไม่รู้ตำบล → /api/geo/reverse หาตำบลให้ + เสนอ "สถานที่ใกล้หมุด" ให้แตะเลือกชื่อ
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Building2,
  History,
  Link2,
  Loader2,
  LocateFixed,
  Map as MapIcon,
  MapPin,
  Search,
  Users,
  X,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import type { RegionData } from '@/app/types/region';
import { getProvinceHealthZone, getRegionLabel } from '@/app/utils/healthZones';
import { parseLatLng, isShortMapsLink } from '@/app/lib/geoLink';
import LocationPicker from './LocationPicker';
import type { PinValue, PinSource } from './LocationPicker';

interface PlaceHit {
  id: string;
  name: string;
  address: string;
  lat: number | null;
  lng: number | null;
  region: RegionData | null;
  regionGuessed?: boolean;
}
interface SearchResult {
  recent?: PlaceHit[];
  saved?: PlaceHit[];
  places?: PlaceHit[];
  regions?: RegionData[];
  regionsFirst?: boolean;
  placesError?: string;
}
interface Nearby {
  name: string;
  lat: number;
  lng: number;
}
type Kind = 'recent' | 'saved' | 'place' | 'region' | 'link';
interface Item {
  key: string;
  kind: Kind;
  title: string;
  sub: string;
  apply: () => void;
}

interface Props {
  location: RegionData | null;
  pin: PinValue | null;
  areaName: string;
  onLocation: (r: RegionData | null) => void;
  onPin: (p: PinValue | null) => void;
  onAreaName: (name: string) => void;
}

const GROUP_LABEL: Record<Kind, string> = {
  recent: 'ที่เคยใช้ล่าสุด',
  saved: 'สถานที่ที่เครือข่ายเคยบันทึก',
  place: 'สถานที่ (GISTDA)',
  region: 'ตำบล',
  link: 'พิกัด',
};
const GROUP_ICON: Record<Kind, typeof MapPin> = {
  recent: History,
  saved: Users,
  place: Building2,
  region: MapIcon,
  link: Link2,
};
const SOURCE_LABEL: Record<PinSource, string> = {
  PLACE: 'ตำแหน่งจากฐานข้อมูลสถานที่',
  PIN: 'ปักหมุดบนแผนที่',
  GPS: 'ตำแหน่งปัจจุบัน (GPS)',
  LINK: 'จากลิงก์/พิกัดที่วาง',
};

const regionLine = (r: RegionData) => `ต.${r.district} อ.${r.amphoe} จ.${r.province}`;
const round6 = (n: number) => Math.round(n * 1e6) / 1e6;
const sameRegion = (a: RegionData, b: RegionData) =>
  a.district === b.district && a.amphoe === b.amphoe && a.province === b.province;

export default function LocationField({ location, pin, areaName, onLocation, onPin, onAreaName }: Props) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SearchResult>({});
  const [active, setActive] = useState(0);
  const [nearby, setNearby] = useState<Nearby[]>([]);
  const [locating, setLocating] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [showMap, setShowMap] = useState(false);
  // ตำบลอีกทางเลือกเมื่อ 2 แหล่งของ GISTDA ขัดกัน (ที่อยู่ของสถานที่ vs ขอบเขตตำบลจากพิกัด)
  const [altRegion, setAltRegion] = useState<{ region: RegionData; from: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const enterPending = useRef(false); // กด Enter ก่อนผลค้นหามาถึง → เลือกรายการแรกทันทีที่มา
  const recentLoaded = useRef(false);

  const reset = () => {
    setQ('');
    setOpen(false);
    setResult({});
    setActive(0);
    enterPending.current = false;
  };

  // พิกัด → ตำบล (+ สถานที่ใกล้เคียง) แล้วเติมให้ครบ
  const applyCoords = useCallback(
    async (lat: number, lng: number, source: PinSource) => {
      onPin({ lat: round6(lat), lng: round6(lng), source });
      setShowMap(true);
      setNearby([]);
      try {
        const res = await fetch(`/api/geo/reverse?lat=${lat}&lng=${lng}&nearby=1`);
        const d = await res.json();
        if (!res.ok) throw new Error(d.error);
        if (d.region) {
          onLocation(d.region);
          if (d.guessed) toast(`เดาตำบลจากพิกัดว่า ต.${d.region.district} — ตรวจสอบอีกครั้ง`, { icon: '📍' });
        } else {
          toast.error('หาตำบลจากพิกัดนี้ไม่ได้ — ลองค้นหาชื่อตำบลแทน');
        }
        setNearby(d.nearby ?? []);
      } catch (err) {
        toast.error(err instanceof Error && err.message ? err.message : 'หาตำบลจากพิกัดไม่สำเร็จ');
      }
    },
    [onLocation, onPin]
  );

  // fromGistda: ตำบลของผล GISTDA มาจาก "ที่อยู่" ที่คนพิมพ์กรอก ผิดได้ (วัดภูมินทร์ เขียน ต.ผาสิงห์ ทั้งที่อยู่ ต.ในเวียง)
  // → ถามขอบเขตตำบลจากพิกัดซ้ำ ถ้าไม่ตรงใช้ขอบเขตตำบลเป็นหลัก แล้วเสนอตำบลตามที่อยู่ให้กดสลับ
  // (ขอบเขตก็พลาดได้ตามแนวเขา — ดอยสุเทพ ที่อยู่ ต.สุเทพ แต่ขอบเขตบอก ช้างเผือก — จึงต้องให้คนเลือกได้)
  // สถานที่ที่เครือข่ายเคยบันทึกไว้ = ตำบลที่คนในพื้นที่เลือกเอง เชื่อได้ ไม่ต้องถามซ้ำ
  const applyPlace = async (p: PlaceHit, fromGistda = false) => {
    if (p.region) onLocation(p.region);
    onPin(p.lat != null && p.lng != null ? { lat: p.lat, lng: p.lng, source: 'PLACE' } : null);
    if (!p.name.startsWith('ต.')) onAreaName(p.name);
    setNearby([]);
    setAltRegion(null);
    setShowMap(true);
    reset();
    if (!p.region) toast('ไม่พบตำบลของสถานที่นี้ — แตะแผนที่หรือค้นหาชื่อตำบล', { icon: '📍' });
    else if (p.regionGuessed)
      toast(`เดาตำบลจากพิกัดว่า ต.${p.region.district} — ตรวจสอบอีกครั้ง`, { icon: '📍' });

    if (!fromGistda || !p.region || p.lat == null || p.lng == null) return;
    try {
      const d = await fetch(`/api/geo/reverse?lat=${p.lat}&lng=${p.lng}`).then((r) => r.json());
      const b: RegionData | null = d.region;
      if (!b || d.guessed || sameRegion(b, p.region)) return;
      onLocation(b);
      setAltRegion({ region: p.region, from: 'ที่อยู่ของสถานที่ระบุ' }); // เริ่มต้นใช้ขอบเขตพื้นที่
    } catch {
      // ถามไม่ได้ก็ใช้ตำบลตามที่อยู่ต่อไป
    }
  };

  const applyLink = async (text: string) => {
    reset();
    const direct = parseLatLng(text);
    if (direct) return applyCoords(direct.lat, direct.lng, 'LINK');
    setResolving(true);
    try {
      const res = await fetch('/api/geo/resolve-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: text }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      await applyCoords(d.lat, d.lng, 'LINK');
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : 'อ่านลิงก์ไม่สำเร็จ');
    } finally {
      setResolving(false);
    }
  };

  // รายการทั้งหมดเรียงเป็นแถวเดียว (ใช้ร่วมกันทั้งการแสดงผลและปุ่มลูกศร/Enter)
  const text = q.trim();
  const isLink = !!text && (!!parseLatLng(text) || isShortMapsLink(text));
  const items: Item[] = [];
  if (isLink) {
    items.push({
      key: 'link',
      kind: 'link',
      title: 'ใช้ตำแหน่งจากลิงก์/พิกัดนี้',
      sub: text.length > 60 ? `${text.slice(0, 60)}…` : text,
      apply: () => applyLink(text),
    });
  } else if (!text) {
    for (const p of result.recent ?? [])
      items.push({ key: p.id, kind: 'recent', title: p.name, sub: p.address, apply: () => applyPlace(p) });
  } else {
    const regionItems: Item[] = (result.regions ?? []).map((r) => ({
      key: `r:${r.district}|${r.amphoe}|${r.province}`,
      kind: 'region',
      title: `ต.${r.district} อ.${r.amphoe}`,
      sub: `จ.${r.province} · ${getRegionLabel(getProvinceHealthZone(r.province))}`,
      apply: () => {
        onLocation(r);
        onPin(null);
        setNearby([]);
        setShowMap(true);
        reset();
      },
    }));
    if (result.regionsFirst) items.push(...regionItems);
    for (const p of result.saved ?? [])
      items.push({ key: p.id, kind: 'saved', title: p.name, sub: p.address, apply: () => applyPlace(p) });
    for (const p of result.places ?? [])
      items.push({
        key: p.id,
        kind: 'place',
        title: p.name,
        sub: p.address || (p.region ? regionLine(p.region) : 'ไม่ทราบที่อยู่'),
        apply: () => applyPlace(p, true),
      });
    if (!result.regionsFirst) items.push(...regionItems);
  }

  // ค้นหา (debounce 300ms, ยกเลิกคำขอเก่าเมื่อพิมพ์ต่อ) — ช่องว่างโหลด "ที่เคยใช้ล่าสุด"
  useEffect(() => {
    if (isLink) return;
    if (!text && recentLoaded.current) return;
    if (text && text.length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(
      async () => {
        setLoading(true);
        try {
          const params = new URLSearchParams({ q: text });
          if (location) {
            params.set('district', location.district);
            params.set('amphoe', location.amphoe);
            params.set('province', location.province);
          }
          const res = await fetch(`/api/geo/search?${params}`, { signal: ctrl.signal });
          const d = (await res.json()) as SearchResult;
          if (!text) recentLoaded.current = true;
          setResult((prev) => (text ? { ...d, recent: prev.recent } : { ...prev, recent: d.recent }));
          setActive(0);
        } catch {
          // ยกเลิกเพราะพิมพ์ต่อ หรือเน็ตหลุด — ไม่ต้องแจ้ง ผู้ใช้พิมพ์ใหม่ได้
        } finally {
          if (!ctrl.signal.aborted) setLoading(false);
        }
      },
      text ? 300 : 0
    );
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, isLink]);

  // กด Enter ระหว่างรอผล → เลือกรายการแรกเมื่อผลมาถึง
  useEffect(() => {
    if (enterPending.current && !loading && items.length > 0) {
      enterPending.current = false;
      items[0].apply();
    }
  });

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault(); // ไม่ให้ส่งฟอร์ม
      if (items[active]) items[active].apply();
      else if (text.length >= 2) enterPending.current = true;
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const useGps = () => {
    if (!navigator.geolocation) return toast.error('อุปกรณ์นี้ไม่รองรับการระบุตำแหน่ง');
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        await applyCoords(pos.coords.latitude, pos.coords.longitude, 'GPS');
        setLocating(false);
        toast.success(`ได้ตำแหน่งแล้ว (คลาดเคลื่อน ~${Math.round(pos.coords.accuracy)} ม.)`);
      },
      (err) => {
        setLocating(false);
        toast.error(
          err.code === err.PERMISSION_DENIED
            ? 'ไม่ได้รับอนุญาตให้ใช้ตำแหน่ง — เปิดสิทธิ์ตำแหน่งในเบราว์เซอร์ก่อน'
            : 'หาตำแหน่งไม่สำเร็จ ลองใหม่อีกครั้ง'
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  // ปักหมุดบนแผนที่: ยังไม่มีพื้นที่ → หาตำบลจากหมุดให้เลย · มีแล้ว → LocationPicker เตือนถ้าตำบลไม่ตรง
  const onMapPin = (v: PinValue) => {
    if (!location) return applyCoords(v.lat, v.lng, v.source);
    onPin(v);
  };

  const clearAll = () => {
    setAltRegion(null);
    onLocation(null);
    onPin(null);
    onAreaName('');
    setNearby([]);
    setShowMap(false);
    reset();
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const zone = location ? getRegionLabel(getProvinceHealthZone(location.province)) : '';
  const busy = loading || resolving;
  let lastKind: Kind | null = null;

  return (
    <div className="space-y-3">
      {!location ? (
        <div ref={boxRef} className="relative">
          <div className="flex gap-2">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-orange-500 pointer-events-none" />
              <input
                ref={inputRef}
                id="locationSearch"
                type="text"
                role="combobox"
                aria-expanded={open}
                aria-controls="location-results"
                aria-label="ค้นหาพื้นที่ดำเนินงาน"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setOpen(true);
                }}
                onFocus={(e) => {
                  setOpen(true);
                  // มือถือ: ช่องมักอยู่ครึ่งล่างจอ รายการผลจะตกจอ/โดนคีย์บอร์ดบัง → เลื่อนขึ้นมาก่อน
                  if (window.innerWidth < 640) e.currentTarget.scrollIntoView({ block: 'start', behavior: 'smooth' });
                }}
                onKeyDown={onKeyDown}
                placeholder="ชื่อสถานที่ ตำบล หรือวางลิงก์ Google Maps"
                autoComplete="off"
                className="scroll-mt-24 w-full pl-10 pr-9 py-3 text-sm text-gray-900 bg-white border border-orange-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400"
              />
              {busy && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-orange-500 animate-spin" />
              )}
            </div>
            <button
              type="button"
              onClick={useGps}
              disabled={locating}
              title="ใช้ตำแหน่งปัจจุบัน"
              className="shrink-0 inline-flex items-center gap-1.5 px-3 sm:px-4 rounded-xl bg-orange-600 text-white text-sm font-medium hover:bg-orange-700 disabled:opacity-60"
            >
              {locating ? <Loader2 className="w-4 h-4 animate-spin" /> : <LocateFixed className="w-4 h-4" />}
              <span className="hidden sm:inline">ตำแหน่งปัจจุบัน</span>
            </button>
          </div>

          {open && (items.length > 0 || (text.length >= 2 && !busy)) && (
            <ul
              id="location-results"
              role="listbox"
              className="absolute z-50 mt-1 w-full bg-white rounded-xl shadow-lg max-h-80 overflow-auto border border-orange-100 py-1"
            >
              {items.length === 0 && (
                <li className="px-4 py-5 text-center text-sm text-gray-500">
                  ไม่พบ — ลองชื่ออื่น พิมพ์ชื่อตำบล หรือกด “ตำแหน่งปัจจุบัน”
                  {result.placesError && <span className="block text-xs text-red-500 mt-1">{result.placesError}</span>}
                </li>
              )}
              {items.map((it, i) => {
                const Icon = GROUP_ICON[it.kind];
                const header = it.kind !== lastKind ? GROUP_LABEL[it.kind] : null;
                lastKind = it.kind;
                return (
                  <li key={it.key} role="presentation">
                    {header && (
                      <p className="px-4 pt-2 pb-1 text-[11px] font-semibold text-gray-400">{header}</p>
                    )}
                    <div
                      role="option"
                      aria-selected={i === active}
                      onMouseEnter={() => setActive(i)}
                      onMouseDown={(e) => e.preventDefault()} // ไม่ให้ input เสีย focus ก่อน click
                      onClick={() => it.apply()}
                      className={`flex items-start gap-3 px-4 py-2 cursor-pointer ${
                        i === active ? 'bg-orange-50' : ''
                      }`}
                    >
                      <Icon className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-800 truncate">{it.title}</p>
                        <p className="text-xs text-gray-500 truncate">{it.sub}</p>
                      </div>
                      {i === active && (
                        <kbd className="hidden sm:block shrink-0 self-center text-[10px] text-gray-400 border border-gray-200 rounded px-1.5 py-0.5">
                          Enter
                        </kbd>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-400">
            <span>พิมพ์แล้วกด Enter เลือกรายการแรก · ระบบเติมตำบล อำเภอ จังหวัด ภาค ให้เอง</span>
            {!showMap && (
              <button
                type="button"
                onClick={() => setShowMap(true)}
                className="text-orange-700 hover:text-orange-800 font-medium"
              >
                หรือเลือกจากแผนที่
              </button>
            )}
          </div>
        </div>
      ) : (
        <div data-testid="location-card" className="rounded-xl border border-orange-200 bg-orange-50 p-4">
          <div className="flex items-start gap-3">
            <MapPin className="w-5 h-5 text-orange-600 shrink-0 mt-1" />
            <div className="min-w-0 flex-1">
              <input
                id="areaName"
                type="text"
                value={areaName}
                onChange={(e) => onAreaName(e.target.value)}
                placeholder="ชื่อสถานที่/ชุมชน (ถ้ามี) เช่น โรงเรียนบ้านแม่ใจ"
                aria-label="ชื่อสถานที่/ชุมชน"
                className="w-full bg-transparent text-base font-semibold text-gray-900 placeholder:font-normal placeholder:text-gray-400 border-b border-dashed border-orange-300 focus:border-orange-500 focus:outline-none pb-0.5"
              />
              <p className="mt-1.5 text-sm text-gray-700">{regionLine(location)}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
                <span className="px-2 py-0.5 rounded-full bg-white border border-orange-200 text-orange-700 font-medium">
                  {zone}
                </span>
                {location.zipcode ? (
                  <span className="px-2 py-0.5 rounded-full bg-white border border-gray-200 text-gray-500">
                    ปณ. {location.zipcode}
                  </span>
                ) : null}
                <span className="text-gray-500">
                  {pin
                    ? `📍 ${SOURCE_LABEL[pin.source]} · ${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}`
                    : 'ยังไม่ปักหมุด — ใช้จุดกลางตำบล'}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={clearAll}
              aria-label="เปลี่ยนพื้นที่"
              className="shrink-0 inline-flex items-center gap-1 p-1.5 sm:px-2.5 sm:py-1 rounded-lg text-xs font-medium text-orange-700 hover:bg-orange-100"
            >
              <X className="w-4 h-4 sm:w-3.5 sm:h-3.5" /> <span className="hidden sm:inline">เปลี่ยน</span>
            </button>
          </div>

          {altRegion && (
            <div className="mt-3 pt-3 border-t border-orange-200 flex flex-wrap items-center gap-2 text-xs text-gray-600">
              <span className="flex-1 min-w-0">
                ⚠️ ข้อมูล 2 แหล่งไม่ตรงกัน — {altRegion.from} ต.{altRegion.region.district} อ.{altRegion.region.amphoe}
                ถ้าที่ตั้งจริงอยู่ตำบลนั้น กดสลับได้
              </span>
              <button
                type="button"
                onClick={() => {
                  const current = location;
                  onLocation(altRegion.region);
                  // สลับกลับได้ — เผื่อกดผิด
                  setAltRegion(current ? { region: current, from: 'ขอบเขตพื้นที่ระบุ' } : null);
                }}
                className="shrink-0 px-2.5 py-1 rounded-lg bg-white border border-orange-300 text-orange-700 font-medium hover:bg-orange-100"
              >
                ใช้ ต.{altRegion.region.district}
              </button>
            </div>
          )}

          {nearby.length > 0 && (
            <div className="mt-3 pt-3 border-t border-orange-200">
              <p className="text-xs text-gray-500 mb-1.5">สถานที่ใกล้หมุด — แตะเพื่อใช้ชื่อและตำแหน่งนี้</p>
              <div className="flex flex-wrap gap-1.5">
                {nearby.map((n) => (
                  <button
                    key={n.name}
                    type="button"
                    onClick={() => {
                      onAreaName(n.name);
                      onPin({ lat: n.lat, lng: n.lng, source: 'PLACE' });
                      setNearby([]);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white border border-orange-200 text-xs text-gray-700 hover:border-orange-400 hover:text-orange-700"
                  >
                    <Building2 className="w-3 h-3 text-orange-500" />
                    {n.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {(location || pin || showMap) && (
        <LocationPicker
          location={location}
          value={pin}
          onChange={onMapPin}
          onRegionChange={(r) => {
            setAltRegion(null);
            onLocation(r); // เปลี่ยนตามหมุด — ไม่ล้างหมุด
            toast.success(`เปลี่ยนพื้นที่เป็น ต.${r.district} อ.${r.amphoe} แล้ว`);
          }}
        />
      )}
    </div>
  );
}
