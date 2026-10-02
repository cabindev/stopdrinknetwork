// app/stories/[id]/page.tsx — หน้ากรณีศึกษาสาธารณะ (ไม่ต้อง login) แบบ "ทำตามได้"
// บริบท → กระบวนการ → นโยบาย/กติกา (ไฟล์ดาวน์โหลด) → ผลลัพธ์ → ปัจจัยสำเร็จ · แกลเลอรี · แชร์
// ข้อมูลจาก STORY_SELECT เท่านั้น (ไม่มีชื่อเจ้าหน้าที่/ผู้ประสานงาน/เบอร์/หมุดจริง)
// งานที่ยังไม่เผยแพร่: แอดมินดูตัวอย่างได้ (มีแถบเตือน) คนอื่นได้ 404
import ImageGallery from '@/app/components/ImageGallery';
import LinkList from '@/app/components/LinkList';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getServerSession } from 'next-auth/next';
import { ArrowLeft, MapPin, CalendarDays, FileText, Download, Users, Home, UserRound, Handshake, EyeOff, Link2 } from 'lucide-react';
import authOptions from '@/app/lib/configs/auth/authOptions';
import prisma from '@/app/lib/db';
import { STORY_SELECT, storyCover, storyExcerpt, storyPlace, publicFileUrl, storyLogoUrl } from '@/app/lib/story';
import {
  parsePartners,
  policyShape,
  policyDetailText,
  formatStartDate,
  POLICY_LABEL,
} from '@/app/lib/activityMeta';
import { getRegionLabel } from '@/app/utils/healthZones';
import type { HealthZone } from '@/app/utils/healthZones';
import ShareButtons from '../ShareButtons';

async function loadStory(idRaw: string) {
  const id = Number(idRaw);
  if (!Number.isInteger(id)) return null;
  const story = await prisma.activity.findUnique({ where: { id }, select: { ...STORY_SELECT, isPublished: true } });
  if (!story) return null;
  if (story.isPublished) return { story, preview: false };
  const session = await getServerSession(authOptions);
  return ['admin', 'superadmin'].includes(session?.user?.role ?? '') ? { story, preview: true } : null;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const found = await loadStory((await params).id);
  if (!found || found.preview) return { title: 'กรณีศึกษา — Stop Drink Network' };
  const { story } = found;
  const cover = storyCover(story);
  return {
    title: `${story.title} — กรณีศึกษา Stop Drink Network`,
    description: storyExcerpt(story, 200),
    openGraph: {
      title: story.title,
      description: storyExcerpt(story, 200),
      type: 'article',
      ...(cover && { images: [{ url: publicFileUrl(cover.id, 'cover'), width: 1280, height: 720 }] }),
    },
  };
}

const fmtNum = (n: number) => n.toLocaleString('th-TH');

export default async function StoryPage({ params }: { params: Promise<{ id: string }> }) {
  const found = await loadStory((await params).id);
  if (!found) notFound();
  const { story, preview } = found;

  // ตัวอย่างของแอดมิน (ยังไม่เผยแพร่) → /api/public-files ยังไม่ให้ไฟล์ จึงดึงผ่าน /api/files (ต้อง login) แทน
  const fileSrc = async (id: number, v?: 'card' | 'cover') => {
    if (!preview) return publicFileUrl(id, v);
    const f = await prisma.activityAttachment.findUnique({ where: { id }, select: { filePath: true } });
    return f ? `/api/files/${f.filePath}` : '';
  };
  const cover = storyCover(story);
  const coverSrc = cover ? await fileSrc(cover.id, 'cover') : null;
  const images = await Promise.all(
    story.attachments
      .filter((a) => a.kind === 'IMAGE' && !a.policyLevel && !a.isSurvey)
      .map(async (a) => ({ ...a, src: await fileSrc(a.id, 'cover'), full: await fileSrc(a.id) }))
  );
  const { levels, details } = policyShape(story.policies);
  const policyFiles = await Promise.all(
    story.attachments.filter((a) => a.kind === 'DOCUMENT' || a.policyLevel || a.isSurvey).map(async (a) => ({ ...a, src: await fileSrc(a.id) }))
  );
  const partners = parsePartners(story.partners);
  const stats = [
    story.coverageVillages != null && { icon: Home, value: fmtNum(story.coverageVillages), label: 'หมู่บ้าน' },
    story.coverageHouseholds != null && { icon: Home, value: fmtNum(story.coverageHouseholds), label: 'ครัวเรือน' },
    story.coveragePopulation != null && { icon: Users, value: fmtNum(story.coveragePopulation), label: 'ประชากร' },
    story.participantCount != null && { icon: UserRound, value: fmtNum(story.participantCount), label: 'ผู้เข้าร่วม' },
  ].filter(Boolean) as { icon: typeof Home; value: string; label: string }[];
  const started = formatStartDate(story.startDate, story.startDatePrecision);

  const related = await prisma.activity.findMany({
    where: {
      isPublished: true,
      id: { not: story.id },
      ...(story.subCategory ? { subCategory: { name: story.subCategory.name } } : { category: { name: story.category.name } }),
    },
    select: STORY_SELECT,
    orderBy: { publishedAt: 'desc' },
    take: 3,
  });

  const lead = story.storyLead || story.description;
  const section = 'mt-8';
  const h2 = 'text-lg font-bold text-gray-800 mb-3 flex items-center gap-2';
  const num = 'flex w-7 h-7 rounded-full bg-orange-600 text-white text-sm font-bold items-center justify-center shrink-0';

  return (
    <main className="min-h-screen bg-white pt-20 pb-16 px-4">
      <article className="max-w-3xl mx-auto">
        {preview && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
            <EyeOff className="w-4 h-4 shrink-0" />
            ตัวอย่างสำหรับแอดมิน — ยังไม่เผยแพร่ คนทั่วไปยังเปิดหน้านี้ไม่ได้
            <Link href={`/activity/${story.id}/publish`} className="ml-auto font-medium underline">
              กลับไปแก้/เผยแพร่
            </Link>
          </div>
        )}
        <Link href="/stories" className="inline-flex items-center gap-1.5 text-sm text-orange-700 hover:text-orange-800 mb-5">
          <ArrowLeft className="w-4 h-4" /> กรณีศึกษาทั้งหมด
        </Link>

        <p className="text-xs font-medium text-orange-700">
          {story.category.name}
          {story.subCategory && <> › {story.subCategory.name}</>}
        </p>
        <h1 className="mt-1 text-2xl sm:text-3xl font-bold text-gray-900 leading-snug">{story.title}</h1>
        <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-orange-600" /> {storyPlace(story)} · {getRegionLabel(story.region as HealthZone)}
            {story.areas.length > 0 && <span className="text-orange-700">· และอีก {story.areas.length} พื้นที่</span>}
          </span>
          {started && (
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="w-4 h-4 text-orange-600" /> เริ่ม{started}
            </span>
          )}
        </p>

        {coverSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverSrc} alt={cover?.caption || story.title} className="mt-6 w-full aspect-video object-cover rounded-2xl border border-orange-100 bg-orange-50" />
        ) : (
          storyLogoUrl(story) && (
            // ยังไม่มีรูปเปิดเผย → โลโก้ประเด็นกลางกรอบ (เตี้ยกว่า 16:9 ไม่ให้ที่ว่างเยอะเกิน)
            <div className="mt-6 w-full aspect-[21/9] rounded-2xl border border-orange-100 bg-orange-50 flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={storyLogoUrl(story)!}
                alt={story.subCategory?.name ?? story.category.name}
                className="h-1/2 aspect-square object-contain rounded-full bg-white p-4 shadow-sm"
              />
            </div>
          )
        )}

        {stats.length > 0 && (
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {stats.map((s) => (
              <div key={s.label} className="rounded-2xl border border-orange-100 bg-orange-50/50 p-4 text-center">
                <p className="text-2xl font-bold text-orange-700">{s.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        <section className={section}>
          <h2 className={h2}><span className={num}>1</span> บริบทและที่มา</h2>
          <p className="text-[15px] text-gray-700 leading-relaxed whitespace-pre-wrap">{lead}</p>
        </section>

        {/* พื้นที่ที่เกี่ยวข้อง — ระดับตำบล ไม่มีพิกัด (STORY_SELECT) */}
        {story.areas.length > 0 && (
          <section className={section}>
            <h2 className={h2}><MapPin className="w-5 h-5 text-orange-600" /> พื้นที่ที่เกี่ยวข้อง</h2>
            <ul className="grid sm:grid-cols-2 gap-3">
              {story.areas.map((a) => (
                <li key={a.id} className="rounded-xl border border-orange-100 bg-orange-50/40 p-3">
                  <p className="text-sm font-medium text-gray-800">{a.areaName || `ต.${a.district}`}</p>
                  <p className="text-xs text-gray-500">ต.{a.district} อ.{a.amphoe} จ.{a.province}</p>
                  {a.note && <p className="mt-1 text-sm text-gray-700">{a.note}</p>}
                </li>
              ))}
            </ul>
          </section>
        )}

        {story.storyProcess && (
          <section className={section}>
            <h2 className={h2}><span className={num}>2</span> กระบวนการ — ทำอย่างไร</h2>
            <p className="text-[15px] text-gray-700 leading-relaxed whitespace-pre-wrap">{story.storyProcess}</p>
          </section>
        )}

        {(levels.length > 0 || policyFiles.length > 0) && (
          <section className={section}>
            <h2 className={h2}><span className={num}>{story.storyProcess ? 3 : 2}</span> นโยบาย / กติกาที่เกิดขึ้น</h2>
            <ul className="space-y-2">
              {levels.map((l) => (
                <li key={l} className="flex flex-wrap items-start gap-2 rounded-xl border border-orange-100 p-3">
                  <span className="shrink-0 px-2.5 py-0.5 rounded-full bg-orange-600 text-white text-xs font-medium">
                    ระดับ{POLICY_LABEL[l]}
                  </span>
                  <span className="text-sm text-gray-800">{policyDetailText(details[l]) || 'มีนโยบาย/ข้อตกลง'}</span>
                </li>
              ))}
            </ul>
            {policyFiles.length > 0 && (
              <div className="mt-3">
                <p className="text-xs text-gray-500 mb-2">ดาวน์โหลดตัวกติกา/เอกสาร ไปปรับใช้ในพื้นที่ของคุณ</p>
                <ul className="space-y-2">
                  {policyFiles.map((f) => (
                    <li key={f.id}>
                      <a
                        href={f.src}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border border-orange-100 hover:bg-orange-50"
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <FileText className="w-4 h-4 text-orange-600 shrink-0" />
                          <span className="text-sm text-gray-700 truncate">{f.fileName}</span>
                        </span>
                        <Download className="w-4 h-4 text-gray-400 shrink-0" />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        {story.links.length > 0 && (
          <section className={section}>
            <h2 className={h2}><Link2 className="w-5 h-5 text-orange-600" /> ติดตามเพิ่มเติม</h2>
            <LinkList links={story.links} />
          </section>
        )}

        {partners.length > 0 && (
          <section className={section}>
            <h2 className={h2}><Handshake className="w-5 h-5 text-orange-600" /> ภาคีที่ร่วมขับเคลื่อน</h2>
            <div className="flex flex-wrap gap-1.5">
              {partners.map((p) => (
                <span key={p} className="px-3 py-1 rounded-full bg-orange-50 border border-orange-100 text-sm text-gray-700">{p}</span>
              ))}
            </div>
          </section>
        )}

        {story.storyLessons && (
          <section className={`${section} rounded-2xl bg-orange-50/60 border border-orange-100 p-5`}>
            <h2 className={h2}>💡 ปัจจัยสำเร็จ / ข้อควรระวัง</h2>
            <p className="text-[15px] text-gray-700 leading-relaxed whitespace-pre-wrap">{story.storyLessons}</p>
          </section>
        )}

        {images.length > (cover ? 1 : 0) && (
          <section className={section}>
            <h2 className={h2}>ภาพกิจกรรม</h2>
            {/* กริดใช้รูป 16:9 · คลิก = พรีวิวเต็มจอด้วยรูปเต็มไม่ตัด */}
            <ImageGallery
              thumbClassName="w-full aspect-video object-cover"
              images={images.map((img) => ({
                id: img.id,
                thumb: img.src,
                full: img.full,
                alt: img.caption || story.title,
                caption: img.caption,
              }))}
            />
          </section>
        )}

        <section className={`${section} pt-6 border-t border-orange-100 flex flex-wrap items-center justify-between gap-3`}>
          <p className="text-sm text-gray-600">
            สนใจทำในพื้นที่ของคุณ? <Link href="/auth/signup" className="font-medium text-orange-700 underline">เข้าร่วมเครือข่ายงดเหล้า</Link>
          </p>
          {!preview && <ShareButtons title={story.title} />}
        </section>

        {related.length > 0 && (
          <section className="mt-10">
            <h2 className="text-base font-bold text-gray-800 mb-3">กรณีศึกษาใกล้เคียง</h2>
            <div className="grid sm:grid-cols-3 gap-3">
              {related.map((r) => (
                <Link key={r.id} href={`/stories/${r.id}`} className="block rounded-xl border border-orange-100 p-3 hover:border-orange-300">
                  <p className="text-sm font-medium text-gray-800 line-clamp-2">{r.title}</p>
                  <p className="mt-1 text-xs text-gray-500">จ.{r.province}</p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </article>
    </main>
  );
}
