/**
 * Comprehensive Template Manifest Validator
 *
 * Validates template manifests against schema with security checks,
 * dependency validation, and best practice enforcement
 */

import { Logger } from '../../../../../utils/logger';
import {
  TemplateManifest,
  VariableSchema,
  TemplateFile,
  TemplateHooks,
  TemplateLimits,
  ValidationResult,
  ValidationError,
  ConditionExpression
} from './interfaces';
import { SecureConditionEvaluator } from './condition-evaluator';
import * as semver from 'semver';

export interface ManifestValidationOptions {
  strictMode: boolean; // Enforce stricter validation rules
  allowExperimentalFeatures: boolean;
  maxVariables: number;
  maxFiles: number;
  maxManifestSize: number; // bytes
  requiredFields: string[];
  securityLevel: 'basic' | 'standard' | 'strict' | 'paranoid';
}

export interface ValidatedManifest extends TemplateManifest {
  _validation: {
    isValid: boolean;
    version: string;
    validatedAt: Date;
    securityLevel: string;
    warnings: string[];
  };
}

export interface ManifestValidationReport {
  isValid: boolean;
  errors: ValidationError[];
  warnings: string[];
  security: {
    level: string;
    threats: string[];
    recommendations: string[];
  };
  compatibility: {
    schemaVersion: string;
    supportedFeatures: string[];
    deprecatedFeatures: string[];
  };
  metrics: {
    variableCount: number;
    fileCount: number;
    complexity: number; // 0-100 scale
    maintainability: number; // 0-100 scale
  };
  performance: {
    estimatedRenderTime: number; // milliseconds
    memoryUsage: number; // bytes estimate
  };
}

export class TemplateManifestValidator {
  private logger: Logger;
  private conditionEvaluator: SecureConditionEvaluator;
  private options: Required<ManifestValidationOptions>;

  // Schema version compatibility
  private supportedVersions = ['1.0.0', '2.0.0'];
  private currentVersion = '2.0.0';

  // Security patterns for validation
  private securityPatterns = {
    // Dangerous path patterns
    dangerousPaths: [
      /\.\.[\/\\]/, // Path traversal
      /^[\/\\]/, // Absolute paths
      /[<>:"|?*]/, // Invalid filename characters
      /(con|prn|aux|nul|com[1-9]|lpt[1-9])/i, // Windows reserved names
      /\.(exe|bat|cmd|com|pif|scr|vbs|js)$/i // Executable extensions
    ],

    // Suspicious variable names
    suspiciousVariables: [
      /password|passwd|secret|key|token/i,
      /admin|root|superuser/i,
      /exec|eval|function|script/i,
      /\$\{.*\}/, // Template injection patterns
      /#\{.*\}/ // Ruby-style interpolation
    ],

    // Hook code patterns to flag
    dangerousHookPatterns: [
      /require\s*\(/,
      /import\s+/,
      /eval\s*\(/,
      /Function\s*\(/,
      /setTimeout|setInterval/,
      /process\./,
      /global\./,
      /window\./,
      /__proto__|constructor|prototype/,
      /fs\.|path\.|os\./,
      /child_process/,
      /spawn|exec/,
      /fetch|XMLHttpRequest/
    ]
  };

  // Best practice recommendations
  private bestPractices = {
    recommendedFields: [
      'description',
      'author',
      'license',
      'version',
      'tags',
      'requirements.projectTypes',
      'limits.maxFiles',
      'security.checksum'
    ],

    maxRecommendations: {
      variables: 50,
      files: 100,
      tagLength: 20,
      descriptionLength: 200
    },

    securityRequirements: {
      basic: ['security.checksum'],
      standard: ['security.checksum', 'limits.maxFiles', 'limits.allowedPaths'],
      strict: [
        'security.checksum',
        'security.signature',
        'limits.maxFiles',
        'limits.allowedPaths',
        'limits.maxTotalSize'
      ],
      paranoid: [
        'security.checksum',
        'security.signature',
        'security.trustedPublisher',
        'limits.maxFiles',
        'limits.allowedPaths',
        'limits.maxTotalSize'
      ]
    }
  };

  constructor(
    logger: Logger,
    conditionEvaluator: SecureConditionEvaluator,
    options: Partial<ManifestValidationOptions> = {}
  ) {
    this.logger = logger;
    this.conditionEvaluator = conditionEvaluator;

    this.options = {
      strictMode: options.strictMode ?? false,
      allowExperimentalFeatures: options.allowExperimentalFeatures ?? false,
      maxVariables: options.maxVariables ?? 100,
      maxFiles: options.maxFiles ?? 500,
      maxManifestSize: options.maxManifestSize ?? 1024 * 1024, // 1MB
      requiredFields: options.requiredFields ?? ['id', 'name', 'version', 'description'],
      securityLevel: options.securityLevel ?? 'standard'
    };
  }

  /**
   * Validate template manifest comprehensively
   */
  async validateManifest(manifest: TemplateManifest): Promise<ManifestValidationReport> {
    this.logger.info('Starting manifest validation', {
      templateId: manifest.id,
      version: manifest.version,
      securityLevel: this.options.securityLevel
    });

    const report: ManifestValidationReport = {
      isValid: true,
      errors: [],
      warnings: [],
      security: {
        level: this.options.securityLevel,
        threats: [],
        recommendations: []
      },
      compatibility: {
        schemaVersion: manifest.schemaVersion,
        supportedFeatures: [],
        deprecatedFeatures: []
      },
      metrics: {
        variableCount: manifest.variables?.length || 0,
        fileCount: manifest.files?.length || 0,
        complexity: 0,
        maintainability: 0
      },
      performance: {
        estimatedRenderTime: 0,
        memoryUsage: 0
      }
    };

    try {
      // 1. Schema version validation
      this.validateSchemaVersion(manifest, report);

      // 2. Required fields validation
      this.validateRequiredFields(manifest, report);

      // 3. Basic field validation
      this.validateBasicFields(manifest, report);

      // 4. Security validation
      await this.validateSecurity(manifest, report);

      // 5. Variables validation
      this.validateVariables(manifest.variables || [], report);

      // 6. Files validation
      this.validateFiles(manifest.files || [], report);

      // 7. Hooks validation
      this.validateHooks(manifest.hooks, report);

      // 8. Limits validation
      this.validateLimits(manifest.limits, report);

      // 9. Dependencies validation
      this.validateDependencies(manifest, report);

      // 10. Performance estimation
      this.estimatePerformance(manifest, report);

      // 11. Complexity analysis
      this.analyzeComplexity(manifest, report);

      // 12. Best practices check
      this.checkBestPractices(manifest, report);

      // Final validation status
      report.isValid = report.errors.length === 0;

      this.logger.info('Manifest validation completed', {
        templateId: manifest.id,
        isValid: report.isValid,
        errorCount: report.errors.length,
        warningCount: report.warnings.length,
        complexity: report.metrics.complexity
      });

      return report;
    } catch (error) {
      report.errors.push({
        code: 'VALIDATION_FAILED',
        message: `Manifest validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'error'
      });
      report.isValid = false;
      return report;
    }
  }

  /**
   * Validate schema version compatibility
   */
  private validateSchemaVersion(
    manifest: TemplateManifest,
    report: ManifestValidationReport
  ): void {
    if (!manifest.schemaVersion) {
      report.errors.push({
        code: 'MISSING_SCHEMA_VERSION',
        message: 'Schema version is required',
        field: 'schemaVersion',
        severity: 'error'
      });
      return;
    }

    if (!this.supportedVersions.includes(manifest.schemaVersion)) {
      report.errors.push({
        code: 'UNSUPPORTED_SCHEMA_VERSION',
        message: `Schema version ${manifest.schemaVersion} is not supported. Supported: ${this.supportedVersions.join(', ')}`,
        field: 'schemaVersion',
        severity: 'error'
      });
    }

    // Check for deprecated features
    if (manifest.schemaVersion === '1.0.0') {
      report.compatibility.deprecatedFeatures.push(
        'Schema v1.0.0 is deprecated, please upgrade to v2.0.0'
      );
      report.warnings.push('Schema v1.0.0 support will be removed in future versions');
    }

    // Set supported features based on version
    switch (manifest.schemaVersion) {
      case '2.0.0':
        report.compatibility.supportedFeatures.push(
          'enhanced-security',
          'conditional-files',
          'variable-dependencies',
          'hooks'
        );
        break;
      case '1.0.0':
        report.compatibility.supportedFeatures.push('basic-templating', 'variables');
        break;
    }
  }

  /**
   * Validate required fields
   */
  private validateRequiredFields(
    manifest: TemplateManifest,
    report: ManifestValidationReport
  ): void {
    for (const field of this.options.requiredFields) {
      const value = this.getNestedValue(manifest, field);
      if (value === undefined || value === null || value === '') {
        report.errors.push({
          code: 'MISSING_REQUIRED_FIELD',
          message: `Required field is missing: ${field}`,
          field,
          severity: 'error'
        });
      }
    }
  }

  /**
   * Validate basic manifest fields
   */
  private validateBasicFields(manifest: TemplateManifest, report: ManifestValidationReport): void {
    // ID validation
    if (manifest.id && !/^[a-zA-Z0-9-_]+$/.test(manifest.id)) {
      report.errors.push({
        code: 'INVALID_ID',
        message: 'Template ID can only contain alphanumeric characters, hyphens, and underscores',
        field: 'id',
        severity: 'error'
      });
    }

    // Version validation
    if (manifest.version && !semver.valid(manifest.version)) {
      report.errors.push({
        code: 'INVALID_VERSION',
        message: 'Template version must be a valid semantic version (e.g., 1.0.0)',
        field: 'version',
        severity: 'error'
      });
    }

    // Name validation
    if (manifest.name && manifest.name.length > 100) {
      report.warnings.push('Template name is very long (>100 characters)');
    }

    // Description validation
    if (
      manifest.description &&
      manifest.description.length > this.bestPractices.maxRecommendations.descriptionLength
    ) {
      report.warnings.push(
        `Description is longer than recommended (>${this.bestPractices.maxRecommendations.descriptionLength} characters)`
      );
    }

    // Tags validation
    if (manifest.tags) {
      if (manifest.tags.length > this.bestPractices.maxRecommendations.tagLength) {
        report.warnings.push(`Too many tags (>${this.bestPractices.maxRecommendations.tagLength})`);
      }

      for (const tag of manifest.tags) {
        if (!/^[a-zA-Z0-9-]+$/.test(tag)) {
          report.warnings.push(`Tag "${tag}" contains invalid characters`);
        }
      }
    }

    // License validation
    const validLicenses = [
      'MIT',
      'Apache-2.0',
      'GPL-3.0',
      'BSD-3-Clause',
      'ISC',
      'GPL-2.0',
      'LGPL-3.0',
      'MPL-2.0'
    ];
    if (manifest.license && !validLicenses.includes(manifest.license)) {
      report.warnings.push(`License "${manifest.license}" is not a common SPDX identifier`);
    }
  }

  /**
   * Validate security configuration
   */
  private async validateSecurity(
    manifest: TemplateManifest,
    report: ManifestValidationReport
  ): Promise<void> {
    if (!manifest.security) {
      report.errors.push({
        code: 'MISSING_SECURITY',
        message: 'Security configuration is required',
        field: 'security',
        severity: 'error'
      });
      return;
    }

    const requiredSecurityFields =
      this.bestPractices.securityRequirements[this.options.securityLevel];

    for (const field of requiredSecurityFields) {
      const value = this.getNestedValue(manifest, field);
      if (value === undefined || value === null || value === '') {
        const severity = this.options.strictMode ? 'error' : 'warning';
        const message = `Security field required for ${this.options.securityLevel} level: ${field}`;

        if (severity === 'error') {
          report.errors.push({
            code: 'MISSING_SECURITY_FIELD',
            message,
            field,
            severity
          });
        } else {
          report.warnings.push(message);
        }
      }
    }

    // Checksum validation
    if (manifest.security.checksum) {
      if (!/^[a-fA-F0-9]{64}$/.test(manifest.security.checksum)) {
        report.errors.push({
          code: 'INVALID_CHECKSUM',
          message: 'Checksum must be a valid SHA-256 hash (64 hex characters)',
          field: 'security.checksum',
          severity: 'error'
        });
      }
    }

    // Signature validation
    if (manifest.security.signature) {
      if (!/^[a-fA-F0-9]+$/.test(manifest.security.signature)) {
        report.warnings.push('Signature format may be invalid');
      }
    }

    // Security threats analysis
    this.analyzeSecurityThreats(manifest, report);
  }

  /**
   * Validate template variables
   */
  private validateVariables(variables: VariableSchema[], report: ManifestValidationReport): void {
    if (variables.length > this.options.maxVariables) {
      report.errors.push({
        code: 'TOO_MANY_VARIABLES',
        message: `Too many variables (${variables.length}). Maximum allowed: ${this.options.maxVariables}`,
        field: 'variables',
        severity: 'error'
      });
    }

    const variableNames = new Set<string>();

    for (let i = 0; i < variables.length; i++) {
      const variable = variables[i];
      const fieldPrefix = `variables[${i}]`;

      // Name validation
      if (!variable.name) {
        report.errors.push({
          code: 'MISSING_VARIABLE_NAME',
          message: 'Variable name is required',
          field: `${fieldPrefix}.name`,
          severity: 'error'
        });
        continue;
      }

      // Check for duplicate names
      if (variableNames.has(variable.name)) {
        report.errors.push({
          code: 'DUPLICATE_VARIABLE',
          message: `Duplicate variable name: ${variable.name}`,
          field: `${fieldPrefix}.name`,
          severity: 'error'
        });
      }
      variableNames.add(variable.name);

      // Name format validation
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(variable.name)) {
        report.errors.push({
          code: 'INVALID_VARIABLE_NAME',
          message: `Invalid variable name: ${variable.name}. Must start with letter or underscore, contain only alphanumeric and underscore`,
          field: `${fieldPrefix}.name`,
          severity: 'error'
        });
      }

      // Check for suspicious variable names
      for (const pattern of this.securityPatterns.suspiciousVariables) {
        if (pattern.test(variable.name)) {
          report.security.threats.push(`Suspicious variable name: ${variable.name}`);
          report.warnings.push(`Variable name "${variable.name}" may pose security risks`);
        }
      }

      // Type validation
      const validTypes = ['string', 'number', 'boolean', 'select', 'array', 'object'];
      if (!validTypes.includes(variable.type)) {
        report.errors.push({
          code: 'INVALID_VARIABLE_TYPE',
          message: `Invalid variable type: ${variable.type}. Valid types: ${validTypes.join(', ')}`,
          field: `${fieldPrefix}.type`,
          severity: 'error'
        });
      }

      // Validation rules
      if (variable.validation) {
        this.validateVariableValidation(variable, `${fieldPrefix}.validation`, report);
      }

      // Condition validation
      if (variable.condition) {
        const conditionResult = this.conditionEvaluator.validateCondition(variable.condition);
        if (!conditionResult.valid) {
          for (const error of conditionResult.errors) {
            report.errors.push({
              code: 'INVALID_VARIABLE_CONDITION',
              message: `Variable condition error: ${error.message}`,
              field: `${fieldPrefix}.condition`,
              severity: 'error'
            });
          }
        }
      }

      // Dependencies validation
      if (variable.dependencies) {
        for (const dep of variable.dependencies) {
          if (!variableNames.has(dep) && !variables.some((v) => v.name === dep)) {
            report.warnings.push(
              `Variable "${variable.name}" depends on undefined variable: ${dep}`
            );
          }
        }
      }
    }
  }

  /**
   * Validate variable validation rules
   */
  private validateVariableValidation(
    variable: VariableSchema,
    fieldPrefix: string,
    report: ManifestValidationReport
  ): void {
    const validation = variable.validation!;

    // Pattern validation
    if (validation.pattern) {
      try {
        new RegExp(validation.pattern);
      } catch (error) {
        report.errors.push({
          code: 'INVALID_REGEX_PATTERN',
          message: `Invalid regex pattern: ${validation.pattern}`,
          field: `${fieldPrefix}.pattern`,
          severity: 'error'
        });
      }
    }

    // Length validation
    if (validation.minLength !== undefined && validation.maxLength !== undefined) {
      if (validation.minLength > validation.maxLength) {
        report.errors.push({
          code: 'INVALID_LENGTH_RANGE',
          message: 'minLength cannot be greater than maxLength',
          field: fieldPrefix,
          severity: 'error'
        });
      }
    }

    // Number range validation
    if (validation.min !== undefined && validation.max !== undefined) {
      if (validation.min > validation.max) {
        report.errors.push({
          code: 'INVALID_NUMBER_RANGE',
          message: 'min cannot be greater than max',
          field: fieldPrefix,
          severity: 'error'
        });
      }
    }

    // Options validation for select type
    if (variable.type === 'select') {
      if (!validation.options || validation.options.length === 0) {
        report.errors.push({
          code: 'MISSING_SELECT_OPTIONS',
          message: 'Select type variables must have options',
          field: `${fieldPrefix}.options`,
          severity: 'error'
        });
      }
    }
  }

  /**
   * Validate template files
   */
  private validateFiles(files: TemplateFile[], report: ManifestValidationReport): void {
    if (files.length > this.options.maxFiles) {
      report.errors.push({
        code: 'TOO_MANY_FILES',
        message: `Too many files (${files.length}). Maximum allowed: ${this.options.maxFiles}`,
        field: 'files',
        severity: 'error'
      });
    }

    const filePaths = new Set<string>();

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fieldPrefix = `files[${i}]`;

      // Path validation
      if (!file.path) {
        report.errors.push({
          code: 'MISSING_FILE_PATH',
          message: 'File path is required',
          field: `${fieldPrefix}.path`,
          severity: 'error'
        });
        continue;
      }

      // Check for duplicate paths
      if (filePaths.has(file.path)) {
        report.errors.push({
          code: 'DUPLICATE_FILE_PATH',
          message: `Duplicate file path: ${file.path}`,
          field: `${fieldPrefix}.path`,
          severity: 'error'
        });
      }
      filePaths.add(file.path);

      // Security validation for paths
      for (const pattern of this.securityPatterns.dangerousPaths) {
        if (pattern.test(file.path)) {
          report.security.threats.push(`Dangerous file path: ${file.path}`);
          report.errors.push({
            code: 'DANGEROUS_FILE_PATH',
            message: `File path poses security risk: ${file.path}`,
            field: `${fieldPrefix}.path`,
            severity: 'error'
          });
        }
      }

      // Template path validation
      if (!file.template) {
        report.errors.push({
          code: 'MISSING_TEMPLATE_PATH',
          message: 'Template path is required',
          field: `${fieldPrefix}.template`,
          severity: 'error'
        });
      }

      // Condition validation
      if (file.condition) {
        const conditionResult = this.conditionEvaluator.validateCondition(file.condition);
        if (!conditionResult.valid) {
          for (const error of conditionResult.errors) {
            report.errors.push({
              code: 'INVALID_FILE_CONDITION',
              message: `File condition error: ${error.message}`,
              field: `${fieldPrefix}.condition`,
              severity: 'error'
            });
          }
        }
      }
    }
  }

  /**
   * Validate template hooks
   */
  private validateHooks(hooks: TemplateHooks | undefined, report: ManifestValidationReport): void {
    if (!hooks) return;

    const hookNames = ['beforeGenerate', 'afterGenerate', 'onConflict'] as const;

    for (const hookName of hookNames) {
      const hookCode = hooks[hookName];
      if (hookCode) {
        // Security validation for hook code
        for (const pattern of this.securityPatterns.dangerousHookPatterns) {
          if (pattern.test(hookCode)) {
            report.security.threats.push(`Dangerous pattern in ${hookName} hook`);
            report.errors.push({
              code: 'DANGEROUS_HOOK_CODE',
              message: `Hook contains potentially dangerous code: ${hookName}`,
              field: `hooks.${hookName}`,
              severity: 'error'
            });
          }
        }

        // Length validation
        if (hookCode.length > 10000) {
          report.warnings.push(
            `Hook code is very long (${hookCode.length} characters): ${hookName}`
          );
        }
      }
    }
  }

  /**
   * Validate template limits
   */
  private validateLimits(
    limits: TemplateLimits | undefined,
    report: ManifestValidationReport
  ): void {
    if (!limits) {
      if (this.options.strictMode) {
        report.errors.push({
          code: 'MISSING_LIMITS',
          message: 'Template limits are required in strict mode',
          field: 'limits',
          severity: 'error'
        });
      }
      return;
    }

    // Max files validation
    if (limits.maxFiles <= 0) {
      report.errors.push({
        code: 'INVALID_MAX_FILES',
        message: 'maxFiles must be greater than 0',
        field: 'limits.maxFiles',
        severity: 'error'
      });
    }

    if (limits.maxFiles > 10000) {
      report.warnings.push(
        `maxFiles is very high (${limits.maxFiles}), may cause performance issues`
      );
    }

    // Total size validation
    if (limits.maxTotalSize) {
      const sizePattern = /^(\d+)(B|KB|MB|GB)$/i;
      if (!sizePattern.test(limits.maxTotalSize)) {
        report.errors.push({
          code: 'INVALID_SIZE_FORMAT',
          message: 'maxTotalSize must be in format like "10MB", "1GB"',
          field: 'limits.maxTotalSize',
          severity: 'error'
        });
      }
    }

    // Allowed paths validation
    if (limits.allowedPaths) {
      for (let i = 0; i < limits.allowedPaths.length; i++) {
        const allowedPath = limits.allowedPaths[i];

        // Check for dangerous paths
        if (allowedPath.includes('..') || allowedPath.startsWith('/')) {
          report.security.threats.push(`Dangerous allowed path: ${allowedPath}`);
          report.errors.push({
            code: 'DANGEROUS_ALLOWED_PATH',
            message: `Allowed path poses security risk: ${allowedPath}`,
            field: `limits.allowedPaths[${i}]`,
            severity: 'error'
          });
        }
      }
    }
  }

  /**
   * Validate dependencies and requirements
   */
  private validateDependencies(manifest: TemplateManifest, report: ManifestValidationReport): void {
    if (!manifest.requirements) return;

    // Project types validation
    if (manifest.requirements.projectTypes) {
      const validProjectTypes = [
        'javascript',
        'typescript',
        'python',
        'java',
        'go',
        'rust',
        'php',
        'ruby',
        'csharp',
        'node',
        'react',
        'vue',
        'angular',
        'express',
        'django',
        'spring',
        'laravel'
      ];

      for (const projectType of manifest.requirements.projectTypes) {
        if (!validProjectTypes.includes(projectType)) {
          report.warnings.push(`Unknown project type: ${projectType}`);
        }
      }
    }

    // Node version validation
    if (manifest.requirements.minNodeVersion) {
      if (!semver.valid(manifest.requirements.minNodeVersion)) {
        report.errors.push({
          code: 'INVALID_NODE_VERSION',
          message: 'minNodeVersion must be a valid semantic version',
          field: 'requirements.minNodeVersion',
          severity: 'error'
        });
      }
    }

    // Dependencies validation
    if (manifest.requirements.dependencies) {
      for (const dep of manifest.requirements.dependencies) {
        // Check for known vulnerable packages
        const vulnerablePackages = ['lodash@<4.17.12', 'moment@<2.29.2'];
        if (vulnerablePackages.some((vuln) => dep.includes(vuln.split('@')[0]))) {
          report.warnings.push(`Dependency may be vulnerable: ${dep}`);
        }
      }
    }
  }

  /**
   * Estimate template performance impact
   */
  private estimatePerformance(manifest: TemplateManifest, report: ManifestValidationReport): void {
    const variableCount = manifest.variables?.length || 0;
    const fileCount = manifest.files?.length || 0;
    const hasHooks = !!(manifest.hooks?.beforeGenerate || manifest.hooks?.afterGenerate);

    // Estimate render time (very rough approximation)
    let renderTime = 100; // Base time
    renderTime += variableCount * 5; // 5ms per variable
    renderTime += fileCount * 20; // 20ms per file
    if (hasHooks) renderTime += 500; // Hook overhead

    // Complex conditions increase render time
    const conditionCount =
      (manifest.variables || []).filter((v) => v.condition).length +
      (manifest.files || []).filter((f) => f.condition).length;
    renderTime += conditionCount * 10;

    report.performance.estimatedRenderTime = renderTime;

    // Estimate memory usage
    let memoryUsage = 50000; // Base memory (50KB)
    memoryUsage += variableCount * 1000; // 1KB per variable
    memoryUsage += fileCount * 5000; // 5KB per file template

    report.performance.memoryUsage = memoryUsage;

    // Performance warnings
    if (renderTime > 5000) {
      report.warnings.push('Template may have slow render performance (>5s estimated)');
    }

    if (memoryUsage > 50 * 1024 * 1024) {
      report.warnings.push('Template may use excessive memory (>50MB estimated)');
    }
  }

  /**
   * Analyze template complexity
   */
  private analyzeComplexity(manifest: TemplateManifest, report: ManifestValidationReport): void {
    let complexity = 0;
    let maintainability = 100; // Start with perfect score

    // Variable complexity
    const variableCount = manifest.variables?.length || 0;
    complexity += variableCount;
    if (variableCount > 20) maintainability -= 10;

    // File complexity
    const fileCount = manifest.files?.length || 0;
    complexity += fileCount;
    if (fileCount > 50) maintainability -= 10;

    // Condition complexity
    const conditionCount =
      (manifest.variables || []).filter((v) => v.condition).length +
      (manifest.files || []).filter((f) => f.condition).length;
    complexity += conditionCount * 2;
    if (conditionCount > 10) maintainability -= 15;

    // Hook complexity
    if (manifest.hooks) {
      const hookCount = Object.keys(manifest.hooks).length;
      complexity += hookCount * 3;
      if (hookCount > 2) maintainability -= 10;
    }

    // Dependencies complexity
    const depCount = manifest.requirements?.dependencies?.length || 0;
    complexity += depCount;
    if (depCount > 20) maintainability -= 5;

    // Normalize complexity to 0-100 scale
    report.metrics.complexity = Math.min(complexity, 100);
    report.metrics.maintainability = Math.max(maintainability, 0);

    // Complexity warnings
    if (report.metrics.complexity > 75) {
      report.warnings.push('Template has high complexity, consider simplifying');
    }

    if (report.metrics.maintainability < 50) {
      report.warnings.push('Template may be difficult to maintain');
    }
  }

  /**
   * Check best practices compliance
   */
  private checkBestPractices(manifest: TemplateManifest, report: ManifestValidationReport): void {
    let score = 0;
    const maxScore = this.bestPractices.recommendedFields.length;

    // Check for recommended fields
    for (const field of this.bestPractices.recommendedFields) {
      const value = this.getNestedValue(manifest, field);
      if (value !== undefined && value !== null && value !== '') {
        score++;
      } else {
        report.security.recommendations.push(
          `Consider adding ${field} for better template quality`
        );
      }
    }

    // Additional best practice checks
    if (!manifest.tags || manifest.tags.length === 0) {
      report.security.recommendations.push('Add tags to improve template discoverability');
    }

    if (!manifest.license) {
      report.security.recommendations.push('Specify a license for legal clarity');
    }

    if (!manifest.requirements?.projectTypes) {
      report.security.recommendations.push('Specify supported project types');
    }

    // Calculate best practices compliance
    const compliance = (score / maxScore) * 100;
    if (compliance < 70) {
      report.warnings.push(`Template follows ${compliance.toFixed(0)}% of best practices`);
    }
  }

  /**
   * Analyze security threats
   */
  private analyzeSecurityThreats(
    manifest: TemplateManifest,
    report: ManifestValidationReport
  ): void {
    // Check for missing security measures
    if (!manifest.security?.checksum) {
      report.security.threats.push('Missing integrity checksum');
      report.security.recommendations.push('Add SHA-256 checksum for template integrity');
    }

    if (!manifest.limits?.allowedPaths) {
      report.security.threats.push('No path restrictions defined');
      report.security.recommendations.push('Define allowed output paths to prevent path traversal');
    }

    if (!manifest.limits?.maxFiles) {
      report.security.threats.push('No file count limits');
      report.security.recommendations.push('Set maximum file count to prevent DoS attacks');
    }

    // Check for overly permissive settings
    if (manifest.limits?.maxFiles && manifest.limits.maxFiles > 1000) {
      report.security.threats.push('Very high file count limit');
    }

    if (manifest.limits?.allowedPaths?.includes('**')) {
      report.security.threats.push('Overly permissive path restrictions');
    }

    // Template injection risks
    const hasUserInput = manifest.variables?.some(
      (v) => v.type === 'string' && !v.validation?.pattern
    );
    if (hasUserInput) {
      report.security.recommendations.push(
        'Consider adding validation patterns for string variables'
      );
    }
  }

  /**
   * Get nested object value by dot notation path
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Create validated manifest with metadata
   */
  createValidatedManifest(
    manifest: TemplateManifest,
    report: ManifestValidationReport
  ): ValidatedManifest {
    return {
      ...manifest,
      _validation: {
        isValid: report.isValid,
        version: this.currentVersion,
        validatedAt: new Date(),
        securityLevel: this.options.securityLevel,
        warnings: report.warnings
      }
    };
  }

  /**
   * Get validation statistics
   */
  getValidationStats(): {
    supportedVersions: string[];
    currentVersion: string;
    securityLevels: string[];
    maxLimits: {
      variables: number;
      files: number;
      manifestSize: number;
    };
  } {
    return {
      supportedVersions: this.supportedVersions,
      currentVersion: this.currentVersion,
      securityLevels: ['basic', 'standard', 'strict', 'paranoid'],
      maxLimits: {
        variables: this.options.maxVariables,
        files: this.options.maxFiles,
        manifestSize: this.options.maxManifestSize
      }
    };
  }
}
