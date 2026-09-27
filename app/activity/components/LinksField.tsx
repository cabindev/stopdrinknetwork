'use client';

// ลิงก์ที่เกี่ยวข้อง (โพสต์ FB, คลิป YouTube, ไฟล์ใน Drive, ข่าว) — ไม่บังคับ, สูงสุด MAX_LINKS
// วาง URL แล้วกด Enter/ปุ่มเพิ่ม · ชื่อสั้น ๆ ไม่บังคับ (ว่าง = แสดงโดเมน) · ตรวจ http(s) ตั้งแต่ฝั่ง browser
import { useState } from 'react';
import { Link2, Plus, X, ExternalLink, Info } from 'lucide-react';
import LinkKindIcon from '@/app/components/LinkKindIcon';
import {
  MAX_LINKS,
  MAX_LINK_TITLE,
  LINK_KIND_LABEL,
  normalizeUrl,
  detectLinkKind,
  linkDisplayName,
} from '@/app/lib/activityLinks';
import type { LinkInput } from '@/app/lib/activityLinks';

const inputCls =
  'w-full px-3 py-2.5 text-sm text-gray-900 bg-white border border-orange-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400';

export default function LinksField({ value, onChange }: { value: LinkInput[]; onChange: (v: LinkInput[]) => void }) {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');

  const add = () => {
    const norm = normalizeUrl(url);
    if (!norm) {
      setError('ลิงก์ไม่ถูกต้อง — วางลิงก์เต็ม เช่น https://www.facebook.com/…');
      return;
    }
    if (value.some((l) => normalizeUrl(l.url) === norm)) {
      setError('ลิงก์นี้เพิ่มไว้แล้ว');
      return;
    }
    if (value.length >= MAX_LINKS) {
      setError(`แนบลิงก์ได้ไม่เกิน ${MAX_LINKS} ลิงก์`);
      return;
    }
    onChange([...value, { url: norm, title: title.trim() }]);
    setUrl('');
    setTitle('');
    setError('');
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault(); // อยู่ในฟอร์มงาน — ห้าม submit
      add();
    }
  };

  const hasDrive = value.some((l) => detectLinkKind(l.url) === 'DRIVE') || detectLinkKind(normalizeUrl(url) ?? '') === 'DRIVE';

  return (
    <section className="bg-white rounded-2xl border border-orange-100 p-6" data-testid="links-field">
      <div className="flex items-center gap-2">
        <Link2 className="w-5 h-5 text-orange-600" />
        <h2 className="text-base font-semibold text-gray-800">ลิงก์ที่เกี่ยวข้อง</h2>
        <span className="text-xs text-gray-400">(ไม่บังคับ · สูงสุด {MAX_LINKS} ลิงก์)</span>
      </div>
      <p className="mt-1 text-xs text-gray-500">
        โพสต์ Facebook, คลิป YouTube/TikTok, ไฟล์ใหญ่ใน Google Drive หรือข่าวที่สื่อลง — ไม่ต้องอัปไฟล์ซ้ำ
      </p>

      {value.length > 0 && (
        <ul className="mt-3 space-y-2" data-testid="link-list">
          {value.map((l, i) => {
            const kind = detectLinkKind(l.url);
            return (
              <li key={l.url} className="flex items-center gap-2 rounded-lg border border-orange-100 bg-orange-50/50 px-3 py-2">
                <span className="shrink-0 text-orange-600" title={LINK_KIND_LABEL[kind]}>
                  <LinkKindIcon kind={kind} />
                </span>
                <div className="min-w-0 flex-1">
                  <input
                    value={l.title}
                    maxLength={MAX_LINK_TITLE}
                    onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))}
                    placeholder={linkDisplayName(l.url)}
                    aria-label="ชื่อลิงก์"
                    className="w-full bg-transparent text-sm text-gray-800 placeholder:text-gray-500 focus:outline-none"
                  />
                  <a href={l.url} target="_blank" rel="noopener noreferrer" className="block truncate text-[11px] text-gray-400 hover:text-orange-700">
                    {l.url}
                  </a>
                </div>
                <a href={l.url} target="_blank" rel="noopener noreferrer" aria-label="เปิดลิงก์" className="p-1 text-gray-400 hover:text-orange-700">
                  <ExternalLink className="w-4 h-4" />
                </a>
                <button
                  type="button"
                  onClick={() => onChange(value.filter((_, j) => j !== i))}
                  aria-label="ลบลิงก์"
                  className="p-1 text-gray-400 hover:text-red-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {value.length < MAX_LINKS && (
        <div className="mt-3 grid sm:grid-cols-[1fr_12rem_auto] gap-2">
          <input
            data-testid="link-url"
            type="url"
            inputMode="url"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setError('');
            }}
            onKeyDown={onKey}
            placeholder="วางลิงก์ เช่น https://www.facebook.com/…"
            className={inputCls}
          />
          <input
            data-testid="link-title"
            value={title}
            maxLength={MAX_LINK_TITLE}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={onKey}
            placeholder="ชื่อสั้น ๆ (ไม่บังคับ)"
            className={inputCls}
          />
          <button
            type="button"
            data-testid="link-add"
            onClick={add}
            disabled={!url.trim()}
            className="inline-flex items-center justify-center gap-1 px-4 py-2.5 rounded-lg bg-orange-600 text-white text-sm font-medium hover:bg-orange-700 disabled:opacity-40"
          >
            <Plus className="w-4 h-4" /> เพิ่ม
          </button>
        </div>
      )}
      {error && <p className="mt-2 text-xs text-red-600" role="alert">{error}</p>}
      {hasDrive && (
        <p className="mt-2 flex items-start gap-1 text-xs text-gray-500">
          <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-orange-500" />
          ลิงก์ Google Drive ต้องตั้งแชร์เป็น &quot;ทุกคนที่มีลิงก์&quot; ไม่งั้นคนอื่นเปิดไม่ได้ · ถ้าต้นทางลบไฟล์/โพสต์ ลิงก์จะเสีย
          ไฟล์สำคัญควรอัปขึ้นระบบด้วย
        </p>
      )}
    </section>
  );
}
