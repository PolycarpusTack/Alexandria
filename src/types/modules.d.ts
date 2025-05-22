/**
 * Type declarations for imported modules
 */

// Declare types for the enterprise_chunker module
declare module '../../../../tools/enterprise_chunker/chunker' {
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
    preserve_structure?: boolean;
    [key: string]: any;
  }

  /**
   * Enterprise-grade text chunking utility for LLM processing
   */
  export class EnterpriseChunker {
    /**
     * Initialize the chunker with configuration options
     * @param options Optional configuration dictionary
     */
    constructor(options?: Record<string, any>);

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
      max_tokens_per_chunk?: number | null,
      overlap_tokens?: number | null,
      strategy?: string | ChunkingStrategy | null
    ): string[];

    /**
     * Alternative signature with options object
     */
    adaptive_chunk_text(
      text: string,
      options: ChunkingOptions
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
    ): AsyncGenerator<string>;

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
  }
}

// Declare types for the Logger module
declare module '../../../../utils/logger' {
  export interface Logger {
    debug(message: string, metadata?: Record<string, any>): void;
    info(message: string, metadata?: Record<string, any>): void;
    warn(message: string, metadata?: Record<string, any>): void;
    error(message: string, metadata?: Record<string, any>): void;
  }
}

// Add more module declarations as needed