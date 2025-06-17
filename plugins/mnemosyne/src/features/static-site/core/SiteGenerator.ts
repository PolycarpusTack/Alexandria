/**
 * Core Site Generator - Orchestrates the static site generation process
 */

import { 
  MnemosyneCore,
  Document as MnemosyneDocument,
  KnowledgeGraph,
  AnalyticsEngine
} from '../../../../core/MnemosyneCore';
import { MnemosyneTemplateEngine } from '../../../templates/TemplateEngine';
import { ExportOptions, ExportContext } from '../../import-export/core/ExportEngine';
import { 
  StaticSiteOptions, 
  GeneratedSite, 
  BuildManifest,
  PerformanceMetrics,
  SiteStructure,
  GeneratedPage,
  GeneratedAsset,
  SiteConfiguration
} from './types';
import { PageGenerator } from '../generators/PageGenerator';
import { AssetGenerator } from '../generators/AssetGenerator';
import { NavigationGenerator } from '../generators/NavigationGenerator';
import { SearchIndexGenerator } from '../generators/SearchIndexGenerator';
import { SitemapGenerator } from '../generators/SitemapGenerator';
import { RSSGenerator } from '../generators/RSSGenerator';
import { PerformanceMonitor } from '../utils/PerformanceMonitor';
import { BuildManifestGenerator } from '../utils/BuildManifestGenerator';
import { SiteAnalyzer } from '../utils/SiteAnalyzer';
import * as fs from 'fs/promises';
import * as path from 'path';

export class SiteGenerator {
  private mnemosyne: MnemosyneCore;
  private templateEngine: MnemosyneTemplateEngine;
  private knowledgeGraph: KnowledgeGraph;
  private analytics: AnalyticsEngine;
  
  // Generator modules
  private pageGenerator: PageGenerator;
  private assetGenerator: AssetGenerator;
  private navigationGenerator: NavigationGenerator;
  private searchIndexGenerator: SearchIndexGenerator;
  private sitemapGenerator: SitemapGenerator;
  private rssGenerator: RSSGenerator;
  
  // Utility modules
  private performanceMonitor: PerformanceMonitor;
  private manifestGenerator: BuildManifestGenerator;
  private siteAnalyzer: SiteAnalyzer;
  
  private siteStructure: SiteStructure;
  private buildCache: Map<string, any> = new Map();

  constructor(
    mnemosyne: MnemosyneCore,
    templateEngine: MnemosyneTemplateEngine
  ) {
    this.mnemosyne = mnemosyne;
    this.templateEngine = templateEngine;
    this.knowledgeGraph = mnemosyne.getKnowledgeGraph();
    this.analytics = mnemosyne.getAnalytics();
    
    // Initialize generators
    this.pageGenerator = new PageGenerator(templateEngine);
    this.assetGenerator = new AssetGenerator();
    this.navigationGenerator = new NavigationGenerator();
    this.searchIndexGenerator = new SearchIndexGenerator();
    this.sitemapGenerator = new SitemapGenerator();
    this.rssGenerator = new RSSGenerator();
    
    // Initialize utilities
    this.performanceMonitor = new PerformanceMonitor();
    this.manifestGenerator = new BuildManifestGenerator();
    this.siteAnalyzer = new SiteAnalyzer();
    
    this.siteStructure = {
      pages: new Map(),
      navigation: [],
      tagHierarchy: new Map(),
      dateHierarchy: new Map()
    };
  }

  /**
   * Generate complete static site from Mnemosyne documents
   */
  async generateSite(
    documents: MnemosyneDocument[],
    context: ExportContext,
    options: ExportOptions & { staticSiteOptions?: StaticSiteOptions } = {}
  ): Promise<GeneratedSite> {
    const startTime = Date.now();
    const siteOptions = options.staticSiteOptions || {};
    
    try {
      this.performanceMonitor.startBuild();
      
      // 1. Initialize build environment
      await this.initializeBuild(siteOptions);
      
      // 2. Analyze documents and build site structure
      this.siteStructure = await this.siteAnalyzer.analyzeSiteStructure(
        documents, 
        this.knowledgeGraph,
        siteOptions
      );
      
      // 3. Generate site configuration and metadata
      const siteConfig = await this.generateSiteConfig(documents, context, siteOptions);
      
      // 4. Process documents and generate pages
      this.performanceMonitor.startPhase('page-generation');
      const pages = await this.pageGenerator.generatePages(
        documents,
        this.siteStructure,
        siteConfig,
        siteOptions
      );
      this.performanceMonitor.endPhase('page-generation');
      
      // 5. Generate navigation and utility pages
      const utilityPages = await this.generateUtilityPages(siteConfig, siteOptions);
      pages.push(...utilityPages);
      
      // 6. Generate assets (CSS, JS, images)
      this.performanceMonitor.startPhase('asset-generation');
      const assets = await this.assetGenerator.generateAssets(
        siteConfig,
        siteOptions,
        pages
      );
      this.performanceMonitor.endPhase('asset-generation');
      
      // 7. Generate search index if enabled
      let searchIndex;
      if (siteOptions.generateSearch) {
        this.performanceMonitor.startPhase('search-index');
        searchIndex = await this.searchIndexGenerator.generateIndex(
          pages,
          siteOptions
        );
        this.performanceMonitor.endPhase('search-index');
      }
      
      // 8. Generate sitemap and RSS feed
      let sitemap;
      if (siteOptions.generateSitemap) {
        sitemap = await this.sitemapGenerator.generate(pages, siteOptions);
      }
      
      if (siteOptions.generateRSS) {
        await this.rssGenerator.generate(pages, siteConfig, siteOptions);
      }
      
      // 9. Write all generated files to disk
      await this.writeGeneratedFiles(pages, assets, siteOptions);
      
      // 10. Generate build manifest and performance metrics
      const buildManifest = this.manifestGenerator.generate(
        pages,
        assets,
        startTime,
        siteOptions
      );
      
      const performanceMetrics = this.performanceMonitor.getMetrics();
      
      const generatedSite: GeneratedSite = {
        outputPath: siteOptions.outputDir,
        pages,
        assets,
        sitemap,
        searchIndex,
        buildManifest,
        performanceMetrics
      };
      
      // 11. Record build analytics
      await this.recordBuildAnalytics(generatedSite, Date.now() - startTime);
      
      return generatedSite;
      
    } catch (error) {
      throw this.enhanceError(error, 'Static site generation failed', { 
        documents: documents.length, 
        options: siteOptions 
      });
    } finally {
      this.performanceMonitor.endBuild();
    }
  }

  /**
   * Initialize build environment and clean output directory
   */
  private async initializeBuild(options: StaticSiteOptions): Promise<void> {
    // Ensure output directory exists
    await this.ensureDirectory(options.outputDir);
    
    // Create subdirectories
    const dirs = [
      'assets/css',
      'assets/js',
      'assets/images',
      'assets/fonts',
      'pages',
      'api',
      'search'
    ];
    
    for (const dir of dirs) {
      await this.ensureDirectory(path.join(options.outputDir, dir));
    }
    
    // Clear build cache
    this.buildCache.clear();
  }

  /**
   * Generate site configuration from options and documents
   */
  private async generateSiteConfig(
    documents: MnemosyneDocument[],
    context: ExportContext,
    options: StaticSiteOptions
  ): Promise<SiteConfiguration> {
    const navigation = await this.navigationGenerator.generateNavigation(
      this.siteStructure,
      options
    );
    
    return {
      siteName: options.siteName || 'Mnemosyne Knowledge Base',
      baseUrl: options.baseUrl || '/',
      theme: options.theme || 'minimal',
      navigation,
      metadata: {
        title: options.siteName || 'Knowledge Base',
        description: context.exportMetadata?.description,
        author: context.user?.name,
        language: 'en',
        copyright: `© ${new Date().getFullYear()} ${context.user?.name || 'Mnemosyne'}`
      },
      features: {
        search: options.generateSearch || false,
        analytics: !!options.analyticsId,
        comments: false,
        sharing: true
      }
    };
  }

  /**
   * Generate utility pages (index, 404, search, etc.)
   */
  private async generateUtilityPages(
    config: SiteConfiguration,
    options: StaticSiteOptions
  ): Promise<GeneratedPage[]> {
    const pages: GeneratedPage[] = [];
    
    // Generate index page
    if (options.generateIndex) {
      const indexPage = await this.pageGenerator.generateIndexPage(
        this.siteStructure,
        config,
        options
      );
      pages.push(indexPage);
    }
    
    // Generate 404 page
    const notFoundPage = await this.pageGenerator.generate404Page(config, options);
    pages.push(notFoundPage);
    
    // Generate search page
    if (options.generateSearch) {
      const searchPage = await this.pageGenerator.generateSearchPage(config, options);
      pages.push(searchPage);
    }
    
    // Generate tag pages
    if (options.groupByTags) {
      const tagPages = await this.pageGenerator.generateTagPages(
        this.siteStructure,
        config,
        options
      );
      pages.push(...tagPages);
    }
    
    return pages;
  }

  /**
   * Write all generated files to disk
   */
  private async writeGeneratedFiles(
    pages: GeneratedPage[],
    assets: GeneratedAsset[],
    options: StaticSiteOptions
  ): Promise<void> {
    // Write pages
    for (const page of pages) {
      const filePath = path.join(options.outputDir, page.path);
      await this.ensureDirectory(path.dirname(filePath));
      await fs.writeFile(filePath, page.content, 'utf8');
    }
    
    // Write assets
    for (const asset of assets) {
      const filePath = path.join(options.outputDir, asset.path);
      await this.ensureDirectory(path.dirname(filePath));
      // Asset content should be handled by AssetGenerator
    }
  }

  /**
   * Record build analytics
   */
  private async recordBuildAnalytics(
    site: GeneratedSite,
    buildTime: number
  ): Promise<void> {
    if (this.analytics) {
      await this.analytics.recordEvent('site-build', {
        pages: site.pages.length,
        assets: site.assets.length,
        buildTime,
        totalSize: site.buildManifest.totalSize,
        features: {
          search: !!site.searchIndex,
          sitemap: !!site.sitemap
        }
      });
    }
  }

  /**
   * Ensure directory exists
   */
  private async ensureDirectory(dir: string): Promise<void> {
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error: any) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
  }

  /**
   * Enhance error with context
   */
  private enhanceError(error: any, message: string, context: any): Error {
    const enhanced = new Error(`${message}: ${error.message}`);
    (enhanced as any).originalError = error;
    (enhanced as any).context = context;
    return enhanced;
  }
}