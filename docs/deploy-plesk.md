# Deploy บน Plesk (network.sdnthailand.com)

เซิร์ฟเวอร์เดียวกับ runludtong.com (14.207.143.39, Plesk Obsidian) — ใช้แนวเดียวกับ activerun:
Node.js ผ่าน Passenger + `server.js` (Express ห่อ Next.js) · DNS ผ่าน Cloudflare (Proxied) · SSL = Let's Encrypt ใน Plesk

## ตั้งครั้งแรก

1. **Git** — Plesk → network.sdnthailand.com → Git → เพิ่ม repo `https://github.com/cabindev/stopdrinknetwork.git`
   branch `main` · deploy ไปที่ root ของเว็บ (เช่น `/httpdocs`)
2. **ฐานข้อมูล** — Databases → Add Database (MySQL) → ผ่าน phpMyAdmin ของ Plesk (ห้ามเปิด URL phpMyAdmin ตรง ๆ
   ต้องคลิกไอคอนจากแถวฐานข้อมูล) → Import ไฟล์ dump จากเครื่อง dev (`mysqldump` ฐาน StopDrinkNetwork)
3. **Node.js** — Plesk → Node.js
   - Node.js version: 20 ขึ้นไป · Application mode: **production**
   - Application root = โฟลเดอร์ repo · Document root = `<repo>/public` · Application startup file = **`server.js`**
   - Custom environment variables (ค่าจริงอยู่ที่นี่ที่เดียว ไม่มีไฟล์ .env บนเซิร์ฟเวอร์):
     `DATABASE_URL`, `NEXTAUTH_URL=https://network.sdnthailand.com/`, `NEXTAUTH_SECRET`, `EMAIL_USER`, `EMAIL_PASS`,
     `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXT_PUBLIC_GISTDA_API_KEY`, `GISTDA_API_BASE_URL`
   - กด **NPM install** → **Run script: build** → **Restart App**
4. **ไฟล์แนบ** — โฟลเดอร์ `uploads/` อยู่ใน application root (gitignore — git pull ไม่ลบ) คัดลอกของเดิมจากเครื่อง dev
   ขึ้นไปด้วย (File Manager/FTP) · **ห้ามย้ายไปไว้ใน public/** (ไฟล์เป็นข้อมูลส่วนตัว ต้องผ่าน /api/files)
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
