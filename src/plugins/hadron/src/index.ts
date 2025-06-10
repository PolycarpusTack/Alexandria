import { PluginContext, PluginLifecycle } from '../../../core/plugin-registry/interfaces';
import { EnhancedCrashAnalyzerService } from './services/enhanced-crash-analyzer-service';
import { EnhancedLogParser } from './services/enhanced-log-parser';
import { AIServiceFactory } from './services/ai-service-factory';
import { ILlmService } from './interfaces';
import { CrashRepository } from './repositories/crash-repository';
import { HadronRepository } from './repositories/hadron-repository';
import { EnhancedFileStorageService } from './services/enhanced-file-storage-service';
import { FileValidator } from './services/file-validator';
import { FileSecurityService } from './services/file-security-service';
import { AnalyticsService } from './services/analytics/analytics-service';
import { AlertManager } from './services/analytics/alert-manager';
import { NotificationService } from './services/analytics/notification-service';
import { container } from 'tsyringe';
import { createUIComponents } from '../ui';
import { Router } from 'express';
import { createFileSecurityRouter } from './api/file-security-api';
import { createFileUploadRouter } from './api/file-upload-api';
import { initializeApi } from './api';

/**
 * AI-Powered Crash Analyzer Plugin
 * 
 * This plugin integrates with the core platform to provide crash log analysis
 * capabilities using local LLMs via Ollama integration.
 */
export default class CrashAnalyzerPlugin implements PluginLifecycle {
  private context: PluginContext | null = null;
  private crashAnalyzerService: EnhancedCrashAnalyzerService | null = null;
  private logParser: EnhancedLogParser | null = null;
  private llmService: ILlmService | null = null;
  private crashRepository: CrashRepository | null = null;
  private hadronRepository: HadronRepository | null = null;
  private fileStorage: EnhancedFileStorageService | null = null;
  private fileValidator: FileValidator | null = null;
  private analyticsService: AnalyticsService | null = null;
  private alertManager: AlertManager | null = null;
  private notificationService: NotificationService | null = null;
  
  // Bound event handlers for memory safety
  private readonly handleLogUploadedEvent = this.handleLogUploaded.bind(this);
  private readonly handleSystemInitializedEvent = this.handleSystemInitialized.bind(this);
  
  /**
   * Called when the plugin is installed (legacy method - delegates to install)
   */
  async onInstall(): Promise<void> {
    // Legacy method - should not be called in modern Alexandria
    // Delegating to install method would require context parameter
    throw new Error('Legacy method not supported - use install instead');  
  }
  
  /**
   * Plugin install method (internal implementation)
   */
  async install(context: PluginContext): Promise<void> {
    this.context = context;
    
    // Initialize plugin repositories using proper data service integration
    if (!context.services.data) {
      throw new Error('Data service not available');
    }
    
    this.crashRepository = new CrashRepository(context.services.data);
    await this.crashRepository.initialize();
    
    // Initialize Hadron repository
    this.hadronRepository = new HadronRepository(context.services.data);
    await this.hadronRepository.initialize();
    
    // Initialize file storage service with environment-based configuration
    const storageOptions = {
      baseStoragePath: process.env.HADRON_STORAGE_PATH || process.env.STORAGE_PATH || './storage/hadron',
      maxSizeBytes: parseInt(process.env.HADRON_MAX_FILE_SIZE || '20971520'), // 20MB default
      allowedExtensions: (process.env.HADRON_ALLOWED_EXTENSIONS || '.txt,.log,.json,.xml,.html,.md,.stacktrace,.crash,.py,.js,.ts,.jsx,.tsx,.java,.cpp,.h,.cs').split(',')
    };
    
    this.fileStorage = new EnhancedFileStorageService(
      storageOptions,
      this.hadronRepository.fileRepository,
      this.hadronRepository.sessionRepository,
      this.hadronRepository.userRepository,
      context.services.logger
    );
    this.fileValidator = new FileValidator(context.services.logger, {});
    
    // Initialize enhanced services
    this.logParser = new EnhancedLogParser(context.services.logger);
    
    // Create AI service using the factory (centralized by default)
    const aiServiceFactory = new AIServiceFactory(context.services.logger, context.services.eventBus);
    this.llmService = await aiServiceFactory.createAIService({
      preferCentralized: true,
      cacheService: context.services.cache,
      featureFlagService: context.services.featureFlags
    });
    
    // Create enhanced analyzer service
    this.crashAnalyzerService = new EnhancedCrashAnalyzerService(
      this.logParser,
      this.llmService,
      this.crashRepository,
      this.hadronRepository,
      this.fileStorage,
      context.services.logger,
      {
        baseStoragePath: process.env.HADRON_STORAGE_PATH || process.env.STORAGE_PATH || './storage/hadron',
        quarantineDir: process.env.HADRON_QUARANTINE_PATH || process.env.QUARANTINE_PATH || './storage/hadron/quarantine'
      }
    );
    
    // Initialize analytics service
    if (this.crashRepository && this.hadronRepository) {
      // Register services in DI container
      container.register('DataService', { useValue: context.services.data });
      container.register('EventBus', { useValue: context.services.eventBus });
      container.register('Logger', { useValue: context.services.logger });
      
      this.analyticsService = new AnalyticsService(
        this.crashRepository,
        this.hadronRepository,
        context.services.cache,
        context.services.logger
      );
      await this.analyticsService.initialize();
      
      // Initialize alert system
      this.alertManager = new AlertManager(
        context.services.data,
        context.services.eventBus
      );
      this.notificationService = new NotificationService(
        context.services.eventBus
      );
      
      // Register services in container for API access
      container.register(AlertManager, { useValue: this.alertManager });
      container.register(NotificationService, { useValue: this.notificationService });
    }
    
    context.services.logger.info('Crash Analyzer Plugin installed successfully');
  }
  
  /**
   * Called when the plugin is activated (legacy method)
   */
  async onActivate(): Promise<void> {
    throw new Error('Legacy method not supported - use activate instead');
  }
  
  /**
   * Plugin activate method (internal implementation)
   */
  async activate(context: PluginContext): Promise<void> {
    if (!this.context) {
      throw new Error('Plugin was not properly installed');
    }
    
    // Register event handlers
    context.services.eventBus.subscribe('log:uploaded', this.handleLogUploadedEvent);
    context.services.eventBus.subscribe('system:initialized', this.handleSystemInitializedEvent);
    
    // Register analytics service if available
    if (this.analyticsService) {
      context.services.set('analytics', this.analyticsService);
    }
    
    // Register UI components
    const uiComponents = createUIComponents(this.crashAnalyzerService!, context);
    for (const component of uiComponents) {
      context.services.ui.registerComponent(component.id, component);
    }
    
    // Register API endpoints
    if (this.crashAnalyzerService) {
      // Use the consolidated Hadron repository instead of separate repositories
      // This ensures consistent data access patterns throughout the plugin
      
      // Create API routers using consolidated repository pattern
      const api = initializeApi(
        this.hadronRepository!,
        context.services.logger,
        context.services.security,
        {
          baseStoragePath: process.env.HADRON_STORAGE_PATH || process.env.STORAGE_PATH || './storage/hadron',
          maxFileSize: parseInt(process.env.HADRON_MAX_FILE_SIZE || '52428800'), // 50MB default
          requireAuth: true // Enforce authentication for all API routes
        }
      );
      
      // Register API routes
      context.services.api.registerRoutes('/api/hadron/security', api.routers.fileSecurityRouter);
      context.services.api.registerRoutes('/api/hadron/files', api.routers.fileUploadRouter);
      
      // Register crash analyzer API routes
      const { createCrashAnalyzerRouter } = await import('./api/crash-analyzer-api');
      const crashAnalyzerRouter = createCrashAnalyzerRouter(
        this.crashAnalyzerService,
        this.crashRepository,
        context.services.logger
      );
      context.services.api.registerRoutes('/api/crash-analyzer', crashAnalyzerRouter);
      
      // Register analytics API routes if analytics service is available
      if (this.analyticsService) {
        const { createAnalyticsRouter } = await import('./api/analytics-api');
        const analyticsRouter = createAnalyticsRouter(
          this.analyticsService,
          context.services.logger,
          this.llmService
        );
        context.services.api.registerRoutes('/api/hadron/analytics', analyticsRouter);
        
        // Register alert API routes
        const { default: alertRouter } = await import('./api/alerts-api');
        context.services.api.registerRoutes('/api/hadron/alerts', alertRouter);
      }
    }
    
    context.services.logger.info('Crash Analyzer Plugin activated successfully');
  }
  
  /**
   * Called when the plugin is deactivated (legacy method)
   */
  async onDeactivate(): Promise<void> {
    throw new Error('Legacy method not supported - use deactivate instead');
  }
  
  /**
   * Plugin deactivate method (internal implementation)
   */
  async deactivate(context: PluginContext): Promise<void> {
    // Stop alert monitoring
    if (this.alertManager) {
      this.alertManager.stopMonitoring();
    }
    
    // Unsubscribe from events with handler references - passing both event name and handler
    // The unsubscribe method should support this signature pattern
    context.services.eventBus.unsubscribe('log:uploaded', this.handleLogUploadedEvent);
    context.services.eventBus.unsubscribe('system:initialized', this.handleSystemInitializedEvent);
    
    // Unregister UI components
    context.services.ui.unregisterComponentsByPlugin('alexandria-crash-analyzer');
    
    context.services.logger.info('Crash Analyzer Plugin deactivated successfully');
  }
  
  /**
   * Called when the plugin is uninstalled (legacy method)
   */
  async onUninstall(): Promise<void> {
    throw new Error('Legacy method not supported - use uninstall instead');
  }
  
  /**
   * Plugin uninstall method (internal implementation)
   */
  async uninstall(context: PluginContext): Promise<void> {
    // Clean up any resources, database tables, etc.
    context.services.logger.info('Crash Analyzer Plugin uninstalled successfully');
  }
  
  /**
   * Event handler for log:uploaded events
   */
  private async handleLogUploaded(data: {
    logId: string;
    content: string;
    metadata: Record<string, string | number | boolean | null>;
  }): Promise<void> {
    if (!this.crashAnalyzerService) return;
    
    try {
      const { logId, content, metadata } = data;
      this.context?.services.logger.info(`Processing uploaded log: ${logId}`);
      
      // Parse and analyze the log
      await this.crashAnalyzerService.analyzeLog(logId, content, metadata);
    } catch (error) {
      this.context?.services.logger.error('Error processing uploaded log', error);
    }
  }
  
  /**
   * Event handler for system:initialized events
   */
  private handleSystemInitialized(): void {
    this.context?.services.logger.info('System initialized, Crash Analyzer Plugin ready');
  }
}