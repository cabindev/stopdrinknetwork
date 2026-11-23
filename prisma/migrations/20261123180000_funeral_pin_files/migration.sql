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

