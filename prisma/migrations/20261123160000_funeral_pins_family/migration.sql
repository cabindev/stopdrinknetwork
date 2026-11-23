-- AlterTable
ALTER TABLE `FuneralPin` ADD COLUMN `answers` JSON NULL,
    ADD COLUMN `deceasedFirstName` VARCHAR(100) NULL,
    ADD COLUMN `deceasedLastName` VARCHAR(100) NULL,
    ADD COLUMN `funeralDate` DATE NULL,
    ADD COLUMN `place` VARCHAR(20) NULL,
    ADD COLUMN `relation` VARCHAR(30) NULL,
    ADD COLUMN `showDeceasedName` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `totalCost` INTEGER NULL,
    ADD COLUMN `userId` INTEGER NULL,
    MODIFY `kind` VARCHAR(20) NOT NULL DEFAULT 'FAMILY';

-- CreateIndex
CREATE INDEX `FuneralPin_userId_idx` ON `FuneralPin`(`userId`);

-- AddForeignKey
ALTER TABLE `FuneralPin` ADD CONSTRAINT `FuneralPin_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

