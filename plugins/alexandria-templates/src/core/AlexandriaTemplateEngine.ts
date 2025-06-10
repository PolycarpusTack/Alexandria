import { PluginLifecycle, PluginContext } from '@core/plugin-registry/interfaces';
import { Logger } from '@utils/logger';
import { EventBus } from '@core/event-bus/event-bus';
import { TemplateEngine, TemplateConfig, RenderContext } from '../types';
import { SecurityManager } from './SecurityManager';
import { AnalyticsTracker } from './AnalyticsTracker';

export class AlexandriaTemplateEngine implements PluginLifecycle {
  private engines: Map<string, TemplateEngine> = new Map();
  private security: SecurityManager;
  private analytics: AnalyticsTracker;
  private alfredAPI?: any;
  private logger?: Logger;
  private eventBus?: EventBus;
  private context?: PluginContext;

  async onActivate(context: PluginContext): Promise<void> {
    this.context = context;
    this.logger = context.services.logger;
    this.eventBus = context.services.eventBus;
    
    this.security = new SecurityManager();
    this.analytics = new AnalyticsTracker(context.workspace);
    this.initializeEngines();
    await this.connectToAlfred();
  }

  async onDeactivate(): Promise<void> {
    this.engines.clear();
    this.alfredAPI = undefined;
  }

  private async connectToAlfred(): Promise<void> {
    try {
      // Try to get alfred plugin if available
      const pluginRegistry = (this.context?.services as any).pluginRegistry;
      if (pluginRegistry) {
        const alfredPlugin = await pluginRegistry.getPlugin('alfred');
        if (alfredPlugin?.instance) {
          this.alfredAPI = alfredPlugin.instance;
          this.logger?.info('Connected to ALFRED for AI-powered template generation');
        }
      }
    } catch (error) {
      this.logger?.info('ALFRED not available, AI features disabled');
    }
  }

  private initializeEngines(): void {
    // Register Handlebars engine
    this.registerEngine('handlebars', {
      name: 'handlebars',
      fileExtensions: ['.hbs', '.handlebars'],
      render: async (template, context) => {
        const Handlebars = await import('handlebars');
        const compiled = Handlebars.compile(template);
        return compiled(context);
      }
    });

    // Register Liquid engine
    this.registerEngine('liquid', {
      name: 'liquid',
      fileExtensions: ['.liquid'],
      render: async (template, context) => {
        const { Liquid } = await import('liquidjs');
        const engine = new Liquid();
        return engine.parseAndRender(template, context);
      }
    });

    // Register EJS engine
    this.registerEngine('ejs', {
      name: 'ejs',
      fileExtensions: ['.ejs'],
      render: async (template, context) => {
        const ejs = await import('ejs');
        return ejs.render(template, context);
      }
    });
  }

  private registerEngine(name: string, engine: TemplateEngine): void {
    this.engines.set(name, engine);
    this.logger?.info(`Registered template engine: ${name}`);
  }

  async render(templateId: string, context: RenderContext, config?: TemplateConfig): Promise<string> {
    const engine = this.engines.get(config?.engine || 'handlebars');
    if (!engine) {
      throw new Error(`Template engine not found: ${config?.engine}`);
    }

    // Security check
    await this.security.validateTemplate(templateId);
    
    // Track analytics
    await this.analytics.trackTemplateUsage(templateId);

    // Get template content (simplified for now)
    const template = await this.getTemplate(templateId);

    // If ALFRED is available and AI enhancement is requested
    if (config?.useAI && this.alfredAPI) {
      const enhancedContext = await this.enhanceWithAI(context);
      return engine.render(template, enhancedContext);
    }

    return engine.render(template, context);
  }

  private async getTemplate(templateId: string): Promise<string> {
    // TODO: Implement template loading from storage
    return '';
  }

  private async enhanceWithAI(context: RenderContext): Promise<RenderContext> {
    if (!this.alfredAPI) return context;
    
    try {
      // Use ALFRED to enhance the context
      const enhanced = await this.alfredAPI.enhanceContext(context);
      return enhanced || context;
    } catch (error) {
      this.logger?.warn('Failed to enhance context with AI', error);
      return context;
    }
  }
}

// Export plugin instance factory
export default {
  createInstance: (context: PluginContext) => new AlexandriaTemplateEngine()
};