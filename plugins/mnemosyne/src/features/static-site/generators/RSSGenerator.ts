/**
 * RSS Generator - Generates RSS feed for content syndication
 */

import { GeneratedPage, SiteConfiguration, StaticSiteOptions } from '../core/types';
import * as fs from 'fs/promises';
import * as path from 'path';

interface RSSItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  guid: string;
  author?: string;
  category?: string[];
}

export class RSSGenerator {
  /**
   * Generate RSS feed
   */
  async generate(
    pages: GeneratedPage[],
    config: SiteConfiguration,
    options: StaticSiteOptions
  ): Promise<void> {
    // Get recent pages for feed
    const feedPages = this.selectPagesForFeed(pages, options);
    
    // Generate RSS XML
    const rssXml = this.generateRSSXML(feedPages, config, options);
    
    // Write RSS feed
    const rssPath = path.join(options.outputDir, 'rss.xml');
    await fs.writeFile(rssPath, rssXml, 'utf8');
    
    // Also generate Atom feed for better compatibility
    const atomXml = this.generateAtomXML(feedPages, config, options);
    const atomPath = path.join(options.outputDir, 'atom.xml');
    await fs.writeFile(atomPath, atomXml, 'utf8');
    
    // Generate JSON feed for modern readers
    const jsonFeed = this.generateJSONFeed(feedPages, config, options);
    const jsonPath = path.join(options.outputDir, 'feed.json');
    await fs.writeFile(jsonPath, JSON.stringify(jsonFeed, null, 2), 'utf8');
  }

  /**
   * Select pages to include in feed
   */
  private selectPagesForFeed(
    pages: GeneratedPage[],
    options: StaticSiteOptions
  ): GeneratedPage[] {
    return pages
      .filter(page => this.shouldIncludeInFeed(page))
      .sort((a, b) => {
        // Sort by modified date, most recent first
        const dateA = a.metadata.modified || a.metadata.created || new Date(0);
        const dateB = b.metadata.modified || b.metadata.created || new Date(0);
        return dateB.getTime() - dateA.getTime();
      })
      .slice(0, 20); // Limit to 20 most recent items
  }

  /**
   * Generate RSS 2.0 XML
   */
  private generateRSSXML(
    pages: GeneratedPage[],
    config: SiteConfiguration,
    options: StaticSiteOptions
  ): string {
    const baseUrl = options.baseUrl || 'https://example.com';
    const buildDate = new Date().toUTCString();
    
    const items = pages.map(page => this.createRSSItem(page, baseUrl));
    const itemsXml = items.map(item => this.generateRSSItemXML(item)).join('\n');
    
    return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" 
     xmlns:atom="http://www.w3.org/2005/Atom"
     xmlns:dc="http://purl.org/dc/elements/1.1/"
     xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${this.escapeXml(config.siteName)}</title>
    <link>${baseUrl}</link>
    <description>${this.escapeXml(config.metadata.description || '')}</description>
    <language>${config.metadata.language || 'en'}</language>
    <lastBuildDate>${buildDate}</lastBuildDate>
    <generator>Mnemosyne Static Site Generator</generator>
    <atom:link href="${baseUrl}/rss.xml" rel="self" type="application/rss+xml"/>
${itemsXml}
  </channel>
</rss>`;
  }

  /**
   * Generate Atom XML
   */
  private generateAtomXML(
    pages: GeneratedPage[],
    config: SiteConfiguration,
    options: StaticSiteOptions
  ): string {
    const baseUrl = options.baseUrl || 'https://example.com';
    const updated = new Date().toISOString();
    
    const entries = pages.map(page => this.generateAtomEntry(page, baseUrl));
    const entriesXml = entries.join('\n');
    
    return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${this.escapeXml(config.siteName)}</title>
  <link href="${baseUrl}"/>
  <link href="${baseUrl}/atom.xml" rel="self" type="application/atom+xml"/>
  <updated>${updated}</updated>
  <id>${baseUrl}/</id>
  <author>
    <name>${this.escapeXml(config.metadata.author || 'Unknown')}</name>
  </author>
  <generator>Mnemosyne</generator>
${entriesXml}
</feed>`;
  }

  /**
   * Generate JSON Feed
   */
  private generateJSONFeed(
    pages: GeneratedPage[],
    config: SiteConfiguration,
    options: StaticSiteOptions
  ): any {
    const baseUrl = options.baseUrl || 'https://example.com';
    
    return {
      version: 'https://jsonfeed.org/version/1.1',
      title: config.siteName,
      home_page_url: baseUrl,
      feed_url: `${baseUrl}/feed.json`,
      description: config.metadata.description,
      language: config.metadata.language || 'en',
      authors: [
        {
          name: config.metadata.author || 'Unknown'
        }
      ],
      items: pages.map(page => ({
        id: `${baseUrl}/${page.path}`,
        url: `${baseUrl}/${page.path}`,
        title: page.metadata.title,
        summary: page.metadata.description,
        content_html: this.getPageContentForFeed(page),
        date_published: page.metadata.created?.toISOString(),
        date_modified: page.metadata.modified?.toISOString(),
        tags: page.metadata.tags,
        authors: page.metadata.author ? [{ name: page.metadata.author }] : undefined
      }))
    };
  }

  /**
   * Create RSS item from page
   */
  private createRSSItem(page: GeneratedPage, baseUrl: string): RSSItem {
    return {
      title: page.metadata.title,
      link: `${baseUrl}/${page.path}`,
      description: page.metadata.description || this.generateDescription(page),
      pubDate: (page.metadata.modified || page.metadata.created || new Date()).toUTCString(),
      guid: `${baseUrl}/${page.path}`,
      author: page.metadata.author,
      category: page.metadata.tags
    };
  }

  /**
   * Generate RSS item XML
   */
  private generateRSSItemXML(item: RSSItem): string {
    let xml = '    <item>\n';
    xml += `      <title>${this.escapeXml(item.title)}</title>\n`;
    xml += `      <link>${this.escapeXml(item.link)}</link>\n`;
    xml += `      <description>${this.escapeXml(item.description)}</description>\n`;
    xml += `      <pubDate>${item.pubDate}</pubDate>\n`;
    xml += `      <guid isPermaLink="true">${this.escapeXml(item.guid)}</guid>\n`;
    
    if (item.author) {
      xml += `      <dc:creator>${this.escapeXml(item.author)}</dc:creator>\n`;
    }
    
    if (item.category) {
      item.category.forEach(cat => {
        xml += `      <category>${this.escapeXml(cat)}</category>\n`;
      });
    }
    
    xml += '    </item>';
    return xml;
  }

  /**
   * Generate Atom entry
   */
  private generateAtomEntry(page: GeneratedPage, baseUrl: string): string {
    const url = `${baseUrl}/${page.path}`;
    const published = page.metadata.created?.toISOString() || new Date().toISOString();
    const updated = page.metadata.modified?.toISOString() || published;
    
    let xml = '  <entry>\n';
    xml += `    <title>${this.escapeXml(page.metadata.title)}</title>\n`;
    xml += `    <link href="${this.escapeXml(url)}"/>\n`;
    xml += `    <id>${this.escapeXml(url)}</id>\n`;
    xml += `    <published>${published}</published>\n`;
    xml += `    <updated>${updated}</updated>\n`;
    
    if (page.metadata.author) {
      xml += `    <author><name>${this.escapeXml(page.metadata.author)}</name></author>\n`;
    }
    
    if (page.metadata.description) {
      xml += `    <summary>${this.escapeXml(page.metadata.description)}</summary>\n`;
    }
    
    const content = this.getPageContentForFeed(page);
    xml += `    <content type="html">${this.escapeXml(content)}</content>\n`;
    
    if (page.metadata.tags) {
      page.metadata.tags.forEach(tag => {
        xml += `    <category term="${this.escapeXml(tag)}"/>\n`;
      });
    }
    
    xml += '  </entry>';
    return xml;
  }

  /**
   * Get page content for feed
   */
  private getPageContentForFeed(page: GeneratedPage): string {
    // Extract main content from page HTML
    const contentRegex = /<main[^>]*>([\s\S]*?)<\/main>/i;
    const match = page.content.match(contentRegex);
    
    if (match) {
      return match[1].trim();
    }
    
    // Fallback: try article tag
    const articleRegex = /<article[^>]*>([\s\S]*?)<\/article>/i;
    const articleMatch = page.content.match(articleRegex);
    
    if (articleMatch) {
      return articleMatch[1].trim();
    }
    
    // Last resort: return description
    return page.metadata.description || '';
  }

  /**
   * Generate description from page
   */
  private generateDescription(page: GeneratedPage): string {
    // Try to extract first paragraph from content
    const paragraphRegex = /<p[^>]*>(.*?)<\/p>/i;
    const match = page.content.match(paragraphRegex);
    
    if (match) {
      // Strip HTML tags
      return match[1].replace(/<[^>]*>/g, '').substring(0, 200) + '...';
    }
    
    return 'No description available';
  }

  /**
   * Check if page should be included in feed
   */
  private shouldIncludeInFeed(page: GeneratedPage): boolean {
    // Exclude special pages
    const excludePaths = ['404.html', 'search.html', 'index.html'];
    if (excludePaths.includes(page.path)) {
      return false;
    }
    
    // Exclude tag and archive pages
    if (page.path.includes('/tags/') || page.path.includes('/archive/')) {
      return false;
    }
    
    // Exclude pages without dates
    if (!page.metadata.created && !page.metadata.modified) {
      return false;
    }
    
    // Exclude draft or private pages
    if (page.metadata.tags?.includes('draft') || page.metadata.tags?.includes('private')) {
      return false;
    }
    
    return true;
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