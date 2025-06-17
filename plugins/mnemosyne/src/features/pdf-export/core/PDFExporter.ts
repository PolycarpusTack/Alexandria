/**
 * Core PDF Exporter - Orchestrates the PDF generation process
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
  PDFExportOptions,
  ProcessedContent,
  ProcessedDocument,
  ExportMetadata,
  ContentAnalytics
} from './types';
import { ContentProcessor } from '../processors/ContentProcessor';
import { TOCGenerator } from '../generators/TOCGenerator';
import { IndexGenerator } from '../generators/IndexGenerator';
import { GlossaryGenerator } from '../generators/GlossaryGenerator';
import { BibliographyGenerator } from '../generators/BibliographyGenerator';
import { KnowledgeGraphRenderer } from '../renderers/KnowledgeGraphRenderer';
import { PDFRenderer } from '../renderers/PDFRenderer';
import { TemplateRenderer } from '../renderers/TemplateRenderer';
import { SecurityManager } from '../utils/SecurityManager';
import { MetadataManager } from '../utils/MetadataManager';
import { PerformanceOptimizer } from '../utils/PerformanceOptimizer';
import * as fs from 'fs/promises';
import * as path from 'path';

export class PDFExporter {
  private mnemosyne: MnemosyneCore;
  private templateEngine: MnemosyneTemplateEngine;
  private knowledgeGraph: KnowledgeGraph;
  private analytics: AnalyticsEngine;
  
  // Processor and generator modules
  private contentProcessor: ContentProcessor;
  private tocGenerator: TOCGenerator;
  private indexGenerator: IndexGenerator;
  private glossaryGenerator: GlossaryGenerator;
  private bibliographyGenerator: BibliographyGenerator;
  private graphRenderer: KnowledgeGraphRenderer;
  private pdfRenderer: PDFRenderer;
  private templateRenderer: TemplateRenderer;
  
  // Utility modules
  private securityManager: SecurityManager;
  private metadataManager: MetadataManager;
  private performanceOptimizer: PerformanceOptimizer;

  constructor(
    mnemosyne: MnemosyneCore,
    templateEngine: MnemosyneTemplateEngine
  ) {
    this.mnemosyne = mnemosyne;
    this.templateEngine = templateEngine;
    this.knowledgeGraph = mnemosyne.getKnowledgeGraph();
    this.analytics = mnemosyne.getAnalytics();
    
    // Initialize modules
    this.contentProcessor = new ContentProcessor();
    this.tocGenerator = new TOCGenerator();
    this.indexGenerator = new IndexGenerator();
    this.glossaryGenerator = new GlossaryGenerator();
    this.bibliographyGenerator = new BibliographyGenerator();
    this.graphRenderer = new KnowledgeGraphRenderer(this.knowledgeGraph);
    this.templateRenderer = new TemplateRenderer(this.templateEngine);
    this.pdfRenderer = new PDFRenderer();
    this.securityManager = new SecurityManager();
    this.metadataManager = new MetadataManager();
    this.performanceOptimizer = new PerformanceOptimizer();
  }

  /**
   * Export documents to PDF with advanced features
   */
  async exportToPDF(
    documents: MnemosyneDocument[],
    context: ExportContext,
    options: ExportOptions & { pdfOptions?: PDFExportOptions } = {}
  ): Promise<Buffer> {
    const pdfOptions = this.mergeDefaultOptions(options.pdfOptions);
    const startTime = Date.now();
    
    try {
      // 1. Initialize performance optimization
      if (pdfOptions.parallelRendering) {
        this.performanceOptimizer.enableParallelProcessing();
      }
      
      // 2. Process documents
      const processedContent = await this.processDocuments(
        documents,
        context,
        pdfOptions
      );
      
      // 3. Generate supplementary content
      await this.generateSupplementaryContent(processedContent, pdfOptions);
      
      // 4. Render HTML with template
      const htmlContent = await this.renderHTML(processedContent, pdfOptions);
      
      // 5. Generate PDF from HTML
      const pdfBuffer = await this.generatePDF(htmlContent, pdfOptions);
      
      // 6. Apply security and metadata
      const securedPDF = await this.applySecurityAndMetadata(
        pdfBuffer,
        processedContent.metadata,
        pdfOptions
      );
      
      // 7. Record analytics
      await this.recordAnalytics(processedContent, Date.now() - startTime);
      
      return securedPDF;
      
    } catch (error) {
      throw this.enhanceError(error, 'PDF export failed', { 
        documents: documents.length, 
        options: pdfOptions 
      });
    }
  }

  /**
   * Process documents for PDF export
   */
  private async processDocuments(
    documents: MnemosyneDocument[],
    context: ExportContext,
    options: PDFExportOptions
  ): Promise<ProcessedContent> {
    // Process documents in chunks for better performance
    const chunkSize = options.chunkSize || 10;
    const processedDocs: ProcessedDocument[] = [];
    
    for (let i = 0; i < documents.length; i += chunkSize) {
      const chunk = documents.slice(i, i + chunkSize);
      const processed = await Promise.all(
        chunk.map(doc => this.contentProcessor.processDocument(doc, options))
      );
      processedDocs.push(...processed);
    }
    
    // Analyze content
    const analytics = await this.contentProcessor.analyzeContent(processedDocs);
    
    // Generate metadata
    const metadata: ExportMetadata = {
      exportDate: new Date(),
      documentCount: documents.length,
      totalPages: 0, // Will be calculated after rendering
      fileSize: 0, // Will be calculated after generation
      version: '1.0.0',
      generator: 'Mnemosyne Enhanced PDF Exporter'
    };
    
    return {
      documents: processedDocs,
      metadata,
      analytics
    };
  }

  /**
   * Generate supplementary content
   */
  private async generateSupplementaryContent(
    content: ProcessedContent,
    options: PDFExportOptions
  ): Promise<void> {
    // Generate table of contents
    if (options.tableOfContents) {
      content.tableOfContents = await this.tocGenerator.generate(
        content.documents,
        options.tocDepth || 3
      );
    }
    
    // Generate index
    if (options.includeIndex) {
      content.index = await this.indexGenerator.generate(content.documents);
    }
    
    // Generate glossary
    if (options.includeGlossary) {
      content.glossary = await this.glossaryGenerator.generate(content.documents);
    }
    
    // Generate bibliography
    if (options.includeBibliography) {
      content.bibliography = await this.bibliographyGenerator.generate(
        content.documents
      );
    }
    
    // Generate knowledge graph visualization
    if (options.includeKnowledgeGraph && this.knowledgeGraph) {
      content.knowledgeGraph = await this.graphRenderer.render(
        content.documents,
        {
          layout: options.graphLayout || 'hierarchical',
          depth: options.graphDepth || 2
        }
      );
    }
  }

  /**
   * Render HTML content
   */
  private async renderHTML(
    content: ProcessedContent,
    options: PDFExportOptions
  ): Promise<string> {
    // Select template
    const templateId = options.templateId || 'default-pdf';
    
    // Prepare template data
    const templateData = {
      content,
      options,
      customCSS: options.customCSS,
      customJS: options.customJS,
      variables: options.templateVariables || {}
    };
    
    // Render with template engine
    const html = await this.templateRenderer.renderPDF(templateId, templateData);
    
    return html;
  }

  /**
   * Generate PDF from HTML
   */
  private async generatePDF(
    html: string,
    options: PDFExportOptions
  ): Promise<Buffer> {
    // Configure PDF generation options
    const pdfConfig = {
      format: options.format || 'A4',
      printBackground: options.printBackground !== false,
      displayHeaderFooter: options.displayHeaderFooter || false,
      headerTemplate: options.headerTemplate,
      footerTemplate: options.footerTemplate,
      margin: options.margin || {
        top: '1in',
        right: '1in',
        bottom: '1in',
        left: '1in'
      },
      scale: options.scale || 1,
      landscape: options.orientation === 'landscape',
      preferCSSPageSize: true
    };
    
    // Generate PDF
    const pdfBuffer = await this.pdfRenderer.render(html, pdfConfig);
    
    // Apply watermark if configured
    if (options.watermark) {
      return await this.pdfRenderer.applyWatermark(pdfBuffer, options.watermark);
    }
    
    return pdfBuffer;
  }

  /**
   * Apply security and metadata to PDF
   */
  private async applySecurityAndMetadata(
    pdfBuffer: Buffer,
    exportMetadata: ExportMetadata,
    options: PDFExportOptions
  ): Promise<Buffer> {
    let result = pdfBuffer;
    
    // Apply security settings
    if (options.security) {
      result = await this.securityManager.securePDF(result, options.security);
    }
    
    // Apply metadata
    if (options.metadata) {
      const metadata = {
        ...options.metadata,
        ...exportMetadata
      };
      result = await this.metadataManager.applyMetadata(result, metadata);
    }
    
    return result;
  }

  /**
   * Record export analytics
   */
  private async recordAnalytics(
    content: ProcessedContent,
    exportTime: number
  ): Promise<void> {
    if (this.analytics) {
      await this.analytics.recordEvent('pdf-export', {
        documentCount: content.documents.length,
        totalWords: content.analytics.totalWords,
        exportTime,
        features: {
          toc: !!content.tableOfContents,
          index: !!content.index,
          glossary: !!content.glossary,
          bibliography: !!content.bibliography,
          knowledgeGraph: !!content.knowledgeGraph
        }
      });
    }
  }

  /**
   * Merge default options
   */
  private mergeDefaultOptions(options?: PDFExportOptions): PDFExportOptions {
    return {
      format: 'A4',
      orientation: 'portrait',
      scale: 1,
      margin: {
        top: '1in',
        right: '1in',
        bottom: '1in',
        left: '1in'
      },
      printBackground: true,
      colorMode: 'color',
      quality: 'normal',
      tableOfContents: true,
      tocDepth: 3,
      bookmarks: true,
      chunkSize: 10,
      cacheEnabled: true,
      compressionLevel: 6,
      ...options
    };
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