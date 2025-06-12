import React, { createContext, useContext, useState, useEffect } from 'react';
import { CCILayout } from './cci-layout';
import { ModernLayout } from './modern-layout';
import EnhancedLayout from './enhanced-layout';
import MockupLayout from './mockup-layout';
import EnhancedMockupSimple from './enhanced-mockup-simple';

type LayoutMode = 'classic' | 'modern' | 'enhanced' | 'mockup' | 'enhanced-mockup';

interface LayoutContextType {
  layoutMode: LayoutMode;
  setLayoutMode: (mode: LayoutMode) => void;
}

const LayoutContext = createContext<LayoutContextType>({
  layoutMode: 'enhanced-mockup',
  setLayoutMode: () => {}
});

export const useLayout = () => useContext(LayoutContext);

export function LayoutProvider({ children }: { children: React.ReactNode }) {
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('enhanced-mockup');

  // Load layout preference from localStorage
  useEffect(() => {
    const savedLayout = localStorage.getItem('alexandria-layout-mode') as LayoutMode;
    if (
      savedLayout &&
      ['classic', 'modern', 'enhanced', 'mockup', 'enhanced-mockup'].includes(savedLayout)
    ) {
      setLayoutMode(savedLayout);
    } else {
      // Default to enhanced-mockup layout
      localStorage.setItem('alexandria-layout-mode', 'enhanced-mockup');
      setLayoutMode('enhanced-mockup');
    }
  }, []);

  // Save layout preference
  const handleSetLayoutMode = (mode: LayoutMode) => {
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

  if (layoutMode === 'enhanced-mockup') {
    return <EnhancedMockupSimple>{children}</EnhancedMockupSimple>;
  }

  if (layoutMode === 'mockup') {
    return <MockupLayout>{children}</MockupLayout>;
  }

  if (layoutMode === 'enhanced') {
    return <EnhancedLayout>{children}</EnhancedLayout>;
  }

  if (layoutMode === 'modern') {
    return <ModernLayout>{children}</ModernLayout>;
  }

  return <CCILayout>{children}</CCILayout>;
}
