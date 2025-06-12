/**
 * UI Framework interfaces for the Alexandria Platform
 *
 * These interfaces define the UI framework and component library that provides
 * a consistent user interface across the platform and plugins.
 */

import { ReactNode, ComponentType } from 'react';

/**
 * UI Component Type
 */
export enum UIComponentType {
  NAVIGATION = 'navigation',
  CONTENT = 'content',
  WIDGET = 'widget',
  MODAL = 'modal',
  ACTION = 'action'
}

/**
 * UI Component Position
 */
export enum UIComponentPosition {
  HEADER = 'header',
  SIDEBAR = 'sidebar',
  MAIN = 'main',
  FOOTER = 'footer'
}

/**
 * UI Component Priority
 * Higher priority components are rendered first/above other components
 */
export enum UIComponentPriority {
  HIGHEST = 100,
  HIGH = 75,
  MEDIUM = 50,
  LOW = 25,
  LOWEST = 0
}

/**
 * UI Component Size
 */
export enum UIComponentSize {
  SMALL = 'small',
  MEDIUM = 'medium',
  LARGE = 'large',
  FULL = 'full'
}

/**
 * UI Component interface
 */
export interface UIComponentDefinition {
  /**
   * Unique identifier for the component
   */
  id: string;

  /**
   * Component type
   */
  type: UIComponentType;

  /**
   * Component position
   */
  position?: UIComponentPosition;

  /**
   * React component to render
   */
  component: ComponentType<any>;

  /**
   * Props to pass to the component
   */
  props?: Record<string, any>;

  /**
   * Required permissions to view this component
   */
  permissions?: string[];

  /**
   * Component priority (higher number = higher priority)
   */
  priority?: number;

  /**
   * Component size
   */
  size?: UIComponentSize;

  /**
   * Plugin ID that registered this component
   */
  pluginId?: string;

  /**
   * Feature flag key that controls this component
   */
  featureFlag?: string;
}

/**
 * UI Route interface
 */
export interface UIRoute {
  /**
   * Route path
   */
  path: string;

  /**
   * Component to render for this route
   */
  component: ComponentType<any>;

  /**
   * Required permissions to access this route
   */
  permissions?: string[];

  /**
   * Plugin ID that registered this route
   */
  pluginId?: string;

  /**
   * Feature flag key that controls this route
   */
  featureFlag?: string;

  /**
   * Whether this route is exact match only
   */
  exact?: boolean;
}

/**
 * UI Theme interface
 */
export interface UITheme {
  /**
   * Theme ID
   */
  id: string;

  /**
   * Display name
   */
  name: string;

  /**
   * Color palette
   */
  colors: {
    primary: string;
    secondary: string;
    background: string;
    surface: string;
    error: string;
    text: {
      primary: string;
      secondary: string;
      disabled: string;
    };
    [key: string]: any;
  };

  /**
   * Spacing scale
   */
  spacing: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
    xxl: string;
  };

  /**
   * Typography settings
   */
  typography: {
    fontFamily: string;
    fontSize: {
      xs: string;
      sm: string;
      md: string;
      lg: string;
      xl: string;
      xxl: string;
    };
    fontWeight: {
      light: number;
      regular: number;
      medium: number;
      bold: number;
    };
  };

  /**
   * Border radius
   */
  borderRadius: {
    sm: string;
    md: string;
    lg: string;
    pill: string;
  };

  /**
   * Shadows
   */
  shadows: {
    sm: string;
    md: string;
    lg: string;
  };

  /**
   * Transitions
   */
  transitions: {
    fast: string;
    medium: string;
    slow: string;
  };

  /**
   * Z-index scale
   */
  zIndex: {
    base: number;
    dropdown: number;
    sticky: number;
    fixed: number;
    modal: number;
    popover: number;
    toast: number;
  };
}

/**
 * UI Registry interface
 */
export interface UIRegistry {
  /**
   * Register a UI component
   */
  registerComponent(component: UIComponentDefinition): void;

  /**
   * Unregister a UI component
   */
  unregisterComponent(id: string): void;

  /**
   * Get all registered components
   */
  getAllComponents(): UIComponentDefinition[];

  /**
   * Get components by type
   */
  getComponentsByType(type: UIComponentType): UIComponentDefinition[];

  /**
   * Get components by position
   */
  getComponentsByPosition(position: UIComponentPosition): UIComponentDefinition[];

  /**
   * Register a UI route
   */
  registerRoute(route: UIRoute): void;

  /**
   * Unregister a UI route
   */
  unregisterRoute(path: string): void;

  /**
   * Get all registered routes
   */
  getAllRoutes(): UIRoute[];

  /**
   * Register a UI theme
   */
  registerTheme(theme: UITheme): void;

  /**
   * Get a UI theme by ID
   */
  getTheme(id: string): UITheme | undefined;

  /**
   * Set the active theme
   */
  setActiveTheme(id: string): void;

  /**
   * Get the active theme
   */
  getActiveTheme(): UITheme;
}

/**
 * UI Shell Props interface
 */
export interface UIShellProps {
  /**
   * UI Registry instance
   */
  uiRegistry: UIRegistry;

  /**
   * Children components
   */
  children?: ReactNode;
}

/**
 * UI Context interface
 */
export interface UIContext {
  /**
   * UI Registry instance
   */
  uiRegistry: UIRegistry;

  /**
   * Active theme
   */
  theme: UITheme;

  /**
   * Set the active theme
   */
  setTheme: (id: string) => void;

  /**
   * Whether to use dark mode
   */
  darkMode: boolean;

  /**
   * Toggle dark mode
   */
  toggleDarkMode: () => void;

  /**
   * Open a modal
   */
  openModal: (id: string, props?: Record<string, any>) => void;

  /**
   * Close a modal
   */
  closeModal: (id: string) => void;

  /**
   * Show a modal (alias for openModal)
   */
  showModal: (id: string, props?: Record<string, any>) => void;

  /**
   * Show a notification
   */
  showNotification: (notification: {
    title: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
    duration?: number;
  }) => void;
}
