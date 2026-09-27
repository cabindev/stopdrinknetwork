// app/map/page.tsx — แผนที่รวมการดำเนินงานทั้งองค์กร (ต้อง login)
import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import authOptions from '@/app/lib/configs/auth/authOptions';
import prisma from '@/app/lib/db';
import MapView from './components/MapView';
import type { MapActivity } from './components/MapView';

export const metadata = { title: 'แผนที่รวม — Stop Drink Network' };

export default async function MapPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect('/auth/signin');
  }

  const myId = Number(session.user.id);
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
      select: { name: true, logo: true },
      orderBy: { name: 'asc' },
    }),
    prisma.workSubCategory.findMany({
      where: { logo: { not: null } },
      select: { name: true, logo: true, category: { select: { name: true } } },
    }),
  ]);

  const activities: MapActivity[] = rows.map((a) => ({
    id: a.id,
    title: a.title,
    status: a.status,
    category: a.category.name,
    subCategory: a.subCategory?.name ?? null,
    userName: `${a.user.firstName} ${a.user.lastName}`,
    areaName: a.areaName,
    district: a.district,
    amphoe: a.amphoe,
    province: a.province,
    region: a.region,
    latitude: a.latitude,
    longitude: a.longitude,
    locationSource: a.locationSource,
    createdAt: a.createdAt.toISOString(),
    mine: a.userId === myId || a.members.length > 0, // งานของตัวเอง/ทีมไม่นับเป็น "งานใหม่"
  }));

  return (
    <main className="bg-white">
      <MapView
        activities={activities}
        categories={categories.map((c) => c.name)}
        // หมวดที่มีโลโก้ → หมุดบนแผนที่เป็นวงกลมโลโก้แทนจุดสี
        categoryLogos={Object.fromEntries(
          categories.filter((c) => c.logo).map((c) => [c.name, `/api/files/${c.logo}`])
        )}
        // โลโก้ประเด็นย่อย key = "ประเด็น|ประเด็นย่อย" — ใช้ก่อนโลโก้ประเด็นหลัก
        subCategoryLogos={Object.fromEntries(
          subLogoRows.map((s) => [`${s.category.name}|${s.name}`, `/api/files/${s.logo}`])
        )}
      />
    </main>
  );
}
