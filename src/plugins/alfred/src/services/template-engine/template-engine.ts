/**
 * Main Template Engine
 * 
 * Orchestrates the secure template processing system
 */

import { Logger } from '../../../../../utils/logger';
import { EventBus } from '../../../../../core/event-bus/interfaces';
import {
  TemplateManifest,
  VariableMap,
  GenerationResult,
  TemplateEngineOptions,
  ValidationResult,
  SecurityScanResult,
  RenderedTemplate
} from './interfaces';

export class TemplateEngine {
  private logger: Logger;
  private eventBus: EventBus;
  private options: TemplateEngineOptions;

  constructor(
    logger: Logger,
    eventBus: EventBus,
    options: Partial<TemplateEngineOptions> = {}
  ) {
    this.logger = logger;
    this.eventBus = eventBus;
    this.options = {
      maxFileSize: 10 * 1024 * 1024, // 10MB
      allowedExtensions: ['.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.txt', '.css', '.scss', '.html'],
      securityLevel: 'strict',
      enableCaching: true,
      ...options
    };
  }

  /**
   * Process template with variables and generate files
   */
  async processTemplate(
    manifest: TemplateManifest,
    variables: VariableMap,
    targetPath: string
  ): Promise<GenerationResult> {
    const startTime = Date.now();
    
    try {
      this.logger.info('Starting template processing', {
        templateId: manifest.id,
        templateName: manifest.name,
        targetPath,
        variableCount: Object.keys(variables).length
      });

      // Validate template
      const validation = await this.validateTemplate(manifest);
      if (!validation.valid) {
        return {
          success: false,
          filesGenerated: [],
          conflicts: [],
          errors: validation.errors.map(e => e.message),
          warnings: validation.warnings,
          duration: Date.now() - startTime
        };
      }

      // Security scan
      const securityScan = await this.performSecurityScan(manifest);
      if (!securityScan.safe && this.options.securityLevel === 'strict') {
        return {
          success: false,
          filesGenerated: [],
          conflicts: [],
          errors: [`Security scan failed: ${securityScan.violations.map(v => v.description).join(', ')}`],
          warnings: [],
          duration: Date.now() - startTime
        };
      }

      // Render template
      const rendered = await this.renderTemplate(manifest, variables, targetPath);
      
      const result: GenerationResult = {
        success: true,
        filesGenerated: Array.from(rendered.files.keys()),
        conflicts: rendered.conflicts,
        errors: [],
        warnings: securityScan.violations
          .filter(v => v.severity === 'low' || v.severity === 'medium')
          .map(v => v.description),
        duration: Date.now() - startTime,
        metadata: rendered.metadata
      };

      this.logger.info('Template processing completed', {
        templateId: manifest.id,
        filesGenerated: result.filesGenerated.length,
        duration: result.duration
      });

      return result;

    } catch (error) {
      this.logger.error('Template processing failed', { 
        templateId: manifest.id, 
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        filesGenerated: [],
        conflicts: [],
        errors: [error instanceof Error ? error.message : 'Unknown error occurred'],
        warnings: [],
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Validate template manifest and structure
   */
  private async validateTemplate(manifest: TemplateManifest): Promise<ValidationResult> {
    const errors: any[] = [];
    const warnings: string[] = [];

    // Basic validation
    if (!manifest.id || !manifest.name || !manifest.version) {
      errors.push({
        code: 'MISSING_REQUIRED_FIELDS',
        message: 'Template manifest is missing required fields (id, name, version)',
        severity: 'error'
      });
    }

    // Variable validation
    for (const variable of manifest.variables) {
      if (!variable.name || !variable.type) {
        errors.push({
          code: 'INVALID_VARIABLE',
          message: `Variable is missing required fields: ${variable.name || 'unnamed'}`,
          field: variable.name,
          severity: 'error'
        });
      }
    }

    // Security validation
    if (!manifest.security?.checksum) {
      warnings.push('Template has no security checksum - integrity cannot be verified');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Perform security scan on template
   */
  private async performSecurityScan(manifest: TemplateManifest): Promise<SecurityScanResult> {
    const violations: any[] = [];
    
    // Simple security checks
    for (const file of manifest.files) {
      // Check for suspicious patterns
      if (file.content?.includes('eval(') || file.content?.includes('Function(')) {
        violations.push({
          type: 'malicious-code',
          description: `Potentially dangerous code detected in ${file.path}`,
          file: file.path,
          severity: 'high'
        });
      }

      // Check for path traversal
      if (file.path.includes('..') || file.path.startsWith('/')) {
        violations.push({
          type: 'path-traversal',
          description: `Suspicious file path detected: ${file.path}`,
          file: file.path,
          severity: 'critical'
        });
      }
    }

    const criticalViolations = violations.filter(v => v.severity === 'critical');
    const highViolations = violations.filter(v => v.severity === 'high');

    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
    if (criticalViolations.length > 0) riskLevel = 'critical';
    else if (highViolations.length > 0) riskLevel = 'high';
    else if (violations.length > 0) riskLevel = 'medium';

    return {
      safe: criticalViolations.length === 0 && (this.options.securityLevel !== 'strict' || highViolations.length === 0),
      violations,
      riskLevel
    };
  }

  /**
   * Render template with variables
   */
  private async renderTemplate(
    manifest: TemplateManifest,
    variables: VariableMap,
    targetPath: string
  ): Promise<RenderedTemplate> {
    const files = new Map();
    const conflicts: any[] = [];
    const startTime = Date.now();

    // Simple template rendering (would be enhanced with proper template engine)
    for (const templateFile of manifest.files) {
      let content = templateFile.content || '';
      
      // Simple variable substitution
      for (const [key, value] of Object.entries(variables)) {
        const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
        content = content.replace(regex, String(value));
      }

      // Process path variables
      let filePath = templateFile.path;
      for (const [key, value] of Object.entries(variables)) {
        const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
        filePath = filePath.replace(regex, String(value));
      }

      files.set(filePath, {
        path: filePath,
        content,
        language: this.detectLanguage(filePath),
        size: content.length,
        checksum: this.calculateChecksum(content)
      });
    }

    return {
      files,
      conflicts,
      metadata: {
        templateId: manifest.id,
        templateVersion: manifest.version,
        renderedAt: new Date(),
        variables,
        performance: {
          parseTime: 0,
          renderTime: Date.now() - startTime,
          totalTime: Date.now() - startTime,
          memoryUsage: 0,
          filesGenerated: files.size,
          cacheHits: 0,
          cacheMisses: 0
        }
      },
      performance: {
        parseTime: 0,
        renderTime: Date.now() - startTime,
        totalTime: Date.now() - startTime,
        memoryUsage: 0,
        filesGenerated: files.size,
        cacheHits: 0,
        cacheMisses: 0
      }
    };
  }

  /**
   * Detect programming language from file extension
   */
  private detectLanguage(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const languageMap: Record<string, string> = {
      'ts': 'typescript',
      'tsx': 'typescript',
      'js': 'javascript',
      'jsx': 'javascript',
      'py': 'python',
      'java': 'java',
      'go': 'go',
      'rs': 'rust',
      'md': 'markdown',
      'json': 'json',
      'html': 'html',
      'css': 'css',
      'scss': 'scss'
    };
    return languageMap[ext || ''] || 'text';
  }

  /**
   * Calculate simple checksum for content
   */
  private calculateChecksum(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }
}

export default TemplateEngine;