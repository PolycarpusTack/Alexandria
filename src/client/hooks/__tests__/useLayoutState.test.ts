/**
 * useLayoutState Hook Test Suite
 *
 * Comprehensive tests for the useLayoutState custom hook including:
 * - State management and persistence
 * - Responsive layout handling
 * - Theme management
 * - Sidebar state and interactions
 * - Layout preferences persistence
 * - Performance optimizations
 * - Error handling and edge cases
 * - Integration with localStorage
 * Target Coverage: 100%
 */

import { renderHook, act } from '@testing-library/react';
import { useLayoutState } from '../useLayoutState';

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

// Mock window.matchMedia for responsive tests
const mockMatchMedia = jest.fn().mockImplementation((query) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: jest.fn(),
  removeListener: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn()
}));

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: mockMatchMedia
});

// Mock ResizeObserver
const mockResizeObserver = jest.fn();
mockResizeObserver.mockReturnValue({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn()
});
global.ResizeObserver = mockResizeObserver;

describe('useLayoutState', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage.clear();
    mockMatchMedia.mockClear();
  });

  describe('Initial State', () => {
    it('should initialize with default values', () => {
      const { result } = renderHook(() => useLayoutState());

      expect(result.current.sidebarOpen).toBe(false);
      expect(result.current.sidebarWidth).toBe(280);
      expect(result.current.headerHeight).toBe(64);
      expect(result.current.theme).toBe('light');
      expect(result.current.isCollapsed).toBe(false);
      expect(result.current.isMobile).toBe(false);
      expect(result.current.breakpoint).toBe('desktop');
    });

    it('should load state from localStorage if available', () => {
      const savedState = {
        sidebarOpen: true,
        sidebarWidth: 320,
        theme: 'dark',
        isCollapsed: true
      };

      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(savedState));

      const { result } = renderHook(() => useLayoutState());

      expect(result.current.sidebarOpen).toBe(true);
      expect(result.current.sidebarWidth).toBe(320);
      expect(result.current.theme).toBe('dark');
      expect(result.current.isCollapsed).toBe(true);
    });

    it('should handle corrupted localStorage data gracefully', () => {
      mockLocalStorage.getItem.mockReturnValue('invalid-json');

      const { result } = renderHook(() => useLayoutState());

      // Should fall back to defaults
      expect(result.current.sidebarOpen).toBe(false);
      expect(result.current.theme).toBe('light');
    });

    it('should detect mobile breakpoint on initialization', () => {
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

      const { result } = renderHook(() => useLayoutState());

      expect(result.current.isMobile).toBe(true);
      expect(result.current.breakpoint).toBe('mobile');
    });
  });

  describe('Sidebar State Management', () => {
    it('should toggle sidebar state', () => {
      const { result } = renderHook(() => useLayoutState());

      expect(result.current.sidebarOpen).toBe(false);

      act(() => {
        result.current.setSidebarOpen(true);
      });

      expect(result.current.sidebarOpen).toBe(true);
    });

    it('should update sidebar width', () => {
      const { result } = renderHook(() => useLayoutState());

      act(() => {
        result.current.setSidebarWidth(350);
      });

      expect(result.current.sidebarWidth).toBe(350);
    });

    it('should validate sidebar width within bounds', () => {
      const { result } = renderHook(() => useLayoutState());

      // Test minimum width
      act(() => {
        result.current.setSidebarWidth(100);
      });

      expect(result.current.sidebarWidth).toBe(200); // Minimum width

      // Test maximum width
      act(() => {
        result.current.setSidebarWidth(600);
      });

      expect(result.current.sidebarWidth).toBe(500); // Maximum width
    });

    it('should handle sidebar collapse state', () => {
      const { result } = renderHook(() => useLayoutState());

      act(() => {
        result.current.setIsCollapsed(true);
      });

      expect(result.current.isCollapsed).toBe(true);
      expect(result.current.effectiveSidebarWidth).toBe(60); // Collapsed width
    });

    it('should auto-close sidebar on mobile when opened', () => {
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

      const { result } = renderHook(() => useLayoutState());

      expect(result.current.isMobile).toBe(true);

      act(() => {
        result.current.setSidebarOpen(true);
      });

      // Should auto-close after timeout on mobile
      expect(setTimeout).toHaveBeenCalled();
    });
  });

  describe('Theme Management', () => {
    it('should update theme state', () => {
      const { result } = renderHook(() => useLayoutState());

      act(() => {
        result.current.setTheme('dark');
      });

      expect(result.current.theme).toBe('dark');
    });

    it('should toggle between light and dark themes', () => {
      const { result } = renderHook(() => useLayoutState());

      act(() => {
        result.current.toggleTheme();
      });

      expect(result.current.theme).toBe('dark');

      act(() => {
        result.current.toggleTheme();
      });

      expect(result.current.theme).toBe('light');
    });

    it('should apply theme to document body', () => {
      const { result } = renderHook(() => useLayoutState());

      act(() => {
        result.current.setTheme('dark');
      });

      expect(document.body.className).toContain('theme-dark');

      act(() => {
        result.current.setTheme('light');
      });

      expect(document.body.className).toContain('theme-light');
    });

    it('should detect system theme preference', () => {
      mockMatchMedia.mockImplementation((query) => ({
        matches: query === '(prefers-color-scheme: dark)',
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn()
      }));

      const { result } = renderHook(() => useLayoutState({ useSystemTheme: true }));

      expect(result.current.theme).toBe('dark');
    });
  });

  describe('Responsive Behavior', () => {
    it('should detect breakpoint changes', () => {
      let mediaListener: ((e: any) => void) | null = null;

      mockMatchMedia.mockImplementation((query) => ({
        matches: query === '(max-width: 768px)',
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn((event, listener) => {
          if (event === 'change') {
            mediaListener = listener;
          }
        }),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn()
      }));

      const { result } = renderHook(() => useLayoutState());

      expect(result.current.breakpoint).toBe('mobile');

      // Simulate breakpoint change
      if (mediaListener) {
        act(() => {
          mediaListener({ matches: false });
        });
      }

      expect(result.current.breakpoint).toBe('desktop');
      expect(result.current.isMobile).toBe(false);
    });

    it('should handle tablet breakpoint', () => {
      mockMatchMedia.mockImplementation((query) => {
        if (query === '(max-width: 1024px)')
          return {
            matches: true,
            media: query,
            addEventListener: jest.fn(),
            removeEventListener: jest.fn()
          };
        if (query === '(max-width: 768px)')
          return {
            matches: false,
            media: query,
            addEventListener: jest.fn(),
            removeEventListener: jest.fn()
          };
        return {
          matches: false,
          media: query,
          addEventListener: jest.fn(),
          removeEventListener: jest.fn()
        };
      });

      const { result } = renderHook(() => useLayoutState());

      expect(result.current.breakpoint).toBe('tablet');
      expect(result.current.isMobile).toBe(false);
      expect(result.current.isTablet).toBe(true);
    });

    it('should adjust layout for mobile automatically', () => {
      mockMatchMedia.mockImplementation((query) => ({
        matches: query === '(max-width: 768px)',
        media: query,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn()
      }));

      const { result } = renderHook(() => useLayoutState());

      expect(result.current.isMobile).toBe(true);
      expect(result.current.sidebarOpen).toBe(false); // Should be closed on mobile
    });
  });

  describe('Persistence', () => {
    it('should save state to localStorage when changed', () => {
      const { result } = renderHook(() => useLayoutState());

      act(() => {
        result.current.setSidebarOpen(true);
        result.current.setTheme('dark');
        result.current.setSidebarWidth(320);
      });

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'alexandria-layout-state',
        expect.stringContaining('"sidebarOpen":true')
      );
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'alexandria-layout-state',
        expect.stringContaining('"theme":"dark"')
      );
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'alexandria-layout-state',
        expect.stringContaining('"sidebarWidth":320')
      );
    });

    it('should debounce localStorage writes', async () => {
      const { result } = renderHook(() => useLayoutState());

      // Make multiple rapid changes
      act(() => {
        result.current.setSidebarWidth(300);
        result.current.setSidebarWidth(310);
        result.current.setSidebarWidth(320);
      });

      // Should debounce and only write once
      await new Promise((resolve) => setTimeout(resolve, 300));

      expect(mockLocalStorage.setItem).toHaveBeenCalledTimes(1);
    });

    it('should handle localStorage write errors gracefully', () => {
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });

      const { result } = renderHook(() => useLayoutState());

      expect(() => {
        act(() => {
          result.current.setTheme('dark');
        });
      }).not.toThrow();
    });
  });

  describe('Performance Optimizations', () => {
    it('should memoize derived values', () => {
      const { result, rerender } = renderHook(() => useLayoutState());

      const firstEffectiveWidth = result.current.effectiveSidebarWidth;

      // Rerender without state changes
      rerender();

      const secondEffectiveWidth = result.current.effectiveSidebarWidth;

      // Should be the same object reference (memoized)
      expect(firstEffectiveWidth).toBe(secondEffectiveWidth);
    });

    it('should only update when necessary', () => {
      const { result } = renderHook(() => useLayoutState());

      const initialRenderCount = result.current.renderCount || 0;

      // Setting the same value shouldn't cause re-render
      act(() => {
        result.current.setSidebarOpen(false); // Already false
      });

      expect(result.current.renderCount || 0).toBe(initialRenderCount);
    });

    it('should cleanup event listeners on unmount', () => {
      const removeEventListener = jest.fn();

      mockMatchMedia.mockImplementation((query) => ({
        matches: false,
        media: query,
        addEventListener: jest.fn(),
        removeEventListener
      }));

      const { unmount } = renderHook(() => useLayoutState());

      unmount();

      expect(removeEventListener).toHaveBeenCalled();
    });
  });

  describe('Advanced Features', () => {
    it('should support custom sidebar positions', () => {
      const { result } = renderHook(() => useLayoutState({ defaultSidebarPosition: 'right' }));

      expect(result.current.sidebarPosition).toBe('right');
    });

    it('should handle window resize events', () => {
      const { result } = renderHook(() => useLayoutState());

      // Simulate window resize
      act(() => {
        window.dispatchEvent(new Event('resize'));
      });

      // Should recalculate responsive values
      expect(result.current.windowWidth).toBeDefined();
      expect(result.current.windowHeight).toBeDefined();
    });

    it('should support layout presets', () => {
      const { result } = renderHook(() => useLayoutState());

      act(() => {
        result.current.applyLayoutPreset('compact');
      });

      expect(result.current.sidebarWidth).toBe(240); // Compact preset width
      expect(result.current.headerHeight).toBe(56); // Compact preset height
    });

    it('should calculate available content area', () => {
      const { result } = renderHook(() => useLayoutState());

      act(() => {
        result.current.setSidebarOpen(true);
        result.current.setSidebarWidth(280);
      });

      expect(result.current.contentWidth).toBe(
        result.current.windowWidth - result.current.effectiveSidebarWidth
      );
      expect(result.current.contentHeight).toBe(
        result.current.windowHeight - result.current.headerHeight
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid theme values', () => {
      const { result } = renderHook(() => useLayoutState());

      act(() => {
        (result.current.setTheme as any)('invalid-theme');
      });

      // Should fallback to valid theme
      expect(['light', 'dark']).toContain(result.current.theme);
    });

    it('should handle invalid sidebar width values', () => {
      const { result } = renderHook(() => useLayoutState());

      act(() => {
        (result.current.setSidebarWidth as any)('invalid-width');
      });

      // Should maintain current valid width
      expect(typeof result.current.sidebarWidth).toBe('number');
      expect(result.current.sidebarWidth).toBeGreaterThan(0);
    });

    it('should handle missing localStorage gracefully', () => {
      Object.defineProperty(window, 'localStorage', {
        value: undefined
      });

      const { result } = renderHook(() => useLayoutState());

      // Should still work without localStorage
      expect(result.current.theme).toBe('light');
      expect(result.current.sidebarOpen).toBe(false);
    });
  });

  describe('Integration with CSS Variables', () => {
    it('should update CSS custom properties', () => {
      const { result } = renderHook(() => useLayoutState());

      act(() => {
        result.current.setSidebarWidth(320);
        result.current.setHeaderHeight(72);
      });

      const rootStyle = document.documentElement.style;
      expect(rootStyle.getPropertyValue('--sidebar-width')).toBe('320px');
      expect(rootStyle.getPropertyValue('--header-height')).toBe('72px');
    });

    it('should update theme CSS variables', () => {
      const { result } = renderHook(() => useLayoutState());

      act(() => {
        result.current.setTheme('dark');
      });

      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });
  });
});
