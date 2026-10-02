// app/activity/new/page.tsx — ฟอร์มบันทึกการดำเนินงาน (แอดมินเท่านั้น)
// ?copy=<id> = "คัดลอกงานนี้": กรอกประเด็น/รายละเอียด/วันที่/ภาคี/ทีม/ลิงก์ไว้ให้ เหลือเลือกพื้นที่ + แนบไฟล์
// (งานเดียวกันหลายพื้นที่ เช่น สงกรานต์ 5 ตำบล — 1 รายการต่อ 1 พื้นที่ แผนที่/ความครอบคลุมจึงนับถูก)
import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Copy } from 'lucide-react';
import authOptions from '@/app/lib/configs/auth/authOptions';
import prisma from '@/app/lib/db';
import ActivityForm from '../components/ActivityForm';
import type { ActivityInitialData } from '../components/ActivityForm';
import { teamPeople } from '@/app/lib/activityAccess';
import { canCreateActivity, parsePartners, toThaiDateInput } from '@/app/lib/activityMeta';

export default async function NewActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ copy?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect('/auth/signin');
  }
  if (!canCreateActivity(session.user.role)) redirect('/activity'); // เพิ่มงานได้เฉพาะแอดมิน
  const me = Number(session.user.id);
  const people = await teamPeople();

  const copyId = Number((await searchParams).copy);
  const src =
    Number.isInteger(copyId) && copyId > 0
      ? await prisma.activity.findUnique({
          where: { id: copyId },
          include: {
            links: { select: { url: true, title: true }, orderBy: { sortOrder: 'asc' } },
            members: { select: { userId: true }, orderBy: { addedAt: 'asc' } },
          },
        })
      : null;

  // ช่องที่ผูกกับพื้นที่ (ตำบล/หมุด/ชื่อสถานที่/ผู้ประสานงาน/ตัวเลขครอบคลุม/นโยบาย/แบบสำรวจ/ไฟล์) ไม่คัดลอก
  // ผู้เขียนงานต้นฉบับเข้าทีมของงานใหม่ด้วย (งานจะขึ้นใน "งานของฉัน" ของเขาเหมือนงานเดิม)
  const copyInitial: ActivityInitialData | undefined = src
    ? {
        id: 0,
        title: src.title,
        categoryId: src.categoryId,
        subCategoryId: src.subCategoryId,
        status: src.status,
        description: src.description,
        startDate: toThaiDateInput(src.startDate),
        endDate: toThaiDateInput(src.endDate),
        startDatePrecision: src.startDatePrecision,
        partners: parsePartners(src.partners),
        links: src.links,
        extraAreas: [], // ไม่คัดลอกพื้นที่
        ownerId: me,
        memberIds: [...new Set([src.userId, ...src.members.map((m) => m.userId)])].filter((id) => id !== me),
        areaName: null,
        district: '',
        amphoe: '',
        province: '',
        zipcode: null,
        pin: null,
        areaScope: src.areaScope,
        participantCount: null,
        coverageVillages: null,
        coverageHouseholds: null,
        coveragePopulation: null,
        coordinatorName: null,
        coordinatorRole: null,
        coordinatorPhone: null,
        coordinatorLine: null,
        coordinatorConsent: false,
        policyLevels: [],
        policyDetails: {},
        hasSurvey: false,
        attachments: [],
      }
    : undefined;

  return (
    <main className="min-h-screen bg-white pt-20 pb-10 px-4">
      <div className="max-w-2xl mx-auto">
        <Link
          href={src ? `/activity/${src.id}` : '/activity'}
          className="inline-flex items-center gap-1.5 text-sm text-orange-700 hover:text-orange-800 mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> {src ? 'กลับไปงานต้นฉบับ' : 'งานของฉัน'}
        </Link>

        <h1 className="text-2xl font-bold text-gray-800">บันทึกการดำเนินงาน</h1>
        {src ? (
          <div className="mt-3 mb-8 flex items-start gap-2 px-4 py-3 rounded-xl border border-orange-200 bg-orange-50 text-sm text-gray-700">
            <Copy className="w-4 h-4 mt-0.5 shrink-0 text-orange-600" />
            <p>
              คัดลอกจาก <span className="font-medium">{src.title}</span> (ต.{src.district} จ.{src.province}) —
              กรอกประเด็น รายละเอียด วันที่ ภาคี ทีม และลิงก์ไว้ให้แล้ว
              <b> เลือกพื้นที่ใหม่</b> แนบรูปของพื้นที่นี้ แล้วปรับชื่องานให้บอกพื้นที่
            </p>
          </div>
        ) : (
          <p className="mt-1 mb-8 text-sm text-gray-500">
            1 รายการ = งาน 1 ประเด็นใน 1 พื้นที่หลัก (เพิ่มพื้นที่ที่เกี่ยวข้องได้) — ข้อมูลจะแสดงในโปรไฟล์ของคุณและแผนที่รวมขององค์กร
          </p>
        )}

        <ActivityForm initial={copyInitial} copy={!!src} people={people} currentUserId={me} />
      </div>
    </main>
  );
}
