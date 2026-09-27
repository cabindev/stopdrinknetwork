// เติมพิกัด lat/lng ให้ Activity ที่ยังไม่มี — lookup จาก app/data/tambon.json
// รัน: node scripts/backfill-coords.mjs
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';

const prisma = new PrismaClient();
const rows = JSON.parse(readFileSync('app/data/tambon.json', 'utf8')).data;

const byTambon = new Map();
const amphoeAgg = new Map();
for (const r of rows) {
  if (typeof r.LAT !== 'number' || typeof r.LONG !== 'number') continue;
  byTambon.set(`${r.TAMBON_T}|${r.AMPHOE_T}|${r.CHANGWAT_T}`, { lat: r.LAT, lng: r.LONG });
  const k = `${r.AMPHOE_T}|${r.CHANGWAT_T}`;
  const a = amphoeAgg.get(k) ?? { latSum: 0, lngSum: 0, n: 0 };
  a.latSum += r.LAT; a.lngSum += r.LONG; a.n++;
  amphoeAgg.set(k, a);
}

const targets = await prisma.activity.findMany({ where: { latitude: null } });
let tambonHit = 0, amphoeHit = 0, miss = 0;
for (const act of targets) {
  let c = byTambon.get(`${act.district}|${act.amphoe}|${act.province}`);
  if (c) tambonHit++;
  else {
    const a = amphoeAgg.get(`${act.amphoe}|${act.province}`);
    if (a) { c = { lat: a.latSum / a.n, lng: a.lngSum / a.n }; amphoeHit++; }
  }
  if (!c) { miss++; continue; }
  await prisma.activity.update({
    where: { id: act.id },
    data: { latitude: c.lat, longitude: c.lng },
  });
}
console.log(`backfill เสร็จ: ตรงตำบล ${tambonHit}, เฉลี่ยอำเภอ ${amphoeHit}, หาไม่เจอ ${miss} (จากทั้งหมด ${targets.length})`);
await prisma.$disconnect();
