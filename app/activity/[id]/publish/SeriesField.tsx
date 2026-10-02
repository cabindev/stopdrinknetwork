'use client';

// ชุดกรณีศึกษาในหน้าเผยแพร่: ไม่อยู่ในชุด / เลือกชุดที่มี / สร้างชุดใหม่ + ลำดับในชุด
// แก้ชื่อ/บทนำของชุดที่เลือกได้ที่นี่ (มีผลกับทุกเรื่องในชุด) — บันทึกพร้อมปุ่มเผยแพร่
import { Layers } from 'lucide-react';

export interface SeriesOption {
  id: number;
  title: string;
  description: string | null;
  count: number; // จำนวนเรื่องในชุด (รวมที่ยังไม่เผยแพร่)
}

// ค่าที่ส่งไป API: null = ไม่อยู่ในชุด · id null = สร้างชุดใหม่
export interface SeriesValue {
  id: number | null;
  title: string;
  description: string;
  order: number;
}

const inputCls =
  'w-full px-3 py-2 text-sm text-gray-900 bg-white border border-orange-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400';

export default function SeriesField({
  options,
  value,
  onChange,
}: {
  options: SeriesOption[];
  value: SeriesValue | null;
  onChange: (v: SeriesValue | null) => void;
}) {
  const selectValue = value === null ? '' : value.id === null ? 'new' : String(value.id);

  const pick = (v: string) => {
    if (v === '') return onChange(null);
    if (v === 'new') return onChange({ id: null, title: '', description: '', order: value?.order ?? 1 });
    const o = options.find((x) => String(x.id) === v);
    if (o) onChange({ id: o.id, title: o.title, description: o.description ?? '', order: value?.order ?? o.count + 1 });
  };
  const current = value?.id != null ? options.find((o) => o.id === value.id) : null;

  return (
    <section className="bg-white rounded-2xl border border-orange-100 p-6">
      <h2 className="flex items-center gap-2 text-base font-semibold text-gray-800">
        <Layers className="w-5 h-5 text-orange-600" /> ชุดกรณีศึกษา <span className="text-xs font-normal text-gray-400">(ไม่บังคับ)</span>
      </h2>
      <p className="text-xs text-gray-400 mt-1 mb-4">
        หลายเรื่องที่อ่านต่อกันได้ เช่น &quot;สงกรานต์ 6 พื้นที่ต้นแบบ 2569&quot; — ท้ายแต่ละเรื่องจะมีรายการเรื่องอื่นในชุด และมีหน้ารวมของชุด
      </p>
      <div className="grid sm:grid-cols-[1fr_120px] gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="seriesSelect">ชุด</label>
          <select id="seriesSelect" value={selectValue} onChange={(e) => pick(e.target.value)} className={inputCls}>
            <option value="">— ไม่อยู่ในชุด —</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.title} ({o.count} เรื่อง)
              </option>
            ))}
            <option value="new">+ สร้างชุดใหม่</option>
          </select>
        </div>
        {value && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="seriesOrder">ลำดับในชุด</label>
            <input
              id="seriesOrder"
              type="number"
              min={1}
              max={999}
              value={value.order}
              onChange={(e) => onChange({ ...value, order: Number(e.target.value) || 1 })}
              className={inputCls}
            />
          </div>
        )}
      </div>
      {value && (
        <div className="mt-3 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="seriesTitle">ชื่อชุด</label>
            <input
              id="seriesTitle"
              value={value.title}
              maxLength={200}
              onChange={(e) => onChange({ ...value, title: e.target.value })}
              placeholder="เช่น สงกรานต์ 6 พื้นที่ต้นแบบ 2569"
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="seriesDescription">บทนำของชุด</label>
            <textarea
              id="seriesDescription"
              rows={3}
              value={value.description}
              onChange={(e) => onChange({ ...value, description: e.target.value })}
              placeholder="ชุดนี้คืออะไร อ่านแล้วได้อะไร (แสดงบนหน้ารวมของชุด)"
              className={inputCls}
            />
          </div>
          {current && current.count > 1 && (
            <p className="text-xs text-gray-400">แก้ชื่อหรือบทนำ = เปลี่ยนให้ทุกเรื่องในชุดนี้ ({current.count} เรื่อง)</p>
          )}
        </div>
      )}
    </section>
  );
}
