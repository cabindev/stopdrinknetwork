'use client';

// ปุ่มแชร์กรณีศึกษา — ลิงก์แชร์ของ Facebook/LINE (ไม่ต้องใช้ API key) + คัดลอกลิงก์
import { useEffect, useState } from 'react';
import { Link2, Check } from 'lucide-react';

export default function ShareButtons({ title }: { title: string }) {
  const [url, setUrl] = useState('');
  const [copied, setCopied] = useState(false);
  useEffect(() => setUrl(window.location.href), []);
  const u = encodeURIComponent(url);
  const btn = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors';
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-gray-500">แชร์:</span>
      <a href={`https://www.facebook.com/sharer/sharer.php?u=${u}`} target="_blank" rel="noopener noreferrer" className={`${btn} border-gray-200 text-gray-700 hover:bg-gray-50`}>
        Facebook
      </a>
      <a href={`https://social-plugins.line.me/lineit/share?url=${u}&text=${encodeURIComponent(title)}`} target="_blank" rel="noopener noreferrer" className={`${btn} border-gray-200 text-gray-700 hover:bg-gray-50`}>
        LINE
      </a>
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
        className={`${btn} border-orange-200 text-orange-700 hover:bg-orange-50`}
      >
        {copied ? <Check className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />}
        {copied ? 'คัดลอกแล้ว' : 'คัดลอกลิงก์'}
      </button>
    </div>
  );
}
