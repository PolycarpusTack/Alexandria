import React, { useState, useCallback, useEffect } from 'react';
import { Header } from './header';
import { CCISidebar } from './cci-sidebar';
import { CommandPalette } from './command-palette';
import { useTheme } from './theme-provider';
import { cn } from '../lib/utils';

interface ModernLayoutProps {
  children: React.ReactNode;
}

interface Panel {
  id: string;
  title: string;
  content: React.ReactNode;
  minWidth?: number;
  maxWidth?: number;
}

export function ModernLayout({ children }: ModernLayoutProps) {
  const { theme } = useTheme();
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [rightPanelWidth, setRightPanelWidth] = useState(300);
  const [isDraggingSidebar, setIsDraggingSidebar] = useState(false);
  const [isDraggingRightPanel, setIsDraggingRightPanel] = useState(false);
  const [showRightPanel, setShowRightPanel] = useState(false);
  
  // VSCode-style keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K to open command palette
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
      
      // Cmd/Ctrl + B to toggle sidebar
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault();
        setSidebarWidth(prev => prev === 0 ? 260 : 0);
      }
      
      // Cmd/Ctrl + \ to toggle right panel
      if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
        e.preventDefault();
        setShowRightPanel(prev => !prev);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  
  // Handle sidebar resize
  const handleSidebarMouseDown = useCallback(() => {
    setIsDraggingSidebar(true);
  }, []);
  
  const handleRightPanelMouseDown = useCallback(() => {
    setIsDraggingRightPanel(true);
  }, []);
  
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingSidebar) {
        const newWidth = Math.max(200, Math.min(500, e.clientX));
        setSidebarWidth(newWidth);
      }
      if (isDraggingRightPanel) {
        const newWidth = Math.max(200, Math.min(600, window.innerWidth - e.clientX));
        setRightPanelWidth(newWidth);
      }
    };
    
    const handleMouseUp = () => {
      setIsDraggingSidebar(false);
      setIsDraggingRightPanel(false);
    };
    
    if (isDraggingSidebar || isDraggingRightPanel) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDraggingSidebar, isDraggingRightPanel]);
  
  const isDark = theme === 'dark' || 
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  
  return (
    <div className={cn(
      "min-h-screen flex flex-col",
      isDark ? "bg-[#1e1e1e] text-[#cccccc]" : "bg-[#ffffff] text-[#333333]"
    )}>
      {/* VSCode-style header */}
      <Header />
      
      {/* Main content area with panels */}
      <div className="flex-1 flex overflow-hidden">
        {/* Activity Bar (left-most bar with icons) */}
        <div className={cn(
          "w-12 flex flex-col items-center py-2 border-r",
          isDark ? "bg-[#333333] border-[#464647]" : "bg-[#f3f3f3] border-[#e7e7e7]"
        )}>
          <ActivityBarIcon icon="files" tooltip="Explorer" active />
          <ActivityBarIcon icon="search" tooltip="Search" />
          <ActivityBarIcon icon="git-branch" tooltip="Source Control" />
          <ActivityBarIcon icon="bug" tooltip="Debug" />
          <ActivityBarIcon icon="puzzle-piece" tooltip="Extensions" />
          <div className="flex-1" />
          <ActivityBarIcon icon="user" tooltip="Account" />
          <ActivityBarIcon icon="cog" tooltip="Settings" />
        </div>
        
        {/* Sidebar */}
        <div 
          className={cn(
            "relative border-r transition-all duration-200",
            isDark ? "bg-[#252526] border-[#464647]" : "bg-[#f3f3f3] border-[#e7e7e7]"
          )}
          style={{ width: `${sidebarWidth}px` }}
        >
          {sidebarWidth > 0 && (
            <>
              <div className="p-2 text-xs uppercase font-semibold opacity-60">
                Explorer
              </div>
              <div className="overflow-y-auto h-full">
                {/* File tree or navigation content */}
                <CCISidebar />
              </div>
            </>
          )}
          
          {/* Resize handle */}
          <div
            className={cn(
              "absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-blue-500 transition-colors",
              isDraggingSidebar && "bg-blue-500"
            )}
            onMouseDown={handleSidebarMouseDown}
          />
        </div>
        
        {/* Main editor area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tab bar */}
          <div className={cn(
            "h-9 flex items-center border-b",
            isDark ? "bg-[#2d2d30] border-[#464647]" : "bg-[#f3f3f3] border-[#e7e7e7]"
          )}>
            <div className={cn(
              "px-3 py-1 text-sm flex items-center gap-2 border-r",
              isDark ? "bg-[#1e1e1e] border-[#464647]" : "bg-white border-[#e7e7e7]"
            )}>
              <span>Welcome</span>
              <button className="ml-2 opacity-60 hover:opacity-100">×</button>
            </div>
          </div>
          
          {/* Editor content */}
          <div className={cn(
            "flex-1 overflow-auto",
            isDark ? "bg-[#1e1e1e]" : "bg-white"
          )}>
            <div className="p-6">
              {children}
            </div>
          </div>
          
          {/* Status bar */}
          <div className={cn(
            "h-6 px-2 flex items-center justify-between text-xs border-t",
            isDark ? "bg-[#007acc] text-white border-[#007acc]" : "bg-[#007acc] text-white border-[#007acc]"
          )}>
            <div className="flex items-center gap-4">
              <span>Ready</span>
              <span>UTF-8</span>
              <span>TypeScript React</span>
            </div>
            <div className="flex items-center gap-4">
              <span>Ln 1, Col 1</span>
              <span>Spaces: 2</span>
            </div>
          </div>
        </div>
        
        {/* Right panel (optional) */}
        {showRightPanel && (
          <>
            <div
              className={cn(
                "absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-blue-500 transition-colors z-10",
                isDraggingRightPanel && "bg-blue-500"
              )}
              style={{ right: `${rightPanelWidth}px` }}
              onMouseDown={handleRightPanelMouseDown}
            />
            <div 
              className={cn(
                "border-l",
                isDark ? "bg-[#252526] border-[#464647]" : "bg-[#f3f3f3] border-[#e7e7e7]"
              )}
              style={{ width: `${rightPanelWidth}px` }}
            >
              <div className="p-2 text-xs uppercase font-semibold opacity-60">
                Output
              </div>
              <div className="p-2 text-sm font-mono">
                {/* Terminal or output content */}
              </div>
            </div>
          </>
        )}
      </div>
      
      {/* Command Palette */}
      <CommandPalette open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen} />
    </div>
  );
}

// Activity bar icon component
function ActivityBarIcon({ 
  icon, 
  tooltip, 
  active = false 
}: { 
  icon: string; 
  tooltip: string; 
  active?: boolean;
}) {
  const { theme } = useTheme();
  const isDark = theme === 'dark' || 
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  
  return (
    <button
      className={cn(
        "w-12 h-12 flex items-center justify-center hover:bg-black/10 relative group",
        active && (isDark ? "border-l-2 border-white" : "border-l-2 border-[#007acc]")
      )}
      title={tooltip}
    >
      <i className={`fa-solid fa-${icon} text-lg`} />
      <span className="absolute left-full ml-2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
        {tooltip}
      </span>
    </button>
  );
}