import { Plugin, AlexandriaPluginContext, LoggerService } from './types/alexandria-plugin-api';
import { MnemosyneCore } from './core/MnemosyneCore';
import { MnemosyneEvents } from './events/MnemosyneEvents';
import { registerMnemosyneAPI } from './api';
import { registerGraphQLWithAlexandria } from './graphql';
import { adaptPluginContext } from './types/plugin-adapter';

/**
 * Main Mnemosyne plugin class implementing Alexandria plugin lifecycle
 */
export class MnemosynePlugin implements Plugin {
  public readonly id = 'mnemosyne';
  public readonly name = 'Mnemosyne Knowledge Management';
  public readonly version = '0.1.0';
  public readonly description = 'Comprehensive knowledge management and graph visualization';
  public readonly author = 'Alexandria Platform Team';

  private core?: MnemosyneCore;
  private context?: AlexandriaPluginContext;
  private logger?: LoggerService;

  /**
   * Called when the plugin is installed
   */
  async onInstall(): Promise<void> {
    this.logger?.info('Mnemosyne plugin installation started');
    
    try {
      // Plugin installation logic here
      // - Create initial database schema
      // - Set up default configurations
      // - Initialize plugin directories
      
      this.logger?.info('Mnemosyne plugin installed successfully');
    } catch (error) {
      this.logger?.error('Failed to install Mnemosyne plugin', { error });
      throw error;
    }
  }

  /**
   * Called when the plugin is activated
   */
  async onActivate(context?: AlexandriaPluginContext): Promise<void> {
    this.logger?.info('Mnemosyne plugin activation started');
    
    try {
      if (!context) {
        throw new Error('Plugin context is required for activation');
      }

      this.context = context;
      this.logger = context.logger;

      // Initialize the core service
      const pluginContext = adaptPluginContext(context);
      this.core = new MnemosyneCore(pluginContext);
      await this.core.initialize();

      // Register event handlers
      this.registerEventHandlers();

      // Register UI components
      this.registerUIComponents();

      // Register API routes
      this.registerAPIRoutes();

      this.logger?.info('Mnemosyne plugin activated successfully');
    } catch (error) {
      this.logger?.error('Failed to activate Mnemosyne plugin', { error });
      throw error;
    }
  }

  /**
   * Called when the plugin is deactivated
   */
  async onDeactivate(): Promise<void> {
    this.logger?.info('Mnemosyne plugin deactivation started');
    
    try {
      // Clean up resources
      if (this.core) {
        await this.core.shutdown();
        this.core = undefined;
      }

      // Unregister event handlers
      this.unregisterEventHandlers();

      // Unregister UI components
      this.unregisterUIComponents();

      this.logger?.info('Mnemosyne plugin deactivated successfully');
    } catch (error) {
      this.logger?.error('Failed to deactivate Mnemosyne plugin', { error });
      throw error;
    }
  }

  /**
   * Called when the plugin is uninstalled
   */
  async onUninstall(): Promise<void> {
    this.logger?.info('Mnemosyne plugin uninstallation started');
    
    try {
      // Ensure plugin is deactivated first
      if (this.core) {
        await this.onDeactivate();
      }

      // Clean up persistent data (with user confirmation)
      // - Remove database tables
      // - Clean up plugin directories
      // - Remove configuration files

      this.logger?.info('Mnemosyne plugin uninstalled successfully');
    } catch (error) {
      this.logger?.error('Failed to uninstall Mnemosyne plugin', { error });
      throw error;
    }
  }

  /**
   * Called when the plugin is updated
   */
  async onUpdate(fromVersion: string, toVersion: string): Promise<void> {
    this.logger?.info('Mnemosyne plugin update started', { fromVersion, toVersion });
    
    try {
      // Run migration logic based on version differences
      if (this.core) {
        await this.core.runMigrations(fromVersion, toVersion);
      }

      this.logger?.info('Mnemosyne plugin updated successfully', { fromVersion, toVersion });
    } catch (error) {
      this.logger?.error('Failed to update Mnemosyne plugin', { error, fromVersion, toVersion });
      throw error;
    }
  }

  /**
   * Get the core service instance
   */
  public getCore(): MnemosyneCore | undefined {
    return this.core;
  }

  /**
   * Get the plugin context
   */
  public getContext(): AlexandriaPluginContext | undefined {
    return this.context;
  }

  /**
   * Register event handlers for Mnemosyne events
   */
  private registerEventHandlers(): void {
    if (!this.context?.eventBus) {
      return;
    }

    const eventBus = this.context.eventBus;

    // Register handlers for Mnemosyne-specific events
    eventBus.on(MnemosyneEvents.KNOWLEDGE_CREATED, this.handleKnowledgeCreated.bind(this));
    eventBus.on(MnemosyneEvents.KNOWLEDGE_UPDATED, this.handleKnowledgeUpdated.bind(this));
    eventBus.on(MnemosyneEvents.KNOWLEDGE_DELETED, this.handleKnowledgeDeleted.bind(this));
    eventBus.on(MnemosyneEvents.GRAPH_UPDATED, this.handleGraphUpdated.bind(this));
    eventBus.on(MnemosyneEvents.TEMPLATE_APPLIED, this.handleTemplateApplied.bind(this));
  }

  /**
   * Unregister event handlers
   */
  private unregisterEventHandlers(): void {
    if (!this.context?.eventBus) {
      return;
    }

    const eventBus = this.context.eventBus;

    // Unregister all Mnemosyne event handlers
    eventBus.off(MnemosyneEvents.KNOWLEDGE_CREATED, this.handleKnowledgeCreated.bind(this));
    eventBus.off(MnemosyneEvents.KNOWLEDGE_UPDATED, this.handleKnowledgeUpdated.bind(this));
    eventBus.off(MnemosyneEvents.KNOWLEDGE_DELETED, this.handleKnowledgeDeleted.bind(this));
    eventBus.off(MnemosyneEvents.GRAPH_UPDATED, this.handleGraphUpdated.bind(this));
    eventBus.off(MnemosyneEvents.TEMPLATE_APPLIED, this.handleTemplateApplied.bind(this));
  }

  /**
   * Register UI components with Alexandria
   */
  private registerUIComponents(): void {
    if (!this.context?.ui) {
      return;
    }

    // Register main dashboard component
    this.context.ui.registerComponent({
      id: 'mnemosyne-dashboard',
      component: 'MnemosyneDashboard',
      zone: 'content',
      title: 'Mnemosyne Dashboard'
    });

    // Register graph visualization component
    this.context.ui.registerComponent({
      id: 'mnemosyne-graph',
      component: 'KnowledgeGraphVisualization',
      zone: 'content',
      title: 'Knowledge Graph'
    });

    // Register search interface component
    this.context.ui.registerComponent({
      id: 'mnemosyne-search',
      component: 'SearchInterface',
      zone: 'widget',
      title: 'Knowledge Search'
    });
    
    // Register routes
    this.context.ui.registerRoute({
      path: '/mnemosyne',
      component: 'MnemosyneDashboard'
    });
    
    this.context.ui.registerRoute({
      path: '/mnemosyne/graph',
      component: 'KnowledgeGraphVisualization'
    });
    
    this.context.ui.registerRoute({
      path: '/mnemosyne/search',
      component: 'SearchInterface'
    });
  }

  /**
   * Unregister UI components
   */
  private unregisterUIComponents(): void {
    if (!this.context?.ui) {
      return;
    }

    // TODO: Implement component unregistration when available in UIService
    // this.context.ui.unregisterComponent('mnemosyne-dashboard');
    // this.context.ui.unregisterComponent('mnemosyne-graph');
    // this.context.ui.unregisterComponent('mnemosyne-search');
  }

  /**
   * Register API routes
   */
  private registerAPIRoutes(): void {
    if (!this.context || !this.core) {
      return;
    }

    try {
      // Get Alexandria's Express app instance
      const app = (this.context as any).app || (this.context as any).services?.app;
      if (!app) {
        this.logger?.warn('Express app not available, skipping API registration');
        return;
      }

      // Import and register our new API routes
      const mnemosyneAPI = require('./api').default;
      app.use('/api/mnemosyne', mnemosyneAPI);

      // Create Mnemosyne context for API (keeping existing structure for backward compatibility)
      const mnemosyneContext = this.core.getContext();

      // Register API with security options (existing)
      const securityOptions = {
        allowedOrigins: ['http://localhost:3000', 'http://localhost:4000'],
        requestTimeoutMs: 30000
      };

      try {
        // Try to register existing API if it exists
        registerMnemosyneAPI(app, '/api/mnemosyne/legacy');
      } catch (error) {
        this.logger?.debug('Legacy API registration skipped (not available)');
      }

      try {
        // Register GraphQL endpoint if available
        registerGraphQLWithAlexandria(app, mnemosyneContext, {
          path: '/graphql/mnemosyne',
          enableSubscriptions: false, // Disable for Alexandria integration
          enablePlayground: process.env.NODE_ENV !== 'production'
        });
      } catch (error) {
        this.logger?.debug('GraphQL registration skipped (not available)');
      }

      this.logger?.info('Mnemosyne API routes registered successfully');
    } catch (error) {
      this.logger?.error('Failed to register Mnemosyne API routes', { error });
    }
  }

  // Event handlers
  private async handleKnowledgeCreated(event: any): Promise<void> {
    this.logger?.debug('Knowledge node created', { nodeId: event.nodeId });
  }

  private async handleKnowledgeUpdated(event: any): Promise<void> {
    this.logger?.debug('Knowledge node updated', { nodeId: event.nodeId });
  }

  private async handleKnowledgeDeleted(event: any): Promise<void> {
    this.logger?.debug('Knowledge node deleted', { nodeId: event.nodeId });
  }

  private async handleGraphUpdated(event: any): Promise<void> {
    this.logger?.debug('Knowledge graph updated', { changes: event.changes });
  }

  private async handleTemplateApplied(event: any): Promise<void> {
    this.logger?.debug('Template applied', { templateId: event.templateId, nodeId: event.nodeId });
  }
}