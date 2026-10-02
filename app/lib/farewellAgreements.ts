// app/lib/farewellAgreements.ts — ข้อตกลงงานศพปลอดเหล้าในพื้นที่ของผู้ใช้ (หน้า /farewell สาธารณะ ไม่ต้อง login)
// ใช้ข้อมูลงานประเด็นย่อย "งานศพปลอดเหล้า" + ตาราง ActivityPolicy
// กติกาสาธารณะเดียวกับแผนที่โหมดสาธารณะ: เห็นชื่องาน + ตำบล/อำเภอ/จังหวัด ไม่มีชื่อสถานที่/ผู้ประสานงาน/พิกัด
// ชื่อนโยบายเปิดเฉพาะงานที่เผยแพร่แล้ว (เหมือน STORY_SELECT) ส่วนระดับ/ประเภท/ปีเป็นข้อมูลเชิงโครงสร้าง เปิดได้
import prisma from '@/app/lib/db';
import { POLICY_LABEL, POLICY_LEVELS } from '@/app/lib/activityMeta';
import { getTambonCoords } from '@/app/lib/tambonCoords';

export const FUNERAL_SUB = 'งานศพปลอดเหล้า';

export interface AreaQuery {
  district: string; // ตำบล
  amphoe: string;
  province: string;
}

/** ความใกล้ของงานกับพื้นที่ที่ผู้ใช้เลือก — ใช้จัดกลุ่มแสดงผล */
export type Closeness = 'here' | 'amphoe' | 'province';

export interface LocalAgreement {
  id: number;
  title: string;
  district: string;
  amphoe: string;
  province: string;
  closeness: Closeness;
  /** มีเรื่องเล่าเผยแพร่ที่ /stories/[id] */
  storyId: number | null;
  policies: { level: string; levelLabel: string; type: string | null; year: number | null; name: string | null }[];
}

const LEVEL_ORDER: string[] = POLICY_LEVELS.map((p) => p.value);

/**
 * งานศพปลอดเหล้าในจังหวัดเดียวกับพื้นที่ที่เลือก จัดกลุ่มเป็น
 *   here     — ตำบลเดียวกัน
 *   amphoe   — ตำบลอื่นในอำเภอเดียวกัน หรือข้อตกลงระดับอำเภอ
 *   province — ที่อื่นในจังหวัด (นับรวมข้อตกลงระดับจังหวัด)
 */
export async function getLocalAgreements(area: AreaQuery): Promise<LocalAgreement[]> {
  const rows = await prisma.activity.findMany({
    where: { subCategory: { name: FUNERAL_SUB }, province: area.province },
    select: {
      id: true,
      title: true,
      district: true,
      amphoe: true,
      province: true,
      isPublished: true,
      policies: { select: { level: true, type: true, year: true, name: true } },
    },
  });

  const rank: Record<Closeness, number> = { here: 0, amphoe: 1, province: 2 };
  return rows
    .map((a): LocalAgreement => {
      const closeness: Closeness =
        a.district === area.district && a.amphoe === area.amphoe
          ? 'here'
          : a.amphoe === area.amphoe
            ? 'amphoe'
            : 'province';
      return {
        id: a.id,
        title: a.title,
        district: a.district,
        amphoe: a.amphoe,
        province: a.province,
        closeness,
        storyId: a.isPublished ? a.id : null,
        policies: [...a.policies]
          .sort((x, y) => LEVEL_ORDER.indexOf(x.level) - LEVEL_ORDER.indexOf(y.level))
          .map((p) => ({
            level: p.level,
            levelLabel: POLICY_LABEL[p.level] ?? p.level,
            type: p.type,
            year: p.year,
            name: a.isPublished ? p.name : null,
          })),
      };
    })
    .sort((x, y) => rank[x.closeness] - rank[y.closeness] || x.district.localeCompare(y.district, 'th'));
}

// ── แผนที่ "เราทำกันจริง" (/farewell และ /farewell/journey) ─────────────────────────────
// ทุกพื้นที่ที่มีข้อตกลงงานศพปลอดเหล้าในระบบ — กติกาสาธารณะเดียวกับแผนที่โหมดสาธารณะ:
// หมุดที่จุดกลางตำบล (หมุดจริงไม่ออก), ไม่มีชื่อสถานที่/ผู้ประสานงาน/ชื่อนโยบายของงานที่ยังไม่เผยแพร่
export interface AgreementPoint {
  id: number;
  title: string;
  district: string;
  amphoe: string;
  province: string;
  lat: number;
  lng: number;
  levels: string[]; // ป้ายระดับ เช่น ["ตำบล"]
  storyId: number | null;
}

export interface AgreementMapData {
  points: AgreementPoint[];
  provinces: number;
  byRegion: { label: string; count: number }[]; // ภาคเหนือ / ภาคอีสาน / ภาคอื่น (เรียงมาก→น้อย)
}

const regionGroup = (zone: string) =>
  zone.startsWith('north-') ? 'ภาคเหนือ' : zone.startsWith('northeast-') ? 'ภาคอีสาน' : 'ภาคอื่น';

export async function getAgreementMapData(): Promise<AgreementMapData> {
  const rows = await prisma.activity.findMany({
    where: { subCategory: { name: FUNERAL_SUB }, policies: { some: {} } },
    select: {
      id: true,
      title: true,
      district: true,
      amphoe: true,
      province: true,
      region: true,
      latitude: true,
      longitude: true,
      locationSource: true,
      isPublished: true,
      policies: { select: { level: true } },
    },
    orderBy: { id: 'asc' },
  });

  const points: AgreementPoint[] = [];
  const regionCount = new Map<string, number>();
  for (const a of rows) {
    // หมุดจริงอาจเป็นบ้านคน → ใช้จุดกลางตำบลแทน (เหมือน app/map/page.tsx โหมดสาธารณะ)
    const c =
      a.locationSource === 'TAMBON' && a.latitude != null && a.longitude != null
        ? { lat: a.latitude, lng: a.longitude }
        : getTambonCoords(a.district, a.amphoe, a.province);
    if (!c) continue;
    points.push({
      id: a.id,
      title: a.title,
      district: a.district,
      amphoe: a.amphoe,
      province: a.province,
      lat: c.lat,
      lng: c.lng,
      levels: [...new Set(a.policies.map((p) => p.level))]
        .sort((x, y) => LEVEL_ORDER.indexOf(x) - LEVEL_ORDER.indexOf(y))
        .map((l) => POLICY_LABEL[l] ?? l),
      storyId: a.isPublished ? a.id : null,
    });
    const g = regionGroup(a.region);
    regionCount.set(g, (regionCount.get(g) ?? 0) + 1);
  }
  return {
    points,
    provinces: new Set(points.map((p) => p.province)).size,
    byRegion: [...regionCount].map(([label, count]) => ({ label, count })).sort((x, y) => y.count - x.count),
  };
}
