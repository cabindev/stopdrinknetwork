// ไอคอนตามชนิดลิงก์ — ใช้ร่วมฟอร์ม/หน้ารายละเอียด/กรณีศึกษา (server หรือ client ก็ได้ ไม่มี state)
import { Facebook, Youtube, Music2, FolderOpen, Globe } from 'lucide-react';
import type { LinkKindValue } from '@/app/lib/activityLinks';

const ICON = { FACEBOOK: Facebook, YOUTUBE: Youtube, TIKTOK: Music2, DRIVE: FolderOpen, WEB: Globe } as const;
// สีโทนส้ม-ดำตามธีม (ไม่ใช้สีแบรนด์) — แยกชนิดด้วยรูปไอคอนพอ
export default function LinkKindIcon({ kind, className = 'w-4 h-4' }: { kind: string; className?: string }) {
  const Icon = ICON[kind as LinkKindValue] ?? Globe;
  return <Icon className={className} aria-hidden />;
}
