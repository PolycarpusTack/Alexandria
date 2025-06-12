import { EventEmitter } from 'events';
import { ProjectContext, CodeAnalysisResult, CodeGenerationRequest, GenerationResult, CodeExample, FileAnalysis, ProjectPattern } from '../../interfaces';
import { AlfredAIAdapter } from '../ai-adapter';
import { TemplateEngine } from '../template-engine/template-engine';
import { AlfredAIHelpers } from '../ai-adapter-helpers';

export interface CodeAnalysisEngineConfig {
  maxFilesToAnalyze?: number;
  maxFileSize?: number;
  analysisDepth?: 'shallow' | 'medium' | 'deep';
  cacheResults?: boolean;
  enablePatternDetection?: boolean;
  supportedLanguages?: string[];
}

export interface AnalysisOptions {
  includeTests?: boolean;
  includeComments?: boolean;
  analyzeImports?: boolean;
  detectPatterns?: boolean;
  generateExamples?: boolean;
}

export class CodeAnalysisEngine extends EventEmitter {
  private config: CodeAnalysisEngineConfig;
  private aiAdapter: AlfredAIAdapter;
  private templateEngine: TemplateEngine;
  private analysisCache: Map<string, CodeAnalysisResult> = new Map();
  private patternCache: Map<string, ProjectPattern[]> = new Map();

  constructor(
    aiAdapter: AlfredAIAdapter,
    templateEngine: TemplateEngine,
    config: CodeAnalysisEngineConfig = {}
  ) {
    super();
    this.aiAdapter = aiAdapter;
    this.templateEngine = templateEngine;
    this.config = {
      maxFilesToAnalyze: 50,
      maxFileSize: 500 * 1024, // 500KB
      analysisDepth: 'medium',
      cacheResults: true,
      enablePatternDetection: true,
      supportedLanguages: ['javascript', 'typescript', 'python', 'java', 'go', 'rust', 'cpp'],
      ...config
    };
  }

  async analyzeProject(
    projectPath: string, 
    options: AnalysisOptions = {}
  ): Promise<CodeAnalysisResult> {
    const cacheKey = `${projectPath}:${JSON.stringify(options)}`;
    
    if (this.config.cacheResults && this.analysisCache.has(cacheKey)) {
      return this.analysisCache.get(cacheKey)!;
    }

    this.emit('analysisStarted', { projectPath, options });
    const startTime = Date.now();

    try {
      // Step 1: Discover and categorize files
      const fileStructure = await this.discoverProjectFiles(projectPath);
      
      // Step 2: Analyze individual files
      const fileAnalyses = await this.analyzeFiles(fileStructure, options);
      
      // Step 3: Detect project patterns and conventions
      const patterns = await this.detectProjectPatterns(fileAnalyses, options);
      
      // Step 4: Extract code examples
      const codeExamples = options.generateExamples 
        ? await this.extractCodeExamples(fileAnalyses, patterns)
        : [];
      
      // Step 5: Generate project context
      const projectContext = await this.buildProjectContext(
        projectPath, 
        fileAnalyses, 
        patterns, 
        codeExamples
      );
      
      // Step 6: AI-powered insights
      const insights = await this.generateAIInsights(projectContext, fileAnalyses);

      const result: CodeAnalysisResult = {
        projectPath,
        timestamp: new Date(),
        fileStructure,
        fileAnalyses,
        patterns,
        codeExamples,
        projectContext,
        insights,
        metadata: {
          filesAnalyzed: fileAnalyses.length,
          patternsDetected: patterns.length,
          examplesExtracted: codeExamples.length,
          analysisTimeMs: Date.now() - startTime,
          analysisDepth: this.config.analysisDepth
        }
      };

      if (this.config.cacheResults) {
        this.analysisCache.set(cacheKey, result);
      }

      this.emit('analysisCompleted', { 
        projectPath, 
        duration: Date.now() - startTime,
        filesAnalyzed: fileAnalyses.length 
      });

      return result;

    } catch (error) {
      this.emit('analysisError', { projectPath, error });
      throw new Error(`Project analysis failed: ${error.message}`);
    }
  }

  async generateCode(request: CodeGenerationRequest): Promise<GenerationResult> {
    this.emit('codeGenerationStarted', { request });
    
    try {
      // Analyze context if needed
      let projectContext = request.context;
      if (!projectContext && request.projectPath) {
        const analysis = await this.analyzeProject(request.projectPath, {
          generateExamples: true,
          detectPatterns: true
        });
        projectContext = analysis.projectContext;
      }

      // Generate code using AI adapter
      const aiResponse = await this.aiAdapter.generateCode(
        request.prompt,
        projectContext!,
        {
          language: request.language,
          style: request.style,
          includeComments: request.includeComments,
          includeTests: request.includeTests
        }
      );

      // Process with template engine if template is specified
      let finalCode = aiResponse.code;
      let processedFiles = [];

      if (request.templateId) {
        const template = await this.getTemplate(request.templateId);
        if (template) {
          const templateResult = await this.templateEngine.processTemplate(
            template,
            {
              code: aiResponse.code,
              language: aiResponse.language,
              ...request.variables
            },
            projectContext
          );
          
          finalCode = templateResult.content;
          processedFiles = templateResult.files;
        }
      }

      const result: GenerationResult = {
        id: aiResponse.id,
        code: finalCode,
        language: aiResponse.language,
        explanation: aiResponse.explanation,
        files: processedFiles,
        dependencies: aiResponse.dependencies,
        warnings: aiResponse.warnings,
        suggestions: await this.generateCodeSuggestions(finalCode, projectContext),
        metadata: {
          ...aiResponse.metadata,
          templateUsed: !!request.templateId,
          filesGenerated: processedFiles.length
        },
        timestamp: new Date()
      };

      this.emit('codeGenerated', {
        language: result.language,
        linesOfCode: result.code.split('\n').length,
        hasTests: result.metadata.hasTests
      });

      return result;

    } catch (error) {
      this.emit('codeGenerationError', { request, error });
      throw error;
    }
  }

  async refactorCode(
    code: string,
    refactorType: 'extract-function' | 'rename-variable' | 'optimize' | 'add-types' | 'add-tests',
    context: ProjectContext,
    options: any = {}
  ): Promise<GenerationResult> {
    const prompt = this.buildRefactorPrompt(code, refactorType, options);
    
    return this.generateCode({
      prompt,
      context,
      language: context.languages?.[0] || 'typescript',
      style: 'functional',
      includeComments: true,
      variables: { originalCode: code, refactorType, ...options }
    });
  }

  async analyzeCodeQuality(
    code: string,
    language: string,
    context?: ProjectContext
  ): Promise<{
    score: number;
    issues: Array<{ type: string; message: string; line?: number; severity: 'low' | 'medium' | 'high' }>;
    suggestions: Array<{ type: string; suggestion: string; impact: string }>;
    metrics: { complexity: number; maintainability: number; testability: number };
  }> {
    const prompt = `Analyze this ${language} code for quality, complexity, and potential issues:\n\n\`\`\`${language}\n${code}\n\`\`\`\n\nProvide:\n1. Quality score (0-100)\n2. Specific issues with line numbers\n3. Improvement suggestions\n4. Complexity metrics`;

    const response = await this.aiAdapter.continueConversation(
      'code-quality-analysis',
      prompt,
      [],
      context
    );

    // Parse AI response and structure the results
    return this.parseQualityAnalysis(response.response, code);
  }

  // Private helper methods

  private async discoverProjectFiles(projectPath: string): Promise<any> {
    // File discovery logic would integrate with Alexandria's file service
    // For now, return a mock structure
    return {
      totalFiles: 0,
      directories: [],
      supportedFiles: [],
      configFiles: [],
      testFiles: []
    };
  }

  private async analyzeFiles(fileStructure: any, options: AnalysisOptions): Promise<FileAnalysis[]> {
    const analyses: FileAnalysis[] = [];
    
    // This would analyze each file using appropriate parsers
    // Implementation would depend on Alexandria's file service integration
    
    return analyses;
  }

  private async detectProjectPatterns(
    fileAnalyses: FileAnalysis[], 
    options: AnalysisOptions
  ): Promise<ProjectPattern[]> {
    if (!this.config.enablePatternDetection || !options.detectPatterns) {
      return [];
    }

    const patterns: ProjectPattern[] = [];
    
    // Detect common patterns like:
    // - Architecture patterns (MVC, Redux, etc.)
    // - Naming conventions
    // - Import/export patterns
    // - Testing patterns
    // - Configuration patterns
    
    return patterns;
  }

  private async extractCodeExamples(
    fileAnalyses: FileAnalysis[], 
    patterns: ProjectPattern[]
  ): Promise<CodeExample[]> {
    const examples: CodeExample[] = [];
    
    // Extract representative code examples for templates and AI context
    
    return examples;
  }

  private async buildProjectContext(
    projectPath: string,
    fileAnalyses: FileAnalysis[],
    patterns: ProjectPattern[],
    codeExamples: CodeExample[]
  ): Promise<ProjectContext> {
    // Aggregate all analysis into a comprehensive project context
    const languages = new Set<string>();
    const frameworks = new Set<string>();
    const dependencies = new Set<string>();

    fileAnalyses.forEach(analysis => {
      if (analysis.language) languages.add(analysis.language);
      if (analysis.frameworks) analysis.frameworks.forEach(fw => frameworks.add(fw));
      if (analysis.dependencies) analysis.dependencies.forEach(dep => dependencies.add(dep));
    });

    return {
      projectName: projectPath.split('/').pop() || 'unknown',
      projectPath,
      projectType: this.detectProjectType(patterns, Array.from(frameworks)),
      languages: Array.from(languages),
      frameworks: Array.from(frameworks),
      dependencies: Array.from(dependencies),
      codeStyle: this.extractCodeStyle(patterns),
      codeExamples,
      patterns,
      metadata: {
        analysisTimestamp: new Date(),
        totalFiles: fileAnalyses.length,
        patternsDetected: patterns.length
      }
    };
  }

  private async generateAIInsights(
    context: ProjectContext, 
    fileAnalyses: FileAnalysis[]
  ): Promise<string[]> {
    const prompt = `Analyze this project and provide key insights:\n\n${AlfredAIHelpers.buildProjectContextPrompt(context)}\n\nProvide 3-5 actionable insights about architecture, code quality, and improvement opportunities.`;
    
    try {
      const response = await this.aiAdapter.continueConversation(
        'project-insights',
        prompt,
        [],
        context
      );
      
      // Extract insights from response
      const insights = response.response
        .split('\n')
        .filter(line => line.trim().startsWith('-') || line.trim().match(/^\d+\./))
        .map(line => line.replace(/^[\-\d\.\s]+/, '').trim())
        .filter(insight => insight.length > 10);
      
      return insights.slice(0, 5);
    } catch (error) {
      return ['AI insights temporarily unavailable'];
    }
  }

  private async generateCodeSuggestions(
    code: string, 
    context?: ProjectContext
  ): Promise<Array<{ suggestion: string; type: string; confidence: number }>> {
    try {
      return await this.aiAdapter.getCodeSuggestions(
        code,
        { line: 0, column: 0 }, // We'll enhance this with actual cursor position later
        context!
      );
    } catch (error) {
      return [];
    }
  }

  private buildRefactorPrompt(code: string, type: string, options: any): string {
    const prompts = {
      'extract-function': `Extract a reusable function from this code:\n\n\`\`\`\n${code}\n\`\`\`\n\nFunction name: ${options.functionName || 'extracted'}\nExtract lines: ${options.startLine || 'auto'} to ${options.endLine || 'auto'}`,
      'rename-variable': `Rename variable '${options.oldName}' to '${options.newName}' in this code:\n\n\`\`\`\n${code}\n\`\`\``,
      'optimize': `Optimize this code for better performance and readability:\n\n\`\`\`\n${code}\n\`\`\``,
      'add-types': `Add TypeScript types to this JavaScript code:\n\n\`\`\`\n${code}\n\`\`\``,
      'add-tests': `Generate comprehensive unit tests for this code:\n\n\`\`\`\n${code}\n\`\`\``
    };

    return prompts[type] || `Refactor this code:\n\n\`\`\`\n${code}\n\`\`\``;
  }

  private async getTemplate(templateId: string): Promise<any> {
    // This would integrate with the template repository
    // For now, return null
    return null;
  }

  private parseQualityAnalysis(response: string, originalCode: string): any {
    // Parse AI response into structured quality analysis
    const lines = originalCode.split('\n').length;
    
    return {
      score: 75, // Default score, would be parsed from AI response
      issues: [],
      suggestions: [],
      metrics: {
        complexity: Math.min(Math.floor(lines / 10), 10),
        maintainability: 7,
        testability: 6
      }
    };
  }

  private detectProjectType(patterns: ProjectPattern[], frameworks: string[]): string {
    if (frameworks.includes('react')) return 'react-app';
    if (frameworks.includes('vue')) return 'vue-app';
    if (frameworks.includes('angular')) return 'angular-app';
    if (frameworks.includes('express')) return 'node-backend';
    if (frameworks.includes('django')) return 'python-web';
    if (frameworks.includes('spring')) return 'java-enterprise';
    return 'general';
  }

  private extractCodeStyle(patterns: ProjectPattern[]): any {
    return {
      indentSize: 2,
      quotes: 'single',
      semicolons: true,
      trailingCommas: true
    };
  }

  // Public utility methods

  clearCache(): void {
    this.analysisCache.clear();
    this.patternCache.clear();
    this.emit('cacheCleared');
  }

  getCacheStats(): { analysisEntries: number; patternEntries: number } {
    return {
      analysisEntries: this.analysisCache.size,
      patternEntries: this.patternCache.size
    };
  }

  updateConfig(updates: Partial<CodeAnalysisEngineConfig>): void {
    this.config = { ...this.config, ...updates };
    this.emit('configUpdated', { config: this.config });
  }

  getConfig(): CodeAnalysisEngineConfig {
    return { ...this.config };
  }
}