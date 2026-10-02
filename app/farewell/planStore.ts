'use client';
// app/farewell/planStore.ts — แผนงานศพของครอบครัว เก็บใน localStorage ของเครื่องผู้ใช้เท่านั้น
// ไม่ส่งขึ้นเซิร์ฟเวอร์ (ผู้ใช้ตัดสินใจ ต.ค. 2026: ข้อมูลส่วนตัวของครอบครัวที่เพิ่งสูญเสีย)
// ใช้ useSyncExternalStore: ฝั่ง server ได้ null แล้วค่อยอ่านค่าจริงตอน hydrate จึงไม่มี hydration mismatch
import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { COST_LINES, type QuestionKey } from './content';

const KEY = 'sdn-farewell-plan-v1';
const EVENT = 'sdn-farewell-plan';

export interface PlanArea {
  district: string;
  amphoe: string;
  province: string;
}

export interface Plan {
  v: 1;
  deceasedName: string;
  area: PlanArea | null;
  answers: Partial<Record<QuestionKey, string>>;
  /** ราคาที่ครอบครัวกรอกเอง (บาท) — รายการต่อวันเก็บเป็นยอดต่อวัน */
  costs: Record<string, number>;
  /** เงินช่วยงานที่คาดว่าจะได้รับ (ไม่บังคับ) */
  support: number | null;
  /** เช็กลิสต์ที่ทำแล้ว */
  done: Record<string, boolean>;
  updatedAt: string;
}

export const EMPTY_PLAN: Plan = {
  v: 1,
  deceasedName: '',
  area: null,
  answers: {},
  costs: {},
  support: null,
  done: {},
  updatedAt: '',
};

// localStorage อาจโยน error ได้ (โหมดส่วนตัว/ปิดการเก็บข้อมูล) — หน้าเว็บยังต้องใช้งานได้ แค่ไม่จำ
function read(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener('storage', onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

// สำรองค่าไว้ในหน่วยความจำ กรณีเครื่องเก็บ localStorage ไม่ได้ จะได้ยังกรอกต่อในหน้าเดิมได้
let memory: string | null = null;

function parse(raw: string | null): Plan {
  if (!raw) return EMPTY_PLAN;
  try {
    const p = JSON.parse(raw) as Partial<Plan>;
    return p?.v === 1 ? { ...EMPTY_PLAN, ...p } : EMPTY_PLAN;
  } catch {
    return EMPTY_PLAN;
  }
}

function write(plan: Plan | null) {
  const raw = plan ? JSON.stringify({ ...plan, updatedAt: new Date().toISOString() }) : null;
  memory = raw;
  try {
    if (raw) window.localStorage.setItem(KEY, raw);
    else window.localStorage.removeItem(KEY);
  } catch {
    // เก็บไม่ได้ก็ไม่เป็นไร ใช้ค่าในหน่วยความจำต่อ
  }
  window.dispatchEvent(new Event(EVENT));
}

/** plan = null ระหว่างที่ยังไม่ได้อ่านค่าจากเครื่อง (render ฝั่ง server และเฟรมแรก) */
export function usePlan() {
  const raw = useSyncExternalStore(
    subscribe,
    () => read() ?? memory,
    () => undefined,
  );
  const plan = useMemo(() => (raw === undefined ? null : parse(raw)), [raw]);

  const update = useCallback((patch: Partial<Plan> | ((p: Plan) => Partial<Plan>)) => {
    const current = parse(read() ?? memory);
    const next = typeof patch === 'function' ? patch(current) : patch;
    write({ ...current, ...next });
  }, []);

  const reset = useCallback(() => write(null), []);

  return { plan, hasSaved: !!raw, update, reset };
}

export function planDays(plan: Plan) {
  const n = Number(plan.answers.days);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/** สรุปงบจากตัวเลขที่ครอบครัวกรอกเอง — ไม่มีราคาตั้งต้นใด ๆ จากระบบ */
export function planBudget(plan: Plan) {
  const days = planDays(plan);
  const lines = COST_LINES.filter((l) => !l.when || l.when(plan.answers)).map((l) => {
    const amount = plan.costs[l.id] ?? 0;
    return { ...l, amount, total: l.perDay ? amount * days : amount };
  });
  const total = lines.reduce((s, l) => s + l.total, 0);
  const perDayTotal = lines.filter((l) => l.perDay).reduce((s, l) => s + l.amount, 0);
  const alcohol = lines.find((l) => l.id === 'alcohol')?.total ?? 0;
  return {
    days,
    lines,
    total,
    /** ถ้าเหลือวันเดียว รายการต่อวันจะลดลงเท่านี้ */
    savedIfOneDay: days > 1 ? perDayTotal * (days - 1) : 0,
    alcohol,
    net: plan.support != null ? total - plan.support : null,
    filled: lines.some((l) => l.amount > 0),
  };
}

export const baht = (n: number) => `${Math.round(n).toLocaleString('th-TH')} บาท`;
