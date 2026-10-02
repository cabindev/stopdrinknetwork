-- ============================================================================
-- Stop Drink Network — ชุดกรณีศึกษา (StorySeries) · 2 ต.ค. 2026
-- หลายกรณีศึกษาที่อ่านต่อกันได้ เช่น "สงกรานต์ 6 พื้นที่ต้นแบบ 2569" — ตาราง StorySeries + Activity.seriesId/seriesOrder
-- รันครั้งเดียวใน phpMyAdmin บนฐาน StopDrinkNetwork (MariaDB 11.8) — Export สำรองก่อนเสมอ
-- ตรวจก่อนรัน: SHOW TABLES LIKE 'StorySeries';  → ต้องว่าง (ถ้ามีแล้ว = รันไปแล้ว ห้ามรันซ้ำ)
-- ============================================================================

-- AlterTable
ALTER TABLE `Activity` ADD COLUMN `seriesId` INTEGER NULL,
    ADD COLUMN `seriesOrder` INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE `StorySeries` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Activity_seriesId_idx` ON `Activity`(`seriesId`);

-- AddForeignKey
ALTER TABLE `Activity` ADD CONSTRAINT `Activity_seriesId_fkey` FOREIGN KEY (`seriesId`) REFERENCES `StorySeries`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;


-- ตรวจหลังรัน: SHOW COLUMNS FROM `StorySeries`;  → 5 คอลัมน์ · SHOW COLUMNS FROM `Activity` LIKE 'series%';  → 2 คอลัมน์
