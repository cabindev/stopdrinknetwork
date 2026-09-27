// app/api/activities/export/route.ts — ส่งออกการดำเนินงานเป็น Excel (ต้อง login)
// query: mine=1 (เฉพาะของตัวเอง), category=<ชื่อ>, sub=<ประเด็นย่อย>, status=<PLANNING|ACTIVE|COMPLETED>, q=<ค้นหา>
// เบอร์/LINE ผู้ประสานงาน: ใส่เฉพาะไฟล์ที่แอดมินส่งออก (สมาชิกทั่วไปไม่มีคอลัมน์นี้ — PDPA)
// ไฟล์มี 2 ชีต: "รายการงาน" + "สรุป" (รายจังหวัด/รายประเด็น)
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import ExcelJS from 'exceljs';
import authOptions from '@/app/lib/configs/auth/authOptions';
import { involvedWhere } from '@/app/lib/activityAccess';
import prisma from '@/app/lib/db';
import { getThaiZoneName } from '@/app/utils/healthZones';
import type { HealthZone } from '@/app/utils/healthZones';
import { parsePartners, policyShape, policyDetailText, formatStartDate, POLICY_LABEL, AREA_SCOPE_LABEL } from '@/app/lib/activityMeta';

const STATUS_TH: Record<string, string> = {
  PLANNING: 'วางแผน',
  ACTIVE: 'กำลังดำเนินการ',
  COMPLETED: 'เสร็จสิ้น',
};

const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFEA580C' }, // orange-600
};

const fmtDate = (d: Date | null) =>
  d ? new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium' }).format(d) : '';

function styleHeaderRow(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { vertical: 'middle' };
  });
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
    }

    const params = request.nextUrl.searchParams;
    const mine = params.get('mine') === '1';
    const category = params.get('category') ?? '';
    const sub = params.get('sub') ?? '';
    const isAdmin = ['admin', 'superadmin'].includes(session.user.role ?? '');
    const status = params.get('status') ?? '';
    const q = (params.get('q') ?? '').toLowerCase();

    const rows = await prisma.activity.findMany({
      where: {
        ...(mine ? involvedWhere(Number(session.user.id)) : {}),
        ...(status ? { status: status as 'PLANNING' | 'ACTIVE' | 'COMPLETED' } : {}),
        ...(category ? { category: { name: category } } : {}),
        ...(sub ? { subCategory: { name: sub } } : {}),
      },
      include: {
        category: { select: { name: true } },
        subCategory: { select: { name: true } },
        user: { select: { firstName: true, lastName: true } },
        attachments: { select: { kind: true } },
        policies: true,
      },
      orderBy: [{ province: 'asc' }, { createdAt: 'desc' }],
    });

    // ค้นหาอิสระ — ใช้เงื่อนไขเดียวกับหน้าแผนที่
    const filtered = q
      ? rows.filter((a) =>
          `${a.title} ${a.province} ${a.amphoe} ${a.district} ${a.areaName ?? ''} ${a.user.firstName} ${a.user.lastName} ${a.category.name}`
            .toLowerCase()
            .includes(q)
        )
      : rows;

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Stop Drink Network';
    wb.created = new Date();

    // ── ชีต 1: รายการงาน ──
    const ws = wb.addWorksheet('รายการงาน', { views: [{ state: 'frozen', ySplit: 1 }] });
    ws.columns = [
      { header: 'ลำดับ', key: 'no', width: 7 },
      { header: 'ชื่อกิจกรรม/โครงการ', key: 'title', width: 42 },
      { header: 'ประเด็นงาน', key: 'category', width: 24 },
      { header: 'ประเด็นย่อย', key: 'subCategory', width: 24 },
      { header: 'สถานะ', key: 'status', width: 15 },
      { header: 'ผู้รับผิดชอบ', key: 'user', width: 22 },
      { header: 'ชื่อชุมชน/พื้นที่', key: 'areaName', width: 26 },
      { header: 'ตำบล', key: 'district', width: 16 },
      { header: 'อำเภอ', key: 'amphoe', width: 16 },
      { header: 'จังหวัด', key: 'province', width: 16 },
      { header: 'ภาค', key: 'region', width: 12 },
      { header: 'วันเริ่ม', key: 'startDate', width: 14 },
      { header: 'วันสิ้นสุด', key: 'endDate', width: 14 },
      { header: 'ผู้เข้าร่วม (คน)', key: 'participants', width: 12 },
      { header: 'ภาคีที่ร่วม', key: 'partners', width: 36 },
      { header: 'นโยบาย/ข้อตกลง (ระดับ)', key: 'policy', width: 26 },
      { header: 'รายละเอียดนโยบาย', key: 'policyDetail', width: 44 },
      { header: 'ขอบเขตพื้นที่', key: 'scope', width: 14 },
      { header: 'หมู่บ้าน', key: 'villages', width: 9 },
      { header: 'ครัวเรือน', key: 'households', width: 10 },
      { header: 'ประชากร', key: 'population', width: 10 },
      { header: 'ผู้ประสานงาน', key: 'coordinator', width: 26 },
      ...(isAdmin
        ? [
            { header: 'เบอร์ผู้ประสานงาน', key: 'coordinatorPhone', width: 16 },
            { header: 'LINE ผู้ประสานงาน', key: 'coordinatorLine', width: 16 },
          ]
        : []),
      { header: 'รูป', key: 'images', width: 6 },
      { header: 'เอกสาร', key: 'docs', width: 8 },
      { header: 'รายละเอียด', key: 'description', width: 60 },
      { header: 'บันทึกเมื่อ', key: 'createdAt', width: 16 },
    ];
    styleHeaderRow(ws.getRow(1));

    filtered.forEach((a, i) => {
      ws.addRow({
        no: i + 1,
        title: a.title,
        category: a.category.name,
        subCategory: a.subCategory?.name ?? '',
        participants: a.participantCount ?? '',
        partners: parsePartners(a.partners).join(', '),
        policy: policyShape(a.policies).levels.map((l) => POLICY_LABEL[l]).join(', '),
        policyDetail: (() => {
          const { levels: lv, details: d } = policyShape(a.policies);
          return lv.map((l) => d[l] && `${POLICY_LABEL[l]}: ${policyDetailText(d[l])}`).filter(Boolean).join(' · ');
        })(),
        scope: AREA_SCOPE_LABEL[a.areaScope] ?? '',
        villages: a.coverageVillages ?? '',
        households: a.coverageHouseholds ?? '',
        population: a.coveragePopulation ?? '',
        coordinator: [a.coordinatorName, a.coordinatorRole].filter(Boolean).join(' · '),
        ...(isAdmin ? { coordinatorPhone: a.coordinatorPhone ?? '', coordinatorLine: a.coordinatorLine ?? '' } : {}),
        status: STATUS_TH[a.status] ?? a.status,
        user: `${a.user.firstName} ${a.user.lastName}`,
        areaName: a.areaName ?? '',
        district: a.district,
        amphoe: a.amphoe,
        province: a.province,
        region: getThaiZoneName(a.region as HealthZone), // หัวคอลัมน์ "ภาค" แล้ว ค่าจึงไม่ต้องมีคำว่าภาคซ้ำ
        startDate: formatStartDate(a.startDate, a.startDatePrecision) ?? '',
        endDate: a.endDate ? fmtDate(a.endDate) : a.startDate ? 'ต่อเนื่อง' : '',
        images: a.attachments.filter((x) => x.kind === 'IMAGE').length,
        docs: a.attachments.filter((x) => x.kind === 'DOCUMENT').length,
        description: a.description,
        createdAt: fmtDate(a.createdAt),
      });
    });
    ws.getColumn('description').alignment = { wrapText: true, vertical: 'top' };

    // ── ชีต 2: สรุป ──
    const sum = wb.addWorksheet('สรุป');
    sum.getCell('A1').value = 'สรุปการดำเนินงาน Stop Drink Network';
    sum.getCell('A1').font = { bold: true, size: 14 };
    sum.getCell('A2').value = `ส่งออกเมื่อ ${fmtDate(new Date())} · ทั้งหมด ${filtered.length} งาน`;
    sum.getCell('A2').font = { color: { argb: 'FF6B7280' } };

    // รายจังหวัด
    const byProvince = new Map<string, { zone: string; count: number; users: Set<string> }>();
    for (const a of filtered) {
      const e = byProvince.get(a.province) ?? {
        zone: getThaiZoneName(a.region as HealthZone),
        count: 0,
        users: new Set<string>(),
      };
      e.count++;
      e.users.add(`${a.user.firstName} ${a.user.lastName}`);
      byProvince.set(a.province, e);
    }
    let r = 4;
    sum.getCell(`A${r}`).value = 'รายจังหวัด';
    sum.getCell(`A${r}`).font = { bold: true };
    r++;
    const provHeader = sum.getRow(r);
    provHeader.values = ['จังหวัด', 'ภาค', 'จำนวนงาน', 'จำนวนเจ้าหน้าที่'];
    styleHeaderRow(provHeader);
    r++;
    [...byProvince.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .forEach(([province, e]) => {
        sum.getRow(r).values = [province, e.zone, e.count, e.users.size];
        r++;
      });

    // รายประเด็น
    r += 1;
    const byCategory = new Map<string, { count: number; provinces: Set<string> }>();
    for (const a of filtered) {
      const e = byCategory.get(a.category.name) ?? { count: 0, provinces: new Set<string>() };
      e.count++;
      e.provinces.add(a.province);
      byCategory.set(a.category.name, e);
    }
    sum.getCell(`A${r}`).value = 'รายประเด็นงาน';
    sum.getCell(`A${r}`).font = { bold: true };
    r++;
    const catHeader = sum.getRow(r);
    catHeader.values = ['ประเด็นงาน', 'จำนวนงาน', 'จำนวนจังหวัด'];
    styleHeaderRow(catHeader);
    r++;
    [...byCategory.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .forEach(([name, e]) => {
        sum.getRow(r).values = [name, e.count, e.provinces.size];
        r++;
      });
    sum.getColumn(1).width = 32;
    sum.getColumn(2).width = 16;
    sum.getColumn(3).width = 14;
    sum.getColumn(4).width = 18;

    const buffer = await wb.xlsx.writeBuffer();
    const date = new Date().toISOString().slice(0, 10);
    const filename = mine ? `sdn-my-activities-${date}.xlsx` : `sdn-activities-${date}.xlsx`;

    return new NextResponse(Buffer.from(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Error exporting activities:', error);
    return NextResponse.json({ error: 'ส่งออกไม่สำเร็จ โปรดลองอีกครั้ง' }, { status: 500 });
  }
}
