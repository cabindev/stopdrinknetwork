// app/api/geo/reverse/route.ts — พิกัด → ตำบลจริง (+ สถานที่ใกล้เคียงถ้าขอ ?nearby=1)
// ใช้ตอนผู้ใช้กด GPS / วางลิงก์ / คลิกแผนที่ก่อนเลือกพื้นที่ → ฟอร์มเติมตำบล/อำเภอ/จังหวัด/โซนให้เอง
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import authOptions from '@/app/lib/configs/auth/authOptions';
import { isInThailandBox } from '@/app/lib/geoLink';
import { reverseGeocode, nearbyPlaces } from '@/app/lib/sphere';
import { provinceAt } from '@/app/lib/provinceGeo';
import { nearestTambon } from '@/app/lib/tambonCoords';
import { findRegion } from '@/app/lib/regionLookup';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
  }
  const sp = request.nextUrl.searchParams;
  const lat = Number(sp.get('lat'));
  const lng = Number(sp.get('lng'));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !isInThailandBox(lat, lng)) {
    return NextResponse.json({ error: 'พิกัดอยู่นอกประเทศไทย' }, { status: 400 });
  }

  const [reversed, nearby] = await Promise.all([
    reverseGeocode(lat, lng),
    sp.get('nearby') === '1' ? nearbyPlaces(lat, lng) : Promise.resolve([]),
  ]);
  let region = reversed;
  let guessed = false;
  if (!region) {
    // Sphere ใช้ไม่ได้ → เดาจากจังหวัดที่พิกัดตก + จุดกลางตำบลที่ใกล้สุด
    const province = provinceAt(lat, lng);
    const near = province && nearestTambon(lat, lng, province);
    region = near ? findRegion(near.district, near.amphoe, near.province) : null;
    guessed = !!region;
  }
  return NextResponse.json({ region, guessed, nearby });
}
