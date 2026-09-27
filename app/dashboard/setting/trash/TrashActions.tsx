'use client';

// ปุ่มกู้คืน / ลบถาวร ในหน้าถังขยะ — ลบถาวรต้องกดยืนยันซ้ำ (ไม่ใช้ confirm() ของ browser)
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { RotateCcw, Trash2, Loader2 } from 'lucide-react';

export default function TrashActions({ id }: { id: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState<'restore' | 'purge' | null>(null);
  const [confirming, setConfirming] = useState(false);

  const run = async (kind: 'restore' | 'purge') => {
    setBusy(kind);
    try {
      const res = await fetch(`/api/admin/trash/${id}`, { method: kind === 'restore' ? 'POST' : 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(data.message);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'ทำรายการไม่สำเร็จ');
      setBusy(null);
    }
  };

  return (
    <div className="flex items-center justify-end gap-1.5">
      <button
        type="button"
        onClick={() => run('restore')}
        disabled={!!busy}
        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-orange-600 text-white text-xs font-medium hover:bg-orange-700 disabled:opacity-50"
      >
        {busy === 'restore' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />} กู้คืน
      </button>
      {confirming ? (
        <button
          type="button"
          onClick={() => run('purge')}
          onBlur={() => setConfirming(false)}
          disabled={!!busy}
          autoFocus
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-medium hover:bg-red-700 disabled:opacity-50"
        >
          {busy === 'purge' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} ยืนยันลบถาวร
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          disabled={!!busy}
          title="ลบถาวร (ไม่สามารถกู้คืนได้)"
          className="inline-flex p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-50"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
