// app/map/page.tsx — แผนที่รวมการดำเนินงานทั้งองค์กร
// ทีมงานที่อนุมัติแล้ว = ข้อมูลเต็ม · ไม่ล็อกอิน/รออนุมัติ (pending) = โหมดสาธารณะ (ผู้ใช้ตัดสินใจ ต.ค. 2026): ทุกงานแต่กรองฝั่ง server —
//   ไม่มีชื่อเจ้าหน้าที่/ชื่อสถานที่/หมุดจริง (ใช้จุดกลางตำบล) · คลิกหมุดงานที่เผยแพร่แล้ว → /stories/[id]
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/lib/configs/auth/authOptions';
import prisma from '@/app/lib/db';
import MapView from './components/MapView';
import type { MapActivity } from './components/MapView';
import { getTambonCoords } from '@/app/lib/tambonCoords';
import { isStaffRole } from '@/app/lib/activityMeta';

export const metadata = { title: 'แผนที่รวม — Stop Drink Network' };

export default async function MapPage() {
  const session = await getServerSession(authOptions);
  const isPublic = !isStaffRole(session?.user?.role);
  const myId = Number(session?.user?.id ?? 0);
  const [rows, categories, subLogoRows] = await Promise.all([
    prisma.activity.findMany({
      include: {
        category: { select: { name: true } },
        subCategory: { select: { name: true } },
        user: { select: { firstName: true, lastName: true } },
        members: { where: { userId: myId }, select: { userId: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.workCategory.findMany({
      where: { isActive: true },
      select: { id: true, name: true, logo: true },
      orderBy: { name: 'asc' },
    }),
    prisma.workSubCategory.findMany({
      where: { logo: { not: null } },
      select: { id: true, name: true, logo: true, category: { select: { name: true } } },
    }),
  ]);

  const activities: MapActivity[] = rows.map((a) => {
    const base = {
      id: a.id,
      title: a.title,
      status: a.status,
      category: a.category.name,
      subCategory: a.subCategory?.name ?? null,
      district: a.district,
      amphoe: a.amphoe,
      province: a.province,
      region: a.region,
      createdAt: a.createdAt.toISOString(),
      published: a.isPublished,
    };
    if (isPublic) {
      // หมุดจริงอาจเป็นบ้านคน/ที่ทำงานผู้ประสานงาน → สาธารณะเห็นแค่จุดกลางตำบล (กติกาเดียวกับ /stories)
      const c =
        a.locationSource === 'TAMBON'
          ? a.latitude != null && a.longitude != null
            ? { lat: a.latitude, lng: a.longitude }
            : null
          : getTambonCoords(a.district, a.amphoe, a.province);
      return {
        ...base,
        userName: '',
        areaName: null,
        latitude: c?.lat ?? null,
        longitude: c?.lng ?? null,
        locationSource: 'TAMBON',
        mine: false,
      };
    }
    return {
      ...base,
      userName: `${a.user.firstName} ${a.user.lastName}`,
      areaName: a.areaName,
      latitude: a.latitude,
      longitude: a.longitude,
      locationSource: a.locationSource,
      mine: a.userId === myId || a.members.length > 0, // งานของตัวเอง/ทีมไม่นับเป็น "งานใหม่"
    };
  });

  // /api/files ต้อง login → สาธารณะใช้ /api/public-logo
  const logoUrl = (kind: 'category' | 'sub', id: number, logo: string) =>
    isPublic ? `/api/public-logo/${kind}/${id}` : `/api/files/${logo}`;

  return (
    <main className="bg-white">
      <MapView
        activities={activities}
        publicView={isPublic}
        categories={categories.map((c) => c.name)}
        // หมวดที่มีโลโก้ → หมุดบนแผนที่เป็นวงกลมโลโก้แทนจุดสี
        categoryLogos={Object.fromEntries(
          categories.filter((c) => c.logo).map((c) => [c.name, logoUrl('category', c.id, c.logo!)])
        )}
        // โลโก้ประเด็นย่อย key = "ประเด็น|ประเด็นย่อย" — ใช้ก่อนโลโก้ประเด็นหลัก
        subCategoryLogos={Object.fromEntries(
          subLogoRows.map((s) => [`${s.category.name}|${s.name}`, logoUrl('sub', s.id, s.logo!)])
        )}
      />
    </main>
  );
}
