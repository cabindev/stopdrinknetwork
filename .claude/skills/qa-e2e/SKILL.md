---
name: qa-e2e
description: ทดสอบระบบ Stop Drink Network ด้วยเบราว์เซอร์จริง (login, บันทึกงาน, ไฟล์แนบ, แผนที่, สิทธิ์, แดชบอร์ด) ใช้เมื่อแก้ไขโค้ดเสร็จแล้วต้องการยืนยันว่าใช้งานได้จริง หรือเมื่อผู้ใช้ขอให้ "ทดสอบระบบ" / "เช็คว่าใช้ได้ไหม" / รายงานว่าอะไรพัง
---

# ทดสอบระบบ Stop Drink Network แบบ end-to-end

เป้าหมาย: ยืนยันด้วยเบราว์เซอร์จริงว่าฟีเจอร์ทำงาน **ก่อน**บอกผู้ใช้ว่าเสร็จ
build ผ่านไม่ได้แปลว่าใช้งานได้ — บั๊ก "แนบเอกสารไม่ได้ทั้งระบบ" เคยรอด typecheck + build มาแล้ว

## ขั้นตอนก่อนเริ่มเสมอ

1. **ถ้าเพิ่งแก้ `prisma/schema.prisma` ต้อง restart dev server** ก่อนทดสอบ ไม่งั้นผลลวง
   (PrismaClient ถูก cache ใน `globalThis` รอด hot-reload — model ใหม่จะไม่มีใน instance เก่า)
   ```bash
   lsof -ti:3000 | xargs kill; sleep 2
   nohup npm run dev > /tmp/dev.log 2>&1 &
   sleep 12 && curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/
   ```
2. เช็คว่ามีข้อมูลทดสอบอยู่ ถ้าไม่มีให้ seed:
   `node scripts/seed-test-data.mjs && node scripts/seed-test-bulk.mjs`

## วิธีรัน

```bash
node ~/.claude/skills/browser-automation/browser.mjs http://localhost:3000/ --script <script.mjs>
```
เขียนสคริปต์เป็นไฟล์ที่ `export default async (page, ui) => result` — ค่าที่ return จะถูกพิมพ์เป็น JSON
ทุกขั้นตอนต้องอยู่ในไฟล์เดียว เพราะแต่ละครั้งที่รันจะเปิดเบราว์เซอร์ใหม่ (session ไม่ค้าง)

## ตัวช่วยที่ใช้ซ้ำได้

```js
const BASE = 'http://localhost:3000';

async function login(page, email) {
  await page.goto(`${BASE}/auth/signin`, { waitUntil: 'domcontentloaded' });
  await page.fill('#email', email);
  await page.fill('#password', '12345');
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.includes('signin'), { timeout: 25000 }).catch(() => {});
  return !page.url().includes('signin');
}

async function logout(page) {
  await page.goto(`${BASE}/api/auth/signout`, { waitUntil: 'domcontentloaded' });
  await page.locator('button[type=submit]').click().catch(() => {});
  await page.waitForTimeout(800);
}

// นับหมุดบนแผนที่ — Leaflet วาด circleMarker เป็น <path> ที่มีคำสั่ง arc ('a')
// ส่วน polygon จังหวัดไม่มี จึงใช้แยกกันได้ (อย่าใช้ selector 'circle' — ไม่มีในหน้า)
const markerCount = () =>
  [...document.querySelectorAll('path.leaflet-interactive')]
    .filter((p) => (p.getAttribute('d') || '').includes('a')).length;

// รอให้แผนที่พร้อมก่อนวัดผลเสมอ
await page.waitForFunction(
  () => document.querySelectorAll('path.leaflet-interactive').length > 50, { timeout: 25000 });
```

## เช็กลิสต์ที่ควรครอบคลุม

| ด้าน | วิธีตรวจ |
|---|---|
| สิทธิ์เข้าถึง | ยังไม่ล็อกอินเปิด `/activity`, `/map`, `/profile`, `/dashboard` → ต้องเด้ง signin ทุกเส้น |
| สิทธิ์ระหว่างผู้ใช้ | login เป็น somying แล้วเปิด `/activity/<id ของสมชาย>/edit` → ต้องถูกเด้งออก และไม่เห็นปุ่มแก้ไข/ลบ |
| member vs admin | member เปิด `/dashboard` ไม่ได้ · admin/superadmin เปิดได้ทุกหน้าใน setting |
| ฟอร์มบันทึกงาน | `#locationSearch` พิมพ์ "ต.บ้านโป่ง" หรือชื่อสถานที่ → `press Enter` (เลือกรายการแรก) → รอ `[data-testid=location-card]` ต้องมี ต./อ./จ. + "ภาค" · ชื่อสถานที่ = `#areaName` (อยู่ในการ์ด โผล่หลังเลือกพื้นที่) · วันที่เป็นปฏิทิน: `click('#startDate')` → ปุ่ม "วันนี้" |
| ช่องพื้นที่ (LocationField) | ลิงก์ย่อ maps.app.goo.gl + Enter · GPS (`context.setGeolocation` + ปุ่ม `title="ใช้ตำแหน่งปัจจุบัน"`) → ต้องได้ชิป "สถานที่ใกล้หมุด" · "หรือเลือกจากแผนที่" แล้วคลิกแผนที่ → การ์ดต้องขึ้นตำบลเอง |
| ไฟล์แนบ | `setInputFiles('[data-testid=doc-input]', ...)` และ `[data-testid=image-input]` (**ห้ามใช้ selector ตาม accept** — ชนกับ `[data-testid=policy-input]` ไฟล์นโยบาย จะเงียบหาย) · นโยบาย: `check('input[aria-label="มีนโยบายระดับตำบล"]')` แล้วกด `button[aria-label="แนบไฟล์นโยบายตำบล"]` + `waitForEvent('filechooser')` (ช่องติ๊กเป็นชิปแถวเดียว ข้อความในชิปมีแค่ชื่อระดับ) → **ต้องเห็นชื่อไฟล์ใน UI ก่อนกดบันทึก** แล้วเช็คใน DB ว่ามี attachment จริง (ทดสอบ .pptx ด้วย) |
| ลากวาง / คลิปบอร์ด | dispatch `DragEvent('drop', {dataTransfer})` ที่ section "ไฟล์แนบ" และ `ClipboardEvent('paste')` ที่ document → ไฟล์ต้องถูกเพิ่ม · **ตรวจ className หลัง `waitForTimeout(400)`** ไม่งั้นอ่านก่อน React re-render จะได้ผลลวง |
| แก้ไข + audit | แก้ชื่อ/สถานะ → หน้า detail ต้องมี "ประวัติการแก้ไข" และ `/dashboard/setting/audit` ต้องมีรายการ |
| ลบงาน (ถังขยะ) | กด "ลบงานนี้" → "ยืนยันลบ" → เด้งกลับ `/activity` · งานต้องหายจากทุกหน้า (detail = 404) แต่ยังอยู่ใน `/dashboard/setting/trash` (ไฟล์ยังอยู่) · กู้คืนแล้วกลับมาครบ · ลบถาวรแล้วไฟล์ใน `uploads/activities/<id>/` ต้องหาย — สคริปต์ `scripts/qa/team-policy-trash.mjs` |
| ทีมงาน | สมาชิกทีมเห็นงานใน "งานของฉัน" + แก้ได้ · คนนอกทีมเปิด edit แล้วถูกเด้ง, DELETE ได้ 403 |
| แผนที่ | กรองประเด็นแล้วหมุดเปลี่ยนสีตามหมวด · โหมดความหนาแน่นซ่อนหมุดหมด · เปลี่ยนฟิลเตอร์แล้วซูมตามผลลัพธ์ |
| popup หมุด | คลิกหมุดงาน (สีประจำประเด็น ไม่ใช่ส้ม) → `.leaflet-popup` ต้องเปิดและ **URL ต้องไม่เปลี่ยน** · คลิกรายการในแผงขวา → ต้องไป `/activity/[id]` |
| export PNG | กดปุ่ม "ภาพแผนที่" → ดักด้วย `page.waitForEvent('download')` แล้วตรวจ magic bytes `89504e47` + ขนาดภาพ · ถ้าเลือกจังหวัดไว้ ให้เปิดภาพดูว่าเส้นขอบที่วาดทับขอบจังหวัดจริงพอดี (วิธีพิสูจน์ว่าพิกัดตรง) |
| วันที่ พ.ศ. | ฟอร์มต้องไม่มี `input[type=date]` · ปีในปฏิทินเป็น พ.ศ. · เลือกวันแล้วช่องแสดง "15 สิงหาคม 2569" · บันทึกแล้ว DB เก็บเป็น ค.ศ. |
| โปรไฟล์ | สถิติ 4 ช่อง (งาน/จังหวัด/ประเด็น/ไฟล์) · แถบประเด็นสีตรงกับแผนที่ · ปุ่ม export ต้องได้เฉพาะงานตัวเอง |
| แดชบอร์ดสถิติ | `/dashboard` ต้องมีตัวเลขรวม 4 ช่อง, ช่องว่างพื้นที่, พื้นที่ทับซ้อน, YoY, แท่งแนวโน้ม 12 แท่ง, กราฟรายประเด็น/รายโซน · กดปุ่มปี → URL เป็น `?year=` |
| ตารางงานทั้งหมด | `/dashboard/activities` (แอดมินเท่านั้น) — กรองประเด็น/จังหวัด/สถานะ/ปี แล้วจำนวน "พบ n รายการ" ต้องเปลี่ยน · member ต้องถูกเด้งออก |
| รายชื่อเครือข่าย | `/dashboard/people` (แอดมิน) — เลือกทั้งหมด/กรองเฉพาะมีเบอร์/ค้นหา · ส่งออก Excel (ดัก download) · "พิมพ์ใบลงชื่อ" ต้องเปิด popup ที่มีคอลัมน์ "ลายมือชื่อ" (ดักด้วย `page.waitForEvent('popup')`) |
| pagination | `/activity?page=2` ต้องขึ้น "แสดง 11–…" และ `?page=99` ต้องตกมาหน้าสุดท้ายไม่ใช่หน้าว่าง |
| มือถือ | `page.setViewportSize({ width: 390, height: 844 })` แล้วดูว่าปุ่มยังกดได้และไม่ล้นจอ |

## อ่านผลอย่างไร

- **`console errors/warnings (0)`** คือสัญญาณที่ถูกที่สุด ดูก่อนเสมอ
- **tile จาก openstreetmap ล้มเหลวเป็นครั้งคราว = ปกติ** (เน็ต/rate limit) ไม่ใช่บั๊กของแอป
- **วัดค่าแล้วได้ false อย่าเพิ่งสรุปว่าพัง** — ตรวจว่าวิธีวัดถูกก่อน เช่น นับหมุดสีส้มตอนที่ระบบเปลี่ยน
  เป็นสีประจำหมวดอยู่ ย่อมได้ 0 ทั้งที่ทำงานถูก
- รูปที่เพิ่งแทรกอาจยังโหลดไม่เสร็จตอน evaluate — เช็ค log ฝั่ง server (`GET /api/files/... 200`) ประกอบ

## กับดักของเครื่องมือทดสอบ (เสียเวลาไปแล้ว อย่าซ้ำ)
- **สคริปต์รันใน isolated world** (browser.mjs ใช้ patchright) — มองไม่เห็นตัวแปร `window.xxx` ที่หน้าเว็บตั้ง และ
  `console.warn` ของหน้าไม่ขึ้นในผลทดสอบ → ถ้าต้อง debug ให้หน้าเขียนลง `document.body.dataset.*` แล้วอ่านจาก DOM
- **ชื่อจาก tooltip จังหวัดตามเมาส์ช้ากว่าจุดจริง** — อย่าใช้ยืนยันว่าคลิกโดนจังหวัดไหน · คลิกจังหวัดที่ "ไม่มีงาน" จะถูก
  ยกเลิกการเลือกทันที (ตั้งใจ) ดูเหมือนคลิกไม่ติด → ทดสอบกับจังหวัดที่มีงาน แล้วเช็คเส้นส้ม `stroke="#ea580c"`
- **ก่อนสรุปว่าโค้ดใหม่ไม่ทำงาน ให้เช็คว่ามี `next dev` ค้างหลายตัวไหม** (`ps aux | grep "[n]ext dev"`) — เคยค้าง 3 ตัว
  แล้ว port 3000 เสิร์ฟโค้ดเก่า · แท็บ Chrome ที่อยู่เบื้องหลัง (`document.hidden`) animation ของ Leaflet หยุดค้างกลางทาง

## ล้างข้อมูลหลังทดสอบ

งานที่สร้างระหว่างเทสต์ต้องลบทิ้งทุกครั้ง ไม่ให้ปนข้อมูลจริง
```bash
node -e "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();
p.activity.deleteMany({where:{title:{startsWith:'QA '}}}).then(async d=>{
  console.log('ลบ',d.count,'งาน | เหลือ',await p.activity.count()); await p.\$disconnect();})"
rm -rf uploads/activities/<id>
```
ลบข้อมูลทดสอบทั้งชุด: `node scripts/seed-test-data.mjs --clean`

> งานที่ full-flow ลบจะอยู่ในถังขยะ (ยังอยู่ใน DB) — คำสั่ง `deleteMany` ด้านบนลบถาวรได้ เพราะตัวกรองถังขยะใน db.ts ไม่กระทบการลบ

## บัญชีที่ใช้ทดสอบ (รหัส `12345`)
`somchai@test.sdn` (งานเยอะสุด/pagination) · `somying@test.sdn` (ทับซ้อนระดับตำบลกับสมชาย) ·
`admin@test.sdn` · `super@test.sdn` · `sdn.warehouse@gmail.com` (บัญชีจริง — งาน Civic Space 10 จังหวัด)

## คลิกอะไรบนแผนที่อย่างไร
- **ไม่มีหมุดรวมรายจังหวัดแล้ว** — ทุกงานเป็นหมุดของตัวเองตั้งแต่มุมทั้งประเทศ · จังหวัด = คลิก polygon · งานใหม่ = `.sdn-pulse` + ปุ่ม `button[aria-pressed]:has-text("ใหม่")` "ใหม่ N งาน" · ปุ่มสถานะอยู่ในแผง "ตัวกรอง" (rail) ไม่ได้ลอยบนแผนที่แล้ว (ต้อง login คนละคนกับเจ้าของงาน)
- **หมุดรายงาน** = path ที่ `d` มี arc (หมวดไม่มีโลโก้) **+ `.sdn-logo-pin`** (หมวดที่มีโลโก้ เช่น Civic Space — เป็น divIcon ไม่ใช่ path)
- ต้องใช้ **เมาส์จริง** (`page.mouse.click(x, y)`) ไม่ใช่ `dispatchEvent` — ไม่งั้น Leaflet ไม่เปิด popup
- รอแผนที่นิ่งก่อนวัดผลเสมอ (flyTo ใช้เวลา ~0.6s + tile โหลด) มิฉะนั้นพิกัดที่วัดได้จะเป็นสถานะกลางทาง

## รายงานผลอย่างไร

บอกผลเป็นตาราง ผ่าน/ไม่ผ่านรายข้อ พร้อม **หลักฐานที่วัดได้จริง** (ตัวเลข/สถานะ HTTP) ไม่ใช่คำว่า "น่าจะได้"
ถ้าเจอบั๊ก ให้ระบุ: อาการที่ผู้ใช้เจอ → สาเหตุในโค้ด → จุดที่แก้ → ผลทดสอบซ้ำหลังแก้
