import React, { useState, useCallback, useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { CommandPalette } from './command-palette';
import { useTheme } from './theme-provider';
import { useAuth } from '../App';
import { cn } from '../lib/utils';
import { 
  Activity,
  Brain,
  Code,
  Database,
  FileSearch,
  Home,
  LayoutGrid,
  LogOut,
  Moon,
  Search,
  Settings,
  Shield,
  Sun,
  Terminal,
  User,
  BarChart3,
  Bell,
  HelpCircle,
  Package,
  Monitor,
  MessageSquare,
  Book,
  Zap,
  Key,
  Palette
} from 'lucide-react';
import { Button } from './ui/button';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Avatar, AvatarImage, AvatarFallback } from './ui/avatar';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';

interface ModernLayoutProps {
  children: React.ReactNode;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  path: string;
  badge?: string;
  badgeVariant?: 'default' | 'secondary' | 'destructive' | 'outline';
}

export function ModernLayout({ children }: ModernLayoutProps) {
  const { theme, setTheme } = useTheme();
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const isDark = theme === 'dark' || 
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  // Navigation sections
  const coreItems: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <Home className="h-4 w-4" />, path: '/' },
    { id: 'configuration', label: 'Configuration', icon: <Settings className="h-4 w-4" />, path: '/configuration' },
    { id: 'data-services', label: 'Data Services', icon: <Database className="h-4 w-4" />, path: '/data-services' },
    { id: 'security', label: 'Security', icon: <Shield className="h-4 w-4" />, path: '/security' },
  ];

  const pluginItems: NavItem[] = [
    { id: 'alfred', label: 'ALFRED', icon: <Brain className="h-4 w-4" />, path: '/alfred', badge: 'AI', badgeVariant: 'secondary' },
    { id: 'crash-analyzer', label: 'Hadron', icon: <FileSearch className="h-4 w-4" />, path: '/crash-analyzer', badge: 'Active', badgeVariant: 'default' },
    { id: 'heimdall', label: 'Heimdall', icon: <BarChart3 className="h-4 w-4" />, path: '/heimdall', badge: 'Beta', badgeVariant: 'outline' },
    { id: 'ticket-analysis', label: 'Ticket Analysis', icon: <MessageSquare className="h-4 w-4" />, path: '/ticket-analysis' },
    { id: 'knowledge-base', label: 'Knowledge Base', icon: <Book className="h-4 w-4" />, path: '/knowledge-base' },
  ];

  const aiServiceItems: NavItem[] = [
    { id: 'llm-models', label: 'LLM Models', icon: <Brain className="h-4 w-4" />, path: '/llm-models' },
    { id: 'fine-tuning', label: 'Fine-tuning', icon: <Zap className="h-4 w-4" />, path: '/fine-tuning' },
    { id: 'api-keys', label: 'API Keys', icon: <Key className="h-4 w-4" />, path: '/api-keys' },
  ];

  const quickLinks: NavItem[] = [
    { id: 'settings', label: 'Settings', icon: <Settings className="h-4 w-4" />, path: '/settings' },
    { id: 'user-settings', label: 'User Settings', icon: <User className="h-4 w-4" />, path: '/user-settings' },
    { id: 'appearance', label: 'Appearance', icon: <Palette className="h-4 w-4" />, path: '/appearance' },
    { id: 'documentation', label: 'Documentation', icon: <Book className="h-4 w-4" />, path: '/docs' },
  ];

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K for command palette
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
      
      // Cmd/Ctrl + B to toggle sidebar
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault();
        setSidebarCollapsed(prev => !prev);
      }
      
      // Cmd/Ctrl + / for search
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        document.getElementById('global-search')?.focus();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleLogout = () => {
    auth?.logout();
  };

  const ThemeIcon = theme === 'dark' ? Sun : theme === 'light' ? Moon : Monitor;

  return (
    <div className={cn(
      "flex h-screen overflow-hidden",
      isDark ? "bg-[#1e1e1e] text-[#cccccc]" : "bg-[#fafbfc] text-[#37352f]"
    )}>
      <CommandPalette open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen} />
      
      {/* Sidebar */}
      <aside className={cn(
        "flex flex-col border-r transition-all duration-300",
        isDark ? "bg-[#252526] border-[#3c3c3c]" : "bg-white border-gray-200",
        sidebarCollapsed ? "w-16" : "w-64"
      )}>
        {/* Logo */}
        <div className={cn(
          "h-14 flex items-center px-4 border-b",
          isDark ? "border-[#3c3c3c]" : "border-gray-200"
        )}>
          <img 
            src="/alexandria-icon.png" 
            alt="Alexandria" 
            className="h-6 w-6 object-contain"
            style={{
              filter: isDark ? 'invert(1) brightness(0.9)' : 'none'
            }}
          />
          {!sidebarCollapsed && (
            <span className="ml-3 font-semibold text-lg">Alexandria</span>
          )}
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1 py-4">
          <nav className="space-y-6 px-3">
            {/* Core Section */}
            <div>
              {!sidebarCollapsed && (
                <p className="px-3 mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Core
                </p>
              )}
              {coreItems.map((item) => {
                const isActive = location.pathname === item.path || 
                  (item.path !== '/' && location.pathname.startsWith(item.path));
                
                return (
                  <Button
                    key={item.id}
                    variant={isActive ? "secondary" : "ghost"}
                    className={cn(
                      "w-full justify-start mb-1",
                      sidebarCollapsed ? "px-2" : "px-3"
                    )}
                    onClick={() => navigate(item.path)}
                  >
                    {item.icon}
                    {!sidebarCollapsed && (
                      <>
                        <span className="ml-3">{item.label}</span>
                        {item.badge && (
                          <Badge variant={item.badgeVariant} className="ml-auto">
                            {item.badge}
                          </Badge>
                        )}
                      </>
                    )}
                  </Button>
                );
              })}
            </div>

            {/* Plugins Section */}
            <div>
              {!sidebarCollapsed && (
                <p className="px-3 mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Plugins
                </p>
              )}
              {pluginItems.map((item) => {
                const isActive = location.pathname === item.path || 
                  (item.path !== '/' && location.pathname.startsWith(item.path));
                
                return (
                  <Button
                    key={item.id}
                    variant={isActive ? "secondary" : "ghost"}
                    className={cn(
                      "w-full justify-start mb-1",
                      sidebarCollapsed ? "px-2" : "px-3"
                    )}
                    onClick={() => navigate(item.path)}
                  >
                    {item.icon}
                    {!sidebarCollapsed && (
                      <>
                        <span className="ml-3">{item.label}</span>
                        {item.badge && (
                          <Badge variant={item.badgeVariant} className="ml-auto">
                            {item.badge}
                          </Badge>
                        )}
                      </>
                    )}
                  </Button>
                );
              })}
            </div>

            {/* AI Services Section */}
            <div>
              {!sidebarCollapsed && (
                <p className="px-3 mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  AI Services
                </p>
              )}
              {aiServiceItems.map((item) => {
                const isActive = location.pathname === item.path;
                
                return (
                  <Button
                    key={item.id}
                    variant={isActive ? "secondary" : "ghost"}
                    className={cn(
                      "w-full justify-start mb-1",
                      sidebarCollapsed ? "px-2" : "px-3"
                    )}
                    onClick={() => navigate(item.path)}
                  >
                    {item.icon}
                    {!sidebarCollapsed && (
                      <>
                        <span className="ml-3">{item.label}</span>
                        {item.badge && (
                          <Badge variant={item.badgeVariant} className="ml-auto">
                            {item.badge}
                          </Badge>
                        )}
                      </>
                    )}
                  </Button>
                );
              })}
            </div>

            {/* Quick Links Section */}
            <div>
              {!sidebarCollapsed && (
                <p className="px-3 mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Quick Links
                </p>
              )}
              {quickLinks.map((item) => {
                const isActive = location.pathname === item.path;
                
                return (
                  <Button
                    key={item.id}
                    variant={isActive ? "secondary" : "ghost"}
                    className={cn(
                      "w-full justify-start mb-1",
                      sidebarCollapsed ? "px-2" : "px-3"
                    )}
                    onClick={() => navigate(item.path)}
                  >
                    {item.icon}
                    {!sidebarCollapsed && (
                      <>
                        <span className="ml-3">{item.label}</span>
                        {item.badge && (
                          <Badge variant={item.badgeVariant} className="ml-auto">
                            {item.badge}
                          </Badge>
                        )}
                      </>
                    )}
                  </Button>
                );
              })}
            </div>
          </nav>
        </ScrollArea>

        {/* Sidebar Footer */}
        <div className={cn(
          "p-3 border-t",
          isDark ? "border-[#3c3c3c]" : "border-gray-200"
        )}>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-center"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          >
            <Terminal className="h-4 w-4" />
            {!sidebarCollapsed && <span className="ml-2">Collapse</span>}
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className={cn(
          "h-14 flex items-center justify-between px-6 border-b",
          isDark ? "bg-[#2d2d2d] border-[#3c3c3c]" : "bg-white border-gray-200"
        )}>
          {/* Search Bar */}
          <div className="flex-1 max-w-xl">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                id="global-search"
                type="text"
                placeholder="Search everything... (Ctrl+/)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={cn(
                  "w-full pl-10 pr-4 py-2 rounded-lg border text-sm transition-colors",
                  isDark 
                    ? "bg-[#1e1e1e] border-[#3c3c3c] focus:border-blue-500" 
                    : "bg-gray-50 border-gray-200 focus:border-blue-500",
                  "focus:outline-none"
                )}
              />
              <kbd className={cn(
                "absolute right-3 top-1/2 transform -translate-y-1/2",
                "hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border px-1.5",
                "text-xs font-medium",
                isDark ? "bg-[#1e1e1e] border-[#3c3c3c]" : "bg-white border-gray-200"
              )}>
                <span className="text-xs">⌘</span>K
              </kbd>
            </div>
          </div>

          {/* Header Actions */}
          <div className="flex items-center gap-2 ml-4">
            {/* System Status */}
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-500/10 text-green-600 dark:text-green-400">
              <Activity className="h-3 w-3" />
              <span className="text-xs font-medium">System Running</span>
            </div>

            {/* Notifications */}
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-4 w-4" />
              <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full" />
            </Button>

            {/* Help */}
            <Button variant="ghost" size="icon">
              <HelpCircle className="h-4 w-4" />
            </Button>

            {/* Theme Toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                const nextTheme = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light';
                setTheme(nextTheme);
              }}
            >
              <ThemeIcon className="h-4 w-4" />
            </Button>

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={auth?.user?.avatar} alt={auth?.user?.name} />
                    <AvatarFallback>
                      {auth?.user?.username?.charAt(0).toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {auth?.user?.name || auth?.user?.username}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {auth?.user?.email || `${auth?.user?.username}@alexandria.local`}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/profile')}>
                  <User className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/settings')}>
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Main Content Area */}
        <main className={cn(
          "flex-1 overflow-auto",
          isDark ? "bg-[#1e1e1e]" : "bg-[#fafbfc]"
        )}>
          {children || <Outlet />}
        </main>
      </div>
    </div>
  );
}