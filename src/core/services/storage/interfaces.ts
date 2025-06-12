/**
 * Storage Service Interfaces
 *
 * Defines the contracts for the enhanced storage service that supports
 * file storage, document indexing, and vector embeddings.
 */

// File Storage Interfaces
export interface FileMetadata {
  filename: string;
  mimeType: string;
  size: number;
  uploadedBy: string;
  tags?: string[];
  description?: string;
  pluginId?: string;
}

export interface StoredFile {
  id: string;
  metadata: FileMetadata;
  uploadedAt: Date;
  url: string;
  checksum: string;
}

// Document Storage Interfaces
export interface Document {
  id?: string;
  title: string;
  content: string;
  type: 'markdown' | 'text' | 'html' | 'pdf' | 'code';
  metadata?: Record<string, any>;
  pluginId?: string;
  createdBy: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface SearchOptions {
  limit?: number;
  offset?: number;
  fields?: string[];
  highlight?: boolean;
  fuzzy?: boolean;
}

export interface SearchResult {
  document: Document;
  score: number;
  highlights?: Record<string, string[]>;
}

// Vector Storage Interfaces
export interface VectorMetadata {
  documentId?: string;
  chunkIndex?: number;
  text: string;
  pluginId?: string;
  [key: string]: any;
}

export interface VectorSearchResult {
  id: string;
  similarity: number;
  metadata: VectorMetadata;
  vector?: number[];
}

// Main Storage Service Interface
export interface StorageService {
  // Initialization
  initialize?(): Promise<void>;

  // File Storage
  uploadFile(file: Buffer, metadata: FileMetadata): Promise<StoredFile>;
  downloadFile(fileId: string): Promise<{ buffer: Buffer; metadata: FileMetadata }>;
  deleteFile(fileId: string): Promise<void>;
  listFiles(filter?: Partial<FileMetadata>): Promise<StoredFile[]>;
  getFileUrl(fileId: string): Promise<string>;

  // Document Storage with Full-Text Search
  indexDocument(doc: Document): Promise<Document>;
  updateDocument(id: string, doc: Partial<Document>): Promise<Document>;
  deleteDocument(id: string): Promise<void>;
  getDocument(id: string): Promise<Document | null>;
  searchDocuments(query: string, options?: SearchOptions): Promise<SearchResult[]>;

  // Vector Storage for Embeddings
  storeVector(id: string, vector: number[], metadata: VectorMetadata): Promise<void>;
  storeVectors(
    vectors: Array<{ id: string; vector: number[]; metadata: VectorMetadata }>
  ): Promise<void>;
  searchSimilar(
    vector: number[],
    limit: number,
    filter?: Record<string, any>
  ): Promise<VectorSearchResult[]>;
  deleteVector(id: string): Promise<void>;
  deleteVectors(filter: Record<string, any>): Promise<number>;

  // Utility Methods
  createBackup(path: string): Promise<void>;
  restoreBackup(path: string): Promise<void>;
  getStorageStats(): Promise<{
    fileCount: number;
    totalFileSize: number;
    documentCount: number;
    vectorCount: number;
  }>;
}

// Storage Configuration
export interface StorageConfig {
  postgres: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
    ssl?: boolean;
    poolSize?: number;
  };
  fileStorage: {
    type: 'local' | 's3' | 'minio';
    basePath?: string;
    bucket?: string;
    endpoint?: string;
    accessKey?: string;
    secretKey?: string;
  };
  elasticsearch?: {
    node: string;
    auth?: {
      username: string;
      password: string;
    };
  };
}
