// app/dashboard/setting/categories/page.tsx — จัดการประเด็นงาน (admin/superadmin)
'use client';

import { useState, useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';
import {
  Tags,
  Plus,
  SquarePen,
  Check,
  X,
  Loader2,
  ImagePlus,
  Trash2,
  ChevronDown,
} from 'lucide-react';
import { prepareLogo } from '@/app/lib/logoImage';
import { categoryColor } from '@/app/lib/categoryColors';

interface CategoryItem {
  id: number;
  name: string;
  description: string | null;
  isActive: boolean;
  logo: string | null; // path ใต้ uploads/ → /api/files/{logo}
  _count: { activities: number };
  subCategories: SubItem[];
}

interface SubItem {
  id: number;
  name: string;
  logo: string | null;
  isActive: boolean;
  _count: { activities: number };
}

const inputCls =
  'w-full px-3 py-2 text-sm text-gray-900 bg-white border border-orange-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400 transition-all';

export default function CategoriesSettingPage() {
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [busyIds, setBusyIds] = useState<Set<number>>(new Set());
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [logoTarget, setLogoTarget] = useState<number | null>(null);
  const [logoBusy, setLogoBusy] = useState<number | null>(null);
  const [openSubs, setOpenSubs] = useState<number | null>(null);

  // ประเด็นย่อย: อัปเดตรายการในหมวดโดยไม่โหลดทั้งหน้าใหม่
  const putSub = (categoryId: number, sub: SubItem) =>
    setCategories((prev) =>
      prev.map((c) =>
        c.id !== categoryId
          ? c
          : {
              ...c,
              subCategories: c.subCategories.some((x) => x.id === sub.id)
                ? c.subCategories.map((x) => (x.id === sub.id ? sub : x))
                : [...c.subCategories, sub],
            }
      )
    );
  const subRequest = async (categoryId: number, url: string, method: string, body: object, msg: string) => {
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      putSub(categoryId, data.subCategory);
      toast.success(msg);
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ');
      return false;
    }
  };

  // โลโก้: ตัดขอบว่าง + ย่อเป็น WebP 256px ฝั่ง browser แล้วค่อยอัปโหลด (ดู lib/logoImage.ts)
  const uploadLogo = async (id: number, file: File) => {
    setLogoBusy(id);
    try {
      const prepared = await prepareLogo(file);
      const fd = new FormData();
      fd.set('logo', prepared);
      const res = await fetch(`/api/admin/categories/${id}/logo`, { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, ...data.category, subCategories: c.subCategories } : c)));
      toast.success(`บันทึกโลโก้แล้ว (${Math.max(1, Math.round(prepared.size / 1024))} KB)`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'อัปโหลดโลโก้ไม่สำเร็จ');
    } finally {
      setLogoBusy(null);
    }
  };

  const removeLogo = async (id: number) => {
    setLogoBusy(id);
    try {
      const res = await fetch(`/api/admin/categories/${id}/logo`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, ...data.category, subCategories: c.subCategories } : c)));
      toast.success('ลบโลโก้แล้ว — แผนที่กลับไปใช้หมุดสี');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'ลบโลโก้ไม่สำเร็จ');
    } finally {
      setLogoBusy(null);
    }
  };

  const load = async () => {
    try {
      const res = await fetch('/api/admin/categories');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCategories(data.categories);
    } catch {
      toast.error('โหลดประเด็นงานไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return toast.error('กรุณาระบุชื่อประเด็นงาน');
    setAdding(true);
    try {
      const res = await fetch('/api/admin/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, description: newDescription }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('เพิ่มประเด็นงานแล้ว');
      setNewName('');
      setNewDescription('');
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'เพิ่มไม่สำเร็จ');
    } finally {
      setAdding(false);
    }
  };

  const patch = async (id: number, body: object, successMsg: string) => {
    setBusyIds((prev) => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/admin/categories/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, ...data.category, subCategories: c.subCategories } : c)));
      toast.success(successMsg);
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ');
      return false;
    } finally {
      setBusyIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const startEdit = (c: CategoryItem) => {
    setEditingId(c.id);
    setEditName(c.name);
    setEditDescription(c.description ?? '');
  };

  const saveEdit = async () => {
    if (editingId === null) return;
    const ok = await patch(
      editingId,
      { name: editName, description: editDescription },
      'บันทึกการแก้ไขแล้ว'
    );
    if (ok) setEditingId(null);
  };

  const activeCount = categories.filter((c) => c.isActive).length;

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center gap-3 mb-1">
        <span className="flex w-10 h-10 rounded-xl bg-orange-50 border border-orange-100 items-center justify-center">
          <Tags className="w-5 h-5 text-orange-600" />
        </span>
        <div>
          <h1 className="text-xl font-bold text-gray-800">จัดการประเด็นงาน</h1>
          <p className="text-sm text-gray-500">
            เปิดใช้ {activeCount} จาก {categories.length} หมวด — หมวดที่ปิดจะไม่ขึ้นในฟอร์มบันทึกงาน
            แต่ข้อมูลเดิมยังอยู่ครบ · หมวดที่มีโลโก้ แผนที่จะแสดงโลโก้แทนหมุดสี
          </p>
        </div>
      </div>

      <input
        ref={logoInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          // อ่าน FileList ออกมาก่อนล้างค่า input (ไม่งั้นไฟล์หายเงียบ ๆ — ดูกับดักข้อ 2 ใน CLAUDE.md)
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file && logoTarget !== null) uploadLogo(logoTarget, file);
        }}
      />

      {/* เพิ่มหมวดใหม่ */}
      <form
        onSubmit={handleAdd}
        className="mt-6 bg-white rounded-2xl border border-orange-100 p-5"
      >
        <div className="grid sm:grid-cols-[1fr_1.4fr_auto] gap-3">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="ชื่อประเด็นงานใหม่"
            className={inputCls}
          />
          <input
            type="text"
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            placeholder="คำอธิบาย (ไม่บังคับ)"
            className={inputCls}
          />
          <button
            type="submit"
            disabled={adding}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-orange-600 text-white text-sm font-medium hover:bg-orange-700 disabled:opacity-60 transition-all"
          >
            {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            เพิ่ม
          </button>
        </div>
      </form>

      {/* รายการ */}
      <div className="mt-6 bg-white rounded-2xl border border-orange-100 divide-y divide-orange-50 overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-gray-400 text-sm">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
            กำลังโหลด...
          </div>
        ) : categories.length === 0 ? (
          <div className="p-10 text-center text-gray-400 text-sm">ยังไม่มีประเด็นงาน</div>
        ) : (
          categories.map((c) => {
            const busy = busyIds.has(c.id);
            const isEditing = editingId === c.id;
            return (
              <div key={c.id} className={`p-4 ${c.isActive ? '' : 'bg-gray-50/60'}`}>
                {isEditing ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className={`${inputCls} flex-1 min-w-[160px]`}
                    />
                    <input
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder="คำอธิบาย"
                      className={`${inputCls} flex-1 min-w-[160px]`}
                    />
                    <button
                      onClick={saveEdit}
                      disabled={busy}
                      className="p-2 rounded-lg bg-orange-100 text-orange-700 hover:bg-orange-200 transition-colors"
                      aria-label="บันทึก"
                    >
                      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
                      aria-label="ยกเลิก"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    {/* โลโก้: คลิกเพื่ออัปโหลด/เปลี่ยน — ไม่มีโลโก้แสดงจุดสีประจำหมวด (แบบเดียวกับหมุดบนแผนที่) */}
                    <button
                      type="button"
                      onClick={() => {
                        setLogoTarget(c.id);
                        logoInputRef.current?.click();
                      }}
                      disabled={logoBusy === c.id}
                      title={c.logo ? 'เปลี่ยนโลโก้' : 'เพิ่มโลโก้ (แสดงแทนหมุดสีบนแผนที่)'}
                      aria-label={c.logo ? `เปลี่ยนโลโก้ ${c.name}` : `เพิ่มโลโก้ ${c.name}`}
                      // มีโลโก้ = วงกลมขาวเปล่าแบบเดียวกับหมุดบนแผนที่ · ไม่มี = ขอบสีประจำหมวด (บอกว่าแผนที่ใช้สีนี้)
                      className={`group relative shrink-0 w-12 h-12 rounded-full bg-white flex items-center justify-center overflow-hidden transition-all ${
                        c.logo ? 'shadow-md hover:ring-2 hover:ring-orange-300' : 'border-2 hover:border-orange-400'
                      }`}
                      style={c.logo ? undefined : { borderColor: categoryColor(c.name) }}
                    >
                      {logoBusy === c.id ? (
                        <Loader2 className="w-4 h-4 animate-spin text-orange-600" />
                      ) : c.logo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={`/api/files/${c.logo}`} alt={`โลโก้ ${c.name}`} className="w-full h-full object-contain p-1" />
                      ) : (
                        <ImagePlus className="w-4 h-4 text-gray-300 group-hover:text-orange-500" />
                      )}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-medium ${c.isActive ? 'text-gray-800' : 'text-gray-400'}`}>
                        {c.name}
                      </p>
                      <p className="text-xs text-gray-400 truncate">
                        {c.description || '—'} · ใช้ใน {c._count.activities} งาน
                      </p>
                      <button
                        type="button"
                        onClick={() => setOpenSubs(openSubs === c.id ? null : c.id)}
                        aria-expanded={openSubs === c.id}
                        className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-orange-700 hover:text-orange-800"
                      >
                        ประเด็นย่อย ({c.subCategories.filter((x) => x.isActive).length})
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${openSubs === c.id ? 'rotate-180' : ''}`} />
                      </button>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {c.logo && (
                        <button
                          onClick={() => removeLogo(c.id)}
                          disabled={logoBusy === c.id}
                          className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          aria-label={`ลบโลโก้ ${c.name}`}
                          title="ลบโลโก้ (กลับไปใช้หมุดสี)"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => startEdit(c)}
                        className="p-2 rounded-lg text-gray-400 hover:text-orange-600 hover:bg-orange-50 transition-colors"
                        aria-label={`แก้ไข ${c.name}`}
                      >
                        <SquarePen className="w-4 h-4" />
                      </button>
                      {/* Toggle เปิด/ปิดหมวด */}
                      <button
                        onClick={() =>
                          patch(c.id, { isActive: !c.isActive }, c.isActive ? 'ปิดหมวดแล้ว' : 'เปิดหมวดแล้ว')
                        }
                        disabled={busy}
                        role="switch"
                        aria-checked={c.isActive}
                        aria-label={`เปิด/ปิด ${c.name}`}
                        className={`relative w-10 h-6 rounded-full transition-colors ${
                          c.isActive ? 'bg-orange-500' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${
                            c.isActive ? 'left-[18px]' : 'left-0.5'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                )}
                {openSubs === c.id && !isEditing && (
                  <SubCategoryPanel
                    category={c}
                    onAdd={(name) =>
                      subRequest(c.id, `/api/admin/categories/${c.id}/subcategories`, 'POST', { name }, 'เพิ่มประเด็นย่อยแล้ว')
                    }
                    onPatch={(subId, body, msg) =>
                      subRequest(c.id, `/api/admin/subcategories/${subId}`, 'PATCH', body, msg)
                    }
                    onLogo={async (subId, file) => {
                      // ตัดขอบว่าง + ย่อเป็น WebP 256px เหมือนโลโก้ประเด็นหลัก
                      try {
                        const fd = new FormData();
                        fd.set('logo', await prepareLogo(file));
                        const res = await fetch(`/api/admin/subcategories/${subId}/logo`, { method: 'POST', body: fd });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data.error);
                        putSub(c.id, data.subCategory);
                        toast.success('บันทึกโลโก้ประเด็นย่อยแล้ว');
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : 'อัปโหลดโลโก้ไม่สำเร็จ');
                      }
                    }}
                    onRemoveLogo={async (subId) => {
                      const res = await fetch(`/api/admin/subcategories/${subId}/logo`, { method: 'DELETE' });
                      const data = await res.json();
                      if (!res.ok) return toast.error(data.error || 'ลบโลโก้ไม่สำเร็จ');
                      putSub(c.id, data.subCategory);
                      toast.success('ลบโลโก้แล้ว — ใช้โลโก้/สีของประเด็นหลักแทน');
                    }}
                  />
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// รายการประเด็นย่อยของหมวด — เพิ่ม / แก้ชื่อ / เปิดปิด (ไม่มีลบ: ปิดแทน งานเดิมไม่เสีย)
function SubCategoryPanel({
  category,
  onAdd,
  onPatch,
  onLogo,
  onRemoveLogo,
}: {
  category: CategoryItem;
  onAdd: (name: string) => Promise<boolean>;
  onPatch: (id: number, body: object, msg: string) => Promise<boolean>;
  onLogo: (id: number, file: File) => Promise<void>;
  onRemoveLogo: (id: number) => Promise<unknown>;
}) {
  const logoRef = useRef<HTMLInputElement>(null);
  const [logoTarget, setLogoTarget] = useState<number | null>(null);
  const [logoBusy, setLogoBusy] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    if (await onAdd(name.trim())) setName('');
    setBusy(false);
  };

  return (
    <div className="mt-3 ml-[60px] rounded-xl bg-orange-50/60 border border-orange-100 p-3">
      <p className="text-[11px] text-gray-500 mb-2">
        ประเด็นย่อยของ “{category.name}” — ผู้บันทึกงานเลือกได้ในฟอร์ม และใช้กรองบนแผนที่/ตารางงาน ·
        คลิกวงกลมเพื่อใส่โลโก้เฉพาะประเด็นย่อย (แผนที่ใช้แทนโลโก้/สีของประเด็นหลัก)
      </p>
      <input
        ref={logoRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={async (e) => {
          // อ่าน FileList ก่อนล้างค่า input (กับดักข้อ 2 ใน CLAUDE.md)
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file || logoTarget === null) return;
          setLogoBusy(logoTarget);
          await onLogo(logoTarget, file);
          setLogoBusy(null);
        }}
      />
      {category.subCategories.length === 0 ? (
        <p className="text-xs text-gray-400 mb-2">ยังไม่มีประเด็นย่อย</p>
      ) : (
        <ul className="space-y-1 mb-2">
          {category.subCategories.map((sc) => (
            <li key={sc.id} className="flex items-center gap-2 bg-white rounded-lg border border-orange-100 px-2.5 py-1.5">
              {editId === sc.id ? (
                <>
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    autoFocus
                    aria-label="ชื่อประเด็นย่อย"
                    className="flex-1 min-w-0 text-xs px-2 py-1 border border-orange-200 rounded focus:outline-none focus:ring-1 focus:ring-orange-400"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      if (await onPatch(sc.id, { name: editName }, 'แก้ชื่อประเด็นย่อยแล้ว')) setEditId(null);
                    }}
                    className="p-1 rounded text-orange-700 hover:bg-orange-100"
                    aria-label="บันทึกชื่อ"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" onClick={() => setEditId(null)} className="p-1 rounded text-gray-400 hover:bg-gray-100" aria-label="ยกเลิก">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setLogoTarget(sc.id);
                      logoRef.current?.click();
                    }}
                    disabled={logoBusy === sc.id}
                    aria-label={sc.logo ? `เปลี่ยนโลโก้ ${sc.name}` : `เพิ่มโลโก้ ${sc.name}`}
                    title={sc.logo ? 'เปลี่ยนโลโก้' : 'เพิ่มโลโก้ประเด็นย่อย'}
                    className={`shrink-0 w-7 h-7 rounded-full bg-white flex items-center justify-center overflow-hidden ${
                      sc.logo ? 'shadow' : 'border border-dashed border-orange-300 hover:border-orange-500'
                    }`}
                  >
                    {logoBusy === sc.id ? (
                      <Loader2 className="w-3 h-3 animate-spin text-orange-600" />
                    ) : sc.logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`/api/files/${sc.logo}`} alt={`โลโก้ ${sc.name}`} className="w-full h-full object-contain p-0.5" />
                    ) : (
                      <ImagePlus className="w-3 h-3 text-orange-300" />
                    )}
                  </button>
                  <span className={`flex-1 min-w-0 truncate text-xs ${sc.isActive ? 'text-gray-800' : 'text-gray-400 line-through'}`}>
                    {sc.name}
                  </span>
                  {sc.logo && (
                    <button
                      type="button"
                      onClick={() => onRemoveLogo(sc.id)}
                      className="p-1 rounded text-gray-300 hover:text-red-500"
                      aria-label={`ลบโลโก้ ${sc.name}`}
                      title="ลบโลโก้"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <span className="text-[10px] text-gray-400 shrink-0">{sc._count.activities} งาน</span>
                  <button
                    type="button"
                    onClick={() => {
                      setEditId(sc.id);
                      setEditName(sc.name);
                    }}
                    className="p-1 rounded text-gray-400 hover:text-orange-600"
                    aria-label={`แก้ชื่อ ${sc.name}`}
                  >
                    <SquarePen className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={sc.isActive}
                    aria-label={`เปิด/ปิด ${sc.name}`}
                    onClick={() => onPatch(sc.id, { isActive: !sc.isActive }, sc.isActive ? 'ปิดประเด็นย่อยแล้ว' : 'เปิดประเด็นย่อยแล้ว')}
                    className={`relative w-8 h-5 rounded-full shrink-0 transition-colors ${sc.isActive ? 'bg-orange-500' : 'bg-gray-200'}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${sc.isActive ? 'left-[14px]' : 'left-0.5'}`} />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={add} className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="เพิ่มประเด็นย่อย เช่น งานศพปลอดเหล้า"
          aria-label={`เพิ่มประเด็นย่อยของ ${category.name}`}
          className="flex-1 min-w-0 text-xs px-2.5 py-1.5 bg-white border border-orange-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400"
        />
        <button
          type="submit"
          disabled={busy || !name.trim()}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-orange-600 text-white text-xs font-medium hover:bg-orange-700 disabled:opacity-50"
        >
          <Plus className="w-3.5 h-3.5" /> เพิ่ม
        </button>
      </form>
    </div>
  );
}
