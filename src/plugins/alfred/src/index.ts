/**
 * Alfred Plugin - AI-powered coding assistant
 */

import {
  PluginLifecycle,
  PluginContext,
  PluginAPI
} from '../../../core/plugin-registry/interfaces';
import { AlfredService } from './services/alfred-service';
import { StreamingService } from './services/streaming-service';
import { AlfredAIAdapter } from './services/alfred-ai-adapter';
import { ProjectAnalyzerService } from './services/project-analyzer';
import { CodeGeneratorService } from './services/code-generator';
import { TemplateManagerService } from './services/template-manager';
import { SessionRepository } from './repositories/session-repository';
import { TemplateRepository } from './repositories/template-repository';
import { createAlfredRouter } from './api/alfred-api';
import { Router } from 'express';
import { AlfredDataServiceAdapter } from './services/data-service-adapter';

// UI components will be loaded dynamically

export class AlfredPlugin implements PluginLifecycle {
  private alfredService?: AlfredService;
  private streamingService?: StreamingService;
  private aiAdapter?: AlfredAIAdapter;
  private projectAnalyzer?: ProjectAnalyzerService;
  private codeGenerator?: CodeGeneratorService;
  private templateManager?: TemplateManagerService;
  private sessionRepository?: SessionRepository;
  private templateRepository?: TemplateRepository;

  async onActivate(context: PluginContext): Promise<void> {
    const { logger, eventBus, data, ui } = context.services;

    // Get AI and Storage services from core
    const aiService = (context.services as any).aiService;
    const storageService = (context.services as any).storageService;

    logger.info('Activating Alfred plugin');

    // Get collection-based data service adapter
    const collectionService = await AlfredDataServiceAdapter.getInstance(data, logger);

    // Initialize repositories with collection service
    this.sessionRepository = new SessionRepository(collectionService, logger);
    this.templateRepository = new TemplateRepository(collectionService, logger);

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
      storageService,
      sessionRepository: this.sessionRepository
    });

    this.streamingService = new StreamingService(logger, this.aiAdapter);

    this.projectAnalyzer = new ProjectAnalyzerService(logger, eventBus, storageService);

    this.codeGenerator = new CodeGeneratorService(logger, eventBus);

    this.templateManager = new TemplateManagerService(logger, this.templateRepository, eventBus);

    // Register API routes
    const api = context.api as PluginAPI & {
      registerRouter?: (path: string, router: Router) => void;
    };
    if (api?.registerRouter) {
      const alfredRouter = createAlfredRouter(this.alfredService, this.streamingService, logger);
      api.registerRouter('/alfred', alfredRouter);
    } else {
      // Fallback: register routes directly
      context.api.registerRoute(
        '/alfred/*',
        createAlfredRouter(this.alfredService, this.streamingService, logger)
      );
    }

    // Make services available globally for UI components
    if (typeof window !== 'undefined') {
      (window as any).alfred = {
        services: {
          alfredService: this.alfredService,
          streamingService: this.streamingService,
          projectAnalyzer: this.projectAnalyzer,
          codeGenerator: this.codeGenerator,
          templateManager: this.templateManager
        }
      };
    }

    // Subscribe to events
    eventBus.subscribe(
      'alfred:request:code',
      async (event: { topic: string; data: { template: string; context: Record<string, unknown> }; timestamp: Date; source?: string }) => {
        const response = await this.alfredService?.generateCode(event.data);
        eventBus.publish('alfred:response:code', { response });
      }
    );

    eventBus.subscribe(
      'alfred:request:analyze',
      async (event: { topic: string; data: { projectPath: string; options?: Record<string, unknown> }; timestamp: Date; source?: string }) => {
        const response = await this.alfredService?.analyzeProject(event.data.projectPath);
        eventBus.publish('alfred:response:analyze', { response });
      }
    );

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

  async onUpdate(fromVersion: string, toVersion: string): Promise<void> {}
}

// Export the plugin instance
export default new AlfredPlugin();
