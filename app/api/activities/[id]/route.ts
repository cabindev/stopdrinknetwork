// app/api/activities/[id]/route.ts — ดู/แก้ไข/ลบการดำเนินงานรายตัว
// สิทธิ์: ดูได้ทุกคนที่ login, แก้/ลบได้เฉพาะเจ้าของงานหรือ admin/superadmin
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import authOptions from '@/app/lib/configs/auth/authOptions';
import prisma from '@/app/lib/db';
import { provinceHealthZones } from '@/app/utils/healthZones';
import {
  filesFrom,
  validateFiles,
  saveAttachment,
  IMAGE_TYPES,
  removeFile,
} from '@/app/lib/activityFiles';
import { resolveActivityCoords } from '@/app/lib/provinceGeo';
import { purgeExpiredTrash, TRASH_DAYS } from '@/app/lib/activityAccess';
import { writeAuditLog, diffFields, STATUS_LABEL } from '@/app/lib/audit';
import { parseExtraAreas, areasText } from '@/app/lib/activityAreas';
import { parseActivityExtras, imageLimitError, applyImageMeta, policyFilesFrom, surveyFilesFrom, parseMemberIds, parseLinksField } from '@/app/lib/activityInput';
import {
  canSeeCoordinatorContact,
  canEditActivity,
  isStaffRole,
  descriptionError,
  parsePolicyLevels,
  policyShape,
  policyDetailText,
  formatStartDate,
  POLICY_LABEL,
  AREA_SCOPE_LABEL,
} from '@/app/lib/activityMeta';

const STATUSES = ['PLANNING', 'ACTIVE', 'COMPLETED'] as const;

async function findActivity(id: string) {
  const activityId = Number(id);
  if (Number.isNaN(activityId)) return null;
  return prisma.activity.findUnique({
    where: { id: activityId },
    include: {
      category: { select: { id: true, name: true } },
      subCategory: { select: { id: true, name: true } },
      user: { select: { id: true, firstName: true, lastName: true } },
      attachments: true,
      policies: true,
      links: { orderBy: { sortOrder: 'asc' } },
      areas: { orderBy: { sortOrder: 'asc' } },
      members: { select: { userId: true, user: { select: { firstName: true, lastName: true } } } },
    },
  });
}

// ข้อความตำแหน่งสำหรับ audit log — จุดกลางตำบลไม่ต้องโชว์ตัวเลข (เปลี่ยนตามตำบลอยู่แล้ว)
const pinLabel = (source: string, lat: number | null, lng: number | null) =>
  source === 'TAMBON' || lat == null || lng == null
    ? 'จุดกลางตำบล'
    : `${lat.toFixed(5)}, ${lng.toFixed(5)}`;

const detailsText = (s: ReturnType<typeof policyShape>) =>
  s.levels.map((l) => s.details[l] && `${POLICY_LABEL[l]}: ${policyDetailText(s.details[l])}`).filter(Boolean).join(' · ') || null;
const coverageText = (v: number | null, h: number | null, p: number | null) =>
  [v != null && `${v} หมู่บ้าน`, h != null && `${h} ครัวเรือน`, p != null && `${p} คน`].filter(Boolean).join(', ') || null;
const policyText = (levels: string[]) =>
  parsePolicyLevels(levels).map((l) => POLICY_LABEL[l]).join(', ') || null;
const partnersText = (v: unknown) =>
  Array.isArray(v) && v.length > 0 ? [...v].sort().join(', ') : null;
// เบอร์/LINE ไม่ลงประวัติ (สมาชิกทุกคนเห็นประวัติ) — บอกแค่ว่ามีช่องทางไหน
const contactLabel = (phone: string | null, line: string | null) =>
  [phone ? 'มีเบอร์' : '', line ? 'มี LINE' : ''].filter(Boolean).join(' + ') || null;

// แก้/ลบได้: admin/superadmin เท่านั้น (canEditActivity)
function canEdit(session: { user: { id: number | string; role?: string } }, a: { userId: number; members: { userId: number }[] }) {
  return canEditActivity(session.user.role, Number(session.user.id), a);
}
// audit: ลิงก์เป็นรายการ "ชื่อ (url)" — เทียบทั้งชุด
const linksText = (l: { url: string; title: string | null }[]) =>
  l.map((x) => (x.title ? `${x.title} (${x.url})` : x.url)).join(' · ') || null;
const teamText = (m: { user: { firstName: string; lastName: string } }[]) =>
  m.map((x) => `${x.user.firstName} ${x.user.lastName}`).sort().join(', ') || null;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
  }
  if (!isStaffRole(session.user.role)) {
    return NextResponse.json({ error: 'บัญชีรอผู้ดูแลระบบอนุมัติ' }, { status: 403 });
  }
  const { id } = await params;
  const activity = await findActivity(id);
  if (!activity) {
    return NextResponse.json({ error: 'ไม่พบข้อมูล' }, { status: 404 });
  }
  // เบอร์/LINE ผู้ประสานงาน: เฉพาะแอดมิน + เจ้าของงาน (PDPA — ผู้ใช้ตัดสินใจ ก.ย. 2026)
  const showContact = canSeeCoordinatorContact(session.user.role, Number(session.user.id), activity);
  const safe = showContact ? activity : { ...activity, coordinatorPhone: null, coordinatorLine: null };
  return NextResponse.json({ activity: safe, canEdit: canEdit(session, activity) });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
    }
    const { id } = await params;
    const activity = await findActivity(id);
    if (!activity) {
      return NextResponse.json({ error: 'ไม่พบข้อมูล' }, { status: 404 });
    }
    if (!canEdit(session, activity)) {
      return NextResponse.json({ error: 'แก้ไขได้เฉพาะงานของตัวเอง' }, { status: 403 });
    }

    const formData = await request.formData();
    const title = String(formData.get('title') ?? '').trim();
    const description = String(formData.get('description') ?? '').trim();
    const categoryId = Number(formData.get('categoryId'));
    const areaName = String(formData.get('areaName') ?? '').trim() || null;
    const district = String(formData.get('district') ?? '').trim();
    const amphoe = String(formData.get('amphoe') ?? '').trim();
    const province = String(formData.get('province') ?? '').trim();
    const zipcode = String(formData.get('zipcode') ?? '').trim() || null;
    const status = String(formData.get('status') ?? 'ACTIVE');
    const startDateRaw = String(formData.get('startDate') ?? '').trim();
    const endDateRaw = String(formData.get('endDate') ?? '').trim();

    if (!title || !description) {
      return NextResponse.json({ error: 'กรุณากรอกชื่อและรายละเอียดงาน' }, { status: 400 });
    }
    const descError = descriptionError(description);
    if (descError) {
      return NextResponse.json({ error: descError }, { status: 400 });
    }
    if (!categoryId || Number.isNaN(categoryId)) {
      return NextResponse.json({ error: 'กรุณาเลือกประเด็นงาน' }, { status: 400 });
    }
    if (!district || !amphoe || !province) {
      return NextResponse.json(
        { error: 'กรุณาเลือกพื้นที่ดำเนินงาน (ตำบล/อำเภอ/จังหวัด)' },
        { status: 400 }
      );
    }
    const region = provinceHealthZones[province];
    if (!region) {
      return NextResponse.json({ error: `ไม่รู้จักจังหวัด "${province}"` }, { status: 400 });
    }
    if (!STATUSES.includes(status as (typeof STATUSES)[number])) {
      return NextResponse.json({ error: 'สถานะไม่ถูกต้อง' }, { status: 400 });
    }
    const category = await prisma.workCategory.findFirst({
      where: { id: categoryId, isActive: true },
    });
    if (!category) {
      return NextResponse.json({ error: 'ไม่พบประเด็นงานที่เลือก' }, { status: 400 });
    }

    let startDate = startDateRaw ? new Date(startDateRaw) : null;
    const endDate = endDateRaw ? new Date(endDateRaw) : null;
    if (startDate && endDate && endDate < startDate) {
      return NextResponse.json(
        { error: 'วันสิ้นสุดต้องไม่มาก่อนวันเริ่มดำเนินการ' },
        { status: 400 }
      );
    }

    const documents = filesFrom(formData, 'documents');
    const images = filesFrom(formData, 'images');
    const fileError = validateFiles(documents, images);
    if (fileError) {
      return NextResponse.json({ error: fileError }, { status: 400 });
    }

    // ไฟล์แนบเดิมที่ผู้ใช้สั่งลบ (ต้องเป็นของ activity นี้เท่านั้น)
    let removeIds: number[] = [];
    try {
      removeIds = JSON.parse(String(formData.get('removeAttachmentIds') ?? '[]'));
    } catch {
      removeIds = [];
    }
    const keptImages = activity.attachments.filter(
      (a) => a.kind === 'IMAGE' && a.policyLevel === null && !a.isSurvey && !removeIds.includes(a.id)
    ).length;
    const limitError = imageLimitError(keptImages, images.length);
    if (limitError) {
      return NextResponse.json({ error: limitError }, { status: 400 });
    }

    const extras = await parseActivityExtras(formData, categoryId, activity.subCategoryId);
    if ('error' in extras) {
      return NextResponse.json({ error: extras.error }, { status: 400 });
    }
    const team = await parseMemberIds(formData, activity.userId);
    if ('error' in team) {
      return NextResponse.json({ error: team.error }, { status: 400 });
    }
    const linkField = parseLinksField(formData);
    if ('error' in linkField) {
      return NextResponse.json({ error: linkField.error }, { status: 400 });
    }
    // ลิงก์เดิมที่ยังอยู่คงสถานะ "เปิดเผยบนกรณีศึกษา" ไว้ (แอดมินไม่ต้องติ๊กใหม่ทุกครั้งที่มีคนแก้งาน)
    const wasPublic = new Set(activity.links.filter((l) => l.isPublic).map((l) => l.url));
    // วันเริ่มแบบรู้แค่ปี → 1 ม.ค. ของปีนั้น (precision เก็บใน extras.data)
    if (extras.data.startDatePrecision === 'YEAR') startDate = extras.startYearDate;
    if (startDate && endDate && endDate < startDate) {
      return NextResponse.json({ error: 'วันสิ้นสุดต้องไม่มาก่อนวันเริ่มดำเนินการ' }, { status: 400 });
    }
    const coords = resolveActivityCoords(formData, district, amphoe, province, extras.data.areaScope);
    if ('error' in coords) {
      return NextResponse.json({ error: coords.error }, { status: 400 });
    }
    const extraAreas = parseExtraAreas(formData);
    if ('error' in extraAreas) {
      return NextResponse.json({ error: extraAreas.error }, { status: 400 });
    }

    // ไฟล์นโยบายรายระดับ (รับเฉพาะระดับที่ติ๊ก) — รวมขนาดกับไฟล์อื่นไม่เกินเพดานต่อครั้ง
    const policy = policyFilesFrom(formData, extras.policyLevels);
    if ('error' in policy) {
      return NextResponse.json({ error: policy.error }, { status: 400 });
    }
    const survey = surveyFilesFrom(formData, extras.data.hasSurvey);
    if ('error' in survey) {
      return NextResponse.json({ error: survey.error }, { status: 400 });
    }
    const totalError = validateFiles(documents, images, [...policy.files.map((p) => p.file), ...survey.files]);
    if (totalError) {
      return NextResponse.json({ error: totalError }, { status: 400 });
    }

    // ไฟล์ที่สั่งลบ + ไฟล์นโยบายของระดับที่เลิกติ๊ก + ไฟล์แบบสำรวจถ้าเลิกติ๊ก (ต้องเป็นของ activity นี้เท่านั้น)
    const toRemove = activity.attachments.filter(
      (a) =>
        removeIds.includes(a.id) ||
        (a.policyLevel !== null && !extras.policyLevels.includes(a.policyLevel)) ||
        (a.isSurvey && !extras.data.hasSurvey)
    );

    await prisma.activity.update({
      where: { id: activity.id },
      data: {
        title,
        description,
        categoryId,
        areaName,
        district,
        amphoe,
        province,
        region,
        zipcode,
        // พิกัด: หมุดที่ผู้ใช้ปัก หรือจุดกลางตำบล (ดู resolveActivityCoords)
        ...coords,
        ...extras.data,
        // นโยบาย: แทนทั้งชุดตามที่ติ๊กในฟอร์ม
        policies: { deleteMany: {}, create: extras.policies },
        ...(team.ids && { members: { deleteMany: {}, create: team.ids.map((userId) => ({ userId })) } }),
        // พื้นที่ที่เกี่ยวข้อง: แทนทั้งชุดตามฟอร์ม (ไม่ส่งมา = ไม่แตะ)
        ...(extraAreas.areas && { areas: { deleteMany: {}, create: extraAreas.areas } }),
        ...(linkField.links && {
          links: {
            deleteMany: {},
            create: linkField.links.map((l, i) => ({
              url: l.url,
              title: l.title || null,
              kind: l.kind,
              sortOrder: i,
              isPublic: wasPublic.has(l.url),
            })),
          },
        }),
        status: status as (typeof STATUSES)[number],
        startDate,
        endDate,
      },
    });

    for (const a of toRemove) {
      await prisma.activityAttachment.delete({ where: { id: a.id } });
      await removeFile(a.filePath);
    }
    for (const f of documents) await saveAttachment(activity.id, f, 'DOCUMENT');
    const newImageIds: number[] = [];
    for (const f of images) newImageIds.push((await saveAttachment(activity.id, f, 'IMAGE')).id);
    await applyImageMeta(activity.id, formData, newImageIds);
    for (const { level, file } of policy.files) {
      await saveAttachment(activity.id, file, IMAGE_TYPES.includes(file.type) ? 'IMAGE' : 'DOCUMENT', level);
    }
    for (const file of survey.files) {
      await saveAttachment(activity.id, file, IMAGE_TYPES.includes(file.type) ? 'IMAGE' : 'DOCUMENT', null, true);
    }

    // audit: บันทึกเฉพาะฟิลด์ที่เปลี่ยนจริง + สรุปไฟล์แนบที่เพิ่ม/ลบ
    const beforePolicy = policyShape(activity.policies);
    const changes = diffFields(
      {
        title: activity.title,
        description: activity.description,
        categoryName: activity.category.name,
        subCategoryName: activity.subCategory?.name ?? null,
        participantCount: activity.participantCount,
        partnersText: partnersText(activity.partners),
        policyText: policyText(beforePolicy.levels),
        policyDetailsText: detailsText(beforePolicy),
        surveyText: activity.hasSurvey ? 'มี' : null,
        teamText: teamText(activity.members),
        linksText: linksText(activity.links),
        areasText: areasText(activity.areas),
        areaScopeLabel: AREA_SCOPE_LABEL[activity.areaScope],
        coverageText: coverageText(activity.coverageVillages, activity.coverageHouseholds, activity.coveragePopulation),
        coordinatorName: activity.coordinatorName,
        coordinatorContact: contactLabel(activity.coordinatorPhone, activity.coordinatorLine),
        statusLabel: STATUS_LABEL[activity.status] ?? activity.status,
        areaName: activity.areaName,
        pinLabel: pinLabel(activity.locationSource, activity.latitude, activity.longitude),
        district: activity.district,
        amphoe: activity.amphoe,
        province: activity.province,
        startDate: formatStartDate(activity.startDate, activity.startDatePrecision),
        endDate: activity.endDate,
      },
      {
        title,
        description,
        categoryName: category.name,
        subCategoryName: extras.data.subCategoryId
          ? (await prisma.workSubCategory.findUnique({ where: { id: extras.data.subCategoryId } }))?.name ?? null
          : null,
        participantCount: extras.data.participantCount,
        partnersText: partnersText(extras.data.partners),
        policyText: policyText(extras.policyLevels),
        policyDetailsText: detailsText({ levels: extras.policyLevels, details: extras.policyDetails }),
        surveyText: extras.data.hasSurvey ? 'มี' : null,
        teamText: team.ids
          ? teamText((await prisma.user.findMany({ where: { id: { in: team.ids } }, select: { firstName: true, lastName: true } })).map((user) => ({ user })))
          : teamText(activity.members),
        linksText: linkField.links ? linksText(linkField.links) : linksText(activity.links),
        areasText: extraAreas.areas ? areasText(extraAreas.areas) : areasText(activity.areas),
        areaScopeLabel: AREA_SCOPE_LABEL[extras.data.areaScope],
        coverageText: coverageText(extras.data.coverageVillages, extras.data.coverageHouseholds, extras.data.coveragePopulation),
        coordinatorName: extras.data.coordinatorName,
        coordinatorContact: contactLabel(extras.data.coordinatorPhone, extras.data.coordinatorLine),
        statusLabel: STATUS_LABEL[status] ?? status,
        areaName,
        pinLabel: pinLabel(coords.locationSource, coords.latitude, coords.longitude),
        district,
        amphoe,
        province,
        startDate: formatStartDate(startDate, extras.data.startDatePrecision),
        endDate,
      }
    );
    const fileNotes: string[] = [];
    const addedCount = documents.length + images.length + policy.files.length;
    if (addedCount > 0) fileNotes.push(`เพิ่มไฟล์แนบ ${addedCount} ไฟล์`);
    if (toRemove.length > 0) fileNotes.push(`ลบไฟล์แนบ ${toRemove.length} ไฟล์`);

    if (changes.length > 0 || fileNotes.length > 0) {
      await writeAuditLog({
        action: 'UPDATE',
        entityId: activity.id,
        entityName: title,
        userId: Number(session.user.id),
        changes: [...changes, ...fileNotes],
      });
    }

    return NextResponse.json({ message: 'บันทึกการแก้ไขสำเร็จ', activityId: activity.id });
  } catch (error) {
    console.error('Error updating activity:', error);
    return NextResponse.json({ error: 'ไม่สามารถบันทึกได้ โปรดลองอีกครั้ง' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
    }
    const { id } = await params;
    const activity = await findActivity(id);
    if (!activity) {
      return NextResponse.json({ error: 'ไม่พบข้อมูล' }, { status: 404 });
    }
    if (!canEdit(session, activity)) {
      return NextResponse.json({ error: 'ลบได้เฉพาะงานของตัวเอง' }, { status: 403 });
    }

    // ย้ายลงถังขยะ (กู้คืนได้ TRASH_DAYS วันที่ /dashboard/trash) — ไฟล์ยังอยู่จนกว่าจะลบถาวร
    await prisma.activity.update({
      where: { id: activity.id },
      data: { deletedAt: new Date(), deletedById: Number(session.user.id) },
    });
    await purgeExpiredTrash();

    await writeAuditLog({
      action: 'DELETE',
      entityId: activity.id,
      entityName: activity.title,
      userId: Number(session.user.id),
      changes: [
        `พื้นที่: ต.${activity.district} อ.${activity.amphoe} จ.${activity.province}`,
        `ประเด็นงาน: ${activity.category.name}`,
        `เจ้าของงาน: ${activity.user.firstName} ${activity.user.lastName}`,
        `ย้ายลงถังขยะ — กู้คืนได้ภายใน ${TRASH_DAYS} วัน`,
      ],
    });

    return NextResponse.json({ message: 'ย้ายงานลงถังขยะแล้ว' });
  } catch (error) {
    console.error('Error deleting activity:', error);
    return NextResponse.json({ error: 'ไม่สามารถลบได้ โปรดลองอีกครั้ง' }, { status: 500 });
  }
}
