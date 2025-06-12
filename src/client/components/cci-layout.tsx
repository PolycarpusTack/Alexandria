import React, { useState, useEffect } from 'react';
import { Header } from './header';
import { CCISidebar } from './cci-sidebar';
import { useTheme } from './theme-provider';

interface CCILayoutProps {
  children: React.ReactNode;
}

export function CCILayout({ children }: CCILayoutProps) {
  const { theme } = useTheme();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Check if viewport is mobile size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth < 768) {
        setSidebarCollapsed(true);
      }
    };

    // Initial check
    checkMobile();

    // Add resize listener
    window.addEventListener('resize', checkMobile);

    // Cleanup
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return (
    <div className='min-h-screen bg-[var(--background-color)]'>
      <Header />
      <CCISidebar />
      <main
        className={`pt-[var(--header-height)] transition-all duration-300 p-5 ${
          sidebarCollapsed ? 'pl-[70px]' : 'pl-[var(--sidebar-width)]'
        }`}
      >
        {children}
      </main>
    </div>
  );
}
