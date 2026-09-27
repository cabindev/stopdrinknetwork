// app/lib/placeQuery.ts — ปรับคำค้นสถานที่ให้ตรงกับที่ผู้ใช้พิมพ์จริง (ใช้ใน /api/geo/search)
// GISTDA ค้นแบบวลีต่อเนื่อง: ตัวย่อ ("สภ.เมืองน่าน") และ "ประเภท + พื้นที่" ("สถานีตำรวจ น่าน") จึงหาไม่เจอ
import { areaByName } from '@/app/lib/tambonCoords';

// ตัวย่อหน่วยงานที่เครือข่ายใช้บ่อย — เรียงยาวก่อน (รพ.สต. ต้องมาก่อน รพ.)
const ABBREVIATIONS: [RegExp, string][] = [
  [/รพ\.?\s?สต\.?/g, 'โรงพยาบาลส่งเสริมสุขภาพตำบล'],
  [/สภ(\.|(?=\s))/g, 'สถานีตำรวจภูธร'], // ต้องมีจุด/ช่องว่างตาม — กันไปโดน "สภา"
  [/สน\.(?=\S)/g, 'สถานีตำรวจนครบาล'],
  [/รพ\./g, 'โรงพยาบาล'],
  [/อบต\.?/g, 'องค์การบริหารส่วนตำบล'],
  [/อบจ\.?/g, 'องค์การบริหารส่วนจังหวัด'],
  [/ทต\./g, 'เทศบาลตำบล'],
  [/ทม\./g, 'เทศบาลเมือง'],
  [/ทน\./g, 'เทศบาลนคร'],
  [/สสอ\.?/g, 'สำนักงานสาธารณสุขอำเภอ'],
  [/สสจ\.?/g, 'สำนักงานสาธารณสุขจังหวัด'],
  [/ศพด\.?/g, 'ศูนย์พัฒนาเด็กเล็ก'],
  [/รร\./g, 'โรงเรียน'],
  [/สพป\.?/g, 'สำนักงานเขตพื้นที่การศึกษาประถมศึกษา'],
  [/สพม\.?/g, 'สำนักงานเขตพื้นที่การศึกษามัธยมศึกษา'],
];

export function expandAbbreviations(q: string): string {
  let out = q;
  for (const [re, full] of ABBREVIATIONS) out = out.replace(re, full);
  return out.replace(/\s+/g, ' ').trim();
}

export interface PlanArea {
  kind: 'province' | 'amphoe';
  province: string;
  amphoe?: string;
  lat: number;
  lng: number;
}

// แผนการค้น: คำค้นหลายแบบ (เดิม + ขยายตัวย่อ) และถ้ามีคำที่เป็นชื่อจังหวัด/อำเภอแยกด้วยช่องว่าง
// → ค้นส่วนที่เหลือรอบพื้นที่นั้น แล้วค่อยกรองผลให้อยู่ในพื้นที่ (area)
export function planPlaceSearch(q: string) {
  const expanded = expandAbbreviations(q);
  const keywords = [...new Set([q, expanded])];
  let area: PlanArea | null = null;
  let areaKeyword = '';
  const tokens = expanded.split(' ');
  if (tokens.length > 1) {
    for (let i = tokens.length - 1; i >= 0; i--) {
      const hit = areaByName(tokens[i]);
      if (hit) {
        area = hit;
        areaKeyword = tokens.filter((_, j) => j !== i).join(' ');
        break;
      }
    }
  }
  return { keywords, expanded, area, areaKeyword };
}

// ลำดับความตรง: ชื่อเท่ากับคำค้น > ขึ้นต้นด้วยคำค้น > มีคำค้นอยู่ > อื่น ๆ
// (กัน "เซเว่นอีเลฟเว่น โรงพยาบาลน่าน" ขึ้นก่อน "โรงพยาบาลน่าน")
export function matchRank(name: string, keywords: string[]) {
  const n = name.replace(/\s+/g, '');
  let best = 3;
  for (const k of keywords) {
    const kk = k.replace(/\s+/g, '');
    if (!kk) continue;
    if (n === kk) return 0;
    if (n.startsWith(kk)) best = Math.min(best, 1);
    else if (n.includes(kk)) best = Math.min(best, 2);
  }
  return best;
}
