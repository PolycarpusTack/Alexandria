/**
 * Type definitions for enterprise_chunker
 * A Python-based enterprise-grade text chunking utility for LLM processing
 */

declare module '@tools/enterprise_chunker/chunker' {
  /**
   * Enum for chunking strategies
   */
  export enum ChunkingStrategy {
    ADAPTIVE = 'adaptive',
    SEMANTIC = 'semantic',
    FIXED_SIZE = 'fixed_size',
    STRUCTURAL = 'structural',
    SENTENCE = 'sentence'
  }

  /**
   * Enum for content formats
   */
  export enum ContentFormat {
    TEXT = 'text',
    JSON = 'json',
    XML = 'xml',
    MARKDOWN = 'markdown',
    CODE = 'code',
    LOGS = 'logs',
    CSV = 'csv'
  }

  /**
   * Options for chunking configuration
   */
  export interface ChunkingOptions {
    max_tokens_per_chunk?: number;
    overlap_tokens?: number;
    chunking_strategy?: ChunkingStrategy;
    enable_format_detection?: boolean;
    stream_buffer_size?: number;
    token_estimation_strategy?: string;
    [key: string]: any;
  }

  /**
   * Chunk metadata interface
   */
  export interface ChunkMetadata {
    index: number;
    start_pos: number;
    end_pos: number;
    token_count: number;
    format?: ContentFormat;
    [key: string]: any;
  }

  /**
   * Chunking result interface
   */
  export interface ChunkingResult {
    chunks: string[];
    metadata: ChunkMetadata[];
    operation_id: string;
  }

  /**
   * Enterprise-grade text chunking utility for LLM processing
   */
  export class EnterpriseChunker {
    /**
     * Initialize the chunker with configuration options
     * @param options Optional configuration dictionary
     */
    constructor(options?: ChunkingOptions);

    /**
     * Main entry point: Adaptively chunk text based on content format
     * @param text Text content to chunk
     * @param max_tokens_per_chunk Maximum tokens per chunk (overrides class settings)
     * @param overlap_tokens Number of tokens to overlap between chunks
     * @param strategy Chunking strategy to use
     * @returns List of text chunks optimized for processing
     */
    adaptive_chunk_text(
      text: string,
      max_tokens_per_chunk?: number,
      overlap_tokens?: number,
      strategy?: string | ChunkingStrategy
    ): string[];

    /**
     * Process a text stream by dynamically chunking it as it's read
     * @param stream Text stream to process
     * @param options Additional options for chunking
     * @returns Generator of text chunks
     */
    chunk_stream(
      stream: string | NodeJS.ReadableStream,
      options?: ChunkingOptions
    ): Generator<string>;

    /**
     * Fluent API for setting max tokens per chunk
     * @param max_tokens Maximum tokens per chunk
     * @returns Self for chaining
     */
    with_max_tokens(max_tokens: number): EnterpriseChunker;

    /**
     * Fluent API for setting overlap tokens
     * @param overlap_tokens Number of tokens to overlap
     * @returns Self for chaining
     */
    with_overlap(overlap_tokens: number): EnterpriseChunker;

    /**
     * Fluent API for setting chunking strategy
     * @param strategy Chunking strategy to use
     * @returns Self for chaining
     */
    with_strategy(strategy: string | ChunkingStrategy): EnterpriseChunker;

    /**
     * Chunk text with current configuration
     * @param text Text to chunk
     * @returns List of text chunks
     */
    chunk(text: string): string[];

    /**
     * Context manager for semantic chunking
     * @param max_tokens Optional max tokens override
     * @param overlap Optional overlap tokens override
     * @returns Context manager
     */
    semantic_context(max_tokens?: number, overlap?: number): ChunkingContext;

    /**
     * Context manager for structural chunking
     * @param max_tokens Optional max tokens override
     * @param overlap Optional overlap tokens override
     * @returns Context manager
     */
    structural_context(max_tokens?: number, overlap?: number): ChunkingContext;

    /**
     * Context manager for fixed-size chunking
     * @param max_tokens Optional max tokens override
     * @param overlap Optional overlap tokens override
     * @returns Context manager
     */
    fixed_size_context(max_tokens?: number, overlap?: number): ChunkingContext;

    /**
     * Context manager for sentence-based chunking
     * @param max_tokens Optional max tokens override
     * @param overlap Optional overlap tokens override
     * @returns Context manager
     */
    sentence_context(max_tokens?: number, overlap?: number): ChunkingContext;
  }

  /**
   * Context manager for temporary chunking configuration
   */
  export class ChunkingContext {
    /**
     * Initialize the context manager
     * @param chunker EnterpriseChunker instance
     * @param strategy Chunking strategy to use
     * @param max_tokens Optional max tokens override
     * @param overlap Optional overlap tokens override
     */
    constructor(
      chunker: EnterpriseChunker,
      strategy: ChunkingStrategy,
      max_tokens?: number,
      overlap?: number
    );
  }
}