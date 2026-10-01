// app/activity/[id]/page.tsx — รายละเอียดการดำเนินงาน + ไฟล์แนบ (login ทุกคนดูได้, เจ้าของ/แอดมินแก้ได้)
import ImageGallery from '@/app/components/ImageGallery';
import LinkList from '@/app/components/LinkList';
import { getServerSession } from 'next-auth/next';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  MapPin,
  CalendarDays,
  SquarePen,
  FileText,
  User,
  Users,
  Download,
  Phone,
  ScrollText,
  Globe,
  Navigation,
} from 'lucide-react';
import authOptions from '@/app/lib/configs/auth/authOptions';
import prisma from '@/app/lib/db';
import { getRegionLabel } from '@/app/utils/healthZones';
import { navigationUrl } from '@/app/lib/geoLink';
import {
  parsePartners,
  canSeeCoordinatorContact,
  canEditActivity,
  policyShape,
  policyDetailText,
  formatStartDate,
  POLICY_LABEL,
  AREA_SCOPE_LABEL,
} from '@/app/lib/activityMeta';
import type { HealthZone } from '@/app/utils/healthZones';
import DeleteButton from './DeleteButton';
import HistorySection from './HistorySection';

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  PLANNING: { text: 'วางแผน', cls: 'bg-gray-100 text-gray-600' },
  ACTIVE: { text: 'กำลังดำเนินการ', cls: 'bg-orange-100 text-orange-700' },
  COMPLETED: { text: 'เสร็จสิ้น', cls: 'bg-green-50 text-green-700' },
};

const fmtDate = (d: Date | null) =>
  d ? new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium' }).format(d) : null;

const fmtSize = (b: number) =>
  b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(b / 1024)} KB`;

export default async function ActivityDetailPage({
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
      category: { select: { name: true } },
      subCategory: { select: { name: true } },
      user: { select: { id: true, firstName: true, lastName: true } },
      attachments: { orderBy: { id: 'asc' } },
      policies: true,
      links: { orderBy: { sortOrder: 'asc' } },
      members: {
        select: { userId: true, user: { select: { firstName: true, lastName: true } } },
        orderBy: { addedAt: 'asc' },
      },
    },
  });
  if (!activity) notFound();

  // ทีมงาน (ผู้เขียน + สมาชิกทีม) หรือแอดมิน แก้/ลบได้
  const canEdit = canEditActivity(session.user.role, Number(session.user.id), activity);

  const status = STATUS_LABEL[activity.status] ?? STATUS_LABEL.ACTIVE;
  const isAdmin = ['admin', 'superadmin'].includes(session.user.role);
  // รูปปกขึ้นก่อน
  const images = activity.attachments
    .filter((a) => a.kind === 'IMAGE' && !a.policyLevel)
    .sort((a, b) => Number(b.isCover) - Number(a.isCover));
  const partners = parsePartners(activity.partners);
  // เบอร์/LINE ผู้ประสานงาน: แอดมิน + เจ้าของงานเท่านั้น (PDPA)
  const showContact = canSeeCoordinatorContact(session.user.role, Number(session.user.id), activity);
  const hasExtra =
    activity.participantCount != null || partners.length > 0 || !!activity.coordinatorName ||
    (showContact && !!(activity.coordinatorPhone || activity.coordinatorLine));
  const documents = activity.attachments.filter((a) => a.kind === 'DOCUMENT' && !a.policyLevel);
  // นโยบาย/ข้อตกลงรายระดับ + ไฟล์ของแต่ละระดับ (เรียง หมู่บ้าน → ประเทศ)
  const { levels: policyLevelList, details } = policyShape(activity.policies);
  const policies = policyLevelList.map((level) => ({
    level,
    detail: policyDetailText(details[level]),
    files: activity.attachments.filter((a) => a.policyLevel === level),
  }));
  const coverage = [
    activity.coverageVillages != null && `${activity.coverageVillages.toLocaleString('th-TH')} หมู่บ้าน`,
    activity.coverageHouseholds != null && `${activity.coverageHouseholds.toLocaleString('th-TH')} ครัวเรือน`,
    activity.coveragePopulation != null && `ประชากร ${activity.coveragePopulation.toLocaleString('th-TH')} คน`,
  ].filter(Boolean);

  return (
    <main className="min-h-screen bg-white pt-20 pb-10 px-4">
      <div className="max-w-3xl mx-auto">
        <Link
          href="/activity"
          className="inline-flex items-center gap-1.5 text-sm text-orange-700 hover:text-orange-800 mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> งานของฉัน
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex px-2.5 py-0.5 rounded-full bg-orange-50 text-orange-700 text-xs font-medium">
                {activity.category.name}
                {activity.subCategory && <> › {activity.subCategory.name}</>}
              </span>
              <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${status.cls}`}>
                {status.text}
              </span>
            </div>
            <h1 className="mt-2 text-2xl font-bold text-gray-800">{activity.title}</h1>
          </div>
          {canEdit && (
            <div className="flex items-center gap-2">
              {isAdmin && (
                <Link
                  href={`/activity/${activity.id}/publish`}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    activity.isPublished
                      ? 'bg-orange-50 border border-orange-200 text-orange-700 hover:bg-orange-100'
                      : 'border border-orange-200 text-orange-700 hover:bg-orange-50'
                  }`}
                  title={activity.isPublished ? 'เผยแพร่แล้ว — แก้เนื้อหา/ยกเลิกได้' : 'เผยแพร่เป็นกรณีศึกษาสาธารณะ'}
                >
                  <Globe className="w-3.5 h-3.5" /> {activity.isPublished ? 'เผยแพร่แล้ว' : 'เผยแพร่เป็นกรณีศึกษา'}
                </Link>
              )}
              <Link
                href={`/activity/${activity.id}/edit`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-600 text-white text-xs font-medium hover:bg-orange-700 transition-colors"
              >
                <SquarePen className="w-3.5 h-3.5" /> แก้ไข
              </Link>
              <DeleteButton activityId={activity.id} />
            </div>
          )}
        </div>

        {/* ข้อมูลสรุป */}
        <div className="mt-5 grid sm:grid-cols-3 gap-3 text-sm">
          <div className="bg-white rounded-xl border border-orange-100 p-3">
            <p className="flex items-center gap-1.5 text-xs text-gray-400 mb-1">
              <MapPin className="w-3.5 h-3.5 text-orange-500" /> พื้นที่ดำเนินงาน
            </p>
            <p className="text-gray-800">
              {activity.areaName && <>{activity.areaName}<br /></>}
              ต.{activity.district} อ.{activity.amphoe}<br />
              จ.{activity.province} · {getRegionLabel(activity.region as HealthZone)}
              {(activity.areaScope === 'DISTRICT' || activity.areaScope === 'PROVINCE') && (
                <span className="mt-1 block w-fit px-2 py-0.5 rounded-full bg-orange-50 border border-orange-100 text-xs text-orange-700">
                  ครอบคลุม{activity.areaScope === 'DISTRICT' ? `ทั้ง อ.${activity.amphoe}` : `ทั้ง จ.${activity.province}`}
                </span>
              )}
              {coverage.length > 0 && <span className="mt-1 block text-xs text-gray-500">{coverage.join(' · ')}</span>}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-orange-100 p-3">
            <p className="flex items-center gap-1.5 text-xs text-gray-400 mb-1">
              <CalendarDays className="w-3.5 h-3.5 text-orange-500" /> ช่วงเวลา
            </p>
            <p className="text-gray-800">
              {formatStartDate(activity.startDate, activity.startDatePrecision) ?? 'ไม่ระบุ'}
              {' — '}
              {fmtDate(activity.endDate) ?? 'ต่อเนื่อง'}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-orange-100 p-3">
            <p className="flex items-center gap-1.5 text-xs text-gray-400 mb-1">
              <User className="w-3.5 h-3.5 text-orange-500" /> ผู้รับผิดชอบ
            </p>
            <p className="text-gray-800">
              {activity.user.firstName} {activity.user.lastName}
            </p>
            {activity.members.length > 0 && (
              <p className="mt-0.5 text-xs text-gray-500">
                ทีมงาน: {activity.members.map((m) => `${m.user.firstName} ${m.user.lastName}`).join(', ')}
              </p>
            )}
          </div>
        </div>

        {/* นำทาง — เปิด Google Maps (บนมือถือเด้งเข้าแอปและเริ่มนำทาง) */}
        <div className="mt-3 flex flex-wrap items-center gap-3 bg-orange-50 rounded-xl border border-orange-100 px-3 py-2.5">
          <a
            href={navigationUrl(activity)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-600 text-white text-xs font-medium hover:bg-orange-700 transition-colors"
          >
            <Navigation className="w-3.5 h-3.5" /> นำทางด้วย Google Maps
          </a>
          <span className="text-xs text-gray-500">
            {activity.locationSource !== 'TAMBON' && activity.latitude != null && activity.longitude != null
              ? `ตำแหน่งจริงที่ปักหมุดไว้ · ${activity.latitude.toFixed(5)}, ${activity.longitude.toFixed(5)}`
              : activity.areaName
                ? `ยังไม่ได้ปักหมุด — Google จะค้นหาจากชื่อ "${activity.areaName}"`
                : 'ยังไม่ได้ปักหมุด — นำทางไปจุดกลางตำบลโดยประมาณ'}
          </span>
        </div>

        {/* รายละเอียด */}
        <section className="mt-6 bg-white rounded-2xl border border-orange-100 p-5">
          <h2 className="text-sm font-semibold text-gray-800 mb-2">รายละเอียดการดำเนินงาน</h2>
          <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">
            {activity.description}
          </p>
        </section>

        {/* ผลลัพธ์ ภาคี ผู้ประสานงาน */}
        {hasExtra && (
          <section className="mt-6 bg-white rounded-2xl border border-orange-100 p-5 grid sm:grid-cols-2 gap-5 text-sm">
            {(activity.participantCount != null || partners.length > 0) && (
              <div>
                {activity.participantCount != null && (
                  <p className="flex items-center gap-1.5 text-gray-800">
                    <Users className="w-4 h-4 text-orange-500" />
                    ผู้เข้าร่วม <b>{activity.participantCount.toLocaleString('th-TH')}</b> คน
                  </p>
                )}
                {partners.length > 0 && (
                  <>
                    <p className="mt-3 text-xs text-gray-400 mb-1.5">ภาคีที่ร่วมงาน</p>
                    <div className="flex flex-wrap gap-1.5">
                      {partners.map((p) => (
                        <span key={p} className="px-2 py-0.5 rounded-full bg-orange-50 border border-orange-100 text-xs text-gray-700">
                          {p}
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
            {(activity.coordinatorName || (showContact && (activity.coordinatorPhone || activity.coordinatorLine))) && (
              <div>
                <p className="text-xs text-gray-400 mb-1">ผู้ประสานงานในพื้นที่</p>
                {activity.coordinatorName && (
                  <p className="text-gray-800">
                    {activity.coordinatorName}
                    {activity.coordinatorRole && <span className="text-gray-500"> · {activity.coordinatorRole}</span>}
                  </p>
                )}
                {showContact ? (
                  <div className="mt-1.5 flex flex-wrap gap-2 text-xs">
                    {activity.coordinatorPhone && (
                      <a
                        href={`tel:${activity.coordinatorPhone.replace(/[^0-9+]/g, '')}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-orange-600 text-white font-medium hover:bg-orange-700"
                      >
                        <Phone className="w-3.5 h-3.5" /> {activity.coordinatorPhone}
                      </a>
                    )}
                    {activity.coordinatorLine && (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg border border-orange-200 text-gray-700">
                        LINE: {activity.coordinatorLine}
                      </span>
                    )}
                    {(activity.coordinatorPhone || activity.coordinatorLine) && (
                      <span className="w-full text-[11px] text-gray-400">🔒 ช่องทางติดต่อเห็นเฉพาะแอดมินและผู้บันทึก</span>
                    )}
                  </div>
                ) : (
                  (activity.coordinatorPhone || activity.coordinatorLine) && (
                    <p className="mt-1 text-[11px] text-gray-400">🔒 ติดต่อผู้ประสานงานผ่านแอดมินเครือข่าย</p>
                  )
                )}
              </div>
            )}
          </section>
        )}

        {/* นโยบาย/ข้อตกลง */}
        {policies.length > 0 && (
          <section className="mt-6 bg-white rounded-2xl border border-orange-100 p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-800 mb-3">
              <ScrollText className="w-4 h-4 text-orange-600" /> นโยบาย/ข้อตกลงที่เกิดขึ้น
            </h2>
            <ul className="space-y-2">
              {policies.map(({ level, detail, files }) => (
                <li key={level} className="flex flex-wrap items-start gap-2">
                  <span className="shrink-0 px-2.5 py-0.5 rounded-full bg-orange-600 text-white text-xs font-medium">
                    ระดับ{POLICY_LABEL[level]}
                  </span>
                  {detail && <span className="text-sm text-gray-800 pt-px">{detail}</span>}
                  {files.length === 0 ? (
                    <span className="text-xs text-gray-400 pt-0.5">ไม่มีไฟล์แนบ</span>
                  ) : (
                    <span className="flex flex-wrap gap-1.5">
                      {files.map((f) => (
                        <a
                          key={f.id}
                          href={`/api/files/${f.filePath}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border border-orange-100 text-xs text-gray-700 hover:bg-orange-50"
                        >
                          <FileText className="w-3.5 h-3.5 text-orange-600" />
                          <span className="max-w-[220px] truncate">{f.fileName}</span>
                        </a>
                      ))}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* รูปภาพ */}
        {images.length > 0 && (
          <section className="mt-6 bg-white rounded-2xl border border-orange-100 p-5">
            <h2 className="text-sm font-semibold text-gray-800 mb-3">
              รูปภาพกิจกรรม ({images.length})
            </h2>
            {/* คลิกรูป = พรีวิวเต็มจอ เลื่อนดูทีละรูปได้ */}
            <ImageGallery
              images={images.map((img) => ({
                id: img.id,
                thumb: `/api/files/${img.filePath}`,
                full: `/api/files/${img.filePath}`,
                alt: img.caption || img.fileName,
                caption: img.caption,
                badge: img.isCover && images.length > 1 ? 'รูปปก' : null,
              }))}
            />
          </section>
        )}

        {/* ลิงก์ที่เกี่ยวข้อง */}
        {activity.links.length > 0 && (
          <section className="mt-6 bg-white rounded-2xl border border-orange-100 p-5">
            <h2 className="text-sm font-semibold text-gray-800 mb-3">ลิงก์ที่เกี่ยวข้อง ({activity.links.length})</h2>
            <LinkList links={activity.links} />
          </section>
        )}

        {/* เอกสาร */}
        {documents.length > 0 && (
          <section className="mt-6 bg-white rounded-2xl border border-orange-100 p-5">
            <h2 className="text-sm font-semibold text-gray-800 mb-3">
              เอกสาร/นโยบาย ({documents.length})
            </h2>
            <ul className="space-y-2">
              {documents.map((doc) => (
                <li key={doc.id}>
                  <a
                    href={`/api/files/${doc.filePath}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border border-orange-100 hover:bg-orange-50 transition-colors"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <FileText className="w-4 h-4 text-orange-600 shrink-0" />
                      <span className="text-sm text-gray-700 truncate">{doc.fileName}</span>
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-gray-400 shrink-0">
                      {fmtSize(doc.size)} <Download className="w-3.5 h-3.5" />
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        <HistorySection activityId={activity.id} />

        <p className="mt-6 text-xs text-gray-400">
          บันทึกเมื่อ {fmtDate(activity.createdAt)} · แก้ไขล่าสุด {fmtDate(activity.updatedAt)}
        </p>
      </div>
    </main>
  );
}
