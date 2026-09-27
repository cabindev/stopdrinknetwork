// app/api/activities/[id]/publish/route.ts — แอดมินเผยแพร่/แก้เนื้อหา/ยกเลิกเผยแพร่กรณีศึกษา
// body: { storyLead, storyProcess, storyLessons, publicAttachmentIds: number[], publish: boolean }
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
      ? await prisma.activity.findUnique({ where: { id }, include: { attachments: { select: { id: true } } } })
      : null;
    if (!activity) return NextResponse.json({ error: 'ไม่พบงาน' }, { status: 404 });

    const body = await request.json();
    const publish = Boolean(body.publish);
    const ownIds = new Set(activity.attachments.map((a) => a.id));
    const publicIds = (Array.isArray(body.publicAttachmentIds) ? body.publicAttachmentIds : [])
      .map(Number)
      .filter((x: number) => ownIds.has(x)); // ต้องเป็นไฟล์ของงานนี้เท่านั้น

    await prisma.$transaction([
      prisma.activityAttachment.updateMany({ where: { activityId: id }, data: { isPublic: false } }),
      prisma.activityAttachment.updateMany({ where: { id: { in: publicIds } }, data: { isPublic: true } }),
      prisma.activity.update({
        where: { id },
        data: {
          storyLead: text(body.storyLead),
          storyProcess: text(body.storyProcess),
          storyLessons: text(body.storyLessons),
          isPublished: publish,
          // เผยแพร่ครั้งแรกเก็บวันที่ไว้ (แก้เนื้อหาทีหลังวันที่ไม่เปลี่ยน) · ยกเลิกเผยแพร่ = ล้าง
          publishedAt: publish ? activity.publishedAt ?? new Date() : null,
          publishedById: publish ? activity.publishedById ?? admin.id : null,
        },
      }),
    ]);

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
