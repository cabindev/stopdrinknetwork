// app/api/admin/subcategories/[id]/route.ts — แก้ชื่อ/เปิดปิดประเด็นย่อย (admin/superadmin)
// ไม่มี DELETE โดยตั้งใจ (แบบเดียวกับประเด็นงาน): ปิด isActive แทน งานเดิมไม่เสีย reference
import { NextRequest, NextResponse } from 'next/server';
import prisma, { ACTIVE_ACTIVITY } from '@/app/lib/db';
import { getAdminUser } from '@/app/lib/adminAuth';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await getAdminUser())) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }
    const id = Number((await params).id);
    const current = Number.isInteger(id) ? await prisma.workSubCategory.findUnique({ where: { id } }) : null;
    if (!current) return NextResponse.json({ error: 'ไม่พบประเด็นย่อย' }, { status: 404 });

    const body = await request.json();
    const data: { name?: string; isActive?: boolean } = {};
    if (body.name !== undefined) {
      const name = String(body.name).trim().slice(0, 120);
      if (!name) return NextResponse.json({ error: 'ชื่อประเด็นย่อยห้ามว่าง' }, { status: 400 });
      const dup = await prisma.workSubCategory.findFirst({
        where: { categoryId: current.categoryId, name, NOT: { id } },
      });
      if (dup) return NextResponse.json({ error: 'มีประเด็นย่อยชื่อนี้แล้ว' }, { status: 400 });
      data.name = name;
    }
    if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);

    const subCategory = await prisma.workSubCategory.update({
      where: { id },
      data,
      include: { _count: { select: { activities: { where: ACTIVE_ACTIVITY } } } },
    });
    return NextResponse.json({ message: 'บันทึกแล้ว', subCategory });
  } catch (error) {
    console.error('Error updating subcategory:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
