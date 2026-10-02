// app/api/farewell/area/route.ts — ค้นหาตำบลจากชื่อ (สาธารณะ ไม่ต้อง login) สำหรับหน้า /farewell
// ใช้ข้อมูล regions.ts ฝั่ง server อย่างเดียว ไม่แตะ DB และไม่เรียก GISTDA (ต่างจาก /api/geo/search ของทีมงาน)
import { NextRequest, NextResponse } from 'next/server';
import { searchRegions } from '@/app/lib/regionLookup';

export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get('q') ?? '').trim().slice(0, 80);
  if (q.length < 2) return NextResponse.json({ results: [] });
  const results = searchRegions(q, 8).map((r) => ({ district: r.district, amphoe: r.amphoe, province: r.province }));
  return NextResponse.json({ results });
}
