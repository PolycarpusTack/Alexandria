import { ICodeSnippet } from './interfaces';

/**
 * CodeSnippet model implementation
 */
export class CodeSnippet implements ICodeSnippet {
  id: string;
  sessionId: string;
  userId: string;
  content: string;
  language: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;

  /**
   * Create a new CodeSnippet instance
   *
   * @param data Code snippet data, partial or complete
   */
  constructor(data: Partial<ICodeSnippet>) {
    this.id = data.id || uuidv4();
    this.sessionId = data.sessionId || '';
    this.userId = data.userId || '';
    this.content = data.content || '';
    this.language = data.language || 'plaintext';
    this.description = data.description;
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
    this.metadata = data.metadata || {};
  }

  /**
   * Validate code snippet data
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

    if (!this.content || this.content.trim() === '') {
      throw new Error('Content is required');
    }

    return true;
  }

  /**
   * Get the line count of the snippet
   *
   * @returns Number of lines
   */
  getLineCount(): number {
    if (!this.content) return 0;
    return this.content.split('\n').length;
  }

  /**
   * Update the content of the code snippet
   *
   * @param content New content
   * @returns Updated code snippet
   */
  updateContent(content: string): CodeSnippet {
    this.content = content;
    this.updatedAt = new Date();
    return this;
  }

  /**
   * Convert to JSON object
   *
   * @returns CodeSnippet data as plain object
   */
  toJSON(): Record<string, any> {
    return {
      id: this.id,
      sessionId: this.sessionId,
      userId: this.userId,
      content: this.content,
      language: this.language,
      description: this.description,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      metadata: this.metadata
    };
  }

  /**
   * Create a CodeSnippet instance from database record
   *
   * @param record Database record
   * @returns CodeSnippet instance
   */
  static fromRecord(record: Record<string, any>): CodeSnippet {
    return new CodeSnippet({
      id: record.id,
      sessionId: record.session_id,
      userId: record.user_id,
      content: record.content,
      language: record.language,
      description: record.description,
      createdAt: new Date(record.created_at),
      updatedAt: new Date(record.updated_at),
      metadata: record.metadata ? JSON.parse(record.metadata) : {}
    });
  }
}
