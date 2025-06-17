/**
 * Sitemap Generator - Generates XML sitemap for SEO
 */

import { GeneratedPage, StaticSiteOptions } from '../core/types';
import * as fs from 'fs/promises';
import * as path from 'path';

interface SitemapEntry {
  loc: string;
  lastmod?: string;
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority?: number;
}

export class SitemapGenerator {
  /**
   * Generate XML sitemap
   */
  async generate(
    pages: GeneratedPage[],
    options: StaticSiteOptions
  ): Promise<string> {
    const entries = this.createSitemapEntries(pages, options);
    const xml = this.generateXML(entries);
    
    // Write sitemap to file
    const sitemapPath = path.join(options.outputDir, 'sitemap.xml');
    await fs.writeFile(sitemapPath, xml, 'utf8');
    
    // Also generate sitemap index if there are many pages
    if (entries.length > 50000) {
      await this.generateSitemapIndex(entries, options);
    }
    
    return sitemapPath;
  }

  /**
   * Create sitemap entries from pages
   */
  private createSitemapEntries(
    pages: GeneratedPage[],
    options: StaticSiteOptions
  ): SitemapEntry[] {
    const baseUrl = options.baseUrl || 'https://example.com';
    
    return pages
      .filter(page => !this.shouldExcludeFromSitemap(page))
      .map(page => {
        const entry: SitemapEntry = {
          loc: this.buildAbsoluteUrl(page.path, baseUrl),
          lastmod: page.metadata.modified?.toISOString() || new Date().toISOString(),
          changefreq: this.determineChangeFrequency(page),
          priority: this.determinePriority(page)
        };
        
        return entry;
      })
      .sort((a, b) => b.priority! - a.priority!);
  }

  /**
   * Generate XML from entries
   */
  private generateXML(entries: SitemapEntry[]): string {
    const xmlEntries = entries.map(entry => this.generateURLElement(entry)).join('\n');
    
    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
${xmlEntries}
</urlset>`;
  }

  /**
   * Generate URL element
   */
  private generateURLElement(entry: SitemapEntry): string {
    let xml = '  <url>\n';
    xml += `    <loc>${this.escapeXml(entry.loc)}</loc>\n`;
    
    if (entry.lastmod) {
      xml += `    <lastmod>${entry.lastmod}</lastmod>\n`;
    }
    
    if (entry.changefreq) {
      xml += `    <changefreq>${entry.changefreq}</changefreq>\n`;
    }
    
    if (entry.priority !== undefined) {
      xml += `    <priority>${entry.priority.toFixed(1)}</priority>\n`;
    }
    
    xml += '  </url>';
    return xml;
  }

  /**
   * Generate sitemap index for large sites
   */
  private async generateSitemapIndex(
    entries: SitemapEntry[],
    options: StaticSiteOptions
  ): Promise<void> {
    const baseUrl = options.baseUrl || 'https://example.com';
    const sitemapsPerFile = 50000;
    const sitemapCount = Math.ceil(entries.length / sitemapsPerFile);
    
    let indexXml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;
    
    for (let i = 0; i < sitemapCount; i++) {
      const sitemapFile = `sitemap-${i + 1}.xml`;
      const sitemapEntries = entries.slice(i * sitemapsPerFile, (i + 1) * sitemapsPerFile);
      
      // Generate individual sitemap
      const sitemapXml = this.generateXML(sitemapEntries);
      const sitemapPath = path.join(options.outputDir, sitemapFile);
      await fs.writeFile(sitemapPath, sitemapXml, 'utf8');
      
      // Add to index
      indexXml += `
  <sitemap>
    <loc>${baseUrl}/${sitemapFile}</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
  </sitemap>`;
    }
    
    indexXml += '\n</sitemapindex>';
    
    // Write sitemap index
    const indexPath = path.join(options.outputDir, 'sitemap.xml');
    await fs.writeFile(indexPath, indexXml, 'utf8');
  }

  /**
   * Build absolute URL
   */
  private buildAbsoluteUrl(pagePath: string, baseUrl: string): string {
    // Ensure base URL doesn't end with slash
    const base = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    
    // Ensure page path starts with slash
    const path = pagePath.startsWith('/') ? pagePath : '/' + pagePath;
    
    return base + path;
  }

  /**
   * Determine change frequency based on page metadata
   */
  private determineChangeFrequency(page: GeneratedPage): SitemapEntry['changefreq'] {
    // If page was recently modified, it's likely to change more frequently
    const daysSinceModified = page.metadata.modified 
      ? (Date.now() - page.metadata.modified.getTime()) / (1000 * 60 * 60 * 24)
      : Infinity;
    
    if (daysSinceModified < 1) return 'daily';
    if (daysSinceModified < 7) return 'weekly';
    if (daysSinceModified < 30) return 'monthly';
    if (daysSinceModified < 365) return 'yearly';
    
    return 'yearly';
  }

  /**
   * Determine priority based on page characteristics
   */
  private determinePriority(page: GeneratedPage): number {
    let priority = 0.5; // Default priority
    
    // Home page gets highest priority
    if (page.path === 'index.html' || page.path === '/') {
      return 1.0;
    }
    
    // Important pages get higher priority
    const importantPaths = ['about', 'contact', 'documentation', 'guide', 'api'];
    if (importantPaths.some(path => page.path.includes(path))) {
      priority = 0.8;
    }
    
    // Tag and archive pages get lower priority
    if (page.path.includes('/tags/') || page.path.includes('/archive/')) {
      priority = 0.3;
    }
    
    // Adjust based on page depth
    const depth = page.path.split('/').length - 1;
    priority -= depth * 0.1;
    
    // Ensure priority is between 0.1 and 1.0
    return Math.max(0.1, Math.min(1.0, priority));
  }

  /**
   * Check if page should be excluded from sitemap
   */
  private shouldExcludeFromSitemap(page: GeneratedPage): boolean {
    // Exclude error pages
    if (page.path.includes('404') || page.path.includes('error')) {
      return true;
    }
    
    // Exclude pages with noindex tag
    if (page.metadata.tags?.includes('noindex')) {
      return true;
    }
    
    // Exclude private or draft pages
    if (page.metadata.tags?.includes('private') || page.metadata.tags?.includes('draft')) {
      return true;
    }
    
    return false;
  }

  /**
   * Escape XML special characters
   */
  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}