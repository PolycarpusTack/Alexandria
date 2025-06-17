import { useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { UIOperationError, ErrorHandler } from '../../core/errors';
import { logger } from '../utils/client-logger';

export interface NavItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  path: string;
  badge?: string;
  badgeVariant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'primary';
  statusIndicator?: 'online' | 'offline' | 'warning';
  color?: string;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

/**
 * Custom hook for managing navigation across layout components.
 * Provides consistent navigation data and helper functions.
 */
export function useNavigation() {
  const navigate = useNavigate();
  const location = useLocation();

  const isActiveRoute = useCallback(
    (path: string): boolean => {
      if (path === '/') {
        return location.pathname === '/' || location.pathname === '/dashboard';
      }
      return location.pathname === path || location.pathname.startsWith(path + '/');
    },
    [location.pathname]
  );

  const navigateToRoute = useCallback(
    (path: string, activeNavSetter?: (nav: string) => void) => {
      navigate(path);
      if (activeNavSetter) {
        const navId = path.split('/')[1] || 'dashboard';
        activeNavSetter(navId);
      }
    },
    [navigate]
  );

  const getNavigationSections = useCallback(
    (): NavSection[] => [
      {
        title: 'Core',
        items: [
          {
            id: 'dashboard',
            label: 'Dashboard',
            path: '/dashboard',
            statusIndicator: 'online'
          },
          {
            id: 'settings',
            label: 'Settings',
            path: '/settings'
          },
          {
            id: 'users',
            label: 'Users',
            path: '/users'
          }
        ]
      },
      {
        title: 'Plugins',
        items: [
          {
            id: 'alfred',
            label: 'ALFRED',
            path: '/alfred',
            badge: 'AI',
            badgeVariant: 'secondary',
            statusIndicator: 'online',
            color: '#38bdf8'
          },
          {
            id: 'crash-analyzer',
            label: 'Crash Analyzer',
            path: '/crash-analyzer',
            badge: 'Active',
            badgeVariant: 'primary',
            statusIndicator: 'online',
            color: '#f43f5e'
          },
          {
            id: 'heimdall',
            label: 'Heimdall',
            path: '/heimdall',
            badge: 'Beta',
            badgeVariant: 'outline',
            statusIndicator: 'offline',
            color: '#a78bfa'
          },
          {
            id: 'mnemosyne',
            label: 'Mnemosyne',
            path: '/mnemosyne',
            badge: 'KB',
            badgeVariant: 'secondary',
            statusIndicator: 'online',
            color: '#22c55e'
          }
        ]
      },
      {
        title: 'AI Services',
        items: [
          {
            id: 'llm-models',
            label: 'Ollama',
            path: '/llm-models',
            statusIndicator: 'online'
          },
          {
            id: 'vector-store',
            label: 'Vector Store',
            path: '/vector-store',
            statusIndicator: 'online'
          }
        ]
      },
      {
        title: 'Quick Links',
        items: [
          {
            id: 'documentation',
            label: 'Documentation',
            path: '/documentation'
          },
          {
            id: 'support',
            label: 'Support',
            path: '/support'
          },
          {
            id: 'plugin-store',
            label: 'Plugin Store',
            path: '/plugin-store',
            badge: '2',
            badgeVariant: 'primary'
          }
        ]
      }
    ],
    []
  );

  const getCommandPaletteItems = useCallback(
    () => [
      {
        id: 'open-file',
        title: 'Open File...',
        subtitle: 'Open a file from the workspace',
        shortcut: '⌘O',
        icon: 'file',
        action: () => {
          try {
            // TODO: Implement file opening functionality
            throw new UIOperationError('open-file', 'File opening not yet implemented', {
              operation: 'open-file',
              shortcut: '⌘O'
            });
          } catch (error) {
            const standardError = ErrorHandler.toStandardError(error);
            logger.error('Failed to open file', {
              error: standardError.message,
              code: standardError.code,
              context: standardError.context
            });
          }
        }
      },
      {
        id: 'toggle-terminal',
        title: 'Toggle Terminal',
        subtitle: 'Show or hide the integrated terminal',
        shortcut: '⌘`',
        icon: 'terminal',
        action: () => {
          try {
            // TODO: Implement terminal toggle functionality
            throw new UIOperationError('toggle-terminal', 'Terminal toggle not yet implemented', {
              operation: 'toggle-terminal',
              shortcut: '⌘`'
            });
          } catch (error) {
            const standardError = ErrorHandler.toStandardError(error);
            logger.error('Failed to toggle terminal', {
              error: standardError.message,
              code: standardError.code,
              context: standardError.context
            });
          }
        }
      },
      {
        id: 'launch-alfred',
        title: 'Launch ALFRED',
        subtitle: 'Start AI coding assistant',
        shortcut: '⌘⇧A',
        icon: 'code',
        action: () => {
          try {
            navigate('/alfred');
            logger.info('Navigated to ALFRED', { destination: '/alfred' });
          } catch (error) {
            const standardError = ErrorHandler.toStandardError(error);
            logger.error('Failed to navigate to ALFRED', {
              error: standardError.message,
              code: standardError.code,
              destination: '/alfred'
            });
          }
        }
      },
      {
        id: 'analyze-crash',
        title: 'Analyze Crash Log',
        subtitle: 'Open crash analyzer',
        shortcut: '⌘⇧C',
        icon: 'bug',
        action: () => {
          try {
            navigate('/crash-analyzer');
            logger.info('Navigated to crash analyzer', { destination: '/crash-analyzer' });
          } catch (error) {
            const standardError = ErrorHandler.toStandardError(error);
            logger.error('Failed to navigate to crash analyzer', {
              error: standardError.message,
              code: standardError.code,
              destination: '/crash-analyzer'
            });
          }
        }
      }
    ],
    [navigate]
  );

  const getBreadcrumbs = useCallback(() => {
    const pathParts = location.pathname.split('/').filter(Boolean);
    const breadcrumbs = [{ label: 'Alexandria Platform', path: '/' }];

    let currentPath = '';
    pathParts.forEach((part) => {
      currentPath += `/${part}`;
      const label = part.charAt(0).toUpperCase() + part.slice(1).replace(/-/g, ' ');
      breadcrumbs.push({ label, path: currentPath });
    });

    return breadcrumbs;
  }, [location.pathname]);

  return {
    currentPath: location.pathname,
    isActiveRoute,
    navigateToRoute,
    getNavigationSections,
    getCommandPaletteItems,
    getBreadcrumbs
  };
}
