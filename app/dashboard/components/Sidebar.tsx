// app/dashboard/components/Sidebar.tsx
// Sidebar เมนูหลักของระบบ Stop Drink Network — โครงสร้างเดียวกับ buddhistlent
'use client'
import type { Session } from 'next-auth';
import ChanFlowerIcon from '@/app/farewell/components/ChanFlowerIcon';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { toast } from 'react-hot-toast';
import { useDashboard } from '../context/DashboardContext';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  User,
  LogOut,
  ChevronDown,
  Menu,
  PanelLeft,
  X,
  UserCheck,
  Settings,
  Home,
  Tags,
  Table2,
  Contact,
  History,
  Trash2,
} from 'lucide-react';

interface SidebarProps {
  user: Session['user'];
}

export default function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const { sidebarCollapsed, toggleSidebar, isMobileSidebarOpen, toggleMobileSidebar } = useDashboard();
  const [isSettingsMenuOpen, setIsSettingsMenuOpen] = useState(false);

  // เปิดเมนูอัตโนมัติตามหน้าที่กำลังเปิดอยู่
  useEffect(() => {
    if (pathname?.startsWith('/dashboard/setting')) {
      setIsSettingsMenuOpen(true);
    }
  }, [pathname]);

  // ปิด sidebar บนมือถือเมื่อเปลี่ยนหน้า
  useEffect(() => {
    if (isMobileSidebarOpen) {
      toggleMobileSidebar(false);
    }
  }, [pathname]);

  // เมนูสำหรับ Settings
  const settingsMenu = {
    name: 'Settings',
    href: '/dashboard/setting',
    icon: Settings,
    subMenus: [
      {
        name: 'จัดการผู้ดูแลระบบ',
        href: '/dashboard/setting/admin',
        icon: UserCheck,
        requireAdmin: true
      },
      {
        name: 'จัดการประเด็นงาน',
        href: '/dashboard/setting/categories',
        icon: Tags,
        requireAdmin: true
      },
      {
        name: 'รายชื่อเครือข่าย',
        href: '/dashboard/people',
        icon: Contact,
        requireAdmin: true
      },
      {
        name: 'ประวัติการเปลี่ยนแปลง',
        href: '/dashboard/setting/audit',
        icon: History,
        requireAdmin: true
      },
      {
        name: 'ถังขยะ',
        href: '/dashboard/setting/trash',
        icon: Trash2,
        requireAdmin: true
      }
    ]
  };

  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  return (
    <>
      {/* Overlay สำหรับกดปิด sidebar บนมือถือ */}
      {isMobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-30 lg:hidden"
          onClick={() => toggleMobileSidebar(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex flex-col bg-white border-r border-orange-100 transition-all duration-200",
          sidebarCollapsed ? "w-16" : "w-64",
          "lg:translate-x-0",
          isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Sidebar header */}
        <div className="flex h-14 items-center justify-between border-b border-orange-100 px-3 bg-orange-600">
          {!sidebarCollapsed ? (
            <div className="flex items-center">
              <Link href="/dashboard">
                <span className="text-sm font-extrabold text-white tracking-wide">SDN</span>
              </Link>
              <Link href="/" className="ml-2">
                <span className="text-white font-semibold text-sm tracking-wide">
                  STOP DRINK
                </span>
              </Link>
            </div>
          ) : (
            <Link href="/dashboard" className="mx-auto">
              <span className="text-sm font-extrabold text-white tracking-wide">SDN</span>
            </Link>
          )}

          {/* ปุ่มปิดบนมือถือ */}
          <button
            onClick={() => toggleMobileSidebar(false)}
            className="p-1.5 rounded text-white/80 hover:text-white hover:bg-white/15 lg:hidden"
            aria-label="ปิดเมนู"
          >
            <X className="h-4 w-4" />
          </button>

          {/* ปุ่มย่อ/ขยายบนจอใหญ่ */}
          <button
            onClick={toggleSidebar}
            className="p-1.5 rounded text-white/80 hover:text-white hover:bg-white/15 hidden lg:block"
            aria-label={sidebarCollapsed ? "ขยายเมนู" : "ย่อเมนู"}
          >
            {sidebarCollapsed ? (
              <Menu className="h-4 w-4" />
            ) : (
              <PanelLeft className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Sidebar menu */}
        <div className="flex-1 overflow-y-auto py-4">
          <div className="mt-2">
            {!sidebarCollapsed && (
              <h4 className="px-2 text-base text-center font-semibold text-orange-700 uppercase tracking-wide mb-2">
                ADMIN PANEL
              </h4>
            )}

            {/* Dashboard */}
            <div className="px-2 mb-2">
              <Link
                href="/dashboard"
                className={cn(
                  "group flex items-center w-full p-2 rounded-lg text-sm transition-colors focus:outline-none",
                  pathname === "/dashboard"
                    ? "bg-orange-50 text-orange-700"
                    : "text-gray-700 hover:bg-orange-50/60",
                  sidebarCollapsed && "justify-center"
                )}
                title={sidebarCollapsed ? "Dashboard" : ""}
              >
                <div
                  className={cn(
                    "flex items-center justify-center",
                    sidebarCollapsed ? "h-8 w-8" : "h-4 w-4"
                  )}
                >
                  <LayoutDashboard className={sidebarCollapsed ? "w-5 h-5" : "w-4 h-4"} />
                </div>
                {!sidebarCollapsed && (
                  <span className="ml-2 font-medium text-sm">Dashboard</span>
                )}
              </Link>
            </div>

            {/* งานทั้งหมด (แอดมิน) */}
            {isAdmin && (
              <div className="px-2 mb-2">
                <Link
                  href="/dashboard/activities"
                  className={cn(
                    "group flex items-center w-full p-2 rounded-lg text-sm transition-colors focus:outline-none",
                    pathname?.startsWith("/dashboard/activities")
                      ? "bg-orange-50 text-orange-700"
                      : "text-gray-700 hover:bg-orange-50/60",
                    sidebarCollapsed && "justify-center"
                  )}
                  title={sidebarCollapsed ? "งานทั้งหมด" : ""}
                >
                  <div
                    className={cn(
                      "flex items-center justify-center",
                      sidebarCollapsed ? "h-8 w-8" : "h-4 w-4"
                    )}
                  >
                    <Table2 className={sidebarCollapsed ? "w-5 h-5" : "w-4 h-4"} />
                  </div>
                  {!sidebarCollapsed && (
                    <span className="ml-2 font-medium text-sm">งานทั้งหมด</span>
                  )}
                </Link>
              </div>
            )}

            {/* สถิติส่งด้วยใจ (ไม่ระบุตัวตน) */}
            {isAdmin && (
              <div className="px-2 mb-2">
                <Link
                  href="/dashboard/farewell"
                  className={cn(
                    "group flex items-center w-full p-2 rounded-lg text-sm transition-colors focus:outline-none",
                    pathname?.startsWith("/dashboard/farewell")
                      ? "bg-orange-50 text-orange-700"
                      : "text-gray-700 hover:bg-orange-50/60",
                    sidebarCollapsed && "justify-center"
                  )}
                  title={sidebarCollapsed ? "สถิติส่งด้วยใจ" : ""}
                >
                  <div
                    className={cn(
                      "flex items-center justify-center",
                      sidebarCollapsed ? "h-8 w-8" : "h-4 w-4"
                    )}
                  >
                    <ChanFlowerIcon className={sidebarCollapsed ? "w-5 h-5" : "w-4 h-4"} />
                  </div>
                  {!sidebarCollapsed && (
                    <span className="ml-2 font-medium text-sm">สถิติส่งด้วยใจ</span>
                  )}
                </Link>
              </div>
            )}

            {/* Profile */}
            <div className="px-2 mb-2">
              <Link
                href="/profile"
                className={cn(
                  "group flex items-center w-full p-2 rounded-lg text-sm transition-colors focus:outline-none",
                  pathname === "/profile"
                    ? "bg-orange-50 text-orange-700"
                    : "text-gray-700 hover:bg-orange-50/60",
                  sidebarCollapsed && "justify-center"
                )}
                title={sidebarCollapsed ? "โปรไฟล์" : ""}
              >
                <div
                  className={cn(
                    "flex items-center justify-center",
                    sidebarCollapsed ? "h-8 w-8" : "h-4 w-4"
                  )}
                >
                  <User className={sidebarCollapsed ? "w-5 h-5" : "w-4 h-4"} />
                </div>
                {!sidebarCollapsed && (
                  <span className="ml-2 font-medium text-sm">โปรไฟล์</span>
                )}
              </Link>
            </div>

            {/* Settings menu */}
            {isAdmin && (
              <div className="px-2 mb-2">
                <button
                  onClick={() => setIsSettingsMenuOpen(!isSettingsMenuOpen)}
                  className={cn(
                    "group flex items-center w-full p-2 rounded-lg text-sm transition-colors focus:outline-none",
                    pathname?.startsWith("/dashboard/setting")
                      ? "bg-orange-50 text-orange-700"
                      : "text-gray-700 hover:bg-orange-50/60",
                    sidebarCollapsed && "justify-center"
                  )}
                  title={sidebarCollapsed ? settingsMenu.name : ""}
                >
                  <div
                    className={cn(
                      "flex items-center justify-center",
                      sidebarCollapsed ? "h-8 w-8" : "h-4 w-4"
                    )}
                  >
                    <Settings className={sidebarCollapsed ? "w-5 h-5" : "w-4 h-4"} />
                  </div>
                  {!sidebarCollapsed && (
                    <div className="flex items-center justify-between w-full ml-2">
                      <span className="font-medium text-sm">{settingsMenu.name}</span>
                      <ChevronDown
                        className={`w-3 h-3 transition-transform ${
                          isSettingsMenuOpen ? "rotate-180" : ""
                        }`}
                      />
                    </div>
                  )}
                </button>

                {/* Settings submenu */}
                {isSettingsMenuOpen &&
                  !sidebarCollapsed && (
                    <div className="mt-1 ml-2">
                      <ul className="space-y-1">
                        {settingsMenu.subMenus.map((subMenu) => {
                          if (subMenu.requireAdmin && !isAdmin) {
                            return null;
                          }

                          const Icon = subMenu.icon;
                          const isSubActive =
                            pathname === subMenu.href ||
                            pathname?.startsWith(subMenu.href);

                          return (
                            <li key={subMenu.href}>
                              <Link
                                href={subMenu.href}
                                className={`flex items-center p-2 text-sm rounded-lg transition-colors focus:outline-none ${
                                  isSubActive
                                    ? "bg-orange-100 text-orange-800"
                                    : "text-gray-600 hover:bg-orange-50/60 hover:text-gray-900"
                                }`}
                              >
                                <Icon className="w-4 h-4 mr-2" />
                                <span className="text-xs font-normal">{subMenu.name}</span>
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
              </div>
            )}

            {/* กลับหน้าหลักเว็บไซต์ */}
            {!sidebarCollapsed && (
              <div className="px-3 mt-6 mb-1">
                <div className="border-t border-orange-100 pt-3">
                  <span className="text-[10px] text-gray-300 uppercase tracking-widest">เว็บไซต์</span>
                </div>
              </div>
            )}
            <div className="px-2 mb-2">
              <Link
                href="/"
                className={cn(
                  "group flex items-center w-full p-2 rounded-lg text-sm text-gray-500 hover:bg-orange-50/60 hover:text-orange-700 transition-colors focus:outline-none",
                  sidebarCollapsed && "justify-center"
                )}
                title={sidebarCollapsed ? "กลับหน้าหลัก" : ""}
              >
                <div
                  className={cn(
                    "flex items-center justify-center",
                    sidebarCollapsed ? "h-8 w-8" : "h-4 w-4"
                  )}
                >
                  <Home className={sidebarCollapsed ? "w-5 h-5" : "w-4 h-4"} />
                </div>
                {!sidebarCollapsed && (
                  <span className="ml-2 font-normal text-sm">กลับหน้าหลัก</span>
                )}
              </Link>
            </div>
          </div>
        </div>

        {/* User info & logout */}
        <div className="border-t border-orange-100 p-3 bg-orange-50/50">
          <div
            className={cn(
              "flex items-center bg-white p-2 rounded-lg border border-orange-100",
              sidebarCollapsed && "justify-center"
            )}
          >
            <div className="flex-shrink-0">
              <div className="h-8 w-8 rounded-full bg-orange-100 flex items-center justify-center border border-orange-200">
                {user?.image ? (
                  <img
                    src={user.image}
                    alt="Profile"
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <span className="text-xs font-medium text-orange-700">
                    {user?.firstName?.charAt(0) || "U"}
                  </span>
                )}
              </div>
            </div>
            {!sidebarCollapsed && (
              <div className="ml-2">
                <p className="text-xs font-medium text-gray-900">
                  {user?.firstName || ""} {user?.lastName || ""}
                </p>
                <p className="text-xs text-gray-500">{user?.email || ""}</p>
                <p className="text-xs mt-1 bg-orange-100 text-orange-700 inline-block px-2 py-0.5 rounded-full border border-orange-200">
                  {user?.role === "admin" ? "ผู้ดูแลระบบ" : "ผู้ใช้งาน"}
                </p>
              </div>
            )}
          </div>
          <button
            onClick={async () => {
              try {
                toast.loading('กำลังออกจากระบบ...');
                await signOut({ callbackUrl: "/" });
              } catch (error) {
                toast.error('เกิดข้อผิดพลาดในการออกจากระบบ');
                console.error('Sign out error:', error);
              }
            }}
            className={cn(
              "mt-2 flex items-center p-2 rounded-lg w-full text-gray-600 hover:bg-red-50 hover:text-red-600 text-sm transition-colors",
              sidebarCollapsed && "justify-center"
            )}
            aria-label="ออกจากระบบ"
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            {!sidebarCollapsed && (
              <span className="ml-2 font-normal">ออกจากระบบ</span>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}
