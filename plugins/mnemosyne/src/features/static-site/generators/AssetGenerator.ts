/**
 * Asset Generator - Backward Compatibility Wrapper
 * This file maintains backward compatibility by delegating to the new modular asset system
 */

import { 
  StaticSiteOptions,
  SiteConfiguration,
  GeneratedAsset,
  GeneratedPage
} from '../core/types';
import { AssetManager, AssetOptions, PWAConfig } from './assets';

export class AssetGenerator {
  private assetManager: AssetManager;
  
  constructor() {
    this.assetManager = new AssetManager();
  }

  /**
   * Generate all assets for the site
   * Delegates to the new AssetManager
   */
  async generateAssets(
    config: SiteConfiguration,
    options: StaticSiteOptions,
    pages: GeneratedPage[]
  ): Promise<GeneratedAsset[]> {
    // Convert options to new format
    const assetOptions: AssetOptions = {
      minify: options.minifyAssets,
      generateSourceMaps: options.generateSourceMaps,
      addHashes: options.useContentHashes,
      customCSS: options.customCSS,
      customJS: options.customJS,
      optimizeImages: options.optimizeImages,
      imageFormats: ['webp', 'jpg'],
      imageQuality: 85,
      analyticsId: options.analyticsId,
      includeKnowledgeGraph: options.includeKnowledgeGraph
    };

    // Convert PWA config if enabled
    let pwaConfig: PWAConfig | undefined;
    if (options.generatePWA) {
      pwaConfig = {
        name: config.title,
        shortName: config.title.substring(0, 12),
        description: config.description || '',
        startUrl: '/',
        display: 'standalone',
        themeColor: '#000000',
        backgroundColor: '#ffffff',
        icons: []
      };
    }

    // Generate assets using new system
    const assetMetadata = await this.assetManager.generateAllAssets(
      options.outputPath,
      assetOptions,
      {
        theme: config.theme,
        siteName: config.title,
        pwa: pwaConfig
      }
    );

    // Convert to legacy format
    const assets: GeneratedAsset[] = [];
    
    for (const [path, metadata] of assetMetadata) {
      assets.push({
        path: path.replace(options.outputPath + '/', ''),
        content: '', // Content is already written to disk
        type: this.getAssetType(path),
        hash: metadata.hash
      });
    }

    // Generate search index for pages
    if (options.generateSearch) {
      const searchIndex = this.generateSearchIndex(pages);
      assets.push({
        path: 'search-index.json',
        content: JSON.stringify(searchIndex),
        type: 'json'
      });
    }

    // Generate graph data if requested
    if (options.includeKnowledgeGraph) {
      const graphData = await this.generateGraphData(pages);
      assets.push({
        path: 'graph-data.json',
        content: JSON.stringify(graphData),
        type: 'json'
      });
    }

    return assets;
  }

  /**
   * Generate search index for pages
   */
  private generateSearchIndex(pages: GeneratedPage[]): Array<{
    id: string;
    title: string;
    content: string;
    url: string;
    tags: string[];
    excerpt: string;
  }> {
    return pages.map(page => ({
      id: page.id,
      title: page.title,
      content: this.stripHtml(page.content).substring(0, 1000),
      url: page.url,
      tags: page.metadata.tags || [],
      excerpt: page.metadata.excerpt || this.stripHtml(page.content).substring(0, 200)
    }));
  }

  /**
   * Generate knowledge graph data
   */
  private async generateGraphData(pages: GeneratedPage[]): Promise<{
    nodes: Array<{ id: string; label: string; type: string }>;
    links: Array<{ source: number; target: number; type: string }>;
  }> {
    const nodes = pages.map((page, index) => ({
      id: page.id,
      label: page.title,
      type: page.metadata.type || 'document'
    }));

    // Simple link generation based on tags
    const links: Array<{ source: number; target: number; type: string }> = [];
    
    for (let i = 0; i < pages.length; i++) {
      for (let j = i + 1; j < pages.length; j++) {
        const sharedTags = this.getSharedTags(
          pages[i].metadata.tags || [],
          pages[j].metadata.tags || []
        );
        
        if (sharedTags.length > 0) {
          links.push({
            source: i,
            target: j,
            type: 'related'
          });
        }
      }
    }

    return { nodes, links };
  }

  /**
   * Get shared tags between two arrays
   */
  private getSharedTags(tags1: string[], tags2: string[]): string[] {
    return tags1.filter(tag => tags2.includes(tag));
  }

  /**
   * Strip HTML from content
   */
  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').trim();
  }

  /**
   * Determine asset type from path
   */
  private getAssetType(path: string): string {
    const ext = path.split('.').pop()?.toLowerCase();
    
    const typeMap: Record<string, string> = {
      'css': 'css',
      'js': 'javascript',
      'json': 'json',
      'png': 'image',
      'jpg': 'image',
      'jpeg': 'image',
      'webp': 'image',
      'svg': 'image',
      'woff': 'font',
      'woff2': 'font',
      'ttf': 'font',
      'html': 'html'
    };

    return typeMap[ext || ''] || 'unknown';
  }
}

// Re-export types for backward compatibility
export * from './assets/types';