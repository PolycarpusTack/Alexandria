/**
 * Context-Aware Variable Resolver
 * 
 * Intelligent variable resolution system that combines project analysis,
 * AI assistance, and deterministic fallbacks for template generation
 */

import { Logger } from '../../../../../utils/logger';
import { VariableMap, VariableSchema, TemplateContext } from './interfaces';
import { EventBus } from '../../../../../core/event-bus/interfaces';
import { AIService } from '../../../../../core/services/ai-service/interfaces';
import { StorageService } from '../../../../../core/services/storage/interfaces';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface ProjectContext {
  rootPath: string;
  projectType: string;
  language: string;
  framework?: string;
  packageManager?: string;
  dependencies: Record<string, string>;
  gitInfo?: {
    remoteUrl?: string;
    currentBranch?: string;
    commitHash?: string;
  };
  structure: {
    hasTests: boolean;
    hasDocs: boolean;
    hasCI: boolean;
    hasTypeScript: boolean;
    hasLinting: boolean;
  };
  patterns: {
    namingConvention: 'camelCase' | 'PascalCase' | 'snake_case' | 'kebab-case';
    fileStructure: 'src-based' | 'feature-based' | 'flat' | 'monorepo';
    testPattern: 'jest' | 'vitest' | 'mocha' | 'pytest' | 'none';
  };
}

export interface AIVariableSuggestion {
  variable: string;
  value: any;
  confidence: number; // 0-1 scale
  reasoning: string;
  alternatives?: Array<{ value: any; confidence: number }>;
}

export interface ResolutionOptions {
  enableAI: boolean;
  enableProjectAnalysis: boolean;
  enableUserInteraction: boolean;
  confidenceThreshold: number; // Minimum confidence for AI suggestions
  timeoutMs: number;
  fallbackToDefaults: boolean;
}

export interface ResolutionResult {
  variables: VariableMap;
  confidence: number; // Overall confidence score
  aiSuggestions: AIVariableSuggestion[];
  fallbacksUsed: string[];
  errors: string[];
  analysisTime: number;
}

export class ContextAwareVariableResolver {
  private logger: Logger;
  private eventBus: EventBus;
  private aiService?: AIService;
  private storageService?: StorageService;
  private options: Required<ResolutionOptions>;

  // Project analysis cache
  private projectContextCache: Map<string, { context: ProjectContext; timestamp: Date }> = new Map();
  private aiSuggestionCache: Map<string, { suggestions: AIVariableSuggestion[]; timestamp: Date }> = new Map();

  // Deterministic patterns for fallbacks
  private namingPatterns = {
    camelCase: (name: string) => name.replace(/[-_\s]+(.)/g, (_, char) => char.toUpperCase()),
    PascalCase: (name: string) => name.replace(/[-_\s]+(.)/g, (_, char) => char.toUpperCase()).replace(/^./, char => char.toUpperCase()),
    snake_case: (name: string) => name.replace(/[-\s]+/g, '_').toLowerCase(),
    'kebab-case': (name: string) => name.replace(/[_\s]+/g, '-').toLowerCase()
  };

  private projectTypeDetectors = [
    { pattern: /package\.json/, type: 'node', languages: ['javascript', 'typescript'] },
    { pattern: /requirements\.txt|setup\.py/, type: 'python', languages: ['python'] },
    { pattern: /Cargo\.toml/, type: 'rust', languages: ['rust'] },
    { pattern: /go\.mod/, type: 'go', languages: ['go'] },
    { pattern: /pom\.xml|build\.gradle/, type: 'java', languages: ['java'] },
    { pattern: /Gemfile/, type: 'ruby', languages: ['ruby'] },
    { pattern: /composer\.json/, type: 'php', languages: ['php'] },
    { pattern: /\.csproj|\.sln/, type: 'dotnet', languages: ['csharp'] }
  ];

  constructor(
    logger: Logger,
    eventBus: EventBus,
    aiService?: AIService,
    storageService?: StorageService,
    options: Partial<ResolutionOptions> = {}
  ) {
    this.logger = logger;
    this.eventBus = eventBus;
    this.aiService = aiService;
    this.storageService = storageService;

    this.options = {
      enableAI: options.enableAI ?? true,
      enableProjectAnalysis: options.enableProjectAnalysis ?? true,
      enableUserInteraction: options.enableUserInteraction ?? false, // CLI/UI integration
      confidenceThreshold: options.confidenceThreshold ?? 0.7,
      timeoutMs: options.timeoutMs ?? 10000, // 10 seconds
      fallbackToDefaults: options.fallbackToDefaults ?? true
    };
  }

  /**
   * Resolve template variables using context analysis and AI assistance
   */
  async resolveVariables(
    variables: VariableSchema[],
    templateContext: TemplateContext,
    providedValues: VariableMap = {},
    options: Partial<ResolutionOptions> = {}
  ): Promise<ResolutionResult> {
    const startTime = Date.now();
    const resolveOptions = { ...this.options, ...options };
    
    const result: ResolutionResult = {
      variables: { ...providedValues },
      confidence: 0,
      aiSuggestions: [],
      fallbacksUsed: [],
      errors: [],
      analysisTime: 0
    };

    this.logger.info('Starting variable resolution', {
      variableCount: variables.length,
      providedCount: Object.keys(providedValues).length,
      projectPath: templateContext.projectPath
    });

    try {
      // 1. Analyze project context
      let projectContext: ProjectContext | null = null;
      if (resolveOptions.enableProjectAnalysis && templateContext.projectPath) {
        projectContext = await this.analyzeProjectContext(templateContext.projectPath);
      }

      // 2. Resolve each variable
      const resolutionPromises = variables.map(async (schema) => {
        return this.resolveVariable(schema, templateContext, projectContext, providedValues, resolveOptions);
      });

      // Execute with timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Variable resolution timeout')), resolveOptions.timeoutMs);
      });

      const resolutions = await Promise.race([
        Promise.all(resolutionPromises),
        timeoutPromise
      ]);

      // 3. Compile results
      for (const resolution of resolutions) {
        if (resolution.value !== undefined) {
          result.variables[resolution.variable] = resolution.value;
        }
        
        if (resolution.aiSuggestion) {
          result.aiSuggestions.push(resolution.aiSuggestion);
        }
        
        if (resolution.fallbackUsed) {
          result.fallbacksUsed.push(resolution.fallbackUsed);
        }
        
        if (resolution.error) {
          result.errors.push(resolution.error);
        }
      }

      // 4. Calculate overall confidence
      result.confidence = this.calculateOverallConfidence(result.aiSuggestions, result.fallbacksUsed);
      result.analysisTime = Date.now() - startTime;

      this.logger.info('Variable resolution completed', {
        resolvedCount: Object.keys(result.variables).length,
        confidence: result.confidence,
        aiSuggestions: result.aiSuggestions.length,
        fallbacks: result.fallbacksUsed.length,
        duration: `${result.analysisTime}ms`
      });

      return result;

    } catch (error) {
      result.errors.push(`Variable resolution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      result.analysisTime = Date.now() - startTime;
      
      this.logger.error('Variable resolution failed', { error, templateContext });
      return result;
    }
  }

  /**
   * Resolve a single variable with multiple strategies
   */
  private async resolveVariable(
    schema: VariableSchema,
    templateContext: TemplateContext,
    projectContext: ProjectContext | null,
    providedValues: VariableMap,
    options: Required<ResolutionOptions>
  ): Promise<{
    variable: string;
    value?: any;
    aiSuggestion?: AIVariableSuggestion;
    fallbackUsed?: string;
    error?: string;
  }> {
    const variableName = schema.name;

    // If already provided, use that value
    if (variableName in providedValues) {
      return { variable: variableName, value: providedValues[variableName] };
    }

    try {
      // Strategy 1: AI-powered suggestion
      if (options.enableAI && this.aiService) {
        const aiSuggestion = await this.getAISuggestion(schema, templateContext, projectContext);
        if (aiSuggestion && aiSuggestion.confidence >= options.confidenceThreshold) {
          return {
            variable: variableName,
            value: aiSuggestion.value,
            aiSuggestion
          };
        }
      }

      // Strategy 2: Project context inference
      if (options.enableProjectAnalysis && projectContext) {
        const contextValue = this.inferFromProjectContext(schema, projectContext);
        if (contextValue !== undefined) {
          return {
            variable: variableName,
            value: contextValue,
            fallbackUsed: 'project-analysis'
          };
        }
      }

      // Strategy 3: Pattern-based inference
      const patternValue = this.inferFromPatterns(schema, templateContext, projectContext);
      if (patternValue !== undefined) {
        return {
          variable: variableName,
          value: patternValue,
          fallbackUsed: 'pattern-inference'
        };
      }

      // Strategy 4: Schema default
      if (schema.default !== undefined) {
        return {
          variable: variableName,
          value: schema.default,
          fallbackUsed: 'schema-default'
        };
      }

      // Strategy 5: Type-based fallback
      if (options.fallbackToDefaults) {
        const fallbackValue = this.getTypeFallback(schema);
        return {
          variable: variableName,
          value: fallbackValue,
          fallbackUsed: 'type-fallback'
        };
      }

      return {
        variable: variableName,
        error: `Unable to resolve variable: ${variableName}`
      };

    } catch (error) {
      return {
        variable: variableName,
        error: `Error resolving ${variableName}: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Get AI-powered variable suggestion
   */
  private async getAISuggestion(
    schema: VariableSchema,
    templateContext: TemplateContext,
    projectContext: ProjectContext | null
  ): Promise<AIVariableSuggestion | null> {
    if (!this.aiService) return null;

    // Check cache first
    const cacheKey = this.generateAICacheKey(schema, templateContext, projectContext);
    const cached = this.aiSuggestionCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp.getTime() < 300000) { // 5 minutes
      return cached.suggestions[0] || null;
    }

    try {
      const prompt = this.buildAIPrompt(schema, templateContext, projectContext);
      
      const response = await this.aiService.query(prompt, {
        model: 'default',
        maxTokens: 200,
        temperature: 0.3, // Lower temperature for more deterministic results
        timeout: 5000
      });

      const suggestion = this.parseAIResponse(schema, response);
      
      if (suggestion) {
        // Cache the suggestion
        this.aiSuggestionCache.set(cacheKey, {
          suggestions: [suggestion],
          timestamp: new Date()
        });
      }

      return suggestion;

    } catch (error) {
      this.logger.warn('AI suggestion failed', { variable: schema.name, error });
      return null;
    }
  }

  /**
   * Build AI prompt for variable suggestion
   */
  private buildAIPrompt(
    schema: VariableSchema,
    templateContext: TemplateContext,
    projectContext: ProjectContext | null
  ): string {
    const parts = [
      'You are helping generate a variable value for a code template.',
      '',
      `Variable: ${schema.name}`,
      `Type: ${schema.type}`,
      `Description: ${schema.description}`,
      schema.required ? 'Required: Yes' : 'Required: No'
    ];

    if (schema.validation) {
      parts.push('Validation rules:');
      if (schema.validation.pattern) parts.push(`- Pattern: ${schema.validation.pattern}`);
      if (schema.validation.minLength) parts.push(`- Min length: ${schema.validation.minLength}`);
      if (schema.validation.maxLength) parts.push(`- Max length: ${schema.validation.maxLength}`);
      if (schema.validation.options) parts.push(`- Options: ${schema.validation.options.join(', ')}`);
    }

    if (projectContext) {
      parts.push('', 'Project context:');
      parts.push(`- Type: ${projectContext.projectType}`);
      parts.push(`- Language: ${projectContext.language}`);
      if (projectContext.framework) parts.push(`- Framework: ${projectContext.framework}`);
      parts.push(`- Naming convention: ${projectContext.patterns.namingConvention}`);
      
      if (Object.keys(projectContext.dependencies).length > 0) {
        const mainDeps = Object.keys(projectContext.dependencies).slice(0, 5).join(', ');
        parts.push(`- Main dependencies: ${mainDeps}`);
      }
    }

    if (schema.aiPrompt) {
      parts.push('', `Additional context: ${schema.aiPrompt}`);
    }

    parts.push('');
    parts.push('Please suggest an appropriate value. Respond with ONLY the value, no explanation.');
    parts.push('Make it realistic and follow the project\'s conventions.');

    return parts.join('\n');
  }

  /**
   * Parse AI response into suggestion
   */
  private parseAIResponse(schema: VariableSchema, response: string): AIVariableSuggestion | null {
    try {
      const value = response.trim();
      
      // Basic validation against schema
      if (!this.validateValue(value, schema)) {
        return null;
      }

      // Convert to appropriate type
      const typedValue = this.convertToType(value, schema.type);

      // Calculate confidence based on validation and context
      const confidence = this.calculateAIConfidence(typedValue, schema);

      return {
        variable: schema.name,
        value: typedValue,
        confidence,
        reasoning: 'AI-generated based on project context and conventions'
      };

    } catch (error) {
      this.logger.debug('Failed to parse AI response', { response, error });
      return null;
    }
  }

  /**
   * Infer variable value from project context
   */
  private inferFromProjectContext(schema: VariableSchema, projectContext: ProjectContext): any {
    const variableName = schema.name.toLowerCase();

    // Common project-based inferences
    if (variableName.includes('name') || variableName === 'projectname') {
      return path.basename(projectContext.rootPath);
    }

    if (variableName.includes('author') || variableName === 'author') {
      return projectContext.gitInfo?.remoteUrl 
        ? this.extractAuthorFromGitUrl(projectContext.gitInfo.remoteUrl)
        : 'Your Name';
    }

    if (variableName.includes('language')) {
      return projectContext.language;
    }

    if (variableName.includes('framework')) {
      return projectContext.framework || 'none';
    }

    if (variableName.includes('type') && schema.validation?.options) {
      // Match project type to available options
      const matchingOption = schema.validation.options.find(option => 
        option.toLowerCase().includes(projectContext.projectType) ||
        projectContext.projectType.includes(option.toLowerCase())
      );
      if (matchingOption) return matchingOption;
    }

    if (variableName.includes('test') && schema.type === 'boolean') {
      return projectContext.structure.hasTests;
    }

    if (variableName.includes('typescript') && schema.type === 'boolean') {
      return projectContext.structure.hasTypeScript;
    }

    if (variableName.includes('lint') && schema.type === 'boolean') {
      return projectContext.structure.hasLinting;
    }

    return undefined;
  }

  /**
   * Infer variable value from naming patterns and conventions
   */
  private inferFromPatterns(
    schema: VariableSchema,
    templateContext: TemplateContext,
    projectContext: ProjectContext | null
  ): any {
    const variableName = schema.name.toLowerCase();

    // Apply naming convention patterns
    if (projectContext && (variableName.includes('name') || variableName.includes('class'))) {
      const baseName = path.basename(templateContext.projectPath || 'Component');
      const converter = this.namingPatterns[projectContext.patterns.namingConvention];
      
      if (variableName.includes('component') || variableName.includes('class')) {
        return converter(baseName);
      }
    }

    // File path patterns
    if (variableName.includes('path') && schema.type === 'string') {
      return './src';
    }

    // Version patterns
    if (variableName.includes('version') && schema.type === 'string') {
      return '1.0.0';
    }

    // Description patterns
    if (variableName.includes('description') && schema.type === 'string') {
      const projectName = projectContext 
        ? path.basename(projectContext.rootPath)
        : 'project';
      return `A ${projectName} component`;
    }

    // Boolean defaults based on modern development practices
    if (schema.type === 'boolean') {
      if (variableName.includes('test') || variableName.includes('spec')) return true;
      if (variableName.includes('typescript') || variableName.includes('types')) return true;
      if (variableName.includes('lint') || variableName.includes('eslint')) return true;
      if (variableName.includes('git') || variableName.includes('vcs')) return true;
    }

    return undefined;
  }

  /**
   * Get type-based fallback value
   */
  private getTypeFallback(schema: VariableSchema): any {
    switch (schema.type) {
      case 'string':
        return schema.validation?.options ? schema.validation.options[0] : '';
      case 'number':
        return schema.validation?.min ?? 0;
      case 'boolean':
        return false;
      case 'array':
        return [];
      case 'object':
        return {};
      case 'select':
        return schema.validation?.options?.[0] ?? null;
      default:
        return null;
    }
  }

  /**
   * Analyze project context from filesystem
   */
  private async analyzeProjectContext(projectPath: string): Promise<ProjectContext | null> {
    // Check cache first
    const cached = this.projectContextCache.get(projectPath);
    if (cached && Date.now() - cached.timestamp.getTime() < 600000) { // 10 minutes
      return cached.context;
    }

    try {
      const context = await this.performProjectAnalysis(projectPath);
      
      // Cache the result
      this.projectContextCache.set(projectPath, {
        context,
        timestamp: new Date()
      });

      return context;

    } catch (error) {
      this.logger.warn('Project analysis failed', { projectPath, error });
      return null;
    }
  }

  /**
   * Perform actual project analysis
   */
  private async performProjectAnalysis(projectPath: string): Promise<ProjectContext> {
    const context: ProjectContext = {
      rootPath: projectPath,
      projectType: 'unknown',
      language: 'unknown',
      dependencies: {},
      structure: {
        hasTests: false,
        hasDocs: false,
        hasCI: false,
        hasTypeScript: false,
        hasLinting: false
      },
      patterns: {
        namingConvention: 'camelCase',
        fileStructure: 'flat',
        testPattern: 'none'
      }
    };

    try {
      const files = await fs.readdir(projectPath);
      
      // Detect project type and language
      for (const detector of this.projectTypeDetectors) {
        if (files.some(file => detector.pattern.test(file))) {
          context.projectType = detector.type;
          context.language = detector.languages[0];
          break;
        }
      }

      // Analyze package.json if it exists
      if (files.includes('package.json')) {
        await this.analyzePackageJson(projectPath, context);
      }

      // Check for TypeScript
      context.structure.hasTypeScript = files.some(file => 
        file.endsWith('.ts') || file.endsWith('.tsx') || file === 'tsconfig.json'
      );

      // Check for tests
      context.structure.hasTests = files.some(file => 
        file.includes('test') || file.includes('spec') || file === '__tests__'
      );

      // Check for CI
      context.structure.hasCI = files.includes('.github') || files.includes('.gitlab-ci.yml');

      // Check for linting
      context.structure.hasLinting = files.some(file => 
        file.includes('eslint') || file.includes('prettier') || file.includes('.editorconfig')
      );

      // Check for docs
      context.structure.hasDocs = files.some(file => 
        file.toLowerCase().includes('readme') || file === 'docs'
      );

      // Detect naming convention by analyzing existing files
      await this.detectNamingConvention(projectPath, context);

      this.logger.debug('Project analysis completed', {
        projectPath,
        type: context.projectType,
        language: context.language,
        structure: context.structure
      });

      return context;

    } catch (error) {
      this.logger.error('Failed to analyze project', { projectPath, error });
      throw error;
    }
  }

  /**
   * Analyze package.json for additional context
   */
  private async analyzePackageJson(projectPath: string, context: ProjectContext): Promise<void> {
    try {
      const packagePath = path.join(projectPath, 'package.json');
      const content = await fs.readFile(packagePath, 'utf-8');
      const packageJson = JSON.parse(content);

      // Extract dependencies
      context.dependencies = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies
      };

      // Detect framework
      const frameworks = {
        react: ['react', '@types/react'],
        vue: ['vue', '@vue/cli'],
        angular: ['@angular/core', '@angular/cli'],
        express: ['express', 'fastify'],
        next: ['next'],
        nuxt: ['nuxt'],
        svelte: ['svelte']
      };

      for (const [framework, packages] of Object.entries(frameworks)) {
        if (packages.some(pkg => context.dependencies[pkg])) {
          context.framework = framework;
          break;
        }
      }

      // Detect package manager
      const lockFiles = await fs.readdir(projectPath);
      if (lockFiles.includes('pnpm-lock.yaml')) {
        context.packageManager = 'pnpm';
      } else if (lockFiles.includes('yarn.lock')) {
        context.packageManager = 'yarn';
      } else if (lockFiles.includes('package-lock.json')) {
        context.packageManager = 'npm';
      }

      // Detect test pattern
      const testDeps = Object.keys(context.dependencies);
      if (testDeps.includes('jest')) context.patterns.testPattern = 'jest';
      else if (testDeps.includes('vitest')) context.patterns.testPattern = 'vitest';
      else if (testDeps.includes('mocha')) context.patterns.testPattern = 'mocha';

    } catch (error) {
      this.logger.debug('Failed to analyze package.json', { error });
    }
  }

  /**
   * Detect naming convention from existing files
   */
  private async detectNamingConvention(projectPath: string, context: ProjectContext): Promise<void> {
    try {
      const srcPath = path.join(projectPath, 'src');
      
      try {
        await fs.access(srcPath);
        const files = await fs.readdir(srcPath);
        
        const jsFiles = files.filter(f => f.endsWith('.js') || f.endsWith('.ts') || f.endsWith('.jsx') || f.endsWith('.tsx'));
        
        if (jsFiles.length > 0) {
          const naming = this.analyzeFileNaming(jsFiles);
          context.patterns.namingConvention = naming;
        }
      } catch {
        // src directory doesn't exist, skip
      }

    } catch (error) {
      this.logger.debug('Failed to detect naming convention', { error });
    }
  }

  /**
   * Analyze file naming patterns
   */
  private analyzeFileNaming(files: string[]): 'camelCase' | 'PascalCase' | 'snake_case' | 'kebab-case' {
    const patterns = {
      camelCase: 0,
      PascalCase: 0,
      snake_case: 0,
      'kebab-case': 0
    };

    for (const file of files) {
      const name = path.parse(file).name;
      
      if (/^[a-z][a-zA-Z0-9]*$/.test(name)) patterns.camelCase++;
      else if (/^[A-Z][a-zA-Z0-9]*$/.test(name)) patterns.PascalCase++;
      else if (/_/.test(name)) patterns.snake_case++;
      else if (/-/.test(name)) patterns['kebab-case']++;
    }

    // Return the most common pattern
    return Object.entries(patterns).reduce((a, b) => patterns[a[0]] > patterns[b[0]] ? a : b)[0] as any;
  }

  /**
   * Validate value against schema
   */
  private validateValue(value: any, schema: VariableSchema): boolean {
    if (schema.required && (value == null || value === '')) {
      return false;
    }

    if (schema.validation) {
      const validation = schema.validation;
      
      if (validation.pattern && typeof value === 'string') {
        if (!new RegExp(validation.pattern).test(value)) return false;
      }
      
      if (validation.minLength && typeof value === 'string') {
        if (value.length < validation.minLength) return false;
      }
      
      if (validation.maxLength && typeof value === 'string') {
        if (value.length > validation.maxLength) return false;
      }
      
      if (validation.options && !validation.options.includes(value)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Convert string value to appropriate type
   */
  private convertToType(value: string, type: VariableSchema['type']): any {
    switch (type) {
      case 'boolean':
        return value.toLowerCase() === 'true';
      case 'number':
        const num = parseFloat(value);
        return isNaN(num) ? 0 : num;
      case 'array':
        try {
          return JSON.parse(value);
        } catch {
          return value.split(',').map(s => s.trim());
        }
      case 'object':
        try {
          return JSON.parse(value);
        } catch {
          return {};
        }
      default:
        return value;
    }
  }

  /**
   * Calculate AI confidence score
   */
  private calculateAIConfidence(value: any, schema: VariableSchema): number {
    let confidence = 0.7; // Base confidence

    // Increase confidence if value validates perfectly
    if (this.validateValue(value, schema)) {
      confidence += 0.2;
    }

    // Increase confidence for specific patterns
    if (schema.validation?.pattern && typeof value === 'string') {
      if (new RegExp(schema.validation.pattern).test(value)) {
        confidence += 0.1;
      }
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Calculate overall confidence for all resolutions
   */
  private calculateOverallConfidence(suggestions: AIVariableSuggestion[], fallbacks: string[]): number {
    if (suggestions.length === 0 && fallbacks.length === 0) return 0;

    const aiConfidence = suggestions.length > 0 
      ? suggestions.reduce((sum, s) => sum + s.confidence, 0) / suggestions.length
      : 0;

    const fallbackPenalty = fallbacks.length * 0.1; // Reduce confidence for each fallback used
    
    return Math.max(aiConfidence - fallbackPenalty, 0.1);
  }

  /**
   * Extract author from git URL
   */
  private extractAuthorFromGitUrl(gitUrl: string): string {
    const match = gitUrl.match(/github\.com[:/]([^/]+)/);
    return match ? match[1] : 'Unknown';
  }

  /**
   * Generate cache key for AI suggestions
   */
  private generateAICacheKey(
    schema: VariableSchema,
    templateContext: TemplateContext,
    projectContext: ProjectContext | null
  ): string {
    const keyData = {
      variable: schema.name,
      type: schema.type,
      projectType: projectContext?.projectType,
      language: projectContext?.language,
      framework: projectContext?.framework
    };
    
    return JSON.stringify(keyData);
  }

  /**
   * Clear caches
   */
  clearCache(): void {
    this.projectContextCache.clear();
    this.aiSuggestionCache.clear();
    this.logger.debug('Variable resolver caches cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    projectContextEntries: number;
    aiSuggestionEntries: number;
  } {
    return {
      projectContextEntries: this.projectContextCache.size,
      aiSuggestionEntries: this.aiSuggestionCache.size
    };
  }
}