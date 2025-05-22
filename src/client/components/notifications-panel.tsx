import React, { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Button } from './ui/button';

interface Notification {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  type: 'info' | 'warning' | 'error' | 'success';
}

export function NotificationsPanel() {
  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: '1',
      title: 'System Update',
      message: 'Alexandria Platform has been updated to version 1.2.0',
      time: '10 minutes ago',
      read: false,
      type: 'info',
    },
    {
      id: '2',
      title: 'Crash Analyzer Alert',
      message: 'New crash pattern detected in production logs',
      time: '2 hours ago',
      read: false,
      type: 'warning',
    },
    {
      id: '3',
      title: 'LLM Model Ready',
      message: 'Vicuna-13b model has finished loading',
      time: '4 hours ago',
      read: true,
      type: 'success',
    },
  ]);
  
  const unreadCount = notifications.filter(n => !n.read).length;
  
  const markAsRead = (id: string) => {
    setNotifications(notifications.map(n => 
      n.id === id ? { ...n, read: true } : n
    ));
  };
  
  const markAllAsRead = () => {
    setNotifications(notifications.map(n => ({ ...n, read: true })));
  };
  
  const getIcon = (type: string) => {
    switch (type) {
      case 'info': return 'fa-info-circle text-blue-500';
      case 'warning': return 'fa-exclamation-triangle text-yellow-500';
      case 'error': return 'fa-exclamation-circle text-red-500';
      case 'success': return 'fa-check-circle text-green-500';
      default: return 'fa-bell text-gray-500';
    }
  };
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <i className="fa-solid fa-bell"></i>
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
              {unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          {unreadCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={markAllAsRead}
              className="text-xs h-auto py-1"
            >
              Mark all as read
            </Button>
          )}
        </DropdownMenuLabel>
        
        <DropdownMenuSeparator />
        
        {notifications.length === 0 ? (
          <div className="text-center p-4 text-sm text-muted-foreground">
            No notifications
          </div>
        ) : (
          <>
            {notifications.map(notification => (
              <DropdownMenuItem 
                key={notification.id} 
                className={`flex flex-col items-start p-3 ${!notification.read ? 'bg-primary/5' : ''}`}
                onClick={() => markAsRead(notification.id)}
              >
                <div className="flex w-full items-start">
                  <i className={`fa-solid ${getIcon(notification.type)} text-lg mr-2 mt-0.5`}></i>
                  <div className="flex-1">
                    <div className="font-medium">{notification.title}</div>
                    <div className="text-sm text-muted-foreground">{notification.message}</div>
                    <div className="text-xs text-muted-foreground mt-1">{notification.time}</div>
                  </div>
                  {!notification.read && (
                    <div className="h-2 w-2 rounded-full bg-primary"></div>
                  )}
                </div>
              </DropdownMenuItem>
            ))}
            
            <DropdownMenuSeparator />
            
            <DropdownMenuItem className="justify-center text-sm">
              View all notifications
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}