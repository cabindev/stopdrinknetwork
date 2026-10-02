// app/stories/series/[id]/page.tsx — หน้าชุดกรณีศึกษา (สาธารณะ ไม่ต้อง login)
// บทนำของชุด + การ์ดทุกเรื่องที่เผยแพร่แล้วตามลำดับในชุด · ไม่มีเรื่องเผยแพร่เลย = 404
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Layers } from 'lucide-react';
import prisma from '@/app/lib/db';
import { STORY_SELECT, SERIES_ORDER, seriesStoriesWhere } from '@/app/lib/story';
import StoryCard from '../../StoryCard';

async function load(idParam: string) {
  const id = Number(idParam);
  if (!Number.isInteger(id)) return null;
  const series = await prisma.storySeries.findUnique({ where: { id }, select: { id: true, title: true, description: true } });
  if (!series) return null;
  const stories = await prisma.activity.findMany({ where: seriesStoriesWhere(id), select: STORY_SELECT, orderBy: SERIES_ORDER });
  return stories.length > 0 ? { series, stories } : null;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const data = await load((await params).id);
  if (!data) return { title: 'ไม่พบชุดกรณีศึกษา — Stop Drink Network' };
  return {
    title: `${data.series.title} — ชุดกรณีศึกษา Stop Drink Network`,
    description: data.series.description?.slice(0, 160) ?? `${data.stories.length} กรณีศึกษาในชุด ${data.series.title}`,
  };
}

export default async function SeriesPage({ params }: { params: Promise<{ id: string }> }) {
  const data = await load((await params).id);
  if (!data) notFound();
  const { series, stories } = data;

  return (
    <main className="min-h-screen bg-white pt-20 pb-16 px-4">
      <div className="max-w-5xl mx-auto">
        <Link href="/stories" className="inline-flex items-center gap-1.5 text-sm text-orange-700 hover:text-orange-800">
          <ArrowLeft className="w-4 h-4" /> กรณีศึกษาทั้งหมด
        </Link>
        <div className="mt-4 flex items-start gap-3">
          <span className="flex shrink-0 w-11 h-11 rounded-xl bg-orange-50 border border-orange-100 items-center justify-center">
            <Layers className="w-5 h-5 text-orange-600" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-medium text-orange-700">ชุดกรณีศึกษา · {stories.length} เรื่อง</p>
            <h1 className="text-2xl font-bold text-gray-900">{series.title}</h1>
          </div>
        </div>
        {series.description && (
          <p className="mt-4 max-w-3xl text-[15px] text-gray-700 leading-relaxed whitespace-pre-wrap">{series.description}</p>
        )}
        <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {stories.map((s, i) => (
            <StoryCard key={s.id} story={s} badge={`เรื่องที่ ${i + 1}`} />
          ))}
        </div>
      </div>
    </main>
  );
}
