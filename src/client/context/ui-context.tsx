/**
 * UI Context for the client application
 *
 * This context provides UI state and functions to the entire client application
 */

import React, { createContext, useContext, useState, useEffect } from 'react';

// Interface for UI Registry
export interface UIRegistry {
  registerComponent: (component: UIComponent) => void;
  unregisterComponent: (id: string) => void;
  getComponentsByType: (type: UIComponent['type']) => UIComponent[];
  getComponentsByPosition: (position: UIComponent['position']) => UIComponent[];
}

// Interface for UI Component
export interface UIComponent {
  id: string;
  type: 'navigation' | 'content' | 'widget' | 'modal';
  position?: 'header' | 'sidebar' | 'main' | 'footer';
  component: React.ComponentType<any>;
  props?: Record<string, any>;
  permissions?: string[];
}

// Simple UI Registry implementation
export class UIRegistryImpl implements UIRegistry {
  private components: Map<string, UIComponent> = new Map();
  private logger: any;

  constructor(logger: any) {
    this.logger = logger;
  }

  registerComponent(component: UIComponent): void {
    if (!component.id) {
      this.logger.error('Cannot register component without ID');
      return;
    }

    this.components.set(component.id, component);
    this.logger.debug(`Registered UI component: ${component.id}`, {
      type: component.type,
      position: component.position
    });
  }

  unregisterComponent(id: string): void {
    if (this.components.delete(id)) {
      this.logger.debug(`Unregistered UI component: ${id}`);
    }
  }

  getComponentsByType(type: UIComponent['type']): UIComponent[] {
    return Array.from(this.components.values()).filter((component) => component.type === type);
  }

  getComponentsByPosition(position: UIComponent['position']): UIComponent[] {
    return Array.from(this.components.values()).filter(
      (component) => component.position === position
    );
  }
}

// Interface for UI Context
interface UIContextType {
  uiRegistry: UIRegistry;
  theme: 'default' | 'minimal' | 'contrast';
  darkMode: boolean;
  toggleDarkMode: () => void;
  setTheme: (theme: 'default' | 'minimal' | 'contrast') => void;
}

// Create context
export const UIContext = createContext<UIContextType | undefined>(undefined);

// Provider component
export const UIContextProvider: React.FC<{
  children: React.ReactNode;
  uiRegistry: UIRegistry;
}> = ({ children, uiRegistry }) => {
  const [darkMode, setDarkMode] = useState(false);
  const [theme, setTheme] = useState<'default' | 'minimal' | 'contrast'>('default');

  // Initialize dark mode from user preferences
  useEffect(() => {
    // Check local storage first
    const storedDarkMode = localStorage.getItem('darkMode');
    if (storedDarkMode !== null) {
      setDarkMode(storedDarkMode === 'true');
    } else {
      // Otherwise, check system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setDarkMode(prefersDark);
    }

    // Check stored theme
    const storedTheme = localStorage.getItem('theme');
    if (storedTheme) {
      setTheme(storedTheme as 'default' | 'minimal' | 'contrast');
    }
  }, []);

  // Apply dark mode class to document
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('darkMode', String(darkMode));
  }, [darkMode]);

  // Update stored theme when changed
  useEffect(() => {
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Toggle dark mode
  const toggleDarkMode = () => {
    setDarkMode((prev) => !prev);
  };

  // Set theme
  const handleSetTheme = (newTheme: 'default' | 'minimal' | 'contrast') => {
    setTheme(newTheme);
  };

  const value = {
    uiRegistry,
    theme,
    darkMode,
    toggleDarkMode,
    setTheme: handleSetTheme
  };

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
};

// Hook to use the UI context
export const useUI = () => {
  const context = useContext(UIContext);
  if (context === undefined) {
    throw new Error('useUI must be used within a UIContextProvider');
  }
  return context;
};
