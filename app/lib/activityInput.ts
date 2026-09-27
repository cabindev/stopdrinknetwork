// app/lib/activityInput.ts — อ่าน/ตรวจข้อมูลส่วนขยายของงานจาก formData (ใช้ร่วม POST/PATCH)
// ประเด็นย่อย · ผู้เข้าร่วม · ภาคี · ผู้ประสานงาน · คำบรรยาย/ปกรูป
import prisma from '@/app/lib/db';
import { MAX_IMAGES, parsePartners, parsePolicyLevels, parsePolicyDetails, POLICY_LEVELS, POLICY_LABEL, AREA_SCOPES } from '@/app/lib/activityMeta';
import type { AreaScopeValue, PolicyDetail } from '@/app/lib/activityMeta';
import type { PolicyLevelValue } from '@/app/lib/activityMeta';
import { parseLinkList } from '@/app/lib/activityLinks';
import { DOC_TYPES, IMAGE_TYPES, MAX_FILE_SIZE, filesFrom } from '@/app/lib/activityFiles';

const str = (fd: FormData, k: string, max: number) =>
  String(fd.get(k) ?? '').trim().slice(0, max) || null;

export async function parseActivityExtras(
  fd: FormData,
  categoryId: number,
  currentSubCategoryId: number | null = null
) {
  // ประเด็นย่อย: ต้องอยู่ใต้ประเด็นที่เลือก และเปิดใช้ (ยกเว้นค่าเดิมของงานที่ถูกปิดภายหลัง — แก้งานอื่นได้โดยไม่ต้องเปลี่ยน)
  const subRaw = String(fd.get('subCategoryId') ?? '').trim();
  let subCategoryId: number | null = null;
  if (subRaw) {
    const sub = await prisma.workSubCategory.findUnique({ where: { id: Number(subRaw) } });
    if (!sub || sub.categoryId !== categoryId || (!sub.isActive && sub.id !== currentSubCategoryId)) {
      return { error: 'ประเด็นย่อยไม่ตรงกับประเด็นงานที่เลือก' } as const;
    }
    subCategoryId = sub.id;
  }

  const pcRaw = String(fd.get('participantCount') ?? '').trim();
  let participantCount: number | null = null;
  if (pcRaw) {
    const n = Number(pcRaw);
    if (!Number.isInteger(n) || n < 0 || n > 10_000_000) {
      return { error: 'จำนวนผู้เข้าร่วมต้องเป็นจำนวนเต็มไม่ติดลบ' } as const;
    }
    participantCount = n;
  }

  let partners: string[] = [];
  try {
    partners = parsePartners(JSON.parse(String(fd.get('partners') ?? '[]')));
  } catch {
    partners = [];
  }

  let policyLevels: PolicyLevelValue[] = [];
  try {
    policyLevels = parsePolicyLevels(JSON.parse(String(fd.get('policyLevels') ?? '[]')));
  } catch {
    policyLevels = [];
  }

  let policyDetails: Record<string, PolicyDetail> = {};
  try {
    policyDetails = parsePolicyDetails(JSON.parse(String(fd.get('policyDetails') ?? '{}')), policyLevels);
  } catch {
    policyDetails = {};
  }

  // ขอบเขตพื้นที่ + ตัวเลขความครอบคลุม
  const scopeRaw = String(fd.get('areaScope') ?? 'SUBDISTRICT');
  const areaScope: AreaScopeValue = AREA_SCOPES.some((a) => a.value === scopeRaw)
    ? (scopeRaw as AreaScopeValue)
    : 'SUBDISTRICT';
  const intField = (k: string, label: string) => {
    const raw = String(fd.get(k) ?? '').trim().replace(/,/g, '');
    if (!raw) return { value: null };
    const n = Number(raw);
    return Number.isInteger(n) && n >= 0 && n <= 100_000_000 ? { value: n } : { error: `${label}ต้องเป็นจำนวนเต็มไม่ติดลบ` };
  };
  const cv = intField('coverageVillages', 'จำนวนหมู่บ้าน');
  const ch = intField('coverageHouseholds', 'จำนวนครัวเรือน');
  const cp = intField('coveragePopulation', 'จำนวนประชากร');
  for (const c of [cv, ch, cp]) if ('error' in c) return { error: c.error } as const;

  // วันเริ่มแบบ "รู้แค่ปี": startYear เป็น พ.ศ. → เก็บ 1 ม.ค. ของปีนั้น
  const precision = String(fd.get('startDatePrecision') ?? 'DAY') === 'YEAR' ? 'YEAR' : 'DAY';
  let startYearDate: Date | null = null;
  if (precision === 'YEAR') {
    const be = Number(fd.get('startYear'));
    if (!Number.isInteger(be) || be < 2400 || be > 2700) return { error: 'ปีที่เริ่มไม่ถูกต้อง (ใช้ปี พ.ศ.)' } as const;
    // UTC เหมือนวันที่อื่นในระบบ (ThaiDateField ส่ง 'YYYY-MM-DD' = เที่ยงคืน UTC) — ถ้าใช้เวลาท้องถิ่น
    // 1 ม.ค. 00:00 +07 = 31 ธ.ค. UTC แล้วหน้าแก้ไขอ่านปีถอยไป 1 ปี
    startYearDate = new Date(Date.UTC(be - 543, 0, 1));
  }

  const coordinatorName = str(fd, 'coordinatorName', 120);
  const coordinatorRole = str(fd, 'coordinatorRole', 120);
  const coordinatorPhone = str(fd, 'coordinatorPhone', 40);
  const coordinatorLine = str(fd, 'coordinatorLine', 80);
  const coordinatorConsent = fd.get('coordinatorConsent') === 'true';
  if (coordinatorPhone && !/^[0-9+\-\s()]{9,20}$/.test(coordinatorPhone)) {
    return { error: 'เบอร์ผู้ประสานงานไม่ถูกต้อง' } as const;
  }
  if ((coordinatorPhone || coordinatorLine) && !coordinatorConsent) {
    return { error: 'กรุณายืนยันว่าผู้ประสานงานยินยอมให้บันทึกช่องทางติดต่อ' } as const;
  }

  return {
    data: {
      subCategoryId,
      participantCount,
      partners,
      areaScope,
      coverageVillages: cv.value ?? null,
      coverageHouseholds: ch.value ?? null,
      coveragePopulation: cp.value ?? null,
      startDatePrecision: precision as 'DAY' | 'YEAR',
      coordinatorName,
      coordinatorRole,
      coordinatorPhone,
      coordinatorLine,
      coordinatorConsent: coordinatorPhone || coordinatorLine ? coordinatorConsent : false,
    },
    startYearDate,
    policyLevels,
    // แถวสำหรับ ActivityPolicy (1 แถว/ระดับที่ติ๊ก)
    policies: policyLevels.map((level) => ({
      level,
      name: policyDetails[level]?.name ?? null,
      type: policyDetails[level]?.type ?? null,
      year: policyDetails[level]?.year ?? null,
    })),
    policyDetails,
  } as const;
}

// จำนวนรูปหลังบันทึกต้องไม่เกิน MAX_IMAGES (รวมรูปเดิมที่ไม่ได้ลบ)
export function imageLimitError(keptExisting: number, newImages: number) {
  const total = keptExisting + newImages;
  return total > MAX_IMAGES ? `แนบรูปได้ไม่เกิน ${MAX_IMAGES} รูปต่องาน (ตอนนี้ ${total} รูป)` : null;
}

// คำบรรยาย + รูปปก หลังบันทึกไฟล์แล้ว
//   imageCaptions: JSON string[] เรียงตามรูปใหม่ · existingCaptions: JSON {id: caption}
//   cover: "new:<index>" | "existing:<id>" — ไม่ระบุ/ชี้ไม่เจอ → รูปแรกของงานเป็นปก
export async function applyImageMeta(activityId: number, fd: FormData, newImageIds: number[]) {
  const parse = <T,>(k: string, fallback: T): T => {
    try {
      return JSON.parse(String(fd.get(k) ?? '')) as T;
    } catch {
      return fallback;
    }
  };
  const captions = parse<unknown[]>('imageCaptions', []);
  const existing = parse<Record<string, unknown>>('existingCaptions', {});
  const clean = (v: unknown) => (typeof v === 'string' ? v.trim().slice(0, 200) || null : null);

  const images = await prisma.activityAttachment.findMany({
    where: { activityId, kind: 'IMAGE', policyLevel: null },
    orderBy: { id: 'asc' },
  });
  const ids = new Set(images.map((i) => i.id));

  for (const [i, id] of newImageIds.entries()) {
    await prisma.activityAttachment.update({ where: { id }, data: { caption: clean(captions[i]) } });
  }
  for (const [id, cap] of Object.entries(existing)) {
    if (ids.has(Number(id))) {
      await prisma.activityAttachment.update({ where: { id: Number(id) }, data: { caption: clean(cap) } });
    }
  }

  const cover = String(fd.get('cover') ?? '');
  let coverId: number | undefined;
  if (cover.startsWith('new:')) coverId = newImageIds[Number(cover.slice(4))];
  else if (cover.startsWith('existing:')) coverId = Number(cover.slice(9));
  if (!coverId || !ids.has(coverId)) coverId = images.find((i) => i.isCover)?.id ?? images[0]?.id;

  await prisma.activityAttachment.updateMany({ where: { activityId, kind: 'IMAGE', policyLevel: null }, data: { isCover: false } });
  if (coverId) await prisma.activityAttachment.update({ where: { id: coverId }, data: { isCover: true } });
}

// ไฟล์นโยบายรายระดับ: formData field `policy_<LEVEL>` (PDF/Word/Excel/PowerPoint หรือรูปถ่ายเอกสาร)
// รับเฉพาะระดับที่ติ๊กไว้ — ระดับที่ไม่ได้ติ๊กแต่มีไฟล์ติดมา ถือว่าผิด
export function policyFilesFrom(fd: FormData, levels: PolicyLevelValue[]) {
  const out: { level: PolicyLevelValue; file: File }[] = [];
  for (const { value } of POLICY_LEVELS) {
    for (const file of filesFrom(fd, `policy_${value}`)) out.push({ level: value, file });
  }
  for (const { level, file } of out) {
    if (!levels.includes(level)) return { error: `ไฟล์นโยบาย "${file.name}" อยู่ในระดับที่ไม่ได้ติ๊ก` } as const;
    if (![...DOC_TYPES, ...IMAGE_TYPES].includes(file.type)) {
      return { error: `ไฟล์นโยบาย${POLICY_LABEL[level]} "${file.name}" ต้องเป็น PDF, Word, Excel, PowerPoint หรือรูปภาพ` } as const;
    }
    if (file.size > MAX_FILE_SIZE) return { error: `ไฟล์ "${file.name}" เกิน 20MB` } as const;
  }
  return { files: out } as const;
}

// ทีมงานร่วมจาก formData `memberIds` (JSON number[]) — ไม่ส่งมา = ไม่แตะทีมเดิม (null)
// ตัดผู้เขียนออก (เป็นทีมอยู่แล้ว) · ต้องเป็นผู้ใช้ที่มีอยู่จริง · สูงสุด 20 คน
export const MAX_TEAM = 20;
export async function parseMemberIds(fd: FormData, ownerId: number) {
  const raw = fd.get('memberIds');
  if (raw === null) return { ids: null } as const;
  let list: number[] = [];
  try {
    const v = JSON.parse(String(raw));
    list = Array.isArray(v) ? v.map(Number).filter((n) => Number.isInteger(n) && n > 0) : [];
  } catch {
    return { error: 'รายชื่อทีมงานไม่ถูกต้อง' } as const;
  }
  const ids = [...new Set(list)].filter((id) => id !== ownerId);
  if (ids.length > MAX_TEAM) return { error: `ทีมงานร่วมได้ไม่เกิน ${MAX_TEAM} คน` } as const;
  const found = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true } });
  if (found.length !== ids.length) return { error: 'ไม่พบผู้ใช้บางคนในทีมงาน' } as const;
  return { ids } as const;
}

// ลิงก์ภายนอกจาก formData `links` (JSON [{url,title}]) — ไม่ส่งมา = ไม่แตะของเดิม (null)
export function parseLinksField(fd: FormData) {
  const raw = fd.get('links');
  if (raw === null) return { links: null } as const;
  let v: unknown;
  try {
    v = JSON.parse(String(raw));
  } catch {
    return { error: 'รายการลิงก์ไม่ถูกต้อง' } as const;
  }
  const r = parseLinkList(v);
  return 'error' in r ? ({ error: r.error } as const) : ({ links: r.links } as const);
}
