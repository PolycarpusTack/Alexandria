import { 
  MnemosyneCore, 
  Document as MnemosyneDocument,
  KnowledgeGraph 
} from '../../../core/MnemosyneCore';
import { TemplateEngine } from '../../templates/TemplateEngine';
import { PDFExporter } from '../exporters/PDFExporter';
import { StaticSiteExporter } from '../exporters/StaticSiteExporter';
import { HTMLExporter } from '../exporters/HTMLExporter';
import { ArchiveExporter } from '../exporters/ArchiveExporter';
import { AlfredAPI } from '@alexandria/alfred-sdk';

export interface ExportConfig {
  format: 'pdf' | 'html' | 'site' | 'archive';
  documents: DocumentSelection;
  template?: string;
  options: ExportOptions;
  enhancement?: AIExportEnhancement;
}

export interface DocumentSelection {
  type: 'single' | 'multiple' | 'query' | 'all';
  ids?: string[];
  query?: string;
  includeRelated?: boolean;
  depth?: number;
}

export interface ExportOptions {
  // Common options
  includeMetadata?: boolean;
  includeGraph?: boolean;
  includeBacklinks?: boolean;
  
  // PDF options
  pdfOptions?: {
    format?: 'A4' | 'Letter' | 'A3';
    margins?: string;
    headerFooter?: boolean;
    tableOfContents?: boolean;
    pageNumbers?: boolean;
  };
  
  // Site options
  siteOptions?: {
    generator?: 'hugo' | 'jekyll' | '11ty';
    theme?: string;
    baseUrl?: string;
    enableSearch?: boolean;
    enableGraph?: boolean;
  };
  
  // Archive options
  archiveOptions?: {
    format?: 'zip' | 'tar.gz';
    encryption?: boolean;
    password?: string;
  };
}

export interface ExportResult {
  success: boolean;
  format: string;
  output: Buffer | string;
  metadata: ExportMetadata;
  errors?: ExportError[];
}

export class ExportEngine {
  private templateEngine: TemplateEngine;
  private exporters: Map<string, any> = new Map();
  private alfred?: AlfredAPI;
  
  constructor(private mnemosyne: MnemosyneCore) {
    this.templateEngine = new TemplateEngine(mnemosyne);
    this.initializeExporters();
    this.initializeAlfred();
  }

  private async initializeAlfred(): Promise<void> {
    try {
      const alexandria = this.mnemosyne.getAlexandriaContext();
      this.alfred = await alexandria.getPlugin<AlfredAPI>('alfred');
    } catch (error) {
      console.log('ALFRED not available for export enhancement');
    }
  }

  private initializeExporters(): void {
    this.exporters.set('pdf', new PDFExporter(this.mnemosyne, this.templateEngine));
    this.exporters.set('html', new HTMLExporter(this.mnemosyne, this.templateEngine));
    this.exporters.set('site', new StaticSiteExporter(this.mnemosyne, this.templateEngine));
    this.exporters.set('archive', new ArchiveExporter(this.mnemosyne));
  }

  /**
   * Main export orchestration method
   */
  async export(config: ExportConfig): Promise<ExportResult> {
    const startTime = Date.now();
    
    try {
      // 1. Gather documents based on selection
      const documents = await this.gatherDocuments(config.documents);
      
      // 2. Enhance with AI if requested
      let enhancedDocs = documents;
      if (config.enhancement?.enabled && this.alfred) {
        enhancedDocs = await this.enhanceDocuments(documents, config.enhancement);
      }
      
      // 3. Get appropriate exporter
      const exporter = this.exporters.get(config.format);
      if (!exporter) {
        throw new Error(`No exporter found for format: ${config.format}`);
      }
      
      // 4. Prepare export context
      const context = await this.buildExportContext(enhancedDocs, config);
      
      // 5. Execute export
      const output = await exporter.export(enhancedDocs, context, config.options);
      
      // 6. Track export in knowledge graph
      await this.trackExport(config, documents);
      
      // 7. Return result
      return {
        success: true,
        format: config.format,
        output,
        metadata: {
          documentCount: documents.length,
          exportDate: new Date(),
          duration: Date.now() - startTime,
          config
        }
      };
      
    } catch (error) {
      return {
        success: false,
        format: config.format,
        output: '',
        metadata: {} as any,
        errors: [{ message: error.message, stack: error.stack }]
      };
    }
  }

  /**
   * Gather documents based on selection criteria
   */
  private async gatherDocuments(selection: DocumentSelection): Promise<MnemosyneDocument[]> {
    let documents: MnemosyneDocument[] = [];
    
    switch (selection.type) {
      case 'single':
        if (selection.ids?.[0]) {
          const doc = await this.mnemosyne.getDocument(selection.ids[0]);
          if (doc) documents = [doc];
        }
        break;
        
      case 'multiple':
        if (selection.ids) {
          documents = await Promise.all(
            selection.ids.map(id => this.mnemosyne.getDocument(id))
          ).then(docs => docs.filter(Boolean) as MnemosyneDocument[]);
        }
        break;
        
      case 'query':
        if (selection.query) {
          documents = await this.mnemosyne.searchDocuments(selection.query);
        }
        break;
        
      case 'all':
        documents = await this.mnemosyne.getAllDocuments();
        break;
    }
    
    // Include related documents if requested
    if (selection.includeRelated) {
      const related = await this.getRelatedDocuments(
        documents,
        selection.depth || 1
      );
      documents = [...documents, ...related];
    }
    
    // Remove duplicates
    const uniqueIds = new Set<string>();
    return documents.filter(doc => {
      if (uniqueIds.has(doc.id)) return false;
      uniqueIds.add(doc.id);
      return true;
    });
  }
}
  /**
   * Get related documents from knowledge graph
   */
  private async getRelatedDocuments(
    documents: MnemosyneDocument[],
    depth: number
  ): Promise<MnemosyneDocument[]> {
    const related: MnemosyneDocument[] = [];
    const visited = new Set<string>(documents.map(d => d.id));
    
    for (const doc of documents) {
      const connections = await this.mnemosyne.knowledgeGraph.getRelated(
        doc.id,
        { depth, types: ['document'] }
      );
      
      for (const node of connections) {
        if (!visited.has(node.id)) {
          visited.add(node.id);
          const relatedDoc = await this.mnemosyne.getDocument(node.id);
          if (relatedDoc) related.push(relatedDoc);
        }
      }
    }
    
    return related;
  }

  /**
   * Build export context with metadata
   */
  private async buildExportContext(
    documents: MnemosyneDocument[],
    config: ExportConfig
  ): Promise<ExportContext> {
    const context: ExportContext = {
      documents,
      metadata: {
        exportDate: new Date(),
        documentCount: documents.length,
        format: config.format,
        mnemosyne: {
          version: this.mnemosyne.version,
          knowledgeBase: this.mnemosyne.getKnowledgeBase().name
        }
      },
      options: config.options
    };
    
    // Add knowledge graph data if requested
    if (config.options.includeGraph) {
      context.knowledgeGraph = await this.buildKnowledgeGraphData(documents);
    }
    
    // Add backlinks if requested
    if (config.options.includeBacklinks) {
      context.backlinks = await this.buildBacklinksData(documents);
    }
    
    // Add template if specified
    if (config.template) {
      context.template = await this.templateEngine.getTemplate(config.template);
    }
    
    return context;
  }

  /**
   * Enhance documents with AI
   */
  private async enhanceDocuments(
    documents: MnemosyneDocument[],
    enhancement: AIExportEnhancement
  ): Promise<MnemosyneDocument[]> {
    if (!this.alfred) return documents;
    
    const enhanced = [];
    
    for (const doc of documents) {
      let enhancedDoc = { ...doc };
      
      // Generate table of contents
      if (enhancement.generateTOC) {
        enhancedDoc.tableOfContents = await this.alfred.generateTOC(doc.content);
      }
      
      // Create executive summary
      if (enhancement.executiveSummary) {
        enhancedDoc.executiveSummary = await this.alfred.generate({
          prompt: `Create an executive summary for: ${doc.title}`,
          context: doc.content,
          maxTokens: 300
        });
      }
      
      // Improve formatting
      if (enhancement.improveFormatting) {
        enhancedDoc.content = await this.alfred.format({
          content: doc.content,
          style: enhancement.formatStyle || 'professional'
        });
      }
      
      // Generate citations
      if (enhancement.generateCitations) {
        enhancedDoc.citations = await this.alfred.extractCitations(doc.content);
      }
      
      enhanced.push(enhancedDoc);
    }
    
    return enhanced;
  }

  /**
   * Track export in knowledge graph
   */
  private async trackExport(
    config: ExportConfig,
    documents: MnemosyneDocument[]
  ): Promise<void> {
    const exportNode = {
      type: 'export',
      id: `export-${Date.now()}`,
      title: `Export: ${config.format} - ${new Date().toISOString()}`,
      metadata: {
        format: config.format,
        documentCount: documents.length,
        documentIds: documents.map(d => d.id),
        config,
        timestamp: new Date()
      }
    };
    
    await this.mnemosyne.knowledgeGraph.addNode(exportNode);
    
    // Link to exported documents
    for (const doc of documents) {
      await this.mnemosyne.knowledgeGraph.link(
        exportNode.id,
        doc.id,
        'exported'
      );
    }
  }

  /**
   * Export presets for common use cases
   */
  async exportWithPreset(preset: ExportPreset, documents?: DocumentSelection): Promise<ExportResult> {
    const presets = {
      'academic-paper': {
        format: 'pdf' as const,
        template: 'academic-paper',
        options: {
          pdfOptions: {
            format: 'A4' as const,
            tableOfContents: true,
            pageNumbers: true
          },
          includeMetadata: true,
          includeBacklinks: true
        }
      },
      'blog-post': {
        format: 'html' as const,
        template: 'blog-post',
        options: {
          includeMetadata: false,
          includeGraph: false
        }
      },
      'knowledge-site': {
        format: 'site' as const,
        template: 'documentation',
        options: {
          siteOptions: {
            generator: 'hugo' as const,
            theme: 'docsy',
            enableSearch: true,
            enableGraph: true
          },
          includeMetadata: true,
          includeGraph: true,
          includeBacklinks: true
        }
      },
      'backup': {
        format: 'archive' as const,
        options: {
          archiveOptions: {
            format: 'zip' as const,
            encryption: true
          },
          includeMetadata: true,
          includeGraph: true
        }
      }
    };
    
    const config = presets[preset];
    if (!config) {
      throw new Error(`Unknown preset: ${preset}`);
    }
    
    return this.export({
      ...config,
      documents: documents || { type: 'all' }
    });
  }

  /**
   * Batch export to multiple formats
   */
  async batchExport(
    documents: DocumentSelection,
    formats: ExportConfig[]
  ): Promise<ExportResult[]> {
    const results = [];
    
    for (const format of formats) {
      const result = await this.export({
        ...format,
        documents
      });
      results.push(result);
    }
    
    return results;
  }
}