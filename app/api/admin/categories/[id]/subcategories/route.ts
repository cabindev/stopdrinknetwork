// app/api/admin/categories/[id]/subcategories/route.ts — เพิ่มประเด็นย่อยใต้ประเด็นงาน (admin/superadmin)
import { NextRequest, NextResponse } from 'next/server';
import prisma, { ACTIVE_ACTIVITY } from '@/app/lib/db';
import { getAdminUser } from '@/app/lib/adminAuth';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await getAdminUser())) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }
    const categoryId = Number((await params).id);
    const category = Number.isInteger(categoryId)
      ? await prisma.workCategory.findUnique({ where: { id: categoryId } })
      : null;
    if (!category) return NextResponse.json({ error: 'ไม่พบประเด็นงาน' }, { status: 404 });

    const name = String((await request.json()).name ?? '').trim().slice(0, 120);
    if (!name) return NextResponse.json({ error: 'กรุณาระบุชื่อประเด็นย่อย' }, { status: 400 });
    const dup = await prisma.workSubCategory.findUnique({ where: { categoryId_name: { categoryId, name } } });
    if (dup) return NextResponse.json({ error: 'มีประเด็นย่อยชื่อนี้แล้ว' }, { status: 400 });

    const last = await prisma.workSubCategory.aggregate({ where: { categoryId }, _max: { sortOrder: true } });
    const subCategory = await prisma.workSubCategory.create({
      data: { categoryId, name, sortOrder: (last._max.sortOrder ?? -1) + 1 },
      include: { _count: { select: { activities: { where: ACTIVE_ACTIVITY } } } },
    });
    return NextResponse.json({ message: 'เพิ่มประเด็นย่อยแล้ว', subCategory });
  } catch (error) {
    console.error('Error creating subcategory:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
