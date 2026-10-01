// proxy.ts — Next 16 เปลี่ยนชื่อจาก middleware.ts (ทำงานเหมือนเดิม)
import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

// หน้าแรกของคนที่ล็อกอินแล้ว = แผนที่รวมงาน
const HOME_AFTER_LOGIN = '/map';

// ล็อกอินแล้วไม่ต้องเห็นหน้า landing / เข้าสู่ระบบ / สมัครสมาชิกอีก
const GUEST_ONLY = ['/', '/auth/signin', '/auth/signup'];

export async function proxy(request: NextRequest) {
  const user = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  const { pathname } = request.nextUrl;

  if (user && GUEST_ONLY.includes(pathname)) {
    return NextResponse.redirect(new URL(HOME_AFTER_LOGIN, request.url));
  }

  // บัญชีรออนุมัติ: งานของทีม (/activity/*) เป็นข้อมูลภายใน → หน้าแจ้งรออนุมัติ
  // (role ใน cookie อาจค้าง pending ชั่วครู่หลังอนุมัติ — หน้า /auth/pending เช็คจาก DB แล้วพากลับเอง)
  if (user?.role === 'pending' && pathname.startsWith('/activity')) {
    return NextResponse.redirect(new URL('/auth/pending', request.url));
  }

  if (
    pathname.startsWith('/dashboard') &&
    (!user || !['admin', 'superadmin'].includes(user.role as string))
  ) {
    return NextResponse.redirect(new URL('/auth/signin', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/auth/signin', '/auth/signup', '/dashboard/:path*', '/activity/:path*'],
};
