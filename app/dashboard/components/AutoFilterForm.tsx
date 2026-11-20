'use client';

// ฟอร์มตัวกรองแบบ "คลิกแล้วกรองเลย" (ผู้ใช้ขอ 11 พ.ย. 2026 — ไม่ต้องกดปุ่มค้นหา/กรอง)
// เลือก select = เปลี่ยน URL ทันที · พิมพ์ในช่องข้อความ = รอหยุดพิมพ์ 300ms · ลบจนว่าง/Enter = ทันที
// ยังเป็น GET params เหมือนเดิม (URL แชร์/บุ๊กมาร์กได้) · router.replace ไม่โหลดหน้าใหม่ทั้งหน้า ไม่เลื่อนจอ
// ผู้เรียกควรใส่ key = ค่าตัวกรอง (ยกเว้นช่องพิมพ์) ให้ select ตามทันเมื่อ URL เปลี่ยนจากลิงก์อื่น
import { useRef, useTransition } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Loader2, X } from 'lucide-react';

export default function AutoFilterForm({
  children,
  className,
  showClear,
  hideStatus,
}: {
  children: React.ReactNode;
  className?: string;
  showClear?: boolean; // มีตัวกรองอยู่ → แสดงปุ่ม "ล้างตัวกรอง"
  hideStatus?: boolean; // ไม่มีแถว "เลือกแล้วกรองทันที/ล้างตัวกรอง" (หน้านโยบาย — ผู้ใช้ขอให้เรียบ 20 พ.ย. 2026)
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const apply = (form: HTMLFormElement) => {
    if (timer.current) clearTimeout(timer.current);
    const params = new URLSearchParams();
    new FormData(form).forEach((v, k) => {
      if (typeof v === 'string' && v.trim()) params.set(k, v.trim());
    });
    const qs = params.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };

  const clear = () => {
    const form = formRef.current;
    if (!form) return;
    for (const el of Array.from(form.elements)) {
      if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement) el.value = '';
    }
    apply(form);
  };

  return (
    <form
      ref={formRef}
      method="get"
      aria-busy={pending}
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        apply(e.currentTarget);
      }}
      onChange={(e) => {
        const form = e.currentTarget;
        // data-resets="ชื่อช่อง ชื่อช่อง": เปลี่ยนค่านี้แล้วล้างช่องที่ขึ้นกับมัน (เช่น เปลี่ยนประเด็น → ล้างประเด็นย่อย,
        //   จังหวัด → ล้างอำเภอ ตำบล) · คั่นหลายช่องด้วยช่องว่าง
        const deps = e.target instanceof HTMLElement ? (e.target.dataset.resets ?? '').split(/\s+/).filter(Boolean) : [];
        for (const dep of deps) {
          const depField = form.elements.namedItem(dep);
          if (depField instanceof HTMLSelectElement || depField instanceof HTMLInputElement) depField.value = '';
        }
        if (e.target instanceof HTMLInputElement && e.target.type !== 'checkbox' && e.target.type !== 'radio') {
          if (timer.current) clearTimeout(timer.current);
          // ลบคำค้นจนว่าง = กรองทันที (ผลค้นหาหายเลย ไม่ต้องรอ/กดล้าง)
          if (!e.target.value.trim()) apply(form);
          else timer.current = setTimeout(() => apply(form), 300);
        } else apply(form);
      }}
    >
      {children}
      {!hideStatus && (
      <div className="flex min-h-8 items-center gap-3 text-xs">
        {pending ? (
          <span className="inline-flex items-center gap-1.5 text-gray-500" role="status">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> กำลังกรอง...
          </span>
        ) : (
          <span className="text-gray-400">เลือกแล้วกรองทันที</span>
        )}
        {showClear && (
          <button
            type="button"
            onClick={clear}
            className="inline-flex items-center gap-1 rounded-full border border-gray-300 px-2.5 py-1 text-gray-600 hover:bg-gray-50 hover:text-gray-900"
          >
            <X className="h-3.5 w-3.5" /> ล้างตัวกรอง
          </button>
        )}
      </div>
      )}
    </form>
  );
}
