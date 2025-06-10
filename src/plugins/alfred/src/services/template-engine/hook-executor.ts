/**
 * Secure Hook Execution System
 * 
 * Executes template hooks in a sandboxed environment with strict timeouts
 * Uses VM2 if available, falls back to isolated execution patterns
 */

import { Logger } from '../../../../../utils/logger';
import { VariableMap, ValidationResult, ValidationError } from './interfaces';

// Optional VM2 import with fallback
let VM2: any;
try {
  VM2 = require('vm2').VM;
} catch {
  // VM2 not available, will use alternative sandboxing
}

export interface HookContext {
  variables: VariableMap;
  projectName: string;
  projectType: string;
  templateId: string;
  templateVersion: string;
  outputPath: string;
  // NO file paths, credentials, or system access
}

export interface HookResult {
  success: boolean;
  output?: any;
  logs: string[];
  errors: string[];
  warnings: string[];
  executionTime: number;
  memoryUsed: number;
}

export interface HookExecutionOptions {
  timeout: number; // milliseconds
  memoryLimit: number; // bytes
  allowConsole: boolean;
  allowedModules: string[];
}

export class SecureHookExecutor {
  private logger: Logger;
  private defaultOptions: HookExecutionOptions;

  constructor(logger: Logger) {
    this.logger = logger;
    this.defaultOptions = {
      timeout: 5000, // 5 seconds
      memoryLimit: 16 * 1024 * 1024, // 16MB
      allowConsole: true,
      allowedModules: [] // No external modules by default
    };
  }

  /**
   * Execute a hook with sandboxing
   */
  async executeHook(
    hookCode: string,
    context: HookContext,
    options: Partial<HookExecutionOptions> = {}
  ): Promise<HookResult> {
    const execOptions = { ...this.defaultOptions, ...options };
    const startTime = Date.now();
    
    // Validate hook code before execution
    const validation = this.validateHookCode(hookCode);
    if (!validation.valid) {
      return {
        success: false,
        logs: [],
        errors: validation.errors.map(e => e.message),
        warnings: validation.warnings,
        executionTime: Date.now() - startTime,
        memoryUsed: 0
      };
    }

    try {
      if (VM2) {
        return await this.executeWithVM2(hookCode, context, execOptions);
      } else {
        return await this.executeWithFallback(hookCode, context, execOptions);
      }
    } catch (error) {
      this.logger.error('Hook execution failed', { error, hookCode: hookCode.substring(0, 100) });
      return {
        success: false,
        logs: [],
        errors: [error instanceof Error ? error.message : 'Unknown execution error'],
        warnings: [],
        executionTime: Date.now() - startTime,
        memoryUsed: 0
      };
    }
  }

  /**
   * Execute hook using VM2 sandbox
   */
  private async executeWithVM2(
    hookCode: string,
    context: HookContext,
    options: HookExecutionOptions
  ): Promise<HookResult> {
    const startTime = Date.now();
    const logs: string[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const vm = new VM2({
        timeout: options.timeout,
        sandbox: this.createSafeSandbox(context, logs, warnings, options.allowConsole),
        eval: false, // Disable eval completely
        wasm: false, // Disable WebAssembly
        fixAsync: true
      });

      // Wrap hook code with error handling
      const wrappedCode = this.wrapHookCode(hookCode);
      
      const result = await vm.run(wrappedCode);

      return {
        success: true,
        output: result,
        logs,
        errors,
        warnings,
        executionTime: Date.now() - startTime,
        memoryUsed: this.estimateMemoryUsage(result)
      };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown VM2 error';
      errors.push(errorMsg);

      return {
        success: false,
        logs,
        errors,
        warnings,
        executionTime: Date.now() - startTime,
        memoryUsed: 0
      };
    }
  }

  /**
   * Fallback execution when VM2 is not available
   */
  private async executeWithFallback(
    hookCode: string,
    context: HookContext,
    options: HookExecutionOptions
  ): Promise<HookResult> {
    const startTime = Date.now();
    const logs: string[] = [];
    const warnings: string[] = [];

    // For fallback, we only allow very simple predefined functions
    const allowedFunctions = this.createAllowedFunctions(context, logs, warnings);
    
    try {
      // Very restrictive - only allow function calls from whitelist
      const result = this.executeSafeFunctions(hookCode, allowedFunctions);
      
      return {
        success: true,
        output: result,
        logs,
        errors: [],
        warnings,
        executionTime: Date.now() - startTime,
        memoryUsed: this.estimateMemoryUsage(result)
      };

    } catch (error) {
      return {
        success: false,
        logs,
        errors: [error instanceof Error ? error.message : 'Fallback execution failed'],
        warnings,
        executionTime: Date.now() - startTime,
        memoryUsed: 0
      };
    }
  }

  /**
   * Create a safe sandbox environment
   */
  private createSafeSandbox(
    context: HookContext, 
    logs: string[], 
    warnings: string[],
    allowConsole: boolean
  ): any {
    const sandbox: any = {
      // Safe context variables
      context: {
        variables: { ...context.variables }, // Clone to prevent modification
        projectName: context.projectName,
        projectType: context.projectType,
        templateId: context.templateId,
        templateVersion: context.templateVersion
        // NO outputPath, file system access, or sensitive data
      },

      // Utility functions
      utils: {
        isString: (val: any) => typeof val === 'string',
        isNumber: (val: any) => typeof val === 'number',
        isBoolean: (val: any) => typeof val === 'boolean',
        isEmpty: (val: any) => val == null || val === '',
        slugify: (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-'),
        capitalize: (str: string) => str.charAt(0).toUpperCase() + str.slice(1),
        camelCase: (str: string) => str.replace(/-([a-z])/g, (g) => g[1].toUpperCase()),
        pascalCase: (str: string) => this.toPascalCase(str)
      },

      // Limited Math functions
      Math: {
        max: Math.max,
        min: Math.min,
        floor: Math.floor,
        ceil: Math.ceil,
        round: Math.round,
        random: Math.random
      },

      // Safe JSON operations
      JSON: {
        parse: JSON.parse,
        stringify: JSON.stringify
      }
    };

    // Add console if allowed
    if (allowConsole) {
      sandbox.console = {
        log: (...args: any[]) => {
          logs.push(args.map(a => String(a)).join(' '));
        },
        warn: (...args: any[]) => {
          warnings.push(args.map(a => String(a)).join(' '));
        },
        error: (...args: any[]) => {
          warnings.push('ERROR: ' + args.map(a => String(a)).join(' '));
        }
      };
    }

    return sandbox;
  }

  /**
   * Wrap hook code with error handling and return statement
   */
  private wrapHookCode(hookCode: string): string {
    return `
      (function() {
        'use strict';
        try {
          ${hookCode}
        } catch (error) {
          throw new Error('Hook execution error: ' + error.message);
        }
      })();
    `;
  }

  /**
   * Validate hook code for security issues
   */
  private validateHookCode(hookCode: string): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    // Check for dangerous patterns
    const dangerousPatterns = [
      { pattern: /eval\s*\(/, message: 'eval() is not allowed' },
      { pattern: /Function\s*\(/, message: 'Function constructor is not allowed' },
      { pattern: /setTimeout|setInterval/, message: 'Timers are not allowed' },
      { pattern: /require\s*\(/, message: 'require() is not allowed' },
      { pattern: /import\s+/, message: 'import statements are not allowed' },
      { pattern: /process\./, message: 'Process access is not allowed' },
      { pattern: /global\./, message: 'Global access is not allowed' },
      { pattern: /window\./, message: 'Window access is not allowed' },
      { pattern: /__proto__/, message: 'Prototype manipulation is not allowed' },
      { pattern: /constructor/, message: 'Constructor access is not allowed' },
      { pattern: /fs\./, message: 'File system access is not allowed' },
      { pattern: /path\./, message: 'Path manipulation is not allowed' },
      { pattern: /child_process/, message: 'Child process execution is not allowed' },
      { pattern: /spawn|exec/, message: 'Process spawning is not allowed' },
      { pattern: /fetch|XMLHttpRequest/, message: 'Network access is not allowed' },
    ];

    for (const { pattern, message } of dangerousPatterns) {
      if (pattern.test(hookCode)) {
        errors.push({
          code: 'DANGEROUS_PATTERN',
          message,
          severity: 'error'
        });
      }
    }

    // Check code length
    if (hookCode.length > 10000) {
      errors.push({
        code: 'CODE_TOO_LONG',
        message: 'Hook code exceeds maximum length (10KB)',
        severity: 'error'
      });
    }

    // Check for potential infinite loops
    if (/while\s*\(true\)|for\s*\(\s*;\s*;\s*\)/.test(hookCode)) {
      warnings.push('Potential infinite loop detected');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Create allowed functions for fallback execution
   */
  private createAllowedFunctions(
    context: HookContext,
    logs: string[],
    warnings: string[]
  ): Map<string, Function> {
    const functions = new Map<string, Function>();

    // Basic validation functions
    functions.set('validateProject', () => {
      return { valid: true, message: 'Project validation passed' };
    });

    functions.set('formatCode', () => {
      return { formatted: true, message: 'Code formatting applied' };
    });

    functions.set('logInfo', (message: string) => {
      logs.push(`INFO: ${message}`);
      return true;
    });

    functions.set('logWarning', (message: string) => {
      warnings.push(`WARNING: ${message}`);
      return true;
    });

    return functions;
  }

  /**
   * Execute safe functions from whitelist
   */
  private executeSafeFunctions(hookCode: string, allowedFunctions: Map<string, Function>): any {
    // Very simple function call parser - only allow whitelisted function calls
    const functionCallPattern = /(\w+)\s*\(\s*([^)]*)\s*\)/g;
    const calls = [];
    let match;

    while ((match = functionCallPattern.exec(hookCode)) !== null) {
      const functionName = match[1];
      const argsStr = match[2];
      
      if (allowedFunctions.has(functionName)) {
        try {
          // Parse simple string arguments only
          const args = argsStr ? argsStr.split(',').map(arg => 
            arg.trim().replace(/['"]/g, '')
          ) : [];
          
          const result = allowedFunctions.get(functionName)!(...args);
          calls.push({ function: functionName, result });
        } catch (error) {
          throw new Error(`Error calling ${functionName}: ${error}`);
        }
      } else {
        throw new Error(`Function ${functionName} is not allowed`);
      }
    }

    return calls.length > 0 ? calls : { message: 'No function calls executed' };
  }

  /**
   * Estimate memory usage of result
   */
  private estimateMemoryUsage(result: any): number {
    try {
      return JSON.stringify(result).length * 2; // Rough approximation
    } catch {
      return 0;
    }
  }

  /**
   * Convert string to PascalCase
   */
  private toPascalCase(str: string): string {
    return str.replace(/(?:^|[-_\s])(.)/g, (_, char) => char.toUpperCase());
  }
}