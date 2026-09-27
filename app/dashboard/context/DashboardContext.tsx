// app/dashboard/context/DashboardContext.tsx
'use client'

import { createContext, useContext, useState, ReactNode } from 'react'

interface DashboardContextType {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  isMobileSidebarOpen: boolean;
  toggleMobileSidebar: (isOpen?: boolean) => void;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const toggleSidebar = () => {
    setSidebarCollapsed(prev => !prev);
  };

  const toggleMobileSidebar = (isOpen?: boolean) => {
    if (typeof isOpen === 'boolean') {
      setIsMobileSidebarOpen(isOpen);
    } else {
      setIsMobileSidebarOpen(prev => !prev);
    }
  };

  return (
    <DashboardContext.Provider value={{
      sidebarCollapsed,
      toggleSidebar,
      isMobileSidebarOpen,
      toggleMobileSidebar
    }}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (context === undefined) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  return context;
}
