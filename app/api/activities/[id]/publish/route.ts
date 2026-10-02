// app/api/activities/[id]/publish/route.ts — แอดมินเผยแพร่/แก้เนื้อหา/ยกเลิกเผยแพร่กรณีศึกษา
// body: { storyLead, storyProcess, storyLessons, publicAttachmentIds: number[], publicLinkIds?: number[], publish: boolean,
//         series?: null | { id: number | null, title, description, order } }  (ไม่ส่ง series = ไม่แตะชุดเดิม)
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/app/lib/db';
import { getAdminUser } from '@/app/lib/adminAuth';
import { writeAuditLog } from '@/app/lib/audit';

const MAX_STORY = 20_000;
const text = (v: unknown) => (typeof v === 'string' ? v.trim().slice(0, MAX_STORY) || null : null);

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getAdminUser();
    if (!admin) return NextResponse.json({ error: 'เฉพาะแอดมินเท่านั้น' }, { status: 403 });

    const id = Number((await params).id);
    const activity = Number.isInteger(id)
      ? await prisma.activity.findUnique({
          where: { id },
          include: { attachments: { select: { id: true } }, links: { select: { id: true } }, series: { select: { id: true, title: true } } },
        })
      : null;
    if (!activity) return NextResponse.json({ error: 'ไม่พบงาน' }, { status: 404 });

    const body = await request.json();
    const publish = Boolean(body.publish);
    const ownIds = new Set(activity.attachments.map((a) => a.id));
    const publicIds = (Array.isArray(body.publicAttachmentIds) ? body.publicAttachmentIds : [])
      .map(Number)
      .filter((x: number) => ownIds.has(x)); // ต้องเป็นไฟล์ของงานนี้เท่านั้น
    // ลิงก์: ไม่ส่งมา (ไคลเอนต์เก่า) = ไม่แตะ · ส่งมา = ตั้งตามที่ติ๊ก (ต้องเป็นลิงก์ของงานนี้)
    const ownLinks = new Set(activity.links.map((l) => l.id));
    const publicLinkIds: number[] | null = Array.isArray(body.publicLinkIds)
      ? body.publicLinkIds.map(Number).filter((x: number) => ownLinks.has(x))
      : null;

    // ชุดกรณีศึกษา: null = ออกจากชุด · id null = สร้างชุดใหม่ · id = เข้าชุดนั้น (แก้ชื่อ/บทนำของชุดได้)
    let seriesData: { seriesId: number | null; seriesOrder: number } | null = null;
    let seriesNote: string | null = null;
    if (body.series !== undefined) {
      if (body.series === null) {
        seriesData = { seriesId: null, seriesOrder: 0 };
        if (activity.series) seriesNote = `ออกจากชุดกรณีศึกษา "${activity.series.title}"`;
      } else {
        const sTitle = typeof body.series.title === 'string' ? body.series.title.trim().slice(0, 200) : '';
        if (!sTitle) return NextResponse.json({ error: 'กรุณาตั้งชื่อชุดกรณีศึกษา' }, { status: 400 });
        const sDesc = text(body.series.description);
        const order = Math.min(999, Math.max(1, Math.round(Number(body.series.order)) || 1));
        let seriesId: number;
        if (body.series.id == null) {
          seriesId = (await prisma.storySeries.create({ data: { title: sTitle, description: sDesc } })).id;
        } else {
          const found = await prisma.storySeries.findUnique({ where: { id: Number(body.series.id) } });
          if (!found) return NextResponse.json({ error: 'ไม่พบชุดกรณีศึกษาที่เลือก' }, { status: 400 });
          seriesId = found.id;
          if (found.title !== sTitle || (found.description ?? null) !== sDesc) {
            await prisma.storySeries.update({ where: { id: seriesId }, data: { title: sTitle, description: sDesc } });
          }
        }
        seriesData = { seriesId, seriesOrder: order };
        if (activity.series?.id !== seriesId) seriesNote = `เข้าชุดกรณีศึกษา "${sTitle}" (ลำดับ ${order})`;
      }
    }

    await prisma.$transaction([
      prisma.activityAttachment.updateMany({ where: { activityId: id }, data: { isPublic: false } }),
      prisma.activityAttachment.updateMany({ where: { id: { in: publicIds } }, data: { isPublic: true } }),
      ...(publicLinkIds
        ? [
            prisma.activityLink.updateMany({ where: { activityId: id }, data: { isPublic: false } }),
            prisma.activityLink.updateMany({ where: { id: { in: publicLinkIds } }, data: { isPublic: true } }),
          ]
        : []),
      prisma.activity.update({
        where: { id },
        data: {
          storyLead: text(body.storyLead),
          storyProcess: text(body.storyProcess),
          storyLessons: text(body.storyLessons),
          ...(seriesData ?? {}),
          isPublished: publish,
          // เผยแพร่ครั้งแรกเก็บวันที่ไว้ (แก้เนื้อหาทีหลังวันที่ไม่เปลี่ยน) · ยกเลิกเผยแพร่ = ล้าง
          publishedAt: publish ? activity.publishedAt ?? new Date() : null,
          publishedById: publish ? activity.publishedById ?? admin.id : null,
        },
      }),
    ]);

    // ชุดที่ไม่เหลือเรื่อง (รวมเรื่องในถังขยะ — กู้คืนแล้วยังอยู่ในชุด) ลบทิ้ง
    if (seriesData) await prisma.storySeries.deleteMany({ where: { activities: { none: {} } } });

    const changed = activity.isPublished !== publish;
    await writeAuditLog({
      action: 'UPDATE',
      entityId: id,
      entityName: activity.title,
      userId: admin.id,
      changes: [
        changed
          ? publish
            ? `เผยแพร่เป็นกรณีศึกษาสาธารณะ (ไฟล์สาธารณะ ${publicIds.length} ไฟล์)`
            : 'ยกเลิกการเผยแพร่กรณีศึกษา'
          : `แก้เนื้อหากรณีศึกษา (ไฟล์สาธารณะ ${publicIds.length} ไฟล์)`,
        ...(seriesNote ? [seriesNote] : []),
      ],
    });

    return NextResponse.json({ message: publish ? 'เผยแพร่แล้ว' : 'บันทึกแล้ว (ยังไม่เผยแพร่)', isPublished: publish });
  } catch (error) {
    console.error('Error publishing story:', error);
    return NextResponse.json({ error: 'บันทึกไม่สำเร็จ' }, { status: 500 });
  }
}

// PATCH — สลับเผยแพร่/ยกเลิกอย่างเดียว (toggle ในตารางแอดมิน) ไม่แตะเนื้อหาเรื่องและไฟล์สาธารณะ
// body: { publish: boolean }
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getAdminUser();
    if (!admin) return NextResponse.json({ error: 'เฉพาะแอดมินเท่านั้น' }, { status: 403 });

    const id = Number((await params).id);
    const activity = Number.isInteger(id) ? await prisma.activity.findUnique({ where: { id } }) : null;
    if (!activity) return NextResponse.json({ error: 'ไม่พบงาน' }, { status: 404 });

    const publish = Boolean((await request.json()).publish);
    if (activity.isPublished === publish) return NextResponse.json({ isPublished: publish });

    await prisma.activity.update({
      where: { id },
      data: {
        isPublished: publish,
        publishedAt: publish ? activity.publishedAt ?? new Date() : null,
        publishedById: publish ? activity.publishedById ?? admin.id : null,
      },
    });

    await writeAuditLog({
      action: 'UPDATE',
      entityId: id,
      entityName: activity.title,
      userId: admin.id,
      changes: [publish ? 'เผยแพร่เป็นกรณีศึกษาสาธารณะ (จากตารางงาน)' : 'ยกเลิกการเผยแพร่กรณีศึกษา (จากตารางงาน)'],
    });

    return NextResponse.json({ isPublished: publish });
  } catch (error) {
    console.error('Error toggling publish:', error);
    return NextResponse.json({ error: 'บันทึกไม่สำเร็จ' }, { status: 500 });
  }
}
