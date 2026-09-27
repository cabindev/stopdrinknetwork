// app/lib/activityLinks.ts — ลิงก์ภายนอกของงาน: ตรวจ URL + เดาชนิดจากโดเมน (ใช้ได้ทั้ง client/server)
export const MAX_LINKS = 10;
export const MAX_URL = 2000;
export const MAX_LINK_TITLE = 200;

export type LinkKindValue = 'FACEBOOK' | 'YOUTUBE' | 'TIKTOK' | 'DRIVE' | 'WEB';
export const LINK_KIND_LABEL: Record<LinkKindValue, string> = {
  FACEBOOK: 'Facebook',
  YOUTUBE: 'YouTube',
  TIKTOK: 'TikTok',
  DRIVE: 'Google Drive',
  WEB: 'เว็บไซต์',
};

export type LinkInput = { url: string; title: string };

// รับเฉพาะ http(s) — กัน javascript:/data: ที่จะกลายเป็น XSS ตอนแสดงเป็น <a href>
// ผู้ใช้มักวางแบบไม่มี scheme ("youtu.be/xxx") → เติม https:// ให้
export function normalizeUrl(raw: string): string | null {
  let s = raw.trim();
  if (!s) return null;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) s = `https://${s}`;
  try {
    const u = new URL(s);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    if (!u.hostname.includes('.')) return null;
    const out = u.toString();
    return out.length <= MAX_URL ? out : null;
  } catch {
    return null;
  }
}

export function detectLinkKind(url: string): LinkKindValue {
  let host = '';
  try {
    host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return 'WEB';
  }
  const is = (...d: string[]) => d.some((x) => host === x || host.endsWith(`.${x}`));
  if (is('facebook.com', 'fb.com', 'fb.watch', 'fb.me')) return 'FACEBOOK';
  if (is('youtube.com', 'youtu.be')) return 'YOUTUBE';
  if (is('tiktok.com')) return 'TIKTOK';
  if (is('drive.google.com', 'docs.google.com')) return 'DRIVE';
  return 'WEB';
}

// ชื่อที่แสดงเมื่อผู้ใช้ไม่ได้พิมพ์ title — โดเมนสั้น ๆ
export const linkDisplayName = (url: string, title?: string | null) => {
  if (title?.trim()) return title.trim();
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

// ตรวจรายการจากฟอร์ม → แถวสำหรับบันทึก (ตัดซ้ำ, เรียงตามลำดับที่ผู้ใช้ใส่)
export function parseLinkList(v: unknown): { links: (LinkInput & { kind: LinkKindValue })[] } | { error: string } {
  const list = Array.isArray(v) ? v : [];
  const out: (LinkInput & { kind: LinkKindValue })[] = [];
  const seen = new Set<string>();
  for (const item of list) {
    const rawUrl = typeof item?.url === 'string' ? item.url : '';
    if (!rawUrl.trim()) continue;
    const url = normalizeUrl(rawUrl);
    if (!url) return { error: `ลิงก์ไม่ถูกต้อง: ${rawUrl.slice(0, 80)} (ต้องขึ้นต้นด้วย http:// หรือ https://)` };
    if (seen.has(url)) continue;
    seen.add(url);
    const title = typeof item?.title === 'string' ? item.title.trim().slice(0, MAX_LINK_TITLE) : '';
    out.push({ url, title, kind: detectLinkKind(url) });
  }
  if (out.length > MAX_LINKS) return { error: `แนบลิงก์ได้ไม่เกิน ${MAX_LINKS} ลิงก์ต่องาน` };
  return { links: out };
}
