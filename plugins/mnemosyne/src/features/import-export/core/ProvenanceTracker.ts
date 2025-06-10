import { 
  MnemosyneCore, 
  KnowledgeNode,
  Document as MnemosyneDocument 
} from '../../../core/MnemosyneCore';
import { ImportSource } from './ImportEngine';
import * as crypto from 'crypto';

export interface ProvenanceNode extends KnowledgeNode {
  type: 'provenance';
  source: {
    system: string;
    version: string;
    importDate: Date;
    importer: string;
  };
  original: {
    format: string;
    location: string;
    metadata: any;
    checksum: string;
    size?: number;
  };
  transformations: Transformation[];
  syncStatus?: {
    enabled: boolean;
    lastSync: Date;
    direction: 'import' | 'export' | 'bidirectional';
    conflicts?: number;
  };
}

export interface Transformation {
  type: string;
  description: string;
  timestamp: Date;
  automated: boolean;
  confidence?: number;
}

export class ProvenanceTracker {
  constructor(private mnemosyne: MnemosyneCore) {}

  /**
   * Track the import of a document
   */
  async track(
    document: MnemosyneDocument,
    source: ImportSource
  ): Promise<ProvenanceNode> {
    const provenance = await this.createProvenanceNode(document, source);
    
    // Add to knowledge graph
    await this.mnemosyne.knowledgeGraph.addNode(provenance);
    
    // Create bidirectional links
    await this.createProvenanceLinks(document.id, provenance.id);
    
    // Store provenance reference in document metadata
    document.metadata = {
      ...document.metadata,
      provenanceId: provenance.id,
      importedAt: provenance.source.importDate
    };
    
    return provenance;
  }

  /**
   * Create provenance node with all tracking data
   */
  private async createProvenanceNode(
    document: MnemosyneDocument,
    source: ImportSource
  ): Promise<ProvenanceNode> {
    const user = this.mnemosyne.getCurrentUser();
    
    return {
      id: this.generateProvenanceId(document.id),
      type: 'provenance',
      title: `Import: ${document.title}`,
      content: this.generateProvenanceReport(document, source),
      source: {
        system: source.type,
        version: await this.getSourceVersion(source),
        importDate: new Date(),
        importer: user.name
      },
      original: {
        format: this.detectFormat(source),
        location: source.path,
        metadata: await this.extractSourceMetadata(source),
        checksum: await this.calculateChecksum(source),
        size: await this.getSourceSize(source)
      },
      transformations: await this.detectTransformations(document, source),
      metadata: {
        documentId: document.id,
        documentTitle: document.title,
        importConfig: source
      }
    };
  }

  /**
   * Create knowledge graph links for provenance
   */
  private async createProvenanceLinks(
    documentId: string,
    provenanceId: string
  ): Promise<void> {
    // Document imported from provenance
    await this.mnemosyne.knowledgeGraph.link(
      documentId,
      provenanceId,
      'imported-from'
    );
    
    // Provenance created document
    await this.mnemosyne.knowledgeGraph.link(
      provenanceId,
      documentId,
      'imported-to'
    );
  }

  /**
   * Get provenance for a document
   */
  async getProvenance(documentId: string): Promise<ProvenanceNode | null> {
    const relationships = await this.mnemosyne.knowledgeGraph.getRelationships(
      documentId,
      { type: 'imported-from' }
    );
    
    if (relationships.length === 0) return null;
    
    const provenanceId = relationships[0].targetId;
    const node = await this.mnemosyne.knowledgeGraph.getNode(
      provenanceId,
      'provenance'
    );
    
    return node as ProvenanceNode;
  }

  /**
   * Get all documents from a specific source
   */
  async getDocumentsBySource(sourceType: string): Promise<MnemosyneDocument[]> {
    const provenanceNodes = await this.mnemosyne.knowledgeGraph.query({
      type: 'provenance',
      where: { 'source.system': sourceType }
    });
    
    const documents: MnemosyneDocument[] = [];
    
    for (const provenance of provenanceNodes) {
      const relationships = await this.mnemosyne.knowledgeGraph.getRelationships(
        provenance.id,
        { type: 'imported-to' }
      );
      
      for (const rel of relationships) {
        const doc = await this.mnemosyne.getDocument(rel.targetId);
        if (doc) documents.push(doc);
      }
    }
    
    return documents;
  }

  /**
   * Update sync status for imported documents
   */
  async updateSyncStatus(
    documentId: string,
    status: Partial<ProvenanceNode['syncStatus']>
  ): Promise<void> {
    const provenance = await this.getProvenance(documentId);
    if (!provenance) return;
    
    provenance.syncStatus = {
      ...provenance.syncStatus,
      ...status,
      lastSync: new Date()
    };
    
    await this.mnemosyne.knowledgeGraph.updateNode(provenance);
  }

  /**
   * Detect what transformations were applied during import
   */
  private async detectTransformations(
    document: MnemosyneDocument,
    source: ImportSource
  ): Promise<Transformation[]> {
    const transformations: Transformation[] = [];
    
    // Detect link conversions
    if (source.type === 'obsidian' && document.content.includes('mnemosyne://')) {
      transformations.push({
        type: 'link-conversion',
        description: 'Converted Obsidian wikilinks to Mnemosyne links',
        timestamp: new Date(),
        automated: true,
        confidence: 0.95
      });
    }
    
    // Detect format conversions
    if (source.type === 'notion') {
      transformations.push({
        type: 'format-conversion',
        description: 'Converted Notion blocks to Markdown',
        timestamp: new Date(),
        automated: true,
        confidence: 0.9
      });
    }
    
    // Detect metadata extraction
    if (document.metadata?.extracted) {
      transformations.push({
        type: 'metadata-extraction',
        description: 'Extracted metadata from source format',
        timestamp: new Date(),
        automated: true,
        confidence: 1.0
      });
    }
    
    return transformations;
  }

  /**
   * Generate human-readable provenance report
   */
  private generateProvenanceReport(
    document: MnemosyneDocument,
    source: ImportSource
  ): string {
    return `# Import Provenance Report

**Document**: ${document.title}
**Source**: ${source.type}
**Location**: ${source.path}
**Import Date**: ${new Date().toISOString()}

## Original Metadata
\`\`\`json
${JSON.stringify(document.metadata?.original || {}, null, 2)}
\`\`\`

## Transformations Applied
- Link format conversion
- Metadata extraction
- Structure preservation

## Sync Configuration
${source.type === 'obsidian' ? '- Two-way sync enabled' : '- One-time import'}
`;
  }

  private generateProvenanceId(documentId: string): string {
    return `provenance-${documentId}-${Date.now()}`;
  }

  private async calculateChecksum(source: ImportSource): Promise<string> {
    // In real implementation, would calculate actual file checksum
    return crypto.createHash('sha256')
      .update(source.path + source.type)
      .digest('hex');
  }

  private async getSourceVersion(source: ImportSource): Promise<string> {
    // Version detection logic per source type
    const versions = {
      'obsidian': '1.4.x',
      'notion': '2.0',
      'roam': '1.0',
      'logseq': '0.9.x',
      'markdown': '1.0'
    };
    return versions[source.type] || 'unknown';
  }

  private detectFormat(source: ImportSource): string {
    const formats = {
      'obsidian': 'Obsidian Markdown',
      'notion': 'Notion Export',
      'roam': 'Roam JSON',
      'logseq': 'Logseq Markdown',
      'markdown': 'Standard Markdown'
    };
    return formats[source.type] || 'Unknown';
  }

  private async extractSourceMetadata(source: ImportSource): Promise<any> {
    // Extract source-specific metadata
    return {
      type: source.type,
      path: source.path,
      importOptions: source
    };
  }

  private async getSourceSize(source: ImportSource): Promise<number> {
    // In real implementation, would get actual file/folder size
    return 0;
  }
}