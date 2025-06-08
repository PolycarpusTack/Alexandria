import React, { useState } from 'react';
import { useTheme } from './theme-provider';
import { Button } from './ui/button';
import { SearchBar } from './search-bar';
import { NotificationsPanel } from './notifications-panel';
import { UserDropdown } from './user-dropdown';
import { CommandPalette } from './command-palette';
import { useLayout } from './layout-selector';

export function Header() {
  const { theme, setTheme } = useTheme();
  const { layoutMode, setLayoutMode } = useLayout();
  const [commandOpen, setCommandOpen] = useState(false);
  
  const isDark = theme === 'dark' || 
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  return (
    <>
      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
      
      <header className={`fixed top-0 left-0 right-0 h-[var(--header-height)] px-5 flex items-center justify-between z-10 ${
        isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'
      } border-b`}>
        <div className="flex items-center gap-4">
          <div className="flex items-center text-xl font-semibold" style={{ color: 'var(--primary-color)' }}>
            <img src="/alexandria-icon.png" alt="Alexandria Logo" className="h-8 w-auto mr-2"/>
            Alexandria
          </div>
          
          <div className="hidden md:block ml-4">
            <SearchBar />
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center text-sm mr-4">
            System:&nbsp;<span className="h-2 w-2 rounded-full bg-green-500 inline-block"></span>&nbsp;Running
          </div>
          
          <div className="flex items-center gap-2">
            <NotificationsPanel />
            
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLayoutMode(layoutMode === 'modern' ? 'classic' : 'modern')}
              aria-label={layoutMode === 'modern' ? "Switch to classic layout" : "Switch to modern layout"}
              title={layoutMode === 'modern' ? "Switch to classic layout" : "Switch to modern VSCode-style layout"}
            >
              {layoutMode === 'modern' ? (
                <i className="fa-solid fa-table-columns"></i>
              ) : (
                <i className="fa-solid fa-code"></i>
              )}
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            >
              {isDark ? (
                <i className="fa-solid fa-sun"></i>
              ) : (
                <i className="fa-solid fa-moon"></i>
              )}
            </Button>
            
            <UserDropdown />
          </div>
        </div>
      </header>
    </>
  );
}