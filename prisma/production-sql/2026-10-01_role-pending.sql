-- ============================================================================
-- Stop Drink Network — role "pending" (บัญชีสมัครใหม่รอแอดมินอนุมัติ) · 1 ต.ค. 2026
-- รันครั้งเดียวใน phpMyAdmin บนฐาน StopDrinkNetwork (MariaDB 11.8) — Export สำรองก่อนเสมอ
-- ตรวจก่อนรัน: SHOW COLUMNS FROM `User` LIKE 'role';  → Type ต้องยังไม่มี 'pending'
-- ผู้ใช้เดิมทุกคนคง role เดิม (member/admin/superadmin) — เฉพาะคนสมัครใหม่หลัง deploy ที่ได้ pending
-- ⚠ รันก่อน deploy โค้ดใหม่ ไม่งั้นสมัครสมาชิกใหม่จะ error (โค้ดใหม่เขียน role = 'pending')
-- ============================================================================

ALTER TABLE `User` MODIFY `role` ENUM('member', 'admin', 'superadmin', 'pending') NOT NULL DEFAULT 'member';

-- ตรวจหลังรัน: SHOW COLUMNS FROM `User` LIKE 'role';  → enum('member','admin','superadmin','pending')
