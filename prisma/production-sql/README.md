# SQL สำหรับฐานข้อมูล production

เซิร์ฟเวอร์ deploy ด้วย `git pull` และแก้ฐานข้อมูลด้วย SQL โดยตรง (phpMyAdmin/mysql) — **ไม่รัน prisma migrate บนเซิร์ฟเวอร์**

## ลำดับ deploy เมื่อมีไฟล์ SQL ใหม่
1. สำรองฐานข้อมูล production (phpMyAdmin → Export)
2. รันไฟล์ SQL ที่ยังไม่เคยรัน **ตามลำดับชื่อไฟล์** (ดูตารางด้านล่าง)
3. Plesk → Git → Pull now → Node.js → Run script: build → Restart App (รายละเอียด: `docs/deploy-plesk.md`)

> ต้องรัน SQL **ก่อน** เปิดโค้ดใหม่ — โค้ดใหม่อ่านตาราง/คอลัมน์ใหม่ทันที

## ไฟล์ที่มี
| ไฟล์ | เนื้อหา | รันบน production แล้ว |
|---|---|---|
| `2026-09-27_upgrade.sql` | นโยบาย → ตาราง ActivityPolicy · ทีมงาน ActivityMember · ถังขยะ · role enum · index | **ไม่ต้องรัน** — production สร้างใหม่จาก dump ที่อัปเกรดแล้ว (27 ก.ย. 2026) |
| `2026-09-28_activity-links.sql` | ตาราง ActivityLink (แนบลิงก์ FB/YouTube/Drive/ข่าว) | ✅ รันแล้ว 28 ก.ย. 2026 (ตรวจโครงสร้าง 8 คอลัมน์ครบ) |

ไฟล์นี้ทดสอบแล้วกับสำเนาฐานข้อมูล ณ 27 ก.ย. 2026 (ก่อนปรับ) — ผลตรงกับ `schema.prisma` ทุกคอลัมน์
ถ้าฐานข้อมูล production เก่ากว่านั้น (เช่น ยังไม่มีตาราง WorkSubCategory หรือคอลัมน์ policyLevels) ห้ามรัน —
ส่งโครงสร้าง (Export แบบ Structure only) ให้ผู้พัฒนาสร้าง SQL ที่ตรงกับสภาพจริงก่อน
