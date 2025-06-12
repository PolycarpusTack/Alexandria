/**
 * Secure Condition Evaluator
 *
 * Evaluates template conditions using a safe AST-based approach
 * No eval() or Function() - prevents code injection attacks
 */

import { Logger } from '../../../../../utils/logger';
import { ConditionExpression, VariableMap, ValidationResult, ValidationError } from './interfaces';

export class SecureConditionEvaluator {
  private logger: Logger;
  private readonly maxDepth = 10; // Prevent deep recursion attacks

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Evaluate a condition expression safely
   */
  evaluateCondition(
    condition: ConditionExpression | string,
    variables: VariableMap,
    depth = 0
  ): boolean {
    if (depth > this.maxDepth) {
      throw new Error('Maximum condition depth exceeded - possible infinite recursion');
    }

    // Handle string conditions by parsing to safe AST
    if (typeof condition === 'string') {
      condition = this.parseStringCondition(condition);
    }

    try {
      return this.evaluateAST(condition, variables, depth + 1);
    } catch (error) {
      this.logger.error('Condition evaluation failed', { condition, error });
      return false; // Fail-safe default
    }
  }

  /**
   * Parse string condition to safe AST
   */
  private parseStringCondition(conditionStr: string): ConditionExpression {
    // Sanitize input
    const sanitized = conditionStr.trim();

    if (!sanitized) {
      return { type: 'equals', variable: 'true', value: true };
    }

    // Handle simple boolean values
    if (sanitized === 'true') {
      return { type: 'equals', variable: 'true', value: true };
    }
    if (sanitized === 'false') {
      return { type: 'equals', variable: 'false', value: false };
    }

    // Parse common patterns safely
    try {
      return this.parseConditionPattern(sanitized);
    } catch (error) {
      this.logger.warn('Failed to parse condition, defaulting to false', {
        condition: conditionStr,
        error
      });
      return { type: 'equals', variable: 'false', value: false };
    }
  }

  /**
   * Parse condition patterns without using eval
   */
  private parseConditionPattern(condition: string): ConditionExpression {
    // Remove dangerous characters and validate
    if (this.containsDangerousPatterns(condition)) {
      throw new Error('Condition contains potentially dangerous patterns');
    }

    // Parse equality operators
    if (condition.includes(' === ')) {
      const [left, right] = condition.split(' === ').map((s) => s.trim());
      return {
        type: 'equals',
        variable: this.parseVariable(left),
        value: this.parseValue(right)
      };
    }

    if (condition.includes(' !== ')) {
      const [left, right] = condition.split(' !== ').map((s) => s.trim());
      return {
        type: 'notEquals',
        variable: this.parseVariable(left),
        value: this.parseValue(right)
      };
    }

    // Parse contains operator
    if (condition.includes('.includes(')) {
      const match = condition.match(/(\w+)\.includes\(['"]([^'"]+)['"]\)/);
      if (match) {
        return {
          type: 'contains',
          variable: match[1],
          value: match[2]
        };
      }
    }

    // Parse startsWith operator
    if (condition.includes('.startsWith(')) {
      const match = condition.match(/(\w+)\.startsWith\(['"]([^'"]+)['"]\)/);
      if (match) {
        return {
          type: 'startsWith',
          variable: match[1],
          value: match[2]
        };
      }
    }

    // Parse simple variable reference
    if (/^\w+$/.test(condition)) {
      return {
        type: 'equals',
        variable: condition,
        value: true
      };
    }

    // Default fallback
    throw new Error(`Unable to parse condition: ${condition}`);
  }

  /**
   * Check for dangerous patterns in conditions
   */
  private containsDangerousPatterns(condition: string): boolean {
    const dangerousPatterns = [
      /eval\s*\(/,
      /Function\s*\(/,
      /setTimeout\s*\(/,
      /setInterval\s*\(/,
      /require\s*\(/,
      /import\s*\(/,
      /process\./,
      /global\./,
      /__proto__/,
      /constructor/,
      /prototype/,
      /\.\./, // Path traversal
      /\/\//, // Comments that could hide code
      /\/\*/ // Block comments
    ];

    return dangerousPatterns.some((pattern) => pattern.test(condition));
  }

  /**
   * Parse variable name with validation
   */
  private parseVariable(varStr: string): string {
    const variable = varStr.trim();

    // Validate variable name (alphanumeric + underscore only)
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(variable)) {
      throw new Error(`Invalid variable name: ${variable}`);
    }

    return variable;
  }

  /**
   * Parse value with type inference
   */
  private parseValue(valueStr: string): any {
    const value = valueStr.trim();

    // Boolean values
    if (value === 'true') return true;
    if (value === 'false') return false;

    // Null/undefined
    if (value === 'null') return null;
    if (value === 'undefined') return undefined;

    // Quoted strings
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      return value.slice(1, -1);
    }

    // Numbers
    if (/^-?\d+(\.\d+)?$/.test(value)) {
      return parseFloat(value);
    }

    // Default to string
    return value;
  }

  /**
   * Evaluate AST node recursively
   */
  private evaluateAST(node: ConditionExpression, variables: VariableMap, depth: number): boolean {
    switch (node.type) {
      case 'equals':
        return this.getVariableValue(node.variable, variables) === node.value;

      case 'notEquals':
        return this.getVariableValue(node.variable, variables) !== node.value;

      case 'contains':
        const containsValue = this.getVariableValue(node.variable, variables);
        return typeof containsValue === 'string' && containsValue.includes(node.value);

      case 'startsWith':
        const startsValue = this.getVariableValue(node.variable, variables);
        return typeof startsValue === 'string' && startsValue.startsWith(node.value);

      case 'endsWith':
        const endsValue = this.getVariableValue(node.variable, variables);
        return typeof endsValue === 'string' && endsValue.endsWith(node.value);

      case 'greater':
        const greaterValue = this.getVariableValue(node.variable, variables);
        return typeof greaterValue === 'number' && greaterValue > node.value;

      case 'less':
        const lessValue = this.getVariableValue(node.variable, variables);
        return typeof lessValue === 'number' && lessValue < node.value;

      case 'and':
        return node.conditions.every((cond) => this.evaluateAST(cond, variables, depth));

      case 'or':
        return node.conditions.some((cond) => this.evaluateAST(cond, variables, depth));

      case 'not':
        return !this.evaluateAST(node.condition, variables, depth);

      default:
        this.logger.warn('Unknown condition type', { type: (node as any).type });
        return false;
    }
  }

  /**
   * Get variable value with safe access
   */
  private getVariableValue(variableName: string, variables: VariableMap): any {
    if (!(variableName in variables)) {
      this.logger.debug('Variable not found in context', { variable: variableName });
      return undefined;
    }

    return variables[variableName];
  }

  /**
   * Validate condition expression
   */
  validateCondition(condition: ConditionExpression | string): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    try {
      // Convert string to AST if needed
      const ast = typeof condition === 'string' ? this.parseStringCondition(condition) : condition;

      // Validate AST structure
      this.validateAST(ast, errors, warnings);
    } catch (error) {
      errors.push({
        code: 'PARSE_ERROR',
        message: `Failed to parse condition: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'error'
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate AST structure recursively
   */
  private validateAST(
    node: ConditionExpression,
    errors: ValidationError[],
    warnings: string[],
    depth = 0
  ): void {
    if (depth > this.maxDepth) {
      errors.push({
        code: 'MAX_DEPTH',
        message: 'Condition exceeds maximum allowed depth',
        severity: 'error'
      });
      return;
    }

    switch (node.type) {
      case 'equals':
      case 'notEquals':
      case 'contains':
      case 'startsWith':
      case 'endsWith':
      case 'greater':
      case 'less':
        this.validateVariableReference(node.variable, errors);
        break;

      case 'and':
      case 'or':
        if (!Array.isArray(node.conditions) || node.conditions.length === 0) {
          errors.push({
            code: 'INVALID_CONDITIONS',
            message: `${node.type} operator requires at least one condition`,
            severity: 'error'
          });
        } else {
          node.conditions.forEach((cond) => this.validateAST(cond, errors, warnings, depth + 1));
        }
        break;

      case 'not':
        if (!node.condition) {
          errors.push({
            code: 'MISSING_CONDITION',
            message: 'not operator requires a condition',
            severity: 'error'
          });
        } else {
          this.validateAST(node.condition, errors, warnings, depth + 1);
        }
        break;

      default:
        errors.push({
          code: 'UNKNOWN_TYPE',
          message: `Unknown condition type: ${(node as any).type}`,
          severity: 'error'
        });
    }
  }

  /**
   * Validate variable reference
   */
  private validateVariableReference(variable: string, errors: ValidationError[]): void {
    if (!variable || typeof variable !== 'string') {
      errors.push({
        code: 'INVALID_VARIABLE',
        message: 'Variable name must be a non-empty string',
        field: 'variable',
        severity: 'error'
      });
      return;
    }

    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(variable)) {
      errors.push({
        code: 'INVALID_VARIABLE_NAME',
        message: `Invalid variable name: ${variable}`,
        field: 'variable',
        severity: 'error'
      });
    }
  }
}
