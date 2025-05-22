import React from 'react';
import { Link } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { useAuth } from '../App';

export function UserDropdown() {
  const auth = useAuth();
  
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part.charAt(0))
      .join('')
      .toUpperCase();
  };
  
  const handleLogout = () => {
    auth?.logout();
  };
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="relative h-8 w-8 rounded-full outline-none focus:ring-2 focus:ring-primary">
          <Avatar className="h-8 w-8">
            <AvatarImage src={auth?.user?.avatar} alt={auth?.user?.name || "User"} />
            <AvatarFallback className="bg-primary/10 text-primary">
              {auth?.user?.name ? getInitials(auth.user.name) : "U"}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{auth?.user?.name || "User"}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {auth?.user?.email || "user@example.com"}
            </p>
          </div>
        </DropdownMenuLabel>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem>
          <Link to="/profile" className="flex w-full">
            <i className="fa-solid fa-user mr-2"></i>
            Profile
          </Link>
        </DropdownMenuItem>
        
        <DropdownMenuItem>
          <Link to="/user-settings" className="flex w-full">
            <i className="fa-solid fa-cog mr-2"></i>
            Settings
          </Link>
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem onClick={handleLogout}>
          <i className="fa-solid fa-sign-out-alt mr-2"></i>
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}