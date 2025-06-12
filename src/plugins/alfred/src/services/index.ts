/**
 * Alfred Services - Centralized export for all Alfred services
 */

// Core Alfred services
export { AlfredService } from './alfred-service';

// AI Integration services
export { AlfredAIAdapter, AlfredAIAdapterConfig, ChatOptions, CodeGenerationOptions } from './ai-adapter';
export { AlfredAIHelpers } from './ai-adapter-helpers';

// Template services
export { TemplateEngine, TemplateEngineConfig } from './template-engine/template-engine';
export { TemplateManager } from './template-manager';
export { TemplateWizardService } from './template-wizard-service';
export { TemplateDiscovery } from './template-discovery';

// Code Analysis services
export * from './code-analysis';

// Chat services
export * from './chat';

// Data and context services
export { CodeExtractionService } from './code-extraction-service';
export { TreeCacheService } from './tree-cache-service';
export { ProjectAnalyzer } from './project-analyzer';
export { ContextManager } from './context-manager';
export { DataServiceAdapter } from './data-service-adapter';

// Generation and suggestion services
export { CodeGenerator } from './code-generator';
export { SuggestionEngine } from './suggestion-engine';
export { StreamingService } from './streaming-service';