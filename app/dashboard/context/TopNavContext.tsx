'use client'

import { createContext, useContext, useState, ReactNode } from 'react'

interface TopNavContextType {
  showSelectAll: boolean;
  setShowSelectAll: (show: boolean) => void;
  selectedCount: number;
  setSelectedCount: (count: number) => void;
  totalCount: number;
  setTotalCount: (count: number) => void;
  onSelectAll?: () => void;
  setOnSelectAll: (callback: (() => void) | undefined) => void;
}

const TopNavContext = createContext<TopNavContextType | undefined>(undefined);

export function TopNavProvider({ children }: { children: ReactNode }) {
  const [showSelectAll, setShowSelectAll] = useState(false);
  const [selectedCount, setSelectedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [onSelectAll, setOnSelectAll] = useState<(() => void) | undefined>(undefined);

  return (
    <TopNavContext.Provider value={{
      showSelectAll,
      setShowSelectAll,
      selectedCount,
      setSelectedCount,
      totalCount,
      setTotalCount,
      onSelectAll,
      setOnSelectAll
    }}>
      {children}
    </TopNavContext.Provider>
  );
}

export function useTopNav() {
  const context = useContext(TopNavContext);
  if (context === undefined) {
    throw new Error('useTopNav must be used within a TopNavProvider');
  }
  return context;
}
