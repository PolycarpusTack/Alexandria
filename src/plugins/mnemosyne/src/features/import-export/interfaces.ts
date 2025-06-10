import { MnemosyneDocument } from '../../interfaces';
import { TemplateContext } from '../templates/interfaces';

// Import/Export Types
export type ImportSourceType = 'obsidian' | 'notion' | 'roam' | 'logseq' | 'markdown' | 'json';
export type ExportFormat = 'pdf' | 'html' | 'markdown' | 'json' | 'static-site' | 'archive';
export type SyncDirection = 'import' | 'export' | 'bidirectional';

// Import Interfaces
export interface ImportSource {
  type: ImportSourceType;
  path: string;
  version?: string;
  format?: string;
  metadata?: Record<string, any>;
}

export interface ImportAnalysis {
  source: ImportSource;
  documentCount: number;
  linkCount: number;
  tagCount: number;
  attachmentCount: number;
  estimatedSize: number;
  structure: ImportStructure;
  sample: ImportSample[];
  preview: ImportPreview[];
  transformations: ImportTransformation[];
  conflicts?: ImportConflict[];
}

export interface ImportStructure {
  folders: FolderNode[];
  documents: number;
  maxDepth: number;
  hasAttachments: boolean;
  hasTags: boolean;
  hasMetadata: boolean;
}

export interface FolderNode {
  name: string;
  path: string;
  documentCount: number;
  children: FolderNode[];
}

export interface ImportSample {
  path: string;
  title: string;
  content: string;
  metadata?: Record<string, any>;
}

export interface ImportPreview {
  original: ImportSample;
  converted: MnemosyneDocument;
  changes: string[];
}

export interface ImportTransformation {
  type: 'wikilink' | 'tag' | 'metadata' | 'attachment' | 'structure';
  description: string;
  count: number;
  examples: string[];
}

export interface ImportConflict {
  type: 'duplicate' | 'naming' | 'relationship' | 'metadata';
  description: string;
  documentPath: string;
  resolution?: ConflictResolution;
}

export interface ConflictResolution {
  strategy: 'skip' | 'rename' | 'merge' | 'replace';
  newName?: string;
  mergeStrategy?: 'local' | 'remote' | 'manual';
}

export interface ImportOptions {
  preserveStructure: boolean;
  convertWikilinks: boolean;
  importAttachments: boolean;
  enableSync: boolean;
  conflictStrategy: 'skip' | 'rename' | 'merge' | 'ask';
  mapping?: ImportMapping;
}

export interface ImportMapping {
  tagMapping?: Record<string, string[]>;
  folderMapping?: Record<string, string>;
  metadataMapping?: Record<string, string>;
}

export interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  failed: number;
  documents: MnemosyneDocument[];
  errors: ImportError[];
  provenance: ProvenanceNode[];
}

export interface ImportError {
  documentPath: string;
  error: string;
  phase: 'parse' | 'transform' | 'save';
}

// Export Interfaces
export interface ExportConfig {
  format: ExportFormat;
  selection: ExportSelection;
  options: ExportOptions;
  metadata?: ExportMetadata;
}

export interface ExportSelection {
  type: 'current' | 'custom' | 'all' | 'query';
  documentIds?: string[];
  query?: string;
  includeRelated?: boolean;
  relationshipDepth?: number;
}

export interface ExportOptions {
  // Common options
  includeMetadata: boolean;
  includeBacklinks: boolean;
  includeGraph: boolean;
  preserveIds: boolean;
  
  // Format-specific options
  pdf?: PDFOptions;
  html?: HTMLOptions;
  staticSite?: StaticSiteOptions;
  archive?: ArchiveOptions;
}

export interface PDFOptions {
  templateId: string;
  theme: 'light' | 'dark' | 'custom';
  pageSize: 'A4' | 'Letter' | 'A3';
  margins: 'normal' | 'narrow' | 'wide';
  headers: 'simple' | 'detailed' | 'none';
  includeToC: boolean;
  includeCitations: boolean;
  includeIndex: boolean;
  aiStyling?: boolean;
  css?: string;
}

export interface HTMLOptions {
  template: string;
  singleFile: boolean;
  includeAssets: boolean;
  includeSearch: boolean;
  theme?: string;
}

export interface StaticSiteOptions {
  generator: 'hugo' | 'jekyll' | '11ty' | 'gatsby';
  theme: string;
  layout: string;
  includeSearch: boolean;
  includeGraph: boolean;
  generateSitemap: boolean;
}

export interface ArchiveOptions {
  encryption: boolean;
  password?: string;
  compressionLevel: number;
  includeHistory: boolean;
  includeAttachments: boolean;
}

export interface ExportMetadata {
  title: string;
  author: string;
  description?: string;
  date?: Date;
  version?: string;
  copyright?: string;
  custom?: Record<string, any>;
}

export interface ExportResult {
  success: boolean;
  format: ExportFormat;
  data: Buffer | string | ExportBundle;
  metadata: ExportResultMetadata;
}

export interface ExportBundle {
  files: ExportFile[];
  manifest: ExportManifest;
}

export interface ExportFile {
  path: string;
  content: Buffer | string;
  mimeType: string;
}

export interface ExportManifest {
  version: string;
  created: Date;
  documents: number;
  format: ExportFormat;
  metadata: ExportMetadata;
}

export interface ExportResultMetadata {
  exportedAt: Date;
  documentCount: number;
  totalSize: number;
  duration: number;
}

// Sync Interfaces
export interface SyncConfig {
  source: SyncEndpoint;
  target: SyncEndpoint;
  direction: SyncDirection;
  schedule?: SyncSchedule;
  conflictStrategy: ConflictStrategy;
  filters?: SyncFilter[];
  aiAssisted: boolean;
}

export interface SyncEndpoint {
  type: 'mnemosyne' | 'obsidian' | 'notion' | 'file-system';
  connection: string;
  credentials?: SyncCredentials;
  options?: Record<string, any>;
}

export interface SyncCredentials {
  type: 'oauth' | 'api-key' | 'basic';
  data: Record<string, string>;
}

export interface SyncSchedule {
  enabled: boolean;
  interval: number; // minutes
  lastSync?: Date;
  nextSync?: Date;
}

export interface ConflictStrategy {
  strategy: 'local-wins' | 'remote-wins' | 'newest-wins' | 'ai-merge' | 'manual';
  autoResolve: boolean;
  createBackup: boolean;
}

export interface SyncFilter {
  type: 'include' | 'exclude';
  field: 'path' | 'tag' | 'type' | 'metadata';
  pattern: string | RegExp;
}

export interface SyncSession {
  id: string;
  config: SyncConfig;
  status: 'idle' | 'syncing' | 'paused' | 'error';
  progress: SyncProgress;
  conflicts: SyncConflict[];
  startedAt?: Date;
  completedAt?: Date;
}

export interface SyncProgress {
  phase: 'scanning' | 'comparing' | 'syncing' | 'resolving';
  processed: number;
  total: number;
  errors: number;
  conflicts: number;
}

export interface SyncConflict {
  id: string;
  documentId: string;
  type: 'content' | 'metadata' | 'deleted';
  localVersion: DocumentVersion;
  remoteVersion: DocumentVersion;
  baseVersion?: DocumentVersion;
  resolution?: ConflictResolution;
}

export interface DocumentVersion {
  content: string;
  metadata: Record<string, any>;
  modifiedAt: Date;
  modifiedBy: string;
  checksum: string;
}

// Provenance Tracking
export interface ProvenanceNode {
  id: string;
  type: 'provenance';
  documentId: string;
  source: ProvenanceSource;
  original: ProvenanceOriginal;
  transformations: ProvenanceTransformation[];
  syncStatus?: ProvenanceSyncStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProvenanceSource {
  system: ImportSourceType;
  version: string;
  importDate: Date;
  importer: string;
  importOptions: ImportOptions;
}

export interface ProvenanceOriginal {
  format: string;
  location: string;
  size: number;
  metadata: Record<string, any>;
  checksum: string;
}

export interface ProvenanceTransformation {
  type: string;
  description: string;
  timestamp: Date;
  reversible: boolean;
}

export interface ProvenanceSyncStatus {
  enabled: boolean;
  lastSync: Date;
  direction: SyncDirection;
  conflicts: number;
  syncId?: string;
}

// Webhook Interfaces
export interface MnemosyneWebhook {
  id: string;
  name: string;
  url: string;
  secret: string;
  events: WebhookEvent[];
  filters?: WebhookFilter[];
  transform?: WebhookTransform;
  active: boolean;
  createdAt: Date;
  lastTriggered?: Date;
}

export interface WebhookEvent {
  type: 'document.created' | 'document.updated' | 'document.deleted' | 
        'import.completed' | 'export.completed' | 'sync.completed' |
        'template.used' | 'graph.updated';
}

export interface WebhookFilter {
  field: string;
  operator: 'equals' | 'contains' | 'regex';
  value: string;
}

export interface WebhookTransform {
  type: 'jmespath' | 'custom';
  expression: string;
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  event: WebhookEvent;
  payload: any;
  response?: WebhookResponse;
  attempts: number;
  deliveredAt?: Date;
  nextRetry?: Date;
}

export interface WebhookResponse {
  status: number;
  headers: Record<string, string>;
  body?: any;
  duration: number;
}

// Import Adapter Interface
export interface ImportAdapter {
  sourceType: ImportSourceType;
  version: string;
  
  // Detection and analysis
  detect(source: ImportSource): Promise<boolean>;
  analyze(source: ImportSource): Promise<ImportAnalysis>;
  
  // Parsing and transformation
  parse(source: ImportSource): Promise<ParsedContent>;
  transform(content: ParsedContent, options: ImportOptions): Promise<MnemosyneDocument[]>;
  
  // Knowledge graph integration
  mapRelationships(docs: MnemosyneDocument[]): Promise<KnowledgeGraphUpdate>;
  trackProvenance(doc: MnemosyneDocument, source: ImportSource): Promise<ProvenanceNode>;
  
  // AI enhancement
  enhanceWithAI?(doc: MnemosyneDocument, context: TemplateContext): Promise<MnemosyneDocument>;
  
  // Sync support
  supportsBidirectionalSync(): boolean;
  getChangesSince?(date: Date): Promise<DocumentChange[]>;
  applyChanges?(changes: DocumentChange[]): Promise<void>;
}

export interface ParsedContent {
  documents: ParsedDocument[];
  structure: ImportStructure;
  metadata: Record<string, any>;
}

export interface ParsedDocument {
  path: string;
  title: string;
  content: string;
  format: string;
  metadata?: Record<string, any>;
  links?: ParsedLink[];
  tags?: string[];
  attachments?: ParsedAttachment[];
}

export interface ParsedLink {
  type: 'wikilink' | 'markdown' | 'external';
  target: string;
  alias?: string;
  position: { start: number; end: number };
}

export interface ParsedAttachment {
  path: string;
  name: string;
  mimeType: string;
  size: number;
  data?: Buffer;
}

export interface KnowledgeGraphUpdate {
  nodes: GraphNode[];
  edges: GraphEdge[];
  clusters?: GraphCluster[];
}

export interface GraphNode {
  id: string;
  type: 'document' | 'tag' | 'folder';
  properties: Record<string, any>;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: string;
  properties?: Record<string, any>;
}

export interface GraphCluster {
  id: string;
  name: string;
  nodeIds: string[];
}

export interface DocumentChange {
  documentId: string;
  type: 'created' | 'updated' | 'deleted';
  timestamp: Date;
  changes?: FieldChange[];
}

export interface FieldChange {
  field: string;
  oldValue: any;
  newValue: any;
}