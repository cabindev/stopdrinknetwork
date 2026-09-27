# stopdrinknetwork

ระบบบันทึกและติดตามการดำเนินงานของเครือข่ายงดเหล้า (Stop Drink Network) — Next.js 16 + Prisma + MySQL

- รายละเอียดโครงสร้าง กติกา และกับดักที่ต้องรู้: [CLAUDE.md](CLAUDE.md)
- ขั้นตอน deploy และ SQL สำหรับฐานข้อมูล production: [prisma/production-sql/README.md](prisma/production-sql/README.md)

```bash
npm ci
cp .env.example .env   # แล้วใส่ค่าจริง (ห้าม commit .env)
npm run dev
```
