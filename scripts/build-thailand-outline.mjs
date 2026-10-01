// สร้างเส้นขอบประเทศไทย (รวม 77 จังหวัดเป็นรูปเดียว) → app/data/thailand-outline.json
// รันครั้งเดียว (หรือเมื่อ thailand.json เปลี่ยน): node scripts/build-thailand-outline.mjs
// ใช้วาดเส้นขอบประเทศเข้ม + ฉากจางนอกประเทศบนแผนที่ (MapView) — คำนวณล่วงหน้าเพื่อไม่ให้หน้าเว็บช้า
import { readFileSync, writeFileSync } from 'fs';
import union from '@turf/union';
import simplify from '@turf/simplify';
import { featureCollection, multiPolygon } from '@turf/helpers';

const provinces = JSON.parse(readFileSync('app/data/thailand.json', 'utf8'));
// ขยายนิดเดียวก่อนรวมไม่ได้ใน turf แบบง่าย → รวมตรง ๆ แล้วทิ้ง "รู" (ช่องว่างเล็กระหว่างขอบจังหวัดที่ไม่ชนกันสนิท)
const merged = union(featureCollection(provinces.features));
const polys = merged.geometry.type === 'Polygon' ? [merged.geometry.coordinates] : merged.geometry.coordinates;

// ขนาดพื้นที่คร่าว ๆ (องศา²) ของวงนอก — ใช้ตัดเศษเกาะ/เศษเส้นเล็กมากที่เกิดจากการรวม
const ringArea = (ring) => {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
  return Math.abs(a / 2);
};
const outer = polys.map((p) => [p[0]]).filter((p) => ringArea(p[0]) > 0.0005); // ~6 ตร.กม. — เก็บเกาะใหญ่ (ภูเก็ต สมุย ช้าง ฯลฯ)

const outline = simplify(multiPolygon(outer), { tolerance: 0.003, highQuality: true });
// ปัดพิกัด 4 ตำแหน่ง (~11 ม.) — เส้นขอบระดับประเทศไม่ต้องละเอียดกว่านี้ ไฟล์เล็กลงครึ่งหนึ่ง
outline.geometry.coordinates = outline.geometry.coordinates.map((p) =>
  p.map((ring) => ring.map(([x, y]) => [Math.round(x * 1e4) / 1e4, Math.round(y * 1e4) / 1e4]))
);
outline.properties = { name: 'Thailand', note: 'สร้างจาก thailand.json ด้วย scripts/build-thailand-outline.mjs' };
writeFileSync('app/data/thailand-outline.json', JSON.stringify(outline));

const pts = outline.geometry.coordinates.reduce((n, p) => n + p[0].length, 0);
console.log(`รวม ${provinces.features.length} จังหวัด → ${outline.geometry.coordinates.length} รูป (แผ่นดินใหญ่ + เกาะ) · ${pts} จุด`);
