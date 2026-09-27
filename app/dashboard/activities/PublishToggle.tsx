'use client';

// สวิตช์เผยแพร่กรณีศึกษาในตารางแอดมิน — อัปเดตทันที (optimistic) ย้อนกลับถ้าบันทึกไม่สำเร็จ
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';

export default function PublishToggle({ activityId, initial }: { activityId: number; initial: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(initial);
  const [saving, setSaving] = useState(false);

  const handleToggle = async () => {
    const next = !on;
    setOn(next);
    setSaving(true);
    try {
      const res = await fetch(`/api/activities/${activityId}/publish`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publish: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(next ? 'เผยแพร่แล้ว' : 'ยกเลิกการเผยแพร่แล้ว');
      router.refresh();
    } catch (err) {
      setOn(!next);
      toast.error(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label="เผยแพร่เป็นกรณีศึกษา"
      title={on ? 'เผยแพร่อยู่ — กดเพื่อยกเลิก' : 'ยังไม่เผยแพร่ — กดเพื่อเผยแพร่'}
      onClick={handleToggle}
      disabled={saving}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 disabled:opacity-60 ${
        on ? 'bg-orange-600' : 'bg-gray-200'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
          on ? 'translate-x-[18px]' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}
