import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import prisma from '@/app/lib/db';

export async function POST(req: NextRequest) {
  try {
    const { token, password } = await req.json();

    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiresAt: { gt: new Date() },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'รหัสยืนยันไม่ถูกต้องหรือหมดอายุแล้ว' }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenCreatedAt: null,
        resetTokenExpiresAt: null,
        lastPasswordReset: new Date(),
      },
    });

    if (updatedUser) {
      return NextResponse.json({ message: 'รีเซ็ตรหัสผ่านสำเร็จ' });
    } else {
      return NextResponse.json({ error: 'ไม่สามารถอัพเดทรหัสผ่านได้' }, { status: 500 });
    }
  } catch (error) {
    console.error('Error resetting password:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการรีเซ็ตรหัสผ่าน' }, { status: 500 });
  }
}
