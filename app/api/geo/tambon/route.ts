// app/api/geo/tambon/route.ts — จุดกลางตำบล (ให้แผนที่ปักหมุดในฟอร์มซูมไปถูกที่)
// + ถ้าส่ง lat/lng มา: เช็คว่าหมุดอยู่ในจังหวัดที่เลือกไหม และหมุดตกตำบลไหนจริง (Reverse geocoding)
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import authOptions from '@/app/lib/configs/auth/authOptions';
import { isStaffRole } from '@/app/lib/activityMeta';
import { getTambonCoords } from '@/app/lib/tambonCoords';
import { isInProvince } from '@/app/lib/provinceGeo';
import { reverseGeocode } from '@/app/lib/sphere';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
  }
  if (!isStaffRole(session.user.role)) {
    return NextResponse.json({ error: 'บัญชีรอผู้ดูแลระบบอนุมัติ' }, { status: 403 });
  }
  const q = request.nextUrl.searchParams;
  const district = q.get('district') ?? '';
  const amphoe = q.get('amphoe') ?? '';
  const province = q.get('province') ?? '';
  const lat = Number(q.get('lat'));
  const lng = Number(q.get('lng'));

  const center = getTambonCoords(district, amphoe, province);
  const hasPin = q.has('lat') && q.has('lng') && Number.isFinite(lat) && Number.isFinite(lng);
  const inside = hasPin ? isInProvince(lat, lng, province) : null;
  const pinRegion = hasPin ? await reverseGeocode(lat, lng) : null;
  return NextResponse.json({ center, inside, pinRegion });
}
