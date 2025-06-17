import Mustache from 'mustache';
import { 
  CodeTemplate, 
  ProcessedTemplate, 
  ProcessedFile, 
  TemplateError, 
  GenerationResult, 
  GeneratedFile,
  TemplateVariable,
  ProjectContext
} from '../../interfaces';


import { createLogger } from '../../../../../utils/logger';

const logger = createLogger({ serviceName: 'template-engine' });
export interface TemplateEngineConfig {
  securityEnabled?: boolean;
  maxFileSize?: number;
  allowedFileTypes?: string[];
  outputDirectory?: string;
  backupEnabled?: boolean;
  enableAdvancedFeatures?: boolean;
}

export class TemplateEngine {
  private config: TemplateEngineConfig;
  private customHelpers: Map<string, Function> = new Map();
  private securityPatterns: RegExp[] = [
    /eval\s*\(/gi,
    /<script[^>]*>/gi,
    /javascript:/gi,
    /vbscript:/gi,
    /on\w+\s*=/gi,
    /\$\{.*\}/gi, // Template literal injection
    /<%.*%>/gi,   // Server-side template injection
  ];

  constructor(config: TemplateEngineConfig = {}) {
    this.config = {
      securityEnabled: true,
      maxFileSize: 1024 * 1024, // 1MB
      allowedFileTypes: ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.go', '.rs', '.md', '.json', '.yml', '.yaml', '.html', '.css', '.sql'],
      backupEnabled: true,
      enableAdvancedFeatures: true,
      ...config
    };

    this.initializeHelpers();
  }

  async processTemplate(
    template: CodeTemplate, 
    variables: Record<string, any>, 
    context?: ProjectContext
  ): Promise<ProcessedTemplate> {
    const startTime = Date.now();
    const errors: TemplateError[] = [];
    const files: ProcessedFile[] = [];
    const variablesUsed: string[] = [];

    try {
      // Validate template
      const validationErrors = this.validateTemplate(template);
      if (validationErrors.length > 0) {
        errors.push(...validationErrors);
        return this.createErrorResult(errors);
      }

      // Validate variables
      const variableErrors = this.validateVariables(template.variables, variables);
      if (variableErrors.length > 0) {
        errors.push(...variableErrors);
        return this.createErrorResult(errors);
      }

      // Security check
      if (this.config.securityEnabled) {
        const securityErrors = this.performSecurityCheck(template.template, variables);
        if (securityErrors.length > 0) {
          errors.push(...securityErrors);
          return this.createErrorResult(errors);
        }
      }

      // Enhance variables with context and helpers
      const enhancedVariables = this.enhanceVariables(variables, context);

      // Process template content
      const processedContent = await this.renderTemplate(template.template, enhancedVariables);
      
      // Extract variables used
      variablesUsed.push(...this.extractUsedVariables(template.template));

      // Generate files from template
      const generatedFiles = await this.generateFilesFromTemplate(
        template, 
        processedContent, 
        enhancedVariables, 
        context
      );

      files.push(...generatedFiles);

      return {
        content: processedContent,
        files,
        errors,
        metadata: {
          variablesUsed,
          filesGenerated: files.length,
          totalSize: files.reduce((sum, file) => sum + file.content.length, 0)
        }
      };

    } catch (error) {
      errors.push({
        type: 'syntax_error',
        message: `Template processing failed: ${error.message}`,
        line: 0
      });

      return this.createErrorResult(errors);
    }
  }

  // [Rest of implementation continues with all helper methods...]
  // Note: Due to length constraints, showing condensed version
  // Full implementation includes all security, validation, and processing methods

  private async renderTemplate(templateContent: string, variables: Record<string, any>): Promise<string> {
    try {
      const preprocessed = this.preprocessTemplate(templateContent, variables);
      const rendered = Mustache.render(preprocessed, variables, {}, {
        escape: (text) => text // Don't escape for code generation
      });
      return this.postprocessTemplate(rendered, variables);
    } catch (error) {
      throw new Error(`Template rendering failed: ${error.message}`);
    }
  }

  private preprocessTemplate(content: string, variables: Record<string, any>): string {
    if (!this.config.enableAdvancedFeatures) return content;
    
    let processed = content;
    processed = this.processIncludes(processed);
    processed = this.processConditionals(processed, variables);
    processed = this.processHelpers(processed, variables);
    processed = this.processRepeats(processed, variables);
    return processed;
  }

  private processConditionals(content: string, variables: Record<string, any>): string {
    // Handle {{#if condition}} blocks
    const ifRegex = /\{\{#if\s+([^}]+)\}\}([\s\S]*?)\{\{\/if\}\}/g;
    return content.replace(ifRegex, (match, condition, body) => {
      const conditionResult = this.evaluateCondition(condition.trim(), variables);
      return conditionResult ? body : '';
    });
  }

  private enhanceVariables(variables: Record<string, any>, context?: ProjectContext): Record<string, any> {
    const enhanced = { ...variables };

    // Add helper functions
    enhanced.helpers = {
      capitalize: (str: string) => str.charAt(0).toUpperCase() + str.slice(1),
      camelCase: (str: string) => str.replace(/[-_\s]+(.)?/g, (_, c) => c ? c.toUpperCase() : ''),
      now: () => new Date().toISOString(),
      uuid: () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };

    // Add project context
    if (context) {
      enhanced.project = {
        name: context.projectName,
        type: context.projectType,
        path: context.projectPath
      };
    }

    enhanced.timestamp = new Date().toISOString();
    enhanced.author = enhanced.author || 'Alfred AI Assistant';
    return enhanced;
  }

  // Validation and security methods
  private validateTemplate(template: CodeTemplate): TemplateError[] {
    const errors: TemplateError[] = [];
    
    if (!template.template || typeof template.template !== 'string') {
      errors.push({
        type: 'syntax_error',
        message: 'Template content is required and must be a string'
      });
    }

    if (!template.variables || !Array.isArray(template.variables)) {
      errors.push({
        type: 'syntax_error',
        message: 'Template variables must be an array'
      });
    }

    return errors;
  }

  private validateVariables(templateVars: TemplateVariable[], providedVars: Record<string, any>): TemplateError[] {
    const errors: TemplateError[] = [];

    for (const templateVar of templateVars) {
      const value = providedVars[templateVar.name];

      if (templateVar.required && (value === undefined || value === null || value === '')) {
        errors.push({
          type: 'missing_variable',
          variable: templateVar.name,
          message: `Required variable '${templateVar.name}' is missing`
        });
      }
    }

    return errors;
  }

  private performSecurityCheck(template: string, variables: Record<string, any>): TemplateError[] {
    const errors: TemplateError[] = [];

    for (const pattern of this.securityPatterns) {
      if (pattern.test(template)) {
        errors.push({
          type: 'security_violation',
          message: `Template contains potentially dangerous pattern: ${pattern.source}`
        });
      }
    }

    return errors;
  }

  // Helper methods for processing
  private processIncludes(content: string): string {
    return content.replace(/\{\{>\s*([^}]+)\}\}/g, (match, partialName) => {
      return `<!-- Included: ${partialName.trim()} -->`;
    });
  }

  private processHelpers(content: string, variables: Record<string, any>): string {
    return content.replace(/\{\{(\w+)\s+([^}]+)\}\}/g, (match, helperName, args) => {
      const helper = this.customHelpers.get(helperName);
      if (helper) {
        try {
          const argValues = this.parseHelperArgs(args, variables);
          return helper(...argValues);
        } catch (error) {
          logger.warn(`Helper ${helperName} failed:`, error);
          return match;
        }
      }
      return match;
    });
  }

  private processRepeats(content: string, variables: Record<string, any>): string {
    return content.replace(/\{\{#repeat\s+(\d+)\}\}([\s\S]*?)\{\{\/repeat\}\}/g, (match, countStr, body) => {
      const count = parseInt(countStr, 10);
      let result = '';
      for (let i = 0; i < count; i++) {
        result += body.replace(/\{\{@index\}\}/g, i.toString());
      }
      return result;
    });
  }

  private postprocessTemplate(content: string, variables: Record<string, any>): string {
    let processed = content;
    processed = processed.replace(/\n\s*\n\s*\n/g, '\n\n');
    processed = this.fixIndentation(processed);
    
    const language = variables.language || this.detectLanguage(processed);
    if (language) {
      processed = this.formatCode(processed, language);
    }
    
    return processed;
  }

  private async generateFilesFromTemplate(
    template: CodeTemplate,
    content: string,
    variables: Record<string, any>,
    context?: ProjectContext
  ): Promise<ProcessedFile[]> {
    const files: ProcessedFile[] = [];

    if (variables.files && Array.isArray(variables.files)) {
      for (const fileSpec of variables.files) {
        const file = await this.generateSingleFile(fileSpec, content, variables, context);
        if (file) files.push(file);
      }
    } else {
      const fileName = variables.fileName || this.generateFileName(template, variables);
      const filePath = variables.filePath || fileName;
      
      files.push({
        path: filePath,
        content,
        language: variables.language || template.language || this.detectLanguage(content),
        action: 'create'
      });
    }

    return files;
  }

  private async generateSingleFile(
    fileSpec: any,
    templateContent: string,
    variables: Record<string, any>,
    context?: ProjectContext
  ): Promise<ProcessedFile | null> {
    try {
      const fileName = Mustache.render(fileSpec.name || fileSpec.path, variables);
      const filePath = fileSpec.path ? Mustache.render(fileSpec.path, variables) : fileName;
      
      let content = templateContent;
      if (fileSpec.template) {
        content = await this.renderTemplate(fileSpec.template, variables);
      }

      return {
        path: filePath,
        content,
        language: fileSpec.language || this.detectLanguageFromPath(filePath),
        action: fileSpec.action || 'create'
      };
    } catch (error) {
      logger.warn('Failed to generate file from spec:', error);
      return null;
    }
  }

  // Utility methods
  private extractUsedVariables(template: string): string[] {
    const variableRegex = /\{\{\s*([^}\s#\/]+)\s*\}\}/g;
    const variables = new Set<string>();
    let match;

    while ((match = variableRegex.exec(template)) !== null) {
      const varName = match[1].split('.')[0];
      variables.add(varName);
    }

    return Array.from(variables);
  }

  private evaluateCondition(condition: string, variables: Record<string, any>): boolean {
    try {
      const parts = condition.split(' ');
      if (parts.length === 1) {
        return !!this.getVariableValue(parts[0], variables);
      }
      if (parts.length === 3) {
        const left = this.getVariableValue(parts[0], variables);
        const operator = parts[1];
        const right = parts[2].startsWith('"') ? parts[2].slice(1, -1) : this.getVariableValue(parts[2], variables);
        
        switch (operator) {
          case '==': return left == right;
          case '===': return left === right;
          case '!=': return left != right;
          default: return false;
        }
      }
      return false;
    } catch {
      return false;
    }
  }

  private getVariableValue(varPath: string, variables: Record<string, any>): any {
    const parts = varPath.split('.');
    let value = variables;
    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return undefined;
      }
    }
    return value;
  }

  private parseHelperArgs(argsString: string, variables: Record<string, any>): any[] {
    return argsString.trim().split(/\s+/).map(arg => {
      if (arg.startsWith('"') && arg.endsWith('"')) {
        return arg.slice(1, -1);
      } else if (/^\d+$/.test(arg)) {
        return parseInt(arg, 10);
      } else if (arg === 'true' || arg === 'false') {
        return arg === 'true';
      } else {
        return this.getVariableValue(arg, variables);
      }
    });
  }

  private initializeHelpers(): void {
    this.customHelpers.set('timestamp', () => new Date().toISOString());
    this.customHelpers.set('date', () => new Date().toLocaleDateString());
    this.customHelpers.set('year', () => new Date().getFullYear());
    this.customHelpers.set('uuid', () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
    this.customHelpers.set('capitalize', (str: string) => str ? str.charAt(0).toUpperCase() + str.slice(1) : '');
    this.customHelpers.set('uppercase', (str: string) => str ? str.toUpperCase() : '');
    this.customHelpers.set('lowercase', (str: string) => str ? str.toLowerCase() : '');
    this.customHelpers.set('indent', (text: string, spaces: number = 2) => {
      const indent = ' '.repeat(spaces);
      return text.split('\n').map(line => line ? indent + line : line).join('\n');
    });
  }

  private fixIndentation(content: string): string {
    const lines = content.split('\n');
    let indentLevel = 0;
    const indentSize = 2;

    return lines.map(line => {
      const trimmed = line.trim();
      if (!trimmed) return '';

      if (trimmed.startsWith('}') || trimmed.startsWith('</')) {
        indentLevel = Math.max(0, indentLevel - 1);
      }

      const indentedLine = ' '.repeat(indentLevel * indentSize) + trimmed;

      if (trimmed.endsWith('{') || (trimmed.startsWith('<') && !trimmed.startsWith('</'))) {
        indentLevel++;
      }

      return indentedLine;
    }).join('\n');
  }

  private formatCode(content: string, language: string): string {
    switch (language.toLowerCase()) {
      case 'javascript':
      case 'typescript':
        return content.replace(/\s*{\s*/g, ' {\n').replace(/;\s*}/g, ';\n}');
      case 'python':
        return content.replace(/:\s*$/gm, ':\n');
      default:
        return content;
    }
  }

  private detectLanguage(content: string): string {
    if (content.includes('function') || content.includes('=>')) return 'javascript';
    if (content.includes('def ') || content.includes('import ')) return 'python';
    if (content.includes('public class')) return 'java';
    return 'text';
  }

  private detectLanguageFromPath(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const languageMap: Record<string, string> = {
      'js': 'javascript', 'ts': 'typescript', 'jsx': 'javascript', 'tsx': 'typescript',
      'py': 'python', 'java': 'java', 'go': 'go', 'rs': 'rust', 'md': 'markdown',
      'html': 'html', 'css': 'css', 'json': 'json', 'yml': 'yaml', 'yaml': 'yaml'
    };
    return languageMap[ext || ''] || 'text';
  }

  private generateFileName(template: CodeTemplate, variables: Record<string, any>): string {
    const baseName = variables.componentName || variables.className || variables.name || 'generated';
    const extension = this.getFileExtension(template.language);
    return `${baseName}${extension}`;
  }

  private getFileExtension(language: string): string {
    const extensionMap: Record<string, string> = {
      'javascript': '.js', 'typescript': '.ts', 'python': '.py', 'java': '.java',
      'go': '.go', 'rust': '.rs', 'html': '.html', 'css': '.css',
      'json': '.json', 'yaml': '.yml', 'markdown': '.md'
    };
    return extensionMap[language.toLowerCase()] || '.txt';
  }

  private createErrorResult(errors: TemplateError[]): ProcessedTemplate {
    return {
      content: '',
      files: [],
      errors,
      metadata: { variablesUsed: [], filesGenerated: 0, totalSize: 0 }
    };
  }

  // Public API methods
  addCustomHelper(name: string, helper: Function): void {
    this.customHelpers.set(name, helper);
  }

  removeCustomHelper(name: string): boolean {
    return this.customHelpers.delete(name);
  }

  getCustomHelpers(): string[] {
    return Array.from(this.customHelpers.keys());
  }

  extractVariables(templateContent: string): TemplateVariable[] {
    const variables = new Set<string>();
    const variableRegex = /\{\{\s*([^}\s#\/]+)\s*\}\}/g;
    let match;

    while ((match = variableRegex.exec(templateContent)) !== null) {
      const varName = match[1].split('.')[0];
      if (!varName.startsWith('helpers.') && !varName.startsWith('project.')) {
        variables.add(varName);
      }
    }

    return Array.from(variables).map(name => ({
      name,
      type: 'string' as const,
      required: true,
      description: `Template variable: ${name}`
    }));
  }
}