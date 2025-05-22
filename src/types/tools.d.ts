/**
 * Type declarations for tools paths
 */

// Re-export types from the existing enterprise_chunker type definitions
// but make them available at the deep relative path imports
declare module '../../../../tools/enterprise_chunker/chunker' {
  export * from '@tools/enterprise_chunker/chunker';
}

// Handle different import depths
declare module '../../../tools/enterprise_chunker/chunker' {
  export * from '@tools/enterprise_chunker/chunker';
}

declare module '../../tools/enterprise_chunker/chunker' {
  export * from '@tools/enterprise_chunker/chunker';
}

declare module '../tools/enterprise_chunker/chunker' {
  export * from '@tools/enterprise_chunker/chunker';
}

// Define the actual module that will be referenced by the paths above
declare module '@tools/enterprise_chunker/chunker' {
  export interface ChunkerOptions {
    chunkSize?: number;
    chunkOverlap?: number;
    separators?: string[];
    modelTokenLimit?: number;
    encoding?: string;
  }

  export interface Chunk {
    text: string;
    metadata: {
      start: number;
      end: number;
      tokens: number;
    };
  }

  export class EnterpriseChunker {
    constructor(options?: ChunkerOptions);
    
    chunk(text: string): Chunk[];
    
    estimateTokens(text: string): number;
    
    getEncoding(): string;
    
    setEncoding(encoding: string): void;
    
    setChunkSize(size: number): void;
    
    setChunkOverlap(overlap: number): void;
    
    setSeparators(separators: string[]): void;
  }
}