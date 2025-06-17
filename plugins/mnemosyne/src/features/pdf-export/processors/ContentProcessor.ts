/**
 * Content Processor - Processes documents for PDF export
 */

import { Document as MnemosyneDocument } from '../../../../core/MnemosyneCore';
import { 
  ProcessedDocument,
  PDFExportOptions,
  DocumentMetadata,
  Heading,
  Footnote,
  ImageReference,
  TableReference,
  CodeBlock,
  Citation,
  PageBreak,
  ContentAnalytics,
  Backlink,
  Outlink
} from '../core/types';
import { marked } from 'marked';
import { JSDOM } from 'jsdom';
import * as crypto from 'crypto';

export class ContentProcessor {
  private footnoteCounter: number = 0;
  private imageCounter: number = 0;
  private tableCounter: number = 0;
  private codeBlockCounter: number = 0;
  
  /**
   * Process a single document
   */
  async processDocument(
    document: MnemosyneDocument,
    options: PDFExportOptions
  ): Promise<ProcessedDocument> {
    // Reset counters for each document
    this.resetCounters();
    
    // Convert markdown to HTML
    const htmlContent = await this.convertToHTML(document.content || '', options);
    
    // Extract document structure
    const dom = new JSDOM(htmlContent);
    const doc = dom.window.document;
    
    // Extract various elements
    const headings = this.extractHeadings(doc);
    const footnotes = this.extractFootnotes(doc);
    const images = this.extractImages(doc);
    const tables = this.extractTables(doc);
    const codeBlocks = this.extractCodeBlocks(doc);
    const citations = this.extractCitations(doc);
    
    // Extract links
    const { backlinks, outlinks } = await this.extractLinks(document, doc);
    
    // Extract keywords
    const keywords = this.extractKeywords(document, doc);
    
    // Calculate metrics
    const readingTime = this.calculateReadingTime(doc.body.textContent || '');
    const complexity = this.calculateComplexity(doc);
    
    // Determine page breaks
    const pageBreaks = this.determinePageBreaks(doc, options);
    
    // Build processed document
    const processed: ProcessedDocument = {
      id: document.id,
      title: document.title,
      content: document.content || '',
      htmlContent: dom.serialize(),
      metadata: this.extractMetadata(document),
      backlinks,
      outlinks,
      headings,
      footnotes,
      images,
      tables,
      codeBlocks,
      citations,
      keywords,
      readingTime,
      complexity,
      pageBreaks
    };
    
    return processed;
  }
  
  /**
   * Analyze content across all documents
   */
  async analyzeContent(documents: ProcessedDocument[]): Promise<ContentAnalytics> {
    let totalWords = 0;
    let totalHeadings = 0;
    let totalParagraphs = 0;
    let totalLists = 0;
    let totalTables = 0;
    let totalImages = 0;
    let totalCodeBlocks = 0;
    
    const allKeywords = new Set<string>();
    const complexityScores: number[] = [];
    
    for (const doc of documents) {
      const dom = new JSDOM(doc.htmlContent);
      const body = dom.window.document.body;
      
      // Count words
      const text = body.textContent || '';
      totalWords += text.split(/\s+/).filter(Boolean).length;
      
      // Count elements
      totalHeadings += doc.headings.length;
      totalParagraphs += body.querySelectorAll('p').length;
      totalLists += body.querySelectorAll('ul, ol').length;
      totalTables += doc.tables.length;
      totalImages += doc.images.length;
      totalCodeBlocks += doc.codeBlocks.length;
      
      // Collect keywords
      doc.keywords.forEach(keyword => allKeywords.add(keyword));
      
      // Collect complexity scores
      complexityScores.push(doc.complexity);
    }
    
    // Calculate averages
    const averageReadingTime = documents.reduce((sum, doc) => sum + doc.readingTime, 0) / documents.length;
    const averageComplexity = complexityScores.reduce((sum, score) => sum + score, 0) / complexityScores.length;
    
    // Extract top topics
    const keyTopics = Array.from(allKeywords)
      .slice(0, 10)
      .sort();
    
    return {
      totalWords,
      averageReadingTime,
      complexityScore: averageComplexity,
      keyTopics,
      documentStructure: {
        headings: totalHeadings,
        paragraphs: totalParagraphs,
        lists: totalLists,
        tables: totalTables,
        images: totalImages,
        codeBlocks: totalCodeBlocks
      }
    };
  }
  
  /**
   * Convert markdown to HTML
   */
  private async convertToHTML(content: string, options: PDFExportOptions): Promise<string> {
    // Configure marked options
    marked.setOptions({
      gfm: true,
      breaks: true,
      pedantic: false,
      sanitize: false,
      smartLists: true,
      smartypants: true,
      highlight: (code, lang) => {
        // Add syntax highlighting if needed
        return `<pre><code class="language-${lang}">${this.escapeHtml(code)}</code></pre>`;
      }
    });
    
    // Process markdown
    let html = marked(content);
    
    // Process footnotes if enabled
    if (options.footnotes) {
      html = this.processFootnotes(html);
    }
    
    // Add custom processing
    html = this.addCustomProcessing(html, options);
    
    return html;
  }
  
  /**
   * Extract headings from document
   */
  private extractHeadings(doc: Document): Heading[] {
    const headings: Heading[] = [];
    const headingElements = doc.querySelectorAll('h1, h2, h3, h4, h5, h6');
    
    headingElements.forEach((element, index) => {
      const level = parseInt(element.tagName.substring(1));
      const text = element.textContent || '';
      const id = element.id || `heading-${index}`;
      
      // Ensure element has an ID for anchoring
      if (!element.id) {
        element.id = id;
      }
      
      headings.push({
        id,
        text: text.trim(),
        level,
        anchor: `#${id}`
      });
    });
    
    return headings;
  }
  
  /**
   * Extract footnotes from document
   */
  private extractFootnotes(doc: Document): Footnote[] {
    const footnotes: Footnote[] = [];
    const footnoteElements = doc.querySelectorAll('.footnote');
    
    footnoteElements.forEach((element, index) => {
      const number = index + 1;
      const id = `footnote-${number}`;
      const content = element.textContent || '';
      const reference = element.getAttribute('data-ref') || '';
      
      footnotes.push({
        id,
        number,
        content: content.trim(),
        reference
      });
    });
    
    return footnotes;
  }
  
  /**
   * Extract images from document
   */
  private extractImages(doc: Document): ImageReference[] {
    const images: ImageReference[] = [];
    const imageElements = doc.querySelectorAll('img');
    
    imageElements.forEach((img) => {
      this.imageCounter++;
      const id = `image-${this.imageCounter}`;
      
      // Extract caption from figure if available
      let caption: string | undefined;
      const figure = img.closest('figure');
      if (figure) {
        const figcaption = figure.querySelector('figcaption');
        caption = figcaption?.textContent || undefined;
      }
      
      images.push({
        id,
        src: img.src,
        alt: img.alt,
        caption
      });
    });
    
    return images;
  }
  
  /**
   * Extract tables from document
   */
  private extractTables(doc: Document): TableReference[] {
    const tables: TableReference[] = [];
    const tableElements = doc.querySelectorAll('table');
    
    tableElements.forEach((table) => {
      this.tableCounter++;
      const id = `table-${this.tableCounter}`;
      
      // Extract headers
      const headers: string[] = [];
      const headerCells = table.querySelectorAll('th');
      headerCells.forEach(th => {
        headers.push(th.textContent || '');
      });
      
      // Count rows and columns
      const rows = table.querySelectorAll('tr');
      const rowCount = rows.length;
      const columnCount = rows[0]?.querySelectorAll('td, th').length || 0;
      
      // Extract caption if available
      const caption = table.querySelector('caption')?.textContent || undefined;
      
      tables.push({
        id,
        caption,
        headers,
        rowCount,
        columnCount
      });
    });
    
    return tables;
  }
  
  /**
   * Extract code blocks from document
   */
  private extractCodeBlocks(doc: Document): CodeBlock[] {
    const codeBlocks: CodeBlock[] = [];
    const codeElements = doc.querySelectorAll('pre code');
    
    codeElements.forEach((code) => {
      this.codeBlockCounter++;
      const id = `code-${this.codeBlockCounter}`;
      const content = code.textContent || '';
      const language = code.className.match(/language-(\w+)/)?.[1];
      const lineCount = content.split('\n').length;
      
      codeBlocks.push({
        id,
        language,
        content,
        lineCount
      });
    });
    
    return codeBlocks;
  }
  
  /**
   * Extract citations from document
   */
  private extractCitations(doc: Document): Citation[] {
    const citations: Citation[] = [];
    const citationElements = doc.querySelectorAll('.citation, cite');
    
    citationElements.forEach((cite, index) => {
      const id = `citation-${index + 1}`;
      const text = cite.textContent || '';
      const source = cite.getAttribute('data-source') || '';
      
      citations.push({
        id,
        text: text.trim(),
        source
      });
    });
    
    return citations;
  }
  
  /**
   * Extract links from document
   */
  private async extractLinks(
    document: MnemosyneDocument,
    doc: Document
  ): Promise<{ backlinks: Backlink[]; outlinks: Outlink[] }> {
    const backlinks: Backlink[] = [];
    const outlinks: Outlink[] = [];
    
    // Extract outgoing links
    const linkElements = doc.querySelectorAll('a[href]');
    linkElements.forEach(link => {
      const href = link.getAttribute('href') || '';
      const text = link.textContent || '';
      
      // Determine if link is external
      const isExternal = /^https?:\/\//.test(href);
      
      if (!isExternal && href.startsWith('#')) {
        // Internal anchor link - skip
        return;
      }
      
      outlinks.push({
        targetId: href,
        targetTitle: text,
        anchor: link.id || '',
        isExternal
      });
    });
    
    // Note: Backlinks would need to be determined from the knowledge graph
    // This is a placeholder implementation
    if (document.metadata?.backlinks) {
      document.metadata.backlinks.forEach((backlink: any) => {
        backlinks.push({
          sourceId: backlink.id,
          sourceTitle: backlink.title,
          context: backlink.context || '',
          anchor: ''
        });
      });
    }
    
    return { backlinks, outlinks };
  }
  
  /**
   * Extract keywords from document
   */
  private extractKeywords(document: MnemosyneDocument, doc: Document): string[] {
    const keywords = new Set<string>();
    
    // Add tags as keywords
    if (document.metadata?.tags) {
      document.metadata.tags.forEach((tag: string) => keywords.add(tag));
    }
    
    // Extract keywords from meta tags
    const metaKeywords = doc.querySelector('meta[name="keywords"]');
    if (metaKeywords) {
      const content = metaKeywords.getAttribute('content') || '';
      content.split(',').forEach(keyword => {
        keywords.add(keyword.trim());
      });
    }
    
    // Extract emphasized words (could be expanded with NLP)
    const emphasized = doc.querySelectorAll('strong, em, b, i');
    emphasized.forEach(element => {
      const text = element.textContent || '';
      if (text.length > 3 && text.length < 30) {
        keywords.add(text.toLowerCase().trim());
      }
    });
    
    return Array.from(keywords).slice(0, 20); // Limit to 20 keywords
  }
  
  /**
   * Calculate reading time in minutes
   */
  private calculateReadingTime(text: string): number {
    const wordsPerMinute = 200;
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    return Math.ceil(wordCount / wordsPerMinute);
  }
  
  /**
   * Calculate document complexity score (0-100)
   */
  private calculateComplexity(doc: Document): number {
    const text = doc.body.textContent || '';
    const sentences = text.split(/[.!?]+/).filter(Boolean);
    const words = text.split(/\s+/).filter(Boolean);
    
    if (sentences.length === 0 || words.length === 0) {
      return 0;
    }
    
    // Calculate average sentence length
    const avgSentenceLength = words.length / sentences.length;
    
    // Calculate average word length
    const totalWordLength = words.reduce((sum, word) => sum + word.length, 0);
    const avgWordLength = totalWordLength / words.length;
    
    // Simple complexity formula (can be enhanced)
    const complexity = Math.min(100, (avgSentenceLength * 2) + (avgWordLength * 5));
    
    return Math.round(complexity);
  }
  
  /**
   * Determine page breaks
   */
  private determinePageBreaks(doc: Document, options: PDFExportOptions): PageBreak[] {
    const pageBreaks: PageBreak[] = [];
    let position = 0;
    
    // Add manual page breaks
    const manualBreaks = doc.querySelectorAll('.page-break, [data-page-break]');
    manualBreaks.forEach(element => {
      pageBreaks.push({
        type: 'manual',
        position: position++,
        reason: 'Manual page break'
      });
    });
    
    // Add section breaks for top-level headings
    const h1Elements = doc.querySelectorAll('h1');
    h1Elements.forEach((heading, index) => {
      if (index > 0) { // Don't break before first heading
        pageBreaks.push({
          type: 'section',
          position: position++,
          reason: 'New chapter/section'
        });
      }
    });
    
    // Sort by position
    pageBreaks.sort((a, b) => a.position - b.position);
    
    return pageBreaks;
  }
  
  /**
   * Extract metadata from document
   */
  private extractMetadata(document: MnemosyneDocument): DocumentMetadata {
    return {
      created: document.metadata?.created ? new Date(document.metadata.created) : undefined,
      modified: document.metadata?.modified ? new Date(document.metadata.modified) : undefined,
      author: document.metadata?.author,
      tags: document.metadata?.tags || [],
      category: document.metadata?.category,
      version: document.metadata?.version
    };
  }
  
  /**
   * Process footnotes in HTML
   */
  private processFootnotes(html: string): string {
    // Simple footnote processing - can be enhanced
    return html.replace(/\[\^(\d+)\]/g, (match, num) => {
      this.footnoteCounter++;
      return `<sup class="footnote" data-ref="${num}">[${this.footnoteCounter}]</sup>`;
    });
  }
  
  /**
   * Add custom processing to HTML
   */
  private addCustomProcessing(html: string, options: PDFExportOptions): string {
    // Add custom classes for styling
    html = html.replace(/<table>/g, '<table class="pdf-table">');
    html = html.replace(/<pre><code/g, '<pre class="pdf-code"><code');
    
    // Add print-specific classes
    if (options.quality === 'print') {
      html = html.replace(/<img/g, '<img class="print-quality"');
    }
    
    return html;
  }
  
  /**
   * Escape HTML characters
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
  
  /**
   * Reset counters
   */
  private resetCounters(): void {
    this.footnoteCounter = 0;
    this.imageCounter = 0;
    this.tableCounter = 0;
    this.codeBlockCounter = 0;
  }
}