-- AlterTable
ALTER TABLE `Activity` ADD COLUMN `hasSurvey` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `ActivityAttachment` ADD COLUMN `isSurvey` BOOLEAN NOT NULL DEFAULT false;

