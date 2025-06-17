import { NodeRepository } from '../repositories/NodeRepository';
import { AppDataSource } from '../database/data-source';
import { NodeType } from '../database/entities/Node.entity';

export interface SearchQuery {
  query: string;
  tags?: string[];
  type?: NodeType;
  limit?: number;
  offset?: number;
}

export interface SearchResult {
  nodes: Array<{
    node: any;
    relevance: number;
    highlights: string[];
  }>;
  total: number;
  facets: {
    tags: Record<string, number>;
    types: Record<string, number>;
  };
}

export class SearchService {
  private nodeRepo: NodeRepository;

  constructor() {
    this.nodeRepo = new NodeRepository(AppDataSource);
  }

  async search(searchQuery: SearchQuery): Promise<SearchResult> {
    const { nodes, total } = await this.nodeRepo.searchNodes(
      searchQuery.query,
      {
        tags: searchQuery.tags,
        type: searchQuery.type,
        limit: searchQuery.limit,
        offset: searchQuery.offset
      }
    );

    // Get facets (tag and type counts)
    const facets = await this.getFacets(searchQuery.query);

    // Format results with highlights
    const results = nodes.map(node => ({
      node,
      relevance: 1.0, // TODO: Calculate actual relevance from search
      highlights: this.extractHighlights(node.content, searchQuery.query)
    }));

    return {
      nodes: results,
      total,
      facets
    };
  }

  async getSuggestions(query: string): Promise<string[]> {
    // Get recent search terms and popular tags
    const tags = await this.nodeRepo.getTags();
    
    // Filter tags that match the query
    const suggestions = tags
      .filter(tag => tag.name.toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map(tag => tag.name);

    // Add some common search terms
    const commonTerms = ['project', 'meeting', 'notes', 'documentation', 'api'];
    const matchingTerms = commonTerms
      .filter(term => term.toLowerCase().includes(query.toLowerCase()));

    return [...new Set([...suggestions, ...matchingTerms])].slice(0, 10);
  }

  private async getFacets(query: string): Promise<{
    tags: Record<string, number>;
    types: Record<string, number>;
  }> {
    // Get all tags with counts
    const tags = await this.nodeRepo.getTags();
    const tagFacets: Record<string, number> = {};
    tags.slice(0, 10).forEach(tag => {
      tagFacets[tag.name] = tag.count;
    });

    // Get type counts
    const typeCounts = await this.nodeRepo.query(`
      SELECT type, COUNT(*) as count
      FROM mnemosyne.nodes
      WHERE deleted_at IS NULL
      GROUP BY type
    `);

    const typeFacets: Record<string, number> = {};
    typeCounts.forEach((row: any) => {
      typeFacets[row.type] = parseInt(row.count);
    });

    return {
      tags: tagFacets,
      types: typeFacets
    };
  }

  private extractHighlights(content: string, query: string): string[] {
    if (!content || !query) return [];

    const words = query.toLowerCase().split(/\s+/);
    const lines = content.split('\n');
    const highlights: string[] = [];

    for (const line of lines) {
      const lowerLine = line.toLowerCase();
      if (words.some(word => lowerLine.includes(word))) {
        // Extract a snippet around the matching word
        const snippet = line.length > 100 
          ? line.substring(0, 100) + '...'
          : line;
        highlights.push(snippet);
        
        if (highlights.length >= 3) break;
      }
    }

    return highlights;
  }
}