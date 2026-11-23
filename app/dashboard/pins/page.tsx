import prisma from '@/app/lib/db';
import { PUBLIC_PIN_SELECT, PIN_PRACTICES, PIN_KINDS } from '@/app/lib/funeralPins';
import PinsTable from './PinsTable';
export const metadata = { title: 'หมุดจากแขกในงาน' };
export default async function PinsPage() {
  const pins = await prisma.funeralPin.findMany({
    select: { ...PUBLIC_PIN_SELECT, hidden: true, contactName: true, contactPhone: true },
    orderBy: { createdAt: 'desc' },
  });
  return (
    <main className="p-4 sm:p-6">
      <h1 className="mb-5 text-xl font-semibold text-gray-900">หมุดจากแขกในงาน</h1>
      <PinsTable
        pins={pins.map((p) => ({
          ...p,
          createdAt: p.createdAt.toISOString(),
          practices: Array.isArray(p.practices) ? p.practices.filter((x): x is string => typeof x === 'string') : [],
        }))}
        labels={{ ...PIN_KINDS, ...PIN_PRACTICES }}
      />
    </main>
  );
}
