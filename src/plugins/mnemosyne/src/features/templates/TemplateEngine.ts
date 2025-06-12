import Handlebars from 'handlebars';
import { PluginContext } from '../../../../../core/plugin-registry/interfaces';
import {
  MnemosyneTemplate,
  TemplateContext,
  TemplateRenderOptions,
  TemplateVariable
} from './interfaces';

export class TemplateEngine {
  private handlebars: typeof Handlebars;

  constructor(private context: PluginContext) {
    this.handlebars = Handlebars.create();
    this.registerHelpers();
  }

  /**
   * Render a template with the given context
   */
  async render(template: MnemosyneTemplate, options: TemplateRenderOptions): Promise<string> {
    try {
      // Validate required variables
      if (options.strict) {
        this.validateRequiredVariables(template, options.context);
      }

      // Enhance context with Mnemosyne data
      const enhancedContext = await this.enhanceContext(template, options.context);

      // Compile and render template
      const compiled = this.handlebars.compile(template.content);
      let result = compiled(enhancedContext);

      // Post-process the result
      if (options.formatOutput) {
        result = await this.formatOutput(result);
      }

      // Record usage analytics
      await this.recordUsage(template.id, enhancedContext);

      return result;
    } catch (error) {
      this.context.logger.error('Template rendering failed', {
        templateId: template.id,
        error: error.message
      });
      throw new Error(`Template rendering failed: ${error.message}`);
    }
  }

  /**
   * Render a snippet (simpler than full template)
   */
  renderSnippet(content: string, variables: Record<string, any>): string {
    const compiled = this.handlebars.compile(content);
    return compiled(variables);
  }

  /**
   * Extract variables from template content
   */
  extractVariables(content: string): string[] {
    const variables = new Set<string>();
    const regex = /\{\{([^}]+)\}\}/g;
    let match;

    while ((match = regex.exec(content)) !== null) {
      const variable = match[1].trim();
      // Remove helpers and operators
      const cleanVar = variable.split(' ')[0].split('.')[0];
      if (!this.isHelper(cleanVar)) {
        variables.add(cleanVar);
      }
    }

    return Array.from(variables);
  }

  /**
   * Validate template syntax
   */
  validateSyntax(content: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    try {
      this.handlebars.compile(content);
    } catch (error) {
      errors.push(`Syntax error: ${error.message}`);
    }

    // Check for common issues
    const openBraces = (content.match(/\{\{/g) || []).length;
    const closeBraces = (content.match(/\}\}/g) || []).length;

    if (openBraces !== closeBraces) {
      errors.push('Mismatched handlebars braces');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Register custom Handlebars helpers
   */
  private registerHelpers(): void {
    // Date formatting
    this.handlebars.registerHelper('formatDate', (date: Date, format: string) => {
      if (!date) return '';
      return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: format.includes('MM') ? '2-digit' : 'short',
        day: '2-digit'
      }).format(new Date(date));
    });

    // Current date/time
    this.handlebars.registerHelper('now', (format?: string) => {
      const now = new Date();
      if (format === 'iso') {
        return now.toISOString();
      }
      return now.toLocaleDateString();
    });

    // String operations
    this.handlebars.registerHelper('uppercase', (str: string) => str?.toUpperCase() || '');
    this.handlebars.registerHelper('lowercase', (str: string) => str?.toLowerCase() || '');
    this.handlebars.registerHelper('capitalize', (str: string) => {
      if (!str) return '';
      return str.charAt(0).toUpperCase() + str.slice(1);
    });

    // Array operations
    this.handlebars.registerHelper('join', (array: any[], separator: string = ', ') => {
      if (!Array.isArray(array)) return '';
      return array.join(separator);
    });

    this.handlebars.registerHelper('length', (array: any[]) => {
      if (!Array.isArray(array)) return 0;
      return array.length;
    });

    // Conditional helpers
    this.handlebars.registerHelper('eq', (a: any, b: any) => a === b);
    this.handlebars.registerHelper('ne', (a: any, b: any) => a !== b);
    this.handlebars.registerHelper('gt', (a: number, b: number) => a > b);
    this.handlebars.registerHelper('lt', (a: number, b: number) => a < b);

    // Knowledge graph helpers
    this.handlebars.registerHelper('wikilink', (title: string, alias?: string) => {
      const displayText = alias || title;
      return new this.handlebars.SafeString(`[[${title}${alias ? `|${alias}` : ''}]]`);
    });

    this.handlebars.registerHelper('backlink', function (this: any, documentId: string) {
      // This would be populated by the context enhancement
      const backlinks = this.mnemosyne?.backlinks || [];
      return backlinks.filter((link: any) => link.targetId === documentId);
    });

    // Code formatting
    this.handlebars.registerHelper('code', (content: string, language?: string) => {
      const lang = language || '';
      return new this.handlebars.SafeString(`\`\`\`${lang}\n${content}\n\`\`\``);
    });

    this.handlebars.registerHelper('inline', (content: string) => {
      return new this.handlebars.SafeString(`\`${content}\``);
    });

    // Math helpers
    this.handlebars.registerHelper('add', (a: number, b: number) => a + b);
    this.handlebars.registerHelper('subtract', (a: number, b: number) => a - b);
    this.handlebars.registerHelper('multiply', (a: number, b: number) => a * b);
    this.handlebars.registerHelper('divide', (a: number, b: number) => (b !== 0 ? a / b : 0));

    // UUID generation
    this.handlebars.registerHelper('uuid', () => {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    });

    // Progress tracking
    this.handlebars.registerHelper('progress', (current: number, total: number) => {
      const percentage = Math.round((current / total) * 100);
      const filled = Math.floor(percentage / 10);
      const empty = 10 - filled;
      const bar = '█'.repeat(filled) + '░'.repeat(empty);
      return new this.handlebars.SafeString(`${bar} ${percentage}%`);
    });
  }

  /**
   * Enhance context with Mnemosyne-specific data
   */
  private async enhanceContext(
    template: MnemosyneTemplate,
    context: TemplateContext
  ): Promise<TemplateContext> {
    const enhanced = { ...context };

    // Add template metadata to context
    enhanced.template = {
      id: template.id,
      name: template.name,
      category: template.metadata.category,
      version: template.metadata.version
    };

    // Enhance with knowledge graph data
    if (template.relationships) {
      enhanced.mnemosyne.related = await this.resolveRelationships(template.relationships);
    }

    // Add AI context if available
    if (this.context.plugins?.get('alfred')) {
      enhanced.alfred = await this.getAlfredContext(template, context);
    }

    // Add usage statistics
    enhanced.analytics = {
      templateUsage: template.analytics.usageCount,
      averageTime: template.analytics.averageCompletionTime,
      satisfaction: template.analytics.satisfactionScore
    };

    return enhanced;
  }

  /**
   * Validate that all required variables are provided
   */
  private validateRequiredVariables(template: MnemosyneTemplate, context: TemplateContext): void {
    const requiredVars = template.variables.filter((v) => v.required);
    const missingVars = requiredVars.filter(
      (v) => !(v.name in context.variables) && !v.defaultValue
    );

    if (missingVars.length > 0) {
      throw new Error(`Missing required variables: ${missingVars.map((v) => v.name).join(', ')}`);
    }
  }

  /**
   * Resolve knowledge graph relationships
   */
  private async resolveRelationships(relationships: any[]): Promise<any[]> {
    // This would query the knowledge graph
    // For now, return mock data
    return relationships.map((rel) => ({
      id: rel.targetId,
      title: rel.targetTitle,
      type: rel.type,
      strength: rel.strength
    }));
  }

  /**
   * Get AI-enhanced context from ALFRED
   */
  private async getAlfredContext(
    template: MnemosyneTemplate,
    context: TemplateContext
  ): Promise<any> {
    // This would integrate with ALFRED plugin
    return {
      available: true,
      summary: `AI-generated summary for ${template.name}`,
      suggestions: ['Consider adding examples', 'Include error handling'],
      relatedConcepts: ['documentation', 'templates', 'automation']
    };
  }

  /**
   * Format the rendered output
   */
  private async formatOutput(content: string): Promise<string> {
    // Format code blocks
    content = content.replace(/```(\w+)?\n([\s\S]*?)\n```/g, (match, lang, code) => {
      // Basic code formatting - could integrate with prettier
      const formatted = code.trim();
      return `\`\`\`${lang || ''}\n${formatted}\n\`\`\``;
    });

    // Clean up extra whitespace
    content = content.replace(/\n{3,}/g, '\n\n');

    return content;
  }

  /**
   * Record template usage for analytics
   */
  private async recordUsage(templateId: string, context: TemplateContext): Promise<void> {
    try {
      const usage = {
        templateId,
        userId: context.user.id,
        timestamp: new Date(),
        context: {
          category: context.template?.category,
          variables: Object.keys(context.variables)
        }
      };

      // Store usage data
      await this.context.storage.set(`template_usage_${Date.now()}`, usage);

      // Emit event for analytics
      this.context.events.emit('mnemosyne:template:used', usage);
    } catch (error) {
      // Don't fail template rendering if analytics fails
      this.context.logger.warn('Failed to record template usage', { error });
    }
  }

  /**
   * Check if a string is a Handlebars helper
   */
  private isHelper(name: string): boolean {
    const helpers = [
      'if',
      'unless',
      'each',
      'with',
      'lookup',
      'eq',
      'ne',
      'gt',
      'lt',
      'formatDate',
      'now',
      'uppercase',
      'lowercase',
      'capitalize',
      'join',
      'length',
      'wikilink',
      'backlink',
      'code',
      'inline',
      'add',
      'subtract',
      'multiply',
      'divide',
      'uuid',
      'progress'
    ];
    return helpers.includes(name);
  }
}
