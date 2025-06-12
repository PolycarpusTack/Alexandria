import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

import { BarChart3, FileText, TrendingUp, Home, FileSearch } from 'lucide-react';
import { cn } from '../../../../client/lib/utils';

interface NavigationItem {
  path: string;
  label: string;
  icon: React.ReactNode;
  description?: string;
}

export const AnalyticsNavigation: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems: NavigationItem[] = [
    {
      path: '/crash-analyzer',
      label: 'Dashboard',
      icon: <Home className='h-4 w-4' />,
      description: 'Crash logs overview'
    },
    {
      path: '/crash-analyzer/analytics',
      label: 'Analytics',
      icon: <BarChart3 className='h-4 w-4' />,
      description: 'Insights & trends'
    },
    {
      path: '/crash-analyzer/reports',
      label: 'Reports',
      icon: <FileText className='h-4 w-4' />,
      description: 'Generate reports'
    }
  ];

  return (
    <div className='border-b'>
      <div className='px-6 py-3'>
        <nav className='flex space-x-6'>
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;

            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors',
                  'hover:bg-muted',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
};
