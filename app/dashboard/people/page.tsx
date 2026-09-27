// app/dashboard/people/page.tsx — รายชื่อเครือข่ายสำหรับงานธุรการ (เลือกรายชื่อเข้าประชุม)
import { redirect } from 'next/navigation';
import { Contact } from 'lucide-react';
import prisma, { ACTIVE_ACTIVITY } from '@/app/lib/db';
import { getAdminUser } from '@/app/lib/adminAuth';
import { getThaiZoneName } from '@/app/utils/healthZones';
import type { HealthZone } from '@/app/utils/healthZones';
import PeopleTable from './PeopleTable';
import type { PersonRow } from './PeopleTable';

export default async function PeoplePage() {
  const admin = await getAdminUser();
  if (!admin) redirect('/dashboard');

  const users = await prisma.user.findMany({
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      organization: true,
      position: true,
      role: true,
      activities: { where: ACTIVE_ACTIVITY, select: { province: true, region: true } },
    },
    orderBy: [{ firstName: 'asc' }],
  });

  const people: PersonRow[] = users.map((u) => {
    const provinces = [...new Set(u.activities.map((a) => a.province))].sort();
    const zones = [...new Set(u.activities.map((a) => getThaiZoneName(a.region as HealthZone)))];
    return {
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      phone: u.phone,
      organization: u.organization,
      position: u.position,
      role: u.role,
      provinces,
      zones,
      activityCount: u.activities.length,
    };
  });

  const withPhone = people.filter((p) => p.phone).length;

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-center gap-3 mb-1">
        <span className="flex w-10 h-10 rounded-xl bg-orange-50 border border-orange-100 items-center justify-center">
          <Contact className="w-5 h-5 text-orange-600" />
        </span>
        <div>
          <h1 className="text-xl font-bold text-gray-800">รายชื่อเครือข่าย</h1>
          <p className="text-sm text-gray-500">
            {people.length} คน · มีเบอร์ติดต่อ {withPhone} คน — เลือกรายชื่อเพื่อคัดลอก
            ส่งออก Excel หรือพิมพ์ใบลงชื่อเข้าประชุม
          </p>
        </div>
      </div>

      <div className="mt-5">
        <PeopleTable people={people} />
      </div>

      <p className="mt-4 text-xs text-gray-400">
        เบอร์โทร/ตำแหน่ง/หน่วยงาน มาจากที่แต่ละคนกรอกในหน้าโปรไฟล์ของตัวเอง —
        ถ้ายังว่างให้แจ้งเจ้าตัวอัปเดตที่เมนูโปรไฟล์
      </p>
    </div>
  );
}
