/**
 * UI State Store using Zustand
 * Manages global UI state including theme, layout, and navigation
 */

import { create } from 'zustand';
import { persist, subscribeWithSelector } from 'zustand/middleware';
import { devtools } from 'zustand/middleware';

export type Theme = 'light' | 'dark' | 'system';
export type LayoutMode = 'default' | 'enhanced' | 'enhanced-mockup' | 'modern' | 'cci';
export type SidebarState = 'expanded' | 'collapsed' | 'hidden';

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  persistent?: boolean;
}

export interface Modal {
  id: string;
  component: string;
  props?: any;
  options?: {
    dismissible?: boolean;
    backdrop?: boolean;
    size?: 'sm' | 'md' | 'lg' | 'xl';
  };
}

export interface UIState {
  // Theme and appearance
  theme: Theme;
  isDarkMode: boolean;
  layoutMode: LayoutMode;
  sidebarState: SidebarState;

  // Navigation
  activeRoute: string;
  breadcrumbs: Array<{ label: string; path?: string }>;

  // UI components state
  notifications: Notification[];
  modals: Modal[];
  isCommandPaletteOpen: boolean;
  searchQuery: string;

  // Loading states
  globalLoading: boolean;
  loadingStates: Record<string, boolean>;

  // Actions
  setTheme: (theme: Theme) => void;
  toggleDarkMode: () => void;
  setLayoutMode: (mode: LayoutMode) => void;
  setSidebarState: (state: SidebarState) => void;
  toggleSidebar: () => void;

  // Navigation actions
  setActiveRoute: (route: string) => void;
  setBreadcrumbs: (breadcrumbs: Array<{ label: string; path?: string }>) => void;

  // Notification actions
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  removeNotification: (id: string) => void;
  markNotificationAsRead: (id: string) => void;
  clearAllNotifications: () => void;

  // Modal actions
  openModal: (modal: Omit<Modal, 'id'>) => void;
  closeModal: (id: string) => void;
  closeAllModals: () => void;

  // Command palette
  toggleCommandPalette: () => void;
  setSearchQuery: (query: string) => void;

  // Loading actions
  setGlobalLoading: (loading: boolean) => void;
  setLoadingState: (key: string, loading: boolean) => void;
  clearLoadingState: (key: string) => void;
}

export const useUIStore = create<UIState>()(
  devtools(
    persist(
      subscribeWithSelector((set, get) => ({
        // Initial state
        theme: 'system',
        isDarkMode: false,
        layoutMode: 'default',
        sidebarState: 'expanded',
        activeRoute: '/',
        breadcrumbs: [],
        notifications: [],
        modals: [],
        isCommandPaletteOpen: false,
        searchQuery: '',
        globalLoading: false,
        loadingStates: {},

        // Theme actions
        setTheme: (theme: Theme) => {
          set({ theme });
          // Apply theme logic
          const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          const isDark = theme === 'dark' || (theme === 'system' && prefersDark);
          set({ isDarkMode: isDark });

          // Update document class
          if (isDark) {
            document.documentElement.classList.add('dark');
          } else {
            document.documentElement.classList.remove('dark');
          }
        },

        toggleDarkMode: () => {
          const { theme, isDarkMode } = get();
          if (theme === 'system') {
            // Switch to explicit mode
            set({ theme: isDarkMode ? 'light' : 'dark', isDarkMode: !isDarkMode });
          } else {
            // Toggle explicit mode
            const newTheme = theme === 'dark' ? 'light' : 'dark';
            set({ theme: newTheme, isDarkMode: newTheme === 'dark' });
          }

          // Update document class
          const { isDarkMode: newIsDarkMode } = get();
          if (newIsDarkMode) {
            document.documentElement.classList.add('dark');
          } else {
            document.documentElement.classList.remove('dark');
          }
        },

        setLayoutMode: (mode: LayoutMode) => {
          set({ layoutMode: mode });
        },

        setSidebarState: (state: SidebarState) => {
          set({ sidebarState: state });
        },

        toggleSidebar: () => {
          const { sidebarState } = get();
          const newState = sidebarState === 'expanded' ? 'collapsed' : 'expanded';
          set({ sidebarState: newState });
        },

        // Navigation actions
        setActiveRoute: (route: string) => {
          set({ activeRoute: route });
        },

        setBreadcrumbs: (breadcrumbs: Array<{ label: string; path?: string }>) => {
          set({ breadcrumbs });
        },

        // Notification actions
        addNotification: (notification) => {
          const id = `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const newNotification: Notification = {
            ...notification,
            id,
            timestamp: new Date().toISOString(),
            read: false
          };

          set((state) => ({
            notifications: [...state.notifications, newNotification]
          }));

          // Auto-remove non-persistent notifications after 5 seconds
          if (!notification.persistent) {
            setTimeout(() => {
              set((state) => ({
                notifications: state.notifications.filter((n) => n.id !== id)
              }));
            }, 5000);
          }
        },

        removeNotification: (id: string) => {
          set((state) => ({
            notifications: state.notifications.filter((n) => n.id !== id)
          }));
        },

        markNotificationAsRead: (id: string) => {
          set((state) => ({
            notifications: state.notifications.map((n) => (n.id === id ? { ...n, read: true } : n))
          }));
        },

        clearAllNotifications: () => {
          set({ notifications: [] });
        },

        // Modal actions
        openModal: (modal) => {
          const id = `modal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const newModal: Modal = { ...modal, id };

          set((state) => ({
            modals: [...state.modals, newModal]
          }));
        },

        closeModal: (id: string) => {
          set((state) => ({
            modals: state.modals.filter((m) => m.id !== id)
          }));
        },

        closeAllModals: () => {
          set({ modals: [] });
        },

        // Command palette actions
        toggleCommandPalette: () => {
          set((state) => ({
            isCommandPaletteOpen: !state.isCommandPaletteOpen
          }));
        },

        setSearchQuery: (query: string) => {
          set({ searchQuery: query });
        },

        // Loading actions
        setGlobalLoading: (loading: boolean) => {
          set({ globalLoading: loading });
        },

        setLoadingState: (key: string, loading: boolean) => {
          set((state) => ({
            loadingStates: {
              ...state.loadingStates,
              [key]: loading
            }
          }));
        },

        clearLoadingState: (key: string) => {
          set((state) => {
            const { [key]: removed, ...rest } = state.loadingStates;
            return { loadingStates: rest };
          });
        }
      })),
      {
        name: 'ui-storage',
        partialize: (state) => ({
          theme: state.theme,
          layoutMode: state.layoutMode,
          sidebarState: state.sidebarState
        })
      }
    ),
    { name: 'ui-store' }
  )
);

// Initialize theme on store creation
useUIStore.getState().setTheme(useUIStore.getState().theme);

// Listen for system theme changes
if (typeof window !== 'undefined') {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    const { theme, setTheme } = useUIStore.getState();
    if (theme === 'system') {
      setTheme('system'); // This will trigger the theme update
    }
  });
}

// Selector hooks for better performance
export const useTheme = () =>
  useUIStore((state) => ({
    theme: state.theme,
    isDarkMode: state.isDarkMode,
    setTheme: state.setTheme,
    toggleDarkMode: state.toggleDarkMode
  }));

export const useLayout = () =>
  useUIStore((state) => ({
    layoutMode: state.layoutMode,
    sidebarState: state.sidebarState,
    setLayoutMode: state.setLayoutMode,
    setSidebarState: state.setSidebarState,
    toggleSidebar: state.toggleSidebar
  }));

export const useNavigation = () =>
  useUIStore((state) => ({
    activeRoute: state.activeRoute,
    breadcrumbs: state.breadcrumbs,
    setActiveRoute: state.setActiveRoute,
    setBreadcrumbs: state.setBreadcrumbs
  }));

export const useNotifications = () =>
  useUIStore((state) => ({
    notifications: state.notifications,
    addNotification: state.addNotification,
    removeNotification: state.removeNotification,
    markNotificationAsRead: state.markNotificationAsRead,
    clearAllNotifications: state.clearAllNotifications
  }));

export const useModals = () =>
  useUIStore((state) => ({
    modals: state.modals,
    openModal: state.openModal,
    closeModal: state.closeModal,
    closeAllModals: state.closeAllModals
  }));

export const useCommandPalette = () =>
  useUIStore((state) => ({
    isCommandPaletteOpen: state.isCommandPaletteOpen,
    searchQuery: state.searchQuery,
    toggleCommandPalette: state.toggleCommandPalette,
    setSearchQuery: state.setSearchQuery
  }));

export const useLoading = () =>
  useUIStore((state) => ({
    globalLoading: state.globalLoading,
    loadingStates: state.loadingStates,
    setGlobalLoading: state.setGlobalLoading,
    setLoadingState: state.setLoadingState,
    clearLoadingState: state.clearLoadingState
  }));
