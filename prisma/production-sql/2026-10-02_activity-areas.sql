-- ============================================================================
-- Stop Drink Network — พื้นที่ที่เกี่ยวข้องของงาน (ActivityArea) · 2 ต.ค. 2026
-- งานเดียวปักได้หลายพื้นที่ (หมุดรองบนแผนที่) — สถิติ/ภาค/พื้นที่ทับซ้อนยังนับจากพื้นที่หลักใน Activity
-- รันครั้งเดียวใน phpMyAdmin บนฐาน StopDrinkNetwork (MariaDB 11.8) — Export สำรองก่อนเสมอ
-- ตรวจก่อนรัน: SHOW TABLES LIKE 'ActivityArea';  → ต้องว่าง (ถ้ามีแล้ว = รันไปแล้ว ห้ามรันซ้ำ)
-- ============================================================================

-- CreateTable
CREATE TABLE `ActivityArea` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `activityId` INTEGER NOT NULL,
    `areaName` VARCHAR(200) NULL,
    `district` VARCHAR(191) NOT NULL,
    `amphoe` VARCHAR(191) NOT NULL,
    `province` VARCHAR(191) NOT NULL,
    `region` VARCHAR(191) NOT NULL,
    `zipcode` VARCHAR(191) NULL,
    `latitude` DOUBLE NULL,
    `longitude` DOUBLE NULL,
    `locationSource` ENUM('TAMBON', 'PIN', 'GPS', 'LINK', 'PLACE') NOT NULL DEFAULT 'TAMBON',
    `note` VARCHAR(200) NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ActivityArea_activityId_idx`(`activityId`),
    INDEX `ActivityArea_province_amphoe_district_idx`(`province`, `amphoe`, `district`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ActivityArea` ADD CONSTRAINT `ActivityArea_activityId_fkey` FOREIGN KEY (`activityId`) REFERENCES `Activity`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- ตรวจหลังรัน: SHOW COLUMNS FROM `ActivityArea`;  → ต้องมี 14 คอลัมน์
