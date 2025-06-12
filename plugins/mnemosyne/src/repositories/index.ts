export { BaseRepository } from './BaseRepository';
export { KnowledgeNodeRepository } from './KnowledgeNodeRepository';
export { RelationshipRepository } from './RelationshipRepository';

export type { DatabaseConnection, PaginationOptions, SortOptions, BaseEntity } from './BaseRepository';

export type {
  KnowledgeNode,
  CreateKnowledgeNodeInput,
  UpdateKnowledgeNodeInput,
  SearchKnowledgeNodesFilters,
  SearchResult,
  NodeStatistics
} from './KnowledgeNodeRepository';

export type {
  Relationship,
  CreateRelationshipInput,
  UpdateRelationshipInput,
  SearchRelationshipsFilters,
  GraphNode,
  GraphLink,
  GraphData,
  SubgraphOptions,
  PathOptions,
  NetworkMetrics
} from './RelationshipRepository';