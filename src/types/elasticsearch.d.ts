/**
 * Type declaration for @elastic/elasticsearch
 */

declare module '@elastic/elasticsearch' {
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
          details: any[];
        };
        fields?: any;
        highlight?: any;
        inner_hits?: any;
        matched_queries?: string[];
        sort?: string[];
      }>;
    };
    aggregations?: any;
  }

  export interface SearchRequest {
    index?: string | string[];
    type?: string | string[];
    body?: {
      query?: any;
      aggs?: any;
      sort?: any[];
      _source?: string[] | boolean;
      size?: number;
      from?: number;
      fields?: string[];
      highlight?: any;
      script_fields?: any;
      post_filter?: any;
      search_after?: any[];
      rescore?: any;
      explain?: boolean;
      version?: boolean;
      indices_boost?: any[];
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
      agent?: any;
      proxy?: string | any;
      headers?: Record<string, string>;
      opaqueIdPrefix?: string;
      name?: string;
      emit?: (...args: any[]) => void;
    });

    search<T = any>(
      params: SearchRequest,
      options?: { ignore?: number | number[]; requestTimeout?: number; maxRetries?: number; }
    ): Promise<SearchResponse<T>>;

    index(params: {
      index: string;
      id?: string;
      refresh?: 'true' | 'false' | 'wait_for';
      body: any;
    }): Promise<any>;

    update(params: {
      index: string;
      id: string;
      refresh?: 'true' | 'false' | 'wait_for';
      body: any;
    }): Promise<any>;

    delete(params: {
      index: string;
      id: string;
      refresh?: 'true' | 'false' | 'wait_for';
    }): Promise<any>;

    bulk(params: {
      index?: string;
      body: any[];
      refresh?: 'true' | 'false' | 'wait_for';
    }): Promise<any>;

    count(params: {
      index?: string | string[];
      body?: any;
      query?: string;
    }): Promise<{ count: number; _shards: any }>;

    exists(params: {
      index: string;
      id: string;
      source?: string | string[];
    }): Promise<boolean>;

    get<T = any>(params: {
      index: string;
      id: string;
      source?: string | string[];
    }): Promise<{ _source: T; found: boolean }>;

    indices: {
      create(params: {
        index: string;
        body?: any;
      }): Promise<any>;
      delete(params: {
        index: string;
      }): Promise<any>;
      exists(params: {
        index: string;
      }): Promise<boolean>;
      refresh(params: {
        index?: string | string[];
      }): Promise<any>;
      putMapping(params: {
        index: string | string[];
        body: any;
      }): Promise<any>;
    };

    ping(): Promise<boolean>;
    info(): Promise<any>;
    close(): Promise<void>;
  }
}