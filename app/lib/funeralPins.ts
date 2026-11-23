// app/lib/funeralPins.ts — หมุด "งานศพปลอดเหล้าของครอบครัว" (ตาราง FuneralPin) ใช้ร่วม client/server (ไม่ import prisma)
// ประชาชนที่ login แล้วปักงานจริงที่จัดแล้ว · คำถามใช้ตัวเลือกชุดเดียวกับกระดาน (farewell/content.ts QUESTIONS)
import { QUESTIONS, type QuestionKey } from '@/app/farewell/content';

/** หมุดรุ่นแรก (ไม่ต้อง login, 23 พ.ย. 2026) — ยังแสดงได้ */
export const PIN_KINDS = {
  FAMILY: 'ครอบครัว',
  VILLAGE: 'หมู่บ้าน/ชุมชน',
  TEMPLE: 'วัด',
  SUBDISTRICT: 'ตำบล/เทศบาล',
  OTHER: 'อื่น ๆ',
} as const;
export const PIN_PRACTICES = {
  no_alcohol: 'ไม่เลี้ยงเหล้า',
  fewer_days: 'ลดจำนวนวัน',
  no_takeaway: 'งด/ลดของห่อกลับ',
  monks_no_fee: 'พระสวดไม่รับซอง',
  simple_coffin: 'หีบ/ดอกไม้เรียบง่าย',
  potluck: 'ญาติและเพื่อนบ้านช่วยกันทำอาหาร',
  community_rule: 'มีข้อตกลงชุมชน',
} as const;

/** จัดงานให้ใคร */
export const PIN_RELATIONS = {
  father: 'พ่อ',
  mother: 'แม่',
  grandparent: 'ปู่ ย่า ตา ยาย',
  spouse: 'สามี/ภรรยา',
  child: 'ลูก',
  sibling: 'พี่น้อง',
  relative: 'ญาติ',
  other: 'อื่น ๆ',
} as const;
export type PinRelation = keyof typeof PIN_RELATIONS;

export const PIN_PLACES = { temple: 'ที่วัด', home: 'ที่บ้าน' } as const;

/** คำถามแบบกระดานที่ถามในฟอร์ม (ไม่รวมตัวเลือกย่อย พราหมณ์/แม่ครัว/คนล้างจาน) */
export const PIN_QUESTIONS = QUESTIONS;
export type PinAnswers = Partial<Record<QuestionKey, string>>;

export const PIN_SOURCE = 'family';

/** ไฟล์แนบ: รูปสาธารณะ ≤5 · บิล/ใบเสร็จ (รูปหรือ PDF) ≤10 เห็นเฉพาะแอดมิน+ผู้ปัก */
export const PIN_FILE_LIMITS = { photos: 5, bills: 10, fileMB: 15, totalMB: 60 } as const;

export interface PublicPin {
  id: number;
  kind: string;
  displayName: string | null;
  relation: string | null;
  /** ชื่อผู้วายชนม์ — มีค่าเฉพาะเมื่อครอบครัวเลือกให้แสดง */
  deceasedName: string | null;
  funeralDate: string | null; // YYYY-MM-DD
  place: string | null;
  answers: PinAnswers;
  totalCost: number | null;
  district: string;
  amphoe: string;
  province: string;
  latitude: number;
  longitude: number;
  yearBE: number | null;
  practices: string[];
  savedAmount: number | null;
  story: string | null;
  /** id รูปสาธารณะ → /api/pin-files/<id> */
  photos: number[];
  createdAt: string;
}

/** ช่องที่อ่านได้สาธารณะ (ชื่อผู้วายชนม์อ่านมาเพื่อคัดตาม showDeceasedName ใน toPublicPin — ห้ามส่ง row ดิบออกไป) */
export const PUBLIC_PIN_SELECT = {
  id: true,
  kind: true,
  displayName: true,
  relation: true,
  deceasedFirstName: true,
  deceasedLastName: true,
  showDeceasedName: true,
  funeralDate: true,
  place: true,
  answers: true,
  totalCost: true,
  district: true,
  amphoe: true,
  province: true,
  latitude: true,
  longitude: true,
  yearBE: true,
  practices: true,
  savedAmount: true,
  story: true,
  createdAt: true,
  files: { where: { kind: 'PHOTO' }, select: { id: true }, orderBy: { id: 'asc' } },
} as const;

type PinRow = {
  id: number;
  kind: string;
  displayName: string | null;
  relation: string | null;
  deceasedFirstName: string | null;
  deceasedLastName: string | null;
  showDeceasedName: boolean;
  funeralDate: Date | null;
  place: string | null;
  answers: unknown;
  totalCost: number | null;
  district: string;
  amphoe: string;
  province: string;
  latitude: number;
  longitude: number;
  yearBE: number | null;
  practices: unknown;
  savedAmount: number | null;
  story: string | null;
  createdAt: Date;
  files?: { id: number }[];
};

const VALID_ANSWER = new Map(PIN_QUESTIONS.map((q) => [q.key, new Set(q.options.map((o) => o.id))]));

/** คัดเฉพาะคำตอบที่เป็นตัวเลือกจริงของกระดาน (ใช้ทั้งตรวจข้อมูลเข้าและอ่านออก) */
export function cleanAnswers(raw: unknown): PinAnswers {
  const out: PinAnswers = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const valid = VALID_ANSWER.get(k as QuestionKey);
    if (valid && typeof v === 'string' && valid.has(v)) out[k as QuestionKey] = v;
  }
  return out;
}

export function toPublicPin(row: PinRow): PublicPin {
  const name = row.showDeceasedName ? [row.deceasedFirstName, row.deceasedLastName].filter(Boolean).join(' ').trim() : '';
  return {
    id: row.id,
    kind: row.kind,
    displayName: row.displayName,
    relation: row.relation,
    deceasedName: name || null,
    funeralDate: row.funeralDate ? row.funeralDate.toISOString().slice(0, 10) : null,
    place: row.place,
    answers: cleanAnswers(row.answers),
    totalCost: row.totalCost,
    district: row.district,
    amphoe: row.amphoe,
    province: row.province,
    latitude: row.latitude,
    longitude: row.longitude,
    yearBE: row.yearBE,
    practices: Array.isArray(row.practices) ? row.practices.filter((x): x is string => typeof x === 'string') : [],
    savedAmount: row.savedAmount,
    story: row.story,
    photos: (row.files ?? []).map((f) => f.id),
    createdAt: row.createdAt.toISOString(),
  };
}

/** ชื่อหมุดบนแผนที่ */
export function pinTitle(p: Pick<PublicPin, 'displayName' | 'kind' | 'deceasedName' | 'relation'>): string {
  if (p.deceasedName) return `งานของคุณ${p.deceasedName}`;
  if (p.displayName) return p.displayName;
  if (p.relation) return `ครอบครัวหนึ่ง จัดงานให้${PIN_RELATIONS[p.relation as PinRelation] ?? 'คนที่รัก'}`;
  return `${PIN_KINDS[p.kind as keyof typeof PIN_KINDS] ?? 'ชุมชน'}หนึ่ง`;
}

/** ป้ายคำตอบ เช่น "3 คืน" "ไม่เลี้ยงเหล้าเบียร์" */
export function answerLabel(key: QuestionKey, id: string | undefined): string | null {
  if (!id) return null;
  return PIN_QUESTIONS.find((q) => q.key === key)?.options.find((o) => o.id === id)?.label ?? null;
}
