# โลโก้ภาคี (ต้นฉบับ)

ไฟล์ต้นฉบับสีจริง (มี .svg ใช้ .svg ก่อน) — **ไม่เสิร์ฟบนเว็บ** (อยู่นอก `public/`) เก็บไว้ใช้คราวหน้า
ที่มา: `~/Desktop/logo/โลโก้หลัก` (24 พ.ย. 2026)

| ไฟล์ | โลโก้ |
|---|---|
| rip.svg | งานศพปลอดเหล้า (สัญลักษณ์ rip-symbol — เวกเตอร์, ใช้แทน PNG ตามที่ผู้ใช้เลือก 24 พ.ย. 2026) |
| thaihealth.png | สสส. (ThaiHealth 2022, 2 สี) |
| skl.png | สคล. (เครือข่ายองค์กรงดเหล้า) |
| civic.png | CivicSpace (ตัวดำ) |

สร้างรุ่นสีเทาสำหรับเว็บ (`public/brand/partners/*.png`) ด้วย:

```bash
node scripts/build-partner-logos.mjs
```

ใช้ที่ภาพสรุปที่ดาวน์โหลดจาก /map โหมดสรุปจังหวัด (`app/map/components/summaryPoster.ts`, มุมขวาบน)
