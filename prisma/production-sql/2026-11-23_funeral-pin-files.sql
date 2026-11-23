-- ============================================================================
-- Stop Drink Network — ไฟล์แนบของหมุดครอบครัว (FuneralPinFile): รูป ≤5 สาธารณะ · บิล/ใบเสร็จ ≤10 เห็นเฉพาะแอดมิน+ผู้ปัก · 23 พ.ย. 2026
-- รันหลัง 2026-11-23_funeral-pins-family.sql · **รันก่อน deploy** · Export สำรองก่อนเสมอ
-- ตรวจก่อนรัน: SHOW TABLES LIKE 'FuneralPinFile';  → ต้องว่าง (ถ้ามีแล้ว = รันไปแล้ว ห้ามรันซ้ำ)
-- ============================================================================

-- CreateTable
CREATE TABLE `FuneralPinFile` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `pinId` INTEGER NOT NULL,
    `kind` VARCHAR(10) NOT NULL,
    `filePath` VARCHAR(255) NOT NULL,
    `fileName` VARCHAR(255) NOT NULL,
    `mimeType` VARCHAR(100) NOT NULL,
    `size` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `FuneralPinFile_pinId_kind_idx`(`pinId`, `kind`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `FuneralPinFile` ADD CONSTRAINT `FuneralPinFile_pinId_fkey` FOREIGN KEY (`pinId`) REFERENCES `FuneralPin`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;


-- ตรวจหลังรัน: SHOW COLUMNS FROM `FuneralPinFile`;  → 8 คอลัมน์
