/**
 * Centralized Store Index
 * Exports all Zustand stores and provides store utilities
 */

// Export individual stores
export * from './auth-store';
export * from './ui-store';
export * from './plugin-store';

// Re-export Zustand utilities
export { create } from 'zustand';
export { persist, subscribeWithSelector, devtools } from 'zustand/middleware';

// Store provider for React context (if needed)
import React, { createContext, useContext } from 'react';
import { useAuthStore } from './auth-store';
import { useUIStore } from './ui-store';
import { usePluginStore } from './plugin-store';

export interface StoreContextType {
  authStore: typeof useAuthStore;
  uiStore: typeof useUIStore;
  pluginStore: typeof usePluginStore;
}

const StoreContext = createContext<StoreContextType | null>(null);

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const stores = {
    authStore: useAuthStore,
    uiStore: useUIStore,
    pluginStore: usePluginStore
  };

  return <StoreContext.Provider value={stores}>{children}</StoreContext.Provider>;
};

export const useStores = () => {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStores must be used within a StoreProvider');
  }
  return context;
};

// Store reset utility for testing or logout
export const resetAllStores = () => {
  useAuthStore.getState().logout();
  useUIStore.setState(
    {
      notifications: [],
      modals: [],
      isCommandPaletteOpen: false,
      searchQuery: '',
      globalLoading: false,
      loadingStates: {}
    },
    false
  );
  usePluginStore.setState(
    {
      pluginData: {},
      errors: []
    },
    false
  );
};

// Store hydration utility
export const hydrateStores = () => {
  // Trigger rehydration of persisted stores
  useAuthStore.persist.rehydrate();
  useUIStore.persist.rehydrate();
  usePluginStore.persist.rehydrate();
};

// Store debugging utilities (development only)
if (process.env.NODE_ENV === 'development') {
  (window as any).__ALEXANDRIA_STORES__ = {
    auth: useAuthStore,
    ui: useUIStore,
    plugin: usePluginStore,
    reset: resetAllStores,
    hydrate: hydrateStores
  };
}
