/**
 * Page Generator - Handles generation of HTML pages from documents
 */

import { Document as MnemosyneDocument } from '../../../../core/MnemosyneCore';
import { MnemosyneTemplateEngine } from '../../../templates/TemplateEngine';
import { 
  StaticSiteOptions,
  SiteStructure,
  SiteConfiguration,
  GeneratedPage,
  PageMetadata
} from '../core/types';
import { marked } from 'marked';
import { JSDOM } from 'jsdom';
import * as path from 'path';
import { createHash } from 'crypto';

export class PageGenerator {
  private templateEngine: MnemosyneTemplateEngine;
  private markdownRenderer: marked.Renderer;
  
  constructor(templateEngine: MnemosyneTemplateEngine) {
    this.templateEngine = templateEngine;
    this.markdownRenderer = new marked.Renderer();
    this.configureMarkdownRenderer();
  }

  /**
   * Generate pages from documents
   */
  async generatePages(
    documents: MnemosyneDocument[],
    siteStructure: SiteStructure,
    config: SiteConfiguration,
    options: StaticSiteOptions
  ): Promise<GeneratedPage[]> {
    const pages: GeneratedPage[] = [];
    
    for (const doc of documents) {
      const page = await this.generatePage(doc, siteStructure, config, options);
      pages.push(page);
    }
    
    return pages;
  }

  /**
   * Generate a single page from a document
   */
  async generatePage(
    document: MnemosyneDocument,
    siteStructure: SiteStructure,
    config: SiteConfiguration,
    options: StaticSiteOptions
  ): Promise<GeneratedPage> {
    // Get page info from site structure
    const pageInfo = siteStructure.pages.get(document.id);
    if (!pageInfo) {
      throw new Error(`Page info not found for document ${document.id}`);
    }
    
    // Convert markdown to HTML
    const contentHtml = await this.renderMarkdown(document.content || '', options);
    
    // Extract metadata
    const metadata = this.extractMetadata(document, pageInfo, contentHtml);
    
    // Generate breadcrumbs
    const breadcrumbs = options.includeBreadcrumbs 
      ? this.generateBreadcrumbs(pageInfo, siteStructure)
      : [];
    
    // Get related pages
    const relatedPages = this.getRelatedPages(document, siteStructure, 5);
    
    // Render page using template
    const templateData = {
      document,
      content: contentHtml,
      metadata,
      config,
      breadcrumbs,
      relatedPages,
      backlinks: pageInfo.backlinks.map(id => siteStructure.pages.get(id)).filter(Boolean),
      navigation: config.navigation,
      currentPath: pageInfo.path
    };
    
    const pageHtml = await this.templateEngine.render(
      options.templateId || 'default-page',
      templateData
    );
    
    // Post-process HTML
    const processedHtml = await this.postProcessHtml(pageHtml, options);
    
    return {
      path: this.generatePagePath(document, options),
      title: metadata.title,
      content: processedHtml,
      metadata,
      dependencies: this.extractDependencies(processedHtml),
      size: Buffer.byteLength(processedHtml, 'utf8'),
      generatedAt: new Date()
    };
  }

  /**
   * Generate index page
   */
  async generateIndexPage(
    siteStructure: SiteStructure,
    config: SiteConfiguration,
    options: StaticSiteOptions
  ): Promise<GeneratedPage> {
    const recentPages = Array.from(siteStructure.pages.values())
      .sort((a, b) => b.modified.getTime() - a.modified.getTime())
      .slice(0, 10);
    
    const templateData = {
      config,
      recentPages,
      totalPages: siteStructure.pages.size,
      tagCloud: this.generateTagCloud(siteStructure),
      navigation: config.navigation
    };
    
    const content = await this.templateEngine.render('index', templateData);
    
    return {
      path: 'index.html',
      title: config.siteName,
      content,
      metadata: {
        title: config.siteName,
        description: config.metadata.description
      },
      dependencies: [],
      size: Buffer.byteLength(content, 'utf8'),
      generatedAt: new Date()
    };
  }

  /**
   * Generate 404 page
   */
  async generate404Page(
    config: SiteConfiguration,
    options: StaticSiteOptions
  ): Promise<GeneratedPage> {
    const content = await this.templateEngine.render('404', { config });
    
    return {
      path: '404.html',
      title: 'Page Not Found',
      content,
      metadata: {
        title: 'Page Not Found',
        description: 'The requested page could not be found.'
      },
      dependencies: [],
      size: Buffer.byteLength(content, 'utf8'),
      generatedAt: new Date()
    };
  }

  /**
   * Generate search page
   */
  async generateSearchPage(
    config: SiteConfiguration,
    options: StaticSiteOptions
  ): Promise<GeneratedPage> {
    const content = await this.templateEngine.render('search', { 
      config,
      searchType: options.searchType || 'lunr'
    });
    
    return {
      path: 'search.html',
      title: 'Search',
      content,
      metadata: {
        title: 'Search',
        description: 'Search the knowledge base'
      },
      dependencies: ['assets/js/search.js'],
      size: Buffer.byteLength(content, 'utf8'),
      generatedAt: new Date()
    };
  }

  /**
   * Generate tag pages
   */
  async generateTagPages(
    siteStructure: SiteStructure,
    config: SiteConfiguration,
    options: StaticSiteOptions
  ): Promise<GeneratedPage[]> {
    const pages: GeneratedPage[] = [];
    
    for (const [tag, pageIds] of siteStructure.tagHierarchy) {
      const tagPages = pageIds
        .map(id => siteStructure.pages.get(id))
        .filter(Boolean);
      
      const content = await this.templateEngine.render('tag', {
        config,
        tag,
        pages: tagPages
      });
      
      pages.push({
        path: `tags/${this.slugify(tag)}.html`,
        title: `Tag: ${tag}`,
        content,
        metadata: {
          title: `Tag: ${tag}`,
          description: `Pages tagged with "${tag}"`
        },
        dependencies: [],
        size: Buffer.byteLength(content, 'utf8'),
        generatedAt: new Date()
      });
    }
    
    return pages;
  }

  /**
   * Configure markdown renderer
   */
  private configureMarkdownRenderer(): void {
    // Add custom rendering for links
    this.markdownRenderer.link = (href: string, title: string, text: string) => {
      const isExternal = /^https?:\/\//.test(href);
      const attrs = isExternal ? ' target="_blank" rel="noopener"' : '';
      return `<a href="${href}"${attrs}${title ? ` title="${title}"` : ''}>${text}</a>`;
    };
    
    // Add custom rendering for code blocks
    this.markdownRenderer.code = (code: string, language?: string) => {
      const lang = language || 'plaintext';
      return `<pre><code class="language-${lang}" data-lang="${lang}">${this.escapeHtml(code)}</code></pre>`;
    };
    
    marked.setOptions({
      renderer: this.markdownRenderer,
      gfm: true,
      breaks: true,
      pedantic: false,
      sanitize: false,
      smartLists: true,
      smartypants: true
    });
  }

  /**
   * Render markdown to HTML
   */
  private async renderMarkdown(content: string, options: StaticSiteOptions): Promise<string> {
    let html = marked(content);
    
    // Apply syntax highlighting if enabled
    if (options.customJS?.includes('prism') || options.customJS?.includes('highlight')) {
      // Syntax highlighting will be applied client-side
    }
    
    return html;
  }

  /**
   * Extract metadata from document and content
   */
  private extractMetadata(
    document: MnemosyneDocument,
    pageInfo: any,
    contentHtml: string
  ): PageMetadata {
    const dom = new JSDOM(contentHtml);
    const text = dom.window.document.body.textContent || '';
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    const readingTime = Math.ceil(wordCount / 200); // Assuming 200 wpm
    
    return {
      title: document.title,
      description: document.metadata?.description || this.extractDescription(text),
      keywords: document.metadata?.keywords || pageInfo.tags,
      author: document.metadata?.author,
      created: pageInfo.created,
      modified: pageInfo.modified,
      tags: pageInfo.tags,
      readingTime,
      wordCount,
      relatedPages: pageInfo.outlinks
    };
  }

  /**
   * Extract description from text
   */
  private extractDescription(text: string, maxLength: number = 160): string {
    const cleanText = text.replace(/\s+/g, ' ').trim();
    if (cleanText.length <= maxLength) {
      return cleanText;
    }
    return cleanText.substring(0, maxLength - 3) + '...';
  }

  /**
   * Generate breadcrumbs
   */
  private generateBreadcrumbs(pageInfo: any, siteStructure: SiteStructure): any[] {
    const breadcrumbs = [];
    let current = pageInfo;
    
    while (current && current.level > 0) {
      breadcrumbs.unshift({
        title: current.title,
        path: current.path
      });
      // Find parent page based on path hierarchy
      const parentPath = path.dirname(current.path);
      current = Array.from(siteStructure.pages.values())
        .find(p => p.path === parentPath + '/index.html');
    }
    
    breadcrumbs.unshift({
      title: 'Home',
      path: '/'
    });
    
    return breadcrumbs;
  }

  /**
   * Get related pages based on tags and links
   */
  private getRelatedPages(
    document: MnemosyneDocument,
    siteStructure: SiteStructure,
    limit: number = 5
  ): any[] {
    const pageInfo = siteStructure.pages.get(document.id);
    if (!pageInfo) return [];
    
    const scores = new Map<string, number>();
    
    // Score by shared tags
    for (const [id, page] of siteStructure.pages) {
      if (id === document.id) continue;
      
      const sharedTags = page.tags.filter(tag => pageInfo.tags.includes(tag));
      if (sharedTags.length > 0) {
        scores.set(id, sharedTags.length * 2);
      }
    }
    
    // Boost score for backlinks
    for (const backlinkId of pageInfo.backlinks) {
      const currentScore = scores.get(backlinkId) || 0;
      scores.set(backlinkId, currentScore + 3);
    }
    
    // Boost score for outlinks
    for (const outlinkId of pageInfo.outlinks) {
      const currentScore = scores.get(outlinkId) || 0;
      scores.set(outlinkId, currentScore + 1);
    }
    
    // Sort by score and return top results
    return Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([id]) => siteStructure.pages.get(id))
      .filter(Boolean);
  }

  /**
   * Post-process HTML
   */
  private async postProcessHtml(html: string, options: StaticSiteOptions): Promise<string> {
    const dom = new JSDOM(html);
    const document = dom.window.document;
    
    // Add lazy loading to images
    if (options.enableLazyLoading) {
      const images = document.querySelectorAll('img');
      images.forEach(img => {
        img.setAttribute('loading', 'lazy');
      });
    }
    
    // Add SEO meta tags
    if (options.enableSEO) {
      this.addSEOTags(document, options);
    }
    
    return dom.serialize();
  }

  /**
   * Add SEO meta tags
   */
  private addSEOTags(document: any, options: StaticSiteOptions): void {
    const head = document.head;
    
    // Add canonical URL
    if (options.baseUrl) {
      const canonical = document.createElement('link');
      canonical.rel = 'canonical';
      canonical.href = options.baseUrl + document.location.pathname;
      head.appendChild(canonical);
    }
    
    // Add robots meta
    const robots = document.createElement('meta');
    robots.name = 'robots';
    robots.content = 'index,follow';
    head.appendChild(robots);
  }

  /**
   * Extract dependencies from HTML
   */
  private extractDependencies(html: string): string[] {
    const dom = new JSDOM(html);
    const document = dom.window.document;
    const dependencies: string[] = [];
    
    // Extract CSS dependencies
    document.querySelectorAll('link[rel="stylesheet"]').forEach((link: any) => {
      dependencies.push(link.href);
    });
    
    // Extract JS dependencies
    document.querySelectorAll('script[src]').forEach((script: any) => {
      dependencies.push(script.src);
    });
    
    return dependencies;
  }

  /**
   * Generate page path from document
   */
  private generatePagePath(document: MnemosyneDocument, options: StaticSiteOptions): string {
    const slug = this.slugify(document.title);
    const ext = '.html';
    
    // Organize by date if enabled
    if (options.groupByDate && document.metadata?.created) {
      const date = new Date(document.metadata.created);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      return `${year}/${month}/${slug}${ext}`;
    }
    
    // Default flat structure
    return `pages/${slug}${ext}`;
  }

  /**
   * Generate tag cloud
   */
  private generateTagCloud(siteStructure: SiteStructure): any[] {
    const tagCounts = new Map<string, number>();
    
    for (const [tag, pageIds] of siteStructure.tagHierarchy) {
      tagCounts.set(tag, pageIds.length);
    }
    
    const maxCount = Math.max(...tagCounts.values());
    const minCount = Math.min(...tagCounts.values());
    
    return Array.from(tagCounts.entries()).map(([tag, count]) => ({
      tag,
      count,
      size: this.calculateTagSize(count, minCount, maxCount)
    }));
  }

  /**
   * Calculate tag size for tag cloud
   */
  private calculateTagSize(count: number, min: number, max: number): string {
    if (max === min) return 'medium';
    
    const normalized = (count - min) / (max - min);
    if (normalized < 0.2) return 'small';
    if (normalized < 0.4) return 'medium-small';
    if (normalized < 0.6) return 'medium';
    if (normalized < 0.8) return 'medium-large';
    return 'large';
  }

  /**
   * Convert string to URL-friendly slug
   */
  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  /**
   * Escape HTML
   */
  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }
}