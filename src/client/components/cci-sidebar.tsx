import React, { useState, createContext } from 'react';
import { NavLink } from 'react-router-dom';
import { cn } from '../lib/utils';
import { useTheme } from './theme-provider';
import { Button } from './ui/button';

interface SidebarContextType {
  collapsed: boolean;
}

const SidebarContext = createContext<SidebarContextType | null>(null);

interface SidebarItemProps {
  icon: string;
  label: string;
  to: string;
  status?: 'green' | 'red' | 'yellow' | null;
  children?: React.ReactNode;
}

function SidebarItem({ icon, label, to, status, children }: SidebarItemProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark' || 
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const sidebarContext = React.useContext(SidebarContext);
  const collapsed = sidebarContext?.collapsed || false;
    
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "flex items-center text-sm px-4 py-2 my-1 rounded-md transition-colors",
          isActive 
            ? "bg-primary/10 text-[var(--primary-color)] font-medium"
            : isDark ? "hover:bg-gray-800" : "hover:bg-gray-100",
          collapsed ? "justify-center p-2" : ""
        )
      }
      title={label}
    >
      <i className={`fa-solid fa-${icon} ${collapsed ? '' : 'mr-2'} text-[var(--primary-color)]`}></i>
      {!collapsed && <span>{label}</span>}
      {!collapsed && status && <span className={`h-2 w-2 rounded-full ml-auto mr-2 bg-${status}-500`}></span>}
      {!collapsed && children}
    </NavLink>
  );
}

interface SectionProps {
  icon: string;
  label: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function Section({ icon, label, children, defaultOpen = false }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const { theme } = useTheme();
  const isDark = theme === 'dark' || 
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const sidebarContext = React.useContext(SidebarContext);
  const collapsed = sidebarContext?.collapsed || false;
  
  if (collapsed) {
    return (
      <div className="mt-4 text-center">
        <button 
          className={`w-8 h-8 rounded-md flex items-center justify-center ${
            isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
          } mx-auto`}
          title={label}
        >
          <i className={`fa-solid fa-${icon} text-[var(--primary-color)]`}></i>
        </button>
      </div>
    );
  }
  
  return (
    <div className="mt-4">
      <button 
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center text-sm font-semibold uppercase text-[var(--primary-color)] px-4 py-2 ${
          isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
        } rounded-md transition-colors`}
      >
        <i className={`fa-solid fa-${icon} mr-2`}></i>
        {label}
        <span className="ml-auto">{open ? '▼' : '►'}</span>
      </button>
      
      {open && <div className="mt-2 space-y-1">{children}</div>}
    </div>
  );
}

export function CCISidebar() {
  const { theme } = useTheme();
  const isDark = theme === 'dark' || 
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const [collapsed, setCollapsed] = useState(false);
  
  return (
    <SidebarContext.Provider value={{ collapsed }}>
    <aside 
      className={`fixed top-[var(--header-height)] left-0 bottom-0 p-5 overflow-y-auto transition-all duration-300 ${
        isDark ? 'bg-gray-900 border-gray-800 text-gray-100' : 'bg-white border-gray-200'
      } border-r ${
        collapsed ? 'w-[70px]' : 'w-[var(--sidebar-width)]'
      }`}
      aria-label="Main navigation"
    >
      <div className="flex items-center justify-between px-4 py-2">
        {!collapsed && (
          <div className="text-sm font-semibold uppercase text-muted-foreground">Menu</div>
        )}
        <Button 
          variant="ghost" 
          size="icon" 
          className={`h-8 w-8 ${collapsed ? 'mx-auto' : ''}`}
          aria-label="Toggle sidebar"
          onClick={() => setCollapsed(!collapsed)}
        >
          <i className={`fa-solid ${collapsed ? 'fa-chevron-right' : 'fa-bars'}`}></i>
        </Button>
      </div>
      
      <SidebarItem icon="home" label="Dashboard" to="/" />
      
      <Section icon="plug" label="Plugins" defaultOpen>
        <SidebarItem icon="robot" label="ALFRED Assistant" to="/alfred" status="green" />
        <SidebarItem icon="microchip" label="Crash Analyzer" to="/crash-analyzer" status="green" />
        <SidebarItem icon="chart-line" label="Log Visualization" to="/log-visualization" status="red" />
        <SidebarItem icon="ticket" label="Ticket Analysis" to="/ticket-analysis" status="green" />
        <SidebarItem icon="book" label="Knowledge Base" to="/knowledge-base" status="green" />
      </Section>
      
      <Section icon="robot" label="LLM Models">
        <div className="flex items-center text-sm px-4 py-2">
          <i className="fa-solid fa-robot mr-2 text-[var(--primary-color)]"></i>
          <span>vicuna-13b</span>
          <span className="h-2 w-2 rounded-full mx-2 bg-green-500"></span>
          <div className="ml-auto space-x-2">
            <i className="fa-solid fa-play text-green-600 cursor-pointer"></i>
            <i className="fa-solid fa-stop text-red-600 cursor-pointer"></i>
          </div>
        </div>
        
        <div className="flex items-center text-sm px-4 py-2">
          <i className="fa-solid fa-robot mr-2 text-[var(--primary-color)]"></i>
          <span>llama2-7b</span>
          <span className="h-2 w-2 rounded-full mx-2 bg-green-500"></span>
          <div className="ml-auto space-x-2">
            <i className="fa-solid fa-play text-green-600 cursor-pointer"></i>
            <i className="fa-solid fa-stop text-red-600 cursor-pointer"></i>
          </div>
        </div>
      </Section>
      
      <Section icon="layer-group" label="Core Framework">
        <SidebarItem icon="cog" label="Configuration" to="/configuration" />
        <SidebarItem icon="database" label="Data Services" to="/data-services" />
        <SidebarItem icon="shield" label="Security" to="/security" />
      </Section>
      
      <Section icon="chart-bar" label="Monitoring">
        <SidebarItem icon="tachometer-alt" label="Performance" to="/performance" />
        <SidebarItem icon="heartbeat" label="Health" to="/health" />
        <SidebarItem icon="history" label="Logs" to="/logs" />
      </Section>
      
      <Section icon="cog" label="Settings">
        <SidebarItem icon="user" label="User Settings" to="/user-settings" />
        <SidebarItem icon="palette" label="Appearance" to="/appearance" />
        <SidebarItem icon="bell" label="Notifications" to="/notifications" />
      </Section>
      
      <Section icon="terminal" label="Dev Tools">
        <SidebarItem icon="code" label="API Explorer" to="/api-explorer" />
        <SidebarItem icon="bug" label="Debug Console" to="/debug-console" />
        <SidebarItem icon="vial" label="Test Runner" to="/test-runner" />
      </Section>
      
      <Section icon="question-circle" label="Help">
        <SidebarItem icon="book" label="Documentation" to="/documentation" />
        <SidebarItem icon="life-ring" label="Support" to="/support" />
        <SidebarItem icon="info-circle" label="About" to="/about" />
      </Section>
    </aside>
    </SidebarContext.Provider>
  );
}