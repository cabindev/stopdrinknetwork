'use client';

// ทีมงานร่วม (งานเป็นงานทีม) — ชิปรายชื่อ + ช่องค้นหาเพิ่มคน
// สมาชิกทีมเห็นงานใน "งานของฉัน" และแก้ไขงานได้ · ผู้เขียน (เจ้าของงาน) เป็นทีมอยู่แล้ว ไม่ต้องเลือก
import { useMemo, useRef, useState } from 'react';
import { UsersRound, X, Plus, UserRound } from 'lucide-react';

export interface TeamPerson {
  id: number;
  name: string;
  organization: string | null;
  image: string | null;
}

const Avatar = ({ p, size = 'w-6 h-6' }: { p: TeamPerson; size?: string }) =>
  p.image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={p.image} alt="" className={`${size} rounded-full object-cover`} />
  ) : (
    <span className={`${size} rounded-full bg-orange-100 text-orange-700 flex items-center justify-center`}>
      <UserRound className="w-3.5 h-3.5" />
    </span>
  );

export default function TeamField({
  people,
  ownerId,
  value,
  onChange,
}: {
  people: TeamPerson[];
  ownerId: number;
  value: number[];
  onChange: (ids: number[]) => void;
}) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const byId = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const owner = byId.get(ownerId);
  const options = useMemo(() => {
    const k = q.trim().toLowerCase();
    return people
      .filter((p) => p.id !== ownerId && !value.includes(p.id))
      .filter((p) => !k || `${p.name} ${p.organization ?? ''}`.toLowerCase().includes(k))
      .slice(0, 8);
  }, [people, ownerId, value, q]);

  const add = (id: number) => {
    onChange([...value, id]);
    setQ('');
    setActive(0);
    inputRef.current?.focus();
  };

  return (
    <section className="bg-white rounded-2xl border border-orange-100 p-6">
      <div className="flex items-center gap-2">
        <UsersRound className="w-5 h-5 text-orange-600" />
        <h2 className="text-base font-semibold text-gray-800">ทีมงาน</h2>
        <span className="text-xs text-gray-400">(ไม่บังคับ)</span>
      </div>
      <p className="mt-1 text-xs text-gray-500">
        เพิ่มเพื่อนร่วมทีมที่ทำงานนี้ด้วยกัน — งานจะขึ้นใน &quot;งานของฉัน&quot; ของทุกคนและทุกคนแก้ไขได้
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2" data-testid="team-chips">
        {owner && (
          <span className="inline-flex items-center gap-1.5 pl-1 pr-3 py-1 rounded-full bg-orange-600 text-white text-sm">
            <Avatar p={owner} /> {owner.name}
            <span className="text-[10px] text-orange-100">ผู้เขียน</span>
          </span>
        )}
        {value.map((id) => {
          const p = byId.get(id);
          if (!p) return null;
          return (
            <span key={id} className="inline-flex items-center gap-1.5 pl-1 pr-1.5 py-1 rounded-full bg-orange-50 border border-orange-200 text-sm text-gray-800">
              <Avatar p={p} /> {p.name}
              <button
                type="button"
                onClick={() => onChange(value.filter((x) => x !== id))}
                aria-label={`เอา ${p.name} ออกจากทีม`}
                className="p-0.5 rounded-full text-gray-400 hover:text-red-600 hover:bg-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          );
        })}
      </div>

      <div className="relative mt-3">
        <Plus className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-orange-400" />
        <input
          ref={inputRef}
          data-testid="team-search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (!open || options.length === 0) return;
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((i) => Math.min(i + 1, options.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            } else if (e.key === 'Enter') {
              e.preventDefault(); // ห้าม submit ฟอร์มงาน
              add(options[active].id);
            } else if (e.key === 'Escape') setOpen(false);
          }}
          placeholder="พิมพ์ชื่อเพื่อเพิ่มเพื่อนร่วมทีม"
          className="w-full pl-9 pr-3 py-2.5 text-sm text-gray-900 bg-white border border-orange-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400"
        />
        {open && options.length > 0 && (
          <ul role="listbox" className="absolute z-20 left-0 right-0 mt-1 bg-white rounded-xl border border-orange-200 shadow-lg max-h-64 overflow-y-auto">
            {options.map((p, i) => (
              <li key={p.id} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => add(p.id)}
                  className={`w-full text-left px-3 py-2 flex items-center gap-2 ${i === active ? 'bg-orange-50' : ''}`}
                >
                  <Avatar p={p} size="w-7 h-7" />
                  <span className="min-w-0">
                    <span className="block text-sm text-gray-800 truncate">{p.name}</span>
                    {p.organization && <span className="block text-[11px] text-gray-400 truncate">{p.organization}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
