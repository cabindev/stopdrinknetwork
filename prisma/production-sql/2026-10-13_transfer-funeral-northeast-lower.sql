-- 2026-10-13 โอนงานศพปลอดเหล้า ภาคอีสานล่าง จาก sdn.warehouse@gmail.com → suwanlaya.80@gmail.com
-- (เจ้าหน้าที่ดูแลงานศพภาคอีสานล่าง) — แก้ข้อมูลอย่างเดียว ไม่แก้โครงสร้างตาราง
-- ทำแบบเดียวกับปุ่ม "โอนงาน" ในตารางแอดมิน (POST /api/admin/activities/transfer):
--   เปลี่ยน Activity.userId · ผู้รับที่อยู่ในทีมงานถูกเอาออกจากทีม · audit log "ผู้รับผิดชอบ" ทุกงาน
-- ขอบเขต: ประเด็นย่อย "งานศพปลอดเหล้า" + region = northeast-lower (ภาคอีสานล่าง 9 จังหวัด:
--   นครราชสีมา ชัยภูมิ บุรีรัมย์ สุรินทร์ ศรีสะเกษ อุบลราชธานี ยโสธร อำนาจเจริญ มุกดาหาร) + เจ้าของปัจจุบัน = sdn.warehouse
--   รวมงานในถังขยะด้วย (ถ้ากู้คืนจะได้อยู่กับเจ้าของที่ถูกต้อง)
--
-- วิธีรัน (phpMyAdmin → แท็บ SQL): สำรองฐานข้อมูลก่อน → วางทั้งไฟล์ → Go
--   ผลลัพธ์ชุดแรก = ตรวจผู้ใช้ 2 บัญชี · ชุดสุดท้าย = งานที่โอนแล้ว (owner ต้องเป็น suwanlaya ทุกแถว)
--   ถ้าไม่พบบัญชี suwanlaya (ยังไม่สมัคร) ไฟล์นี้จะไม่เปลี่ยนอะไรเลย · รันซ้ำได้ (รอบสองไม่มีงานเหลือให้โอน)

-- อีเมลเขียนตรงในคำสั่ง ไม่ใช้ตัวแปรข้อความ (ตัวแปร session คนละ collation กับคอลัมน์ → error 1267)
SET @from_id = (SELECT `id` FROM `User` WHERE `email` = 'sdn.warehouse@gmail.com');
SET @to_id   = (SELECT `id` FROM `User` WHERE `email` = 'suwanlaya.80@gmail.com');
SET @from_name = (SELECT COALESCE(NULLIF(TRIM(CONCAT_WS(' ', `firstName`, `lastName`)), ''), `email`) FROM `User` WHERE `id` = @from_id);
SET @to_name   = (SELECT COALESCE(NULLIF(TRIM(CONCAT_WS(' ', `firstName`, `lastName`)), ''), `email`) FROM `User` WHERE `id` = @to_id);

-- 1) ตรวจบัญชี — ต้องเห็น 2 แถว · suwanlaya ควรเป็น member/admin (ถ้ายัง pending ให้อนุมัติก่อน ไม่งั้นเปิดงานของตัวเองไม่ได้)
SELECT `id`, `email`, `firstName`, `lastName`, `role` FROM `User` WHERE `id` IN (@from_id, @to_id);

START TRANSACTION;

DROP TEMPORARY TABLE IF EXISTS `_transfer_ids`;
CREATE TEMPORARY TABLE `_transfer_ids` (`id` INT PRIMARY KEY, `title` VARCHAR(191) NOT NULL);
INSERT INTO `_transfer_ids` (`id`, `title`)
SELECT a.`id`, a.`title`
FROM `Activity` a
JOIN `WorkSubCategory` s ON s.`id` = a.`subCategoryId`
WHERE s.`name` = 'งานศพปลอดเหล้า'
  AND a.`region` = 'northeast-lower'
  AND a.`userId` = @from_id
  AND @to_id IS NOT NULL;

-- 2) ประวัติการแก้ไข (ผู้กระทำ = sdn.warehouse เจ้าของเดิมที่สั่งโอน)
INSERT INTO `AuditLog` (`action`, `entityType`, `entityId`, `entityName`, `changes`, `userId`, `createdAt`)
SELECT 'UPDATE', 'Activity', t.`id`, t.`title`,
       JSON_ARRAY(JSON_OBJECT('field', 'userId', 'label', 'ผู้รับผิดชอบ', 'from', @from_name, 'to', @to_name)),
       @from_id, NOW(3)
FROM `_transfer_ids` t;

-- 3) ผู้รับเคยอยู่ในทีมงาน → เอาออก (เป็นผู้รับผิดชอบแล้ว)
DELETE m FROM `ActivityMember` m JOIN `_transfer_ids` t ON t.`id` = m.`activityId` WHERE m.`userId` = @to_id;

-- 4) โอน
UPDATE `Activity` a JOIN `_transfer_ids` t ON t.`id` = a.`id` SET a.`userId` = @to_id, a.`updatedAt` = NOW(3);

COMMIT;

-- 5) ตรวจผล — งานศพอีสานล่างทั้งหมด แยกตามจังหวัดและเจ้าของ
SELECT a.`province` AS `จังหวัด`, u.`email` AS `ผู้รับผิดชอบ`, COUNT(*) AS `งาน`, SUM(a.`deletedAt` IS NOT NULL) AS `ในถังขยะ`
FROM `Activity` a
JOIN `WorkSubCategory` s ON s.`id` = a.`subCategoryId`
JOIN `User` u ON u.`id` = a.`userId`
WHERE s.`name` = 'งานศพปลอดเหล้า' AND a.`region` = 'northeast-lower'
GROUP BY a.`province`, u.`email`
ORDER BY a.`province`;

DROP TEMPORARY TABLE IF EXISTS `_transfer_ids`;
