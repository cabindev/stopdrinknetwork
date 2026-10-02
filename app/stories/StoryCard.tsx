// app/stories/StoryCard.tsx — การ์ดกรณีศึกษา (ใช้ในหน้ารวม /stories และหน้าชุด /stories/series/[id])
// รับเฉพาะข้อมูลจาก STORY_SELECT · badge = ป้ายลำดับในชุด (เช่น "เรื่องที่ 2")
import Link from 'next/link';
import { BookOpen, MapPin } from 'lucide-react';
import { storyCover, storyExcerpt, storyPlace, publicFileUrl, storyLogoUrl } from '@/app/lib/story';
import type { StoryRow } from '@/app/lib/story';
import { formatStartDate } from '@/app/lib/activityMeta';

export default function StoryCard({ story: s, badge }: { story: StoryRow; badge?: string }) {
  const cover = storyCover(s);
  const started = formatStartDate(s.startDate, s.startDatePrecision);
  return (
    <Link
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
        <p className="text-[11px] font-medium text-orange-700">
          {badge && <span className="mr-1.5 px-1.5 py-0.5 rounded bg-orange-600 text-white">{badge}</span>}
          {s.subCategory?.name ?? s.category.name}
        </p>
        <h2 className="mt-1 text-sm font-semibold text-gray-800 line-clamp-2 group-hover:text-orange-700">{s.title}</h2>
        <p className="mt-2 text-xs text-gray-500 line-clamp-3">{storyExcerpt(s, 140)}</p>
        <p className="mt-auto pt-3 flex items-center gap-1 text-[11px] text-gray-400">
          <MapPin className="w-3 h-3" /> {storyPlace(s)}
          {started && <> · เริ่ม{started}</>}
        </p>
      </div>
    </Link>
  );
}
