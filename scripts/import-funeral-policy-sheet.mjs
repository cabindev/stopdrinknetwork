// นำเข้าแบบสำรวจ "พื้นที่ประกาศนโยบายงานศพปลอดเหล้า" (Google Form → Sheet) เป็น Activity
// ค่าเริ่มต้น = ทดลอง (dry-run) แสดงผลการจับคู่ทุกแถว ไม่เขียน DB · ใส่ --commit เพื่อบันทึกจริง
//
//   node --experimental-strip-types scripts/import-funeral-policy-sheet.mjs            # ทดลอง
//   node --experimental-strip-types scripts/import-funeral-policy-sheet.mjs --commit   # บันทึกจริง
//   ตัวเลือก: --owner <email> (ค่าเริ่มต้น sdn.warehouse@gmail.com) · --csv <ไฟล์> (ไม่ใส่ = ดึงจาก Sheet)
//             --no-files (ไม่ดาวน์โหลดไฟล์แนบจาก Drive)
//
// กติกาการจับคู่ (ตามที่ตกลง ก.ย. 2026):
//   ประเด็น = งานบุญประเพณี › งานศพปลอดเหล้า · ระดับนโยบาย → ActivityPolicy + ขอบเขตพื้นที่ (areaScope)
//   พื้นที่: แยก ตำบล/อำเภอ/หมู่บ้าน จากข้อความ → ไม่เจอตำบล ใช้ GISTDA ค้นชื่อหมู่บ้าน → ยังไม่เจอ = ข้าม (รายงาน)
//   ปี: ดึงเลข 25xx (สะกดผิด 15xx → 25xx) → startDatePrecision YEAR
//   ไฟล์ Drive: PDF/Word = ไฟล์นโยบายของระดับนั้น · รูป = รูปกิจกรรม (≤5, รูปแรก = ปก)
//   กันซ้ำ: ประเด็นย่อย + ตำบล/อำเภอ/จังหวัด + ชื่อพื้นที่ ตรงกับงานในระบบหรือแถวก่อนหน้า = ข้าม
import { PrismaClient } from '@prisma/client';
import { readFileSync, mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import { provinceHealthZones } from '../app/utils/healthZones.ts';

const SHEET_CSV =
  'https://docs.google.com/spreadsheets/d/1W00YG7owNmIJ7gJT3lsRIeODx_Jt8hMGzy9D6gDz6is/export?format=csv&gid=158401691';
const SOURCE = 'แบบฟอร์มข้อมูลพื้นที่ประกาศนโยบายงานศพปลอดเหล้า';

const args = process.argv.slice(2);
const COMMIT = args.includes('--commit');
const WITH_FILES = !args.includes('--no-files');
const argVal = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const OWNER = argVal('--owner', 'sdn.warehouse@gmail.com');

const prisma = new PrismaClient();

// ── ข้อมูลอ้างอิง ──────────────────────────────────────────────
const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split('\n')
    .map((l) => l.match(/^([A-Z_]+)=(.*)$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2].replace(/^"|"$/g, '')])
);
const SPHERE_KEY = env.GISTDA_API_KEY || env.NEXT_PUBLIC_GISTDA_API_KEY || '';

const regionsSrc = readFileSync('app/data/regions.ts', 'utf8');
const REGIONS = JSON.parse(regionsSrc.slice(regionsSrc.indexOf('= [') + 2, regionsSrc.lastIndexOf(']') + 1));
const PROVINCES = [...new Set(REGIONS.map((r) => r.province))];
const tambonRows = JSON.parse(readFileSync('app/data/tambon.json', 'utf8')).data;

// ── ตัวช่วย ────────────────────────────────────────────────────
const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').replace(/^"+|"+$/g, '').trim();

function parseCSV(text) {
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c !== '\r') cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

function levenshtein(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

// จังหวัดสะกดผิด (เช่น "อุบลรราชธานี") → ชื่อที่ใกล้สุดภายในระยะ 2
function canonicalProvince(raw) {
  const p = clean(raw).replace(/^จังหวัด|^จ\./, '');
  if (PROVINCES.includes(p)) return p;
  let best = null, bestD = 3;
  for (const x of PROVINCES) {
    const d = levenshtein(p, x);
    if (d < bestD) { best = x; bestD = d; }
  }
  return best;
}

const LEVEL = {
  'ระดับตำบล': 'SUBDISTRICT',
  'ระดับอำเภอ': 'DISTRICT',
  'ระดับจังหวัด': 'PROVINCE',
  'ระดับชุมชน / หมู่บ้าน': 'VILLAGE',
};
const LEVEL_LABEL = { VILLAGE: 'หมู่บ้าน', SUBDISTRICT: 'ตำบล', DISTRICT: 'อำเภอ', PROVINCE: 'จังหวัด' };

// ประเภทนโยบายจากชื่อ (ต้องตรงกับ POLICY_TYPES ใน lib/activityMeta.ts)
function policyType(name) {
  if (/ธรรมนูญ/.test(name)) return 'ธรรมนูญตำบล/ธรรมนูญสุขภาพ';
  if (/พชอ/.test(name)) return 'นโยบาย พชอ.';
  if (/MOU|บันทึกข้อตกลง|บันทึกความเข้าใจ/i.test(name)) return 'MOU/บันทึกข้อตกลง';
  if (/กติกา|ข้อตกลงหมู่บ้าน|ข้อตกลงชุมชน|มาตรา?การชุมชน/.test(name)) return 'กติกาชุมชน/ข้อตกลงหมู่บ้าน';
  if (/ข้อตกลง(ระดับ)?ตำบล/.test(name)) return 'ข้อตกลงระดับตำบล';
  if (/เทศบาล|อบต|นโยบายตำบล/.test(name)) return 'นโยบายท้องถิ่น (อบต./เทศบาล)';
  if (/โครงการ/.test(name)) return 'โครงการ';
  return undefined; // ชื่อทั่วไป เช่น "งานศพปลอดเหล้า" — ไม่เดา
}

// ปี พ.ศ.: "เริ่มต้นปี 2566" / "พ.ศ.2569" / "1561" (สะกดผิด → 2561)
function parseYear(raw) {
  const m = String(raw).match(/(25|15)(\d\d)/);
  if (!m) return { year: null };
  const year = Number(`25${m[2]}`);
  return { year, fixed: m[1] === '15' ? `แก้ "${m[0]}" → ${year}` : undefined };
}

const num = (s) => Number(String(s).replace(/,/g, ''));
function parseCoverage(text) {
  const pop = text.match(/ประชากร[^0-9]{0,12}([\d,]+)\s*คน/);
  const hh = text.match(/([\d,]+)\s*ครัวเรือน/);
  const vil = text.match(/(?:ครอบคลุม|รวม)?\s*([\d,]+)\s*หมู่บ้าน/);
  return {
    coveragePopulation: pop ? num(pop[1]) : null,
    coverageHouseholds: hh ? num(hh[1]) : null,
    coverageVillages: vil ? num(vil[1]) : null,
  };
}

// แยกชื่อพื้นที่: ตำบล / อำเภอ / หมู่บ้าน / หน่วยงาน (เทศบาล/อบต.)
function parseArea(text, province) {
  const t = clean(text);
  const pick = (re) => { const m = t.match(re); return m ? m[1].trim() : ''; };
  let tambon = pick(/(?:ตำบล|ต\.)\s*([^\s,()]+)/);
  let amphoe = pick(/(?:อำเภอ|อ\.)\s*([^\s,()]+)/);
  const org = pick(/((?:เทศบาล(?:นคร|เมือง|ตำบล)|อบต\.|องค์การบริหารส่วนตำบล)\s*[^\s,()]+)/);
  if (!tambon) tambon = pick(/(?:เทศบาลตำบล|อบต\.|องค์การบริหารส่วนตำบล)\s*([^\s,()]+)/);
  if (!tambon) tambon = pick(/\(ตำบล([^)\s]+)\)/);
  const village = pick(/(บ้+าน[^\s,]+(?:\s*ม\.\s*\d+)?)/).replace(/^บ้+าน/, 'บ้าน');
  if (amphoe === 'เมือง') amphoe = `เมือง${province}`;
  return { tambon, amphoe, org, village };
}

async function sphereTambon(keyword, province) {
  if (!SPHERE_KEY || !keyword) return null;
  try {
    const u = `https://api.sphere.gistda.or.th/services/search/search?keyword=${encodeURIComponent(keyword)}&limit=20&key=${SPHERE_KEY}`;
    const d = await (await fetch(u)).json();
    for (const it of d.data ?? []) {
      const m = String(it.address ?? '').match(/(?:ต\.|ตำบล)\s*(\S+)\s+(?:อ\.|อำเภอ)\s*(\S+)\s+(?:จ\.)?\s*(\S+)/);
      if (m && m[3] === province) return { tambon: m[1], amphoe: m[2], via: `GISTDA: ${it.name}` };
    }
  } catch { /* ค้นไม่ได้ก็ข้าม */ }
  return null;
}

// หา RegionData ของตำบลอ้างอิง ตามขอบเขต
async function resolveRegion(area, province, scope) {
  const inProv = REGIONS.filter((r) => r.province === province);
  const byAmphoe = (a) => inProv.filter((r) => r.amphoe === a);
  if (scope === 'PROVINCE') {
    const city = byAmphoe(`เมือง${province}`);
    const r = city.find((x) => ['ในเมือง', 'ในเวียง', province].includes(x.district)) ?? city[0];
    return r ? { region: r, via: 'จุดอ้างอิงอำเภอเมือง' } : null;
  }
  let { tambon, amphoe } = area;
  let via = 'ข้อความในชีต';
  // ชื่ออำเภอสะกดผิด (ศรีขรภูมิ → ศีขรภูมิ) → ใกล้สุดในจังหวัด ระยะ ≤ 2
  if (amphoe && !inProv.some((r) => r.amphoe === amphoe)) {
    const names = [...new Set(inProv.map((r) => r.amphoe))];
    const best = names.map((n) => [n, levenshtein(amphoe, n)]).sort((x, y) => x[1] - y[1])[0];
    if (best && best[1] <= 2) {
      via = `อำเภอ "${amphoe}" → ${best[0]}`;
      amphoe = best[0];
    }
  }
  if (!tambon && scope !== 'DISTRICT') {
    const g = await sphereTambon(area.village || area.org, province);
    if (g) ({ tambon, amphoe, via } = { ...g });
  }
  if (tambon) {
    let c = inProv.filter((r) => r.district === tambon);
    // สะกดผิด (ทุ่งเยาว → ทุ่งยาว, ทุ่งอั้ว → ทุ่งฮั้ว) → ใกล้สุดในอำเภอเดียวกัน ระยะ ≤ 1
    if (c.length === 0 && amphoe) {
      const near = byAmphoe(amphoe)
        .map((r) => [r, levenshtein(tambon, r.district)])
        .sort((x, y) => x[1] - y[1])[0];
      if (near && near[1] <= 1) {
        c = [near[0]];
        via = `ตำบล "${tambon}" → ${near[0].district}`;
      }
    }
    if (amphoe && c.length > 1) {
      const same = c.filter((r) => r.amphoe === amphoe);
      if (same.length) c = same;
    }
    // ชื่อตำบลซ้ำหลายอำเภอและไม่ระบุอำเภอ (ในเมือง) → อำเภอเมืองก่อน
    if (!amphoe && c.length > 1) {
      const city = c.filter((r) => r.amphoe === `เมือง${province}`);
      if (city.length) c = city;
      else via = `ชื่อตำบลซ้ำ ${c.length} แห่ง เลือก อ.${c[0].amphoe}`;
    }
    if (c.length >= 1) return { region: c[0], via };
  }
  if (amphoe) {
    const a = byAmphoe(amphoe);
    const r = a.find((x) => x.district === amphoe) ?? a[0]; // ตำบลชื่อเดียวกับอำเภอ = มักเป็นที่ตั้งอำเภอ
    if (r) return { region: r, via: scope === 'DISTRICT' ? 'จุดอ้างอิงอำเภอ' : `${via} (ไม่เจอตำบล ใช้อำเภอ)` };
  }
  return null;
}

// พิกัด: ตำบลตรงตัว / เฉลี่ยอำเภอ / เฉลี่ยจังหวัด (ตรรกะเดียวกับ lib/tambonCoords + provinceGeo)
function coordsFor(region, scope) {
  const rows = tambonRows.filter((t) => typeof t.LAT === 'number');
  const avg = (list) =>
    list.length ? { lat: list.reduce((s, t) => s + t.LAT, 0) / list.length, lng: list.reduce((s, t) => s + t.LONG, 0) / list.length } : null;
  if (scope === 'PROVINCE') return avg(rows.filter((t) => t.CHANGWAT_T === region.province));
  if (scope === 'DISTRICT') return avg(rows.filter((t) => t.AMPHOE_T === region.amphoe && t.CHANGWAT_T === region.province));
  const exact = rows.find((t) => t.TAMBON_T === region.district && t.AMPHOE_T === region.amphoe && t.CHANGWAT_T === region.province);
  return exact ? { lat: exact.LAT, lng: exact.LONG } : avg(rows.filter((t) => t.AMPHOE_T === region.amphoe && t.CHANGWAT_T === region.province));
}

// "8/6/2026, 15:07:32" (วัน/เดือน/ค.ศ.) → Date
function parseStamp(s) {
  const m = String(s).match(/(\d+)\/(\d+)\/(\d{4}),?\s*(\d+):(\d+):(\d+)/);
  return m ? new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5], +m[6]) : new Date();
}

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const DOC_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
];
async function downloadDrive(id) {
  const res = await fetch(`https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`);
  if (!res.ok) return { error: `HTTP ${res.status}` };
  let type = (res.headers.get('content-type') || '').split(';')[0];
  const disp = res.headers.get('content-disposition') || '';
  const nameM = disp.match(/filename\*=UTF-8''([^;]+)/) || disp.match(/filename="([^"]+)"/);
  // filename="..." ของ Drive เป็น UTF-8 แต่ fetch อ่าน header เป็น latin1 → แปลงกลับ (filename* ถอดด้วย decodeURIComponent)
  const name = nameM
    ? disp.includes("filename*=")
      ? decodeURIComponent(nameM[1])
      : Buffer.from(nameM[1], 'latin1').toString('utf8')
    : `${id}`;
  const buf = Buffer.from(await res.arrayBuffer());
  if (type === 'application/octet-stream' && buf.subarray(0, 4).toString() === '%PDF') type = 'application/pdf';
  if (type === 'text/html') return { error: 'ไฟล์ไม่ได้แชร์แบบเปิด' };
  if (buf.length > 20 * 1024 * 1024) return { error: 'ใหญ่เกิน 20MB' };
  if (![...IMAGE_TYPES, ...DOC_TYPES].includes(type)) return { error: `ชนิดไฟล์ ${type}` };
  return { name, type, buf };
}

// ── หลัก ───────────────────────────────────────────────────────
const csvText = argVal('--csv') ? readFileSync(argVal('--csv'), 'utf8') : await (await fetch(SHEET_CSV)).text();
const rows = parseCSV(csvText).slice(1).filter((r) => r.some((c) => c.trim()));

const owner = await prisma.user.findUnique({ where: { email: OWNER } });
if (!owner) throw new Error(`ไม่พบผู้ใช้ ${OWNER}`);
const category = await prisma.workCategory.findUnique({ where: { name: 'งานบุญประเพณี' } });
const sub = category &&
  (await prisma.workSubCategory.findUnique({ where: { categoryId_name: { categoryId: category.id, name: 'งานศพปลอดเหล้า' } } }));
if (!category || !sub) throw new Error('ไม่พบประเด็น งานบุญประเพณี › งานศพปลอดเหล้า (รัน seed-subcategories ก่อน)');

const existing = await prisma.activity.findMany({
  where: { subCategoryId: sub.id },
  select: { id: true, district: true, amphoe: true, province: true, areaName: true },
});
const keyOf = (r) => `${r.district}|${r.amphoe}|${r.province}|${clean(r.areaName ?? '')}`;
const seen = new Map(existing.map((e) => [keyOf(e), `มีแล้ว #${e.id}`]));

const plan = [];
for (const [i, raw] of rows.entries()) {
  const rowNo = i + 1;
  const [stamp, , provRaw, levelRaw, areaRaw, detailRaw, nameRaw, yearRaw, filesRaw, extraRaw] = raw.map((c) => c ?? '');
  const province = canonicalProvince(provRaw);
  const level = LEVEL[clean(levelRaw)];
  const notes = [];
  if (!province || !level) {
    plan.push({ rowNo, skip: `อ่านจังหวัด/ระดับไม่ได้ (${clean(provRaw)} / ${clean(levelRaw)})` });
    continue;
  }
  if (province !== clean(provRaw).replace(/^จังหวัด/, '')) notes.push(`จังหวัด "${clean(provRaw)}" → ${province}`);
  const scope = level; // ระดับนโยบาย = ขอบเขตพื้นที่
  const area = parseArea(areaRaw, province);
  const found = await resolveRegion(area, province, scope);
  if (!found) {
    plan.push({ rowNo, skip: `หาตำบลไม่เจอ: "${clean(areaRaw)}"` });
    continue;
  }
  const region = found.region;
  if (found.via !== 'ข้อความในชีต') notes.push(found.via);

  const areaName =
    scope === 'VILLAGE' ? area.village || clean(areaRaw).split(/\s+(?:ต\.|ตำบล|อ\.|อำเภอ)/)[0] : area.org || null;
  const key = keyOf({ ...region, areaName });
  if (seen.has(key)) {
    plan.push({ rowNo, skip: `ซ้ำ (${seen.get(key)})`, area: clean(areaRaw) });
    continue;
  }
  seen.set(key, `แถว ${rowNo}`);

  const policyName = clean(nameRaw);
  const { year, fixed } = parseYear(yearRaw);
  if (fixed) notes.push(fixed);
  const detail = [clean(detailRaw) ? String(detailRaw).trim() : '', clean(extraRaw) ? String(extraRaw).trim() : '']
    .filter(Boolean)
    .join('\n');
  const coverage = parseCoverage(detail);
  const where =
    scope === 'PROVINCE' ? `จ.${province}` : scope === 'DISTRICT' ? `อ.${region.amphoe}` : areaName || `ต.${region.district}`;
  const shortName = policyName.length > 80 ? `${policyName.slice(0, 78)}…` : policyName;
  const title = `${shortName || 'งานศพปลอดเหล้า'} — ${where}`;
  const description = [
    detail || `${clean(areaRaw)} มีนโยบายงานศพปลอดเหล้าระดับ${LEVEL_LABEL[level]}`,
    `นโยบาย: ${policyName || '-'} (ระดับ${LEVEL_LABEL[level]})${year ? ` เริ่มปี ${year}` : ''}`,
    `พื้นที่ตามแบบฟอร์ม: ${clean(areaRaw)}`,
    `(ที่มา: ${SOURCE} · ตอบเมื่อ ${clean(stamp)} · แถวที่ ${rowNo})`,
  ].join('\n');
  const fileIds = [...String(filesRaw).matchAll(/id=([\w-]+)/g)].map((m) => m[1]);

  plan.push({
    rowNo,
    title,
    region,
    scope,
    areaName,
    level,
    policy: { name: policyName || undefined, type: policyType(policyName), year: year ?? undefined },
    year,
    coverage,
    description: description.slice(0, 20000),
    createdAt: parseStamp(stamp),
    fileIds,
    notes,
  });
}

// ── รายงาน ─────────────────────────────────────────────────────
const toCreate = plan.filter((p) => !p.skip);
console.log(`\n${COMMIT ? 'บันทึกจริง' : 'ทดลอง (ยังไม่บันทึก)'} — ${rows.length} แถว: สร้าง ${toCreate.length} · ข้าม ${plan.length - toCreate.length}\n`);
for (const p of plan) {
  if (p.skip) {
    console.log(`  ${String(p.rowNo).padStart(2)} ⏭  ${p.skip}${p.area ? ` — ${p.area}` : ''}`);
    continue;
  }
  const r = p.region;
  const cov = Object.entries(p.coverage).filter(([, v]) => v != null).map(([k, v]) => `${k.replace('coverage', '')}=${v}`).join(' ');
  console.log(
    `  ${String(p.rowNo).padStart(2)} ✅ ${p.title}\n` +
      `      ต.${r.district} อ.${r.amphoe} จ.${r.province} · ขอบเขต ${p.scope} · นโยบาย${LEVEL_LABEL[p.level]}` +
      `${p.policy.type ? ` [${p.policy.type}]` : ''}${p.year ? ` · ปี ${p.year}` : ''}` +
      `${p.fileIds.length ? ` · ไฟล์ ${p.fileIds.length}` : ''}${cov ? ` · ${cov}` : ''}` +
      `${p.notes.length ? `\n      ⚠️ ${p.notes.join(' · ')}` : ''}`
  );
}

if (!COMMIT) {
  console.log('\nยังไม่ได้บันทึก — ตรวจรายการด้านบน แล้วรันซ้ำพร้อม --commit\n');
  await prisma.$disconnect();
  process.exit(0);
}

// ── บันทึก ─────────────────────────────────────────────────────
const UPLOAD_ROOT = path.join(process.cwd(), 'uploads');
let createdCount = 0, fileOk = 0;
const fileErrors = [];
for (const p of toCreate) {
  const r = p.region;
  const c = coordsFor(r, p.scope);
  const activity = await prisma.activity.create({
    data: {
      title: p.title,
      description: p.description,
      categoryId: category.id,
      subCategoryId: sub.id,
      userId: owner.id,
      areaName: p.areaName,
      district: r.district,
      amphoe: r.amphoe,
      province: r.province,
      region: provinceHealthZones[r.province],
      zipcode: r.zipcode ? String(r.zipcode) : null,
      latitude: c?.lat ?? null,
      longitude: c?.lng ?? null,
      locationSource: 'TAMBON',
      areaScope: p.scope,
      status: 'ACTIVE',
      startDate: p.year ? new Date(Date.UTC(p.year - 543, 0, 1)) : null, // UTC — ดู lib/activityInput.ts
      startDatePrecision: p.year ? 'YEAR' : 'DAY',
      policies: { create: [{ level: p.level, name: p.policy.name ?? null, type: p.policy.type ?? null, year: p.policy.year ?? null }] },
      ...p.coverage,
      createdAt: p.createdAt,
    },
  });
  createdCount++;

  if (WITH_FILES) {
    let images = 0;
    for (const id of p.fileIds) {
      const f = await downloadDrive(id);
      if (f.error) {
        fileErrors.push(`แถว ${p.rowNo} ไฟล์ ${id}: ${f.error}`);
        continue;
      }
      const isImage = IMAGE_TYPES.includes(f.type);
      if (isImage && images >= 5) {
        fileErrors.push(`แถว ${p.rowNo} ${f.name}: เกิน 5 รูป (ข้าม)`);
        continue;
      }
      const ext = path.extname(f.name) || (f.type === 'application/pdf' ? '.pdf' : '');
      const rel = path.posix.join('activities', String(activity.id), `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
      mkdirSync(path.join(UPLOAD_ROOT, 'activities', String(activity.id)), { recursive: true });
      writeFileSync(path.join(UPLOAD_ROOT, rel), f.buf);
      await prisma.activityAttachment.create({
        data: {
          activityId: activity.id,
          kind: isImage ? 'IMAGE' : 'DOCUMENT',
          filePath: rel,
          fileName: f.name,
          mimeType: f.type,
          size: f.buf.length,
          // รูป = รูปกิจกรรม (รูปแรกเป็นปก) · เอกสาร = ไฟล์นโยบายของระดับนี้
          policyLevel: isImage ? null : p.level,
          isCover: isImage && images === 0,
        },
      });
      if (isImage) images++;
      fileOk++;
    }
  }

  await prisma.auditLog.create({
    data: {
      action: 'CREATE',
      entityType: 'Activity',
      entityId: activity.id,
      entityName: activity.title,
      userId: owner.id,
      changes: JSON.stringify([`นำเข้าจาก${SOURCE} (แถวที่ ${p.rowNo})`]),
    },
  }).catch((e) => fileErrors.push(`audit แถว ${p.rowNo}: ${e.message.split('\n')[0]}`));
  console.log(`  + #${activity.id} ${p.title}`);
}
console.log(`\nสร้างงาน ${createdCount} รายการ · ไฟล์แนบ ${fileOk} ไฟล์`);
if (fileErrors.length) console.log(`ปัญหา ${fileErrors.length} รายการ:\n  ${fileErrors.join('\n  ')}`);
await prisma.$disconnect();
