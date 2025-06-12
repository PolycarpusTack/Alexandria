/**
 * Mnemosyne Document Service
 *
 * Enterprise-grade document management service with version control,
 * collaboration, full-text search, and knowledge graph integration
 */

import { Logger, DataService, EventBus } from '@alexandria/plugin-interface';
import { MnemosyneConfiguration } from '../config/Configuration';
import {
  ServiceConstructorOptions,
  MnemosyneService,
  ServiceStatus,
  ServiceMetrics,
  Document,
  DocumentStatus,
  DocumentVersion,
  DocumentProvenance,
  ViewEvent,
  SearchQuery,
  SearchResult
} from '../../types/core';

export interface DocumentCreateOptions {
  autoIndex?: boolean;
  createKnowledgeNode?: boolean;
  templateId?: string;
  templateVariables?: Record<string, any>;
}

export interface DocumentSearchOptions {
  includeContent?: boolean;
  includeDeleted?: boolean;
  sortBy?: 'relevance' | 'created' | 'modified' | 'title';
  sortOrder?: 'asc' | 'desc';
}

export interface DocumentCollaborationSession {
  id: string;
  documentId: string;
  participants: string[];
  startTime: Date;
  endTime?: Date;
  changes: DocumentChange[];
}

export interface DocumentChange {
  id: string;
  type: 'content' | 'title' | 'tags' | 'metadata';
  oldValue: any;
  newValue: any;
  userId: string;
  timestamp: Date;
  description?: string;
}

/**
 * Document Service
 *
 * Comprehensive document management with advanced features
 * including version control, collaboration, and analytics
 */
export class DocumentService implements MnemosyneService {
  public readonly name = 'DocumentService';
  public readonly version = '1.0.0';
  public status: ServiceStatus = ServiceStatus.UNINITIALIZED;

  private readonly logger: Logger;
  private readonly config: MnemosyneConfiguration;
  private readonly dataService: DataService;
  private readonly eventBus: EventBus;

  // Performance tracking
  private metrics: ServiceMetrics = {
    name: this.name,
    status: this.status,
    uptime: 0,
    requestCount: 0,
    errorCount: 0,
    avgResponseTime: 0,
    customMetrics: {}
  };

  // Document caching
  private documentCache: Map<string, Document> = new Map();
  private cacheTimeout = 300000; // 5 minutes
  private maxCacheSize = 500;

  // Active collaboration sessions
  private collaborationSessions: Map<string, DocumentCollaborationSession> = new Map();

  // Change tracking
  private changeHistory: Map<string, DocumentChange[]> = new Map();
  private maxHistorySize = 1000;

  constructor(options: ServiceConstructorOptions) {
    this.logger = options.logger.child({ service: 'DocumentService' });
    this.config = options.config;
    this.dataService = options.dataService || options.context.dataService;
    this.eventBus = options.eventBus || options.context.eventBus;
  }

  /**
   * Initialize the service
   */
  public async initialize(): Promise<void> {
    try {
      this.status = ServiceStatus.INITIALIZING;
      this.logger.info('Initializing Document Service...');

      await this.setupEventHandlers();
      await this.initializeSearchIndexes();
      await this.loadActiveCollaborationSessions();

      this.status = ServiceStatus.INITIALIZED;
      this.logger.info('Document Service initialized successfully');
    } catch (error) {
      this.status = ServiceStatus.ERROR;
      this.logger.error('Failed to initialize Document Service', { error });
      throw error;
    }
  }

  /**
   * Activate the service
   */
  public async activate(): Promise<void> {
    if (this.status !== ServiceStatus.INITIALIZED) {
      throw new Error('Service must be initialized before activation');
    }

    try {
      this.status = ServiceStatus.ACTIVATING;
      this.logger.info('Activating Document Service...');

      await this.startBackgroundTasks();
      await this.warmupCaches();

      this.status = ServiceStatus.ACTIVE;
      this.logger.info('Document Service activated successfully');
    } catch (error) {
      this.status = ServiceStatus.ERROR;
      this.logger.error('Failed to activate Document Service', { error });
      throw error;
    }
  }

  /**
   * Shutdown the service
   */
  public async shutdown(): Promise<void> {
    try {
      this.status = ServiceStatus.DEACTIVATING;
      this.logger.info('Shutting down Document Service...');

      // Save active collaboration sessions
      await this.saveCollaborationSessions();

      // Clear caches
      this.documentCache.clear();
      this.collaborationSessions.clear();
      this.changeHistory.clear();

      this.status = ServiceStatus.INACTIVE;
      this.logger.info('Document Service shut down successfully');
    } catch (error) {
      this.status = ServiceStatus.ERROR;
      this.logger.error('Error shutting down Document Service', { error });
      throw error;
    }
  }

  /**
   * Health check
   */
  public async healthCheck(): Promise<boolean> {
    try {
      // Test basic database operations
      await this.dataService.query('SELECT COUNT(*) FROM mnemosyne_active_documents LIMIT 1');
      return this.status === ServiceStatus.ACTIVE;
    } catch (error) {
      this.logger.error('Document Service health check failed', { error });
      return false;
    }
  }

  /**
   * Get service metrics
   */
  public async getMetrics(): Promise<ServiceMetrics> {
    const documentCount = await this.getDocumentCount();
    const activeCollaborationCount = this.collaborationSessions.size;

    this.metrics.customMetrics = {
      ...this.metrics.customMetrics,
      documentCount,
      activeCollaborationCount,
      cacheHitRate: this.calculateCacheHitRate(),
      averageDocumentSize: await this.getAverageDocumentSize()
    };

    return { ...this.metrics };
  }

  // Document CRUD Operations

  /**
   * Create a new document
   */
  public async createDocument(
    documentData: Partial<Document>,
    options: DocumentCreateOptions = {}
  ): Promise<Document> {
    const startTime = Date.now();

    try {
      this.validateDocumentData(documentData);

      const query = `
        INSERT INTO mnemosyne_documents (
          title, content, content_type, status, tags, category, description,
          author, contributors, template_id, template_variables, provenance, 
          collaborators, permissions, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING *;
      `;

      const values = [
        documentData.title || 'Untitled Document',
        documentData.content || '',
        documentData.contentType || 'markdown',
        documentData.status || DocumentStatus.DRAFT,
        documentData.tags || [],
        documentData.category || null,
        documentData.description || null,
        documentData.author || 'unknown',
        documentData.contributors || [],
        options.templateId || null,
        JSON.stringify(options.templateVariables || {}),
        JSON.stringify(documentData.provenance || {}),
        documentData.collaborators || [],
        JSON.stringify(documentData.permissions || {}),
        JSON.stringify(documentData.metadata || {})
      ];

      const result = await this.dataService.query(query, values);
      const document = this.mapDbRowToDocument(result[0]);

      // Create initial version
      await this.createDocumentVersion(
        document.id,
        document.content,
        [],
        document.author,
        'Initial version'
      );

      // Auto-create knowledge node if requested
      if (options.createKnowledgeNode && options.autoIndex !== false) {
        await this.createKnowledgeNodeForDocument(document);
      }

      // Cache the document
      this.documentCache.set(document.id, document);

      // Emit event
      await this.emitDocumentEvent('document-created', document);

      this.updateMetrics(startTime, true);
      this.logger.debug(`Created document: ${document.id}`);

      return document;
    } catch (error) {
      this.updateMetrics(startTime, false);
      this.logger.error('Failed to create document', { error, documentData });
      throw error;
    }
  }

  /**
   * Get document by ID
   */
  public async getDocument(documentId: string, includeVersions = false): Promise<Document | null> {
    const startTime = Date.now();

    try {
      // Check cache first
      const cached = this.documentCache.get(documentId);
      if (cached && !includeVersions) {
        this.updateMetrics(startTime, true);
        return cached;
      }

      const query = `
        SELECT * FROM mnemosyne_active_documents 
        WHERE id = $1;
      `;

      const result = await this.dataService.query(query, [documentId]);

      if (result.length === 0) {
        this.updateMetrics(startTime, true);
        return null;
      }

      const document = this.mapDbRowToDocument(result[0]);

      // Load version history if requested
      if (includeVersions) {
        document.versionHistory = await this.getDocumentVersions(documentId);
      }

      // Update analytics
      await this.recordDocumentView(documentId, 'api');

      // Cache the document
      this.documentCache.set(documentId, document);

      this.updateMetrics(startTime, true);
      return document;
    } catch (error) {
      this.updateMetrics(startTime, false);
      this.logger.error('Failed to get document', { error, documentId });
      throw error;
    }
  }

  /**
   * Update existing document
   */
  public async updateDocument(
    documentId: string,
    updates: Partial<Document>,
    userId = 'system',
    comment?: string
  ): Promise<Document> {
    const startTime = Date.now();

    try {
      // Get current document for change tracking
      const currentDocument = await this.getDocument(documentId);
      if (!currentDocument) {
        throw new Error(`Document ${documentId} not found`);
      }

      const changes = this.detectChanges(currentDocument, updates);
      const setClause = [];
      const values = [];
      let paramIndex = 1;

      // Build update query dynamically
      if (updates.title !== undefined) {
        setClause.push(`title = $${paramIndex++}`);
        values.push(updates.title);
      }
      if (updates.content !== undefined) {
        setClause.push(`content = $${paramIndex++}`);
        values.push(updates.content);
      }
      if (updates.status !== undefined) {
        setClause.push(`status = $${paramIndex++}`);
        values.push(updates.status);
      }
      if (updates.tags !== undefined) {
        setClause.push(`tags = $${paramIndex++}`);
        values.push(updates.tags);
      }
      if (updates.category !== undefined) {
        setClause.push(`category = $${paramIndex++}`);
        values.push(updates.category);
      }
      if (updates.description !== undefined) {
        setClause.push(`description = $${paramIndex++}`);
        values.push(updates.description);
      }
      if (updates.metadata !== undefined) {
        setClause.push(`metadata = $${paramIndex++}`);
        values.push(JSON.stringify(updates.metadata));
      }

      // Always update edit count and modified timestamp
      setClause.push(`edit_count = edit_count + 1`);
      setClause.push(`modified = NOW()`);

      values.push(documentId);

      const query = `
        UPDATE mnemosyne_documents 
        SET ${setClause.join(', ')}
        WHERE id = $${paramIndex} AND deleted_at IS NULL
        RETURNING *;
      `;

      const result = await this.dataService.query(query, values);

      if (result.length === 0) {
        throw new Error(`Document ${documentId} not found or deleted`);
      }

      const document = this.mapDbRowToDocument(result[0]);

      // Create new version if content changed
      if (updates.content !== undefined && updates.content !== currentDocument.content) {
        await this.createDocumentVersion(
          documentId,
          updates.content,
          changes.map((c) => c.description || `${c.type} changed`),
          userId,
          comment
        );
        document.version = currentDocument.version + 1;
      }

      // Track changes
      await this.recordChanges(documentId, changes, userId);

      // Update cache
      this.documentCache.set(documentId, document);

      // Emit event
      await this.emitDocumentEvent('document-updated', document, { changes, userId });

      this.updateMetrics(startTime, true);
      this.logger.debug(`Updated document: ${documentId}`);

      return document;
    } catch (error) {
      this.updateMetrics(startTime, false);
      this.logger.error('Failed to update document', { error, documentId, updates });
      throw error;
    }
  }

  /**
   * Delete document (soft delete)
   */
  public async deleteDocument(documentId: string, userId = 'system'): Promise<boolean> {
    const startTime = Date.now();

    try {
      const query = `
        UPDATE mnemosyne_documents 
        SET deleted_at = NOW(), status = 'deleted'
        WHERE id = $1 AND deleted_at IS NULL
        RETURNING id;
      `;

      const result = await this.dataService.query(query, [documentId]);

      if (result.length === 0) {
        this.updateMetrics(startTime, true);
        return false;
      }

      // Remove from cache
      this.documentCache.delete(documentId);

      // End any active collaboration sessions
      const activeSessions = Array.from(this.collaborationSessions.values()).filter(
        (session) => session.documentId === documentId && !session.endTime
      );

      for (const session of activeSessions) {
        await this.endCollaborationSession(session.id);
      }

      // Emit event
      await this.emitDocumentEvent('document-deleted', { id: documentId } as Document, { userId });

      this.updateMetrics(startTime, true);
      this.logger.debug(`Deleted document: ${documentId}`);

      return true;
    } catch (error) {
      this.updateMetrics(startTime, false);
      this.logger.error('Failed to delete document', { error, documentId });
      throw error;
    }
  }

  // Search Operations

  /**
   * Search documents with full-text search
   */
  public async searchDocuments(
    query: SearchQuery,
    options: DocumentSearchOptions = {}
  ): Promise<SearchResult> {
    const startTime = Date.now();

    try {
      let sqlQuery = '';
      let params: any[] = [];

      switch (query.type) {
        case 'full-text':
          sqlQuery = this.buildFullTextSearchQuery(query, options);
          params = [query.query];
          break;
        case 'semantic':
          // Placeholder for semantic search implementation
          sqlQuery = this.buildSemanticSearchQuery(query, options);
          params = [query.query];
          break;
        default:
          throw new Error(`Unsupported search type: ${query.type}`);
      }

      const results = await this.dataService.query(sqlQuery, params);
      const documents = results.map((row) => this.mapDbRowToDocument(row));

      // Record search query for analytics
      await this.recordSearchQuery(query, documents.length);

      const searchResult: SearchResult = {
        documents: documents.map((doc) => ({
          document: doc,
          score: 1.0, // Would be calculated based on search relevance
          highlights: {} // Would be populated with highlighting
        })),
        facets: [], // Could be populated with faceted search results
        metadata: {
          total: documents.length,
          maxScore: 1.0,
          executionTime: Date.now() - startTime,
          searchType: query.type
        }
      };

      this.updateMetrics(startTime, true);
      return searchResult;
    } catch (error) {
      this.updateMetrics(startTime, false);
      this.logger.error('Failed to search documents', { error, query });
      throw error;
    }
  }

  /**
   * Get documents by criteria
   */
  public async getDocuments(
    filters: Record<string, any> = {},
    limit = 50,
    offset = 0
  ): Promise<{ documents: Document[]; total: number }> {
    const startTime = Date.now();

    try {
      const whereConditions = this.buildWhereConditions(filters);
      const baseQuery = `
        FROM mnemosyne_active_documents 
        ${whereConditions ? 'WHERE ' + whereConditions : ''}
      `;

      // Get total count
      const countResult = await this.dataService.query(`SELECT COUNT(*) as total ${baseQuery}`);
      const total = parseInt(countResult[0].total);

      // Get documents
      const documentsQuery = `
        SELECT * ${baseQuery}
        ORDER BY modified DESC
        LIMIT $1 OFFSET $2;
      `;

      const results = await this.dataService.query(documentsQuery, [limit, offset]);
      const documents = results.map((row) => this.mapDbRowToDocument(row));

      this.updateMetrics(startTime, true);
      return { documents, total };
    } catch (error) {
      this.updateMetrics(startTime, false);
      this.logger.error('Failed to get documents', { error, filters });
      throw error;
    }
  }

  // Version Control

  /**
   * Get document version history
   */
  public async getDocumentVersions(documentId: string): Promise<DocumentVersion[]> {
    const query = `
      SELECT * FROM mnemosyne_document_versions 
      WHERE document_id = $1 
      ORDER BY version DESC;
    `;

    const results = await this.dataService.query(query, [documentId]);
    return results.map((row) => this.mapDbRowToDocumentVersion(row));
  }

  /**
   * Restore document to specific version
   */
  public async restoreDocumentVersion(
    documentId: string,
    version: number,
    userId = 'system'
  ): Promise<Document> {
    const startTime = Date.now();

    try {
      // Get the specific version
      const versionQuery = `
        SELECT * FROM mnemosyne_document_versions 
        WHERE document_id = $1 AND version = $2;
      `;

      const versionResult = await this.dataService.query(versionQuery, [documentId, version]);

      if (versionResult.length === 0) {
        throw new Error(`Version ${version} not found for document ${documentId}`);
      }

      const versionData = versionResult[0];

      // Update document with version content
      const document = await this.updateDocument(
        documentId,
        { content: versionData.content },
        userId,
        `Restored to version ${version}`
      );

      this.updateMetrics(startTime, true);
      this.logger.debug(`Restored document ${documentId} to version ${version}`);

      return document;
    } catch (error) {
      this.updateMetrics(startTime, false);
      this.logger.error('Failed to restore document version', { error, documentId, version });
      throw error;
    }
  }

  // Collaboration

  /**
   * Start collaboration session
   */
  public async startCollaborationSession(
    documentId: string,
    userId: string
  ): Promise<DocumentCollaborationSession> {
    const sessionId = this.generateSessionId();

    const session: DocumentCollaborationSession = {
      id: sessionId,
      documentId,
      participants: [userId],
      startTime: new Date(),
      changes: []
    };

    this.collaborationSessions.set(sessionId, session);

    this.logger.debug(`Started collaboration session: ${sessionId} for document: ${documentId}`);
    return session;
  }

  /**
   * Join collaboration session
   */
  public async joinCollaborationSession(
    sessionId: string,
    userId: string
  ): Promise<DocumentCollaborationSession> {
    const session = this.collaborationSessions.get(sessionId);

    if (!session) {
      throw new Error(`Collaboration session ${sessionId} not found`);
    }

    if (!session.participants.includes(userId)) {
      session.participants.push(userId);
    }

    this.logger.debug(`User ${userId} joined collaboration session: ${sessionId}`);
    return session;
  }

  /**
   * End collaboration session
   */
  public async endCollaborationSession(sessionId: string): Promise<void> {
    const session = this.collaborationSessions.get(sessionId);

    if (session) {
      session.endTime = new Date();

      // Persist session data
      await this.saveCollaborationSession(session);

      // Remove from active sessions
      this.collaborationSessions.delete(sessionId);

      this.logger.debug(`Ended collaboration session: ${sessionId}`);
    }
  }

  // Analytics

  /**
   * Record document view
   */
  public async recordDocumentView(
    documentId: string,
    source = 'web',
    userId?: string,
    duration?: number
  ): Promise<void> {
    try {
      const query = `
        INSERT INTO mnemosyne_view_events (document_id, user_id, source, duration, metadata)
        VALUES ($1, $2, $3, $4, $5);
      `;

      await this.dataService.query(query, [
        documentId,
        userId || null,
        source,
        duration || null,
        JSON.stringify({})
      ]);

      // Update document view count
      await this.dataService.query(
        `
        UPDATE mnemosyne_documents 
        SET view_count = view_count + 1, last_accessed = NOW()
        WHERE id = $1;
      `,
        [documentId]
      );
    } catch (error) {
      this.logger.error('Failed to record document view', { error, documentId });
    }
  }

  /**
   * Get document analytics
   */
  public async getDocumentAnalytics(documentId: string): Promise<any> {
    const query = `
      SELECT 
        d.view_count,
        d.edit_count,
        d.share_count,
        d.export_count,
        COUNT(DISTINCT ve.user_id) as unique_viewers,
        AVG(ve.duration) as avg_view_duration,
        MAX(ve.timestamp) as last_viewed
      FROM mnemosyne_active_documents d
      LEFT JOIN mnemosyne_view_events ve ON d.id = ve.document_id
      WHERE d.id = $1
      GROUP BY d.id, d.view_count, d.edit_count, d.share_count, d.export_count;
    `;

    const result = await this.dataService.query(query, [documentId]);
    return result[0] || {};
  }

  // Private helper methods

  private async setupEventHandlers(): Promise<void> {
    // Set up event handlers for document-related events
    this.eventBus.on('mnemosyne:template:used', async (event) => {
      // Track template usage in documents
      this.logger.debug('Template used in document', { event });
    });
  }

  private async initializeSearchIndexes(): Promise<void> {
    // Initialize full-text search indexes if needed
    this.logger.debug('Search indexes initialized');
  }

  private async loadActiveCollaborationSessions(): Promise<void> {
    // Load any persisted collaboration sessions
    this.logger.debug('Active collaboration sessions loaded');
  }

  private async startBackgroundTasks(): Promise<void> {
    // Start background tasks like cache cleanup, analytics aggregation
    setInterval(() => {
      this.cleanupExpiredCacheEntries();
    }, 300000); // Every 5 minutes
  }

  private async warmupCaches(): Promise<void> {
    // Preload frequently accessed documents
    const query = `
      SELECT * FROM mnemosyne_active_documents 
      ORDER BY view_count DESC 
      LIMIT 100;
    `;

    const results = await this.dataService.query(query);

    for (const row of results) {
      const document = this.mapDbRowToDocument(row);
      this.documentCache.set(document.id, document);
    }

    this.logger.debug(`Warmed up cache with ${results.length} documents`);
  }

  private async saveCollaborationSessions(): Promise<void> {
    // Save active collaboration sessions
    for (const session of this.collaborationSessions.values()) {
      await this.saveCollaborationSession(session);
    }
  }

  private async saveCollaborationSession(session: DocumentCollaborationSession): Promise<void> {
    // Persist collaboration session data
    try {
      const query = `
        INSERT INTO mnemosyne_plugin_state (plugin_id, key, value)
        VALUES ('mnemosyne', $1, $2)
        ON CONFLICT (plugin_id, key) 
        DO UPDATE SET value = $2, updated = NOW();
      `;

      await this.dataService.query(query, [
        `collaboration_session_${session.id}`,
        JSON.stringify(session)
      ]);
    } catch (error) {
      this.logger.error('Failed to save collaboration session', { error, sessionId: session.id });
    }
  }

  private validateDocumentData(documentData: Partial<Document>): void {
    if (!documentData.title || documentData.title.trim().length === 0) {
      throw new Error('Document title is required');
    }

    if (documentData.title.length > 500) {
      throw new Error('Document title cannot exceed 500 characters');
    }
  }

  private mapDbRowToDocument(row: any): Document {
    return {
      id: row.id,
      title: row.title,
      content: row.content || '',
      contentType: row.content_type,
      status: row.status,
      tags: row.tags || [],
      category: row.category,
      description: row.description,
      created: row.created,
      modified: row.modified,
      lastAccessed: row.last_accessed,
      author: row.author,
      contributors: row.contributors || [],
      version: row.version,
      parentVersion: row.parent_version,
      templateId: row.template_id,
      templateVariables: row.template_variables ? JSON.parse(row.template_variables) : {},
      provenance: row.provenance ? JSON.parse(row.provenance) : undefined,
      collaborators: row.collaborators || [],
      permissions: row.permissions ? JSON.parse(row.permissions) : undefined,
      analytics: {
        views: row.view_count || 0,
        uniqueViews: 0, // Would be calculated
        lastViewed: row.last_accessed,
        viewHistory: [], // Would be loaded separately
        editCount: row.edit_count || 0,
        shareCount: row.share_count || 0,
        exportCount: row.export_count || 0
      },
      metadata: row.metadata ? JSON.parse(row.metadata) : {},
      relationships: [], // Would be loaded from knowledge graph service
      backlinks: [] // Would be calculated
    };
  }

  private mapDbRowToDocumentVersion(row: any): DocumentVersion {
    return {
      version: row.version,
      content: row.content,
      changes: row.changes || [],
      author: row.author,
      timestamp: row.timestamp,
      comment: row.comment
    };
  }

  private async createDocumentVersion(
    documentId: string,
    content: string,
    changes: string[],
    author: string,
    comment?: string
  ): Promise<void> {
    const query = `
      INSERT INTO mnemosyne_document_versions (
        document_id, version, content, changes, author, comment
      ) 
      SELECT $1, COALESCE(MAX(version), 0) + 1, $2, $3, $4, $5
      FROM mnemosyne_document_versions 
      WHERE document_id = $1;
    `;

    await this.dataService.query(query, [documentId, content, changes, author, comment || null]);
  }

  private async createKnowledgeNodeForDocument(document: Document): Promise<void> {
    // This would integrate with the Knowledge Graph Service
    this.eventBus.emit('mnemosyne:document:index-requested', {
      documentId: document.id,
      title: document.title,
      content: document.content,
      tags: document.tags
    });
  }

  private detectChanges(current: Document, updates: Partial<Document>): DocumentChange[] {
    const changes: DocumentChange[] = [];

    if (updates.title !== undefined && updates.title !== current.title) {
      changes.push({
        id: this.generateChangeId(),
        type: 'title',
        oldValue: current.title,
        newValue: updates.title,
        userId: 'system',
        timestamp: new Date(),
        description: 'Title changed'
      });
    }

    if (updates.content !== undefined && updates.content !== current.content) {
      changes.push({
        id: this.generateChangeId(),
        type: 'content',
        oldValue: current.content,
        newValue: updates.content,
        userId: 'system',
        timestamp: new Date(),
        description: 'Content modified'
      });
    }

    if (
      updates.tags !== undefined &&
      JSON.stringify(updates.tags) !== JSON.stringify(current.tags)
    ) {
      changes.push({
        id: this.generateChangeId(),
        type: 'tags',
        oldValue: current.tags,
        newValue: updates.tags,
        userId: 'system',
        timestamp: new Date(),
        description: 'Tags updated'
      });
    }

    return changes;
  }

  private async recordChanges(
    documentId: string,
    changes: DocumentChange[],
    userId: string
  ): Promise<void> {
    if (changes.length === 0) return;

    const existingChanges = this.changeHistory.get(documentId) || [];
    const updatedChanges = [...existingChanges, ...changes];

    // Limit history size
    if (updatedChanges.length > this.maxHistorySize) {
      updatedChanges.splice(0, updatedChanges.length - this.maxHistorySize);
    }

    this.changeHistory.set(documentId, updatedChanges);
  }

  private buildFullTextSearchQuery(query: SearchQuery, options: DocumentSearchOptions): string {
    const selectClause = options.includeContent
      ? '*'
      : 'id, title, description, tags, created, modified, author';
    const deletedClause = options.includeDeleted ? '' : 'AND deleted_at IS NULL';

    return `
      SELECT ${selectClause}
      FROM mnemosyne_documents 
      WHERE search_vector @@ plainto_tsquery('english', $1)
        ${deletedClause}
      ORDER BY ts_rank(search_vector, plainto_tsquery('english', $1)) DESC
      LIMIT ${query.limit || 50}
      OFFSET ${query.offset || 0};
    `;
  }

  private buildSemanticSearchQuery(query: SearchQuery, options: DocumentSearchOptions): string {
    // Placeholder for semantic search - would integrate with vector similarity
    return this.buildFullTextSearchQuery(query, options);
  }

  private buildWhereConditions(filters: Record<string, any>): string {
    const conditions: string[] = ['deleted_at IS NULL'];

    if (filters.status) {
      conditions.push(`status = '${filters.status}'`);
    }
    if (filters.author) {
      conditions.push(`author = '${filters.author}'`);
    }
    if (filters.category) {
      conditions.push(`category = '${filters.category}'`);
    }
    if (filters.tags && Array.isArray(filters.tags)) {
      conditions.push(`tags && ARRAY[${filters.tags.map((tag) => `'${tag}'`).join(',')}]`);
    }

    return conditions.length > 1 ? conditions.join(' AND ') : conditions[0];
  }

  private async recordSearchQuery(query: SearchQuery, resultsCount: number): Promise<void> {
    try {
      const sqlQuery = `
        INSERT INTO mnemosyne_search_queries (query, type, filters, results_count, duration)
        VALUES ($1, $2, $3, $4, $5);
      `;

      await this.dataService.query(sqlQuery, [
        query.query,
        query.type,
        JSON.stringify(query.filters || {}),
        resultsCount,
        0 // Duration would be calculated
      ]);
    } catch (error) {
      this.logger.error('Failed to record search query', { error, query });
    }
  }

  private async emitDocumentEvent(
    eventType: string,
    document: Document,
    metadata?: any
  ): Promise<void> {
    this.eventBus.emit(`mnemosyne:${eventType}`, {
      documentId: document.id,
      title: document.title,
      author: document.author,
      timestamp: new Date(),
      metadata
    });
  }

  private updateMetrics(startTime: number, success: boolean): void {
    const responseTime = Date.now() - startTime;

    this.metrics.requestCount++;
    if (!success) {
      this.metrics.errorCount++;
    }

    this.metrics.avgResponseTime =
      (this.metrics.avgResponseTime * (this.metrics.requestCount - 1) + responseTime) /
      this.metrics.requestCount;
  }

  private calculateCacheHitRate(): number {
    const totalRequests = this.metrics.requestCount;
    const cacheHits = this.metrics.customMetrics?.cacheHits || 0;
    return totalRequests > 0 ? cacheHits / totalRequests : 0;
  }

  private async getDocumentCount(): Promise<number> {
    const result = await this.dataService.query(
      'SELECT COUNT(*) as count FROM mnemosyne_active_documents'
    );
    return parseInt(result[0].count);
  }

  private async getAverageDocumentSize(): Promise<number> {
    const result = await this.dataService.query(`
      SELECT AVG(LENGTH(content)) as avg_size 
      FROM mnemosyne_active_documents 
      WHERE content IS NOT NULL
    `);
    return parseFloat(result[0].avg_size) || 0;
  }

  private cleanupExpiredCacheEntries(): void {
    // Simple cache cleanup - could be more sophisticated
    if (this.documentCache.size > this.maxCacheSize) {
      const entriesToRemove = this.documentCache.size - this.maxCacheSize;
      const keys = Array.from(this.documentCache.keys()).slice(0, entriesToRemove);

      for (const key of keys) {
        this.documentCache.delete(key);
      }
    }
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateChangeId(): string {
    return `change_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
