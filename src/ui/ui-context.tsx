/**
 * UI Context for the Alexandria Platform
 *
 * This file provides the UI context that is used throughout the platform
 * to access UI components, themes, and functionality.
 */

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { UIRegistry, UIComponentType } from './interfaces';
import { darkTheme, defaultTheme } from './themes/default-theme';
import { createClientLogger } from '../client/utils/client-logger';

const logger = createClientLogger({ serviceName: 'ui-context' });

// Create the context with a default value
export type { UIContextInterface };
export const UIContext = createContext<UIContextInterface | undefined>(undefined);

// Props for the UI Context Provider
interface UIContextProviderProps {
  uiRegistry: UIRegistry;
  children: ReactNode;
}

/**
 * UI Context Provider component
 *
 * Provides UI context to all child components
 */
export const UIContextProvider: React.FC<UIContextProviderProps> = ({ uiRegistry, children }) => {
  const [activeThemeId, setActiveThemeId] = useState<string>(uiRegistry.getActiveTheme().id);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [activeModals, setActiveModals] = useState<Record<string, Record<string, any>>>({});

  // Get the active theme
  const activeTheme = uiRegistry.getTheme(activeThemeId) || defaultTheme;

  // Set the active theme
  const setTheme = useCallback(
    (id: string) => {
      uiRegistry.setActiveTheme(id);
      setActiveThemeId(id);
    },
    [uiRegistry]
  );

  // Toggle dark mode
  const toggleDarkMode = useCallback(() => {
    setIsDarkMode((prev) => {
      const newDarkMode = !prev;

      // Set the appropriate theme based on dark mode
      if (newDarkMode) {
        uiRegistry.setActiveTheme('dark');
        setActiveThemeId('dark');
      } else {
        uiRegistry.setActiveTheme('default');
        setActiveThemeId('default');
      }

      return newDarkMode;
    });
  }, [uiRegistry]);

  // Open a modal
  const openModal = useCallback((id: string, props: Record<string, any> = {}) => {
    setActiveModals((prev) => ({
      ...prev,
      [id]: props
    }));
  }, []);

  // Close a modal
  const closeModal = useCallback((id: string) => {
    setActiveModals((prev) => {
      const newModals = { ...prev };
      delete newModals[id];
      return newModals;
    });
  }, []);

  // Show a notification
  const showNotification = useCallback(
    (notification: {
      title: string;
      message: string;
      type: 'info' | 'success' | 'warning' | 'error';
      duration?: number;
    }) => {
      // In a real implementation, this would dispatch to a notification system
      logger.info('Notification shown', notification);
    },
    []
  );

  // Ensure both light and dark themes are registered
  if (!uiRegistry.getTheme('dark')) {
    uiRegistry.registerTheme(darkTheme);
  }

  // Create the context value
  const contextValue: UIContextInterface = {
    uiRegistry,
    theme: activeTheme,
    setTheme,
    darkMode: isDarkMode,
    toggleDarkMode,
    openModal,
    closeModal,
    showModal: openModal, // Alias for openModal
    showNotification
  };

  return (
    <UIContext.Provider value={contextValue}>
      {children}

      {/* Render active modals */}
      {Object.entries(activeModals).map(([id, props]) => {
        const modalComponents = uiRegistry
          .getComponentsByType(UIComponentType.MODAL)
          .filter((component) => component.id === id);

        if (modalComponents.length === 0) {
          return null;
        }

        const ModalComponent = modalComponents[0].component;

        return <ModalComponent key={id} {...props} onClose={() => closeModal(id)} />;
      })}
    </UIContext.Provider>
  );
};

/**
 * Hook to use the UI context
 */
export const useUI = (): UIContextInterface => {
  const context = useContext(UIContext);

  if (!context) {
    throw new Error('useUI must be used within a UIContextProvider');
  }

  return context;
};

/**
 * Alias for useUI to maintain compatibility with components expecting useUIContext
 */
export const useUIContext = useUI;
