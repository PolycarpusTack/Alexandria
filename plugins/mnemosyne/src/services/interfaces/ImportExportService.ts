import { ManagedService } from '../../core/ServiceRegistry';
import { KnowledgeNode } from './KnowledgeService';
import { Relationship } from './GraphService';

/**
 * Supported import/export formats
 */
export enum ImportExportFormat {
  JSON = 'json',
  MARKDOWN = 'markdown',
  HTML = 'html',
  PDF = 'pdf',
  OBSIDIAN = 'obsidian',
  NOTION = 'notion',
  ROAM = 'roam',
  LOGSEQ = 'logseq',
  CSV = 'csv',
  XML = 'xml',
  YAML = 'yaml',
  OPML = 'opml'
}

/**
 * Import source types
 */
export enum ImportSourceType {
  FILE = 'file',
  URL = 'url',
  API = 'api',
  DATABASE = 'database',
  CLIPBOARD = 'clipboard',
  DIRECTORY = 'directory'
}

/**
 * Export destination types
 */
export enum ExportDestinationType {
  FILE = 'file',
  URL = 'url',
  EMAIL = 'email',
  CLOUD_STORAGE = 'cloud_storage',
  ARCHIVE = 'archive'
}

/**
 * Import configuration
 */
export interface ImportConfiguration {
  format: ImportExportFormat;
  sourceType: ImportSourceType;
  source: string; // file path, URL, etc.
  options: ImportOptions;
}

/**
 * Import options
 */
export interface ImportOptions {
  preserveIds?: boolean;
  mergeStrategy?: 'overwrite' | 'skip' | 'merge' | 'create_new';
  createRelationships?: boolean;
  inferTypes?: boolean;
  validateData?: boolean;
  batchSize?: number;
  includeMetadata?: boolean;
  includeAttachments?: boolean;
  tagPrefix?: string;
  defaultNodeType?: string;
  fieldMapping?: Record<string, string>;
  customTransforms?: Array<{
    field: string;
    transform: 'lowercase' | 'uppercase' | 'trim' | 'custom';
    value?: string;
  }>;
}

/**
 * Export configuration
 */
export interface ExportConfiguration {
  format: ImportExportFormat;
  destinationType: ExportDestinationType;
  destination: string;
  options: ExportOptions;
}

/**
 * Export options
 */
export interface ExportOptions {
  includeRelationships?: boolean;
  includeMetadata?: boolean;
  includeAttachments?: boolean;
  includeVersions?: boolean;
  filterByType?: string[];
  filterByTags?: string[];
  filterByStatus?: string[];
  dateRange?: {
    from: Date;
    to: Date;
  };
  formatOptions?: {
    prettyPrint?: boolean;
    compression?: 'none' | 'gzip' | 'zip';
    encoding?: 'utf8' | 'base64';
    template?: string;
  };
  privacy?: {
    excludePrivate?: boolean;
    anonymizeAuthors?: boolean;
    redactSensitive?: boolean;
  };
}

/**
 * Import result
 */
export interface ImportResult {
  operationId: string;
  success: boolean;
  summary: {
    totalItems: number;
    successCount: number;
    errorCount: number;
    skippedCount: number;
    processingTime: number;
  };
  items: Array<{
    sourceId?: string;
    targetId?: string;
    type: 'node' | 'relationship' | 'template';
    status: 'success' | 'error' | 'skipped';
    error?: string;
    warnings?: string[];
  }>;
  relationships: {
    created: number;
    updated: number;
    errors: Array<{
      source: string;
      target: string;
      error: string;
    }>;
  };
  metadata: {
    importedAt: Date;
    source: string;
    format: ImportExportFormat;
    configuration: ImportConfiguration;
  };
}

/**
 * Export result
 */
export interface ExportResult {
  operationId: string;
  success: boolean;
  summary: {
    totalItems: number;
    exportedNodes: number;
    exportedRelationships: number;
    fileSize: number;
    processingTime: number;
  };
  output: {
    destination: string;
    format: ImportExportFormat;
    downloadUrl?: string;
    expiresAt?: Date;
  };
  metadata: {
    exportedAt: Date;
    configuration: ExportConfiguration;
    checksum?: string;
  };
}

/**
 * Import/Export operation status
 */
export interface OperationStatus {
  operationId: string;
  type: 'import' | 'export';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: {
    current: number;
    total: number;
    percentage: number;
    currentItem?: string;
  };
  startedAt: Date;
  completedAt?: Date;
  estimatedTimeRemaining?: number;
  error?: string;
}

/**
 * Import adapter interface
 */
export interface ImportAdapter {
  name: string;
  supportedFormats: ImportExportFormat[];
  
  /**
   * Validate source data
   */
  validateSource(source: any): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }>;

  /**
   * Parse source data into standardized format
   */
  parse(source: any, options: ImportOptions): Promise<{
    nodes: Partial<KnowledgeNode>[];
    relationships: Array<{
      sourceId: string;
      targetId: string;
      type: string;
      metadata?: any;
    }>;
    metadata: any;
  }>;
}

/**
 * Export adapter interface
 */
export interface ExportAdapter {
  name: string;
  supportedFormats: ImportExportFormat[];

  /**
   * Generate export data
   */
  generate(
    nodes: KnowledgeNode[],
    relationships: Relationship[],
    options: ExportOptions
  ): Promise<{
    data: any;
    metadata: any;
  }>;

  /**
   * Write to destination
   */
  write(data: any, destination: string, options: ExportOptions): Promise<void>;
}

/**
 * Import/Export service interface
 */
export interface ImportExportService extends ManagedService {
  /**
   * Import data from external sources
   */
  importData(configuration: ImportConfiguration): Promise<ImportResult>;

  /**
   * Export data to external destinations
   */
  exportData(configuration: ExportConfiguration): Promise<ExportResult>;

  /**
   * Get operation status
   */
  getOperationStatus(operationId: string): Promise<OperationStatus>;

  /**
   * Cancel an ongoing operation
   */
  cancelOperation(operationId: string): Promise<void>;

  /**
   * List available import formats
   */
  getSupportedImportFormats(): Promise<Array<{
    format: ImportExportFormat;
    name: string;
    description: string;
    extensions: string[];
    adapter: string;
  }>>;

  /**
   * List available export formats
   */
  getSupportedExportFormats(): Promise<Array<{
    format: ImportExportFormat;
    name: string;
    description: string;
    extensions: string[];
    adapter: string;
  }>>;

  /**
   * Validate import data before processing
   */
  validateImportData(source: string, format: ImportExportFormat): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
    preview: {
      estimatedNodes: number;
      estimatedRelationships: number;
      sampleData: any[];
    };
  }>;

  /**
   * Preview export data
   */
  previewExport(configuration: ExportConfiguration): Promise<{
    estimatedSize: number;
    itemCount: number;
    sample: any;
  }>;

  /**
   * Register custom import adapter
   */
  registerImportAdapter(adapter: ImportAdapter): void;

  /**
   * Register custom export adapter
   */
  registerExportAdapter(adapter: ExportAdapter): void;

  /**
   * Get import/export history
   */
  getOperationHistory(limit?: number): Promise<Array<{
    operationId: string;
    type: 'import' | 'export';
    status: string;
    summary: any;
    createdAt: Date;
    completedAt?: Date;
  }>>;

  /**
   * Sync with external source (bidirectional)
   */
  syncWithSource(sourceId: string, options: {
    direction: 'import' | 'export' | 'bidirectional';
    conflictResolution: 'local_wins' | 'remote_wins' | 'manual';
    dryRun?: boolean;
  }): Promise<{
    conflicts: Array<{
      itemId: string;
      type: 'node' | 'relationship';
      localVersion: any;
      remoteVersion: any;
    }>;
    changes: {
      toImport: number;
      toExport: number;
      toUpdate: number;
      toDelete: number;
    };
  }>;

  /**
   * Schedule regular sync
   */
  scheduleSync(sourceId: string, schedule: {
    interval: 'hourly' | 'daily' | 'weekly';
    time?: string;
    enabled: boolean;
  }): Promise<void>;

  /**
   * Bulk import from multiple sources
   */
  bulkImport(configurations: ImportConfiguration[]): Promise<ImportResult[]>;

  /**
   * Create backup/archive
   */
  createBackup(options: {
    includeData: boolean;
    includeFiles: boolean;
    compression: boolean;
    encryption?: string;
  }): Promise<{
    backupId: string;
    filePath: string;
    size: number;
    createdAt: Date;
  }>;

  /**
   * Restore from backup
   */
  restoreFromBackup(backupId: string, options: {
    overwriteExisting: boolean;
    selectiveRestore?: {
      nodeIds?: string[];
      categories?: string[];
    };
  }): Promise<ImportResult>;
}