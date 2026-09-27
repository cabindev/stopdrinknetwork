// seed ประเด็นย่อยตั้งต้น (ร่าง ก.ย. 2026 — แอดมินแก้/เพิ่มต่อได้ที่ /dashboard/setting/categories)
// รันซ้ำได้: มีชื่อนี้อยู่แล้วจะข้าม
// node scripts/seed-subcategories.mjs
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DRAFT = {
  // ประเพณีปลอดเหล้า
  'งานบุญประเพณี': [
    'งานศพปลอดเหล้า',
    'งานบุญบั้งไฟปลอดเหล้า',
    'งานแข่งเรือปลอดเหล้า',
    'ลอยกระทงปลอดเหล้า',
    'ปีใหม่ปลอดเหล้า',
    'สงกรานต์ปลอดเหล้า',
    'งานบวชปลอดเหล้า',
    'งานแต่งปลอดเหล้า',
    'เข้าพรรษา-ออกพรรษาปลอดเหล้า',
    'งานกฐิน-ผ้าป่าปลอดเหล้า',
    'งานวัด/งานประจำปีปลอดเหล้า',
    'ประเพณีท้องถิ่นอื่น ๆ',
  ],
};

let created = 0;
for (const [categoryName, subs] of Object.entries(DRAFT)) {
  const category = await prisma.workCategory.findUnique({ where: { name: categoryName } });
  if (!category) {
    console.log(`ข้าม: ไม่พบประเด็นงาน "${categoryName}"`);
    continue;
  }
  for (const [i, name] of subs.entries()) {
    const exists = await prisma.workSubCategory.findUnique({
      where: { categoryId_name: { categoryId: category.id, name } },
    });
    if (exists) continue;
    await prisma.workSubCategory.create({ data: { categoryId: category.id, name, sortOrder: i } });
    created++;
  }
}
console.log(`เพิ่มประเด็นย่อย ${created} รายการ`);
await prisma.$disconnect();
