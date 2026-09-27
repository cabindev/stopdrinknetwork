'use client';

// ช่อง "ผู้เขียน" แบบ WordPress (หน้าแก้ไขงาน) — superadmin คลิกชื่อ → ค้น → เลือก = บันทึกทันที
// ใช้ API เดียวกับการโอนหลายงานในตารางแอดมิน (/api/admin/activities/transfer)
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { UserRound, X, Check, Loader2 } from 'lucide-react';

export interface AuthorOption {
  id: number;
  name: string;
  email: string;
  image: string | null;
}

export default function AuthorPicker({
  activityId,
  current,
  users,
}: {
  activityId: number;
  current: AuthorOption;
  users: AuthorOption[];
}) {
  const router = useRouter();
  const [author, setAuthor] = useState(current);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const [saving, setSaving] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const shown = useMemo(() => {
    const k = q.trim().toLowerCase();
    return (k ? users.filter((u) => `${u.name} ${u.email}`.toLowerCase().includes(k)) : users).slice(0, 50);
  }, [q, users]);

  // คลิกนอกกล่อง / Esc = ปิด
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const choose = async (u: AuthorOption) => {
    setOpen(false);
    if (u.id === author.id) return;
    const prev = author;
    setAuthor(u);
    setSaving(true);
    try {
      const res = await fetch('/api/admin/activities/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [activityId], userId: u.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`เปลี่ยนผู้เขียนเป็น ${u.name} แล้ว`);
      router.refresh();
    } catch (err) {
      setAuthor(prev);
      toast.error(err instanceof Error ? err.message : 'เปลี่ยนผู้เขียนไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div ref={boxRef} className="relative mb-6 flex items-center gap-3 rounded-2xl border border-orange-100 bg-orange-50/50 px-4 py-3">
      <span className="text-sm text-gray-500 w-20 shrink-0">ผู้เขียน</span>
      <button
        type="button"
        data-testid="author-button"
        onClick={() => {
          setOpen((o) => !o);
          setQ('');
          setActive(0);
        }}
        disabled={saving}
        className="inline-flex items-center gap-2 min-w-0 text-sm font-medium text-orange-700 hover:text-orange-800 hover:underline underline-offset-2 disabled:opacity-60"
      >
        {author.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={author.image} alt="" className="w-6 h-6 rounded-full object-cover" />
        ) : (
          <UserRound className="w-5 h-5 text-orange-400" />
        )}
        <span className="truncate">{author.name}</span>
        {saving && <Loader2 className="w-4 h-4 animate-spin" />}
      </button>
      <span className="ml-auto hidden sm:block text-[11px] text-gray-400">เฉพาะ superadmin · งานจะย้ายไป "งานของฉัน" ของคนนั้น</span>

      {open && (
        <div className="absolute left-4 right-4 sm:left-24 sm:right-auto sm:w-80 top-full mt-1 z-30 bg-white rounded-xl border border-orange-200 shadow-xl">
          <div className="flex items-center justify-between px-3 pt-3 pb-2">
            <span className="text-sm font-semibold text-gray-800">ผู้เขียน</span>
            <button type="button" onClick={() => setOpen(false)} aria-label="ปิด" className="p-1 text-gray-400 hover:text-gray-700">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="px-3 pb-2">
            <input
              autoFocus
              data-testid="author-search"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setActive(0);
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setActive((i) => Math.min(i + 1, shown.length - 1));
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setActive((i) => Math.max(i - 1, 0));
                } else if (e.key === 'Enter') {
                  e.preventDefault(); // อยู่ในหน้าที่มีฟอร์ม — ห้าม submit ฟอร์มงาน
                  if (shown[active]) choose(shown[active]);
                } else if (e.key === 'Escape') setOpen(false);
              }}
              placeholder="ค้นชื่อหรืออีเมล"
              className="w-full px-3 py-2 text-sm border border-orange-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>
          <ul role="listbox" className="max-h-64 overflow-y-auto pb-2">
            {shown.length === 0 && <li className="px-4 py-3 text-sm text-gray-400">ไม่พบผู้ใช้</li>}
            {shown.map((u, i) => (
              <li key={u.id} role="option" aria-selected={u.id === author.id}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(u)}
                  className={`w-full text-left px-4 py-2 flex items-center gap-2 ${
                    i === active ? 'bg-orange-600 text-white' : 'text-gray-800'
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm truncate">{u.name}</span>
                    <span className={`block text-[11px] truncate ${i === active ? 'text-orange-100' : 'text-gray-400'}`}>{u.email}</span>
                  </span>
                  {u.id === author.id && <Check className="w-4 h-4 shrink-0" />}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
