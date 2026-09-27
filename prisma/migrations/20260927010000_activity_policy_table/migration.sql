-- แยกนโยบายรายระดับจาก JSON (Activity.policyLevels / policyDetails) เป็นตาราง ActivityPolicy
-- ลำดับ: สร้างตาราง → คัดลอกข้อมูลเดิม → FK → ลบคอลัมน์ JSON (ห้ามสลับ ไม่งั้นข้อมูลหาย)

-- CreateTable
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

-- ย้ายข้อมูล: 1 ระดับใน policyLevels = 1 แถว + รายละเอียดจาก policyDetails[ระดับ]
INSERT INTO `ActivityPolicy` (`activityId`, `level`, `name`, `type`, `year`, `createdAt`)
SELECT
    a.`id`,
    jt.`lvl`,
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(a.`policyDetails`, CONCAT('$."', jt.`lvl`, '".name'))), 'null'),
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(a.`policyDetails`, CONCAT('$."', jt.`lvl`, '".type'))), 'null'),
    CAST(JSON_UNQUOTE(JSON_EXTRACT(a.`policyDetails`, CONCAT('$."', jt.`lvl`, '".year'))) AS SIGNED),
    a.`createdAt`
FROM `Activity` a,
    JSON_TABLE(a.`policyLevels`, '$[*]' COLUMNS (`lvl` VARCHAR(20) PATH '$')) AS jt
WHERE a.`policyLevels` IS NOT NULL
    AND jt.`lvl` IN ('VILLAGE', 'SUBDISTRICT', 'DISTRICT', 'PROVINCE', 'NATIONAL');

-- AddForeignKey
ALTER TABLE `ActivityPolicy` ADD CONSTRAINT `ActivityPolicy_activityId_fkey` FOREIGN KEY (`activityId`) REFERENCES `Activity`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE `Activity` DROP COLUMN `policyDetails`,
    DROP COLUMN `policyLevels`;
