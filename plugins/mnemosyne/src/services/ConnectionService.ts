import { ConnectionRepository } from '../repositories/ConnectionRepository';
import { NodeRepository } from '../repositories/NodeRepository';
import { AppDataSource } from '../database/data-source';
import { Connection, ConnectionType } from '../database/entities/Connection.entity';
import { ApiError } from '../utils/errors';
import { EventEmitter } from 'events';

export class ConnectionService extends EventEmitter {
  private connectionRepo: ConnectionRepository;
  private nodeRepo: NodeRepository;

  constructor() {
    super();
    this.connectionRepo = new ConnectionRepository(AppDataSource);
    this.nodeRepo = new NodeRepository(AppDataSource);
  }

  async getNodeConnections(nodeId: string): Promise<Connection[]> {
    // Verify node exists
    const node = await this.nodeRepo.findOne({ 
      where: { id: nodeId, deletedAt: null } 
    });
    
    if (!node) {
      throw new ApiError('Node not found', 404);
    }

    return this.connectionRepo.findByNodeId(nodeId);
  }

  async createConnection(data: {
    sourceId: string;
    targetId: string;
    type?: ConnectionType;
    metadata?: Record<string, any>;
  }): Promise<Connection> {
    // Validate nodes exist
    const [sourceNode, targetNode] = await Promise.all([
      this.nodeRepo.findOne({ where: { id: data.sourceId, deletedAt: null } }),
      this.nodeRepo.findOne({ where: { id: data.targetId, deletedAt: null } })
    ]);

    if (!sourceNode) {
      throw new ApiError('Source node not found', 404);
    }
    
    if (!targetNode) {
      throw new ApiError('Target node not found', 404);
    }

    // Check for existing connection
    const existing = await this.connectionRepo.findBetweenNodes(
      data.sourceId,
      data.targetId
    );
    
    if (existing) {
      throw new ApiError('Connection already exists between these nodes', 409);
    }

    // Create connection
    const connection = await this.connectionRepo.save({
      sourceId: data.sourceId,
      targetId: data.targetId,
      type: data.type || ConnectionType.RELATED,
      metadata: data.metadata || {}
    });

    // Emit event
    this.emit('connection:created', connection);

    // Return with populated relations
    return this.connectionRepo.findOne({
      where: { id: connection.id },
      relations: ['source', 'target']
    }) as Promise<Connection>;
  }

  async deleteConnection(id: string): Promise<void> {
    const connection = await this.connectionRepo.findOne({ where: { id } });
    
    if (!connection) {
      throw new ApiError('Connection not found', 404);
    }

    await this.connectionRepo.delete(id);

    // Emit event
    this.emit('connection:deleted', { id });
  }

  async updateConnectionType(
    id: string, 
    type: ConnectionType
  ): Promise<Connection | null> {
    const connection = await this.connectionRepo.findOne({ where: { id } });
    
    if (!connection) {
      return null;
    }

    connection.type = type;
    const updated = await this.connectionRepo.save(connection);

    // Emit event
    this.emit('connection:updated', updated);

    return updated;
  }

  async updateConnectionMetadata(
    id: string,
    metadata: Record<string, any>
  ): Promise<Connection | null> {
    const connection = await this.connectionRepo.findOne({ where: { id } });
    
    if (!connection) {
      return null;
    }

    connection.metadata = { ...connection.metadata, ...metadata };
    const updated = await this.connectionRepo.save(connection);

    // Emit event
    this.emit('connection:updated', updated);

    return updated;
  }

  async findConnectionsBetweenNodes(
    nodeIds: string[]
  ): Promise<Connection[]> {
    if (nodeIds.length < 2) {
      return [];
    }

    return this.connectionRepo.findByNodeIds(nodeIds);
  }

  async getConnectionStats(nodeId: string): Promise<{
    total: number;
    byType: Record<string, number>;
    incoming: number;
    outgoing: number;
  }> {
    const connections = await this.connectionRepo.findByNodeId(nodeId);
    
    const stats = {
      total: connections.length,
      byType: {} as Record<string, number>,
      incoming: 0,
      outgoing: 0
    };

    connections.forEach(conn => {
      // Count by type
      stats.byType[conn.type] = (stats.byType[conn.type] || 0) + 1;
      
      // Count direction
      if (conn.sourceId === nodeId) {
        stats.outgoing++;
      } else {
        stats.incoming++;
      }
    });

    return stats;
  }
}