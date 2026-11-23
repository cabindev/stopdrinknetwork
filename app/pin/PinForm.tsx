'use client';
// ฟอร์มปักหมุดงานจริงของครอบครัว — ตัวเลือกชุดเดียวกับกระดาน (QUESTIONS) ถ้าเคยจัดแผนบนกระดานในเครื่องนี้ เติมคำตอบให้ก่อน
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, FileText, Plus, X } from 'lucide-react';
import AreaPicker from '@/app/farewell/components/AreaPicker';
import ThaiDateField from '@/app/components/ThaiDateField';
import { EMPTY_PLAN, baht, planBudget, usePlan, type PlanArea } from '@/app/farewell/planStore';
import { PIN_FILE_LIMITS, PIN_PLACES, PIN_QUESTIONS, PIN_RELATIONS, type PinAnswers } from '@/app/lib/funeralPins';

/** รูปจากมือถือ: HEIC → JPEG แล้วย่อ ≤1920px ~1MB ก่อนส่ง (server เข้ารหัสใหม่และลบพิกัด GPS อีกชั้น) · PDF ส่งตามเดิม */
async function prepareFile(f: File): Promise<File> {
  if (f.type === 'application/pdf') return f;
  let file = f;
  if (/heic|heif/i.test(f.type) || /\.hei[cf]$/i.test(f.name)) {
    const heic2any = (await import('heic2any')).default;
    const blob = (await heic2any({ blob: f, toType: 'image/jpeg', quality: 0.9 })) as Blob;
    file = new File([blob], f.name.replace(/\.hei[cf]$/i, '.jpg'), { type: 'image/jpeg' });
  }
  if (!file.type.startsWith('image/')) return file;
  const imageCompression = (await import('browser-image-compression')).default;
  const out = await imageCompression(file, { maxSizeMB: 1, maxWidthOrHeight: 1920, useWebWorker: true });
  return new File([out], file.name, { type: out.type || file.type });
}

const labelCls = 'block text-sm font-medium text-gray-900';
const inputCls =
  'mt-1.5 h-11 w-full rounded-xl border border-gray-300 px-3 text-base text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900';

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm transition-colors ${
        on ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-300 text-gray-800 hover:bg-gray-50'
      }`}
    >
      {on && <Check className="w-4 h-4" />}
      {children}
    </button>
  );
}

export default function PinForm() {
  const router = useRouter();
  const { plan } = usePlan();
  // เคยจัดแผนบนกระดาน/หน้าวางแผนในเครื่องนี้ = เติมคำตอบให้ก่อน (แก้ได้ทุกข้อ)
  const seed = plan ?? EMPTY_PLAN;
  const [relation, setRelation] = useState('');
  const [first, setFirst] = useState(seed.deceasedName.split(' ')[0] ?? '');
  const [last, setLast] = useState(seed.deceasedName.split(' ').slice(1).join(' '));
  const [showName, setShowName] = useState(false);
  const [date, setDate] = useState('');
  const [area, setArea] = useState<PlanArea | null>(seed.area);
  const [place, setPlace] = useState(seed.place ?? '');
  const [answers, setAnswers] = useState<PinAnswers>(() => {
    const a: PinAnswers = {};
    for (const q of PIN_QUESTIONS) if (seed.answers[q.key]) a[q.key] = seed.answers[q.key];
    return a;
  });
  const [cost, setCost] = useState('');
  const [story, setStory] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [photos, setPhotos] = useState<{ file: File; url: string }[]>([]);
  const [bills, setBills] = useState<File[]>([]);
  const [preparing, setPreparing] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);
  const billInput = useRef<HTMLInputElement>(null);
  // คืนหน่วยความจำของรูปตัวอย่างเมื่อออกจากหน้า
  const photosRef = useRef(photos);
  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);
  useEffect(() => () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.url)), []);

  /** เลือกไฟล์ — อ่าน FileList ออกมาก่อนล้างค่า input (ล้างก่อน = ไฟล์หายเงียบ ๆ) */
  const addFiles = async (e: React.ChangeEvent<HTMLInputElement>, kind: 'photo' | 'bill') => {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (!picked.length) return;
    const room = kind === 'photo' ? PIN_FILE_LIMITS.photos - photos.length : PIN_FILE_LIMITS.bills - bills.length;
    const take = picked.slice(0, Math.max(0, room));
    if (picked.length > take.length) setError(kind === 'photo' ? `แนบรูปได้ไม่เกิน ${PIN_FILE_LIMITS.photos} รูป` : `แนบบิลได้ไม่เกิน ${PIN_FILE_LIMITS.bills} ไฟล์`);
    setPreparing(true);
    try {
      const ready = await Promise.all(take.map(prepareFile));
      if (kind === 'photo') setPhotos((p) => [...p, ...ready.map((file) => ({ file, url: URL.createObjectURL(file) }))]);
      else setBills((b) => [...b, ...ready]);
    } catch {
      setError('เปิดไฟล์บางไฟล์ไม่ได้ ลองเลือกรูป JPG/PNG หรือ PDF');
    } finally {
      setPreparing(false);
    }
  };

  const estimate = answers.days ? planBudget({ ...EMPTY_PLAN, answers }).total : 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!relation) return setError('กรุณาเลือกว่าจัดงานให้ใคร');
    if (!area) return setError('กรุณาเลือกตำบลที่จัดงาน');
    if (!place) return setError('กรุณาเลือกว่าจัดที่วัดหรือที่บ้าน');
    if (!answers.days) return setError('กรุณาเลือกจำนวนวันที่จัดงาน');
    if (!answers.alcohol) return setError('กรุณาตอบเรื่องเหล้าเบียร์ในงาน');
    if (story.length > 1000) return setError('เรื่องเล่ายาวเกิน 1,000 ตัวอักษร');
    setSending(true);
    try {
      const fd = new FormData();
      fd.append(
        'data',
        JSON.stringify({
          relation,
          deceasedFirstName: first,
          deceasedLastName: last,
          showDeceasedName: showName && !!first.trim(),
          funeralDate: date,
          ...area,
          place,
          answers,
          totalCost: cost.replace(/[^\d]/g, ''),
          story,
        }),
      );
      for (const p of photos) fd.append('photos', p.file);
      for (const b of bills) fd.append('bills', b);
      const res = await fetch('/api/pins', { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'บันทึกไม่สำเร็จ ลองอีกครั้ง');
      router.push(`/map?pin=${data.pin.id}`);
    } catch (err) {
      setError((err as Error).message);
      setSending(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-6 space-y-7">
      {/* 1. งานของใคร */}
      <fieldset>
        <legend className={labelCls}>จัดงานให้ใคร</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {Object.entries(PIN_RELATIONS).map(([id, label]) => (
            <Chip key={id} on={relation === id} onClick={() => setRelation(id)}>
              {label}
            </Chip>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="text-sm text-gray-700">
            ชื่อผู้วายชนม์
            <input value={first} onChange={(e) => setFirst(e.target.value)} className={inputCls} autoComplete="off" />
          </label>
          <label className="text-sm text-gray-700">
            นามสกุล
            <input value={last} onChange={(e) => setLast(e.target.value)} className={inputCls} autoComplete="off" />
          </label>
        </div>
        <label className="mt-3 flex items-start gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={showName}
            onChange={(e) => setShowName(e.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 accent-gray-900"
          />
          <span>
            แสดงชื่อผู้วายชนม์บนแผนที่
            <span className="block text-xs text-gray-500">ไม่ติ๊ก = แสดงเป็น “ครอบครัวหนึ่ง” ชื่อเก็บไว้ให้ทีมงานเห็นเท่านั้น</span>
          </span>
        </label>
      </fieldset>

      {/* 2. เมื่อไร ที่ไหน */}
      <fieldset className="space-y-4">
        <div>
          <label className={labelCls} htmlFor="funeralDate">
            วันที่จัดงาน <span className="font-normal text-gray-500">(ไม่บังคับ)</span>
          </label>
          <div className="mt-1.5">
            <ThaiDateField id="funeralDate" value={date} onChange={setDate} yearsBack={25} yearsForward={0} />
          </div>
        </div>
        <div>
          <span className={labelCls}>ตำบลที่จัดงาน</span>
          <div className="mt-1.5">
            <AreaPicker plain value={area} onChange={setArea} />
          </div>
          <p className="mt-1 text-xs text-gray-500">แผนที่แสดงระดับตำบล ไม่ปักตำแหน่งบ้าน</p>
        </div>
        <div>
          <span className={labelCls}>ตั้งศพที่ไหน</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {Object.entries(PIN_PLACES).map(([id, label]) => (
              <Chip key={id} on={place === id} onClick={() => setPlace(id)}>
                {label}
              </Chip>
            ))}
          </div>
        </div>
      </fieldset>

      {/* 3. งานจริงจัดแบบไหน — ตัวเลือกเดียวกับกระดาน */}
      <fieldset className="space-y-5">
        <legend className="text-base font-semibold text-gray-900">งานจริงจัดแบบไหน</legend>
        {PIN_QUESTIONS.map((q) => (
          <div key={q.key}>
            <span className={labelCls}>
              {q.short}
              {q.key !== 'days' && q.key !== 'alcohol' && <span className="font-normal text-gray-500"> (ไม่บังคับ)</span>}
            </span>
            <div className="mt-2 flex flex-wrap gap-2">
              {q.options.map((o) => (
                <Chip
                  key={o.id}
                  on={answers[q.key] === o.id}
                  onClick={() => setAnswers((a) => ({ ...a, [q.key]: a[q.key] === o.id && q.key !== 'days' && q.key !== 'alcohol' ? undefined : o.id }))}
                >
                  {o.label}
                </Chip>
              ))}
            </div>
          </div>
        ))}
      </fieldset>

      {/* 4. ค่าใช้จ่าย + เรื่องเล่า */}
      <fieldset className="space-y-4">
        <label className="block">
          <span className={labelCls}>
            ใช้จ่ายจริงทั้งงานประมาณ (บาท) <span className="font-normal text-gray-500">(ไม่บังคับ)</span>
          </span>
          <input
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            inputMode="numeric"
            placeholder={estimate ? `ราคาประมาณจากที่เลือก ~${baht(estimate)}` : 'เช่น 50000'}
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className={labelCls}>
            เล่าสั้น ๆ <span className="font-normal text-gray-500">(ไม่บังคับ)</span>
          </span>
          <textarea
            value={story}
            onChange={(e) => setStory(e.target.value)}
            rows={4}
            placeholder="เช่น ญาติและเพื่อนบ้านช่วยกันทำอาหาร ติดป้ายไม่เลี้ยงเหล้า แขกเข้าใจ งานเรียบร้อย"
            className="mt-1.5 w-full rounded-xl border border-gray-300 px-3 py-2.5 text-base text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
          />
          <span className={`mt-1 block text-right text-xs tabular-nums ${story.length > 1000 ? 'text-red-700' : 'text-gray-500'}`}>
            {story.length.toLocaleString('th-TH')}/1,000
          </span>
        </label>
      </fieldset>

      {/* 5. รูป + บิล */}
      <fieldset className="space-y-5">
        <div>
          <span className={labelCls}>
            รูปภาพงาน <span className="font-normal text-gray-500">(ไม่บังคับ · ไม่เกิน {PIN_FILE_LIMITS.photos} รูป)</span>
          </span>
          <p className="mt-0.5 text-xs text-gray-500">แสดงบนแผนที่ให้ทุกคนเห็น — เลือกรูปที่คนในภาพยินดีให้เผยแพร่</p>
          <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
            {photos.map((p, i) => (
              <div key={p.url} className="relative aspect-square overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
                {/* eslint-disable-next-line @next/next/no-img-element -- blob URL ตัวอย่างในเครื่อง */}
                <img src={p.url} alt={`รูปที่ ${i + 1}`} className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => {
                    URL.revokeObjectURL(p.url);
                    setPhotos((list) => list.filter((x) => x.url !== p.url));
                  }}
                  aria-label={`ลบรูปที่ ${i + 1}`}
                  className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-gray-900/80 text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            {photos.length < PIN_FILE_LIMITS.photos && (
              <button
                type="button"
                onClick={() => photoInput.current?.click()}
                disabled={preparing}
                className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-gray-300 text-sm text-gray-700 hover:bg-gray-50 disabled:text-gray-400"
              >
                <Plus className="w-5 h-5" />
                เพิ่มรูป
              </button>
            )}
          </div>
          <input ref={photoInput} type="file" accept="image/*,.heic,.heif" multiple hidden onChange={(e) => addFiles(e, 'photo')} />
        </div>

        <div>
          <span className={labelCls}>
            บิล / ใบเสร็จค่าใช้จ่าย <span className="font-normal text-gray-500">(ไม่บังคับ · รูปหรือ PDF)</span>
          </span>
          <p className="mt-0.5 text-xs text-gray-500">ไม่แสดงบนแผนที่ — ทีมงานใช้ยืนยันค่าใช้จ่ายจริงเท่านั้น</p>
          {bills.length > 0 && (
            <ul className="mt-2 divide-y divide-gray-100 rounded-xl border border-gray-200">
              {bills.map((b, i) => (
                <li key={`${b.name}-${i}`} className="flex items-center gap-2 px-3 py-2 text-sm">
                  <FileText className="w-4 h-4 shrink-0 text-gray-500" />
                  <span className="min-w-0 flex-1 truncate text-gray-900">{b.name}</span>
                  <span className="shrink-0 text-xs tabular-nums text-gray-500">{Math.max(1, Math.round(b.size / 1024)).toLocaleString('th-TH')} KB</span>
                  <button
                    type="button"
                    onClick={() => setBills((list) => list.filter((_, j) => j !== i))}
                    aria-label={`ลบ ${b.name}`}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-600 hover:bg-gray-100"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {bills.length < PIN_FILE_LIMITS.bills && (
            <button
              type="button"
              onClick={() => billInput.current?.click()}
              disabled={preparing}
              className="mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-full border border-gray-300 px-4 text-sm text-gray-900 hover:bg-gray-50 disabled:text-gray-400"
            >
              <Plus className="w-4 h-4" /> เพิ่มบิล
            </button>
          )}
          <input ref={billInput} type="file" accept="image/*,.heic,.heif,application/pdf" multiple hidden onChange={(e) => addFiles(e, 'bill')} />
        </div>
        {preparing && <p className="text-xs text-gray-500">กำลังเตรียมไฟล์…</p>}
      </fieldset>

      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      <button
        type="submit"
        disabled={sending || preparing}
        className="h-12 w-full rounded-full bg-gray-900 text-base font-medium text-white hover:bg-gray-700 disabled:bg-gray-400"
      >
        {sending ? 'กำลังปักหมุด…' : 'ปักหมุดบนแผนที่'}
      </button>
      <p className="text-center text-xs text-gray-500">หมุดขึ้นแผนที่ทันที ทีมงานอาจปรับข้อความหรือซ่อนหมุดที่ไม่เหมาะสม</p>
    </form>
  );
}
