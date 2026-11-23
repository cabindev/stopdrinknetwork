-- ============================================================================
-- Stop Drink Network — หมุด "ปักหมุดงานศพปลอดเหล้า" จากแขกในงาน (FuneralPin) · 23 พ.ย. 2026
-- แขกเวทีอุบล 27 พ.ย. 2026 สแกน QR กรอกจากมือถือ ไม่ต้อง login ขึ้นแผนที่ทันที (เจ้าหน้าที่ซ่อน/แก้ทีหลัง)
-- รันครั้งเดียวใน phpMyAdmin บนฐาน StopDrinkNetwork (MariaDB 11.8) — Export สำรองก่อนเสมอ · **รันก่อน deploy**
-- ตรวจก่อนรัน: SHOW TABLES LIKE 'FuneralPin';  → ต้องว่าง (ถ้ามีแล้ว = รันไปแล้ว ห้ามรันซ้ำ)
-- ============================================================================

-- CreateTable
CREATE TABLE `FuneralPin` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `kind` VARCHAR(20) NOT NULL,
    `displayName` VARCHAR(120) NULL,
    `district` VARCHAR(100) NOT NULL,
    `amphoe` VARCHAR(100) NOT NULL,
    `province` VARCHAR(100) NOT NULL,
    `region` VARCHAR(40) NULL,
    `latitude` DOUBLE NOT NULL,
    `longitude` DOUBLE NOT NULL,
    `yearBE` INTEGER NULL,
    `practices` JSON NULL,
    `savedAmount` INTEGER NULL,
    `story` TEXT NULL,
    `contactName` VARCHAR(120) NULL,
    `contactPhone` VARCHAR(40) NULL,
    `consent` BOOLEAN NOT NULL DEFAULT false,
    `hidden` BOOLEAN NOT NULL DEFAULT false,
    `source` VARCHAR(40) NULL,
    `ipHash` VARCHAR(64) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `FuneralPin_hidden_createdAt_idx`(`hidden`, `createdAt`),
    INDEX `FuneralPin_province_idx`(`province`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;


-- ตรวจหลังรัน: SHOW COLUMNS FROM `FuneralPin`;  → 21 คอลัมน์
