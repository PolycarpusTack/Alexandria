import { BaseRepository, DatabaseConnection, PaginationOptions, SortOptions } from './BaseRepository';

export interface KnowledgeNode {
  id: string;
  title: string;
  slug: string;
  content?: string;
  content_type: string;
  node_type: 'DOCUMENT' | 'CONCEPT' | 'PERSON' | 'PROJECT' | 'TASK' | 'NOTE' | 'REFERENCE' | 'TEMPLATE';
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' | 'DELETED';
  visibility: 'PUBLIC' | 'PRIVATE' | 'RESTRICTED';
  
  // Metadata
  description?: string;
  keywords?: string[];
  tags: string[];
  language: string;
  
  // Hierarchy
  parent_id?: string;
  position: number;
  template_id?: string;
  
  // Content metadata
  content_hash?: string;
  content_size: number;
  word_count: number;
  
  // User tracking
  created_by?: string;
  updated_by?: string;
  owned_by?: string;
  
  // Statistics
  view_count: number;
  edit_count: number;
  share_count: number;
  rating: number;
  
  // Timestamps
  created_at: Date;
  updated_at: Date;
  published_at?: Date;
  last_viewed_at?: Date;
  last_edited_at?: Date;
  
  // Version control
  version: number;
  
  // Source tracking
  source_url?: string;
  source_type?: string;
  import_metadata: Record<string, any>;
  
  // Additional metadata
  metadata: Record<string, any>;
}

export interface CreateKnowledgeNodeInput {
  title: string;
  content?: string;
  content_type?: string;
  node_type: KnowledgeNode['node_type'];
  status?: KnowledgeNode['status'];
  visibility?: KnowledgeNode['visibility'];
  description?: string;
  keywords?: string[];
  tags?: string[];
  language?: string;
  parent_id?: string;
  position?: number;
  template_id?: string;
  created_by?: string;
  owned_by?: string;
  source_url?: string;
  source_type?: string;
  import_metadata?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface UpdateKnowledgeNodeInput {
  title?: string;
  content?: string;
  content_type?: string;
  node_type?: KnowledgeNode['node_type'];
  status?: KnowledgeNode['status'];
  visibility?: KnowledgeNode['visibility'];
  description?: string;
  keywords?: string[];
  tags?: string[];
  language?: string;
  parent_id?: string;
  position?: number;
  template_id?: string;
  updated_by?: string;
  source_url?: string;
  source_type?: string;
  import_metadata?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface SearchKnowledgeNodesFilters {
  query?: string;
  node_type?: KnowledgeNode['node_type'];
  status?: KnowledgeNode['status'];
  visibility?: KnowledgeNode['visibility'];
  tags?: string[];
  created_by?: string;
  owned_by?: string;
  parent_id?: string;
  template_id?: string;
  created_after?: Date;
  created_before?: Date;
  updated_after?: Date;
  updated_before?: Date;
  min_rating?: number;
  has_content?: boolean;
}

export interface SearchResult {
  nodes: KnowledgeNode[];
  total: number;
  facets: {
    node_types: Record<string, number>;
    statuses: Record<string, number>;
    tags: Record<string, number>;
    authors: Record<string, number>;
  };
}

export interface NodeStatistics {
  total_nodes: number;
  nodes_by_type: Record<string, number>;
  recent_activity: number;
  top_tags: Array<{ tag: string; count: number }>;
  top_authors: Array<{ author: string; count: number }>;
  growth_stats: {
    daily: number;
    weekly: number;
    monthly: number;
  };
}

export class KnowledgeNodeRepository extends BaseRepository<KnowledgeNode> {
  constructor(db: DatabaseConnection) {
    super('mnemosyne_knowledge_nodes', db);
  }

  protected mapRowToEntity(row: any): KnowledgeNode {
    return {
      id: row.id,
      title: row.title,
      slug: row.slug,
      content: row.content,
      content_type: row.content_type || 'markdown',
      node_type: row.node_type,
      status: row.status || 'DRAFT',
      visibility: row.visibility || 'PRIVATE',
      
      description: row.description,
      keywords: row.keywords || [],
      tags: row.tags || [],
      language: row.language || 'en',
      
      parent_id: row.parent_id,
      position: row.position || 0,
      template_id: row.template_id,
      
      content_hash: row.content_hash,
      content_size: row.content_size || 0,
      word_count: row.word_count || 0,
      
      created_by: row.created_by,
      updated_by: row.updated_by,
      owned_by: row.owned_by,
      
      view_count: row.view_count || 0,
      edit_count: row.edit_count || 0,
      share_count: row.share_count || 0,
      rating: parseFloat(row.rating) || 0.0,
      
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
      published_at: row.published_at ? new Date(row.published_at) : undefined,
      last_viewed_at: row.last_viewed_at ? new Date(row.last_viewed_at) : undefined,
      last_edited_at: row.last_edited_at ? new Date(row.last_edited_at) : undefined,
      
      version: row.version || 1,
      
      source_url: row.source_url,
      source_type: row.source_type,
      import_metadata: row.import_metadata || {},
      
      metadata: row.metadata || {}
    };
  }

  async create(data: CreateKnowledgeNodeInput): Promise<KnowledgeNode> {
    // Generate slug if not provided
    const slug = await this.generateUniqueSlug(data.title);
    
    // Calculate content metadata
    const content = data.content || '';
    const word_count = this.calculateWordCount(content);
    const content_size = Buffer.byteLength(content, 'utf8');
    const content_hash = this.calculateContentHash(content);

    const nodeData = {
      ...data,
      slug,
      content_type: data.content_type || 'markdown',
      status: data.status || 'DRAFT',
      visibility: data.visibility || 'PRIVATE',
      tags: data.tags || [],
      language: data.language || 'en',
      position: data.position || 0,
      content_size,
      word_count,
      content_hash,
      view_count: 0,
      edit_count: 0,
      share_count: 0,
      rating: 0.0,
      version: 1,
      import_metadata: data.import_metadata || {},
      metadata: data.metadata || {}
    };

    return super.create(nodeData);
  }

  async update(id: string, data: UpdateKnowledgeNodeInput): Promise<KnowledgeNode | null> {
    const updateData: any = { ...data };

    // Update slug if title changed
    if (data.title) {
      updateData.slug = await this.generateUniqueSlug(data.title, id);
    }

    // Update content metadata if content changed
    if (data.content !== undefined) {
      updateData.word_count = this.calculateWordCount(data.content);
      updateData.content_size = Buffer.byteLength(data.content, 'utf8');
      updateData.content_hash = this.calculateContentHash(data.content);
      updateData.last_edited_at = new Date();
      
      // Increment edit count
      await this.db.query(
        `UPDATE ${this.tableName} SET edit_count = edit_count + 1 WHERE id = $1`,
        [id]
      );
    }

    return super.update(id, updateData);
  }

  async findBySlug(slug: string): Promise<KnowledgeNode | null> {
    return this.findOneWhere('slug = $1', [slug]);
  }

  async incrementViewCount(id: string): Promise<void> {
    await this.db.query(`
      UPDATE ${this.tableName} 
      SET view_count = view_count + 1, last_viewed_at = CURRENT_TIMESTAMP 
      WHERE id = $1
    `, [id]);
  }

  async search(
    filters: SearchKnowledgeNodesFilters,
    options: PaginationOptions & SortOptions = {}
  ): Promise<SearchResult> {
    const { limit = 20, offset = 0, sortBy = 'updated_at', sortOrder = 'DESC' } = options;
    
    let whereConditions: string[] = ["status != 'DELETED'"];
    let params: any[] = [];
    let paramIndex = 1;

    // Full-text search
    if (filters.query) {
      whereConditions.push(`search_vector @@ plainto_tsquery('english', $${paramIndex})`);
      params.push(filters.query);
      paramIndex++;
    }

    // Filter by node type
    if (filters.node_type) {
      whereConditions.push(`node_type = $${paramIndex}`);
      params.push(filters.node_type);
      paramIndex++;
    }

    // Filter by status
    if (filters.status) {
      whereConditions.push(`status = $${paramIndex}`);
      params.push(filters.status);
      paramIndex++;
    }

    // Filter by visibility
    if (filters.visibility) {
      whereConditions.push(`visibility = $${paramIndex}`);
      params.push(filters.visibility);
      paramIndex++;
    }

    // Filter by tags
    if (filters.tags && filters.tags.length > 0) {
      whereConditions.push(`tags && $${paramIndex}`);
      params.push(filters.tags);
      paramIndex++;
    }

    // Filter by creator
    if (filters.created_by) {
      whereConditions.push(`created_by = $${paramIndex}`);
      params.push(filters.created_by);
      paramIndex++;
    }

    // Filter by owner
    if (filters.owned_by) {
      whereConditions.push(`owned_by = $${paramIndex}`);
      params.push(filters.owned_by);
      paramIndex++;
    }

    // Filter by parent
    if (filters.parent_id) {
      whereConditions.push(`parent_id = $${paramIndex}`);
      params.push(filters.parent_id);
      paramIndex++;
    }

    // Filter by template
    if (filters.template_id) {
      whereConditions.push(`template_id = $${paramIndex}`);
      params.push(filters.template_id);
      paramIndex++;
    }

    // Date range filters
    if (filters.created_after) {
      whereConditions.push(`created_at >= $${paramIndex}`);
      params.push(filters.created_after);
      paramIndex++;
    }

    if (filters.created_before) {
      whereConditions.push(`created_at <= $${paramIndex}`);
      params.push(filters.created_before);
      paramIndex++;
    }

    if (filters.updated_after) {
      whereConditions.push(`updated_at >= $${paramIndex}`);
      params.push(filters.updated_after);
      paramIndex++;
    }

    if (filters.updated_before) {
      whereConditions.push(`updated_at <= $${paramIndex}`);
      params.push(filters.updated_before);
      paramIndex++;
    }

    // Rating filter
    if (filters.min_rating !== undefined) {
      whereConditions.push(`rating >= $${paramIndex}`);
      params.push(filters.min_rating);
      paramIndex++;
    }

    // Content filter
    if (filters.has_content !== undefined) {
      if (filters.has_content) {
        whereConditions.push(`content IS NOT NULL AND content != ''`);
      } else {
        whereConditions.push(`(content IS NULL OR content = '')`);
      }
    }

    const whereClause = whereConditions.join(' AND ');

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM ${this.tableName} WHERE ${whereClause}`;
    const countResult = await this.db.query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);

    // Get nodes with ranking for full-text search
    let orderClause = `ORDER BY ${sortBy} ${sortOrder}`;
    if (filters.query) {
      orderClause = `ORDER BY ts_rank(search_vector, plainto_tsquery('english', $1)) DESC, ${sortBy} ${sortOrder}`;
    }

    const nodesQuery = `
      SELECT * FROM ${this.tableName} 
      WHERE ${whereClause}
      ${orderClause}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const nodesResult = await this.db.query(nodesQuery, [...params, limit, offset]);
    const nodes = nodesResult.rows.map(row => this.mapRowToEntity(row));

    // Get facets
    const facets = await this.getFacets(whereClause, params);

    return {
      nodes,
      total,
      facets
    };
  }

  async getStatistics(): Promise<NodeStatistics> {
    const query = 'SELECT * FROM mnemosyne_get_node_statistics()';
    const result = await this.db.query(query);
    
    if (result.rows.length === 0) {
      return {
        total_nodes: 0,
        nodes_by_type: {},
        recent_activity: 0,
        top_tags: [],
        top_authors: [],
        growth_stats: { daily: 0, weekly: 0, monthly: 0 }
      };
    }

    const row = result.rows[0];
    return {
      total_nodes: parseInt(row.total_nodes),
      nodes_by_type: row.nodes_by_type || {},
      recent_activity: parseInt(row.recent_activity),
      top_tags: row.top_tags || [],
      top_authors: row.top_authors || [],
      growth_stats: row.growth_stats || { daily: 0, weekly: 0, monthly: 0 }
    };
  }

  async getChildNodes(parentId: string): Promise<KnowledgeNode[]> {
    return this.findWhere('parent_id = $1 AND status != $2', [parentId, 'DELETED'], {
      sortBy: 'position',
      sortOrder: 'ASC'
    });
  }

  async getNodesByTemplate(templateId: string): Promise<KnowledgeNode[]> {
    return this.findWhere('template_id = $1 AND status != $2', [templateId, 'DELETED']);
  }

  async getRecentNodes(userId?: string, limit: number = 10): Promise<KnowledgeNode[]> {
    const whereClause = userId 
      ? "status != 'DELETED' AND (created_by = $1 OR owned_by = $1)"
      : "status != 'DELETED'";
    const params = userId ? [userId] : [];

    return this.findWhere(whereClause, params, {
      limit,
      sortBy: 'updated_at',
      sortOrder: 'DESC'
    });
  }

  async getPopularNodes(limit: number = 10): Promise<KnowledgeNode[]> {
    return this.findWhere("status = 'PUBLISHED'", [], {
      limit,
      sortBy: 'view_count',
      sortOrder: 'DESC'
    });
  }

  private async generateUniqueSlug(title: string, excludeId?: string): Promise<string> {
    const query = 'SELECT mnemosyne_generate_slug($1, $2) as slug';
    const result = await this.db.query(query, [title, excludeId || null]);
    return result.rows[0].slug;
  }

  private calculateWordCount(content: string): number {
    if (!content) return 0;
    return content.trim().split(/\s+/).length;
  }

  private calculateContentHash(content: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(content || '').digest('hex');
  }

  private async getFacets(whereClause: string, params: any[]) {
    const facetQueries = [
      {
        name: 'node_types',
        query: `SELECT node_type, COUNT(*) as count FROM ${this.tableName} WHERE ${whereClause} GROUP BY node_type`
      },
      {
        name: 'statuses',
        query: `SELECT status, COUNT(*) as count FROM ${this.tableName} WHERE ${whereClause} GROUP BY status`
      },
      {
        name: 'tags',
        query: `SELECT unnest(tags) as tag, COUNT(*) as count FROM ${this.tableName} WHERE ${whereClause} AND tags IS NOT NULL GROUP BY tag ORDER BY count DESC LIMIT 20`
      },
      {
        name: 'authors',
        query: `SELECT u.username as author, COUNT(*) as count FROM ${this.tableName} kn LEFT JOIN users u ON kn.created_by = u.id WHERE ${whereClause} AND u.username IS NOT NULL GROUP BY u.username ORDER BY count DESC LIMIT 10`
      }
    ];

    const facets: any = {};

    for (const facetQuery of facetQueries) {
      try {
        const result = await this.db.query(facetQuery.query, params);
        facets[facetQuery.name] = result.rows.reduce((acc, row) => {
          const key = facetQuery.name === 'tags' ? row.tag : 
                     facetQuery.name === 'authors' ? row.author : 
                     row[Object.keys(row)[0]];
          acc[key] = parseInt(row.count);
          return acc;
        }, {});
      } catch (error) {
        console.error(`Error generating facet ${facetQuery.name}:`, error);
        facets[facetQuery.name] = {};
      }
    }

    return facets;
  }
}