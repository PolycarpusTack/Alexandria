/**
 * Template Wizard CLI Interface
 *
 * Interactive command-line interface for template generation with
 * inquirer-style prompts, validation, and AI assistance
 */

import { Logger } from '../../../../../utils/logger';
import { EventBus } from '../../../../../core/event-bus/interfaces';
import { AIService } from '../../../../../core/services/ai-service/interfaces';
import {
  TemplateManifest,
  VariableSchema,
  VariableMap,
  TemplateContext
} from '../../services/template-engine/interfaces';
import { ContextAwareVariableResolver } from '../../services/template-engine/variable-resolver';
import { DeterministicDefaultsSystem } from '../../services/template-engine/deterministic-defaults';
import * as readline from 'readline';
import * as path from 'path';

export interface CLIWizardOptions {
  enableColors: boolean;
  enableEmojis: boolean;
  enableAI: boolean;
  enableInteractiveMode: boolean;
  showProgress: boolean;
  validateInput: boolean;
  timeoutMs: number;
}

export interface WizardStep {
  id: string;
  type: 'select' | 'input' | 'confirm' | 'multiselect' | 'autocomplete';
  message: string;
  choices?: Array<{ name: string; value: any; description?: string }>;
  validate?: (input: any) => boolean | string;
  transform?: (input: any) => any;
  default?: any;
  when?: (answers: VariableMap) => boolean;
}

export interface WizardSession {
  id: string;
  templateId?: string;
  projectPath?: string;
  answers: VariableMap;
  currentStep: number;
  startTime: Date;
  aiSuggestions: Record<string, any>;
  validationErrors: Record<string, string[]>;
}

export class TemplateWizardCLI {
  private logger: Logger;
  private eventBus: EventBus;
  private aiService?: AIService;
  private variableResolver: ContextAwareVariableResolver;
  private defaultsSystem: DeterministicDefaultsSystem;
  private options: Required<CLIWizardOptions>;
  private rl?: readline.Interface;
  private currentSession?: WizardSession;

  // CLI styling
  private colors = {
    primary: '\x1b[36m', // Cyan
    success: '\x1b[32m', // Green
    warning: '\x1b[33m', // Yellow
    error: '\x1b[31m', // Red
    info: '\x1b[34m', // Blue
    muted: '\x1b[90m', // Gray
    bold: '\x1b[1m', // Bold
    reset: '\x1b[0m' // Reset
  };

  private emojis = {
    question: '❓',
    success: '✅',
    warning: '⚠️',
    error: '❌',
    info: 'ℹ️',
    rocket: '🚀',
    gear: '⚙️',
    magic: '✨',
    folder: '📁',
    file: '📄'
  };

  constructor(
    logger: Logger,
    eventBus: EventBus,
    variableResolver: ContextAwareVariableResolver,
    defaultsSystem: DeterministicDefaultsSystem,
    aiService?: AIService,
    options: Partial<CLIWizardOptions> = {}
  ) {
    this.logger = logger;
    this.eventBus = eventBus;
    this.aiService = aiService;
    this.variableResolver = variableResolver;
    this.defaultsSystem = defaultsSystem;

    this.options = {
      enableColors: options.enableColors ?? true,
      enableEmojis: options.enableEmojis ?? true,
      enableAI: options.enableAI ?? true,
      enableInteractiveMode: options.enableInteractiveMode ?? true,
      showProgress: options.showProgress ?? true,
      validateInput: options.validateInput ?? true,
      timeoutMs: options.timeoutMs ?? 300000 // 5 minutes
    };

    this.setupEventListeners();
  }

  /**
   * Start template generation wizard
   */
  async startWizard(
    templates: TemplateManifest[],
    projectPath?: string
  ): Promise<{ templateId: string; variables: VariableMap } | null> {
    this.logger.info('Starting template wizard', {
      templateCount: templates.length,
      projectPath
    });

    try {
      this.setupReadline();

      // Create new session
      this.currentSession = {
        id: this.generateSessionId(),
        projectPath,
        answers: {},
        currentStep: 0,
        startTime: new Date(),
        aiSuggestions: {},
        validationErrors: {}
      };

      this.printWelcome();

      // Step 1: Template selection
      const selectedTemplate = await this.selectTemplate(templates);
      if (!selectedTemplate) {
        this.printMessage('Template selection cancelled.', 'warning');
        return null;
      }

      this.currentSession.templateId = selectedTemplate.id;
      this.printMessage(`Selected template: ${selectedTemplate.name}`, 'success');

      // Step 2: Variable collection
      const variables = await this.collectVariables(selectedTemplate, projectPath);
      if (!variables) {
        this.printMessage('Variable collection cancelled.', 'warning');
        return null;
      }

      this.printMessage('Template configuration completed!', 'success');
      return {
        templateId: selectedTemplate.id,
        variables
      };
    } catch (error) {
      this.logger.error('Wizard failed', { error });
      this.printMessage(
        `Wizard failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'error'
      );
      return null;
    } finally {
      this.cleanup();
    }
  }

  /**
   * Template selection step
   */
  private async selectTemplate(templates: TemplateManifest[]): Promise<TemplateManifest | null> {
    if (templates.length === 0) {
      this.printMessage('No templates available.', 'error');
      return null;
    }

    if (templates.length === 1) {
      const template = templates[0];
      const confirm = await this.confirm(`Use template "${template.name}"?`, true);
      return confirm ? template : null;
    }

    // Multiple templates - show selection menu
    this.printMessage('\nAvailable Templates:', 'info');
    this.printLine();

    for (let i = 0; i < templates.length; i++) {
      const template = templates[i];
      const emoji = this.options.enableEmojis ? this.getTemplateEmoji(template.category) : '';
      const number = this.colorize(`${i + 1}.`, 'primary');
      const name = this.colorize(template.name, 'bold');
      const description = this.colorize(template.description, 'muted');
      const tags = template.tags ? `[${template.tags.join(', ')}]` : '';

      this.printRaw(`  ${number} ${emoji} ${name}`);
      this.printRaw(`     ${description}`);
      if (tags) {
        this.printRaw(`     ${this.colorize(tags, 'muted')}`);
      }
      this.printRaw('');
    }

    const selection = await this.select(
      'Select a template:',
      templates.map((template, index) => ({
        name: `${template.name} - ${template.description}`,
        value: index
      }))
    );

    return selection !== null ? templates[selection] : null;
  }

  /**
   * Variable collection step
   */
  private async collectVariables(
    template: TemplateManifest,
    projectPath?: string
  ): Promise<VariableMap | null> {
    const variables = template.variables || [];
    if (variables.length === 0) {
      return {};
    }

    this.printMessage(`\nConfiguring ${variables.length} variables:`, 'info');
    this.printLine();

    // Get AI suggestions if enabled
    if (this.options.enableAI && this.aiService && projectPath) {
      await this.loadAISuggestions(template, projectPath);
    }

    // Get deterministic defaults
    const defaultsContext = {
      projectPath,
      projectName: projectPath ? path.basename(projectPath) : undefined,
      templateCategory: template.category
    };
    const defaultsResult = this.defaultsSystem.generateDefaults(variables, defaultsContext);

    const answers: VariableMap = {};

    for (let i = 0; i < variables.length; i++) {
      const variable = variables[i];
      this.currentSession!.currentStep = i;

      // Skip if condition doesn't match
      if (variable.condition && !this.evaluateCondition(variable.condition, answers)) {
        continue;
      }

      // Show progress if enabled
      if (this.options.showProgress) {
        this.printProgress(i + 1, variables.length, variable.name);
      }

      const value = await this.collectSingleVariable(variable, answers, defaultsResult.variables);
      if (value === null) {
        return null; // User cancelled
      }

      answers[variable.name] = value;
    }

    return answers;
  }

  /**
   * Collect single variable value
   */
  private async collectSingleVariable(
    variable: VariableSchema,
    existingAnswers: VariableMap,
    defaults: VariableMap
  ): Promise<any> {
    const prompt = this.buildVariablePrompt(variable);
    const defaultValue = this.getDefaultValue(variable, defaults);
    const aiSuggestion = this.currentSession!.aiSuggestions[variable.name];

    // Show AI suggestion if available
    if (aiSuggestion && this.options.enableAI) {
      const suggestionText = this.colorize(`AI suggests: ${aiSuggestion}`, 'info');
      this.printRaw(`  ${suggestionText}`);
    }

    let value: any;

    switch (variable.type) {
      case 'boolean':
        value = await this.confirm(prompt, defaultValue);
        break;

      case 'select':
        if (!variable.validation?.options) {
          throw new Error(`Select variable ${variable.name} missing options`);
        }
        value = await this.select(
          prompt,
          variable.validation.options.map((opt) => ({ name: opt, value: opt })),
          defaultValue
        );
        break;

      case 'number':
        value = await this.number(prompt, defaultValue, variable.validation);
        break;

      case 'array':
        value = await this.array(prompt, defaultValue);
        break;

      default: // string and others
        value = await this.input(prompt, defaultValue, variable.validation);
        break;
    }

    // Validate input if enabled
    if (this.options.validateInput && value !== null) {
      const validationResult = this.validateVariable(variable, value);
      if (!validationResult.valid) {
        this.printMessage(`Validation failed: ${validationResult.errors.join(', ')}`, 'error');
        return this.collectSingleVariable(variable, existingAnswers, defaults);
      }
    }

    return value;
  }

  /**
   * Setup readline interface
   */
  private setupReadline(): void {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true
    });

    // Handle Ctrl+C gracefully
    this.rl.on('SIGINT', () => {
      this.printMessage('\nTemplate generation cancelled.', 'warning');
      this.cleanup();
      process.exit(0);
    });
  }

  /**
   * Basic input prompt
   */
  private async input(
    message: string,
    defaultValue?: string,
    validation?: any
  ): Promise<string | null> {
    return new Promise((resolve) => {
      const prompt = this.formatPrompt(message, defaultValue);

      this.rl!.question(prompt, (answer) => {
        const value = answer.trim() || defaultValue || '';
        resolve(value === '' ? null : value);
      });
    });
  }

  /**
   * Confirmation prompt
   */
  private async confirm(message: string, defaultValue = false): Promise<boolean | null> {
    return new Promise((resolve) => {
      const defaultText = defaultValue ? 'Y/n' : 'y/N';
      const prompt = this.formatPrompt(message, defaultText);

      this.rl!.question(prompt, (answer) => {
        const cleaned = answer.trim().toLowerCase();

        if (cleaned === '') {
          resolve(defaultValue);
        } else if (cleaned === 'y' || cleaned === 'yes') {
          resolve(true);
        } else if (cleaned === 'n' || cleaned === 'no') {
          resolve(false);
        } else if (cleaned === 'q' || cleaned === 'quit') {
          resolve(null);
        } else {
          this.printMessage('Please answer y/n (or q to quit)', 'warning');
          resolve(this.confirm(message, defaultValue));
        }
      });
    });
  }

  /**
   * Selection prompt
   */
  private async select(
    message: string,
    choices: Array<{ name: string; value: any }>,
    defaultValue?: any
  ): Promise<any> {
    return new Promise((resolve) => {
      this.printRaw(`\n${this.formatMessage(message)}`);

      choices.forEach((choice, index) => {
        const number = this.colorize(`${index + 1}.`, 'primary');
        const isDefault = choice.value === defaultValue;
        const marker = isDefault ? this.colorize(' (default)', 'muted') : '';
        this.printRaw(`  ${number} ${choice.name}${marker}`);
      });

      const prompt = this.formatPrompt('Select option (number)', '1');

      this.rl!.question(prompt, (answer) => {
        const cleaned = answer.trim();

        if (cleaned === '' && defaultValue !== undefined) {
          resolve(defaultValue);
        } else {
          const index = parseInt(cleaned, 10) - 1;
          if (index >= 0 && index < choices.length) {
            resolve(choices[index].value);
          } else if (cleaned === 'q' || cleaned === 'quit') {
            resolve(null);
          } else {
            this.printMessage('Invalid selection. Please enter a valid number.', 'warning');
            resolve(this.select(message, choices, defaultValue));
          }
        }
      });
    });
  }

  /**
   * Number input prompt
   */
  private async number(
    message: string,
    defaultValue?: number,
    validation?: any
  ): Promise<number | null> {
    return new Promise((resolve) => {
      const prompt = this.formatPrompt(message, defaultValue?.toString());

      this.rl!.question(prompt, (answer) => {
        const cleaned = answer.trim();

        if (cleaned === '' && defaultValue !== undefined) {
          resolve(defaultValue);
        } else if (cleaned === 'q' || cleaned === 'quit') {
          resolve(null);
        } else {
          const num = parseFloat(cleaned);
          if (isNaN(num)) {
            this.printMessage('Please enter a valid number.', 'warning');
            resolve(this.number(message, defaultValue, validation));
          } else {
            // Apply validation if provided
            if (validation?.min !== undefined && num < validation.min) {
              this.printMessage(`Number must be at least ${validation.min}`, 'warning');
              resolve(this.number(message, defaultValue, validation));
            } else if (validation?.max !== undefined && num > validation.max) {
              this.printMessage(`Number must be at most ${validation.max}`, 'warning');
              resolve(this.number(message, defaultValue, validation));
            } else {
              resolve(num);
            }
          }
        }
      });
    });
  }

  /**
   * Array input prompt
   */
  private async array(message: string, defaultValue?: any[]): Promise<any[] | null> {
    return new Promise((resolve) => {
      const defaultText = defaultValue ? defaultValue.join(', ') : '';
      const prompt = this.formatPrompt(`${message} (comma-separated)`, defaultText);

      this.rl!.question(prompt, (answer) => {
        const cleaned = answer.trim();

        if (cleaned === '' && defaultValue !== undefined) {
          resolve(defaultValue);
        } else if (cleaned === 'q' || cleaned === 'quit') {
          resolve(null);
        } else if (cleaned === '') {
          resolve([]);
        } else {
          const items = cleaned
            .split(',')
            .map((item) => item.trim())
            .filter((item) => item);
          resolve(items);
        }
      });
    });
  }

  /**
   * Load AI suggestions for variables
   */
  private async loadAISuggestions(template: TemplateManifest, projectPath: string): Promise<void> {
    if (!this.aiService || !template.variables) return;

    try {
      this.printMessage('Loading AI suggestions...', 'info');

      const templateContext: TemplateContext = {
        variables: {},
        projectPath,
        metadata: {
          generatedAt: new Date(),
          templateId: template.id,
          templateVersion: template.version
        }
      };

      const resolutionResult = await this.variableResolver.resolveVariables(
        template.variables,
        templateContext,
        {},
        { enableAI: true, enableProjectAnalysis: true }
      );

      // Store AI suggestions
      for (const suggestion of resolutionResult.aiSuggestions) {
        this.currentSession!.aiSuggestions[suggestion.variable] = suggestion.value;
      }

      this.printMessage(
        `Loaded ${resolutionResult.aiSuggestions.length} AI suggestions`,
        'success'
      );
    } catch (error) {
      this.logger.warn('Failed to load AI suggestions', { error });
      this.printMessage('Failed to load AI suggestions, using defaults', 'warning');
    }
  }

  /**
   * Format prompt message
   */
  private formatPrompt(message: string, defaultValue?: string): string {
    const emoji = this.options.enableEmojis ? `${this.emojis.question} ` : '';
    const colored = this.colorize(message, 'primary');
    const defaultText = defaultValue ? this.colorize(` (${defaultValue})`, 'muted') : '';
    return `${emoji}${colored}${defaultText}: `;
  }

  /**
   * Format regular message
   */
  private formatMessage(message: string): string {
    return this.colorize(message, 'primary');
  }

  /**
   * Print colored message
   */
  private printMessage(message: string, type: keyof typeof this.colors): void {
    const emoji = this.options.enableEmojis ? this.getMessageEmoji(type) : '';
    const colored = this.colorize(message, type);
    this.printRaw(`${emoji}${colored}`);
  }

  /**
   * Print raw text
   * Note: This is intentionally console.log for CLI output to stdout
   */
  private printRaw(text: string): void {
    process.stdout.write(text + '\n');
  }

  /**
   * Print separator line
   */
  private printLine(): void {
    this.printRaw(this.colorize('─'.repeat(50), 'muted'));
  }

  /**
   * Print welcome message
   */
  private printWelcome(): void {
    const title = this.colorize('Alfred Template Wizard', 'bold');
    const emoji = this.options.enableEmojis ? `${this.emojis.magic} ` : '';

    this.printRaw('');
    this.printLine();
    this.printRaw(`  ${emoji}${title}`);
    this.printRaw('  Generate code from templates with AI assistance');
    this.printLine();
    this.printRaw('');
  }

  /**
   * Print progress indicator
   */
  private printProgress(current: number, total: number, variableName: string): void {
    if (!this.options.showProgress) return;

    const percentage = Math.round((current / total) * 100);
    const progressBar = this.buildProgressBar(current, total);
    const step = this.colorize(`[${current}/${total}]`, 'muted');
    const variable = this.colorize(variableName, 'bold');

    this.printRaw(`\n${step} ${progressBar} ${percentage}% - ${variable}`);
  }

  /**
   * Build progress bar
   */
  private buildProgressBar(current: number, total: number, width = 20): string {
    const filled = Math.round((current / total) * width);
    const empty = width - filled;
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    return this.colorize(bar, 'primary');
  }

  /**
   * Colorize text
   */
  private colorize(text: string, color: keyof typeof this.colors): string {
    if (!this.options.enableColors) return text;
    return `${this.colors[color]}${text}${this.colors.reset}`;
  }

  /**
   * Get emoji for message type
   */
  private getMessageEmoji(type: string): string {
    if (!this.options.enableEmojis) return '';

    const emojiMap: Record<string, string> = {
      success: this.emojis.success + ' ',
      warning: this.emojis.warning + ' ',
      error: this.emojis.error + ' ',
      info: this.emojis.info + ' ',
      primary: this.emojis.gear + ' '
    };

    return emojiMap[type] || '';
  }

  /**
   * Get emoji for template category
   */
  private getTemplateEmoji(category: string): string {
    if (!this.options.enableEmojis) return '';

    const categoryEmojis: Record<string, string> = {
      react: '⚛️',
      vue: '💚',
      angular: '🅰️',
      node: '🟢',
      python: '🐍',
      docker: '🐳',
      ci: '🔄',
      config: '⚙️'
    };

    return categoryEmojis[category] || '📦';
  }

  /**
   * Build variable prompt
   */
  private buildVariablePrompt(variable: VariableSchema): string {
    let prompt = variable.description || variable.name;

    if (variable.required) {
      prompt += this.colorize(' *', 'error');
    }

    return prompt;
  }

  /**
   * Get default value for variable
   */
  private getDefaultValue(variable: VariableSchema, defaults: VariableMap): any {
    return defaults[variable.name] ?? variable.default;
  }

  /**
   * Validate variable value
   */
  private validateVariable(
    variable: VariableSchema,
    value: any
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Required check
    if (variable.required && (value == null || value === '')) {
      errors.push(`${variable.name} is required`);
    }

    // Type-specific validation
    if (variable.validation && value != null && value !== '') {
      const validation = variable.validation;

      if (validation.pattern && typeof value === 'string') {
        if (!new RegExp(validation.pattern).test(value)) {
          errors.push(`${variable.name} does not match required pattern`);
        }
      }

      if (validation.minLength && typeof value === 'string') {
        if (value.length < validation.minLength) {
          errors.push(`${variable.name} must be at least ${validation.minLength} characters`);
        }
      }

      if (validation.maxLength && typeof value === 'string') {
        if (value.length > validation.maxLength) {
          errors.push(`${variable.name} must be at most ${validation.maxLength} characters`);
        }
      }

      if (validation.options && !validation.options.includes(value)) {
        errors.push(`${variable.name} must be one of: ${validation.options.join(', ')}`);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Evaluate condition (simplified)
   */
  private evaluateCondition(condition: any, answers: VariableMap): boolean {
    // This would use the SecureConditionEvaluator in practice
    // For now, return true to keep variables visible
    return true;
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    this.eventBus.subscribe('alfred:template:wizard:cancel', () => {
      this.printMessage('Template generation cancelled by user.', 'warning');
      this.cleanup();
    });
  }

  /**
   * Generate session ID
   */
  private generateSessionId(): string {
    return `wizard_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    if (this.rl) {
      this.rl.close();
      this.rl = undefined;
    }
    this.currentSession = undefined;
  }

  /**
   * Get current session info
   */
  getCurrentSession(): WizardSession | undefined {
    return this.currentSession;
  }
}
