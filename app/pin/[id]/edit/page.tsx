// app/pin/[id]/edit/page.tsx — ผู้ปักแก้ไข/ลบหมุดของตัวเอง (แอดมินแก้ได้ทุกหมุด)
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import prisma from '@/app/lib/db';
import { cleanAnswers } from '@/app/lib/funeralPins';
import { pinViewer } from '@/app/lib/funeralPinInput';
import PinForm from '../../PinForm';

export const metadata: Metadata = { title: 'แก้ไขหมุดงานศพปลอดเหล้า' };

export default async function EditPinPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const n = Number(id);
  const { userId, admin } = await pinViewer();
  if (!userId) redirect(`/auth/signin?callbackUrl=${encodeURIComponent(`/pin/${id}/edit`)}`);
  const pin =
    Number.isInteger(n) && n > 0
      ? await prisma.funeralPin.findUnique({
          where: { id: n },
          include: { files: { select: { id: true, kind: true, fileName: true }, orderBy: { id: 'asc' } } },
        })
      : null;
  if (!pin || (!admin && pin.userId !== userId)) notFound();

  return (
    <main className="min-h-screen bg-white px-4 pb-16 pt-20">
      <div className="mx-auto max-w-lg">
        <Link href="/pin" className="inline-flex min-h-10 items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-4 h-4" /> หมุดของฉัน
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-gray-900">แก้ไขหมุดงานศพปลอดเหล้า</h1>
        <PinForm
          initial={{
            id: pin.id,
            relation: pin.relation,
            deceasedFirstName: pin.deceasedFirstName,
            deceasedLastName: pin.deceasedLastName,
            showDeceasedName: pin.showDeceasedName,
            funeralDate: pin.funeralDate ? pin.funeralDate.toISOString().slice(0, 10) : null,
            area: { district: pin.district, amphoe: pin.amphoe, province: pin.province },
            place: pin.place,
            answers: cleanAnswers(pin.answers),
            totalCost: pin.totalCost,
            story: pin.story,
            files: pin.files.map((f) => ({ id: f.id, kind: f.kind === 'BILL' ? 'BILL' : 'PHOTO', fileName: f.fileName })),
          }}
        />
      </div>
    </main>
  );
}
