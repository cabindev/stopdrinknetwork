# Deploy บน Plesk (network.sdnthailand.com)

เซิร์ฟเวอร์เดียวกับ runludtong.com (14.207.143.39, Plesk Obsidian) — ใช้แนวเดียวกับ activerun:
Node.js ผ่าน Passenger + `server.js` (Express ห่อ Next.js) · DNS ผ่าน Cloudflare (Proxied) · SSL = Let's Encrypt ใน Plesk

## สภาพจริงบนเซิร์ฟเวอร์ (ตรวจ 27 ก.ย. 2026)
- เว็บ `network.sdnthailand.com` (site_id 29) อยู่ใต้ subscription **sdnthailand.com** (domainId 4)
- ฐานข้อมูลเป็น **MariaDB 11.8** (ไม่ใช่ MySQL) — SQL ที่ส่งขึ้นเซิร์ฟเวอร์ห้ามใช้ JSON_TABLE / syntax เฉพาะ MySQL 8
- ฐานข้อมูลชื่อ **`StopDrinkNetwork`** (ตัวพิมพ์ใหญ่-เล็กมีผลบน Linux — ใน DATABASE_URL ต้องสะกดตรงนี้) · นำเข้าข้อมูลแล้ว
  27 ก.ย. 2026 (55 งาน, 49 นโยบาย, 4 ผู้ใช้จริง, ไม่มีบัญชี @test.sdn) · มีฐานเก่าชื่อ `stopdrink`,
  `stopdrink65`, `stopdrink66` ของระบบเดิม — **อย่าสับสน**
- Node.js 26.9 · startup `server.js` · Document root = `/network.sdnthailand.com/public` (แก้จากค่าเดิมที่ชี้ root
  ของแอป — ถ้าชี้ root nginx จะเปิดไฟล์ในโฟลเดอร์แอปตรง ๆ รวมถึง uploads/)
- env ที่ตั้งแล้ว: `NEXTAUTH_URL`, `EMAIL_USER`, `GISTDA_API_BASE_URL`, `GOOGLE_CLIENT_ID`
  ต้องใส่เอง (ค่าลับ): `DATABASE_URL`, `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_SECRET`, `EMAIL_PASS`, `GISTDA_API_KEY`
  · **ใช้ชื่อ `GISTDA_API_KEY` ไม่ใช่ `NEXT_PUBLIC_GISTDA_API_KEY`** — ตัวแปร NEXT_PUBLIC_ ถูกฝังตอน build ซึ่ง env ของ
    Plesk อาจไปไม่ถึง ส่วน GISTDA_API_KEY อ่านตอนรันจริง (lib/sphere.ts รองรับทั้งสองชื่อ)
  · `DATABASE_URL="mysql://<db user>:<รหัส>@localhost:3306/StopDrinkNetwork"` (รหัสมีอักขระพิเศษต้อง URL-encode)

## ตั้งครั้งแรก

1. **Git** — Plesk → network.sdnthailand.com → Git → เพิ่ม repo `https://github.com/cabindev/stopdrinknetwork.git`
   branch `main` · deploy ไปที่ `/network.sdnthailand.com`
2. **ฐานข้อมูล** — Databases → Add Database (MySQL) → ผ่าน phpMyAdmin ของ Plesk (ห้ามเปิด URL phpMyAdmin ตรง ๆ
   ต้องคลิกไอคอนจากแถวฐานข้อมูล) → Import ไฟล์ dump ที่เตรียมไว้ (`backups/deploy/stopdrinknetwork-production-*.sql` — ตัดบัญชี @test.sdn ออกแล้ว,
   รวม schema ล่าสุดแล้ว **ไม่ต้องรัน production-sql/2026-09-27_upgrade.sql ซ้ำ**)
3. **Node.js** — Plesk → Node.js
   - Node.js version: 20 ขึ้นไป · Application mode: **production**
   - Application root = โฟลเดอร์ repo · Document root = `<repo>/public` · Application startup file = **`server.js`**
   - Custom environment variables (ค่าจริงอยู่ที่นี่ที่เดียว ไม่มีไฟล์ .env บนเซิร์ฟเวอร์):
     `DATABASE_URL`, `NEXTAUTH_URL=https://network.sdnthailand.com/`, `NEXTAUTH_SECRET`, `EMAIL_USER`, `EMAIL_PASS`,
     `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXT_PUBLIC_GISTDA_API_KEY`, `GISTDA_API_BASE_URL`
   - กด **NPM install** → **Run script: build** → **Restart App**
4. **ไฟล์แนบ** — โฟลเดอร์ `uploads/` อยู่ใน application root (gitignore — git pull ไม่ลบ) คัดลอกของเดิมจากเครื่อง dev
   ขึ้นไปด้วย — อัป `backups/deploy/uploads.zip` ผ่าน File Manager ไปที่ `/network.sdnthailand.com` แล้วกด Extract · **ห้ามย้ายไปไว้ใน public/** (ไฟล์เป็นข้อมูลส่วนตัว ต้องผ่าน /api/files)
5. **ขนาดอัปโหลด** — ระบบรับได้ 60MB ต่อครั้ง: Apache & nginx Settings → Additional nginx directives
   `client_max_body_size 64m;`
6. **Google OAuth** — redirect URI `https://network.sdnthailand.com/api/auth/callback/google` ลงทะเบียนไว้แล้ว
   (แอปยังโหมด Testing — ต้อง Publish app ก่อนเปิดให้ทุกคน login ด้วย Google)

## Deploy ครั้งต่อไป

1. `git push` ขึ้น GitHub
2. **ถ้ามีไฟล์ใหม่ใน `prisma/production-sql/`** — Export ฐานข้อมูลก่อน แล้วรัน SQL ใน phpMyAdmin (ดู README ในโฟลเดอร์นั้น)
   · ต้องทำก่อนขั้น 3 เพราะโค้ดใหม่อ่านตาราง/คอลัมน์ใหม่ทันที
3. Plesk → Git → **Pull now** → Node.js → **Run script: build** → **Restart App**
   (`npm run build` = `prisma generate && next build` — ถ้า package.json เปลี่ยน กด NPM install ก่อน)

## ทำไมไม่รัน prisma migrate บนเซิร์ฟเวอร์
env ที่ตั้งใน Plesk ถูกฉีดเฉพาะตอน Passenger สตาร์ทแอป — ไม่ถึง SSH/Run Node.js commands
(`Environment variable not found: DATABASE_URL`) จึงแก้ฐานข้อมูลด้วย SQL ผ่าน phpMyAdmin (บทเรียนจาก activerun)

## สำรองข้อมูลอัตโนมัติ (ยังไม่ได้ตั้ง — ตั้งครั้งเดียว)
ข้อมูลจริงมี 2 ส่วน ต้องสำรองทั้งคู่: **ฐานข้อมูล `StopDrinkNetwork`** และ **โฟลเดอร์ `uploads/`** (รูป/เอกสาร/แบบสำรวจ
ทั้งหมด — ไม่อยู่ใน git) ถ้าเสียอย่างใดอย่างหนึ่ง ข้อมูลอีกส่วนใช้ไม่ได้ครบ

ใช้ **Plesk Backup Manager** (มีในตัว ไม่ต้องเขียนสคริปต์ — สคริปต์ cron เองไม่เหมาะเพราะ env ของ Plesk ไม่ถึง cron
ต้องเขียนรหัสฐานข้อมูลลงไฟล์):
1. Plesk → Websites & Domains → **sdnthailand.com** → **Backup & Restore** (Backup Manager)
2. **Remote Storage Settings** → เลือก Google Drive (บัญชี sdnthailandbackup@gmail.com) หรือ FTP/S3 —
   **ต้องเก็บนอกเซิร์ฟเวอร์** ถ้าเก็บในเครื่องเดียวกัน ดิสก์เสียก็หายพร้อมกัน
3. **Schedule** → เปิด · ทุกวัน (ช่วงกลางคืน) · เก็บย้อนหลัง 14 ชุด · เนื้อหา = **Configuration and content**
   (รวม mail/ไฟล์เว็บ/ฐานข้อมูล — `uploads/` อยู่ใน `/network.sdnthailand.com` จึงติดไปด้วย)
   · เลือก "Store backups in: Remote storage" (หรือทั้งสองที่)
4. กด **Back Up** ครั้งแรกด้วยมือ แล้วตรวจว่ามีไฟล์ใน Google Drive จริง
5. ทดสอบกู้คืนอย่างน้อยปีละครั้ง: ดาวน์โหลดชุดสำรอง → เปิดดูว่ามี dump ของ `StopDrinkNetwork` และ `uploads/`

ก่อนแก้ schema ทุกครั้ง (production-sql) ยัง Export ฐานข้อมูลจาก phpMyAdmin เก็บไว้เองเหมือนเดิม — ชุดสำรองรายวัน
อาจเก่าถึง 24 ชม.
