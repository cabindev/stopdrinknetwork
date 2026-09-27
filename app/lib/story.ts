// app/lib/story.ts — ข้อมูลสำหรับหน้าเผยแพร่สาธารณะ (/stories) ไม่ต้อง login
// ⚠️ ใช้ STORY_SELECT เท่านั้นเวลา query ให้หน้าสาธารณะ — ห้าม include user/ผู้ประสานงาน/พิกัด/ไฟล์ที่ไม่ public
//    (หน้าสาธารณะ = ตำแหน่งแค่ตำบล, ไม่มีชื่อเจ้าหน้าที่/ผู้ประสานงาน/เบอร์ — ตามแผน activity-data-roadmap)
import type { Prisma } from '@prisma/client';

export const STORY_SELECT = {
  id: true,
  title: true,
  description: true,
  storyLead: true,
  storyProcess: true,
  storyLessons: true,
  publishedAt: true,
  areaName: true,
  district: true,
  amphoe: true,
  province: true,
  region: true,
  areaScope: true,
  status: true,
  startDate: true,
  startDatePrecision: true,
  participantCount: true,
  partners: true,
  policies: { select: { level: true, name: true, type: true, year: true } },
  coverageVillages: true,
  coverageHouseholds: true,
  coveragePopulation: true,
  category: { select: { id: true, name: true, logo: true } },
  subCategory: { select: { id: true, name: true, logo: true } },
  // ลิงก์เฉพาะที่แอดมินติ๊กให้เปิดเผย
  links: { where: { isPublic: true }, select: { id: true, url: true, title: true, kind: true }, orderBy: { sortOrder: 'asc' } },
  attachments: {
    where: { isPublic: true },
    select: { id: true, kind: true, fileName: true, caption: true, isCover: true, policyLevel: true, size: true },
    orderBy: { id: 'asc' },
  },
} satisfies Prisma.ActivitySelect;

export type StoryRow = Prisma.ActivityGetPayload<{ select: typeof STORY_SELECT }>;

// v: รูปตัดขอบ + ครอบ 16:9 (card 640×360 · cover 1280×720) — ไม่ใส่ = ไฟล์ต้นฉบับ (เอกสาร/ดูรูปเต็ม)
export const publicFileUrl = (attachmentId: number, v?: 'card' | 'cover') =>
  `/api/public-files/${attachmentId}${v ? `?v=${v}` : ''}`;

// รูปปกสาธารณะ: รูป public ที่เป็นปก → รูป public รูปแรก
export function storyCover(s: Pick<StoryRow, 'attachments'>) {
  const imgs = s.attachments.filter((a) => a.kind === 'IMAGE' && !a.policyLevel);
  return imgs.find((a) => a.isCover) ?? imgs[0] ?? null;
}

// โลโก้แทนรูปปก (ยังไม่มีรูปเปิดเผย): ประเด็นย่อย → ประเด็นหลัก → null (ไอคอน)
// logo ใส่ใน URL เป็น ?v= เพื่อให้ cache ของ browser เปลี่ยนตามเมื่อแอดมินเปลี่ยนโลโก้
export function storyLogoUrl(s: Pick<StoryRow, 'category' | 'subCategory'>) {
  if (s.subCategory?.logo) return `/api/public-logo/sub/${s.subCategory.id}?v=${encodeURIComponent(s.subCategory.logo.split('/').pop()!)}`;
  if (s.category.logo) return `/api/public-logo/category/${s.category.id}?v=${encodeURIComponent(s.category.logo.split('/').pop()!)}`;
  return null;
}

// ย่อหน้าแรกสำหรับการ์ด/คำอธิบายตอนแชร์
export function storyExcerpt(s: Pick<StoryRow, 'storyLead' | 'description'>, max = 160) {
  const text = (s.storyLead || s.description).replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export const storyPlace = (s: Pick<StoryRow, 'areaName' | 'district' | 'amphoe' | 'province' | 'areaScope'>) =>
  s.areaScope === 'PROVINCE'
    ? `ทั้ง จ.${s.province}`
    : s.areaScope === 'DISTRICT'
      ? `ทั้ง อ.${s.amphoe} จ.${s.province}`
      : [s.areaName, `ต.${s.district} อ.${s.amphoe} จ.${s.province}`].filter(Boolean).join(' · ');
