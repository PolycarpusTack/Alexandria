/**
 * Mnemosyne Core Types and Interfaces
 * 
 * Core data structures and interfaces for the Mnemosyne knowledge management system
 */

import { 
  PluginContext,
  Logger,
  EventBus,
  DataService
} from '@alexandria/plugin-interface';

import { MnemosyneConfiguration } from '../core/config/Configuration';

// Core System Interface
export interface MnemosyneCoreInterface {
  initialize(): Promise<void>;
  activate(): Promise<void>;
  deactivate(): Promise<void>;
  cleanup(): Promise<void>;
  healthCheck(): Promise<boolean>;
  getMetrics(): Promise<CoreMetrics>;
}

export interface CoreMetrics {
  uptime: number;
  memoryUsage: {
    used: number;
    total: number;
    percentage: number;
  };
  performance: {
    avgResponseTime: number;
    requestsPerSecond: number;
    errorRate: number;
  };
  resources: {
    documentsCount: number;
    relationshipsCount: number;
    templatesCount: number;
    activeUsers: number;
  };
}

// Document Management
export interface Document {
  id: string;
  title: string;
  content: string;
  contentType: 'markdown' | 'html' | 'plain';
  status: DocumentStatus;
  
  // Metadata
  tags: string[];
  category?: string;
  description?: string;
  
  // Timestamps
  created: Date;
  modified: Date;
  lastAccessed?: Date;
  
  // Authorship
  author: string;
  contributors: string[];
  
  // Version control
  version: number;
  parentVersion?: string;
  versionHistory?: DocumentVersion[];
  
  // Knowledge graph integration
  relationships: DocumentRelationship[];
  backlinks: string[];
  
  // Template information
  templateId?: string;
  templateVariables?: Record<string, any>;
  
  // Import/Export tracking
  provenance?: DocumentProvenance;
  
  // Collaboration
  collaborators?: string[];
  permissions?: DocumentPermissions;
  
  // Analytics
  analytics?: DocumentAnalytics;
  
  // Custom metadata
  metadata?: Record<string, any>;
}

export enum DocumentStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
  DELETED = 'deleted',
  REVIEWING = 'reviewing',
  APPROVED = 'approved'
}

export interface DocumentVersion {
  version: number;
  content: string;
  changes: string[];
  author: string;
  timestamp: Date;
  comment?: string;
}

export interface DocumentRelationship {
  id: string;
  sourceId: string;
  targetId: string;
  type: RelationshipType;
  strength: number;
  metadata?: Record<string, any>;
  created: Date;
  createdBy: string;
}

export enum RelationshipType {
  LINKS_TO = 'links-to',
  REFERENCES = 'references',
  DEPENDS_ON = 'depends-on',
  PART_OF = 'part-of',
  SIMILAR_TO = 'similar-to',
  CONTRADICTS = 'contradicts',
  EXTENDS = 'extends',
  IMPLEMENTS = 'implements',
  USES = 'uses',
  CUSTOM = 'custom'
}

export interface DocumentProvenance {
  source: 'import' | 'template' | 'user' | 'ai';
  originalId?: string;
  originalSource?: string;
  importSession?: string;
  transformations?: ProvenanceTransformation[];
  created: Date;
}

export interface ProvenanceTransformation {
  type: string;
  description: string;
  timestamp: Date;
  parameters?: Record<string, any>;
}

export interface DocumentPermissions {
  owner: string;
  readers: string[];
  writers: string[];
  admins: string[];
  public: boolean;
  shareLink?: string;
}

export interface DocumentAnalytics {
  views: number;
  uniqueViews: number;
  lastViewed: Date;
  viewHistory: ViewEvent[];
  editCount: number;
  shareCount: number;
  exportCount: number;
}

export interface ViewEvent {
  userId: string;
  timestamp: Date;
  duration?: number;
  source?: string;
}

// Knowledge Graph
export interface KnowledgeNode {
  id: string;
  type: NodeType;
  title: string;
  content?: string;
  
  // Position and visualization
  position?: {
    x: number;
    y: number;
    z?: number;
  };
  
  // Graph properties
  weight: number;
  centrality?: number;
  clustering?: number;
  
  // Metadata
  tags: string[];
  category?: string;
  metadata?: Record<string, any>;
  
  // Timestamps
  created: Date;
  modified: Date;
  
  // Relationships
  relationships: KnowledgeRelationship[];
  
  // Analytics
  analytics?: NodeAnalytics;
}

export enum NodeType {
  DOCUMENT = 'document',
  CONCEPT = 'concept',
  PERSON = 'person',
  ORGANIZATION = 'organization',
  TOPIC = 'topic',
  KEYWORD = 'keyword',
  TEMPLATE = 'template',
  FOLDER = 'folder',
  TAG = 'tag',
  CUSTOM = 'custom'
}

export interface KnowledgeRelationship {
  id: string;
  sourceId: string;
  targetId: string;
  type: RelationshipType;
  
  // Relationship properties
  strength: number;
  confidence: number;
  bidirectional: boolean;
  
  // Metadata
  description?: string;
  evidence?: string[];
  metadata?: Record<string, any>;
  
  // Timestamps
  created: Date;
  modified: Date;
  createdBy: string;
  
  // Analytics
  analytics?: RelationshipAnalytics;
}

export interface NodeAnalytics {
  connectionsCount: number;
  inboundConnections: number;
  outboundConnections: number;
  pageRank: number;
  betweennessCentrality: number;
  clusteringCoefficient: number;
  accessCount: number;
  lastAccessed: Date;
}

export interface RelationshipAnalytics {
  accessCount: number;
  strengthHistory: Array<{
    strength: number;
    timestamp: Date;
  }>;
  lastTraversed: Date;
}

// Knowledge Graph Operations
export interface GraphQuery {
  type: 'traversal' | 'search' | 'pattern' | 'similarity';
  startNode?: string;
  endNode?: string;
  depth?: number;
  filters?: GraphFilter[];
  algorithm?: GraphAlgorithm;
  limit?: number;
  offset?: number;
}

export interface GraphFilter {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'nin' | 'contains';
  value: any;
}

export enum GraphAlgorithm {
  SHORTEST_PATH = 'shortest-path',
  PAGE_RANK = 'page-rank',
  CLUSTERING = 'clustering',
  COMMUNITY_DETECTION = 'community-detection',
  CENTRALITY = 'centrality',
  SIMILARITY = 'similarity'
}

export interface GraphQueryResult {
  nodes: KnowledgeNode[];
  relationships: KnowledgeRelationship[];
  metadata: {
    totalNodes: number;
    totalRelationships: number;
    executionTime: number;
    algorithm?: string;
  };
}

// Search System
export interface SearchQuery {
  query: string;
  type: SearchType;
  filters?: SearchFilter[];
  facets?: string[];
  highlight?: boolean;
  fuzzy?: boolean;
  boost?: Record<string, number>;
  limit?: number;
  offset?: number;
}

export enum SearchType {
  FULL_TEXT = 'full-text',
  SEMANTIC = 'semantic',
  GRAPH = 'graph',
  HYBRID = 'hybrid'
}

export interface SearchFilter {
  field: string;
  value: any;
  operator?: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'range';
}

export interface SearchResult {
  documents: SearchHit[];
  facets: SearchFacet[];
  metadata: {
    total: number;
    maxScore: number;
    executionTime: number;
    searchType: SearchType;
  };
}

export interface SearchHit {
  document: Document;
  score: number;
  highlights?: Record<string, string[]>;
  explanation?: string;
}

export interface SearchFacet {
  field: string;
  values: Array<{
    value: any;
    count: number;
  }>;
}

// Template System
export interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  
  // Template content
  content: string;
  engine: 'handlebars' | 'mustache' | 'liquid';
  
  // Variables
  variables: TemplateVariable[];
  requiredVariables: string[];
  
  // Metadata
  tags: string[];
  author: string;
  version: string;
  
  // Usage tracking
  usageCount: number;
  lastUsed?: Date;
  
  // AI generation
  generatedBy?: 'user' | 'ai';
  generationPrompt?: string;
  
  // Timestamps
  created: Date;
  modified: Date;
  
  // Template relationships
  parentTemplate?: string;
  childTemplates?: string[];
  
  // Configuration
  config?: TemplateConfig;
  
  // Analytics
  analytics?: TemplateAnalytics;
}

export interface TemplateVariable {
  name: string;
  type: VariableType;
  description: string;
  required: boolean;
  defaultValue?: any;
  validation?: VariableValidation;
  suggestions?: any[];
}

export enum VariableType {
  STRING = 'string',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  DATE = 'date',
  ARRAY = 'array',
  OBJECT = 'object',
  REFERENCE = 'reference',
  TEMPLATE = 'template'
}

export interface VariableValidation {
  pattern?: RegExp;
  min?: number;
  max?: number;
  enum?: any[];
  custom?: (value: any) => boolean | string;
}

export interface TemplateConfig {
  autoSave: boolean;
  validation: boolean;
  preview: boolean;
  syntax: 'handlebars' | 'mustache' | 'liquid';
}

export interface TemplateAnalytics {
  usageCount: number;
  successRate: number;
  avgCompletionTime: number;
  popularVariables: string[];
  userSatisfaction?: number;
  errorPatterns: string[];
}

export interface TemplateRenderContext {
  variables: Record<string, any>;
  user: UserContext;
  document?: Document;
  knowledgeGraph?: KnowledgeGraphContext;
  mnemosyne?: MnemosyneContext;
}

export interface UserContext {
  id: string;
  name: string;
  email: string;
  role: string;
  preferences: Record<string, any>;
  expertise: string[];
}

export interface KnowledgeGraphContext {
  relatedNodes: KnowledgeNode[];
  relatedDocuments: Document[];
  suggestedConnections: KnowledgeRelationship[];
}

export interface MnemosyneContext {
  version: string;
  activeDocument?: Document;
  recentDocuments: Document[];
  templates: Template[];
  userPreferences: Record<string, any>;
}

// Import/Export System
export interface ImportSession {
  id: string;
  source: ImportSource;
  status: ImportStatus;
  
  // Progress tracking
  progress: number;
  totalItems: number;
  processedItems: number;
  
  // Results
  documentsImported: number;
  relationshipsCreated: number;
  errorsCount: number;
  
  // Configuration
  options: ImportOptions;
  
  // Metadata
  started: Date;
  completed?: Date;
  duration?: number;
  
  // Error tracking
  errors: ImportError[];
  warnings: ImportWarning[];
  
  // Analytics
  analytics?: ImportAnalytics;
}

export interface ImportSource {
  type: 'obsidian' | 'notion' | 'markdown' | 'csv' | 'json';
  path: string;
  credentials?: Record<string, any>;
  metadata?: Record<string, any>;
}

export enum ImportStatus {
  PENDING = 'pending',
  ANALYZING = 'analyzing',
  IMPORTING = 'importing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export interface ImportOptions {
  preserveStructure: boolean;
  convertLinks: boolean;
  trackProvenance: boolean;
  enableSync: boolean;
  batchSize: number;
  validation: boolean;
  enhancement?: ImportEnhancement;
}

export interface ImportEnhancement {
  enabled: boolean;
  generateSummary: boolean;
  enhanceTags: boolean;
  improveFormatting: boolean;
  createRelationships: boolean;
}

export interface ImportError {
  code: string;
  message: string;
  item?: string;
  severity: 'low' | 'medium' | 'high';
  recoverable: boolean;
  timestamp: Date;
}

export interface ImportWarning {
  code: string;
  message: string;
  item?: string;
  suggestion?: string;
  timestamp: Date;
}

export interface ImportAnalytics {
  sourceAnalysis: {
    fileCount: number;
    totalSize: number;
    fileTypes: Record<string, number>;
    avgFileSize: number;
  };
  conversionMetrics: {
    successRate: number;
    avgProcessingTime: number;
    memoryUsage: number;
  };
  qualityMetrics: {
    duplicatesFound: number;
    brokenLinks: number;
    missingReferences: number;
  };
}

export interface ExportSession {
  id: string;
  format: ExportFormat;
  status: ExportStatus;
  
  // Configuration
  documents: ExportDocumentSelection;
  options: ExportOptions;
  template?: string;
  
  // Progress
  progress: number;
  
  // Results
  outputPath?: string;
  fileSize?: number;
  
  // Timestamps
  started: Date;
  completed?: Date;
  
  // Error tracking
  errors: ExportError[];
}

export enum ExportFormat {
  PDF = 'pdf',
  HTML = 'html',
  MARKDOWN = 'markdown',
  STATIC_SITE = 'static-site',
  ARCHIVE = 'archive',
  JSON = 'json'
}

export enum ExportStatus {
  PENDING = 'pending',
  PREPARING = 'preparing',
  EXPORTING = 'exporting',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

export interface ExportDocumentSelection {
  type: 'all' | 'selected' | 'filtered' | 'graph';
  ids?: string[];
  filters?: SearchFilter[];
  graphQuery?: GraphQuery;
}

export interface ExportOptions {
  includeMetadata: boolean;
  includeRelationships: boolean;
  includeBacklinks: boolean;
  template?: string;
  format?: Record<string, any>;
  customOptions?: Record<string, any>;
}

export interface ExportError {
  code: string;
  message: string;
  documentId?: string;
  severity: 'low' | 'medium' | 'high';
  timestamp: Date;
}

// Analytics and Monitoring
export interface AnalyticsMetrics {
  usage: UsageMetrics;
  performance: PerformanceMetrics;
  content: ContentMetrics;
  user: UserMetrics;
  system: SystemMetrics;
}

export interface UsageMetrics {
  documentsCreated: number;
  documentsEdited: number;
  documentsViewed: number;
  templatesUsed: number;
  searchesPerformed: number;
  importsCompleted: number;
  exportsGenerated: number;
  activeUsers: number;
  sessionDuration: number;
}

export interface PerformanceMetrics {
  avgResponseTime: number;
  requestsPerSecond: number;
  errorRate: number;
  cacheHitRate: number;
  memoryUsage: number;
  cpuUsage: number;
  databaseQueries: number;
  slowQueries: number;
}

export interface ContentMetrics {
  totalDocuments: number;
  totalRelationships: number;
  totalTemplates: number;
  avgDocumentSize: number;
  contentGrowthRate: number;
  duplicateContent: number;
  orphanedDocuments: number;
  graphDensity: number;
}

export interface UserMetrics {
  totalUsers: number;
  activeUsers: number;
  newUsers: number;
  userRetention: number;
  collaborationRate: number;
  feedbackScore: number;
  supportTickets: number;
}

export interface SystemMetrics {
  uptime: number;
  availability: number;
  dataIntegrity: number;
  backupStatus: string;
  securityIncidents: number;
  apiCalls: number;
  storageUsage: number;
}

// Service Interfaces
export interface ServiceConstructorOptions {
  context: PluginContext;
  config: MnemosyneConfiguration;
  logger: Logger;
  dataService?: DataService;
  eventBus?: EventBus;
}

export interface ServiceHealthStatus {
  healthy: boolean;
  details: {
    status: string;
    uptime: number;
    lastCheck: Date;
    errors?: string[];
    metrics?: Record<string, any>;
  };
}

// Event System
export interface EventPayload {
  id: string;
  timestamp: Date;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, any>;
}

export interface AsyncEventHandler<T extends EventPayload = EventPayload> {
  (payload: T): Promise<void>;
}

export interface EventMiddleware {
  (payload: EventPayload, next: () => Promise<void>): Promise<void>;
}

// Cache System
export interface CacheEntry<T = any> {
  key: string;
  value: T;
  ttl: number;
  created: Date;
  accessed: Date;
  hits: number;
}

export interface CacheStats {
  totalEntries: number;
  totalSize: number;
  hitRate: number;
  missRate: number;
  evictions: number;
  memoryUsage: number;
}

// Utility Types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequiredBy<T, K extends keyof T> = T & Required<Pick<T, K>>;

export type OptionalBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type Writeable<T> = { -readonly [P in keyof T]: T[P] };

export type AsyncOrSync<T> = T | Promise<T>;