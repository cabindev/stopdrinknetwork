'use client';
// Navbar ลอยไร้พื้นหลัง — แต่ละเมนูเป็นปุ่มขาวมุมมนของตัวเอง จึงอ่านออกทั้งบนแผนที่และหน้าพื้นขาว
// ซ่อนตัวเองบน /dashboard ซึ่งมี Sidebar/TopNav ของตัวเองอยู่แล้ว
import React, { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Home, User, LogOut, Menu, BarChart3, X, ClipboardList, Map as MapIcon, BookOpen, Clock } from 'lucide-react';
import ChanFlowerIcon from '@/app/farewell/components/ChanFlowerIcon';

const PILL =
  'inline-flex items-center gap-1.5 h-9 px-3 rounded-full bg-white/95 backdrop-blur border border-gray-200 shadow-sm text-xs font-medium text-gray-700 hover:bg-white hover:text-orange-700 transition-colors';

export default function Navbar() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.dropdown-menu')) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const isAdmin = session?.user?.role === 'admin' || session?.user?.role === 'superadmin';
  const isPending = session?.user?.role === 'pending'; // สมัครใหม่ รออนุมัติ — ไม่มีเมนูงานของทีม

  if (pathname?.startsWith('/dashboard')) return null;

  return (
    <nav className="fixed top-0 inset-x-0 z-[2000] pointer-events-none print:hidden">
      <div className="flex items-center justify-between gap-3 px-3 py-2.5">
        {/* แบรนด์ */}
        <Link
          href="/"
          className="pointer-events-auto inline-flex items-center gap-2 h-9 pl-2.5 pr-3.5 rounded-full bg-white/95 backdrop-blur border border-gray-200 shadow-sm"
        >
          <span className="text-sm font-extrabold tracking-wide text-orange-600">SDN</span>
          <span className="hidden sm:inline text-xs font-medium text-gray-600">
            Stop Drink Network
          </span>
        </Link>

        {/* เมนูหลัก (เดสก์ท็อป) */}
        <div className="pointer-events-auto hidden sm:flex items-center gap-2">
          {status === 'loading' ? (
            <div className="w-24 h-9 rounded-full bg-white/70 animate-pulse" />
          ) : (
            <>
              {/* กรณีศึกษา = หน้าสาธารณะ เห็นทุกคนแม้ไม่ได้ login */}
              <Link href="/stories" className={PILL} title="กรณีศึกษา">
                <BookOpen className="w-4 h-4 text-gray-400" />
                กรณีศึกษา
              </Link>
              {/* ส่งด้วยใจ → หน้า 3D "เส้นทางสุดท้าย" ก่อน (ผู้ใช้ตัดสินใจ 2 ต.ค. 2026) ท้ายหน้ามีทางไปเครื่องมือวางแผน */}
              <Link href="/farewell/journey" className={PILL} title="ส่งด้วยใจ — เส้นทางสุดท้าย">
                <ChanFlowerIcon className="w-4 h-4 text-gray-400" />
                ส่งด้วยใจ
              </Link>
              {session?.user && !isPending && (
                <Link href="/activity" className={PILL} title="งานของฉัน">
                  <ClipboardList className="w-4 h-4 text-gray-400" />
                  งานของฉัน
                </Link>
              )}
              {isPending && (
                <Link href="/auth/pending" className={PILL} title="บัญชีรอผู้ดูแลระบบอนุมัติ">
                  <Clock className="w-4 h-4 text-orange-500" />
                  รออนุมัติ
                </Link>
              )}
              {/* แผนที่เปิดสาธารณะ — ไม่ login เห็นแบบกรองข้อมูล (app/map/page.tsx) */}
              <Link href="/map" className={PILL} title="แผนที่รวม">
                <MapIcon className="w-4 h-4 text-gray-400" />
                แผนที่รวม
              </Link>
              {isAdmin && (
                <Link href="/dashboard" className={PILL} title="Dashboard">
                  <BarChart3 className="w-4 h-4 text-gray-400" />
                  Dashboard
                </Link>
              )}
            </>
          )}

          {session?.user ? (
            <div className="relative dropdown-menu">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsUserMenuOpen(!isUserMenuOpen);
                }}
                aria-label="เมนูผู้ใช้"
                className="flex w-9 h-9 rounded-full bg-white/95 backdrop-blur border border-gray-200 shadow-sm items-center justify-center overflow-hidden hover:border-orange-300 transition-colors"
              >
                {session.user.image ? (
                  <img src={session.user.image} alt="" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-4 h-4 text-gray-500" />
                )}
              </button>
              {isUserMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 rounded-xl border border-gray-200 bg-white shadow-xl py-1.5">
                  <div className="px-4 py-2.5 border-b border-gray-100">
                    <p className="text-xs font-medium text-gray-800">
                      {session.user.firstName} {session.user.lastName}
                    </p>
                    <p className="text-[10px] text-gray-400 truncate">{session.user.email}</p>
                  </div>
                  <Link
                    href="/profile"
                    className="flex items-center gap-2 px-4 py-2 text-xs text-gray-600 hover:bg-orange-50 hover:text-orange-700 transition-colors"
                    onClick={() => setIsUserMenuOpen(false)}
                  >
                    <User className="w-3.5 h-3.5 text-gray-400" />
                    โปรไฟล์
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      signOut({ callbackUrl: '/' });
                      setIsUserMenuOpen(false);
                    }}
                    className="flex items-center gap-2 w-full px-4 py-2 text-xs text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    ออกจากระบบ
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button type="button" onClick={() => router.push('/auth/signin')} className={PILL}>
              <User className="w-4 h-4 text-gray-400" />
              เข้าสู่ระบบ
            </button>
          )}
        </div>

        {/* มือถือ */}
        <button
          type="button"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          aria-label="เมนู"
          className="pointer-events-auto sm:hidden flex w-9 h-9 rounded-full bg-white/95 backdrop-blur border border-gray-200 shadow-sm items-center justify-center text-gray-600"
        >
          {isMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
        </button>
      </div>

      {isMenuOpen && (
        <div className="pointer-events-auto sm:hidden mx-3 rounded-2xl bg-white border border-gray-200 shadow-xl p-2">
          <Link
            href="/"
            className="flex items-center gap-2 px-3 py-2.5 text-xs rounded-xl text-gray-600 hover:bg-orange-50 hover:text-orange-700"
            onClick={() => setIsMenuOpen(false)}
          >
            <Home className="w-4 h-4 text-gray-400" /> หน้าแรก
          </Link>
          <Link
            href="/stories"
            className="flex items-center gap-2 px-3 py-2.5 text-xs rounded-xl text-gray-600 hover:bg-orange-50 hover:text-orange-700"
            onClick={() => setIsMenuOpen(false)}
          >
            <BookOpen className="w-4 h-4 text-gray-400" /> กรณีศึกษา
          </Link>
          <Link
            href="/farewell/journey"
            className="flex items-center gap-2 px-3 py-2.5 text-xs rounded-xl text-gray-600 hover:bg-orange-50 hover:text-orange-700"
            onClick={() => setIsMenuOpen(false)}
          >
            <ChanFlowerIcon className="w-4 h-4 text-gray-400" /> ส่งด้วยใจ
          </Link>
          {session?.user && !isPending && (
            <Link
              href="/activity"
              className="flex items-center gap-2 px-3 py-2.5 text-xs rounded-xl text-gray-600 hover:bg-orange-50 hover:text-orange-700"
              onClick={() => setIsMenuOpen(false)}
            >
              <ClipboardList className="w-4 h-4 text-gray-400" /> งานของฉัน
            </Link>
          )}
          {isPending && (
            <Link
              href="/auth/pending"
              className="flex items-center gap-2 px-3 py-2.5 text-xs rounded-xl text-gray-600 hover:bg-orange-50 hover:text-orange-700"
              onClick={() => setIsMenuOpen(false)}
            >
              <Clock className="w-4 h-4 text-orange-500" /> รออนุมัติ
            </Link>
          )}
          <Link
            href="/map"
            className="flex items-center gap-2 px-3 py-2.5 text-xs rounded-xl text-gray-600 hover:bg-orange-50 hover:text-orange-700"
            onClick={() => setIsMenuOpen(false)}
          >
            <MapIcon className="w-4 h-4 text-gray-400" /> แผนที่รวม
          </Link>
          {isAdmin && (
            <Link
              href="/dashboard"
              className="flex items-center gap-2 px-3 py-2.5 text-xs rounded-xl text-gray-600 hover:bg-orange-50 hover:text-orange-700"
              onClick={() => setIsMenuOpen(false)}
            >
              <BarChart3 className="w-4 h-4 text-gray-400" /> Dashboard
            </Link>
          )}

          <div className="mt-1 pt-1 border-t border-gray-100">
            {session?.user ? (
              <>
                <Link
                  href="/profile"
                  className="flex items-center gap-2 px-3 py-2.5 text-xs rounded-xl text-gray-600 hover:bg-orange-50 hover:text-orange-700"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <User className="w-4 h-4 text-gray-400" /> {session.user.firstName}
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    signOut({ callbackUrl: '/' });
                    setIsMenuOpen(false);
                  }}
                  className="flex items-center gap-2 w-full px-3 py-2.5 text-xs rounded-xl text-red-500 hover:bg-red-50"
                >
                  <LogOut className="w-4 h-4" /> ออกจากระบบ
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  router.push('/auth/signin');
                  setIsMenuOpen(false);
                }}
                className="flex items-center gap-2 w-full px-3 py-2.5 text-xs rounded-xl text-gray-600 hover:bg-orange-50 hover:text-orange-700"
              >
                <User className="w-4 h-4 text-gray-400" /> เข้าสู่ระบบ
              </button>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
