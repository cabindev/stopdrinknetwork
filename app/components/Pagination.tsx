// app/components/Pagination.tsx — แบ่งหน้าแบบ server component (ใช้ query string ?page=)
// ใช้ซ้ำได้ทุกหน้าที่มีรายการยาว
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  basePath: string; // เช่น '/activity'
  extraParams?: Record<string, string>; // query อื่นที่ต้องคงไว้ (ฟิลเตอร์ ฯลฯ)
}

// สร้างช่วงเลขหน้าแบบย่อ: 1 … 4 5 6 … 20
function pageWindow(current: number, total: number): (number | 'gap')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set<number>([1, total, current, current - 1, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out: (number | 'gap')[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push('gap');
    out.push(p);
  });
  return out;
}

export default function Pagination({
  currentPage,
  totalPages,
  basePath,
  extraParams = {},
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const hrefFor = (page: number) => {
    const params = new URLSearchParams(extraParams);
    if (page > 1) params.set('page', String(page));
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  const arrowCls =
    'inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-orange-200 text-sm text-orange-700 hover:bg-orange-50 transition-colors';
  const disabledCls =
    'inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-100 text-sm text-gray-300 cursor-not-allowed';

  return (
    <nav className="mt-6 flex items-center justify-center gap-1.5" aria-label="แบ่งหน้า">
      {currentPage > 1 ? (
        <Link href={hrefFor(currentPage - 1)} className={arrowCls} rel="prev">
          <ChevronLeft className="w-4 h-4" /> ก่อนหน้า
        </Link>
      ) : (
        <span className={disabledCls}>
          <ChevronLeft className="w-4 h-4" /> ก่อนหน้า
        </span>
      )}

      <div className="hidden sm:flex items-center gap-1 mx-1">
        {pageWindow(currentPage, totalPages).map((p, i) =>
          p === 'gap' ? (
            <span key={`gap-${i}`} className="px-1.5 text-sm text-gray-300">
              …
            </span>
          ) : (
            <Link
              key={p}
              href={hrefFor(p)}
              aria-current={p === currentPage ? 'page' : undefined}
              className={`min-w-[34px] text-center px-2 py-1.5 rounded-lg text-sm transition-colors ${
                p === currentPage
                  ? 'bg-orange-600 text-white font-medium'
                  : 'text-gray-600 hover:bg-orange-50 hover:text-orange-700'
              }`}
            >
              {p}
            </Link>
          )
        )}
      </div>

      <span className="sm:hidden px-2 text-sm text-gray-500">
        {currentPage} / {totalPages}
      </span>

      {currentPage < totalPages ? (
        <Link href={hrefFor(currentPage + 1)} className={arrowCls} rel="next">
          ถัดไป <ChevronRight className="w-4 h-4" />
        </Link>
      ) : (
        <span className={disabledCls}>
          ถัดไป <ChevronRight className="w-4 h-4" />
        </span>
      )}
    </nav>
  );
}
