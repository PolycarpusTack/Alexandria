import { PluginContext } from '../../../../../../core/plugin-registry/interfaces';
import {
  ImportSource,
  ImportOptions,
  ImportResult,
  ImportAnalysis,
  ImportAdapter,
  ImportError,
  ProvenanceNode,
  ImportConflict,
  ConflictResolution,
  ParsedContent,
  ParsedDocument
} from '../interfaces';
import { MnemosyneDocument } from '../../../interfaces';
import { ProvenanceTracker } from './ProvenanceTracker';
import { FormatConverter } from './FormatConverter';
import { v4 as uuidv4 } from 'uuid';

export class ImportEngine {
  private adapters: Map<string, ImportAdapter> = new Map();
  private provenanceTracker: ProvenanceTracker;
  private formatConverter: FormatConverter;
  private activeImports: Map<string, ImportSession> = new Map();

  constructor(private context: PluginContext) {
    this.provenanceTracker = new ProvenanceTracker(context);
    this.formatConverter = new FormatConverter(context);
  }

  /**
   * Register an import adapter
   */
  registerAdapter(adapter: ImportAdapter): void {
    this.adapters.set(adapter.sourceType, adapter);
    this.context.logger.info(`Registered import adapter: ${adapter.sourceType}`);
  }

  /**
   * Analyze import source without importing
   */
  async analyze(source: ImportSource): Promise<ImportAnalysis> {
    const adapter = this.getAdapter(source.type);
    
    // Detect if source is valid
    const isValid = await adapter.detect(source);
    if (!isValid) {
      throw new Error(`Invalid ${source.type} source: ${source.path}`);
    }

    // Perform analysis
    const analysis = await adapter.analyze(source);
    
    // Check for potential conflicts
    analysis.conflicts = await this.detectConflicts(analysis);
    
    // Emit analysis event
    this.context.events.emit('mnemosyne:import:analyzed', {
      source,
      analysis
    });

    return analysis;
  }

  /**
   * Import documents from source
   */
  async import(
    source: ImportSource,
    options: ImportOptions
  ): Promise<ImportResult> {
    const sessionId = uuidv4();
    const session = new ImportSession(sessionId, source, options);
    this.activeImports.set(sessionId, session);

    try {
      // Start import
      session.start();
      this.context.events.emit('mnemosyne:import:started', { sessionId, source });

      // Get adapter
      const adapter = this.getAdapter(source.type);

      // Parse content
      session.updatePhase('parsing');
      const parsedContent = await adapter.parse(source);
      
      // Transform to Mnemosyne format
      session.updatePhase('transforming');
      const documents = await this.transformDocuments(
        parsedContent,
        adapter,
        options,
        session
      );

      // Handle conflicts
      session.updatePhase('resolving');
      const resolvedDocuments = await this.resolveConflicts(
        documents,
        options,
        session
      );

      // Save documents
      session.updatePhase('saving');
      const savedDocuments = await this.saveDocuments(
        resolvedDocuments,
        session
      );

      // Track provenance
      session.updatePhase('tracking');
      const provenanceNodes = await this.trackProvenance(
        savedDocuments,
        source,
        options,
        adapter
      );

      // Update knowledge graph
      session.updatePhase('graphing');
      await this.updateKnowledgeGraph(savedDocuments, adapter);

      // Complete import
      session.complete(savedDocuments, provenanceNodes);
      
      const result = session.getResult();
      
      // Emit completion event
      this.context.events.emit('mnemosyne:import:completed', {
        sessionId,
        result
      });

      return result;

    } catch (error) {
      session.fail(error);
      this.context.logger.error('Import failed', {
        sessionId,
        source,
        error: error.message
      });
      throw error;
    } finally {
      this.activeImports.delete(sessionId);
    }
  }

  /**
   * Get import session status
   */
  getImportStatus(sessionId: string): ImportSession | null {
    return this.activeImports.get(sessionId) || null;
  }

  /**
   * Cancel active import
   */
  async cancelImport(sessionId: string): Promise<void> {
    const session = this.activeImports.get(sessionId);
    if (session) {
      session.cancel();
      this.activeImports.delete(sessionId);
      this.context.events.emit('mnemosyne:import:cancelled', { sessionId });
    }
  }

  // Private methods

  private getAdapter(type: string): ImportAdapter {
    const adapter = this.adapters.get(type);
    if (!adapter) {
      throw new Error(`No adapter registered for type: ${type}`);
    }
    return adapter;
  }

  private async transformDocuments(
    parsedContent: ParsedContent,
    adapter: ImportAdapter,
    options: ImportOptions,
    session: ImportSession
  ): Promise<MnemosyneDocument[]> {
    const documents: MnemosyneDocument[] = [];
    
    for (const parsedDoc of parsedContent.documents) {
      try {
        session.updateProgress('transforming', parsedDoc.path);
        
        // Basic transformation
        const docs = await adapter.transform(parsedContent, options);
        
        // Apply format conversion if needed
        for (const doc of docs) {
          const converted = await this.formatConverter.convert(doc, {
            sourceFormat: parsedDoc.format,
            preserveStructure: options.preserveStructure,
            convertWikilinks: options.convertWikilinks
          });
          
          documents.push(converted);
        }
        
        session.incrementProcessed();
      } catch (error) {
        session.addError({
          documentPath: parsedDoc.path,
          error: error.message,
          phase: 'transform'
        });
      }
    }
    
    return documents;
  }

  private async detectConflicts(analysis: ImportAnalysis): Promise<ImportConflict[]> {
    const conflicts: ImportConflict[] = [];
    
    // Check for duplicate titles
    for (const sample of analysis.sample) {
      const existing = await this.checkExistingDocument(sample.title);
      if (existing) {
        conflicts.push({
          type: 'duplicate',
          description: `Document "${sample.title}" already exists`,
          documentPath: sample.path
        });
      }
    }
    
    return conflicts;
  }

  private async resolveConflicts(
    documents: MnemosyneDocument[],
    options: ImportOptions,
    session: ImportSession
  ): Promise<MnemosyneDocument[]> {
    const resolved: MnemosyneDocument[] = [];
    
    for (const doc of documents) {
      const conflict = await this.checkDocumentConflict(doc);
      
      if (!conflict) {
        resolved.push(doc);
        continue;
      }
      
      const resolution = await this.resolveConflict(conflict, options);
      
      switch (resolution.strategy) {
        case 'skip':
          session.incrementSkipped();
          break;
          
        case 'rename':
          doc.title = resolution.newName || `${doc.title} (imported)`;
          resolved.push(doc);
          break;
          
        case 'merge':
          const merged = await this.mergeDocuments(doc, conflict);
          resolved.push(merged);
          break;
          
        case 'replace':
          resolved.push(doc);
          break;
      }
    }
    
    return resolved;
  }

  private async saveDocuments(
    documents: MnemosyneDocument[],
    session: ImportSession
  ): Promise<MnemosyneDocument[]> {
    const saved: MnemosyneDocument[] = [];
    
    for (const doc of documents) {
      try {
        session.updateProgress('saving', doc.title);
        
        // Save to database
        const savedDoc = await this.saveDocument(doc);
        saved.push(savedDoc);
        
        session.incrementProcessed();
      } catch (error) {
        session.addError({
          documentPath: doc.title,
          error: error.message,
          phase: 'save'
        });
        session.incrementFailed();
      }
    }
    
    return saved;
  }

  private async trackProvenance(
    documents: MnemosyneDocument[],
    source: ImportSource,
    options: ImportOptions,
    adapter: ImportAdapter
  ): Promise<ProvenanceNode[]> {
    const provenanceNodes: ProvenanceNode[] = [];
    
    for (const doc of documents) {
      const node = await adapter.trackProvenance(doc, source);
      const saved = await this.provenanceTracker.track(node);
      provenanceNodes.push(saved);
    }
    
    return provenanceNodes;
  }

  private async updateKnowledgeGraph(
    documents: MnemosyneDocument[],
    adapter: ImportAdapter
  ): Promise<void> {
    const graphUpdate = await adapter.mapRelationships(documents);
    
    // Update knowledge graph with new nodes and relationships
    await this.context.storage.set('graph_update', graphUpdate);
    
    this.context.events.emit('mnemosyne:graph:updated', graphUpdate);
  }

  private async checkExistingDocument(title: string): Promise<boolean> {
    const query = `
      SELECT EXISTS(
        SELECT 1 FROM mnemosyne_documents 
        WHERE title = $1
      )
    `;
    const result = await this.context.db.query(query, [title]);
    return result.rows[0].exists;
  }

  private async checkDocumentConflict(doc: MnemosyneDocument): Promise<any> {
    // Check for conflicts based on title, content hash, etc.
    return null; // Simplified for now
  }

  private async resolveConflict(
    conflict: any,
    options: ImportOptions
  ): Promise<ConflictResolution> {
    // Apply conflict resolution strategy
    return {
      strategy: options.conflictStrategy || 'skip'
    };
  }

  private async mergeDocuments(
    newDoc: MnemosyneDocument,
    existing: any
  ): Promise<MnemosyneDocument> {
    // Merge logic would go here
    return newDoc;
  }

  private async saveDocument(doc: MnemosyneDocument): Promise<MnemosyneDocument> {
    // Save document using document service
    // This would integrate with existing MnemosyneDocumentService
    return doc;
  }
}

/**
 * Import session tracker
 */
class ImportSession {
  private status: 'idle' | 'running' | 'completed' | 'failed' | 'cancelled' = 'idle';
  private phase: string = 'initializing';
  private processed = 0;
  private skipped = 0;
  private failed = 0;
  private errors: ImportError[] = [];
  private startTime?: Date;
  private endTime?: Date;
  private documents: MnemosyneDocument[] = [];
  private provenanceNodes: ProvenanceNode[] = [];

  constructor(
    public readonly id: string,
    public readonly source: ImportSource,
    public readonly options: ImportOptions
  ) {}

  start(): void {
    this.status = 'running';
    this.startTime = new Date();
  }

  updatePhase(phase: string): void {
    this.phase = phase;
  }

  updateProgress(action: string, item: string): void {
    // Progress tracking
  }

  incrementProcessed(): void {
    this.processed++;
  }

  incrementSkipped(): void {
    this.skipped++;
  }

  incrementFailed(): void {
    this.failed++;
  }

  addError(error: ImportError): void {
    this.errors.push(error);
  }

  complete(documents: MnemosyneDocument[], provenanceNodes: ProvenanceNode[]): void {
    this.status = 'completed';
    this.endTime = new Date();
    this.documents = documents;
    this.provenanceNodes = provenanceNodes;
  }

  fail(error: Error): void {
    this.status = 'failed';
    this.endTime = new Date();
    this.errors.push({
      documentPath: 'import',
      error: error.message,
      phase: this.phase as any
    });
  }

  cancel(): void {
    this.status = 'cancelled';
    this.endTime = new Date();
  }

  getResult(): ImportResult {
    return {
      success: this.status === 'completed',
      imported: this.processed - this.skipped - this.failed,
      skipped: this.skipped,
      failed: this.failed,
      documents: this.documents,
      errors: this.errors,
      provenance: this.provenanceNodes
    };
  }

  getStatus(): any {
    return {
      id: this.id,
      status: this.status,
      phase: this.phase,
      processed: this.processed,
      skipped: this.skipped,
      failed: this.failed,
      errors: this.errors.length,
      duration: this.getDuration()
    };
  }

  private getDuration(): number {
    if (!this.startTime) return 0;
    const end = this.endTime || new Date();
    return end.getTime() - this.startTime.getTime();
  }
}