'use client';
// app/farewell/components/AgreementList.tsx — ข้อตกลงงานศพปลอดเหล้าใกล้พื้นที่ของครอบครัว
// ข้อตกลงในพื้นที่ช่วยให้เจ้าภาพไม่ต้องรับแรงกดดันอยู่คนเดียว (บทเรียนจากพื้นที่ต้นแบบ)
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BookOpen, CheckCircle2, Landmark, Loader2 } from 'lucide-react';
import type { LocalAgreement } from '@/app/lib/farewellAgreements';
import type { PlanArea } from '../planStore';
import { trackOncePerTab } from '../track';

interface Result {
  key: string;
  agreements: LocalAgreement[] | null;
  error: boolean;
}

function covers(a: LocalAgreement) {
  const levels = a.policies.map((p) => p.level);
  return a.closeness === 'here' || (a.closeness === 'amphoe' && levels.includes('DISTRICT')) || levels.includes('PROVINCE');
}

function Item({ a, plain }: { a: LocalAgreement; plain: boolean }) {
  return (
    <li className={plain ? 'rounded-md border border-gray-200 bg-white p-4' : 'rounded-2xl border border-orange-100 bg-white p-4'}>
      <p className="text-xs text-gray-500">
        ต.{a.district} อ.{a.amphoe} จ.{a.province}
      </p>
      <p className="mt-1 text-sm font-medium text-gray-900">{a.title}</p>
      {a.policies.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {a.policies.map((p) => (
            <li
              key={p.level}
              className={
                plain
                  ? 'inline-flex items-center gap-1 rounded border border-gray-200 px-2 py-0.5 text-xs text-gray-700'
                  : 'inline-flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-1 text-xs text-gray-700'
              }
            >
              {!plain && <Landmark className="w-3 h-3 text-orange-600" />}
              ระดับ{p.levelLabel}
              {p.type && <span className="text-gray-500">· {p.type}</span>}
              {p.year && <span className="text-gray-500">· ปี {p.year}</span>}
            </li>
          ))}
        </ul>
      )}
      {a.policies.find((p) => p.name) && (
        <p className="mt-2 text-xs text-gray-600">{a.policies.find((p) => p.name)?.name}</p>
      )}
      {a.storyId && (
        <Link
          href={`/stories/${a.storyId}`}
          className={
            plain
              ? 'mt-3 inline-flex items-center min-h-10 text-sm font-medium text-gray-900 underline underline-offset-4 hover:text-gray-600'
              : 'mt-3 inline-flex items-center gap-1.5 min-h-10 text-sm font-medium text-orange-700 hover:text-orange-800'
          }
        >
          {!plain && <BookOpen className="w-4 h-4" />} อ่านเรื่องเล่าจากพื้นที่นี้
        </Link>
      )}
    </li>
  );
}

/** plain = แบบทางการ ขาว-ดำ ไม่มีไอคอน (หน้าวางแผน — ผู้ใช้ขอ 28 ต.ค. 2026)
 *  brief = แค่กล่องแจ้งผลสั้น ๆ ใต้ช่องตำบลในขั้นแรก (ผู้ใช้ขอ 28 ต.ค. 2026: รู้ทันทีที่เลือกตำบลว่าชุมชนมีมติแล้ว
 *          ให้ชาวบ้านเห็นแล้วอยากไปต่อ) — มีข้อตกลง = กล่องเขียวแสดงความยินดี · มีแค่พื้นที่ใกล้เคียง = กล่องเทาชวนเริ่ม
 *          · ไม่มีเลย = ไม่แสดงอะไร · onDetails = ปุ่มไปดูรายละเอียดเต็ม (ขั้นเหล้าเบียร์) */
export default function AgreementList({
  area,
  plain = false,
  brief = false,
  onDetails,
}: {
  area: PlanArea;
  plain?: boolean;
  brief?: boolean;
  onDetails?: () => void;
}) {
  const key = `${area.district}|${area.amphoe}|${area.province}`;
  const [result, setResult] = useState<Result | null>(null);

  // ผูกกับ key (ข้อความ) ไม่ใช่ object area — แผนถูกอ่านใหม่ทุกครั้งที่แก้ อ็อบเจกต์จึงเปลี่ยนตลอด จะยิงซ้ำโดยไม่จำเป็น
  useEffect(() => {
    const [district, amphoe, province] = key.split('|');
    const ctrl = new AbortController();
    const qs = new URLSearchParams({ district, amphoe, province });
    fetch(`/api/farewell/agreements?${qs}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { agreements: LocalAgreement[] }) => setResult({ key, agreements: d.agreements, error: false }))
      .catch(() => {
        if (!ctrl.signal.aborted) setResult({ key, agreements: null, error: true });
      });
    return () => ctrl.abort();
  }, [key]);

  // สถิติ: พบข้อตกลงหรือไม่ + จังหวัด (ไม่ส่งตำบล)
  useEffect(() => {
    if (!result || result.key !== key || !result.agreements) return;
    trackOncePerTab(`lookup:${key}`, 'LOCAL_LOOKUP', { province: key.split('|')[2], found: result.agreements.some(covers) });
  }, [result, key]);

  if (brief) return <Brief area={area} result={result?.key === key ? result : null} onDetails={onDetails} />;

  if (!result || result.key !== key) {
    return (
      <p className="flex items-center gap-2 text-sm text-gray-500">
        {!plain && <Loader2 className="w-4 h-4 animate-spin" />} กำลังค้นข้อตกลงในพื้นที่…
      </p>
    );
  }
  if (result.error || !result.agreements) {
    return <p className="text-sm text-gray-500">ยังโหลดข้อมูลข้อตกลงไม่ได้ ลองใหม่อีกครั้งภายหลัง</p>;
  }

  const list = result.agreements;
  const covering = list.filter(covers);
  const others = list.filter((a) => !covers(a));

  return (
    <div className="space-y-4">
      {covering.length > 0 ? (
        // สีเขียว = "มีแล้ว ปลอดภัยที่จะทำ" (ผู้ใช้ขอ ต.ค. 2026 — ข้อยกเว้นธีมส้ม-ขาว-ดำ ใช้เฉพาะสถานะพบข้อตกลง)
        <div className={`${plain ? 'rounded-md' : 'rounded-2xl'} border border-green-200 bg-green-50 p-4`}>
          <p className="flex items-start gap-2 text-sm font-semibold text-green-800">
            {!plain && <CheckCircle2 className="w-5 h-5 shrink-0 text-green-600" />}
            พื้นที่ของคุณมีข้อตกลงงานศพปลอดเหล้าแล้ว
          </p>
          <p className={`mt-1 ${plain ? '' : 'pl-7 '}text-sm text-gray-700`}>
            การจัดงานไม่เลี้ยงเหล้าจึงเป็นสิ่งที่ชุมชนตกลงร่วมกันไว้ ไม่ใช่การตัดสินใจของครอบครัวคุณเพียงลำพัง
          </p>
        </div>
      ) : (
        <p className="text-sm text-gray-700">
          ยังไม่พบข้อตกลงงานศพปลอดเหล้าที่ครอบคลุมตำบลของคุณในข้อมูลของเครือข่าย
          {list.length > 0 ? ' แต่มีพื้นที่ใกล้เคียงในจังหวัดเดียวกันที่ทำแล้ว' : ''}
        </p>
      )}

      {covering.length > 0 && (
        <ul className="space-y-2">
          {covering.map((a) => (
            <Item key={a.id} a={a} plain={plain} />
          ))}
        </ul>
      )}

      {others.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium text-gray-500">พื้นที่ใกล้เคียงในจังหวัด{area.province}</p>
          <ul className="space-y-2">
            {others.slice(0, 6).map((a) => (
              <Item key={a.id} a={a} plain={plain} />
            ))}
          </ul>
          {others.length > 6 && <p className="mt-2 text-xs text-gray-500">และอีก {others.length - 6} พื้นที่</p>}
        </div>
      )}

      <p className="text-xs text-gray-400">
        ข้อมูลจากงานที่เครือข่ายงดเหล้าบันทึกไว้ อาจยังไม่ครบทุกพื้นที่ สอบถามผู้นำชุมชนหรือวัดในพื้นที่เพิ่มเติมได้
      </p>
    </div>
  );
}

// ── กล่องแจ้งผลสั้น ๆ ใต้ช่องตำบล (โหมด brief) ──────────────────────────────────────────
function Brief({ area, result, onDetails }: { area: PlanArea; result: Result | null; onDetails?: () => void }) {
  if (!result) return <p className="mt-3 text-sm text-gray-500">กำลังตรวจสอบข้อตกลงในพื้นที่…</p>;
  if (result.error || !result.agreements) return null;

  const covering = result.agreements.filter(covers);
  const nearby = result.agreements.length - covering.length;
  const more = (label: string) =>
    onDetails && (
      <button
        type="button"
        onClick={onDetails}
        className="mt-3 text-sm font-medium text-gray-900 underline underline-offset-4 hover:text-gray-600"
      >
        {label}
      </button>
    );

  if (covering.length > 0) {
    // ระดับ/ปีของข้อตกลงที่ใกล้ที่สุด เช่น "ข้อตกลงระดับตำบล ปี 2562"
    const p = covering[0].policies[0];
    const detail = p ? `ข้อตกลงระดับ${p.levelLabel}${p.year ? ` ปี ${p.year}` : ''}` : 'ข้อตกลงร่วมกันของชุมชน';
    return (
      // สีเขียว = "มีแล้ว ปลอดภัยที่จะทำ" (ข้อยกเว้นธีม ใช้เฉพาะสถานะพบข้อตกลง เหมือนกล่องในขั้นเหล้าเบียร์)
      <div role="status" className="mt-3 rounded-md border border-green-200 bg-green-50 px-4 py-4">
        <p className="text-base font-semibold text-green-800">ยินดีด้วย ชุมชนของคุณมีข้อตกลงงานศพปลอดเหล้าแล้ว</p>
        <p className="mt-1 text-xs text-green-800">
          ต.{covering[0].district} อ.{covering[0].amphoe} จ.{covering[0].province} · {detail}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-gray-700">
          การจัดงานไม่เลี้ยงเหล้าจึงเป็นสิ่งที่ชุมชนตกลงร่วมกันไว้ ไม่ใช่การตัดสินใจของครอบครัวคุณเพียงลำพัง
        </p>
        {more('ดูรายละเอียดข้อตกลง')}
      </div>
    );
  }

  if (nearby > 0) {
    return (
      <div role="status" className="mt-3 rounded-md border border-gray-200 bg-gray-50 px-4 py-4">
        <p className="text-sm font-semibold text-gray-900">
          ในจังหวัด{area.province} มี {nearby.toLocaleString('th-TH')} ชุมชนที่จัดงานศพปลอดเหล้าแล้ว
        </p>
        <p className="mt-1 text-sm leading-relaxed text-gray-700">
          ตำบลของคุณยังไม่มีข้อตกลงในข้อมูลของเครือข่าย งานของครอบครัวคุณเป็นจุดเริ่มต้นให้ชุมชนได้ และมีตัวอย่างใกล้บ้านให้ดู
        </p>
        {more('ดูตัวอย่างพื้นที่ใกล้เคียง')}
      </div>
    );
  }
  return null;
}
