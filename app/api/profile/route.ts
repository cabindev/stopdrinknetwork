// app/api/profile/route.ts — แก้ไขโปรไฟล์ของตัวเอง (ชื่อ, ข้อมูลติดต่อ, รูป)
// รูปเก็บใน uploads/avatars/ แล้ว serve ผ่าน /api/files เหมือนไฟล์แนบ
// (ห้ามเก็บใน public/ เพราะ production จะไม่ serve ไฟล์ที่เพิ่มหลัง build)
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import path from 'path';
import fs from 'fs/promises';
import authOptions from '@/app/lib/configs/auth/authOptions';
import prisma from '@/app/lib/db';
import { IMAGE_TYPES, MAX_FILE_SIZE, UPLOAD_ROOT } from '@/app/lib/activityFiles';

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
    }
    const userId = Number(session.user.id);

    const formData = await request.formData();
    const firstName = String(formData.get('firstName') ?? '').trim();
    const lastName = String(formData.get('lastName') ?? '').trim();
    const phone = String(formData.get('phone') ?? '').trim() || null;
    const organization = String(formData.get('organization') ?? '').trim() || null;
    const position = String(formData.get('position') ?? '').trim() || null;
    const removeImage = String(formData.get('removeImage') ?? '') === '1';
    const image = formData.get('image');

    if (!firstName || !lastName) {
      return NextResponse.json({ error: 'กรุณากรอกชื่อและนามสกุล' }, { status: 400 });
    }
    if (phone && !/^[0-9+\-\s()]{6,20}$/.test(phone)) {
      return NextResponse.json({ error: 'รูปแบบเบอร์โทรไม่ถูกต้อง' }, { status: 400 });
    }

    const current = await prisma.user.findUnique({
      where: { id: userId },
      select: { image: true },
    });

    let imagePath: string | null | undefined; // undefined = ไม่แตะของเดิม
    if (image instanceof File && image.size > 0) {
      if (!IMAGE_TYPES.includes(image.type)) {
        return NextResponse.json(
          { error: 'รูปโปรไฟล์ต้องเป็น JPG, PNG, WebP หรือ GIF' },
          { status: 400 }
        );
      }
      if (image.size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: 'รูปเกิน 20MB' }, { status: 400 });
      }
      const ext = path.extname(image.name) || '.jpg';
      const fileName = `${userId}-${Date.now()}${ext}`;
      const relPath = path.join('avatars', fileName);
      const absPath = path.join(UPLOAD_ROOT, relPath);
      await fs.mkdir(path.dirname(absPath), { recursive: true });
      await fs.writeFile(absPath, Buffer.from(await image.arrayBuffer()));
      imagePath = `/api/files/${relPath.split(path.sep).join('/')}`;
    } else if (removeImage) {
      imagePath = null;
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        firstName,
        lastName,
        phone,
        organization,
        position,
        ...(imagePath !== undefined ? { image: imagePath } : {}),
      },
      select: { firstName: true, lastName: true, image: true },
    });

    // ลบไฟล์รูปเก่าที่อยู่ใน uploads/ (รูปเดิมใน public/img ปล่อยไว้ อาจถูกใช้ที่อื่น)
    if (imagePath !== undefined && current?.image?.startsWith('/api/files/')) {
      const old = current.image.replace('/api/files/', '');
      await fs.rm(path.join(UPLOAD_ROOT, old)).catch(() => {});
    }

    return NextResponse.json({ message: 'บันทึกโปรไฟล์แล้ว', user });
  } catch (error) {
    console.error('Error updating profile:', error);
    return NextResponse.json({ error: 'บันทึกไม่สำเร็จ โปรดลองอีกครั้ง' }, { status: 500 });
  }
}
