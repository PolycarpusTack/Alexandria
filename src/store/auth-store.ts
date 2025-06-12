/**
 * Authentication Store using Zustand
 * Manages user authentication state across the application
 */

import { create } from 'zustand';
import { persist, subscribeWithSelector } from 'zustand/middleware';
import { devtools } from 'zustand/middleware';
import { logger, security } from '../utils/logger.browser';

export interface User {
  id: string;
  email: string;
  name?: string;
  username?: string;
  role?: string;
  avatar?: string;
  permissions?: string[];
  profile?: {
    preferences?: any;
    settings?: any;
  };
}

export interface AuthState {
  // State
  isAuthenticated: boolean;
  token: string | null;
  refreshToken: string | null;
  user: User | null;
  isLoading: boolean;
  error: string | null;
  lastLogin: string | null;
  sessionExpiry: string | null;

  // Actions
  login: (token: string, user: User, refreshToken?: string) => void;
  logout: () => void;
  setUser: (user: User) => void;
  updateProfile: (updates: Partial<User['profile']>) => void;
  setError: (error: string | null) => void;
  setLoading: (loading: boolean) => void;
  refreshSession: (newToken: string, newExpiry?: string) => void;
  clearError: () => void;

  // Computed
  isTokenExpired: () => boolean;
  hasPermission: (permission: string) => boolean;
  isAdmin: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  devtools(
    persist(
      subscribeWithSelector((set, get) => ({
        // Initial state
        isAuthenticated: false,
        token: null,
        refreshToken: null,
        user: null,
        isLoading: false,
        error: null,
        lastLogin: null,
        sessionExpiry: null,

        // Actions
        login: (token: string, user: User, refreshToken?: string) => {
          const now = new Date();
          const expiry = new Date();
          expiry.setHours(expiry.getHours() + 24); // 24 hours default

          set({
            isAuthenticated: true,
            token,
            refreshToken: refreshToken || null,
            user,
            error: null,
            lastLogin: now.toISOString(),
            sessionExpiry: expiry.toISOString(),
            isLoading: false
          });
        },

        logout: () => {
          set({
            isAuthenticated: false,
            token: null,
            refreshToken: null,
            user: null,
            error: null,
            lastLogin: null,
            sessionExpiry: null,
            isLoading: false
          });
        },

        setUser: (user: User) => {
          set({ user, error: null });
        },

        updateProfile: (updates: Partial<User['profile']>) => {
          const currentUser = get().user;
          if (currentUser) {
            set({
              user: {
                ...currentUser,
                profile: {
                  ...currentUser.profile,
                  ...updates
                }
              }
            });
          }
        },

        setError: (error: string | null) => {
          set({ error, isLoading: false });
        },

        setLoading: (loading: boolean) => {
          set({ isLoading: loading });
        },

        refreshSession: (newToken: string, newExpiry?: string) => {
          const expiry = newExpiry || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
          set({
            token: newToken,
            sessionExpiry: expiry,
            error: null
          });
        },

        clearError: () => {
          set({ error: null });
        },

        // Computed functions
        isTokenExpired: () => {
          const { sessionExpiry } = get();
          if (!sessionExpiry) return true;
          return new Date() > new Date(sessionExpiry);
        },

        hasPermission: (permission: string) => {
          const { user } = get();
          return user?.permissions?.includes(permission) || false;
        },

        isAdmin: () => {
          const { user } = get();
          return user?.role === 'admin' || user?.permissions?.includes('admin') || false;
        }
      })),
      {
        name: 'auth-storage',
        partialize: (state) => ({
          isAuthenticated: state.isAuthenticated,
          token: state.token,
          refreshToken: state.refreshToken,
          user: state.user,
          lastLogin: state.lastLogin,
          sessionExpiry: state.sessionExpiry
        }),
        // Handle hydration
        onRehydrateStorage: () => (state) => {
          if (state) {
            // Check if token is expired on hydration
            if (state.isTokenExpired()) {
              state.logout();
            }
          }
        }
      }
    ),
    { name: 'auth-store' }
  )
);

// Subscribe to auth changes for side effects
useAuthStore.subscribe(
  (state) => state.isAuthenticated,
  (isAuthenticated, previousIsAuthenticated) => {
    // Handle authentication state changes
    if (isAuthenticated && !previousIsAuthenticated) {
      const state = useAuthStore.getState();
      logger.info('User authenticated', { userId: state.user?.id });
      security.authEvent('success', state.user?.id);
      // Could trigger analytics, notifications, etc.
    } else if (!isAuthenticated && previousIsAuthenticated) {
      logger.info('User logged out');
      // Clear any user-specific data, close connections, etc.
    }
  }
);

// Selector hooks for better performance
export const useAuth = () =>
  useAuthStore((state) => ({
    isAuthenticated: state.isAuthenticated,
    user: state.user,
    isLoading: state.isLoading,
    error: state.error
  }));

export const useAuthActions = () =>
  useAuthStore((state) => ({
    login: state.login,
    logout: state.logout,
    setUser: state.setUser,
    updateProfile: state.updateProfile,
    setError: state.setError,
    setLoading: state.setLoading,
    refreshSession: state.refreshSession,
    clearError: state.clearError
  }));

export const useAuthUtils = () =>
  useAuthStore((state) => ({
    isTokenExpired: state.isTokenExpired,
    hasPermission: state.hasPermission,
    isAdmin: state.isAdmin
  }));
