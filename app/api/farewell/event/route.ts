// app/api/farewell/event/route.ts — รับสถิติการใช้ "ส่งด้วยใจ" แบบไม่ระบุตัวตน (สาธารณะ ไม่ต้อง login)
// รับเฉพาะค่าที่รู้จัก: ชนิดเหตุการณ์ใน enum, จังหวัดที่มีจริง, รหัสตัวเลือกที่มีใน QUESTIONS — ที่เหลือทิ้งหมด
// ไม่เก็บ IP/อุปกรณ์ (IP ใช้แค่จำกัดอัตราในหน่วยความจำ ไม่ลง DB) · ตอบ 204 เสมอเมื่อรับได้ ไม่มีข้อมูลย้อนกลับ
import { NextRequest, NextResponse } from 'next/server';
import { Prisma, FarewellEventType } from '@prisma/client';
import prisma from '@/app/lib/db';
import { provinceHealthZones } from '@/app/utils/healthZones';
import { QUESTIONS } from '@/app/farewell/content';

const NO_STORE = { 'Cache-Control': 'no-store' };
const TYPES = new Set<string>(Object.values(FarewellEventType));
const OPTION_IDS = new Map(QUESTIONS.map((q) => [q.key as string, new Set(q.options.map((o) => o.id))]));

// จำกัด 60 เหตุการณ์ / 10 นาที ต่อ IP (หน่วยความจำของ process — ไม่ต้องแม่นข้ามเครื่อง แค่กันยิงรัว)
const WINDOW = 10 * 60 * 1000;
const LIMIT = 60;
const hits = new Map<string, { n: number; at: number }>();
function limited(ip: string) {
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || now - h.at > WINDOW) {
    hits.set(ip, { n: 1, at: now });
    if (hits.size > 5000) for (const [k, v] of hits) if (now - v.at > WINDOW) hits.delete(k);
    return false;
  }
  h.n += 1;
  return h.n > LIMIT;
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (limited(ip)) return new NextResponse(null, { status: 429, headers: NO_STORE });

  let body: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (raw.length > 2000) return new NextResponse(null, { status: 413, headers: NO_STORE });
    body = JSON.parse(raw);
  } catch {
    return new NextResponse(null, { status: 400, headers: NO_STORE });
  }

  const type = String(body.type ?? '');
  if (!TYPES.has(type)) return new NextResponse(null, { status: 400, headers: NO_STORE });

  const province = typeof body.province === 'string' && body.province in provinceHealthZones ? body.province : null;

  let answers: Record<string, string> | null = null;
  if (type === 'PLAN_COMPLETE' && body.answers && typeof body.answers === 'object') {
    answers = {};
    for (const [k, v] of Object.entries(body.answers as Record<string, unknown>)) {
      if (typeof v === 'string' && OPTION_IDS.get(k)?.has(v)) answers[k] = v;
    }
    if (Object.keys(answers).length === 0) answers = null;
  }

  await prisma.farewellEvent.create({
    data: {
      type: type as FarewellEventType,
      province,
      region: province ? provinceHealthZones[province] : null,
      answers: answers ?? Prisma.DbNull,
      found: type === 'LOCAL_LOOKUP' && typeof body.found === 'boolean' ? body.found : null,
    },
  });
  return new NextResponse(null, { status: 204, headers: NO_STORE });
}
