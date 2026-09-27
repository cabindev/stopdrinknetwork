// app/api/admin/categories/route.ts — จัดการประเด็นงาน (admin/superadmin)
import { NextRequest, NextResponse } from 'next/server';
import prisma, { ACTIVE_ACTIVITY } from '@/app/lib/db';
import { getAdminUser } from '@/app/lib/adminAuth';

export async function GET() {
  try {
    const admin = await getAdminUser();
    if (!admin) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const categories = await prisma.workCategory.findMany({
      include: {
        _count: { select: { activities: { where: ACTIVE_ACTIVITY } } },
        subCategories: {
          include: { _count: { select: { activities: { where: ACTIVE_ACTIVITY } } } },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ categories });
  } catch (error) {
    console.error('Error fetching categories:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminUser();
    if (!admin) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { name, description } = await request.json();
    const trimmed = String(name ?? '').trim();
    if (!trimmed) {
      return NextResponse.json({ error: 'กรุณาระบุชื่อประเด็นงาน' }, { status: 400 });
    }

    const existing = await prisma.workCategory.findUnique({ where: { name: trimmed } });
    if (existing) {
      return NextResponse.json({ error: 'มีประเด็นงานชื่อนี้อยู่แล้ว' }, { status: 400 });
    }

    const category = await prisma.workCategory.create({
      data: { name: trimmed, description: String(description ?? '').trim() || null },
    });

    return NextResponse.json({ message: 'เพิ่มประเด็นงานสำเร็จ', category });
  } catch (error) {
    console.error('Error creating category:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
