import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LucideIcon } from 'lucide-react';

export interface NavigationItem {
  id: string;
  label: string;
  path: string;
  icon: LucideIcon;
  badge?: string | number;
  disabled?: boolean;
}

export interface NavigationSection {
  id: string;
  title?: string;
  items: NavigationItem[];
}

export interface NavigationRendererProps {
  sections: NavigationSection[];
  variant?: 'sidebar' | 'header' | 'compact';
  className?: string;
  onItemClick?: (item: NavigationItem) => void;
}

export const NavigationRenderer: React.FC<NavigationRendererProps> = ({
  sections,
  variant = 'sidebar',
  className = '',
  onItemClick
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  const isActiveRoute = (path: string): boolean => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  const handleItemClick = (item: NavigationItem): void => {
    if (item.disabled) return;

    if (onItemClick) {
      onItemClick(item);
    } else {
      navigate(item.path);
    }
  };

  const getVariantClasses = (): string => {
    switch (variant) {
      case 'header':
        return 'flex flex-row space-x-4';
      case 'compact':
        return 'flex flex-col space-y-1 text-sm';
      default:
        return 'flex flex-col space-y-2';
    }
  };

  const getItemClasses = (item: NavigationItem): string => {
    const baseClasses =
      'flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 cursor-pointer';
    const activeClasses = 'bg-primary text-primary-foreground';
    const inactiveClasses = 'text-muted-foreground hover:text-foreground hover:bg-accent';
    const disabledClasses = 'opacity-50 cursor-not-allowed';

    let classes = baseClasses;

    if (item.disabled) {
      classes += ` ${disabledClasses}`;
    } else if (isActiveRoute(item.path)) {
      classes += ` ${activeClasses}`;
    } else {
      classes += ` ${inactiveClasses}`;
    }

    return classes;
  };

  return (
    <nav className={`${getVariantClasses()} ${className}`}>
      {sections.map((section) => (
        <div key={section.id} className={variant === 'sidebar' ? 'space-y-2' : ''}>
          {section.title && variant === 'sidebar' && (
            <h4 className='text-sm font-medium text-muted-foreground mb-2'>{section.title}</h4>
          )}
          <div className={variant === 'header' ? 'flex space-x-2' : 'space-y-1'}>
            {section.items.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.id}
                  className={getItemClasses(item)}
                  onClick={() => handleItemClick(item)}
                  role='button'
                  tabIndex={item.disabled ? -1 : 0}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      handleItemClick(item);
                    }
                  }}
                >
                  <Icon
                    className={variant === 'compact' ? 'h-4 w-4' : 'h-5 w-5'}
                    aria-hidden='true'
                  />
                  <span className={variant === 'compact' ? 'text-xs' : 'text-sm font-medium'}>
                    {item.label}
                  </span>
                  {item.badge && (
                    <span className='ml-auto bg-destructive text-destructive-foreground px-2 py-1 text-xs rounded-full'>
                      {item.badge}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
};

export default NavigationRenderer;
