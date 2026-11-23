// app/api/pins/route.ts — ปักหมุดงานศพปลอดเหล้าจากแขกในงาน (สาธารณะ ไม่ต้อง login) · GET = หมุดที่แสดง (ไม่มีข้อมูลติดต่อ) · POST = เพิ่มหมุด เฉพาะช่วงเปิด (pinsOpen)
import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/app/lib/db';
import { findRegion } from '@/app/lib/regionLookup';
import { getTambonCoords } from '@/app/lib/tambonCoords';
import { provinceHealthZones } from '@/app/utils/healthZones';
import { PIN_KINDS, PIN_PRACTICES, PIN_SOURCE, PUBLIC_PIN_SELECT, pinsOpen, toPublicPin } from '@/app/lib/funeralPins';
const headers = { 'Cache-Control': 'no-store' };
const limits = new Map<string, number[]>();
// กันสแปม: ต่อ IP ไม่เกิน RATE_MAX ครั้งใน 10 นาที — ตั้งหลวมไว้ เพราะแขกในงานใช้ Wi-Fi ห้าง/เน็ตมือถือ (CGNAT) ร่วม IP เดียวกันได้หลายสิบคน
const RATE_MAX = 30;
export async function GET(req: NextRequest) {
  const since = Number(req.nextUrl.searchParams.get('since') || 0);
  const rows = await prisma.funeralPin.findMany({
    where: { hidden: false, ...(since > 0 ? { id: { gt: since } } : {}) },
    select: PUBLIC_PIN_SELECT,
    orderBy: { createdAt: 'asc' },
  });
  return NextResponse.json({ pins: rows.map(toPublicPin), open: pinsOpen() }, { headers });
}
export async function POST(req: NextRequest) {
  if (!pinsOpen()) return NextResponse.json({ error: 'เปิดให้ปักหมุดเฉพาะวันที่ 27 พ.ย. 2569' }, { status: 403, headers });
  try {
    const b = await req.json();
    if (typeof b.website === 'string' && b.website.trim()) return NextResponse.json({ ok: true }, { headers });
    const forwarded =
      req.headers.get('cf-connecting-ip') ||
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      'unknown';
    const ipHash = createHash('sha256')
      .update(`${forwarded}:${process.env.NEXTAUTH_SECRET || ''}`)
      .digest('hex');
    const now = Date.now();
    const recent = (limits.get(ipHash) || []).filter((t) => now - t < 600000);
    if (recent.length >= RATE_MAX) return NextResponse.json({ error: 'ส่งถี่เกินไป ลองใหม่อีกสักครู่' }, { status: 429, headers });
    recent.push(now);
    limits.set(ipHash, recent);
    const kind = String(b.kind || '');
    const district = String(b.district || '').trim(),
      amphoe = String(b.amphoe || '').trim(),
      province = String(b.province || '').trim();
    const displayName = typeof b.displayName === 'string' ? b.displayName.trim() || null : null;
    const story = typeof b.story === 'string' ? b.story.trim() || null : null;
    const currentYear = new Date().getUTCFullYear() + 543;
    if (!Object.hasOwn(PIN_KINDS, kind) || !findRegion(district, amphoe, province)) throw new Error('กรุณาเลือกตำบล อำเภอ และจังหวัดให้ถูกต้อง');
    if (displayName && displayName.length > 120) throw new Error('ชื่อที่แสดงยาวเกิน 120 ตัวอักษร');
    if (story && story.length > 1000) throw new Error('เรื่องเล่ายาวเกิน 1,000 ตัวอักษร');
    const yearBE = b.yearBE === '' || b.yearBE == null ? null : Number(b.yearBE);
    if (yearBE !== null && (!Number.isInteger(yearBE) || yearBE < 2500 || yearBE > currentYear)) throw new Error('ปี พ.ศ. ไม่ถูกต้อง');
    const practices = Array.isArray(b.practices)
      ? [...new Set<string>(b.practices.filter((x: unknown): x is string => typeof x === 'string'))]
      : [];
    if (!practices.length || practices.length > 10 || practices.some((x) => !Object.hasOwn(PIN_PRACTICES, x)))
      throw new Error('เลือกสิ่งที่ทำอย่างน้อย 1 ข้อ');
    const savedAmount = b.savedAmount === '' || b.savedAmount == null ? null : Number(b.savedAmount);
    if (savedAmount !== null && (!Number.isInteger(savedAmount) || savedAmount < 0 || savedAmount > 10000000))
      throw new Error('จำนวนเงินไม่ถูกต้อง');
    const coords = getTambonCoords(district, amphoe, province);
    if (!coords) throw new Error('ไม่พบพิกัดตำบล กรุณาเลือกพื้นที่ใหม่');
    const consent = b.consent === true;
    const row = await prisma.funeralPin.create({
      data: {
        kind,
        displayName,
        district,
        amphoe,
        province,
        region: provinceHealthZones[province] ?? null,
        latitude: coords.lat + (Math.random() - 0.5) * 0.016,
        longitude: coords.lng + (Math.random() - 0.5) * 0.016,
        yearBE,
        practices,
        savedAmount,
        story,
        contactName: consent && typeof b.contactName === 'string' ? b.contactName.trim().slice(0, 120) || null : null,
        contactPhone: consent && typeof b.contactPhone === 'string' ? b.contactPhone.trim().slice(0, 40) || null : null,
        consent,
        source: PIN_SOURCE,
        ipHash,
      },
      select: PUBLIC_PIN_SELECT,
    });
    return NextResponse.json({ ok: true, pin: toPublicPin(row) }, { headers });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'ข้อมูลไม่ถูกต้อง' }, { status: 400, headers });
  }
}
