// server.js — custom Express server สำหรับรัน Next.js บน Plesk (แนวเดียวกับ activerun/runludtong.com)
// Plesk รัน Node ผ่าน Passenger ซึ่งต้องการ entry file ที่เรียก .listen() เอง บน port จาก process.env.PORT
//
// ⚠️ ห้ามเสิร์ฟ uploads/ ด้วย express.static (activerun ทำ แต่ระบบนี้ห้าม) — ไฟล์แนบ/รูปโปรไฟล์เป็นข้อมูลส่วนตัว
//    ต้องผ่าน /api/files (ต้อง login) หรือ /api/public-files (เฉพาะที่แอดมินเปิดเผย) เท่านั้น
const express = require('express')
const next = require('next')

const dev = process.env.NODE_ENV !== 'production'
const app = next({ dev, dir: __dirname })
const handle = app.getRequestHandler()
const port = Number(process.env.PORT) || 3000

app.prepare().then(() => {
  const server = express()
  server.disable('x-powered-by')
  // อยู่หลัง Cloudflare + nginx ของ Plesk — ให้ req.ip/req.protocol อ่านจาก X-Forwarded-* ได้ถูกต้อง
  server.set('trust proxy', true)

  // ทุกอย่างส่งให้ Next จัดการ (หน้าเว็บ, API, ไฟล์ static ใน public/ และ /_next)
  server.use((req, res) => handle(req, res))

  server.listen(port, (err) => {
    if (err) throw err
    console.log(`> Ready on http://localhost:${port}`)
    console.log(`> Environment: ${dev ? 'development' : 'production'}`)
  })
})
