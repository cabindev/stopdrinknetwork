'use client';

// เลือกวันที่แบบไทย — ปฏิทินป๊อปอัป ปี พ.ศ.
// ใช้แทน <input type="date"> ที่บังคับให้แสดง พ.ศ. ไม่ได้
// ค่าที่รับ/ส่งออกเป็น 'YYYY-MM-DD' แบบ ค.ศ. เสมอ เพื่อส่งเข้า API/DB ได้ตรง ๆ
import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react';

const WEEKDAYS = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
const MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];

const toISO = (y: number, m: number, d: number) =>
  `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

interface ThaiDateFieldProps {
  id?: string;
  value: string; // 'YYYY-MM-DD' (ค.ศ.) หรือ ''
  onChange: (value: string) => void;
  placeholder?: string;
  yearsBack?: number;
  yearsForward?: number;
}

export default function ThaiDateField({
  id,
  value,
  onChange,
  placeholder = 'เลือกวันที่',
  yearsBack = 5,
  yearsForward = 3,
}: ThaiDateFieldProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const today = useMemo(() => {
    const t = new Date();
    return { y: t.getFullYear(), m: t.getMonth() + 1, d: t.getDate() };
  }, []);

  const selected = useMemo(() => {
    if (!value) return null;
    const [y, m, d] = value.split('-').map(Number);
    return y && m && d ? { y, m, d } : null;
  }, [value]);

  // เดือน/ปีที่กำลังเปิดดูในปฏิทิน
  const [view, setView] = useState(() => selected ?? { y: today.y, m: today.m, d: 1 });
  useEffect(() => {
    if (selected) setView({ ...selected });
  }, [selected]);

  // ปิดเมื่อคลิกนอกกล่อง / กด Escape
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const years = useMemo(() => {
    const nowBE = today.y + 543;
    return Array.from({ length: yearsBack + yearsForward + 1 }, (_, i) => nowBE - yearsBack + i);
  }, [today.y, yearsBack, yearsForward]);

  // ตารางวัน: ช่องว่างนำหน้าตามวันในสัปดาห์ของวันที่ 1
  const cells = useMemo(() => {
    const firstWeekday = new Date(view.y, view.m - 1, 1).getDay();
    const daysInMonth = new Date(view.y, view.m, 0).getDate();
    return [
      ...Array.from({ length: firstWeekday }, () => 0),
      ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ];
  }, [view.y, view.m]);

  const shiftMonth = (delta: number) => {
    const next = new Date(view.y, view.m - 1 + delta, 1);
    setView({ y: next.getFullYear(), m: next.getMonth() + 1, d: 1 });
  };

  const pick = (d: number) => {
    onChange(toISO(view.y, view.m, d));
    setOpen(false);
  };

  const label = selected ? `${selected.d} ${MONTHS[selected.m - 1]} ${selected.y + 543}` : '';

  return (
    <div className="relative" ref={wrapRef}>
      {/* ช่องแสดงค่า — คลิกเพื่อเปิดปฏิทิน */}
      <div className="flex items-center gap-1">
        <button
          id={id}
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={`flex-1 flex items-center gap-2 px-3 py-2.5 text-sm text-left bg-white border rounded-lg transition-colors ${
            open ? 'border-orange-400 ring-2 ring-orange-400' : 'border-orange-200 hover:border-orange-300'
          }`}
        >
          <CalendarDays className="w-4 h-4 text-orange-500 shrink-0" />
          <span className={label ? 'text-gray-900' : 'text-gray-400'}>{label || placeholder}</span>
        </button>
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            aria-label="ล้างวันที่"
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-[292px] bg-white rounded-xl border border-orange-100 shadow-xl p-3">
          {/* หัวปฏิทิน: เดือน + ปี พ.ศ. */}
          <div className="flex items-center gap-1 mb-2">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              aria-label="เดือนก่อนหน้า"
              className="p-1.5 rounded-lg text-gray-500 hover:bg-orange-50 hover:text-orange-700"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <select
              aria-label="เดือน"
              value={view.m}
              onChange={(e) => setView((v) => ({ ...v, m: Number(e.target.value) }))}
              className="flex-1 min-w-0 px-2 py-1.5 text-sm text-gray-800 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400"
            >
              {MONTHS.map((name, i) => (
                <option key={name} value={i + 1}>{name}</option>
              ))}
            </select>

            <select
              aria-label="ปี พ.ศ."
              value={view.y + 543}
              onChange={(e) => setView((v) => ({ ...v, y: Number(e.target.value) - 543 }))}
              className="w-[86px] px-2 py-1.5 text-sm text-gray-800 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400"
            >
              {years.map((be) => (
                <option key={be} value={be}>{be}</option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => shiftMonth(1)}
              aria-label="เดือนถัดไป"
              className="p-1.5 rounded-lg text-gray-500 hover:bg-orange-50 hover:text-orange-700"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* หัวคอลัมน์วัน */}
          <div className="grid grid-cols-7 mb-1">
            {WEEKDAYS.map((w) => (
              <span key={w} className="text-[11px] text-gray-400 text-center py-1">{w}</span>
            ))}
          </div>

          {/* ตารางวันที่ */}
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((d, i) => {
              if (!d) return <span key={`x${i}`} />;
              const isSelected =
                selected && selected.y === view.y && selected.m === view.m && selected.d === d;
              const isToday = today.y === view.y && today.m === view.m && today.d === d;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => pick(d)}
                  className={`h-8 rounded-lg text-sm transition-colors ${
                    isSelected
                      ? 'bg-orange-600 text-white font-semibold'
                      : isToday
                        ? 'bg-orange-50 text-orange-700 font-semibold'
                        : 'text-gray-700 hover:bg-orange-50'
                  }`}
                >
                  {d}
                </button>
              );
            })}
          </div>

          {/* ท้ายปฏิทิน */}
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={() => {
                onChange(toISO(today.y, today.m, today.d));
                setOpen(false);
              }}
              className="px-2.5 py-1 rounded-lg text-xs font-medium text-orange-700 hover:bg-orange-50"
            >
              วันนี้
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-2.5 py-1 rounded-lg text-xs text-gray-500 hover:bg-gray-50"
            >
              ปิด
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
