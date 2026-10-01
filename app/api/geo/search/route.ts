// app/api/geo/search/route.ts — ค้นหาพื้นที่ดำเนินงานจากช่องเดียว (LocationField)
// ส่งผลเป็นกลุ่ม:
//   q ว่าง → recent: สถานที่ที่ผู้ใช้เคยบันทึกล่าสุด (แตะเดียวใช้ซ้ำ)
//   q มีคำ → saved: สถานที่ที่เครือข่ายเคยบันทึกใน DB (ฐานข้อมูลของเราเอง มีชุมชนเล็กที่ GISTDA ไม่มี)
//            places: GISTDA Sphere (เรียงใกล้ตำบลที่เลือกไว้ก่อน) · regions: ตำบลจาก regions.ts
// ทุกรายการมี region (ตำบล/อำเภอ/จังหวัด/โซน) ให้ฟอร์มเติมอัตโนมัติ
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import authOptions from '@/app/lib/configs/auth/authOptions';
import { isStaffRole } from '@/app/lib/activityMeta';
import prisma from '@/app/lib/db';
import { provinceAt } from '@/app/lib/provinceGeo';
import { getTambonCoords, nearestTambon } from '@/app/lib/tambonCoords';
import { isInThailandBox } from '@/app/lib/geoLink';
import { reverseGeocode, searchPlaces, searchNearby, sphereKey } from '@/app/lib/sphere';
import { findRegion, searchRegions, looksLikeRegionQuery } from '@/app/lib/regionLookup';
import { planPlaceSearch, matchRank } from '@/app/lib/placeQuery';
import type { SphereItem } from '@/app/lib/sphere';

const ADDRESS_RE =
  /(?:ต\.|ตำบล|แขวง)\s*([^\s,]+)\s+(?:อ\.|อำเภอ|เขต)\s*([^\s,]+)\s+(?:จ\.|จังหวัด)?\s*([^\s,\d]+)/;

// ตำบลของสถานที่: ที่อยู่ "ต./อ./จ." → reverse geocoding → เดาจากจุดกลางตำบลที่ใกล้สุด
async function matchRegion(address: string, lat: number, lng: number) {
  const m = address.match(ADDRESS_RE);
  if (m) {
    const hit = findRegion(m[1], m[2], m[3] === 'กรุงเทพฯ' ? 'กรุงเทพมหานคร' : m[3]);
    if (hit) return { region: hit, guessed: false };
  }
  const reversed = await reverseGeocode(lat, lng);
  if (reversed) return { region: reversed, guessed: false };
  const province = provinceAt(lat, lng);
  const near = province && nearestTambon(lat, lng, province);
  const hit = near && findRegion(near.district, near.amphoe, near.province);
  return hit ? { region: hit, guessed: true } : null;
}

type ActivityPlaceRow = {
  areaName: string | null;
  district: string;
  amphoe: string;
  province: string;
  latitude: number | null;
  longitude: number | null;
  locationSource: string;
};

// แปลงงานใน DB เป็นรายการสถานที่ (ตัดซ้ำด้วย ชื่อ+ตำบล) — หมุดจุดกลางตำบลไม่นับเป็นพิกัดจริง
function toSavedPlaces(rows: ActivityPlaceRow[], limit: number) {
  const seen = new Set<string>();
  const out = [];
  for (const a of rows) {
    const k = `${a.areaName ?? ''}|${a.district}|${a.amphoe}|${a.province}`;
    if (seen.has(k)) continue;
    const region = findRegion(a.district, a.amphoe, a.province);
    if (!region) continue;
    seen.add(k);
    const precise = a.locationSource !== 'TAMBON' && a.latitude != null && a.longitude != null;
    out.push({
      id: `saved:${k}`,
      name: a.areaName ?? `ต.${a.district}`,
      address: `ต.${a.district} อ.${a.amphoe} จ.${a.province}`,
      lat: precise ? a.latitude : null,
      lng: precise ? a.longitude : null,
      region,
    });
    if (out.length === limit) break;
  }
  return out;
}

const PLACE_SELECT = {
  areaName: true,
  district: true,
  amphoe: true,
  province: true,
  latitude: true,
  longitude: true,
  locationSource: true,
} as const;

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
  }
  if (!isStaffRole(session.user.role)) {
    return NextResponse.json({ error: 'บัญชีรอผู้ดูแลระบบอนุมัติ' }, { status: 403 });
  }
  const sp = request.nextUrl.searchParams;
  const q = (sp.get('q') ?? '').trim().slice(0, 100);

  if (q.length === 0) {
    const rows = await prisma.activity.findMany({
      where: { userId: Number(session.user.id) },
      select: PLACE_SELECT,
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });
    return NextResponse.json({ recent: toSavedPlaces(rows, 6) });
  }
  if (q.length < 2) return NextResponse.json({ saved: [], places: [], regions: [] });

  // พื้นที่ที่เลือกไว้ในฟอร์ม — ให้ Sphere เรียงผลใกล้จุดกลางตำบลนั้นก่อน + จังหวัดเดียวกันขึ้นก่อน
  const province = sp.get('province') ?? '';
  const near = province ? getTambonCoords(sp.get('district') ?? '', sp.get('amphoe') ?? '', province) : null;

  // คำค้นหลายแบบ: เดิม + ขยายตัวย่อ (สภ. → สถานีตำรวจภูธร) + "ประเภท + พื้นที่" (สถานีตำรวจ น่าน)
  const plan = planPlaceSearch(q);
  const sphereCalls: Promise<SphereItem[]>[] = plan.keywords.map((k) => searchPlaces(k, near));
  if (plan.area && plan.areaKeyword.length >= 2) {
    // ผลตามระยะใส่ไว้หน้าสุด — พอ sort ด้วย matchRank (เสถียร) ผลในพื้นที่จะนำหน้าผลชื่อตรงจากที่อื่น
    sphereCalls.unshift(searchNearby(plan.areaKeyword, plan.area.lat, plan.area.lng));
  }

  const [savedRows, placeResult] = await Promise.all([
    prisma.activity.findMany({
      where: { OR: [...new Set([q, plan.expanded])].map((k) => ({ areaName: { contains: k } })) },
      select: PLACE_SELECT,
      orderBy: { updatedAt: 'desc' },
      take: 50,
    }),
    sphereKey()
      ? Promise.allSettled(sphereCalls).then((rs) => {
          const items = rs.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
          const failed = rs.every((r) => r.status === 'rejected');
          if (failed) console.error('Error searching places:', rs);
          return { items, error: failed ? 'ค้นหาสถานที่จาก GISTDA ไม่สำเร็จ' : '' };
        })
      : Promise.resolve({ items: [] as SphereItem[], error: 'ยังไม่ได้ตั้งค่าคีย์ GISTDA' }),
  ]);

  // ชื่อตรงคำค้นขึ้นก่อน (sort เสถียร — ภายในระดับเดียวกันคงลำดับความใกล้ของ Sphere)
  const rankKeywords = [...plan.keywords, plan.areaKeyword].filter(Boolean);
  placeResult.items.sort((a, b) => matchRank(a.name ?? '', rankKeywords) - matchRank(b.name ?? '', rankKeywords));

  // ตู้ ATM ชื่อพ่วงสถานที่ดัง (เช่น "เอทีเอ็ม ธนาคารออมสิน วัดพระธาตุดอยสุเทพ") ท่วมผล → ตัด ยกเว้นตั้งใจค้น
  const skipAtm = !/เอทีเอ็ม|atm|ตู้/i.test(q);
  const seen = new Set<string>();
  const picked = [];
  for (const it of placeResult.items) {
    if (it.obsoleted || typeof it.lat !== 'number' || typeof it.lon !== 'number' || !it.name) continue;
    if (!isInThailandBox(it.lat, it.lon)) continue;
    if (skipAtm && /^(เอทีเอ็ม|ATM|ตู้)/i.test(it.name.trim())) continue;
    // Sphere มีรายการซ้ำชื่อเดียวกันที่พิกัดต่างกันเล็กน้อย (อาคาร/ประตูคนละจุด, ประถม+อนุบาล)
    // → ชื่อเดียวกันในกริด ~1 กม. ถือเป็นที่เดียว (โรงเรียนชื่อซ้ำต่างอำเภอยังแยกกัน)
    const dup = `${it.name}|${it.lat.toFixed(2)}|${it.lon.toFixed(2)}`;
    if (seen.has(dup)) continue;
    seen.add(dup);
    picked.push(it);
    if (picked.length === 12) break;
  }
  const places = await Promise.all(
    picked.map(async (it) => {
      // Sphere บางรายการมีคำว่า NULL ค้างในที่อยู่ (เช่น "...จ.เชียงใหม่ NULL")
      const cleaned = (it.address ?? '').replace(/\bNULL\b/g, '').replace(/\s+/g, ' ').trim();
      const address = /[ก-๙]/.test(cleaned) ? cleaned : '';
      const match = await matchRegion(address, it.lat!, it.lon!);
      return {
        id: it.id ?? `${it.name}|${it.lat}|${it.lon}`,
        name: it.name!,
        address,
        lat: Math.round(it.lat! * 1e6) / 1e6,
        lng: Math.round(it.lon! * 1e6) / 1e6,
        region: match?.region ?? null,
        regionGuessed: match?.guessed ?? false,
      };
    })
  );
  // "ประเภท + พื้นที่" → เก็บเฉพาะผลในจังหวัด/อำเภอนั้น (ถ้ากรองแล้วไม่เหลือ ใช้ผลทั้งหมดแทน)
  let shown = places;
  if (plan.area) {
    const a = plan.area;
    const inArea = places.filter(
      (p) => p.region?.province === a.province && (a.kind === 'province' || p.region?.amphoe === a.amphoe)
    );
    if (inArea.length > 0) shown = inArea;
  }
  if (province) {
    shown.sort(
      (a, b) => Number(b.region?.province === province) - Number(a.region?.province === province)
    );
  }

  return NextResponse.json({
    saved: toSavedPlaces(savedRows, 4),
    places: shown.slice(0, 8),
    regions: searchRegions(q, 5),
    regionsFirst: looksLikeRegionQuery(q),
    placesError: placeResult.error,
  });
}
