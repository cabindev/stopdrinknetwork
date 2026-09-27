// app/api/admin/categories/[id]/logo/route.ts — อัปโหลด/ลบโลโก้ประเด็นงาน (admin/superadmin)
// browser ตัดขอบว่าง + ย่อเป็น WebP 256px มาแล้ว (ดู lib/logoImage.ts) — server ตรวจชนิด/ขนาดซ้ำอีกชั้น
// เก็บที่ uploads/category-logos/ (ไม่ใช่ public/ — production ไม่ serve ไฟล์ที่เพิ่มหลัง build)
// ไม่รับ SVG: เปิดตรงผ่าน /api/files ได้ = มีสคริปต์ฝังได้ (XSS)
import { NextRequest, NextResponse } from 'next/server';
import prisma, { ACTIVE_ACTIVITY } from '@/app/lib/db';
import { getAdminUser } from '@/app/lib/adminAuth';
import { saveLogo, removeLogoFile } from '@/app/lib/logoStorage';

async function parseId(params: Promise<{ id: string }>) {
  const id = Number((await params).id);
  return Number.isInteger(id) ? id : null;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await getAdminUser())) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }
    const id = await parseId(params);
    const category = id ? await prisma.workCategory.findUnique({ where: { id } }) : null;
    if (!category) return NextResponse.json({ error: 'ไม่พบประเด็นงาน' }, { status: 404 });

    const saved = await saveLogo((await request.formData()).get('logo'), String(category.id));
    if ('error' in saved) return NextResponse.json({ error: saved.error }, { status: 400 });
    const rel = saved.rel;

    const updated = await prisma.workCategory.update({
      where: { id: category.id },
      data: { logo: rel },
      include: { _count: { select: { activities: { where: ACTIVE_ACTIVITY } } } },
    });
    await removeLogoFile(category.logo);
    return NextResponse.json({ message: 'บันทึกโลโก้แล้ว', category: updated });
  } catch (error) {
    console.error('Error uploading category logo:', error);
    return NextResponse.json({ error: 'อัปโหลดโลโก้ไม่สำเร็จ' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await getAdminUser())) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }
    const id = await parseId(params);
    const category = id ? await prisma.workCategory.findUnique({ where: { id } }) : null;
    if (!category) return NextResponse.json({ error: 'ไม่พบประเด็นงาน' }, { status: 404 });

    const updated = await prisma.workCategory.update({
      where: { id: category.id },
      data: { logo: null },
      include: { _count: { select: { activities: { where: ACTIVE_ACTIVITY } } } },
    });
    await removeLogoFile(category.logo);
    return NextResponse.json({ message: 'ลบโลโก้แล้ว', category: updated });
  } catch (error) {
    console.error('Error deleting category logo:', error);
    return NextResponse.json({ error: 'ลบโลโก้ไม่สำเร็จ' }, { status: 500 });
  }
}
