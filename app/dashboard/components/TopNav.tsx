// app/dashboard/components/TopNav.tsx
'use client'
import type { Session } from 'next-auth';

import { useDashboard } from '../context/DashboardContext';
import { useTopNav } from '../context/TopNavContext';
import {
  Bell,
  Search,
  Settings,
  Menu
} from 'lucide-react';

interface TopNavProps {
  user: Session['user'];
}

export default function TopNav({ user }: TopNavProps) {
  const { toggleMobileSidebar, isMobileSidebarOpen } = useDashboard();
  const { showSelectAll, selectedCount, totalCount, onSelectAll } = useTopNav();

  const handleMenuToggle = () => {
    toggleMobileSidebar(!isMobileSidebarOpen);
  };

  return (
    <header className="bg-white/80 backdrop-blur h-12 flex items-center justify-between px-6 relative z-[100] shadow-sm border-b border-orange-100">
      {/* Left side - Mobile hamburger + Brand */}
      <div className="flex items-center space-x-4">
        {/* Mobile hamburger button */}
        <button
          type="button"
          onClick={handleMenuToggle}
          className="p-1 text-gray-700 hover:bg-orange-50 rounded lg:hidden transition-colors"
          aria-label="เปิดเมนู"
        >
          <Menu className="h-4 w-4" />
        </button>

        {/* Brand/Title */}
        <div className="flex items-center">
          <h1 className="text-lg font-normal text-gray-900 hidden sm:block">
            Stop Drink Network Dashboard
          </h1>
          <h1 className="text-base font-normal text-gray-900 sm:hidden">
            Dashboard
          </h1>
        </div>
      </div>

      {/* Center - Search */}
      <div className="flex-1 max-w-xl mx-8 hidden md:block">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search everything..."
            className="w-full pl-10 pr-4 py-1.5 text-sm bg-orange-50/60 border border-orange-100 rounded-md focus:outline-none focus:bg-white focus:border-orange-400 transition-all"
          />
        </div>
      </div>

      {/* Right side - Actions & User */}
      <div className="flex items-center space-x-1">
        {/* Select All Button - Only show when relevant */}
        {showSelectAll && totalCount > 0 && (
          <button
            type="button"
            onClick={onSelectAll}
            className="px-3 py-1.5 text-sm text-orange-600 hover:bg-orange-50 rounded transition-colors font-medium"
            aria-label="เลือกทั้งหมด"
          >
            {selectedCount === totalCount ? 'Clear all' : `Select all (${totalCount})`}
          </button>
        )}

        {/* Selection indicator */}
        {selectedCount > 0 && (
          <span className="px-2 py-1 text-xs bg-orange-100 text-orange-700 rounded-full font-medium">
            {selectedCount} selected
          </span>
        )}

        {/* Settings */}
        <button
          type="button"
          className="p-1.5 text-gray-600 hover:bg-orange-50 rounded transition-colors"
          aria-label="การตั้งค่า"
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* Notifications */}
        <button
          type="button"
          className="p-1.5 text-gray-600 hover:bg-orange-50 rounded transition-colors relative"
          aria-label="การแจ้งเตือน"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-orange-400 rounded-full"></span>
        </button>

        {/* User Info Display Only */}
        <div className="flex items-center space-x-2">
          {user?.image ? (
            <img
              src={user.image}
              alt="Profile"
              className="w-6 h-6 rounded-full object-cover"
            />
          ) : (
            <span className="flex w-6 h-6 rounded-full bg-orange-100 items-center justify-center text-[10px] font-medium text-orange-700">
              {user?.firstName?.charAt(0) || "U"}
            </span>
          )}
          <span className="text-sm text-gray-700 hidden lg:block font-normal">
            {user?.firstName || "User"}
          </span>
        </div>
      </div>
    </header>
  );
}
