import { EventEmitter } from 'events';

export interface KnowledgeNode {
  id: string;
  title: string;
  content: string;
  type: 'DOCUMENT' | 'CONCEPT' | 'PERSON' | 'PROJECT' | 'TASK' | 'NOTE' | 'REFERENCE';
  slug: string;
  tags: string[];
  metadata: {
    author: string;
    created: Date;
    updated: Date;
    version: number;
    size: number;
    status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
    visibility: 'PUBLIC' | 'PRIVATE' | 'RESTRICTED';
    views: number;
    rating: number;
    description?: string;
    keywords?: string[];
    language?: string;
    parent?: string;
    position?: number;
    template?: string;
    source?: string;
    hash?: string;
  };
  connections: string[];
  statistics?: {
    viewCount: number;
    editCount: number;
    shareCount: number;
    lastViewed?: Date;
    lastEdited?: Date;
  };
}

export interface CreateNodeInput {
  title: string;
  content: string;
  type: KnowledgeNode['type'];
  tags?: string[];
  metadata?: Partial<KnowledgeNode['metadata']>;
  connections?: string[];
}

export interface UpdateNodeInput {
  title?: string;
  content?: string;
  type?: KnowledgeNode['type'];
  tags?: string[];
  metadata?: Partial<KnowledgeNode['metadata']>;
  connections?: string[];
}

export interface SearchFilters {
  query?: string;
  type?: KnowledgeNode['type'];
  tags?: string[];
  author?: string;
  status?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
  limit?: number;
  offset?: number;
  sortBy?: 'created' | 'updated' | 'title' | 'views' | 'rating';
  sortOrder?: 'asc' | 'desc';
}

export interface SearchResult {
  nodes: KnowledgeNode[];
  total: number;
  hasMore: boolean;
  facets?: {
    types: Record<string, number>;
    tags: Record<string, number>;
    authors: Record<string, number>;
  };
}

export interface NodeStatistics {
  totalNodes: number;
  nodesByType: Record<string, number>;
  recentActivity: number;
  topTags: Array<{ tag: string; count: number }>;
  topAuthors: Array<{ author: string; count: number }>;
  growthStats: {
    daily: number;
    weekly: number;
    monthly: number;
  };
}

export class KnowledgeNodeService extends EventEmitter {
  private nodes: Map<string, KnowledgeNode> = new Map();
  private slugIndex: Map<string, string> = new Map();
  private tagIndex: Map<string, Set<string>> = new Map();
  private typeIndex: Map<string, Set<string>> = new Map();

  constructor() {
    super();
    this.initializeMockData();
  }

  private initializeMockData() {
    // Add some mock data for development/testing
    const mockNodes: KnowledgeNode[] = [
      {
        id: '1',
        title: 'React Components Guide',
        content: 'A comprehensive guide to building React components with TypeScript.',
        type: 'DOCUMENT',
        slug: 'react-components-guide',
        tags: ['react', 'typescript', 'frontend'],
        metadata: {
          author: 'John Doe',
          created: new Date('2024-01-15'),
          updated: new Date('2024-01-20'),
          version: 1,
          size: 2500,
          status: 'PUBLISHED',
          visibility: 'PUBLIC',
          views: 45,
          rating: 4.8,
          description: 'Learn how to build reusable React components',
          keywords: ['react', 'components', 'typescript', 'frontend'],
          language: 'en'
        },
        connections: ['2', '3'],
        statistics: {
          viewCount: 45,
          editCount: 3,
          shareCount: 8,
          lastViewed: new Date('2024-01-25'),
          lastEdited: new Date('2024-01-20')
        }
      },
      {
        id: '2',
        title: 'TypeScript Best Practices',
        content: 'Essential TypeScript patterns and best practices for enterprise applications.',
        type: 'CONCEPT',
        slug: 'typescript-best-practices',
        tags: ['typescript', 'best-practices', 'enterprise'],
        metadata: {
          author: 'Jane Smith',
          created: new Date('2024-01-10'),
          updated: new Date('2024-01-18'),
          version: 2,
          size: 1800,
          status: 'PUBLISHED',
          visibility: 'PUBLIC',
          views: 67,
          rating: 4.9,
          description: 'Advanced TypeScript techniques',
          keywords: ['typescript', 'patterns', 'enterprise'],
          language: 'en'
        },
        connections: ['1', '4'],
        statistics: {
          viewCount: 67,
          editCount: 5,
          shareCount: 12,
          lastViewed: new Date('2024-01-26'),
          lastEdited: new Date('2024-01-18')
        }
      },
      {
        id: '3',
        title: 'API Design Template',
        content: 'Standard template for designing RESTful APIs.',
        type: 'REFERENCE',
        slug: 'api-design-template',
        tags: ['api', 'design', 'template', 'rest'],
        metadata: {
          author: 'Bob Wilson',
          created: new Date('2024-01-12'),
          updated: new Date('2024-01-22'),
          version: 1,
          size: 1200,
          status: 'PUBLISHED',
          visibility: 'PUBLIC',
          views: 23,
          rating: 4.5,
          description: 'Template for API documentation',
          keywords: ['api', 'rest', 'template'],
          language: 'en'
        },
        connections: ['1'],
        statistics: {
          viewCount: 23,
          editCount: 2,
          shareCount: 4,
          lastViewed: new Date('2024-01-24'),
          lastEdited: new Date('2024-01-22')
        }
      }
    ];

    mockNodes.forEach(node => {
      this.nodes.set(node.id, node);
      this.slugIndex.set(node.slug, node.id);
      
      // Update tag index
      node.tags.forEach(tag => {
        if (!this.tagIndex.has(tag)) {
          this.tagIndex.set(tag, new Set());
        }
        this.tagIndex.get(tag)!.add(node.id);
      });

      // Update type index
      if (!this.typeIndex.has(node.type)) {
        this.typeIndex.set(node.type, new Set());
      }
      this.typeIndex.get(node.type)!.add(node.id);
    });
  }

  async getAllNodes(): Promise<KnowledgeNode[]> {
    return Array.from(this.nodes.values())
      .sort((a, b) => b.metadata.updated.getTime() - a.metadata.updated.getTime());
  }

  async getNodeById(id: string): Promise<KnowledgeNode | null> {
    const node = this.nodes.get(id);
    if (node) {
      // Increment view count
      node.statistics = {
        ...node.statistics,
        viewCount: (node.statistics?.viewCount || 0) + 1,
        lastViewed: new Date()
      };
      node.metadata.views = node.statistics.viewCount;
      this.emit('nodeViewed', { nodeId: id, timestamp: new Date() });
    }
    return node || null;
  }

  async getNodeBySlug(slug: string): Promise<KnowledgeNode | null> {
    const id = this.slugIndex.get(slug);
    return id ? this.getNodeById(id) : null;
  }

  async createNode(input: CreateNodeInput): Promise<KnowledgeNode> {
    const id = this.generateId();
    const slug = this.generateSlug(input.title);
    const now = new Date();
    
    const node: KnowledgeNode = {
      id,
      title: input.title,
      content: input.content,
      type: input.type,
      slug,
      tags: input.tags || [],
      metadata: {
        author: 'Current User', // This would come from auth context
        created: now,
        updated: now,
        version: 1,
        size: input.content.length,
        status: 'DRAFT',
        visibility: 'PRIVATE',
        views: 0,
        rating: 0,
        ...input.metadata
      },
      connections: input.connections || [],
      statistics: {
        viewCount: 0,
        editCount: 0,
        shareCount: 0
      }
    };

    this.nodes.set(id, node);
    this.slugIndex.set(slug, id);
    
    // Update indexes
    node.tags.forEach(tag => {
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, new Set());
      }
      this.tagIndex.get(tag)!.add(id);
    });

    if (!this.typeIndex.has(node.type)) {
      this.typeIndex.set(node.type, new Set());
    }
    this.typeIndex.get(node.type)!.add(id);

    this.emit('nodeCreated', { node, timestamp: now });
    return node;
  }

  async updateNode(id: string, input: UpdateNodeInput): Promise<KnowledgeNode | null> {
    const existingNode = this.nodes.get(id);
    if (!existingNode) return null;

    const now = new Date();
    
    // Handle slug change if title changed
    if (input.title && input.title !== existingNode.title) {
      this.slugIndex.delete(existingNode.slug);
      const newSlug = this.generateSlug(input.title);
      this.slugIndex.set(newSlug, id);
      existingNode.slug = newSlug;
    }

    // Handle tag changes
    if (input.tags) {
      // Remove from old tag indexes
      existingNode.tags.forEach(tag => {
        this.tagIndex.get(tag)?.delete(id);
        if (this.tagIndex.get(tag)?.size === 0) {
          this.tagIndex.delete(tag);
        }
      });
      
      // Add to new tag indexes
      input.tags.forEach(tag => {
        if (!this.tagIndex.has(tag)) {
          this.tagIndex.set(tag, new Set());
        }
        this.tagIndex.get(tag)!.add(id);
      });
    }

    // Handle type change
    if (input.type && input.type !== existingNode.type) {
      this.typeIndex.get(existingNode.type)?.delete(id);
      if (!this.typeIndex.has(input.type)) {
        this.typeIndex.set(input.type, new Set());
      }
      this.typeIndex.get(input.type)!.add(id);
    }

    const updatedNode: KnowledgeNode = {
      ...existingNode,
      ...input,
      metadata: {
        ...existingNode.metadata,
        ...input.metadata,
        updated: now,
        version: existingNode.metadata.version + 1,
        size: input.content ? input.content.length : existingNode.metadata.size
      },
      statistics: {
        ...existingNode.statistics,
        editCount: (existingNode.statistics?.editCount || 0) + 1,
        lastEdited: now
      }
    };

    this.nodes.set(id, updatedNode);
    this.emit('nodeUpdated', { node: updatedNode, timestamp: now });
    return updatedNode;
  }

  async deleteNode(id: string): Promise<boolean> {
    const node = this.nodes.get(id);
    if (!node) return false;

    // Remove from indexes
    this.slugIndex.delete(node.slug);
    node.tags.forEach(tag => {
      this.tagIndex.get(tag)?.delete(id);
      if (this.tagIndex.get(tag)?.size === 0) {
        this.tagIndex.delete(tag);
      }
    });
    this.typeIndex.get(node.type)?.delete(id);

    this.nodes.delete(id);
    this.emit('nodeDeleted', { nodeId: id, timestamp: new Date() });
    return true;
  }

  async searchNodes(filters: SearchFilters): Promise<SearchResult> {
    let results = Array.from(this.nodes.values());

    // Apply filters
    if (filters.query) {
      const query = filters.query.toLowerCase();
      results = results.filter(node => 
        node.title.toLowerCase().includes(query) ||
        node.content.toLowerCase().includes(query) ||
        node.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    if (filters.type) {
      results = results.filter(node => node.type === filters.type);
    }

    if (filters.tags && filters.tags.length > 0) {
      results = results.filter(node => 
        filters.tags!.some(tag => node.tags.includes(tag))
      );
    }

    if (filters.author) {
      results = results.filter(node => node.metadata.author === filters.author);
    }

    if (filters.status) {
      results = results.filter(node => node.metadata.status === filters.status);
    }

    if (filters.dateRange) {
      results = results.filter(node => 
        node.metadata.updated >= filters.dateRange!.start &&
        node.metadata.updated <= filters.dateRange!.end
      );
    }

    // Apply sorting
    const sortBy = filters.sortBy || 'updated';
    const sortOrder = filters.sortOrder || 'desc';
    
    results.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'created':
          comparison = a.metadata.created.getTime() - b.metadata.created.getTime();
          break;
        case 'updated':
          comparison = a.metadata.updated.getTime() - b.metadata.updated.getTime();
          break;
        case 'views':
          comparison = a.metadata.views - b.metadata.views;
          break;
        case 'rating':
          comparison = a.metadata.rating - b.metadata.rating;
          break;
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    // Apply pagination
    const total = results.length;
    const offset = filters.offset || 0;
    const limit = filters.limit || 20;
    const paginatedResults = results.slice(offset, offset + limit);

    // Generate facets
    const facets = {
      types: this.generateFacetCounts(results, 'type'),
      tags: this.generateTagFacets(results),
      authors: this.generateFacetCounts(results, 'metadata.author')
    };

    return {
      nodes: paginatedResults,
      total,
      hasMore: offset + limit < total,
      facets
    };
  }

  async getNodeStatistics(): Promise<NodeStatistics> {
    const nodes = Array.from(this.nodes.values());
    const now = new Date();
    const oneDay = 24 * 60 * 60 * 1000;
    const oneWeek = 7 * oneDay;
    const oneMonth = 30 * oneDay;

    // Calculate growth stats
    const dailyNodes = nodes.filter(node => 
      now.getTime() - node.metadata.created.getTime() < oneDay
    ).length;
    
    const weeklyNodes = nodes.filter(node => 
      now.getTime() - node.metadata.created.getTime() < oneWeek
    ).length;
    
    const monthlyNodes = nodes.filter(node => 
      now.getTime() - node.metadata.created.getTime() < oneMonth
    ).length;

    // Calculate recent activity (views, edits in last 24h)
    const recentActivity = nodes.reduce((sum, node) => {
      const lastViewed = node.statistics?.lastViewed;
      const lastEdited = node.statistics?.lastEdited;
      let activity = 0;
      
      if (lastViewed && now.getTime() - lastViewed.getTime() < oneDay) {
        activity += node.statistics?.viewCount || 0;
      }
      if (lastEdited && now.getTime() - lastEdited.getTime() < oneDay) {
        activity += node.statistics?.editCount || 0;
      }
      
      return sum + activity;
    }, 0);

    // Generate tag counts
    const tagCounts = new Map<string, number>();
    nodes.forEach(node => {
      node.tags.forEach(tag => {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      });
    });

    const topTags = Array.from(tagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag, count]) => ({ tag, count }));

    // Generate author counts
    const authorCounts = new Map<string, number>();
    nodes.forEach(node => {
      const author = node.metadata.author;
      authorCounts.set(author, (authorCounts.get(author) || 0) + 1);
    });

    const topAuthors = Array.from(authorCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([author, count]) => ({ author, count }));

    return {
      totalNodes: nodes.length,
      nodesByType: this.generateFacetCounts(nodes, 'type'),
      recentActivity,
      topTags,
      topAuthors,
      growthStats: {
        daily: dailyNodes,
        weekly: weeklyNodes,
        monthly: monthlyNodes
      }
    };
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  private generateSlug(title: string): string {
    const baseSlug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    
    let slug = baseSlug;
    let counter = 1;
    
    while (this.slugIndex.has(slug)) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }
    
    return slug;
  }

  private generateFacetCounts(nodes: KnowledgeNode[], field: string): Record<string, number> {
    const counts: Record<string, number> = {};
    
    nodes.forEach(node => {
      const value = this.getNestedProperty(node, field);
      if (value) {
        counts[value] = (counts[value] || 0) + 1;
      }
    });
    
    return counts;
  }

  private generateTagFacets(nodes: KnowledgeNode[]): Record<string, number> {
    const counts: Record<string, number> = {};
    
    nodes.forEach(node => {
      node.tags.forEach(tag => {
        counts[tag] = (counts[tag] || 0) + 1;
      });
    });
    
    return counts;
  }

  private getNestedProperty(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }
}