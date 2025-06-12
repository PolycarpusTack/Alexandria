/**
 * Case Service - Handles all case-related operations
 */

import { Case } from '../interfaces';
import { DataService } from '../../data/interfaces';
import { Logger } from '../../../utils/logger';
import { ValidationError } from '../../errors';

export interface CaseServiceOptions {
  dataService: DataService;
  logger: Logger;
}

export class CaseService {
  private readonly dataService: DataService;
  private readonly logger: Logger;

  constructor(options: CaseServiceOptions) {
    this.dataService = options.dataService;
    this.logger = options.logger;
  }

  /**
   * Get a case by ID
   */
  async getCaseById(id: string): Promise<Case | null> {
    if (!id || typeof id !== 'string') {
      throw new ValidationError([{ field: 'id', message: 'Case ID must be a non-empty string' }]);
    }

    return await this.dataService.cases.findById(id);
  }

  /**
   * Create a new case
   */
  async createCase(caseData: Omit<Case, 'id' | 'createdAt' | 'updatedAt'>): Promise<Case> {
    if (!caseData || !caseData.title) {
      throw new ValidationError([{ field: 'title', message: 'Case title is required' }]);
    }

    return await this.dataService.cases.create(caseData);
  }

  /**
   * Update an existing case
   */
  async updateCase(id: string, updates: Partial<Case>): Promise<Case> {
    if (!id || typeof id !== 'string') {
      throw new ValidationError([{ field: 'id', message: 'Case ID must be a non-empty string' }]);
    }

    const existingCase = await this.getCaseById(id);
    if (!existingCase) {
      throw new ValidationError([{ field: 'id', message: 'Case not found' }]);
    }

    return await this.dataService.cases.update(id, updates);
  }

  /**
   * Delete a case
   */
  async deleteCase(id: string): Promise<boolean> {
    if (!id || typeof id !== 'string') {
      throw new ValidationError([{ field: 'id', message: 'Case ID must be a non-empty string' }]);
    }

    return await this.dataService.cases.delete(id);
  }

  /**
   * Find cases by status
   */
  async findCasesByStatus(status: Case['status']): Promise<Case[]> {
    const validStatuses: Case['status'][] = ['open', 'in_progress', 'resolved', 'closed'];
    if (!status || !validStatuses.includes(status)) {
      throw new ValidationError([
        { field: 'status', message: 'Status must be one of: open, in_progress, resolved, closed' }
      ]);
    }

    return await this.dataService.cases.findByStatus(status);
  }

  /**
   * Find cases assigned to a user
   */
  async findCasesByAssignee(userId: string): Promise<Case[]> {
    if (!userId || typeof userId !== 'string') {
      throw new ValidationError([
        { field: 'userId', message: 'User ID must be a non-empty string' }
      ]);
    }

    return await this.dataService.cases.findByAssignedTo(userId);
  }

  /**
   * Add a comment to a case
   */
  async addComment(caseId: string, userId: string, comment: string): Promise<Case> {
    if (!caseId || typeof caseId !== 'string') {
      throw new ValidationError([
        { field: 'caseId', message: 'Case ID must be a non-empty string' }
      ]);
    }

    if (!userId || typeof userId !== 'string') {
      throw new ValidationError([
        { field: 'userId', message: 'User ID must be a non-empty string' }
      ]);
    }

    if (!comment || typeof comment !== 'string') {
      throw new ValidationError([
        { field: 'comment', message: 'Comment must be a non-empty string' }
      ]);
    }

    const caseToUpdate = await this.getCaseById(caseId);
    if (!caseToUpdate) {
      throw new ValidationError([{ field: 'caseId', message: 'Case not found' }]);
    }

    // Since Case doesn't have a history property, we'll store comments in metadata
    const newComment = {
      id: Date.now().toString(), // Simple ID generation
      userId,
      text: comment,
      createdAt: new Date()
    };

    const metadata = caseToUpdate.metadata || {};
    const comments = metadata.comments || [];
    comments.push(newComment);

    return await this.updateCase(caseId, {
      metadata: {
        ...metadata,
        comments
      }
    });
  }
}
