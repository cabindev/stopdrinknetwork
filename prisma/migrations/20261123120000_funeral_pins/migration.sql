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

