/**
 * Type declaration for @elastic/elasticsearch
 */

declare module '@elastic/elasticsearch' {
  // Elasticsearch type definitions
  interface ExplanationDetail {
    value: number;
    description: string;
    details?: ExplanationDetail[];
  }

  interface ElasticsearchQuery {
    [key: string]: unknown;
  }

  interface ElasticsearchAggregation {
    [key: string]: unknown;
  }

  interface ElasticsearchSort {
    [key: string]: 'asc' | 'desc' | { order: 'asc' | 'desc'; [key: string]: unknown };
  }
  export interface SearchResponse<T> {
    took: number;
    timed_out: boolean;
    _scroll_id?: string;
    _shards: {
      total: number;
      successful: number;
      skipped: number;
      failed: number;
    };
    hits: {
      total: {
        value: number;
        relation: string;
      };
      max_score: number | null;
      hits: Array<{
        _index: string;
        _type?: string;
        _id: string;
        _score: number | null;
        _source: T;
        _version?: number;
        _explanation?: {
          value: number;
          description: string;
          details: ExplanationDetail[];
        };
        fields?: Record<string, unknown[]>;
        highlight?: Record<string, string[]>;
        inner_hits?: Record<string, SearchResponse<unknown>>;
        matched_queries?: string[];
        sort?: string[];
      }>;
    };
    aggregations?: Record<string, ElasticsearchAggregation>;
  }

  export interface SearchRequest {
    index?: string | string[];
    type?: string | string[];
    body?: {
      query?: ElasticsearchQuery;
      aggs?: Record<string, ElasticsearchAggregation>;
      sort?: ElasticsearchSort[];
      _source?: string[] | boolean;
      size?: number;
      from?: number;
      fields?: string[];
      highlight?: Record<string, unknown>;
      script_fields?: Record<string, { script: { source: string; params?: Record<string, unknown> } }>;
      post_filter?: ElasticsearchQuery;
      search_after?: (string | number)[];
      rescore?: Record<string, unknown>;
      explain?: boolean;
      version?: boolean;
      indices_boost?: Array<Record<string, number>>;
      min_score?: number;
      track_scores?: boolean;
      track_total_hits?: boolean | number;
    };
    q?: string;
    df?: string;
    analyzer?: string;
    analyze_wildcard?: boolean;
    default_operator?: 'AND' | 'OR';
    lenient?: boolean;
    explain?: boolean;
    _source?: string | string[] | boolean;
    _source_excludes?: string | string[];
    _source_includes?: string | string[];
    stored_fields?: string | string[];
    sort?: string | string[];
    preference?: string;
    routing?: string | string[];
    scroll?: string;
    search_type?: 'query_then_fetch' | 'dfs_query_then_fetch';
    size?: number;
    from?: number;
    timeout?: string;
    terminate_after?: number;
    stats?: string | string[];
    suggest_field?: string;
    suggest_mode?: 'missing' | 'popular' | 'always';
    suggest_size?: number;
    suggest_text?: string;
    version?: boolean;
    fielddata_fields?: string | string[];
    docvalue_fields?: string | string[];
    request_cache?: boolean;
    knn?: boolean;
    seq_no_primary_term?: boolean;
  }

  export class Client {
    constructor(options?: {
      node?: string | string[] | { url: string }[];
      nodes?: string | string[] | { url: string }[];
      cloud?: { id: string; username?: string; password?: string };
      auth?: { username: string; password: string };
      apiKey?: string | { id: string; api_key: string };
      maxRetries?: number;
      requestTimeout?: number;
      pingTimeout?: number;
      sniffInterval?: number;
      sniffOnStart?: boolean;
      sniffOnConnectionFault?: boolean;
      resurrectStrategy?: 'ping' | 'optimistic' | 'none';
      suggestCompression?: boolean;
      compression?: 'gzip';
      ssl?: {
        ca?: string | string[];
        rejectUnauthorized?: boolean;
        pfx?: string;
        key?: string;
        passphrase?: string;
        cert?: string;
        keyPassphrase?: string;
        serverName?: string;
        secureProtocol?: string;
      };
      agent?: Record<string, unknown>;
      proxy?: string | Record<string, unknown>;
      headers?: Record<string, string>;
      opaqueIdPrefix?: string;
      name?: string;
      emit?: (...args: unknown[]) => void;
    });

    search<T = unknown>(
      params: SearchRequest,
      options?: { ignore?: number | number[]; requestTimeout?: number; maxRetries?: number; }
    ): Promise<SearchResponse<T>>;

    index(params: {
      index: string;
      id?: string;
      refresh?: 'true' | 'false' | 'wait_for';
      body: Record<string, unknown>;
    }): Promise<{ _id: string; _index: string; _version: number; result: string }>;

    update(params: {
      index: string;
      id: string;
      refresh?: 'true' | 'false' | 'wait_for';
      body: { doc?: Record<string, unknown>; script?: Record<string, unknown> };
    }): Promise<{ _id: string; _index: string; _version: number; result: string }>;

    delete(params: {
      index: string;
      id: string;
      refresh?: 'true' | 'false' | 'wait_for';
    }): Promise<{ _id: string; _index: string; _version: number; result: string }>;

    bulk(params: {
      index?: string;
      body: Array<Record<string, unknown>>;
      refresh?: 'true' | 'false' | 'wait_for';
    }): Promise<{ items: Array<Record<string, unknown>>; errors: boolean }>;

    count(params: {
      index?: string | string[];
      body?: { query?: ElasticsearchQuery };
      query?: string;
    }): Promise<{ count: number; _shards: { total: number; successful: number; skipped: number; failed: number } }>;

    exists(params: {
      index: string;
      id: string;
      source?: string | string[];
    }): Promise<boolean>;

    get<T = unknown>(params: {
      index: string;
      id: string;
      source?: string | string[];
    }): Promise<{ _source: T; found: boolean; _index: string; _id: string; _version: number }>;

    indices: {
      create(params: {
        index: string;
        body?: Record<string, unknown>;
      }): Promise<{ acknowledged: boolean; shards_acknowledged: boolean; index: string }>;
      delete(params: {
        index: string;
      }): Promise<{ acknowledged: boolean }>;
      exists(params: {
        index: string;
      }): Promise<boolean>;
      refresh(params: {
        index?: string | string[];
      }): Promise<{ _shards: { total: number; successful: number; failed: number } }>;
      putMapping(params: {
        index: string | string[];
        body: Record<string, unknown>;
      }): Promise<{ acknowledged: boolean }>;
    };

    ping(): Promise<boolean>;
    info(): Promise<{ cluster_name: string; version: Record<string, unknown>; [key: string]: unknown }>;
    close(): Promise<void>;
  }
}