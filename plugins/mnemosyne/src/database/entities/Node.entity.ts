import { 
  Entity, 
  PrimaryGeneratedColumn, 
  Column, 
  CreateDateColumn, 
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  Index,
  JoinColumn
} from 'typeorm';

export enum NodeType {
  DOCUMENT = 'document',
  NOTE = 'note',
  FOLDER = 'folder'
}

@Entity('nodes', { schema: 'mnemosyne' })
@Index(['parentId', 'deletedAt'])
@Index(['type', 'deletedAt'])
@Index(['createdAt', 'deletedAt'])
@Index(['updatedAt', 'deletedAt'])
export class Node {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 500 })
  @Index()
  title: string;

  @Column({ type: 'text', default: '' })
  content: string;

  @Column({
    type: 'enum',
    enum: NodeType,
    default: NodeType.DOCUMENT
  })
  type: NodeType;

  @Column({ type: 'uuid', nullable: true })
  parentId?: string;

  @ManyToOne(() => Node, node => node.children, { nullable: true })
  @JoinColumn({ name: 'parent_id' })
  parent?: Node;

  @OneToMany(() => Node, node => node.parent)
  children?: Node[];

  @Column({ 
    type: 'jsonb', 
    default: { tags: [], author: null, version: 1 } 
  })
  metadata: {
    tags: string[];
    author?: string;
    version: number;
    [key: string]: any;
  };

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ type: 'timestamptz', nullable: true, name: 'deleted_at' })
  deletedAt?: Date;

  // Virtual properties (populated by queries)
  childrenCount?: number;
  connectionCount?: number;
}

export interface NodeWithStats extends Node {
  childrenCount: number;
  connectionCount: number;
}