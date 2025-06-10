import { PluginContext } from '../../../../../../core/plugin-registry/interfaces';
import {
  ProvenanceNode,
  ProvenanceSource,
  ProvenanceOriginal,
  ProvenanceTransformation,
  ProvenanceSyncStatus,
  ImportSource,
  ImportOptions,
  SyncDirection
} from '../interfaces';
import { MnemosyneDocument } from '../../../interfaces';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';

export class ProvenanceTracker {
  constructor(private context: PluginContext) {}

  /**
   * Track document provenance
   */
  async track(node: ProvenanceNode): Promise<ProvenanceNode> {
    // Save to database
    const query = `
      INSERT INTO mnemosyne_provenance (
        id, type, document_id, source, original, 
        transformations, sync_status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const values = [
      node.id,
      node.type,
      node.documentId,
      JSON.stringify(node.source),
      JSON.stringify(node.original),
      JSON.stringify(node.transformations),
      node.syncStatus ? JSON.stringify(node.syncStatus) : null,
      node.createdAt,
      node.updatedAt
    ];

    const result = await this.context.db.query(query, values);
    
    // Create knowledge graph relationships
    await this.createGraphRelationships(node);
    
    // Emit provenance event
    this.context.events.emit('mnemosyne:provenance:tracked', node);
    
    return this.mapToProvenanceNode(result.rows[0]);
  }

  /**
   * Create provenance node for import
   */
  async createImportProvenance(
    document: MnemosyneDocument,
    source: ImportSource,
    options: ImportOptions,
    originalContent: string
  ): Promise<ProvenanceNode> {
    const node: ProvenanceNode = {
      id: uuidv4(),
      type: 'provenance',
      documentId: document.id,
      source: {
        system: source.type,
        version: source.version || 'unknown',
        importDate: new Date(),
        importer: this.context.user.id,
        importOptions: options
      },
      original: {
        format: source.format || source.type,
        location: source.path,
        size: Buffer.byteLength(originalContent, 'utf8'),
        metadata: source.metadata || {},
        checksum: this.calculateChecksum(originalContent)
      },
      transformations: await this.detectTransformations(originalContent, document),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    return this.track(node);
  }

  /**
   * Update sync status
   */
  async updateSyncStatus(
    documentId: string,
    syncStatus: ProvenanceSyncStatus
  ): Promise<void> {
    const query = `
      UPDATE mnemosyne_provenance
      SET sync_status = $2, updated_at = CURRENT_TIMESTAMP
      WHERE document_id = $1
    `;

    await this.context.db.query(query, [
      documentId,
      JSON.stringify(syncStatus)
    ]);

    this.context.events.emit('mnemosyne:provenance:sync-updated', {
      documentId,
      syncStatus
    });
  }

  /**
   * Get provenance for document
   */
  async getByDocumentId(documentId: string): Promise<ProvenanceNode | null> {
    const query = `
      SELECT * FROM mnemosyne_provenance
      WHERE document_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const result = await this.context.db.query(query, [documentId]);
    return result.rows[0] ? this.mapToProvenanceNode(result.rows[0]) : null;
  }

  /**
   * Get all provenance nodes for a source
   */
  async getBySource(system: string, location?: string): Promise<ProvenanceNode[]> {
    let query = `
      SELECT * FROM mnemosyne_provenance
      WHERE source->>'system' = $1
    `;
    const params = [system];

    if (location) {
      query += ` AND original->>'location' = $2`;
      params.push(location);
    }

    query += ` ORDER BY created_at DESC`;

    const result = await this.context.db.query(query, params);
    return result.rows.map(row => this.mapToProvenanceNode(row));
  }

  /**
   * Get sync candidates
   */
  async getSyncCandidates(
    system: string,
    direction: SyncDirection
  ): Promise<ProvenanceNode[]> {
    const query = `
      SELECT p.* FROM mnemosyne_provenance p
      JOIN mnemosyne_documents d ON p.document_id = d.id
      WHERE p.source->>'system' = $1
      AND (
        p.sync_status IS NULL 
        OR p.sync_status->>'enabled' = 'true'
      )
      AND (
        p.sync_status->>'direction' = $2
        OR p.sync_status->>'direction' = 'bidirectional'
      )
      ORDER BY d.updated_at DESC
    `;

    const result = await this.context.db.query(query, [system, direction]);
    return result.rows.map(row => this.mapToProvenanceNode(row));
  }

  /**
   * Add transformation record
   */
  async addTransformation(
    documentId: string,
    transformation: ProvenanceTransformation
  ): Promise<void> {
    const provenance = await this.getByDocumentId(documentId);
    if (!provenance) {
      throw new Error('No provenance found for document');
    }

    provenance.transformations.push(transformation);
    provenance.updatedAt = new Date();

    const query = `
      UPDATE mnemosyne_provenance
      SET transformations = $2, updated_at = $3
      WHERE document_id = $1
    `;

    await this.context.db.query(query, [
      documentId,
      JSON.stringify(provenance.transformations),
      provenance.updatedAt
    ]);
  }

  /**
   * Check if document has been modified since import
   */
  async hasLocalModifications(documentId: string): Promise<boolean> {
    const provenance = await this.getByDocumentId(documentId);
    if (!provenance) return false;

    const document = await this.getDocument(documentId);
    if (!document) return false;

    // Compare checksums
    const currentChecksum = this.calculateChecksum(document.content);
    return currentChecksum !== provenance.original.checksum;
  }

  /**
   * Get import statistics
   */
  async getImportStatistics(): Promise<ImportStatistics> {
    const query = `
      SELECT 
        source->>'system' as system,
        COUNT(*) as total,
        COUNT(CASE WHEN sync_status->>'enabled' = 'true' THEN 1 END) as synced,
        AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) as avg_age_seconds
      FROM mnemosyne_provenance
      GROUP BY source->>'system'
    `;

    const result = await this.context.db.query(query);
    
    const bySystem = result.rows.reduce((acc, row) => {
      acc[row.system] = {
        total: parseInt(row.total),
        synced: parseInt(row.synced),
        averageAge: Math.round(row.avg_age_seconds)
      };
      return acc;
    }, {} as Record<string, any>);

    const totalQuery = `
      SELECT 
        COUNT(*) as total,
        COUNT(DISTINCT source->>'system') as systems,
        COUNT(DISTINCT original->>'location') as locations
      FROM mnemosyne_provenance
    `;

    const totalResult = await this.context.db.query(totalQuery);
    const totals = totalResult.rows[0];

    return {
      total: parseInt(totals.total),
      systems: parseInt(totals.systems),
      locations: parseInt(totals.locations),
      bySystem
    };
  }

  /**
   * Initialize database schema
   */
  async initializeSchema(): Promise<void> {
    const query = `
      CREATE TABLE IF NOT EXISTS mnemosyne_provenance (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        type VARCHAR(50) DEFAULT 'provenance',
        document_id UUID REFERENCES mnemosyne_documents(id) ON DELETE CASCADE,
        source JSONB NOT NULL,
        original JSONB NOT NULL,
        transformations JSONB DEFAULT '[]',
        sync_status JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(document_id)
      );

      CREATE INDEX IF NOT EXISTS idx_provenance_document ON mnemosyne_provenance(document_id);
      CREATE INDEX IF NOT EXISTS idx_provenance_system ON mnemosyne_provenance((source->>'system'));
      CREATE INDEX IF NOT EXISTS idx_provenance_location ON mnemosyne_provenance((original->>'location'));
      CREATE INDEX IF NOT EXISTS idx_provenance_sync ON mnemosyne_provenance((sync_status->>'enabled'));
    `;

    await this.context.db.query(query);
  }

  // Private methods

  private calculateChecksum(content: string): string {
    return crypto
      .createHash('sha256')
      .update(content, 'utf8')
      .digest('hex');
  }

  private async detectTransformations(
    original: string,
    document: MnemosyneDocument
  ): Promise<ProvenanceTransformation[]> {
    const transformations: ProvenanceTransformation[] = [];

    // Detect wikilink conversions
    const wikilinks = original.match(/\[\[([^\]]+)\]\]/g);
    const mnemosyneLinks = document.content.match(/\[([^\]]+)\]\(mnemosyne:\/\/[^)]+\)/g);
    
    if (wikilinks && mnemosyneLinks) {
      transformations.push({
        type: 'wikilink-conversion',
        description: `Converted ${wikilinks.length} wikilinks to Mnemosyne format`,
        timestamp: new Date(),
        reversible: true
      });
    }

    // Detect metadata extraction
    if (document.metadata && Object.keys(document.metadata).length > 0) {
      transformations.push({
        type: 'metadata-extraction',
        description: 'Extracted metadata from source',
        timestamp: new Date(),
        reversible: false
      });
    }

    // Detect format conversion
    if (document.format !== 'markdown') {
      transformations.push({
        type: 'format-conversion',
        description: `Converted to ${document.format} format`,
        timestamp: new Date(),
        reversible: true
      });
    }

    return transformations;
  }

  private async createGraphRelationships(node: ProvenanceNode): Promise<void> {
    // Create bidirectional relationships in knowledge graph
    const relationships = [
      {
        source: node.documentId,
        target: node.id,
        type: 'has-provenance'
      },
      {
        source: node.id,
        target: node.documentId,
        type: 'tracks-document'
      }
    ];

    for (const rel of relationships) {
      await this.context.storage.set(`graph_edge_${rel.source}_${rel.target}`, rel);
    }
  }

  private async getDocument(documentId: string): Promise<MnemosyneDocument | null> {
    const query = `SELECT * FROM mnemosyne_documents WHERE id = $1`;
    const result = await this.context.db.query(query, [documentId]);
    return result.rows[0] || null;
  }

  private mapToProvenanceNode(row: any): ProvenanceNode {
    return {
      id: row.id,
      type: row.type,
      documentId: row.document_id,
      source: JSON.parse(row.source),
      original: JSON.parse(row.original),
      transformations: JSON.parse(row.transformations),
      syncStatus: row.sync_status ? JSON.parse(row.sync_status) : undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

interface ImportStatistics {
  total: number;
  systems: number;
  locations: number;
  bySystem: Record<string, {
    total: number;
    synced: number;
    averageAge: number;
  }>;
}