// app/api/admin/people/export/route.ts — ส่งออกรายชื่อที่เลือกเป็น Excel (admin/superadmin)
import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import prisma, { ACTIVE_ACTIVITY } from '@/app/lib/db';
import { getAdminUser } from '@/app/lib/adminAuth';
import { getThaiZoneName } from '@/app/utils/healthZones';
import type { HealthZone } from '@/app/utils/healthZones';

const ROLE_LABEL: Record<string, string> = {
  member: 'เจ้าหน้าที่',
  admin: 'ผู้ดูแลระบบ',
  superadmin: 'ผู้ดูแลสูงสุด',
};

export async function GET(request: NextRequest) {
  try {
    const admin = await getAdminUser();
    if (!admin) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const ids = (request.nextUrl.searchParams.get('ids') ?? '')
      .split(',')
      .map(Number)
      .filter((n) => Number.isInteger(n) && n > 0);

    const users = await prisma.user.findMany({
      where: ids.length > 0 ? { id: { in: ids } } : undefined,
      select: {
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

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Stop Drink Network';
    wb.created = new Date();
    const ws = wb.addWorksheet('รายชื่อ', { views: [{ state: 'frozen', ySplit: 1 }] });
    ws.columns = [
      { header: 'ลำดับ', key: 'no', width: 7 },
      { header: 'ชื่อ-นามสกุล', key: 'name', width: 26 },
      { header: 'ตำแหน่ง', key: 'position', width: 24 },
      { header: 'หน่วยงาน/ประชาคม', key: 'organization', width: 32 },
      { header: 'เบอร์โทร', key: 'phone', width: 16 },
      { header: 'อีเมล', key: 'email', width: 28 },
      { header: 'พื้นที่ที่ดูแล', key: 'provinces', width: 34 },
      { header: 'ภาค', key: 'zones', width: 20 },
      { header: 'จำนวนงาน', key: 'count', width: 11 },
      { header: 'บทบาท', key: 'role', width: 16 },
      { header: 'ลายมือชื่อ', key: 'sign', width: 20 },
    ];
    ws.getRow(1).eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEA580C' } };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    });

    users.forEach((u, i) => {
      const provinces = [...new Set(u.activities.map((a) => a.province))].sort();
      const zones = [...new Set(u.activities.map((a) => getThaiZoneName(a.region as HealthZone)))];
      ws.addRow({
        no: i + 1,
        name: `${u.firstName} ${u.lastName}`,
        position: u.position ?? '',
        organization: u.organization ?? '',
        phone: u.phone ?? '',
        email: u.email,
        provinces: provinces.join(', '),
        zones: zones.join(', '),
        count: u.activities.length,
        role: ROLE_LABEL[u.role] ?? u.role,
        sign: '',
      });
    });

    const buffer = await wb.xlsx.writeBuffer();
    const date = new Date().toISOString().slice(0, 10);
    return new NextResponse(Buffer.from(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="sdn-people-${date}.xlsx"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Error exporting people:', error);
    return NextResponse.json({ error: 'ส่งออกไม่สำเร็จ' }, { status: 500 });
  }
}
