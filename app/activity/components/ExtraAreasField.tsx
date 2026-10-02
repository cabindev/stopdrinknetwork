'use client';

// พื้นที่ที่เกี่ยวข้อง (ไม่บังคับ) — งานเดียวที่ยกหลายพื้นที่ เช่น งานสื่อสารที่เล่าต้นแบบหลายจังหวัด
// แต่ละแห่งเลือกผ่าน LocationField ตัวเดียวกับพื้นที่หลัก (ตำบลสะกดตรง + หมุดได้) แล้วกด "เพิ่มพื้นที่นี้"
// บนแผนที่เป็นหมุดรองของงานเดียวกัน — สถิติ/ภาค/พื้นที่ทับซ้อนยังนับจากพื้นที่หลัก
import { useState } from 'react';
import { MapPinned, Plus, X } from 'lucide-react';
import type { RegionData } from '@/app/types/region';
import { MAX_EXTRA_AREAS } from '@/app/lib/activityMeta';
import type { ExtraAreaInput } from '@/app/lib/activityAreas';
import LocationField from './LocationField';
import type { PinValue } from './LocationPicker';

const inputCls =
  'w-full px-3 py-2 text-sm text-gray-900 bg-white border border-orange-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400';

export default function ExtraAreasField({ value, onChange }: { value: ExtraAreaInput[]; onChange: (v: ExtraAreaInput[]) => void }) {
  const [adding, setAdding] = useState(false);
  const [location, setLocation] = useState<RegionData | null>(null);
  const [pin, setPin] = useState<PinValue | null>(null);
  const [areaName, setAreaName] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const resetDraft = () => {
    setLocation(null);
    setPin(null);
    setAreaName('');
    setNote('');
    setError('');
  };

  const add = () => {
    if (!location) return setError('ค้นหาและเลือกพื้นที่ก่อน');
    const dup = value.some(
      (a) =>
        a.district === location.district &&
        a.amphoe === location.amphoe &&
        a.province === location.province &&
        a.areaName.trim() === areaName.trim()
    );
    if (dup) return setError('เพิ่มพื้นที่นี้ไว้แล้ว');
    onChange([
      ...value,
      {
        areaName: areaName.trim(),
        district: location.district,
        amphoe: location.amphoe,
        province: location.province,
        zipcode: String(location.zipcode ?? ''),
        lat: pin?.lat ?? null,
        lng: pin?.lng ?? null,
        source: pin?.source ?? 'TAMBON',
        note: note.trim(),
      },
    ]);
    resetDraft();
    setAdding(false);
  };

  const update = (i: number, patch: Partial<ExtraAreaInput>) => onChange(value.map((a, j) => (j === i ? { ...a, ...patch } : a)));

  return (
    <div className="mt-6 pt-5 border-t border-orange-100">
      <div className="flex items-center gap-2">
        <MapPinned className="w-4 h-4 text-orange-600" />
        <span className="text-sm font-semibold text-gray-800">พื้นที่ที่เกี่ยวข้อง</span>
        <span className="text-xs text-gray-400">(ไม่บังคับ · {value.length}/{MAX_EXTRA_AREAS})</span>
      </div>
      <p className="mt-1 text-xs text-gray-400">
        งานเดียวที่ยกหลายพื้นที่ เช่น งานสื่อสารที่เล่าต้นแบบหลายจังหวัด — ขึ้นเป็นหมุดเพิ่มบนแผนที่และรายการในหน้ากรณีศึกษา
        แต่นับเป็นงานเดียว · ถ้าแต่ละพื้นที่มีกิจกรรมของตัวเอง ให้บันทึกแยกรายการ (ปุ่ม &quot;คัดลอกงานนี้&quot;)
      </p>

      {value.length > 0 && (
        <ul className="mt-3 space-y-2">
          {value.map((a, i) => (
            <li key={`${a.district}|${a.amphoe}|${a.province}|${a.areaName}`} className="rounded-xl border border-orange-100 bg-orange-50/40 p-3">
              <div className="flex items-start gap-2">
                <span className="mt-0.5 w-5 h-5 shrink-0 rounded-full bg-orange-600 text-white text-[11px] font-semibold flex items-center justify-center">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-800">{a.areaName || `ต.${a.district}`}</p>
                  <p className="text-xs text-gray-500">
                    ต.{a.district} อ.{a.amphoe} จ.{a.province} · {a.source === 'TAMBON' ? 'จุดกลางตำบล' : 'ปักหมุดตำแหน่งจริง'}
                  </p>
                  <input
                    value={a.note}
                    maxLength={200}
                    onChange={(e) => update(i, { note: e.target.value })}
                    placeholder="บทบาทของพื้นที่ในงานนี้ (ไม่บังคับ) เช่น พื้นที่ต้นแบบ ประหยัดค่าเหล้า 990,000 บาท"
                    aria-label={`บทบาทของพื้นที่ ${a.areaName || a.district}`}
                    className={`${inputCls} mt-2`}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => onChange(value.filter((_, j) => j !== i))}
                  className="p-1 text-gray-400 hover:text-red-600"
                  aria-label={`ลบพื้นที่ ${a.areaName || a.district}`}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <div className="mt-3 rounded-xl border border-orange-200 p-3 space-y-3">
          <LocationField
            location={location}
            pin={pin}
            areaName={areaName}
            onLocation={setLocation}
            onPin={setPin}
            onAreaName={setAreaName}
          />
          {location && (
            <input
              value={note}
              maxLength={200}
              onChange={(e) => setNote(e.target.value)}
              placeholder="บทบาทของพื้นที่ในงานนี้ (ไม่บังคับ)"
              aria-label="บทบาทของพื้นที่ใหม่"
              className={inputCls}
            />
          )}
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={add}
              disabled={!location}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" /> เพิ่มพื้นที่นี้
            </button>
            <button
              type="button"
              onClick={() => {
                resetDraft();
                setAdding(false);
              }}
              className="px-3 py-2 text-sm rounded-lg border border-orange-200 text-gray-600 hover:bg-orange-50"
            >
              ยกเลิก
            </button>
          </div>
        </div>
      ) : (
        value.length < MAX_EXTRA_AREAS && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="mt-3 inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-orange-200 text-orange-700 hover:bg-orange-50"
          >
            <Plus className="w-4 h-4" /> เพิ่มพื้นที่ที่เกี่ยวข้อง
          </button>
        )
      )}
    </div>
  );
}
