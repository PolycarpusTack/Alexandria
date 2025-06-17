/**
 * Search Query Builder
 * Constructs database queries for different search types
 */

import { SearchQuery, SearchFilters, SearchType } from '../../interfaces/SearchService';
import { SearchQueryParams } from './types';
import { MnemosyneContext } from '../../../types/MnemosyneContext';

export class QueryBuilder {
  private context: MnemosyneContext;

  constructor(context: MnemosyneContext) {
    this.context = context;
  }

  /**
   * Build the main search query based on search type
   */
  buildSearchQuery(params: SearchQueryParams, searchType: SearchType): {
    query: string;
    params: unknown[];
  } {
    switch (searchType) {
      case 'basic':
        return this.buildBasicSearchQuery(params);
      case 'advanced':
        return this.buildAdvancedSearchQuery(params);
      case 'semantic':
        return this.buildSemanticSearchQuery(params);
      case 'hybrid':
        return this.buildHybridSearchQuery(params);
      default:
        return this.buildBasicSearchQuery(params);
    }
  }

  /**
   * Build basic text search query
   */
  private buildBasicSearchQuery(params: SearchQueryParams): {
    query: string;
    params: unknown[];
  } {
    const queryParts: string[] = [];
    const queryParams: unknown[] = [];
    let paramIndex = 1;

    // Base query with text search
    queryParts.push(`
      SELECT 
        n.id,
        n.title,
        n.content,
        n.type,
        n.status,
        n.metadata,
        n.tags,
        n.created_at,
        n.updated_at,
        ts_rank(n.search_vector, plainto_tsquery('english', $${paramIndex})) as rank
      FROM mnemosyne_nodes n
      WHERE n.status != 'deleted'
        AND n.search_vector @@ plainto_tsquery('english', $${paramIndex})
    `);
    queryParams.push(params.query);
    paramIndex++;

    // Add filter conditions
    const filterConditions = this.buildFilterConditions(params.filters, paramIndex);
    if (filterConditions.conditions.length > 0) {
      queryParts.push('AND ' + filterConditions.conditions.join(' AND '));
      queryParams.push(...filterConditions.params);
      paramIndex += filterConditions.params.length;
    }

    // Add ordering
    queryParts.push('ORDER BY rank DESC, n.updated_at DESC');

    // Add pagination
    if (params.pagination) {
      queryParts.push(`LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`);
      queryParams.push(params.pagination.limit, params.pagination.offset);
    }

    return {
      query: queryParts.join('\n'),
      params: queryParams
    };
  }

  /**
   * Build advanced search query with boolean operators
   */
  private buildAdvancedSearchQuery(params: SearchQueryParams): {
    query: string;
    params: unknown[];
  } {
    const queryParts: string[] = [];
    const queryParams: unknown[] = [];
    let paramIndex = 1;

    // Parse and convert advanced query syntax to tsquery
    const tsQuery = this.parseAdvancedQuery(params.query);

    queryParts.push(`
      SELECT 
        n.id,
        n.title,
        n.content,
        n.type,
        n.status,
        n.metadata,
        n.tags,
        n.created_at,
        n.updated_at,
        ts_rank(n.search_vector, to_tsquery('english', $${paramIndex})) as rank,
        ts_headline('english', n.content, to_tsquery('english', $${paramIndex}), 
          'MaxWords=50, MinWords=25, ShortWord=3, HighlightAll=FALSE'
        ) as snippet
      FROM mnemosyne_nodes n
      WHERE n.status != 'deleted'
        AND n.search_vector @@ to_tsquery('english', $${paramIndex})
    `);
    queryParams.push(tsQuery);
    paramIndex++;

    // Add filters
    const filterConditions = this.buildFilterConditions(params.filters, paramIndex);
    if (filterConditions.conditions.length > 0) {
      queryParts.push('AND ' + filterConditions.conditions.join(' AND '));
      queryParams.push(...filterConditions.params);
      paramIndex += filterConditions.params.length;
    }

    // Add ordering
    queryParts.push('ORDER BY rank DESC, n.updated_at DESC');

    // Add pagination
    if (params.pagination) {
      queryParts.push(`LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`);
      queryParams.push(params.pagination.limit, params.pagination.offset);
    }

    return {
      query: queryParts.join('\n'),
      params: queryParams
    };
  }

  /**
   * Build semantic search query (requires vector extension)
   */
  private buildSemanticSearchQuery(params: SearchQueryParams): {
    query: string;
    params: unknown[];
  } {
    // This would use pgvector or similar for semantic search
    // For now, fall back to basic search
    this.context.logger.warn('Semantic search not yet implemented, falling back to basic search');
    return this.buildBasicSearchQuery(params);
  }

  /**
   * Build hybrid search query combining text and semantic search
   */
  private buildHybridSearchQuery(params: SearchQueryParams): {
    query: string;
    params: unknown[];
  } {
    // This would combine text and semantic search
    // For now, fall back to basic search
    this.context.logger.warn('Hybrid search not yet implemented, falling back to basic search');
    return this.buildBasicSearchQuery(params);
  }

  /**
   * Build filter conditions for the WHERE clause
   */
  private buildFilterConditions(
    filters: SearchFilters | undefined,
    startParamIndex: number
  ): {
    conditions: string[];
    params: unknown[];
  } {
    if (!filters) {
      return { conditions: [], params: [] };
    }

    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = startParamIndex;

    // Node types filter
    if (filters.nodeTypes && filters.nodeTypes.length > 0) {
      conditions.push(`n.type = ANY($${paramIndex})`);
      params.push(filters.nodeTypes);
      paramIndex++;
    }

    // Status filter
    if (filters.status && filters.status.length > 0) {
      conditions.push(`n.status = ANY($${paramIndex})`);
      params.push(filters.status);
      paramIndex++;
    }

    // Tags filter
    if (filters.tags && filters.tags.length > 0) {
      conditions.push(`n.tags && $${paramIndex}`);
      params.push(filters.tags);
      paramIndex++;
    }

    // Date range filter
    if (filters.dateRange) {
      if (filters.dateRange.from) {
        conditions.push(`n.created_at >= $${paramIndex}`);
        params.push(new Date(filters.dateRange.from));
        paramIndex++;
      }
      if (filters.dateRange.to) {
        conditions.push(`n.created_at <= $${paramIndex}`);
        params.push(new Date(filters.dateRange.to));
        paramIndex++;
      }
    }

    // Author filter
    if (filters.authors && filters.authors.length > 0) {
      conditions.push(`n.metadata->>'author' = ANY($${paramIndex})`);
      params.push(filters.authors);
      paramIndex++;
    }

    // Metadata filters
    if (filters.metadata) {
      for (const [key, value] of Object.entries(filters.metadata)) {
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          // Range filter
          const range = value as any;
          if (range.min !== undefined) {
            conditions.push(`(n.metadata->>'${key}')::numeric >= $${paramIndex}`);
            params.push(range.min);
            paramIndex++;
          }
          if (range.max !== undefined) {
            conditions.push(`(n.metadata->>'${key}')::numeric <= $${paramIndex}`);
            params.push(range.max);
            paramIndex++;
          }
        } else {
          // Exact match
          conditions.push(`n.metadata->>'${key}' = $${paramIndex}`);
          params.push(value);
          paramIndex++;
        }
      }
    }

    // Exclude IDs
    if (filters.excludeIds && filters.excludeIds.length > 0) {
      conditions.push(`n.id != ALL($${paramIndex})`);
      params.push(filters.excludeIds);
      paramIndex++;
    }

    return { conditions, params };
  }

  /**
   * Parse advanced query syntax to PostgreSQL tsquery format
   */
  private parseAdvancedQuery(query: string): string {
    let tsQuery = query;

    // Replace boolean operators with PostgreSQL equivalents
    tsQuery = tsQuery.replace(/\bAND\b/g, '&');
    tsQuery = tsQuery.replace(/\bOR\b/g, '|');
    tsQuery = tsQuery.replace(/\bNOT\b/g, '!');

    // Handle quoted phrases
    tsQuery = tsQuery.replace(/"([^"]+)"/g, (match, phrase) => {
      // Convert phrase to tsquery format
      return phrase.split(/\s+/).join(' <-> ');
    });

    // Handle wildcards
    tsQuery = tsQuery.replace(/\*(\w+)/g, '$1:*');
    tsQuery = tsQuery.replace(/(\w+)\*/g, '$1:*');

    return tsQuery;
  }

  /**
   * Build count query for pagination
   */
  buildCountQuery(params: SearchQueryParams, searchType: SearchType): {
    query: string;
    params: unknown[];
  } {
    const queryParts: string[] = [];
    const queryParams: unknown[] = [];
    let paramIndex = 1;

    queryParts.push(`
      SELECT COUNT(*) as total
      FROM mnemosyne_nodes n
      WHERE n.status != 'deleted'
    `);

    // Add search condition based on type
    if (searchType === 'advanced') {
      const tsQuery = this.parseAdvancedQuery(params.query);
      queryParts.push(`AND n.search_vector @@ to_tsquery('english', $${paramIndex})`);
      queryParams.push(tsQuery);
    } else {
      queryParts.push(`AND n.search_vector @@ plainto_tsquery('english', $${paramIndex})`);
      queryParams.push(params.query);
    }
    paramIndex++;

    // Add filter conditions
    const filterConditions = this.buildFilterConditions(params.filters, paramIndex);
    if (filterConditions.conditions.length > 0) {
      queryParts.push('AND ' + filterConditions.conditions.join(' AND '));
      queryParams.push(...filterConditions.params);
    }

    return {
      query: queryParts.join('\n'),
      params: queryParams
    };
  }

  /**
   * Build query for similar nodes
   */
  buildSimilarNodesQuery(nodeId: string, limit: number): {
    query: string;
    params: unknown[];
  } {
    return {
      query: `
        WITH target_node AS (
          SELECT 
            id, 
            search_vector, 
            tags,
            type,
            metadata->>'category' as category
          FROM mnemosyne_nodes 
          WHERE id = $1 AND status != 'deleted'
        )
        SELECT 
          n.id,
          n.title,
          n.type,
          n.tags,
          n.metadata,
          n.created_at,
          n.updated_at,
          ts_rank(n.search_vector, t.search_vector) as text_similarity,
          CASE 
            WHEN n.tags && t.tags THEN 
              array_length(n.tags & t.tags, 1)::float / array_length(t.tags, 1)::float
            ELSE 0 
          END as tag_similarity,
          CASE WHEN n.type = t.type THEN 0.2 ELSE 0 END as type_boost,
          CASE WHEN n.metadata->>'category' = t.category THEN 0.1 ELSE 0 END as category_boost
        FROM mnemosyne_nodes n
        CROSS JOIN target_node t
        WHERE n.id != $1 
          AND n.status != 'deleted'
          AND (
            ts_rank(n.search_vector, t.search_vector) > 0.1
            OR n.tags && t.tags
            OR n.type = t.type
          )
        ORDER BY 
          (text_similarity + tag_similarity + type_boost + category_boost) DESC
        LIMIT $2
      `,
      params: [nodeId, limit]
    };
  }
}