-- AlterTable
ALTER TABLE `User` MODIFY `role` ENUM('member', 'admin', 'superadmin', 'pending') NOT NULL DEFAULT 'member';

