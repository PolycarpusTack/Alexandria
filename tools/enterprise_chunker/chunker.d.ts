/**
 * TypeScript implementation of Enterprise Chunker
 *
 * This file provides a TypeScript wrapper for the enterprise_chunker Python module.
 * It reexports all types and interfaces from the index.d.ts file and provides
 * a basic implementation for TypeScript-only environments.
 */
/// <reference types="node" />
/// <reference types="styled-components" />
import { ChunkingStrategy, ContentFormat, ChunkingOptions, ChunkMetadata, ChunkingResult } from './index';
/**
 * Enterprise-grade text chunking utility for LLM processing
 */
export declare class EnterpriseChunker {
    private options;
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
    adaptive_chunk_text(text: string, max_tokens_per_chunk?: number, overlap_tokens?: number, strategy?: string | ChunkingStrategy): string[];
    /**
     * Process a text stream by dynamically chunking it as it's read
     * @param stream Text stream to process
     * @param options Additional options for chunking
     * @returns Generator of text chunks
     */
    chunk_stream(stream: string | NodeJS.ReadableStream, options?: ChunkingOptions): Generator<string>;
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
export { ChunkingStrategy, ContentFormat, ChunkingOptions, ChunkMetadata, ChunkingResult };
