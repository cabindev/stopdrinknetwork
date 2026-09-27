// app/dashboard/setting/audit/page.tsx — ประวัติการเปลี่ยนแปลงทั้งระบบ (admin/superadmin)
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { History, Plus, SquarePen, Trash2, ExternalLink } from 'lucide-react';
import prisma from '@/app/lib/db';
import { getAdminUser } from '@/app/lib/adminAuth';
import { parseChanges } from '@/app/lib/audit';
import type { FieldChange } from '@/app/lib/audit';
import Pagination from '@/app/components/Pagination';

const PER_PAGE = 25;

const ACTION_META: Record<string, { text: string; cls: string; Icon: typeof Plus }> = {
  CREATE: { text: 'สร้าง', cls: 'bg-green-50 text-green-700', Icon: Plus },
  UPDATE: { text: 'แก้ไข', cls: 'bg-orange-50 text-orange-700', Icon: SquarePen },
  DELETE: { text: 'ลบ', cls: 'bg-red-50 text-red-600', Icon: Trash2 },
};

const fmt = (d: Date) =>
  new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short' }).format(d);

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; action?: string }>;
}) {
  const admin = await getAdminUser();
  if (!admin) redirect('/dashboard');

  const { page, action } = await searchParams;
  const actionFilter = action && ACTION_META[action] ? action : '';
  const where = actionFilter
    ? { action: actionFilter as 'CREATE' | 'UPDATE' | 'DELETE' }
    : {};

  const totalCount = await prisma.auditLog.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalCount / PER_PAGE));
  const currentPage = Math.min(Math.max(1, Number(page) || 1), totalPages);

  const logs = await prisma.auditLog.findMany({
    where,
    include: { user: { select: { firstName: true, lastName: true } } },
    orderBy: { createdAt: 'desc' },
    skip: (currentPage - 1) * PER_PAGE,
    take: PER_PAGE,
  });

  const tabCls = (active: boolean) =>
    `px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
      active ? 'bg-orange-600 text-white' : 'text-gray-600 hover:bg-orange-50'
    }`;

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center gap-3 mb-1">
        <span className="flex w-10 h-10 rounded-xl bg-orange-50 border border-orange-100 items-center justify-center">
          <History className="w-5 h-5 text-orange-600" />
        </span>
        <div>
          <h1 className="text-xl font-bold text-gray-800">ประวัติการเปลี่ยนแปลง</h1>
          <p className="text-sm text-gray-500">
            บันทึกทุกการสร้าง/แก้ไข/ลบข้อมูลการดำเนินงาน — ทั้งหมด {totalCount} รายการ
          </p>
        </div>
      </div>

      <div className="mt-5 flex items-center gap-1 bg-white border border-orange-100 rounded-xl p-1 w-fit">
        <Link href="/dashboard/setting/audit" className={tabCls(!actionFilter)}>
          ทั้งหมด
        </Link>
        {Object.entries(ACTION_META).map(([key, meta]) => (
          <Link
            key={key}
            href={`/dashboard/setting/audit?action=${key}`}
            className={tabCls(actionFilter === key)}
          >
            {meta.text}
          </Link>
        ))}
      </div>

      <div className="mt-4 bg-white rounded-2xl border border-orange-100 divide-y divide-orange-50">
        {logs.length === 0 ? (
          <p className="p-10 text-center text-sm text-gray-400">ยังไม่มีประวัติ</p>
        ) : (
          logs.map((log) => {
            const meta = ACTION_META[log.action] ?? ACTION_META.UPDATE;
            const changes = parseChanges(log.changes);
            return (
              <div key={log.id} className="p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${meta.cls}`}>
                    <meta.Icon className="w-3 h-3" />
                    {meta.text}
                  </span>
                  {log.action === 'DELETE' ? (
                    <span className="text-sm font-medium text-gray-500 line-through">
                      {log.entityName}
                    </span>
                  ) : (
                    <Link
                      href={`/activity/${log.entityId}`}
                      className="inline-flex items-center gap-1 text-sm font-medium text-gray-800 hover:text-orange-700"
                    >
                      {log.entityName}
                      <ExternalLink className="w-3 h-3 text-gray-300" />
                    </Link>
                  )}
                </div>
                <p className="mt-1 text-xs text-gray-400">
                  โดย {log.user.firstName} {log.user.lastName} · {fmt(log.createdAt)}
                </p>
                {changes.length > 0 && (
                  <ul className="mt-1.5 space-y-0.5">
                    {changes.map((c, i) => (
                      <li key={i} className="text-xs text-gray-500">
                        {typeof c === 'string' ? (
                          c
                        ) : (
                          <>
                            <span className="text-gray-600">{(c as FieldChange).label}:</span>{' '}
                            <span className="line-through text-gray-400">
                              {truncate((c as FieldChange).from)}
                            </span>{' '}
                            → <span className="text-gray-700">{truncate((c as FieldChange).to)}</span>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })
        )}
      </div>

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        basePath="/dashboard/setting/audit"
        extraParams={actionFilter ? { action: actionFilter } : {}}
      />
    </div>
  );
}

function truncate(s: string, n = 70) {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}
