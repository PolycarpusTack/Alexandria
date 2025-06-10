/**
 * Static Site Generator for Mnemosyne
 * Enterprise-grade static site generation with template integration and knowledge graph support
 */

import { 
  MnemosyneCore,
  Document as MnemosyneDocument,
  KnowledgeGraph,
  AnalyticsEngine
} from '../../../core/MnemosyneCore';
import { MnemosyneTemplateEngine } from '../../templates/TemplateEngine';
import { ExportOptions, ExportContext } from '../core/ExportEngine';
import * as fs from 'fs/promises';
import * as path from 'path';
import { marked } from 'marked';
import { JSDOM } from 'jsdom';

interface StaticSiteOptions {
  // Site configuration
  outputDir: string;
  baseUrl?: string;
  siteName?: string;
  
  // Theme and templates
  theme?: 'minimal' | 'academic' | 'blog' | 'documentation' | 'knowledge-base';
  templateId?: string;
  customCSS?: string;
  customJS?: string;
  
  // Content organization
  generateIndex?: boolean;
  generateSitemap?: boolean;
  generateRSS?: boolean;
  generateSearch?: boolean;
  groupByTags?: boolean;
  groupByDate?: boolean;
  
  // Navigation
  includeNavigation?: boolean;
  includeBacklinks?: boolean;
  includeBreadcrumbs?: boolean;
  includeTagCloud?: boolean;
  
  // Knowledge graph features
  includeKnowledgeGraph?: boolean;
  graphVisualization?: 'd3' | 'cytoscape' | 'vis' | 'force-graph';
  interactiveGraph?: boolean;
  
  // Search functionality
  searchType?: 'lunr' | 'fuse' | 'elasticlunr' | 'client-side';
  indexContent?: boolean;
  
  // Performance optimization
  enableMinification?: boolean;
  enableCompression?: boolean;
  enableLazyLoading?: boolean;
  generatePWA?: boolean;
  
  // SEO and metadata
  enableSEO?: boolean;
  generateOpenGraph?: boolean;
  generateTwitterCards?: boolean;
  robotsTxt?: string;
  
  // Analytics integration
  analyticsId?: string;
  analyticsProvider?: 'google' | 'plausible' | 'fathom' | 'custom';
  
  // Asset management
  optimizeImages?: boolean;
  generateThumbnails?: boolean;
  copyAssets?: boolean;
  assetDirs?: string[];
  
  // Development features
  generateDevServer?: boolean;
  enableHotReload?: boolean;
  watchFiles?: boolean;
}

interface GeneratedSite {
  outputPath: string;
  pages: GeneratedPage[];
  assets: GeneratedAsset[];
  sitemap?: string;
  searchIndex?: any;
  buildManifest: BuildManifest;
  performanceMetrics: PerformanceMetrics;
}

interface GeneratedPage {
  path: string;
  title: string;
  content: string;
  metadata: PageMetadata;
  dependencies: string[];
  size: number;
  generatedAt: Date;
}

interface GeneratedAsset {
  path: string;
  type: 'css' | 'js' | 'image' | 'font' | 'data';
  size: number;
  hash: string;
  optimized: boolean;
}

interface PageMetadata {
  title: string;
  description?: string;
  keywords?: string[];
  author?: string;
  created?: Date;
  modified?: Date;
  tags?: string[];
  readingTime?: number;
  wordCount?: number;
  relatedPages?: string[];
}

interface BuildManifest {
  buildId: string;
  timestamp: Date;
  totalPages: number;
  totalAssets: number;
  totalSize: number;
  buildTime: number;
  version: string;
  dependencies: Record<string, string>;
}

interface PerformanceMetrics {
  buildTime: number;
  pageGenerationTime: number;
  assetOptimizationTime: number;
  averagePageSize: number;
  compressionRatio?: number;
  lighthouseScore?: number;
}

interface SiteStructure {
  pages: Map<string, PageInfo>;
  navigation: NavigationItem[];
  tagHierarchy: Map<string, string[]>;
  dateHierarchy: Map<string, string[]>;
  knowledgeGraph?: KnowledgeGraphData;
}

interface PageInfo {
  id: string;
  path: string;
  title: string;
  tags: string[];
  created: Date;
  modified: Date;
  backlinks: string[];
  outlinks: string[];
  level: number;
}

interface NavigationItem {
  title: string;
  path: string;
  children?: NavigationItem[];
  icon?: string;
  order?: number;
}

interface KnowledgeGraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  clusters: GraphCluster[];
  metadata: GraphMetadata;
}

export class StaticSiteGenerator {
  private mnemosyne: MnemosyneCore;
  private templateEngine: MnemosyneTemplateEngine;
  private knowledgeGraph: KnowledgeGraph;
  private analytics: AnalyticsEngine;
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
      // 1. Initialize build environment
      await this.initializeBuild(siteOptions);
      
      // 2. Analyze documents and build site structure
      await this.analyzeSiteStructure(documents, siteOptions);
      
      // 3. Generate site configuration and metadata
      const siteConfig = await this.generateSiteConfig(documents, context, siteOptions);
      
      // 4. Process documents and generate pages
      const pages = await this.generatePages(documents, siteConfig, siteOptions);
      
      // 5. Generate navigation and utility pages
      const utilityPages = await this.generateUtilityPages(siteConfig, siteOptions);
      pages.push(...utilityPages);
      
      // 6. Generate assets (CSS, JS, images)
      const assets = await this.generateAssets(siteConfig, siteOptions);
      
      // 7. Generate search index if enabled
      let searchIndex;
      if (siteOptions.generateSearch) {
        searchIndex = await this.generateSearchIndex(pages, siteOptions);
      }
      
      // 8. Generate sitemap and RSS feed
      let sitemap;
      if (siteOptions.generateSitemap) {
        sitemap = await this.generateSitemap(pages, siteOptions);
      }
      
      if (siteOptions.generateRSS) {
        await this.generateRSSFeed(pages, siteConfig, siteOptions);
      }
      
      // 9. Optimize and compress assets
      if (siteOptions.enableMinification || siteOptions.enableCompression) {
        await this.optimizeAssets(assets, siteOptions);
      }
      
      // 10. Generate build manifest and analytics
      const buildManifest = this.generateBuildManifest(pages, assets, startTime, siteOptions);
      const performanceMetrics = await this.calculatePerformanceMetrics(pages, assets, startTime);
      
      // 11. Copy additional assets and files
      if (siteOptions.copyAssets) {
        await this.copyAssets(siteOptions);
      }
      
      // 12. Generate development server if requested
      if (siteOptions.generateDevServer) {
        await this.generateDevServer(siteOptions);
      }
      
      const generatedSite: GeneratedSite = {
        outputPath: siteOptions.outputDir,
        pages,
        assets,
        sitemap,
        searchIndex,
        buildManifest,
        performanceMetrics
      };
      
      // 13. Record build analytics
      await this.recordBuildAnalytics(generatedSite, Date.now() - startTime);
      
      return generatedSite;
      
    } catch (error) {
      throw this.enhanceError(error, 'Static site generation failed', { 
        documents: documents.length, 
        options: siteOptions 
      });
    }
  }

  /**
   * Initialize build environment and clean output directory
   */
  private async initializeBuild(options: StaticSiteOptions): Promise<void> {
    // Clean output directory
    await this.ensureDirectory(options.outputDir);
    
    // Create directory structure
    const dirs = [
      'pages',
      'assets/css',
      'assets/js',
      'assets/images',
      'assets/fonts',
      'data'
    ];
    
    for (const dir of dirs) {
      await this.ensureDirectory(path.join(options.outputDir, dir));
    }
    
    // Clear build cache
    this.buildCache.clear();
  }

  /**
   * Analyze documents to understand site structure
   */
  private async analyzeSiteStructure(
    documents: MnemosyneDocument[],
    options: StaticSiteOptions
  ): Promise<void> {
    // Process each document to build site structure
    for (const doc of documents) {
      const pageInfo: PageInfo = {
        id: doc.id,
        path: this.generatePagePath(doc, options),
        title: doc.title,
        tags: doc.tags || [],
        created: new Date(doc.metadata?.created || Date.now()),
        modified: new Date(doc.metadata?.modified || doc.metadata?.created || Date.now()),
        backlinks: await this.getBacklinks(doc.id),
        outlinks: await this.getOutlinks(doc.content),
        level: this.calculatePageLevel(doc)
      };
      
      this.siteStructure.pages.set(doc.id, pageInfo);
    }
    
    // Build navigation structure
    this.siteStructure.navigation = await this.buildNavigation(options);
    
    // Build tag hierarchy
    if (options.groupByTags) {
      this.siteStructure.tagHierarchy = this.buildTagHierarchy();
    }
    
    // Build date hierarchy
    if (options.groupByDate) {
      this.siteStructure.dateHierarchy = this.buildDateHierarchy();
    }
    
    // Generate knowledge graph data
    if (options.includeKnowledgeGraph) {
      this.siteStructure.knowledgeGraph = await this.generateKnowledgeGraphData(documents, options);
    }
  }

  /**
   * Generate site configuration object
   */
  private async generateSiteConfig(
    documents: MnemosyneDocument[],
    context: ExportContext,
    options: StaticSiteOptions
  ): Promise<any> {
    return {
      site: {
        title: options.siteName || context.title || 'Mnemosyne Knowledge Base',
        baseUrl: options.baseUrl || '/',
        description: context.description || 'Generated by Mnemosyne',
        author: context.author || 'Mnemosyne User',
        language: context.language || 'en',
        theme: options.theme || 'minimal',
        buildDate: new Date().toISOString()
      },
      navigation: this.siteStructure.navigation,
      pages: Array.from(this.siteStructure.pages.values()),
      tags: this.extractAllTags(),
      knowledgeGraph: this.siteStructure.knowledgeGraph,
      analytics: {
        totalDocuments: documents.length,
        totalWords: documents.reduce((sum, doc) => sum + this.countWords(doc.content), 0),
        totalTags: this.extractAllTags().length,
        averageReadingTime: this.calculateAverageReadingTime(documents)
      }
    };
  }

  /**
   * Generate all site pages
   */
  private async generatePages(
    documents: MnemosyneDocument[],
    siteConfig: any,
    options: StaticSiteOptions
  ): Promise<GeneratedPage[]> {
    const pages: GeneratedPage[] = [];
    const chunkSize = 10; // Process documents in chunks
    
    // Process documents in parallel chunks
    const chunks = this.chunkArray(documents, chunkSize);
    for (const chunk of chunks) {
      const chunkPages = await Promise.all(
        chunk.map(doc => this.generatePage(doc, siteConfig, options))
      );
      pages.push(...chunkPages);
    }
    
    return pages;
  }

  /**
   * Generate individual page
   */
  private async generatePage(
    document: MnemosyneDocument,
    siteConfig: any,
    options: StaticSiteOptions
  ): Promise<GeneratedPage> {
    const pageInfo = this.siteStructure.pages.get(document.id)!;
    
    // Process markdown content
    const processedContent = await this.processMarkdownAdvanced(document.content);
    
    // Get template
    const template = await this.getPageTemplate(document, options);
    
    // Build page context
    const pageContext = {
      document: {
        ...document,
        content: processedContent,
        path: pageInfo.path,
        backlinks: options.includeBacklinks ? await this.getPageBacklinks(document.id) : [],
        outlinks: await this.getPageOutlinks(document.content),
        readingTime: this.calculateReadingTime(document.content),
        wordCount: this.countWords(document.content)
      },
      site: siteConfig.site,
      navigation: siteConfig.navigation,
      page: {
        title: document.title,
        path: pageInfo.path,
        isActive: true,
        breadcrumbs: options.includeBreadcrumbs ? this.generateBreadcrumbs(pageInfo) : [],
        related: await this.getRelatedPages(document.id, 5),
        tags: pageInfo.tags
      },
      options
    };
    
    // Render page using template
    const renderedHTML = await this.templateEngine.render(
      template.id,
      pageContext,
      { format: 'html', features: { seo: options.enableSEO } }
    );
    
    // Apply post-processing
    const finalHTML = await this.postProcessPage(renderedHTML, pageContext, options);
    
    // Write page to disk
    const pagePath = path.join(options.outputDir, 'pages', `${pageInfo.path}.html`);
    await this.ensureDirectory(path.dirname(pagePath));
    await fs.writeFile(pagePath, finalHTML, 'utf8');
    
    return {
      path: pageInfo.path,
      title: document.title,
      content: finalHTML,
      metadata: {
        title: document.title,
        description: this.extractDescription(document.content),
        keywords: pageInfo.tags,
        author: document.metadata?.author || siteConfig.site.author,
        created: pageInfo.created,
        modified: pageInfo.modified,
        tags: pageInfo.tags,
        readingTime: this.calculateReadingTime(document.content),
        wordCount: this.countWords(document.content),
        relatedPages: (await this.getRelatedPages(document.id, 3)).map(p => p.path)
      },
      dependencies: this.extractDependencies(finalHTML),
      size: Buffer.byteLength(finalHTML, 'utf8'),
      generatedAt: new Date()
    };
  }

  /**
   * Generate utility pages (index, tags, search, etc.)
   */
  private async generateUtilityPages(
    siteConfig: any,
    options: StaticSiteOptions
  ): Promise<GeneratedPage[]> {
    const pages: GeneratedPage[] = [];
    
    // Generate index page
    if (options.generateIndex) {
      const indexPage = await this.generateIndexPage(siteConfig, options);
      pages.push(indexPage);
    }
    
    // Generate tag pages
    if (options.groupByTags) {
      const tagPages = await this.generateTagPages(siteConfig, options);
      pages.push(...tagPages);
    }
    
    // Generate date archive pages
    if (options.groupByDate) {
      const datePages = await this.generateDatePages(siteConfig, options);
      pages.push(...datePages);
    }
    
    // Generate search page
    if (options.generateSearch) {
      const searchPage = await this.generateSearchPage(siteConfig, options);
      pages.push(searchPage);
    }
    
    // Generate knowledge graph page
    if (options.includeKnowledgeGraph) {
      const graphPage = await this.generateKnowledgeGraphPage(siteConfig, options);
      pages.push(graphPage);
    }
    
    return pages;
  }

  /**
   * Generate site assets (CSS, JS, images)
   */
  private async generateAssets(
    siteConfig: any,
    options: StaticSiteOptions
  ): Promise<GeneratedAsset[]> {
    const assets: GeneratedAsset[] = [];
    
    // Generate CSS
    const cssAssets = await this.generateCSS(siteConfig, options);
    assets.push(...cssAssets);
    
    // Generate JavaScript
    const jsAssets = await this.generateJavaScript(siteConfig, options);
    assets.push(...jsAssets);
    
    // Process images
    if (options.optimizeImages) {
      const imageAssets = await this.processImages(options);
      assets.push(...imageAssets);
    }
    
    // Generate PWA assets
    if (options.generatePWA) {
      const pwaAssets = await this.generatePWAAssets(siteConfig, options);
      assets.push(...pwaAssets);
    }
    
    return assets;
  }

  /**
   * Generate comprehensive CSS for the site
   */
  private async generateCSS(
    siteConfig: any,
    options: StaticSiteOptions
  ): Promise<GeneratedAsset[]> {
    const assets: GeneratedAsset[] = [];
    
    // Base theme CSS
    const themeCSS = await this.generateThemeCSS(options.theme || 'minimal');
    
    // Component CSS
    const componentCSS = this.generateComponentCSS();
    
    // Knowledge graph CSS
    const graphCSS = options.includeKnowledgeGraph ? this.generateKnowledgeGraphCSS(options.graphVisualization) : '';
    
    // Search CSS
    const searchCSS = options.generateSearch ? this.generateSearchCSS() : '';
    
    // Combine all CSS
    let combinedCSS = [themeCSS, componentCSS, graphCSS, searchCSS, options.customCSS || ''].join('\n\n');
    
    // Minify if enabled
    if (options.enableMinification) {
      combinedCSS = this.minifyCSS(combinedCSS);
    }
    
    // Write main CSS file
    const cssPath = path.join(options.outputDir, 'assets/css/main.css');
    await fs.writeFile(cssPath, combinedCSS, 'utf8');
    
    assets.push({
      path: 'assets/css/main.css',
      type: 'css',
      size: Buffer.byteLength(combinedCSS, 'utf8'),
      hash: this.generateHash(combinedCSS),
      optimized: !!options.enableMinification
    });
    
    return assets;
  }

  /**
   * Generate JavaScript for interactive features
   */
  private async generateJavaScript(
    siteConfig: any,
    options: StaticSiteOptions
  ): Promise<GeneratedAsset[]> {
    const assets: GeneratedAsset[] = [];
    
    // Base JavaScript
    const baseJS = this.generateBaseJavaScript();
    
    // Search JavaScript
    const searchJS = options.generateSearch ? await this.generateSearchJavaScript(options.searchType) : '';
    
    // Knowledge graph JavaScript
    const graphJS = options.includeKnowledgeGraph ? await this.generateKnowledgeGraphJavaScript(options.graphVisualization) : '';
    
    // PWA JavaScript
    const pwaJS = options.generatePWA ? this.generatePWAJavaScript() : '';
    
    // Analytics JavaScript
    const analyticsJS = options.analyticsId ? this.generateAnalyticsJavaScript(options.analyticsProvider, options.analyticsId) : '';
    
    // Combine all JavaScript
    let combinedJS = [baseJS, searchJS, graphJS, pwaJS, analyticsJS, options.customJS || ''].join('\n\n');
    
    // Minify if enabled
    if (options.enableMinification) {
      combinedJS = this.minifyJavaScript(combinedJS);
    }
    
    // Write main JS file
    const jsPath = path.join(options.outputDir, 'assets/js/main.js');
    await fs.writeFile(jsPath, combinedJS, 'utf8');
    
    assets.push({
      path: 'assets/js/main.js',
      type: 'js',
      size: Buffer.byteLength(combinedJS, 'utf8'),
      hash: this.generateHash(combinedJS),
      optimized: !!options.enableMinification
    });
    
    return assets;
  }

  /**
   * Generate search index for client-side search
   */
  private async generateSearchIndex(
    pages: GeneratedPage[],
    options: StaticSiteOptions
  ): Promise<any> {
    const searchDocuments = pages.map(page => ({
      id: page.path,
      title: page.metadata.title,
      content: this.extractTextContent(page.content),
      tags: page.metadata.tags || [],
      url: `/${page.path}.html`
    }));
    
    let searchIndex;
    
    switch (options.searchType) {
      case 'lunr':
        searchIndex = await this.generateLunrIndex(searchDocuments);
        break;
      case 'fuse':
        searchIndex = await this.generateFuseIndex(searchDocuments);
        break;
      case 'elasticlunr':
        searchIndex = await this.generateElasticLunrIndex(searchDocuments);
        break;
      default:
        searchIndex = await this.generateClientSideIndex(searchDocuments);
    }
    
    // Write search index to file
    const indexPath = path.join(options.outputDir, 'data/search-index.json');
    await fs.writeFile(indexPath, JSON.stringify(searchIndex, null, 2), 'utf8');
    
    return searchIndex;
  }

  /**
   * Generate XML sitemap
   */
  private async generateSitemap(
    pages: GeneratedPage[],
    options: StaticSiteOptions
  ): Promise<string> {
    const baseUrl = options.baseUrl || '/';
    const now = new Date().toISOString();
    
    const urlEntries = pages.map(page => `
  <url>
    <loc>${baseUrl}${page.path}.html</loc>
    <lastmod>${page.metadata.modified?.toISOString() || now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${this.calculateSitemapPriority(page)}</priority>
  </url>`).join('');
    
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>${urlEntries}
</urlset>`;
    
    // Write sitemap to file
    const sitemapPath = path.join(options.outputDir, 'sitemap.xml');
    await fs.writeFile(sitemapPath, sitemap, 'utf8');
    
    return sitemap;
  }

  /**
   * Generate RSS feed
   */
  private async generateRSSFeed(
    pages: GeneratedPage[],
    siteConfig: any,
    options: StaticSiteOptions
  ): Promise<void> {
    const baseUrl = options.baseUrl || '/';
    const sortedPages = pages
      .filter(page => page.metadata.created)
      .sort((a, b) => (b.metadata.created?.getTime() || 0) - (a.metadata.created?.getTime() || 0))
      .slice(0, 20); // Latest 20 pages
    
    const rssItems = sortedPages.map(page => `
    <item>
      <title><![CDATA[${page.metadata.title}]]></title>
      <link>${baseUrl}${page.path}.html</link>
      <guid>${baseUrl}${page.path}.html</guid>
      <pubDate>${page.metadata.created?.toUTCString()}</pubDate>
      <description><![CDATA[${page.metadata.description || this.extractDescription(page.content)}]]></description>
      ${page.metadata.author ? `<author>${page.metadata.author}</author>` : ''}
      ${(page.metadata.tags || []).map(tag => `<category>${tag}</category>`).join('')}
    </item>`).join('');
    
    const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${siteConfig.site.title}</title>
    <link>${baseUrl}</link>
    <description>${siteConfig.site.description}</description>
    <language>${siteConfig.site.language}</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${baseUrl}rss.xml" rel="self" type="application/rss+xml"/>
    ${rssItems}
  </channel>
</rss>`;
    
    // Write RSS feed to file
    const rssPath = path.join(options.outputDir, 'rss.xml');
    await fs.writeFile(rssPath, rss, 'utf8');
  }

  // Helper methods for content processing
  private async processMarkdownAdvanced(markdown: string): Promise<string> {
    const renderer = new marked.Renderer();
    
    // Custom heading renderer with anchor links
    renderer.heading = (text: string, level: number) => {
      const anchor = this.slugify(text);
      return `<h${level} id="${anchor}">
        <a href="#${anchor}" class="anchor-link" aria-hidden="true">#</a>
        ${text}
      </h${level}>`;
    };
    
    // Custom link renderer for internal links
    renderer.link = (href: string, title: string | null, text: string) => {
      const isInternal = !href.startsWith('http') && !href.startsWith('#');
      const className = isInternal ? 'internal-link' : 'external-link';
      const target = isInternal ? '' : 'target="_blank" rel="noopener noreferrer"';
      
      return `<a href="${href}" ${target} title="${title || ''}" class="${className}">${text}</a>`;
    };
    
    // Custom image renderer with lazy loading
    renderer.image = (href: string, title: string | null, text: string) => {
      return `<figure class="image-figure">
        <img src="${href}" alt="${text}" title="${title || ''}" loading="lazy" />
        ${title ? `<figcaption>${title}</figcaption>` : ''}
      </figure>`;
    };
    
    marked.setOptions({
      renderer,
      gfm: true,
      breaks: true,
      smartLists: true,
      smartypants: true
    });
    
    return marked(markdown);
  }

  // Utility methods
  private generatePagePath(document: MnemosyneDocument, options: StaticSiteOptions): string {
    return this.slugify(document.title);
  }

  private calculatePageLevel(document: MnemosyneDocument): number {
    // Calculate based on heading levels, backlinks, etc.
    return document.title.startsWith('#') ? 1 : 2;
  }

  private async getBacklinks(documentId: string): Promise<string[]> {
    const relationships = await this.knowledgeGraph.getRelationships(
      documentId,
      { type: 'links-to', direction: 'incoming' }
    );
    return relationships.map(rel => rel.sourceId);
  }

  private async getOutlinks(content: string): Promise<string[]> {
    const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
    const links: string[] = [];
    let match;
    
    while ((match = linkPattern.exec(content)) !== null) {
      if (!match[2].startsWith('http')) {
        links.push(match[2]);
      }
    }
    
    return links;
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  private countWords(text: string): number {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  private calculateReadingTime(text: string): number {
    const wordsPerMinute = 250;
    const words = this.countWords(text);
    return Math.ceil(words / wordsPerMinute);
  }

  private extractDescription(content: string, maxLength: number = 160): string {
    const plainText = content.replace(/[#*_`]/g, '').substring(0, maxLength);
    return plainText.length === maxLength ? plainText + '...' : plainText;
  }

  private extractTextContent(html: string): string {
    const dom = new JSDOM(html);
    return dom.window.document.body.textContent || '';
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  private generateHash(content: string): string {
    // Simple hash function for content versioning
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  private async ensureDirectory(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  private enhanceError(error: any, message: string, context: any): Error {
    const enhancedError = new Error(`${message}: ${error.message}`);
    (enhancedError as any).context = context;
    (enhancedError as any).originalError = error;
    return enhancedError;
  }

  /**
   * Get page template with intelligent selection
   */
  private async getPageTemplate(document: MnemosyneDocument, options: StaticSiteOptions): Promise<any> {
    let templateId = options.templateId;
    
    if (!templateId) {
      // Intelligent template selection based on document type and content
      if (document.metadata?.type === 'academic') {
        templateId = 'site-academic';
      } else if (document.metadata?.type === 'blog') {
        templateId = 'site-blog';
      } else if (document.metadata?.type === 'documentation') {
        templateId = 'site-documentation';
      } else if (this.hasKnowledgeGraphConnections(document)) {
        templateId = 'site-knowledge-base';
      } else {
        templateId = `site-${options.theme || 'minimal'}`;
      }
    }
    
    try {
      return await this.templateEngine.getTemplate(templateId);
    } catch (error) {
      // Fallback to minimal template
      return await this.templateEngine.getTemplate('site-minimal');
    }
  }
  
  /**
   * Check if document has significant knowledge graph connections
   */
  private hasKnowledgeGraphConnections(document: MnemosyneDocument): boolean {
    const pageInfo = this.siteStructure.pages.get(document.id);
    if (!pageInfo) return false;
    
    return pageInfo.backlinks.length > 3 || pageInfo.outlinks.length > 5;
  }

  /**
   * Get page backlinks with full metadata
   */
  private async getPageBacklinks(documentId: string): Promise<any[]> {
    const backlinkIds = await this.getBacklinks(documentId);
    const backlinks = [];
    
    for (const linkId of backlinkIds) {
      const pageInfo = this.siteStructure.pages.get(linkId);
      if (pageInfo) {
        backlinks.push({
          id: linkId,
          title: pageInfo.title,
          path: pageInfo.path,
          context: await this.extractLinkContext(linkId, documentId)
        });
      }
    }
    
    return backlinks;
  }

  /**
   * Get page outlinks with metadata
   */
  private async getPageOutlinks(content: string): Promise<any[]> {
    const outlinks = [];
    const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
    let match;
    
    while ((match = linkPattern.exec(content)) !== null) {
      const title = match[1];
      const url = match[2];
      const isExternal = url.startsWith('http') || url.startsWith('//');
      
      if (!isExternal) {
        // Try to find the referenced page
        const referencedPage = this.findPageByPath(url) || this.findPageByTitle(title);
        if (referencedPage) {
          outlinks.push({
            title: referencedPage.title,
            path: referencedPage.path,
            type: 'internal'
          });
        }
      } else {
        outlinks.push({
          title,
          url,
          type: 'external'
        });
      }
    }
    
    return outlinks;
  }

  /**
   * Get related pages using knowledge graph analysis
   */
  private async getRelatedPages(documentId: string, limit: number): Promise<any[]> {
    try {
      const related = await this.knowledgeGraph.getRelated(documentId, { 
        limit: limit * 2, // Get more than needed for filtering
        minRelevance: 0.3 
      });
      
      const relatedPages = [];
      for (const node of related.slice(0, limit)) {
        const pageInfo = this.siteStructure.pages.get(node.id);
        if (pageInfo) {
          relatedPages.push({
            id: node.id,
            title: pageInfo.title,
            path: pageInfo.path,
            relevance: node.relevance,
            description: await this.generatePageDescription(pageInfo),
            tags: pageInfo.tags.slice(0, 3) // First 3 tags
          });
        }
      }
      
      return relatedPages;
    } catch (error) {
      // Fallback to tag-based similarity
      return this.getRelatedPagesByTags(documentId, limit);
    }
  }

  /**
   * Generate hierarchical breadcrumbs
   */
  private generateBreadcrumbs(pageInfo: PageInfo): any[] {
    const breadcrumbs = [
      { title: 'Home', path: '/' }
    ];
    
    // Add category based on tags
    if (pageInfo.tags.length > 0) {
      const primaryTag = pageInfo.tags[0];
      breadcrumbs.push({
        title: this.capitalizeFirst(primaryTag),
        path: `/tags/${this.slugify(primaryTag)}/`
      });
    }
    
    // Add current page (without link)
    breadcrumbs.push({
      title: pageInfo.title,
      path: pageInfo.path,
      current: true
    });
    
    return breadcrumbs;
  }

  /**
   * Post-process page HTML with SEO, metadata, and enhancements
   */
  private async postProcessPage(html: string, context: any, options: StaticSiteOptions): Promise<string> {
    let processed = html;
    
    // Add SEO meta tags
    if (options.enableSEO) {
      processed = this.addSEOMetaTags(processed, context);
    }
    
    // Add Open Graph tags
    if (options.generateOpenGraph) {
      processed = this.addOpenGraphTags(processed, context);
    }
    
    // Add Twitter Card tags
    if (options.generateTwitterCards) {
      processed = this.addTwitterCardTags(processed, context);
    }
    
    // Add JSON-LD structured data
    if (options.enableSEO) {
      processed = this.addStructuredData(processed, context);
    }
    
    // Optimize images for lazy loading
    if (options.enableLazyLoading) {
      processed = this.optimizeImagesForLazyLoading(processed);
    }
    
    // Add table of contents if not already present
    if (options.tableOfContents && !processed.includes('table-of-contents')) {
      processed = this.injectTableOfContents(processed, context);
    }
    
    return processed;
  }

  /**
   * Add comprehensive SEO meta tags
   */
  private addSEOMetaTags(html: string, context: any): string {
    const dom = new JSDOM(html);
    const document = dom.window.document;
    const head = document.head;
    
    // Description meta tag
    if (context.document.metadata.description && !document.querySelector('meta[name="description"]')) {
      const descMeta = document.createElement('meta');
      descMeta.setAttribute('name', 'description');
      descMeta.setAttribute('content', context.document.metadata.description);
      head.appendChild(descMeta);
    }
    
    // Keywords meta tag
    if (context.document.metadata.keywords?.length && !document.querySelector('meta[name="keywords"]')) {
      const keywordsMeta = document.createElement('meta');
      keywordsMeta.setAttribute('name', 'keywords');
      keywordsMeta.setAttribute('content', context.document.metadata.keywords.join(', '));
      head.appendChild(keywordsMeta);
    }
    
    // Author meta tag
    if (context.document.metadata.author && !document.querySelector('meta[name="author"]')) {
      const authorMeta = document.createElement('meta');
      authorMeta.setAttribute('name', 'author');
      authorMeta.setAttribute('content', context.document.metadata.author);
      head.appendChild(authorMeta);
    }
    
    // Canonical URL
    if (!document.querySelector('link[rel="canonical"]')) {
      const canonicalLink = document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      canonicalLink.setAttribute('href', `${context.site.baseUrl}${context.page.path}.html`);
      head.appendChild(canonicalLink);
    }
    
    // Robots meta tag
    const robotsMeta = document.createElement('meta');
    robotsMeta.setAttribute('name', 'robots');
    robotsMeta.setAttribute('content', 'index, follow');
    head.appendChild(robotsMeta);
    
    return dom.serialize();
  }

  /**
   * Add Open Graph meta tags for social sharing
   */
  private addOpenGraphTags(html: string, context: any): string {
    const dom = new JSDOM(html);
    const document = dom.window.document;
    const head = document.head;
    
    const ogTags = [
      { property: 'og:title', content: context.page.title },
      { property: 'og:description', content: context.document.metadata.description || '' },
      { property: 'og:type', content: 'article' },
      { property: 'og:url', content: `${context.site.baseUrl}${context.page.path}.html` },
      { property: 'og:site_name', content: context.site.title },
      { property: 'article:author', content: context.document.metadata.author || context.site.author }
    ];
    
    if (context.document.metadata.created) {
      ogTags.push({ 
        property: 'article:published_time', 
        content: context.document.metadata.created.toISOString() 
      });
    }
    
    if (context.document.metadata.modified) {
      ogTags.push({ 
        property: 'article:modified_time', 
        content: context.document.metadata.modified.toISOString() 
      });
    }
    
    if (context.document.metadata.tags?.length) {
      context.document.metadata.tags.forEach((tag: string) => {
        ogTags.push({ property: 'article:tag', content: tag });
      });
    }
    
    ogTags.forEach(tag => {
      if (tag.content && !document.querySelector(`meta[property="${tag.property}"]`)) {
        const meta = document.createElement('meta');
        meta.setAttribute('property', tag.property);
        meta.setAttribute('content', tag.content);
        head.appendChild(meta);
      }
    });
    
    return dom.serialize();
  }

  /**
   * Add Twitter Card meta tags
   */
  private addTwitterCardTags(html: string, context: any): string {
    const dom = new JSDOM(html);
    const document = dom.window.document;
    const head = document.head;
    
    const twitterTags = [
      { name: 'twitter:card', content: 'summary' },
      { name: 'twitter:title', content: context.page.title },
      { name: 'twitter:description', content: context.document.metadata.description || '' }
    ];
    
    if (context.site.twitterHandle) {
      twitterTags.push({ name: 'twitter:site', content: context.site.twitterHandle });
    }
    
    if (context.document.metadata.author && context.site.authorTwitter) {
      twitterTags.push({ name: 'twitter:creator', content: context.site.authorTwitter });
    }
    
    twitterTags.forEach(tag => {
      if (tag.content && !document.querySelector(`meta[name="${tag.name}"]`)) {
        const meta = document.createElement('meta');
        meta.setAttribute('name', tag.name);
        meta.setAttribute('content', tag.content);
        head.appendChild(meta);
      }
    });
    
    return dom.serialize();
  }

  /**
   * Add JSON-LD structured data
   */
  private addStructuredData(html: string, context: any): string {
    const dom = new JSDOM(html);
    const document = dom.window.document;
    const head = document.head;
    
    const structuredData = {
      "@context": "https://schema.org",
      "@type": "Article",
      "headline": context.page.title,
      "description": context.document.metadata.description || '',
      "author": {
        "@type": "Person",
        "name": context.document.metadata.author || context.site.author
      },
      "publisher": {
        "@type": "Organization",
        "name": context.site.title
      },
      "url": `${context.site.baseUrl}${context.page.path}.html`,
      "wordCount": context.document.wordCount,
      "keywords": context.document.metadata.keywords || []
    };
    
    if (context.document.metadata.created) {
      structuredData["datePublished"] = context.document.metadata.created.toISOString();
    }
    
    if (context.document.metadata.modified) {
      structuredData["dateModified"] = context.document.metadata.modified.toISOString();
    }
    
    const script = document.createElement('script');
    script.setAttribute('type', 'application/ld+json');
    script.textContent = JSON.stringify(structuredData, null, 2);
    head.appendChild(script);
    
    return dom.serialize();
  }

  /**
   * Optimize images for lazy loading
   */
  private optimizeImagesForLazyLoading(html: string): string {
    const dom = new JSDOM(html);
    const document = dom.window.document;
    const images = document.querySelectorAll('img');
    
    images.forEach(img => {
      if (!img.hasAttribute('loading')) {
        img.setAttribute('loading', 'lazy');
      }
      
      // Add placeholder for better UX
      if (!img.hasAttribute('src') && img.hasAttribute('data-src')) {
        img.setAttribute('src', 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMSIgaGVpZ2h0PSIxIiB2aWV3Qm94PSIwIDAgMSAxIiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9IiNmNWY1ZjUiLz48L3N2Zz4=');
      }
    });
    
    return dom.serialize();
  }

  /**
   * Inject table of contents into page
   */
  private injectTableOfContents(html: string, context: any): string {
    if (!context.document.headings?.length) return html;
    
    const dom = new JSDOM(html);
    const document = dom.window.document;
    const mainContent = document.querySelector('.article-content') || document.querySelector('main');
    
    if (!mainContent) return html;
    
    // Generate TOC HTML
    const tocContainer = document.createElement('aside');
    tocContainer.className = 'table-of-contents-injected';
    
    const tocTitle = document.createElement('h2');
    tocTitle.textContent = 'Table of Contents';
    tocContainer.appendChild(tocTitle);
    
    const tocNav = document.createElement('nav');
    tocNav.className = 'toc-nav';
    
    const tocList = document.createElement('ul');
    tocList.className = 'toc-list';
    
    context.document.headings.forEach((heading: any) => {
      const listItem = document.createElement('li');
      listItem.className = `toc-item toc-level-${heading.level}`;
      
      const link = document.createElement('a');
      link.href = `#${heading.anchor}`;
      link.textContent = heading.text;
      
      listItem.appendChild(link);
      tocList.appendChild(listItem);
    });
    
    tocNav.appendChild(tocList);
    tocContainer.appendChild(tocNav);
    
    // Insert TOC before main content
    mainContent.parentNode?.insertBefore(tocContainer, mainContent);
    
    return dom.serialize();
  }

  /**
   * Extract dependencies from HTML (CSS, JS, images)
   */
  private extractDependencies(html: string): string[] {
    const dom = new JSDOM(html);
    const document = dom.window.document;
    const dependencies: string[] = [];
    
    // Extract CSS dependencies
    const stylesheets = document.querySelectorAll('link[rel="stylesheet"]');
    stylesheets.forEach(link => {
      const href = link.getAttribute('href');
      if (href && !href.startsWith('http')) {
        dependencies.push(href);
      }
    });
    
    // Extract JavaScript dependencies
    const scripts = document.querySelectorAll('script[src]');
    scripts.forEach(script => {
      const src = script.getAttribute('src');
      if (src && !src.startsWith('http')) {
        dependencies.push(src);
      }
    });
    
    // Extract image dependencies
    const images = document.querySelectorAll('img');
    images.forEach(img => {
      const src = img.getAttribute('src');
      if (src && !src.startsWith('http') && !src.startsWith('data:')) {
        dependencies.push(src);
      }
    });
    
    return dependencies;
  }

  private extractAllTags(): string[] {
    const allTags = new Set<string>();
    for (const page of this.siteStructure.pages.values()) {
      page.tags.forEach(tag => allTags.add(tag));
    }
    return Array.from(allTags);
  }

  private calculateAverageReadingTime(documents: MnemosyneDocument[]): number {
    const totalTime = documents.reduce((sum, doc) => sum + this.calculateReadingTime(doc.content), 0);
    return documents.length > 0 ? totalTime / documents.length : 0;
  }

  private async buildNavigation(options: StaticSiteOptions): Promise<NavigationItem[]> {
    // Would implement navigation structure building
    return [];
  }

  private buildTagHierarchy(): Map<string, string[]> {
    // Would implement tag hierarchy building
    return new Map();
  }

  private buildDateHierarchy(): Map<string, string[]> {
    // Would implement date hierarchy building
    return new Map();
  }

  private async generateKnowledgeGraphData(documents: MnemosyneDocument[], options: StaticSiteOptions): Promise<KnowledgeGraphData> {
    // Would implement knowledge graph data generation
    return {
      nodes: [],
      edges: [],
      clusters: [],
      metadata: { nodeCount: 0, edgeCount: 0, density: 0 }
    };
  }

  /**
   * Generate main index page
   */
  private async generateIndexPage(siteConfig: any, options: StaticSiteOptions): Promise<GeneratedPage> {
    const template = await this.templateEngine.getTemplate('site-index');
    
    // Get recent pages for index
    const recentPages = Array.from(this.siteStructure.pages.values())
      .sort((a, b) => b.modified.getTime() - a.modified.getTime())
      .slice(0, 10);
    
    // Get popular tags
    const tagCounts = new Map<string, number>();
    for (const page of this.siteStructure.pages.values()) {
      page.tags.forEach(tag => {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      });
    }
    
    const popularTags = Array.from(tagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([tag, count]) => ({ name: tag, count, weight: this.calculateTagWeight(count, tagCounts) }));
    
    const indexContext = {
      site: siteConfig.site,
      page: { title: 'Home', path: '', isHome: true },
      recentPages,
      popularTags,
      totalPages: this.siteStructure.pages.size,
      totalTags: tagCounts.size,
      knowledgeGraph: siteConfig.knowledgeGraph,
      analytics: siteConfig.analytics
    };
    
    const html = await this.templateEngine.render(template.id, indexContext);
    const finalHTML = await this.postProcessPage(html, indexContext, options);
    
    const indexPath = path.join(options.outputDir, 'index.html');
    await fs.writeFile(indexPath, finalHTML, 'utf8');
    
    return {
      path: '',
      title: 'Home',
      content: finalHTML,
      metadata: {
        title: siteConfig.site.title,
        description: siteConfig.site.description,
        keywords: popularTags.slice(0, 10).map(t => t.name)
      },
      dependencies: this.extractDependencies(finalHTML),
      size: Buffer.byteLength(finalHTML, 'utf8'),
      generatedAt: new Date()
    };
  }

  /**
   * Generate individual tag pages
   */
  private async generateTagPages(siteConfig: any, options: StaticSiteOptions): Promise<GeneratedPage[]> {
    const pages: GeneratedPage[] = [];
    const template = await this.templateEngine.getTemplate('site-tag');
    
    // Group pages by tags
    const tagGroups = new Map<string, PageInfo[]>();
    for (const page of this.siteStructure.pages.values()) {
      page.tags.forEach(tag => {
        if (!tagGroups.has(tag)) {
          tagGroups.set(tag, []);
        }
        tagGroups.get(tag)!.push(page);
      });
    }
    
    // Generate page for each tag
    for (const [tag, tagPages] of tagGroups.entries()) {
      const tagContext = {
        site: siteConfig.site,
        page: { title: `Tagged: ${tag}`, path: `tags/${this.slugify(tag)}` },
        tag: {
          name: tag,
          count: tagPages.length,
          pages: tagPages.sort((a, b) => b.modified.getTime() - a.modified.getTime())
        },
        relatedTags: this.getRelatedTags(tag, tagGroups)
      };
      
      const html = await this.templateEngine.render(template.id, tagContext);
      const finalHTML = await this.postProcessPage(html, tagContext, options);
      
      const tagPath = path.join(options.outputDir, 'tags', `${this.slugify(tag)}.html`);
      await this.ensureDirectory(path.dirname(tagPath));
      await fs.writeFile(tagPath, finalHTML, 'utf8');
      
      pages.push({
        path: `tags/${this.slugify(tag)}`,
        title: `Tagged: ${tag}`,
        content: finalHTML,
        metadata: {
          title: `Pages tagged with "${tag}"`,
          description: `${tagPages.length} pages tagged with ${tag}`,
          keywords: [tag, ...this.getRelatedTags(tag, tagGroups).slice(0, 5)]
        },
        dependencies: this.extractDependencies(finalHTML),
        size: Buffer.byteLength(finalHTML, 'utf8'),
        generatedAt: new Date()
      });
    }
    
    return pages;
  }

  /**
   * Generate date archive pages
   */
  private async generateDatePages(siteConfig: any, options: StaticSiteOptions): Promise<GeneratedPage[]> {
    const pages: GeneratedPage[] = [];
    const template = await this.templateEngine.getTemplate('site-archive');
    
    // Group pages by year and month
    const dateGroups = new Map<string, Map<string, PageInfo[]>>();
    
    for (const page of this.siteStructure.pages.values()) {
      const year = page.created.getFullYear().toString();
      const month = page.created.toLocaleDateString('en-US', { month: 'long' });
      
      if (!dateGroups.has(year)) {
        dateGroups.set(year, new Map());
      }
      if (!dateGroups.get(year)!.has(month)) {
        dateGroups.get(year)!.set(month, []);
      }
      dateGroups.get(year)!.get(month)!.push(page);
    }
    
    // Generate yearly archive pages
    for (const [year, months] of dateGroups.entries()) {
      const yearPages: PageInfo[] = [];
      for (const monthPages of months.values()) {
        yearPages.push(...monthPages);
      }
      
      const yearContext = {
        site: siteConfig.site,
        page: { title: `Archive: ${year}`, path: `archive/${year}` },
        archive: {
          year,
          totalPages: yearPages.length,
          months: Array.from(months.entries()).map(([month, pages]) => ({
            name: month,
            count: pages.length,
            pages: pages.sort((a, b) => b.created.getTime() - a.created.getTime())
          }))
        }
      };
      
      const html = await this.templateEngine.render(template.id, yearContext);
      const finalHTML = await this.postProcessPage(html, yearContext, options);
      
      const yearPath = path.join(options.outputDir, 'archive', `${year}.html`);
      await this.ensureDirectory(path.dirname(yearPath));
      await fs.writeFile(yearPath, finalHTML, 'utf8');
      
      pages.push({
        path: `archive/${year}`,
        title: `Archive: ${year}`,
        content: finalHTML,
        metadata: {
          title: `${year} Archive`,
          description: `${yearPages.length} pages from ${year}`,
          keywords: [`${year}`, 'archive']
        },
        dependencies: this.extractDependencies(finalHTML),
        size: Buffer.byteLength(finalHTML, 'utf8'),
        generatedAt: new Date()
      });
    }
    
    return pages;
  }

  /**
   * Generate search page
   */
  private async generateSearchPage(siteConfig: any, options: StaticSiteOptions): Promise<GeneratedPage> {
    const template = await this.templateEngine.getTemplate('site-search');
    
    const searchContext = {
      site: siteConfig.site,
      page: { title: 'Search', path: 'search' },
      searchConfig: {
        type: options.searchType || 'client-side',
        indexUrl: '/data/search-index.json',
        placeholder: 'Search the knowledge base...'
      },
      totalPages: this.siteStructure.pages.size,
      allTags: this.extractAllTags()
    };
    
    const html = await this.templateEngine.render(template.id, searchContext);
    const finalHTML = await this.postProcessPage(html, searchContext, options);
    
    const searchPath = path.join(options.outputDir, 'search.html');
    await fs.writeFile(searchPath, finalHTML, 'utf8');
    
    return {
      path: 'search',
      title: 'Search',
      content: finalHTML,
      metadata: {
        title: 'Search',
        description: 'Search the knowledge base',
        keywords: ['search', 'find', 'explore']
      },
      dependencies: this.extractDependencies(finalHTML),
      size: Buffer.byteLength(finalHTML, 'utf8'),
      generatedAt: new Date()
    };
  }

  /**
   * Generate knowledge graph visualization page
   */
  private async generateKnowledgeGraphPage(siteConfig: any, options: StaticSiteOptions): Promise<GeneratedPage> {
    const template = await this.templateEngine.getTemplate('site-graph');
    
    const graphContext = {
      site: siteConfig.site,
      page: { title: 'Knowledge Graph', path: 'graph' },
      graph: {
        data: siteConfig.knowledgeGraph,
        visualization: options.graphVisualization || 'd3',
        interactive: options.interactiveGraph !== false,
        controls: {
          search: true,
          filter: true,
          zoom: true,
          fullscreen: true
        }
      },
      statistics: {
        nodes: siteConfig.knowledgeGraph?.nodes.length || 0,
        edges: siteConfig.knowledgeGraph?.edges.length || 0,
        clusters: siteConfig.knowledgeGraph?.clusters.length || 0,
        density: this.calculateGraphDensity(siteConfig.knowledgeGraph)
      }
    };
    
    const html = await this.templateEngine.render(template.id, graphContext);
    const finalHTML = await this.postProcessPage(html, graphContext, options);
    
    const graphPath = path.join(options.outputDir, 'graph.html');
    await fs.writeFile(graphPath, finalHTML, 'utf8');
    
    return {
      path: 'graph',
      title: 'Knowledge Graph',
      content: finalHTML,
      metadata: {
        title: 'Knowledge Graph',
        description: 'Interactive visualization of knowledge connections',
        keywords: ['graph', 'visualization', 'connections', 'knowledge']
      },
      dependencies: this.extractDependencies(finalHTML),
      size: Buffer.byteLength(finalHTML, 'utf8'),
      generatedAt: new Date()
    };
  }

  /**
   * Generate theme-specific CSS
   */
  private async generateThemeCSS(theme: string): Promise<string> {
    const themes = {
      minimal: `
        /* Minimal Theme */
        :root {
          --primary-color: #2563eb;
          --secondary-color: #64748b;
          --background-color: #ffffff;
          --surface-color: #f8fafc;
          --text-color: #1e293b;
          --muted-color: #64748b;
          --border-color: #e2e8f0;
          --font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          --font-mono: 'JetBrains Mono', 'SF Mono', Monaco, monospace;
        }
        
        body {
          font-family: var(--font-family);
          line-height: 1.6;
          color: var(--text-color);
          background-color: var(--background-color);
          margin: 0;
          padding: 0;
        }
        
        .site-header {
          background: var(--surface-color);
          border-bottom: 1px solid var(--border-color);
          padding: 1rem 0;
        }
        
        .header-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 2rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .site-title {
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--primary-color);
          text-decoration: none;
        }
        
        .main-navigation ul {
          display: flex;
          list-style: none;
          margin: 0;
          padding: 0;
          gap: 2rem;
        }
        
        .main-navigation a {
          color: var(--text-color);
          text-decoration: none;
          font-weight: 500;
          transition: color 0.2s;
        }
        
        .main-navigation a:hover {
          color: var(--primary-color);
        }
        
        .main-content {
          max-width: 1200px;
          margin: 0 auto;
          padding: 2rem;
        }
        
        .article-title {
          font-size: 2.5rem;
          font-weight: 700;
          margin-bottom: 1rem;
          color: var(--text-color);
        }
        
        .article-meta {
          color: var(--muted-color);
          font-size: 0.9rem;
          margin-bottom: 2rem;
          display: flex;
          gap: 1rem;
          flex-wrap: wrap;
        }
        
        .article-content {
          prose prose-lg max-w-none;
        }
        
        .article-content h1,
        .article-content h2,
        .article-content h3 {
          color: var(--text-color);
          margin-top: 2rem;
          margin-bottom: 1rem;
        }
        
        .article-content p {
          margin-bottom: 1.5rem;
        }
        
        .article-content a {
          color: var(--primary-color);
          text-decoration: none;
        }
        
        .article-content a:hover {
          text-decoration: underline;
        }
        
        .article-tags {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
          margin-top: 1rem;
        }
        
        .tag {
          background: var(--surface-color);
          color: var(--text-color);
          padding: 0.25rem 0.75rem;
          border-radius: 1rem;
          font-size: 0.875rem;
          text-decoration: none;
          border: 1px solid var(--border-color);
          transition: all 0.2s;
        }
        
        .tag:hover {
          background: var(--primary-color);
          color: white;
          border-color: var(--primary-color);
        }
        
        .table-of-contents {
          background: var(--surface-color);
          border: 1px solid var(--border-color);
          border-radius: 0.5rem;
          padding: 1.5rem;
          margin-bottom: 2rem;
        }
        
        .toc-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        
        .toc-item {
          margin: 0.5rem 0;
        }
        
        .toc-level-1 { margin-left: 0; font-weight: 600; }
        .toc-level-2 { margin-left: 1rem; }
        .toc-level-3 { margin-left: 2rem; }
        
        .site-footer {
          background: var(--surface-color);
          border-top: 1px solid var(--border-color);
          padding: 2rem 0;
          margin-top: 4rem;
          text-align: center;
          color: var(--muted-color);
        }
      `,
      
      academic: `
        /* Academic Theme */
        :root {
          --primary-color: #1e40af;
          --secondary-color: #6b7280;
          --background-color: #ffffff;
          --surface-color: #f9fafb;
          --text-color: #111827;
          --muted-color: #6b7280;
          --border-color: #d1d5db;
          --font-family: 'Charter', 'Times New Roman', serif;
          --font-mono: 'Source Code Pro', 'Monaco', monospace;
        }
        
        body {
          font-family: var(--font-family);
          line-height: 1.7;
          color: var(--text-color);
          background-color: var(--background-color);
          margin: 0;
          padding: 0;
          font-size: 18px;
        }
        
        .site-header {
          background: white;
          border-bottom: 2px solid var(--primary-color);
          padding: 1.5rem 0;
        }
        
        .article-title {
          font-size: 2.75rem;
          font-weight: 600;
          margin-bottom: 1.5rem;
          text-align: center;
          color: var(--primary-color);
        }
        
        .article-content {
          max-width: 45rem;
          margin: 0 auto;
          text-align: justify;
          hyphens: auto;
        }
        
        .article-content p {
          margin-bottom: 1.5rem;
          text-indent: 1.5rem;
        }
        
        .article-content p:first-child,
        .article-content h1 + p,
        .article-content h2 + p,
        .article-content h3 + p {
          text-indent: 0;
        }
        
        .article-content blockquote {
          border-left: 4px solid var(--primary-color);
          margin: 2rem 0;
          padding: 1rem 0 1rem 2rem;
          font-style: italic;
          background: var(--surface-color);
        }
        
        .table-of-contents {
          background: white;
          border: 2px solid var(--border-color);
          border-radius: 4px;
          padding: 2rem;
          margin: 2rem auto;
          max-width: 45rem;
        }
        
        .footnotes {
          border-top: 1px solid var(--border-color);
          margin-top: 3rem;
          padding-top: 1rem;
          font-size: 0.9rem;
        }
      `,
      
      blog: `
        /* Blog Theme */
        :root {
          --primary-color: #7c3aed;
          --secondary-color: #a78bfa;
          --background-color: #fafafa;
          --surface-color: #ffffff;
          --text-color: #1f2937;
          --muted-color: #6b7280;
          --border-color: #e5e7eb;
          --font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          --font-mono: 'JetBrains Mono', monospace;
        }
        
        body {
          font-family: var(--font-family);
          line-height: 1.6;
          color: var(--text-color);
          background-color: var(--background-color);
          margin: 0;
          padding: 0;
        }
        
        .site-header {
          background: var(--surface-color);
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          padding: 1rem 0;
          position: sticky;
          top: 0;
          z-index: 100;
        }
        
        .article-title {
          font-size: 2.5rem;
          font-weight: 800;
          margin-bottom: 1rem;
          background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        
        .article-meta {
          background: var(--surface-color);
          border-radius: 0.5rem;
          padding: 1rem;
          margin-bottom: 2rem;
          border-left: 4px solid var(--primary-color);
        }
        
        .article-content {
          background: var(--surface-color);
          border-radius: 0.75rem;
          padding: 2rem;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }
        
        .tag {
          background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
          color: white;
          padding: 0.5rem 1rem;
          border-radius: 2rem;
          font-size: 0.875rem;
          font-weight: 500;
          text-decoration: none;
          display: inline-block;
          transition: transform 0.2s;
        }
        
        .tag:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(124, 58, 237, 0.3);
        }
      `,
      
      documentation: `
        /* Documentation Theme */
        :root {
          --primary-color: #059669;
          --secondary-color: #10b981;
          --background-color: #ffffff;
          --surface-color: #f0fdf4;
          --text-color: #064e3b;
          --muted-color: #6b7280;
          --border-color: #d1fae5;
          --font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          --font-mono: 'SF Mono', Monaco, 'Cascadia Code', monospace;
        }
        
        body {
          font-family: var(--font-family);
          line-height: 1.6;
          color: var(--text-color);
          background-color: var(--background-color);
          margin: 0;
          padding: 0;
          display: grid;
          grid-template-columns: 280px 1fr;
          min-height: 100vh;
        }
        
        .sidebar {
          background: var(--surface-color);
          border-right: 1px solid var(--border-color);
          padding: 1rem;
          overflow-y: auto;
        }
        
        .main-content {
          padding: 2rem;
          max-width: none;
        }
        
        .article-title {
          font-size: 2.25rem;
          font-weight: 700;
          margin-bottom: 0.5rem;
          color: var(--primary-color);
          border-bottom: 2px solid var(--border-color);
          padding-bottom: 0.5rem;
        }
        
        .table-of-contents {
          position: sticky;
          top: 2rem;
          background: var(--surface-color);
          border: 1px solid var(--border-color);
          border-radius: 0.5rem;
          padding: 1rem;
          margin-bottom: 2rem;
        }
        
        .article-content pre {
          background: #1e293b;
          color: #e2e8f0;
          border-radius: 0.5rem;
          padding: 1.5rem;
          overflow-x: auto;
          font-family: var(--font-mono);
        }
        
        .article-content code {
          background: var(--surface-color);
          color: var(--primary-color);
          padding: 0.25rem 0.5rem;
          border-radius: 0.25rem;
          font-family: var(--font-mono);
          font-size: 0.9em;
        }
        
        .breadcrumbs {
          background: var(--surface-color);
          border-radius: 0.5rem;
          padding: 0.75rem 1rem;
          margin-bottom: 2rem;
        }
        
        .breadcrumb-list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          gap: 0.5rem;
        }
        
        .breadcrumb-item:not(:last-child)::after {
          content: '/';
          margin-left: 0.5rem;
          color: var(--muted-color);
        }
      `
    };
    
    return themes[theme as keyof typeof themes] || themes.minimal;
  }

  private generateComponentCSS(): string {
    return `
      /* Component styles */
      .internal-link { color: #0066cc; text-decoration: none; }
      .external-link { color: #cc6600; }
      .anchor-link { opacity: 0; margin-left: 0.25em; }
      h1:hover .anchor-link, h2:hover .anchor-link { opacity: 0.5; }
      .image-figure { text-align: center; margin: 1em 0; }
      .image-figure img { max-width: 100%; height: auto; }
      .image-figure figcaption { font-style: italic; color: #666; }
    `;
  }

  private generateKnowledgeGraphCSS(visualization?: string): string {
    // Implementation would return knowledge graph CSS
    return '';
  }

  private generateSearchCSS(): string {
    // Implementation would return search component CSS
    return '';
  }

  private minifyCSS(css: string): string {
    // Simple CSS minification
    return css
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\s+/g, ' ')
      .replace(/;\s*}/g, '}')
      .trim();
  }

  private generateBaseJavaScript(): string {
    return `
      // Base JavaScript functionality
      document.addEventListener('DOMContentLoaded', function() {
        // Initialize site functionality
      });
    `;
  }

  private async generateSearchJavaScript(searchType?: string): Promise<string> {
    // Implementation would return search functionality JavaScript
    return '';
  }

  private async generateKnowledgeGraphJavaScript(visualization?: string): Promise<string> {
    // Implementation would return knowledge graph JavaScript
    return '';
  }

  private generatePWAJavaScript(): string {
    // Implementation would return PWA service worker JavaScript
    return '';
  }

  private generateAnalyticsJavaScript(provider?: string, id?: string): string {
    // Implementation would return analytics tracking JavaScript
    return '';
  }

  private minifyJavaScript(js: string): string {
    // Simple JavaScript minification
    return js
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private async processImages(options: StaticSiteOptions): Promise<GeneratedAsset[]> {
    // Implementation would process and optimize images
    return [];
  }

  private async generatePWAAssets(siteConfig: any, options: StaticSiteOptions): Promise<GeneratedAsset[]> {
    // Implementation would generate PWA manifest and icons
    return [];
  }

  private async generateLunrIndex(documents: any[]): Promise<any> {
    // Implementation would create Lunr.js search index
    return {};
  }

  private async generateFuseIndex(documents: any[]): Promise<any> {
    // Implementation would create Fuse.js search index
    return {};
  }

  private async generateElasticLunrIndex(documents: any[]): Promise<any> {
    // Implementation would create ElasticLunr search index
    return {};
  }

  private async generateClientSideIndex(documents: any[]): Promise<any> {
    // Implementation would create simple client-side search index
    return { documents };
  }

  private calculateSitemapPriority(page: GeneratedPage): string {
    // Implementation would calculate sitemap priority based on page importance
    return '0.5';
  }

  private async optimizeAssets(assets: GeneratedAsset[], options: StaticSiteOptions): Promise<void> {
    // Implementation would optimize assets (compression, etc.)
  }

  private generateBuildManifest(pages: GeneratedPage[], assets: GeneratedAsset[], startTime: number, options: StaticSiteOptions): BuildManifest {
    return {
      buildId: this.generateHash(Date.now().toString()),
      timestamp: new Date(),
      totalPages: pages.length,
      totalAssets: assets.length,
      totalSize: pages.reduce((sum, page) => sum + page.size, 0) + assets.reduce((sum, asset) => sum + asset.size, 0),
      buildTime: Date.now() - startTime,
      version: this.mnemosyne.version,
      dependencies: {} // Would include package.json dependencies
    };
  }

  private async calculatePerformanceMetrics(pages: GeneratedPage[], assets: GeneratedAsset[], startTime: number): Promise<PerformanceMetrics> {
    return {
      buildTime: Date.now() - startTime,
      pageGenerationTime: 0, // Would track actual page generation time
      assetOptimizationTime: 0, // Would track asset optimization time
      averagePageSize: pages.reduce((sum, page) => sum + page.size, 0) / pages.length
    };
  }

  private async copyAssets(options: StaticSiteOptions): Promise<void> {
    // Implementation would copy additional asset directories
  }

  private async generateDevServer(options: StaticSiteOptions): Promise<void> {
    // Implementation would generate development server configuration
  }

  private async recordBuildAnalytics(site: GeneratedSite, buildTime: number): Promise<void> {
    await this.analytics.recordEvent({
      type: 'static_site_generation',
      data: {
        pages: site.pages.length,
        assets: site.assets.length,
        buildTime,
        totalSize: site.buildManifest.totalSize
      },
      timestamp: new Date()
    });
  }

  // Additional helper methods for complete implementation
  
  /**
   * Extract link context for backlinks
   */
  private async extractLinkContext(linkingDocId: string, targetDocId: string): Promise<string> {
    try {
      const linkingDoc = await this.mnemosyne.getDocument(linkingDocId);
      if (!linkingDoc) return '';
      
      const targetPage = this.siteStructure.pages.get(targetDocId);
      if (!targetPage) return '';
      
      // Find the paragraph containing the link
      const linkPattern = new RegExp(`\\[([^\\]]*${targetPage.title}[^\\]]*)\\]\\([^)]*\\)`, 'i');
      const sentences = linkingDoc.content.split(/[.!?]+/);
      
      for (const sentence of sentences) {
        if (linkPattern.test(sentence)) {
          return sentence.trim().substring(0, 150) + (sentence.length > 150 ? '...' : '');
        }
      }
      
      return '';
    } catch (error) {
      return '';
    }
  }

  /**
   * Find page by path
   */
  private findPageByPath(path: string): PageInfo | null {
    for (const page of this.siteStructure.pages.values()) {
      if (page.path === path || page.path === this.slugify(path)) {
        return page;
      }
    }
    return null;
  }

  /**
   * Find page by title
   */
  private findPageByTitle(title: string): PageInfo | null {
    for (const page of this.siteStructure.pages.values()) {
      if (page.title.toLowerCase() === title.toLowerCase() ||
          this.slugify(page.title) === this.slugify(title)) {
        return page;
      }
    }
    return null;
  }

  /**
   * Generate page description from content
   */
  private async generatePageDescription(pageInfo: PageInfo): Promise<string> {
    try {
      const doc = await this.mnemosyne.getDocument(pageInfo.id);
      if (!doc) return '';
      
      // Extract first paragraph or first 160 characters
      const plainText = doc.content.replace(/[#*_`\[\]]/g, '');
      const firstParagraph = plainText.split('\n').find(p => p.trim().length > 20);
      
      if (firstParagraph) {
        return firstParagraph.substring(0, 160) + (firstParagraph.length > 160 ? '...' : '');
      }
      
      return plainText.substring(0, 160) + (plainText.length > 160 ? '...' : '');
    } catch (error) {
      return '';
    }
  }

  /**
   * Get related pages by tags (fallback method)
   */
  private getRelatedPagesByTags(documentId: string, limit: number): any[] {
    const currentPage = this.siteStructure.pages.get(documentId);
    if (!currentPage || currentPage.tags.length === 0) return [];
    
    const related: Array<{ page: PageInfo; score: number }> = [];
    
    for (const page of this.siteStructure.pages.values()) {
      if (page.id === documentId) continue;
      
      const commonTags = page.tags.filter(tag => currentPage.tags.includes(tag));
      if (commonTags.length > 0) {
        const score = commonTags.length / Math.max(currentPage.tags.length, page.tags.length);
        related.push({ page, score });
      }
    }
    
    return related
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ page }) => ({
        id: page.id,
        title: page.title,
        path: page.path,
        tags: page.tags.slice(0, 3)
      }));
  }

  /**
   * Capitalize first letter
   */
  private capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Calculate tag weight for cloud visualization
   */
  private calculateTagWeight(count: number, allCounts: Map<string, number>): number {
    const max = Math.max(...allCounts.values());
    const min = Math.min(...allCounts.values());
    const range = max - min;
    
    if (range === 0) return 1;
    
    return Math.ceil(((count - min) / range) * 5) + 1; // Weight 1-6
  }

  /**
   * Get related tags
   */
  private getRelatedTags(tag: string, tagGroups: Map<string, PageInfo[]>): string[] {
    const currentPages = tagGroups.get(tag) || [];
    const relatedTags = new Map<string, number>();
    
    for (const page of currentPages) {
      for (const pageTag of page.tags) {
        if (pageTag !== tag) {
          relatedTags.set(pageTag, (relatedTags.get(pageTag) || 0) + 1);
        }
      }
    }
    
    return Array.from(relatedTags.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([tagName]) => tagName);
  }

  /**
   * Calculate graph density
   */
  private calculateGraphDensity(graph: KnowledgeGraphData | undefined): number {
    if (!graph || graph.nodes.length === 0) return 0;
    
    const nodeCount = graph.nodes.length;
    const edgeCount = graph.edges.length;
    const maxPossibleEdges = nodeCount * (nodeCount - 1) / 2;
    
    return maxPossibleEdges > 0 ? edgeCount / maxPossibleEdges : 0;
  }

  /**
   * Build navigation structure
   */
  private async buildNavigation(options: StaticSiteOptions): Promise<NavigationItem[]> {
    const navigation: NavigationItem[] = [
      { title: 'Home', path: '/', order: 1 }
    ];
    
    if (options.groupByTags) {
      navigation.push({ title: 'Tags', path: '/tags/', order: 2 });
    }
    
    if (options.groupByDate) {
      navigation.push({ title: 'Archive', path: '/archive/', order: 3 });
    }
    
    if (options.generateSearch) {
      navigation.push({ title: 'Search', path: '/search/', order: 4 });
    }
    
    if (options.includeKnowledgeGraph) {
      navigation.push({ title: 'Graph', path: '/graph/', order: 5 });
    }
    
    // Add top-level pages (pages without many backlinks)
    const topLevelPages = Array.from(this.siteStructure.pages.values())
      .filter(page => page.backlinks.length <= 2 && page.level === 1)
      .sort((a, b) => a.title.localeCompare(b.title))
      .slice(0, 8); // Limit to 8 top-level pages
    
    topLevelPages.forEach((page, index) => {
      navigation.push({
        title: page.title,
        path: `/${page.path}/`,
        order: 10 + index
      });
    });
    
    return navigation.sort((a, b) => (a.order || 999) - (b.order || 999));
  }

  /**
   * Build tag hierarchy
   */
  private buildTagHierarchy(): Map<string, string[]> {
    const hierarchy = new Map<string, string[]>();
    
    // Simple hierarchy based on tag patterns (can be enhanced)
    for (const page of this.siteStructure.pages.values()) {
      for (const tag of page.tags) {
        if (tag.includes('/') || tag.includes(':')) {
          // Hierarchical tag detected
          const parts = tag.split(/[\/:]/).map(p => p.trim());
          if (parts.length >= 2) {
            const parent = parts[0];
            const child = parts.slice(1).join('/');
            
            if (!hierarchy.has(parent)) {
              hierarchy.set(parent, []);
            }
            if (!hierarchy.get(parent)!.includes(child)) {
              hierarchy.get(parent)!.push(child);
            }
          }
        }
      }
    }
    
    return hierarchy;
  }

  /**
   * Build date hierarchy
   */
  private buildDateHierarchy(): Map<string, string[]> {
    const hierarchy = new Map<string, string[]>();
    
    for (const page of this.siteStructure.pages.values()) {
      const year = page.created.getFullYear().toString();
      const month = page.created.toLocaleDateString('en-US', { month: 'long' });
      
      if (!hierarchy.has(year)) {
        hierarchy.set(year, []);
      }
      if (!hierarchy.get(year)!.includes(month)) {
        hierarchy.get(year)!.push(month);
      }
    }
    
    // Sort months chronologically
    for (const [year, months] of hierarchy.entries()) {
      months.sort((a, b) => {
        const monthA = new Date(`${a} 1, ${year}`).getMonth();
        const monthB = new Date(`${b} 1, ${year}`).getMonth();
        return monthA - monthB;
      });
    }
    
    return hierarchy;
  }

  /**
   * Generate knowledge graph data for static site
   */
  private async generateKnowledgeGraphData(
    documents: MnemosyneDocument[],
    options: StaticSiteOptions
  ): Promise<KnowledgeGraphData> {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    
    // Create nodes for documents
    documents.forEach((doc, index) => {
      const pageInfo = this.siteStructure.pages.get(doc.id);
      if (pageInfo) {
        nodes.push({
          id: doc.id,
          label: doc.title,
          type: 'document',
          size: Math.log(pageInfo.backlinks.length + pageInfo.outlinks.length + 1) * 8 + 10,
          color: this.getNodeColorByType('document'),
          x: Math.cos(index / documents.length * 2 * Math.PI) * 200 + 400,
          y: Math.sin(index / documents.length * 2 * Math.PI) * 200 + 300
        });
      }
    });
    
    // Create nodes for tags
    const tagNodes = new Set<string>();
    for (const page of this.siteStructure.pages.values()) {
      for (const tag of page.tags) {
        if (!tagNodes.has(tag)) {
          tagNodes.add(tag);
          nodes.push({
            id: `tag-${tag}`,
            label: tag,
            type: 'tag',
            size: this.getTagFrequency(tag) * 3 + 5,
            color: this.getNodeColorByType('tag'),
            x: Math.random() * 800,
            y: Math.random() * 600
          });
        }
      }
    }
    
    // Create edges for document relationships
    for (const page of this.siteStructure.pages.values()) {
      // Document to document links
      page.outlinks.forEach(outlink => {
        const targetPage = this.findPageByPath(outlink) || this.findPageByTitle(outlink);
        if (targetPage) {
          edges.push({
            from: page.id,
            to: targetPage.id,
            type: 'reference',
            weight: 1,
            color: this.getEdgeColorByType('reference')
          });
        }
      });
      
      // Document to tag links
      page.tags.forEach(tag => {
        edges.push({
          from: page.id,
          to: `tag-${tag}`,
          type: 'tagged',
          weight: 0.5,
          color: this.getEdgeColorByType('tagged')
        });
      });
    }
    
    // Calculate clusters (simple clustering by tags)
    const clusters: GraphCluster[] = [];
    const processedTags = new Set<string>();
    
    for (const tag of tagNodes) {
      if (!processedTags.has(tag)) {
        const clusterNodes = nodes.filter(node => 
          node.type === 'document' && 
          this.siteStructure.pages.get(node.id)?.tags.includes(tag)
        );
        
        if (clusterNodes.length >= 2) {
          clusters.push({
            id: `cluster-${tag}`,
            nodes: clusterNodes.map(n => n.id),
            centroid: this.calculateCentroid(clusterNodes),
            color: this.getClusterColor(clusters.length)
          });
        }
        
        processedTags.add(tag);
      }
    }
    
    return {
      nodes,
      edges,
      clusters,
      metadata: {
        nodeCount: nodes.length,
        edgeCount: edges.length,
        density: this.calculateGraphDensity({ nodes, edges, clusters, metadata: { nodeCount: 0, edgeCount: 0, density: 0 } })
      }
    };
  }

  private getNodeColorByType(type: string): string {
    const colors = {
      document: '#3b82f6',
      tag: '#10b981',
      author: '#f59e0b',
      concept: '#8b5cf6'
    };
    return colors[type as keyof typeof colors] || '#6b7280';
  }

  private getEdgeColorByType(type: string): string {
    const colors = {
      reference: '#6366f1',
      tagged: '#059669',
      related: '#dc2626'
    };
    return colors[type as keyof typeof colors] || '#9ca3af';
  }

  private getTagFrequency(tag: string): number {
    let count = 0;
    for (const page of this.siteStructure.pages.values()) {
      if (page.tags.includes(tag)) count++;
    }
    return count;
  }

  private calculateCentroid(nodes: GraphNode[]): { x: number; y: number } {
    if (nodes.length === 0) return { x: 0, y: 0 };
    
    const sumX = nodes.reduce((sum, node) => sum + (node.x || 0), 0);
    const sumY = nodes.reduce((sum, node) => sum + (node.y || 0), 0);
    
    return {
      x: sumX / nodes.length,
      y: sumY / nodes.length
    };
  }

  private getClusterColor(index: number): string {
    const colors = ['#fef3c7', '#dbeafe', '#dcfce7', '#fce7f3', '#e0e7ff'];
    return colors[index % colors.length];
  }
}

// Additional type definitions
interface GraphNode {
  id: string;
  label: string;
  type: string;
  size: number;
  color: string;
  x?: number;
  y?: number;
}

interface GraphEdge {
  from: string;
  to: string;
  type: string;
  weight: number;
  color: string;
}

interface GraphCluster {
  id: string;
  nodes: string[];
  centroid: { x: number; y: number };
  color: string;
}

interface GraphMetadata {
  nodeCount: number;
  edgeCount: number;
  density: number;
}