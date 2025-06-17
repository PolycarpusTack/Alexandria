/**
 * Search Index Generator - Generates search indices for different search engines
 */

import { GeneratedPage, StaticSiteOptions } from '../core/types';
import { JSDOM } from 'jsdom';
import * as fs from 'fs/promises';
import * as path from 'path';

interface SearchDocument {
  id: string;
  title: string;
  content: string;
  tags: string[];
  url: string;
  created?: string;
  modified?: string;
}

export class SearchIndexGenerator {
  /**
   * Generate search index based on selected search engine
   */
  async generateIndex(
    pages: GeneratedPage[],
    options: StaticSiteOptions
  ): Promise<any> {
    const documents = this.extractSearchDocuments(pages);
    
    switch (options.searchType || 'lunr') {
      case 'lunr':
        return this.generateLunrIndex(documents, options);
      case 'fuse':
        return this.generateFuseIndex(documents, options);
      case 'elasticlunr':
        return this.generateElasticlunrIndex(documents, options);
      case 'client-side':
      default:
        return this.generateClientSideIndex(documents, options);
    }
  }

  /**
   * Extract searchable documents from pages
   */
  private extractSearchDocuments(pages: GeneratedPage[]): SearchDocument[] {
    return pages
      .filter(page => !this.shouldExcludeFromSearch(page))
      .map(page => {
        const text = this.extractTextContent(page.content);
        
        return {
          id: this.generateDocumentId(page),
          title: page.metadata.title,
          content: this.truncateContent(text, 1000), // Limit content size
          tags: page.metadata.tags || [],
          url: page.path,
          created: page.metadata.created?.toISOString(),
          modified: page.metadata.modified?.toISOString()
        };
      });
  }

  /**
   * Generate Lunr.js index
   */
  private async generateLunrIndex(
    documents: SearchDocument[],
    options: StaticSiteOptions
  ): Promise<any> {
    // Lunr.js expects the index to be built client-side
    // We'll prepare the documents for client-side indexing
    const indexData = {
      documents: documents.reduce((acc, doc) => {
        acc[doc.id] = doc;
        return acc;
      }, {} as Record<string, SearchDocument>)
    };
    
    // Write index data to file
    await this.writeIndexFile(indexData, options);
    
    return indexData;
  }

  /**
   * Generate Fuse.js index
   */
  private async generateFuseIndex(
    documents: SearchDocument[],
    options: StaticSiteOptions
  ): Promise<any> {
    // Fuse.js can work with raw documents
    const indexData = {
      documents,
      options: {
        keys: ['title', 'content', 'tags'],
        threshold: 0.3,
        includeScore: true,
        includeMatches: true,
        minMatchCharLength: 2
      }
    };
    
    await this.writeIndexFile(indexData, options);
    
    return indexData;
  }

  /**
   * Generate Elasticlunr index
   */
  private async generateElasticlunrIndex(
    documents: SearchDocument[],
    options: StaticSiteOptions
  ): Promise<any> {
    // Similar to Lunr, Elasticlunr builds index client-side
    const indexData = {
      documents,
      fields: ['title', 'content', 'tags'],
      ref: 'id'
    };
    
    await this.writeIndexFile(indexData, options);
    
    return indexData;
  }

  /**
   * Generate simple client-side search index
   */
  private async generateClientSideIndex(
    documents: SearchDocument[],
    options: StaticSiteOptions
  ): Promise<any> {
    // For simple client-side search, we provide all documents
    const indexData = {
      documents,
      metadata: {
        totalDocuments: documents.length,
        indexedAt: new Date().toISOString(),
        fields: ['title', 'content', 'tags']
      }
    };
    
    await this.writeIndexFile(indexData, options);
    
    // Also generate a compressed version for better performance
    if (options.enableCompression) {
      await this.writeCompressedIndex(indexData, options);
    }
    
    return indexData;
  }

  /**
   * Write index file to disk
   */
  private async writeIndexFile(
    indexData: any,
    options: StaticSiteOptions
  ): Promise<void> {
    const indexPath = path.join(options.outputDir, 'search', 'index.json');
    await fs.mkdir(path.dirname(indexPath), { recursive: true });
    
    const jsonContent = JSON.stringify(indexData, null, options.enableMinification ? 0 : 2);
    await fs.writeFile(indexPath, jsonContent, 'utf8');
  }

  /**
   * Write compressed index for better performance
   */
  private async writeCompressedIndex(
    indexData: any,
    options: StaticSiteOptions
  ): Promise<void> {
    const gzip = await import('zlib');
    const { promisify } = await import('util');
    const compress = promisify(gzip.gzip);
    
    const jsonContent = JSON.stringify(indexData);
    const compressed = await compress(jsonContent);
    
    const compressedPath = path.join(options.outputDir, 'search', 'index.json.gz');
    await fs.writeFile(compressedPath, compressed);
  }

  /**
   * Extract text content from HTML
   */
  private extractTextContent(html: string): string {
    const dom = new JSDOM(html);
    const document = dom.window.document;
    
    // Remove script and style elements
    document.querySelectorAll('script, style').forEach(el => el.remove());
    
    // Remove navigation and footer elements
    document.querySelectorAll('nav, .navigation, footer, .footer').forEach(el => el.remove());
    
    // Get text content
    const text = document.body.textContent || '';
    
    // Clean up whitespace
    return text
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Truncate content to specified length
   */
  private truncateContent(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }
    
    // Truncate at word boundary
    const truncated = text.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');
    
    if (lastSpace > maxLength * 0.8) {
      return truncated.substring(0, lastSpace) + '...';
    }
    
    return truncated + '...';
  }

  /**
   * Generate unique document ID
   */
  private generateDocumentId(page: GeneratedPage): string {
    // Use path as ID, removing extension and special characters
    return page.path
      .replace(/\.html?$/, '')
      .replace(/[^a-zA-Z0-9-_]/g, '-')
      .replace(/-+/g, '-')
      .toLowerCase();
  }

  /**
   * Check if page should be excluded from search
   */
  private shouldExcludeFromSearch(page: GeneratedPage): boolean {
    // Exclude special pages
    const excludePaths = [
      '404.html',
      'search.html',
      'sitemap.xml',
      'robots.txt'
    ];
    
    if (excludePaths.includes(page.path)) {
      return true;
    }
    
    // Exclude pages with noindex tag
    if (page.metadata.tags?.includes('noindex')) {
      return true;
    }
    
    // Exclude very small pages (likely navigation or redirect pages)
    if (page.size < 500) {
      return true;
    }
    
    return false;
  }
}