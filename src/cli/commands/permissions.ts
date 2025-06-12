/**
 * CLI Command for managing plugin permissions
 *
 * Provides commands to list available permissions, validate plugin manifests,
 * and get detailed information about permissions
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { EnhancedPermissionValidator } from '../../core/plugin-registry/permission-validator-enhanced';
import { AuthorizationService } from '../../core/security/interfaces';
import { PluginRegistry } from '../../core/plugin-registry/interfaces';
import { createLogger } from '../../utils/logger';

const logger = createLogger({ serviceName: 'permissions-cli' });

export class PermissionsCommand {
  private permissionValidator: EnhancedPermissionValidator;

  constructor(
    private authorizationService?: AuthorizationService,
    private pluginRegistry?: PluginRegistry
  ) {
    this.permissionValidator = new EnhancedPermissionValidator(
      authorizationService,
      pluginRegistry
    );
  }

  /**
   * List all available permissions
   */
  public async listPermissions(options: { category?: string; verbose?: boolean }): Promise<void> {
    logger.info('Listing permissions', { category: options.category, verbose: options.verbose });
    process.stdout.write('\n📋 Alexandria Platform - Available Permissions\n\n');

    if (options.category) {
      const permissions = this.permissionValidator.getPermissionsByCategory(options.category);

      if (permissions.length === 0) {
        logger.warn('No permissions found in category', { category: options.category });
        process.stdout.write(`❌ No permissions found in category "${options.category}"\n`);
        process.stdout.write(
          `\nAvailable categories: ${Array.from(this.permissionValidator.getPermissionCategories()).join(', ')}\n`
        );
        return;
      }

      process.stdout.write(`Category: ${options.category}\n`);
      process.stdout.write('─'.repeat(50) + '\n');

      permissions.forEach((permission) => {
        if (options.verbose) {
          const info = this.permissionValidator.getPermissionInfo(permission);
          process.stdout.write(`  ✓ ${permission}\n`);
          if (info?.description) {
            process.stdout.write(`    Description: ${info.description}\n`);
          }
          if (info?.riskLevel) {
            const riskIcons = {
              low: '🟢',
              medium: '🟡',
              high: '🟠',
              critical: '🔴'
            };
            process.stdout.write(
              `    Risk Level: ${riskIcons[info.riskLevel]} ${info.riskLevel}\n`
            );
          }
          process.stdout.write('\n');
        } else {
          process.stdout.write(`  ✓ ${permission}\n`);
        }
      });
    } else {
      const allPermissions = this.permissionValidator.getAllPermissions();
      const categorized = this.permissionValidator.categorizePermissions(allPermissions);

      Object.entries(categorized).forEach(([category, perms]) => {
        process.stdout.write(`📁 ${category}:\n`);
        perms.forEach((permission) => {
          if (options.verbose) {
            const info = this.permissionValidator.getPermissionInfo(permission);
            process.stdout.write(`  ✓ ${permission}\n`);
            if (info?.description) {
              process.stdout.write(`    ${info.description}\n`);
            }
            if (info?.riskLevel) {
              const riskIcons = {
                low: '🟢',
                medium: '🟡',
                high: '🟠',
                critical: '🔴'
              };
              process.stdout.write(`    Risk: ${riskIcons[info.riskLevel]} ${info.riskLevel}\n`);
            }
          } else {
            process.stdout.write(`  ✓ ${permission}\n`);
          }
        });
        process.stdout.write('\n');
      });
    }

    const totalCount = this.permissionValidator.getAllPermissions().length;
    logger.info('Listed permissions', { totalCount, category: options.category });
    process.stdout.write(`\nTotal permissions: ${totalCount}\n`);
  }
  /**
   * Validate a plugin's permissions
   */
  public async validatePlugin(pluginPath: string): Promise<void> {
    logger.info('Starting plugin validation', { pluginPath });
    process.stdout.write('\n🔍 Validating Plugin Permissions\n\n');

    try {
      const manifest = await this.loadPluginManifest(pluginPath);

      logger.info('Plugin manifest loaded', {
        name: manifest.name,
        id: manifest.id,
        version: manifest.version
      });
      process.stdout.write(`Plugin: ${manifest.name} (${manifest.id})\n`);
      process.stdout.write(`Version: ${manifest.version}\n`);
      process.stdout.write('─'.repeat(50) + '\n');

      const permissions = manifest.permissions || [];

      if (permissions.length === 0) {
        logger.info('Plugin validation complete - no permissions requested', {
          pluginId: manifest.id
        });
        process.stdout.write('✅ No permissions requested\n');
        return;
      }

      logger.info('Plugin permissions found', { permissionCount: permissions.length, permissions });
      process.stdout.write(`\nRequested permissions: ${permissions.length}\n`);
      permissions.forEach((p: string) => process.stdout.write(`  • ${p}\n`));

      const result = this.permissionValidator.validatePluginPermissions(manifest.id, permissions);

      logger.info('Plugin validation completed', {
        isValid: result.isValid,
        errorCount: result.errors.length,
        suggestionCount: result.suggestions.length,
        warningCount: result.warnings.length
      });
      process.stdout.write('\n─── Validation Results ───\n');
      process.stdout.write(`Status: ${result.isValid ? '✅ VALID' : '❌ INVALID'}\n`);

      if (result.errors.length > 0) {
        logger.error('Plugin validation errors found', { errors: result.errors });
        process.stdout.write('\n❌ Errors:\n');
        result.errors.forEach((e) => process.stdout.write(`  • ${e}\n`));
      }

      if (result.suggestions.length > 0) {
        logger.info('Plugin validation suggestions available', { suggestions: result.suggestions });
        process.stdout.write('\n💡 Suggestions:\n');
        result.suggestions.forEach((s) => process.stdout.write(`  • ${s}\n`));
      }

      if (result.warnings.length > 0) {
        logger.warn('Plugin validation warnings found', { warnings: result.warnings });
        process.stdout.write('\n⚠️  Warnings:\n');
        result.warnings.forEach((w) => process.stdout.write(`  • ${w}\n`));
      }

      // Show risk analysis
      this.showRiskAnalysis(permissions);
    } catch (error) {
      logger.error('Plugin validation failed', {
        error: error instanceof Error ? error.message : String(error),
        pluginPath
      });
      process.stderr.write(
        `\n❌ Error: ${error instanceof Error ? error.message : String(error)}\n`
      );
      process.exit(1);
    }
  }
  /**
   * Show risk analysis for permissions
   */
  private showRiskAnalysis(permissions: string[]): void {
    logger.info('Performing risk analysis', { permissionCount: permissions.length });
    process.stdout.write('\n📊 Risk Analysis:\n');

    const riskCounts = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0
    };

    permissions.forEach((permission) => {
      const info = this.permissionValidator.getPermissionInfo(permission);
      if (info?.riskLevel) {
        riskCounts[info.riskLevel]++;
      }
    });

    const riskScore =
      riskCounts.low * 1 + riskCounts.medium * 5 + riskCounts.high * 10 + riskCounts.critical * 20;

    logger.info('Risk analysis completed', { riskCounts, riskScore });
    process.stdout.write(`  🟢 Low risk: ${riskCounts.low}\n`);
    process.stdout.write(`  🟡 Medium risk: ${riskCounts.medium}\n`);
    process.stdout.write(`  🟠 High risk: ${riskCounts.high}\n`);
    process.stdout.write(`  🔴 Critical risk: ${riskCounts.critical}\n`);
    process.stdout.write(`\n  Total Risk Score: ${riskScore}\n`);

    let assessment: string;
    if (riskScore === 0) {
      assessment = '✅ Minimal risk';
    } else if (riskScore <= 10) {
      assessment = '✅ Low risk';
    } else if (riskScore <= 30) {
      assessment = '⚠️  Moderate risk';
    } else if (riskScore <= 50) {
      assessment = '⚠️  High risk - Review carefully';
    } else {
      assessment = '❌ Very high risk - Manual approval recommended';
    }

    logger.info('Risk assessment completed', {
      assessment: assessment.replace(/[✅⚠️❌]\s*/, ''),
      riskScore
    });
    process.stdout.write(`  Assessment: ${assessment}\n`);
  }
  /**
   * Load plugin manifest from file
   */
  private async loadPluginManifest(pluginPath: string): Promise<any> {
    let manifestPath: string;

    // Check if pluginPath is a directory or file
    const stats = await fs.stat(pluginPath);

    if (stats.isDirectory()) {
      manifestPath = path.join(pluginPath, 'plugin.json');
    } else if (pluginPath.endsWith('.json')) {
      manifestPath = pluginPath;
    } else {
      throw new Error('Invalid plugin path. Must be a directory or a plugin.json file.');
    }

    // Check if manifest exists
    try {
      await fs.access(manifestPath);
    } catch {
      throw new Error(`Plugin manifest not found at: ${manifestPath}`);
    }

    // Read and parse manifest
    const manifestContent = await fs.readFile(manifestPath, 'utf-8');

    try {
      return JSON.parse(manifestContent);
    } catch (error) {
      throw new Error(
        `Invalid JSON in plugin manifest: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Search for similar permissions (helper command)
   */
  public async searchPermissions(searchTerm: string): Promise<void> {
    logger.info('Searching permissions', { searchTerm });
    process.stdout.write(`\n🔍 Searching for permissions similar to: "${searchTerm}"\n\n`);

    const allPermissions = this.permissionValidator.getAllPermissions();
    const results: Array<{ permission: string; score: number }> = [];

    allPermissions.forEach((permission) => {
      const score = this.calculateSimilarity(searchTerm.toLowerCase(), permission.toLowerCase());
      if (score > 0.3) {
        // Lower threshold for search
        results.push({ permission, score });
      }
    });

    if (results.length === 0) {
      logger.info('No similar permissions found', { searchTerm });
      process.stdout.write('No similar permissions found.\n');
      process.stdout.write('\nTry using a category name or partial permission name.\n');
      return;
    }

    // Sort by score
    results.sort((a, b) => b.score - a.score);

    logger.info('Search completed', { searchTerm, resultCount: results.length });
    process.stdout.write('Found similar permissions:\n');
    results.slice(0, 10).forEach(({ permission, score }) => {
      const info = this.permissionValidator.getPermissionInfo(permission);
      const percentage = Math.round(score * 100);
      process.stdout.write(`  ${percentage}% match: ${permission}\n`);
      if (info?.description) {
        process.stdout.write(`      ${info.description}\n`);
      }
    });
  }

  /**
   * Calculate string similarity (copied from validator for standalone use)
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Levenshtein distance implementation
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }
}
