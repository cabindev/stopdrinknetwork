// app/api/categories/route.ts — รายการประเด็นงานที่เปิดใช้ (สำหรับ dropdown ในฟอร์ม)
import { NextResponse } from 'next/server';
import prisma from '@/app/lib/db';

export async function GET() {
  try {
    const categories = await prisma.workCategory.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        description: true,
        subCategories: {
          where: { isActive: true },
          select: { id: true, name: true },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        },
      },
      orderBy: { name: 'asc' },
    });
    return NextResponse.json({ categories });
  } catch (error) {
    console.error('Error fetching categories:', error);
    return NextResponse.json({ error: 'ไม่สามารถดึงประเด็นงานได้' }, { status: 500 });
  }
}
