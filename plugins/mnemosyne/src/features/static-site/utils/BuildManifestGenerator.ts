/**
 * Build Manifest Generator - Generates build manifest with metadata
 */

import { 
  BuildManifest,
  GeneratedPage,
  GeneratedAsset,
  StaticSiteOptions
} from '../core/types';
import { createHash } from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';

export class BuildManifestGenerator {
  /**
   * Generate build manifest
   */
  generate(
    pages: GeneratedPage[],
    assets: GeneratedAsset[],
    buildStartTime: number,
    options: StaticSiteOptions
  ): BuildManifest {
    const manifest: BuildManifest = {
      buildId: this.generateBuildId(),
      timestamp: new Date(),
      totalPages: pages.length,
      totalAssets: assets.length,
      totalSize: this.calculateTotalSize(pages, assets),
      buildTime: Date.now() - buildStartTime,
      version: this.getVersion(),
      dependencies: this.extractDependencies()
    };
    
    // Write manifest to file
    this.writeManifest(manifest, options);
    
    return manifest;
  }

  /**
   * Generate unique build ID
   */
  private generateBuildId(): string {
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2, 9);
    const hash = createHash('sha256')
      .update(timestamp + random)
      .digest('hex')
      .substring(0, 8);
    
    return `build-${hash}`;
  }

  /**
   * Calculate total size of all generated files
   */
  private calculateTotalSize(
    pages: GeneratedPage[],
    assets: GeneratedAsset[]
  ): number {
    const pageSize = pages.reduce((sum, page) => sum + page.size, 0);
    const assetSize = assets.reduce((sum, asset) => sum + asset.size, 0);
    
    return pageSize + assetSize;
  }

  /**
   * Get version from package.json
   */
  private getVersion(): string {
    try {
      // Try to read package.json
      const packagePath = path.join(process.cwd(), 'package.json');
      const packageJson = require(packagePath);
      return packageJson.version || '1.0.0';
    } catch {
      return '1.0.0';
    }
  }

  /**
   * Extract dependencies from package.json
   */
  private extractDependencies(): Record<string, string> {
    try {
      const packagePath = path.join(process.cwd(), 'package.json');
      const packageJson = require(packagePath);
      
      // Extract relevant dependencies for the static site
      const relevantDeps = [
        'marked',
        'jsdom',
        'csso',
        'terser',
        'sharp',
        'lunr',
        'fuse.js',
        'elasticlunr'
      ];
      
      const dependencies: Record<string, string> = {};
      
      if (packageJson.dependencies) {
        relevantDeps.forEach(dep => {
          if (packageJson.dependencies[dep]) {
            dependencies[dep] = packageJson.dependencies[dep];
          }
        });
      }
      
      return dependencies;
    } catch {
      return {};
    }
  }

  /**
   * Write manifest to file
   */
  private async writeManifest(
    manifest: BuildManifest,
    options: StaticSiteOptions
  ): Promise<void> {
    const manifestPath = path.join(options.outputDir, 'build-manifest.json');
    const manifestJson = JSON.stringify(manifest, null, 2);
    
    await fs.writeFile(manifestPath, manifestJson, 'utf8');
    
    // Also create a simple version file
    const versionPath = path.join(options.outputDir, 'version.txt');
    const versionInfo = `Build ID: ${manifest.buildId}
Version: ${manifest.version}
Built: ${manifest.timestamp.toISOString()}
Pages: ${manifest.totalPages}
Assets: ${manifest.totalAssets}
Size: ${this.formatBytes(manifest.totalSize)}
Time: ${this.formatDuration(manifest.buildTime)}`;
    
    await fs.writeFile(versionPath, versionInfo, 'utf8');
  }

  /**
   * Format bytes for display
   */
  private formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let value = bytes;
    let unitIndex = 0;
    
    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex++;
    }
    
    return `${value.toFixed(1)} ${units[unitIndex]}`;
  }

  /**
   * Format duration for display
   */
  private formatDuration(ms: number): string {
    if (ms < 1000) {
      return `${ms}ms`;
    } else if (ms < 60000) {
      return `${(ms / 1000).toFixed(1)}s`;
    } else {
      const minutes = Math.floor(ms / 60000);
      const seconds = ((ms % 60000) / 1000).toFixed(0);
      return `${minutes}m ${seconds}s`;
    }
  }
}