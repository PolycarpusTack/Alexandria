/**
 * In-Memory Storage Service Implementation
 *
 * A minimal implementation of the StorageService interface that stores
 * everything in memory. Useful for development or when PostgreSQL with
 * vector extension is not available.
 */

import {
  StorageService,
  FileMetadata,
  StoredFile,
  Document,
  SearchOptions,
  SearchResult,
  VectorMetadata,
  VectorSearchResult
} from './interfaces';
import { Logger } from '../../../utils/logger';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';

export class InMemoryStorageService implements StorageService {
  private files: Map<
    string,
    {
      file: StoredFile;
      buffer: Buffer;
    }
  > = new Map();

  private documents: Map<string, Document> = new Map();
  private vectors: Map<
    string,
    {
      id: string;
      vector: number[];
      metadata: VectorMetadata;
    }
  > = new Map();

  private fileBasePath: string;
  private initialized = false;

  constructor(private logger: Logger) {
    this.fileBasePath = process.env.FILE_STORAGE_PATH || './storage/files';
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Create file storage directory
      await fs.mkdir(this.fileBasePath, { recursive: true });

      this.initialized = true;
      this.logger.info('In-memory storage service initialized', {
        component: 'InMemoryStorageService'
      });
    } catch (error) {
      this.logger.error('Failed to initialize in-memory storage service', {
        component: 'InMemoryStorageService',
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  // File Storage Implementation
  async uploadFile(buffer: Buffer, metadata: FileMetadata): Promise<StoredFile> {
    const fileId = crypto.randomUUID();
    const checksum = crypto.createHash('sha256').update(buffer).digest('hex');
    const storagePath = path.join(fileId.substring(0, 2), fileId.substring(2, 4), fileId);
    const fullPath = path.join(this.fileBasePath, storagePath);

    try {
      // Create directory structure
      await fs.mkdir(path.dirname(fullPath), { recursive: true });

      // Write file to disk
      await fs.writeFile(fullPath, buffer);

      const storedFile: StoredFile = {
        id: fileId,
        metadata,
        uploadedAt: new Date(),
        url: `/api/storage/files/${fileId}`,
        checksum
      };

      this.files.set(fileId, { file: storedFile, buffer });

      return storedFile;
    } catch (error) {
      this.logger.error('Failed to upload file', { error });
      throw error;
    }
  }

  async downloadFile(fileId: string): Promise<{ buffer: Buffer; metadata: FileMetadata }> {
    const file = this.files.get(fileId);

    if (!file) {
      throw new Error(`File not found: ${fileId}`);
    }

    return {
      buffer: file.buffer,
      metadata: file.file.metadata
    };
  }

  async deleteFile(fileId: string): Promise<void> {
    const file = this.files.get(fileId);

    if (file) {
      this.files.delete(fileId);
    }
  }

  async listFiles(filter?: Partial<FileMetadata>): Promise<StoredFile[]> {
    let results = Array.from(this.files.values()).map((f) => f.file);

    if (filter) {
      if (filter.pluginId) {
        results = results.filter((f) => f.metadata.pluginId === filter.pluginId);
      }

      if (filter.uploadedBy) {
        results = results.filter((f) => f.metadata.uploadedBy === filter.uploadedBy);
      }

      if (filter.tags && filter.tags.length > 0) {
        results = results.filter((f) => {
          if (!f.metadata.tags) return false;
          return filter.tags!.some((tag) => f.metadata.tags!.includes(tag));
        });
      }
    }

    return results;
  }

  async getFileUrl(fileId: string): Promise<string> {
    return `/api/storage/files/${fileId}`;
  }

  // Document Storage Implementation
  async indexDocument(doc: Document): Promise<Document> {
    const id = doc.id || crypto.randomUUID();
    const now = new Date();

    const document: Document = {
      ...doc,
      id,
      createdAt: doc.createdAt || now,
      updatedAt: now
    };

    this.documents.set(id, document);

    return document;
  }

  async updateDocument(id: string, doc: Partial<Document>): Promise<Document> {
    const existingDoc = this.documents.get(id);

    if (!existingDoc) {
      throw new Error(`Document not found: ${id}`);
    }

    const updatedDoc: Document = {
      ...existingDoc,
      ...doc,
      updatedAt: new Date()
    };

    this.documents.set(id, updatedDoc);

    return updatedDoc;
  }

  async deleteDocument(id: string): Promise<void> {
    this.documents.delete(id);
  }

  async getDocument(id: string): Promise<Document | null> {
    return this.documents.get(id) || null;
  }

  async searchDocuments(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    const limit = options?.limit || 10;
    const offset = options?.offset || 0;

    // Very simple search implementation that just looks for the query string in title and content
    const results = Array.from(this.documents.values())
      .filter((doc) => {
        const titleMatch = doc.title.toLowerCase().includes(query.toLowerCase());
        const contentMatch = doc.content.toLowerCase().includes(query.toLowerCase());
        return titleMatch || contentMatch;
      })
      .map((doc) => ({
        document: doc,
        score: 1.0,
        highlights: options?.highlight
          ? {
              title: [doc.title],
              content: [doc.content.substring(0, 100) + '...']
            }
          : undefined
      }))
      .slice(offset, offset + limit);

    return results;
  }

  // Vector Storage Implementation
  async storeVector(id: string, vector: number[], metadata: VectorMetadata): Promise<void> {
    this.vectors.set(id, { id, vector, metadata });
  }

  async storeVectors(
    vectors: Array<{ id: string; vector: number[]; metadata: VectorMetadata }>
  ): Promise<void> {
    for (const item of vectors) {
      this.vectors.set(item.id, item);
    }
  }

  async searchSimilar(
    vector: number[],
    limit: number,
    filter?: Record<string, any>
  ): Promise<VectorSearchResult[]> {
    // Very basic implementation that doesn't do true vector similarity
    // Just returns vectors based on filter criteria
    let results = Array.from(this.vectors.values());

    if (filter) {
      if (filter.pluginId) {
        results = results.filter((v) => v.metadata.pluginId === filter.pluginId);
      }

      if (filter.documentId) {
        results = results.filter((v) => v.metadata.documentId === filter.documentId);
      }
    }

    return results.slice(0, limit).map((item) => ({
      id: item.id,
      similarity: 0.5, // Placeholder similarity score
      metadata: item.metadata
    }));
  }

  async deleteVector(id: string): Promise<void> {
    this.vectors.delete(id);
  }

  async deleteVectors(filter: Record<string, any>): Promise<number> {
    let count = 0;

    for (const [id, item] of this.vectors.entries()) {
      let shouldDelete = true;

      if (filter.pluginId && item.metadata.pluginId !== filter.pluginId) {
        shouldDelete = false;
      }

      if (filter.documentId && item.metadata.documentId !== filter.documentId) {
        shouldDelete = false;
      }

      if (shouldDelete) {
        this.vectors.delete(id);
        count++;
      }
    }

    return count;
  }

  // Utility Methods
  async createBackup(path: string): Promise<void> {
    const data = {
      files: Array.from(this.files.entries()),
      documents: Array.from(this.documents.entries()),
      vectors: Array.from(this.vectors.entries())
    };

    await fs.writeFile(path, JSON.stringify(data, null, 2));
    this.logger.info(`In-memory storage backup created at: ${path}`);
  }

  async restoreBackup(path: string): Promise<void> {
    try {
      const data = JSON.parse(await fs.readFile(path, 'utf8'));

      this.files = new Map(data.files || []);
      this.documents = new Map(data.documents || []);
      this.vectors = new Map(data.vectors || []);

      this.logger.info(`In-memory storage restored from: ${path}`);
    } catch (error) {
      this.logger.error('Failed to restore in-memory storage backup', { error });
      throw error;
    }
  }

  async getStorageStats(): Promise<{
    fileCount: number;
    totalFileSize: number;
    documentCount: number;
    vectorCount: number;
  }> {
    const totalFileSize = Array.from(this.files.values()).reduce(
      (total, { buffer }) => total + buffer.length,
      0
    );

    return {
      fileCount: this.files.size,
      totalFileSize,
      documentCount: this.documents.size,
      vectorCount: this.vectors.size
    };
  }
}
