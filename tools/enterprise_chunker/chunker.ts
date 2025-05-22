/**
 * TypeScript implementation of Enterprise Chunker
 * 
 * This file provides a TypeScript wrapper for the enterprise_chunker Python module.
 * It reexports all types and interfaces from the index.d.ts file and provides
 * a basic implementation for TypeScript-only environments.
 */

/**
 * These types are defined in the index.d.ts file and exported here
 */
export enum ChunkingStrategy {
  ADAPTIVE = 'adaptive',
  SEMANTIC = 'semantic',
  FIXED_SIZE = 'fixed_size',
  STRUCTURAL = 'structural',
  SENTENCE = 'sentence'
}

export enum ContentFormat {
  TEXT = 'text',
  JSON = 'json',
  XML = 'xml',
  MARKDOWN = 'markdown',
  CODE = 'code',
  LOGS = 'logs',
  CSV = 'csv'
}

export interface ChunkingOptions {
  max_tokens_per_chunk?: number;
  overlap_tokens?: number;
  chunking_strategy?: ChunkingStrategy;
  enable_format_detection?: boolean;
  stream_buffer_size?: number;
  token_estimation_strategy?: string;
  [key: string]: any;
}

export interface ChunkMetadata {
  index: number;
  start_pos: number;
  end_pos: number;
  token_count: number;
  format?: ContentFormat;
  [key: string]: any;
}

export interface ChunkingResult {
  chunks: string[];
  metadata: ChunkMetadata[];
  operation_id: string;
}

/**
 * Enterprise-grade text chunking utility for LLM processing
 */
export class EnterpriseChunker {
  options: ChunkingOptions;

  /**
   * Initialize the chunker with configuration options
   * @param options Optional configuration dictionary
   */
  constructor(options?: ChunkingOptions) {
    this.options = options || {};
  }

  /**
   * Main entry point: Adaptively chunk text based on content format
   * @param text Text content to chunk
   * @param options Optional configuration options
   * @returns List of text chunks optimized for processing
   */
  adaptive_chunk_text(
    text: string,
    options?: ChunkingOptions
  ): string[] {
    // Extract parameters from options for backward compatibility
    const max_tokens_per_chunk = options?.max_tokens_per_chunk;
    const overlap_tokens = options?.overlap_tokens;
    const strategy = options?.chunking_strategy || options?.strategy;
    // Basic implementation that just splits by newlines
    // In a real implementation, this would call the Python module
    const maxChars = max_tokens_per_chunk || this.options.max_tokens_per_chunk || 4000;
    const overlap = overlap_tokens || this.options.overlap_tokens || 200;
    
    // Split by newlines as a simple chunking strategy
    const lines = text.split('\n');
    const chunks: string[] = [];
    let currentChunk = '';
    
    for (const line of lines) {
      if (currentChunk.length + line.length + 1 > maxChars) {
        chunks.push(currentChunk);
        // Add overlap by including the last few characters
        const overlapText = currentChunk.slice(-overlap);
        currentChunk = overlapText + line + '\n';
      } else {
        currentChunk += line + '\n';
      }
    }
    
    if (currentChunk) {
      chunks.push(currentChunk);
    }
    
    return chunks;
  }

  /**
   * Process a text stream by dynamically chunking it as it's read
   * @param stream Text stream to process
   * @param options Additional options for chunking
   * @returns Async generator of text chunks
   */
  async *chunk_stream(
    stream: string | NodeJS.ReadableStream,
    options?: ChunkingOptions
  ): AsyncGenerator<string> {
    // In a real implementation, this would chunk a stream
    // For now, just process as a string
    if (typeof stream === 'string') {
      const chunks = this.adaptive_chunk_text(stream, options);
      
      for (const chunk of chunks) {
        yield chunk;
      }
    } else {
      // Return an empty generator for now
      return;
    }
  }

  /**
   * Fluent API for setting max tokens per chunk
   * @param max_tokens Maximum tokens per chunk
   * @returns Self for chaining
   */
  with_max_tokens(max_tokens: number): EnterpriseChunker {
    this.options.max_tokens_per_chunk = max_tokens;
    return this;
  }

  /**
   * Fluent API for setting overlap tokens
   * @param overlap_tokens Number of tokens to overlap
   * @returns Self for chaining
   */
  with_overlap(overlap_tokens: number): EnterpriseChunker {
    this.options.overlap_tokens = overlap_tokens;
    return this;
  }

  /**
   * Fluent API for setting chunking strategy
   * @param strategy Chunking strategy to use
   * @returns Self for chaining
   */
  with_strategy(strategy: string | ChunkingStrategy): EnterpriseChunker {
    this.options.chunking_strategy = strategy as ChunkingStrategy;
    return this;
  }

  /**
   * Chunk text with current configuration
   * @param text Text to chunk
   * @returns List of text chunks
   */
  chunk(text: string): string[] {
    return this.adaptive_chunk_text(
      text, 
      {
        max_tokens_per_chunk: this.options.max_tokens_per_chunk,
        overlap_tokens: this.options.overlap_tokens,
        chunking_strategy: this.options.chunking_strategy
      }
    );
  }

  /**
   * Context manager for semantic chunking
   */
  semantic_context(max_tokens?: number, overlap?: number): ChunkingContext {
    return new ChunkingContext(this, ChunkingStrategy.SEMANTIC, max_tokens, overlap);
  }

  /**
   * Context manager for structural chunking
   */
  structural_context(max_tokens?: number, overlap?: number): ChunkingContext {
    return new ChunkingContext(this, ChunkingStrategy.STRUCTURAL, max_tokens, overlap);
  }

  /**
   * Context manager for fixed-size chunking
   */
  fixed_size_context(max_tokens?: number, overlap?: number): ChunkingContext {
    return new ChunkingContext(this, ChunkingStrategy.FIXED_SIZE, max_tokens, overlap);
  }

  /**
   * Context manager for sentence-based chunking
   */
  sentence_context(max_tokens?: number, overlap?: number): ChunkingContext {
    return new ChunkingContext(this, ChunkingStrategy.SENTENCE, max_tokens, overlap);
  }
}

/**
 * Context manager for temporary chunking configuration
 */
export class ChunkingContext {
  private chunker: EnterpriseChunker;
  private previousStrategy: ChunkingStrategy;
  private previousMaxTokens: number;
  private previousOverlap: number;
  private strategy: ChunkingStrategy;
  private maxTokens?: number;
  private overlap?: number;

  /**
   * Initialize the context manager
   */
  constructor(
    chunker: EnterpriseChunker,
    strategy: ChunkingStrategy,
    maxTokens?: number,
    overlap?: number
  ) {
    this.chunker = chunker;
    this.strategy = strategy;
    this.maxTokens = maxTokens;
    this.overlap = overlap;
    
    // Store previous settings
    this.previousStrategy = this.chunker.options.chunking_strategy as ChunkingStrategy || ChunkingStrategy.ADAPTIVE;
    this.previousMaxTokens = this.chunker.options.max_tokens_per_chunk || 1000;
    this.previousOverlap = this.chunker.options.overlap_tokens || 0;
  }

  /**
   * Apply temporary settings
   */
  enter(): EnterpriseChunker {
    // Apply temporary settings
    this.chunker.options.chunking_strategy = this.strategy;
    
    if (this.maxTokens !== undefined) {
      this.chunker.options.max_tokens_per_chunk = this.maxTokens;
    }
    
    if (this.overlap !== undefined) {
      this.chunker.options.overlap_tokens = this.overlap;
    }
    
    return this.chunker;
  }

  /**
   * Restore original settings
   */
  exit(): void {
    // Restore original settings
    this.chunker.options.chunking_strategy = this.previousStrategy;
    this.chunker.options.max_tokens_per_chunk = this.previousMaxTokens;
    this.chunker.options.overlap_tokens = this.previousOverlap;
  }
}