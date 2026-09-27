// รายการลิงก์ภายนอกของงาน — ใช้ทั้งหน้ารายละเอียด (ต้อง login) และหน้ากรณีศึกษาสาธารณะ
// URL ผ่าน normalizeUrl ตอนบันทึกแล้ว (http/https เท่านั้น) · เปิดแท็บใหม่ + noopener
import { ExternalLink } from 'lucide-react';
import LinkKindIcon from '@/app/components/LinkKindIcon';
import { LINK_KIND_LABEL, linkDisplayName } from '@/app/lib/activityLinks';
import type { LinkKindValue } from '@/app/lib/activityLinks';

export interface LinkRow {
  id: number;
  url: string;
  title: string | null;
  kind: string;
}

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};

export default function LinkList({ links }: { links: LinkRow[] }) {
  return (
    <ul className="space-y-2" data-testid="activity-links">
      {links.map((l) => (
        <li key={l.id}>
          <a
            href={l.url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border border-orange-100 hover:bg-orange-50 transition-colors"
          >
            <span className="flex items-center gap-2 min-w-0">
              <span className="text-orange-600 shrink-0">
                <LinkKindIcon kind={l.kind} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm text-gray-700 truncate">{linkDisplayName(l.url, l.title)}</span>
                <span className="block text-[11px] text-gray-400 truncate">
                  {LINK_KIND_LABEL[l.kind as LinkKindValue] ?? 'เว็บไซต์'} · {hostOf(l.url)}
                </span>
              </span>
            </span>
            <ExternalLink className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          </a>
        </li>
      ))}
    </ul>
  );
}
