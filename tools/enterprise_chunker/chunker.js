"use strict";
/**
 * TypeScript implementation of Enterprise Chunker
 *
 * This file provides a TypeScript wrapper for the enterprise_chunker Python module.
 * It reexports all types and interfaces from the index.d.ts file and provides
 * a basic implementation for TypeScript-only environments.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChunkingResult = exports.ChunkMetadata = exports.ChunkingOptions = exports.ContentFormat = exports.ChunkingStrategy = exports.EnterpriseChunker = void 0;
const index_1 = require("./index");
Object.defineProperty(exports, "ChunkingStrategy", { enumerable: true, get: function () { return index_1.ChunkingStrategy; } });
Object.defineProperty(exports, "ContentFormat", { enumerable: true, get: function () { return index_1.ContentFormat; } });
Object.defineProperty(exports, "ChunkingOptions", { enumerable: true, get: function () { return index_1.ChunkingOptions; } });
Object.defineProperty(exports, "ChunkMetadata", { enumerable: true, get: function () { return index_1.ChunkMetadata; } });
Object.defineProperty(exports, "ChunkingResult", { enumerable: true, get: function () { return index_1.ChunkingResult; } });
/**
 * Enterprise-grade text chunking utility for LLM processing
 */
class EnterpriseChunker {
    /**
     * Initialize the chunker with configuration options
     * @param options Optional configuration dictionary
     */
    constructor(options) {
        this.options = options || {};
    }
    /**
     * Main entry point: Adaptively chunk text based on content format
     * @param text Text content to chunk
     * @param max_tokens_per_chunk Maximum tokens per chunk (overrides class settings)
     * @param overlap_tokens Number of tokens to overlap between chunks
     * @param strategy Chunking strategy to use
     * @returns List of text chunks optimized for processing
     */
    adaptive_chunk_text(text, max_tokens_per_chunk, overlap_tokens, strategy) {
        // Basic implementation that just splits by newlines
        // In a real implementation, this would call the Python module
        const maxChars = max_tokens_per_chunk || this.options.max_tokens_per_chunk || 4000;
        const overlap = overlap_tokens || this.options.overlap_tokens || 200;
        // Split by newlines as a simple chunking strategy
        const lines = text.split('\n');
        const chunks = [];
        let currentChunk = '';
        for (const line of lines) {
            if (currentChunk.length + line.length + 1 > maxChars) {
                chunks.push(currentChunk);
                // Add overlap by including the last few characters
                const overlapText = currentChunk.slice(-overlap);
                currentChunk = overlapText + line + '\n';
            }
            else {
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
     * @returns Generator of text chunks
     */
    *chunk_stream(stream, options) {
        // In a real implementation, this would chunk a stream
        // For now, just process as a string
        if (typeof stream === 'string') {
            const chunks = this.adaptive_chunk_text(stream, options?.max_tokens_per_chunk, options?.overlap_tokens, options?.chunking_strategy);
            for (const chunk of chunks) {
                yield chunk;
            }
        }
        else {
            // Return an empty generator for now
            return;
        }
    }
    /**
     * Fluent API for setting max tokens per chunk
     * @param max_tokens Maximum tokens per chunk
     * @returns Self for chaining
     */
    with_max_tokens(max_tokens) {
        this.options.max_tokens_per_chunk = max_tokens;
        return this;
    }
    /**
     * Fluent API for setting overlap tokens
     * @param overlap_tokens Number of tokens to overlap
     * @returns Self for chaining
     */
    with_overlap(overlap_tokens) {
        this.options.overlap_tokens = overlap_tokens;
        return this;
    }
    /**
     * Fluent API for setting chunking strategy
     * @param strategy Chunking strategy to use
     * @returns Self for chaining
     */
    with_strategy(strategy) {
        this.options.chunking_strategy = strategy;
        return this;
    }
    /**
     * Chunk text with current configuration
     * @param text Text to chunk
     * @returns List of text chunks
     */
    chunk(text) {
        return this.adaptive_chunk_text(text, this.options.max_tokens_per_chunk, this.options.overlap_tokens, this.options.chunking_strategy);
    }
}
exports.EnterpriseChunker = EnterpriseChunker;
//# sourceMappingURL=chunker.js.map