/**
 * Template Integrity Validator
 * 
 * Validates template integrity through checksum verification and security scanning
 * Detects secrets, vulnerabilities, and malicious code patterns
 */

import { Logger } from '../../../../../utils/logger';
import { TemplateManifest, SecurityScanResult, SecurityViolation, ValidationResult, ValidationError } from './interfaces';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface IntegrityCheckResult {
  valid: boolean;
  checksumValid: boolean;
  securityScan: SecurityScanResult;
  errors: ValidationError[];
  warnings: string[];
}

export interface ScanOptions {
  enableSecretScanning: boolean;
  enableVulnerabilityCheck: boolean;
  enableMaliciousCodeDetection: boolean;
  maxFileSize: number; // bytes
  allowedFileTypes: string[];
}

export class TemplateIntegrityValidator {
  private logger: Logger;
  private defaultOptions: Required<ScanOptions>;

  // Known secret patterns (basic implementation - real world would use more sophisticated detection)
  private secretPatterns = [
    { name: 'AWS Access Key', pattern: /AKIA[0-9A-Z]{16}/, severity: 'critical' as const },
    { name: 'AWS Secret Key', pattern: /[A-Za-z0-9/+=]{40}/, severity: 'critical' as const },
    { name: 'GitHub Token', pattern: /gh[ps]_[A-Za-z0-9]{36}/, severity: 'critical' as const },
    { name: 'Slack Token', pattern: /xox[baprs]-([0-9a-zA-Z]{10,48})/, severity: 'high' as const },
    { name: 'Generic API Key', pattern: /api[_-]?key["\s]*[:=]["\s]*[a-zA-Z0-9]{16,}/, severity: 'high' as const },
    { name: 'JWT Token', pattern: /eyJ[A-Za-z0-9_-]*\.eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*/, severity: 'medium' as const },
    { name: 'Private Key', pattern: /-----BEGIN [A-Z]+ PRIVATE KEY-----/, severity: 'critical' as const },
    { name: 'Database URL', pattern: /(mongodb|mysql|postgres):\/\/[^\s]+/, severity: 'high' as const },
    { name: 'Email/Password', pattern: /(password|passwd|pwd)["\s]*[:=]["\s]*[^\s"]+/, severity: 'medium' as const }
  ];

  // Malicious code patterns
  private maliciousPatterns = [
    { name: 'eval() usage', pattern: /eval\s*\(/, severity: 'high' as const },
    { name: 'Function constructor', pattern: /new\s+Function\s*\(/, severity: 'high' as const },
    { name: 'setTimeout with string', pattern: /setTimeout\s*\(\s*["'`]/, severity: 'medium' as const },
    { name: 'Child process execution', pattern: /(exec|spawn|execSync)\s*\(/, severity: 'high' as const },
    { name: 'File system write', pattern: /(writeFile|writeFileSync|createWriteStream)\s*\(/, severity: 'medium' as const },
    { name: 'Network requests', pattern: /(fetch|XMLHttpRequest|axios\.get|request\()/g, severity: 'medium' as const },
    { name: 'Script injection', pattern: /<script[^>]*>[\s\S]*?<\/script>/gi, severity: 'high' as const },
    { name: 'SQL injection patterns', pattern: /(union|select|insert|delete|drop)\s+(select|from|table|database)/gi, severity: 'high' as const },
    { name: 'Path traversal', pattern: /\.\.[\/\\]/, severity: 'high' as const },
    { name: 'Backdoor patterns', pattern: /(backdoor|malware|trojan|virus)/gi, severity: 'critical' as const }
  ];

  // Known vulnerable dependencies (simplified - real implementation would use CVE database)
  private vulnerableDependencies = new Map([
    ['lodash', { versions: ['<4.17.12'], cve: 'CVE-2019-10744', severity: 'high' as const }],
    ['express', { versions: ['<4.17.1'], cve: 'CVE-2019-5413', severity: 'medium' as const }],
    ['axios', { versions: ['<0.21.1'], cve: 'CVE-2020-28168', severity: 'medium' as const }],
    ['moment', { versions: ['<2.29.2'], cve: 'CVE-2022-24785', severity: 'high' as const }],
    ['handlebars', { versions: ['<4.7.7'], cve: 'CVE-2021-23383', severity: 'high' as const }]
  ]);

  constructor(logger: Logger, options: Partial<ScanOptions> = {}) {
    this.logger = logger;
    this.defaultOptions = {
      enableSecretScanning: options.enableSecretScanning ?? true,
      enableVulnerabilityCheck: options.enableVulnerabilityCheck ?? true,
      enableMaliciousCodeDetection: options.enableMaliciousCodeDetection ?? true,
      maxFileSize: options.maxFileSize ?? 10 * 1024 * 1024, // 10MB
      allowedFileTypes: options.allowedFileTypes ?? [
        '.js', '.ts', '.tsx', '.jsx', '.json', '.md', '.txt', '.yml', '.yaml',
        '.css', '.scss', '.sass', '.html', '.hbs', '.mustache', '.py', '.go',
        '.rs', '.java', '.c', '.cpp', '.h', '.sh', '.bat', '.ps1', '.dockerfile'
      ]
    };
  }

  /**
   * Validate template integrity comprehensively
   */
  async validateTemplate(
    templatePath: string, 
    manifest: TemplateManifest,
    options: Partial<ScanOptions> = {}
  ): Promise<IntegrityCheckResult> {
    const scanOptions = { ...this.defaultOptions, ...options };
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    this.logger.info('Starting template integrity validation', { 
      templatePath, 
      templateId: manifest.id 
    });

    try {
      // 1. Verify template directory exists
      await fs.access(templatePath);

      // 2. Validate checksum if provided
      const checksumValid = await this.validateChecksum(templatePath, manifest, errors);

      // 3. Perform security scanning
      const securityScan = await this.performSecurityScan(
        templatePath, 
        manifest, 
        scanOptions, 
        errors, 
        warnings
      );

      // 4. Validate file structure
      await this.validateFileStructure(templatePath, manifest, errors, warnings);

      const result: IntegrityCheckResult = {
        valid: errors.length === 0,
        checksumValid,
        securityScan,
        errors,
        warnings
      };

      this.logger.info('Template integrity validation completed', {
        templateId: manifest.id,
        valid: result.valid,
        riskLevel: securityScan.riskLevel,
        violations: securityScan.violations.length
      });

      return result;

    } catch (error) {
      errors.push({
        code: 'VALIDATION_ERROR',
        message: `Template validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'error'
      });

      return {
        valid: false,
        checksumValid: false,
        securityScan: {
          safe: false,
          violations: [],
          riskLevel: 'critical'
        },
        errors,
        warnings
      };
    }
  }

  /**
   * Validate template checksum
   */
  private async validateChecksum(
    templatePath: string, 
    manifest: TemplateManifest, 
    errors: ValidationError[]
  ): Promise<boolean> {
    if (!manifest.security.checksum) {
      errors.push({
        code: 'MISSING_CHECKSUM',
        message: 'Template manifest missing security checksum',
        severity: 'error'
      });
      return false;
    }

    try {
      const calculatedChecksum = await this.calculateDirectoryChecksum(templatePath);
      const expectedChecksum = manifest.security.checksum;

      if (calculatedChecksum !== expectedChecksum) {
        errors.push({
          code: 'CHECKSUM_MISMATCH',
          message: `Template checksum mismatch. Expected: ${expectedChecksum}, Got: ${calculatedChecksum}`,
          severity: 'error'
        });
        return false;
      }

      this.logger.debug('Template checksum validation passed', { 
        templateId: manifest.id,
        checksum: calculatedChecksum
      });
      return true;

    } catch (error) {
      errors.push({
        code: 'CHECKSUM_ERROR',
        message: `Failed to validate checksum: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'error'
      });
      return false;
    }
  }

  /**
   * Calculate checksum for entire directory
   */
  async calculateDirectoryChecksum(dirPath: string): Promise<string> {
    const hash = crypto.createHash('sha256');
    
    async function processDirectory(currentPath: string): Promise<void> {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });
      
      // Sort entries for consistent hashing
      entries.sort((a, b) => a.name.localeCompare(b.name));

      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);
        const relativePath = path.relative(dirPath, fullPath);

        // Hash the relative path
        hash.update(relativePath);

        if (entry.isFile()) {
          // Hash file content
          const content = await fs.readFile(fullPath);
          hash.update(content);
        } else if (entry.isDirectory()) {
          // Recursively process subdirectories
          await processDirectory(fullPath);
        }
      }
    }

    await processDirectory(dirPath);
    return hash.digest('hex');
  }

  /**
   * Perform comprehensive security scanning
   */
  private async performSecurityScan(
    templatePath: string,
    manifest: TemplateManifest,
    options: Required<ScanOptions>,
    errors: ValidationError[],
    warnings: string[]
  ): Promise<SecurityScanResult> {
    const violations: SecurityViolation[] = [];

    try {
      // 1. Scan for secrets in all template files
      if (options.enableSecretScanning) {
        await this.scanForSecrets(templatePath, violations, options);
      }

      // 2. Check for vulnerable dependencies
      if (options.enableVulnerabilityCheck) {
        await this.scanForVulnerabilities(templatePath, violations);
      }

      // 3. Detect malicious code patterns
      if (options.enableMaliciousCodeDetection) {
        await this.scanForMaliciousCode(templatePath, violations, options);
      }

      // 4. Validate template manifest security
      this.validateManifestSecurity(manifest, violations);

      // Calculate overall risk level
      const riskLevel = this.calculateRiskLevel(violations);

      return {
        safe: violations.length === 0,
        violations,
        riskLevel
      };

    } catch (error) {
      this.logger.error('Security scan failed', { templatePath, error });
      
      violations.push({
        type: 'malicious-code',
        description: `Security scan failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'critical'
      });

      return {
        safe: false,
        violations,
        riskLevel: 'critical'
      };
    }
  }

  /**
   * Scan for secrets in template files
   */
  private async scanForSecrets(
    templatePath: string,
    violations: SecurityViolation[],
    options: Required<ScanOptions>
  ): Promise<void> {
    await this.scanDirectory(templatePath, async (filePath: string, content: string) => {
      // Skip binary files and overly large files
      if (content.length > options.maxFileSize) return;
      
      const relativePath = path.relative(templatePath, filePath);
      const lines = content.split('\n');

      for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex];
        
        for (const pattern of this.secretPatterns) {
          if (pattern.pattern.test(line)) {
            violations.push({
              type: 'secret',
              description: `Potential ${pattern.name} detected`,
              file: relativePath,
              line: lineIndex + 1,
              severity: pattern.severity
            });
          }
        }
      }
    }, options);
  }

  /**
   * Scan for vulnerable dependencies
   */
  private async scanForVulnerabilities(
    templatePath: string,
    violations: SecurityViolation[]
  ): Promise<void> {
    const packageJsonPath = path.join(templatePath, 'package.json');
    const requirementsPath = path.join(templatePath, 'requirements.txt');

    try {
      // Check package.json
      await fs.access(packageJsonPath);
      const packageContent = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(packageContent);
      
      this.checkDependencies(packageJson.dependencies || {}, violations, 'package.json');
      this.checkDependencies(packageJson.devDependencies || {}, violations, 'package.json');

    } catch {
      // package.json doesn't exist or is invalid - not an error
    }

    try {
      // Check requirements.txt
      await fs.access(requirementsPath);
      const reqContent = await fs.readFile(requirementsPath, 'utf-8');
      this.checkPythonRequirements(reqContent, violations);

    } catch {
      // requirements.txt doesn't exist - not an error
    }
  }

  /**
   * Check JavaScript/Node.js dependencies for vulnerabilities
   */
  private checkDependencies(
    dependencies: Record<string, string>,
    violations: SecurityViolation[],
    fileName: string
  ): void {
    for (const [name, version] of Object.entries(dependencies)) {
      const vulnerability = this.vulnerableDependencies.get(name);
      if (vulnerability) {
        // Simple version check (real implementation would use semver)
        const cleanVersion = version.replace(/[\^~>=<]/, '');
        violations.push({
          type: 'vulnerability',
          description: `Vulnerable dependency: ${name}@${version} (${vulnerability.cve})`,
          file: fileName,
          severity: vulnerability.severity
        });
      }
    }
  }

  /**
   * Check Python requirements for vulnerabilities
   */
  private checkPythonRequirements(content: string, violations: SecurityViolation[]): void {
    const lines = content.split('\n');
    
    for (const line of lines) {
      if (line.trim() && !line.startsWith('#')) {
        // Basic parsing - real implementation would be more sophisticated
        const match = line.match(/^([a-zA-Z0-9-_]+)([>=<~!]+)?(.+)?$/);
        if (match) {
          const packageName = match[1];
          // Add specific Python vulnerability checks here
          if (packageName === 'django' || packageName === 'flask') {
            violations.push({
              type: 'vulnerability',
              description: `Consider checking ${packageName} version for known vulnerabilities`,
              file: 'requirements.txt',
              severity: 'medium'
            });
          }
        }
      }
    }
  }

  /**
   * Scan for malicious code patterns
   */
  private async scanForMaliciousCode(
    templatePath: string,
    violations: SecurityViolation[],
    options: Required<ScanOptions>
  ): Promise<void> {
    await this.scanDirectory(templatePath, async (filePath: string, content: string) => {
      if (content.length > options.maxFileSize) return;
      
      const relativePath = path.relative(templatePath, filePath);
      const lines = content.split('\n');

      for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex];
        
        for (const pattern of this.maliciousPatterns) {
          const matches = line.match(pattern.pattern);
          if (matches) {
            violations.push({
              type: 'malicious-code',
              description: `Potentially dangerous pattern: ${pattern.name}`,
              file: relativePath,
              line: lineIndex + 1,
              severity: pattern.severity
            });
          }
        }
      }
    }, options);
  }

  /**
   * Validate manifest security settings
   */
  private validateManifestSecurity(
    manifest: TemplateManifest,
    violations: SecurityViolation[]
  ): void {
    // Check for missing security fields
    if (!manifest.security.checksum) {
      violations.push({
        type: 'malicious-code',
        description: 'Template manifest missing required checksum',
        severity: 'high'
      });
    }

    // Check template limits
    if (!manifest.limits || manifest.limits.maxFiles > 1000) {
      violations.push({
        type: 'malicious-code',
        description: 'Template allows too many files (potential DoS)',
        severity: 'medium'
      });
    }

    // Check allowed paths
    if (!manifest.limits?.allowedPaths || manifest.limits.allowedPaths.length === 0) {
      violations.push({
        type: 'path-traversal',
        description: 'Template has no path restrictions (potential directory traversal)',
        severity: 'high'
      });
    }
  }

  /**
   * Validate file structure against manifest
   */
  private async validateFileStructure(
    templatePath: string,
    manifest: TemplateManifest,
    errors: ValidationError[],
    warnings: string[]
  ): Promise<void> {
    try {
      // Check that all declared template files exist
      for (const templateFile of manifest.files) {
        const filePath = path.join(templatePath, templateFile.template);
        try {
          await fs.access(filePath);
        } catch {
          errors.push({
            code: 'MISSING_TEMPLATE_FILE',
            message: `Template file not found: ${templateFile.template}`,
            field: 'files',
            severity: 'error'
          });
        }
      }

      // Check for unexpected files
      const declaredFiles = new Set(manifest.files.map(f => f.template));
      await this.scanDirectory(templatePath, async (filePath: string) => {
        const relativePath = path.relative(templatePath, filePath);
        if (!declaredFiles.has(relativePath) && !relativePath.startsWith('.') && relativePath !== 'manifest.json') {
          warnings.push(`Undeclared template file found: ${relativePath}`);
        }
      }, this.defaultOptions);

    } catch (error) {
      errors.push({
        code: 'FILE_STRUCTURE_ERROR',
        message: `Failed to validate file structure: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'error'
      });
    }
  }

  /**
   * Scan directory recursively with file processor
   */
  private async scanDirectory(
    dirPath: string,
    processor: (filePath: string, content: string) => Promise<void>,
    options: Required<ScanOptions>
  ): Promise<void> {
    async function scanRecursive(currentPath: string): Promise<void> {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);

        if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          
          if (options.allowedFileTypes.includes(ext) || options.allowedFileTypes.includes('*')) {
            try {
              const stats = await fs.stat(fullPath);
              if (stats.size <= options.maxFileSize) {
                const content = await fs.readFile(fullPath, 'utf-8');
                await processor(fullPath, content);
              }
            } catch (error) {
              // Skip files we can't read (binary, permissions, etc.)
            }
          }
        } else if (entry.isDirectory() && !entry.name.startsWith('.')) {
          await scanRecursive(fullPath);
        }
      }
    }

    await scanRecursive(dirPath);
  }

  /**
   * Calculate overall risk level based on violations
   */
  private calculateRiskLevel(violations: SecurityViolation[]): 'low' | 'medium' | 'high' | 'critical' {
    if (violations.length === 0) return 'low';

    const severityCounts = {
      critical: violations.filter(v => v.severity === 'critical').length,
      high: violations.filter(v => v.severity === 'high').length,
      medium: violations.filter(v => v.severity === 'medium').length,
      low: violations.filter(v => v.severity === 'low').length
    };

    if (severityCounts.critical > 0) return 'critical';
    if (severityCounts.high > 2) return 'critical';
    if (severityCounts.high > 0) return 'high';
    if (severityCounts.medium > 5) return 'high';
    if (severityCounts.medium > 0) return 'medium';
    return 'low';
  }

  /**
   * Generate security report
   */
  generateSecurityReport(result: IntegrityCheckResult): string {
    const report = [];
    
    report.push('# Template Security Report\n');
    report.push(`**Overall Status**: ${result.valid ? '✅ PASS' : '❌ FAIL'}`);
    report.push(`**Risk Level**: ${result.securityScan.riskLevel.toUpperCase()}`);
    report.push(`**Checksum Valid**: ${result.checksumValid ? '✅' : '❌'}\n`);

    if (result.securityScan.violations.length > 0) {
      report.push('## Security Violations\n');
      
      for (const violation of result.securityScan.violations) {
        const icon = this.getSeverityIcon(violation.severity);
        report.push(`${icon} **${violation.type}**: ${violation.description}`);
        if (violation.file) {
          report.push(`  - File: ${violation.file}${violation.line ? `:${violation.line}` : ''}`);
        }
        report.push('');
      }
    }

    if (result.errors.length > 0) {
      report.push('## Errors\n');
      for (const error of result.errors) {
        report.push(`❌ **${error.code}**: ${error.message}`);
      }
      report.push('');
    }

    if (result.warnings.length > 0) {
      report.push('## Warnings\n');
      for (const warning of result.warnings) {
        report.push(`⚠️ ${warning}`);
      }
    }

    return report.join('\n');
  }

  /**
   * Get severity icon
   */
  private getSeverityIcon(severity: string): string {
    switch (severity) {
      case 'critical': return '🚨';
      case 'high': return '❌';
      case 'medium': return '⚠️';
      case 'low': return 'ℹ️';
      default: return '❓';
    }
  }
}