/**
 * Mnemosyne-specific event definitions and interfaces
 */

/**
 * Event names enumeration for Mnemosyne plugin
 */
export enum MnemosyneEvents {
  // Knowledge node events
  KNOWLEDGE_CREATED = 'mnemosyne:knowledge:created',
  KNOWLEDGE_UPDATED = 'mnemosyne:knowledge:updated',
  KNOWLEDGE_DELETED = 'mnemosyne:knowledge:deleted',
  KNOWLEDGE_VIEWED = 'mnemosyne:knowledge:viewed',

  // Relationship events
  RELATIONSHIP_CREATED = 'mnemosyne:relationship:created',
  RELATIONSHIP_UPDATED = 'mnemosyne:relationship:updated',
  RELATIONSHIP_DELETED = 'mnemosyne:relationship:deleted',

  // Graph events
  GRAPH_UPDATED = 'mnemosyne:graph:updated',
  GRAPH_ANALYZED = 'mnemosyne:graph:analyzed',

  // Search events
  SEARCH_PERFORMED = 'mnemosyne:search:performed',
  SEARCH_INDEXED = 'mnemosyne:search:indexed',

  // Template events
  TEMPLATE_APPLIED = 'mnemosyne:template:applied',
  TEMPLATE_CREATED = 'mnemosyne:template:created',
  TEMPLATE_UPDATED = 'mnemosyne:template:updated',

  // Import/Export events
  IMPORT_STARTED = 'mnemosyne:import:started',
  IMPORT_COMPLETED = 'mnemosyne:import:completed',
  IMPORT_FAILED = 'mnemosyne:import:failed',
  EXPORT_STARTED = 'mnemosyne:export:started',
  EXPORT_COMPLETED = 'mnemosyne:export:completed',
  EXPORT_FAILED = 'mnemosyne:export:failed',

  // System events
  PLUGIN_INITIALIZED = 'mnemosyne:plugin:initialized',
  PLUGIN_SHUTDOWN = 'mnemosyne:plugin:shutdown',
  SERVICE_READY = 'mnemosyne:service:ready',
  SERVICE_ERROR = 'mnemosyne:service:error'
}

/**
 * Base event payload interface
 */
export interface BaseEventPayload {
  timestamp: Date;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, any>;
}

/**
 * Knowledge node event payload
 */
export interface KnowledgeNodeEventPayload extends BaseEventPayload {
  nodeId: string;
  nodeType: string;
  title: string;
  changes?: {
    field: string;
    oldValue: any;
    newValue: any;
  }[];
}

/**
 * Relationship event payload
 */
export interface RelationshipEventPayload extends BaseEventPayload {
  relationshipId: string;
  sourceNodeId: string;
  targetNodeId: string;
  relationshipType: string;
  weight?: number;
}

/**
 * Graph update event payload
 */
export interface GraphUpdateEventPayload extends BaseEventPayload {
  changeType: 'node_added' | 'node_removed' | 'relationship_added' | 'relationship_removed' | 'structure_changed';
  affectedNodes: string[];
  affectedRelationships: string[];
  statistics?: {
    nodeCount: number;
    relationshipCount: number;
    density: number;
  };
}

/**
 * Search event payload
 */
export interface SearchEventPayload extends BaseEventPayload {
  query: string;
  filters?: Record<string, any>;
  resultCount: number;
  responseTime: number;
  searchType: 'full_text' | 'semantic' | 'graph_traversal';
}

/**
 * Template event payload
 */
export interface TemplateEventPayload extends BaseEventPayload {
  templateId: string;
  templateName: string;
  targetNodeId?: string;
  variables?: Record<string, any>;
  generatedContent?: string;
}

/**
 * Import/Export event payload
 */
export interface ImportExportEventPayload extends BaseEventPayload {
  operationId: string;
  operationType: 'import' | 'export';
  sourceType: string;
  itemCount?: number;
  progress?: number;
  error?: string;
}

/**
 * Service event payload
 */
export interface ServiceEventPayload extends BaseEventPayload {
  serviceName: string;
  serviceVersion?: string;
  status: 'ready' | 'error' | 'initializing' | 'shutting_down';
  error?: string;
}

/**
 * Event payload type mapping
 */
export type EventPayloadMap = {
  [MnemosyneEvents.KNOWLEDGE_CREATED]: KnowledgeNodeEventPayload;
  [MnemosyneEvents.KNOWLEDGE_UPDATED]: KnowledgeNodeEventPayload;
  [MnemosyneEvents.KNOWLEDGE_DELETED]: KnowledgeNodeEventPayload;
  [MnemosyneEvents.KNOWLEDGE_VIEWED]: KnowledgeNodeEventPayload;
  [MnemosyneEvents.RELATIONSHIP_CREATED]: RelationshipEventPayload;
  [MnemosyneEvents.RELATIONSHIP_UPDATED]: RelationshipEventPayload;
  [MnemosyneEvents.RELATIONSHIP_DELETED]: RelationshipEventPayload;
  [MnemosyneEvents.GRAPH_UPDATED]: GraphUpdateEventPayload;
  [MnemosyneEvents.GRAPH_ANALYZED]: GraphUpdateEventPayload;
  [MnemosyneEvents.SEARCH_PERFORMED]: SearchEventPayload;
  [MnemosyneEvents.SEARCH_INDEXED]: SearchEventPayload;
  [MnemosyneEvents.TEMPLATE_APPLIED]: TemplateEventPayload;
  [MnemosyneEvents.TEMPLATE_CREATED]: TemplateEventPayload;
  [MnemosyneEvents.TEMPLATE_UPDATED]: TemplateEventPayload;
  [MnemosyneEvents.IMPORT_STARTED]: ImportExportEventPayload;
  [MnemosyneEvents.IMPORT_COMPLETED]: ImportExportEventPayload;
  [MnemosyneEvents.IMPORT_FAILED]: ImportExportEventPayload;
  [MnemosyneEvents.EXPORT_STARTED]: ImportExportEventPayload;
  [MnemosyneEvents.EXPORT_COMPLETED]: ImportExportEventPayload;
  [MnemosyneEvents.EXPORT_FAILED]: ImportExportEventPayload;
  [MnemosyneEvents.PLUGIN_INITIALIZED]: ServiceEventPayload;
  [MnemosyneEvents.PLUGIN_SHUTDOWN]: ServiceEventPayload;
  [MnemosyneEvents.SERVICE_READY]: ServiceEventPayload;
  [MnemosyneEvents.SERVICE_ERROR]: ServiceEventPayload;
};

/**
 * Event emitter interface for type-safe event emission
 */
export interface MnemosyneEventEmitter {
  emit<T extends keyof EventPayloadMap>(event: T, payload: EventPayloadMap[T]): void;
  subscribe<T extends keyof EventPayloadMap>(
    event: T,
    handler: (payload: EventPayloadMap[T]) => void | Promise<void>
  ): void;
  unsubscribe<T extends keyof EventPayloadMap>(
    event: T,
    handler: (payload: EventPayloadMap[T]) => void | Promise<void>
  ): void;
}

/**
 * Event handler function type
 */
export type EventHandler<T extends keyof EventPayloadMap> = (payload: EventPayloadMap[T]) => void | Promise<void>;

/**
 * Utility function to create event payload with common fields
 */
export function createEventPayload<T extends BaseEventPayload>(
  specificPayload: Omit<T, keyof BaseEventPayload>,
  userId?: string,
  sessionId?: string,
  metadata?: Record<string, any>
): T {
  return {
    ...specificPayload,
    timestamp: new Date(),
    userId,
    sessionId,
    metadata,
  } as T;
}