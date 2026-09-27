import Link from 'next/link';
import { UserCheck, User, Home, HeartHandshake } from 'lucide-react';

interface QuickActionsProps {
  isAdmin: boolean;
}

interface Action {
  title: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  requireAdmin?: boolean;
}

interface Group {
  label: string;
  sub: string;
  accent: string;       // text + icon color
  ring: string;         // hover border color
  iconBg: string;       // icon circle bg
  actions: Action[];
}

export default function QuickActions({ isAdmin }: QuickActionsProps) {
  const groups: Group[] = [
    {
      label: 'จัดการระบบ',
      sub: 'เมนูหลัก',
      accent: 'text-orange-600',
      ring: 'hover:border-orange-300',
      iconBg: 'bg-orange-50',
      actions: [
        { title: 'จัดการผู้ดูแลระบบ', description: 'ตั้งค่าสิทธิ์ผู้ใช้และผู้ดูแลระบบ', href: '/dashboard/setting/admin', icon: UserCheck, requireAdmin: true },
        { title: 'โปรไฟล์ของฉัน', description: 'ดูข้อมูลบัญชีผู้ใช้ของคุณ', href: '/profile', icon: User },
      ],
    },
    {
      label: 'เว็บไซต์',
      sub: 'หน้าสาธารณะ',
      accent: 'text-orange-600',
      ring: 'hover:border-orange-300',
      iconBg: 'bg-orange-50',
      actions: [
        { title: 'หน้าหลักเว็บไซต์', description: 'กลับไปยังหน้าแรกของ Stop Drink Network', href: '/', icon: Home },
        { title: 'สมัครสมาชิกใหม่', description: 'เพิ่มสมาชิกเข้าร่วมเครือข่ายงดเหล้า', href: '/auth/signup', icon: HeartHandshake },
      ],
    },
  ];

  return (
    <div className="space-y-7">
      {groups.map((group) => {
        const actions = group.actions.filter(a => !a.requireAdmin || isAdmin);
        if (actions.length === 0) return null;

        return (
          <div key={group.label}>
            <div className="flex items-baseline gap-2 mb-3 px-1">
              <h2 className="text-sm font-semibold text-gray-800">{group.label}</h2>
              <span className="text-xs text-gray-400">· {group.sub}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {actions.map((action) => {
                const Icon = action.icon;
                return (
                  <Link
                    key={action.href}
                    href={action.href}
                    className={`group relative bg-white rounded-2xl border border-orange-100 p-5 transition-all hover:shadow-md ${group.ring} active:scale-[0.99]`}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className={`w-10 h-10 rounded-xl ${group.iconBg} flex items-center justify-center`}>
                        <Icon className={`w-5 h-5 ${group.accent}`} />
                      </div>
                    </div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-0.5">{action.title}</h3>
                    <p className="text-xs text-gray-400 leading-relaxed">{action.description}</p>
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
