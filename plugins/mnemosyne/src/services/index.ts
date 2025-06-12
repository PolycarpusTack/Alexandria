// Legacy mock services (deprecated)
export { KnowledgeNodeService } from './KnowledgeNodeService';
export { RelationshipService } from './RelationshipService';

// New database-backed services
export { DatabaseKnowledgeNodeService } from './DatabaseKnowledgeNodeService';
export { DatabaseRelationshipService } from './DatabaseRelationshipService';
export { DatabaseAdapter, DatabaseAdapterFactory } from './DatabaseAdapter';

// Performance and caching services
export { CacheService, cacheService, CacheInvalidator, CacheWarmer } from './CacheService';

export type {
  KnowledgeNode,
  CreateNodeInput,
  UpdateNodeInput,
  SearchFilters,
  SearchResult,
  NodeStatistics
} from './KnowledgeNodeService';

export type {
  Relationship,
  CreateRelationshipInput,
  UpdateRelationshipInput,
  RelationshipFilters,
  GraphNode,
  GraphLink,
  GraphData,
  SubgraphOptions,
  PathFindingOptions,
  NetworkMetrics
} from './RelationshipService';