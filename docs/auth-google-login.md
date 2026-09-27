# ระบบ Login (Google Sign-In + อีเมล/รหัสผ่าน)

บันทึกงานวันที่ 24 ก.ย. 2026 — เพิ่ม Google Sign-In ตามแนวของโปรเจกต์ `activerun`,
อัปเดต Next ให้ตรงกับ activerun, ปรับดีไซน์หน้า auth และกำหนดหน้าแรกหลังล็อกอิน

---

## 1. ภาพรวม

ล็อกอินได้ 2 ทาง ใช้ NextAuth 4 แบบ JWT ล้วน (ไม่มีตาราง Account/Session ในฐานข้อมูล)

| ทาง | Provider | หมายเหตุ |
|---|---|---|
| อีเมล + รหัสผ่าน | `CredentialsProvider` | bcrypt, รหัสขั้นต่ำ 5 ตัว |
| Google | `GoogleProvider` | scope `openid email profile` |

**ไม่ใช้ `PrismaAdapter`** — เดิมโค้ดใส่ไว้ แต่ schema ไม่มีตาราง `Account` ถ้ามี adapter
การล็อกอินด้วย Google จะพัง จึงถอดออกและ find-or-create ผู้ใช้เองใน `callbacks.signIn`
(แนวเดียวกับ activerun)

### พฤติกรรมตอนล็อกอินด้วย Google (`app/lib/configs/auth/authOptions.ts`)

- **อีเมลตรงกับบัญชีเดิม** (ไม่ว่าสมัครด้วยรหัสผ่านหรือ Google มาก่อน) → เข้าบัญชีเดิมทันที
  ไม่แตะรหัสผ่าน / role / ชื่อ / รูปที่ผู้ใช้ตั้งเอง — เติมรูปจาก Google ให้เฉพาะกรณีที่ยังไม่มีรูป
- **อีเมลใหม่** → สร้างบัญชีให้อัตโนมัติ role `member` เสมอ
  (ชื่อ/นามสกุลจาก `given_name`/`family_name` ของ Google, ตั้ง `emailVerified`)
- **บัญชี Google ที่ยังไม่ยืนยันอีเมล** → ปฏิเสธ (หน้า signin แสดงข้อความ `AccessDenied`)
- ไม่มีอีเมลไหนได้ admin อัตโนมัติ — ต้องไปตั้งในหน้า Settings → ผู้ดูแลระบบ

---

## 2. Google Cloud (ตั้งค่าแล้ว)

| รายการ | ค่า |
|---|---|
| บัญชี Google เจ้าของ | `sdnthailandbackup@gmail.com` |
| โปรเจกต์ GCP | **sdnthailand** (ID `precise-ratio-463904-n8`) |
| หน้า consent | ชื่อแอป "Stop Drink Network", home page `https://network.sdnthailand.com` |
| Authorized domain | `sdnthailand.com` |
| Audience | External — สถานะ **Testing** |
| Test users | `sdnthailandbackup@gmail.com`, `sdn.warehouse@gmail.com` |
| OAuth client | "Stop Drink Network (network.sdnthailand.com)" แบบ Web application |

**Authorized JavaScript origins**
- `https://network.sdnthailand.com`
- `http://localhost:3000`

**Authorized redirect URIs** (path `/api/auth/callback/google` ตายตัวตาม NextAuth)
- `https://network.sdnthailand.com/api/auth/callback/google`
- `http://localhost:3000/api/auth/callback/google`

Console: https://console.cloud.google.com/auth/clients?project=precise-ratio-463904-n8
(ในเบราว์เซอร์ของเครื่องนี้ บัญชี sdnthailandbackup คือ `authuser=5`)

### Environment variables

```env
GOOGLE_CLIENT_ID="...apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-..."
```

ค่าจริงอยู่ใน `.env` (อยู่ใน `.gitignore` — ห้าม commit)

### สิ่งที่ยังต้องทำ

- [ ] **เปลี่ยน Client secret ใหม่** — Clients → เปิด client → *Add secret* → ใส่ `.env` → ลบ secret เก่า
      (ค่า secret ดูซ้ำไม่ได้หลังปิดหน้าต่างตอนสร้าง)
- [ ] **Publish app** (Audience → Publish app) ก่อนเปิดใช้จริง — ตอน Testing ล็อกอินได้เฉพาะ test users
      Google อาจขอลิงก์ privacy policy ในหน้า Branding
- [ ] **ตอน deploy `network.sdnthailand.com`** ตั้งค่าบนเซิร์ฟเวอร์:
      ```env
      NEXTAUTH_URL="https://network.sdnthailand.com"
      NEXTAUTH_SECRET="<สร้างใหม่: openssl rand -base64 32>"
      GOOGLE_CLIENT_ID="<ตัวเดิม>"
      GOOGLE_CLIENT_SECRET="<ตัวใหม่>"
      ```
      ต้องเป็น `https://` เท่านั้น (Google ไม่รับ redirect แบบ http บนโดเมนจริง)

---

## 3. หน้า auth (ดีไซน์ใหม่แนว activerun)

ทั้ง 4 หน้าใช้เปลือกร่วม `app/components/auth/AuthLayout.tsx`

- ไม่มีการ์ด พื้นขาวล้วน · eyebrow ส้ม "STOP DRINK NETWORK" + หัวเรื่องใหญ่
- ช่องกรอกแบบเส้นใต้ (focus = เส้นส้ม) · ปุ่มหลักแคปซูลส้มพื้นล้วน · สลับรหัสผ่านด้วยข้อความ "แสดง/ซ่อน"
- **ปุ่ม Google อยู่บนสุด** → เส้นคั่น "หรือใช้อีเมล" → ฟอร์มอีเมล
- label ภาษาไทย **ห้ามใส่ letter-spacing** (ทำให้อักษรไทยแยกห่าง) — ใช้เฉพาะ eyebrow ภาษาอังกฤษ

| ไฟล์ | หน้า |
|---|---|
| `AuthLayout.tsx` | เปลือก + `Field`, `PasswordField`, `SubmitButton`, `Notice`, `OrDivider`, `Spinner` |
| `GoogleSignInButton.tsx` | ปุ่ม "ดำเนินการต่อด้วย Google" ใช้ทั้ง signin/signup |
| `SignInForm.tsx` | `/auth/signin` — รองรับ `?callbackUrl=` และ `?error=` (อยู่ใน `<Suspense>`) |
| `SignUpForm.tsx` | `/auth/signup` |
| `ForgotPasswordForm.tsx` / `ResetPasswordForm.tsx` | ลืม/ตั้งรหัสผ่านใหม่ |

`callbackUrl` รับเฉพาะ path ในเว็บเราเอง — URL ของเว็บอื่นจะถูกแทนด้วย `/map` (กัน open redirect)

---

## 4. หน้าแรกหลังล็อกอิน + การกันสิทธิ์ (`proxy.ts`)

Next 16 เปลี่ยนชื่อ `middleware.ts` → **`proxy.ts`** (ทำงานเหมือนเดิม)

| สถานการณ์ | ผลลัพธ์ |
|---|---|
| ล็อกอินสำเร็จ (อีเมลหรือ Google) | ไป **`/map`** (แผนที่รวมงาน) |
| ล็อกอินแล้วเปิด `/`, `/auth/signin`, `/auth/signup` | redirect → `/map` |
| มี `?callbackUrl=/dashboard` แล้ว admin ล็อกอิน | ไป `/dashboard` ตามที่ขอ |
| ยังไม่ล็อกอินเปิด `/dashboard` | → `/auth/signin` |
| member เปิด `/dashboard` | → `/map` |
| ออกจากระบบ (Navbar / Sidebar แดชบอร์ด) | กลับ `/` (landing), session ถูกล้าง |

### member (ยังไม่เป็น admin) เห็นอะไร

- Navbar: **งานของฉัน**, **แผนที่รวม**, เมนูโปรไฟล์ — ปุ่ม Dashboard ซ่อน
- บันทึกงาน, แก้/ลบได้เฉพาะงานของตัวเอง, ดู "เพื่อนร่วมพื้นที่", export Excel เฉพาะงานตัวเอง
- API ฝั่งแอดมินทุกตัว (`/api/admin/*`) เช็ค role **จากฐานข้อมูล** ทุกครั้ง → member ได้ `403`

### ⚠️ ช่องโหว่ที่ยังค้าง

role ที่ proxy และ Navbar ใช้มาจาก JWT ซึ่ง snapshot ตอนล็อกอิน (อายุ 30 วัน)
- เลื่อน member เป็น admin → ต้องออกแล้วล็อกอินใหม่ถึงเห็นแดชบอร์ด
- ลด admin เป็น member → **ยังเปิดหน้าแดชบอร์ดดูข้อมูลได้** จนกว่า token หมดอายุ (แก้ไขข้อมูลไม่ได้เพราะ API เช็ค DB)

แนวแก้ (แบบ activerun): ใน `callbacks.jwt` อ่าน role ล่าสุดจาก DB ทุกครั้งที่ไม่ใช่ตอน sign-in — ยังไม่ได้ทำ

---

## 5. อัปเดตแพ็กเกจให้ตรง activerun

| แพ็กเกจ | เดิม | ใหม่ |
|---|---|---|
| next | 16.3.0 | 16.3.3 |
| react / react-dom | 19.2.7 | 19.2.8 |
| next-auth | 4.24.7 | 4.24.15 |
| prisma / @prisma/client | 6.6 / 6.9 | 6.19.3 |
| @types/react(-dom) | 18 | 19 |

**ไม่ได้อัปเดต Tailwind** (โปรเจกต์นี้ยัง v3, activerun เป็น v4) — การย้ายต้องแก้ config/CSS ทั้งระบบ แยกเป็นงานต่างหาก

---

## 6. ผลการทดสอบ (เบราว์เซอร์จริง)

- ✅ รหัสผิด → ข้อความเตือน · รหัสถูก → เข้าระบบ + ไปตาม callbackUrl
- ✅ Google: ปุ่มอยู่บนสุดทั้ง 2 หน้า, redirect ไป accounts.google.com ด้วย client ID ใหม่ถูกต้อง
      (ยังไม่ได้ทดสอบล็อกอิน Google จนจบ — ต้องให้เจ้าของบัญชีกดเลือกบัญชีเอง)
- ✅ ออกจากระบบ member (Navbar) และ admin (Sidebar) → session ว่าง, หน้าที่ต้องล็อกอินเด้งไป signin
- ✅ redirect หลังล็อกอินและหน้า guest-only ตามตารางหัวข้อ 4
- ✅ มือถือ 375px ไม่มี scroll แนวนอน
- ✅ หลังอัปเดต Next: 10 หน้าหลัก (activity/map/profile/dashboard) ได้ 200 ไม่มี console error, typecheck ผ่าน

### ปัญหาที่พบระหว่างทาง (ยังไม่ได้แก้)

- สคริปต์ QA `scripts/qa/full-flow.mjs` และ `map-ui.mjs` **ล้าสมัย** — ยังกรอก `#startDate` แบบ `<input type="date">`
  (ปัจจุบันเป็น ThaiDateField ปฏิทินป๊อปอัป) และหาปุ่มหมวดหมู่ในแผงแผนที่แบบเดิมไม่เจอ
- หน้าลืมรหัสผ่านตอบ "ไม่พบผู้ใช้งานในระบบ" เมื่ออีเมลไม่มีในระบบ → คนนอกเช็คได้ว่าอีเมลไหนมีบัญชี
  (ควรตอบข้อความเดียวกันเสมอ)
