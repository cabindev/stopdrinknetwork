-- ทีมงานร่วม (ActivityMember) · ถังขยะ (deletedAt) · role เป็น enum · index กรองภาค/สถานะ/เวลา · resetToken unique
-- AlterTable
ALTER TABLE `Activity` ADD COLUMN `deletedAt` DATETIME(3) NULL,
    ADD COLUMN `deletedById` INTEGER NULL;

-- AlterTable
ALTER TABLE `User` MODIFY `role` ENUM('member', 'admin', 'superadmin') NOT NULL DEFAULT 'member';

-- CreateTable
CREATE TABLE `ActivityMember` (
    `activityId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `addedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ActivityMember_userId_idx`(`userId`),
    PRIMARY KEY (`activityId`, `userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Activity_region_idx` ON `Activity`(`region`);

-- CreateIndex
CREATE INDEX `Activity_status_idx` ON `Activity`(`status`);

-- CreateIndex
CREATE INDEX `Activity_createdAt_idx` ON `Activity`(`createdAt`);

-- CreateIndex
CREATE INDEX `Activity_deletedAt_idx` ON `Activity`(`deletedAt`);

-- CreateIndex
CREATE UNIQUE INDEX `User_resetToken_key` ON `User`(`resetToken`);

-- AddForeignKey
ALTER TABLE `ActivityMember` ADD CONSTRAINT `ActivityMember_activityId_fkey` FOREIGN KEY (`activityId`) REFERENCES `Activity`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ActivityMember` ADD CONSTRAINT `ActivityMember_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

