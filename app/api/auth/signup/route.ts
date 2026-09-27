//api/auth/signup/route.ts
import bcrypt from 'bcrypt';
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import prisma from '@/app/lib/db';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const firstName = formData.get('firstName') as string;
    const lastName = formData.get('lastName') as string;
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const image = formData.get('image') as File | null;

    // Check if user with the same email already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return new NextResponse(JSON.stringify({ error: 'มีอีเมลนี้แล้วในระบบ' }), { status: 400 });
    }

    // Validate password strength
    if (password.length < 5) {
      return new NextResponse(JSON.stringify({ error: 'รหัสผ่านต้องมีความยาวอย่างน้อย 5 ตัวอักษร' }), { status: 400 });
    }

    // Hash the password
    const hashedPassword = bcrypt.hashSync(password, 10);

    let imagePath = '';
    if (image) {
      const bufferData = Buffer.from(await image.arrayBuffer());
      const timestamp = new Date().getTime();
      const fileExtension = path.extname(image.name) || '.jpg';
      const fileName = `${timestamp}${fileExtension}`;
      const imageSavePath = path.join(process.cwd(), 'public/img', fileName);

      await fs.writeFile(imageSavePath, bufferData);
      imagePath = `/img/${fileName}`;
    }

    // Create the new user
    const newUser = await prisma.user.create({
      data: {
        firstName,
        lastName,
        email,
        password: hashedPassword,
        image: imagePath || null,
      },
    });

    // Return success response
    return new NextResponse(JSON.stringify({ message: 'ลงทะเบียนสำเร็จ', userId: newUser.id }), { status: 200 });
  } catch (error) {
    console.error('Error creating user:', error);
    return new NextResponse(JSON.stringify({ error: 'ไม่สามารถสร้างบัญชีผู้ใช้ได้ โปรดลองอีกครั้ง' }), { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const userCount = await prisma.user.count();
    return new NextResponse(JSON.stringify({ userCount }), { status: 200 });
  } catch (error) {
    console.error('Error fetching user count:', error);
    return new NextResponse(JSON.stringify({ error: 'ไม่สามารถดึงจำนวนผู้ใช้ได้' }), { status: 500 });
  }
}
