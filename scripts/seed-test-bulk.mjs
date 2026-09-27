// เพิ่มข้อมูลทดสอบชุดใหญ่ — 20 งาน กระจายหลายจังหวัด/ประเด็น/สถานะ
// ใช้ผู้ใช้ @test.sdn เดิม + เพิ่มอีก 2 คน (ลบทั้งหมดได้ด้วย seed-test-data.mjs --clean)
// พื้นที่สุ่มจาก app/data/tambon.json จึงมีพิกัดจริงเสมอ
// รัน: node scripts/seed-test-bulk.mjs
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { readFileSync } from 'fs';

const prisma = new PrismaClient();

// อ่าน mapping จังหวัด→โซน จาก healthZones.ts (แหล่งความจริงเดียว)
const zoneSrc = readFileSync('app/utils/healthZones.ts', 'utf8');
const ZONE = Object.fromEntries(
  [...zoneSrc.matchAll(/"([^"]+)":\s*"(north-upper|north-lower|northeast-upper|northeast-lower|central|east|west|south-upper|south-lower|bangkok)"/g)]
    .map((m) => [m[1], m[2]])
);

const tambons = JSON.parse(readFileSync('app/data/tambon.json', 'utf8')).data;
const byProvince = new Map();
for (const t of tambons) {
  if (typeof t.LAT !== 'number') continue;
  const list = byProvince.get(t.CHANGWAT_T) ?? [];
  list.push(t);
  byProvince.set(t.CHANGWAT_T, list);
}

// สุ่มแบบกำหนด seed ให้ผลซ้ำได้
let seed = 20260805;
const rnd = () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
};
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];

const password = bcrypt.hashSync('12345', 10);
const userDefs = [
  { firstName: 'สมชาย', lastName: 'ใจดี', email: 'somchai@test.sdn' },
  { firstName: 'สมหญิง', lastName: 'รักงาน', email: 'somying@test.sdn' },
  { firstName: 'วิชัย', lastName: 'พัฒนา', email: 'wichai@test.sdn' },
  { firstName: 'ปราณี', lastName: 'สุขใจ', email: 'pranee@test.sdn' },
  { firstName: 'ธนกร', lastName: 'มั่นคง', email: 'thanakorn@test.sdn' },
];
const users = {};
for (const d of userDefs) {
  users[d.email] = await prisma.user.upsert({
    where: { email: d.email },
    update: {},
    create: { ...d, password, role: 'member' },
  });
}

const categories = await prisma.workCategory.findMany({ where: { isActive: true } });

// จังหวัดเป้าหมาย — ตัวเลขคือจำนวนงานที่จะสร้าง (จังหวัดที่ซ้ำเยอะ = จุดกระจุกให้เห็นบน heat map)
const plan = [
  ['เชียงราย', 3], ['ขอนแก่น', 3], ['สงขลา', 2], ['อุบลราชธานี', 2],
  ['นครราชสีมา', 2], ['เชียงใหม่', 2], ['พิษณุโลก', 1], ['สุราษฎร์ธานี', 1],
  ['ชลบุรี', 1], ['กาญจนบุรี', 1], ['สกลนคร', 1], ['ลำปาง', 1],
];

const TITLES = [
  'ชุมชนต้นแบบงดเหล้าเข้าพรรษา',
  'รณรงค์งานบุญปลอดเหล้า',
  'เยาวชนคนรุ่นใหม่ไม่ดื่ม',
  'เฝ้าระวังร้านค้ารอบสถานศึกษา',
  'ครอบครัวอบอุ่นปลอดแอลกอฮอล์',
  'อบรมแกนนำชุมชนหัวใจเพชร',
  'สื่อสารสาธารณะลดนักดื่มหน้าใหม่',
  'งานศพปลอดเหล้าต้นแบบ',
  'ลานกีฬาสร้างสรรค์ต้านเหล้า',
  'พัฒนาศักยภาพพี่เลี้ยงชุมชน',
];
const STATUSES = ['ACTIVE', 'ACTIVE', 'ACTIVE', 'PLANNING', 'COMPLETED'];

let created = 0;
for (const [province, count] of plan) {
  const pool = byProvince.get(province);
  if (!pool) {
    console.warn(`ข้ามจังหวัด ${province} — ไม่พบในข้อมูลตำบล`);
    continue;
  }
  for (let i = 0; i < count; i++) {
    const t = pick(pool);
    const cat = pick(categories);
    const user = users[pick(userDefs).email];
    const status = pick(STATUSES);
    const title = `${pick(TITLES)} ${t.AMPHOE_T}`;

    const exists = await prisma.activity.findFirst({ where: { title, userId: user.id } });
    if (exists) continue;

    const startMonth = 1 + Math.floor(rnd() * 7);
    await prisma.activity.create({
      data: {
        title,
        description: `ข้อมูลทดสอบระบบ — ดำเนินงานประเด็น "${cat.name}" ในพื้นที่ ต.${t.TAMBON_T} อ.${t.AMPHOE_T} จ.${province} โดยประสานภาคีในพื้นที่ร่วมขับเคลื่อน`,
        categoryId: cat.id,
        userId: user.id,
        areaName: rnd() > 0.5 ? `ชุมชนบ้าน${t.TAMBON_T}` : null,
        district: t.TAMBON_T,
        amphoe: t.AMPHOE_T,
        province,
        region: ZONE[province] ?? 'central',
        latitude: t.LAT,
        longitude: t.LONG,
        status,
        startDate: new Date(2026, startMonth, 1 + Math.floor(rnd() * 27)),
        endDate: status === 'COMPLETED' ? new Date(2026, startMonth + 2, 15) : null,
      },
    });
    created++;
  }
}

const total = await prisma.activity.count();
const provinces = (await prisma.activity.groupBy({ by: ['province'] })).length;
console.log(`สร้างงานใหม่ ${created} รายการ — รวมทั้งหมด ${total} งาน ใน ${provinces} จังหวัด`);
await prisma.$disconnect();
