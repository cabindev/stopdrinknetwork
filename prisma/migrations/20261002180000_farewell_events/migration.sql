-- CreateTable
CREATE TABLE `FarewellEvent` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `type` ENUM('VISIT', 'JOURNEY_VIEW', 'PLAN_START', 'PLAN_COMPLETE', 'PRINT', 'SHARE', 'LINE', 'COPY', 'SIGN_DOWNLOAD', 'SIGN_PRINT', 'LOCAL_LOOKUP') NOT NULL,
    `province` VARCHAR(100) NULL,
    `region` VARCHAR(40) NULL,
    `answers` JSON NULL,
    `found` BOOLEAN NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `FarewellEvent_type_createdAt_idx`(`type`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

