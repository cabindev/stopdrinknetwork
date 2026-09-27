'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { Trash2, Loader2 } from 'lucide-react';

export default function DeleteButton({ activityId }: { activityId: number }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/activities/${activityId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('ย้ายงานลงถังขยะแล้ว (แอดมินกู้คืนได้ภายใน 30 วัน)');
      router.push('/activity');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'ลบไม่สำเร็จ');
      setDeleting(false);
      setConfirming(false);
    }
  };

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-2">
        <span className="text-xs text-gray-500">ย้ายลงถังขยะ? (กู้คืนได้ 30 วัน)</span>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-medium hover:bg-red-700 transition-colors"
        >
          {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          ยืนยันลบ
        </button>
        <button
          onClick={() => setConfirming(false)}
          disabled={deleting}
          className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 transition-colors"
        >
          ยกเลิก
        </button>
      </span>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 text-red-600 text-xs font-medium hover:bg-red-50 transition-colors"
    >
      <Trash2 className="w-3.5 h-3.5" /> ลบงานนี้
    </button>
  );
}
