/**
 * Asset Manager
 * Coordinates all asset generation and manages caching
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { createHash } from 'crypto';
import { 
  AssetOptions, 
  AssetCacheEntry, 
  AssetMetadata,
  CSSAssetConfig,
  JSAssetConfig,
  ImageProcessingOptions,
  PWAConfig
} from './types';
import { CSSGenerator } from './CSSGenerator';
import { JSGenerator } from './JSGenerator';
import { ImageProcessor } from './ImageProcessor';
import { PWAGenerator } from './PWAGenerator';
import { FontManager } from './FontManager';

export class AssetManager {
  private cssGenerator: CSSGenerator;
  private jsGenerator: JSGenerator;
  private imageProcessor: ImageProcessor;
  private pwaGenerator: PWAGenerator;
  private fontManager: FontManager;
  private assetCache: Map<string, AssetCacheEntry>;

  constructor() {
    this.cssGenerator = new CSSGenerator();
    this.jsGenerator = new JSGenerator();
    this.imageProcessor = new ImageProcessor();
    this.pwaGenerator = new PWAGenerator();
    this.fontManager = new FontManager();
    this.assetCache = new Map();
  }

  /**
   * Generate all assets for the static site
   */
  async generateAllAssets(
    outputDir: string,
    options: AssetOptions,
    config: {
      theme: string;
      siteName: string;
      pwa?: PWAConfig;
    }
  ): Promise<Map<string, AssetMetadata>> {
    const assetMetadata = new Map<string, AssetMetadata>();

    // Ensure output directories exist
    await this.ensureDirectories(outputDir);

    // Generate CSS assets
    const cssMetadata = await this.generateCSSAssets(outputDir, options, config.theme);
    cssMetadata.forEach((meta, path) => assetMetadata.set(path, meta));

    // Generate JavaScript assets
    const jsMetadata = await this.generateJSAssets(outputDir, options);
    jsMetadata.forEach((meta, path) => assetMetadata.set(path, meta));

    // Process images if needed
    if (options.optimizeImages) {
      const imageMetadata = await this.processImages(outputDir, options);
      imageMetadata.forEach((meta, path) => assetMetadata.set(path, meta));
    }

    // Generate PWA assets if enabled
    if (config.pwa) {
      const pwaMetadata = await this.generatePWAAssets(outputDir, config.pwa);
      pwaMetadata.forEach((meta, path) => assetMetadata.set(path, meta));
    }

    // Copy fonts
    const fontMetadata = await this.copyFonts(outputDir);
    fontMetadata.forEach((meta, path) => assetMetadata.set(path, meta));

    return assetMetadata;
  }

  /**
   * Generate CSS assets
   */
  private async generateCSSAssets(
    outputDir: string,
    options: AssetOptions,
    theme: string
  ): Promise<Map<string, AssetMetadata>> {
    const metadata = new Map<string, AssetMetadata>();
    const cssDir = path.join(outputDir, 'assets', 'css');

    const config: CSSAssetConfig = {
      theme,
      customCSS: options.customCSS,
      includePrintStyles: true,
      includeResetStyles: true
    };

    // Generate main CSS
    let css = await this.cssGenerator.generateCSS(config);
    
    // Minify if requested
    if (options.minify) {
      css = await this.cssGenerator.minifyCSS(css);
    }

    // Add hash if requested
    const filename = options.addHashes 
      ? `theme-${this.generateHash(css)}.css`
      : 'theme.css';
    
    const cssPath = path.join(cssDir, filename);
    await fs.writeFile(cssPath, css);

    metadata.set(cssPath, {
      processedAt: new Date(),
      size: Buffer.byteLength(css),
      hash: this.generateHash(css),
      mimeType: 'text/css'
    });

    return metadata;
  }

  /**
   * Generate JavaScript assets
   */
  private async generateJSAssets(
    outputDir: string,
    options: AssetOptions
  ): Promise<Map<string, AssetMetadata>> {
    const metadata = new Map<string, AssetMetadata>();
    const jsDir = path.join(outputDir, 'assets', 'js');

    const config: JSAssetConfig = {
      includeSearch: true,
      includeNavigation: true,
      includeAnalytics: !!options.analyticsId,
      analyticsId: options.analyticsId,
      includeGraph: options.includeKnowledgeGraph,
      customJS: options.customJS,
      moduleFormat: 'iife'
    };

    // Generate main JavaScript
    let js = await this.jsGenerator.generateJS(config);
    
    // Minify if requested
    if (options.minify) {
      const result = await this.jsGenerator.minifyJS(js, options.generateSourceMaps);
      js = result.code;
      
      // Save source map if generated
      if (result.map && options.generateSourceMaps) {
        const mapPath = path.join(jsDir, 'bundle.js.map');
        await fs.writeFile(mapPath, result.map);
      }
    }

    // Add hash if requested
    const filename = options.addHashes 
      ? `bundle-${this.generateHash(js)}.js`
      : 'bundle.js';
    
    const jsPath = path.join(jsDir, filename);
    await fs.writeFile(jsPath, js);

    metadata.set(jsPath, {
      processedAt: new Date(),
      size: Buffer.byteLength(js),
      hash: this.generateHash(js),
      mimeType: 'application/javascript'
    });

    return metadata;
  }

  /**
   * Process and optimize images
   */
  private async processImages(
    outputDir: string,
    options: AssetOptions
  ): Promise<Map<string, AssetMetadata>> {
    const metadata = new Map<string, AssetMetadata>();
    const imageDir = path.join(outputDir, 'assets', 'images');
    const sourceDir = path.join(outputDir, 'content', 'images');

    const processingOptions: ImageProcessingOptions = {
      formats: options.imageFormats || ['webp', 'jpg'],
      quality: options.imageQuality || 85,
      maxWidth: 1920,
      generateThumbnails: true,
      thumbnailSizes: [320, 640, 1280]
    };

    try {
      const results = await this.imageProcessor.processImages(
        sourceDir,
        imageDir,
        processingOptions
      );

      for (const result of results) {
        for (const output of result.outputs) {
          const meta = await this.imageProcessor.generateMetadata(output.path);
          metadata.set(output.path, meta);
        }
      }
    } catch (error) {
      console.warn('Image processing skipped:', error);
    }

    return metadata;
  }

  /**
   * Generate PWA assets
   */
  private async generatePWAAssets(
    outputDir: string,
    config: PWAConfig
  ): Promise<Map<string, AssetMetadata>> {
    const metadata = new Map<string, AssetMetadata>();

    const assets = await this.pwaGenerator.generatePWAAssets(config, outputDir);

    for (const asset of assets) {
      await fs.writeFile(
        asset.path,
        asset.content
      );

      const size = Buffer.isBuffer(asset.content)
        ? asset.content.length
        : Buffer.byteLength(asset.content);

      metadata.set(asset.path, {
        processedAt: new Date(),
        size,
        hash: this.generateHash(asset.content),
        mimeType: asset.type
      });
    }

    // Generate offline page
    const offlinePage = await this.pwaGenerator.generateOfflinePage(config.name);
    const offlinePath = path.join(outputDir, 'offline.html');
    await fs.writeFile(offlinePath, offlinePage);

    metadata.set(offlinePath, {
      processedAt: new Date(),
      size: Buffer.byteLength(offlinePage),
      hash: this.generateHash(offlinePage),
      mimeType: 'text/html'
    });

    return metadata;
  }

  /**
   * Copy font files
   */
  private async copyFonts(outputDir: string): Promise<Map<string, AssetMetadata>> {
    const metadata = new Map<string, AssetMetadata>();
    const fontDir = path.join(outputDir, 'assets', 'fonts');

    try {
      const fonts = await this.fontManager.copyFonts(
        path.join(outputDir, 'content', 'fonts'),
        fontDir
      );

      for (const font of fonts) {
        metadata.set(font.destination, {
          originalPath: font.source,
          processedAt: new Date(),
          size: font.size,
          hash: font.hash,
          mimeType: font.mimeType
        });
      }
    } catch (error) {
      console.warn('Font copying skipped:', error);
    }

    return metadata;
  }

  /**
   * Ensure required directories exist
   */
  private async ensureDirectories(outputDir: string): Promise<void> {
    const dirs = [
      path.join(outputDir, 'assets'),
      path.join(outputDir, 'assets', 'css'),
      path.join(outputDir, 'assets', 'js'),
      path.join(outputDir, 'assets', 'images'),
      path.join(outputDir, 'assets', 'fonts'),
      path.join(outputDir, 'icons')
    ];

    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  /**
   * Generate content hash
   */
  private generateHash(content: string | Buffer): string {
    return createHash('md5').update(content).digest('hex').substring(0, 8);
  }

  /**
   * Get cached asset if available
   */
  getCachedAsset(path: string): AssetCacheEntry | undefined {
    const entry = this.assetCache.get(path);
    
    if (entry && (!entry.expiresAt || entry.expiresAt > new Date())) {
      return entry;
    }
    
    // Remove expired entry
    if (entry) {
      this.assetCache.delete(path);
    }
    
    return undefined;
  }

  /**
   * Cache an asset
   */
  cacheAsset(path: string, content: string | Buffer, metadata: AssetMetadata): void {
    this.assetCache.set(path, {
      path,
      content,
      hash: metadata.hash,
      metadata,
      expiresAt: new Date(Date.now() + 3600000) // 1 hour
    });
  }

  /**
   * Clear asset cache
   */
  clearCache(): void {
    this.assetCache.clear();
  }
}