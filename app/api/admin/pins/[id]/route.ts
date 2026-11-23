import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/app/lib/db';
import { getAdminUser } from '@/app/lib/adminAuth';
type Context = { params: Promise<{ id: string }> };
export async function PATCH(req: NextRequest, { params }: Context) {
  if (!(await getAdminUser())) return NextResponse.json({ error: 'ไม่มีสิทธิ์' }, { status: 403 });
  const { id } = await params;
  const n = Number(id);
  if (!Number.isInteger(n)) return NextResponse.json({ error: 'ไม่พบหมุด' }, { status: 400 });
  const b = await req.json();
  const data: { hidden?: boolean; displayName?: string | null; story?: string | null } = {};
  if (typeof b.hidden === 'boolean') data.hidden = b.hidden;
  if (b.displayName === null || typeof b.displayName === 'string')
    data.displayName = typeof b.displayName === 'string' ? b.displayName.trim().slice(0, 120) || null : null;
  if (b.story === null || typeof b.story === 'string')
    data.story = typeof b.story === 'string' ? b.story.trim().slice(0, 1000) || null : null;
  if (!Object.keys(data).length) return NextResponse.json({ error: 'ไม่มีข้อมูลแก้ไข' }, { status: 400 });
  try {
    return NextResponse.json(
      await prisma.funeralPin.update({ where: { id: n }, data, select: { id: true, hidden: true, displayName: true, story: true } }),
    );
  } catch {
    return NextResponse.json({ error: 'ไม่พบหมุด' }, { status: 404 });
  }
}
export async function DELETE(_req: NextRequest, { params }: Context) {
  if (!(await getAdminUser())) return NextResponse.json({ error: 'ไม่มีสิทธิ์' }, { status: 403 });
  const { id } = await params;
  const n = Number(id);
  if (!Number.isInteger(n)) return NextResponse.json({ error: 'ไม่พบหมุด' }, { status: 400 });
  try {
    await prisma.funeralPin.delete({ where: { id: n } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'ไม่พบหมุด' }, { status: 404 });
  }
}
