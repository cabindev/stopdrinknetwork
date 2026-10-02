'use client';
// app/farewell/components/AreaPicker.tsx — พิมพ์ชื่อตำบลแล้วเลือก (ค้นฝั่ง server ไม่ต้องโหลดรายชื่อตำบลทั้งประเทศมาที่เครื่อง)
import { useEffect, useId, useState } from 'react';
import { MapPin, Search, X } from 'lucide-react';
import type { PlanArea } from '../planStore';

interface AreaPickerProps {
  value: PlanArea | null;
  onChange: (area: PlanArea | null) => void;
}

export const areaText = (a: PlanArea) => `ต.${a.district} อ.${a.amphoe} จ.${a.province}`;

export default function AreaPicker({ value, onChange }: AreaPickerProps) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<PlanArea[]>([]);
  const [loading, setLoading] = useState(false);
  const listId = useId();

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/farewell/area?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        const data = (await res.json()) as { results: PlanArea[] };
        setResults(data.results ?? []);
      } catch {
        // ยกเลิกเพราะพิมพ์ต่อ หรือเน็ตหลุด — ไม่ต้องแจ้งอะไร
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      ctrl.abort();
      clearTimeout(timer);
    };
  }, [q]);

  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3">
        <MapPin className="w-5 h-5 shrink-0 text-orange-600" />
        <span className="flex-1 text-sm text-gray-800">{areaText(value)}</span>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="inline-flex items-center gap-1 min-h-10 px-3 rounded-full text-xs text-gray-600 hover:bg-white"
        >
          <X className="w-3.5 h-3.5" /> เปลี่ยน
        </button>
      </div>
    );
  }

  const shown = q.trim().length >= 2 ? results : [];

  return (
    <div>
      <label htmlFor={`${listId}-input`} className="sr-only">
        ชื่อตำบล
      </label>
      <div className="flex items-center gap-2 rounded-2xl border border-gray-300 bg-white px-4 focus-within:border-orange-500 focus-within:ring-2 focus-within:ring-orange-100">
        <Search className="w-4 h-4 shrink-0 text-gray-400" />
        <input
          id={`${listId}-input`}
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="พิมพ์ชื่อตำบลที่จะจัดงาน"
          autoComplete="off"
          className="w-full h-12 bg-transparent text-base outline-none placeholder:text-gray-400"
        />
      </div>
      {/* ชื่อตำบลซ้ำกันได้หลายจังหวัด (เช่น หินดาด 3 แห่ง) — เตือนให้ดูอำเภอ/จังหวัด เพราะข้อตกลงผูกกับตำบลที่ถูกต้อง */}
      {new Set(shown.map((r) => r.district)).size < shown.length && (
        <p className="mt-2 text-xs text-orange-700">มีตำบลชื่อซ้ำกันหลายแห่ง — ดูชื่ออำเภอและจังหวัดให้ตรงก่อนเลือก</p>
      )}
      {shown.length > 0 && (
        <ul className="mt-2 rounded-2xl border border-gray-200 bg-white divide-y divide-gray-100 overflow-hidden">
          {shown.map((r) => (
            <li key={`${r.district}|${r.amphoe}|${r.province}`}>
              <button
                type="button"
                onClick={() => {
                  onChange(r);
                  setQ('');
                }}
                className="w-full text-left px-4 py-3 min-h-12 text-sm text-gray-800 hover:bg-orange-50"
              >
                <span className="font-medium">ต.{r.district}</span>{' '}
                <span className="text-gray-500">
                  อ.{r.amphoe} จ.{r.province}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {q.trim().length >= 2 && !loading && shown.length === 0 && (
        <p className="mt-2 text-xs text-gray-500">ไม่พบตำบลนี้ ลองพิมพ์ชื่ออื่น หรือพิมพ์ชื่อตำบลตามด้วยชื่ออำเภอ</p>
      )}
    </div>
  );
}
