'use client';

// ฟอร์มจัดหน้ากรณีศึกษา: เนื้อหา 3 ส่วน (แบบ "ทำตามได้") + ติ๊กไฟล์ที่เปิดเผย + เผยแพร่/บันทึกร่าง/ยกเลิก
// รูปเริ่มต้น "ไม่ติ๊ก" เสมอ — ต้องแน่ใจว่าได้รับอนุญาตจากคนในภาพ (โดยเฉพาะเด็ก) ก่อน
// ไฟล์นโยบาย/เอกสารเริ่มต้นติ๊ก (ครั้งแรก) — เป็นตัวกติกาที่คนอื่นดาวน์โหลดไปปรับใช้ได้
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { Globe, EyeOff, Save, ExternalLink, Loader2, FileText } from 'lucide-react';
import LinkKindIcon from '@/app/components/LinkKindIcon';
import { linkDisplayName } from '@/app/lib/activityLinks';

interface LinkItem {
  id: number;
  url: string;
  title: string | null;
  kind: string;
  isPublic: boolean;
}

interface FileItem {
  id: number;
  kind: string;
  fileName: string;
  caption: string | null;
  isCover: boolean;
  isPublic: boolean;
  group: string;
  isSurvey: boolean; // แบบสำรวจอาจมีข้อมูลผู้ตอบ — ครั้งแรกไม่ติ๊กให้ (เหมือนรูป)
  src: string;
}

const areaCls =
  'w-full px-3 py-2.5 text-sm text-gray-900 bg-white border border-orange-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400';

export default function PublishForm({
  activityId,
  isPublished,
  initial,
  files,
  links = [],
}: {
  activityId: number;
  isPublished: boolean;
  initial: { storyLead: string; storyProcess: string; storyLessons: string };
  files: FileItem[];
  links?: LinkItem[];
}) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const firstTime = !isPublished && !files.some((f) => f.isPublic);
  const [picked, setPicked] = useState<Set<number>>(
    new Set(files.filter((f) => (firstTime ? f.kind === 'DOCUMENT' && !f.isSurvey : f.isPublic)).map((f) => f.id))
  );
  // ลิงก์: ครั้งแรกติ๊กให้ทุกลิงก์ยกเว้น Google Drive (มักเป็นเอกสารภายใน) — ครั้งต่อไปตามที่เคยเลือก
  const firstLinks = !isPublished && !links.some((l) => l.isPublic);
  const [pickedLinks, setPickedLinks] = useState<Set<number>>(
    new Set(links.filter((l) => (firstLinks ? l.kind !== 'DRIVE' : l.isPublic)).map((l) => l.id))
  );
  const [busy, setBusy] = useState<string | null>(null);

  const save = async (publish: boolean, label: string) => {
    setBusy(label);
    try {
      const res = await fetch(`/api/activities/${activityId}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, publicAttachmentIds: [...picked], publicLinkIds: [...pickedLinks], publish }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      toast.success(d.message);
      // เผยแพร่/บันทึกร่าง → ไปดูหน้ากรณีศึกษา (ร่าง = โหมดตัวอย่างของแอดมิน) · ยกเลิกเผยแพร่ → กลับหน้างาน
      router.push(label === "unpublish" ? `/activity/${activityId}` : `/stories/${activityId}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ');
      setBusy(null);
    }
  };

  const groups = [...new Set(files.map((f) => f.group))];
  const sections = [
    ['storyLead', 'บริบทและที่มา', 'ปัญหาในพื้นที่ เช่น ค่าใช้จ่ายงานศพ การดื่มในงาน — ทำไมถึงเริ่มทำ (เติมจากรายละเอียดงานให้แล้ว แก้ได้)'],
    ['storyProcess', 'กระบวนการ (ทำอย่างไร)', 'ขั้นตอนที่ทำจริง เช่น 1) ประชุมผู้นำ 2) ร่างกติกา 3) ประชาคมหมู่บ้าน 4) ติดป้าย/ประกาศ'],
    ['storyLessons', 'ปัจจัยสำเร็จ / ข้อควรระวัง', 'อะไรทำให้สำเร็จ อุปสรรคที่เจอ และคำแนะนำสำหรับพื้นที่อื่นที่อยากทำตาม'],
  ] as const;

  return (
    <div className="space-y-6">
      <section className="bg-white rounded-2xl border border-orange-100 p-6 space-y-5">
        <h2 className="text-base font-semibold text-gray-800">เนื้อหาหน้ากรณีศึกษา</h2>
        {sections.map(([k, label, hint]) => (
          <div key={k}>
            <label className="block text-sm font-medium text-gray-700" htmlFor={k}>{label}</label>
            <p className="text-xs text-gray-400 mb-1.5">{hint}</p>
            <textarea
              id={k}
              rows={k === 'storyLead' ? 6 : 5}
              value={form[k]}
              onChange={(e) => setForm((p) => ({ ...p, [k]: e.target.value }))}
              className={areaCls}
            />
          </div>
        ))}
        <p className="text-xs text-gray-400">
          ตัวเลขผลลัพธ์ (หมู่บ้าน/ครัวเรือน/ประชากร/ผู้เข้าร่วม) ภาคี และรายละเอียดนโยบาย ดึงจากข้อมูลงานให้อัตโนมัติ
        </p>
      </section>

      <section className="bg-white rounded-2xl border border-orange-100 p-6">
        <h2 className="text-base font-semibold text-gray-800">รูปและไฟล์ที่เปิดเผย</h2>
        <p className="text-xs text-gray-400 mt-1 mb-4">
          ติ๊กเฉพาะรูปที่ได้รับอนุญาตจากคนในภาพแล้ว (ระวังรูปเด็ก/หน้าบุคคลชัด ๆ) · ไฟล์นโยบายคือกติกาที่คนอื่นดาวน์โหลดไปปรับใช้ได้
        </p>
        {files.length === 0 ? (
          <p className="text-sm text-gray-400">งานนี้ยังไม่มีไฟล์แนบ</p>
        ) : (
          groups.map((g) => (
            <div key={g} className="mb-4 last:mb-0">
              <p className="text-xs font-semibold text-gray-500 mb-2">{g}</p>
              <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {files
                  .filter((f) => f.group === g)
                  .map((f) => {
                    const on = picked.has(f.id);
                    return (
                      <li key={f.id}>
                        <label
                          className={`block rounded-xl border overflow-hidden cursor-pointer ${
                            on ? 'border-orange-500 ring-2 ring-orange-200' : 'border-orange-100'
                          }`}
                        >
                          {f.kind === 'IMAGE' ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={f.src} alt={f.caption || f.fileName} className={`w-full h-24 object-cover ${on ? '' : 'opacity-60'}`} />
                          ) : (
                            <div className="h-24 flex flex-col items-center justify-center gap-1 bg-orange-50/60 px-2">
                              <FileText className="w-6 h-6 text-orange-600" />
                              <span className="text-[11px] text-gray-600 text-center line-clamp-2">{f.fileName}</span>
                            </div>
                          )}
                          <span className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-gray-700">
                            <input
                              type="checkbox"
                              checked={on}
                              onChange={(e) =>
                                setPicked((prev) => {
                                  const next = new Set(prev);
                                  if (e.target.checked) next.add(f.id);
                                  else next.delete(f.id);
                                  return next;
                                })
                              }
                              aria-label={`เปิดเผย ${f.fileName}`}
                              className="accent-orange-600"
                            />
                            <span className="truncate">{on ? 'เปิดเผย' : 'ไม่เปิดเผย'}{f.isCover ? ' · ปก' : ''}</span>
                          </span>
                        </label>
                      </li>
                    );
                  })}
              </ul>
            </div>
          ))
        )}
      </section>

      {links.length > 0 && (
        <section className="bg-white rounded-2xl border border-orange-100 p-6" data-testid="publish-links">
          <h2 className="text-base font-semibold text-gray-800">ลิงก์ที่แสดงบนหน้าสาธารณะ</h2>
          <p className="text-xs text-gray-400 mt-1 mb-4">
            ลิงก์ Google Drive ไม่ติ๊กให้ตั้งต้น — ตรวจก่อนว่าไฟล์ตั้งแชร์สาธารณะและไม่มีข้อมูลส่วนตัว
          </p>
          <ul className="space-y-2">
            {links.map((l) => {
              const on = pickedLinks.has(l.id);
              return (
                <li key={l.id}>
                  <label className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 cursor-pointer ${on ? 'border-orange-500 bg-orange-50/60' : 'border-orange-100'}`}>
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={(e) =>
                        setPickedLinks((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(l.id);
                          else next.delete(l.id);
                          return next;
                        })
                      }
                      aria-label={`เปิดเผยลิงก์ ${linkDisplayName(l.url, l.title)}`}
                      className="accent-orange-600"
                    />
                    <span className="text-orange-600 shrink-0"><LinkKindIcon kind={l.kind} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm text-gray-800 truncate">{linkDisplayName(l.url, l.title)}</span>
                      <span className="block text-[11px] text-gray-400 truncate">{l.url}</span>
                    </span>
                    <a href={l.url} target="_blank" rel="noopener noreferrer" className="p-1 text-gray-400 hover:text-orange-700" aria-label="เปิดลิงก์">
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </label>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => save(true, 'publish')}
          disabled={!!busy}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-orange-600 text-white text-sm font-medium hover:bg-orange-700 disabled:opacity-60"
        >
          {busy === 'publish' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
          {isPublished ? 'บันทึกและเผยแพร่ต่อ' : 'เผยแพร่เป็นกรณีศึกษา'}
        </button>
        {isPublished ? (
          <>
            <a
              href={`/stories/${activityId}`}
              target="_blank"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-orange-200 text-sm text-orange-700 hover:bg-orange-50"
            >
              <ExternalLink className="w-4 h-4" /> ดูหน้าสาธารณะ
            </a>
            <button
              type="button"
              onClick={() => save(false, 'unpublish')}
              disabled={!!busy}
              className="ml-auto inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm text-red-600 hover:bg-red-50 disabled:opacity-60"
            >
              {busy === 'unpublish' ? <Loader2 className="w-4 h-4 animate-spin" /> : <EyeOff className="w-4 h-4" />}
              ยกเลิกเผยแพร่
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => save(false, 'draft')}
            disabled={!!busy}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-orange-200 text-sm text-orange-700 hover:bg-orange-50 disabled:opacity-60"
          >
            {busy === 'draft' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            บันทึกร่าง (ยังไม่เผยแพร่)
          </button>
        )}
      </div>
    </div>
  );
}
