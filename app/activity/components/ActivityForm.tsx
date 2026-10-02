'use client';

import LinksField from './LinksField';
import TeamField from './TeamField';
import type { TeamPerson } from './TeamField';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ClipboardList,
  MapPin,
  CalendarDays,
  Paperclip,
  ImagePlus,
  AlertCircle,
  X,
  Users,
  ChevronDown,
  Star,
  Undo2,
  ScrollText,
  ClipboardCheck,
  FileText,
  Plus,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import imageCompression from 'browser-image-compression';
import ThaiDateField from '@/app/components/ThaiDateField';
import { RegionData } from '@/app/types/region';
import LocationField from './LocationField';
import ExtraAreasField from './ExtraAreasField';
import type { ExtraAreaInput } from '@/app/lib/activityAreas';
import type { PinValue } from './LocationPicker';
import {
  MAX_IMAGES,
  PARTNER_OPTIONS,
  MAX_DESCRIPTION,
  DESCRIPTION_WARN_AT,
  DESCRIPTION_SUGGEST_FILE_AT,
  descriptionError,
  POLICY_LEVELS,
  POLICY_TYPES,
  AREA_SCOPES,
} from '@/app/lib/activityMeta';
import type { PolicyDetail } from '@/app/lib/activityMeta';

interface Category {
  id: number;
  name: string;
  subCategories: { id: number; name: string }[];
}

// รูปใหม่ที่ยังไม่อัปโหลด — key คงที่ (ใช้ชี้รูปปกได้แม้ลบรูปก่อนหน้าออก)
interface NewImage {
  key: string;
  file: File;
  url: string;
  caption: string;
}

// ข้อมูลตั้งต้นสำหรับโหมดแก้ไข (ส่งมาจากหน้า edit ที่เป็น server component)
export interface ActivityInitialData {
  id: number;
  title: string;
  categoryId: number;
  status: string;
  areaName: string | null;
  district: string;
  amphoe: string;
  province: string;
  zipcode: string | null;
  startDate: string | null; // YYYY-MM-DD
  endDate: string | null;
  description: string;
  pin: PinValue | null; // null = ใช้จุดกลางตำบล
  subCategoryId: number | null;
  participantCount: number | null;
  partners: string[];
  policyLevels: string[];
  policyDetails: Record<string, PolicyDetail>;
  hasSurvey: boolean;
  areaScope: string;
  coverageVillages: number | null;
  coverageHouseholds: number | null;
  coveragePopulation: number | null;
  startDatePrecision: string; // DAY | YEAR
  coordinatorName: string | null;
  coordinatorRole: string | null;
  coordinatorPhone: string | null;
  coordinatorLine: string | null;
  coordinatorConsent: boolean;
  links: { url: string; title: string | null }[]; // ลิงก์ที่เกี่ยวข้อง (เรียงตาม sortOrder)
  extraAreas: ExtraAreaInput[]; // พื้นที่ที่เกี่ยวข้อง (ActivityArea) — คัดลอกงานไม่พาไปด้วย
  ownerId: number; // ผู้เขียน (เจ้าของงาน)
  memberIds: number[]; // ทีมงานร่วม
  attachments: {
    id: number;
    kind: string;
    filePath: string;
    fileName: string;
    caption: string | null;
    isCover: boolean;
    policyLevel: string | null; // ไฟล์นโยบายระดับไหน (null = ไฟล์แนบทั่วไป)
    isSurvey: boolean; // ไฟล์แบบสำรวจ
    isPublic?: boolean; // เปิดเผยบนหน้ากรณีศึกษาแล้ว (ตั้งที่หน้าเผยแพร่)
  }[];
  isPublished?: boolean; // งานนี้เผยแพร่เป็นกรณีศึกษาแล้ว
}

const STATUS_OPTIONS = [
  { value: 'PLANNING', label: 'วางแผน' },
  { value: 'ACTIVE', label: 'กำลังดำเนินการ' },
  { value: 'COMPLETED', label: 'เสร็จสิ้น' },
];

const inputCls =
  'w-full px-3 py-2.5 text-sm text-gray-900 bg-white border border-orange-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400 transition-all';
const labelCls = 'block text-gray-700 text-sm font-medium mb-1';

export default function ActivityForm({
  initial,
  copy = false,
  people = [],
  currentUserId,
}: {
  initial?: ActivityInitialData;
  // คัดลอกงาน: ใช้ initial เป็นค่าตั้งต้นของ "งานใหม่" (POST) — หน้า new ล้างพื้นที่/ไฟล์/ช่องเฉพาะพื้นที่มาแล้ว
  copy?: boolean;
  people?: TeamPerson[]; // รายชื่อให้เลือกทีมงาน
  currentUserId: number; // งานใหม่ = ผู้เขียน
}) {
  const router = useRouter();
  const isEdit = !!initial && !copy;
  const [memberIds, setMemberIds] = useState<number[]>(initial?.memberIds ?? []);
  const [links, setLinks] = useState<{ url: string; title: string }[]>(
    (initial?.links ?? []).map((l) => ({ url: l.url, title: l.title ?? '' }))
  );
  // พื้นที่ที่เกี่ยวข้อง — ไม่คัดลอก (เหมือนพื้นที่หลัก/หมุด)
  const [extraAreas, setExtraAreas] = useState<ExtraAreaInput[]>(copy ? [] : initial?.extraAreas ?? []);
  const [categories, setCategories] = useState<Category[]>([]);
  const [location, setLocation] = useState<RegionData | null>(
    initial && !copy
      ? {
          district: initial.district,
          amphoe: initial.amphoe,
          province: initial.province,
          zipcode: initial.zipcode ?? '',
          district_code: 0,
          amphoe_code: 0,
          province_code: 0,
          zone: '',
        }
      : null
  );
  const [pin, setPin] = useState<PinValue | null>(copy ? null : initial?.pin ?? null);
  const [images, setImages] = useState<NewImage[]>([]);
  const [documents, setDocuments] = useState<File[]>([]);
  const [existingAttachments] = useState(copy ? [] : initial?.attachments ?? []);
  // ไฟล์นโยบายแยกออกจากรูป/เอกสารทั่วไป (ไม่นับเพดานรูปกิจกรรม)
  const existingImages = existingAttachments.filter((a) => a.kind === 'IMAGE' && !a.policyLevel && !a.isSurvey);
  const existingDocs = existingAttachments.filter((a) => a.kind === 'DOCUMENT' && !a.policyLevel && !a.isSurvey);
  const existingPolicy = existingAttachments.filter((a) => a.policyLevel);
  const existingSurvey = existingAttachments.filter((a) => a.isSurvey);
  // แบบสำรวจ: ติ๊กได้โดยไม่แนบไฟล์ · เลิกติ๊ก = ไฟล์แบบสำรวจเดิมถูกลบตอนบันทึก (เหมือนนโยบาย)
  const [hasSurvey, setHasSurvey] = useState(initial?.hasSurvey ?? false);
  const [surveyFiles, setSurveyFiles] = useState<File[]>([]);
  const surveyInputRef = useRef<HTMLInputElement>(null);
  const [policyLevels, setPolicyLevels] = useState<string[]>(initial?.policyLevels ?? []);
  const [policyDetails, setPolicyDetails] = useState<Record<string, PolicyDetail>>(initial?.policyDetails ?? {});
  const setPolicyDetail = (level: string, patch: PolicyDetail) =>
    setPolicyDetails((prev) => ({ ...prev, [level]: { ...prev[level], ...patch } }));
  const [areaScope, setAreaScope] = useState(initial?.areaScope ?? 'SUBDISTRICT');
  // วันเริ่มแบบรู้แค่ปี (ข้อมูลสำรวจ/งานเก่ามักรู้แค่ "เริ่มปี 2562")
  const [yearOnly, setYearOnly] = useState(initial?.startDatePrecision === 'YEAR');
  const [startYear, setStartYear] = useState(
    initial?.startDatePrecision === 'YEAR' && initial.startDate ? String(Number(initial.startDate.slice(0, 4)) + 543) : ''
  );
  const [policyFiles, setPolicyFiles] = useState<Record<string, File[]>>({});
  const policyInputRef = useRef<HTMLInputElement>(null);
  const [policyTarget, setPolicyTarget] = useState('');
  const allPolicyFiles = policyLevels.flatMap((l) => policyFiles[l] ?? []);
  const [removeIds, setRemoveIds] = useState<number[]>([]);
  const [existingCaptions, setExistingCaptions] = useState<Record<number, string>>(
    Object.fromEntries(existingImages.map((a) => [a.id, a.caption ?? '']))
  );
  // รูปปก: "existing:<id>" | "new:<key>" — ว่าง = ให้ server ใช้รูปแรก
  const [cover, setCover] = useState(() => {
    const c = existingImages.find((a) => a.isCover);
    return c ? `existing:${c.id}` : '';
  });
  const keptExistingImages = existingImages.filter((a) => !removeIds.includes(a.id));
  const imageSlots = MAX_IMAGES - keptExistingImages.length - images.length;
  const [extra, setExtra] = useState({
    subCategoryId: initial?.subCategoryId ? String(initial.subCategoryId) : '',
    participantCount: initial?.participantCount != null ? String(initial.participantCount) : '',
    partners: initial?.partners ?? [],
    coverageVillages: initial?.coverageVillages != null ? String(initial.coverageVillages) : '',
    coverageHouseholds: initial?.coverageHouseholds != null ? String(initial.coverageHouseholds) : '',
    coveragePopulation: initial?.coveragePopulation != null ? String(initial.coveragePopulation) : '',
    coordinatorName: initial?.coordinatorName ?? '',
    coordinatorRole: initial?.coordinatorRole ?? '',
    coordinatorPhone: initial?.coordinatorPhone ?? '',
    coordinatorLine: initial?.coordinatorLine ?? '',
    coordinatorConsent: initial?.coordinatorConsent ?? false,
  });
  const setX = (field: keyof typeof extra) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setExtra((prev) => ({ ...prev, [field]: e.target.value }));
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const [isCompressing, setIsCompressing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  // รูป HEIC/HEIF จาก iPhone — เบราว์เซอร์ส่วนใหญ่แสดงไม่ได้ จึงแปลงเป็น JPEG ก่อน
  const isHeic = (f: File) =>
    /image\/hei[cf]/i.test(f.type) || /\.(heic|heif)$/i.test(f.name);

  const toJpeg = async (f: File) => {
    const heic2any = (await import('heic2any')).default;
    const blob = (await heic2any({ blob: f, toType: 'image/jpeg', quality: 0.9 })) as Blob;
    return new File([blob], f.name.replace(/\.(heic|heif)$/i, '.jpg'), { type: 'image/jpeg' });
  };

  // บีบอัดรูปฝั่ง browser ก่อนเข้าคิวอัปโหลด — รูปมือถือ 5-10MB จะเหลือ ~1MB
  const slotsRef = useRef(imageSlots);
  slotsRef.current = imageSlots;
  const addImages = async (picked: File[]) => {
    if (picked.length === 0) return;
    const room = slotsRef.current;
    if (room <= 0) {
      toast.error(`แนบรูปได้ไม่เกิน ${MAX_IMAGES} รูปต่องาน — ลบรูปเดิมก่อนถ้าต้องการเปลี่ยน`);
      return;
    }
    const files = picked.slice(0, room);
    if (picked.length > room) toast(`เพิ่มได้อีก ${room} รูป (เพดาน ${MAX_IMAGES} รูป) — ข้ามรูปที่เกิน`, { icon: '🖼' });
    setIsCompressing(true);
    try {
      const processed: File[] = [];
      for (const original of files) {
        let f = original;
        if (isHeic(f)) {
          try {
            f = await toJpeg(f);
          } catch {
            toast.error(`แปลงรูป ${original.name} จาก HEIC ไม่สำเร็จ`);
            continue;
          }
        }
        if (f.size <= 1024 * 1024) {
          processed.push(f); // เล็กกว่า 1MB ใช้ไฟล์เดิม
          continue;
        }
        try {
          const compressed = await imageCompression(f, {
            maxSizeMB: 1,
            maxWidthOrHeight: 1920,
            useWebWorker: true,
          });
          processed.push(new File([compressed], f.name, { type: compressed.type }));
        } catch {
          processed.push(f); // บีบอัดไม่ได้ก็ส่งไฟล์เดิม ให้ server ตรวจขนาดเอง
        }
      }
      if (processed.length > 0)
        setImages((prev) => [
          ...prev,
          ...processed.map((file) => ({
            key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            file,
            url: URL.createObjectURL(file),
            caption: '',
          })),
        ]);
    } finally {
      setIsCompressing(false);
    }
  };

  // แยกไฟล์ที่ผู้ใช้ลากมาวาง/วางจากคลิปบอร์ด ว่าเป็นรูปหรือเอกสาร
  const addFiles = (files: File[]) => {
    const imgs = files.filter((f) => f.type.startsWith('image/') || isHeic(f));
    const docs = files.filter((f) => !imgs.includes(f));
    if (imgs.length > 0) addImages(imgs);
    if (docs.length > 0) setDocuments((prev) => [...prev, ...docs]);
  };

  const [form, setForm] = useState({
    title: initial?.title ?? '',
    categoryId: initial ? String(initial.categoryId) : '',
    status: initial?.status ?? 'ACTIVE',
    areaName: initial?.areaName ?? '',
    // งานที่รู้แค่ปี: ไม่ใส่ 1 ม.ค. ลงช่องวันที่ — เอาติ๊ก "รู้แค่ปี" ออกแล้วต้องเป็นค่าว่าง ไม่ใช่วันที่ปลอม
    startDate: initial?.startDatePrecision === 'YEAR' ? '' : initial?.startDate ?? '',
    endDate: initial?.endDate ?? '',
    description: initial?.description ?? '',
  });

  // วางรูปจากคลิปบอร์ดได้ทั้งฟอร์ม (เช่น แคปหน้าจอมาแปะ)
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = [...(e.clipboardData?.files ?? [])];
      if (files.length > 0) {
        e.preventDefault();
        addFiles(files);
        toast.success(`เพิ่มไฟล์จากคลิปบอร์ด ${files.length} ไฟล์`);
      }
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetch('/api/categories')
      .then((r) => r.json())
      .then((d) => setCategories(d.categories ?? []))
      .catch(() => setError('โหลดประเด็นงานไม่สำเร็จ กรุณารีเฟรชหน้า'));
  }, []);

  const selectedCategory = categories.find((c) => String(c.id) === form.categoryId);
  const descLength = form.description.trim().length;

  const set = (field: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.title.trim()) return setError('กรุณาระบุชื่อกิจกรรม/โครงการ');
    if (!form.categoryId) return setError('กรุณาเลือกประเด็นงาน');
    if (!location) return setError('กรุณาค้นหาและเลือกพื้นที่ดำเนินงาน');
    if (!form.description.trim()) return setError('กรุณาระบุรายละเอียดการดำเนินงาน');
    const descErr = descriptionError(form.description.trim());
    if (descErr) {
      document.getElementById('description')?.focus();
      return setError(descErr);
    }
    if (!yearOnly && form.startDate && form.endDate && form.endDate < form.startDate)
      return setError('วันสิ้นสุดต้องไม่มาก่อนวันเริ่มดำเนินการ');
    if (yearOnly && !startYear) return setError('กรุณาเลือกปีที่เริ่มดำเนินการ (หรือเอาติ๊ก "รู้แค่ปี" ออก)');

    if ((extra.coordinatorPhone.trim() || extra.coordinatorLine.trim()) && !extra.coordinatorConsent)
      return setError('กรุณายืนยันว่าผู้ประสานงานยินยอมให้บันทึกช่องทางติดต่อ');
    const imageFiles = images.map((i) => i.file);
    const sentSurvey = hasSurvey ? surveyFiles : [];
    const oversize = [...documents, ...imageFiles, ...allPolicyFiles, ...sentSurvey].find((f) => f.size > 20 * 1024 * 1024);
    if (oversize) return setError(`ไฟล์ "${oversize.name}" เกิน 20MB`);
    const totalSize = [...documents, ...imageFiles, ...allPolicyFiles, ...sentSurvey].reduce((sum, f) => sum + f.size, 0);
    if (totalSize > 60 * 1024 * 1024)
      return setError(
        `ไฟล์แนบรวมกัน ${Math.round(totalSize / 1024 / 1024)}MB เกินเพดาน 60MB — ลองลบบางไฟล์ออกหรือแยกบันทึกเป็นสองรายการ`
      );

    setIsLoading(true);
    try {
      const fd = new FormData();
      fd.set('title', form.title.trim());
      fd.set('categoryId', form.categoryId);
      fd.set('status', form.status);
      fd.set('areaName', form.areaName.trim());
      fd.set('district', location.district);
      fd.set('amphoe', location.amphoe);
      fd.set('province', location.province);
      fd.set('zipcode', String(location.zipcode ?? ''));
      if (pin) {
        fd.set('latitude', String(pin.lat));
        fd.set('longitude', String(pin.lng));
        fd.set('locationSource', pin.source);
      }
      fd.set('startDate', form.startDate);
      fd.set('endDate', form.endDate);
      fd.set('description', form.description.trim());
      documents.forEach((f) => fd.append('documents', f));
      images.forEach((img) => fd.append('images', img.file));
      fd.set('imageCaptions', JSON.stringify(images.map((img) => img.caption)));
      fd.set('existingCaptions', JSON.stringify(existingCaptions));
      if (cover.startsWith('new:')) {
        const idx = images.findIndex((img) => `new:${img.key}` === cover);
        if (idx >= 0) fd.set('cover', `new:${idx}`);
      } else if (cover) fd.set('cover', cover);
      fd.set('subCategoryId', extra.subCategoryId);
      fd.set('participantCount', extra.participantCount.trim());
      fd.set('partners', JSON.stringify(extra.partners));
      fd.set('policyLevels', JSON.stringify(policyLevels));
      fd.set('policyDetails', JSON.stringify(policyDetails));
      fd.set('areaScope', areaScope);
      fd.set('coverageVillages', extra.coverageVillages);
      fd.set('coverageHouseholds', extra.coverageHouseholds);
      fd.set('coveragePopulation', extra.coveragePopulation);
      fd.set('startDatePrecision', yearOnly ? 'YEAR' : 'DAY');
      if (yearOnly) fd.set('startYear', startYear);
      for (const level of policyLevels) {
        for (const f of policyFiles[level] ?? []) fd.append(`policy_${level}`, f);
      }
      fd.set('hasSurvey', String(hasSurvey));
      for (const f of sentSurvey) fd.append('survey', f);
      fd.set('coordinatorName', extra.coordinatorName);
      fd.set('coordinatorRole', extra.coordinatorRole);
      fd.set('coordinatorPhone', extra.coordinatorPhone);
      fd.set('coordinatorLine', extra.coordinatorLine);
      fd.set('coordinatorConsent', String(extra.coordinatorConsent));
      fd.set('memberIds', JSON.stringify(memberIds));
      fd.set('links', JSON.stringify(links));
      fd.set('extraAreas', JSON.stringify(extraAreas));
      if (isEdit) fd.set('removeAttachmentIds', JSON.stringify(removeIds));

      const res = await fetch(isEdit ? `/api/activities/${initial!.id}` : '/api/activities', {
        method: isEdit ? 'PATCH' : 'POST',
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'บันทึกไม่สำเร็จ');

      toast.success(isEdit ? 'บันทึกการแก้ไขแล้ว' : 'บันทึกการดำเนินงานสำเร็จ');
      router.push(`/activity/${data.activityId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ โปรดลองอีกครั้ง');
      setIsLoading(false);
    }
  };

  return (
    // ไม่ทำ fade-in: HTML จาก server ต้องมองเห็นทันที (เดิม opacity 0 จนกว่า JS โหลดเสร็จ = จอว่างบนเน็ตช้า)
    // fieldset ล็อกทุกช่องจนกว่า hydrate เสร็จ — พิมพ์ก่อนนั้น React จะล้างค่าช่อง controlled ทิ้ง ข้อความหายเงียบ ๆ
    <form onSubmit={handleSubmit} aria-busy={!hydrated}>
      <fieldset disabled={!hydrated} className="space-y-8 min-w-0 border-0 p-0 m-0 disabled:opacity-70">
      {/* ข้อมูลกิจกรรม */}
      <section className="bg-white rounded-2xl border border-orange-100 p-6">
        <h2 className="flex items-center gap-2 text-base font-semibold text-gray-800 mb-4">
          <ClipboardList className="w-5 h-5 text-orange-600" />
          ข้อมูลกิจกรรม
        </h2>
        <div className="space-y-4">
          <div>
            <label className={labelCls} htmlFor="title">
              ชื่อกิจกรรม/โครงการ <span className="text-red-500">*</span>
            </label>
            <input
              id="title"
              type="text"
              value={form.title}
              onChange={set('title')}
              placeholder="เช่น ชุมชนต้นแบบงดเหล้าเข้าพรรษา บ้านหนองบัว"
              className={inputCls}
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls} htmlFor="categoryId">
                ประเด็นงาน <span className="text-red-500">*</span>
              </label>
              <select
                id="categoryId"
                value={form.categoryId}
                onChange={(e) => {
                  set('categoryId')(e);
                  setExtra((prev) => ({ ...prev, subCategoryId: '' })); // ประเด็นย่อยเป็นของประเด็นเดิม
                }}
                className={inputCls}
              >
                <option value="">— เลือกประเด็นงาน —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls} htmlFor="status">สถานะ</label>
              <select id="status" value={form.status} onChange={set('status')} className={inputCls}>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* ประเด็นย่อย — ย่อส่วน สีจาง เยื้องใต้ช่องประเด็นงาน ให้เห็นว่าเป็นระดับรองของประเด็นที่เลือก */}
          {selectedCategory && selectedCategory.subCategories.length > 0 && (
            <div className="-mt-2 sm:w-1/2 sm:pr-2 flex items-center gap-2 pl-3">
              <span aria-hidden className="text-orange-300 text-sm leading-none">└</span>
              <label className="shrink-0 text-xs font-light text-gray-400" htmlFor="subCategoryId">
                ประเด็นย่อย
              </label>
              <select
                id="subCategoryId"
                value={extra.subCategoryId}
                onChange={setX('subCategoryId')}
                className="flex-1 min-w-0 px-2 py-1 text-xs font-light text-gray-600 bg-orange-50/40 border border-orange-100 rounded-md focus:outline-none focus:ring-1 focus:ring-orange-300 focus:border-orange-300"
              >
                <option value="">— ไม่ระบุ (ถ้ามี) —</option>
                {selectedCategory.subCategories.map((sc) => (
                  <option key={sc.id} value={sc.id}>{sc.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className={labelCls} htmlFor="description">
              รายละเอียดการดำเนินงาน <span className="text-red-500">*</span>
            </label>
            <textarea
              id="description"
              rows={4}
              value={form.description}
              onChange={set('description')}
              placeholder="แนวทาง กลุ่มเป้าหมาย ผลการดำเนินงาน ภาคีที่ร่วมงาน ฯลฯ"
              aria-describedby="description-count"
              aria-invalid={descLength > MAX_DESCRIPTION}
              className={`${inputCls} ${descLength > MAX_DESCRIPTION ? 'border-red-400 focus:ring-red-300' : ''}`}
            />
            <div className="mt-1 flex items-start justify-between gap-3 text-xs">
              <p className="text-gray-400">
                {descLength > MAX_DESCRIPTION ? (
                  <span className="text-red-600 font-medium">
                    เกินเพดาน {(descLength - MAX_DESCRIPTION).toLocaleString('th-TH')} ตัวอักษร — สรุปให้สั้นลง
                    แล้วแนบรายงานฉบับเต็มเป็นไฟล์
                  </span>
                ) : descLength > DESCRIPTION_SUGGEST_FILE_AT ? (
                  <span className="text-orange-700">
                    💡 ข้อความยาว — ถ้าเป็นรายงานฉบับเต็ม แนะนำแนบเป็นไฟล์ PDF/Word ในส่วน “ไฟล์แนบ”
                    แล้วเขียนสรุปสาระสำคัญไว้ที่นี่ให้อ่านง่าย
                  </span>
                ) : null}
              </p>
              <span
                id="description-count"
                aria-live="polite"
                className={`shrink-0 tabular-nums ${
                  descLength > MAX_DESCRIPTION
                    ? 'text-red-600 font-semibold'
                    : descLength > DESCRIPTION_WARN_AT
                      ? 'text-orange-600 font-medium'
                      : 'text-gray-400'
                }`}
              >
                {descLength.toLocaleString('th-TH')} / {MAX_DESCRIPTION.toLocaleString('th-TH')} ตัวอักษร
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* พื้นที่ดำเนินงาน */}
      <section className="bg-white rounded-2xl border border-orange-100 p-6">
        <h2 className="flex items-center gap-2 text-base font-semibold text-gray-800 mb-1">
          <MapPin className="w-5 h-5 text-orange-600" />
          พื้นที่ดำเนินงาน <span className="text-red-500 text-sm">*</span>
        </h2>
        <p className="text-xs text-gray-400 mb-4">
          ค้นหาครั้งเดียว ระบบเติมตำบล อำเภอ จังหวัด ภาค และปักหมุดให้ — ข้อมูลพื้นที่จึงสะกดตรงกันทั้งระบบ
          นำไปแสดงบนแผนที่และวิเคราะห์พื้นที่ทับซ้อนได้
        </p>
        <LocationField
          location={location}
          pin={pin}
          areaName={form.areaName}
          onLocation={setLocation}
          onPin={setPin}
          onAreaName={(v) => setForm((prev) => ({ ...prev, areaName: v }))}
        />
        {/* ขอบเขตงาน — นโยบายระดับอำเภอ/จังหวัดครอบคลุมเกินตำบลที่เลือก (ตำบลยังใช้เป็นจุดอ้างอิง/ภาค) */}
        {location && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs" role="radiogroup" aria-label="ขอบเขตงาน">
            <span className="text-gray-500 mr-1">ขอบเขตงาน:</span>
            {AREA_SCOPES.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={areaScope === value}
                onClick={() => setAreaScope(value)}
                className={`px-2.5 py-1 rounded-full border transition-colors ${
                  areaScope === value
                    ? 'bg-orange-600 border-orange-600 text-white'
                    : 'bg-white border-orange-200 text-gray-600 hover:bg-orange-50'
                }`}
              >
                {value === 'DISTRICT' ? `ทั้ง อ.${location.amphoe}` : value === 'PROVINCE' ? `ทั้ง จ.${location.province}` : label}
              </button>
            ))}
          </div>
        )}
        <ExtraAreasField value={extraAreas} onChange={setExtraAreas} />
      </section>

      {/* ทีมงานร่วม — งานเป็นงานทีม */}
      <TeamField people={people} ownerId={isEdit ? initial!.ownerId : currentUserId} value={memberIds} onChange={setMemberIds} />

      {/* ผลลัพธ์ + ภาคี + ผู้ประสานงาน — พับได้ ไม่บังคับ (ฟอร์มชั้น 2: เติมทีหลังได้) */}
      <details
        open={!!(initial?.participantCount || initial?.partners?.length || initial?.coordinatorName)}
        className="group bg-white rounded-2xl border border-orange-100 p-6 [&_summary::-webkit-details-marker]:hidden"
      >
        <summary className="flex items-center gap-2 cursor-pointer list-none">
          <Users className="w-5 h-5 text-orange-600" />
          <span className="text-base font-semibold text-gray-800">ผลลัพธ์ ภาคี และผู้ประสานงาน</span>
          <span className="text-xs text-gray-400">(ไม่บังคับ — เติมทีหลังได้)</span>
          <ChevronDown className="ml-auto w-4 h-4 text-gray-400 transition-transform group-open:rotate-180" />
        </summary>

        <div className="mt-5 space-y-5">
          <div className="grid sm:grid-cols-[180px_1fr] gap-4 items-start">
            <div>
              <label className={labelCls} htmlFor="participantCount">จำนวนผู้เข้าร่วม</label>
              <input
                id="participantCount"
                type="number"
                inputMode="numeric"
                min={0}
                value={extra.participantCount}
                onChange={setX('participantCount')}
                placeholder="เช่น 120"
                className={inputCls}
              />
            </div>
            <div>
              <p className={labelCls}>ภาคีที่ร่วมงาน</p>
              <div className="flex flex-wrap gap-1.5">
                {PARTNER_OPTIONS.map((p) => {
                  const on = extra.partners.includes(p);
                  return (
                    <button
                      key={p}
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        setExtra((prev) => ({
                          ...prev,
                          partners: on ? prev.partners.filter((x) => x !== p) : [...prev.partners, p],
                        }))
                      }
                      className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                        on
                          ? 'bg-orange-600 text-white border-orange-600'
                          : 'bg-white text-gray-600 border-orange-200 hover:bg-orange-50'
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div>
            <p className={labelCls}>
              ความครอบคลุมของพื้นที่ <span className="text-xs font-normal text-gray-400">(ถ้ามี)</span>
            </p>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  ['coverageVillages', 'หมู่บ้าน'],
                  ['coverageHouseholds', 'ครัวเรือน'],
                  ['coveragePopulation', 'ประชากร (คน)'],
                ] as const
              ).map(([k, label]) => (
                <label key={k} className="block">
                  <span className="block text-xs text-gray-500 mb-1">{label}</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={extra[k]}
                    onChange={setX(k)}
                    aria-label={`จำนวน${label}`}
                    className={inputCls}
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-orange-100">
            <p className="text-sm font-medium text-gray-700">ผู้ประสานงานในพื้นที่</p>
            <p className="text-xs text-gray-400 mb-3">
              คนในพื้นที่ที่ติดต่อต่อได้ เช่น ผู้ใหญ่บ้าน เจ้าอาวาส ผอ.รพ.สต. —
              <b className="font-medium text-gray-500"> เบอร์และ LINE เห็นเฉพาะแอดมิน</b> (และคุณในฐานะผู้บันทึก)
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              <input value={extra.coordinatorName} onChange={setX('coordinatorName')} placeholder="ชื่อ-นามสกุล" aria-label="ชื่อผู้ประสานงาน" className={inputCls} />
              <input value={extra.coordinatorRole} onChange={setX('coordinatorRole')} placeholder="บทบาท/ตำแหน่ง เช่น ผู้ใหญ่บ้าน" aria-label="บทบาทผู้ประสานงาน" className={inputCls} />
              <input value={extra.coordinatorPhone} onChange={setX('coordinatorPhone')} type="tel" inputMode="tel" placeholder="เบอร์โทร" aria-label="เบอร์ผู้ประสานงาน" className={inputCls} />
              <input value={extra.coordinatorLine} onChange={setX('coordinatorLine')} placeholder="LINE ID" aria-label="LINE ผู้ประสานงาน" className={inputCls} />
            </div>
            {(extra.coordinatorPhone || extra.coordinatorLine) && (
              <label className="mt-3 flex items-start gap-2 text-xs text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={extra.coordinatorConsent}
                  onChange={(e) => setExtra((prev) => ({ ...prev, coordinatorConsent: e.target.checked }))}
                  className="mt-0.5 accent-orange-600"
                />
                ผู้ประสานงานยินยอมให้บันทึกช่องทางติดต่อไว้ในระบบ เพื่อให้แอดมินเครือข่ายติดต่อประสานงาน
                <span className="text-red-500">*</span>
              </label>
            )}
          </div>
        </div>
      </details>

      {/* ช่วงเวลา */}
      <section className="bg-white rounded-2xl border border-orange-100 p-6">
        <h2 className="flex items-center gap-2 text-base font-semibold text-gray-800 mb-4">
          <CalendarDays className="w-5 h-5 text-orange-600" />
          ช่วงเวลาดำเนินงาน
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between gap-2">
              <label className={labelCls} htmlFor={yearOnly ? 'startYear' : 'startDate'}>วันเริ่มดำเนินการ</label>
              <label className="mb-1 flex items-center gap-1 text-xs text-gray-500 cursor-pointer">
                <input
                  type="checkbox"
                  checked={yearOnly}
                  onChange={(e) => setYearOnly(e.target.checked)}
                  className="w-3.5 h-3.5 accent-orange-600"
                />
                รู้แค่ปี
              </label>
            </div>
            {yearOnly ? (
              <select
                id="startYear"
                value={startYear}
                onChange={(e) => setStartYear(e.target.value)}
                className={inputCls}
              >
                <option value="">— เลือกปี พ.ศ. —</option>
                {Array.from({ length: 40 }, (_, i) => new Date().getFullYear() + 543 + 1 - i).map((y) => (
                  <option key={y} value={y}>ปี {y}</option>
                ))}
              </select>
            ) : (
              <ThaiDateField
                id="startDate"
                value={form.startDate}
                onChange={(v) => setForm((prev) => ({ ...prev, startDate: v }))}
              />
            )}
          </div>
          <div>
            <label className={labelCls} htmlFor="endDate">วันสิ้นสุด</label>
            <ThaiDateField
              id="endDate"
              value={form.endDate}
              onChange={(v) => setForm((prev) => ({ ...prev, endDate: v }))}
            />
            <p className="mt-1 text-xs text-gray-400">เว้นว่างไว้หากเป็นงานต่อเนื่องที่ยังดำเนินการอยู่</p>
          </div>
        </div>
      </section>

      {/* นโยบาย/ข้อตกลงที่เกิดจากงาน — หัวข้อ "มีนโยบายระดับ" + ช่องติ๊กแถวเดียว, ติ๊กแล้วแนบไฟล์ของระดับนั้น (ไม่บังคับ) */}
      <section className="bg-white rounded-2xl border border-orange-100 p-6">
        <h2 className="flex flex-wrap items-baseline gap-x-2 text-base font-semibold text-gray-800 mb-3">
          <ScrollText className="w-5 h-5 text-orange-600 self-center" />
          มีนโยบายระดับ
          <span className="text-xs font-normal text-gray-400">
            (ถ้ามี — ติ๊กได้หลายระดับ แล้วแนบไฟล์ PDF, Word หรือรูปถ่ายเอกสาร)
          </span>
        </h2>
        <input
          ref={policyInputRef}
          data-testid="policy-input"
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            // อ่าน FileList ออกมาก่อนล้างค่า input (กับดักข้อ 2 ใน CLAUDE.md)
            const files = Array.from(e.target.files ?? []);
            e.target.value = '';
            if (files.length > 0 && policyTarget)
              setPolicyFiles((prev) => ({ ...prev, [policyTarget]: [...(prev[policyTarget] ?? []), ...files] }));
          }}
        />

        {/* ช่องติ๊ก 5 ระดับในแถวเดียว (จอเล็กตัดขึ้นบรรทัดใหม่เอง) */}
        <div className="flex flex-wrap gap-2" role="group" aria-label="มีนโยบายระดับ">
          {POLICY_LEVELS.map(({ value, label }) => {
            const on = policyLevels.includes(value);
            return (
              <label
                key={value}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm cursor-pointer select-none transition-colors ${
                  on
                    ? 'bg-orange-600 border-orange-600 text-white'
                    : 'bg-white border-orange-200 text-gray-700 hover:bg-orange-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={on}
                  onChange={(e) =>
                    setPolicyLevels((prev) =>
                      e.target.checked ? [...prev, value] : prev.filter((x) => x !== value)
                    )
                  }
                  aria-label={`มีนโยบายระดับ${label}`}
                  className="w-3.5 h-3.5 accent-white"
                />
                {label}
              </label>
            );
          })}
        </div>

        {/* ไฟล์ของระดับที่ติ๊ก — แถวละระดับ กะทัดรัด */}
        {(policyLevels.length > 0 || existingPolicy.some((a) => !policyLevels.includes(a.policyLevel!))) && (
          <ul className="mt-3 space-y-2">
            {POLICY_LEVELS.map(({ value, label }) => {
              const on = policyLevels.includes(value);
              const oldFiles = existingPolicy.filter((a) => a.policyLevel === value);
              const newFiles = policyFiles[value] ?? [];
              if (!on && oldFiles.length === 0) return null;
              if (!on)
                return (
                  <li key={value} className="text-xs text-red-500">
                    เลิกติ๊ก{label}แล้ว — ไฟล์เดิม {oldFiles.length} ไฟล์ของระดับนี้จะถูกลบเมื่อบันทึก
                  </li>
                );
              return (
                <li key={value} className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="w-16 shrink-0 font-medium text-gray-700">{label}</span>
                  <input
                    value={policyDetails[value]?.name ?? ''}
                    onChange={(e) => setPolicyDetail(value, { name: e.target.value })}
                    placeholder="ชื่อนโยบาย เช่น ธรรมนูญตำบลงานศพปลอดเหล้า"
                    aria-label={`ชื่อนโยบาย${label}`}
                    className="flex-1 min-w-[180px] px-2 py-1 border border-orange-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-orange-400"
                  />
                  <select
                    value={policyDetails[value]?.type ?? ''}
                    onChange={(e) => setPolicyDetail(value, { type: e.target.value || undefined })}
                    aria-label={`ประเภทนโยบาย${label}`}
                    className="px-2 py-1 border border-orange-200 rounded-lg text-xs text-gray-700 bg-white focus:outline-none focus:ring-1 focus:ring-orange-400"
                  >
                    <option value="">ประเภท</option>
                    {POLICY_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={policyDetails[value]?.year ?? ''}
                    onChange={(e) => setPolicyDetail(value, { year: e.target.value ? Number(e.target.value) : undefined })}
                    placeholder="ปี พ.ศ."
                    aria-label={`ปีที่ประกาศนโยบาย${label}`}
                    className="w-20 px-2 py-1 border border-orange-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-orange-400"
                  />
                  <span className="basis-full h-0 sm:hidden" />
                  {oldFiles.map((a) => {
                    const marked = removeIds.includes(a.id);
                    return (
                      <span
                        key={a.id}
                        className={`inline-flex items-center gap-1 max-w-[220px] px-2 py-1 rounded-lg border ${
                          marked ? 'bg-red-50 border-red-100 text-red-500 line-through' : 'bg-orange-50 border-orange-100 text-gray-700'
                        }`}
                      >
                        <span className="truncate">📜 {a.fileName}</span>
                        <button
                          type="button"
                          aria-label={marked ? 'เลิกลบไฟล์' : 'ลบไฟล์'}
                          onClick={() =>
                            setRemoveIds((prev) => (marked ? prev.filter((x) => x !== a.id) : [...prev, a.id]))
                          }
                        >
                          <X className={`w-3 h-3 ${marked ? 'text-red-400' : 'text-gray-400 hover:text-red-500'}`} />
                        </button>
                      </span>
                    );
                  })}
                  {newFiles.map((f, i) => (
                    <span
                      key={`${f.name}-${i}`}
                      className="inline-flex items-center gap-1 max-w-[220px] px-2 py-1 rounded-lg border bg-orange-50 border-orange-200 text-gray-700"
                    >
                      <span className="truncate">📜 {f.name}</span>
                      <span className="text-orange-600">(ใหม่)</span>
                      <button
                        type="button"
                        aria-label="ลบไฟล์"
                        onClick={() =>
                          setPolicyFiles((prev) => ({ ...prev, [value]: (prev[value] ?? []).filter((_, j) => j !== i) }))
                        }
                      >
                        <X className="w-3 h-3 text-gray-400 hover:text-red-500" />
                      </button>
                    </span>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setPolicyTarget(value);
                      policyInputRef.current?.click();
                    }}
                    aria-label={`แนบไฟล์นโยบาย${label}`}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-dashed border-orange-300 text-orange-700 hover:bg-orange-50"
                  >
                    <Paperclip className="w-3 h-3" /> แนบไฟล์
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* แบบสำรวจ — ติ๊ก "มีแบบสำรวจ" แล้วแนบไฟล์ได้ (ไม่บังคับ) */}
      <section className="bg-white rounded-2xl border border-orange-100 p-6">
        <h2 className="flex flex-wrap items-baseline gap-x-2 text-base font-semibold text-gray-800 mb-3">
          <ClipboardCheck className="w-5 h-5 text-orange-600 self-center" />
          แบบสำรวจ
          <span className="text-xs font-normal text-gray-400">(ถ้ามี — แนบไฟล์ PDF, Word, Excel หรือรูปถ่ายแบบสำรวจ)</span>
        </h2>
        <input
          ref={surveyInputRef}
          data-testid="survey-input"
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            // อ่าน FileList ออกมาก่อนล้างค่า input (กับดักข้อ 2 ใน CLAUDE.md)
            const files = Array.from(e.target.files ?? []);
            e.target.value = '';
            if (files.length > 0) setSurveyFiles((prev) => [...prev, ...files]);
          }}
        />
        <label
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm cursor-pointer select-none transition-colors ${
            hasSurvey
              ? 'bg-orange-600 border-orange-600 text-white'
              : 'bg-white border-orange-200 text-gray-700 hover:bg-orange-50'
          }`}
        >
          <input
            type="checkbox"
            checked={hasSurvey}
            onChange={(e) => setHasSurvey(e.target.checked)}
            className="w-3.5 h-3.5 accent-white"
          />
          มีแบบสำรวจ
        </label>
        {/* 1 แถว = 1 แบบสำรวจ · กด "+ เพิ่มแบบสำรวจ" ได้เรื่อย ๆ (เลือกทีละหลายไฟล์ก็ได้) */}
        {hasSurvey && (
          <div className="mt-3 space-y-1.5 text-xs" data-testid="survey-list">
            {existingSurvey.map((a, i) => {
              const marked = removeIds.includes(a.id);
              return (
                <div
                  key={a.id}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
                    marked ? 'bg-red-50 border-red-100 text-red-500' : 'bg-orange-50 border-orange-100 text-gray-700'
                  }`}
                >
                  <span className="shrink-0 w-5 text-gray-400 tabular-nums">{i + 1}.</span>
                  <FileText className="w-3.5 h-3.5 shrink-0 text-orange-600" />
                  <span className={`flex-1 truncate ${marked ? 'line-through' : ''}`}>{a.fileName}</span>
                  {marked && <span className="shrink-0">จะถูกลบ</span>}
                  <button
                    type="button"
                    aria-label={marked ? 'เลิกลบไฟล์' : 'ลบไฟล์'}
                    onClick={() => setRemoveIds((prev) => (marked ? prev.filter((x) => x !== a.id) : [...prev, a.id]))}
                    className="shrink-0 p-0.5"
                  >
                    {marked ? (
                      <Undo2 className="w-3.5 h-3.5 text-red-400" />
                    ) : (
                      <X className="w-3.5 h-3.5 text-gray-400 hover:text-red-500" />
                    )}
                  </button>
                </div>
              );
            })}
            {surveyFiles.map((f, i) => {
              const tooBig = f.size > 20 * 1024 * 1024;
              return (
                <div
                  key={`${f.name}-${i}`}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
                    tooBig ? 'bg-red-50 border-red-200' : 'bg-orange-50 border-orange-200'
                  } text-gray-700`}
                >
                  <span className="shrink-0 w-5 text-gray-400 tabular-nums">{existingSurvey.length + i + 1}.</span>
                  <FileText className="w-3.5 h-3.5 shrink-0 text-orange-600" />
                  <span className="flex-1 truncate">{f.name}</span>
                  <span className={`shrink-0 ${tooBig ? 'text-red-500' : 'text-orange-600'}`}>
                    {tooBig ? `${Math.round(f.size / 1024 / 1024)}MB เกิน 20MB` : 'ใหม่'}
                  </span>
                  <button
                    type="button"
                    aria-label="ลบไฟล์"
                    onClick={() => setSurveyFiles((prev) => prev.filter((_, j) => j !== i))}
                    className="shrink-0 p-0.5"
                  >
                    <X className="w-3.5 h-3.5 text-gray-400 hover:text-red-500" />
                  </button>
                </div>
              );
            })}
            <button
              type="button"
              onClick={() => surveyInputRef.current?.click()}
              aria-label="แนบไฟล์แบบสำรวจ"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-dashed border-orange-300 text-orange-700 hover:bg-orange-50"
            >
              <Plus className="w-3.5 h-3.5" />
              {existingSurvey.length + surveyFiles.length > 0 ? 'เพิ่มแบบสำรวจ' : 'แนบไฟล์แบบสำรวจ'}
            </button>
            {/* PDF จาก "พิมพ์ → บันทึกเป็น PDF" เก็บรูปแบบไม่บีบอัด (เคยเจอ Word 2MB กลายเป็น PDF 28MB) */}
            <p className={`text-[11px] leading-relaxed ${surveyFiles.some((f) => f.size > 20 * 1024 * 1024) ? 'text-red-500' : 'text-gray-400'}`}>
              ไฟล์ละไม่เกิน 20MB · แนบไฟล์ Word ได้เลย หรือถ้าจะทำ PDF จาก Word ให้ใช้ <b>File → Save As → PDF</b>
              (เลือกขนาดเล็ก/สำหรับออนไลน์) — อย่าใช้ “พิมพ์ → บันทึกเป็น PDF” ไฟล์จะใหญ่ขึ้นหลายเท่า
            </p>
          </div>
        )}
        {!hasSurvey && existingSurvey.length > 0 && (
          <p className="mt-2 text-xs text-red-500">
            เลิกติ๊กแล้ว — ไฟล์แบบสำรวจเดิม {existingSurvey.length} ไฟล์จะถูกลบเมื่อบันทึก
          </p>
        )}
      </section>

      {/* ไฟล์แนบ — ลากไฟล์มาวางได้ทั้งกรอบ */}
      <section
        onDragOver={(e) => {
          e.preventDefault();
          if (!dragOver) setDragOver(true);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const files = [...e.dataTransfer.files];
          if (files.length > 0) {
            addFiles(files);
            toast.success(`เพิ่มไฟล์ ${files.length} ไฟล์`);
          }
        }}
        className={`bg-white rounded-2xl border p-6 transition-colors ${
          dragOver ? 'border-orange-400 bg-orange-50/50' : 'border-orange-100'
        }`}
      >
        <h2 className="flex items-center gap-2 text-base font-semibold text-gray-800 mb-4">
          <Paperclip className="w-5 h-5 text-orange-600" />
          ไฟล์แนบ
        </h2>

        {/* ไฟล์แนบเดิม (โหมดแก้ไข) — กดกากบาทเพื่อทำเครื่องหมายลบ ลบจริงตอนบันทึก */}
        {existingDocs.length > 0 && (
          <div className="mb-4">
            <p className="text-xs text-gray-400 mb-2">เอกสารเดิม — กด × เพื่อลบออกเมื่อบันทึก</p>
            <ul className="space-y-1">
              {existingDocs.map((a) => {
                const marked = removeIds.includes(a.id);
                return (
                  <li
                    key={a.id}
                    className={`flex items-center justify-between gap-2 text-xs border rounded px-2 py-1.5 ${
                      marked
                        ? 'bg-red-50 border-red-100 text-red-500 line-through'
                        : 'bg-orange-50 border-orange-100 text-gray-700'
                    }`}
                  >
                    <span className="truncate">📄 {a.fileName}</span>
                    <button
                      type="button"
                      aria-label={marked ? 'เลิกลบไฟล์' : 'ลบไฟล์'}
                      onClick={() =>
                        setRemoveIds((prev) =>
                          marked ? prev.filter((x) => x !== a.id) : [...prev, a.id]
                        )
                      }
                    >
                      <X className={`w-3.5 h-3.5 ${marked ? 'text-red-400' : 'text-gray-400 hover:text-red-500'}`} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>เอกสาร/นโยบาย (PDF, Word, Excel, PowerPoint)</label>
            <button
              type="button"
              onClick={() => docInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-orange-200 rounded-lg text-sm text-orange-700 hover:bg-orange-50 transition-colors"
            >
              <Paperclip className="w-4 h-4" /> เลือกไฟล์เอกสาร
            </button>
            <input
              ref={docInputRef}
              data-testid="doc-input"
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
              className="hidden"
              onChange={(e) => {
                // ต้องอ่าน FileList ออกมาก่อนล้างค่า input — updater ของ setState ทำงานทีหลัง
                // ถ้าเคลียร์ก่อน ไฟล์จะหายไปทั้งหมด
                const files = Array.from(e.target.files ?? []);
                e.target.value = '';
                setDocuments((prev) => [...prev, ...files]);
              }}
            />
            {documents.length > 0 && (
              <ul className="mt-2 space-y-1">
                {documents.map((f, i) => (
                  <li key={i} className="flex items-center justify-between gap-2 text-xs bg-orange-50 border border-orange-100 rounded px-2 py-1.5">
                    <span className="truncate text-gray-700">{f.name}</span>
                    <button type="button" onClick={() => setDocuments((prev) => prev.filter((_, j) => j !== i))} aria-label="ลบไฟล์">
                      <X className="w-3.5 h-3.5 text-gray-400 hover:text-red-500" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <label className={labelCls}>
              รูปภาพกิจกรรม{' '}
              <span className="text-xs font-normal text-gray-400">
                ({keptExistingImages.length + images.length}/{MAX_IMAGES})
              </span>
            </label>
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              disabled={isCompressing || imageSlots <= 0}
              className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-orange-200 rounded-lg text-sm text-orange-700 hover:bg-orange-50 transition-colors disabled:opacity-60"
            >
              {isCompressing ? (
                <>
                  <span className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                  กำลังบีบอัดรูป...
                </>
              ) : imageSlots <= 0 ? (
                <>ครบ {MAX_IMAGES} รูปแล้ว</>
              ) : (
                <>
                  <ImagePlus className="w-4 h-4" /> เลือกรูปภาพ
                </>
              )}
            </button>
            <input
              ref={imageInputRef}
              data-testid="image-input"
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.heic,.heif"
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                e.target.value = '';
                addImages(files);
              }}
            />
          </div>
        </div>

        {/* รูปทั้งหมด (เดิม + ใหม่): กดดาว = รูปปก · ใส่คำบรรยายใต้รูปได้ */}
        {(existingImages.length > 0 || images.length > 0) && (
          <div className="mt-4">
            <p className="text-xs text-gray-400 mb-2">
              ⭐ = รูปปก (ใช้แสดงบนการ์ดและหน้าเผยแพร่) · ไม่เลือก ระบบใช้รูปแรก
            </p>
            {/* หน้ากรณีศึกษาใช้เฉพาะรูปที่เปิดเผย — ปกใหม่ที่ยังไม่เปิดเผยจะไม่ขึ้นบนหน้าสาธารณะ (เคยเกิดกับ #151) */}
            {isEdit && initial?.isPublished && cover &&
              (cover.startsWith('new:') || !existingImages.find((a) => `existing:${a.id}` === cover)?.isPublic) && (
                <p role="note" className="mb-2 text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
                  รูปปกที่เลือกยังไม่เปิดเผยบนหน้ากรณีศึกษา — บันทึกแล้วไปติ๊ก &quot;เปิดเผย&quot; ที่หน้าเผยแพร่ด้วย ไม่งั้นหน้าสาธารณะยังใช้รูปปกเดิม
                </p>
              )}
            <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {existingImages.map((a) => {
                const marked = removeIds.includes(a.id);
                const key = `existing:${a.id}`;
                return (
                  <ImageTile
                    key={key}
                    src={`/api/files/${a.filePath}?v=card`}
                    alt={a.fileName}
                    caption={existingCaptions[a.id] ?? ''}
                    onCaption={(v) => setExistingCaptions((prev) => ({ ...prev, [a.id]: v }))}
                    isCover={!marked && cover === key}
                    onCover={() => setCover(key)}
                    removed={marked}
                    onRemove={() =>
                      setRemoveIds((prev) => (marked ? prev.filter((x) => x !== a.id) : [...prev, a.id]))
                    }
                  />
                );
              })}
              {images.map((img) => {
                const key = `new:${img.key}`;
                return (
                  <ImageTile
                    key={key}
                    src={img.url}
                    alt={img.file.name}
                    caption={img.caption}
                    onCaption={(v) =>
                      setImages((prev) => prev.map((x) => (x.key === img.key ? { ...x, caption: v } : x)))
                    }
                    isCover={cover === key}
                    onCover={() => setCover(key)}
                    onRemove={() => {
                      URL.revokeObjectURL(img.url);
                      setImages((prev) => prev.filter((x) => x.key !== img.key));
                      if (cover === key) setCover('');
                    }}
                  />
                );
              })}
            </ul>
          </div>
        )}
        <p className="mt-3 text-xs text-gray-400">
          ลากไฟล์มาวางในกรอบนี้ หรือกด Ctrl+V เพื่อวางจากคลิปบอร์ดก็ได้ · ไฟล์ละไม่เกิน 20MB
          (รวมครั้งละไม่เกิน 60MB) · รูป HEIC จาก iPhone ระบบแปลงเป็น JPEG ให้อัตโนมัติ
        </p>
      </section>

      {/* ลิงก์ภายนอก — ต่อจากไฟล์แนบ */}
      <LinksField value={links} onChange={setLinks} />

      {error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center p-4 bg-red-50 rounded-lg border border-red-100"
        >
          <AlertCircle size={18} className="text-red-500 flex-shrink-0" />
          <p className="ml-3 text-sm text-red-700">{error}</p>
        </motion.div>
      )}

      <button
        type="submit"
        disabled={isLoading}
        className={`w-full py-3 rounded-lg font-medium text-white transition-all ${
          isLoading
            ? 'bg-orange-400 cursor-not-allowed'
            : 'bg-orange-600 hover:bg-orange-700 shadow-lg shadow-orange-600/20'
        }`}
      >
        {isLoading ? (
          <span className="flex items-center justify-center">
            <span className="w-5 h-5 border-2 border-white/70 border-t-transparent rounded-full animate-spin mr-2"></span>
            กำลังบันทึก...
          </span>
        ) : (
          isEdit ? 'บันทึกการแก้ไข' : 'บันทึกการดำเนินงาน'
        )}
      </button>
      </fieldset>
    </form>
  );
}

// การ์ดรูปในฟอร์ม: ดาว = รูปปก · ช่องคำบรรยาย · ลบ (รูปเดิม = ทำเครื่องหมายลบ กดซ้ำเพื่อยกเลิก)
function ImageTile({
  src,
  alt,
  caption,
  onCaption,
  isCover,
  onCover,
  removed = false,
  onRemove,
}: {
  src: string;
  alt: string;
  caption: string;
  onCaption: (v: string) => void;
  isCover: boolean;
  onCover: () => void;
  removed?: boolean;
  onRemove: () => void;
}) {
  return (
    <li className={`rounded-xl border overflow-hidden ${isCover ? 'border-orange-400 ring-2 ring-orange-200' : 'border-orange-100'}`}>
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className={`w-full h-28 object-cover ${removed ? 'opacity-30 grayscale' : ''}`} />
        {!removed && (
          <button
            type="button"
            onClick={onCover}
            aria-pressed={isCover}
            aria-label={isCover ? 'รูปปก' : 'ตั้งเป็นรูปปก'}
            title={isCover ? 'รูปปก' : 'ตั้งเป็นรูปปก'}
            className={`absolute top-1.5 left-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold shadow ${
              isCover ? 'bg-orange-600 text-white' : 'bg-white/90 text-gray-500 hover:text-orange-600'
            }`}
          >
            <Star className={`w-3 h-3 ${isCover ? 'fill-white' : ''}`} />
            {isCover && 'ปก'}
          </button>
        )}
        <button
          type="button"
          onClick={onRemove}
          aria-label={removed ? 'ยกเลิกการลบรูป' : 'ลบรูป'}
          className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-white/90 shadow flex items-center justify-center"
        >
          {removed ? <Undo2 className="w-3.5 h-3.5 text-gray-600" /> : <X className="w-3.5 h-3.5 text-gray-500" />}
        </button>
        {removed && (
          <span className="absolute inset-x-0 bottom-1 text-center text-[11px] font-medium text-red-600">
            จะถูกลบเมื่อบันทึก
          </span>
        )}
      </div>
      <input
        value={caption}
        onChange={(e) => onCaption(e.target.value)}
        disabled={removed}
        maxLength={200}
        placeholder="คำบรรยายรูป (ถ้ามี)"
        aria-label={`คำบรรยาย ${alt}`}
        className="w-full px-2 py-1.5 text-xs text-gray-700 border-t border-orange-100 focus:outline-none focus:bg-orange-50/50 disabled:bg-gray-50"
      />
    </li>
  );
}
