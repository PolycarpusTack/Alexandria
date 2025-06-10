/**
 * Template Wizard Service
 * 
 * Orchestrates template generation by connecting UI components
 * to the backend template engine services
 */

import { Logger } from '../../../../utils/logger';
import { EventBus } from '../../../../core/event-bus/interfaces';
import { AIService } from '../../../../core/services/ai-service/interfaces';
import { StorageService } from '../../../../core/services/storage/interfaces';
import { TemplateEngine } from './template-engine/template-engine';
import { TemplateDiscoveryService } from './template-discovery';
import { VariableResolver } from './template-engine/variable-resolver';
import { 
  TemplateManifest, 
  VariableMap, 
  GenerationResult,
  FileConflict 
} from './template-engine/interfaces';
import * as path from 'path';
import * as fs from 'fs/promises';

export interface GenerationProgress {
  phase: 'initializing' | 'resolving' | 'generating' | 'writing' | 'complete' | 'error';
  currentFile?: string;
  totalFiles: number;
  completedFiles: number;
  percentage: number;
  message: string;
  error?: Error;
}

export interface WizardGenerationOptions {
  templateId: string;
  variables: VariableMap;
  targetPath: string;
  projectPath?: string;
  enableAI?: boolean;
  handleConflicts?: 'skip' | 'overwrite' | 'merge' | 'prompt';
  onProgress?: (progress: GenerationProgress) => void;
  signal?: AbortSignal;
}

export interface WizardGenerationResult {
  success: boolean;
  filesGenerated: string[];
  conflicts: FileConflict[];
  errors: Array<{ file: string; error: Error }>;
  duration: number;
}

export class TemplateWizardService {
  private logger: Logger;
  private eventBus: EventBus;
  private templateEngine: TemplateEngine;
  private discoveryService: TemplateDiscoveryService;
  private variableResolver: VariableResolver;
  private aiService?: AIService;
  private storageService: StorageService;
  private activeGenerations = new Map<string, AbortController>();

  constructor(
    logger: Logger,
    eventBus: EventBus,
    templateEngine: TemplateEngine,
    discoveryService: TemplateDiscoveryService,
    variableResolver: VariableResolver,
    storageService: StorageService,
    aiService?: AIService
  ) {
    this.logger = logger;
    this.eventBus = eventBus;
    this.templateEngine = templateEngine;
    this.discoveryService = discoveryService;
    this.variableResolver = variableResolver;
    this.storageService = storageService;
    this.aiService = aiService;
  }

  /**
   * Generate template with progress tracking
   */
  async generateTemplate(options: WizardGenerationOptions): Promise<WizardGenerationResult> {
    const startTime = Date.now();
    const generationId = `gen-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const abortController = new AbortController();
    
    // Link external abort signal if provided
    if (options.signal) {
      options.signal.addEventListener('abort', () => abortController.abort());
    }
    
    this.activeGenerations.set(generationId, abortController);

    const result: WizardGenerationResult = {
      success: false,
      filesGenerated: [],
      conflicts: [],
      errors: [],
      duration: 0
    };

    try {
      // Phase 1: Initialization
      this.reportProgress(options.onProgress, {
        phase: 'initializing',
        totalFiles: 0,
        completedFiles: 0,
        percentage: 0,
        message: 'Loading template...'
      });

      // Get template manifest
      const template = this.discoveryService.getTemplate(options.templateId);
      if (!template) {
        throw new Error(`Template not found: ${options.templateId}`);
      }

      const totalFiles = template.files?.length || 0;

      // Phase 2: Variable Resolution
      this.reportProgress(options.onProgress, {
        phase: 'resolving',
        totalFiles,
        completedFiles: 0,
        percentage: 10,
        message: 'Resolving variables...'
      });

      // Resolve variables with AI assistance if enabled
      const resolvedVariables = await this.resolveVariables(
        template,
        options.variables,
        options.projectPath || options.targetPath,
        options.enableAI
      );

      // Check for abort
      if (abortController.signal.aborted) {
        throw new Error('Generation cancelled');
      }

      // Phase 3: Template Generation
      this.reportProgress(options.onProgress, {
        phase: 'generating',
        totalFiles,
        completedFiles: 0,
        percentage: 30,
        message: 'Generating files...'
      });

      const generationResult = await this.templateEngine.generateTemplate(
        options.templateId,
        resolvedVariables,
        {
          outputPath: options.targetPath,
          projectContext: {
            projectPath: options.projectPath || options.targetPath,
            projectType: 'auto-detect'
          }
        }
      );

      // Phase 4: File Writing
      let completedFiles = 0;
      for (const file of generationResult.files) {
        // Check for abort
        if (abortController.signal.aborted) {
          throw new Error('Generation cancelled');
        }

        this.reportProgress(options.onProgress, {
          phase: 'writing',
          currentFile: file.path,
          totalFiles,
          completedFiles,
          percentage: 30 + (completedFiles / totalFiles) * 60,
          message: `Writing ${path.basename(file.path)}...`
        });

        try {
          // Check for conflicts
          const fullPath = path.join(options.targetPath, file.path);
          const exists = await this.fileExists(fullPath);
          
          if (exists) {
            const conflict = await this.handleFileConflict(
              fullPath,
              file.content,
              options.handleConflicts || 'prompt'
            );
            
            if (conflict) {
              result.conflicts.push(conflict);
              if (options.handleConflicts === 'skip') {
                continue;
              }
            }
          }

          // Write file
          await this.writeFile(fullPath, file.content);
          result.filesGenerated.push(file.path);
          completedFiles++;

        } catch (error) {
          result.errors.push({
            file: file.path,
            error: error as Error
          });
          this.logger.error('Failed to write file', { 
            file: file.path, 
            error 
          });
        }
      }

      // Phase 5: Completion
      this.reportProgress(options.onProgress, {
        phase: 'complete',
        totalFiles,
        completedFiles,
        percentage: 100,
        message: `Generated ${result.filesGenerated.length} files successfully`
      });

      result.success = result.errors.length === 0;
      result.duration = Date.now() - startTime;

      // Record usage for analytics
      this.discoveryService.recordUsage(options.templateId, {
        rating: result.success ? 5 : 3,
        comment: result.success ? 'Generated successfully' : 'Completed with errors'
      });

      // Emit completion event
      this.eventBus.publish('template:generated', {
        templateId: options.templateId,
        targetPath: options.targetPath,
        filesGenerated: result.filesGenerated.length,
        duration: result.duration
      });

    } catch (error) {
      this.reportProgress(options.onProgress, {
        phase: 'error',
        totalFiles: 0,
        completedFiles: 0,
        percentage: 0,
        message: error instanceof Error ? error.message : 'Generation failed',
        error: error as Error
      });

      result.errors.push({
        file: 'general',
        error: error as Error
      });
      
      this.logger.error('Template generation failed', { 
        templateId: options.templateId,
        error 
      });
    } finally {
      this.activeGenerations.delete(generationId);
    }

    return result;
  }

  /**
   * Get AI suggestions for variables
   */
  async getVariableSuggestions(
    template: TemplateManifest,
    projectPath?: string
  ): Promise<VariableMap> {
    if (!this.aiService) {
      return {};
    }

    try {
      const projectContext = projectPath ? 
        await this.discoveryService.analyzeProject(projectPath) : 
        undefined;

      const prompt = this.buildSuggestionPrompt(template, projectContext);
      
      const response = await this.aiService.query(prompt, {
        model: 'default',
        maxTokens: 500,
        temperature: 0.3
      });

      // Parse AI response into variable suggestions
      return this.parseAISuggestions(response, template.variables || []);

    } catch (error) {
      this.logger.warn('Failed to get AI suggestions', { error });
      return {};
    }
  }

  /**
   * Get file tree preview
   */
  async getTemplatePreview(
    templateId: string,
    variables: VariableMap
  ): Promise<Array<{ path: string; type: 'file' | 'directory' }>> {
    const template = this.discoveryService.getTemplate(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    const preview: Array<{ path: string; type: 'file' | 'directory' }> = [];
    const directories = new Set<string>();

    // Process template files
    for (const file of template.files || []) {
      // Resolve path with variables
      const resolvedPath = this.resolvePathVariables(file.path, variables);
      
      // Add directories
      const dir = path.dirname(resolvedPath);
      if (dir !== '.' && !directories.has(dir)) {
        const parts = dir.split(path.sep);
        for (let i = 1; i <= parts.length; i++) {
          const subDir = parts.slice(0, i).join(path.sep);
          if (!directories.has(subDir)) {
            directories.add(subDir);
            preview.push({ path: subDir, type: 'directory' });
          }
        }
      }

      // Add file
      preview.push({ path: resolvedPath, type: 'file' });
    }

    return preview.sort((a, b) => {
      // Directories first, then alphabetical
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1;
      }
      return a.path.localeCompare(b.path);
    });
  }

  /**
   * Cancel active generation
   */
  cancelGeneration(generationId: string): boolean {
    const controller = this.activeGenerations.get(generationId);
    if (controller) {
      controller.abort();
      this.activeGenerations.delete(generationId);
      return true;
    }
    return false;
  }

  /**
   * Resolve variables with AI assistance
   */
  private async resolveVariables(
    template: TemplateManifest,
    providedVariables: VariableMap,
    projectPath: string,
    enableAI?: boolean
  ): Promise<VariableMap> {
    const projectContext = await this.discoveryService.analyzeProject(projectPath);
    
    const resolutionResult = await this.variableResolver.resolveVariables(
      template.variables || [],
      {
        projectPath,
        projectType: projectContext.projectType,
        language: projectContext.language,
        framework: projectContext.framework
      },
      providedVariables,
      {
        enableAI: enableAI && !!this.aiService,
        aiService: this.aiService
      }
    );

    return resolutionResult.resolvedVariables;
  }

  /**
   * Handle file conflicts
   */
  private async handleFileConflict(
    filePath: string,
    newContent: string,
    strategy: 'skip' | 'overwrite' | 'merge' | 'prompt'
  ): Promise<FileConflict | null> {
    try {
      const existingContent = await fs.readFile(filePath, 'utf-8');
      
      const conflict: FileConflict = {
        filePath,
        existingContent,
        newContent,
        conflictType: 'overwrite',
        fileSize: {
          existing: Buffer.byteLength(existingContent),
          new: Buffer.byteLength(newContent)
        },
        lastModified: (await fs.stat(filePath)).mtime
      };

      switch (strategy) {
        case 'skip':
          return conflict;
        case 'overwrite':
          return null; // Will overwrite
        case 'merge':
          // TODO: Implement intelligent merging
          return conflict;
        case 'prompt':
          return conflict; // Return for UI to handle
      }
    } catch (error) {
      // File doesn't exist, no conflict
      return null;
    }
  }

  /**
   * Write file with directory creation
   */
  private async writeFile(filePath: string, content: string): Promise<void> {
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, content, 'utf-8');
  }

  /**
   * Check if file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Report progress
   */
  private reportProgress(
    callback: ((progress: GenerationProgress) => void) | undefined,
    progress: GenerationProgress
  ): void {
    if (callback) {
      callback(progress);
    }
    
    this.eventBus.publish('template:generation-progress', progress);
  }

  /**
   * Build AI suggestion prompt
   */
  private buildSuggestionPrompt(
    template: TemplateManifest,
    projectContext?: any
  ): string {
    const parts = [
      `Generate variable suggestions for the "${template.name}" template.`,
      '',
      'Template Description: ' + template.description,
      'Category: ' + template.category,
      ''   
    ];

    if (projectContext) {
      parts.push(
        'Project Context:',
        `- Type: ${projectContext.projectType}`,
        `- Language: ${projectContext.language}`,
        `- Framework: ${projectContext.framework || 'none'}`,
        ''
      );
    }

    parts.push(
      'Variables to suggest values for:',
      ...template.variables?.map(v => `- ${v.name}: ${v.description}`) || [],
      '',
      'Provide practical, contextually appropriate suggestions.'
    );

    return parts.join('\n');
  }

  /**
   * Parse AI suggestions into variable map
   */
  private parseAISuggestions(aiResponse: string, variables: any[]): VariableMap {
    const suggestions: VariableMap = {};
    
    // Simple parsing - in production would be more sophisticated
    for (const variable of variables) {
      const regex = new RegExp(`${variable.name}[:\s]+([^\n]+)`, 'i');
      const match = aiResponse.match(regex);
      if (match) {
        suggestions[variable.name] = match[1].trim();
      }
    }

    return suggestions;
  }

  /**
   * Resolve path variables
   */
  private resolvePathVariables(pathTemplate: string, variables: VariableMap): string {
    return pathTemplate.replace(/{{(\w+)}}/g, (match, varName) => {
      return variables[varName] || match;
    });
  }
}