// app/lib/focus.ts — เว็บนี้ขับเคลื่อนเรื่อง "งานศพปลอดเหล้า" อย่างเดียว (ผู้ใช้ตัดสินใจ 30 ต.ค. 2026)
// งานประเด็นอื่น (เช่น Civic Space) ถูก "ซ่อน" ไม่ลบ: หน้าแรก, แผนที่, กรณีศึกษา, แดชบอร์ด (สถิติ/ตาราง/Excel) และฟอร์มบันทึกงานล็อกประเด็น
// "งานของฉัน" (/activity) กับโปรไฟล์ยังเห็นครบ · ปิดโหมดนี้ = ตั้ง FOCUS_SUB เป็น null แล้วทุกหน้ากลับมาแสดงทุกประเด็น
// ไฟล์นี้ใช้ได้ทั้ง client/server (ไม่ import prisma) — ชื่อต้องตรงกับ FUNERAL_SUB ใน lib/farewellAgreements.ts
export const FOCUS_SUB: string | null = 'งานศพปลอดเหล้า';

/** เงื่อนไข Prisma ของงานที่แสดงได้ — ใส่ใน AND: [...] เสมอ (ห้าม spread ปนกับ subCategory ของตัวกรอง ไม่งั้นทับกัน) */
export const FOCUS_WHERE = FOCUS_SUB ? { subCategory: { name: FOCUS_SUB } } : {};
