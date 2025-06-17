import { Repository, DataSource, IsNull, ILike, In, FindOptionsWhere } from 'typeorm';
import { Node, NodeType } from '../database/entities/Node.entity';
import { BaseRepository } from '../database/base/BaseRepository';

export class NodeRepository extends BaseRepository<Node> {
  constructor(dataSource: DataSource) {
    super(Node, dataSource);
  }

  async findByIdWithStats(id: string): Promise<Node | null> {
    const queryBuilder = this.createQueryBuilder('node')
      .leftJoinAndSelect('node.parent', 'parent')
      .where('node.id = :id', { id })
      .andWhere('node.deletedAt IS NULL');

    // Add children count
    queryBuilder.loadRelationCountAndMap('node.childrenCount', 'node.children', 'children',
      qb => qb.where('children.deletedAt IS NULL')
    );

    // Add connection count
    queryBuilder.loadRelationCountAndMap('node.connectionCount', 'node.connections', 'connections');

    return queryBuilder.getOne();
  }

  async findRootNodes(): Promise<Node[]> {
    return this.find({
      where: {
        parentId: IsNull(),
        deletedAt: IsNull()
      },
      order: {
        title: 'ASC'
      }
    });
  }

  async findByParent(parentId: string): Promise<Node[]> {
    return this.find({
      where: {
        parentId,
        deletedAt: IsNull()
      },
      order: {
        type: 'ASC',
        title: 'ASC'
      }
    });
  }

  async findRecentlyUpdated(limit: number = 10): Promise<Node[]> {
    return this.find({
      where: {
        deletedAt: IsNull()
      },
      order: {
        updatedAt: 'DESC'
      },
      take: limit
    });
  }

  async searchNodes(query: string, options?: {
    tags?: string[];
    type?: NodeType;
    limit?: number;
    offset?: number;
  }): Promise<{ nodes: Node[]; total: number }> {
    const qb = this.createQueryBuilder('node')
      .where('node.deletedAt IS NULL');

    // Full-text search on title and content
    if (query) {
      qb.andWhere(
        `to_tsvector('english', node.title || ' ' || COALESCE(node.content, '')) 
         @@ plainto_tsquery('english', :query)`,
        { query }
      );
    }

    // Filter by tags
    if (options?.tags && options.tags.length > 0) {
      qb.andWhere(`node.metadata->>'tags' ?| :tags`, { tags: options.tags });
    }

    // Filter by type
    if (options?.type) {
      qb.andWhere('node.type = :type', { type: options.type });
    }

    // Add relevance score for ordering
    if (query) {
      qb.addSelect(
        `ts_rank(to_tsvector('english', node.title || ' ' || COALESCE(node.content, '')), 
         plainto_tsquery('english', :query))`,
        'relevance'
      );
      qb.orderBy('relevance', 'DESC');
    }

    // Get total count
    const total = await qb.getCount();

    // Apply pagination
    if (options?.limit) {
      qb.limit(options.limit);
    }
    if (options?.offset) {
      qb.offset(options.offset);
    }

    const nodes = await qb.getMany();

    return { nodes, total };
  }

  async getNodePath(nodeId: string): Promise<Node[]> {
    // Recursive CTE to get all ancestors
    const result = await this.query(`
      WITH RECURSIVE node_path AS (
        SELECT * FROM mnemosyne.nodes WHERE id = $1
        UNION ALL
        SELECT n.* FROM mnemosyne.nodes n
        INNER JOIN node_path np ON n.id = np.parent_id
      )
      SELECT * FROM node_path ORDER BY created_at;
    `, [nodeId]);

    return result;
  }

  async getNodeTree(nodeId?: string, maxDepth: number = 3): Promise<any> {
    const query = nodeId ? 
      `parent_id = $1 AND deleted_at IS NULL` : 
      `parent_id IS NULL AND deleted_at IS NULL`;
    
    const params = nodeId ? [nodeId] : [];

    const result = await this.query(`
      WITH RECURSIVE node_tree AS (
        SELECT *, 0 as depth FROM mnemosyne.nodes 
        WHERE ${query}
        UNION ALL
        SELECT n.*, nt.depth + 1 FROM mnemosyne.nodes n
        INNER JOIN node_tree nt ON n.parent_id = nt.id
        WHERE n.deleted_at IS NULL AND nt.depth < $${params.length + 1}
      )
      SELECT * FROM node_tree ORDER BY depth, type, title;
    `, [...params, maxDepth]);

    return this.buildTree(result);
  }

  private buildTree(flatNodes: Node[]): Node[] {
    const nodeMap = new Map<string, Node & { children: Node[] }>();
    const rootNodes: (Node & { children: Node[] })[] = [];

    // First pass: create all nodes
    flatNodes.forEach(node => {
      nodeMap.set(node.id, { ...node, children: [] });
    });

    // Second pass: build tree
    flatNodes.forEach(node => {
      const currentNode = nodeMap.get(node.id)!;
      if (node.parentId && nodeMap.has(node.parentId)) {
        const parent = nodeMap.get(node.parentId)!;
        parent.children.push(currentNode);
      } else if (!node.parentId) {
        rootNodes.push(currentNode);
      }
    });

    return rootNodes;
  }

  async getDashboardStats(): Promise<{
    totalNodes: number;
    totalTags: number;
    totalConnections: number;
    recentlyUpdated: number;
    storageUsed: number;
  }> {
    const stats = await this.query(`
      SELECT 
        (SELECT COUNT(*) FROM mnemosyne.nodes WHERE deleted_at IS NULL) as total_nodes,
        (SELECT COUNT(DISTINCT tag) FROM mnemosyne.nodes, jsonb_array_elements_text(metadata->'tags') as tag WHERE deleted_at IS NULL) as total_tags,
        (SELECT COUNT(*) FROM mnemosyne.connections) as total_connections,
        (SELECT COUNT(*) FROM mnemosyne.nodes WHERE deleted_at IS NULL AND updated_at > NOW() - INTERVAL '7 days') as recently_updated,
        (SELECT pg_database_size(current_database())) as storage_used
    `);

    return {
      totalNodes: parseInt(stats[0].total_nodes),
      totalTags: parseInt(stats[0].total_tags),
      totalConnections: parseInt(stats[0].total_connections),
      recentlyUpdated: parseInt(stats[0].recently_updated),
      storageUsed: parseInt(stats[0].storage_used)
    };
  }

  async softDelete(id: string): Promise<void> {
    await this.update(id, { deletedAt: new Date() });
  }

  async getTags(): Promise<Array<{ name: string; count: number }>> {
    const result = await this.query(`
      SELECT tag as name, COUNT(*) as count
      FROM mnemosyne.nodes, jsonb_array_elements_text(metadata->'tags') as tag
      WHERE deleted_at IS NULL
      GROUP BY tag
      ORDER BY count DESC, tag ASC
    `);

    return result.map(row => ({
      name: row.name,
      count: parseInt(row.count)
    }));
  }
}