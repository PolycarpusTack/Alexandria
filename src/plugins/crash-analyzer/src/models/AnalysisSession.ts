import { IAnalysisSession, AnalysisSessionStatus } from './interfaces';
import { v4 as uuidv4 } from 'uuid';

/**
 * Analysis Session model implementation
 */
export class AnalysisSession implements IAnalysisSession {
  id: string;
  userId: string;
  title: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  status: AnalysisSessionStatus;
  metadata?: Record<string, any>;
  tags?: string[];

  /**
   * Create a new AnalysisSession instance
   * 
   * @param data Analysis session data, partial or complete
   */
  constructor(data: Partial<IAnalysisSession>) {
    this.id = data.id || uuidv4();
    this.userId = data.userId || '';
    this.title = data.title || 'New Analysis Session';
    this.description = data.description;
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
    this.status = data.status || AnalysisSessionStatus.CREATED;
    this.metadata = data.metadata || {};
    this.tags = data.tags || [];
  }

  /**
   * Validate analysis session data
   * 
   * @returns true if valid, throws error if invalid
   */
  validate(): boolean {
    if (!this.userId || this.userId.trim() === '') {
      throw new Error('User ID is required');
    }

    if (!this.title || this.title.trim() === '') {
      throw new Error('Title is required');
    }

    return true;
  }

  /**
   * Update the status of the analysis session
   * 
   * @param status New status
   * @returns Updated analysis session
   */
  updateStatus(status: AnalysisSessionStatus): AnalysisSession {
    this.status = status;
    this.updatedAt = new Date();
    return this;
  }

  /**
   * Convert to JSON object
   * 
   * @returns Analysis session data as plain object
   */
  toJSON(): Record<string, any> {
    return {
      id: this.id,
      userId: this.userId,
      title: this.title,
      description: this.description,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      status: this.status,
      metadata: this.metadata,
      tags: this.tags
    };
  }

  /**
   * Create an AnalysisSession instance from database record
   * 
   * @param record Database record
   * @returns AnalysisSession instance
   */
  static fromRecord(record: Record<string, any>): AnalysisSession {
    return new AnalysisSession({
      id: record.id,
      userId: record.user_id,
      title: record.title,
      description: record.description,
      createdAt: new Date(record.created_at),
      updatedAt: new Date(record.updated_at),
      status: record.status as AnalysisSessionStatus,
      metadata: record.metadata ? JSON.parse(record.metadata) : {},
      tags: record.tags ? JSON.parse(record.tags) : []
    });
  }
}