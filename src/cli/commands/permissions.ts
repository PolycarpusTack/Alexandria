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
    console.log('\n📋 Alexandria Platform - Available Permissions\n');
    
    if (options.category) {
      const permissions = this.permissionValidator.getPermissionsByCategory(options.category);
      
      if (permissions.length === 0) {
        console.log(`❌ No permissions found in category "${options.category}"`);
        console.log(`\nAvailable categories: ${Array.from(this.permissionValidator.getPermissionCategories()).join(', ')}`);
        return;
      }
      
      console.log(`Category: ${options.category}`);
      console.log('─'.repeat(50));
      
      permissions.forEach(permission => {
        if (options.verbose) {
          const info = this.permissionValidator.getPermissionInfo(permission);
          console.log(`  ✓ ${permission}`);
          if (info?.description) {
            console.log(`    Description: ${info.description}`);
          }
          if (info?.riskLevel) {
            const riskIcons = {
              low: '🟢',
              medium: '🟡',
              high: '🟠',
              critical: '🔴'
            };
            console.log(`    Risk Level: ${riskIcons[info.riskLevel]} ${info.riskLevel}`);
          }
          console.log();
        } else {
          console.log(`  ✓ ${permission}`);
        }
      });
    } else {
      const allPermissions = this.permissionValidator.getAllPermissions();
      const categorized = this.permissionValidator.categorizePermissions(allPermissions);
      
      Object.entries(categorized).forEach(([category, perms]) => {
        console.log(`📁 ${category}:`);
        perms.forEach(permission => {
          if (options.verbose) {
            const info = this.permissionValidator.getPermissionInfo(permission);
            console.log(`  ✓ ${permission}`);
            if (info?.description) {
              console.log(`    ${info.description}`);
            }
            if (info?.riskLevel) {
              const riskIcons = {
                low: '🟢',
                medium: '🟡', 
                high: '🟠',
                critical: '🔴'
              };
              console.log(`    Risk: ${riskIcons[info.riskLevel]} ${info.riskLevel}`);
            }
          } else {
            console.log(`  ✓ ${permission}`);
          }
        });
        console.log();
      });
    }
    
    console.log(`\nTotal permissions: ${this.permissionValidator.getAllPermissions().length}`);
  }
  /**
   * Validate a plugin's permissions
   */
  public async validatePlugin(pluginPath: string): Promise<void> {
    console.log('\n🔍 Validating Plugin Permissions\n');
    
    try {
      const manifest = await this.loadPluginManifest(pluginPath);
      
      console.log(`Plugin: ${manifest.name} (${manifest.id})`);
      console.log(`Version: ${manifest.version}`);
      console.log('─'.repeat(50));
      
      const permissions = manifest.permissions || [];
      
      if (permissions.length === 0) {
        console.log('✅ No permissions requested');
        return;
      }
      
      console.log(`\nRequested permissions: ${permissions.length}`);
      permissions.forEach(p => console.log(`  • ${p}`));
      
      const result = this.permissionValidator.validatePluginPermissions(
        manifest.id,
        permissions
      );
      
      console.log('\n─── Validation Results ───');
      console.log(`Status: ${result.isValid ? '✅ VALID' : '❌ INVALID'}`);
      
      if (result.errors.length > 0) {
        console.log('\n❌ Errors:');
        result.errors.forEach(e => console.log(`  • ${e}`));
      }
      
      if (result.suggestions.length > 0) {
        console.log('\n💡 Suggestions:');
        result.suggestions.forEach(s => console.log(`  • ${s}`));
      }
      
      if (result.warnings.length > 0) {
        console.log('\n⚠️  Warnings:');
        result.warnings.forEach(w => console.log(`  • ${w}`));
      }
      
      // Show risk analysis
      this.showRiskAnalysis(permissions);
      
    } catch (error) {
      console.error(`\n❌ Error: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  }
  /**
   * Show risk analysis for permissions
   */
  private showRiskAnalysis(permissions: string[]): void {
    console.log('\n📊 Risk Analysis:');
    
    const riskCounts = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0
    };
    
    permissions.forEach(permission => {
      const info = this.permissionValidator.getPermissionInfo(permission);
      if (info?.riskLevel) {
        riskCounts[info.riskLevel]++;
      }
    });
    
    const riskScore = 
      riskCounts.low * 1 +
      riskCounts.medium * 5 +
      riskCounts.high * 10 +
      riskCounts.critical * 20;
    
    console.log(`  🟢 Low risk: ${riskCounts.low}`);
    console.log(`  🟡 Medium risk: ${riskCounts.medium}`);
    console.log(`  🟠 High risk: ${riskCounts.high}`);
    console.log(`  🔴 Critical risk: ${riskCounts.critical}`);
    console.log(`\n  Total Risk Score: ${riskScore}`);
    
    if (riskScore === 0) {
      console.log('  Assessment: ✅ Minimal risk');
    } else if (riskScore <= 10) {
      console.log('  Assessment: ✅ Low risk');
    } else if (riskScore <= 30) {
      console.log('  Assessment: ⚠️  Moderate risk');
    } else if (riskScore <= 50) {
      console.log('  Assessment: ⚠️  High risk - Review carefully');
    } else {
      console.log('  Assessment: ❌ Very high risk - Manual approval recommended');
    }
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
      throw new Error(`Invalid JSON in plugin manifest: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Search for similar permissions (helper command)
   */
  public async searchPermissions(searchTerm: string): Promise<void> {
    console.log(`\n🔍 Searching for permissions similar to: "${searchTerm}"\n`);
    
    const allPermissions = this.permissionValidator.getAllPermissions();
    const results: Array<{ permission: string; score: number }> = [];
    
    allPermissions.forEach(permission => {
      const score = this.calculateSimilarity(searchTerm.toLowerCase(), permission.toLowerCase());
      if (score > 0.3) { // Lower threshold for search
        results.push({ permission, score });
      }
    });
    
    if (results.length === 0) {
      console.log('No similar permissions found.');
      console.log('\nTry using a category name or partial permission name.');
      return;
    }
    
    // Sort by score
    results.sort((a, b) => b.score - a.score);
    
    console.log('Found similar permissions:');
    results.slice(0, 10).forEach(({ permission, score }) => {
      const info = this.permissionValidator.getPermissionInfo(permission);
      const percentage = Math.round(score * 100);
      console.log(`  ${percentage}% match: ${permission}`);
      if (info?.description) {
        console.log(`      ${info.description}`);
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