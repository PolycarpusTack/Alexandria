/**
 * Deterministic Defaults System
 * 
 * Provides reliable, AI-independent variable defaults based on conventions,
 * patterns, and best practices. Ensures template generation always succeeds
 * even when AI services are unavailable.
 */

import { Logger } from '../../../../../utils/logger';
import { VariableSchema, VariableMap } from './interfaces';
import * as path from 'path';
import * as crypto from 'crypto';

export interface DefaultsContext {
  projectPath?: string;
  projectName?: string;
  language?: string;
  framework?: string;
  templateCategory?: string;
  timestamp?: Date;
  userPreferences?: Record<string, any>;
}

export interface DefaultRule {
  matcher: (schema: VariableSchema, context: DefaultsContext) => boolean;
  generator: (schema: VariableSchema, context: DefaultsContext) => any;
  priority: number; // Higher priority rules are applied first
  description: string;
}

export interface DefaultsResult {
  variables: VariableMap;
  rulesApplied: Array<{ variable: string; rule: string; value: any }>;
  warnings: string[];
  confidence: number; // 0-1 scale indicating reliability of defaults
}

export class DeterministicDefaultsSystem {
  private logger: Logger;
  private rules: DefaultRule[] = [];
  private knownPatterns: Map<string, any> = new Map();

  // Industry-standard defaults for different contexts
  private industryDefaults = {
    // Package managers
    packageManagers: {
      node: ['npm', 'yarn', 'pnpm'],
      python: ['pip', 'poetry', 'pipenv'],
      rust: ['cargo'],
      go: ['go mod'],
      java: ['maven', 'gradle'],
      php: ['composer'],
      ruby: ['bundler'],
      csharp: ['nuget']
    },

    // Version patterns
    versions: {
      semver: '1.0.0',
      major: '1',
      minor: '0',
      patch: '0',
      prerelease: 'alpha'
    },

    // License types
    licenses: ['MIT', 'Apache-2.0', 'GPL-3.0', 'BSD-3-Clause', 'ISC'],

    // Author patterns
    authors: ['Your Name', 'Team Name', 'Organization'],

    // Common paths
    paths: {
      source: ['src', 'lib', 'source'],
      tests: ['test', 'tests', '__tests__', 'spec'],
      docs: ['docs', 'documentation', 'README'],
      config: ['config', 'configuration', 'settings'],
      assets: ['assets', 'static', 'public'],
      output: ['dist', 'build', 'out', 'target']
    },

    // Framework conventions
    frameworks: {
      react: {
        componentExtension: '.tsx',
        testExtension: '.test.tsx',
        styleExtension: '.module.css',
        namingConvention: 'PascalCase'
      },
      vue: {
        componentExtension: '.vue',
        testExtension: '.spec.js',
        styleExtension: '.scss',
        namingConvention: 'PascalCase'
      },
      angular: {
        componentExtension: '.component.ts',
        testExtension: '.spec.ts',
        styleExtension: '.component.scss',
        namingConvention: 'kebab-case'
      },
      express: {
        routeExtension: '.js',
        testExtension: '.test.js',
        namingConvention: 'camelCase'
      }
    }
  };

  constructor(logger: Logger) {
    this.logger = logger;
    this.initializeDefaultRules();
  }

  /**
   * Generate deterministic defaults for variables
   */
  generateDefaults(
    variables: VariableSchema[],
    context: DefaultsContext = {}
  ): DefaultsResult {
    const result: DefaultsResult = {
      variables: {},
      rulesApplied: [],
      warnings: [],
      confidence: 1.0 // Start with high confidence for deterministic system
    };

    this.logger.info('Generating deterministic defaults', {
      variableCount: variables.length,
      projectPath: context.projectPath,
      language: context.language
    });

    // Enrich context with derived information
    const enrichedContext = this.enrichContext(context);

    // Apply rules for each variable
    for (const schema of variables) {
      try {
        const defaultValue = this.generateVariableDefault(schema, enrichedContext);
        
        if (defaultValue.value !== undefined) {
          result.variables[schema.name] = defaultValue.value;
          result.rulesApplied.push({
            variable: schema.name,
            rule: defaultValue.rule,
            value: defaultValue.value
          });
        } else {
          // Fallback to basic type default
          const typeDefault = this.getBasicTypeDefault(schema);
          result.variables[schema.name] = typeDefault;
          result.rulesApplied.push({
            variable: schema.name,
            rule: 'basic-type-fallback',
            value: typeDefault
          });
          result.warnings.push(`No specific rule matched for ${schema.name}, using type default`);
        }
      } catch (error) {
        this.logger.warn('Failed to generate default for variable', { 
          variable: schema.name, 
          error 
        });
        
        const fallback = this.getBasicTypeDefault(schema);
        result.variables[schema.name] = fallback;
        result.warnings.push(`Error generating default for ${schema.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        result.confidence *= 0.9; // Reduce confidence for each error
      }
    }

    // Post-process to ensure consistency
    this.postProcessDefaults(result.variables, enrichedContext);

    this.logger.info('Deterministic defaults generated', {
      generated: Object.keys(result.variables).length,
      rulesApplied: result.rulesApplied.length,
      warnings: result.warnings.length,
      confidence: result.confidence
    });

    return result;
  }

  /**
   * Generate default for a single variable
   */
  private generateVariableDefault(
    schema: VariableSchema,
    context: DefaultsContext
  ): { value: any; rule: string } {
    // Sort rules by priority (highest first)
    const sortedRules = [...this.rules].sort((a, b) => b.priority - a.priority);

    for (const rule of sortedRules) {
      if (rule.matcher(schema, context)) {
        try {
          const value = rule.generator(schema, context);
          if (value !== undefined && this.validateValue(value, schema)) {
            return { value, rule: rule.description };
          }
        } catch (error) {
          this.logger.debug('Rule failed to generate value', { 
            rule: rule.description, 
            variable: schema.name, 
            error 
          });
        }
      }
    }

    return { value: undefined, rule: 'no-match' };
  }

  /**
   * Initialize default rules with comprehensive patterns
   */
  private initializeDefaultRules(): void {
    // Project name rules
    this.addRule({
      matcher: (schema, context) => 
        (/name/i).test(schema.name) && 
        !(/(class|component|function)/i).test(schema.name) &&
        schema.type === 'string',
      generator: (schema, context) => {
        if (context.projectName) return context.projectName;
        if (context.projectPath) return path.basename(context.projectPath);
        return 'my-project';
      },
      priority: 100,
      description: 'project-name'
    });

    // Component/Class name rules
    this.addRule({
      matcher: (schema, context) => 
        (/(component|class|interface|type)name/i).test(schema.name) &&
        schema.type === 'string',
      generator: (schema, context) => {
        const baseName = context.projectName || 
          (context.projectPath ? path.basename(context.projectPath) : 'Component');
        return this.toPascalCase(baseName);
      },
      priority: 90,
      description: 'component-name'
    });

    // Author rules
    this.addRule({
      matcher: (schema) => (/(author|creator|maintainer)/i).test(schema.name),
      generator: () => 'Your Name',
      priority: 80,
      description: 'author-default'
    });

    // Email rules
    this.addRule({
      matcher: (schema) => (/email/i).test(schema.name),
      generator: () => 'your.email@example.com',
      priority: 80,
      description: 'email-default'
    });

    // Version rules
    this.addRule({
      matcher: (schema) => (/version/i).test(schema.name) && schema.type === 'string',
      generator: () => '1.0.0',
      priority: 70,
      description: 'version-semver'
    });

    // Description rules
    this.addRule({
      matcher: (schema, context) => 
        (/description/i).test(schema.name) && schema.type === 'string',
      generator: (schema, context) => {
        const projectName = context.projectName || 'project';
        const type = context.templateCategory || 'component';
        return `A ${type} for ${projectName}`;
      },
      priority: 70,
      description: 'description-auto'
    });

    // License rules
    this.addRule({
      matcher: (schema) => (/license/i).test(schema.name),
      generator: (schema) => {
        if (schema.validation?.options) {
          return schema.validation.options.includes('MIT') ? 'MIT' : schema.validation.options[0];
        }
        return 'MIT';
      },
      priority: 70,
      description: 'license-mit'
    });

    // Path rules
    this.addRule({
      matcher: (schema) => (/path/i).test(schema.name) && schema.type === 'string',
      generator: (schema, context) => {
        const varName = schema.name.toLowerCase();
        if ((/src|source/i).test(varName)) return 'src';
        if ((/test/i).test(varName)) return 'tests';
        if ((/(doc|readme)/i).test(varName)) return 'docs';
        if ((/(config|setting)/i).test(varName)) return 'config';
        if ((/(asset|static)/i).test(varName)) return 'assets';
        if ((/(build|dist|out)/i).test(varName)) return 'dist';
        return './';
      },
      priority: 60,
      description: 'path-convention'
    });

    // Boolean feature flags (modern defaults)
    this.addRule({
      matcher: (schema) => schema.type === 'boolean',
      generator: (schema, context) => {
        const varName = schema.name.toLowerCase();
        
        // Enable modern development practices by default
        if ((/(typescript|types|ts)/i).test(varName)) return true;
        if ((/(test|spec|testing)/i).test(varName)) return true;
        if ((/(lint|eslint|prettier)/i).test(varName)) return true;
        if ((/(git|vcs|version)/i).test(varName)) return true;
        if ((/(css|style|styling)/i).test(varName)) return true;
        if ((/(doc|readme|documentation)/i).test(varName)) return true;
        
        // Conservative defaults for optional features
        if ((/(docker|container)/i).test(varName)) return false;
        if ((/(deploy|ci|cd)/i).test(varName)) return false;
        if ((/(strict|enforce)/i).test(varName)) return true;
        
        return false; // Safe default
      },
      priority: 50,
      description: 'boolean-modern-defaults'
    });

    // Language-specific rules
    this.addRule({
      matcher: (schema, context) => 
        (/language/i).test(schema.name) && context.language,
      generator: (schema, context) => context.language,
      priority: 80,
      description: 'language-context'
    });

    // Framework-specific rules
    this.addRule({
      matcher: (schema, context) => 
        (/framework/i).test(schema.name) && context.framework,
      generator: (schema, context) => context.framework,
      priority: 80,
      description: 'framework-context'
    });

    // Package manager rules
    this.addRule({
      matcher: (schema, context) => 
        (/(package.*manager|pm)/i).test(schema.name) && context.language,
      generator: (schema, context) => {
        const managers = this.industryDefaults.packageManagers[context.language as keyof typeof this.industryDefaults.packageManagers];
        return managers ? managers[0] : 'npm';
      },
      priority: 70,
      description: 'package-manager'
    });

    // File extension rules
    this.addRule({
      matcher: (schema, context) => 
        (/extension/i).test(schema.name) && schema.type === 'string',
      generator: (schema, context) => {
        if (context.framework && this.industryDefaults.frameworks[context.framework as keyof typeof this.industryDefaults.frameworks]) {
          const frameworkDefaults = this.industryDefaults.frameworks[context.framework as keyof typeof this.industryDefaults.frameworks];
          if ((/(component|comp)/i).test(schema.name)) return frameworkDefaults.componentExtension;
          if ((/test/i).test(schema.name)) return frameworkDefaults.testExtension;
          if ((/(style|css)/i).test(schema.name)) return frameworkDefaults.styleExtension;
        }
        
        // Language-based defaults
        switch (context.language) {
          case 'typescript': return '.ts';
          case 'javascript': return '.js';
          case 'python': return '.py';
          case 'java': return '.java';
          case 'go': return '.go';
          case 'rust': return '.rs';
          default: return '.txt';
        }
      },
      priority: 60,
      description: 'file-extension'
    });

    // Port number rules
    this.addRule({
      matcher: (schema) => (/port/i).test(schema.name) && schema.type === 'number',
      generator: (schema, context) => {
        const varName = schema.name.toLowerCase();
        if ((/dev|development/i).test(varName)) return 3000;
        if ((/(api|server)/i).test(varName)) return 8080;
        if ((/(db|database)/i).test(varName)) return 5432;
        if ((/(redis|cache)/i).test(varName)) return 6379;
        return 3000;
      },
      priority: 60,
      description: 'port-conventions'
    });

    // URL/Domain rules
    this.addRule({
      matcher: (schema) => (/(url|domain|host)/i).test(schema.name) && schema.type === 'string',
      generator: (schema, context) => {
        const varName = schema.name.toLowerCase();
        if ((/api/i).test(varName)) return 'https://api.example.com';
        if ((/(db|database)/i).test(varName)) return 'localhost';
        return 'https://example.com';
      },
      priority: 60,
      description: 'url-defaults'
    });

    // Select/Option rules (use first option as default)
    this.addRule({
      matcher: (schema) => 
        schema.type === 'select' && schema.validation?.options && schema.validation.options.length > 0,
      generator: (schema) => schema.validation!.options![0],
      priority: 90,
      description: 'select-first-option'
    });

    // Date/Time rules
    this.addRule({
      matcher: (schema) => 
        (/(date|time|created|updated)/i).test(schema.name) && schema.type === 'string',
      generator: () => new Date().toISOString().split('T')[0], // YYYY-MM-DD format
      priority: 60,
      description: 'date-current'
    });

    // UUID/ID rules
    this.addRule({
      matcher: (schema) => 
        (/(id|uuid|guid)/i).test(schema.name) && schema.type === 'string',
      generator: () => this.generateUUID(),
      priority: 70,
      description: 'uuid-generator'
    });

    // Array defaults
    this.addRule({
      matcher: (schema) => schema.type === 'array',
      generator: (schema, context) => {
        const varName = schema.name.toLowerCase();
        
        // Common array patterns
        if ((/(tag|keyword)/i).test(varName)) return ['tag1', 'tag2'];
        if ((/(dep|dependencies)/i).test(varName)) return [];
        if ((/(author|contributor)/i).test(varName)) return ['Your Name'];
        if ((/(script|command)/i).test(varName)) return ['npm run build'];
        
        return [];
      },
      priority: 50,
      description: 'array-patterns'
    });

    // Object defaults
    this.addRule({
      matcher: (schema) => schema.type === 'object',
      generator: (schema, context) => {
        const varName = schema.name.toLowerCase();
        
        // Common object patterns
        if ((/(config|setting)/i).test(varName)) return {};
        if ((/(meta|metadata)/i).test(varName)) return { version: '1.0.0' };
        if ((/(script|scripts)/i).test(varName)) return { build: 'npm run build' };
        
        return {};
      },
      priority: 50,
      description: 'object-patterns'
    });

    this.logger.info('Initialized deterministic defaults', { ruleCount: this.rules.length });
  }

  /**
   * Add a new default rule
   */
  addRule(rule: DefaultRule): void {
    this.rules.push(rule);
    this.logger.debug('Added default rule', { description: rule.description, priority: rule.priority });
  }

  /**
   * Enrich context with derived information
   */
  private enrichContext(context: DefaultsContext): DefaultsContext {
    const enriched = { ...context };

    // Derive project name from path if not provided
    if (!enriched.projectName && enriched.projectPath) {
      enriched.projectName = path.basename(enriched.projectPath);
    }

    // Set current timestamp if not provided
    if (!enriched.timestamp) {
      enriched.timestamp = new Date();
    }

    // Infer language from framework if not provided
    if (!enriched.language && enriched.framework) {
      const frameworkLanguageMap: Record<string, string> = {
        react: 'typescript',
        vue: 'javascript',
        angular: 'typescript',
        express: 'javascript',
        django: 'python',
        flask: 'python',
        spring: 'java',
        laravel: 'php'
      };
      enriched.language = frameworkLanguageMap[enriched.framework] || enriched.language;
    }

    return enriched;
  }

  /**
   * Post-process defaults to ensure consistency
   */
  private postProcessDefaults(variables: VariableMap, context: DefaultsContext): void {
    // Ensure naming consistency
    if (variables.componentName && variables.className && !variables.className) {
      variables.className = variables.componentName;
    }

    // Ensure path consistency
    if (variables.srcPath && variables.outputPath && !variables.outputPath) {
      variables.outputPath = path.join(variables.srcPath, 'dist');
    }

    // Ensure version consistency
    if (variables.version && variables.packageVersion && !variables.packageVersion) {
      variables.packageVersion = variables.version;
    }

    // Apply naming convention consistency
    if (context.framework) {
      const frameworkDefaults = this.industryDefaults.frameworks[context.framework as keyof typeof this.industryDefaults.frameworks];
      if (frameworkDefaults && variables.componentName) {
        const naming = frameworkDefaults.namingConvention;
        variables.componentName = this.applyNamingConvention(variables.componentName, naming);
      }
    }
  }

  /**
   * Apply naming convention to a string
   */
  private applyNamingConvention(str: string, convention: string): string {
    switch (convention) {
      case 'PascalCase':
        return this.toPascalCase(str);
      case 'camelCase':
        return this.toCamelCase(str);
      case 'snake_case':
        return this.toSnakeCase(str);
      case 'kebab-case':
        return this.toKebabCase(str);
      default:
        return str;
    }
  }

  /**
   * Convert to PascalCase
   */
  private toPascalCase(str: string): string {
    return str
      .replace(/[-_\s]+(.)/g, (_, char) => char.toUpperCase())
      .replace(/^./, char => char.toUpperCase());
  }

  /**
   * Convert to camelCase
   */
  private toCamelCase(str: string): string {
    return str
      .replace(/[-_\s]+(.)/g, (_, char) => char.toUpperCase())
      .replace(/^./, char => char.toLowerCase());
  }

  /**
   * Convert to snake_case
   */
  private toSnakeCase(str: string): string {
    return str
      .replace(/[-\s]+/g, '_')
      .replace(/([a-z])([A-Z])/g, '$1_$2')
      .toLowerCase();
  }

  /**
   * Convert to kebab-case
   */
  private toKebabCase(str: string): string {
    return str
      .replace(/[_\s]+/g, '-')
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .toLowerCase();
  }

  /**
   * Generate a simple UUID
   */
  private generateUUID(): string {
    return crypto.randomUUID();
  }

  /**
   * Get basic type default
   */
  private getBasicTypeDefault(schema: VariableSchema): any {
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
   * Validate value against schema
   */
  private validateValue(value: any, schema: VariableSchema): boolean {
    try {
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
        
        if (validation.min && typeof value === 'number') {
          if (value < validation.min) return false;
        }
        
        if (validation.max && typeof value === 'number') {
          if (value > validation.max) return false;
        }
        
        if (validation.options && !validation.options.includes(value)) {
          return false;
        }
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get rule statistics
   */
  getRuleStats(): {
    totalRules: number;
    rulesByPriority: Record<number, number>;
    ruleDescriptions: string[];
  } {
    const rulesByPriority: Record<number, number> = {};
    
    for (const rule of this.rules) {
      rulesByPriority[rule.priority] = (rulesByPriority[rule.priority] || 0) + 1;
    }

    return {
      totalRules: this.rules.length,
      rulesByPriority,
      ruleDescriptions: this.rules.map(r => r.description)
    };
  }

  /**
   * Test rules against schema
   */
  testRules(schema: VariableSchema, context: DefaultsContext = {}): Array<{
    rule: string;
    matches: boolean;
    value?: any;
    error?: string;
  }> {
    const enrichedContext = this.enrichContext(context);
    const results = [];

    for (const rule of this.rules) {
      try {
        const matches = rule.matcher(schema, enrichedContext);
        let value: any;
        let error: string | undefined;

        if (matches) {
          try {
            value = rule.generator(schema, enrichedContext);
          } catch (err) {
            error = err instanceof Error ? err.message : 'Unknown error';
          }
        }

        results.push({
          rule: rule.description,
          matches,
          value,
          error
        });
      } catch (err) {
        results.push({
          rule: rule.description,
          matches: false,
          error: err instanceof Error ? err.message : 'Unknown error'
        });
      }
    }

    return results;
  }
}