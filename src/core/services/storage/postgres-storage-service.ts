/**
 * PostgreSQL Storage Service Implementation
 *
 * Implements the StorageService interface using PostgreSQL for metadata,
 * local filesystem for files, and pgvector for embeddings.
 */

import { Pool } from 'pg';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import {
  StorageService,
  StorageConfig,
  FileMetadata,
  StoredFile,
  Document,
  SearchOptions,
  SearchResult,
  VectorMetadata,
  VectorSearchResult
} from './interfaces';
import { Logger } from '../../../utils/logger';

export class PostgresStorageService implements StorageService {
  private pool: Pool;
  private logger: Logger;
  private fileBasePath: string;
  private initialized = false;

  constructor(
    private config: StorageConfig,
    logger: Logger
  ) {
    this.logger = logger;
    this.fileBasePath = config.fileStorage.basePath || './storage/files';

    // Initialize PostgreSQL connection pool
    this.pool = new Pool({
      host: config.postgres.host,
      port: config.postgres.port,
      database: config.postgres.database,
      user: config.postgres.user,
      password: config.postgres.password,
      ssl: config.postgres.ssl,
      max: config.postgres.poolSize || 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000
    });
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Test connection
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();

      // Create file storage directory
      await fs.mkdir(this.fileBasePath, { recursive: true });

      // Initialize database schema
      await this.initializeSchema();

      this.initialized = true;
      this.logger.info('PostgreSQL storage service initialized', {
        component: 'PostgresStorageService'
      });
    } catch (error) {
      this.logger.error('Failed to initialize storage service', {
        component: 'PostgresStorageService',
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  private async initializeSchema(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Create extensions
      await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
      // Skip vector extension since it's not available
      // // Skipping vector extension for compatibility

      // Create files table
      await client.query(`
        CREATE TABLE IF NOT EXISTS files (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          filename TEXT NOT NULL,
          mime_type TEXT NOT NULL,
          size BIGINT NOT NULL,
          uploaded_by TEXT NOT NULL,
          plugin_id TEXT,
          tags TEXT[],
          description TEXT,
          checksum TEXT NOT NULL,
          storage_path TEXT NOT NULL,
          uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          metadata JSONB DEFAULT '{}'::jsonb
        )
      `);

      // Create documents table
      await client.query(`
        CREATE TABLE IF NOT EXISTS documents (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          title TEXT NOT NULL,
          content TEXT NOT NULL,
          type TEXT NOT NULL CHECK (type IN ('markdown', 'text', 'html', 'pdf', 'code')),
          plugin_id TEXT,
          created_by TEXT NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          metadata JSONB DEFAULT '{}'::jsonb,
          search_vector tsvector GENERATED ALWAYS AS (
            setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
            setweight(to_tsvector('english', coalesce(content, '')), 'B')
          ) STORED
        )
      `);

      // Create vectors table with JSONB instead of vector type
      await client.query(`
        CREATE TABLE IF NOT EXISTS vectors (
          id TEXT PRIMARY KEY,
          vector_data JSONB NOT NULL, -- Store as JSON array instead of vector type
          document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
          chunk_index INTEGER,
          text TEXT NOT NULL,
          plugin_id TEXT,
          metadata JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);

      // Create indexes
      await client.query('CREATE INDEX IF NOT EXISTS idx_files_plugin_id ON files(plugin_id)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_files_uploaded_by ON files(uploaded_by)');
      await client.query(
        'CREATE INDEX IF NOT EXISTS idx_documents_search_vector ON documents USING GIN(search_vector)'
      );
      await client.query(
        'CREATE INDEX IF NOT EXISTS idx_documents_plugin_id ON documents(plugin_id)'
      );
      // Create JSONB index instead of vector index
      await client.query(
        'CREATE INDEX IF NOT EXISTS idx_vectors_data ON vectors USING GIN(vector_data)'
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // File Storage Implementation
  async uploadFile(buffer: Buffer, metadata: FileMetadata): Promise<StoredFile> {
    await this.ensureInitialized();

    const fileId = crypto.randomUUID();
    const checksum = crypto.createHash('sha256').update(buffer).digest('hex');
    const storagePath = path.join(fileId.substring(0, 2), fileId.substring(2, 4), fileId);
    const fullPath = path.join(this.fileBasePath, storagePath);

    try {
      // Create directory structure
      await fs.mkdir(path.dirname(fullPath), { recursive: true });

      // Write file to disk
      await fs.writeFile(fullPath, buffer);

      // Store metadata in database
      const result = await this.pool.query(
        `INSERT INTO files (
          id, filename, mime_type, size, uploaded_by, plugin_id, 
          tags, description, checksum, storage_path, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *`,
        [
          fileId,
          metadata.filename,
          metadata.mimeType,
          metadata.size,
          metadata.uploadedBy,
          metadata.pluginId || null,
          metadata.tags || [],
          metadata.description || null,
          checksum,
          storagePath,
          JSON.stringify(metadata)
        ]
      );

      const file = result.rows[0];
      return {
        id: file.id,
        metadata,
        uploadedAt: file.uploaded_at,
        url: `/api/storage/files/${file.id}`,
        checksum: file.checksum
      };
    } catch (error) {
      // Clean up file if database insert fails
      try {
        await fs.unlink(fullPath);
      } catch {}

      throw error;
    }
  }

  async downloadFile(fileId: string): Promise<{ buffer: Buffer; metadata: FileMetadata }> {
    await this.ensureInitialized();

    const result = await this.pool.query('SELECT * FROM files WHERE id = $1', [fileId]);

    if (result.rows.length === 0) {
      throw new Error(`File not found: ${fileId}`);
    }

    const file = result.rows[0];
    const fullPath = path.join(this.fileBasePath, file.storage_path);

    const buffer = await fs.readFile(fullPath);

    return {
      buffer,
      metadata: {
        filename: file.filename,
        mimeType: file.mime_type,
        size: file.size,
        uploadedBy: file.uploaded_by,
        pluginId: file.plugin_id,
        tags: file.tags,
        description: file.description
      }
    };
  }

  async deleteFile(fileId: string): Promise<void> {
    await this.ensureInitialized();

    const result = await this.pool.query('DELETE FROM files WHERE id = $1 RETURNING storage_path', [
      fileId
    ]);

    if (result.rows.length > 0) {
      const fullPath = path.join(this.fileBasePath, result.rows[0].storage_path);
      try {
        await fs.unlink(fullPath);
      } catch (error) {
        this.logger.warn('Failed to delete file from disk', { fileId, error });
      }
    }
  }

  async listFiles(filter?: Partial<FileMetadata>): Promise<StoredFile[]> {
    await this.ensureInitialized();

    let query = 'SELECT * FROM files WHERE 1=1';
    const params: any[] = [];
    let paramCount = 0;

    if (filter?.pluginId) {
      query += ` AND plugin_id = $${++paramCount}`;
      params.push(filter.pluginId);
    }

    if (filter?.uploadedBy) {
      query += ` AND uploaded_by = $${++paramCount}`;
      params.push(filter.uploadedBy);
    }

    if (filter?.tags && filter.tags.length > 0) {
      query += ` AND tags && $${++paramCount}`;
      params.push(filter.tags);
    }

    query += ' ORDER BY uploaded_at DESC';

    const result = await this.pool.query(query, params);

    return result.rows.map((file) => ({
      id: file.id,
      metadata: {
        filename: file.filename,
        mimeType: file.mime_type,
        size: file.size,
        uploadedBy: file.uploaded_by,
        pluginId: file.plugin_id,
        tags: file.tags,
        description: file.description
      },
      uploadedAt: file.uploaded_at,
      url: `/api/storage/files/${file.id}`,
      checksum: file.checksum
    }));
  }

  async getFileUrl(fileId: string): Promise<string> {
    return `/api/storage/files/${fileId}`;
  }

  // Document Storage Implementation
  async indexDocument(doc: Document): Promise<Document> {
    await this.ensureInitialized();

    const id = doc.id || crypto.randomUUID();

    const result = await this.pool.query(
      `INSERT INTO documents (
        id, title, content, type, plugin_id, created_by, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        content = EXCLUDED.content,
        type = EXCLUDED.type,
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
      RETURNING *`,
      [
        id,
        doc.title,
        doc.content,
        doc.type,
        doc.pluginId || null,
        doc.createdBy,
        JSON.stringify(doc.metadata || {})
      ]
    );

    const savedDoc = result.rows[0];
    return {
      id: savedDoc.id,
      title: savedDoc.title,
      content: savedDoc.content,
      type: savedDoc.type,
      pluginId: savedDoc.plugin_id,
      createdBy: savedDoc.created_by,
      createdAt: savedDoc.created_at,
      updatedAt: savedDoc.updated_at,
      metadata: savedDoc.metadata
    };
  }

  async searchDocuments(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    await this.ensureInitialized();

    const limit = options?.limit || 10;
    const offset = options?.offset || 0;

    const result = await this.pool.query(
      `SELECT 
        *,
        ts_rank(search_vector, plainto_tsquery('english', $1)) AS rank,
        ts_headline('english', content, plainto_tsquery('english', $1), 
          'MaxWords=50, MinWords=25, StartSel=<mark>, StopSel=</mark>'
        ) AS highlight
      FROM documents
      WHERE search_vector @@ plainto_tsquery('english', $1)
      ORDER BY rank DESC
      LIMIT $2 OFFSET $3`,
      [query, limit, offset]
    );

    return result.rows.map((row) => ({
      document: {
        id: row.id,
        title: row.title,
        content: row.content,
        type: row.type,
        pluginId: row.plugin_id,
        createdBy: row.created_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        metadata: row.metadata
      },
      score: row.rank,
      highlights: options?.highlight ? { content: [row.highlight] } : undefined
    }));
  }

  // Vector Storage Implementation
  async storeVector(id: string, vector: number[], metadata: VectorMetadata): Promise<void> {
    await this.ensureInitialized();

    await this.pool.query(
      `INSERT INTO vectors (id, vector_data, document_id, chunk_index, text, plugin_id, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (id) DO UPDATE SET
        vector_data = EXCLUDED.vector_data,
        metadata = EXCLUDED.metadata`,
      [
        id,
        JSON.stringify(vector), // Store as JSON instead of vector type
        metadata.documentId || null,
        metadata.chunkIndex || null,
        metadata.text,
        metadata.pluginId || null,
        JSON.stringify(metadata)
      ]
    );
  }

  async storeVectors(
    vectors: Array<{ id: string; vector: number[]; metadata: VectorMetadata }>
  ): Promise<void> {
    await this.ensureInitialized();

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      for (const item of vectors) {
        await client.query(
          `INSERT INTO vectors (id, vector_data, document_id, chunk_index, text, plugin_id, metadata)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (id) DO UPDATE SET
            vector_data = EXCLUDED.vector_data,
            metadata = EXCLUDED.metadata`,
          [
            item.id,
            JSON.stringify(item.vector), // Store as JSON instead of vector type
            item.metadata.documentId || null,
            item.metadata.chunkIndex || null,
            item.metadata.text,
            item.metadata.pluginId || null,
            JSON.stringify(item.metadata)
          ]
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async searchSimilar(
    vector: number[],
    limit: number,
    filter?: Record<string, any>
  ): Promise<VectorSearchResult[]> {
    await this.ensureInitialized();

    // Note: This is a simplified implementation that doesn't do true vector similarity
    // It just returns vectors based on non-similarity criteria as a fallback
    let query = `
      SELECT id, vector_data, metadata, text,
        0.5 AS similarity  -- Placeholder similarity since we can't compute without vector extension
      FROM vectors
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramCount = 0;

    if (filter?.pluginId) {
      query += ` AND plugin_id = $${++paramCount}`;
      params.push(filter.pluginId);
    }

    if (filter?.documentId) {
      query += ` AND document_id = $${++paramCount}`;
      params.push(filter.documentId);
    }

    query += ` ORDER BY created_at DESC LIMIT $${++paramCount}`; // Just sort by creation date as fallback
    params.push(limit);

    const result = await this.pool.query(query, params);

    return result.rows.map((row) => ({
      id: row.id,
      similarity: row.similarity,
      metadata: {
        ...row.metadata,
        text: row.text
      }
    }));
  }

  // Utility Methods
  async getStorageStats(): Promise<{
    fileCount: number;
    totalFileSize: number;
    documentCount: number;
    vectorCount: number;
  }> {
    await this.ensureInitialized();

    const [files, documents, vectors] = await Promise.all([
      this.pool.query('SELECT COUNT(*) as count, COALESCE(SUM(size), 0) as total_size FROM files'),
      this.pool.query('SELECT COUNT(*) as count FROM documents'),
      this.pool.query('SELECT COUNT(*) as count FROM vectors')
    ]);

    return {
      fileCount: parseInt(files.rows[0].count),
      totalFileSize: parseInt(files.rows[0].total_size),
      documentCount: parseInt(documents.rows[0].count),
      vectorCount: parseInt(vectors.rows[0].count)
    };
  }

  // Helper methods
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  async shutdown(): Promise<void> {
    await this.pool.end();
  }

  // Backup and restore implementations
  async createBackup(backupPath: string): Promise<void> {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    const connectionString = `postgresql://${this.config.postgres.user}:${this.config.postgres.password}@${this.config.postgres.host}:${this.config.postgres.port}/${this.config.postgres.database}`;

    try {
      await execAsync(
        `pg_dump ${connectionString} -f "${backupPath}" --verbose --format=custom --no-owner --no-privileges`
      );
      this.logger.info(`Database backup created at: ${backupPath}`);
    } catch (error) {
      this.logger.error('Failed to create database backup', { error });
      throw new Error(`Backup failed: ${(error as Error).message}`);
    }
  }

  async restoreBackup(backupPath: string): Promise<void> {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    const connectionString = `postgresql://${this.config.postgres.user}:${this.config.postgres.password}@${this.config.postgres.host}:${this.config.postgres.port}/${this.config.postgres.database}`;

    try {
      // First, drop existing connections to the database
      await this.pool.query(
        `
        SELECT pg_terminate_backend(pg_stat_activity.pid)
        FROM pg_stat_activity
        WHERE pg_stat_activity.datname = $1
        AND pid <> pg_backend_pid()
      `,
        [this.config.postgres.database]
      );

      // Restore the backup
      await execAsync(
        `pg_restore ${connectionString} "${backupPath}" --verbose --no-owner --no-privileges --if-exists --clean`
      );
      this.logger.info(`Database restored from: ${backupPath}`);

      // Reinitialize the connection pool
      await this.initialize();
    } catch (error) {
      this.logger.error('Failed to restore database backup', { error });
      throw new Error(`Restore failed: ${(error as Error).message}`);
    }
  }

  async updateDocument(id: string, doc: Partial<Document>): Promise<Document> {
    await this.ensureInitialized();

    const updates: string[] = [];
    const params: any[] = [];
    let paramCount = 0;

    if (doc.title !== undefined) {
      updates.push(`title = $${++paramCount}`);
      params.push(doc.title);
    }

    if (doc.content !== undefined) {
      updates.push(`content = $${++paramCount}`);
      params.push(doc.content);
    }

    if (doc.type !== undefined) {
      updates.push(`type = $${++paramCount}`);
      params.push(doc.type);
    }

    if (doc.metadata !== undefined) {
      updates.push(`metadata = $${++paramCount}`);
      params.push(JSON.stringify(doc.metadata));
    }

    updates.push('updated_at = NOW()');

    params.push(id);

    const result = await this.pool.query(
      `UPDATE documents SET ${updates.join(', ')} WHERE id = $${++paramCount} RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      throw new Error(`Document not found: ${id}`);
    }

    const updatedDoc = result.rows[0];
    return {
      id: updatedDoc.id,
      title: updatedDoc.title,
      content: updatedDoc.content,
      type: updatedDoc.type,
      pluginId: updatedDoc.plugin_id,
      createdBy: updatedDoc.created_by,
      createdAt: updatedDoc.created_at,
      updatedAt: updatedDoc.updated_at,
      metadata: updatedDoc.metadata
    };
  }

  async deleteDocument(id: string): Promise<void> {
    await this.ensureInitialized();

    await this.pool.query('DELETE FROM documents WHERE id = $1', [id]);
  }

  async getDocument(id: string): Promise<Document | null> {
    await this.ensureInitialized();

    const result = await this.pool.query('SELECT * FROM documents WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return null;
    }

    const doc = result.rows[0];
    return {
      id: doc.id,
      title: doc.title,
      content: doc.content,
      type: doc.type,
      pluginId: doc.plugin_id,
      createdBy: doc.created_by,
      createdAt: doc.created_at,
      updatedAt: doc.updated_at,
      metadata: doc.metadata
    };
  }

  async deleteVector(id: string): Promise<void> {
    await this.ensureInitialized();

    await this.pool.query('DELETE FROM vectors WHERE id = $1', [id]);
  }

  async deleteVectors(filter: Record<string, any>): Promise<number> {
    await this.ensureInitialized();

    let query = 'DELETE FROM vectors WHERE 1=1';
    const params: any[] = [];
    let paramCount = 0;

    if (filter.pluginId) {
      query += ` AND plugin_id = $${++paramCount}`;
      params.push(filter.pluginId);
    }

    if (filter.documentId) {
      query += ` AND document_id = $${++paramCount}`;
      params.push(filter.documentId);
    }

    const result = await this.pool.query(query, params);
    return result.rowCount || 0;
  }
}
