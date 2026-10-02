// app/activity/[id]/publish/page.tsx — แอดมินจัดหน้ากรณีศึกษาสาธารณะของงานนี้ (เนื้อหา + เลือกไฟล์ที่เปิดเผย)
import { getServerSession } from 'next-auth/next';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import authOptions from '@/app/lib/configs/auth/authOptions';
import prisma, { ACTIVE_ACTIVITY } from '@/app/lib/db';
import { POLICY_LABEL, GALLERY_GROUP } from '@/app/lib/activityMeta';
import PublishForm from './PublishForm';

export default async function PublishStoryPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/auth/signin');
  const { id } = await params;
  if (!['admin', 'superadmin'].includes(session.user.role)) redirect(`/activity/${id}`);

  const activity = await prisma.activity.findUnique({
    where: { id: Number(id) || 0 },
    include: {
      attachments: { orderBy: { id: 'asc' } },
      links: { orderBy: { sortOrder: 'asc' } },
      subCategory: { select: { name: true } },
    },
  });
  if (!activity) notFound();
  // ชุดกรณีศึกษาทั้งหมด (ให้เลือก) + จำนวนเรื่องในแต่ละชุด
  const seriesRows = await prisma.storySeries.findMany({
    select: { id: true, title: true, description: true, _count: { select: { activities: { where: ACTIVE_ACTIVITY } } } },
    orderBy: { updatedAt: 'desc' },
  });
  const currentSeries = seriesRows.find((x) => x.id === activity.seriesId);

  return (
    <main className="min-h-screen bg-white pt-20 pb-10 px-4">
      <div className="max-w-3xl mx-auto">
        <Link
          href={`/activity/${activity.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-orange-700 hover:text-orange-800 mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> กลับไปหน้างาน
        </Link>
        <h1 className="text-2xl font-bold text-gray-800">เผยแพร่เป็นกรณีศึกษา</h1>
        <p className="mt-1 text-sm text-gray-500">{activity.title}</p>
        <p className="mt-3 mb-8 text-xs text-gray-400 leading-relaxed">
          หน้าสาธารณะเปิดได้โดยไม่ต้องเข้าสู่ระบบ แสดงพื้นที่แค่ระดับตำบล ไม่แสดงชื่อเจ้าหน้าที่ ผู้ประสานงาน
          เบอร์โทร หรือหมุดตำแหน่งจริง — รูปและไฟล์จะขึ้นเฉพาะที่ติ๊กเลือกด้านล่าง
        </p>
        <PublishForm
          activityId={activity.id}
          isPublished={activity.isPublished}
          initial={{
            storyLead: activity.storyLead ?? activity.description,
            storyProcess: activity.storyProcess ?? '',
            storyLessons: activity.storyLessons ?? '',
          }}
          files={activity.attachments.map((a) => ({
            id: a.id,
            kind: a.kind,
            fileName: a.fileName,
            caption: a.caption,
            isCover: a.isCover,
            isPublic: a.isPublic,
            group: a.policyLevel ? `ไฟล์นโยบายระดับ${POLICY_LABEL[a.policyLevel]}` : a.isSurvey ? 'แบบสำรวจ' : a.kind === 'IMAGE' ? GALLERY_GROUP : 'เอกสาร',
            isSurvey: a.isSurvey,
            src: `/api/files/${a.filePath}`,
          }))}
          links={activity.links.map((l) => ({ id: l.id, url: l.url, title: l.title, kind: l.kind, isPublic: l.isPublic }))}
          seriesOptions={seriesRows.map((x) => ({ id: x.id, title: x.title, description: x.description, count: x._count.activities }))}
          initialSeries={
            currentSeries
              ? { id: currentSeries.id, title: currentSeries.title, description: currentSeries.description ?? '', order: activity.seriesOrder || 1 }
              : null
          }
        />
      </div>
    </main>
  );
}
