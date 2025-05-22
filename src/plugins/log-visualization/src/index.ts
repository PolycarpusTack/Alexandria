/**
 * Log Visualization Plugin
 * 
 * This plugin integrates with the core platform to provide advanced
 * log visualization capabilities with support for multiple log sources.
 */

import { PluginContext, PluginLifecycle } from '../../../core/plugin-registry/interfaces';
import { EventHandler, Event } from '../../../core/event-bus/interfaces';
import { LogVisualizationService } from './services/log-visualization-service';
import { createUIComponents } from '../ui';
import { Router } from 'express';
import { createLogApiRouter } from './api';
import { isLogSourceConnectedEvent, isSystemInitializedEvent } from './interfaces/event-types';

/**
 * Log Visualization Plugin
 */
export default class LogVisualizationPlugin implements PluginLifecycle {
  private context: PluginContext | null = null;
  private logVisualizationService: LogVisualizationService | null = null;
  
  // Bound event handlers to avoid creating new function instances on each subscription
  private readonly handleSystemInitializedEvent = this.handleSystemInitialized.bind(this);
  private readonly handleLogSourceConnectedEvent = this.handleLogSourceConnected.bind(this);
  
  /**
   * Called when the plugin is installed
   */
  async onInstall(): Promise<void> {
    throw new Error('Legacy method called - use install instead');  
  }
  
  /**
   * Plugin install method (internal implementation)
   */
  async install(context: PluginContext): Promise<void> {
    try {
      this.context = context;
      
      context.services.logger.info('Installing Log Visualization Plugin', {
        component: 'LogVisualizationPlugin'
      });
      
      // Initialize service
      this.logVisualizationService = new LogVisualizationService(
        context.services.logger,
        context.services.data
      );
      
      await this.logVisualizationService.initialize();
      
      context.services.logger.info('Log Visualization Plugin installed successfully', {
        component: 'LogVisualizationPlugin'
      });
    } catch (error) {
      context.services.logger.error('Failed to install Log Visualization Plugin', {
        component: 'LogVisualizationPlugin',
        error: error instanceof Error ? error.message : String(error)
      });
      
      throw error;
    }
  }
  
  /**
   * Called when the plugin is activated
   */
  async onActivate(): Promise<void> {
    throw new Error('Legacy method called - use activate instead');
  }
  
  /**
   * Plugin activate method (internal implementation)
   */
  async activate(context: PluginContext): Promise<void> {
    try {
      if (!this.context) {
        throw new Error('Plugin was not properly installed');
      }
      
      if (!this.logVisualizationService) {
        throw new Error('Log Visualization Service was not properly initialized');
      }
      
      context.services.logger.info('Activating Log Visualization Plugin', {
        component: 'LogVisualizationPlugin'
      });
      
      // Register event handlers using pre-bound methods
      context.services.eventBus.subscribe('system:initialized', this.handleSystemInitializedEvent);
      context.services.eventBus.subscribe('log:source:connected', this.handleLogSourceConnectedEvent);
      
      // Register UI components
      const uiComponents = createUIComponents(this.logVisualizationService, context);
      for (const component of uiComponents) {
        context.services.ui.registerComponent(component.id, component);
      }
      
      // Register API endpoints
      const apiRouter = createLogApiRouter(this.logVisualizationService, context.services.logger);
      context.services.api.registerRoutes('/api/logs', apiRouter);
      
      context.services.logger.info('Log Visualization Plugin activated successfully', {
        component: 'LogVisualizationPlugin'
      });
    } catch (error) {
      context.services.logger.error('Failed to activate Log Visualization Plugin', {
        component: 'LogVisualizationPlugin',
        error: error instanceof Error ? error.message : String(error)
      });
      
      throw error;
    }
  }
  
  /**
   * Called when the plugin is deactivated
   */
  async onDeactivate(): Promise<void> {
    throw new Error('Legacy method called - use deactivate instead');
  }
  
  /**
   * Plugin deactivate method (internal implementation)
   */
  async deactivate(context: PluginContext): Promise<void> {
    try {
      context.services.logger.info('Deactivating Log Visualization Plugin', {
        component: 'LogVisualizationPlugin'
      });
      
      // Unsubscribe from events using the same bound handlers
      context.services.eventBus.unsubscribe('system:initialized', this.handleSystemInitializedEvent);
      context.services.eventBus.unsubscribe('log:source:connected', this.handleLogSourceConnectedEvent);
      
      // Unregister UI components
      context.services.ui.unregisterComponentsByPlugin('alexandria-log-visualization');
      
      context.services.logger.info('Log Visualization Plugin deactivated successfully', {
        component: 'LogVisualizationPlugin'
      });
    } catch (error) {
      context.services.logger.error('Failed to deactivate Log Visualization Plugin', {
        component: 'LogVisualizationPlugin',
        error: error instanceof Error ? error.message : String(error)
      });
      
      throw error;
    }
  }
  
  /**
   * Called when the plugin is uninstalled
   */
  async onUninstall(): Promise<void> {
    throw new Error('Legacy method called - use uninstall instead');
  }
  
  /**
   * Plugin uninstall method (internal implementation)
   */
  async uninstall(context: PluginContext): Promise<void> {
    try {
      context.services.logger.info('Uninstalling Log Visualization Plugin', {
        component: 'LogVisualizationPlugin'
      });
      
      // Clean up resources
      
      context.services.logger.info('Log Visualization Plugin uninstalled successfully', {
        component: 'LogVisualizationPlugin'
      });
    } catch (error) {
      context.services.logger.error('Failed to uninstall Log Visualization Plugin', {
        component: 'LogVisualizationPlugin',
        error: error instanceof Error ? error.message : String(error)
      });
      
      throw error;
    }
  }
  
  /**
   * Event handler for system:initialized events
   */
  private handleSystemInitialized(event: Event): void {
    if (isSystemInitializedEvent(event)) {
      this.context?.services.logger.info('System initialized, Log Visualization Plugin ready', {
        component: 'LogVisualizationPlugin'
      });
    }
  }
  
  /**
   * Event handler for log:source:connected events
   */
  private handleLogSourceConnected(event: Event): void {
    if (isLogSourceConnectedEvent(event)) {
      const { sourceId, sourceType } = event.data;
      
      if (!sourceId || !sourceType) {
        this.context?.services.logger.warn('Received invalid log source connection data', {
          component: 'LogVisualizationPlugin',
          data: event.data
        });
        return;
      }
    
    this.context?.services.logger.info(`Log source connected: ${sourceId} (${sourceType})`, {
      component: 'LogVisualizationPlugin',
      sourceId,
      sourceType
    });  
    }
  }
}