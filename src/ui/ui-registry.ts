/**
 * UI Registry implementation for the Alexandria Platform
 *
 * This class manages UI components, routes, and themes for the platform.
 */

import {
  UIRegistry,
  UIComponentDefinition,
  UIComponentType,
  UIComponentPosition,
  UIComponentPriority,
  UIRoute,
  UITheme
} from './interfaces';
import { Logger } from '../utils/logger';
import { defaultTheme } from './themes/default-theme';

/**
 * UI Registry implementation
 */
export class UIRegistryImpl implements UIRegistry {
  private components: Map<string, UIComponentDefinition> = new Map();
  private routes: Map<string, UIRoute> = new Map();
  private themes: Map<string, UITheme> = new Map();
  private activeThemeId: string = 'default';
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;

    // Register default theme
    this.registerTheme(defaultTheme);
  }

  /**
   * Register a UI component
   */
  registerComponent(component: UIComponentDefinition): void {
    // Check if component already exists
    if (this.components.has(component.id)) {
      this.logger.warn(`Component with ID ${component.id} already exists and will be overwritten`, {
        component: 'UIRegistry',
        componentId: component.id,
        pluginId: component.pluginId
      });
    }

    // Set default priority if not provided
    if (component.priority === undefined) {
      component.priority = UIComponentPriority.MEDIUM;
    }

    // Store component
    this.components.set(component.id, component);

    this.logger.debug(`Registered UI component: ${component.id}`, {
      component: 'UIRegistry',
      componentType: component.type,
      position: component.position,
      pluginId: component.pluginId
    });
  }

  /**
   * Unregister a UI component
   */
  unregisterComponent(id: string): void {
    if (this.components.has(id)) {
      const component = this.components.get(id)!;
      this.components.delete(id);

      this.logger.debug(`Unregistered UI component: ${id}`, {
        component: 'UIRegistry',
        componentType: component.type,
        pluginId: component.pluginId
      });
    }
  }

  /**
   * Get all registered components
   */
  getAllComponents(): UIComponentDefinition[] {
    return Array.from(this.components.values());
  }

  /**
   * Get components by type
   */
  getComponentsByType(type: UIComponentType): UIComponentDefinition[] {
    return Array.from(this.components.values())
      .filter((component) => component.type === type)
      .sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }

  /**
   * Get components by position
   */
  getComponentsByPosition(position: UIComponentPosition): UIComponentDefinition[] {
    return Array.from(this.components.values())
      .filter((component) => component.position === position)
      .sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }

  /**
   * Register a UI route
   */
  registerRoute(route: UIRoute): void {
    // Check if route already exists
    if (this.routes.has(route.path)) {
      this.logger.warn(`Route with path ${route.path} already exists and will be overwritten`, {
        component: 'UIRegistry',
        path: route.path,
        pluginId: route.pluginId
      });
    }

    // Store route
    this.routes.set(route.path, route);

    this.logger.debug(`Registered UI route: ${route.path}`, {
      component: 'UIRegistry',
      pluginId: route.pluginId
    });
  }

  /**
   * Unregister a UI route
   */
  unregisterRoute(path: string): void {
    if (this.routes.has(path)) {
      const route = this.routes.get(path)!;
      this.routes.delete(path);

      this.logger.debug(`Unregistered UI route: ${path}`, {
        component: 'UIRegistry',
        pluginId: route.pluginId
      });
    }
  }

  /**
   * Get all registered routes
   */
  getAllRoutes(): UIRoute[] {
    return Array.from(this.routes.values());
  }

  /**
   * Register a UI theme
   */
  registerTheme(theme: UITheme): void {
    // Check if theme already exists
    if (this.themes.has(theme.id)) {
      this.logger.warn(`Theme with ID ${theme.id} already exists and will be overwritten`, {
        component: 'UIRegistry',
        themeId: theme.id
      });
    }

    // Store theme
    this.themes.set(theme.id, theme);

    this.logger.debug(`Registered UI theme: ${theme.id}`, {
      component: 'UIRegistry',
      themeName: theme.name
    });

    // If no active theme, set this as active
    if (this.themes.size === 1) {
      this.activeThemeId = theme.id;
    }
  }

  /**
   * Get a UI theme by ID
   */
  getTheme(id: string): UITheme | undefined {
    return this.themes.get(id);
  }

  /**
   * Set the active theme
   */
  setActiveTheme(id: string): void {
    if (!this.themes.has(id)) {
      throw new Error(`Theme with ID ${id} does not exist`);
    }

    this.activeThemeId = id;

    this.logger.debug(`Set active theme: ${id}`, {
      component: 'UIRegistry',
      themeName: this.themes.get(id)!.name
    });
  }

  /**
   * Get the active theme
   */
  getActiveTheme(): UITheme {
    return this.themes.get(this.activeThemeId) || defaultTheme;
  }
}
