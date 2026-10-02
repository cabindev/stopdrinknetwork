// app/api/farewell/agreements/route.ts — ข้อตกลงงานศพปลอดเหล้าใกล้พื้นที่ที่เลือก (สาธารณะ ไม่ต้อง login)
// ข้อมูลที่ส่งออกจำกัดตาม app/lib/farewellAgreements.ts
import { NextRequest, NextResponse } from 'next/server';
import { findRegion } from '@/app/lib/regionLookup';
import { getLocalAgreements } from '@/app/lib/farewellAgreements';

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const region = findRegion(sp.get('district') ?? '', sp.get('amphoe') ?? '', sp.get('province') ?? '');
  // รับเฉพาะตำบลที่มีจริงใน regions.ts กันการส่งค่าแปลก ๆ ไปถาม DB
  if (!region) return NextResponse.json({ error: 'ไม่พบตำบลนี้' }, { status: 400 });
  const agreements = await getLocalAgreements(region);
  return NextResponse.json({ agreements });
}
