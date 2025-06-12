import { IAnalysisResult, IRootCause } from './interfaces';

/**
 * AnalysisResult model implementation
 */
export class AnalysisResult implements IAnalysisResult {
  id: string;
  sessionId: string;
  fileId?: string;
  snippetId?: string;
  userId: string;
  primaryError: string;
  failingComponent?: string;
  potentialRootCauses: IRootCause[];
  troubleshootingSteps?: string[];
  summary: string;
  llmModel: string;
  confidence: number;
  inferenceTime: number;
  createdAt: Date;
  metadata?: Record<string, any>;

  /**
   * Create a new AnalysisResult instance
   *
   * @param data Analysis result data, partial or complete
   */
  constructor(data: Partial<IAnalysisResult>) {
    this.id = data.id || uuidv4();
    this.sessionId = data.sessionId || '';
    this.fileId = data.fileId;
    this.snippetId = data.snippetId;
    this.userId = data.userId || '';
    this.primaryError = data.primaryError || '';
    this.failingComponent = data.failingComponent;
    this.potentialRootCauses = data.potentialRootCauses || [];
    this.troubleshootingSteps = data.troubleshootingSteps || [];
    this.summary = data.summary || '';
    this.llmModel = data.llmModel || '';
    this.confidence = data.confidence || 0;
    this.inferenceTime = data.inferenceTime || 0;
    this.createdAt = data.createdAt || new Date();
    this.metadata = data.metadata || {};
  }

  /**
   * Validate analysis result data
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

    if (
      (!this.fileId || this.fileId.trim() === '') &&
      (!this.snippetId || this.snippetId.trim() === '')
    ) {
      throw new Error('Either file ID or snippet ID is required');
    }

    if (!this.primaryError || this.primaryError.trim() === '') {
      throw new Error('Primary error is required');
    }

    if (!this.summary || this.summary.trim() === '') {
      throw new Error('Summary is required');
    }

    if (!this.llmModel || this.llmModel.trim() === '') {
      throw new Error('LLM model is required');
    }

    return true;
  }

  /**
   * Get the most likely root cause
   *
   * @returns The root cause with highest confidence or undefined
   */
  getMostLikelyRootCause(): IRootCause | undefined {
    if (!this.potentialRootCauses || this.potentialRootCauses.length === 0) {
      return undefined;
    }

    return [...this.potentialRootCauses].sort((a, b) => b.confidence - a.confidence)[0];
  }

  /**
   * Convert to JSON object
   *
   * @returns AnalysisResult data as plain object
   */
  toJSON(): Record<string, any> {
    return {
      id: this.id,
      sessionId: this.sessionId,
      fileId: this.fileId,
      snippetId: this.snippetId,
      userId: this.userId,
      primaryError: this.primaryError,
      failingComponent: this.failingComponent,
      potentialRootCauses: this.potentialRootCauses,
      troubleshootingSteps: this.troubleshootingSteps,
      summary: this.summary,
      llmModel: this.llmModel,
      confidence: this.confidence,
      inferenceTime: this.inferenceTime,
      createdAt: this.createdAt,
      metadata: this.metadata
    };
  }

  /**
   * Create an AnalysisResult instance from database record
   *
   * @param record Database record
   * @returns AnalysisResult instance
   */
  static fromRecord(record: Record<string, any>): AnalysisResult {
    return new AnalysisResult({
      id: record.id,
      sessionId: record.session_id,
      fileId: record.file_id,
      snippetId: record.snippet_id,
      userId: record.user_id,
      primaryError: record.primary_error,
      failingComponent: record.failing_component,
      potentialRootCauses: record.root_causes ? JSON.parse(record.root_causes) : [],
      troubleshootingSteps: record.troubleshooting_steps
        ? JSON.parse(record.troubleshooting_steps)
        : [],
      summary: record.summary,
      llmModel: record.llm_model,
      confidence: record.confidence,
      inferenceTime: record.inference_time,
      createdAt: new Date(record.created_at),
      metadata: record.metadata ? JSON.parse(record.metadata) : {}
    });
  }
}
