'use client';
import { useState } from 'react';
type Pin = {
  id: number;
  kind: string;
  displayName: string | null;
  district: string;
  amphoe: string;
  province: string;
  yearBE: number | null;
  practices: string[];
  savedAmount: number | null;
  story: string | null;
  contactName: string | null;
  contactPhone: string | null;
  createdAt: string;
  hidden: boolean;
};
export default function PinsTable({ pins: initial, labels }: { pins: Pin[]; labels: Record<string, string> }) {
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
      <table className="w-full min-w-[900px] text-left text-xs">
        <thead className="bg-gray-50 text-gray-600">
          <tr>
            {['ID', 'ใครจัด/ชื่อ', 'พื้นที่', 'ปี', 'สิ่งที่ทำ', 'ประหยัด', 'เรื่องเล่า', 'ผู้ติดต่อ/เบอร์', 'เวลา', 'สถานะ', 'จัดการ'].map((x, i) => (
              <th key={x} className={`px-3 py-3 font-medium ${i > 4 && i < 10 ? 'hidden sm:table-cell' : ''}`}>
                {x}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {pins.map((p) => (
            <tr key={p.id} className="align-top">
              <td className="px-3 py-3">{p.id}</td>
              <td className="px-3 py-3">
                {labels[p.kind] || p.kind}
                {p.displayName && <p className="mt-1 font-medium">{p.displayName}</p>}
              </td>
              <td className="px-3 py-3">
                ต.{p.district} อ.{p.amphoe} จ.{p.province}
              </td>
              <td className="hidden px-3 py-3 sm:table-cell">{p.yearBE || '—'}</td>
              <td className="hidden max-w-48 px-3 py-3 sm:table-cell">{p.practices.map((x) => labels[x] || x).join(' · ')}</td>
              <td className="hidden px-3 py-3 sm:table-cell">{p.savedAmount?.toLocaleString() || '—'}</td>
              <td className="hidden max-w-40 px-3 py-3 sm:table-cell">{p.story || '—'}</td>
              <td className="hidden px-3 py-3 sm:table-cell">
                {p.contactName || '—'}
                <br />
                {p.contactPhone}
              </td>
              <td className="hidden whitespace-nowrap px-3 py-3 sm:table-cell">
                {new Date(p.createdAt).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}
              </td>
              <td className="hidden px-3 py-3 sm:table-cell">{p.hidden ? 'ซ่อน' : 'แสดง'}</td>
              <td className="px-3 py-3">
                <div className="flex gap-2">
                  <button
                    onClick={() => patch(p.id, { hidden: !p.hidden })}
                    className="min-h-9 rounded-full border border-gray-300 px-3 hover:bg-gray-50"
                  >
                    {p.hidden ? 'แสดง' : 'ซ่อน'}
                  </button>
                  <button onClick={() => remove(p.id)} className="min-h-9 rounded-full border border-gray-300 px-3 hover:bg-gray-50">
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
