// Seed ประเด็นงานตั้งต้น (อิงหมวดจากชีตพื้นที่ดำเนินงานเดิม — เกลาชื่อ/ตัดโน้ตภายในออกแล้ว)
// รัน: node scripts/seed-categories.mjs
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const categories = [
  'Civic Space',
  'งานสื่อสาร',
  'ชุมชนหัวใจเพชร',
  'เฝ้าระวังและบังคับใช้กฎหมาย',
  'ปฐมวัย',
  'โรงเรียนคำพ่อสอน',
  'โพธิสัตว์น้อย',
  'ครูดีไม่มีอบายมุข',
  'งานบุญประเพณี',
  'พื้นที่สร้างสรรค์',
  'เยาวชนระดับอำเภอ',
  'Futsal SDN',
  'เครือข่ายพระสงฆ์นักพัฒนา',
];

for (const name of categories) {
  await prisma.workCategory.upsert({
    where: { name },
    update: {},
    create: { name },
  });
}

const count = await prisma.workCategory.count();
console.log(`seeded — total categories: ${count}`);
await prisma.$disconnect();
