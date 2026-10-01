'use client';
// อนุมัติแล้วแต่ cookie ยังเป็น pending → update() ให้ jwt callback อ่าน role ใหม่จาก DB แล้วไปหน้างาน
import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function RefreshSessionButton() {
  const { update } = useSession();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await update();
        router.push('/activity');
        router.refresh();
      }}
      className="mt-6 px-4 py-2.5 rounded-xl bg-orange-600 text-white text-sm font-medium hover:bg-orange-700 disabled:opacity-60"
    >
      {busy ? 'กำลังเข้าสู่ระบบ…' : 'ไปหน้างานของฉัน'}
    </button>
  );
}
