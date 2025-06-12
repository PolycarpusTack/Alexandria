import { BaseRepository, DatabaseConnection, PaginationOptions, SortOptions } from './BaseRepository';

export interface Relationship {
  id: string;
  source_id: string;
  target_id: string;
  relationship_type: 'REFERENCES' | 'TAGS' | 'RELATED' | 'CONTAINS' | 'DEPENDS_ON' | 
                   'SIMILAR_TO' | 'PART_OF' | 'FOLLOWS' | 'MENTIONS' | 'SUPERSEDES' |
                   'IMPLEMENTS' | 'EXTENDS' | 'USES' | 'CONFLICTS_WITH';
  
  // Relationship properties
  weight: number;
  bidirectional: boolean;
  strength: number;
  confidence: number;
  
  // Relationship metadata
  description?: string;
  context?: string;
  evidence?: string;
  automatic: boolean;
  verified: boolean;
  
  // User tracking
  created_by?: string;
  updated_by?: string;
  verified_by?: string;
  
  // Timestamps
  created_at: Date;
  updated_at: Date;
  verified_at?: Date;
  
  // Additional properties
  properties: Record<string, any>;
}

export interface CreateRelationshipInput {
  source_id: string;
  target_id: string;
  relationship_type: Relationship['relationship_type'];
  weight?: number;
  bidirectional?: boolean;
  strength?: number;
  confidence?: number;
  description?: string;
  context?: string;
  evidence?: string;
  automatic?: boolean;
  verified?: boolean;
  created_by?: string;
  properties?: Record<string, any>;
}

export interface UpdateRelationshipInput {
  relationship_type?: Relationship['relationship_type'];
  weight?: number;
  bidirectional?: boolean;
  strength?: number;
  confidence?: number;
  description?: string;
  context?: string;
  evidence?: string;
  verified?: boolean;
  updated_by?: string;
  verified_by?: string;
  properties?: Record<string, any>;
}

export interface SearchRelationshipsFilters {
  source_id?: string;
  target_id?: string;
  node_id?: string; // Either source or target
  relationship_type?: Relationship['relationship_type'];
  min_weight?: number;
  max_weight?: number;
  min_strength?: number;
  max_strength?: number;
  min_confidence?: number;
  bidirectional?: boolean;
  automatic?: boolean;
  verified?: boolean;
  created_by?: string;
  created_after?: Date;
  created_before?: Date;
}

export interface GraphNode {
  id: string;
  title: string;
  node_type: string;
  size: number;
  color?: string;
  metadata?: Record<string, any>;
}

export interface GraphLink {
  id: string;
  source: string;
  target: string;
  relationship_type: string;
  weight: number;
  bidirectional: boolean;
  color?: string;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface SubgraphOptions {
  depth?: number;
  max_nodes?: number;
  include_types?: string[];
  exclude_types?: string[];
  min_weight?: number;
  include_relationship_types?: string[];
  exclude_relationship_types?: string[];
}

export interface PathOptions {
  max_depth?: number;
  algorithm?: 'shortest' | 'weighted';
  include_relationship_types?: string[];
  exclude_relationship_types?: string[];
}

export interface NetworkMetrics {
  total_nodes: number;
  total_edges: number;
  density: number;
  average_degree: number;
  max_degree: number;
  components: number;
  clustering_coefficient: number;
  most_connected: Array<{ node_id: string; degree: number; title?: string }>;
  relationship_type_distribution: Record<string, number>;
  weight_statistics: {
    min: number;
    max: number;
    average: number;
    median: number;
  };
}

export class RelationshipRepository extends BaseRepository<Relationship> {
  constructor(db: DatabaseConnection) {
    super('mnemosyne_relationships', db);
  }

  protected mapRowToEntity(row: any): Relationship {
    return {
      id: row.id,
      source_id: row.source_id,
      target_id: row.target_id,
      relationship_type: row.relationship_type,
      weight: parseFloat(row.weight) || 1.0,
      bidirectional: row.bidirectional || false,
      strength: parseFloat(row.strength) || 1.0,
      confidence: parseFloat(row.confidence) || 1.0,
      description: row.description,
      context: row.context,
      evidence: row.evidence,
      automatic: row.automatic || false,
      verified: row.verified || false,
      created_by: row.created_by,
      updated_by: row.updated_by,
      verified_by: row.verified_by,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
      verified_at: row.verified_at ? new Date(row.verified_at) : undefined,
      properties: row.properties || {}
    };
  }

  async create(data: CreateRelationshipInput): Promise<Relationship> {
    // Validate that source and target are different
    if (data.source_id === data.target_id) {
      throw new Error('Cannot create relationship to self');
    }

    const relationshipData = {
      ...data,
      weight: data.weight || 1.0,
      bidirectional: data.bidirectional || false,
      strength: data.strength || 1.0,
      confidence: data.confidence || 1.0,
      automatic: data.automatic || false,
      verified: data.verified || false,
      properties: data.properties || {}
    };

    return super.create(relationshipData);
  }

  async findByNodeId(nodeId: string, options: PaginationOptions & SortOptions = {}): Promise<Relationship[]> {
    const whereClause = 'source_id = $1 OR target_id = $1';
    return this.findWhere(whereClause, [nodeId], options);
  }

  async findBySourceId(sourceId: string, options: PaginationOptions & SortOptions = {}): Promise<Relationship[]> {
    return this.findWhere('source_id = $1', [sourceId], options);
  }

  async findByTargetId(targetId: string, options: PaginationOptions & SortOptions = {}): Promise<Relationship[]> {
    return this.findWhere('target_id = $1', [targetId], options);
  }

  async search(
    filters: SearchRelationshipsFilters,
    options: PaginationOptions & SortOptions = {}
  ): Promise<Relationship[]> {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (filters.source_id) {
      conditions.push(`source_id = $${paramIndex++}`);
      params.push(filters.source_id);
    }

    if (filters.target_id) {
      conditions.push(`target_id = $${paramIndex++}`);
      params.push(filters.target_id);
    }

    if (filters.node_id) {
      conditions.push(`(source_id = $${paramIndex} OR target_id = $${paramIndex})`);
      params.push(filters.node_id);
      paramIndex++;
    }

    if (filters.relationship_type) {
      conditions.push(`relationship_type = $${paramIndex++}`);
      params.push(filters.relationship_type);
    }

    if (filters.min_weight !== undefined) {
      conditions.push(`weight >= $${paramIndex++}`);
      params.push(filters.min_weight);
    }

    if (filters.max_weight !== undefined) {
      conditions.push(`weight <= $${paramIndex++}`);
      params.push(filters.max_weight);
    }

    if (filters.min_strength !== undefined) {
      conditions.push(`strength >= $${paramIndex++}`);
      params.push(filters.min_strength);
    }

    if (filters.max_strength !== undefined) {
      conditions.push(`strength <= $${paramIndex++}`);
      params.push(filters.max_strength);
    }

    if (filters.min_confidence !== undefined) {
      conditions.push(`confidence >= $${paramIndex++}`);
      params.push(filters.min_confidence);
    }

    if (filters.bidirectional !== undefined) {
      conditions.push(`bidirectional = $${paramIndex++}`);
      params.push(filters.bidirectional);
    }

    if (filters.automatic !== undefined) {
      conditions.push(`automatic = $${paramIndex++}`);
      params.push(filters.automatic);
    }

    if (filters.verified !== undefined) {
      conditions.push(`verified = $${paramIndex++}`);
      params.push(filters.verified);
    }

    if (filters.created_by) {
      conditions.push(`created_by = $${paramIndex++}`);
      params.push(filters.created_by);
    }

    if (filters.created_after) {
      conditions.push(`created_at >= $${paramIndex++}`);
      params.push(filters.created_after);
    }

    if (filters.created_before) {
      conditions.push(`created_at <= $${paramIndex++}`);
      params.push(filters.created_before);
    }

    const whereClause = conditions.length > 0 ? conditions.join(' AND ') : '1=1';
    return this.findWhere(whereClause, params, options);
  }

  async getSubgraph(nodeId: string, options: SubgraphOptions = {}): Promise<GraphData> {
    const {
      depth = 2,
      max_nodes = 50,
      include_types,
      exclude_types,
      min_weight = 0,
      include_relationship_types,
      exclude_relationship_types
    } = options;

    // Build the recursive query to traverse the graph
    let nodeTypeFilter = '';
    if (include_types && include_types.length > 0) {
      nodeTypeFilter = `AND n.node_type = ANY($${this.getNextParamIndex()})`;
    } else if (exclude_types && exclude_types.length > 0) {
      nodeTypeFilter = `AND n.node_type != ALL($${this.getNextParamIndex()})`;
    }

    let relationshipTypeFilter = '';
    if (include_relationship_types && include_relationship_types.length > 0) {
      relationshipTypeFilter = `AND r.relationship_type = ANY($${this.getNextParamIndex()})`;
    } else if (exclude_relationship_types && exclude_relationship_types.length > 0) {
      relationshipTypeFilter = `AND r.relationship_type != ALL($${this.getNextParamIndex()})`;
    }

    const query = `
      WITH RECURSIVE graph_traversal AS (
        -- Base case: start with the given node
        SELECT n.id, n.title, n.node_type, 0 as depth
        FROM mnemosyne_knowledge_nodes n
        WHERE n.id = $1 AND n.status != 'DELETED'
        
        UNION ALL
        
        -- Recursive case: find connected nodes
        SELECT DISTINCT n.id, n.title, n.node_type, gt.depth + 1
        FROM graph_traversal gt
        JOIN mnemosyne_relationships r ON (
          (r.source_id = gt.id OR r.target_id = gt.id)
          AND r.weight >= $2
          ${relationshipTypeFilter}
        )
        JOIN mnemosyne_knowledge_nodes n ON (
          n.id = CASE 
            WHEN r.source_id = gt.id THEN r.target_id 
            ELSE r.source_id 
          END
          AND n.status != 'DELETED'
          ${nodeTypeFilter}
        )
        WHERE gt.depth < $3
      ),
      limited_nodes AS (
        SELECT DISTINCT id, title, node_type, MIN(depth) as min_depth
        FROM graph_traversal
        GROUP BY id, title, node_type
        ORDER BY min_depth, title
        LIMIT $4
      )
      SELECT 
        ln.id, ln.title, ln.node_type, ln.min_depth,
        r.id as rel_id, r.source_id, r.target_id, r.relationship_type, 
        r.weight, r.bidirectional
      FROM limited_nodes ln
      LEFT JOIN mnemosyne_relationships r ON (
        (r.source_id = ln.id OR r.target_id = ln.id)
        AND (r.source_id IN (SELECT id FROM limited_nodes) 
             AND r.target_id IN (SELECT id FROM limited_nodes))
        AND r.weight >= $2
        ${relationshipTypeFilter}
      )
      ORDER BY ln.min_depth, ln.title
    `;

    const params = [nodeId, min_weight, depth, max_nodes];
    
    if (include_types && include_types.length > 0) {
      params.push(include_types);
    } else if (exclude_types && exclude_types.length > 0) {
      params.push(exclude_types);
    }

    if (include_relationship_types && include_relationship_types.length > 0) {
      params.push(include_relationship_types);
    } else if (exclude_relationship_types && exclude_relationship_types.length > 0) {
      params.push(exclude_relationship_types);
    }

    const result = await this.db.query(query, params);

    // Process results into nodes and links
    const nodesMap = new Map<string, GraphNode>();
    const linksMap = new Map<string, GraphLink>();

    for (const row of result.rows) {
      // Add node if not already added
      if (!nodesMap.has(row.id)) {
        nodesMap.set(row.id, {
          id: row.id,
          title: row.title,
          node_type: row.node_type,
          size: this.calculateNodeSize(row.id, result.rows)
        });
      }

      // Add relationship if exists and not already added
      if (row.rel_id && !linksMap.has(row.rel_id)) {
        linksMap.set(row.rel_id, {
          id: row.rel_id,
          source: row.source_id,
          target: row.target_id,
          relationship_type: row.relationship_type,
          weight: parseFloat(row.weight),
          bidirectional: row.bidirectional
        });
      }
    }

    return {
      nodes: Array.from(nodesMap.values()),
      links: Array.from(linksMap.values())
    };
  }

  async findPath(sourceId: string, targetId: string, options: PathOptions = {}): Promise<string[]> {
    const {
      max_depth = 5,
      algorithm = 'shortest',
      include_relationship_types,
      exclude_relationship_types
    } = options;

    let relationshipTypeFilter = '';
    const params = [sourceId, targetId, max_depth];

    if (include_relationship_types && include_relationship_types.length > 0) {
      relationshipTypeFilter = `AND r.relationship_type = ANY($4)`;
      params.push(include_relationship_types);
    } else if (exclude_relationship_types && exclude_relationship_types.length > 0) {
      relationshipTypeFilter = `AND r.relationship_type != ALL($4)`;
      params.push(exclude_relationship_types);
    }

    const weightOrder = algorithm === 'weighted' ? 'ORDER BY r.weight DESC' : '';

    const query = `
      WITH RECURSIVE path_search AS (
        -- Base case: start with source node
        SELECT $1::uuid as current_node, ARRAY[$1::uuid] as path, 0 as depth
        
        UNION ALL
        
        -- Recursive case: extend path
        SELECT 
          CASE 
            WHEN r.source_id = ps.current_node THEN r.target_id 
            ELSE r.source_id 
          END as current_node,
          ps.path || CASE 
            WHEN r.source_id = ps.current_node THEN r.target_id 
            ELSE r.source_id 
          END as path,
          ps.depth + 1
        FROM path_search ps
        JOIN mnemosyne_relationships r ON (
          (r.source_id = ps.current_node OR r.target_id = ps.current_node)
          ${relationshipTypeFilter}
        )
        WHERE ps.depth < $3
          AND NOT (CASE 
            WHEN r.source_id = ps.current_node THEN r.target_id 
            ELSE r.source_id 
          END = ANY(ps.path))  -- Avoid cycles
      )
      SELECT path
      FROM path_search
      WHERE current_node = $2
      ORDER BY array_length(path, 1)
      LIMIT 1
    `;

    const result = await this.db.query(query, params);
    
    if (result.rows.length === 0) {
      return [];
    }

    return result.rows[0].path;
  }

  async areNodesConnected(sourceId: string, targetId: string, maxDepth: number = 3): Promise<boolean> {
    const path = await this.findPath(sourceId, targetId, { max_depth: maxDepth });
    return path.length > 0;
  }

  async getNetworkMetrics(): Promise<NetworkMetrics> {
    const query = `
      WITH node_degrees AS (
        SELECT 
          COALESCE(source_counts.node_id, target_counts.node_id) as node_id,
          COALESCE(source_counts.out_degree, 0) + COALESCE(target_counts.in_degree, 0) as total_degree
        FROM (
          SELECT source_id as node_id, COUNT(*) as out_degree
          FROM mnemosyne_relationships
          GROUP BY source_id
        ) source_counts
        FULL OUTER JOIN (
          SELECT target_id as node_id, COUNT(*) as in_degree
          FROM mnemosyne_relationships
          GROUP BY target_id
        ) target_counts ON source_counts.node_id = target_counts.node_id
      ),
      network_stats AS (
        SELECT 
          (SELECT COUNT(DISTINCT id) FROM mnemosyne_knowledge_nodes WHERE status != 'DELETED') as total_nodes,
          (SELECT COUNT(*) FROM mnemosyne_relationships) as total_edges,
          AVG(nd.total_degree) as avg_degree,
          MAX(nd.total_degree) as max_degree,
          percentile_cont(0.5) WITHIN GROUP (ORDER BY nd.total_degree) as median_degree
        FROM node_degrees nd
      ),
      weight_stats AS (
        SELECT 
          MIN(weight) as min_weight,
          MAX(weight) as max_weight,
          AVG(weight) as avg_weight,
          percentile_cont(0.5) WITHIN GROUP (ORDER BY weight) as median_weight
        FROM mnemosyne_relationships
      ),
      relationship_distribution AS (
        SELECT relationship_type, COUNT(*) as count
        FROM mnemosyne_relationships
        GROUP BY relationship_type
      ),
      most_connected AS (
        SELECT nd.node_id, nd.total_degree, kn.title
        FROM node_degrees nd
        LEFT JOIN mnemosyne_knowledge_nodes kn ON nd.node_id = kn.id
        ORDER BY nd.total_degree DESC
        LIMIT 10
      )
      SELECT 
        ns.total_nodes,
        ns.total_edges,
        ns.avg_degree,
        ns.max_degree,
        ws.min_weight,
        ws.max_weight,
        ws.avg_weight,
        ws.median_weight,
        jsonb_agg(DISTINCT jsonb_build_object('node_id', mc.node_id, 'degree', mc.total_degree, 'title', mc.title)) as most_connected,
        jsonb_object_agg(rd.relationship_type, rd.count) as relationship_distribution
      FROM network_stats ns
      CROSS JOIN weight_stats ws
      CROSS JOIN relationship_distribution rd
      CROSS JOIN most_connected mc
      GROUP BY ns.total_nodes, ns.total_edges, ns.avg_degree, ns.max_degree, 
               ws.min_weight, ws.max_weight, ws.avg_weight, ws.median_weight
    `;

    const result = await this.db.query(query);
    
    if (result.rows.length === 0) {
      return {
        total_nodes: 0,
        total_edges: 0,
        density: 0,
        average_degree: 0,
        max_degree: 0,
        components: 0,
        clustering_coefficient: 0,
        most_connected: [],
        relationship_type_distribution: {},
        weight_statistics: { min: 0, max: 0, average: 0, median: 0 }
      };
    }

    const row = result.rows[0];
    const totalNodes = parseInt(row.total_nodes);
    const totalEdges = parseInt(row.total_edges);
    const maxPossibleEdges = totalNodes * (totalNodes - 1) / 2;
    const density = maxPossibleEdges > 0 ? totalEdges / maxPossibleEdges : 0;

    return {
      total_nodes: totalNodes,
      total_edges: totalEdges,
      density,
      average_degree: parseFloat(row.avg_degree) || 0,
      max_degree: parseInt(row.max_degree) || 0,
      components: 1, // Simplified - would need more complex query for actual component count
      clustering_coefficient: density, // Simplified approximation
      most_connected: row.most_connected || [],
      relationship_type_distribution: row.relationship_distribution || {},
      weight_statistics: {
        min: parseFloat(row.min_weight) || 0,
        max: parseFloat(row.max_weight) || 0,
        average: parseFloat(row.avg_weight) || 0,
        median: parseFloat(row.median_weight) || 0
      }
    };
  }

  async suggestRelationships(nodeId: string, limit: number = 5): Promise<Array<{
    target_id: string;
    relationship_type: string;
    confidence: number;
    reason: string;
  }>> {
    // Find nodes that share similar characteristics with the given node
    const query = `
      WITH current_node AS (
        SELECT tags, node_type, created_by
        FROM mnemosyne_knowledge_nodes
        WHERE id = $1 AND status != 'DELETED'
      ),
      existing_connections AS (
        SELECT DISTINCT 
          CASE WHEN source_id = $1 THEN target_id ELSE source_id END as connected_id
        FROM mnemosyne_relationships
        WHERE source_id = $1 OR target_id = $1
      ),
      similar_nodes AS (
        SELECT 
          kn.id,
          kn.title,
          kn.node_type,
          -- Calculate similarity score based on shared tags
          (
            CASE 
              WHEN cn.tags IS NOT NULL AND kn.tags IS NOT NULL 
              THEN array_length(cn.tags & kn.tags, 1)::float / 
                   GREATEST(array_length(cn.tags, 1), array_length(kn.tags, 1))
              ELSE 0
            END
          ) as tag_similarity,
          -- Bonus for same type
          CASE WHEN cn.node_type = kn.node_type THEN 0.2 ELSE 0 END as type_bonus,
          -- Bonus for same author
          CASE WHEN cn.created_by = kn.created_by THEN 0.1 ELSE 0 END as author_bonus
        FROM mnemosyne_knowledge_nodes kn
        CROSS JOIN current_node cn
        WHERE kn.id != $1 
          AND kn.status != 'DELETED'
          AND kn.id NOT IN (SELECT connected_id FROM existing_connections)
          AND (
            cn.tags && kn.tags  -- Share at least one tag
            OR cn.node_type = kn.node_type  -- Same type
            OR cn.created_by = kn.created_by  -- Same author
          )
      )
      SELECT 
        id as target_id,
        title,
        CASE 
          WHEN node_type = (SELECT node_type FROM current_node) THEN 'SIMILAR_TO'
          WHEN tag_similarity > 0.5 THEN 'RELATED'
          ELSE 'REFERENCES'
        END as relationship_type,
        LEAST(tag_similarity + type_bonus + author_bonus, 1.0) as confidence,
        CASE 
          WHEN tag_similarity > 0.5 THEN 'Shares many common tags'
          WHEN type_bonus > 0 THEN 'Same node type'
          WHEN author_bonus > 0 THEN 'Same author'
          ELSE 'Related content'
        END as reason
      FROM similar_nodes
      WHERE tag_similarity + type_bonus + author_bonus > 0.1
      ORDER BY confidence DESC
      LIMIT $2
    `;

    const result = await this.db.query(query, [nodeId, limit]);
    return result.rows;
  }

  private calculateNodeSize(nodeId: string, allRows: any[]): number {
    // Count connections for this node
    const connections = allRows.filter(row => 
      row.source_id === nodeId || row.target_id === nodeId
    ).length;
    
    // Scale size based on connections (min 10, max 30)
    return Math.max(10, Math.min(30, 10 + connections * 2));
  }

  private getNextParamIndex(): number {
    // This is a placeholder - in real usage, you'd track parameter indices properly
    return 5; // Adjust based on your parameter counting logic
  }
}