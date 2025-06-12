import { gql } from 'graphql-tag';

/**
 * GraphQL schema definition for Mnemosyne Knowledge Management
 */
export const typeDefs = gql`
  # Date scalar type
  scalar Date
  scalar JSON

  # Enums
  enum NodeType {
    DOCUMENT
    CONCEPT
    PERSON
    PROJECT
    TASK
    NOTE
    REFERENCE
    CATEGORY
    TAG
  }

  enum RelationshipType {
    REFERENCES
    RELATES_TO
    PART_OF
    DEPENDS_ON
    SIMILAR_TO
    CONTRADICTS
    SUPPORTS
    CREATED_BY
    MODIFIED_BY
    TAGGED_WITH
    CATEGORIZED_AS
  }

  enum SortOrder {
    ASC
    DESC
  }

  enum NodeSortField {
    TITLE
    CREATED_AT
    UPDATED_AT
    TYPE
    RELEVANCE
  }

  enum RelationshipSortField {
    WEIGHT
    CREATED_AT
    UPDATED_AT
    TYPE
  }

  # Input types for filtering and pagination
  input PaginationInput {
    offset: Int = 0
    limit: Int = 20
  }

  input DateRangeInput {
    from: Date
    to: Date
  }

  input NodeFiltersInput {
    types: [NodeType!]
    createdDate: DateRangeInput
    updatedDate: DateRangeInput
    tags: [String!]
    searchQuery: String
  }

  input RelationshipFiltersInput {
    types: [RelationshipType!]
    sourceId: ID
    targetId: ID
    minWeight: Float
    maxWeight: Float
    bidirectional: Boolean
    createdDate: DateRangeInput
  }

  input NodeSortInput {
    field: NodeSortField!
    order: SortOrder!
  }

  input RelationshipSortInput {
    field: RelationshipSortField!
    order: SortOrder!
  }

  # Core data types
  type Node {
    id: ID!
    title: String!
    content: String
    type: NodeType!
    slug: String
    tags: [String!]!
    metadata: JSON
    createdAt: Date!
    updatedAt: Date!
    deletedAt: Date
    version: Int!
    
    # Relationships
    outgoingRelationships(
      filters: RelationshipFiltersInput
      sort: RelationshipSortInput
      pagination: PaginationInput
    ): RelationshipConnection!
    
    incomingRelationships(
      filters: RelationshipFiltersInput
      sort: RelationshipSortInput
      pagination: PaginationInput
    ): RelationshipConnection!
    
    allRelationships(
      filters: RelationshipFiltersInput
      sort: RelationshipSortInput
      pagination: PaginationInput
    ): RelationshipConnection!
    
    # Graph operations
    neighbors(depth: Int = 1): [Node!]!
    shortestPathTo(targetId: ID!): Path
    subgraph(radius: Int = 2): Subgraph!
    suggestions(limit: Int = 5): [Node!]!
    
    # Hierarchy
    parent: Node
    children: [Node!]!
    ancestors: [Node!]!
    
    # Versions
    versions: [NodeVersion!]!
    currentVersion: NodeVersion!
    
    # Analytics
    connectionCount: Int!
    viewCount: Int!
    editCount: Int!
  }

  type Relationship {
    id: ID!
    sourceId: ID!
    targetId: ID!
    source: Node!
    target: Node!
    type: RelationshipType!
    weight: Float!
    bidirectional: Boolean!
    metadata: JSON
    createdAt: Date!
    updatedAt: Date!
    
    # Analytics
    traversalCount: Int!
  }

  type NodeVersion {
    id: ID!
    nodeId: ID!
    version: Int!
    title: String!
    content: String
    metadata: JSON
    createdAt: Date!
    createdBy: String
    changeDescription: String
  }

  # Graph structures
  type Path {
    nodes: [Node!]!
    relationships: [Relationship!]!
    totalWeight: Float!
    length: Int!
  }

  type Subgraph {
    centerNode: Node!
    nodes: [Node!]!
    relationships: [Relationship!]!
    radius: Int!
  }

  type GraphMetrics {
    totalNodes: Int!
    totalRelationships: Int!
    averageConnections: Float!
    maxDepth: Int!
    clusteringCoefficient: Float!
    networkDensity: Float!
    stronglyConnectedComponents: Int!
  }

  # Connection types for pagination
  type NodeConnection {
    nodes: [Node!]!
    totalCount: Int!
    pageInfo: PageInfo!
  }

  type RelationshipConnection {
    relationships: [Relationship!]!
    totalCount: Int!
    pageInfo: PageInfo!
  }

  type PageInfo {
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
    startCursor: String
    endCursor: String
  }

  # Search results
  type SearchResult {
    node: Node!
    score: Float!
    highlights: [SearchHighlight!]!
  }

  type SearchHighlight {
    field: String!
    value: String!
  }

  type SearchResults {
    results: [SearchResult!]!
    totalCount: Int!
    facets: SearchFacets!
    query: String!
    executionTime: Float!
  }

  type SearchFacets {
    types: [FacetCount!]!
    tags: [FacetCount!]!
    dateRanges: [DateFacetCount!]!
  }

  type FacetCount {
    value: String!
    count: Int!
  }

  type DateFacetCount {
    range: String!
    from: Date!
    to: Date!
    count: Int!
  }

  # Analytics types
  type NodeAnalytics {
    mostConnected: [NodePopularity!]!
    recentlyCreated: [Node!]!
    recentlyUpdated: [Node!]!
    mostViewed: [NodePopularity!]!
    typeDistribution: [TypeDistribution!]!
  }

  type NodePopularity {
    node: Node!
    count: Int!
    score: Float!
  }

  type TypeDistribution {
    type: NodeType!
    count: Int!
    percentage: Float!
  }

  type RelationshipAnalytics {
    typeDistribution: [RelationshipTypeDistribution!]!
    weightDistribution: [WeightDistribution!]!
    mostTraversed: [RelationshipPopularity!]!
  }

  type RelationshipTypeDistribution {
    type: RelationshipType!
    count: Int!
    percentage: Float!
  }

  type WeightDistribution {
    range: String!
    count: Int!
  }

  type RelationshipPopularity {
    relationship: Relationship!
    traversalCount: Int!
  }

  type TemporalAnalytics {
    creationTrend: [TrendPoint!]!
    updateTrend: [TrendPoint!]!
    viewTrend: [TrendPoint!]!
    granularity: String!
  }

  type TrendPoint {
    date: Date!
    value: Int!
    label: String!
  }

  # Input types for mutations
  input CreateNodeInput {
    title: String!
    content: String
    type: NodeType!
    tags: [String!] = []
    metadata: JSON
    parentId: ID
  }

  input UpdateNodeInput {
    title: String
    content: String
    type: NodeType
    tags: [String!]
    metadata: JSON
    parentId: ID
    changeDescription: String
  }

  input CreateRelationshipInput {
    sourceId: ID!
    targetId: ID!
    type: RelationshipType!
    weight: Float = 1.0
    bidirectional: Boolean = false
    metadata: JSON
  }

  input UpdateRelationshipInput {
    type: RelationshipType
    weight: Float
    bidirectional: Boolean
    metadata: JSON
  }

  input BulkCreateNodesInput {
    nodes: [CreateNodeInput!]!
  }

  input BulkUpdateNodesInput {
    updates: [BulkNodeUpdate!]!
  }

  input BulkNodeUpdate {
    id: ID!
    data: UpdateNodeInput!
  }

  input BulkCreateRelationshipsInput {
    relationships: [CreateRelationshipInput!]!
  }

  input BulkUpdateRelationshipsInput {
    updates: [BulkRelationshipUpdate!]!
  }

  input BulkRelationshipUpdate {
    id: ID!
    data: UpdateRelationshipInput!
  }

  # Mutation response types
  type NodeMutationResponse {
    success: Boolean!
    node: Node
    errors: [MutationError!]!
  }

  type RelationshipMutationResponse {
    success: Boolean!
    relationship: Relationship
    errors: [MutationError!]!
  }

  type BulkNodeMutationResponse {
    success: Boolean!
    nodes: [Node!]!
    successCount: Int!
    errors: [MutationError!]!
  }

  type BulkRelationshipMutationResponse {
    success: Boolean!
    relationships: [Relationship!]!
    successCount: Int!
    errors: [MutationError!]!
  }

  type MutationError {
    field: String
    message: String!
    code: String
  }

  # Subscription types
  type NodeSubscriptionPayload {
    mutation: String!
    node: Node!
    previousValues: Node
  }

  type RelationshipSubscriptionPayload {
    mutation: String!
    relationship: Relationship!
    previousValues: Relationship
  }

  type GraphUpdatePayload {
    type: String!
    nodeId: ID
    relationshipId: ID
    timestamp: Date!
  }

  # Root types
  type Query {
    # Node queries
    node(id: ID!): Node
    nodeBySlug(slug: String!): Node
    nodes(
      filters: NodeFiltersInput
      sort: NodeSortInput
      pagination: PaginationInput
    ): NodeConnection!
    
    # Relationship queries
    relationship(id: ID!): Relationship
    relationships(
      filters: RelationshipFiltersInput
      sort: RelationshipSortInput
      pagination: PaginationInput
    ): RelationshipConnection!
    
    # Search queries
    search(
      query: String!
      filters: NodeFiltersInput
      pagination: PaginationInput
    ): SearchResults!
    
    # Graph queries
    shortestPath(sourceId: ID!, targetId: ID!): Path
    allPaths(sourceId: ID!, targetId: ID!, maxDepth: Int = 6): [Path!]!
    nodeNeighbors(nodeId: ID!, depth: Int = 2): [Node!]!
    nodeSubgraph(nodeId: ID!, radius: Int = 2): Subgraph!
    areNodesConnected(sourceId: ID!, targetId: ID!, maxDepth: Int = 6): Boolean!
    
    # Analytics queries
    graphMetrics: GraphMetrics!
    nodeAnalytics(period: Int = 30): NodeAnalytics!
    relationshipAnalytics(period: Int = 30): RelationshipAnalytics!
    temporalAnalytics(
      granularity: String = "week"
      period: Int = 30
    ): TemporalAnalytics!
    
    # Utility queries
    nodeTypes: [NodeType!]!
    relationshipTypes: [RelationshipType!]!
    tags: [String!]!
    recentNodes(limit: Int = 10): [Node!]!
    popularNodes(limit: Int = 10): [Node!]!
  }

  type Mutation {
    # Node mutations
    createNode(input: CreateNodeInput!): NodeMutationResponse!
    updateNode(id: ID!, input: UpdateNodeInput!): NodeMutationResponse!
    deleteNode(id: ID!): NodeMutationResponse!
    restoreNode(id: ID!): NodeMutationResponse!
    duplicateNode(id: ID!, title: String): NodeMutationResponse!
    
    # Relationship mutations
    createRelationship(input: CreateRelationshipInput!): RelationshipMutationResponse!
    updateRelationship(id: ID!, input: UpdateRelationshipInput!): RelationshipMutationResponse!
    deleteRelationship(id: ID!): RelationshipMutationResponse!
    
    # Bulk mutations
    bulkCreateNodes(input: BulkCreateNodesInput!): BulkNodeMutationResponse!
    bulkUpdateNodes(input: BulkUpdateNodesInput!): BulkNodeMutationResponse!
    bulkDeleteNodes(ids: [ID!]!): BulkNodeMutationResponse!
    
    bulkCreateRelationships(input: BulkCreateRelationshipsInput!): BulkRelationshipMutationResponse!
    bulkUpdateRelationships(input: BulkUpdateRelationshipsInput!): BulkRelationshipMutationResponse!
    bulkDeleteRelationships(ids: [ID!]!): BulkRelationshipMutationResponse!
    
    # Version mutations
    restoreNodeVersion(nodeId: ID!, version: Int!): NodeMutationResponse!
    
    # Graph operations
    mergeNodes(primaryId: ID!, secondaryId: ID!): NodeMutationResponse!
    splitNode(nodeId: ID!, splitData: [CreateNodeInput!]!): BulkNodeMutationResponse!
  }

  type Subscription {
    # Node subscriptions
    nodeCreated: NodeSubscriptionPayload!
    nodeUpdated(nodeId: ID): NodeSubscriptionPayload!
    nodeDeleted: NodeSubscriptionPayload!
    
    # Relationship subscriptions
    relationshipCreated: RelationshipSubscriptionPayload!
    relationshipUpdated(relationshipId: ID): RelationshipSubscriptionPayload!
    relationshipDeleted: RelationshipSubscriptionPayload!
    
    # Graph subscriptions
    graphUpdated: GraphUpdatePayload!
    nodeNeighborsChanged(nodeId: ID!): [Node!]!
  }
`;

export default typeDefs;