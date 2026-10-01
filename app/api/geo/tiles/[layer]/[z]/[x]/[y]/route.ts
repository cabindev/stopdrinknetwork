// app/api/geo/tiles/[layer]/[z]/[x]/[y]/route.ts — proxy แผนที่พื้นหลังของ GISTDA Sphere
// ผ่าน server เพื่อไม่ให้คีย์โผล่ใน URL ฝั่ง browser + เป็น same-origin (วาดลง canvas ได้ไม่โดน taint)
import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { isStaffRole } from '@/app/lib/activityMeta';
import { SPHERE_LAYERS, sphereKey, sphereTileUrl } from '@/app/lib/sphere';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ layer: string; z: string; x: string; y: string }> }
) {
  // getToken อ่าน JWT จาก cookie ตรง ๆ — เร็วกว่า getServerSession (tile ถูกเรียกทีละหลายสิบรูป)
  const token = await getToken({ req: request });
  if (!token) return new NextResponse(null, { status: 401 });
  if (!isStaffRole(token.role as string)) return new NextResponse(null, { status: 403 }); // รออนุมัติ
  const { layer, z, x, y } = await params;
  const [zi, xi, yi] = [z, x, y.replace(/\.\w+$/, '')].map(Number);
  const max = 2 ** zi;
  if (
    !(layer in SPHERE_LAYERS) ||
    !sphereKey() ||
    ![zi, xi, yi].every(Number.isInteger) ||
    zi < 0 || zi > 19 || xi < 0 || yi < 0 || xi >= max || yi >= max
  ) {
    return new NextResponse(null, { status: 400 });
  }
  try {
    const res = await fetch(sphereTileUrl(layer, zi, xi, yi), { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return new NextResponse(null, { status: res.status === 404 ? 404 : 502 });
    return new NextResponse(res.body, {
      headers: {
        'Content-Type': res.headers.get('content-type') ?? 'image/jpeg',
        'Cache-Control': 'private, max-age=259200', // 3 วัน เท่ากับที่ Sphere ตั้งไว้
      },
    });
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}
