-- ชุดกรณีศึกษา (StorySeries) + Activity.seriesId/seriesOrder
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

