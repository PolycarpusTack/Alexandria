/**
 * Plugin State Store using Zustand
 * Manages plugin system state and configuration
 */

import { create } from 'zustand';
import { persist, subscribeWithSelector } from 'zustand/middleware';
import { devtools } from 'zustand/middleware';
import { logger } from '../utils/logger';

export interface PluginConfig {
  [key: string]: any;
}

export interface PluginState {
  id: string;
  name: string;
  version: string;
  status: 'active' | 'inactive' | 'loading' | 'error' | 'beta';
  config: PluginConfig;
  lastUpdated: string;
  dependencies: string[];
  routes: string[];
  permissions: string[];
  error?: string;
}

export interface PluginStoreState {
  // Plugin registry
  plugins: Record<string, PluginState>;
  activePlugins: string[];
  loadingPlugins: string[];

  // Plugin data/state
  pluginData: Record<string, any>;

  // Registry state
  isInitialized: boolean;
  lastSync: string | null;
  errors: string[];

  // Actions
  addPlugin: (plugin: PluginState) => void;
  updatePlugin: (id: string, updates: Partial<PluginState>) => void;
  removePlugin: (id: string) => void;
  activatePlugin: (id: string) => void;
  deactivatePlugin: (id: string) => void;

  // Plugin configuration
  updatePluginConfig: (id: string, config: Partial<PluginConfig>) => void;
  resetPluginConfig: (id: string) => void;

  // Plugin data management
  setPluginData: (pluginId: string, key: string, data: any) => void;
  getPluginData: (pluginId: string, key: string) => any;
  clearPluginData: (pluginId: string) => void;

  // Registry management
  syncRegistry: () => Promise<void>;
  setInitialized: (initialized: boolean) => void;
  addError: (error: string) => void;
  clearErrors: () => void;

  // Selectors
  getPlugin: (id: string) => PluginState | undefined;
  getActivePlugins: () => PluginState[];
  getPluginsByStatus: (status: PluginState['status']) => PluginState[];
  isPluginActive: (id: string) => boolean;
  hasPermission: (pluginId: string, permission: string) => boolean;
}

export const usePluginStore = create<PluginStoreState>()(
  devtools(
    persist(
      subscribeWithSelector((set, get) => ({
        // Initial state
        plugins: {},
        activePlugins: [],
        loadingPlugins: [],
        pluginData: {},
        isInitialized: false,
        lastSync: null,
        errors: [],

        // Plugin management actions
        addPlugin: (plugin: PluginState) => {
          set((state) => ({
            plugins: {
              ...state.plugins,
              [plugin.id]: plugin
            }
          }));
        },

        updatePlugin: (id: string, updates: Partial<PluginState>) => {
          set((state) => ({
            plugins: {
              ...state.plugins,
              [id]: state.plugins[id]
                ? {
                    ...state.plugins[id],
                    ...updates,
                    lastUpdated: new Date().toISOString()
                  }
                : state.plugins[id]
            }
          }));
        },

        removePlugin: (id: string) => {
          set((state) => {
            const { [id]: removed, ...remainingPlugins } = state.plugins;
            const { [id]: removedData, ...remainingData } = state.pluginData;

            return {
              plugins: remainingPlugins,
              pluginData: remainingData,
              activePlugins: state.activePlugins.filter((pid) => pid !== id),
              loadingPlugins: state.loadingPlugins.filter((pid) => pid !== id)
            };
          });
        },

        activatePlugin: (id: string) => {
          const plugin = get().plugins[id];
          if (!plugin) return;

          set((state) => ({
            activePlugins: state.activePlugins.includes(id)
              ? state.activePlugins
              : [...state.activePlugins, id],
            loadingPlugins: state.loadingPlugins.filter((pid) => pid !== id),
            plugins: {
              ...state.plugins,
              [id]: {
                ...plugin,
                status: 'active',
                lastUpdated: new Date().toISOString()
              }
            }
          }));
        },

        deactivatePlugin: (id: string) => {
          const plugin = get().plugins[id];
          if (!plugin) return;

          set((state) => ({
            activePlugins: state.activePlugins.filter((pid) => pid !== id),
            loadingPlugins: state.loadingPlugins.filter((pid) => pid !== id),
            plugins: {
              ...state.plugins,
              [id]: {
                ...plugin,
                status: 'inactive',
                lastUpdated: new Date().toISOString()
              }
            }
          }));
        },

        // Configuration management
        updatePluginConfig: (id: string, config: Partial<PluginConfig>) => {
          set((state) => ({
            plugins: {
              ...state.plugins,
              [id]: state.plugins[id]
                ? {
                    ...state.plugins[id],
                    config: {
                      ...state.plugins[id].config,
                      ...config
                    },
                    lastUpdated: new Date().toISOString()
                  }
                : state.plugins[id]
            }
          }));
        },

        resetPluginConfig: (id: string) => {
          set((state) => ({
            plugins: {
              ...state.plugins,
              [id]: state.plugins[id]
                ? {
                    ...state.plugins[id],
                    config: {},
                    lastUpdated: new Date().toISOString()
                  }
                : state.plugins[id]
            }
          }));
        },

        // Plugin data management
        setPluginData: (pluginId: string, key: string, data: any) => {
          set((state) => ({
            pluginData: {
              ...state.pluginData,
              [pluginId]: {
                ...state.pluginData[pluginId],
                [key]: data
              }
            }
          }));
        },

        getPluginData: (pluginId: string, key: string) => {
          const state = get();
          return state.pluginData[pluginId]?.[key];
        },

        clearPluginData: (pluginId: string) => {
          set((state) => {
            const { [pluginId]: removed, ...remaining } = state.pluginData;
            return { pluginData: remaining };
          });
        },

        // Registry management
        syncRegistry: async () => {
          set({ lastSync: new Date().toISOString() });
          // In a real implementation, this would sync with the backend
          try {
            // Mock sync operation
            await new Promise((resolve) => setTimeout(resolve, 1000));
            logger.info('Plugin registry synced successfully');
          } catch (error) {
            get().addError(`Failed to sync plugin registry: ${error}`);
          }
        },

        setInitialized: (initialized: boolean) => {
          set({ isInitialized: initialized });
        },

        addError: (error: string) => {
          set((state) => ({
            errors: [...state.errors, error]
          }));
        },

        clearErrors: () => {
          set({ errors: [] });
        },

        // Selectors
        getPlugin: (id: string) => {
          return get().plugins[id];
        },

        getActivePlugins: () => {
          const state = get();
          return state.activePlugins.map((id) => state.plugins[id]).filter(Boolean);
        },

        getPluginsByStatus: (status: PluginState['status']) => {
          const state = get();
          return Object.values(state.plugins).filter((plugin) => plugin.status === status);
        },

        isPluginActive: (id: string) => {
          return get().activePlugins.includes(id);
        },

        hasPermission: (pluginId: string, permission: string) => {
          const plugin = get().plugins[pluginId];
          return plugin?.permissions.includes(permission) || false;
        }
      })),
      {
        name: 'plugin-storage',
        partialize: (state) => ({
          plugins: state.plugins,
          activePlugins: state.activePlugins,
          pluginData: state.pluginData,
          lastSync: state.lastSync
        })
      }
    ),
    { name: 'plugin-store' }
  )
);

// Subscribe to plugin activation/deactivation for side effects
usePluginStore.subscribe(
  (state) => state.activePlugins,
  (activePlugins, previousActivePlugins) => {
    // Handle plugin activation/deactivation
    const activated = activePlugins.filter((id) => !previousActivePlugins.includes(id));
    const deactivated = previousActivePlugins.filter((id) => !activePlugins.includes(id));

    activated.forEach((id) => {
      logger.info('Plugin activated', { pluginId: id });
      // Could trigger plugin initialization, route registration, etc.
    });

    deactivated.forEach((id) => {
      logger.info('Plugin deactivated', { pluginId: id });
      // Could trigger cleanup, route deregistration, etc.
    });
  }
);

// Selector hooks for better performance
export const usePlugins = () =>
  usePluginStore((state) => ({
    plugins: state.plugins,
    activePlugins: state.activePlugins,
    loadingPlugins: state.loadingPlugins,
    isInitialized: state.isInitialized
  }));

export const usePluginActions = () =>
  usePluginStore((state) => ({
    addPlugin: state.addPlugin,
    updatePlugin: state.updatePlugin,
    removePlugin: state.removePlugin,
    activatePlugin: state.activatePlugin,
    deactivatePlugin: state.deactivatePlugin,
    updatePluginConfig: state.updatePluginConfig,
    resetPluginConfig: state.resetPluginConfig,
    syncRegistry: state.syncRegistry
  }));

export const usePluginData = () =>
  usePluginStore((state) => ({
    setPluginData: state.setPluginData,
    getPluginData: state.getPluginData,
    clearPluginData: state.clearPluginData
  }));

export const usePluginSelectors = () =>
  usePluginStore((state) => ({
    getPlugin: state.getPlugin,
    getActivePlugins: state.getActivePlugins,
    getPluginsByStatus: state.getPluginsByStatus,
    isPluginActive: state.isPluginActive,
    hasPermission: state.hasPermission
  }));
