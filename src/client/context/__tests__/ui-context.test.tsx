/**
 * UI Context Test Suite
 *
 * Comprehensive tests for the UI Context provider including:
 * - Context provider initialization
 * - State management and updates
 * - Theme management and persistence
 * - Notification system
 * - Loading state management
 * - Modal and dialog management
 * - Error handling and recovery
 * - Performance optimizations
 * Target Coverage: 100%
 */

import React, { useContext } from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UIContext, UIProvider, useUI } from '../ui-context';

// Mock localStorage
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    })
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage
});

// Test component that uses the UI context
const TestComponent: React.FC = () => {
  const {
    theme,
    setTheme,
    sidebarOpen,
    setSidebarOpen,
    notifications,
    addNotification,
    removeNotification,
    clearNotifications,
    loading,
    setLoading,
    modals,
    openModal,
    closeModal,
    toasts,
    showToast,
    dismissToast
  } = useUI();

  return (
    <div data-testid='test-component'>
      <div data-testid='theme'>{theme}</div>
      <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>Toggle Theme</button>

      <div data-testid='sidebar-state'>{sidebarOpen ? 'open' : 'closed'}</div>
      <button onClick={() => setSidebarOpen(!sidebarOpen)}>Toggle Sidebar</button>

      <div data-testid='notification-count'>{notifications.length}</div>
      <button
        onClick={() =>
          addNotification({
            id: `notif-${Date.now()}`,
            type: 'info',
            title: 'Test Notification',
            message: 'This is a test notification'
          })
        }
      >
        Add Notification
      </button>
      <button onClick={() => clearNotifications()}>Clear Notifications</button>

      <div data-testid='loading-state'>{loading ? 'loading' : 'idle'}</div>
      <button onClick={() => setLoading(!loading)}>Toggle Loading</button>

      <div data-testid='modal-count'>{modals.length}</div>
      <button
        onClick={() =>
          openModal({
            id: `modal-${Date.now()}`,
            type: 'confirm',
            title: 'Test Modal',
            content: 'This is a test modal'
          })
        }
      >
        Open Modal
      </button>

      <div data-testid='toast-count'>{toasts.length}</div>
      <button
        onClick={() =>
          showToast({
            id: `toast-${Date.now()}`,
            type: 'success',
            message: 'Test toast message'
          })
        }
      >
        Show Toast
      </button>

      {notifications.map((notification) => (
        <div key={notification.id} data-testid='notification-item'>
          <span>{notification.message}</span>
          <button onClick={() => removeNotification(notification.id)}>Remove</button>
        </div>
      ))}

      {modals.map((modal) => (
        <div key={modal.id} data-testid='modal-item'>
          <span>{modal.title}</span>
          <button onClick={() => closeModal(modal.id)}>Close</button>
        </div>
      ))}

      {toasts.map((toast) => (
        <div key={toast.id} data-testid='toast-item'>
          <span>{toast.message}</span>
          <button onClick={() => dismissToast(toast.id)}>Dismiss</button>
        </div>
      ))}
    </div>
  );
};

describe('UI Context', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage.clear();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Provider Initialization', () => {
    it('should provide default values', () => {
      render(
        <UIProvider>
          <TestComponent />
        </UIProvider>
      );

      expect(screen.getByTestId('theme')).toHaveTextContent('light');
      expect(screen.getByTestId('sidebar-state')).toHaveTextContent('closed');
      expect(screen.getByTestId('notification-count')).toHaveTextContent('0');
      expect(screen.getByTestId('loading-state')).toHaveTextContent('idle');
      expect(screen.getByTestId('modal-count')).toHaveTextContent('0');
      expect(screen.getByTestId('toast-count')).toHaveTextContent('0');
    });

    it('should load persisted state from localStorage', () => {
      const persistedState = {
        theme: 'dark',
        sidebarOpen: true
      };

      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(persistedState));

      render(
        <UIProvider>
          <TestComponent />
        </UIProvider>
      );

      expect(screen.getByTestId('theme')).toHaveTextContent('dark');
      expect(screen.getByTestId('sidebar-state')).toHaveTextContent('open');
    });

    it('should handle corrupted localStorage data gracefully', () => {
      mockLocalStorage.getItem.mockReturnValue('invalid-json');

      render(
        <UIProvider>
          <TestComponent />
        </UIProvider>
      );

      // Should fall back to defaults
      expect(screen.getByTestId('theme')).toHaveTextContent('light');
      expect(screen.getByTestId('sidebar-state')).toHaveTextContent('closed');
    });

    it('should accept initial values via props', () => {
      const initialState = {
        theme: 'dark' as const,
        sidebarOpen: true,
        loading: true
      };

      render(
        <UIProvider initialState={initialState}>
          <TestComponent />
        </UIProvider>
      );

      expect(screen.getByTestId('theme')).toHaveTextContent('dark');
      expect(screen.getByTestId('sidebar-state')).toHaveTextContent('open');
      expect(screen.getByTestId('loading-state')).toHaveTextContent('loading');
    });
  });

  describe('Theme Management', () => {
    it('should toggle theme correctly', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(
        <UIProvider>
          <TestComponent />
        </UIProvider>
      );

      expect(screen.getByTestId('theme')).toHaveTextContent('light');

      const toggleButton = screen.getByText('Toggle Theme');
      await user.click(toggleButton);

      expect(screen.getByTestId('theme')).toHaveTextContent('dark');

      await user.click(toggleButton);
      expect(screen.getByTestId('theme')).toHaveTextContent('light');
    });

    it('should persist theme changes to localStorage', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(
        <UIProvider>
          <TestComponent />
        </UIProvider>
      );

      const toggleButton = screen.getByText('Toggle Theme');
      await user.click(toggleButton);

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'alexandria-ui-state',
        expect.stringContaining('"theme":"dark"')
      );
    });

    it('should apply theme to document body', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(
        <UIProvider>
          <TestComponent />
        </UIProvider>
      );

      const toggleButton = screen.getByText('Toggle Theme');
      await user.click(toggleButton);

      expect(document.body.className).toContain('theme-dark');
    });

    it('should support system theme detection', () => {
      // Mock matchMedia for system theme detection
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation((query) => ({
          matches: query === '(prefers-color-scheme: dark)',
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn()
        }))
      });

      render(
        <UIProvider useSystemTheme>
          <TestComponent />
        </UIProvider>
      );

      expect(screen.getByTestId('theme')).toHaveTextContent('dark');
    });
  });

  describe('Sidebar State Management', () => {
    it('should toggle sidebar state', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(
        <UIProvider>
          <TestComponent />
        </UIProvider>
      );

      expect(screen.getByTestId('sidebar-state')).toHaveTextContent('closed');

      const toggleButton = screen.getByText('Toggle Sidebar');
      await user.click(toggleButton);

      expect(screen.getByTestId('sidebar-state')).toHaveTextContent('open');
    });

    it('should persist sidebar state', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(
        <UIProvider>
          <TestComponent />
        </UIProvider>
      );

      const toggleButton = screen.getByText('Toggle Sidebar');
      await user.click(toggleButton);

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'alexandria-ui-state',
        expect.stringContaining('"sidebarOpen":true')
      );
    });
  });

  describe('Notification System', () => {
    it('should add notifications', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(
        <UIProvider>
          <TestComponent />
        </UIProvider>
      );

      expect(screen.getByTestId('notification-count')).toHaveTextContent('0');

      const addButton = screen.getByText('Add Notification');
      await user.click(addButton);

      expect(screen.getByTestId('notification-count')).toHaveTextContent('1');
      expect(screen.getByTestId('notification-item')).toBeInTheDocument();
      expect(screen.getByText('This is a test notification')).toBeInTheDocument();
    });

    it('should remove individual notifications', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(
        <UIProvider>
          <TestComponent />
        </UIProvider>
      );

      // Add a notification
      const addButton = screen.getByText('Add Notification');
      await user.click(addButton);

      expect(screen.getByTestId('notification-count')).toHaveTextContent('1');

      // Remove the notification
      const removeButton = screen.getByText('Remove');
      await user.click(removeButton);

      expect(screen.getByTestId('notification-count')).toHaveTextContent('0');
      expect(screen.queryByTestId('notification-item')).not.toBeInTheDocument();
    });

    it('should clear all notifications', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(
        <UIProvider>
          <TestComponent />
        </UIProvider>
      );

      // Add multiple notifications
      const addButton = screen.getByText('Add Notification');
      await user.click(addButton);
      await user.click(addButton);

      expect(screen.getByTestId('notification-count')).toHaveTextContent('2');

      // Clear all notifications
      const clearButton = screen.getByText('Clear Notifications');
      await user.click(clearButton);

      expect(screen.getByTestId('notification-count')).toHaveTextContent('0');
    });

    it('should auto-dismiss notifications with timeout', async () => {
      render(
        <UIProvider>
          <TestComponent />
        </UIProvider>
      );

      // Add notification with auto-dismiss
      act(() => {
        const { addNotification } = useContext(UIContext);
        addNotification({
          id: 'auto-dismiss-test',
          type: 'info',
          title: 'Auto Dismiss',
          message: 'This will auto-dismiss',
          autoDismiss: true,
          dismissAfter: 3000
        });
      });

      expect(screen.getByTestId('notification-count')).toHaveTextContent('1');

      // Fast-forward time
      act(() => {
        jest.advanceTimersByTime(3000);
      });

      expect(screen.getByTestId('notification-count')).toHaveTextContent('0');
    });

    it('should handle duplicate notification IDs', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(
        <UIProvider>
          <TestComponent />
        </UIProvider>
      );

      // Mock addNotification to use fixed ID
      const FixedIdComponent = () => {
        const { addNotification, notifications } = useUI();

        return (
          <div>
            <div data-testid='notification-count'>{notifications.length}</div>
            <button
              onClick={() =>
                addNotification({
                  id: 'fixed-id',
                  type: 'info',
                  title: 'Fixed ID',
                  message: 'Same ID notification'
                })
              }
            >
              Add Fixed ID Notification
            </button>
          </div>
        );
      };

      render(
        <UIProvider>
          <FixedIdComponent />
        </UIProvider>
      );

      const addButton = screen.getByText('Add Fixed ID Notification');

      // Add same notification twice
      await user.click(addButton);
      await user.click(addButton);

      // Should only have one notification (duplicate should replace)
      expect(screen.getByTestId('notification-count')).toHaveTextContent('1');
    });
  });

  describe('Loading State Management', () => {
    it('should toggle loading state', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(
        <UIProvider>
          <TestComponent />
        </UIProvider>
      );

      expect(screen.getByTestId('loading-state')).toHaveTextContent('idle');

      const toggleButton = screen.getByText('Toggle Loading');
      await user.click(toggleButton);

      expect(screen.getByTestId('loading-state')).toHaveTextContent('loading');
    });

    it('should support loading with custom message', () => {
      const LoadingComponent = () => {
        const { setLoading, loadingMessage } = useUI();

        return (
          <div>
            <div data-testid='loading-message'>{loadingMessage || 'No message'}</div>
            <button onClick={() => setLoading(true, 'Processing data...')}>
              Start Loading with Message
            </button>
          </div>
        );
      };

      render(
        <UIProvider>
          <LoadingComponent />
        </UIProvider>
      );

      const startButton = screen.getByText('Start Loading with Message');
      fireEvent.click(startButton);

      expect(screen.getByTestId('loading-message')).toHaveTextContent('Processing data...');
    });

    it('should handle nested loading states', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      const NestedLoadingComponent = () => {
        const { setLoading, loadingCount } = useUI();

        return (
          <div>
            <div data-testid='loading-count'>{loadingCount}</div>
            <button onClick={() => setLoading(true)}>Start Loading</button>
            <button onClick={() => setLoading(false)}>Stop Loading</button>
          </div>
        );
      };

      render(
        <UIProvider>
          <NestedLoadingComponent />
        </UIProvider>
      );

      const startButton = screen.getByText('Start Loading');
      const stopButton = screen.getByText('Stop Loading');

      // Start multiple loading operations
      await user.click(startButton);
      await user.click(startButton);

      expect(screen.getByTestId('loading-count')).toHaveTextContent('2');

      // Stop one loading operation
      await user.click(stopButton);

      expect(screen.getByTestId('loading-count')).toHaveTextContent('1');
    });
  });

  describe('Modal Management', () => {
    it('should open and close modals', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(
        <UIProvider>
          <TestComponent />
        </UIProvider>
      );

      expect(screen.getByTestId('modal-count')).toHaveTextContent('0');

      // Open modal
      const openButton = screen.getByText('Open Modal');
      await user.click(openButton);

      expect(screen.getByTestId('modal-count')).toHaveTextContent('1');
      expect(screen.getByTestId('modal-item')).toBeInTheDocument();
      expect(screen.getByText('Test Modal')).toBeInTheDocument();

      // Close modal
      const closeButton = screen.getByText('Close');
      await user.click(closeButton);

      expect(screen.getByTestId('modal-count')).toHaveTextContent('0');
    });

    it('should support modal stacking', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(
        <UIProvider>
          <TestComponent />
        </UIProvider>
      );

      const openButton = screen.getByText('Open Modal');

      // Open multiple modals
      await user.click(openButton);
      await user.click(openButton);

      expect(screen.getByTestId('modal-count')).toHaveTextContent('2');
      expect(screen.getAllByTestId('modal-item')).toHaveLength(2);
    });

    it('should handle modal escape key closing', () => {
      const EscapeModalComponent = () => {
        const { modals, openModal, closeModal } = useUI();

        React.useEffect(() => {
          const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && modals.length > 0) {
              closeModal(modals[modals.length - 1].id);
            }
          };

          document.addEventListener('keydown', handleKeyDown);
          return () => document.removeEventListener('keydown', handleKeyDown);
        }, [modals, closeModal]);

        return (
          <div>
            <div data-testid='modal-count'>{modals.length}</div>
            <button
              onClick={() =>
                openModal({
                  id: 'escape-test',
                  type: 'info',
                  title: 'Escape Test',
                  content: 'Press escape to close'
                })
              }
            >
              Open Modal
            </button>
          </div>
        );
      };

      render(
        <UIProvider>
          <EscapeModalComponent />
        </UIProvider>
      );

      const openButton = screen.getByText('Open Modal');
      fireEvent.click(openButton);

      expect(screen.getByTestId('modal-count')).toHaveTextContent('1');

      // Simulate escape key
      fireEvent.keyDown(document, { key: 'Escape' });

      expect(screen.getByTestId('modal-count')).toHaveTextContent('0');
    });
  });

  describe('Toast Management', () => {
    it('should show and dismiss toasts', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(
        <UIProvider>
          <TestComponent />
        </UIProvider>
      );

      expect(screen.getByTestId('toast-count')).toHaveTextContent('0');

      // Show toast
      const showButton = screen.getByText('Show Toast');
      await user.click(showButton);

      expect(screen.getByTestId('toast-count')).toHaveTextContent('1');
      expect(screen.getByTestId('toast-item')).toBeInTheDocument();
      expect(screen.getByText('Test toast message')).toBeInTheDocument();

      // Dismiss toast
      const dismissButton = screen.getByText('Dismiss');
      await user.click(dismissButton);

      expect(screen.getByTestId('toast-count')).toHaveTextContent('0');
    });

    it('should auto-dismiss toasts after timeout', () => {
      render(
        <UIProvider>
          <TestComponent />
        </UIProvider>
      );

      // Show toast with auto-dismiss
      act(() => {
        const { showToast } = useContext(UIContext);
        showToast({
          id: 'auto-dismiss-toast',
          type: 'success',
          message: 'Auto dismiss toast',
          duration: 2000
        });
      });

      expect(screen.getByTestId('toast-count')).toHaveTextContent('1');

      // Fast-forward time
      act(() => {
        jest.advanceTimersByTime(2000);
      });

      expect(screen.getByTestId('toast-count')).toHaveTextContent('0');
    });

    it('should limit maximum number of toasts', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(
        <UIProvider maxToasts={3}>
          <TestComponent />
        </UIProvider>
      );

      const showButton = screen.getByText('Show Toast');

      // Show more toasts than the limit
      for (let i = 0; i < 5; i++) {
        await user.click(showButton);
      }

      // Should only show maximum allowed toasts
      expect(screen.getByTestId('toast-count')).toHaveTextContent('3');
    });
  });

  describe('Error Handling', () => {
    it('should handle context usage outside provider', () => {
      const TestComponentWithoutProvider = () => {
        try {
          useUI();
          return <div>Should not render</div>;
        } catch (error) {
          return <div data-testid='context-error'>Context error caught</div>;
        }
      };

      // Should throw error when used outside provider
      expect(() => {
        render(<TestComponentWithoutProvider />);
      }).toThrow();
    });

    it('should handle localStorage errors gracefully', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });

      render(
        <UIProvider>
          <TestComponent />
        </UIProvider>
      );

      // Should not throw when localStorage fails
      const toggleButton = screen.getByText('Toggle Theme');
      await user.click(toggleButton);

      expect(screen.getByTestId('theme')).toHaveTextContent('dark');
    });

    it('should handle invalid notification data', () => {
      const InvalidNotificationComponent = () => {
        const { addNotification, notifications } = useUI();

        return (
          <div>
            <div data-testid='notification-count'>{notifications.length}</div>
            <button onClick={() => addNotification({} as any)}>Add Invalid Notification</button>
          </div>
        );
      };

      render(
        <UIProvider>
          <InvalidNotificationComponent />
        </UIProvider>
      );

      const addButton = screen.getByText('Add Invalid Notification');
      fireEvent.click(addButton);

      // Should not add invalid notification
      expect(screen.getByTestId('notification-count')).toHaveTextContent('0');
    });
  });

  describe('Performance Optimizations', () => {
    it('should debounce localStorage writes', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(
        <UIProvider>
          <TestComponent />
        </UIProvider>
      );

      const toggleButton = screen.getByText('Toggle Theme');

      // Make multiple rapid changes
      await user.click(toggleButton);
      await user.click(toggleButton);
      await user.click(toggleButton);

      // Should debounce localStorage writes
      act(() => {
        jest.advanceTimersByTime(500);
      });

      expect(mockLocalStorage.setItem).toHaveBeenCalledTimes(1);
    });

    it('should memoize context value', () => {
      const ContextValueComponent = () => {
        const contextValue = useContext(UIContext);
        const [renderCount, setRenderCount] = React.useState(0);

        React.useEffect(() => {
          setRenderCount((count) => count + 1);
        }, [contextValue]);

        return <div data-testid='render-count'>{renderCount}</div>;
      };

      const { rerender } = render(
        <UIProvider>
          <ContextValueComponent />
        </UIProvider>
      );

      const initialRenderCount = parseInt(screen.getByTestId('render-count').textContent || '0');

      // Rerender provider without state changes
      rerender(
        <UIProvider>
          <ContextValueComponent />
        </UIProvider>
      );

      // Render count should not increase (memoized context value)
      const finalRenderCount = parseInt(screen.getByTestId('render-count').textContent || '0');
      expect(finalRenderCount).toBe(initialRenderCount);
    });
  });

  describe('Cleanup', () => {
    it('should cleanup timers on unmount', () => {
      const { unmount } = render(
        <UIProvider>
          <TestComponent />
        </UIProvider>
      );

      // Add notification with auto-dismiss
      act(() => {
        const { addNotification } = useContext(UIContext);
        addNotification({
          id: 'cleanup-test',
          type: 'info',
          title: 'Cleanup Test',
          message: 'This should be cleaned up',
          autoDismiss: true,
          dismissAfter: 5000
        });
      });

      unmount();

      // Timers should be cleared
      act(() => {
        jest.advanceTimersByTime(5000);
      });

      // No errors should occur
    });

    it('should cleanup event listeners on unmount', () => {
      const removeEventListener = jest.spyOn(document, 'removeEventListener');

      const { unmount } = render(
        <UIProvider>
          <TestComponent />
        </UIProvider>
      );

      unmount();

      expect(removeEventListener).toHaveBeenCalled();
    });
  });
});
