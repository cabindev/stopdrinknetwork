// app/stories/page.tsx — รายการกรณีศึกษาสาธารณะ (ไม่ต้อง login)
// กรองตามประเด็นย่อย/จังหวัด ผ่าน ?sub=&province= (URL แชร์ได้) — ข้อมูลจาก STORY_SELECT เท่านั้น
import type { Metadata } from 'next';
import Link from 'next/link';
import { BookOpen, Layers } from 'lucide-react';
import prisma from '@/app/lib/db';
import { STORY_SELECT } from '@/app/lib/story';
import { ACTIVE_ACTIVITY } from '@/app/lib/db';
import StoryCard from './StoryCard';

export const metadata: Metadata = {
  title: 'กรณีศึกษา — Stop Drink Network',
  description: 'เรียนรู้จากพื้นที่จริง: งานศพปลอดเหล้า ประเพณีปลอดเหล้า และกติกาชุมชนที่ทำได้ผล พร้อมไฟล์กติกาให้ดาวน์โหลดไปปรับใช้',
};

export default async function StoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ sub?: string; province?: string }>;
}) {
  const sp = await searchParams;
  const sub = sp.sub ?? '';
  const province = sp.province ?? '';

  const [stories, facets] = await Promise.all([
    prisma.activity.findMany({
      where: {
        isPublished: true,
        ...(sub ? { subCategory: { name: sub } } : {}),
        // จังหวัด: พื้นที่หลัก หรือพื้นที่ที่เกี่ยวข้อง (ActivityArea) ของเรื่องนั้น
        ...(province ? { OR: [{ province }, { areas: { some: { province } } }] } : {}),
      },
      select: STORY_SELECT,
      orderBy: { publishedAt: 'desc' },
    }),
    prisma.activity.findMany({
      where: { isPublished: true },
      select: { province: true, areas: { select: { province: true } }, subCategory: { select: { name: true } } },
    }),
  ]);
  // ชุดกรณีศึกษาที่มีเรื่องเผยแพร่แล้ว — ชิปลิงก์ไปหน้าชุด
  const seriesList = await prisma.storySeries.findMany({
    where: { activities: { some: { isPublished: true, ...ACTIVE_ACTIVITY } } },
    select: { id: true, title: true, _count: { select: { activities: { where: { isPublished: true, ...ACTIVE_ACTIVITY } } } } },
    orderBy: { updatedAt: 'desc' },
  });
  const count = <T,>(list: T[]) => [...list.reduce((m, k) => m.set(k, (m.get(k) ?? 0) + 1), new Map<T, number>())];
  const subs = count(facets.map((f) => f.subCategory?.name).filter((x): x is string => !!x)).sort((a, b) => b[1] - a[1]);
  // เรื่องเดียวนับครั้งเดียวต่อจังหวัด แม้จะมีหลายพื้นที่ในจังหวัดเดียวกัน
  const provinces = count(facets.flatMap((f) => [...new Set([f.province, ...f.areas.map((a) => a.province)])])).sort((a, b) => a[0].localeCompare(b[0], 'th'));

  const chip = (active: boolean) =>
    `px-3 py-1 rounded-full border text-xs whitespace-nowrap transition-colors ${
      active ? 'bg-orange-600 border-orange-600 text-white' : 'bg-white border-orange-200 text-gray-700 hover:bg-orange-50'
    }`;
  const qs = (p: Record<string, string>) => {
    const q = new URLSearchParams(Object.entries({ sub, province, ...p }).filter(([, v]) => v));
    return q.toString() ? `/stories?${q}` : '/stories';
  };

  return (
    <main className="min-h-screen bg-white pt-20 pb-16 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3">
          <span className="flex w-11 h-11 rounded-xl bg-orange-50 border border-orange-100 items-center justify-center">
            <BookOpen className="w-5 h-5 text-orange-600" />
          </span>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">กรณีศึกษา</h1>
            <p className="text-sm text-gray-500">เรียนรู้จากพื้นที่จริง พร้อมกติกาให้ดาวน์โหลดไปปรับใช้</p>
          </div>
        </div>

        {seriesList.length > 0 && (
          <div className="mt-6 flex items-center gap-2 overflow-x-auto pb-1">
            <span className="shrink-0 inline-flex items-center gap-1 text-xs font-medium text-gray-500">
              <Layers className="w-3.5 h-3.5 text-orange-600" /> ชุดกรณีศึกษา
            </span>
            {seriesList.map((x) => (
              <Link
                key={x.id}
                href={`/stories/series/${x.id}`}
                className="px-3 py-1 rounded-full border border-orange-300 bg-orange-50 text-xs text-orange-800 whitespace-nowrap hover:bg-orange-100"
              >
                {x.title} <span className="opacity-70">{x._count.activities}</span>
              </Link>
            ))}
          </div>
        )}
        {subs.length > 0 && (
          <div className="mt-6 flex gap-2 overflow-x-auto pb-1">
            <Link href={qs({ sub: '' })} className={chip(!sub)}>ทุกประเด็น</Link>
            {subs.map(([name, n]) => (
              <Link key={name} href={qs({ sub: name })} className={chip(sub === name)}>
                {name} <span className="opacity-70">{n}</span>
              </Link>
            ))}
          </div>
        )}
        {provinces.length > 1 && (
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
            <Link href={qs({ province: '' })} className={chip(!province)}>ทุกจังหวัด</Link>
            {provinces.map(([name, n]) => (
              <Link key={name} href={qs({ province: name })} className={chip(province === name)}>
                {name} <span className="opacity-70">{n}</span>
              </Link>
            ))}
          </div>
        )}

        <p className="mt-5 text-sm text-gray-500">{stories.length} เรื่อง</p>
        {stories.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-orange-200 p-10 text-center text-sm text-gray-400">
            ยังไม่มีกรณีศึกษา{sub || province ? 'ที่ตรงกับตัวกรอง' : ''}
          </div>
        ) : (
          <div className="mt-3 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {stories.map((s) => (
              <StoryCard key={s.id} story={s} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
