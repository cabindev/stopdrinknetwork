'use client';

// ตารางรายชื่อเครือข่าย — เลือกรายชื่อเพื่อคัดลอก / ส่งออก Excel / พิมพ์ใบลงชื่อเข้าประชุม
import { useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import {
  Search,
  Copy,
  FileSpreadsheet,
  Printer,
  Phone,
  Mail,
  CheckSquare,
  Square,
} from 'lucide-react';

export interface PersonRow {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  organization: string | null;
  position: string | null;
  role: string;
  provinces: string[];
  zones: string[];
  activityCount: number;
}

const ROLE_LABEL: Record<string, string> = {
  member: 'เจ้าหน้าที่',
  admin: 'ผู้ดูแลระบบ',
  superadmin: 'ผู้ดูแลสูงสุด',
};

const inputCls =
  'px-3 py-2 text-sm text-gray-800 bg-white border border-orange-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400';

const esc = (v: unknown) =>
  String(v ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string
  );

export default function PeopleTable({ people }: { people: PersonRow[] }) {
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [onlyWithPhone, setOnlyWithPhone] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const filtered = useMemo(
    () =>
      people.filter((p) => {
        if (role && p.role !== role) return false;
        if (onlyWithPhone && !p.phone) return false;
        if (q) {
          const hay =
            `${p.firstName} ${p.lastName} ${p.email} ${p.organization ?? ''} ${p.position ?? ''}`.toLowerCase();
          if (!hay.includes(q.toLowerCase())) return false;
        }
        return true;
      }),
    [people, q, role, onlyWithPhone]
  );

  const selectedPeople = people.filter((p) => selected.has(p.id));
  const allFilteredSelected = filtered.length > 0 && filtered.every((p) => selected.has(p.id));

  const toggleAll = () => {
    const next = new Set(selected);
    if (allFilteredSelected) filtered.forEach((p) => next.delete(p.id));
    else filtered.forEach((p) => next.add(p.id));
    setSelected(next);
  };

  const toggleOne = (id: number) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const needSelection = () => {
    if (selectedPeople.length === 0) {
      toast.error('เลือกรายชื่อก่อนอย่างน้อย 1 คน');
      return true;
    }
    return false;
  };

  // คัดลอกเป็นข้อความ วางในไลน์/อีเมล/หนังสือเชิญได้เลย
  const copyList = async () => {
    if (needSelection()) return;
    const text = selectedPeople
      .map((p, i) => {
        const parts = [`${i + 1}. ${p.firstName} ${p.lastName}`];
        if (p.position || p.organization)
          parts.push(`   ${[p.position, p.organization].filter(Boolean).join(' · ')}`);
        parts.push(`   โทร ${p.phone ?? '-'} · ${p.email}`);
        return parts.join('\n');
      })
      .join('\n');
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`คัดลอกรายชื่อ ${selectedPeople.length} คนแล้ว`);
    } catch {
      toast.error('คัดลอกไม่สำเร็จ');
    }
  };

  const exportExcel = () => {
    if (needSelection()) return;
    window.location.href = `/api/admin/people/export?ids=${selectedPeople.map((p) => p.id).join(',')}`;
  };

  // ใบลงชื่อเข้าประชุม — เปิดหน้าต่างใหม่แล้วสั่งพิมพ์ (มีช่องลายเซ็น)
  const printSignSheet = () => {
    if (needSelection()) return;
    const today = new Intl.DateTimeFormat('th-TH', { dateStyle: 'long' }).format(new Date());
    const rows = selectedPeople
      .map(
        (p, i) => `<tr>
          <td class="c">${i + 1}</td>
          <td>${esc(`${p.firstName} ${p.lastName}`)}</td>
          <td>${esc([p.position, p.organization].filter(Boolean).join(' · '))}</td>
          <td class="c">${esc(p.phone ?? '')}</td>
          <td></td>
        </tr>`
      )
      .join('');
    const html = `<!doctype html><html lang="th"><head><meta charset="utf-8">
      <title>ใบลงชื่อเข้าประชุม</title>
      <style>
        body{font-family:"Segoe UI","Leelawadee UI",Tahoma,sans-serif;padding:28px;color:#1f2937}
        h1{font-size:18px;margin:0 0 4px}
        p.meta{font-size:12px;color:#6b7280;margin:0 0 18px}
        table{width:100%;border-collapse:collapse;font-size:13px}
        th,td{border:1px solid #d1d5db;padding:8px 10px;vertical-align:middle}
        th{background:#fff7ed;text-align:left;font-weight:600}
        td.c{text-align:center}
        tr{height:38px}
        @media print{@page{size:A4;margin:14mm}}
      </style></head><body>
      <h1>ใบลงชื่อเข้าประชุม — เครือข่ายงดเหล้า (Stop Drink Network)</h1>
      <p class="meta">วันที่ ${today} · จำนวน ${selectedPeople.length} คน · การประชุม ..................................................</p>
      <table>
        <thead><tr>
          <th style="width:44px" class="c">ลำดับ</th>
          <th style="width:26%">ชื่อ-นามสกุล</th>
          <th>ตำแหน่ง / หน่วยงาน</th>
          <th style="width:16%" class="c">เบอร์โทร</th>
          <th style="width:22%" class="c">ลายมือชื่อ</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      </body></html>`;
    const w = window.open('', '_blank');
    if (!w) return toast.error('เบราว์เซอร์บล็อกหน้าต่างใหม่ — อนุญาต pop-up ก่อน');
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  };

  return (
    <div>
      {/* ตัวกรอง */}
      <div className="bg-white rounded-2xl border border-orange-100 p-4">
        <div className="grid sm:grid-cols-[1fr_auto] gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ค้นหาชื่อ อีเมล ตำแหน่ง หรือหน่วยงาน..."
              className={`${inputCls} w-full pl-9`}
            />
          </div>
          <select value={role} onChange={(e) => setRole(e.target.value)} className={`${inputCls} sm:w-40`}>
            <option value="">ทุกบทบาท</option>
            {Object.entries(ROLE_LABEL).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
        <label className="mt-2 inline-flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={onlyWithPhone}
            onChange={(e) => setOnlyWithPhone(e.target.checked)}
            className="accent-orange-600"
          />
          เฉพาะคนที่มีเบอร์โทร
        </label>
      </div>

      {/* แถบเลือก + การกระทำ */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 bg-orange-50 border border-orange-100 rounded-xl px-4 py-2.5">
        <span className="text-sm text-gray-700">
          เลือกแล้ว <span className="font-bold text-orange-700">{selectedPeople.length}</span> คน
          <span className="text-gray-400"> · แสดง {filtered.length} จาก {people.length} คน</span>
          {selectedPeople.length > 0 && (
            <button
              onClick={() => setSelected(new Set())}
              className="ml-2 text-xs text-gray-500 hover:text-orange-700 underline"
            >
              ล้างที่เลือก
            </button>
          )}
        </span>
        <div className="flex flex-wrap gap-2">
          <button onClick={copyList} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-orange-200 bg-white text-orange-700 text-xs font-medium hover:bg-orange-50 transition-colors">
            <Copy className="w-4 h-4" /> คัดลอกรายชื่อ
          </button>
          <button onClick={exportExcel} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-orange-200 bg-white text-orange-700 text-xs font-medium hover:bg-orange-50 transition-colors">
            <FileSpreadsheet className="w-4 h-4" /> ส่งออก Excel
          </button>
          <button onClick={printSignSheet} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-orange-600 text-white text-xs font-medium hover:bg-orange-700 transition-colors">
            <Printer className="w-4 h-4" /> พิมพ์ใบลงชื่อ
          </button>
        </div>
      </div>

      {/* ตาราง */}
      <div className="mt-3 bg-white rounded-2xl border border-orange-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-orange-50/60 text-gray-600">
              <tr>
                <th className="px-3 py-3 w-10">
                  <button onClick={toggleAll} aria-label="เลือกทั้งหมด" className="text-orange-600">
                    {allFilteredSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4 text-gray-300" />}
                  </button>
                </th>
                <th className="text-left font-medium px-3 py-3">ชื่อ-นามสกุล</th>
                <th className="text-left font-medium px-3 py-3 whitespace-nowrap">ตำแหน่ง / หน่วยงาน</th>
                <th className="text-left font-medium px-3 py-3 whitespace-nowrap">เบอร์โทร</th>
                <th className="text-left font-medium px-3 py-3 whitespace-nowrap">อีเมล</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-orange-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-gray-400">
                    ไม่พบรายชื่อที่ตรงกับตัวกรอง
                  </td>
                </tr>
              ) : (
                filtered.map((p) => {
                  const isSel = selected.has(p.id);
                  return (
                    <tr
                      key={p.id}
                      onClick={() => toggleOne(p.id)}
                      className={`cursor-pointer ${isSel ? 'bg-orange-50/70' : 'hover:bg-orange-50/30'}`}
                    >
                      <td className="px-3 py-3">
                        {isSel ? (
                          <CheckSquare className="w-4 h-4 text-orange-600" />
                        ) : (
                          <Square className="w-4 h-4 text-gray-300" />
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <span className="font-medium text-gray-800">
                          {p.firstName} {p.lastName}
                        </span>
                        {p.role !== 'member' && (
                          <span className="ml-2 inline-flex px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 text-[10px]">
                            {ROLE_LABEL[p.role]}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-xs text-gray-600">
                        {[p.position, p.organization].filter(Boolean).join(' · ') || (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-xs whitespace-nowrap">
                        {p.phone ? (
                          <a
                            href={`tel:${p.phone}`}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-orange-700 hover:underline"
                          >
                            <Phone className="w-3 h-3" />
                            {p.phone}
                          </a>
                        ) : (
                          <span className="text-gray-300">ยังไม่กรอก</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-xs">
                        <a
                          href={`mailto:${p.email}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-gray-500 hover:text-orange-700"
                        >
                          <Mail className="w-3 h-3" />
                          {p.email}
                        </a>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
