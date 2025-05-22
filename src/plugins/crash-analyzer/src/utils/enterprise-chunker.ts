/**
 * Node.js wrapper for the Python EnterpriseChunker
 * Provides a seamless interface to the Python chunker implementation
 */

import { spawnSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { Logger } from '../../../../utils/logger';

/**
 * Available chunking strategies
 */
export enum ChunkingStrategy {
  ADAPTIVE = 'adaptive',
  SEMANTIC = 'semantic',
  STRUCTURAL = 'structural',
  FIXED_SIZE = 'fixed_size',
  SENTENCE = 'sentence'
}

/**
 * Chunking options for the Enterprise Chunker
 */
export interface ChunkingOptions {
  strategy?: ChunkingStrategy | string;
  max_tokens_per_chunk?: number;
  overlap_tokens?: number;
  preserve_structure?: boolean;
  overlap?: number; // Alias for overlap_tokens
}

/**
 * A Node.js wrapper for the Python EnterpriseChunker
 */
export class EnterpriseChunker {
  private pythonPath: string;
  private chunkerPath: string;
  private logger?: Logger;

  /**
   * Create a new EnterpriseChunker instance
   * 
   * @param logger Optional logger for error reporting
   */
  constructor(logger?: Logger) {
    this.logger = logger;
    
    // Find Python executable and EnterpriseChunker script
    this.pythonPath = process.env.PYTHON_PATH || 'python3';
    this.chunkerPath = path.resolve(
      process.env.ENTERPRISE_CHUNKER_PATH || 
      path.join(__dirname, '..', '..', '..', '..', '..', 'tools', 'enterprise_chunker', 'chunker.py')
    );
    
    // Verify chunker script exists, but don't throw error (will use fallback)
    if (!fs.existsSync(this.chunkerPath)) {
      this.log('warn', `EnterpriseChunker script not found at: ${this.chunkerPath}, will use fallback chunking`);
    }
  }

  /**
   * Adaptively chunk text based on content
   * 
   * @param text Text to chunk
   * @param options Chunking options
   * @returns Array of optimized chunks
   */
  adaptive_chunk_text(
    text: string, 
    options: ChunkingOptions = {}
  ): string[] {
    try {
      // Check if the chunker script exists
      if (!fs.existsSync(this.chunkerPath)) {
        return this.fallbackChunking(text, options.max_tokens_per_chunk);
      }
      
      // Create a temporary file for the input text
      const tempInput = path.join(os.tmpdir(), `input-${Date.now()}.txt`);
      fs.writeFileSync(tempInput, text);
      
      // Create a temporary file for the output
      const tempOutput = path.join(os.tmpdir(), `output-${Date.now()}.json`);
      
      // Prepare command arguments
      const args = [
        this.chunkerPath,
        '--input', tempInput,
        '--output', tempOutput,
        '--format', 'json'
      ];
      
      // Add options
      if (options.strategy) {
        args.push('--strategy', options.strategy);
      }
      
      if (options.max_tokens_per_chunk) {
        args.push('--max-tokens', options.max_tokens_per_chunk.toString());
      }
      
      if (options.overlap_tokens) {
        args.push('--overlap', options.overlap_tokens.toString());
      }
      
      // Execute Python script
      const result = spawnSync(this.pythonPath, args);
      
      // Check for errors
      if (result.status !== 0) {
        this.log('error', `Error executing EnterpriseChunker: ${result.stderr.toString()}`);
        
        // Fall back to naive chunking
        return this.fallbackChunking(text, options.max_tokens_per_chunk);
      }
      
      // Parse output
      if (!fs.existsSync(tempOutput)) {
        this.log('error', 'EnterpriseChunker did not produce output file');
        return this.fallbackChunking(text, options.max_tokens_per_chunk);
      }
      
      const output = fs.readFileSync(tempOutput, 'utf8');
      let chunks: string[];
      
      try {
        chunks = JSON.parse(output).chunks;
      } catch (parseError) {
        this.log('error', `Error parsing EnterpriseChunker output: ${parseError}`);
        return this.fallbackChunking(text, options.max_tokens_per_chunk);
      }
      
      // Clean up temporary files
      try {
        fs.unlinkSync(tempInput);
        fs.unlinkSync(tempOutput);
      } catch (cleanupError) {
        this.log('warn', `Error cleaning up temporary files: ${cleanupError}`);
      }
      
      return chunks;
    } catch (error) {
      this.log('error', `Error in EnterpriseChunker: ${error}`);
      
      // Fall back to naive chunking
      return this.fallbackChunking(text, options.max_tokens_per_chunk);
    }
  }
  
  /**
   * Simple fallback chunking method when Python integration fails
   * 
   * @param text Text to chunk
   * @param maxTokens Maximum tokens per chunk
   * @returns Array of chunks
   */
  private fallbackChunking(text: string, maxTokens?: number): string[] {
    // Approximate chars per token - standard measure for English text
    const charsPerToken = 4;
    
    // Default to 2000 tokens if not specified
    const chunkSize = (maxTokens || 2000) * charsPerToken;
    
    // Try to split by paragraphs first
    const paragraphs = text.split(/\n\s*\n/);
    
    if (paragraphs.length > 1) {
      // Combine paragraphs into chunks
      const chunks: string[] = [];
      let currentChunk = '';
      
      for (const paragraph of paragraphs) {
        if (currentChunk.length + paragraph.length + 2 <= chunkSize) {
          // Add paragraph to current chunk
          currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
        } else {
          // Start new chunk
          if (currentChunk) {
            chunks.push(currentChunk);
          }
          currentChunk = paragraph;
        }
      }
      
      // Add final chunk
      if (currentChunk) {
        chunks.push(currentChunk);
      }
      
      return chunks;
    } else {
      // No paragraphs, split by size
      const chunks: string[] = [];
      for (let i = 0; i < text.length; i += chunkSize) {
        chunks.push(text.substring(i, i + chunkSize));
      }
      return chunks;
    }
  }
  
  /**
   * Log a message if a logger is available
   * 
   * @param level Log level
   * @param message Message to log
   * @param meta Optional metadata
   */
  private log(level: 'info' | 'warn' | 'error', message: string, meta?: any): void {
    if (!this.logger) return;
    
    switch (level) {
      case 'info':
        this.logger.info(message, meta);
        break;
      case 'warn':
        this.logger.warn(message, meta);
        break;
      case 'error':
        this.logger.error(message, meta);
        break;
    }
  }

  /**
   * Stream chunks from text or stream
   * @param stream Text or stream to chunk
   * @param options Chunking options
   * @returns Async generator of chunks
   */
  async *chunk_stream(
    stream: string | NodeJS.ReadableStream,
    options: ChunkingOptions = {}
  ): AsyncGenerator<string> {
    // In the Node.js wrapper, we actually process all text at once
    // This is a simplified implementation that reads the entire stream into memory
    try {
      let text: string;
      
      if (typeof stream === 'string') {
        text = stream;
      } else {
        // Read the stream into a buffer
        const chunks: Buffer[] = [];
        
        for await (const chunk of stream) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        
        text = Buffer.concat(chunks).toString('utf8');
      }
      
      // Now chunk the text
      const textChunks = this.adaptive_chunk_text(text, options);
      
      // Yield each chunk
      for (const chunk of textChunks) {
        yield chunk;
      }
    } catch (error) {
      this.log('error', `Error in chunk_stream: ${error}`);
      // Yield the empty string as a way to indicate an error
      yield '';
    }
  }
}