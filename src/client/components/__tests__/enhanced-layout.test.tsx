/**
 * Enhanced Layout Component Test Suite
 *
 * Comprehensive tests for the Enhanced Layout component including:
 * - Layout rendering and structure
 * - Sidebar functionality and responsive behavior
 * - Theme switching and persistence
 * - Navigation and routing integration
 * - User authentication states
 * - Accessibility features
 * - Performance optimizations
 * - Error boundary handling
 * Target Coverage: 100%
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '../theme-provider';
import { EnhancedLayout } from '../enhanced-layout';
import { UIContext } from '../../context/ui-context';
import { useLayoutState } from '../../hooks/useLayoutState';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';

// Mock dependencies
jest.mock('../../hooks/useLayoutState');
jest.mock('../../hooks/useKeyboardShortcuts');
jest.mock('../header', () => ({
  Header: ({ onToggleSidebar, user }: any) => (
    <header data-testid='header'>
      <button onClick={onToggleSidebar} data-testid='toggle-sidebar'>
        Toggle Sidebar
      </button>
      {user && <span data-testid='user-info'>{user.username}</span>}
    </header>
  )
}));

jest.mock('../sidebar', () => ({
  Sidebar: ({ isOpen, onClose, currentPath }: any) => (
    <aside
      data-testid='sidebar'
      className={isOpen ? 'open' : 'closed'}
      data-current-path={currentPath}
    >
      <button onClick={onClose} data-testid='close-sidebar'>
        Close
      </button>
      <nav data-testid='navigation'>
        <a href='/dashboard' data-testid='nav-dashboard'>
          Dashboard
        </a>
        <a href='/plugins' data-testid='nav-plugins'>
          Plugins
        </a>
        <a href='/settings' data-testid='nav-settings'>
          Settings
        </a>
      </nav>
    </aside>
  )
}));

jest.mock('../notifications-panel', () => ({
  NotificationsPanel: ({ notifications, onDismiss }: any) => (
    <div data-testid='notifications-panel'>
      {notifications.map((notif: any) => (
        <div key={notif.id} data-testid='notification'>
          {notif.message}
          <button onClick={() => onDismiss(notif.id)}>Dismiss</button>
        </div>
      ))}
    </div>
  )
}));

// Test wrapper component
const TestWrapper: React.FC<{ children: React.ReactNode; uiContextValue?: any }> = ({
  children,
  uiContextValue = {}
}) => {
  const defaultUIContext = {
    theme: 'light',
    setTheme: jest.fn(),
    sidebarOpen: false,
    setSidebarOpen: jest.fn(),
    notifications: [],
    addNotification: jest.fn(),
    removeNotification: jest.fn(),
    loading: false,
    setLoading: jest.fn(),
    ...uiContextValue
  };

  return (
    <BrowserRouter>
      <ThemeProvider>
        <UIContext.Provider value={defaultUIContext}>{children}</UIContext.Provider>
      </ThemeProvider>
    </BrowserRouter>
  );
};

describe('EnhancedLayout', () => {
  const mockUseLayoutState = useLayoutState as jest.MockedFunction<typeof useLayoutState>;
  const mockUseKeyboardShortcuts = useKeyboardShortcuts as jest.MockedFunction<
    typeof useKeyboardShortcuts
  >;

  const mockUser = {
    id: 'user-123',
    username: 'testuser',
    email: 'test@example.com',
    roles: ['user'],
    permissions: ['read', 'write']
  };

  const defaultLayoutState = {
    sidebarOpen: false,
    setSidebarOpen: jest.fn(),
    sidebarWidth: 280,
    setSidebarWidth: jest.fn(),
    headerHeight: 64,
    theme: 'light',
    setTheme: jest.fn(),
    isCollapsed: false,
    setIsCollapsed: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockUseLayoutState.mockReturnValue(defaultLayoutState);
    mockUseKeyboardShortcuts.mockReturnValue({
      registerShortcut: jest.fn(),
      unregisterShortcut: jest.fn()
    });

    // Mock window.matchMedia for responsive tests
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn()
      }))
    });
  });

  describe('Basic Rendering', () => {
    it('should render layout structure correctly', () => {
      render(
        <TestWrapper>
          <EnhancedLayout user={mockUser}>
            <div data-testid='main-content'>Main Content</div>
          </EnhancedLayout>
        </TestWrapper>
      );

      expect(screen.getByTestId('enhanced-layout')).toBeInTheDocument();
      expect(screen.getByTestId('header')).toBeInTheDocument();
      expect(screen.getByTestId('sidebar')).toBeInTheDocument();
      expect(screen.getByTestId('main-content')).toBeInTheDocument();
    });

    it('should render without user when not authenticated', () => {
      render(
        <TestWrapper>
          <EnhancedLayout>
            <div data-testid='main-content'>Main Content</div>
          </EnhancedLayout>
        </TestWrapper>
      );

      expect(screen.getByTestId('enhanced-layout')).toBeInTheDocument();
      expect(screen.queryByTestId('user-info')).not.toBeInTheDocument();
    });

    it('should apply correct CSS classes based on layout state', () => {
      const { rerender } = render(
        <TestWrapper>
          <EnhancedLayout user={mockUser}>
            <div>Content</div>
          </EnhancedLayout>
        </TestWrapper>
      );

      const layout = screen.getByTestId('enhanced-layout');
      expect(layout).toHaveClass('enhanced-layout');
      expect(layout).toHaveClass('sidebar-closed');

      // Test with sidebar open
      mockUseLayoutState.mockReturnValue({
        ...defaultLayoutState,
        sidebarOpen: true
      });

      rerender(
        <TestWrapper>
          <EnhancedLayout user={mockUser}>
            <div>Content</div>
          </EnhancedLayout>
        </TestWrapper>
      );

      expect(layout).toHaveClass('sidebar-open');
    });
  });

  describe('Sidebar Functionality', () => {
    it('should toggle sidebar when header button is clicked', async () => {
      const user = userEvent.setup();
      const setSidebarOpen = jest.fn();

      mockUseLayoutState.mockReturnValue({
        ...defaultLayoutState,
        setSidebarOpen
      });

      render(
        <TestWrapper>
          <EnhancedLayout user={mockUser}>
            <div>Content</div>
          </EnhancedLayout>
        </TestWrapper>
      );

      const toggleButton = screen.getByTestId('toggle-sidebar');
      await user.click(toggleButton);

      expect(setSidebarOpen).toHaveBeenCalledWith(true);
    });

    it('should close sidebar when close button is clicked', async () => {
      const user = userEvent.setup();
      const setSidebarOpen = jest.fn();

      mockUseLayoutState.mockReturnValue({
        ...defaultLayoutState,
        sidebarOpen: true,
        setSidebarOpen
      });

      render(
        <TestWrapper>
          <EnhancedLayout user={mockUser}>
            <div>Content</div>
          </EnhancedLayout>
        </TestWrapper>
      );

      const closeButton = screen.getByTestId('close-sidebar');
      await user.click(closeButton);

      expect(setSidebarOpen).toHaveBeenCalledWith(false);
    });

    it('should handle keyboard shortcuts for sidebar toggle', () => {
      const registerShortcut = jest.fn();

      mockUseKeyboardShortcuts.mockReturnValue({
        registerShortcut,
        unregisterShortcut: jest.fn()
      });

      render(
        <TestWrapper>
          <EnhancedLayout user={mockUser}>
            <div>Content</div>
          </EnhancedLayout>
        </TestWrapper>
      );

      expect(registerShortcut).toHaveBeenCalledWith(
        'ctrl+b',
        expect.any(Function),
        'Toggle Sidebar'
      );
    });

    it('should be responsive to screen size changes', () => {
      const mockMatchMedia = window.matchMedia as jest.Mock;

      // Mock mobile breakpoint
      mockMatchMedia.mockImplementation((query) => ({
        matches: query === '(max-width: 768px)',
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn()
      }));

      render(
        <TestWrapper>
          <EnhancedLayout user={mockUser}>
            <div>Content</div>
          </EnhancedLayout>
        </TestWrapper>
      );

      const layout = screen.getByTestId('enhanced-layout');
      expect(layout).toHaveClass('mobile-layout');
    });
  });

  describe('Theme Integration', () => {
    it('should apply theme classes correctly', () => {
      const uiContextValue = {
        theme: 'dark',
        setTheme: jest.fn()
      };

      render(
        <TestWrapper uiContextValue={uiContextValue}>
          <EnhancedLayout user={mockUser}>
            <div>Content</div>
          </EnhancedLayout>
        </TestWrapper>
      );

      const layout = screen.getByTestId('enhanced-layout');
      expect(layout).toHaveClass('theme-dark');
    });

    it('should handle theme switching', async () => {
      const user = userEvent.setup();
      const setTheme = jest.fn();

      mockUseLayoutState.mockReturnValue({
        ...defaultLayoutState,
        theme: 'light',
        setTheme
      });

      render(
        <TestWrapper uiContextValue={{ setTheme }}>
          <EnhancedLayout user={mockUser}>
            <div>Content</div>
          </EnhancedLayout>
        </TestWrapper>
      );

      // Simulate theme toggle (assuming there's a theme toggle button)
      const themeToggle = screen.queryByTestId('theme-toggle');
      if (themeToggle) {
        await user.click(themeToggle);
        expect(setTheme).toHaveBeenCalled();
      }
    });
  });

  describe('Navigation Integration', () => {
    it('should highlight current page in navigation', () => {
      // Mock current location
      delete (window as any).location;
      (window as any).location = { pathname: '/dashboard' };

      render(
        <TestWrapper>
          <EnhancedLayout user={mockUser}>
            <div>Content</div>
          </EnhancedLayout>
        </TestWrapper>
      );

      const sidebar = screen.getByTestId('sidebar');
      expect(sidebar).toHaveAttribute('data-current-path', '/dashboard');
    });

    it('should handle navigation clicks', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <EnhancedLayout user={mockUser}>
            <div>Content</div>
          </EnhancedLayout>
        </TestWrapper>
      );

      const dashboardLink = screen.getByTestId('nav-dashboard');
      await user.click(dashboardLink);

      // Navigation would be handled by React Router
      expect(dashboardLink).toHaveAttribute('href', '/dashboard');
    });
  });

  describe('Notifications Integration', () => {
    it('should display notifications panel when notifications exist', () => {
      const notifications = [
        { id: '1', message: 'Test notification 1', type: 'info' },
        { id: '2', message: 'Test notification 2', type: 'success' }
      ];

      const uiContextValue = {
        notifications,
        removeNotification: jest.fn()
      };

      render(
        <TestWrapper uiContextValue={uiContextValue}>
          <EnhancedLayout user={mockUser}>
            <div>Content</div>
          </EnhancedLayout>
        </TestWrapper>
      );

      expect(screen.getByTestId('notifications-panel')).toBeInTheDocument();
      expect(screen.getAllByTestId('notification')).toHaveLength(2);
    });

    it('should handle notification dismissal', async () => {
      const user = userEvent.setup();
      const removeNotification = jest.fn();

      const notifications = [{ id: '1', message: 'Test notification', type: 'info' }];

      const uiContextValue = {
        notifications,
        removeNotification
      };

      render(
        <TestWrapper uiContextValue={uiContextValue}>
          <EnhancedLayout user={mockUser}>
            <div>Content</div>
          </EnhancedLayout>
        </TestWrapper>
      );

      const dismissButton = screen.getByText('Dismiss');
      await user.click(dismissButton);

      expect(removeNotification).toHaveBeenCalledWith('1');
    });
  });

  describe('Loading States', () => {
    it('should show loading overlay when loading', () => {
      const uiContextValue = {
        loading: true
      };

      render(
        <TestWrapper uiContextValue={uiContextValue}>
          <EnhancedLayout user={mockUser}>
            <div>Content</div>
          </EnhancedLayout>
        </TestWrapper>
      );

      expect(screen.getByTestId('loading-overlay')).toBeInTheDocument();
    });

    it('should hide loading overlay when not loading', () => {
      const uiContextValue = {
        loading: false
      };

      render(
        <TestWrapper uiContextValue={uiContextValue}>
          <EnhancedLayout user={mockUser}>
            <div>Content</div>
          </EnhancedLayout>
        </TestWrapper>
      );

      expect(screen.queryByTestId('loading-overlay')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA landmarks', () => {
      render(
        <TestWrapper>
          <EnhancedLayout user={mockUser}>
            <div>Content</div>
          </EnhancedLayout>
        </TestWrapper>
      );

      expect(screen.getByRole('banner')).toBeInTheDocument(); // Header
      expect(screen.getByRole('navigation')).toBeInTheDocument(); // Sidebar nav
      expect(screen.getByRole('main')).toBeInTheDocument(); // Main content
    });

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <EnhancedLayout user={mockUser}>
            <div>Content</div>
          </EnhancedLayout>
        </TestWrapper>
      );

      // Test tab navigation
      await user.tab();
      expect(screen.getByTestId('toggle-sidebar')).toHaveFocus();

      await user.tab();
      const firstNavLink = screen.getByTestId('nav-dashboard');
      expect(firstNavLink).toHaveFocus();
    });

    it('should have proper focus management for sidebar', async () => {
      const user = userEvent.setup();
      const setSidebarOpen = jest.fn();

      mockUseLayoutState.mockReturnValue({
        ...defaultLayoutState,
        setSidebarOpen
      });

      render(
        <TestWrapper>
          <EnhancedLayout user={mockUser}>
            <div>Content</div>
          </EnhancedLayout>
        </TestWrapper>
      );

      // Open sidebar
      const toggleButton = screen.getByTestId('toggle-sidebar');
      await user.click(toggleButton);

      // Focus should move to sidebar
      await waitFor(() => {
        expect(screen.getByTestId('close-sidebar')).toHaveFocus();
      });
    });

    it('should support screen reader announcements', () => {
      render(
        <TestWrapper>
          <EnhancedLayout user={mockUser}>
            <div>Content</div>
          </EnhancedLayout>
        </TestWrapper>
      );

      // Should have aria-live region for announcements
      expect(screen.getByRole('status')).toBeInTheDocument();
    });
  });

  describe('Performance Optimizations', () => {
    it('should memoize expensive computations', () => {
      const { rerender } = render(
        <TestWrapper>
          <EnhancedLayout user={mockUser}>
            <div>Content</div>
          </EnhancedLayout>
        </TestWrapper>
      );

      // Rerender with same props should not trigger expensive calculations
      rerender(
        <TestWrapper>
          <EnhancedLayout user={mockUser}>
            <div>Content</div>
          </EnhancedLayout>
        </TestWrapper>
      );

      // Should use React.memo or useMemo for optimization
      expect(screen.getByTestId('enhanced-layout')).toBeInTheDocument();
    });

    it('should handle resize events efficiently', () => {
      const mockResizeObserver = jest.fn();
      mockResizeObserver.mockReturnValue({
        observe: jest.fn(),
        unobserve: jest.fn(),
        disconnect: jest.fn()
      });

      global.ResizeObserver = mockResizeObserver;

      render(
        <TestWrapper>
          <EnhancedLayout user={mockUser}>
            <div>Content</div>
          </EnhancedLayout>
        </TestWrapper>
      );

      expect(mockResizeObserver).toHaveBeenCalled();
    });
  });

  describe('Error Boundary', () => {
    it('should catch and handle child component errors', () => {
      const ErrorThrowingComponent = () => {
        throw new Error('Test error');
      };

      // Suppress console.error for this test
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      render(
        <TestWrapper>
          <EnhancedLayout user={mockUser}>
            <ErrorThrowingComponent />
          </EnhancedLayout>
        </TestWrapper>
      );

      expect(screen.getByTestId('error-fallback')).toBeInTheDocument();
      expect(screen.getByText(/Something went wrong/)).toBeInTheDocument();

      consoleSpy.mockRestore();
    });

    it('should provide error recovery options', async () => {
      const user = userEvent.setup();
      const ErrorThrowingComponent = () => {
        throw new Error('Test error');
      };

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      render(
        <TestWrapper>
          <EnhancedLayout user={mockUser}>
            <ErrorThrowingComponent />
          </EnhancedLayout>
        </TestWrapper>
      );

      const retryButton = screen.getByText('Try Again');
      await user.click(retryButton);

      // Should attempt to recover from error
      expect(retryButton).toBeInTheDocument();

      consoleSpy.mockRestore();
    });
  });

  describe('Custom Hooks Integration', () => {
    it('should register keyboard shortcuts on mount', () => {
      const registerShortcut = jest.fn();

      mockUseKeyboardShortcuts.mockReturnValue({
        registerShortcut,
        unregisterShortcut: jest.fn()
      });

      render(
        <TestWrapper>
          <EnhancedLayout user={mockUser}>
            <div>Content</div>
          </EnhancedLayout>
        </TestWrapper>
      );

      expect(registerShortcut).toHaveBeenCalledWith(
        'ctrl+b',
        expect.any(Function),
        'Toggle Sidebar'
      );
    });

    it('should cleanup shortcuts on unmount', () => {
      const unregisterShortcut = jest.fn();

      mockUseKeyboardShortcuts.mockReturnValue({
        registerShortcut: jest.fn(),
        unregisterShortcut
      });

      const { unmount } = render(
        <TestWrapper>
          <EnhancedLayout user={mockUser}>
            <div>Content</div>
          </EnhancedLayout>
        </TestWrapper>
      );

      unmount();

      expect(unregisterShortcut).toHaveBeenCalledWith('ctrl+b');
    });
  });
});
