import { Repository, DataSource, In } from 'typeorm';
import { Connection } from '../database/entities/Connection.entity';
import { BaseRepository } from '../database/base/BaseRepository';

export class ConnectionRepository extends BaseRepository<Connection> {
  constructor(dataSource: DataSource) {
    super(Connection, dataSource);
  }

  async findByNodeId(nodeId: string): Promise<Connection[]> {
    return this.find({
      where: [
        { sourceId: nodeId },
        { targetId: nodeId }
      ],
      relations: ['source', 'target']
    });
  }

  async findByNodeIds(nodeIds: string[]): Promise<Connection[]> {
    if (nodeIds.length === 0) {
      return [];
    }

    return this.createQueryBuilder('connection')
      .where('connection.sourceId IN (:...nodeIds)', { nodeIds })
      .orWhere('connection.targetId IN (:...nodeIds)', { nodeIds })
      .getMany();
  }

  async findBetweenNodes(node1Id: string, node2Id: string): Promise<Connection | null> {
    return this.findOne({
      where: [
        { sourceId: node1Id, targetId: node2Id },
        { sourceId: node2Id, targetId: node1Id }
      ]
    });
  }

  async createConnection(data: Partial<Connection>): Promise<Connection> {
    // Check if connection already exists
    const existing = await this.findBetweenNodes(data.sourceId!, data.targetId!);
    if (existing) {
      throw new Error('Connection already exists between these nodes');
    }

    // Ensure no self-connections
    if (data.sourceId === data.targetId) {
      throw new Error('Cannot create connection to self');
    }

    return this.save(data);
  }
}