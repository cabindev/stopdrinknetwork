// app/api/farewell/area/route.ts — ค้นหาตำบลจากชื่อ (สาธารณะ ไม่ต้อง login) สำหรับหน้า /farewell
// ใช้ข้อมูล regions.ts ฝั่ง server + ตำแหน่งข้อตกลงงานศพปลอดเหล้า (ระดับตำบล — ข้อมูลสาธารณะอยู่แล้วบนแผนที่ /farewell)
// ไม่เรียก GISTDA (ต่างจาก /api/geo/search ของทีมงาน)
// ชื่อตำบลซ้ำหลายจังหวัด (เช่น หินดาด) → เรียงตำบลที่มีข้อตกลงขึ้นก่อน แล้วอำเภอ/จังหวัดที่มีข้อตกลง
// (QA 3 ต.ค. 2026: "หินดาด" เดิมขึ้นกาญจนบุรีก่อน ทั้งที่ชุมชนที่มีข้อตกลงอยู่นครราชสีมา — คนกดอันแรกจะได้ตำบลผิด)
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/app/lib/db';
import { FUNERAL_SUB } from '@/app/lib/farewellAgreements';
import { searchRegions } from '@/app/lib/regionLookup';

type Agreement = 'here' | 'amphoe' | 'province' | null;

// งานศพปลอดเหล้ามีไม่กี่สิบงาน — จำไว้ 5 นาที ไม่ต้อง query ทุกตัวอักษรที่พิมพ์
let cache: { at: number; rows: { district: string; amphoe: string; province: string }[] } | null = null;
async function agreementAreas() {
  if (cache && Date.now() - cache.at < 5 * 60_000) return cache.rows;
  const rows = await prisma.activity.findMany({
    where: { subCategory: { name: FUNERAL_SUB }, policies: { some: {} } },
    select: { district: true, amphoe: true, province: true },
    distinct: ['district', 'amphoe', 'province'],
  });
  cache = { at: Date.now(), rows };
  return rows;
}

const RANK: Record<string, number> = { here: 0, amphoe: 1, province: 2 };

export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get('q') ?? '').trim().slice(0, 80);
  if (q.length < 2) return NextResponse.json({ results: [] });

  const first = q.split(/\s+/)[0].replace(/^(ต\.|ตำบล|แขวง)\s*/, '');
  const hits = searchRegions(q, 40);
  const areas = await agreementAreas().catch(() => []);

  const results = hits
    .map((r, i) => {
      const agreement: Agreement = areas.some((a) => a.district === r.district && a.amphoe === r.amphoe && a.province === r.province)
        ? 'here'
        : areas.some((a) => a.amphoe === r.amphoe && a.province === r.province)
          ? 'amphoe'
          : areas.some((a) => a.province === r.province)
            ? 'province'
            : null;
      // ความตรงของชื่อยังมาก่อน (พิมพ์ "หิน" ไม่ควรเอา "บ้านหินลาด" ที่มีข้อตกลงขึ้นเหนือ "หินดาด")
      const match = r.district === first ? 0 : r.district.startsWith(first) ? 1 : 2;
      return { r, i, match, agreement };
    })
    .sort((a, b) => a.match - b.match || (RANK[a.agreement ?? ''] ?? 3) - (RANK[b.agreement ?? ''] ?? 3) || a.i - b.i)
    .slice(0, 8)
    .map(({ r, agreement }) => ({ district: r.district, amphoe: r.amphoe, province: r.province, agreement }));

  return NextResponse.json({ results });
}
