// scripts/build-partner-logos.mjs — โลโก้ภาคีรุ่นสีเทา (brand-assets/partners/*.svg|png → public/brand/partners/*.png)
// ตัดขอบใส · เทาโทนเดียว (ส่วนมีสี/เข้ม = gray-500 เท่ากันทุกโลโก้, ส่วนสว่างคงขาว) · สูง 240px (วาดในภาพ 2x ได้คม)
import sharp from 'sharp';
import fs from 'node:fs';

const SRC = 'brand-assets/partners';
const OUT = 'public/brand/partners';
fs.mkdirSync(OUT, { recursive: true });
const DARK = 107; // #6b7280 ≈ gray-500
for (const name of ['rip', 'thaihealth', 'skl', 'civic']) {
  // ต้นฉบับ .svg ก่อน (คมสุด) ไม่มีค่อยใช้ .png
  const svg = `${SRC}/${name}.svg`;
  const input = fs.existsSync(svg) ? sharp(svg, { density: 300 }) : sharp(`${SRC}/${name}.png`);
  const { data, info } = await input.trim().resize({ height: 240 }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const l = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    // ส่วนที่มีสี (ส้ม สสส./วง สคล./เหลือง Civic) = เทาเข้มเท่าตัวหนังสือ · ส่วนสว่าง (หน้า/ตัวขาว) ค่อย ๆ จางเป็นขาว
    const t = Math.min(1, Math.max(0, (l - 170) / 65));
    const v = Math.round(DARK + t * (255 - DARK));
    data[i] = data[i + 1] = data[i + 2] = v;
  }
  await sharp(data, { raw: info }).png({ compressionLevel: 9 }).toFile(`${OUT}/${name}.png`);
  console.log(name, info.width, 'x', info.height);
}
