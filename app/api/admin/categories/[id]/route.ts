// app/api/admin/categories/[id]/route.ts — แก้ไข/เปิดปิดประเด็นงาน (admin/superadmin)
// ไม่มี DELETE โดยตั้งใจ: หมวดที่เลิกใช้ให้ปิด isActive แทน เพื่อไม่ให้ Activity เดิมเสีย reference
import { NextRequest, NextResponse } from 'next/server';
import prisma, { ACTIVE_ACTIVITY } from '@/app/lib/db';
import { getAdminUser } from '@/app/lib/adminAuth';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getAdminUser();
    if (!admin) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { id } = await params;
    const categoryId = Number(id);
    if (Number.isNaN(categoryId)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    const body = await request.json();
    const data: { name?: string; description?: string | null; isActive?: boolean } = {};

    if (body.name !== undefined) {
      const trimmed = String(body.name).trim();
      if (!trimmed) {
        return NextResponse.json({ error: 'ชื่อประเด็นงานห้ามว่าง' }, { status: 400 });
      }
      const dup = await prisma.workCategory.findFirst({
        where: { name: trimmed, NOT: { id: categoryId } },
      });
      if (dup) {
        return NextResponse.json({ error: 'มีประเด็นงานชื่อนี้อยู่แล้ว' }, { status: 400 });
      }
      data.name = trimmed;
    }
    if (body.description !== undefined) {
      data.description = String(body.description).trim() || null;
    }
    if (body.isActive !== undefined) {
      data.isActive = Boolean(body.isActive);
    }

    const category = await prisma.workCategory.update({
      where: { id: categoryId },
      data,
      include: { _count: { select: { activities: { where: ACTIVE_ACTIVITY } } } },
    });

    return NextResponse.json({ message: 'บันทึกสำเร็จ', category });
  } catch (error) {
    console.error('Error updating category:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
