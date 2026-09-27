// app/activity/[id]/HistorySection.tsx — ประวัติการแก้ไขของงานหนึ่งรายการ (server component)
import { History, Plus, SquarePen } from 'lucide-react';
import prisma from '@/app/lib/db';
import { parseChanges } from '@/app/lib/audit';
import type { FieldChange } from '@/app/lib/audit';

const fmt = (d: Date) =>
  new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short' }).format(d);

export default async function HistorySection({ activityId }: { activityId: number }) {
  const logs = await prisma.auditLog.findMany({
    where: { entityType: 'Activity', entityId: activityId },
    include: { user: { select: { firstName: true, lastName: true } } },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  if (logs.length === 0) return null;

  return (
    <section className="mt-6 bg-white rounded-2xl border border-orange-100 p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-800 mb-3">
        <History className="w-4 h-4 text-orange-600" /> ประวัติการแก้ไข
      </h2>
      <ol className="space-y-3">
        {logs.map((log) => {
          const changes = parseChanges(log.changes);
          const isCreate = log.action === 'CREATE';
          return (
            <li key={log.id} className="flex gap-3">
              <span
                className={`mt-0.5 flex w-6 h-6 shrink-0 rounded-full items-center justify-center ${
                  isCreate ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-600'
                }`}
              >
                {isCreate ? <Plus className="w-3.5 h-3.5" /> : <SquarePen className="w-3.5 h-3.5" />}
              </span>
              <div className="min-w-0">
                <p className="text-xs text-gray-700">
                  <span className="font-medium">
                    {log.user.firstName} {log.user.lastName}
                  </span>{' '}
                  {isCreate ? 'สร้างรายการนี้' : 'แก้ไขรายการนี้'}
                  <span className="text-gray-400"> · {fmt(log.createdAt)}</span>
                </p>
                {changes.length > 0 && (
                  <ul className="mt-1 space-y-0.5">
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
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function truncate(s: string, n = 60) {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}
