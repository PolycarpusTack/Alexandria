/**
 * Search Facet Generator
 * Generates facets and aggregations for search results
 */

import { SearchQuery, SearchFacets } from '../../interfaces/SearchService';
import { ExtendedSearchFacets, FacetValue } from './types';
import { MnemosyneContext } from '../../../types/MnemosyneContext';
import { MnemosyneError, MnemosyneErrorCode } from '../../../errors/MnemosyneErrors';

export class FacetGenerator {
  private context: MnemosyneContext;

  constructor(context: MnemosyneContext) {
    this.context = context;
  }

  /**
   * Generate facets for search results
   */
  async generateFacets(query: SearchQuery): Promise<ExtendedSearchFacets> {
    try {
      const facets: ExtendedSearchFacets = {};

      // Always generate basic facets
      const [nodeTypes, tags, authors, statuses] = await Promise.all([
        this.generateNodeTypeFacets(query),
        this.generateTagFacets(query),
        this.generateAuthorFacets(query),
        this.generateStatusFacets(query)
      ]);

      facets.nodeTypes = nodeTypes;
      facets.tags = tags;
      facets.authors = authors;
      facets.statuses = statuses;

      // Generate date range facets if requested
      if (query.includeFacets?.includes('dateRanges')) {
        facets.dateRanges = await this.generateDateRangeFacets(query);
      }

      // Generate custom metadata facets if specified
      if (query.facetFields && query.facetFields.length > 0) {
        facets.customFacets = await this.generateCustomFacets(query, query.facetFields);
      }

      return facets;

    } catch (error) {
      this.context.logger.error('Failed to generate facets', { error, query });
      // Return empty facets on error rather than failing the search
      return {
        nodeTypes: [],
        tags: [],
        authors: [],
        statuses: []
      };
    }
  }

  /**
   * Generate node type facets
   */
  private async generateNodeTypeFacets(query: SearchQuery): Promise<string[]> {
    const facetQuery = `
      SELECT 
        type,
        COUNT(*) as count
      FROM mnemosyne_nodes
      WHERE status != 'deleted'
        ${query.text ? "AND search_vector @@ plainto_tsquery('english', $1)" : ''}
        ${this.buildFacetFilterClause(query.filters, ['nodeTypes'])}
      GROUP BY type
      ORDER BY count DESC
    `;

    const params = query.text ? [query.text] : [];
    const result = await this.context.dataService.query(facetQuery, params);

    return result.map((row: any) => row.type);
  }

  /**
   * Generate tag facets
   */
  private async generateTagFacets(query: SearchQuery): Promise<string[]> {
    const facetQuery = `
      SELECT 
        unnest(tags) as tag,
        COUNT(*) as count
      FROM mnemosyne_nodes
      WHERE status != 'deleted'
        ${query.text ? "AND search_vector @@ plainto_tsquery('english', $1)" : ''}
        ${this.buildFacetFilterClause(query.filters, ['tags'])}
      GROUP BY tag
      ORDER BY count DESC
      LIMIT 50
    `;

    const params = query.text ? [query.text] : [];
    const result = await this.context.dataService.query(facetQuery, params);

    return result.map((row: any) => row.tag);
  }

  /**
   * Generate author facets
   */
  private async generateAuthorFacets(query: SearchQuery): Promise<string[]> {
    const facetQuery = `
      SELECT 
        metadata->>'author' as author,
        COUNT(*) as count
      FROM mnemosyne_nodes
      WHERE status != 'deleted'
        AND metadata->>'author' IS NOT NULL
        ${query.text ? "AND search_vector @@ plainto_tsquery('english', $1)" : ''}
        ${this.buildFacetFilterClause(query.filters, ['authors'])}
      GROUP BY author
      ORDER BY count DESC
      LIMIT 20
    `;

    const params = query.text ? [query.text] : [];
    const result = await this.context.dataService.query(facetQuery, params);

    return result.map((row: any) => row.author);
  }

  /**
   * Generate status facets
   */
  private async generateStatusFacets(query: SearchQuery): Promise<string[]> {
    const facetQuery = `
      SELECT 
        status,
        COUNT(*) as count
      FROM mnemosyne_nodes
      WHERE status != 'deleted'
        ${query.text ? "AND search_vector @@ plainto_tsquery('english', $1)" : ''}
        ${this.buildFacetFilterClause(query.filters, ['status'])}
      GROUP BY status
      ORDER BY count DESC
    `;

    const params = query.text ? [query.text] : [];
    const result = await this.context.dataService.query(facetQuery, params);

    return result.map((row: any) => row.status);
  }

  /**
   * Generate date range facets
   */
  private async generateDateRangeFacets(query: SearchQuery): Promise<Array<{
    label: string;
    from: Date;
    to: Date;
    count: number;
  }>> {
    const now = new Date();
    const ranges = [
      { label: 'Today', days: 1 },
      { label: 'Last 7 days', days: 7 },
      { label: 'Last 30 days', days: 30 },
      { label: 'Last 90 days', days: 90 },
      { label: 'Last year', days: 365 }
    ];

    const facets = await Promise.all(ranges.map(async range => {
      const from = new Date(now);
      from.setDate(from.getDate() - range.days);

      const countQuery = `
        SELECT COUNT(*) as count
        FROM mnemosyne_nodes
        WHERE status != 'deleted'
          AND created_at >= $1
          ${query.text ? "AND search_vector @@ plainto_tsquery('english', $2)" : ''}
          ${this.buildFacetFilterClause(query.filters, ['dateRange'])}
      `;

      const params = query.text ? [from, query.text] : [from];
      const result = await this.context.dataService.query(countQuery, params);

      return {
        label: range.label,
        from,
        to: now,
        count: parseInt(result[0]?.count || '0')
      };
    }));

    return facets.filter(f => f.count > 0);
  }

  /**
   * Generate custom metadata facets
   */
  private async generateCustomFacets(
    query: SearchQuery,
    fields: string[]
  ): Promise<Record<string, FacetValue[]>> {
    const customFacets: Record<string, FacetValue[]> = {};

    await Promise.all(fields.map(async field => {
      const facetQuery = `
        SELECT 
          metadata->>'${field}' as value,
          COUNT(*) as count
        FROM mnemosyne_nodes
        WHERE status != 'deleted'
          AND metadata->>'${field}' IS NOT NULL
          ${query.text ? "AND search_vector @@ plainto_tsquery('english', $1)" : ''}
          ${this.buildFacetFilterClause(query.filters)}
        GROUP BY value
        ORDER BY count DESC
        LIMIT 20
      `;

      const params = query.text ? [query.text] : [];
      const result = await this.context.dataService.query(facetQuery, params);

      customFacets[field] = result.map((row: any) => ({
        value: row.value,
        count: parseInt(row.count),
        selected: query.filters?.metadata?.[field] === row.value
      }));
    }));

    return customFacets;
  }

  /**
   * Build filter clause for facet queries
   */
  private buildFacetFilterClause(
    filters?: any,
    excludeFields: string[] = []
  ): string {
    if (!filters) return '';

    const conditions: string[] = [];

    // Apply filters except the ones being faceted
    if (filters.nodeTypes && !excludeFields.includes('nodeTypes')) {
      conditions.push(`AND type = ANY(ARRAY[${filters.nodeTypes.map((t: string) => `'${t}'`).join(',')}])`);
    }

    if (filters.tags && !excludeFields.includes('tags')) {
      conditions.push(`AND tags && ARRAY[${filters.tags.map((t: string) => `'${t}'`).join(',')}]`);
    }

    if (filters.authors && !excludeFields.includes('authors')) {
      conditions.push(`AND metadata->>'author' = ANY(ARRAY[${filters.authors.map((a: string) => `'${a}'`).join(',')}])`);
    }

    if (filters.status && !excludeFields.includes('status')) {
      conditions.push(`AND status = ANY(ARRAY[${filters.status.map((s: string) => `'${s}'`).join(',')}])`);
    }

    if (filters.dateRange && !excludeFields.includes('dateRange')) {
      if (filters.dateRange.from) {
        conditions.push(`AND created_at >= '${new Date(filters.dateRange.from).toISOString()}'`);
      }
      if (filters.dateRange.to) {
        conditions.push(`AND created_at <= '${new Date(filters.dateRange.to).toISOString()}'`);
      }
    }

    return conditions.join(' ');
  }

  /**
   * Calculate facet statistics
   */
  async calculateFacetStats(facets: ExtendedSearchFacets): Promise<{
    totalFacets: number;
    coverage: Record<string, number>;
    diversity: Record<string, number>;
  }> {
    const stats = {
      totalFacets: 0,
      coverage: {} as Record<string, number>,
      diversity: {} as Record<string, number>
    };

    // Count total facets
    Object.entries(facets).forEach(([key, values]) => {
      if (Array.isArray(values)) {
        stats.totalFacets += values.length;
        stats.coverage[key] = values.length;
        
        // Calculate diversity (Shannon entropy)
        if (key === 'customFacets' && typeof values === 'object') {
          Object.entries(values).forEach(([field, facetValues]) => {
            const total = facetValues.reduce((sum, fv) => sum + fv.count, 0);
            const entropy = facetValues.reduce((h, fv) => {
              const p = fv.count / total;
              return h - (p > 0 ? p * Math.log2(p) : 0);
            }, 0);
            stats.diversity[field] = entropy;
          });
        }
      }
    });

    return stats;
  }
}