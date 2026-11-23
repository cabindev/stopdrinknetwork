'use client';
// แผงข้างของหมุดครอบครัวบน /map — แบบเดียวกับแผงจังหวัดของเครือข่าย (ขวาบนจอใหญ่ · แผ่นล่างบนมือถือ)
// ข้อมูลเต็ม: รูปทั้งหมด (พรีวิวเต็มจอ) · งานจริงจัดแบบไหน ทุกข้อ · ค่าใช้จ่าย · เรื่องเล่าเต็ม · ผู้ปัก/แอดมินมีปุ่มแก้ไข
import Link from 'next/link';
import { MapPinHouse, Pencil, X } from 'lucide-react';
import ImageGallery from '@/app/components/ImageGallery';
import { PIN_PLACES, PIN_PRACTICES, PIN_QUESTIONS, PIN_RELATIONS, answerLabel, pinTitle, type PublicPin } from '@/app/lib/funeralPins';

export default function FamilyPinPanel({ pin, canEdit, onClose }: { pin: PublicPin; canEdit: boolean; onClose: () => void }) {
  const relation = pin.relation ? PIN_RELATIONS[pin.relation as keyof typeof PIN_RELATIONS] : null;
  const when = pin.funeralDate
    ? new Date(`${pin.funeralDate}T00:00:00Z`).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
    : pin.yearBE
      ? `ปี ${pin.yearBE}`
      : null;
  const noAlcohol = pin.answers.alcohol === 'none' || pin.practices.includes('no_alcohol');
  const rows = [
    pin.place ? { label: 'ตั้งศพ', value: PIN_PLACES[pin.place as keyof typeof PIN_PLACES] } : null,
    ...PIN_QUESTIONS.map((q) => {
      const v = answerLabel(q.key, pin.answers[q.key]);
      return v ? { label: q.short, value: v } : null;
    }),
  ].filter((r): r is { label: string; value: string } => !!r);
  const practices = pin.practices.map((x) => PIN_PRACTICES[x as keyof typeof PIN_PRACTICES] ?? x);
  const posted = new Date(pin.createdAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Bangkok' });

  return (
    <aside
      aria-label="รายละเอียดหมุดครอบครัว"
      className="absolute z-[1000] overflow-auto rounded-2xl border border-gray-200 bg-white shadow-xl max-sm:inset-x-2 max-sm:bottom-2 max-sm:max-h-[60%] sm:bottom-4 sm:right-4 sm:top-16 sm:w-[360px]"
    >
      <div className="sticky top-0 z-10 flex items-start justify-between gap-2 border-b border-gray-200 bg-white/95 p-4 backdrop-blur">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs text-gray-500">
            <MapPinHouse className="w-3.5 h-3.5" /> งานศพของครอบครัว{relation ? ` · จัดให้${relation}` : ''}
          </p>
          <h2 className="mt-0.5 text-lg font-bold leading-snug text-gray-900">{pinTitle(pin)}</h2>
          <p className="mt-0.5 text-xs text-gray-600">
            ต.{pin.district} อ.{pin.amphoe} จ.{pin.province}
            {when ? ` · ${when}` : ''}
          </p>
        </div>
        <button type="button" onClick={onClose} className="shrink-0 rounded-lg p-1.5 text-gray-500 hover:bg-gray-100" aria-label="ปิด">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-4 p-4">
        {noAlcohol && (
          <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">ไม่เลี้ยงเหล้า</span>
        )}

        {pin.photos.length > 0 && (
          <ImageGallery
            thumbClassName="h-40 w-full object-cover"
            images={pin.photos.map((id, i) => ({
              id,
              thumb: `/api/pin-files/${id}`,
              full: `/api/pin-files/${id}`,
              alt: `รูปงานที่ ${i + 1}`,
            }))}
          />
        )}

        {(pin.totalCost != null || pin.savedAmount != null) && (
          <div className="rounded-xl bg-gray-50 p-3">
            <p className="text-xs text-gray-500">{pin.totalCost != null ? 'ใช้จ่ายจริงทั้งงานประมาณ' : 'ประหยัดได้ประมาณ'}</p>
            <p className="text-xl font-bold tabular-nums text-gray-900">{(pin.totalCost ?? pin.savedAmount)!.toLocaleString('th-TH')} บาท</p>
          </div>
        )}

        {(rows.length > 0 || practices.length > 0) && (
          <section>
            <h3 className="text-sm font-semibold text-gray-900">งานจริงจัดแบบไหน</h3>
            <dl className="mt-1.5 divide-y divide-gray-100 text-sm">
              {rows.map((r) => (
                <div key={r.label} className="flex items-baseline justify-between gap-3 py-1.5">
                  <dt className="shrink-0 text-gray-500">{r.label}</dt>
                  <dd className="text-right text-gray-900">{r.value}</dd>
                </div>
              ))}
            </dl>
            {practices.length > 0 && <p className="mt-1.5 text-sm text-gray-900">{practices.join(' · ')}</p>}
          </section>
        )}

        {pin.story && (
          <section>
            <h3 className="text-sm font-semibold text-gray-900">เรื่องเล่าจากครอบครัว</h3>
            <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-gray-700">{pin.story}</p>
          </section>
        )}

        <p className="text-xs text-gray-500">ครอบครัวปักหมุดเอง · {posted}</p>

        <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-3">
          {canEdit && (
            <Link
              href={`/pin/${pin.id}/edit`}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-gray-900 px-4 text-sm font-medium text-white hover:bg-gray-700"
            >
              <Pencil className="w-4 h-4" /> แก้ไขหมุดนี้
            </Link>
          )}
          <Link
            href="/pin"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-gray-300 px-4 text-sm text-gray-900 hover:bg-gray-50"
          >
            <MapPinHouse className="w-4 h-4" /> ปักหมุดงานของบ้านคุณ
          </Link>
        </div>
      </div>
    </aside>
  );
}
