/**
 * Heimdall UI Service
 * Manages UI components registration and lifecycle
 */

import { UIRegistry } from '@core/plugin-registry/interfaces';
import { HeimdallService } from '../services/heimdall-service';

export class HeimdallUI {
  private readonly registry: UIRegistry;
  private readonly service: HeimdallService;
  private registeredComponents: string[] = [];

  constructor(registry: UIRegistry, service: HeimdallService) {
    this.registry = registry;
    this.service = service;
  }

  async initialize(): Promise<void> {
    // Register main dashboard
    await this.registry.registerComponent({
      id: 'heimdall-dashboard',
      name: 'Heimdall Dashboard',
      component: () => import('../../ui/components/HeimdallDashboard'),
      location: 'main',
      icon: 'Eye',
      route: '/heimdall',
      permissions: ['heimdall:view']
    });
    this.registeredComponents.push('heimdall-dashboard');

    // Register search component
    await this.registry.registerComponent({
      id: 'heimdall-search',
      name: 'Log Search',
      component: () => import('../../ui/components/HeimdallSearch'),
      location: 'main',
      route: '/heimdall/search',
      permissions: ['heimdall:search']
    });
    this.registeredComponents.push('heimdall-search');

    // Register analytics component
    await this.registry.registerComponent({
      id: 'heimdall-analytics',
      name: 'Log Analytics',
      component: () => import('../../ui/components/HeimdallAnalytics'),
      location: 'main',
      route: '/heimdall/analytics',
      permissions: ['heimdall:analytics']
    });
    this.registeredComponents.push('heimdall-analytics');

    // Register alerts component
    await this.registry.registerComponent({
      id: 'heimdall-alerts',
      name: 'Alerts',
      component: () => import('../../ui/components/HeimdallAlerts'),
      location: 'main',
      route: '/heimdall/alerts',
      permissions: ['heimdall:alerts']
    });
    this.registeredComponents.push('heimdall-alerts');

    // Register sidebar navigation
    await this.registry.registerNavigation({
      id: 'heimdall-nav',
      label: 'Heimdall',
      icon: 'Eye',
      position: 3,
      items: [
        {
          id: 'heimdall-dashboard-nav',
          label: 'Dashboard',
          route: '/heimdall',
          icon: 'LayoutDashboard'
        },
        {
          id: 'heimdall-search-nav',
          label: 'Search',
          route: '/heimdall/search',
          icon: 'Search'
        },
        {
          id: 'heimdall-analytics-nav',
          label: 'Analytics',
          route: '/heimdall/analytics',
          icon: 'TrendingUp'
        },
        {
          id: 'heimdall-alerts-nav',
          label: 'Alerts',
          route: '/heimdall/alerts',
          icon: 'Bell'
        }
      ]
    });

    // Register command palette commands
    await this.registry.registerCommand({
      id: 'heimdall-search-command',
      name: 'Search Logs',
      shortcut: 'Ctrl+Shift+L',
      handler: () => {
        window.location.href = '/heimdall/search';
      }
    });

    await this.registry.registerCommand({
      id: 'heimdall-new-alert',
      name: 'Create New Alert',
      handler: () => {
        window.location.href = '/heimdall/alerts/new';
      }
    });
  }

  async cleanup(): Promise<void> {
    // Unregister all components
    for (const componentId of this.registeredComponents) {
      await this.registry.unregisterComponent(componentId);
    }
    this.registeredComponents = [];

    // Unregister navigation
    await this.registry.unregisterNavigation('heimdall-nav');

    // Unregister commands
    await this.registry.unregisterCommand('heimdall-search-command');
    await this.registry.unregisterCommand('heimdall-new-alert');
  }

  /**
   * Get the service instance for UI components
   */
  getService(): HeimdallService {
    return this.service;
  }
}