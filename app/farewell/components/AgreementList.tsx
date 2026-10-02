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

function Item({ a }: { a: LocalAgreement }) {
  return (
    <li className="rounded-2xl border border-orange-100 bg-white p-4">
      <p className="text-xs text-gray-500">
        ต.{a.district} อ.{a.amphoe} จ.{a.province}
      </p>
      <p className="mt-1 text-sm font-medium text-gray-900">{a.title}</p>
      {a.policies.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {a.policies.map((p) => (
            <li key={p.level} className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-1 text-xs text-gray-700">
              <Landmark className="w-3 h-3 text-orange-600" />
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
          className="mt-3 inline-flex items-center gap-1.5 min-h-10 text-sm font-medium text-orange-700 hover:text-orange-800"
        >
          <BookOpen className="w-4 h-4" /> อ่านเรื่องเล่าจากพื้นที่นี้
        </Link>
      )}
    </li>
  );
}

export default function AgreementList({ area }: { area: PlanArea }) {
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

  if (!result || result.key !== key) {
    return (
      <p className="flex items-center gap-2 text-sm text-gray-500">
        <Loader2 className="w-4 h-4 animate-spin" /> กำลังค้นข้อตกลงในพื้นที่…
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
        <div className="rounded-2xl border border-green-200 bg-green-50 p-4">
          <p className="flex items-start gap-2 text-sm font-semibold text-green-800">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-green-600" />
            พื้นที่ของคุณมีข้อตกลงงานศพปลอดเหล้าแล้ว
          </p>
          <p className="mt-1 pl-7 text-sm text-gray-700">
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
            <Item key={a.id} a={a} />
          ))}
        </ul>
      )}

      {others.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium text-gray-500">พื้นที่ใกล้เคียงในจังหวัด{area.province}</p>
          <ul className="space-y-2">
            {others.slice(0, 6).map((a) => (
              <Item key={a.id} a={a} />
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
