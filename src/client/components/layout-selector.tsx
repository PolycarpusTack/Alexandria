import React, { createContext, useContext, useState, useEffect } from 'react';
import { CCILayout } from './cci-layout';
import { ModernLayout } from './modern-layout';

interface LayoutContextType {
  layoutMode: 'classic' | 'modern';
  setLayoutMode: (mode: 'classic' | 'modern') => void;
}

const LayoutContext = createContext<LayoutContextType>({
  layoutMode: 'modern',
  setLayoutMode: () => {}
});

export const useLayout = () => useContext(LayoutContext);

export function LayoutProvider({ children }: { children: React.ReactNode }) {
  const [layoutMode, setLayoutMode] = useState<'classic' | 'modern'>('modern');
  
  // Load layout preference from localStorage
  useEffect(() => {
    const savedLayout = localStorage.getItem('alexandria-layout-mode');
    if (savedLayout === 'classic' || savedLayout === 'modern') {
      setLayoutMode(savedLayout);
    }
  }, []);
  
  // Save layout preference
  const handleSetLayoutMode = (mode: 'classic' | 'modern') => {
    setLayoutMode(mode);
    localStorage.setItem('alexandria-layout-mode', mode);
  };
  
  return (
    <LayoutContext.Provider value={{ layoutMode, setLayoutMode: handleSetLayoutMode }}>
      {children}
    </LayoutContext.Provider>
  );
}

interface DynamicLayoutProps {
  children: React.ReactNode;
}

export function DynamicLayout({ children }: DynamicLayoutProps) {
  const { layoutMode } = useLayout();
  
  if (layoutMode === 'modern') {
    return <ModernLayout>{children}</ModernLayout>;
  }
  
  return <CCILayout>{children}</CCILayout>;
}