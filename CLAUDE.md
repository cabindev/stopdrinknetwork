# Stop Drink Network — เครือข่ายงดเหล้า

## Project Overview
ระบบบันทึกและติดตามการดำเนินงานของเครือข่ายงดเหล้า — เจ้าหน้าที่บันทึกงานของตัวเองพร้อมพื้นที่/ไฟล์แนบ
ดูภาพรวมทั้งองค์กรบนแผนที่ และวิเคราะห์ "พื้นที่ทับซ้อน" ระหว่างคนทำงาน
(สร้างบนโครงสร้าง auth เดียวกับ `buddhistlent`, ยกโค้ดแผนที่/โซนจาก `sdn-mapportal`)

**เหตุผลที่มีระบบนี้**: แทนที่ Google Sheet เดิมที่เก็บข้อมูลเป็น free text + ใช้ "สีพื้นหลัง cell"
สื่อความหมาย ทำให้กรอง/สรุป/แสดงบนแผนที่ไม่ได้ — ระบบใหม่จึงบังคับให้ข้อมูลมีโครงสร้างตั้งแต่ต้นทาง

**Local DB**: `StopDrinkNetwork` (MySQL, MAMP)

## Design Theme
- **สีหลัก**: ส้ม–ขาว–ดำ เท่านั้น **สีพื้นล้วน ห้ามใช้ gradient ทุกชนิด**
- ปุ่ม/element หลัก: `bg-orange-600 text-white hover:bg-orange-700` — พื้นหลังหน้า: `bg-white`
- Card ขาว `rounded-2xl border border-orange-100`, tint อ่อน `bg-orange-50`, ข้อความ gray-800/500 (โทนดำ)
- Font: สไตล์ Microsoft — system stack `"Segoe UI", "Leelawadee UI", Tahoma, "Noto Sans Thai", sans-serif` (ตั้งใน globals.css + tailwind fontFamily.sans, ไม่ใช้ next/font)
- Icons: lucide-react (โลโก้ = ตัวอักษร "SDN" font-extrabold `text-orange-600` ไม่มีกล่องพื้นหลัง)
- **Navbar ลอย ไม่มีแถบพื้นหลัง** (`fixed top-0 pointer-events-none`) แต่ละเมนูเป็นแคปซูลขาว
  `bg-white/95 backdrop-blur border rounded-full` จึงอ่านออกทั้งบนแผนที่และหน้าพื้นขาว
  → **หน้าอื่นต้องเว้นระยะบนเอง** (`pt-20` สำหรับหน้าเนื้อหา, `pt-16` หน้าแรก) เพราะ navbar ไม่กินพื้นที่
- แผนที่: UI ทุกชิ้นลอยทับแผนที่เป็นการ์ดขาวมุมมน — แถบไอคอนแนวตั้งซ้าย (การ์ดเดี่ยว มีเส้นคั่น),
  แผง "ตัวกรอง" (สถานะ+ประเด็น พร้อมจำนวน) กางออกข้าง ๆ เว้น 12px, ด้านบนมีแค่ช่องค้นหา+ชิป "ใหม่ N งาน"
  (**ห้ามวางชิป/ปุ่มกรองลอยบนแผนที่เพิ่ม — ผู้ใช้บอกว่าบังการมอง** ให้ใส่ในแผงตัวกรอง), แผงรายละเอียดจังหวัดด้านขวา

## Technology Stack
- Next.js 16 (App Router) / React 19 / TypeScript 5
- MySQL — Prisma 6.x (singleton `app/lib/db.ts` — ใช้ตัวนี้ทุกที่ ห้าม `new PrismaClient()` ซ้ำ)
- NextAuth.js 4.x (JWT, role-based: `member`/`admin`/`superadmin`)
- Tailwind CSS 3, framer-motion, nodemailer, react-hot-toast, clsx + tailwind-merge (`cn()` ใน `lib/utils.ts`)
- leaflet (+@types), browser-image-compression + heic2any (บีบอัด/แปลงรูปฝั่ง browser), exceljs (export)
- **ไม่ใช้** html2canvas/ไลบรารีจับภาพ — export PNG วาดลง canvas เอง (เหตุผลในหัวข้อกับดัก)

## Development Commands
```bash
npm run dev          # Dev server (port 3000)
npm run build        # Production build
npx prisma generate  # Regenerate client หลังแก้ schema
npx prisma migrate status   # ดูว่า migration ครบไหม
npx prisma migrate deploy   # ใช้ migration (ทั้ง dev และ production) — **ห้ามใช้ db push แล้ว** (ดูกับดักข้อ 8)
npx prisma studio    # GUI ดูข้อมูล
npm run lint         # ESLint (eslint.config.mjs — Next 16 ถอด `next lint` แล้ว) ต้อง 0 error ก่อน commit
                     #   กฎ React Compiler (set-state-in-effect/refs/purity/immutability) ตั้งเป็น warn: โค้ดเดิม — แก้เมื่อแตะไฟล์นั้น

node scripts/seed-categories.mjs      # seed ประเด็นงาน 13 หมวด (ตอนติดตั้งใหม่)
node scripts/seed-subcategories.mjs   # seed ประเด็นย่อยร่าง (ประเพณีปลอดเหล้า 12 รายการ) — รันซ้ำได้ ไม่สร้างซ้ำ
# นำเข้าแบบสำรวจนโยบายงานศพปลอดเหล้า (Google Sheet สาธารณะ) — ค่าเริ่มต้นทดลอง แสดงการจับคู่ทุกแถว
node --experimental-strip-types scripts/import-funeral-policy-sheet.mjs            # ทดลอง
node --experimental-strip-types scripts/import-funeral-policy-sheet.mjs --commit   # บันทึกจริง (กันซ้ำในตัว)
node scripts/seed-test-data.mjs       # ผู้ใช้ทดสอบ 3 คน + งาน 10 รายการ
node scripts/seed-test-bulk.mjs       # เพิ่มงานทดสอบอีก 20 รายการ (สุ่มพื้นที่จริง)
node scripts/seed-test-data.mjs --clean   # ลบข้อมูลทดสอบทั้งหมด (@test.sdn)
node scripts/backfill-coords.mjs      # เติม lat/lng ให้ Activity ที่ยังไม่มี
```

### ⚠️ กับดักที่เจอบ่อย (อ่านก่อนดีบัก)
1. **แก้ schema แล้วต้อง restart dev server เสมอ** — `app/lib/db.ts` cache PrismaClient ไว้ใน
   `globalThis` ซึ่งรอด hot-reload ทำให้ instance เก่าไม่มี model ใหม่ อาการ:
   `Cannot read properties of undefined (reading 'findMany')` หรือ audit log ไม่ถูกเขียนโดยไม่มี error
2. **อ่าน FileList ออกมาก่อนล้าง `e.target.value`** ใน `<input type="file">` เสมอ —
   updater ของ `setState` ทำงานทีหลัง ถ้าเคลียร์ก่อนไฟล์จะหายเงียบ ๆ (เคยทำให้แนบเอกสารไม่ได้ทั้งระบบ)
3. **Leaflet วาด circleMarker เป็น `<path>` ไม่ใช่ `<circle>`** — ตอนเขียนเทสต์ให้แยกหมุดจาก polygon
   ด้วยการเช็คว่า attribute `d` มีคำสั่ง arc (`a`) หรือไม่
4. **เปลี่ยนขนาด container ของแผนที่ต้องเรียก `map.invalidateSize()`** ไม่งั้น tile เพี้ยน
5. **ห้ามใช้ html2canvas จับภาพแผนที่** — อ่าน CSS transform ของ Leaflet ผิด ทำให้ tile/หมุดไม่ตรงกัน
   วิธีที่ใช้จริง: วาดเองลง canvas (tile → polygon → หมุด) ด้วย `map.latLngToContainerPoint()`
   และต้อง `map.stop()` ก่อนจับภาพ (ถ้ายัง fly อยู่ พิกัดกับ tile จะคนละสถานะ)
   + tileLayer ต้องตั้ง `crossOrigin: 'anonymous'` ไม่งั้น canvas โดน taint export ไม่ได้
6. **แก้ mapping โซนใน healthZones.ts แล้วต้องอัปเดต Activity เก่าใน DB ด้วย** —
   `region` ถูก snapshot ตอนบันทึก ไม่ได้คำนวณสดตอนแสดงผล
7. **ข้อความจากผู้ใช้ที่ใส่ลง HTML string (เช่น popup ของ Leaflet) ต้อง escape เสมอ** — กัน XSS
8. **แก้ schema = สร้าง migration + ไฟล์ SQL สำหรับ production ทุกครั้ง** — เซิร์ฟเวอร์ deploy ด้วย `git pull` และ
   **แก้ฐานข้อมูลด้วย SQL โดยตรง** (ผู้ใช้เลือกเอง 27 ก.ย. 2026 — ไม่รัน migrate บนเซิร์ฟเวอร์) → ต้องเขียน
   `prisma/production-sql/<YYYY-MM-DD>_<ชื่อ>.sql` ที่รันใน phpMyAdmin ได้ (MySQL 5.7+/MariaDB — ห้าม JSON_TABLE) +
   อัปเดตตารางใน README ของโฟลเดอร์นั้น · **ทดสอบก่อนส่งเสมอ**: โหลด backup เข้า DB ชั่วคราว → รันไฟล์ →
   `migrate diff --from-url <db ชั่วคราว> --to-schema-datamodel prisma/schema.prisma` ต้องได้ "empty migration"
   · ฝั่ง local ยังใช้ migrations (baseline `0_init`) — `migrate dev` รันใน agent ไม่ได้
   (non-interactive) ให้ทำแบบนี้: แก้ schema.prisma → `npx prisma migrate diff --from-url "$DATABASE_URL"
   --to-schema-datamodel prisma/schema.prisma --script` → เซฟเป็น `prisma/migrations/<YYYYMMDDHHMMSS>_<ชื่อ>/migration.sql`
   (**ถ้ามี DROP COLUMN ต้องเขียนขั้นย้ายข้อมูลแทรกก่อน** ดูตัวอย่าง `..._activity_policy_table`) → `migrate deploy`
   → `generate` → restart dev server · สำรองก่อนเสมอ: `mysqldump ... > backups/` (gitignore แล้ว)
10. **response error ของ route เสิร์ฟไฟล์ต้องใส่ `NO_STORE`** (`lib/activityFiles.ts`) — Cloudflare เติม
   `max-age=14400` ให้ response ที่ไม่มี Cache-Control → browser จำ 404 ไว้ 4 ชม. (เคยเกิดบน production:
   อัป uploads/ ทีหลังแล้วโลโก้บนแผนที่ยังว่าง ทั้งที่ไฟล์มีแล้ว)
11. **ห้ามเขียนไฟล์ผู้ใช้ลง `public/`** — production ไม่เสิร์ฟไฟล์ที่เพิ่มหลัง build และ `public/img` อยู่ใน .gitignore
   (signup เดิมเขียน `/img/...` → รูปโปรไฟล์พังบนเซิร์ฟเวอร์ แก้แล้วให้ไป `uploads/avatars/`)
9. **งานในถังขยะถูกกรองอัตโนมัติใน `app/lib/db.ts`** (Prisma extension ใส่ `deletedAt: null` ให้ทุก query อ่านของ activity)
   แต่**ไม่ครอบคลุม relation ซ้อน** — `_count: { activities }`, `include: { activities }`, `where: { activity: {...} }`
   ต้องใส่ `ACTIVE_ACTIVITY` เอง · query ที่อยากเห็นของในถังขยะให้ระบุ `deletedAt` ใน where เอง (ตัวกรองจะไม่ทับ)

## Structure
```
app/
├── page.tsx                      # Landing page
├── layout.tsx                    # SessionProvider + Navbar + Toaster (react-hot-toast มีที่นี่ที่เดียว)
├── auth/                         # signin/ signup/ forgot-password/ reset-password/
├── profile/page.tsx              # โปรไฟล์ + พอร์ตงานของฉัน: สถิติ, ประเด็นที่ทำ (แถบสี),
│                                 #   จังหวัดที่ลงพื้นที่, งานล่าสุด, ปุ่ม export Excel เฉพาะของตัวเอง
├── profile/edit/page.tsx         # แก้ไขโปรไฟล์: รูป (ย่อ/แปลง HEIC ฝั่ง browser), ชื่อ, เบอร์, ตำแหน่ง, หน่วยงาน
├── profile/components/ProfileForm.tsx  # เรียก PATCH /api/profile แล้ว session.update() ให้ Navbar เปลี่ยนทันที
├── activity/                     # ★ โมดูลบันทึกการดำเนินงาน (ต้อง login)
│   ├── page.tsx                  # "งานของฉัน" — สถิติ 4 ช่อง + แท็บสถานะ (?status=) + รายการจัดกลุ่มตามเดือนที่บันทึก
│                                 #   การ์ด: รูปปก→โลโก้ประเด็น→อักษรสีประจำประเด็น, "บันทึกเมื่อ … · n วันที่แล้ว", แก้ไขล่าสุด, ป้ายใหม่ (<24 ชม.)
│                                 #   + OverlapSection
│   ├── components/OverlapSection.tsx  # "เพื่อนร่วมพื้นที่": เทียบงานเรากับคนอื่น 3 ระดับ ตำบล>อำเภอ>จังหวัด
│                                 #   (รับ myAreas จากงานทั้งหมด ไม่ใช่เฉพาะหน้าปัจจุบัน)
│   ├── new/page.tsx              # ฟอร์มบันทึกงาน · `?copy=<id>` = "คัดลอกงานนี้" (ปุ่มในหน้า detail) กรอกประเด็น/รายละเอียด/
│                                 #   วันที่/ภาคี/ทีม(+ผู้เขียนเดิม)/ลิงก์ให้ — ไม่คัดลอกพื้นที่/หมุด/ไฟล์/นโยบาย/แบบสำรวจ/ผู้ประสานงาน
│                                 #   (งานเดียวกันหลายพื้นที่ = หลายรายการ เช่น สงกรานต์ 5 ตำบล — ActivityForm prop `copy`)
│   ├── [id]/page.tsx             # รายละเอียด: ประเด็น › ประเด็นย่อย, ผู้เข้าร่วม/ภาคี/ผู้ประสานงาน (เบอร์เฉพาะ
│                                 #   แอดมิน+เจ้าของ), แกลเลอรี (ปกขึ้นก่อน+คำบรรยาย) + เอกสาร + ปุ่มแก้/ลบ
│   ├── [id]/edit/page.tsx        # แก้ไข (ใช้ ActivityForm โหมด initial)
│   ├── [id]/publish/             # แอดมินจัดหน้ากรณีศึกษา: บริบท/กระบวนการ/บทเรียน + ติ๊กไฟล์ที่เปิดเผย → เผยแพร่/ร่าง/ยกเลิก
│   ├── components/ActivityForm.tsx  # ฟอร์ม create/edit: ประเด็นย่อย (แถวเล็กสีจาง └ ใต้ประเด็น), LocationField + ขอบเขต,
│                                 #   วันเริ่ม/"รู้แค่ปี", ส่วนพับ "ผลลัพธ์ ภาคี และ
│                                 #   ผู้ประสานงาน", รูป ≤10 (ImageTile: ดาว=ปก + คำบรรยาย), เอกสาร, toast
│   ├── components/LocationField.tsx # ★ ช่องเดียวจบเรื่องพื้นที่: ค้นหา (ที่เคยใช้/เครือข่ายเคยบันทึก/GISTDA/ตำบล)
│   │                             #   · วางลิงก์/พิกัด · ปุ่ม GPS · แตะแผนที่ → เติม ต./อ./จ./โซน/ชื่อ/หมุด → การ์ดสรุป
│   │                             #   Enter = เลือกรายการแรก (กดก่อนผลมาก็ได้) · ↑↓ · หลังได้พิกัด เสนอชิป "สถานที่ใกล้หมุด"
│   └── components/LocationPicker.tsx  # แผนที่ใน LocationField: คลิก/ลากหมุด, ภาพดาวเทียม, เตือนตำบลไม่ตรง
├── stories/                      # ★ กรณีศึกษาสาธารณะ (ไม่ต้อง login) — page.tsx รายการ (?sub=&province=),
│                                 #   [id]/page.tsx เรื่องแบบ "ทำตามได้" + og:image, ShareButtons (FB/LINE/คัดลอก)
├── map/                          # ★ แผนที่รวมทั้งองค์กร (ไม่ login = โหมดสาธารณะ ดู Map Rules)
│   ├── page.tsx                  # server: ดึง Activity ทุกคน + categories ส่งเข้า MapView (กรองข้อมูลถ้าไม่ login)
│   └── components/MapView.tsx    # Leaflet ล้วน (import ใน useEffect กัน SSR) — polygon 77 จว.,
│                                 #   คลิกหมุดงาน = popup บนแผนที่ (ไม่เปลี่ยนหน้า) — คลิกในแผงขวา = ไปหน้า detail,
│                                 #   ปุ่มบันทึกภาพแผนที่ PNG 2x (วาด tile/polygon/หมุดลง canvas เอง —
│                                 #   ห้ามใช้ html2canvas: อ่าน transform ของ Leaflet ผิด ภาพจะเลื่อน),
│                                 #   หมุดรายงานทุกงานตามตำแหน่งจริง สีตามประเด็น (ไม่รวมเป็นหมุดจังหวัด),
│                                 #   งานใหม่ = วงกระเพื่อม + ชิป "ใหม่ N งาน", ฟิลเตอร์, panel รายจังหวัด
├── data/regions.ts               # ตำบล/อำเภอ/จังหวัด/โซน ทั้งประเทศ 7,498 รายการ (ชุดเดียวกับ sdn-mapportal
│                                 #   ฟิลด์โซนชื่อ `zone` — ไม่ใช่ `type` แบบ buddhistlent)
├── data/thailand.json            # GeoJSON 77 จังหวัด (มี name_th, จาก sdn-mapportal)
├── data/tambon.json              # พิกัด lat/lng รายตำบลทั้งประเทศ (จาก sdn-mapportal)
├── types/region.ts               # RegionData interface
├── utils/healthZones.ts          # โซนพื้นที่ 10 โซน (จาก sdn-mapportal) — จังหวัด→zone slug + ชื่อไทย + สี
├── dashboard/                    # Admin only (proxy.ts role=admin) — โครงสร้างเดียวกับ buddhistlent
│   ├── layout.tsx                # DashboardProvider + TopNavProvider + DashboardClient + Toaster
│   ├── page.tsx                  # Greeting + StatsOverview + QuickActions (?year= กรองปี)
│   ├── components/StatsOverview.tsx  # สถิติผู้บริหาร: ตัวเลขรวม, ช่องว่างพื้นที่, พื้นที่ทับซ้อน,
│   │                             #   เทียบปีก่อน (YoY), แนวโน้ม 12 เดือน, งานรายประเด็น/รายโซน,
│   │                             #   ตาราง % ความครอบคลุมรายจังหวัด (อำเภอที่มีงาน ÷ อำเภอทั้งหมด)
│   ├── people/page.tsx + PeopleTable.tsx  # ★ รายชื่อเครือข่าย (แอดมิน/ธุรการ): เลือกรายชื่อ →
│   │                             #   คัดลอกเป็นข้อความ / ส่งออก Excel / พิมพ์ใบลงชื่อเข้าประชุม
│   ├── activities/page.tsx       # ★ ตารางงานทั้งหมด (แอดมิน): ค้นหา + กรองประเด็น/จังหวัด/ภาค/ผู้รับผิดชอบ/สถานะ/ปี
│   │                             #   + ติ๊กเลือก → แถบ "โอนงาน" ให้ผู้ใช้อื่น (TransferSelection.tsx → POST /api/admin/activities/transfer,
│   │                             #   audit ทุกงาน, เลือกทั้งหมดตามตัวกรองข้ามหน้าได้) — ผู้รับต้องมีบัญชีก่อน · **เฉพาะ superadmin**
│   │                             #   + pagination + ลิงก์แก้ไข + export ตามตัวกรอง (URL แชร์ได้)
│   ├── loading.tsx               # Skeleton
│   ├── components/
│   │   ├── DashboardClient.tsx   # Sidebar + TopNav + main (margin ตาม sidebarCollapsed)
│   │   ├── Sidebar.tsx           # ย่อ/ขยาย + mobile overlay, เมนู: Dashboard/โปรไฟล์/Settings
│   │   ├── TopNav.tsx            # Search + select-all (TopNavContext) + user info
│   │   └── QuickActions.tsx      # Card grid ลิงก์ด่วน
│   ├── context/                  # DashboardContext (sidebar state), TopNavContext (selection)
│   ├── setting/admin/page.tsx    # จัดการผู้ดูแลระบบ: stats, tabs, search, toggle role
│   ├── setting/categories/page.tsx  # จัดการประเด็นงาน: เพิ่ม/แก้ไข/toggle isActive (ไม่มี delete) + โลโก้ประจำหมวด
│   │                             #   (คลิกวงกลมซ้ายเพื่อเพิ่ม/เปลี่ยน, ถังขยะ = ลบ → แผนที่กลับไปใช้หมุดสี)
│   ├── setting/audit/page.tsx    # ประวัติการเปลี่ยนแปลงทั้งระบบ + filter action + pagination
│   └── setting/trash/            # ถังขยะ: งานที่ถูกลบ กู้คืน/ลบถาวร (API /api/admin/trash/[id]) — เก็บ 30 วัน
├── api/
│   ├── auth/[...nextauth]/       # NextAuth handler
│   ├── auth/signup/              # สมัครสมาชิก (formData + upload รูปไป public/img)
│   ├── auth/forgot-password/     # ส่งอีเมล reset token (nodemailer, หมดอายุ 1 ชม.)
│   ├── auth/reset-password/      # ตั้งรหัสผ่านใหม่จาก token
│   ├── admin/users/ + toggle-role/  # จัดการผู้ใช้ (admin/superadmin; role ของ superadmin แก้ได้เฉพาะ superadmin)
│   ├── admin/categories/ + [id]/    # CRUD ประเด็นงาน (ใช้ getAdminUser จาก lib/adminAuth.ts)
│   ├── admin/categories/[id]/subcategories/  # POST เพิ่มประเด็นย่อย · admin/subcategories/[id] PATCH ชื่อ/isActive
│   │                             #   · admin/subcategories/[id]/logo POST/DELETE (โลโก้เฉพาะประเด็นย่อย)
│   ├── admin/categories/[id]/logo/  # POST/DELETE โลโก้ → uploads/category-logos/{id}-{ts}.webp (webp/png/jpg ≤1MB, ห้าม SVG)
│   ├── admin/people/export/      # Excel รายชื่อที่เลือก (?ids=1,2,3) มีคอลัมน์ลายมือชื่อ
│   ├── activities/               # POST สร้าง (formData + ไฟล์→uploads/), GET ของตัวเอง
│   ├── activities/[id]/          # GET ดู / PATCH แก้+ลบไฟล์เดิม / DELETE (เจ้าของหรือแอดมินเท่านั้น)
│   │                             #   ใช้ helper ร่วมจาก lib/activityFiles.ts
│   ├── activities/export/        # Excel (exceljs) 2 ชีต: รายการงาน+สรุป — query: mine/category/status/q
│   ├── categories/               # GET ประเด็นงานที่ isActive
│   ├── geo/search/               # GET ผลแบ่งกลุ่ม: q ว่าง = recent (งานของฉัน) · saved (areaName ใน DB ทั้งเครือข่าย)
│   │                             #   + places (GISTDA, ตัด ATM/ซ้ำ/NULL) + regions (regions.ts) + regionsFirst
│   │                             #   จับคู่ตำบลของสถานที่: ที่อยู่ "ต./อ./จ."/"แขวง/เขต" → reverse geocode → เดา nearestTambon
│   ├── geo/reverse/              # GET พิกัด → ตำบล (+ ?nearby=1 สถานที่ใกล้เคียง คัดโรงเรียน/วัด/ราชการ/สาธารณสุขขึ้นก่อน)
│   ├── geo/tambon/               # GET จุดกลางตำบล + (?lat&lng) หมุดอยู่ในจังหวัดไหม + pinRegion ตำบลจริงของหมุด
│   ├── geo/tiles/[layer]/[z]/[x]/[y]/  # proxy แผนที่ดาวเทียม Sphere (คีย์ไม่หลุดถึง browser, same-origin) ต้อง login
│   ├── geo/resolve-link/         # POST ตาม redirect ลิงก์ย่อ maps.app.goo.gl → lat/lng (allowlist โดเมน Google กัน SSRF)
│   ├── profile/                  # PATCH แก้โปรไฟล์ตัวเอง (รูปเก็บ uploads/avatars/ → /api/files)
│   ├── activities/[id]/publish/  # POST แอดมินเผยแพร่/ร่าง/ยกเลิก + เลือก isPublic ของไฟล์ (audit log ทุกครั้ง)
│   ├── public-files/[id]/        # ไฟล์สำหรับหน้าสาธารณะ ไม่ต้อง login — เฉพาะ isPublic + งาน isPublished (อ้างด้วย id)
│   ├── public-logo/[kind]/[id]/  # โลโก้ประเด็น (category|sub) ไม่ต้อง login — ใช้แทนรูปปกกรณีศึกษาที่ยังไม่มีรูป
│   └── files/[...path]/          # serve ไฟล์จาก uploads/ (ต้อง login + isStaffRole, กัน path traversal)
│                                 #   `?v=card|cover` = รูปย่อ 16:9 WebP (imageVariant) — การ์ด "งานของฉัน", แถบรูป, ไทล์ในฟอร์ม
│                                 #   ต้นฉบับ ~1MB/รูป ห้ามใช้เป็นรูปย่อ (พรีวิวเต็มจอ/เปิดต้นฉบับยังใช้ไฟล์จริง)
├── components/
│   ├── SessionProvider.tsx
│   ├── ImageGallery.tsx          # แถบรูปเลื่อนซ้าย-ขวา (snap, ปุ่ม ‹ › จอใหญ่) + พรีวิวเต็มจอ (lightbox): ‹ › / ลูกศร / ปัด / รูปย่อ / Esc — หน้างาน + กรณีศึกษา
│   ├── Pagination.tsx            # แบ่งหน้าแบบ server component (?page=) ใช้ซ้ำได้ทุกหน้า
│   ├── ThaiDateField.tsx         # ปฏิทินป๊อปอัป ปี พ.ศ. (เลือกเดือน/ปี, ปุ่มวันนี้) — ใช้แทน
│                                 #   <input type="date"> ที่บังคับให้แสดง พ.ศ. ไม่ได้ (ค่า in/out = 'YYYY-MM-DD' ค.ศ.)
│   └── auth/                     # SignInForm, SignUpForm, ForgotPasswordForm, ResetPasswordForm, GoogleSignInButton
│                                 #   AuthLayout.tsx = เปลือก+Field/PasswordField/SubmitButton/Notice ร่วม (ดีไซน์แนว activerun:
│                                 #   ไม่มีการ์ด ช่องเส้นใต้ ปุ่มแคปซูลส้ม, ปุ่ม Google อยู่บนสุด) — label ไทยห้ามใส่ letter-spacing
└── lib/
    ├── db.ts                     # Prisma singleton + กรองงานในถังขยะอัตโนมัติ (ACTIVE_ACTIVITY สำหรับ relation ซ้อน)
    ├── activityAccess.ts         # involvedWhere() งานที่เป็นผู้เขียน/ทีม · purgeExpiredTrash() · teamPeople()
    ├── adminAuth.ts              # getAdminUser() — ตรวจสิทธิ์ admin/superadmin สำหรับ API
    ├── audit.ts                  # writeAuditLog()/diffFields() — audit trail (ไม่ throw ถ้าเขียน log พลาด)
    ├── story.ts                  # STORY_SELECT (ช่องที่ปลอดภัยสำหรับหน้าสาธารณะ), storyCover/Excerpt/Place, publicFileUrl
    ├── activityMeta.ts           # MAX_IMAGES=10, PARTNER_OPTIONS, canSeeCoordinatorContact() — ใช้ได้ทั้ง client/server
    ├── activityInput.ts          # parseActivityExtras() (ประเด็นย่อย/ผู้เข้าร่วม/ภาคี/ผู้ประสานงาน+ยินยอม),
    │                             #   imageLimitError(), applyImageMeta() (คำบรรยาย+ปก) — ใช้ร่วม POST/PATCH
    ├── logoStorage.ts            # saveLogo()/removeLogoFile() ใช้ร่วมโลโก้ประเด็น + ประเด็นย่อย (uploads/category-logos/)
    ├── logoImage.ts              # prepareLogo(): ตัดขอบว่าง/ขาว + ย่อให้ "ทแยงมุม" พอดีวงกลม → WebP 256px (browser)
    ├── categoryColors.ts         # สีประจำประเด็นงาน (แหล่งเดียว ใช้ทั้งแผนที่และโปรไฟล์)
    ├── areaCoverage.ts           # จำนวนอำเภอ/ตำบลจริงรายจังหวัด (ตัวหารของ % ความครอบคลุม)
    ├── provinceGeo.ts            # isInProvince() (point-in-polygon + เผื่อขอบ ~2 กม.) + resolveActivityCoords() ใช้ใน POST/PATCH
    ├── sphere.ts                 # GISTDA Sphere ฝั่ง server: reverseGeocode(), searchPlaces(), nearbyPlaces(), raster tiles
    ├── placeQuery.ts             # ขยายตัวย่อหน่วยงาน (สภ./สน./รพ.สต./รพ./อบต./ทม./สสอ./ศพด./รร. …) + "ประเภท + พื้นที่"
    │                             #   ("สถานีตำรวจ น่าน" → ค้นรอบจุดกลางจังหวัด/อำเภอแล้วกรอง) + matchRank ชื่อตรงขึ้นก่อน
    ├── regionLookup.ts           # findRegion()/searchRegions() ค้นตำบลฝั่ง server (ไม่ส่ง regions.ts 7,498 แถวไปหน้าเว็บ)
    ├── geoLink.ts                # parseLatLng() อ่านพิกัดจากลิงก์/ข้อความ + navigationUrl() ลิงก์นำทาง Google Maps (client+server)
    └── configs/auth/authOptions.ts  # NextAuth config (JWT + role ใน session)

components/Navbar.tsx             # แสดงทุกหน้า ยกเว้น /dashboard (มี Sidebar/TopNav ของตัวเอง)
server.js                         # Express ห่อ Next สำหรับ Plesk/Passenger (production) — ห้าม express.static uploads/
                                  #   ขั้นตอน deploy: docs/deploy-plesk.md
proxy.ts                          # (Next 16 เปลี่ยนชื่อจาก middleware.ts) /dashboard/* ต้อง role admin|superadmin ไม่งั้น → /auth/signin
                                  #   ล็อกอินแล้วเข้า / , /auth/signin, /auth/signup → redirect /map (หน้าแรกหลังล็อกอิน)
prisma/schema.prisma              # User, WorkCategory, WorkSubCategory, Activity, ActivityPolicy, ActivityMember,
                                  #   ActivityAttachment, AuditLog · migrations/ = ประวัติ schema (ใช้ migrate deploy)
scripts/seed-categories.mjs       # seed ประเด็นงาน 13 หมวด (node scripts/seed-categories.mjs)
uploads/                          # ไฟล์แนบ runtime (gitignore) — ห้ามเก็บใน public/ เพราะ prod ไม่ serve ไฟล์หลัง build
```

## Activity Module Rules
- 1 Activity = งาน 1 ประเด็นใน 1 พื้นที่ (กิจกรรมต่อเนื่อง: endDate null = ยังดำเนินการอยู่)
- พื้นที่เลือกผ่าน LocationField เท่านั้น (ตำบลต้องมาจาก regions.ts ห้ามพิมพ์เอง) — `region` เก็บเป็น HealthZone slug
  ซึ่ง server คำนวณจากจังหวัดเสมอ (`provinceHealthZones`) ไม่รับค่าจาก client
- `latitude/longitude` + `locationSource`: ผู้ใช้**ปักหมุดตำแหน่งจริงได้ (ไม่บังคับ)** ใน LocationPicker —
  `PLACE` เลือกจากช่องค้นหาสถานที่ · `PIN` คลิก/ลาก · `GPS` ตำแหน่งปัจจุบัน · `LINK` วางลิงก์ Google Maps/พิกัด
  (ลิงก์ย่อ maps.app.goo.gl จากปุ่มแชร์ทดสอบกับของจริงแล้วใช้ได้); ไม่ปัก = `TAMBON`
  server หาจากตำบล (`lib/tambonCoords.ts` — ตำบลตรงตัว → เฉลี่ยอำเภอ → null)
  - server ตรวจหมุดต้องอยู่ในจังหวัดที่เลือก (`isInProvince`) ไม่งั้น 400 · กด "เปลี่ยน" ในการ์ด = ล้างทั้งพื้นที่/ชื่อ/หมุด
  - **การค้นหาหน่วยงาน** (ทดสอบ ก.ย. 2026): Sphere ค้นแบบวลี → ตัวย่อ/"ประเภท พื้นที่" หาไม่เจอถ้าไม่ผ่าน placeQuery
    · "ประเภท + พื้นที่" ใช้ `searchNearby()` (`poi/search` + keyword — รับได้แม้ docs ไม่เขียน) เพราะ `search/search`
    ให้น้ำหนักความตรงของชื่อเหนือระยะ คำกว้าง ("โรงเรียน") ได้ผลทั้งประเทศ · regex ตัวย่อต้องกันคำจริง (สภ. ≠ สภา)
    · ตัด ATM (ยกเว้นตั้งใจค้น) · ชื่อซ้ำในกริด ~1 กม. = ที่เดียว
  - **ฐานข้อมูลสถานที่ของเราเอง**: areaName ของงานที่บันทึกแล้วถูกค้นก่อน GISTDA (กลุ่ม "เครือข่ายเคยบันทึก") —
    มีชุมชน/หมู่บ้านเล็กที่ GISTDA ไม่มี และไม่เสียโควตา API ยิ่งใช้ยิ่งแม่น
  - **ไม่ใช้ Google Places API** — เงื่อนไข Google ห้ามเก็บ lat/lng จาก Places ถาวรและห้ามแสดงบนแผนที่ที่ไม่ใช่ Google
    (แผนที่เราเป็น OSM) การวางลิงก์ที่ผู้ใช้ยืนยันเองไม่ติดข้อนี้ — ช่องค้นหาสถานที่จึงใช้ **GISTDA Sphere**
    (ทดสอบ ก.ย. 2026: หาโรงเรียน/วัด/อบต./รพ.สต. เจอมากกว่า Nominatim/Photon และให้ที่อยู่ ต./อ./จ. มาด้วย;
    มีรายการซ้ำชื่อ+พิกัดเดียวกัน → dedupe ใน API) · ชุมชน/หมู่บ้านเล็ก ๆ มักหาไม่เจอ ต้องปักหมุดเอง
  - **Reverse geocoding (Sphere `geo/address`)**: `geocode` = รหัสตำบล DOPA แต่ regions.ts ใช้รหัสชุดเก่า
    (ตำบลที่ย้ายไปอำเภอใหม่ไม่ตรง เช่น ท่าน้าว 550112→551406 อ.ภูเพียง, 114 แถวไม่มีรหัส)
    → `reverseGeocode()` จับคู่ด้วยชื่อ ตำบล|อำเภอ|จังหวัด ก่อน แล้วค่อยรหัส · หมุดตกตำบลอื่น = LocationPicker
    ขึ้นเตือน + ปุ่ม "ใช้ตำบลนี้" (เปลี่ยนพื้นที่โดยไม่ล้างหมุด)
  - **ที่อยู่ POI ของ GISTDA กับขอบเขตตำบลขัดกันได้ ผิดได้ทั้งคู่** — วัดภูมินทร์: ที่อยู่ ต.ผาสิงห์ ✗ ขอบเขต ต.ในเวียง ✓ ·
    ดอยสุเทพ: ที่อยู่ ต.สุเทพ ✓ ขอบเขต ต.ช้างเผือก ✗ → เลือกผล GISTDA แล้วใช้**ขอบเขตตำบลเป็นหลัก** (ข้อมูลเขตปกครอง
    ชุดเดียวทั้งประเทศ) + การ์ดขึ้น "ข้อมูล 2 แหล่งไม่ตรงกัน — ใช้ ต.X" สลับไปกลับได้ · ผลจาก DB เครือข่ายเชื่อตำบลเดิม
  - ปุ่ม "ภาพดาวเทียม" ใน LocationPicker = `sphere_hybrid` ผ่าน proxy (คมถึง z18, maxNativeZoom 18)
    · raster tile นามสกุลต่างกัน: `sphere_streets` = .png, `thailand_images`/`sphere_hybrid` = .jpeg (ผิด = 404)
  - ปุ่ม **"นำทาง"** (หน้า detail + popup แผนที่) = `navigationUrl()` ลิงก์ Google Maps ไม่ต้องใช้ API key:
    หมุดจริง → พิกัด · จุดกลางตำบล + มี areaName → ค้นด้วยชื่อสถานที่ (แม่นกว่าจุดกลางตำบล)
  - แผนที่: หมุดทุกงานตามพิกัด (หมุดจริงซ้อนกันกระจายวง ~50 ม., จุดกลางตำบล ~1.3 กม.) — ดู Map Rules
- **หน้าจอเรียกโซนว่า "ภาค"** (ตัดสินใจ ก.ย. 2026) — ใช้ `getRegionLabel()` → "ภาคเหนือบน", กทม. = "กรุงเทพฯ"
  ห้ามเขียน `โซน${...}` ในหน้าจอ/หัวคอลัมน์ Excel · โค้ด/ฟิลด์ยังชื่อ zone/region/HealthZone ตามเดิม
- **แหล่งความจริงของโซนคือ `utils/healthZones.ts` เท่านั้น** — ฟิลด์ `zone` ใน `data/regions.ts`
  เป็นข้อมูลอ้างอิง ไม่ได้ใช้คำนวณ ปัจจุบันทั้งสองชุด**ตรงกันครบ 77 จังหวัด**
  (ปรับ healthZones ตาม regions.ts เมื่อ ส.ค. 2026: ชัยนาท→เหนือล่าง, นครนายก→กลาง, มุกดาหาร→อีสานล่าง;
  เหลือต่างแค่ชื่อเรียก กทม. = "กรุงเทพฯ")
- สถานะ: PLANNING / ACTIVE / COMPLETED
- **งานเป็นงานทีม** (ผู้ใช้ตัดสินใจ 27 ก.ย. 2026; แอดมินเป็นผู้บันทึกตั้งแต่ 1 ต.ค.): `Activity.userId` = ผู้รับผิดชอบ + `ActivityMember` = ทีมงานร่วม
  (เลือกใน TeamField ของฟอร์ม, สูงสุด 20 คน) · "งานของฉัน"/โปรไฟล์/Excel ของฉัน ใช้ `involvedWhere()` (ผู้เขียนหรืออยู่ในทีม)
  · เพื่อนร่วมพื้นที่ไม่นับงานที่เราอยู่ในทีม · รายชื่อให้เลือกส่งแค่ชื่อ/หน่วยงาน/รูป (ไม่มีอีเมล/เบอร์)
- **ลบงาน = ย้ายลงถังขยะ** (`deletedAt`) ไฟล์ยังอยู่ · แอดมินกู้คืน/ลบถาวรที่ `/dashboard/setting/trash` · เกิน 30 วันลบถาวร
  พร้อมไฟล์อัตโนมัติ (`purgeExpiredTrash()` ทำงานตอนมีการลบ/เปิดหน้าถังขยะ — ไม่ต้องมี cron)
- **ประเด็นย่อย** (`WorkSubCategory` ใต้ WorkCategory, ไม่บังคับ): รายการที่แอดมินจัดการ ไม่ใช่ tag พิมพ์อิสระ ·
  server ตรวจว่าเป็นของประเด็นที่เลือก · กรองได้บนแผนที่ (กางใต้ประเด็นในแผงตัวกรอง), ตารางแอดมิน (`?sub=`), Excel
- **ผู้ประสานงานในพื้นที่**: ชื่อ/บทบาทเห็นทุกคน · **เบอร์/LINE เฉพาะแอดมิน + เจ้าของงาน** (ผู้ใช้ตัดสินใจ ก.ย. 2026)
  ต้องติ๊กยินยอมเมื่อกรอกเบอร์/LINE · `GET /api/activities/[id]` ตัดเบอร์ทิ้งถ้าไม่มีสิทธิ์ · audit เก็บแค่ "มีเบอร์/มี LINE"
  (ประวัติการแก้ไขทุกคนเห็น) · Excel มีคอลัมน์เบอร์เฉพาะไฟล์ที่แอดมินส่งออก · **ห้ามส่ง activity ทั้งก้อนเข้า client
  component** (จะพา coordinatorPhone ไปด้วย) ให้ select เฉพาะช่องที่ใช้
- **นโยบาย/ข้อตกลงรายระดับ** (ส่วนก่อน "ไฟล์แนบ" ในฟอร์ม — หัวข้อ "มีนโยบายระดับ" + ชิปติ๊กแถวเดียวที่มีแค่ชื่อระดับ,
  ติ๊กแล้วมีแถวไฟล์ของระดับนั้นใต้ชิป): ติ๊กได้หลายระดับ หมู่บ้าน/ตำบล/อำเภอ/จังหวัด/ประเทศ
  (**ตาราง `ActivityPolicy`** 1 แถว/ระดับ: level, name, type, year — ย้ายจาก JSON เมื่อ 27 ก.ย. 2026 เพื่อให้นับ/กรองด้วย SQL ได้;
  โค้ดแปลงเป็นรูป {levels, details} ด้วย `policyShape()`) · ไฟล์ของแต่ละระดับ = `ActivityAttachment.policyLevel`
  (formData `policy_<LEVEL>`, PDF/Office/รูปถ่ายเอกสาร) · ติ๊กโดยไม่แนบไฟล์ได้ · **ไม่นับเพดานรูป และไม่ขึ้นใน
  แกลเลอรี/รายการเอกสารทั่วไป** (กรอง `policyLevel: null`) · เลิกติ๊กระดับ = ไฟล์ระดับนั้นถูกลบตอนบันทึก ·
  server ปฏิเสธไฟล์ในระดับที่ไม่ได้ติ๊ก · Excel มีคอลัมน์ "นโยบาย/ข้อตกลง (ระดับ)"
- **แบบสำรวจ** (1 ต.ค. 2026, ส่วนถัดจาก "มีนโยบายระดับ"): ชิปติ๊ก "มีแบบสำรวจ" (`Activity.hasSurvey`) + แนบไฟล์ได้ (formData `survey`,
  `ActivityAttachment.isSurvey`, ชนิดไฟล์เดียวกับไฟล์นโยบาย) · **หลายชุดได้: 1 แถว = 1 ไฟล์ มีเลขลำดับ + ปุ่ม "+ เพิ่มแบบสำรวจ"** · ติ๊กโดยไม่แนบไฟล์ได้ · เลิกติ๊ก = ไฟล์แบบสำรวจถูกลบตอนบันทึก ·
  **กรองออกจากรูป/เอกสารทั่วไปทุกที่ (`!isSurvey`)** เหมือน policyLevel · หน้าเผยแพร่ครั้งแรก**ไม่ติ๊ก**ให้ (อาจมีข้อมูลผู้ตอบ) ·
  Excel คอลัมน์ "แบบสำรวจ" · แบบสำรวจสแกนมักเกิน 20MB → ย่อก่อน (สแกน 7 หน้า 28.8MB → 3.3MB ที่ 200dpi)
- **ขอบเขตพื้นที่ `areaScope`** หมู่บ้าน/ตำบล/ทั้งอำเภอ/ทั้งจังหวัด (ชิปใต้การ์ดพื้นที่) — ตำบลยังบังคับเป็นจุดอ้างอิง/ภาค ·
  ไม่มีหมุด: ทั้งอำเภอ = เฉลี่ยจุดกลางตำบลในอำเภอ, ทั้งจังหวัด = เฉลี่ยทั้งจังหวัด (`resolveActivityCoords(..., scope)`)
- **วันเริ่มแบบ "รู้แค่ปี"** (`startDatePrecision` YEAR) เก็บ **1 ม.ค. เวลา UTC** ของปีนั้น + แสดงผ่าน `formatStartDate()`
  เป็น "ปี 2562" — **ห้ามใช้ `new Date(y, 0, 1)`** (เวลาไทย = 31 ธ.ค. UTC → หน้าแก้ไขอ่านปีถอยทีละปีทุกครั้งที่บันทึก เคยเกิดแล้ว)
- **แปลงวันที่เป็น 'YYYY-MM-DD' ใช้ `toThaiDateInput()` (activityMeta) เสมอ ห้าม `toISOString().slice(0, 10)`** — งานที่นำเข้าด้วยสคริปต์
  เก็บเที่ยงคืนเวลาไทย (= 17:00 UTC วันก่อน) อ่านแบบ UTC ได้วันถอย 1 วัน (1 ต.ค. 2026: หน้าแก้ไขโชว์วันผิด + กดบันทึกเซฟวันผิดทับ เงียบ ๆ)
- **ความครอบคลุม** coverageVillages/Households/Population (ต่างจาก participantCount) · **รายละเอียดนโยบายรายระดับ**
  = คอลัมน์ name / type (POLICY_TYPES) / year พ.ศ. ของ ActivityPolicy กรอกในแถวของระดับที่ติ๊ก
- ข้อมูลจริงชุดแรก: นำเข้าแบบสำรวจนโยบายงานศพปลอดเหล้า 47 งาน (#85–#131) + กรอกมือ 2 (#83 หินดาด, #84 แวงน้อย) ก.ย. 2026
  สคริปต์: ขอบเขต = ระดับนโยบาย, จับคู่ตำบล/อำเภอที่สะกดผิดด้วย Levenshtein (ทุ่งเยาว→ทุ่งยาว, ศรีขรภูมิ→ศีขรภูมิ),
  ตำบลชื่อซ้ำไม่ระบุอำเภอ → อำเภอเมืองก่อน, ไม่มีตำบล → ค้น GISTDA, ไฟล์ Drive (แชร์เปิด) PDF=นโยบาย รูป=กิจกรรม ≤5,
  ชื่อไฟล์จาก content-disposition ต้องแปลง latin1→utf8
- **รายละเอียดการดำเนินงาน ≤ 20,000 ตัวอักษร** (DB = TEXT 65,535 ไบต์, ไทย 3 ไบต์/ตัว) — `descriptionError()` ใน
  activityMeta ตรวจทั้ง client/server (+ เพดานไบต์กันอีโมจิ) · ตัวนับใต้ช่อง เทา→ส้ม (18,000)→แดง · เกิน 3,000 ตัว
  แนะนำแนบรายงานฉบับเต็มเป็นไฟล์ · **ห้ามใส่ maxLength ใน textarea** (วางข้อความยาวแล้ว browser ตัดท้ายเงียบ ๆ)
- **รูปไม่เกิน 10 รูปต่องาน** (`MAX_IMAGES` — เดิม 5, เพิ่มเป็น 10 เมื่อ 1 ต.ค. 2026 · รวมรูปเดิม — เช็คทั้ง client และ server) · รูปปก `isCover` ได้ 1 รูป (ไม่เลือก = รูปแรก) ·
  คำบรรยาย `caption` · ภาคี `partners` = Json string[] จาก PARTNER_OPTIONS · แผนเฟส 2-3 ดู memory activity-data-roadmap
- **ฟอร์มห้าม fade-in จาก opacity 0** — HTML จาก server ต้องมองเห็นทันที (เดิมจอว่างจนกว่า JS โหลด) และ
  ActivityForm ครอบด้วย `<fieldset disabled={!hydrated}>`: พิมพ์ก่อน hydrate เสร็จ React ล้างค่าช่อง controlled ทิ้งเงียบ ๆ
- **ลิงก์ที่เกี่ยวข้อง** (`ActivityLink`, ก.ย. 2026) — โพสต์ FB/คลิป YouTube-TikTok/ไฟล์ใน Drive/ข่าว แทนการอัปไฟล์ใหญ่
  · ≤10 ลิงก์/งาน · รับเฉพาะ http(s) (`normalizeUrl()` ใน `lib/activityLinks.ts` — กัน `javascript:` ที่จะเป็น XSS ใน href)
  · ชนิดเดาจากโดเมน (`detectLinkKind`) ต้องเทียบ "โดเมนตรง/ซับโดเมน" ไม่ใช่ includes (evil-facebook.com ≠ Facebook)
  · แก้งานแล้วลิงก์เดิมคง `isPublic` · หน้าเผยแพร่: ครั้งแรกติ๊กทุกลิงก์ **ยกเว้น Google Drive** (มักเป็นเอกสารภายใน)
  · UI: `LinksField` (ฟอร์ม), `components/LinkList` (detail + stories), Excel คอลัมน์ "ลิงก์ที่เกี่ยวข้อง"
- **ไฟล์แนบเป็นทางเลือกเสมอ ห้ามบังคับ** (บังคับแค่ ชื่องาน/ประเด็น/พื้นที่/รายละเอียด) —
  งานที่เพิ่งวางแผนยังไม่มีรูป ถ้าบังคับผู้ใช้จะอัปมั่วหรือเลี่ยงไม่บันทึก
  - DOCUMENT: pdf, word, excel, **powerpoint** · IMAGE: jpg, png, webp, gif
  - **HEIC/HEIF จาก iPhone แปลงเป็น JPEG ฝั่ง browser** (heic2any) ก่อนบีบอัด — server รับเฉพาะชนิดที่แสดงผลได้
  - เพดาน 20MB/ไฟล์ และ 60MB ต่อการบันทึกหนึ่งครั้ง (เช็คทั้ง client และ server)
  - เพิ่มไฟล์ได้ 3 ทาง: กดปุ่มเลือก · **ลากมาวางในกรอบไฟล์แนบ** · **Ctrl+V จากคลิปบอร์ด**
- ยังไม่มีเรื่องงบประมาณ (ตัดสินใจ ส.ค. 2026 — ไว้เฟสหลัง)

## Map Rules (`/map`)
- แผนที่เต็มจอ (`h-screen`) — UI ลอยทับทั้งหมด, Leaflet โหลดใน `useEffect` เท่านั้น (กัน SSR)
- **โหมดสาธารณะ (ไม่ login, ผู้ใช้ตัดสินใจ ต.ค. 2026)**: แสดงทุกงาน แต่**กรองฝั่ง server ใน `map/page.tsx`** (ห้ามส่งไปซ่อนที่ client)
  — userName ว่าง, areaName null, หมุดจริง → จุดกลางตำบล (`getTambonCoords`), locationSource = TAMBON, โลโก้ผ่าน `/api/public-logo`
  · `MapView publicView`: คลิกหมุด/การ์ดงานที่ `published` → `/stories/[id]`, ยังไม่เผยแพร่ = "ยังไม่มีกรณีศึกษาเผยแพร่" (ไม่มีลิงก์)
  · ซ่อน: "โดย…", ปุ่มนำทาง, เกณฑ์จำนวนเจ้าหน้าที่, ป้าย "ใหม่", ปุ่ม Excel · สิทธิ์เพิ่ม/แก้งานคงเดิม (สมาชิกที่ login)
- **หมุด = 1 งาน 1 หมุด ตามตำแหน่งจริงทุกระดับซูม สีตามประเด็น** (ผู้ใช้ขอ ก.ย. 2026: ไม่ซ่อนงานรวมในหมุดจังหวัด)
  ปักตำแหน่งจริง = ทึบขอบขาว · จุดกลางตำบล (TAMBON) = จาง 0.6 ขอบประ · พิกัดซ้ำกระจายเป็นวง
  · **ลำดับโลโก้ของหมุด: ประเด็นย่อย (`WorkSubCategory.logo`, เช่น งานศพปลอดเหล้า = rip) → ประเด็นหลัก → หมุดสี**
  · **หมวดที่มีโลโก้ (`WorkCategory.logo`) = หมุดวงกลม 36px ใส่โลโก้ (วงขาวเปล่า ไม่มีขอบสี)** (`.sdn-logo-pin` ใน globals.css,
    ขอบประถ้าโดยประมาณ) — divIcon ไม่ใช่ `<path>` ตอนนับหมุดในเทสต์ต้องนับ `.sdn-logo-pin` เพิ่ม · PNG วาดจาก `<img>` บนแผนที่
    · โลโก้ civic (2917px 41KB) บีบเหลือ 256px ~7KB — โลโก้แนวนอนย่อตามทแยงมุมจึงเล็กลงแต่ไม่โดนวงกลมตัด
- **งานใหม่** = createdAt หลัง "ครั้งก่อนที่คนนี้เปิดแผนที่" (localStorage `sdn:map:lastSeen`, baseline ของแท็บใน
  sessionStorage ให้รีเฟรชแล้วยังเห็น) ไม่นับงานของตัวเอง · ครั้งแรก = 7 วัน · เพดาน 14 วัน
  แสดง: วงกระเพื่อม `.sdn-pulse` (globals.css, ปิดเมื่อ prefers-reduced-motion) + ชิป "ใหม่ N งาน" (กรอง+ซูม)
  + ป้าย "ใหม่" ใน popup/แผงขวา (เรียงขึ้นก่อน) · PNG วาดเป็นวงส้มแทนอนิเมชัน (options.sdn)
- **เส้นขอบประเทศบาง ๆ** (ก.ย. 2026): `COUNTRY_LINE` สีเกือบดำ หนา 1.2 โปร่ง 0.55 — แค่พอสังเกต ไม่เปลี่ยนหน้าตาเดิม
  (ผู้ใช้ลองฉากจางนอกประเทศ + เส้นหนาแล้ว **ไม่เอา** — อย่าเพิ่มกลับ) · ไม่ใช้ส้ม (สงวนให้ข้อมูล) · `interactive: false`
  · มาจาก `data/thailand-outline.json` ที่รวม 77 จังหวัดล่วงหน้าด้วย `node scripts/build-thailand-outline.mjs`
    (turf, devDependency) — แก้ thailand.json แล้วต้องรันใหม่ · PNG ที่ส่งออกวาดเส้นเดียวกัน
- 2 โหมด: **หมุด** / **ความหนาแน่น** (choropleth ไล่เฉดส้ม 5 ขั้น,
  จังหวัดไม่มีงาน = เทาอ่อน เห็น "ช่องว่าง") เลือกเกณฑ์ได้: จำนวนงาน / จำนวนเจ้าหน้าที่
- เลือกจังหวัด → ซูมเข้า + แตกหมุดรายงานสีตามประเด็น (งานที่พิกัดเดียวกันกระจายเป็นวง)
- **เปลี่ยนฟิลเตอร์แล้วซูมตามผลลัพธ์เสมอ** และถ้าจังหวัดที่เลือกไม่เหลืองาน → ยกเลิกการเลือกอัตโนมัติ
  (ไม่ผูกกับช่องค้นหา เพื่อไม่ให้แผนที่ขยับทุกครั้งที่พิมพ์)
- **คลิกหมุดงาน = popup บนแผนที่** (ไม่เปลี่ยนหน้า) · คลิกรายการในแผงขวา = ไปหน้า `/activity/[id]`
- ปุ่ม "ภาพแผนที่" = PNG 2x พร้อมแถบหัวเรื่อง (ขอบเขต/จำนวนงาน/ฟิลเตอร์/วันที่) + เครดิต OSM

## หน้าเผยแพร่สาธารณะ (`/stories`) — เฟส 3
- แอดมินกดเผยแพร่ได้เลย (ผู้ใช้ตัดสินใจ) ที่ปุ่ม "เผยแพร่เป็นกรณีศึกษา" ในหน้างาน → `/activity/[id]/publish`
- **query หน้าสาธารณะต้องใช้ `STORY_SELECT` เท่านั้น** — ห้าม include user/ผู้ประสานงาน/เบอร์/พิกัด · พื้นที่แสดงแค่ตำบล
  (หรือ "ทั้งอำเภอ/จังหวัด") · ไม่มีหมุดจริง · ไม่มีชื่อเจ้าหน้าที่
- **ไฟล์เปิดเผยเฉพาะที่ติ๊ก `isPublic`** ผ่าน `/api/public-files/[id]` (ต้อง isPublished ด้วย) — `/api/files` ยังต้อง login
  · ค่าเริ่มต้นครั้งแรก: เอกสาร/นโยบายติ๊ก, **รูปไม่ติ๊ก** (ต้องได้รับอนุญาตจากคนในภาพก่อน โดยเฉพาะเด็ก)
- ยังไม่เผยแพร่: แอดมินดูตัวอย่างที่ `/stories/[id]` ได้ (แถบเหลือง, รูปผ่าน /api/files) คนอื่น 404
- **รูปบนหน้าสาธารณะเป็น 16:9 เต็มกรอบเสมอ** — `/api/public-files/[id]?v=card` (640×360) / `?v=cover` (1280×720, ใช้กับ
  รูปปก/แกลเลอรี/og:image) ผ่าน `lib/imageVariant.ts` (sharp: ตัดขอบพื้นเรียบ → ครอบ 16:9 position attention → WebP,
  cache ที่ uploads/.cache/) · ตัดขอบแล้วเหลือ <50% = ไม่ตัด · คลิกรูปในแกลเลอรีเปิดไฟล์ต้นฉบับ · sharp อยู่ใน package.json แล้ว
- **เรื่องที่ยังไม่มีรูปเปิดเผย → แสดงโลโก้ประเด็นย่อย (หรือประเด็นหลัก) ในวงกลมขาวกลางกรอบ** (`storyLogoUrl()` ใน `lib/story.ts`)
  ผ่าน `/api/public-logo/...` เพราะ `/api/files/category-logos/...` ต้อง login — ไม่มีโลโก้ทั้งคู่ = ไอคอนหนังสือ
- `metadataBase` ใน layout.tsx จาก NEXTAUTH_URL → og:image เป็น URL เต็ม (ต้องตั้ง NEXTAUTH_URL โดเมนจริงบน production)
- เนื้อหา: storyLead (ว่าง = description) / storyProcess / storyLessons + ตัวเลขความครอบคลุม ภาคี นโยบาย ดึงจากงานอัตโนมัติ

## รูปโปรไฟล์
- **รูปใหม่เก็บที่ `uploads/avatars/` แล้วอ้างเป็น `/api/files/avatars/...`** (ต้อง login ถึงเปิดได้)
  — ห้ามเก็บลง `public/img` แบบ buddhistlent เพราะ production ไม่ serve ไฟล์ที่เพิ่มหลัง build
- รูปเก่าที่เป็น `/img/...` (มาจาก signup เดิม) ยังแสดงได้ปกติ ไม่ต้องย้าย
- ย่อ/แปลงรูปฝั่ง browser ก่อนอัปโหลด (HEIC→JPEG, ≤0.5MB, ≤800px)
- แก้โปรไฟล์แล้วต้องเรียก `session.update()` — `authOptions.jwt` รองรับ `trigger === 'update'`
  เพื่อให้ชื่อ/รูปบน Navbar เปลี่ยนทันทีโดยไม่ต้อง login ใหม่

## Auth Rules (เหมือน buddhistlent)
- Role: `member` (เจ้าหน้าที่) / `admin` / `superadmin` / **`pending`** — dashboard เข้าได้ทั้ง admin และ superadmin
- **สมัครใหม่ (ฟอร์ม + Google) = `pending` รอแอดมินอนุมัติ** (1 ต.ค. 2026 — เดิมได้ member ทันที คนนอกสมัครแล้วเห็นชื่อเจ้าหน้าที่/หมุดจริง)
  · pending เห็นแค่ข้อมูลสาธารณะ: แผนที่โหมดสาธารณะ, /stories, โปรไฟล์ตัวเอง · `/activity/*` → `/auth/pending` (proxy.ts)
  · API ภายในเช็ค `isStaffRole()` (activityMeta) ตอบ 403: activities/[id], export, files (ยกเว้น avatars/), geo/*, tiles
  · **เพิ่ม API/หน้าภายในใหม่ต้องเช็ค `isStaffRole` ไม่ใช่แค่ `session?.user`**
  · อนุมัติ = `/dashboard/setting/admin` แท็บ "รออนุมัติ" (เปิดให้เองถ้ามี) → member · แดชบอร์ดมีแถบเตือนจำนวนรออนุมัติ
  · **ปฏิเสธ** = ลบบัญชี (`DELETE /api/admin/users/[id]`) ได้เฉพาะ pending ที่ไม่มีงาน/ทีม/ประวัติ + ลบรูป avatars ตามไป
  · สมัครใหม่ → อีเมลแจ้งแอดมินทุกคน (BCC, ข้าม @test.sdn) ผ่าน `notifyAdminsOfSignup()` ใน `lib/mailer.ts`
    (transporter Gmail ใช้ร่วมกับลืมรหัสผ่าน · ไม่ await — ส่งพลาดไม่ทำให้สมัครล้ม · ไม่มี EMAIL_USER = ข้าม)
  · jwt callback อ่าน role จาก DB ใหม่ทุกครั้งที่ token ยังเป็น pending → อนุมัติแล้วใช้ได้ทันที (หน้า /auth/pending มีปุ่มรีเฟรช)
  · pending ไม่อยู่ในรายชื่อเลือกทีมงาน (`teamPeople`) และรายชื่อเครือข่าย (/dashboard/people)
- Session JWT มี `id, firstName, lastName, role, image` (ผ่าน callbacks ใน authOptions)
- Password: bcrypt, ขั้นต่ำ 5 ตัวอักษร (เช็คทั้ง frontend/backend)
- Reset token: crypto 32 bytes hex, หมดอายุ 1 ชั่วโมง
- **Google Sign-In** (แนวเดียวกับ activerun): ไม่ใช้ PrismaAdapter (schema ไม่มี Account/Session) —
  `callbacks.signIn` find-or-create User เอง: อีเมลตรงบัญชีเดิม = เข้าบัญชีเดิม (ไม่ทับชื่อ/รูป/role),
  อีเมลใหม่ = สร้าง role `member` · ปุ่ม `components/auth/GoogleSignInButton.tsx` ใช้ทั้ง signin/signup
  · OAuth client อยู่ในบัญชี Google `sdnthailandbackup@gmail.com` โปรเจกต์ GCP **sdnthailand** (`precise-ratio-463904-n8`)
  · redirect URI ที่ลงทะเบียนแล้ว: `http://localhost:3000` และ `https://network.sdnthailand.com` + `/api/auth/callback/google`
  · แอปยังอยู่โหมด **Testing** — login ได้เฉพาะ test users (ตอนนี้: sdnthailandbackup, sdn.warehouse) ต้องกด Publish app ก่อนเปิดใช้จริง
- Admin ห้าม demote ตัวเอง · role ของ superadmin แก้ได้เฉพาะ superadmin ด้วยกัน
- **เพิ่ม/แก้/ลบ Activity: admin/superadmin เท่านั้น** (ผู้ใช้ตัดสินใจ 1 ต.ค. 2026 — member ดูได้อย่างเดียว)
  ใช้ `canCreateActivity()` / `canEditActivity()` ใน `lib/activityMeta.ts` เสมอ (เช็คทั้ง API และหน้า UI —
  POST/PATCH/DELETE ตอบ 403, `/activity/new` redirect, ซ่อนปุ่ม "บันทึกงานใหม่" ใน /activity และ /profile)
  · เบอร์ผู้ประสานงานยังเห็นได้ทั้งแอดมิน + ทีมงานของงานนั้น (`canSeeCoordinatorContact`)
- **เปลี่ยนผู้เขียน (เจ้าของงาน) ได้เฉพาะ superadmin** (ผู้ใช้ตัดสินใจ ก.ย. 2026) — ช่อง "ผู้เขียน" แบบ WordPress บนหน้าแก้ไข
  (`AuthorPicker.tsx` เลือกแล้วบันทึกทันที) + โอนหลายงานในตารางแอดมิน · ทั้งคู่ใช้ `POST /api/admin/activities/transfer` + audit

## บัญชีทดสอบ (จาก seed scripts — รหัสผ่าน `12345` ทุกบัญชี)
| อีเมล | role | ใช้ทดสอบ |
|---|---|---|
| somchai@test.sdn | member | เจ้าของงานหลัก (มีงานเยอะสุด ใช้ทดสอบ pagination) |
| somying@test.sdn | member | ทับซ้อนพื้นที่กับสมชายระดับตำบล (เชียงราย) |
| wichai@test.sdn / pranee@test.sdn / thanakorn@test.sdn | member | กระจายพื้นที่อื่น |
| admin@test.sdn | admin | แดชบอร์ด/จัดการผู้ใช้ |
| super@test.sdn | superadmin | สิทธิ์สูงสุด |
| sdn.warehouse@gmail.com | admin | บัญชีจริงของเจ้าของโปรเจค (yongyut yodjarn) — มีงานศพปลอดเหล้า 49 งาน |

> **26 ก.ย. 2026 ล้างงานทดสอบทั้งหมดแล้ว** เหลือเฉพาะงานศพปลอดเหล้า 49 งาน (#83–#131) — บัญชี @test.sdn ยังอยู่แต่ไม่มีงาน
> ต้องการข้อมูลทดสอบ (pagination/ทับซ้อน) ให้รัน `node scripts/seed-test-data.mjs && node scripts/seed-test-bulk.mjs` แล้ว `--clean` หลังใช้

## แนวทางทดสอบ
ทดสอบด้วยเบราว์เซอร์จริงเสมอก่อนบอกว่า "เสร็จ" (build ผ่าน ≠ ใช้งานได้)
- คู่มือเต็ม + เช็กลิสต์: `.claude/skills/qa-e2e/SKILL.md` (เรียกด้วย skill `qa-e2e`)
- สคริปต์พร้อมใช้ (ปรับตามสิทธิ์ ต.ค. 2026 แล้ว — แอดมินเป็นคนสร้างงาน, ลบงานทดสอบถาวรเองทุกสคริปต์):
  `scripts/qa/full-flow.mjs` (ครบวงจร), `scripts/qa/map-ui.mjs` (หน้าแผนที่ ทีมงาน + โหมดสาธารณะ),
  `scripts/qa/team-policy-trash.mjs` (ทีมงาน + นโยบาย + ถังขยะ — ลบงานทดสอบถาวรเองตอนจบ)
  `scripts/qa/lightbox.mjs` (พรีวิวรูปเต็มจอ ใช้งาน #85 ที่มี 5 รูป),
  `scripts/qa/survey.mjs` (แบบสำรวจ ติ๊ก/แนบ/เลิกติ๊ก · ต้องตั้ง `SURVEY_PDF=<ไฟล์>` · ลบงานทดสอบถาวรเอง),
  `scripts/qa/links.mjs` (แนบลิงก์ → แก้ → เผยแพร่ → หน้าสาธารณะ · ลบงานทดสอบถาวรเอง)
```bash
mkdir -p /tmp/sdn-qa
node ~/.claude/skills/browser-automation/browser.mjs http://localhost:3000/ --script scripts/qa/full-flow.mjs
```

## Environment Variables (.env)
```env
DATABASE_URL="mysql://root:root@localhost:3306/StopDrinkNetwork?schema=public"
NEXTAUTH_URL="http://localhost:3000/"
NEXTAUTH_SECRET="..."
EMAIL_USER="..." / EMAIL_PASS="..."   # Gmail SMTP สำหรับ forgot-password
GOOGLE_CLIENT_ID="..." / GOOGLE_CLIENT_SECRET="..."   # Google OAuth (บัญชี sdnthailandbackup@gmail.com)
NEXT_PUBLIC_GISTDA_API_KEY="..." / GISTDA_API_BASE_URL="https://api.sphere.gistda.or.th"   # GISTDA Sphere (ชื่อเดียวกับ sdn-mapportal)
#   ใช้ฝั่ง server เท่านั้นผ่าน lib/sphere.ts — ห้ามอ้างใน client component · ต้องใส่ใน env production ด้วย
```

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
