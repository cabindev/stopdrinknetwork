// app/dashboard/components/DashboardClient.tsx
'use client'
import type { Session } from 'next-auth';

import { useDashboard } from '../context/DashboardContext'
import Sidebar from './Sidebar'
import TopNav from './TopNav'
import { cn } from '@/lib/utils'

interface DashboardClientProps {
  children: React.ReactNode
  user: Session['user']
}

export default function DashboardClient({ children, user }: DashboardClientProps) {
  const { sidebarCollapsed } = useDashboard()

  return (
    <div className="min-h-screen bg-white">
      <Sidebar user={user} />

      {/* Main content area */}
      <div
        className={cn(
          "transition-all duration-200",
          sidebarCollapsed ? "lg:ml-16" : "lg:ml-64"
        )}
      >
        <TopNav user={user} />

        {/* Page content */}
        <main className="pt-2">
          {children}
        </main>
      </div>
    </div>
  )
}
