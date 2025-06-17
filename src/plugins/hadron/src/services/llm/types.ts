/**
 * LLM Service Types
 * Shared types for LLM operations
 */

import { ModelTier } from '../../interfaces';

export interface ModelTierInfo {
  models: string[];
  description: string;
  goodFor: string;
  maxTokens: number;
}

export type ModelTierSystem = {
  [key in ModelTier]: ModelTierInfo;
};

export interface ModelRecommendationCriteria {
  complexity: number;
  urgency: 'low' | 'medium' | 'high';
  resourceConstraints: 'strict' | 'moderate' | 'relaxed';
  accuracyRequirement: 'basic' | 'standard' | 'high';
}

export interface ModelRecommendation {
  model: string;
  tier: ModelTier;
  confidence: number;
  reasoning: string;
  alternatives: string[];
}

export interface LLMRequestOptions {
  model?: string;
  timeout?: number;
  maxRetries?: number;
  temperature?: number;
  maxTokens?: number;
  useCache?: boolean;
}

export interface LLMResponse {
  content: string;
  model: string;
  tokens: {
    input: number;
    output: number;
    total: number;
  };
  timing: {
    requestTime: number;
    responseTime: number;
    totalTime: number;
  };
  cached: boolean;
}

export interface PromptTemplate {
  system: string;
  user: string;
  examples?: Array<{
    input: string;
    output: string;
  }>;
  metadata: {
    version: string;
    complexity: number;
    estimatedTokens: number;
  };
}

export interface AnalysisContext {
  crashType?: string;
  severity?: string;
  stackDepth?: number;
  codeLanguage?: string;
  framework?: string;
  customInstructions?: string;
}

export interface ModelPerformanceMetrics {
  modelName: string;
  averageResponseTime: number;
  successRate: number;
  averageTokensUsed: number;
  qualityScore: number;
  lastUpdated: Date;
}

export interface CacheConfiguration {
  enableCaching: boolean;
  defaultTtl: number;
  maxPromptLength: number;
  minConfidence: number;
  compressionEnabled?: boolean;
}

export interface RetryConfiguration {
  maxAttempts: number;
  initialDelay: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  retryableErrors?: string[];
}

export interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeout: number;
  monitoringPeriod: number;
}

export interface ResilienceOptions {
  enableCircuitBreaker: boolean;
  enableRetry: boolean;
  timeout: number;
  retryConfig?: RetryConfiguration;
  circuitBreakerConfig?: CircuitBreakerOptions;
}

export interface ModelHealth {
  isAvailable: boolean;
  responseTime: number;
  errorRate: number;
  lastChecked: Date;
  issues?: string[];
}

export interface LLMServiceMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  cacheHitRate: number;
  modelUsageStats: Record<string, number>;
  lastReset: Date;
}

export interface PromptOptimization {
  originalLength: number;
  optimizedLength: number;
  compressionRatio: number;
  preservedKeywords: string[];
  removedSections: string[];
}

export interface CodeAnalysisRequest {
  code: string;
  language: string;
  analysisType: 'security' | 'performance' | 'style' | 'bugs' | 'general';
  context?: AnalysisContext;
  options?: LLMRequestOptions;
}

export interface ParsedAnalysisResult {
  rootCause: {
    primary: string;
    secondary?: string[];
    confidence: number;
  };
  evidence: Array<{
    type: string;
    description: string;
    relevance: number;
    location?: string;
  }>;
  recommendations: Array<{
    action: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    effort: 'minimal' | 'moderate' | 'significant';
    impact: string;
  }>;
  metadata: {
    analysisTime: number;
    confidence: number;
    modelUsed: string;
    promptTokens: number;
    responseTokens: number;
  };
}

export type ErrorCategory = 
  | 'network'
  | 'timeout'
  | 'model_error'
  | 'parsing_error'
  | 'validation_error'
  | 'quota_exceeded'
  | 'service_unavailable';

export interface LLMError extends Error {
  category: ErrorCategory;
  retryable: boolean;
  modelName?: string;
  requestId?: string;
  details?: Record<string, any>;
}