/**
 * Code Generator Service - AI-powered code generation with templates
 */

import { Logger } from '@utils/logger';
import { EventBus } from '@core/event-bus/event-bus';
import { AIService } from '@core/services/ai-service';
import { 
  CodeGenerationRequest,
  CodeGenerationResponse,
  CodeTemplate,
  ICodeGeneratorService,
  ProjectContext
} from '../interfaces';
import { TemplateManagerService } from './template-manager';

export class CodeGeneratorService implements ICodeGeneratorService {
  private generationHistory: Map<string, CodeGenerationResponse> = new Map();

  constructor(
    private logger: Logger,
    private eventBus: EventBus,
    private aiService: AIService,
    private templateManager: TemplateManagerService
  ) {}

  async generateCode(request: CodeGenerationRequest): Promise<CodeGenerationResponse> {
    this.logger.info('Generating code', { 
      templateId: request.templateId,
      language: request.context.language 
    });

    try {
      let prompt = request.prompt;
      let template: CodeTemplate | null = null;

      // If template specified, load and prepare it
      if (request.templateId) {
        template = await this.templateManager.getTemplate(request.templateId);
        if (!template) {
          throw new Error(`Template not found: ${request.templateId}`);
        }

        prompt = this.preparePromptWithTemplate(template, request);
      }

      // Build system prompt based on context
      const systemPrompt = this.buildSystemPrompt(request.context);

      // Generate code using AI
      const startTime = Date.now();
      const aiResponse = await this.aiService.query(prompt, {
        model: 'deepseek-coder:latest', // Or from config
        systemPrompt,
        temperature: 0.7,
        maxTokens: 4000
      });

      // Parse AI response
      const response = this.parseAIResponse(aiResponse.content, request.context.language);
      
      // Add metadata
      response.dependencies = await this.extractDependencies(response.code, request.context.language);
      response.warnings = this.checkForWarnings(response.code, request.context);

      // Cache the generation
      const cacheKey = this.getCacheKey(request);
      this.generationHistory.set(cacheKey, response);

      // Emit event
      this.eventBus.emit('alfred:code-generated', {
        language: request.context.language,
        linesOfCode: response.code.split('\n').length,
        templateUsed: request.templateId,
        duration: Date.now() - startTime
      });

      return response;

    } catch (error) {
      this.logger.error('Code generation failed', { error, request });
      throw error;
    }
  }

  async showGenerateDialog(): Promise<void> {
    // This would be handled by the UI layer
    this.eventBus.emit('alfred:show-generate-dialog');
  }

  async validateTemplate(template: CodeTemplate): Promise<boolean> {
    try {
      // Check required fields
      if (!template.name || !template.template || !template.language) {
        return false;
      }

      // Validate variables
      for (const variable of template.variables) {
        if (!variable.name || !variable.type) {
          return false;
        }

        // Validate regex if provided
        if (variable.validation) {
          try {
            new RegExp(variable.validation);
          } catch {
            return false;
          }
        }
      }

      // Try to render template with dummy variables
      const dummyVars: Record<string, any> = {};
      for (const variable of template.variables) {
        dummyVars[variable.name] = this.getDummyValue(variable.type);
      }

      this.renderTemplate(template.template, dummyVars);
      return true;

    } catch (error) {
      this.logger.warn('Template validation failed', { error, templateName: template.name });
      return false;
    }
  }

  async previewGeneration(request: CodeGenerationRequest): Promise<string> {
    // Generate but don't save to history
    const response = await this.generateCode(request);
    return response.code;
  }

  // Private helper methods

  private preparePromptWithTemplate(template: CodeTemplate, request: CodeGenerationRequest): string {
    // Render template with provided variables
    const renderedTemplate = this.renderTemplate(template.template, request.variables || {});

    // Combine with user prompt
    return `${request.prompt}\n\nUse this template as a guide:\n\n${renderedTemplate}`;
  }

  private buildSystemPrompt(context: any): string {
    const parts = [
      'You are an expert code generator. Generate clean, well-documented, production-ready code.',
      `Language: ${context.language}`
    ];

    if (context.framework) {
      parts.push(`Framework: ${context.framework}`);
    }

    if (context.projectContext) {
      parts.push(`Project Type: ${context.projectContext.projectType}`);
      parts.push(`Project: ${context.projectContext.projectName}`);
    }

    if (context.additionalInstructions) {
      parts.push(`Additional Instructions: ${context.additionalInstructions}`);
    }

    parts.push('Follow best practices and include appropriate error handling.');
    parts.push('Add helpful comments but avoid over-commenting obvious code.');

    return parts.join('\n');
  }

  private parseAIResponse(content: string, language: string): CodeGenerationResponse {
    // Try to extract code blocks
    const codeBlockRegex = /```(?:\w+)?\n([\s\S]*?)```/g;
    const matches = Array.from(content.matchAll(codeBlockRegex));

    let code = '';
    let explanation = content;

    if (matches.length > 0) {
      // Extract code from code blocks
      code = matches.map(match => match[1].trim()).join('\n\n');
      
      // Remove code blocks from explanation
      explanation = content.replace(codeBlockRegex, '').trim();
    } else {
      // No code blocks, assume entire response is code
      code = content;
      explanation = undefined;
    }

    return {
      code,
      language,
      explanation
    };
  }

  private async extractDependencies(code: string, language: string): Promise<string[]> {
    const dependencies: Set<string> = new Set();

    switch (language.toLowerCase()) {
      case 'python':
        // Extract imports
        const pythonImports = code.match(/^(?:from\s+(\S+)|import\s+(\S+))/gm);
        if (pythonImports) {
          pythonImports.forEach(imp => {
            const match = imp.match(/(?:from\s+(\S+)|import\s+(\S+))/);
            if (match) {
              const module = (match[1] || match[2]).split('.')[0];
              // Filter out standard library modules (basic heuristic)
              if (!['os', 'sys', 'json', 'datetime', 'math', 'random', 'collections'].includes(module)) {
                dependencies.add(module);
              }
            }
          });
        }
        break;

      case 'javascript':
      case 'typescript':
        // Extract imports and requires
        const jsImports = code.match(/(?:import.*from\s+['"]([^'"]+)['"]|require\(['"]([^'"]+)['"]\))/g);
        if (jsImports) {
          jsImports.forEach(imp => {
            const match = imp.match(/['"]([^'"]+)['"]/);
            if (match && !match[1].startsWith('.')) {
              dependencies.add(match[1]);
            }
          });
        }
        break;

      // Add more language-specific extractors...
    }

    return Array.from(dependencies);
  }

  private checkForWarnings(code: string, context: any): string[] {
    const warnings: string[] = [];

    // Check for common issues
    if (code.includes('TODO')) {
      warnings.push('Code contains TODO comments that need to be addressed');
    }

    if (code.includes('FIXME')) {
      warnings.push('Code contains FIXME comments indicating potential issues');
    }

    // Language-specific checks
    if (context.language === 'javascript' || context.language === 'typescript') {
      if (code.includes('var ')) {
        warnings.push('Consider using let or const instead of var');
      }
      if (code.includes('console.log')) {
        warnings.push('Remove console.log statements before production');
      }
    }

    if (context.language === 'python') {
      if (code.includes('print(')) {
        warnings.push('Consider using proper logging instead of print statements');
      }
    }

    return warnings;
  }

  private renderTemplate(template: string, variables: Record<string, any>): string {
    let rendered = template;

    // Replace all {{variable}} with values
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      rendered = rendered.replace(regex, String(value));
    }

    return rendered;
  }

  private getDummyValue(type: string): any {
    switch (type) {
      case 'string':
        return 'example';
      case 'number':
        return 42;
      case 'boolean':
        return true;
      case 'array':
        return ['item1', 'item2'];
      case 'object':
        return { key: 'value' };
      default:
        return 'dummy';
    }
  }

  private getCacheKey(request: CodeGenerationRequest): string {
    const key = `${request.templateId || 'no-template'}-${request.prompt}-${request.context.language}`;
    return Buffer.from(key).toString('base64');
  }
}