-- ลิงก์ภายนอกของงาน (ActivityLink)
-- CreateTable
CREATE TABLE `ActivityLink` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `activityId` INTEGER NOT NULL,
    `url` VARCHAR(2000) NOT NULL,
    `title` VARCHAR(200) NULL,
    `kind` ENUM('FACEBOOK', 'YOUTUBE', 'TIKTOK', 'DRIVE', 'WEB') NOT NULL DEFAULT 'WEB',
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `isPublic` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ActivityLink_activityId_idx`(`activityId`),
    INDEX `ActivityLink_kind_idx`(`kind`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ActivityLink` ADD CONSTRAINT `ActivityLink_activityId_fkey` FOREIGN KEY (`activityId`) REFERENCES `Activity`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
