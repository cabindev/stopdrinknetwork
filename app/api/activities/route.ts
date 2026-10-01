// app/api/activities/route.ts — บันทึก/ดึงการดำเนินงานของเจ้าหน้าที่ (ต้อง login)
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import authOptions from '@/app/lib/configs/auth/authOptions';
import { involvedWhere } from '@/app/lib/activityAccess';
import prisma from '@/app/lib/db';
import { provinceHealthZones } from '@/app/utils/healthZones';
import { filesFrom, validateFiles, saveAttachment, IMAGE_TYPES } from '@/app/lib/activityFiles';
import { resolveActivityCoords } from '@/app/lib/provinceGeo';
import { writeAuditLog } from '@/app/lib/audit';
import { parseLinksField, parseMemberIds, parseActivityExtras, imageLimitError, applyImageMeta, policyFilesFrom, surveyFilesFrom } from '@/app/lib/activityInput';
import { canCreateActivity, descriptionError } from '@/app/lib/activityMeta';

const STATUSES = ['PLANNING', 'ACTIVE', 'COMPLETED'] as const;

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อนบันทึกข้อมูล' }, { status: 401 });
    }
    if (!canCreateActivity(session.user.role)) {
      return NextResponse.json({ error: 'เพิ่มงานได้เฉพาะผู้ดูแลระบบ' }, { status: 403 });
    }
    const userId = Number(session.user.id);

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

    // Validation ฝั่ง server (ฟอร์มเช็คซ้ำอีกชั้นแล้ว)
    if (!title) {
      return NextResponse.json({ error: 'กรุณาระบุชื่อกิจกรรม/โครงการ' }, { status: 400 });
    }
    if (!description) {
      return NextResponse.json({ error: 'กรุณาระบุรายละเอียดการดำเนินงาน' }, { status: 400 });
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
    // โซนพื้นที่คำนวณฝั่ง server จากจังหวัดเสมอ — ไม่รับจาก client และกันจังหวัดสะกดผิดไปในตัว
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

    // ตรวจไฟล์แนบทั้งหมดก่อนสร้าง record
    const documents = filesFrom(formData, 'documents');
    const images = filesFrom(formData, 'images');
    const fileError = validateFiles(documents, images) ?? imageLimitError(0, images.length);
    if (fileError) {
      return NextResponse.json({ error: fileError }, { status: 400 });
    }

    // ประเด็นย่อย · ผู้เข้าร่วม · ภาคี · ผู้ประสานงาน (ดู lib/activityInput.ts)
    const extras = await parseActivityExtras(formData, categoryId);
    if ('error' in extras) {
      return NextResponse.json({ error: extras.error }, { status: 400 });
    }
    const team = await parseMemberIds(formData, userId);
    if ('error' in team) {
      return NextResponse.json({ error: team.error }, { status: 400 });
    }
    const linkField = parseLinksField(formData);
    if ('error' in linkField) {
      return NextResponse.json({ error: linkField.error }, { status: 400 });
    }
    // วันเริ่มแบบรู้แค่ปี → 1 ม.ค. ของปีนั้น (precision เก็บใน extras.data)
    if (extras.data.startDatePrecision === 'YEAR') startDate = extras.startYearDate;
    if (startDate && endDate && endDate < startDate) {
      return NextResponse.json({ error: 'วันสิ้นสุดต้องไม่มาก่อนวันเริ่มดำเนินการ' }, { status: 400 });
    }
    const coords = resolveActivityCoords(formData, district, amphoe, province, extras.data.areaScope);
    if ('error' in coords) {
      return NextResponse.json({ error: coords.error }, { status: 400 });
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

    const activity = await prisma.activity.create({
      data: {
        title,
        description,
        categoryId,
        userId,
        areaName,
        district,
        amphoe,
        province,
        region,
        zipcode,
        // พิกัด: หมุดที่ผู้ใช้ปัก หรือจุดกลางตำบล (ดู resolveActivityCoords)
        ...coords,
        ...extras.data,
        policies: { create: extras.policies },
        ...(linkField.links && linkField.links.length > 0 && {
          links: { create: linkField.links.map((l, i) => ({ url: l.url, title: l.title || null, kind: l.kind, sortOrder: i })) },
        }),
        ...(team.ids && team.ids.length > 0 && { members: { create: team.ids.map((uid) => ({ userId: uid })) } }),
        status: status as (typeof STATUSES)[number],
        startDate,
        endDate,
      },
    });

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

    await writeAuditLog({
      action: 'CREATE',
      entityId: activity.id,
      entityName: activity.title,
      userId,
    });

    return NextResponse.json({ message: 'บันทึกการดำเนินงานสำเร็จ', activityId: activity.id });
  } catch (error) {
    console.error('Error creating activity:', error);
    return NextResponse.json(
      { error: 'ไม่สามารถบันทึกข้อมูลได้ โปรดลองอีกครั้ง' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
    }

    const activities = await prisma.activity.findMany({
      where: involvedWhere(Number(session.user.id)),
      include: {
        category: { select: { name: true } },
        attachments: { select: { id: true, kind: true, filePath: true, fileName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ activities });
  } catch (error) {
    console.error('Error fetching activities:', error);
    return NextResponse.json({ error: 'ไม่สามารถดึงข้อมูลได้' }, { status: 500 });
  }
}
