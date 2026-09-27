'use client';

// เลือกงานในตารางแอดมิน → โอนให้ผู้รับผิดชอบคนอื่น
// ตารางเป็น server component — ใช้ context ให้ช่องติ๊กแต่ละแถว/ติ๊กทั้งหมด/แถบโอนแชร์ชุดที่เลือกกัน
import { createContext, useContext, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { ArrowRightLeft, X, Loader2, Search } from 'lucide-react';

type Ctx = { selected: Set<number>; toggle: (id: number, on: boolean) => void; setMany: (ids: number[], on: boolean) => void; clear: () => void };
const SelectionContext = createContext<Ctx | null>(null);
const useSel = () => {
  const c = useContext(SelectionContext);
  if (!c) throw new Error('TransferSelection: missing provider');
  return c;
};

export function TransferProvider({ children }: { children: React.ReactNode }) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const value = useMemo<Ctx>(
    () => ({
      selected,
      toggle: (id, on) =>
        setSelected((prev) => {
          const n = new Set(prev);
          if (on) n.add(id);
          else n.delete(id);
          return n;
        }),
      setMany: (ids, on) =>
        setSelected((prev) => {
          const n = new Set(prev);
          ids.forEach((id) => (on ? n.add(id) : n.delete(id)));
          return n;
        }),
      clear: () => setSelected(new Set()),
    }),
    [selected]
  );
  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>;
}

const boxCls = 'w-4 h-4 rounded border-orange-300 text-orange-600 focus:ring-orange-400 cursor-pointer';

export function RowCheck({ id }: { id: number }) {
  const { selected, toggle } = useSel();
  return (
    <input
      type="checkbox"
      aria-label="เลือกงานนี้"
      data-testid="row-check"
      className={boxCls}
      checked={selected.has(id)}
      onChange={(e) => toggle(id, e.target.checked)}
    />
  );
}

// ติ๊กทั้งหน้า (หัวตาราง)
export function PageCheck({ ids }: { ids: number[] }) {
  const { selected, setMany } = useSel();
  const all = ids.length > 0 && ids.every((id) => selected.has(id));
  return (
    <input
      type="checkbox"
      aria-label="เลือกทั้งหน้านี้"
      className={boxCls}
      checked={all}
      onChange={(e) => setMany(ids, e.target.checked)}
    />
  );
}

export interface UserOption {
  id: number;
  name: string;
  email: string;
  count: number;
}

// แถบโอนงาน — โผล่เมื่อเลือกอย่างน้อย 1 งาน · มีปุ่ม "เลือกทั้งหมดตามตัวกรอง" (ข้ามหน้า)
export function TransferBar({ users, filteredIds }: { users: UserOption[]; filteredIds: number[] }) {
  const router = useRouter();
  const { selected, setMany, clear } = useSel();
  const [q, setQ] = useState('');
  const [userId, setUserId] = useState('');
  const [saving, setSaving] = useState(false);

  const shown = useMemo(() => {
    const k = q.trim().toLowerCase();
    return k ? users.filter((u) => `${u.name} ${u.email}`.toLowerCase().includes(k)) : users;
  }, [q, users]);

  if (selected.size === 0) return null;
  const target = users.find((u) => String(u.id) === userId);
  const allFiltered = filteredIds.every((id) => selected.has(id));

  const submit = async () => {
    if (!target) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/activities/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [...selected], userId: target.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`โอน ${data.moved} งานให้ ${data.to} แล้ว${data.skipped ? ` (ข้าม ${data.skipped} งานที่เป็นของผู้รับอยู่แล้ว)` : ''}`);
      clear();
      setUserId('');
      setQ('');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'โอนงานไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      data-testid="transfer-bar"
      className="sticky bottom-4 z-20 mt-4 bg-white rounded-2xl border border-orange-200 shadow-lg shadow-orange-100 p-3 flex flex-wrap items-center gap-2"
    >
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-600 text-white text-xs font-medium">
        เลือก {selected.size} งาน
        <button type="button" onClick={clear} aria-label="ล้างที่เลือก" className="hover:text-orange-100">
          <X className="w-3.5 h-3.5" />
        </button>
      </span>
      {!allFiltered && filteredIds.length > selected.size && (
        <button
          type="button"
          onClick={() => setMany(filteredIds, true)}
          className="text-xs text-orange-700 underline underline-offset-2 hover:text-orange-800"
        >
          เลือกทั้งหมดตามตัวกรอง ({filteredIds.length} งาน)
        </button>
      )}
      <div className="flex-1" />
      <span className="text-xs text-gray-500">โอนให้</span>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ค้นชื่อ/อีเมล"
          className="w-36 pl-8 pr-2 py-2 text-sm border border-orange-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400"
        />
      </div>
      <select
        data-testid="transfer-user"
        value={userId}
        onChange={(e) => setUserId(e.target.value)}
        className="max-w-[16rem] px-3 py-2 text-sm text-gray-800 bg-white border border-orange-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400"
      >
        <option value="">— เลือกผู้รับผิดชอบ ({shown.length}) —</option>
        {shown.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name} · {u.email} ({u.count} งาน)
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={submit}
        disabled={!target || saving}
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-600 text-white text-sm font-medium hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRightLeft className="w-4 h-4" />}
        โอนงาน
      </button>
    </div>
  );
}
