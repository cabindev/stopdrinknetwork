// app/farewell/planText.ts — ข้อความของแผนที่ใช้ร่วม: หน้าแรก (กระดาน) · หน้าวางแผน · ใบสรุป · ข้อความส่ง LINE
// สถานที่ (วัด/บ้าน) + ตัวเลือกย่อย (พราหมณ์/แม่ครัว/คนล้างจาน) นิยามที่ board/items.ts — ที่นี่แปลงเป็นคำที่แสดง
import { CATEGORIES, EXTRAS, type Category, type Extra } from './board/items';
import { COST_LINES, DEFAULT_COST, type QuestionKey } from './content';
import { nightly, type Plan } from './planStore';

/** ขั้น "สถานที่ตั้งศพ" (ไม่อยู่ใน QUESTIONS — เก็บที่ plan.place) */
export const PLACE: Category = CATEGORIES.find((c) => c.key === 'place')!;

export const placeLabel = (id: string | null | undefined) => PLACE.options.find((o) => o.id === id)?.label ?? null;

/** ตัวเลือกย่อยใต้หมวดนี้ */
export const extrasOf = (parent: string): Extra[] => EXTRAS.filter((e) => e.parent === parent);

/** "บุฟเฟ่ต์" → "บุฟเฟ่ต์ + แม่ครัว + คนล้างจาน" ตามตัวเลือกย่อยที่ตอบ "มี" */
export function withExtrasText(answers: Plan['answers'], parent: string, text: string) {
  const on = extrasOf(parent).filter((e) => answers[e.key] === 'yes');
  return on.length ? `${text} + ${on.map((e) => e.tag).join(' + ')}` : text;
}

/** หมวดแม่ของรายการค่าใช้จ่ายตัวเลือกย่อย (cook → food) — ใช้กดแถวในใบสรุปกลับไปแก้ */
export const parentOfExtra = (id: string) => EXTRAS.find((e) => e.key === id)?.parent;

/** ราคาเริ่มต้นของตัวเลือก "6,000 บาท/วัน" (ไม่มีราคา = null) */
export function priceOf(key: QuestionKey | string, id: string) {
  const d = DEFAULT_COST[key];
  if (!d || typeof d === 'number' || d[id] == null) return null;
  const perDay = COST_LINES.find((l) => l.id === key)?.perDay;
  return `${d[id].toLocaleString('th-TH')} บาท${perDay ? (nightly(key) ? '/คืน' : '/วัน') : ''}`;
}
