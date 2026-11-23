'use client';
import { useState } from 'react';
type Pin = {
  id: number;
  hidden: boolean;
  who: string;
  whoSub: string | null;
  relation: string | null;
  deceased: string | null;
  showName: boolean;
  area: string;
  when: string | null;
  summary: string;
  cost: number | null;
  story: string | null;
  photos: number[];
  bills: number[];
  createdAt: string;
};
export default function PinsTable({ pins: initial }: { pins: Pin[] }) {
  const [pins, setPins] = useState(initial);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [error, setError] = useState('');
  async function patch(id: number, data: object) {
    const r = await fetch(`/api/admin/pins/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!r.ok) {
      setError('บันทึกไม่สำเร็จ');
      return;
    }
    const p = await r.json();
    setPins((s) => s.map((x) => (x.id === id ? { ...x, ...p } : x)));
  }
  async function remove(id: number) {
    if (deleting !== id) {
      setDeleting(id);
      return;
    }
    const r = await fetch(`/api/admin/pins/${id}`, { method: 'DELETE' });
    if (!r.ok) {
      setError('ลบไม่สำเร็จ');
      return;
    }
    setPins((s) => s.filter((x) => x.id !== id));
    setDeleting(null);
  }
  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-200">
      {error && <p className="p-3 text-sm text-red-700">{error}</p>}
      <table className="w-full sm:min-w-[960px] text-left text-xs">
        <thead className="bg-gray-50 text-gray-600">
          <tr>
            {['ID', 'งาน', 'พื้นที่ / วันที่', 'จัดแบบไหน', 'ค่าใช้จ่าย', 'เรื่องเล่า / ไฟล์', 'ผู้ปัก', 'เวลาปัก', 'จัดการ'].map((x, i) => (
              <th key={x} className={`px-3 py-3 font-medium ${[3, 4, 5, 6, 7].includes(i) ? 'hidden sm:table-cell' : ''}`}>
                {x}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {pins.map((p) => (
            <tr key={p.id} className="align-top">
              <td className="px-3 py-3">
                {p.id}
                {p.hidden && <span className="mt-1 block rounded-full bg-gray-100 px-2 text-center text-gray-600">ซ่อน</span>}
              </td>
              <td className="px-3 py-3">
                <p className="font-medium text-gray-900">{p.deceased || '—'}</p>
                <p className="mt-0.5 text-gray-500">
                  {p.relation ? `จัดให้${p.relation}` : ''}
                  {p.deceased ? (p.showName ? ' · แสดงชื่อ' : ' · ไม่แสดงชื่อ') : ''}
                </p>
              </td>
              <td className="px-3 py-3">
                {p.area}
                {p.when && <p className="mt-0.5 text-gray-500">{p.when}</p>}
              </td>
              <td className="hidden max-w-56 px-3 py-3 sm:table-cell">{p.summary || '—'}</td>
              <td className="hidden whitespace-nowrap px-3 py-3 tabular-nums sm:table-cell">{p.cost != null ? p.cost.toLocaleString('th-TH') : '—'}</td>
              <td className="hidden max-w-48 px-3 py-3 sm:table-cell">
                {p.story || '—'}
                {(p.photos.length > 0 || p.bills.length > 0) && (
                  <p className="mt-1.5 flex flex-wrap gap-x-2 gap-y-1">
                    {p.photos.map((id, i) => (
                      <a key={id} href={`/api/pin-files/${id}`} target="_blank" rel="noopener" className="text-gray-900 underline underline-offset-2">
                        รูป {i + 1}
                      </a>
                    ))}
                    {p.bills.map((id, i) => (
                      <a key={id} href={`/api/pin-files/${id}`} target="_blank" rel="noopener" className="text-gray-900 underline underline-offset-2">
                        บิล {i + 1}
                      </a>
                    ))}
                  </p>
                )}
              </td>
              <td className="hidden px-3 py-3 sm:table-cell">
                {p.who}
                {p.whoSub && <p className="mt-0.5 text-gray-500">{p.whoSub}</p>}
              </td>
              <td className="hidden whitespace-nowrap px-3 py-3 sm:table-cell">
                {new Date(p.createdAt).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'medium', timeStyle: 'short' })}
              </td>
              <td className="px-3 py-3">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => patch(p.id, { hidden: !p.hidden })}
                    className="min-h-9 rounded-full border border-gray-300 px-3 hover:bg-gray-50"
                  >
                    {p.hidden ? 'แสดง' : 'ซ่อน'}
                  </button>
                  <button type="button" onClick={() => remove(p.id)} className="min-h-9 rounded-full border border-gray-300 px-3 hover:bg-gray-50">
                    {deleting === p.id ? 'ยืนยันลบ' : 'ลบ'}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
