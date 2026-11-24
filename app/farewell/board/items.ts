// app/farewell/board/items.ts — หมวดและตัวเลือกของ "กระดานจัดงาน" (/farewell/board)
// ผู้ใช้ขอ 21 พ.ย. 2026: กระดานแนวตั้งตรงกลาง + การ์ดเลือกสองข้างเหมือนเมนู เลือกแล้ว "ของ" ลอยไปวางบนกระดานแบบ knolling
// ชื่อ/คำอธิบาย/ข้อเท็จจริงของตัวเลือก มาจาก QUESTIONS ใน ../content.ts (แหล่งเดียวกับหน้าวางแผน) — ที่นี่เก็บแค่ภาพ + ตำแหน่งบนกระดาน
// ภาพของ: public/farewell/board/*.webp — สร้างด้วย AI (Higgsfield z_image) แล้วตัดพื้นหลังด้วย Vision ของ macOS
// บ้าน/วัด ทำใหม่ตามภาพงานศพจริงจาก Google (21 พ.ย. 2026): บ้านไม้สองชั้น+เต็นท์ผ้าใบน้ำเงิน/ลาย+เก้าอี้พลาสติกฟ้า ·
//   ศาลาวัดยาวโล่ง หลังคากระเบื้องแดงมีช่อฟ้า เวทีหีบ+ม่านเหลือง+ดอกไม้ พรมแดง เก้าอี้เรียง อาสน์สงฆ์
import { QUESTIONS, type ExtraKey, type Fact, type Option, type QuestionKey } from '../content';

/** หมวดบนกระดาน — ตัวเลือกย่อย (ExtraKey) ไม่มีหมวดของตัวเอง อยู่ใต้หมวดแม่ (EXTRAS) */
export type BoardKey = Exclude<QuestionKey, ExtraKey>;
export type CategoryKey = 'place' | BoardKey;

/** ภาพของหนึ่งตัวเลือก: รูปเดียว / รูปซ้อนหลายชิ้น / การ์ด HTML (ปฏิทิน ป้าย การ์ดขอบคุณ) */
export type Visual =
  | { kind: 'img'; src: string; alt: string; stack?: number; mark?: Mark; label?: string }
  | { kind: 'calendar'; n: number }
  | { kind: 'sign' }
  | { kind: 'card'; text: string };

/** เครื่องหมายทับภาพ: none = ของจางลง + วงห้ามสีดำ ("งด") · maybe = ของจางลง + เครื่องหมายคำถาม ("ยังไม่แน่ใจ")
 *  soft-none = ของสีปกติ + วงห้ามจาง ๆ ทับ (ใช้คู่กับ label) · label (ฟิลด์แยก) = ข้อความพิมพ์ลงบนตัวของ เช่น "งดห่อ" บนถุงกระดาษ */
export type Mark = 'none' | 'maybe' | 'soft-none';

export interface BoardOption extends Option {
  visual: Visual;
}

export interface Category {
  key: CategoryKey;
  label: string;
  title: string;
  why: string;
  options: BoardOption[];
  /** เรื่องเล่า/ข้อเท็จจริงจากกรณีศึกษา — โผล่ใต้กระดานเมื่อเลือกเรื่องนี้ */
  facts: Fact[];
  /** ตำแหน่งช่องบนกระดาน (% ของกระดาน) */
  slot: { x: number; y: number; w: number; h: number };
  /** ช่องที่หดลงเมื่อมีภาพตัวเลือกย่อยวางข้าง ๆ (เช่น อาหาร + แม่ครัว/คนล้างจาน) */
  slotCompact?: { x: number; y: number; w: number; h: number };
  /** ป้ายคำใต้ของบนกระดาน ชิดซ้าย/ขวาแทนกึ่งกลาง (ช่องที่ติดขอบกระดาน ป้ายจะได้ไม่ล้นออก) */
  tagAlign?: 'start' | 'end';
}

/** ป้ายคำสั้นใต้ของที่วางบนกระดาน — เห็นแค่ภาพอาจไม่รู้ว่าคืออะไร (ผู้ใช้ขอ 21 พ.ย. 2026)
 *  ไม่มีในรายการ = ไม่มีป้าย (ปฏิทินมีตัวเลข "คืน" อยู่แล้ว) */
export const BOARD_TAGS: Partial<Record<CategoryKey, Record<string, string>>> = {
  place: { temple: 'ตั้งศพที่วัด', home: 'ตั้งศพที่บ้าน' },
  coffin: { simple: 'หีบเรียบง่าย', standard: 'หีบตามที่นิยม', ornate: 'หีบประณีต' },
  monks: { ask: 'ปรึกษาพระ', ability: 'ถวายตามกำลัง', custom: 'ถวายตามธรรมเนียม' },
  food: { buffet: 'บุฟเฟ่ต์', potluck: 'ญาติช่วยกันทำอาหาร', served: 'อาหารยกเสิร์ฟ' },
  flowers: { simple: 'ดอกไม้เรียบง่าย', standard: 'ดอกไม้ตามที่นิยม', full: 'ดอกไม้จัดเต็ม' },
  takeaway: { none: 'ไม่มีห่อกลับ', less: 'ลดห่อ', host: 'ห่อกลับเท่าที่มี', all: 'ห่อกลับทุกคน' },
  alcohol: { none: 'ไม่เลี้ยงเหล้าเบียร์', undecided: 'เหล้าเบียร์ ยังไม่แน่ใจ', serve: 'เลี้ยงเหล้าเบียร์' },
};

const img = (name: string, alt: string, stack?: number, mark?: Mark): Visual => ({
  kind: 'img',
  src: name.includes('.') ? `/farewell/board/${name}` : `/farewell/board/${name}.webp`,
  alt,
  stack,
  mark,
});

const VISUALS: Record<BoardKey, Record<string, Visual>> = {
  days: { '1': { kind: 'calendar', n: 1 }, '3': { kind: 'calendar', n: 3 }, '4': { kind: 'calendar', n: 4 }, '5': { kind: 'calendar', n: 5 }, '7': { kind: 'calendar', n: 7 } },
  coffin: {
    // หีบที่ทีมออกแบบเอง = "เรียบง่าย" (ผู้ใช้สลับ 21 พ.ย. 2026) — โมเดล Blender เดียวกับหน้าเส้นทางสุดท้าย /farewell/journey
    //   (public/farewell/fallback-coffin.png ตัดพื้นแล้ว) · หีบขาวแบบขั้นจาก AI ย้ายไปเป็น "ตามที่นิยมในพื้นที่"
    simple: img('coffin-ours', 'หีบศพสีขาวลายทองแบบไทย'),
    // ตามที่นิยม = หีบขาวขอบทอง ลายดอกทองที่มุม บนฐานทอง (ทำใหม่ 22 พ.ย. 2026 — เดิมแผ่นขาวแบบขั้น ผู้ใช้ว่าไม่ถูกต้อง)
    standard: img('coffin-standard', 'หีบศพสีขาวขอบทองบนฐานทอง'),
    ornate: img('coffin-ornate', 'หีบศพลายทองประณีต'),
  },
  monks: {
    // ปรึกษาพระ = ภาพพระสมมติจาก GPT (Codex CLI, 22 พ.ย. 2026 — แทนภาพถ่ายพระไพศาลที่ยังไม่ได้ขออนุญาต ก่อนเวทีอุบล)
    ask: img('monk', 'พระสงฆ์ห่มจีวรสีส้ม'),
    // ซองขาวแนวนอนฝาปลายมน วาดเป็น SVG (ตามภาพอ้างอิงที่ผู้ใช้ส่ง)
    ability: img('envelope.svg', 'ซองถวายพระหนึ่งซอง'),
    custom: img('envelope.svg', 'ซองถวายพระหลายซอง', 3),
  },
  food: {
    buffet: img('food-buffet', 'ถาดแกงและข้าวแบบตักเอง'),
    potluck: img('food-potluck', 'หม้อแกงที่ญาติช่วยกันทำ'),
    served: img('food-served', 'ถาดอาหารยกเสิร์ฟ'),
  },
  takeaway: {
    // งดห่อ: ถุงกระดาษที่พิมพ์คำว่า "งดห่อ" บนตัวถุง (ผู้ใช้ขอ 21 พ.ย. 2026 — เดิมการ์ด "ขอบคุณที่มาร่วมส่ง" แล้วถุงจาง+วงห้าม ไม่สื่อ)
    //   + วงห้ามจาง ๆ ทับ (ผู้ใช้ขอเพิ่ม 21 พ.ย. 2026)
    none: { ...img('takeaway-bag', 'ถุงกระดาษพิมพ์คำว่างดห่อ', undefined, 'soft-none'), label: 'งดห่อ' } as Visual,
    less: { ...img('takeaway-bag', 'ถุงกระดาษพิมพ์คำว่าลดห่อ'), label: 'ลดห่อ' } as Visual,
    host: img('takeaway-bag', 'ถุงของฝากหนึ่งใบ'),
    all: img('takeaway-bag', 'ถุงของฝากหลายใบ', 3),
  },
  flowers: {
    simple: img('flowers-simple', 'แจกันดอกเบญจมาศขาว'),
    standard: img('flowers-full', 'พานดอกไม้ขาวเหลือง'),
    full: img('flowers-full', 'ดอกไม้จัดเต็มหลายพาน', 2),
  },
  alcohol: {
    none: { kind: 'sign' },
    undecided: img('alcohol-beer', 'ขวดเบียร์มีเครื่องหมายคำถาม', undefined, 'maybe'),
    serve: img('alcohol-beer', 'ขวดเบียร์สามขวด'),
  },
};

const fromQuestion = (key: BoardKey, slot: Category['slot'], tagAlign?: Category['tagAlign']): Category => {
  const q = QUESTIONS.find((x) => x.key === key)!;
  return {
    key,
    label: q.short,
    title: q.title,
    why: q.why,
    facts: q.facts,
    options: q.options.map((o) => ({ ...o, visual: VISUALS[key][o.id] })),
    slot,
    tagAlign,
  };
};

// ผังกระดาน 3:4 แบบ knolling — ของชิ้นใหญ่ (สถานที่) บนสุด ไล่ลงตามลำดับการตัดสินใจ
export const CATEGORIES: Category[] = [
  {
    key: 'place',
    label: 'สถานที่',
    title: 'ตั้งศพที่ไหน',
    why: 'สถานที่กำหนดว่าใครต้องดูแลอะไร ทั้งสองแบบให้เกียรติผู้วายชนม์ได้เท่ากัน',
    facts: [],
    options: [
      {
        id: 'temple',
        label: 'ที่วัด',
        detail: 'ใช้ศาลาของวัด ไม่ต้องจัดสถานที่เอง นัดพระและวันฌาปนกิจได้ในที่เดียว',
        visual: img('place-temple-v2', 'โมเดลศาลาวัดหลังคาแดงที่ตั้งหีบศพ ฉากม่านเหลือง เก้าอี้เรียงแถว'),
      },
      {
        id: 'home',
        label: 'ที่บ้าน',
        detail: 'ญาติและเพื่อนบ้านแวะมาได้ใกล้ชิด แต่ต้องมีคนดูแลเต็นท์ เก้าอี้ ไฟ และการเคลื่อนศพไปวัดวันเผา',
        // v5: GPT ออกแบบ (Codex CLI image generation, 22 พ.ย. 2026 — ผู้ใช้เลือกแบบ A) โมเดลจิ๋วสไตล์เดียวกับศาลาวัด:
        //   บ้านไม้สองชั้นใต้ถุนปูน + เต็นท์ลายฟ้าขาว เก้าอี้พลาสติกฟ้า หีบขาวขอบทอง พระสวดบนอาสน์ · ตัดพื้นขาวแบบ flood fill จากขอบ (Vision ตัดต้นไม้หาย)
        //   (v4 ห้องโถงในบ้าน, v2 บ้านไม้เก่า+เต็นท์, v3 บ้านไม้สัก ไม่ใช้แล้ว)
        visual: img('place-home-v5', 'โมเดลงานศพที่บ้าน บ้านไม้สองชั้น เต็นท์ลายฟ้าขาว เก้าอี้พลาสติกสีฟ้า พระสวดหน้าหีบศพ'),
      },
    ],
    slot: { x: 22, y: 2, w: 56, h: 34 },
  },
  fromQuestion('days', { x: 5, y: 6, w: 17, h: 17 }),
  fromQuestion('coffin', { x: 8, y: 37, w: 84, h: 17 }),
  fromQuestion('monks', { x: 76, y: 8, w: 20, h: 13 }, 'end'),
  { ...fromQuestion('food', { x: 5, y: 56, w: 55, h: 19 }), slotCompact: { x: 4, y: 56, w: 33, h: 19 } },
  fromQuestion('flowers', { x: 64, y: 55, w: 31, h: 21 }),
  fromQuestion('takeaway', { x: 8, y: 78, w: 34, h: 20 }),
  fromQuestion('alcohol', { x: 52, y: 78, w: 40, h: 20 }),
];

/** ตัวอย่างแผนเรียบง่าย (ปุ่ม "ดูตัวอย่าง") — ทางที่ภาระเบาเกือบทุกข้อ แต่ 3 คืน ให้ญาติที่อยู่ไกลมาทัน */
export const SAMPLE: Partial<Record<CategoryKey, string>> = {
  place: 'temple',
  days: '3',
  coffin: 'simple',
  monks: 'ability',
  food: 'buffet',
  takeaway: 'none',
  flowers: 'simple',
  alcohol: 'none',
};

/** ตัวเลือกย่อย มี/ไม่มี ใต้หมวดแม่ (ผู้ใช้ขอ 22 พ.ย. 2026) — ตอบเก็บใน answers[key] = 'yes'|'no'
 *  tag = คำต่อท้ายป้ายของหมวดแม่บนกระดาน · visual+slot = มีภาพวางบนกระดานของตัวเอง (แทน tag) */
export interface Extra {
  key: ExtraKey;
  parent: CategoryKey;
  title: string;
  yes: string;
  tag: string;
  visual?: Visual;
  slot?: Category['slot'];
}

export const EXTRAS: Extra[] = [
  {
    key: 'brahmin',
    parent: 'monks',
    title: 'พราหมณ์ทำพิธี',
    yes: 'มี',
    tag: 'พราหมณ์',
    // ภาพพราหมณ์สมมติจาก GPT (Codex CLI, 22 พ.ย. 2026 — แทนภาพถ่ายบุคคลจริงที่ยังไม่ได้ขออนุญาต ก่อนเวทีอุบล) ตัดพื้นด้วย Vision + ไล่จางขอบล่าง
    //   วางในช่องว่างใต้ซองถวายพระ (ขวาของศาลา)
    visual: img('brahmin', 'พราหมณ์ในชุดราชปะแตนสีขาว'),
    slot: { x: 79, y: 22, w: 16, h: 15 },
  },
  // แม่ครัว/คนล้างจาน: สร้างด้วย Codex CLI (image generation) จากภาพอ้างอิงท่าทางที่ผู้ใช้ส่ง 22 พ.ย. 2026 — เป็นคนสมมติ
  //   ไม่ใช่คนในภาพอ้างอิง · ตัดพื้นด้วย Vision ของ macOS · มีภาพแล้วช่องอาหารหด (slotCompact) ให้ยืนข้างถาด
  {
    key: 'cook',
    parent: 'food',
    title: 'จ้างแม่ครัว',
    yes: 'จ้าง',
    tag: 'แม่ครัว',
    visual: img('cook', 'แม่ครัวถือกระด้งผัก'),
    slot: { x: 37, y: 53, w: 12, h: 23 },
  },
  {
    key: 'dishwash',
    parent: 'food',
    title: 'จ้างคนล้างจาน',
    yes: 'จ้าง',
    tag: 'คนล้างจาน',
    visual: img('dishwasher', 'คนล้างจานนั่งล้างจานในกะละมังสีฟ้า'),
    slot: { x: 48, y: 57, w: 16, h: 19 },
  },
];
