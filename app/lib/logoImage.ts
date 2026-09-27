// app/lib/logoImage.ts — เตรียมโลโก้ประเด็นงานฝั่ง browser ก่อนอัปโหลด
// โลโก้ที่ได้มามักเป็นภาพใหญ่ (เช่น 2917×2917) ที่มีขอบว่างรอบตัวอักษรเยอะ
// ย่อทั้งภาพลงหมุด 30px ตัวโลโก้จะเหลือเป็นจุด → ตัดขอบว่าง (โปร่งใส/ขาว) ออกก่อน แล้ววางกลางช่องสี่เหลี่ยม
// หมุดบนแผนที่เป็นวงกลม → ย่อให้ "เส้นทแยงมุม" ของโลโก้พอดีวง (โลโก้กว้างอย่าง Civic Space มุมไม่โดนตัด)
// ผล: WebP 256×256 พื้นโปร่งใส ไม่กี่ KB (browser ที่ encode WebP ไม่ได้จะได้ PNG แทน)

const OUT = 256;
const PAD = 0.05; // เว้นขอบ 5% ไม่ให้โลโก้ชิดขอบวงกลม

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('เปิดไฟล์รูปไม่ได้'));
    };
    img.src = url;
  });
}

// กรอบของเนื้อหาจริง: พิกเซลที่ไม่โปร่งใส และไม่ใช่ขาวเกือบล้วน
function contentBox(data: Uint8ClampedArray, w: number, h: number) {
  let top = h, left = w, right = -1, bottom = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const a = data[i + 3];
      const nearWhite = data[i] > 245 && data[i + 1] > 245 && data[i + 2] > 245;
      if (a > 16 && !nearWhite) {
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
  }
  return right < 0 ? null : { x: left, y: top, w: right - left + 1, h: bottom - top + 1 };
}

export async function prepareLogo(file: File): Promise<File> {
  const img = await loadImage(file);
  // สแกนหาขอบบนภาพย่อ (≤600px) — สแกนภาพเต็ม 8.5 ล้านพิกเซลช้าเกินบนมือถือ
  const scale = Math.min(1, 600 / Math.max(img.naturalWidth, img.naturalHeight));
  const sw = Math.max(1, Math.round(img.naturalWidth * scale));
  const sh = Math.max(1, Math.round(img.naturalHeight * scale));
  const scan = document.createElement('canvas');
  scan.width = sw;
  scan.height = sh;
  const sctx = scan.getContext('2d', { willReadFrequently: true })!;
  sctx.drawImage(img, 0, 0, sw, sh);
  const box = contentBox(sctx.getImageData(0, 0, sw, sh).data, sw, sh) ?? { x: 0, y: 0, w: sw, h: sh };

  // แปลงกรอบกลับเป็นพิกัดภาพจริง แล้ววาดกลางช่อง 256×256
  const src = { x: box.x / scale, y: box.y / scale, w: box.w / scale, h: box.h / scale };
  const inner = OUT * (1 - PAD * 2);
  const k = inner / Math.hypot(src.w, src.h); // ทแยงมุม = เส้นผ่านศูนย์กลาง → ทั้ง 4 มุมอยู่ในวงกลม
  const dw = src.w * k;
  const dh = src.h * k;
  const out = document.createElement('canvas');
  out.width = OUT;
  out.height = OUT;
  const ctx = out.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, src.x, src.y, src.w, src.h, (OUT - dw) / 2, (OUT - dh) / 2, dw, dh);

  const blob = await new Promise<Blob | null>((r) => out.toBlob(r, 'image/webp', 0.9));
  if (!blob) throw new Error('แปลงรูปไม่สำเร็จ');
  const type = blob.type === 'image/webp' ? 'image/webp' : 'image/png';
  return new File([blob], `logo${type === 'image/webp' ? '.webp' : '.png'}`, { type });
}
