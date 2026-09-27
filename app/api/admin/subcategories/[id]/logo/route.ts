// app/api/admin/subcategories/[id]/logo/route.ts — อัปโหลด/ลบโลโก้ประเด็นย่อย (admin/superadmin)
// แผนที่ใช้โลโก้ประเด็นย่อยก่อน → ไม่มีค่อยใช้โลโก้ประเด็นหลัก → ไม่มีเลยใช้หมุดสี
import { NextRequest, NextResponse } from 'next/server';
import prisma, { ACTIVE_ACTIVITY } from '@/app/lib/db';
import { getAdminUser } from '@/app/lib/adminAuth';
import { saveLogo, removeLogoFile } from '@/app/lib/logoStorage';

async function findSub(params: Promise<{ id: string }>) {
  const id = Number((await params).id);
  return Number.isInteger(id) ? prisma.workSubCategory.findUnique({ where: { id } }) : null;
}
const withCount = { _count: { select: { activities: { where: ACTIVE_ACTIVITY } } } } as const;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await getAdminUser())) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }
    const sub = await findSub(params);
    if (!sub) return NextResponse.json({ error: 'ไม่พบประเด็นย่อย' }, { status: 404 });
    const saved = await saveLogo((await request.formData()).get('logo'), `sub-${sub.id}`);
    if ('error' in saved) return NextResponse.json({ error: saved.error }, { status: 400 });
    const subCategory = await prisma.workSubCategory.update({
      where: { id: sub.id },
      data: { logo: saved.rel },
      include: withCount,
    });
    await removeLogoFile(sub.logo);
    return NextResponse.json({ message: 'บันทึกโลโก้แล้ว', subCategory });
  } catch (error) {
    console.error('Error uploading subcategory logo:', error);
    return NextResponse.json({ error: 'อัปโหลดโลโก้ไม่สำเร็จ' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await getAdminUser())) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }
    const sub = await findSub(params);
    if (!sub) return NextResponse.json({ error: 'ไม่พบประเด็นย่อย' }, { status: 404 });
    const subCategory = await prisma.workSubCategory.update({
      where: { id: sub.id },
      data: { logo: null },
      include: withCount,
    });
    await removeLogoFile(sub.logo);
    return NextResponse.json({ message: 'ลบโลโก้แล้ว', subCategory });
  } catch (error) {
    console.error('Error deleting subcategory logo:', error);
    return NextResponse.json({ error: 'ลบโลโก้ไม่สำเร็จ' }, { status: 500 });
  }
}
