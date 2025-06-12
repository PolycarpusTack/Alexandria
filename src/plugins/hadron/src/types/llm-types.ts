/**
 * Type definitions for LLM service responses and parameters
 */

/**
 * Base LLM response interface
 */
export interface ILlmResponse {
  response: string;
  model: string;
  done: boolean;
  done_reason?: string;
  total_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
  context?: number[];
}

/**
 * Ollama model information
 */
export interface IOllamaModel {
  name: string;
  modified_at: string;
  size: number;
  digest: string;
  details?: {
    format: string;
    family: string;
    families?: string[];
    parameter_size: string;
    quantization_level: string;
  };
}

/**
 * Ollama models list response
 */
export interface IOllamaModelsResponse {
  models: IOllamaModel[];
}

/**
 * Model status details
 */
export interface IModelStatusDetails {
  loaded: boolean;
  size?: number;
  digest?: string;
  modified_at?: string;
  family?: string;
  parameter_size?: string;
  quantization_level?: string;
  loading_progress?: number;
  error?: string;
}

/**
 * LLM analysis response structure
 */
export interface ILlmAnalysisResponse {
  primaryError: string;
  failingComponent?: string;
  potentialIssues: Array<{
    issue: string;
    confidence: number;
    explanation: string;
    codeReferences: Array<{
      description: string;
      location: string;
      snippet?: string;
    }>;
    category?: string;
  }>;
  troubleshootingSteps?: string[];
  summary: string;
  confidence: number;
  additionalContext?: Record<string, string | number | boolean>;
}

/**
 * Code analysis response structure
 */
export interface ICodeAnalysisResponse {
  codeQuality: {
    score: number;
    issues: Array<{
      type: 'error' | 'warning' | 'suggestion';
      severity: 'low' | 'medium' | 'high' | 'critical';
      message: string;
      line?: number;
      column?: number;
    }>;
  };
  suggestions: Array<{
    type: string;
    description: string;
    impact: 'low' | 'medium' | 'high';
    codeExample?: string;
  }>;
  metrics: {
    complexity: number;
    maintainability: number;
    testability: number;
    readability: number;
  };
  summary: string;
  confidence: number;
}

/**
 * Request context for analysis
 */
export interface IAnalysisContext {
  language?: string;
  framework?: string;
  platform?: string;
  userPreferences?: {
    verbosity: 'minimal' | 'detailed' | 'comprehensive';
    includeExamples: boolean;
    focusAreas?: string[];
  };
  sessionId?: string;
  fileType?: string;
}

/**
 * User information for requests
 */
export interface IRequestUser {
  id: string;
  username: string;
  role: string;
  permissions?: string[];
}

/**
 * Extended request with user context
 */
export interface IAuthenticatedRequest {
  user?: IRequestUser;
  sessionId?: string;
  requestId?: string;
}

/**
 * Generic object for nested value access
 */
export interface INestedObject {
  [key: string]:
    | string
    | number
    | boolean
    | INestedObject
    | Array<string | number | boolean | INestedObject>;
}

/**
 * Query options for database operations
 */
export interface IQueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'ASC' | 'DESC';
  filters?: Record<string, string | number | boolean>;
  includes?: string[];
}

/**
 * Error response from external services
 */
export interface IServiceErrorResponse {
  error: {
    message: string;
    code?: string | number;
    details?: Record<string, unknown>;
  };
  status?: number;
  timestamp?: string;
}

/**
 * Time range for analytics queries
 */
export interface ITimeRange {
  start: Date;
  end: Date;
  granularity?: 'hour' | 'day' | 'week' | 'month';
}

/**
 * Alert severity levels
 */
export type AlertSeverity = 'critical' | 'warning' | 'info';

/**
 * Express middleware error handler function signature
 */
export interface IErrorMiddleware {
  (error: Error, req: IAuthenticatedRequest, res: any, next: any): void;
}
