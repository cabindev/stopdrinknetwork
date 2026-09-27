// ข้อมูลทดสอบระบบ — ผู้ใช้ @test.sdn 3 คน + งาน 10 รายการ (มีพื้นที่ทับซ้อนโดยตั้งใจ)
// รัน:  node scripts/seed-test-data.mjs
// ลบ:  node scripts/seed-test-data.mjs --clean
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// โซนของจังหวัดที่ใช้ในชุดทดสอบ (ค่าเดียวกับ app/utils/healthZones.ts)
const ZONE = {
  เชียงราย: 'north-upper',
  น่าน: 'north-upper',
  พะเยา: 'north-upper',
  ขอนแก่น: 'northeast-upper',
  อุบลราชธานี: 'northeast-lower',
  สงขลา: 'south-lower',
  สุพรรณบุรี: 'central',
};

if (process.argv.includes('--clean')) {
  const users = await prisma.user.findMany({ where: { email: { endsWith: '@test.sdn' } } });
  const ids = users.map((u) => u.id);
  const del = await prisma.activity.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  console.log(`ลบข้อมูลทดสอบแล้ว: users ${ids.length}, activities ${del.count}`);
  await prisma.$disconnect();
  process.exit(0);
}

const password = bcrypt.hashSync('12345', 10);

const userDefs = [
  { firstName: 'สมชาย', lastName: 'ใจดี', email: 'somchai@test.sdn' },
  { firstName: 'สมหญิง', lastName: 'รักงาน', email: 'somying@test.sdn' },
  { firstName: 'วิชัย', lastName: 'พัฒนา', email: 'wichai@test.sdn' },
];

const users = {};
for (const def of userDefs) {
  users[def.email] = await prisma.user.upsert({
    where: { email: def.email },
    update: {},
    create: { ...def, password, role: 'member' },
  });
}

const cat = async (name) => {
  const c = await prisma.workCategory.findUnique({ where: { name } });
  if (!c) throw new Error(`ไม่พบหมวด "${name}" — รัน seed-categories ก่อน`);
  return c.id;
};

// งานทดสอบ — เชียงราย: สมชาย+สมหญิง (ทับซ้อนระดับจังหวัด และ อ.เวียงชัย ทับซ้อนระดับอำเภอ)
const activityDefs = [
  { email: 'somchai@test.sdn', category: 'ชุมชนหัวใจเพชร', title: 'ชุมชนใหม่โพธิ์งามงดเหล้าเข้าพรรษา', areaName: 'ชุมชนใหม่โพธิ์งาม', district: 'เวียงชัย', amphoe: 'เวียงชัย', province: 'เชียงราย', zipcode: '57210', status: 'ACTIVE', startDate: '2026-07-01' },
  { email: 'somying@test.sdn', category: 'งานสื่อสาร', title: 'นักสื่อสารชุมชนรุ่นเยาว์ อ.เวียงชัย', areaName: 'โรงเรียนเวียงชัยวิทยาคม', district: 'เวียงชัย', amphoe: 'เวียงชัย', province: 'เชียงราย', zipcode: '57210', status: 'ACTIVE', startDate: '2026-06-15' },
  { email: 'somying@test.sdn', category: 'พื้นที่สร้างสรรค์', title: 'ลานกิจกรรมสร้างสรรค์เยาวชนเชียงราย', areaName: null, district: 'เวียง', amphoe: 'เมืองเชียงราย', province: 'เชียงราย', zipcode: '57000', status: 'PLANNING', startDate: null },
  { email: 'somchai@test.sdn', category: 'Civic Space', title: 'เด็กน่านโตที่บ้านเกิด', areaName: null, district: 'ในเวียง', amphoe: 'เมืองน่าน', province: 'น่าน', zipcode: '55000', status: 'ACTIVE', startDate: '2026-05-01' },
  { email: 'wichai@test.sdn', category: 'เฝ้าระวังและบังคับใช้กฎหมาย', title: 'เฝ้าระวังจุดจำหน่ายรอบสถานศึกษา พะเยา', areaName: 'บ้านจำป่าหวาย', district: 'จำป่าหวาย', amphoe: 'เมืองพะเยา', province: 'พะเยา', zipcode: '56000', status: 'ACTIVE', startDate: '2026-06-01' },
  { email: 'wichai@test.sdn', category: 'งานบุญประเพณี', title: 'งานบุญปลอดเหล้า บ้านไผ่', areaName: null, district: 'ในเมือง', amphoe: 'บ้านไผ่', province: 'ขอนแก่น', zipcode: '40110', status: 'COMPLETED', startDate: '2026-02-01', endDate: '2026-04-30' },
  { email: 'somchai@test.sdn', category: 'โพธิสัตว์น้อย', title: 'โพธิสัตว์น้อยชวนพ่อแม่เลิกเหล้า อุบลฯ', areaName: 'โรงเรียนบ้านหนองบัว', district: 'ในเมือง', amphoe: 'เมืองอุบลราชธานี', province: 'อุบลราชธานี', zipcode: '34000', status: 'ACTIVE', startDate: '2026-05-20' },
  { email: 'somying@test.sdn', category: 'Futsal SDN', title: 'ฟุตซอลเยาวชนปลอดเหล้า สงขลา', areaName: null, district: 'บ่อยาง', amphoe: 'เมืองสงขลา', province: 'สงขลา', zipcode: '90000', status: 'PLANNING', startDate: '2026-09-01' },
  { email: 'wichai@test.sdn', category: 'ปฐมวัย', title: 'ครอบครัวปฐมวัยห่างไกลแอลกอฮอล์ สุพรรณบุรี', areaName: 'ศูนย์พัฒนาเด็กเล็กท่าพี่เลี้ยง', district: 'ท่าพี่เลี้ยง', amphoe: 'เมืองสุพรรณบุรี', province: 'สุพรรณบุรี', zipcode: '72000', status: 'ACTIVE', startDate: '2026-06-10' },
  { email: 'somchai@test.sdn', category: 'เครือข่ายพระสงฆ์นักพัฒนา', title: 'พระสงฆ์นักพัฒนาชวนชุมชนงดเหล้า เชียงราย', areaName: 'วัดพระแก้ว', district: 'เวียง', amphoe: 'เมืองเชียงราย', province: 'เชียงราย', zipcode: '57000', status: 'ACTIVE', startDate: '2026-07-15' },
];

let created = 0;
for (const d of activityDefs) {
  const exists = await prisma.activity.findFirst({
    where: { title: d.title, userId: users[d.email].id },
  });
  if (exists) continue;
  await prisma.activity.create({
    data: {
      title: d.title,
      description: `ข้อมูลทดสอบระบบ — ${d.title} ดำเนินงานในพื้นที่ ${d.areaName ?? ''} ต.${d.district} อ.${d.amphoe} จ.${d.province}`,
      categoryId: await cat(d.category),
      userId: users[d.email].id,
      areaName: d.areaName,
      district: d.district,
      amphoe: d.amphoe,
      province: d.province,
      region: ZONE[d.province],
      zipcode: d.zipcode,
      status: d.status,
      startDate: d.startDate ? new Date(d.startDate) : null,
      endDate: d.endDate ? new Date(d.endDate) : null,
    },
  });
  created++;
}

const total = await prisma.activity.count();
console.log(`สร้างงานทดสอบใหม่ ${created} รายการ — Activity ทั้งหมดใน DB: ${total}`);
console.log('ผู้ใช้ทดสอบ (รหัสผ่าน 12345):', userDefs.map((u) => u.email).join(', '));
await prisma.$disconnect();
