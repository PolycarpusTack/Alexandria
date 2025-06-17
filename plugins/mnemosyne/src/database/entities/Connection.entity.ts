import { 
  Entity, 
  PrimaryGeneratedColumn, 
  Column, 
  CreateDateColumn,
  ManyToOne,
  Index,
  Unique,
  JoinColumn
} from 'typeorm';
import { Node } from './Node.entity';

export enum ConnectionType {
  REFERENCE = 'reference',
  RELATED = 'related',
  PARENT_CHILD = 'parent-child'
}

@Entity('connections', { schema: 'mnemosyne' })
@Unique(['sourceId', 'targetId', 'type'])
@Index(['sourceId'])
@Index(['targetId'])
export class Connection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'source_id' })
  sourceId: string;

  @ManyToOne(() => Node, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'source_id' })
  source: Node;

  @Column({ type: 'uuid', name: 'target_id' })
  targetId: string;

  @ManyToOne(() => Node, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'target_id' })
  target: Node;

  @Column({
    type: 'enum',
    enum: ConnectionType,
    default: ConnectionType.RELATED
  })
  type: ConnectionType;

  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}