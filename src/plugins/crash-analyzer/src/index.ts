import { PluginContext, PluginLifecycle } from '../../../core/plugin-registry/interfaces';
import { CrashAnalyzerService } from './services/crash-analyzer-service';
import { EnhancedCrashAnalyzerService } from './services/enhanced-crash-analyzer-service';
import { LogParser } from './services/log-parser';
import { EnhancedLogParser } from './services/enhanced-log-parser';
import { LlmService } from './services/llm-service';
import { EnhancedLlmService } from './services/enhanced-llm-service';
import { CrashRepository } from './repositories/crash-repository';
import { HadronRepository } from './repositories/hadron-repository';
import { FileStorageService } from './services/file-storage-service';
import { FileValidator } from './services/file-validator';
import { FileSecurityService } from './services/file-security-service';
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
  private crashAnalyzerService: CrashAnalyzerService | EnhancedCrashAnalyzerService | null = null;
  private logParser: LogParser | EnhancedLogParser | null = null;
  private llmService: LlmService | EnhancedLlmService | null = null;
  private crashRepository: CrashRepository | null = null;
  private hadronRepository: HadronRepository | null = null;
  private fileStorage: FileStorageService | null = null;
  private fileValidator: FileValidator | null = null;
  private useEnhancedVersion: boolean = true;
  
  // Bound event handlers for memory safety
  private readonly handleLogUploadedEvent = this.handleLogUploaded.bind(this);
  private readonly handleSystemInitializedEvent = this.handleSystemInitialized.bind(this);
  
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
    this.context = context;
    
    // Initialize plugin repositories
    this.crashRepository = new CrashRepository(context.services.data as any);
    await this.crashRepository.initialize();
    
    // Initialize Hadron repository if using enhanced version
    if (this.useEnhancedVersion) {
      this.hadronRepository = new HadronRepository(context.services.data as any);
      await this.hadronRepository.initialize();
      
      // Initialize file storage service
      const storageOptions = {
        baseStoragePath: process.env.STORAGE_PATH || './storage',
        maxSizeBytes: 20 * 1024 * 1024, // 20MB
        allowedExtensions: ['.txt', '.log', '.json', '.xml', '.html', '.md', '.stacktrace', '.crash', '.py', '.js', '.ts', '.jsx', '.tsx', '.java', '.cpp', '.h', '.cs']
      };
      
      this.fileStorage = new FileStorageService(storageOptions, context.services.logger);
      this.fileValidator = new FileValidator(context.services.logger, {});
    }
    
    // Initialize services - standard or enhanced versions
    if (this.useEnhancedVersion && this.hadronRepository && this.fileStorage) {
      this.logParser = new EnhancedLogParser(context.services.logger);
      this.llmService = new EnhancedLlmService(context.services.featureFlags, context.services.logger);
      
      // Create enhanced analyzer service
      this.crashAnalyzerService = new EnhancedCrashAnalyzerService(
        this.logParser,
        this.llmService,
        this.crashRepository,
        this.hadronRepository,
        this.fileStorage,
        context.services.logger,
        {
          baseStoragePath: process.env.STORAGE_PATH || './storage',
          quarantineDir: process.env.QUARANTINE_PATH || './storage/quarantine'
        }
      );
    } else {
      // Fallback to standard services
      this.logParser = new LogParser();
      this.llmService = new LlmService(context.services.featureFlags);
      this.crashAnalyzerService = new CrashAnalyzerService(
        this.logParser,
        this.llmService,
        this.crashRepository,
        context.services.logger
      );
    }
    
    context.services.logger.info('Crash Analyzer Plugin installed successfully');
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
    if (!this.context) {
      throw new Error('Plugin was not properly installed');
    }
    
    // Register event handlers
    context.services.eventBus.subscribe('log:uploaded', this.handleLogUploadedEvent);
    context.services.eventBus.subscribe('system:initialized', this.handleSystemInitializedEvent);
    
    // Register UI components
    const uiComponents = createUIComponents(this.crashAnalyzerService!, context);
    for (const component of uiComponents) {
      context.services.ui.registerComponent(component.id, component);
    }
    
    // Register API endpoints
    if (this.useEnhancedVersion && this.crashAnalyzerService instanceof EnhancedCrashAnalyzerService) {
      // Initialize the API with necessary repositories
      const fileRepository = context.services.data.getRepository('hadron_files');
      const userRepository = context.services.data.getRepository('hadron_users');
      const sessionRepository = context.services.data.getRepository('hadron_sessions');
      
      // Create API routers
      const api = initializeApi(
        fileRepository,
        userRepository,
        sessionRepository,
        this.hadronRepository!,
        context.services.logger,
        context.services.security,
        {
          baseStoragePath: process.env.STORAGE_PATH || './storage',
          maxFileSize: 50 * 1024 * 1024, // 50MB
          requireAuth: true // Enforce authentication for all API routes
        }
      );
      
      // Register API routes
      context.services.api.registerRoutes('/api/security', api.routers.fileSecurityRouter);
      context.services.api.registerRoutes('/api/files', api.routers.fileUploadRouter);
    }
    
    context.services.logger.info('Crash Analyzer Plugin activated successfully');
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
    // Unsubscribe from events with handler references - passing both event name and handler
    // The unsubscribe method should support this signature pattern
    context.services.eventBus.unsubscribe('log:uploaded', this.handleLogUploadedEvent);
    context.services.eventBus.unsubscribe('system:initialized', this.handleSystemInitializedEvent);
    
    // Unregister UI components
    context.services.ui.unregisterComponentsByPlugin('alexandria-crash-analyzer');
    
    context.services.logger.info('Crash Analyzer Plugin deactivated successfully');
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
    // Clean up any resources, database tables, etc.
    context.services.logger.info('Crash Analyzer Plugin uninstalled successfully');
  }
  
  /**
   * Event handler for log:uploaded events
   */
  private async handleLogUploaded(data: any): Promise<void> {
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