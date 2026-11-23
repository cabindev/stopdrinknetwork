'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import AreaPicker from '@/app/farewell/components/AreaPicker';
import type { PlanArea } from '@/app/farewell/planStore';
type Props = { kinds: Record<string, string>; practices: Record<string, string> };
export default function PinForm({ kinds, practices }: Props) {
  const router = useRouter();
  const [kind, setKind] = useState('');
  const [area, setArea] = useState<PlanArea | null>(null);
  const [selected, setSelected] = useState<string[]>(['no_alcohol']);
  const [story, setStory] = useState('');
  const [contactOpen, setContactOpen] = useState(false);
  const [consent, setConsent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [year, setYear] = useState('');
  const currentBE = new Date().getFullYear() + 543;
  const field =
    'min-h-11 w-full rounded-xl border border-gray-300 px-3 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-200';
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    if (!kind || !area || !selected.length) {
      setError('กรุณาเลือกผู้จัด พื้นที่ และสิ่งที่ทำอย่างน้อย 1 ข้อ');
      return;
    }
    if (story.trim().length > 1000) {
      setError('เรื่องเล่ายาวเกิน 1,000 ตัวอักษร');
      return;
    }
    setSending(true);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch('/api/pins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind,
          displayName: fd.get('displayName'),
          district: area.district,
          amphoe: area.amphoe,
          province: area.province,
          yearBE: year,
          practices: selected,
          savedAmount: fd.get('savedAmount'),
          story,
          contactName: fd.get('contactName'),
          contactPhone: consent ? fd.get('contactPhone') : null,
          consent,
          website: fd.get('website'),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'ส่งข้อมูลไม่สำเร็จ');
      router.push(`/map?pin=${data.pin.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่');
      setSending(false);
    }
  }
  return (
    <form onSubmit={submit} className="mt-6 space-y-6">
      <div className="space-y-2">
        <label className="block text-sm font-medium">
          ใครจัด <span className="text-gray-500">(จำเป็น)</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {Object.entries(kinds).map(([v, l]) => (
            <button
              type="button"
              key={v}
              onClick={() => setKind(v)}
              className={`min-h-11 rounded-full border px-4 text-sm ${kind === v ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-300 hover:bg-gray-50'}`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium" htmlFor="displayName">
          ชื่อที่แสดงบนแผนที่ (ไม่บังคับ)
        </label>
        <input id="displayName" name="displayName" className={field} placeholder="เช่น ครอบครัวศรีสุข · บ้านโนนสวรรค์ · วัดป่า…" />
        <p className="mt-1 text-xs text-gray-500">ไม่ใส่ = แสดงเป็น ‘ครอบครัวหนึ่ง’</p>
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium">
          ที่ไหน <span className="text-gray-500">(จำเป็น)</span>
        </label>
        <AreaPicker plain value={area} onChange={setArea} />
        <p className="mt-1 text-xs text-gray-500">แผนที่แสดงระดับตำบล ไม่ปักบ้าน</p>
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium" htmlFor="year">
          ปี พ.ศ. ที่จัด (ไม่บังคับ)
        </label>
        <select id="year" className={field} value={year} onChange={(e) => setYear(e.target.value)}>
          <option value="">ไม่ระบุ</option>
          {Array.from({ length: currentBE - 2539 }, (_, i) => currentBE - i).map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">
          ทำอะไรบ้าง <span className="text-gray-500">(เลือกอย่างน้อย 1 ข้อ)</span>
        </p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(practices).map(([v, l]) => (
            <button
              type="button"
              key={v}
              onClick={() => setSelected((s) => (s.includes(v) ? s.filter((x) => x !== v) : [...s, v]))}
              className={`min-h-11 rounded-full border px-4 text-sm ${selected.includes(v) ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-300 hover:bg-gray-50'}`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium" htmlFor="savedAmount">
          ประหยัดได้ประมาณ (บาท, ไม่บังคับ)
        </label>
        <input id="savedAmount" name="savedAmount" type="number" min="0" max="10000000" step="1" inputMode="numeric" className={field} />
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium" htmlFor="story">
          เล่าสั้น ๆ (ไม่บังคับ)
        </label>
        <textarea
          id="story"
          value={story}
          onChange={(e) => setStory(e.target.value)}
          rows={4}
          className={`${field} py-3`}
          placeholder="แบ่งปันวิธีที่ชุมชนของคุณทำได้จริง"
        />
        <p className="mt-1 text-right text-xs text-gray-500">{story.length}/1000</p>
      </div>
      <div className="rounded-2xl border border-gray-200 p-4">
        <button type="button" onClick={() => setContactOpen((v) => !v)} className="min-h-11 text-sm font-medium">
          {contactOpen ? '−' : '＋'} ให้ทีมงานติดต่อกลับ (ไม่บังคับ)
        </button>
        {contactOpen && (
          <div className="mt-3 space-y-3">
            <input name="contactName" aria-label="ชื่อผู้ติดต่อ" className={field} placeholder="ชื่อผู้ติดต่อ" />
            <input name="contactPhone" aria-label="เบอร์โทรศัพท์" inputMode="tel" className={field} placeholder="เบอร์โทรศัพท์" />
            <label className="flex min-h-11 items-center gap-3 text-sm">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="h-5 w-5" />
              ยินยอมให้ทีมงานเก็บชื่อและเบอร์ไว้ติดต่อ (ไม่แสดงบนแผนที่)
            </label>
          </div>
        )}
      </div>
      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute -left-[10000px] h-px w-px" />
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
      <button
        disabled={sending}
        className="h-12 w-full rounded-full bg-gray-900 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
      >
        {sending ? 'กำลังส่ง…' : 'ปักหมุดเลย'}
      </button>
    </form>
  );
}
