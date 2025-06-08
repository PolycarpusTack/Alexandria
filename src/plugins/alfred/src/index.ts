/**
 * Alfred Plugin - AI-powered coding assistant
 */

import { PluginLifecycle, PluginContext, PluginAPI } from '../../../core/plugin-registry/interfaces';
import { AlfredService } from './services/alfred-service';
import { StreamingService } from './services/streaming-service';
import { AlfredAIAdapter } from './services/alfred-ai-adapter';
import { ProjectAnalyzer } from './services/project-analyzer';
import { CodeGenerator } from './services/code-generator';
import { TemplateManager } from './services/template-manager';
import { SessionRepository } from './repositories/session-repository';
import { TemplateRepository } from './repositories/template-repository';
import { createAlfredRouter } from './api/alfred-api';
import { Router } from 'express';

// UI components
import { AlfredDashboard } from '../ui/components/AlfredDashboard';
import { ChatInterface } from '../ui/components/ChatInterface';
import { ProjectExplorer } from '../ui/components/ProjectExplorer';
import { TemplateManager as TemplateManagerUI } from '../ui/components/TemplateManager';

export class AlfredPlugin implements PluginLifecycle {
  private alfredService?: AlfredService;
  private streamingService?: StreamingService;
  private aiAdapter?: AlfredAIAdapter;
  private projectAnalyzer?: ProjectAnalyzer;
  private codeGenerator?: CodeGenerator;
  private templateManager?: TemplateManager;
  private sessionRepository?: SessionRepository;
  private templateRepository?: TemplateRepository;

  async onActivate(context: PluginContext): Promise<void> {
    const { logger, eventBus, data, ui } = context.services;
    
    // Get AI and Storage services from core
    const aiService = (context.services as any).aiService;
    const storageService = (context.services as any).storageService;
    
    logger.info('Activating Alfred plugin');
    
    // Initialize repositories
    this.sessionRepository = new SessionRepository(data);
    this.templateRepository = new TemplateRepository(data);
    
    // Initialize AI adapter
    this.aiAdapter = new AlfredAIAdapter({
      aiService,
      logger
    });
    
    // Initialize services
    this.alfredService = new AlfredService({
      logger,
      dataService: data,
      eventBus,
      aiService,
      storageService
    });
    
    this.streamingService = new StreamingService(logger, this.aiAdapter);
    
    this.projectAnalyzer = new ProjectAnalyzer({
      logger,
      eventBus
    });
    
    this.codeGenerator = new CodeGenerator({
      logger,
      eventBus
    });
    
    this.templateManager = new TemplateManager({
      logger,
      repository: this.templateRepository,
      eventBus
    });
    
    // Register API routes
    const api = context.api as PluginAPI & { registerRouter?: (path: string, router: Router) => void };
    if (api?.registerRouter) {
      const alfredRouter = createAlfredRouter(
        this.alfredService,
        this.streamingService,
        logger
      );
      api.registerRouter('/alfred', alfredRouter);
    } else {
      // Fallback: register routes directly
      context.api.registerRoute('/alfred/*', createAlfredRouter(
        this.alfredService,
        this.streamingService,
        logger
      ));
    }
    
    // Register UI components
    ui.registerComponent({
      id: 'alfred-dashboard',
      component: AlfredDashboard,
      props: {
        alfredService: this.alfredService,
        streamingService: this.streamingService,
        projectAnalyzer: this.projectAnalyzer,
        codeGenerator: this.codeGenerator,
        templateManager: this.templateManager
      }
    });
    
    ui.registerComponent({
      id: 'alfred-chat',
      component: ChatInterface,
      props: {
        alfredService: this.alfredService,
        streamingService: this.streamingService
      }
    });
    
    ui.registerComponent({
      id: 'alfred-project-explorer',
      component: ProjectExplorer,
      props: {
        projectAnalyzer: this.projectAnalyzer
      }
    });
    
    ui.registerComponent({
      id: 'alfred-template-manager',
      component: TemplateManagerUI,
      props: {
        templateManager: this.templateManager
      }
    });
    
    // Subscribe to events
    eventBus.on('alfred:request:code', async (data: any) => {
      const response = await this.alfredService?.generateCode(data);
      eventBus.emit('alfred:response:code', response);
    });
    
    eventBus.on('alfred:request:analyze', async (data: any) => {
      const response = await this.alfredService?.analyzeProject(data.projectPath);
      eventBus.emit('alfred:response:analyze', response);
    });
    
    logger.info('Alfred plugin activated successfully');
  }

  async onDeactivate(): Promise<void> {
    // Cancel any active streams
    if (this.streamingService) {
      this.streamingService.cancelAllStreams();
    }
    
    // Shutdown services
    if (this.alfredService) {
      await (this.alfredService as any).shutdown();
    }
    
    // Clean up event listeners
    this.streamingService?.removeAllListeners();
    this.alfredService?.removeAllListeners();
  }

  async onInstall(): Promise<void> {
    // Setup required directories, configs, etc.

  }

  async onUninstall(): Promise<void> {
    // Cleanup plugin data

  }

  async onUpdate(fromVersion: string, toVersion: string): Promise<void> {

  }
}

// Export the plugin instance
export default new AlfredPlugin();