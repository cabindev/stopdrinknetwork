-- ============================================================================
-- Stop Drink Network — อัปเกรดฐานข้อมูล production (27 ก.ย. 2026)
-- รันครั้งเดียวใน phpMyAdmin / mysql client บนฐานข้อมูล production
--   1) นโยบายรายระดับ: JSON (Activity.policyLevels/policyDetails) → ตาราง ActivityPolicy
--   2) ทีมงานร่วม ActivityMember · ถังขยะ Activity.deletedAt · role เป็น enum · index เพิ่ม
--
-- ก่อนรัน: สำรองฐานข้อมูลก่อนเสมอ (Export ใน phpMyAdmin)
-- ใช้ได้กับ MySQL 5.7+ / MariaDB 10.2+ (ไม่ใช้ JSON_TABLE)
-- ห้ามรันซ้ำ — ถ้ามีตาราง ActivityPolicy อยู่แล้ว แปลว่ารันไปแล้ว
-- ============================================================================

-- ── ตรวจก่อนรัน: ต้องเห็นคอลัมน์ policyLevels, policyDetails (ถ้าไม่เห็น หยุดแล้วแจ้งผู้พัฒนา)
-- SHOW COLUMNS FROM `Activity` LIKE 'policy%';
-- SELECT role, COUNT(*) FROM `User` GROUP BY role;   -- ต้องมีแค่ member / admin / superadmin

-- ── 1) ตาราง ActivityPolicy + ย้ายข้อมูล ─────────────────────────────────────
CREATE TABLE `ActivityPolicy` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `activityId` INTEGER NOT NULL,
    `level` ENUM('VILLAGE', 'SUBDISTRICT', 'DISTRICT', 'PROVINCE', 'NATIONAL') NOT NULL,
    `name` VARCHAR(300) NULL,
    `type` VARCHAR(100) NULL,
    `year` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ActivityPolicy_level_idx`(`level`),
    INDEX `ActivityPolicy_type_idx`(`type`),
    INDEX `ActivityPolicy_year_idx`(`year`),
    UNIQUE INDEX `ActivityPolicy_activityId_level_key`(`activityId`, `level`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 1 ระดับที่ติ๊ก = 1 แถว (ระดับมีแค่ 5 ค่า จึงไล่ทีละค่าแทน JSON_TABLE)
INSERT INTO `ActivityPolicy` (`activityId`, `level`, `name`, `type`, `year`, `createdAt`)
SELECT
    a.`id`,
    l.`lvl`,
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(a.`policyDetails`, CONCAT('$."', l.`lvl`, '".name'))), 'null'),
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(a.`policyDetails`, CONCAT('$."', l.`lvl`, '".type'))), 'null'),
    CAST(JSON_UNQUOTE(JSON_EXTRACT(a.`policyDetails`, CONCAT('$."', l.`lvl`, '".year'))) AS SIGNED),
    a.`createdAt`
FROM `Activity` a
JOIN (
    SELECT 'VILLAGE' AS `lvl` UNION ALL SELECT 'SUBDISTRICT' UNION ALL SELECT 'DISTRICT'
    UNION ALL SELECT 'PROVINCE' UNION ALL SELECT 'NATIONAL'
) l ON JSON_CONTAINS(a.`policyLevels`, JSON_QUOTE(l.`lvl`))
WHERE a.`policyLevels` IS NOT NULL;

ALTER TABLE `ActivityPolicy` ADD CONSTRAINT `ActivityPolicy_activityId_fkey` FOREIGN KEY (`activityId`) REFERENCES `Activity`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `Activity` DROP COLUMN `policyDetails`,
    DROP COLUMN `policyLevels`;

-- ── 2) ทีมงาน · ถังขยะ · role · index ───────────────────────────────────────
ALTER TABLE `Activity` ADD COLUMN `deletedAt` DATETIME(3) NULL,
    ADD COLUMN `deletedById` INTEGER NULL;

ALTER TABLE `User` MODIFY `role` ENUM('member', 'admin', 'superadmin') NOT NULL DEFAULT 'member';

CREATE TABLE `ActivityMember` (
    `activityId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `addedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ActivityMember_userId_idx`(`userId`),
    PRIMARY KEY (`activityId`, `userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `Activity_region_idx` ON `Activity`(`region`);
CREATE INDEX `Activity_status_idx` ON `Activity`(`status`);
CREATE INDEX `Activity_createdAt_idx` ON `Activity`(`createdAt`);
CREATE INDEX `Activity_deletedAt_idx` ON `Activity`(`deletedAt`);
CREATE UNIQUE INDEX `User_resetToken_key` ON `User`(`resetToken`);

ALTER TABLE `ActivityMember` ADD CONSTRAINT `ActivityMember_activityId_fkey` FOREIGN KEY (`activityId`) REFERENCES `Activity`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ActivityMember` ADD CONSTRAINT `ActivityMember_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── ตรวจหลังรัน ─────────────────────────────────────────────────────────────
-- SELECT COUNT(*) AS policies, COUNT(DISTINCT activityId) AS works FROM `ActivityPolicy`;
