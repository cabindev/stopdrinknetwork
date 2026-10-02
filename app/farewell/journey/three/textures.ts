// app/farewell/journey/three/textures.ts
// texture ทั้งหมดของฉาก
// - ลายทองบนหีบมาจากรูปอ้างอิงของผู้ใช้ (public/farewell/textures)
// - เหล็ก อิฐ ปูน กระเบื้อง วาดด้วย canvas เพื่อไม่ต้องโหลดไฟล์เพิ่ม (ใช้ seed คงที่ ภาพจึงเหมือนเดิมทุกครั้ง)
import * as THREE from 'three';

const BASE = '/farewell/textures';

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return { c, g: c.getContext('2d')! };
}

function toTexture(c: HTMLCanvasElement, color: boolean) {
  const t = new THREE.CanvasTexture(c);
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

const smooth = (lo: number, hi: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - lo) / (hi - lo)));
  return t * t * (3 - 2 * t);
};

/**
 * หาส่วนที่เป็นทองในรูป (แดงมากกว่าน้ำเงินชัดเจน) ใช้แยกทองออกจากพื้นขาว
 * แบบเดียวกับ node ใน add_right_ornament.py ของไฟล์ Blender
 */
function goldMask(img: HTMLImageElement) {
  const { c, g } = canvas(img.naturalWidth, img.naturalHeight);
  g.drawImage(img, 0, 0);
  const data = g.getImageData(0, 0, c.width, c.height);
  const mask = new Float32Array(c.width * c.height);
  for (let i = 0; i < mask.length; i++) {
    const r = data.data[i * 4] / 255;
    const b = data.data[i * 4 + 2] / 255;
    mask[i] = smooth(0.06, 0.2, r - b);
  }
  return { mask, w: c.width, h: c.height };
}

/** roughness อยู่ช่อง G, metalness อยู่ช่อง B ตามที่ three อ่าน */
function ormFromMask({ mask, w, h }: ReturnType<typeof goldMask>, roughBase: number, roughGold: number) {
  const { c, g } = canvas(w, h);
  const out = g.createImageData(w, h);
  for (let i = 0; i < mask.length; i++) {
    const m = mask[i];
    out.data[i * 4] = 255;
    out.data[i * 4 + 1] = Math.round((roughBase + (roughGold - roughBase) * m) * 255);
    // โลหะ 0.65 ไม่ใช่ 1 ไม่งั้นทองสะท้อนแต่ส่วนมืดของห้องจนดูเป็นสำริด
    out.data[i * 4 + 2] = Math.round(m * 0.65 * 255);
    out.data[i * 4 + 3] = 255;
  }
  g.putImageData(out, 0, 0);
  return toTexture(c, false);
}

/** alphaMap อ่านช่อง G */
function alphaFromMask({ mask, w, h }: ReturnType<typeof goldMask>) {
  const { c, g } = canvas(w, h);
  const out = g.createImageData(w, h);
  for (let i = 0; i < mask.length; i++) {
    const v = Math.round(smooth(0.25, 0.6, mask[i]) * 255);
    out.data[i * 4] = v;
    out.data[i * 4 + 1] = v;
    out.data[i * 4 + 2] = v;
    out.data[i * 4 + 3] = 255;
  }
  g.putImageData(out, 0, 0);
  return toTexture(c, false);
}

/** พื้นปูน มีคราบเขม่าเหนือช่องประตูเตา ขนาดตรงกับผนัง 16×4 ม. */
function plasterWall() {
  const { c, g } = canvas(1024, 512);
  const r = rng(11);
  g.fillStyle = '#e8e1d3';
  g.fillRect(0, 0, 1024, 512);
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = `rgba(${r() < 0.5 ? '120,110,95' : '255,255,250'},${0.04 + r() * 0.05})`;
    g.fillRect(r() * 1024, r() * 512, 1 + r() * 3, 1 + r() * 3);
  }
  // ผนัง 16×4 ม. ลงบน 1024×512 px: แนวนอน 64 px/ม. แนวตั้ง 128 px/ม. วาดเขม่าเป็นวงรีให้ออกมากลมบนผนัง
  const doorTop = 512 - (1.55 + 0.05) * 128;
  g.save();
  g.translate(512, 0);
  g.scale(0.5, 1);
  g.translate(-512, 0);
  const soot = g.createRadialGradient(512, doorTop - 10, 10, 512, doorTop - 60, 210);
  soot.addColorStop(0, 'rgba(25,20,16,0.75)');
  soot.addColorStop(0.45, 'rgba(25,20,16,0.38)');
  soot.addColorStop(1, 'rgba(25,20,16,0)');
  g.fillStyle = soot;
  g.fillRect(0, 0, 2048, 512);
  g.restore();
  return toTexture(c, true);
}

/** แผ่นเหล็กประตูเตา: สีเทาที่แตกลายงาด้านบน คราบสนิมไหลลง (ref 07) */
function steelDoor() {
  const W = 512;
  const H = 836;
  const { c, g } = canvas(W, H);
  const r = rng(7);
  const base = g.createLinearGradient(0, 0, 0, H);
  base.addColorStop(0, '#8d9293');
  base.addColorStop(0.35, '#b3b8b9');
  base.addColorStop(1, '#a6abac');
  g.fillStyle = base;
  g.fillRect(0, 0, W, H);
  for (let i = 0; i < 3500; i++) {
    g.fillStyle = `rgba(${r() < 0.6 ? '60,58,55' : '235,235,230'},${0.03 + r() * 0.06})`;
    g.fillRect(r() * W, r() * H, 1 + r() * 2, 1 + r() * 2);
  }
  // คราบสนิม
  for (let i = 0; i < 26; i++) {
    const x = r() * W;
    const y = H * (0.25 + r() * 0.5);
    const len = 40 + r() * 160;
    const grd = g.createLinearGradient(x, y, x, y + len);
    grd.addColorStop(0, `rgba(110,62,32,${0.25 + r() * 0.3})`);
    grd.addColorStop(1, 'rgba(110,62,32,0)');
    g.fillStyle = grd;
    g.fillRect(x, y, 2 + r() * 6, len);
  }
  // สีแตกลายงาครึ่งบน
  g.lineCap = 'round';
  for (let i = 0; i < 45; i++) {
    let x = r() * W;
    let y = r() * H * 0.45;
    g.strokeStyle = `rgba(40,36,32,${0.18 + r() * 0.25})`;
    g.lineWidth = 0.6 + r() * 0.9;
    g.beginPath();
    g.moveTo(x, y);
    const steps = 4 + Math.floor(r() * 8);
    for (let s = 0; s < steps; s++) {
      x += (r() - 0.5) * 22;
      y += (r() - 0.5) * 18;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  // เขม่าจากขอบบน
  const top = g.createLinearGradient(0, 0, 0, H * 0.35);
  top.addColorStop(0, 'rgba(20,18,16,0.6)');
  top.addColorStop(1, 'rgba(20,18,16,0)');
  g.fillStyle = top;
  g.fillRect(0, 0, W, H * 0.35);
  return toTexture(c, true);
}

/** ด้านในบานประตู: วัสดุทนไฟสีขาวขุ่นแตกเป็นก้อน มีรูกลมเล็ก ขอบบนไหม้ (ref 06) */
function refractory() {
  const W = 512;
  const H = 836;
  const { c, g } = canvas(W, H);
  const r = rng(23);
  g.fillStyle = '#e2dccf';
  g.fillRect(0, 0, W, H);
  for (let i = 0; i < 3000; i++) {
    g.fillStyle = `rgba(${r() < 0.5 ? '120,110,95' : '250,248,240'},${0.05 + r() * 0.08})`;
    g.fillRect(r() * W, r() * H, 1 + r() * 3, 1 + r() * 3);
  }
  // รอยต่อก้อน
  g.strokeStyle = 'rgba(70,62,52,0.55)';
  g.lineWidth = 2.2;
  const rows = [0, 150, 300, 470, 640, H];
  for (const y of rows.slice(1, -1)) {
    g.beginPath();
    g.moveTo(0, y);
    for (let x = 0; x <= W; x += 32) g.lineTo(x, y + (r() - 0.5) * 10);
    g.stroke();
  }
  for (let i = 0; i < rows.length - 1; i++) {
    const n = 2 + Math.floor(r() * 2);
    for (let k = 1; k <= n; k++) {
      const x = (W / (n + 1)) * k + (r() - 0.5) * 50;
      g.beginPath();
      g.moveTo(x, rows[i]);
      g.lineTo(x + (r() - 0.5) * 16, rows[i + 1]);
      g.stroke();
    }
  }
  // รูกลม
  for (let i = 0; i < 34; i++) {
    g.fillStyle = 'rgba(45,38,30,0.85)';
    g.beginPath();
    g.arc(r() * W, r() * H, 3 + r() * 3, 0, Math.PI * 2);
    g.fill();
  }
  const burn = g.createRadialGradient(W * 0.3, H * 0.08, 10, W * 0.3, H * 0.1, 260);
  burn.addColorStop(0, 'rgba(30,24,18,0.85)');
  burn.addColorStop(1, 'rgba(30,24,18,0)');
  g.fillStyle = burn;
  g.fillRect(0, 0, W, H);
  return toTexture(c, true);
}

/** อิฐทนไฟด้านในเตา */
function brick() {
  const { c, g } = canvas(512, 512);
  const r = rng(5);
  g.fillStyle = '#4c443b';
  g.fillRect(0, 0, 512, 512);
  const bh = 512 / 8;
  const bw = 512 / 4;
  for (let row = 0; row < 8; row++) {
    const off = row % 2 ? bw / 2 : 0;
    for (let col = -1; col < 5; col++) {
      const v = 150 + Math.floor(r() * 40);
      g.fillStyle = `rgb(${v + 22},${v + 12},${v - 4})`;
      g.fillRect(col * bw + off + 3, row * bh + 3, bw - 6, bh - 6);
    }
  }
  const soot = g.createLinearGradient(0, 0, 0, 512);
  soot.addColorStop(0, 'rgba(20,16,12,0.55)');
  soot.addColorStop(1, 'rgba(20,16,12,0.1)');
  g.fillStyle = soot;
  g.fillRect(0, 0, 512, 512);
  const t = toTexture(c, true);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** กระเบื้องหินสีทรายบนพื้น (ref 07) แผ่นละ 0.6 ม. */
function floorTiles() {
  const { c, g } = canvas(512, 512);
  const r = rng(3);
  g.fillStyle = '#9d9483';
  g.fillRect(0, 0, 512, 512);
  const n = 4;
  const s = 512 / n;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const v = 205 + Math.floor(r() * 22);
      g.fillStyle = `rgb(${v + 10},${v + 4},${v - 10})`;
      g.fillRect(x * s + 2, y * s + 2, s - 4, s - 4);
      for (let k = 0; k < 90; k++) {
        g.fillStyle = `rgba(120,108,90,${r() * 0.12})`;
        g.fillRect(x * s + r() * s, y * s + r() * s, 2, 2);
      }
    }
  }
  const t = toTexture(c, true);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** เงาใต้วัตถุ ใช้แทน shadow map (ถูกกว่ามากบนมือถือ) */
function contactShadow() {
  const { c, g } = canvas(256, 128);
  const grd = g.createRadialGradient(128, 64, 4, 128, 64, 124);
  grd.addColorStop(0, 'rgba(0,0,0,0.55)');
  grd.addColorStop(0.6, 'rgba(0,0,0,0.2)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.save();
  g.scale(1, 0.5);
  g.fillRect(0, 0, 256, 256);
  g.restore();
  return toTexture(c, false);
}

export interface JourneyTextures {
  coffinSide: THREE.Texture;
  coffinSideOrm: THREE.Texture;
  figure: THREE.Texture;
  figureAlpha: THREE.Texture;
  figureOrm: THREE.Texture;
  plaster: THREE.Texture;
  steel: THREE.Texture;
  refractory: THREE.Texture;
  brick: THREE.Texture;
  floor: THREE.Texture;
  shadow: THREE.Texture;
}

async function loadImage(url: string) {
  const img = new Image();
  img.decoding = 'async';
  img.src = url;
  await img.decode();
  return img;
}

export async function createTextures(maxAnisotropy: number): Promise<JourneyTextures> {
  const [sideImg, figureImg] = await Promise.all([
    loadImage(`${BASE}/coffin-side.jpg`),
    loadImage(`${BASE}/coffin-end-figure.jpg`),
  ]);

  const coffinSide = new THREE.Texture(sideImg);
  coffinSide.colorSpace = THREE.SRGBColorSpace;
  coffinSide.anisotropy = Math.min(8, maxAnisotropy);
  coffinSide.needsUpdate = true;

  const figure = new THREE.Texture(figureImg);
  figure.colorSpace = THREE.SRGBColorSpace;
  figure.needsUpdate = true;

  const sideMask = goldMask(sideImg);
  const figureMask = goldMask(figureImg);

  return {
    coffinSide,
    coffinSideOrm: ormFromMask(sideMask, 0.5, 0.38),
    figure,
    figureAlpha: alphaFromMask(figureMask),
    figureOrm: ormFromMask(figureMask, 0.5, 0.38),
    plaster: plasterWall(),
    steel: steelDoor(),
    refractory: refractory(),
    brick: brick(),
    floor: floorTiles(),
    shadow: contactShadow(),
  };
}
