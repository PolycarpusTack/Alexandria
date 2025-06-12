import { IUploadedFile } from './interfaces';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

/**
 * UploadedFile model implementation
 */
export class UploadedFile implements IUploadedFile {
  id: string;
  sessionId: string;
  userId: string;
  filename: string;
  path: string;
  mimeType: string;
  size: number;
  checksum: string;
  uploadedAt: Date;
  content?: string;
  metadata?: Record<string, any>;

  /**
   * Create a new UploadedFile instance
   *
   * @param data Uploaded file data, partial or complete
   */
  constructor(data: Partial<IUploadedFile>) {
    this.id = data.id || uuidv4();
    this.sessionId = data.sessionId || '';
    this.userId = data.userId || '';
    this.filename = data.filename || '';
    this.path = data.path || '';
    this.mimeType = data.mimeType || 'text/plain';
    this.size = data.size || 0;
    this.checksum = data.checksum || '';
    this.uploadedAt = data.uploadedAt || new Date();
    this.content = data.content;
    this.metadata = data.metadata || {};
  }

  /**
   * Validate uploaded file data
   *
   * @returns true if valid, throws error if invalid
   */
  validate(): boolean {
    if (!this.sessionId || this.sessionId.trim() === '') {
      throw new Error('Session ID is required');
    }

    if (!this.userId || this.userId.trim() === '') {
      throw new Error('User ID is required');
    }

    if (!this.filename || this.filename.trim() === '') {
      throw new Error('Filename is required');
    }

    if (!this.path || this.path.trim() === '') {
      throw new Error('File path is required');
    }

    return true;
  }

  /**
   * Get file extension
   *
   * @returns File extension or empty string
   */
  getExtension(): string {
    return path.extname(this.filename).toLowerCase();
  }

  /**
   * Check if file is a text file
   *
   * @returns true if text file
   */
  isTextFile(): boolean {
    const textMimeTypes = [
      'text/plain',
      'text/html',
      'text/css',
      'text/javascript',
      'application/json',
      'application/xml',
      'application/javascript',
      'application/typescript'
    ];

    return (
      textMimeTypes.includes(this.mimeType) ||
      [
        '.txt',
        '.log',
        '.md',
        '.json',
        '.xml',
        '.js',
        '.ts',
        '.html',
        '.css',
        '.stacktrace'
      ].includes(this.getExtension())
    );
  }

  /**
   * Calculate checksum for file
   *
   * @param filePath Path to file
   * @returns SHA-256 checksum
   */
  static async calculateChecksum(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);

      stream.on('error', (err) => reject(err));
      stream.on('data', (chunk) => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
    });
  }

  /**
   * Convert to JSON object
   *
   * @returns UploadedFile data as plain object
   */
  toJSON(): Record<string, any> {
    return {
      id: this.id,
      sessionId: this.sessionId,
      userId: this.userId,
      filename: this.filename,
      path: this.path,
      mimeType: this.mimeType,
      size: this.size,
      checksum: this.checksum,
      uploadedAt: this.uploadedAt,
      // Note: content is excluded from JSON for size reasons
      metadata: this.metadata
    };
  }

  /**
   * Create an UploadedFile instance from database record
   *
   * @param record Database record
   * @returns UploadedFile instance
   */
  static fromRecord(record: Record<string, any>): UploadedFile {
    return new UploadedFile({
      id: record.id,
      sessionId: record.session_id,
      userId: record.user_id,
      filename: record.filename,
      path: record.file_path,
      mimeType: record.mime_type,
      size: record.size,
      checksum: record.checksum,
      uploadedAt: new Date(record.uploaded_at),
      content: record.content,
      metadata: record.metadata ? JSON.parse(record.metadata) : {}
    });
  }
}
