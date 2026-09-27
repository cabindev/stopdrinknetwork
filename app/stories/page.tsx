// app/stories/page.tsx — รายการกรณีศึกษาสาธารณะ (ไม่ต้อง login)
// กรองตามประเด็นย่อย/จังหวัด ผ่าน ?sub=&province= (URL แชร์ได้) — ข้อมูลจาก STORY_SELECT เท่านั้น
import type { Metadata } from 'next';
import Link from 'next/link';
import { BookOpen, MapPin } from 'lucide-react';
import prisma from '@/app/lib/db';
import { STORY_SELECT, storyCover, storyExcerpt, storyPlace, publicFileUrl, storyLogoUrl } from '@/app/lib/story';
import { formatStartDate } from '@/app/lib/activityMeta';

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
        ...(province ? { province } : {}),
      },
      select: STORY_SELECT,
      orderBy: { publishedAt: 'desc' },
    }),
    prisma.activity.findMany({
      where: { isPublished: true },
      select: { province: true, subCategory: { select: { name: true } } },
    }),
  ]);
  const count = <T,>(list: T[]) => [...list.reduce((m, k) => m.set(k, (m.get(k) ?? 0) + 1), new Map<T, number>())];
  const subs = count(facets.map((f) => f.subCategory?.name).filter((x): x is string => !!x)).sort((a, b) => b[1] - a[1]);
  const provinces = count(facets.map((f) => f.province)).sort((a, b) => a[0].localeCompare(b[0], 'th'));

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
            {stories.map((s) => {
              const cover = storyCover(s);
              const started = formatStartDate(s.startDate, s.startDatePrecision);
              return (
                <Link
                  key={s.id}
                  href={`/stories/${s.id}`}
                  className="group flex flex-col rounded-2xl border border-orange-100 overflow-hidden hover:border-orange-300 hover:shadow-sm transition"
                >
                  {cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={publicFileUrl(cover.id, 'card')}
                      alt={cover.caption || s.title}
                      className="w-full aspect-video object-cover bg-orange-50"
                      loading="lazy"
                    />
                  ) : (
                    // ยังไม่มีรูปเปิดเผย → โลโก้ประเด็นกลางกรอบ 16:9 (จนกว่าแอดมินจะติ๊กรูป)
                    <div className="w-full aspect-video bg-orange-50 flex items-center justify-center">
                      {storyLogoUrl(s) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={storyLogoUrl(s)!}
                          alt={s.subCategory?.name ?? s.category.name}
                          className="w-1/3 max-w-[140px] aspect-square object-contain rounded-full bg-white p-3 shadow-sm"
                          loading="lazy"
                        />
                      ) : (
                        <BookOpen className="w-8 h-8 text-orange-300" />
                      )}
                    </div>
                  )}
                  <div className="p-4 flex-1 flex flex-col">
                    <p className="text-[11px] font-medium text-orange-700">{s.subCategory?.name ?? s.category.name}</p>
                    <h2 className="mt-1 text-sm font-semibold text-gray-800 line-clamp-2 group-hover:text-orange-700">{s.title}</h2>
                    <p className="mt-2 text-xs text-gray-500 line-clamp-3">{storyExcerpt(s, 140)}</p>
                    <p className="mt-auto pt-3 flex items-center gap-1 text-[11px] text-gray-400">
                      <MapPin className="w-3 h-3" /> {storyPlace(s)}
                      {started && <> · เริ่ม{started}</>}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
