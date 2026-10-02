'use client';
// app/farewell/local/LocalLookup.tsx — เลือกตำบลแล้วดูข้อตกลงงานศพปลอดเหล้าในพื้นที่
// ถ้ามีแผนในเครื่องที่เลือกตำบลไว้แล้ว ใช้ตำบลนั้นเป็นค่าเริ่มต้น
import { useState } from 'react';
import AreaPicker from '../components/AreaPicker';
import AgreementList from '../components/AgreementList';
import { usePlan, type PlanArea } from '../planStore';

export default function LocalLookup() {
  const { plan } = usePlan();
  // undefined = ยังไม่ได้เลือกเองในหน้านี้ → ใช้ตำบลจากแผน
  const [picked, setPicked] = useState<PlanArea | null | undefined>(undefined);
  const area = picked === undefined ? (plan?.area ?? null) : picked;

  return (
    <div className="space-y-6">
      <AreaPicker value={area} onChange={setPicked} />
      {area && <AgreementList area={area} />}
    </div>
  );
}
