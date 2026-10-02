// app/activity/[id]/edit/page.tsx — แก้ไขการดำเนินงาน (เจ้าของงานหรือ admin/superadmin)
import { getServerSession } from 'next-auth/next';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import authOptions from '@/app/lib/configs/auth/authOptions';
import prisma from '@/app/lib/db';
import ActivityForm from '../../components/ActivityForm';
import AuthorPicker from '../../components/AuthorPicker';
import { teamPeople } from '@/app/lib/activityAccess';
import { canEditActivity } from '@/app/lib/activityMeta';
import { toExtraAreaInput } from '@/app/lib/activityAreas';
import type { ActivityInitialData } from '../../components/ActivityForm';
import { parsePartners, policyShape, toThaiDateInput } from '@/app/lib/activityMeta';

const toDateInput = toThaiDateInput;

export default async function EditActivityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/auth/signin');

  const { id } = await params;
  const activityId = Number(id);
  if (Number.isNaN(activityId)) notFound();

  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
    include: {
      attachments: { orderBy: { id: 'asc' } },
      policies: true,
      links: { select: { url: true, title: true }, orderBy: { sortOrder: 'asc' } },
      areas: { orderBy: { sortOrder: 'asc' } },
      members: { select: { userId: true }, orderBy: { addedAt: 'asc' } },
    },
  });
  if (!activity) notFound();

  // ทีมงาน (ผู้เขียน + สมาชิกทีม) หรือแอดมิน
  const canEdit = canEditActivity(session.user.role, Number(session.user.id), activity);
  if (!canEdit) redirect(`/activity/${activity.id}`);

  // ช่องผู้เขียน (แบบ WordPress) — เฉพาะ superadmin
  const isSuper = session.user.role === 'superadmin';
  const authorName = (u: { firstName: string | null; lastName: string | null; email: string }) =>
    [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email;
  const authorUsers = isSuper
    ? (
        await prisma.user.findMany({
          select: { id: true, firstName: true, lastName: true, email: true, image: true },
          orderBy: [{ firstName: 'asc' }],
        })
      ).map((u) => ({ id: u.id, name: authorName(u), email: u.email, image: u.image }))
    : [];
  const currentAuthor = authorUsers.find((u) => u.id === activity.userId);

  const initial: ActivityInitialData = {
    id: activity.id,
    title: activity.title,
    categoryId: activity.categoryId,
    status: activity.status,
    areaName: activity.areaName,
    district: activity.district,
    amphoe: activity.amphoe,
    province: activity.province,
    zipcode: activity.zipcode,
    startDate: toDateInput(activity.startDate),
    endDate: toDateInput(activity.endDate),
    description: activity.description,
    pin:
      activity.locationSource !== 'TAMBON' && activity.latitude != null && activity.longitude != null
        ? { lat: activity.latitude, lng: activity.longitude, source: activity.locationSource }
        : null,
    attachments: activity.attachments.map((a) => ({
      id: a.id,
      kind: a.kind,
      filePath: a.filePath,
      fileName: a.fileName,
      caption: a.caption,
      isCover: a.isCover,
      policyLevel: a.policyLevel,
      isSurvey: a.isSurvey,
    })),
    hasSurvey: activity.hasSurvey,
    policyLevels: policyShape(activity.policies).levels,
    policyDetails: policyShape(activity.policies).details,
    areaScope: activity.areaScope,
    coverageVillages: activity.coverageVillages,
    coverageHouseholds: activity.coverageHouseholds,
    coveragePopulation: activity.coveragePopulation,
    startDatePrecision: activity.startDatePrecision,
    subCategoryId: activity.subCategoryId,
    participantCount: activity.participantCount,
    partners: parsePartners(activity.partners),
    coordinatorName: activity.coordinatorName,
    coordinatorRole: activity.coordinatorRole,
    // หน้านี้เปิดได้เฉพาะเจ้าของ/แอดมิน (canEdit ด้านบน) = กลุ่มที่เห็นเบอร์ได้อยู่แล้ว
    coordinatorPhone: activity.coordinatorPhone,
    coordinatorLine: activity.coordinatorLine,
    coordinatorConsent: activity.coordinatorConsent,
    links: activity.links,
    extraAreas: activity.areas.map(toExtraAreaInput),
    ownerId: activity.userId,
    memberIds: activity.members.map((m) => m.userId),
  };
  const people = await teamPeople();

  return (
    <main className="min-h-screen bg-white pt-20 pb-10 px-4">
      <div className="max-w-2xl mx-auto">
        <Link
          href={`/activity/${activity.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-orange-700 hover:text-orange-800 mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> กลับไปหน้ารายละเอียด
        </Link>

        <h1 className="text-2xl font-bold text-gray-800">แก้ไขการดำเนินงาน</h1>
        <p className="mt-1 mb-8 text-sm text-gray-500">{activity.title}</p>

        {currentAuthor && <AuthorPicker activityId={activity.id} current={currentAuthor} users={authorUsers} />}

        <ActivityForm initial={initial} people={people} currentUserId={Number(session.user.id)} />
      </div>
    </main>
  );
}
