-- CreateTable
CREATE TABLE `User` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `firstName` VARCHAR(191) NOT NULL,
    `lastName` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NULL,
    `image` VARCHAR(191) NULL,
    `role` VARCHAR(191) NOT NULL DEFAULT 'member',
    `phone` VARCHAR(191) NULL,
    `organization` VARCHAR(191) NULL,
    `position` VARCHAR(191) NULL,
    `emailVerified` DATETIME(3) NULL,
    `resetToken` VARCHAR(191) NULL,
    `resetTokenCreatedAt` DATETIME(3) NULL,
    `resetTokenExpiresAt` DATETIME(3) NULL,
    `lastPasswordReset` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `action` ENUM('CREATE', 'UPDATE', 'DELETE') NOT NULL,
    `entityType` VARCHAR(191) NOT NULL,
    `entityId` INTEGER NOT NULL,
    `entityName` VARCHAR(191) NOT NULL,
    `changes` TEXT NULL,
    `userId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AuditLog_entityType_entityId_idx`(`entityType`, `entityId`),
    INDEX `AuditLog_userId_idx`(`userId`),
    INDEX `AuditLog_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WorkCategory` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `logo` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `WorkCategory_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WorkSubCategory` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `categoryId` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `logo` VARCHAR(191) NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `WorkSubCategory_categoryId_name_key`(`categoryId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Activity` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `categoryId` INTEGER NOT NULL,
    `subCategoryId` INTEGER NULL,
    `userId` INTEGER NOT NULL,
    `areaName` VARCHAR(191) NULL,
    `district` VARCHAR(191) NOT NULL,
    `amphoe` VARCHAR(191) NOT NULL,
    `province` VARCHAR(191) NOT NULL,
    `areaScope` ENUM('VILLAGE', 'SUBDISTRICT', 'DISTRICT', 'PROVINCE') NOT NULL DEFAULT 'SUBDISTRICT',
    `region` VARCHAR(191) NOT NULL,
    `zipcode` VARCHAR(191) NULL,
    `latitude` DOUBLE NULL,
    `longitude` DOUBLE NULL,
    `locationSource` ENUM('TAMBON', 'PIN', 'GPS', 'LINK', 'PLACE') NOT NULL DEFAULT 'TAMBON',
    `participantCount` INTEGER NULL,
    `partners` JSON NULL,
    `policyLevels` JSON NULL,
    `policyDetails` JSON NULL,
    `coverageVillages` INTEGER NULL,
    `coverageHouseholds` INTEGER NULL,
    `coveragePopulation` INTEGER NULL,
    `coordinatorName` VARCHAR(191) NULL,
    `coordinatorRole` VARCHAR(191) NULL,
    `coordinatorPhone` VARCHAR(191) NULL,
    `coordinatorLine` VARCHAR(191) NULL,
    `coordinatorConsent` BOOLEAN NOT NULL DEFAULT false,
    `isPublished` BOOLEAN NOT NULL DEFAULT false,
    `publishedAt` DATETIME(3) NULL,
    `publishedById` INTEGER NULL,
    `storyLead` TEXT NULL,
    `storyProcess` TEXT NULL,
    `storyLessons` TEXT NULL,
    `status` ENUM('PLANNING', 'ACTIVE', 'COMPLETED') NOT NULL DEFAULT 'ACTIVE',
    `startDate` DATETIME(3) NULL,
    `startDatePrecision` ENUM('DAY', 'YEAR') NOT NULL DEFAULT 'DAY',
    `endDate` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Activity_userId_idx`(`userId`),
    INDEX `Activity_categoryId_idx`(`categoryId`),
    INDEX `Activity_subCategoryId_idx`(`subCategoryId`),
    INDEX `Activity_isPublished_idx`(`isPublished`),
    INDEX `Activity_province_idx`(`province`),
    INDEX `Activity_province_amphoe_district_idx`(`province`, `amphoe`, `district`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ActivityAttachment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `activityId` INTEGER NOT NULL,
    `kind` ENUM('DOCUMENT', 'IMAGE') NOT NULL,
    `filePath` VARCHAR(191) NOT NULL,
    `fileName` VARCHAR(191) NOT NULL,
    `mimeType` VARCHAR(191) NOT NULL,
    `size` INTEGER NOT NULL,
    `caption` VARCHAR(191) NULL,
    `isCover` BOOLEAN NOT NULL DEFAULT false,
    `policyLevel` ENUM('VILLAGE', 'SUBDISTRICT', 'DISTRICT', 'PROVINCE', 'NATIONAL') NULL,
    `isPublic` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ActivityAttachment_activityId_idx`(`activityId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkSubCategory` ADD CONSTRAINT `WorkSubCategory_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `WorkCategory`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Activity` ADD CONSTRAINT `Activity_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `WorkCategory`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Activity` ADD CONSTRAINT `Activity_subCategoryId_fkey` FOREIGN KEY (`subCategoryId`) REFERENCES `WorkSubCategory`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Activity` ADD CONSTRAINT `Activity_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ActivityAttachment` ADD CONSTRAINT `ActivityAttachment_activityId_fkey` FOREIGN KEY (`activityId`) REFERENCES `Activity`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

