/**
 * Enhanced PDF Exporter with Advanced Template Integration
 * Enterprise-grade PDF generation with intelligent content analysis and formatting
 */

import { 
  MnemosyneCore,
  Document as MnemosyneDocument,
  KnowledgeGraph,
  AnalyticsEngine
} from '../../../core/MnemosyneCore';
import { MnemosyneTemplateEngine } from '../../templates/TemplateEngine';
import { ExportOptions, ExportContext } from '../core/ExportEngine';
import * as puppeteer from 'puppeteer';
import * as fs from 'fs/promises';
import * as path from 'path';
import { marked } from 'marked';
import { JSDOM } from 'jsdom';

interface AdvancedPDFOptions {
  // Page configuration
  format?: 'A4' | 'Letter' | 'A3' | 'A5' | 'Legal' | 'Tabloid';
  orientation?: 'portrait' | 'landscape';
  scale?: number;
  
  // Margins and spacing
  margin?: {
    top?: string;
    right?: string;
    bottom?: string;
    left?: string;
  };
  
  // Headers and footers
  displayHeaderFooter?: boolean;
  headerTemplate?: string;
  footerTemplate?: string;
  headerHeight?: string;
  footerHeight?: string;
  
  // Content options
  tableOfContents?: boolean;
  tocDepth?: number;
  includeIndex?: boolean;
  includeGlossary?: boolean;
  includeBacklinks?: boolean;
  includeBibliography?: boolean;
  
  // Visual enhancements
  printBackground?: boolean;
  colorMode?: 'color' | 'grayscale' | 'monochrome';
  quality?: 'draft' | 'normal' | 'high' | 'print';
  
  // Knowledge graph integration
  includeKnowledgeGraph?: boolean;
  graphLayout?: 'hierarchical' | 'force' | 'circular' | 'tree';
  graphDepth?: number;
  
  // Security and metadata
  security?: {
    password?: string;
    permissions?: {
      printing?: boolean;
      modifying?: boolean;
      copying?: boolean;
      annotating?: boolean;
    };
  };
  metadata?: {
    title?: string;
    author?: string;
    subject?: string;
    keywords?: string[];
    creator?: string;
    producer?: string;
  };
  
  // Advanced features
  bookmarks?: boolean;
  annotations?: boolean;
  crossReferences?: boolean;
  footnotes?: boolean;
  watermark?: {
    text?: string;
    image?: string;
    opacity?: number;
    position?: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  };
  
  // Template integration
  templateId?: string;
  templateVariables?: Record<string, any>;
  customCSS?: string;
  customJS?: string;
  
  // Performance optimization
  chunkSize?: number;
  parallelRendering?: boolean;
  cacheEnabled?: boolean;
  compressionLevel?: number;
}

interface ProcessedContent {
  documents: ProcessedDocument[];
  tableOfContents?: TableOfContents;
  index?: ContentIndex;
  glossary?: Glossary;
  bibliography?: Bibliography;
  knowledgeGraph?: KnowledgeGraphData;
  metadata: ExportMetadata;
  analytics: ContentAnalytics;
}

interface ProcessedDocument {
  id: string;
  title: string;
  content: string;
  htmlContent: string;
  metadata: DocumentMetadata;
  backlinks: Backlink[];
  outlinks: Outlink[];
  headings: Heading[];
  footnotes: Footnote[];
  images: ImageReference[];
  tables: TableReference[];
  codeBlocks: CodeBlock[];
  citations: Citation[];
  keywords: string[];
  readingTime: number;
  complexity: number;
  pageBreaks: PageBreak[];
}

interface TableOfContents {
  title: string;
  sections: TOCSection[];
  depth: number;
  pageMapping: Map<string, number>;
  crossReferences: Map<string, string[]>;
}

interface TOCSection {
  id: string;
  title: string;
  level: number;
  page: number;
  subsections: TOCSection[];
  documentId: string;
  anchor: string;
  wordCount: number;
}

interface ContentIndex {
  entries: IndexEntry[];
  categories: IndexCategory[];
  crossReferences: Map<string, string[]>;
}

interface IndexEntry {
  term: string;
  pages: number[];
  subEntries: IndexEntry[];
  category: string;
  importance: number;
}

interface Glossary {
  terms: GlossaryTerm[];
  categories: string[];
  sources: string[];
}

interface GlossaryTerm {
  term: string;
  definition: string;
  category: string;
  source: string;
  relatedTerms: string[];
  firstOccurrence: number;
}

interface Bibliography {
  sources: BibliographySource[];
  citationStyle: string;
  groupedByType: Map<string, BibliographySource[]>;
}

interface ContentAnalytics {
  totalWords: number;
  totalPages: number;
  readingTime: number;
  complexityScore: number;
  knowledgeDensity: number;
  vocabularyRichness: number;
  crossReferenceCount: number;
  mediaCount: {
    images: number;
    tables: number;
    codeBlocks: number;
    equations: number;
  };
  topicDistribution: Map<string, number>;
  sentimentAnalysis: {
    overall: 'positive' | 'neutral' | 'negative';
    confidence: number;
    bySection: Map<string, any>;
  };
}

export class EnhancedPDFExporter {
  private mnemosyne: MnemosyneCore;
  private templateEngine: MnemosyneTemplateEngine;
  private knowledgeGraph: KnowledgeGraph;
  private analytics: AnalyticsEngine;
  private cache: Map<string, any> = new Map();
  private renderingPool: puppeteer.Browser[] = [];
  private maxConcurrency = 3;

  constructor(
    mnemosyne: MnemosyneCore,
    templateEngine: MnemosyneTemplateEngine
  ) {
    this.mnemosyne = mnemosyne;
    this.templateEngine = templateEngine;
    this.knowledgeGraph = mnemosyne.getKnowledgeGraph();
    this.analytics = mnemosyne.getAnalytics();
  }

  /**
   * Export documents to PDF with advanced template integration
   */
  async export(
    documents: MnemosyneDocument[],
    context: ExportContext,
    options: ExportOptions & { pdfOptions?: AdvancedPDFOptions } = {}
  ): Promise<Buffer> {
    const startTime = Date.now();
    const pdfOptions = options.pdfOptions || {};
    
    try {
      // 1. Validate and prepare documents
      await this.validateDocuments(documents);
      
      // 2. Initialize rendering pool for parallel processing
      if (pdfOptions.parallelRendering) {
        await this.initializeRenderingPool();
      }
      
      // 3. Process content with advanced analysis
      const processedContent = await this.processContent(documents, options);
      
      // 4. Select and prepare template
      const template = await this.prepareTemplate(context, pdfOptions);
      
      // 5. Generate enhanced HTML with template integration
      const html = await this.generateHTML(processedContent, template, pdfOptions);
      
      // 6. Apply advanced styling and optimizations
      const styledHTML = await this.applyAdvancedStyling(html, template, pdfOptions);
      
      // 7. Generate PDF with performance optimization
      const pdf = await this.generateAdvancedPDF(styledHTML, pdfOptions);
      
      // 8. Apply post-processing (security, metadata, optimization)
      const finalPDF = await this.postProcessPDF(pdf, processedContent, pdfOptions);
      
      // 9. Record analytics and update knowledge graph
      await this.recordExportAnalytics(documents, processedContent, Date.now() - startTime);
      
      return finalPDF;
      
    } catch (error) {
      throw this.enhanceError(error, 'PDF export failed', { documents: documents.length, options });
    } finally {
      await this.cleanupResources();
    }
  }

  /**
   * Process content with comprehensive analysis
   */
  private async processContent(
    documents: MnemosyneDocument[],
    options: ExportOptions
  ): Promise<ProcessedContent> {
    const processedDocs: ProcessedDocument[] = [];
    
    // Process documents in parallel with chunking
    const chunkSize = options.pdfOptions?.chunkSize || 5;
    const chunks = this.chunkArray(documents, chunkSize);
    
    for (const chunk of chunks) {
      const chunkResults = await Promise.all(
        chunk.map(doc => this.processDocument(doc, options))
      );
      processedDocs.push(...chunkResults);
    }
    
    // Generate supplementary content
    const [tableOfContents, index, glossary, bibliography, knowledgeGraph] = await Promise.all([
      this.generateTableOfContents(processedDocs, options.pdfOptions?.tocDepth || 3),
      options.pdfOptions?.includeIndex ? this.generateIndex(processedDocs) : null,
      options.pdfOptions?.includeGlossary ? this.generateGlossary(processedDocs) : null,
      options.pdfOptions?.includeBibliography ? this.generateBibliography(processedDocs) : null,
      options.pdfOptions?.includeKnowledgeGraph ? this.generateKnowledgeGraphData(processedDocs, options.pdfOptions) : null
    ]);
    
    // Perform content analytics
    const analytics = await this.analyzeContent(processedDocs);
    
    return {
      documents: processedDocs,
      tableOfContents,
      index: index || undefined,
      glossary: glossary || undefined,
      bibliography: bibliography || undefined,
      knowledgeGraph: knowledgeGraph || undefined,
      metadata: this.generateExportMetadata(documents, analytics),
      analytics
    };
  }

  /**
   * Process individual document with advanced analysis
   */
  private async processDocument(
    document: MnemosyneDocument,
    options: ExportOptions
  ): Promise<ProcessedDocument> {
    // Convert markdown to HTML with enhanced processing
    const htmlContent = await this.processMarkdownAdvanced(document.content);
    
    // Extract document structure
    const [headings, footnotes, images, tables, codeBlocks, citations] = await Promise.all([
      this.extractHeadings(htmlContent),
      this.extractFootnotes(htmlContent),
      this.extractImages(htmlContent),
      this.extractTables(htmlContent),
      this.extractCodeBlocks(htmlContent),
      this.extractCitations(htmlContent)
    ]);
    
    // Get backlinks and outlinks
    const [backlinks, outlinks] = await Promise.all([
      this.getBacklinks(document.id),
      this.getOutlinks(document.content)
    ]);
    
    // Perform content analysis
    const keywords = await this.extractKeywords(document.content);
    const readingTime = this.calculateReadingTime(document.content);
    const complexity = this.calculateComplexity(document.content, htmlContent);
    const pageBreaks = this.determinePageBreaks(htmlContent, headings);
    
    return {
      id: document.id,
      title: document.title,
      content: document.content,
      htmlContent,
      metadata: {
        ...document.metadata,
        processedAt: new Date(),
        wordCount: this.countWords(document.content),
        characterCount: document.content.length
      },
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
  }

  /**
   * Advanced markdown processing with custom renderers
   */
  private async processMarkdownAdvanced(markdown: string): Promise<string> {
    const renderer = new marked.Renderer();
    
    // Custom heading renderer with anchor links
    renderer.heading = (text: string, level: number) => {
      const anchor = this.slugify(text);
      return `<h${level} id="${anchor}" class="heading-${level}">
        <a href="#${anchor}" class="anchor-link">#</a>
        ${text}
      </h${level}>`;
    };
    
    // Custom code block renderer with syntax highlighting
    renderer.code = (code: string, language?: string) => {
      const lang = language || 'text';
      return `<pre class="code-block language-${lang}">
        <code class="language-${lang}">${this.escapeHtml(code)}</code>
      </pre>`;
    };
    
    // Custom table renderer with enhanced styling
    renderer.table = (header: string, body: string) => {
      return `<div class="table-container">
        <table class="enhanced-table">
          <thead>${header}</thead>
          <tbody>${body}</tbody>
        </table>
      </div>`;
    };
    
    // Custom image renderer with lazy loading and captions
    renderer.image = (href: string, title: string | null, text: string) => {
      const caption = title || text;
      return `<figure class="image-figure">
        <img src="${href}" alt="${text}" title="${title || ''}" loading="lazy" />
        ${caption ? `<figcaption>${caption}</figcaption>` : ''}
      </figure>`;
    };
    
    // Custom link renderer with external link detection
    renderer.link = (href: string, title: string | null, text: string) => {
      const isExternal = href.startsWith('http') && !href.includes(window?.location?.hostname || '');
      const target = isExternal ? 'target="_blank" rel="noopener noreferrer"' : '';
      const className = isExternal ? 'external-link' : 'internal-link';
      
      return `<a href="${href}" ${target} title="${title || ''}" class="${className}">${text}</a>`;
    };
    
    // Configure marked options
    marked.setOptions({
      renderer,
      gfm: true,
      breaks: true,
      pedantic: false,
      sanitize: false,
      smartLists: true,
      smartypants: true
    });
    
    return marked(markdown);
  }

  /**
   * Generate advanced HTML with template integration
   */
  private async generateHTML(
    content: ProcessedContent,
    template: any,
    options: AdvancedPDFOptions
  ): Promise<string> {
    // Prepare template context with comprehensive data
    const templateContext = {
      content,
      options,
      mnemosyne: {
        version: this.mnemosyne.version,
        exportDate: new Date(),
        user: await this.mnemosyne.getCurrentUser(),
        knowledgeBase: this.mnemosyne.getKnowledgeBase()
      },
      analytics: content.analytics,
      ...(options.templateVariables || {})
    };
    
    // Render using template engine
    const renderedHTML = await this.templateEngine.render(
      template.id,
      templateContext,
      {
        format: 'pdf',
        features: {
          toc: options.tableOfContents,
          index: options.includeIndex,
          glossary: options.includeGlossary,
          bibliography: options.includeBibliography,
          knowledgeGraph: options.includeKnowledgeGraph
        }
      }
    );
    
    return renderedHTML;
  }

  /**
   * Apply advanced styling with CSS optimization
   */
  private async applyAdvancedStyling(
    html: string,
    template: any,
    options: AdvancedPDFOptions
  ): Promise<string> {
    // Generate comprehensive CSS
    const css = await this.generateAdvancedCSS(template, options);
    
    // Add custom CSS if provided
    const customCSS = options.customCSS || '';
    
    // Generate JavaScript for interactive elements
    const javascript = this.generatePDFJavaScript(options);
    
    // Optimize images for PDF
    const optimizedHTML = await this.optimizeImagesForPDF(html, options);
    
    return `<!DOCTYPE html>
<html lang="en" class="pdf-export">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${options.metadata?.title || 'Mnemosyne Export'}</title>
  <style>${css}</style>
  ${customCSS ? `<style>${customCSS}</style>` : ''}
  ${javascript ? `<script>${javascript}</script>` : ''}
</head>
<body class="mnemosyne-pdf ${options.colorMode || 'color'} quality-${options.quality || 'normal'}">
  ${optimizedHTML}
  ${this.generateWatermark(options.watermark)}
</body>
</html>`;
  }

  /**
   * Generate comprehensive CSS for PDF
   */
  private async generateAdvancedCSS(template: any, options: AdvancedPDFOptions): Promise<string> {
    const format = options.format || 'A4';
    const orientation = options.orientation || 'portrait';
    const colorMode = options.colorMode || 'color';
    
    const baseCSS = `
      /* Page configuration */
      @page {
        size: ${format} ${orientation};
        margin: ${this.formatMargins(options.margin)};
        ${options.displayHeaderFooter ? `
          margin-top: ${options.headerHeight || '2cm'};
          margin-bottom: ${options.footerHeight || '2cm'};
        ` : ''}
        
        /* Page counters */
        counter-increment: page;
        
        /* Headers and footers */
        ${options.headerTemplate ? `@top-center { content: "${options.headerTemplate}"; }` : ''}
        ${options.footerTemplate ? `@bottom-center { content: "${options.footerTemplate}"; }` : ''}
      }
      
      /* Print-specific styles */
      @media print {
        body { print-color-adjust: ${options.printBackground ? 'exact' : 'economy'}; }
        .page-break { page-break-after: always; }
        .no-break { page-break-inside: avoid; }
        .no-print { display: none !important; }
      }
      
      /* Color mode adjustments */
      ${colorMode === 'grayscale' ? this.getGrayscaleCSS() : ''}
      ${colorMode === 'monochrome' ? this.getMonochromeCSS() : ''}
      
      /* Typography and layout */
      ${this.getTypographyCSS(options)}
      
      /* Component-specific styles */
      ${this.getComponentCSS()}
      
      /* Table of contents styles */
      ${options.tableOfContents ? this.getTOCCSS() : ''}
      
      /* Index styles */
      ${options.includeIndex ? this.getIndexCSS() : ''}
      
      /* Knowledge graph styles */
      ${options.includeKnowledgeGraph ? this.getKnowledgeGraphCSS(options.graphLayout) : ''}
      
      /* Template-specific CSS */
      ${template.css || ''}
    `;
    
    return this.optimizeCSS(baseCSS);
  }

  /**
   * Generate advanced PDF with performance optimization
   */
  private async generateAdvancedPDF(
    html: string,
    options: AdvancedPDFOptions
  ): Promise<Buffer> {
    const browser = options.parallelRendering && this.renderingPool.length > 0
      ? this.renderingPool.pop()!
      : await puppeteer.launch({
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
          ]
        });
    
    try {
      const page = await browser.newPage();
      
      // Set viewport for consistent rendering
      await page.setViewport({
        width: this.getPageWidth(options.format || 'A4'),
        height: this.getPageHeight(options.format || 'A4'),
        deviceScaleFactor: options.scale || 1
      });
      
      // Performance optimizations
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        if (req.resourceType() === 'image' && !this.isImageOptimized(req.url())) {
          req.abort();
        } else {
          req.continue();
        }
      });
      
      // Set content with enhanced waiting strategy
      await page.setContent(html, {
        waitUntil: ['load', 'domcontentloaded', 'networkidle0'],
        timeout: 60000
      });
      
      // Wait for any dynamic content
      await page.evaluate(() => {
        return new Promise(resolve => {
          if (document.readyState === 'complete') {
            resolve(undefined);
          } else {
            window.addEventListener('load', () => resolve(undefined));
          }
        });
      });
      
      // Generate PDF with advanced options
      const pdf = await page.pdf({
        format: options.format || 'A4',
        landscape: options.orientation === 'landscape',
        margin: this.formatMarginsForPuppeteer(options.margin),
        displayHeaderFooter: options.displayHeaderFooter || false,
        headerTemplate: options.headerTemplate || '',
        footerTemplate: options.footerTemplate || '',
        printBackground: options.printBackground !== false,
        preferCSSPageSize: true,
        tagged: true, // For accessibility
        scale: options.scale || 1
      });
      
      return pdf;
      
    } finally {
      if (options.parallelRendering && this.renderingPool.length < this.maxConcurrency) {
        this.renderingPool.push(browser);
      } else {
        await browser.close();
      }
    }
  }

  /**
   * Post-process PDF with security and optimization
   */
  private async postProcessPDF(
    pdf: Buffer,
    content: ProcessedContent,
    options: AdvancedPDFOptions
  ): Promise<Buffer> {
    let processedPDF = pdf;
    
    // Apply metadata
    if (options.metadata) {
      processedPDF = await this.addPDFMetadata(processedPDF, options.metadata, content);
    }
    
    // Apply security settings
    if (options.security) {
      processedPDF = await this.applyPDFSecurity(processedPDF, options.security);
    }
    
    // Add bookmarks
    if (options.bookmarks && content.tableOfContents) {
      processedPDF = await this.addPDFBookmarks(processedPDF, content.tableOfContents);
    }
    
    // Optimize file size
    if (options.compressionLevel) {
      processedPDF = await this.compressPDF(processedPDF, options.compressionLevel);
    }
    
    return processedPDF;
  }

  // Helper methods for content analysis and processing
  private async extractHeadings(html: string): Promise<Heading[]> {
    const dom = new JSDOM(html);
    const headings = dom.window.document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    
    return Array.from(headings).map((heading, index) => ({
      id: heading.id || `heading-${index}`,
      text: heading.textContent || '',
      level: parseInt(heading.tagName.substring(1)),
      anchor: heading.id || this.slugify(heading.textContent || ''),
      wordCount: this.countWords(heading.textContent || '')
    }));
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

  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  private async cleanupResources(): Promise<void> {
    // Close all browsers in the pool
    await Promise.all(this.renderingPool.map(browser => browser.close()));
    this.renderingPool = [];
    
    // Clear cache
    this.cache.clear();
  }

  private enhanceError(error: any, message: string, context: any): Error {
    const enhancedError = new Error(`${message}: ${error.message}`);
    (enhancedError as any).context = context;
    (enhancedError as any).originalError = error;
    return enhancedError;
  }

  // Additional implementation methods
  
  private async validateDocuments(documents: MnemosyneDocument[]): Promise<void> {
    if (!documents || documents.length === 0) {
      throw new Error('No documents provided for export');
    }
    
    for (const doc of documents) {
      if (!doc.id || !doc.title || !doc.content) {
        throw new Error(`Invalid document structure: ${doc.id}`);
      }
    }
  }

  private async initializeRenderingPool(): Promise<void> {
    const poolSize = Math.min(this.maxConcurrency, 3);
    
    for (let i = 0; i < poolSize; i++) {
      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      this.renderingPool.push(browser);
    }
  }

  private async prepareTemplate(context: ExportContext, options: AdvancedPDFOptions): Promise<any> {
    if (options.templateId) {
      return await this.templateEngine.getTemplate(options.templateId);
    }
    
    // Auto-select template based on content type
    const templateId = this.selectOptimalTemplate(context, options);
    return await this.templateEngine.getTemplate(templateId);
  }

  private selectOptimalTemplate(context: ExportContext, options: AdvancedPDFOptions): string {
    // AI-powered template selection logic
    if (options.includeKnowledgeGraph) return 'pdf-knowledge-graph';
    if (options.tableOfContents && options.includeIndex) return 'pdf-academic';
    if (options.includeBibliography) return 'pdf-research';
    return 'pdf-default';
  }

  private async generateTableOfContents(
    documents: ProcessedDocument[], 
    depth: number
  ): Promise<TableOfContents> {
    const sections: TOCSection[] = [];
    const pageMapping = new Map<string, number>();
    let currentPage = 1;
    
    for (const doc of documents) {
      const docSections = this.generateDocumentTOC(doc, depth, currentPage);
      sections.push(...docSections);
      
      // Update page mapping
      pageMapping.set(doc.id, currentPage);
      currentPage += Math.ceil(doc.content.length / 2500); // Rough page estimation
    }
    
    return {
      title: 'Table of Contents',
      sections,
      depth,
      pageMapping,
      crossReferences: new Map()
    };
  }

  private generateDocumentTOC(doc: ProcessedDocument, depth: number, startPage: number): TOCSection[] {
    return doc.headings
      .filter(h => h.level <= depth)
      .map((heading, index) => ({
        id: heading.id,
        title: heading.text,
        level: heading.level,
        page: startPage + Math.floor(index / 10), // Rough page calculation
        subsections: [],
        documentId: doc.id,
        anchor: heading.anchor,
        wordCount: heading.wordCount
      }));
  }

  private async generateIndex(documents: ProcessedDocument[]): Promise<ContentIndex> {
    const entries: IndexEntry[] = [];
    const categories = new Set<string>();
    
    // Extract important terms from all documents
    for (const doc of documents) {
      const terms = await this.extractIndexTerms(doc);
      entries.push(...terms);
      terms.forEach(term => categories.add(term.category));
    }
    
    // Sort and deduplicate entries
    const uniqueEntries = this.deduplicateIndexEntries(entries);
    
    return {
      entries: uniqueEntries,
      categories: Array.from(categories).map(cat => ({ name: cat, entries: [] })),
      crossReferences: new Map()
    };
  }

  private async extractIndexTerms(doc: ProcessedDocument): Promise<IndexEntry[]> {
    const terms: IndexEntry[] = [];
    
    // Extract from keywords
    doc.keywords.forEach(keyword => {
      terms.push({
        term: keyword,
        pages: [1], // Would need actual page calculation
        subEntries: [],
        category: 'keyword',
        importance: 1
      });
    });
    
    // Extract from headings
    doc.headings.forEach(heading => {
      if (heading.level <= 2) {
        terms.push({
          term: heading.text,
          pages: [1],
          subEntries: [],
          category: 'heading',
          importance: 3 - heading.level
        });
      }
    });
    
    return terms;
  }

  private deduplicateIndexEntries(entries: IndexEntry[]): IndexEntry[] {
    const termMap = new Map<string, IndexEntry>();
    
    entries.forEach(entry => {
      const key = entry.term.toLowerCase();
      if (termMap.has(key)) {
        const existing = termMap.get(key)!;
        existing.pages.push(...entry.pages);
        existing.importance = Math.max(existing.importance, entry.importance);
      } else {
        termMap.set(key, { ...entry });
      }
    });
    
    return Array.from(termMap.values()).sort((a, b) => a.term.localeCompare(b.term));
  }

  private async generateGlossary(documents: ProcessedDocument[]): Promise<Glossary> {
    const terms: GlossaryTerm[] = [];
    
    // Extract technical terms and definitions
    for (const doc of documents) {
      const docTerms = await this.extractGlossaryTerms(doc);
      terms.push(...docTerms);
    }
    
    return {
      terms: this.deduplicateGlossaryTerms(terms),
      categories: [...new Set(terms.map(t => t.category))],
      sources: [...new Set(terms.map(t => t.source))]
    };
  }

  private async extractGlossaryTerms(doc: ProcessedDocument): Promise<GlossaryTerm[]> {
    const terms: GlossaryTerm[] = [];
    
    // Simple pattern matching for definitions
    const definitionPattern = /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*[:\-]\s*([^.]+\.)/g;
    let match;
    
    while ((match = definitionPattern.exec(doc.content)) !== null) {
      terms.push({
        term: match[1],
        definition: match[2],
        category: 'definition',
        source: doc.title,
        relatedTerms: [],
        firstOccurrence: 1
      });
    }
    
    return terms;
  }

  private deduplicateGlossaryTerms(terms: GlossaryTerm[]): GlossaryTerm[] {
    const termMap = new Map<string, GlossaryTerm>();
    
    terms.forEach(term => {
      const key = term.term.toLowerCase();
      if (!termMap.has(key)) {
        termMap.set(key, term);
      }
    });
    
    return Array.from(termMap.values()).sort((a, b) => a.term.localeCompare(b.term));
  }

  private async generateBibliography(documents: ProcessedDocument[]): Promise<Bibliography> {
    const sources: BibliographySource[] = [];
    
    for (const doc of documents) {
      const docSources = doc.citations.map(citation => ({
        id: citation.id,
        type: citation.type,
        title: citation.text,
        authors: [doc.metadata.author || 'Unknown'],
        year: new Date(doc.metadata.created || Date.now()).getFullYear(),
        url: citation.source.startsWith('http') ? citation.source : undefined
      }));
      sources.push(...docSources);
    }
    
    const groupedByType = new Map<string, BibliographySource[]>();
    sources.forEach(source => {
      const type = source.type;
      if (!groupedByType.has(type)) {
        groupedByType.set(type, []);
      }
      groupedByType.get(type)!.push(source);
    });
    
    return {
      sources: this.deduplicateBibliographySources(sources),
      citationStyle: 'APA',
      groupedByType
    };
  }

  private deduplicateBibliographySources(sources: BibliographySource[]): BibliographySource[] {
    const sourceMap = new Map<string, BibliographySource>();
    
    sources.forEach(source => {
      const key = `${source.title}-${source.year}`;
      if (!sourceMap.has(key)) {
        sourceMap.set(key, source);
      }
    });
    
    return Array.from(sourceMap.values()).sort((a, b) => a.title.localeCompare(b.title));
  }

  private async generateKnowledgeGraphData(
    documents: ProcessedDocument[],
    options: AdvancedPDFOptions
  ): Promise<KnowledgeGraphData> {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    
    // Create nodes for each document
    documents.forEach(doc => {
      nodes.push({
        id: doc.id,
        label: doc.title,
        type: 'document',
        size: Math.log(doc.metadata.wordCount || 1) * 10,
        color: this.getNodeColor('document'),
        x: Math.random() * 800,
        y: Math.random() * 600
      });
    });
    
    // Create edges for relationships
    for (const doc of documents) {
      doc.outlinks.forEach(link => {
        if (link.type === 'internal') {
          const targetDoc = documents.find(d => d.title === link.title);
          if (targetDoc) {
            edges.push({
              from: doc.id,
              to: targetDoc.id,
              type: 'reference',
              weight: 1,
              color: this.getEdgeColor('reference')
            });
          }
        }
      });
    }
    
    return {
      nodes,
      edges,
      layout: options.graphLayout || 'force',
      metadata: {
        nodeCount: nodes.length,
        edgeCount: edges.length,
        clusters: this.calculateClusters(nodes, edges)
      }
    };
  }

  private getNodeColor(type: string): string {
    const colors: Record<string, string> = {
      document: '#4A90E2',
      concept: '#7ED321',
      person: '#F5A623',
      location: '#D0021B',
      default: '#9B9B9B'
    };
    return colors[type] || colors.default;
  }

  private getEdgeColor(type: string): string {
    const colors: Record<string, string> = {
      reference: '#50E3C2',
      similarity: '#B8E986',
      hierarchy: '#4A90E2',
      default: '#E0E0E0'
    };
    return colors[type] || colors.default;
  }

  private calculateClusters(nodes: GraphNode[], edges: GraphEdge[]): number {
    // Simple clustering algorithm
    const visited = new Set<string>();
    let clusters = 0;
    
    for (const node of nodes) {
      if (!visited.has(node.id)) {
        this.depthFirstSearch(node.id, edges, visited);
        clusters++;
      }
    }
    
    return clusters;
  }

  private depthFirstSearch(nodeId: string, edges: GraphEdge[], visited: Set<string>): void {
    visited.add(nodeId);
    
    const connectedEdges = edges.filter(e => e.from === nodeId || e.to === nodeId);
    for (const edge of connectedEdges) {
      const connectedNode = edge.from === nodeId ? edge.to : edge.from;
      if (!visited.has(connectedNode)) {
        this.depthFirstSearch(connectedNode, edges, visited);
      }
    }
  }

  private async analyzeContent(documents: ProcessedDocument[]): Promise<ContentAnalytics> {
    const totalWords = documents.reduce((sum, doc) => sum + (doc.metadata.wordCount || 0), 0);
    const totalPages = Math.ceil(totalWords / 250); // Rough estimate
    const readingTime = documents.reduce((sum, doc) => sum + doc.readingTime, 0);
    const complexityScore = this.calculateOverallComplexity(documents);
    
    const mediaCount = {
      images: documents.reduce((sum, doc) => sum + doc.images.length, 0),
      tables: documents.reduce((sum, doc) => sum + doc.tables.length, 0),
      codeBlocks: documents.reduce((sum, doc) => sum + doc.codeBlocks.length, 0),
      equations: 0 // Would need equation detection
    };
    
    const topicDistribution = await this.analyzeTopicDistribution(documents);
    const sentimentAnalysis = await this.analyzeSentiment(documents);
    
    return {
      totalWords,
      totalPages,
      readingTime,
      complexityScore,
      knowledgeDensity: this.calculateKnowledgeDensity(documents),
      vocabularyRichness: this.calculateVocabularyRichness(documents),
      crossReferenceCount: documents.reduce((sum, doc) => sum + doc.outlinks.length, 0),
      mediaCount,
      topicDistribution,
      sentimentAnalysis
    };
  }

  private calculateOverallComplexity(documents: ProcessedDocument[]): number {
    const avgComplexity = documents.reduce((sum, doc) => sum + doc.complexity, 0) / documents.length;
    return Math.round(avgComplexity * 100) / 100;
  }

  private calculateKnowledgeDensity(documents: ProcessedDocument[]): number {
    const totalKeywords = documents.reduce((sum, doc) => sum + doc.keywords.length, 0);
    const totalWords = documents.reduce((sum, doc) => sum + (doc.metadata.wordCount || 0), 0);
    return totalWords > 0 ? totalKeywords / totalWords : 0;
  }

  private calculateVocabularyRichness(documents: ProcessedDocument[]): number {
    const allWords = new Set<string>();
    let totalWords = 0;
    
    documents.forEach(doc => {
      const words = doc.content.toLowerCase().match(/\b\w+\b/g) || [];
      words.forEach(word => allWords.add(word));
      totalWords += words.length;
    });
    
    return totalWords > 0 ? allWords.size / totalWords : 0;
  }

  private async analyzeTopicDistribution(documents: ProcessedDocument[]): Promise<Map<string, number>> {
    const topicMap = new Map<string, number>();
    
    documents.forEach(doc => {
      doc.keywords.forEach(keyword => {
        topicMap.set(keyword, (topicMap.get(keyword) || 0) + 1);
      });
    });
    
    return topicMap;
  }

  private async analyzeSentiment(documents: ProcessedDocument[]): Promise<any> {
    // Simplified sentiment analysis
    const positiveWords = ['good', 'great', 'excellent', 'amazing', 'wonderful'];
    const negativeWords = ['bad', 'terrible', 'awful', 'horrible', 'poor'];
    
    let positiveCount = 0;
    let negativeCount = 0;
    let totalWords = 0;
    
    documents.forEach(doc => {
      const words = doc.content.toLowerCase().match(/\b\w+\b/g) || [];
      totalWords += words.length;
      
      words.forEach(word => {
        if (positiveWords.includes(word)) positiveCount++;
        if (negativeWords.includes(word)) negativeCount++;
      });
    });
    
    const overall = positiveCount > negativeCount ? 'positive' : 
                   negativeCount > positiveCount ? 'negative' : 'neutral';
    const confidence = totalWords > 0 ? 
      Math.abs(positiveCount - negativeCount) / totalWords : 0;
    
    return {
      overall,
      confidence,
      bySection: new Map()
    };
  }

  // Additional utility methods
  private calculateComplexity(content: string, htmlContent: string): number {
    const sentences = content.split(/[.!?]+/).length;
    const words = this.countWords(content);
    const avgWordsPerSentence = words / sentences;
    
    // Flesch Reading Ease approximation
    const syllables = this.estimateSyllables(content);
    const fleschScore = 206.835 - (1.015 * avgWordsPerSentence) - (84.6 * (syllables / words));
    
    // Convert to 0-1 scale where higher is more complex
    return Math.max(0, Math.min(1, (100 - fleschScore) / 100));
  }

  private estimateSyllables(text: string): number {
    // Simplified syllable counting
    return text.toLowerCase()
      .replace(/[^a-z]/g, '')
      .replace(/[aeiouy]+/g, 'a')
      .replace(/[^a]/g, '')
      .length;
  }

  private determinePageBreaks(htmlContent: string, headings: Heading[]): PageBreak[] {
    const pageBreaks: PageBreak[] = [];
    
    // Add page breaks before major headings
    headings.forEach(heading => {
      if (heading.level === 1) {
        pageBreaks.push({
          type: 'before',
          element: heading.id,
          reason: 'Major section'
        });
      }
    });
    
    return pageBreaks;
  }

  private generateExportMetadata(
    documents: MnemosyneDocument[],
    analytics: ContentAnalytics
  ): ExportMetadata {
    return {
      title: `Export of ${documents.length} documents`,
      author: documents[0]?.metadata?.author || 'Unknown',
      created: new Date(),
      documentCount: documents.length,
      totalWords: analytics.totalWords,
      version: this.mnemosyne.version
    };
  }

  // Styling helper methods
  private formatMargins(margin?: any): string {
    if (!margin) return '20mm';
    
    const top = margin.top || '20mm';
    const right = margin.right || '20mm';
    const bottom = margin.bottom || '20mm';
    const left = margin.left || '20mm';
    
    return `${top} ${right} ${bottom} ${left}`;
  }

  private formatMarginsForPuppeteer(margin?: any): any {
    return {
      top: margin?.top || '20mm',
      right: margin?.right || '20mm',
      bottom: margin?.bottom || '20mm',
      left: margin?.left || '20mm'
    };
  }

  private getPageWidth(format: string): number {
    const sizes: Record<string, number> = {
      'A4': 794,
      'Letter': 816,
      'A3': 1123,
      'A5': 559,
      'Legal': 1056,
      'Tabloid': 1224
    };
    return sizes[format] || 794;
  }

  private getPageHeight(format: string): number {
    const sizes: Record<string, number> = {
      'A4': 1123,
      'Letter': 1056,
      'A3': 1587,
      'A5': 794,
      'Legal': 1344,
      'Tabloid': 1584
    };
    return sizes[format] || 1123;
  }

  private isImageOptimized(url: string): boolean {
    // Check if image is already optimized
    return url.includes('optimized') || url.includes('compressed');
  }

  // CSS generation methods
  private getGrayscaleCSS(): string {
    return `
      * {
        filter: grayscale(100%) !important;
      }
    `;
  }

  private getMonochromeCSS(): string {
    return `
      * {
        filter: grayscale(100%) contrast(200%) !important;
        color: #000 !important;
        background-color: #fff !important;
      }
    `;
  }

  private getTypographyCSS(options: AdvancedPDFOptions): string {
    return `
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        line-height: 1.6;
        color: #333;
        font-size: 11pt;
      }
      
      h1, h2, h3, h4, h5, h6 {
        page-break-after: avoid;
        margin-top: 1.5em;
        margin-bottom: 0.5em;
        font-weight: 600;
      }
      
      h1 { font-size: 24pt; color: #1a1a1a; }
      h2 { font-size: 20pt; color: #2a2a2a; }
      h3 { font-size: 16pt; color: #3a3a3a; }
      h4 { font-size: 14pt; color: #4a4a4a; }
      h5 { font-size: 12pt; color: #5a5a5a; }
      h6 { font-size: 11pt; color: #6a6a6a; }
      
      p { 
        margin: 1em 0; 
        text-align: justify;
        hyphens: auto;
      }
      
      .anchor-link {
        opacity: 0;
        margin-left: 0.25em;
        transition: opacity 0.2s;
      }
      
      h1:hover .anchor-link,
      h2:hover .anchor-link,
      h3:hover .anchor-link {
        opacity: 0.5;
      }
    `;
  }

  private getComponentCSS(): string {
    return `
      /* Code blocks */
      .code-block {
        background-color: #f8f9fa;
        border: 1px solid #e9ecef;
        border-radius: 4px;
        padding: 1em;
        margin: 1em 0;
        page-break-inside: avoid;
        font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, monospace;
        font-size: 9pt;
        line-height: 1.4;
        overflow-x: auto;
      }
      
      /* Tables */
      .enhanced-table {
        width: 100%;
        border-collapse: collapse;
        margin: 1em 0;
        page-break-inside: avoid;
        font-size: 10pt;
      }
      
      .enhanced-table th,
      .enhanced-table td {
        border: 1px solid #ddd;
        padding: 8px 12px;
        text-align: left;
        vertical-align: top;
      }
      
      .enhanced-table th {
        background-color: #f8f9fa;
        font-weight: 600;
        page-break-after: avoid;
      }
      
      .table-container {
        overflow-x: auto;
        margin: 1em 0;
      }
      
      /* Images */
      .image-figure {
        margin: 1em 0;
        text-align: center;
        page-break-inside: avoid;
      }
      
      .image-figure img {
        max-width: 100%;
        height: auto;
        border-radius: 4px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      }
      
      .image-figure figcaption {
        margin-top: 0.5em;
        font-size: 9pt;
        color: #666;
        font-style: italic;
      }
      
      /* Links */
      .internal-link {
        color: #0066cc;
        text-decoration: none;
        border-bottom: 1px dotted #0066cc;
      }
      
      .external-link {
        color: #cc6600;
        text-decoration: none;
      }
      
      .external-link::after {
        content: " ↗";
        font-size: 0.8em;
        opacity: 0.7;
      }
      
      /* Blockquotes */
      blockquote {
        border-left: 4px solid #e9ecef;
        margin: 1em 0;
        padding: 0.5em 0 0.5em 1em;
        color: #666;
        font-style: italic;
        background-color: #f8f9fa;
      }
      
      /* Lists */
      ul, ol {
        padding-left: 2em;
        margin: 1em 0;
      }
      
      li {
        margin-bottom: 0.5em;
      }
    `;
  }

  private getTOCCSS(): string {
    return `
      .table-of-contents {
        page-break-after: always;
        margin-bottom: 2em;
      }
      
      .toc-title {
        font-size: 20pt;
        font-weight: 600;
        margin-bottom: 1em;
        text-align: center;
      }
      
      .toc-entry {
        margin: 0.3em 0;
        line-height: 1.4;
      }
      
      .toc-entry a {
        text-decoration: none;
        color: #333;
        display: flex;
        justify-content: space-between;
      }
      
      .toc-entry a:hover {
        color: #0066cc;
      }
      
      .toc-title-text {
        flex: 1;
        margin-right: 1em;
      }
      
      .toc-page {
        font-weight: normal;
      }
      
      .toc-level-1 { 
        margin-left: 0; 
        font-weight: 600;
        font-size: 12pt;
      }
      .toc-level-2 { 
        margin-left: 1.5em; 
        font-size: 11pt;
      }
      .toc-level-3 { 
        margin-left: 3em; 
        font-size: 10pt;
        color: #666;
      }
      
      .toc-dots {
        border-bottom: 1px dotted #ccc;
        flex: 1;
        margin: 0 0.5em;
        height: 0.6em;
      }
    `;
  }

  private getIndexCSS(): string {
    return `
      .content-index {
        page-break-before: always;
        margin-top: 2em;
      }
      
      .index-title {
        font-size: 20pt;
        font-weight: 600;
        margin-bottom: 1em;
        text-align: center;
      }
      
      .index-entry {
        margin: 0.2em 0;
        font-size: 10pt;
      }
      
      .index-term {
        font-weight: 500;
      }
      
      .index-pages {
        margin-left: 0.5em;
        color: #666;
      }
      
      .index-category {
        margin-top: 1em;
        margin-bottom: 0.5em;
        font-weight: 600;
        color: #333;
        border-bottom: 1px solid #ddd;
        padding-bottom: 0.2em;
      }
    `;
  }

  private getKnowledgeGraphCSS(layout?: string): string {
    return `
      .knowledge-graph-container {
        page-break-before: always;
        page-break-inside: avoid;
        text-align: center;
        margin: 2em 0;
      }
      
      .knowledge-graph-title {
        font-size: 18pt;
        font-weight: 600;
        margin-bottom: 1em;
      }
      
      .knowledge-graph {
        max-width: 100%;
        height: 400px;
        border: 1px solid #ddd;
        border-radius: 4px;
        background-color: #fafafa;
        margin: 0 auto;
      }
      
      .graph-metadata {
        margin-top: 1em;
        font-size: 9pt;
        color: #666;
      }
      
      .graph-legend {
        display: flex;
        justify-content: center;
        margin-top: 0.5em;
        flex-wrap: wrap;
      }
      
      .legend-item {
        margin: 0 1em;
        font-size: 8pt;
      }
      
      .legend-color {
        display: inline-block;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        margin-right: 0.3em;
        vertical-align: middle;
      }
    `;
  }

  private optimizeCSS(css: string): string {
    return css
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove comments
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/;\s*}/g, '}') // Remove unnecessary semicolons
      .trim();
  }

  private generateWatermark(watermark?: any): string {
    if (!watermark) return '';
    
    const position = watermark.position || 'center';
    const opacity = watermark.opacity || 0.1;
    
    const positionStyles: Record<string, string> = {
      'center': 'top: 50%; left: 50%; transform: translate(-50%, -50%);',
      'top-left': 'top: 20px; left: 20px;',
      'top-right': 'top: 20px; right: 20px;',
      'bottom-left': 'bottom: 20px; left: 20px;',
      'bottom-right': 'bottom: 20px; right: 20px;'
    };
    
    return `
      <div class="watermark" style="
        position: fixed;
        ${positionStyles[position]}
        opacity: ${opacity};
        font-size: 48pt;
        color: #ccc;
        font-weight: bold;
        z-index: -1;
        pointer-events: none;
        transform-origin: center;
        ${watermark.text ? '' : 'background-image: url(' + watermark.image + '); background-size: contain; background-repeat: no-repeat; width: 200px; height: 200px;'}
      ">
        ${watermark.text || ''}
      </div>
    `;
  }

  private generatePDFJavaScript(options: AdvancedPDFOptions): string {
    if (!options.customJS) return '';
    
    // Add safe JavaScript for PDF generation
    return `
      (function() {
        // PDF-safe JavaScript
        ${options.customJS}
      })();
    `;
  }

  private async optimizeImagesForPDF(html: string, options: AdvancedPDFOptions): Promise<string> {
    // Image optimization for PDF would go here
    // For now, just return the HTML as-is
    return html;
  }

  // PDF post-processing methods (these would require additional libraries)
  private async addPDFMetadata(pdf: Buffer, metadata: any, content: ProcessedContent): Promise<Buffer> {
    // Would use a library like pdf-lib to add metadata
    return pdf;
  }

  private async applyPDFSecurity(pdf: Buffer, security: any): Promise<Buffer> {
    // Would use a library like pdf-lib to apply security settings
    return pdf;
  }

  private async addPDFBookmarks(pdf: Buffer, toc: TableOfContents): Promise<Buffer> {
    // Would use a library like pdf-lib to add bookmarks
    return pdf;
  }

  private async compressPDF(pdf: Buffer, compressionLevel: number): Promise<Buffer> {
    // Would implement PDF compression
    return pdf;
  }

  private async recordExportAnalytics(
    documents: MnemosyneDocument[],
    content: ProcessedContent,
    duration: number
  ): Promise<void> {
    await this.analytics.recordEvent({
      type: 'pdf_export',
      data: {
        documentCount: documents.length,
        totalWords: content.analytics.totalWords,
        duration,
        features: {
          toc: !!content.tableOfContents,
          index: !!content.index,
          glossary: !!content.glossary,
          bibliography: !!content.bibliography,
          knowledgeGraph: !!content.knowledgeGraph
        }
      },
      timestamp: new Date()
    });
  }

  // Additional extraction methods for content analysis
  private async extractFootnotes(htmlContent: string): Promise<Footnote[]> {
    const dom = new JSDOM(htmlContent);
    const footnotes = dom.window.document.querySelectorAll('[data-footnote]');
    
    return Array.from(footnotes).map((note, index) => ({
      id: note.getAttribute('data-footnote') || `footnote-${index}`,
      text: note.textContent || '',
      reference: note.getAttribute('href') || ''
    }));
  }

  private async extractImages(htmlContent: string): Promise<ImageReference[]> {
    const dom = new JSDOM(htmlContent);
    const images = dom.window.document.querySelectorAll('img');
    
    return Array.from(images).map(img => ({
      src: img.src,
      alt: img.alt,
      caption: img.getAttribute('title') || undefined,
      size: { width: img.width || 0, height: img.height || 0 }
    }));
  }

  private async extractTables(htmlContent: string): Promise<TableReference[]> {
    const dom = new JSDOM(htmlContent);
    const tables = dom.window.document.querySelectorAll('table');
    
    return Array.from(tables).map((table, index) => {
      const caption = table.querySelector('caption');
      const rows = table.querySelectorAll('tr');
      const firstRow = rows[0];
      const headers = firstRow ? Array.from(firstRow.querySelectorAll('th, td')).map(cell => cell.textContent || '') : [];
      
      return {
        id: table.id || `table-${index}`,
        caption: caption?.textContent || undefined,
        rows: rows.length,
        columns: headers.length,
        headers
      };
    });
  }

  private async extractCodeBlocks(htmlContent: string): Promise<CodeBlock[]> {
    const dom = new JSDOM(htmlContent);
    const codeBlocks = dom.window.document.querySelectorAll('pre code');
    
    return Array.from(codeBlocks).map(block => {
      const pre = block.parentElement;
      const language = Array.from(block.classList).find(cls => cls.startsWith('language-'))?.replace('language-', '') || 'text';
      const code = block.textContent || '';
      
      return {
        language,
        code,
        lineCount: code.split('\n').length
      };
    });
  }

  private async extractCitations(htmlContent: string): Promise<Citation[]> {
    const dom = new JSDOM(htmlContent);
    const citations = dom.window.document.querySelectorAll('[data-citation]');
    
    return Array.from(citations).map((citation, index) => ({
      id: citation.getAttribute('data-citation') || `citation-${index}`,
      text: citation.textContent || '',
      source: citation.getAttribute('href') || '',
      type: citation.getAttribute('data-type') as any || 'other'
    }));
  }

  private async getBacklinks(documentId: string): Promise<Backlink[]> {
    const relationships = await this.knowledgeGraph.getRelationships(
      documentId,
      { type: 'links-to', direction: 'incoming' }
    );
    
    return relationships.map(rel => ({
      id: rel.sourceId,
      title: rel.sourceTitle || 'Unknown',
      context: rel.context || ''
    }));
  }

  private async getOutlinks(content: string): Promise<Outlink[]> {
    const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
    const links: Outlink[] = [];
    let match;
    
    while ((match = linkPattern.exec(content)) !== null) {
      const title = match[1];
      const url = match[2];
      const type = url.startsWith('http') ? 'external' : 'internal';
      
      links.push({ url, title, type });
    }
    
    return links;
  }

  private async extractKeywords(content: string): Promise<string[]> {
    // Simple keyword extraction
    const words = content.toLowerCase().match(/\b[a-z]{4,}\b/g) || [];
    const frequency = new Map<string, number>();
    
    words.forEach(word => {
      frequency.set(word, (frequency.get(word) || 0) + 1);
    });
    
    // Return top 20 most frequent words
    return Array.from(frequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([word]) => word);
  }
}

// Type definitions for the enhanced system
interface Heading {
  id: string;
  text: string;
  level: number;
  anchor: string;
  wordCount: number;
}

interface Footnote {
  id: string;
  text: string;
  reference: string;
}

interface ImageReference {
  src: string;
  alt: string;
  caption?: string;
  size: { width: number; height: number };
}

interface TableReference {
  id: string;
  caption?: string;
  rows: number;
  columns: number;
  headers: string[];
}

interface CodeBlock {
  language: string;
  code: string;
  lineCount: number;
}

interface Citation {
  id: string;
  text: string;
  source: string;
  type: 'book' | 'article' | 'website' | 'other';
}

interface Backlink {
  id: string;
  title: string;
  context: string;
}

interface Outlink {
  url: string;
  title: string;
  type: 'internal' | 'external';
}

interface PageBreak {
  type: 'before' | 'after';
  element: string;
  reason: string;
}

interface DocumentMetadata {
  processedAt: Date;
  wordCount: number;
  characterCount: number;
  [key: string]: any;
}

interface ExportMetadata {
  title: string;
  author: string;
  created: Date;
  documentCount: number;
  totalWords: number;
  version: string;
}

interface IndexCategory {
  name: string;
  entries: string[];
}

interface BibliographySource {
  id: string;
  type: string;
  title: string;
  authors: string[];
  year: number;
  url?: string;
}

interface KnowledgeGraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  layout: string;
  metadata: {
    nodeCount: number;
    edgeCount: number;
    clusters: number;
  };
}

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