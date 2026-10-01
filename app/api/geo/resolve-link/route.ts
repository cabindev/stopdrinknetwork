// app/api/geo/resolve-link/route.ts — แปลงลิงก์ย่อ Google Maps (maps.app.goo.gl) เป็นพิกัด
// เบราว์เซอร์ตาม redirect ข้ามโดเมนเองไม่ได้ (CORS) จึงให้ server ตามแทน
// ตามเฉพาะโดเมนของ Google เท่านั้น (กัน SSRF) และจำกัดจำนวน hop
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import authOptions from '@/app/lib/configs/auth/authOptions';
import { isStaffRole } from '@/app/lib/activityMeta';
import { parseLatLng, isShortMapsLink } from '@/app/lib/geoLink';

const ALLOWED_HOST = /^(maps\.app\.goo\.gl|goo\.gl|(www\.|maps\.)?google\.(com|co\.th))$/i;
const MAX_HOPS = 5;

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
  }
  if (!isStaffRole(session.user.role)) {
    return NextResponse.json({ error: 'บัญชีรอผู้ดูแลระบบอนุมัติ' }, { status: 403 });
  }
  const { url } = (await request.json().catch(() => ({}))) as { url?: string };
  if (!url || !isShortMapsLink(url)) {
    return NextResponse.json({ error: 'รองรับเฉพาะลิงก์แชร์จาก Google Maps' }, { status: 400 });
  }

  let current = url.trim();
  try {
    for (let hop = 0; hop <= MAX_HOPS; hop++) {
      const u = new URL(current);
      if (u.protocol !== 'https:' || !ALLOWED_HOST.test(u.hostname)) break;

      const hit = parseLatLng(current);
      if (hit) return NextResponse.json(hit);

      const res = await fetch(current, {
        redirect: 'manual',
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'th' },
        signal: AbortSignal.timeout(8000),
      });
      const next = res.headers.get('location');
      if (res.status >= 300 && res.status < 400 && next) {
        current = new URL(next, current).toString();
        continue;
      }
      // หน้าสุดท้ายไม่มีพิกัดใน URL — ลองหาในเนื้อหา (หน้าสถานที่ของ Google ฝังพิกัดไว้)
      if (res.ok) {
        const html = (await res.text()).slice(0, 500_000);
        const inBody =
          html.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) ??
          html.match(/center=(-?\d+\.\d+)%2C(-?\d+\.\d+)/) ??
          html.match(/\[null,null,(-?\d+\.\d+),(-?\d+\.\d+)\]/);
        const fromBody = inBody && parseLatLng(`${inBody[1]},${inBody[2]}`);
        if (fromBody) return NextResponse.json(fromBody);
      }
      break;
    }
  } catch (error) {
    console.error('Error resolving maps link:', error);
  }
  return NextResponse.json(
    { error: 'อ่านพิกัดจากลิงก์นี้ไม่ได้ — ลองกดค้างที่หมุดใน Google Maps แล้วคัดลอกตัวเลขพิกัดมาวางแทน' },
    { status: 422 }
  );
}
