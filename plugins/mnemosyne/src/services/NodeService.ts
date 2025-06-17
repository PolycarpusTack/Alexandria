import { AppDataSource } from '../database/data-source';
import { NodeRepository } from '../repositories/NodeRepository';
import { ConnectionRepository } from '../repositories/ConnectionRepository';
import { Node, NodeType } from '../database/entities/Node.entity';
import { Connection } from '../database/entities/Connection.entity';
import { ApiError } from '../utils/errors';
import { EventEmitter } from 'events';

export interface NodeFilters {
  parentId?: string;
  type?: NodeType;
  tags?: string[];
}

export interface GraphData {
  nodes: Array<{ id: string; label: string; type: string }>;
  edges: Array<{ source: string; target: string; type: string }>;
}

export interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  errors: number;
  details: Array<{
    status: 'success' | 'warning' | 'error';
    message: string;
    nodeId?: string;
  }>;
}

export interface ExportOptions {
  format: 'markdown' | 'json' | 'pdf' | 'html' | 'obsidian';
  nodeIds?: string[];
  includeAttachments: boolean;
  includeHistory: boolean;
}

export class NodeService extends EventEmitter {
  private nodeRepo: NodeRepository;
  private connectionRepo: ConnectionRepository;

  constructor() {
    super();
    this.nodeRepo = new NodeRepository(AppDataSource);
    this.connectionRepo = new ConnectionRepository(AppDataSource);
  }

  async getNodes(filters: NodeFilters): Promise<Node[]> {
    if (filters.parentId !== undefined) {
      return filters.parentId === null 
        ? this.nodeRepo.findRootNodes()
        : this.nodeRepo.findByParent(filters.parentId);
    }

    // Return all nodes with optional type filter
    const where: any = { deletedAt: null };
    if (filters.type) {
      where.type = filters.type;
    }

    return this.nodeRepo.find({ where });
  }

  async getRecentNodes(limit: number): Promise<Node[]> {
    return this.nodeRepo.findRecentlyUpdated(limit);
  }

  async getNodeById(id: string): Promise<Node | null> {
    return this.nodeRepo.findByIdWithStats(id);
  }

  async createNode(data: Partial<Node>): Promise<Node> {
    // Validate required fields
    if (!data.title || data.title.trim().length === 0) {
      throw new ApiError('Title is required', 400);
    }

    // Create node
    const node = await this.nodeRepo.save({
      title: data.title.trim(),
      content: data.content || '',
      type: data.type || NodeType.DOCUMENT,
      parentId: data.parentId,
      metadata: {
        tags: data.metadata?.tags || [],
        author: data.metadata?.author,
        version: 1,
        ...data.metadata
      }
    });

    // Emit event
    this.emit('node:created', node);

    return node;
  }

  async updateNode(id: string, updates: Partial<Node>): Promise<Node | null> {
    const node = await this.nodeRepo.findOne({ where: { id, deletedAt: null } });
    
    if (!node) {
      return null;
    }

    // Update node
    const updatedNode = await this.nodeRepo.save({
      ...node,
      ...updates,
      id, // Ensure ID doesn't change
      metadata: {
        ...node.metadata,
        ...updates.metadata,
        version: (node.metadata.version || 1) + 1
      }
    });

    // Emit event
    this.emit('node:updated', updatedNode);

    return updatedNode;
  }

  async deleteNode(id: string): Promise<void> {
    const node = await this.nodeRepo.findOne({ where: { id, deletedAt: null } });
    
    if (!node) {
      throw new ApiError('Node not found', 404);
    }

    // Soft delete
    await this.nodeRepo.softDelete(id);

    // Emit event
    this.emit('node:deleted', { id });
  }

  async moveNode(nodeId: string, newParentId: string | null): Promise<Node | null> {
    const node = await this.nodeRepo.findOne({ where: { id: nodeId, deletedAt: null } });
    
    if (!node) {
      return null;
    }

    // Check for circular reference
    if (newParentId) {
      const isCircular = await this.checkCircularReference(nodeId, newParentId);
      if (isCircular) {
        throw new ApiError('Cannot move node to its own descendant', 400);
      }
    }

    // Update parent
    node.parentId = newParentId || undefined;
    const updatedNode = await this.nodeRepo.save(node);

    // Emit event
    this.emit('node:moved', { node: updatedNode, oldParentId: node.parentId });

    return updatedNode;
  }

  async getNodePath(nodeId: string): Promise<Node[]> {
    return this.nodeRepo.getNodePath(nodeId);
  }

  async getNodeTree(nodeId?: string, maxDepth: number = 3): Promise<any> {
    return this.nodeRepo.getNodeTree(nodeId, maxDepth);
  }

  async getTags(): Promise<Array<{ name: string; count: number }>> {
    return this.nodeRepo.getTags();
  }

  async renameTag(oldName: string, newName: string): Promise<void> {
    // Get all nodes with the old tag
    const nodes = await this.nodeRepo.createQueryBuilder('node')
      .where(`node.metadata->'tags' ? :tag`, { tag: oldName })
      .andWhere('node.deletedAt IS NULL')
      .getMany();

    // Update each node
    for (const node of nodes) {
      const tags = node.metadata.tags.map(tag => 
        tag === oldName ? newName : tag
      );
      
      await this.nodeRepo.save({
        ...node,
        metadata: {
          ...node.metadata,
          tags
        }
      });
    }

    // Emit event
    this.emit('tag:renamed', { oldName, newName, affectedNodes: nodes.length });
  }

  async getGraphData(nodeId?: string, depth: number = 2): Promise<GraphData> {
    // Get nodes
    const nodes = nodeId 
      ? await this.getConnectedNodes(nodeId, depth)
      : await this.nodeRepo.find({ where: { deletedAt: null }, take: 100 });

    // Get connections for these nodes
    const nodeIds = nodes.map(n => n.id);
    const connections = await this.connectionRepo.findByNodeIds(nodeIds);

    // Format for graph visualization
    const graphNodes = nodes.map(node => ({
      id: node.id,
      label: node.title,
      type: node.type
    }));

    const graphEdges = connections.map(conn => ({
      source: conn.sourceId,
      target: conn.targetId,
      type: conn.type
    }));

    return {
      nodes: graphNodes,
      edges: graphEdges
    };
  }

  async getDashboardStats(): Promise<any> {
    return this.nodeRepo.getDashboardStats();
  }

  async importData(
    fileBuffer: Buffer,
    format: string,
    userId: string
  ): Promise<ImportResult> {
    // This is a simplified implementation
    // In production, you'd parse different formats properly
    
    const result: ImportResult = {
      success: true,
      imported: 0,
      skipped: 0,
      errors: 0,
      details: []
    };

    try {
      let data: any;
      
      if (format === 'json') {
        data = JSON.parse(fileBuffer.toString());
      } else {
        throw new ApiError('Unsupported format: ' + format, 400);
      }

      // Import nodes
      if (data.nodes && Array.isArray(data.nodes)) {
        for (const nodeData of data.nodes) {
          try {
            await this.createNode({
              ...nodeData,
              metadata: {
                ...nodeData.metadata,
                author: userId,
                importedAt: new Date().toISOString()
              }
            });
            
            result.imported++;
            result.details.push({
              status: 'success',
              message: `Imported node: ${nodeData.title}`
            });
          } catch (error: any) {
            result.errors++;
            result.details.push({
              status: 'error',
              message: `Failed to import node: ${error.message}`
            });
          }
        }
      }
    } catch (error: any) {
      result.success = false;
      result.details.push({
        status: 'error',
        message: `Import failed: ${error.message}`
      });
    }

    return result;
  }

  async exportData(options: ExportOptions): Promise<Buffer> {
    // Get nodes to export
    let nodes: Node[];
    
    if (options.nodeIds && options.nodeIds.length > 0) {
      nodes = await this.nodeRepo.findByIds(options.nodeIds);
    } else {
      nodes = await this.nodeRepo.find({ where: { deletedAt: null } });
    }

    // Format based on export type
    let exportData: any;
    
    switch (options.format) {
      case 'json':
        exportData = {
          version: '1.0',
          exportDate: new Date().toISOString(),
          nodes: nodes.map(node => ({
            id: node.id,
            title: node.title,
            content: node.content,
            type: node.type,
            parentId: node.parentId,
            metadata: node.metadata,
            createdAt: node.createdAt,
            updatedAt: node.updatedAt
          }))
        };
        return Buffer.from(JSON.stringify(exportData, null, 2));
        
      case 'markdown':
        const markdown = nodes.map(node => 
          `# ${node.title}\n\n${node.content}\n\n---\n`
        ).join('\n');
        return Buffer.from(markdown);
        
      default:
        throw new ApiError('Unsupported export format: ' + options.format, 400);
    }
  }

  private async checkCircularReference(nodeId: string, targetParentId: string): Promise<boolean> {
    // Check if targetParentId is a descendant of nodeId
    const path = await this.getNodePath(targetParentId);
    return path.some(node => node.id === nodeId);
  }

  private async getConnectedNodes(nodeId: string, depth: number): Promise<Node[]> {
    const visited = new Set<string>();
    const queue: Array<{ id: string; level: number }> = [{ id: nodeId, level: 0 }];
    const nodes: Node[] = [];

    while (queue.length > 0) {
      const { id, level } = queue.shift()!;
      
      if (visited.has(id) || level > depth) {
        continue;
      }

      visited.add(id);

      const node = await this.nodeRepo.findOne({ where: { id, deletedAt: null } });
      if (node) {
        nodes.push(node);

        // Get connected nodes
        const connections = await this.connectionRepo.findByNodeId(id);
        
        for (const conn of connections) {
          const connectedId = conn.sourceId === id ? conn.targetId : conn.sourceId;
          if (!visited.has(connectedId)) {
            queue.push({ id: connectedId, level: level + 1 });
          }
        }
      }
    }

    return nodes;
  }
}