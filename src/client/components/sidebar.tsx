import React, { useState } from 'react';
import { useLocation, NavLink } from 'react-router-dom';
import {     
  Home,
  Package,
  Settings,
  Bug,
  BarChart3 as BarChart,
  Database,
  Ticket,
  Book,
  Plus,
  ChevronDown,
  ChevronRight,
     } from 'lucide-react';
import { Button } from './ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from './ui/collapsible';
import { cn } from '../lib/utils';

interface SidebarItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  badge?: number;
}

const SidebarItem: React.FC<SidebarItemProps> = ({ to, icon, label, badge }) => {
  const location = useLocation();
  const isActive = location.pathname.startsWith(to);

  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-lg px-3 py-2 transition-all',
          isActive
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
        )
      }
    >
      {icon}
      <span className="flex-1">{label}</span>
      {badge ? (
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-xs font-medium">
          {badge}
        </span>
      ) : null}
    </NavLink>
  );
};

interface SidebarGroupProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

const SidebarGroup: React.FC<SidebarGroupProps> = ({ title, children, defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="w-full">
      <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-1 text-sm font-medium text-muted-foreground hover:text-foreground">
        {title}
        {isOpen ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-1 px-1 py-2">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
};

export const Sidebar: React.FC = () => {
  return (
    <div className="sidebar">
      <div className="flex flex-col space-y-6">
        <div className="space-y-1">
          <SidebarItem to="/" icon={<Home className="h-4 w-4" />} label="Dashboard" />
        </div>

        <SidebarGroup title="PLUGINS" defaultOpen={true}>
          <SidebarItem 
            to="/crash-analyzer" 
            icon={<Bug className="h-4 w-4" />} 
            label="Hadron" 
            badge={3} 
          />
          <SidebarItem 
            to="/log-visualization" 
            icon={<BarChart className="h-4 w-4" />} 
            label="Log Visualization" 
          />
          <SidebarItem 
            to="/ticket-analysis" 
            icon={<Ticket className="h-4 w-4" />} 
            label="Ticket Analysis" 
          />
          <SidebarItem 
            to="/knowledge-base" 
            icon={<Book className="h-4 w-4" />} 
            label="Knowledge Base" 
          />
        </SidebarGroup>

        <SidebarGroup title="WORKFLOWS" defaultOpen={false}>
          <SidebarItem 
            to="/workflows/ticket-to-resolution" 
            icon={<Database className="h-4 w-4" />} 
            label="Ticket to Resolution" 
          />
          <SidebarItem 
            to="/workflows/proactive-communication" 
            icon={<Database className="h-4 w-4" />} 
            label="Proactive Communication" 
          />
        </SidebarGroup>

        <SidebarGroup title="SYSTEM" defaultOpen={false}>
          <SidebarItem 
            to="/settings" 
            icon={<Settings className="h-4 w-4" />} 
            label="Settings" 
          />
          <SidebarItem 
            to="/plugins" 
            icon={<Package className="h-4 w-4" />} 
            label="Plugin Manager" 
          />
        </SidebarGroup>

        <div className="pt-4">
          <Button className="w-full justify-start" variant="outline">
            <Plus className="mr-2 h-4 w-4" />
            Add Plugin
          </Button>
        </div>
      </div>
    </div>
  );
};