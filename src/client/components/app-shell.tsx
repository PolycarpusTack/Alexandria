import React from 'react';
import { Link } from 'react-router-dom';
import {        
  Bell,
  Search,
  Settings,
  Sun,
  Moon,
  Monitor,
  LogOut,
  Lightbulb,
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
import { useTheme } from './theme-provider';

interface AuthUser {
  id: string;
  username: string;
  email: string;
  roles: string[];
  name: string;
  avatar?: string;
}

interface AppShellProps {
  children: React.ReactNode;
  user: AuthUser | null;
  onLogout: () => void;
}

export const AppShell: React.FC<AppShellProps> = ({ children, user, onLogout }) => {
  const { theme, setTheme } = useTheme();
  
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part.charAt(0))
      .join('')
      .toUpperCase();
  };
  
  const handleCommandOpen = (e: React.MouseEvent) => {
    e.preventDefault();
    // Simulate Cmd+K / Ctrl+K
    window.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'k',
      metaKey: true,
    }));
  };
  
  return (
    <div className="app-shell">
      <div className="flex flex-col w-full h-full">
        <header className="app-header">
          <div className="flex items-center">
            <div className="mr-4">
              <Link to="/" className="flex items-center">
                <img 
                  src="/alexandria-icon.png" 
                  alt="Alexandria" 
                  className="w-8 h-8 mr-2 object-contain"
                />
                <h1 className="text-xl font-bold">Alexandria</h1>
              </Link>
            </div>
            
            <Button
              variant="outline"
              size="sm"
              className="hidden md:flex gap-2 ml-4"
              onClick={handleCommandOpen}
            >
              <Search className="h-4 w-4" />
              <span>Search...</span>
              <kbd className="bg-muted rounded-sm px-1.5 py-0.5 text-xs flex items-center gap-1">
                <span className="text-xs">⌘</span>K
              </kbd>
            </Button>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Notifications"
              className="rounded-full"
            >
              <Bell className="h-5 w-5" />
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <Settings className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Appearance</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setTheme("light")}>
                  <Sun className="h-4 w-4 mr-2" />
                  <span>Light</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("dark")}>
                  <Moon className="h-4 w-4 mr-2" />
                  <span>Dark</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("system")}>
                  <Monitor className="h-4 w-4 mr-2" />
                  <span>System</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user?.avatar} alt={user?.name || "User"} />
                    <AvatarFallback>{user ? getInitials(user.name || user.username) : "U"}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{user?.name || user?.username}</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user?.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <Link to="/profile" className="flex w-full">Profile</Link>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Link to="/settings" className="flex w-full">Settings</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onLogout}>
                  <LogOut className="h-4 w-4 mr-2" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        
        <main className="flex flex-1 overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
};