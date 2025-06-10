import { 
  MnemosyneCore,
  Document as MnemosyneDocument,
  KnowledgeRelationship
} from '../../../../core/MnemosyneCore';
import { ImportSource, ImportOptions } from '../../core/ImportEngine';

export interface ImportAnalysis {
  documentCount: number;
  linkCount: number;
  attachmentCount: number;
  tagCount: number;
  structure: StructureAnalysis;
  preview: PreviewData;
  warnings: ImportWarning[];
  estimatedDuration: number;
}

export interface StructureAnalysis {
  folders?: FolderStructure[];
  tags?: string[];
  linkGraph?: LinkGraph;
  metadata?: any;
}

export interface PreviewData {
  sampleDocuments: DocumentPreview[];
  transformations: TransformationPreview[];
}

export interface DocumentPreview {
  original: string;
  converted: string;
  changes: string[];
}

export interface ImportWarning {
  type: 'broken-link' | 'missing-attachment' | 'format-issue' | 'encoding';
  message: string;
  affected: string[];
  severity: 'low' | 'medium' | 'high';
}

export interface ParsedContent {
  documents: RawDocument[];
  relationships: RawRelationship[];
  attachments: RawAttachment[];
  metadata: any;
}

export interface RawDocument {
  id: string;
  path: string;
  title: string;
  content: string;
  frontmatter?: any;
  tags?: string[];
  created?: Date;
  modified?: Date;
  metadata?: any;
}

export interface RawRelationship {
  source: string;
  target: string;
  type: string;
  metadata?: any;
}

export interface RawAttachment {
  id: string;
  path: string;
  name: string;
  type: string;
  size: number;
  data?: Buffer;
}

/**
 * Base adapter interface for all import sources
 */
export abstract class ImportAdapter {
  protected mnemosyne: MnemosyneCore;
  
  constructor(mnemosyne: MnemosyneCore) {
    this.mnemosyne = mnemosyne;
  }
  
  /**
   * Detect if this adapter can handle the source
   */
  abstract async detect(source: ImportSource): Promise<boolean>;
  
  /**
   * Analyze the source without importing
   */
  abstract async analyze(source: ImportSource): Promise<ImportAnalysis>;
  
  /**
   * Parse the source into raw content
   */
  abstract async parse(source: ImportSource): Promise<ParsedContent>;
  
  /**
   * Transform parsed content to Mnemosyne documents
   */
  abstract async transform(
    content: ParsedContent,
    options: ImportOptions
  ): Promise<MnemosyneDocument[]>;
  
  /**
   * Map relationships for knowledge graph
   */
  abstract async mapRelationships(
    documents: MnemosyneDocument[]
  ): Promise<KnowledgeRelationship[]>;
  
  /**
   * Validate import results
   */
  async validate(documents: MnemosyneDocument[]): Promise<ValidationReport> {
    const report: ValidationReport = {
      valid: true,
      errors: [],
      warnings: [],
      stats: {
        total: documents.length,
        valid: 0,
        invalid: 0
      }
    };
    
    for (const doc of documents) {
      const validation = await this.validateDocument(doc);
      if (validation.valid) {
        report.stats.valid++;
      } else {
        report.stats.invalid++;
        report.errors.push(...validation.errors);
      }
      report.warnings.push(...validation.warnings);
    }
    
    report.valid = report.errors.length === 0;
    return report;
  }
  
  /**
   * Validate individual document
   */
  protected async validateDocument(doc: MnemosyneDocument): Promise<DocumentValidation> {
    const validation: DocumentValidation = {
      valid: true,
      errors: [],
      warnings: []
    };
    
    // Check required fields
    if (!doc.title) {
      validation.errors.push('Document missing title');
      validation.valid = false;
    }
    
    if (!doc.content) {
      validation.errors.push('Document missing content');
      validation.valid = false;
    }
    
    // Check for potential issues
    if (doc.content.length < 10) {
      validation.warnings.push('Document content very short');
    }
    
    // Check links
    const brokenLinks = await this.checkBrokenLinks(doc);
    if (brokenLinks.length > 0) {
      validation.warnings.push(`${brokenLinks.length} broken links found`);
    }
    
    return validation;
  }
  
  /**
   * Check for broken internal links
   */
  protected async checkBrokenLinks(doc: MnemosyneDocument): Promise<string[]> {
    const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
    const brokenLinks: string[] = [];
    let match;
    
    while ((match = linkPattern.exec(doc.content)) !== null) {
      const linkTarget = match[2];
      if (linkTarget.startsWith('mnemosyne://')) {
        // Check if target exists
        const targetId = linkTarget.replace('mnemosyne://', '');
        const exists = await this.mnemosyne.documentExists(targetId);
        if (!exists) {
          brokenLinks.push(linkTarget);
        }
      }
    }
    
    return brokenLinks;
  }
  
  /**
   * Generate unique ID for imported document
   */
  protected generateDocumentId(source: string, original: string): string {
    return `${source}-${this.sanitizeId(original)}-${Date.now()}`;
  }
  
  /**
   * Sanitize string for use as ID
   */
  protected sanitizeId(str: string): string {
    return str
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 50);
  }
  
  /**
   * Convert source-specific date to Date object
   */
  protected parseDate(dateStr: any): Date {
    if (dateStr instanceof Date) return dateStr;
    if (typeof dateStr === 'number') return new Date(dateStr);
    if (typeof dateStr === 'string') return new Date(dateStr);
    return new Date();
  }
}

export interface ValidationReport {
  valid: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    total: number;
    valid: number;
    invalid: number;
  };
}

export interface DocumentValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface FolderStructure {
  path: string;
  name: string;
  children: FolderStructure[];
  documentCount: number;
}

export interface LinkGraph {
  nodes: string[];
  edges: Array<{
    source: string;
    target: string;
    count: number;
  }>;
}

export interface TransformationPreview {
  type: string;
  description: string;
  example?: {
    before: string;
    after: string;
  };
}