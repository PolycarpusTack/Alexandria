import { 
  MnemosyneCore, 
  KnowledgeGraph, 
  Document as MnemosyneDocument 
} from '../../../core/MnemosyneCore';
import { ImportAdapter } from '../adapters/base/ImportAdapter';
import { ProvenanceTracker } from './ProvenanceTracker';
import { FormatConverter } from './FormatConverter';

export interface ImportConfig {
  source: ImportSource;
  options: ImportOptions;
  enhancement?: AIEnhancementOptions;
}

export interface ImportSource {
  type: 'obsidian' | 'notion' | 'roam' | 'logseq' | 'markdown';
  path: string;
  credentials?: any;
}

export interface ImportOptions {
  preserveStructure?: boolean;
  convertLinks?: boolean;
  importAttachments?: boolean;
  trackProvenance?: boolean;
  enableSync?: boolean;
  conflictStrategy?: 'keep-local' | 'keep-remote' | 'ai-merge';
}

export interface ImportResult {
  success: boolean;
  imported: number;
  failed: number;
  documents: MnemosyneDocument[];
  errors: ImportError[];
  provenance: ProvenanceNode[];
  report: ImportReport;
}

export class ImportEngine {
  private adapters: Map<string, ImportAdapter> = new Map();
  private provenanceTracker: ProvenanceTracker;
  private converter: FormatConverter;
  private alfred?: any;
  
  constructor(private mnemosyne: MnemosyneCore) {
    this.provenanceTracker = new ProvenanceTracker(mnemosyne);
    this.converter = new FormatConverter(mnemosyne);
    this.initializeAdapters();
    this.initializeAlfred();
  }

  private async initializeAlfred(): Promise<void> {
    try {
      const alexandria = this.mnemosyne.getAlexandriaContext();
      this.alfred = await alexandria.getPlugin('alfred');
    } catch (error) {
      console.log('ALFRED not available for import enhancement');
    }
  }

  /**
   * Main import orchestration method
   */
  async import(config: ImportConfig): Promise<ImportResult> {
    const startTime = Date.now();
    const result: ImportResult = {
      success: false,
      imported: 0,
      failed: 0,
      documents: [],
      errors: [],
      provenance: [],
      report: {} as ImportReport
    };

    try {
      // 1. Select appropriate adapter
      const adapter = this.getAdapter(config.source.type);
      if (!adapter) {
        throw new Error(`No adapter found for source type: ${config.source.type}`);
      }

      // 2. Analyze source
      const analysis = await adapter.analyze(config.source);
      result.report.analysis = analysis;

      // 3. Show preview to user (would trigger UI here)
      this.mnemosyne.emit('import:preview', { analysis, config });

      // 4. Parse content
      const parsed = await adapter.parse(config.source);
      
      // 5. Transform to Mnemosyne format
      const documents = await adapter.transform(parsed, config.options);

      // 6. Enhance with AI if requested
      if (config.enhancement?.enabled && this.alfred) {
        for (const doc of documents) {
          const enhanced = await this.enhanceWithAlfred(doc, config.enhancement);
          Object.assign(doc, enhanced);
        }
      }

      // 7. Map relationships in knowledge graph
      const relationships = await adapter.mapRelationships(documents);
      
      // 8. Track provenance
      if (config.options.trackProvenance) {
        for (const doc of documents) {
          const provenance = await this.provenanceTracker.track(doc, config.source);
          result.provenance.push(provenance);
        }
      }

      // 9. Import into Mnemosyne
      for (const doc of documents) {
        try {
          const imported = await this.mnemosyne.createDocument(doc);
          result.documents.push(imported);
          result.imported++;
        } catch (error) {
          result.errors.push({ document: doc, error });
          result.failed++;
        }
      }

      // 10. Create knowledge graph connections
      await this.mnemosyne.knowledgeGraph.addRelationships(relationships);

      // 11. Setup sync if requested
      if (config.options.enableSync) {
        await this.setupSync(config);
      }

      result.success = true;
      result.report.duration = Date.now() - startTime;
      
      // 12. Emit completion event
      this.mnemosyne.emit('import:complete', result);
      
    } catch (error) {
      result.errors.push({ error });
      this.mnemosyne.emit('import:error', error);
    }

    return result;
  }
}
  /**
   * Get adapter for source type
   */
  private getAdapter(type: string): ImportAdapter | null {
    return this.adapters.get(type) || null;
  }

  /**
   * Initialize all available adapters
   */
  private async initializeAdapters(): Promise<void> {
    // Lazy load adapters to reduce initial bundle size
    const adapterModules = {
      'obsidian': () => import('../adapters/ObsidianAdapter'),
      'notion': () => import('../adapters/NotionAdapter'),
      'roam': () => import('../adapters/RoamAdapter'),
      'logseq': () => import('../adapters/LogseqAdapter'),
      'markdown': () => import('../adapters/MarkdownAdapter')
    };

    for (const [type, loader] of Object.entries(adapterModules)) {
      try {
        const module = await loader();
        const adapter = new module.default(this.mnemosyne);
        this.adapters.set(type, adapter);
      } catch (error) {
        console.warn(`Failed to load adapter for ${type}:`, error);
      }
    }
  }

  /**
   * Enhance document with AI
   */
  private async enhanceWithAlfred(
    doc: MnemosyneDocument,
    options: AIEnhancementOptions
  ): Promise<Partial<MnemosyneDocument>> {
    if (!this.alfred) return {};

    const enhancements: Partial<MnemosyneDocument> = {};

    // Generate summary if missing
    if (options.generateSummary && !doc.summary) {
      enhancements.summary = await this.alfred.generate({
        prompt: `Summarize this document in 2-3 sentences: ${doc.content.slice(0, 1000)}`,
        model: 'codellama',
        maxTokens: 150
      });
    }

    // Extract and enhance tags
    if (options.enhanceTags) {
      const suggestedTags = await this.alfred.generate({
        prompt: `Suggest 5-7 relevant tags for this document: ${doc.content.slice(0, 1000)}`,
        model: 'codellama',
        format: 'json'
      });
      enhancements.tags = [...(doc.tags || []), ...suggestedTags];
    }

    // Generate knowledge graph suggestions
    if (options.suggestConnections) {
      const connections = await this.alfred.analyze({
        content: doc.content,
        context: 'knowledge-graph',
        existingDocs: await this.mnemosyne.getRecentDocuments(10)
      });
      enhancements.suggestedRelationships = connections;
    }

    // Improve formatting
    if (options.improveFormatting) {
      enhancements.content = await this.alfred.format({
        content: doc.content,
        style: 'academic',
        preserveStructure: true
      });
    }

    return enhancements;
  }

  /**
   * Setup continuous sync for imported source
   */
  private async setupSync(config: ImportConfig): Promise<void> {
    const { SyncEngine } = await import('../sync/SyncEngine');
    const syncEngine = new SyncEngine(this.mnemosyne);
    
    await syncEngine.createSyncConnection({
      source: config.source,
      direction: 'bidirectional',
      conflictStrategy: config.options.conflictStrategy || 'ai-merge',
      schedule: 'realtime'
    });
  }

  /**
   * Batch import multiple sources
   */
  async batchImport(configs: ImportConfig[]): Promise<ImportResult[]> {
    const results: ImportResult[] = [];
    
    // Process imports in parallel with concurrency limit
    const concurrency = 3;
    for (let i = 0; i < configs.length; i += concurrency) {
      const batch = configs.slice(i, i + concurrency);
      const batchResults = await Promise.all(
        batch.map(config => this.import(config))
      );
      results.push(...batchResults);
    }
    
    return results;
  }

  /**
   * Import from URL (for web-based sources)
   */
  async importFromURL(url: string, type?: string): Promise<ImportResult> {
    // Detect source type from URL if not provided
    const sourceType = type || this.detectSourceFromURL(url);
    
    return this.import({
      source: {
        type: sourceType as any,
        path: url
      },
      options: {
        preserveStructure: true,
        convertLinks: true,
        trackProvenance: true
      }
    });
  }

  /**
   * Get import statistics
   */
  async getImportStats(): Promise<ImportStatistics> {
    const imports = await this.mnemosyne.analytics.getImportHistory();
    
    return {
      totalImports: imports.length,
      bySource: this.groupBySource(imports),
      successRate: this.calculateSuccessRate(imports),
      averageDuration: this.calculateAverageDuration(imports),
      mostRecentImport: imports[0]
    };
  }

  private detectSourceFromURL(url: string): string {
    if (url.includes('notion.so')) return 'notion';
    if (url.includes('roamresearch.com')) return 'roam';
    if (url.includes('logseq.com')) return 'logseq';
    return 'markdown';
  }
}