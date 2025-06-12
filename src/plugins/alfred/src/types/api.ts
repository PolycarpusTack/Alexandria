/**
 * Alfred API Type Definitions
 * 
 * Type definitions for Alfred plugin API requests and responses
 */

import { Request, Response } from 'express';
import { AuthenticatedRequest, ValidatedRequest } from '../../../../types/express-extensions';

// ==================== Request Interfaces ====================

/**
 * Base Alfred request interface
 */
export interface AlfredRequest extends AuthenticatedRequest {
  user: {
    id: string;
    email: string;
    role: string;
    permissions?: string[];
  };
}

/**
 * Create session request
 */
export interface CreateSessionRequest extends AlfredRequest {
  body: {
    projectPath?: string;
    name?: string;
    template?: string;
    variables?: Record<string, any>;
  };
}

/**
 * Session parameters
 */
export interface SessionParams {
  sessionId: string;
}

/**
 * Send message request
 */
export interface SendMessageRequest extends ValidatedRequest<SessionParams> {
  body: {
    content: string;
    stream?: boolean;
    context?: string;
  };
}

/**
 * Stream chat request
 */
export interface StreamChatRequest extends ValidatedRequest<SessionParams> {
  body: {
    content: string;
    includeHistory?: boolean;
    maxHistoryLength?: number;
  };
}

/**
 * Generate code request
 */
export interface GenerateCodeRequest extends AlfredRequest {
  body: {
    prompt: string;
    language?: string;
    context?: string;
    sessionId?: string;
    template?: string;
    variables?: Record<string, any>;
  };
}

/**
 * Stream code request
 */
export interface StreamCodeRequest extends AlfredRequest {
  body: {
    prompt: string;
    context?: string;
    language?: string;
    sessionId?: string;
    template?: string;
    variables?: Record<string, any>;
  };
}

/**
 * Analyze project request
 */
export interface AnalyzeProjectRequest extends AlfredRequest {
  body: {
    projectPath: string;
    includeFiles?: boolean;
    depth?: number;
  };
}

/**
 * Sessions query parameters
 */
export interface SessionsQuery {
  page?: string;
  limit?: string;
  sortBy?: 'createdAt' | 'updatedAt' | 'name';
  order?: 'asc' | 'desc';
  search?: string;
}

/**
 * Get sessions request
 */
export interface GetSessionsRequest extends ValidatedRequest<{}, {}, SessionsQuery> {}

/**
 * Get session request
 */
export interface GetSessionRequest extends ValidatedRequest<SessionParams> {}

/**
 * Delete session request
 */
export interface DeleteSessionRequest extends ValidatedRequest<SessionParams> {}

/**
 * Cancel stream request
 */
export interface CancelStreamRequest extends ValidatedRequest<SessionParams> {}

// ==================== Response Interfaces ====================

/**
 * Alfred session response
 */
export interface AlfredSessionResponse {
  id: string;
  name: string;
  projectPath?: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  lastMessage?: {
    content: string;
    timestamp: string;
    role: 'user' | 'assistant';
  };
}

/**
 * Alfred message response
 */
export interface AlfredMessageResponse {
  id: string;
  sessionId: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: string;
  metadata?: {
    model?: string;
    tokens?: number;
    processingTime?: number;
  };
}

/**
 * Sessions list response
 */
export interface SessionsListResponse {
  sessions: AlfredSessionResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Session detail response
 */
export interface SessionDetailResponse extends AlfredSessionResponse {
  messages: AlfredMessageResponse[];
  variables?: Record<string, any>;
  template?: string;
}

/**
 * Code generation response
 */
export interface CodeGenerationResponse {
  id: string;
  sessionId: string;
  code: string;
  language: string;
  explanation?: string;
  metadata: {
    model: string;
    tokens: number;
    processingTime: number;
    template?: string;
  };
}

/**
 * Project analysis response
 */
export interface ProjectAnalysisResponse {
  projectPath: string;
  structure: {
    totalFiles: number;
    totalDirectories: number;
    languages: Record<string, number>;
    frameworks: string[];
    dependencies: Record<string, string>;
  };
  files?: Array<{
    path: string;
    type: 'file' | 'directory';
    size?: number;
    language?: string;
  }>;
  recommendations?: string[];
}

/**
 * Stream chunk response
 */
export interface StreamChunkResponse {
  chunk?: string;
  complete?: boolean;
  error?: string;
  metadata?: {
    tokens?: number;
    model?: string;
  };
}

/**
 * Alfred health response
 */
export interface AlfredHealthResponse {
  status: 'healthy' | 'unhealthy';
  activeSessions: number;
  activeStreams: number;
  uptime?: number;
  error?: string;
}

/**
 * Cancel stream response
 */
export interface CancelStreamResponse {
  status: 'cancelled' | 'not_found';
  sessionId: string;
}

// ==================== Error Response Interfaces ====================

/**
 * Alfred API error response
 */
export interface AlfredErrorResponse {
  error: string;
  code: string;
  details?: Record<string, any>;
  timestamp: string;
  requestId?: string;
}

/**
 * Validation error response
 */
export interface ValidationErrorResponse {
  error: 'Validation failed';
  code: 'VALIDATION_ERROR';
  details: {
    field: string;
    message: string;
    value?: any;
  }[];
  timestamp: string;
}

// ==================== Streaming Types ====================

/**
 * SSE data types
 */
export type SSEData = 
  | { type: 'chunk'; data: string }
  | { type: 'complete'; data: string }
  | { type: 'error'; data: string }
  | { type: 'metadata'; data: Record<string, any> };

/**
 * Stream callback options
 */
export interface StreamCallbacks {
  onChunk: (chunk: string) => void;
  onComplete: (fullResponse: string) => void;
  onError: (error: Error) => void;
  onMetadata?: (metadata: Record<string, any>) => void;
}

/**
 * Stream options
 */
export interface StreamOptions {
  sessionId: string;
  context?: string;
  language?: string;
  timeout?: number;
  maxTokens?: number;
}

// ==================== Handler Type Definitions ====================

/**
 * Alfred route handler type
 */
export type AlfredRouteHandler<
  TRequest extends Request = AlfredRequest,
  TResponse = any
> = (
  req: TRequest,
  res: Response,
  next: import('express').NextFunction
) => Promise<void> | void;

/**
 * Stream route handler type
 */
export type StreamRouteHandler<
  TRequest extends Request = AlfredRequest
> = (
  req: TRequest,
  res: Response,
  next: import('express').NextFunction
) => Promise<void>;

// ==================== Utility Types ====================

/**
 * Extract request body type
 */
export type RequestBody<T> = T extends { body: infer B } ? B : never;

/**
 * Extract request params type
 */
export type RequestParams<T> = T extends ValidatedRequest<infer P> ? P : never;

/**
 * Extract request query type
 */
export type RequestQuery<T> = T extends ValidatedRequest<any, any, infer Q> ? Q : never;