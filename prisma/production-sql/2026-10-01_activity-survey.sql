-- ============================================================================
-- Stop Drink Network — ช่อง "มีแบบสำรวจ" + ไฟล์แบบสำรวจ · 1 ต.ค. 2026
-- รันครั้งเดียวใน phpMyAdmin บนฐาน StopDrinkNetwork (MariaDB 11.8) — Export สำรองก่อนเสมอ
-- ตรวจก่อนรัน: SHOW COLUMNS FROM `Activity` LIKE 'hasSurvey';  → ต้องว่าง (ถ้ามีแล้ว = รันไปแล้ว ห้ามรันซ้ำ)
-- ============================================================================

ALTER TABLE `Activity` ADD COLUMN `hasSurvey` BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE `ActivityAttachment` ADD COLUMN `isSurvey` BOOLEAN NOT NULL DEFAULT false;

-- ตรวจหลังรัน: SHOW COLUMNS FROM `Activity` LIKE 'hasSurvey';  และ  SHOW COLUMNS FROM `ActivityAttachment` LIKE 'isSurvey';  → ได้อย่างละ 1 แถว
