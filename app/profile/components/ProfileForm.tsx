'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { toast } from 'react-hot-toast';
import imageCompression from 'browser-image-compression';
import { User, Camera, Trash2, AlertCircle, Save } from 'lucide-react';

export interface ProfileInitial {
  firstName: string;
  lastName: string;
  email: string;
  image: string | null;
  phone: string | null;
  organization: string | null;
  position: string | null;
}

const inputCls =
  'w-full px-3 py-2.5 text-sm text-gray-900 bg-white border border-orange-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400 transition-all';
const labelCls = 'block text-gray-700 text-sm font-medium mb-1';

export default function ProfileForm({ initial }: { initial: ProfileInitial }) {
  const router = useRouter();
  const { update } = useSession();
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    firstName: initial.firstName,
    lastName: initial.lastName,
    phone: initial.phone ?? '',
    organization: initial.organization ?? '',
    position: initial.position ?? '',
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(initial.image);
  const [removeImage, setRemoveImage] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  // รูปโปรไฟล์ไม่ต้องใหญ่ — ย่อฝั่ง browser ก่อนอัปโหลด (รองรับ HEIC จาก iPhone)
  const pickImage = async (file: File) => {
    try {
      let f = file;
      if (/image\/hei[cf]/i.test(f.type) || /\.(heic|heif)$/i.test(f.name)) {
        const heic2any = (await import('heic2any')).default;
        const blob = (await heic2any({ blob: f, toType: 'image/jpeg', quality: 0.9 })) as Blob;
        f = new File([blob], f.name.replace(/\.(heic|heif)$/i, '.jpg'), { type: 'image/jpeg' });
      }
      if (f.size > 512 * 1024) {
        const compressed = await imageCompression(f, {
          maxSizeMB: 0.5,
          maxWidthOrHeight: 800,
          useWebWorker: true,
        });
        f = new File([compressed], f.name, { type: compressed.type });
      }
      setImageFile(f);
      setRemoveImage(false);
      setPreview(URL.createObjectURL(f));
    } catch {
      toast.error('เตรียมรูปไม่สำเร็จ ลองไฟล์อื่น');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.firstName.trim() || !form.lastName.trim())
      return setError('กรุณากรอกชื่อและนามสกุล');

    setSaving(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.set(k, v.trim()));
      if (imageFile) fd.set('image', imageFile);
      if (removeImage) fd.set('removeImage', '1');

      const res = await fetch('/api/profile', { method: 'PATCH', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'บันทึกไม่สำเร็จ');

      // อัปเดต session ให้ชื่อ/รูปบน Navbar เปลี่ยนตามทันที
      await update({
        firstName: data.user.firstName,
        lastName: data.user.lastName,
        image: data.user.image,
      });
      toast.success('บันทึกโปรไฟล์แล้ว');
      router.push('/profile');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ');
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* รูปโปรไฟล์ */}
      <section className="bg-white rounded-2xl border border-orange-100 p-6">
        <h2 className="text-base font-semibold text-gray-800 mb-4">รูปโปรไฟล์</h2>
        <div className="flex items-center gap-5">
          {preview && !removeImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt="รูปโปรไฟล์"
              className="w-24 h-24 rounded-full object-cover border-2 border-orange-100"
            />
          ) : (
            <span className="flex w-24 h-24 rounded-full bg-orange-50 border-2 border-orange-100 items-center justify-center">
              <User className="w-10 h-10 text-orange-300" />
            </span>
          )}

          <div className="space-y-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-orange-200 text-orange-700 text-sm font-medium hover:bg-orange-50 transition-colors"
            >
              <Camera className="w-4 h-4" /> เลือกรูปใหม่
            </button>
            {preview && !removeImage && (
              <button
                type="button"
                onClick={() => {
                  setRemoveImage(true);
                  setImageFile(null);
                }}
                className="ml-2 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors"
              >
                <Trash2 className="w-4 h-4" /> ลบรูป
              </button>
            )}
            <p className="text-xs text-gray-400">
              JPG, PNG, WebP, GIF หรือ HEIC จาก iPhone — ระบบย่อขนาดให้อัตโนมัติ
            </p>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.heic,.heif"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) pickImage(f);
            }}
          />
        </div>
      </section>

      {/* ข้อมูลส่วนตัว */}
      <section className="bg-white rounded-2xl border border-orange-100 p-6">
        <h2 className="text-base font-semibold text-gray-800 mb-4">ข้อมูลส่วนตัว</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls} htmlFor="firstName">
              ชื่อ <span className="text-red-500">*</span>
            </label>
            <input id="firstName" value={form.firstName} onChange={set('firstName')} className={inputCls} />
          </div>
          <div>
            <label className={labelCls} htmlFor="lastName">
              นามสกุล <span className="text-red-500">*</span>
            </label>
            <input id="lastName" value={form.lastName} onChange={set('lastName')} className={inputCls} />
          </div>
          <div>
            <label className={labelCls} htmlFor="phone">เบอร์ติดต่อ</label>
            <input
              id="phone"
              value={form.phone}
              onChange={set('phone')}
              placeholder="08x-xxx-xxxx"
              className={inputCls}
            />
            <p className="mt-1 text-xs text-gray-400">
              แสดงให้เพื่อนร่วมพื้นที่ติดต่อประสานงานได้
            </p>
          </div>
          <div>
            <label className={labelCls} htmlFor="position">ตำแหน่ง/บทบาท</label>
            <input
              id="position"
              value={form.position}
              onChange={set('position')}
              placeholder="เช่น ผู้ประสานงานจังหวัด"
              className={inputCls}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls} htmlFor="organization">หน่วยงาน/ประชาคมที่สังกัด</label>
            <input
              id="organization"
              value={form.organization}
              onChange={set('organization')}
              placeholder="เช่น ประชาคมงดเหล้าจังหวัดเชียงราย"
              className={inputCls}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>อีเมล</label>
            <input value={initial.email} disabled className={`${inputCls} bg-gray-50 text-gray-500`} />
            <p className="mt-1 text-xs text-gray-400">อีเมลใช้เข้าสู่ระบบ เปลี่ยนไม่ได้เอง</p>
          </div>
        </div>
      </section>

      {error && (
        <div className="flex items-center p-4 bg-red-50 rounded-lg border border-red-100">
          <AlertCircle size={18} className="text-red-500 flex-shrink-0" />
          <p className="ml-3 text-sm text-red-700">{error}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={saving}
        className={`w-full py-3 rounded-lg font-medium text-white transition-all ${
          saving ? 'bg-orange-400 cursor-not-allowed' : 'bg-orange-600 hover:bg-orange-700'
        }`}
      >
        <span className="inline-flex items-center gap-2">
          {saving ? (
            <span className="w-5 h-5 border-2 border-white/70 border-t-transparent rounded-full animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saving ? 'กำลังบันทึก...' : 'บันทึกโปรไฟล์'}
        </span>
      </button>
    </form>
  );
}
