/**
 * Database model interfaces for Hadron Crash Analyzer
 */

/**
 * User preferences interface
 */
export interface IUserPreferences {
  theme?: 'light' | 'dark' | 'auto';
  language?: string;
  timezone?: string;
  emailNotifications?: boolean;
  autoSaveEnabled?: boolean;
  defaultAnalysisModel?: string;
  maxFileSize?: number;
  customSettings?: Record<string, string | number | boolean>;
}

/**
 * Session metadata interface
 */
export interface ISessionMetadata {
  platform?: string;
  language?: string;
  framework?: string;
  version?: string;
  environment?: 'development' | 'staging' | 'production';
  stackTrace?: string;
  customTags?: string[];
  priority?: 'low' | 'medium' | 'high' | 'critical';
  reproducible?: boolean;
  additionalInfo?: Record<string, string | number | boolean>;
}

/**
 * File metadata interface
 */
export interface IFileMetadata {
  encoding?: string;
  lineCount?: number;
  processingTime?: number;
  detectedLanguage?: string;
  detectedFormat?: string;
  securityScanResult?: {
    safe: boolean;
    threats: string[];
    scanTime: number;
  };
  compressionRatio?: number;
  originalName?: string;
  uploadSource?: 'web' | 'api' | 'cli';
  customAttributes?: Record<string, string | number | boolean>;
}

/**
 * Code snippet metadata interface
 */
export interface ICodeSnippetMetadata {
  lineNumbers?: { start: number; end: number };
  filePath?: string;
  functionName?: string;
  className?: string;
  complexity?: number;
  linesOfCode?: number;
  analysisHints?: string[];
  relatedSnippets?: string[];
  customAnnotations?: Record<string, string | number | boolean>;
}

/**
 * Analysis result metadata interface
 */
export interface IAnalysisMetadata {
  modelVersion?: string;
  promptVersion?: string;
  analysisType?: 'crash' | 'code_review' | 'performance' | 'security';
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  performanceMetrics?: {
    parseTime: number;
    analysisTime: number;
    totalTime: number;
  };
  qualityScore?: number;
  reviewedBy?: string;
  reviewedAt?: Date;
  customFlags?: Record<string, string | number | boolean>;
}

/**
 * User model interface
 */
export interface IUser {
  id: string;
  username: string;
  email: string;
  fullName?: string;
  role: UserRole;
  createdAt: Date;
  lastLoginAt?: Date;
  preferences?: IUserPreferences;
}

/**
 * Analysis session interface
 */
export interface IAnalysisSession {
  id: string;
  userId: string;
  title: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  status: AnalysisSessionStatus;
  metadata?: ISessionMetadata;
  tags?: string[];
}

/**
 * Uploaded file interface
 */
export interface IUploadedFile {
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
  metadata?: IFileMetadata;
}

/**
 * Code snippet interface
 */
export interface ICodeSnippet {
  id: string;
  sessionId: string;
  userId: string;
  content: string;
  language: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  metadata?: ICodeSnippetMetadata;
}

/**
 * Analysis result interface
 */
export interface IAnalysisResult {
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
  metadata?: IAnalysisMetadata;
}

/**
 * Root cause interface
 */
export interface IRootCause {
  cause: string;
  confidence: number;
  explanation: string;
  supportingEvidence: IEvidence[];
  category?: string;
}

/**
 * Evidence interface
 */
export interface IEvidence {
  description: string;
  location: string;
  snippet?: string;
}

/**
 * User role enum
 */
export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
  DEVELOPER = 'developer',
  SYSTEM_ADMIN = 'system_admin'
}

/**
 * Analysis session status enum
 */
export enum AnalysisSessionStatus {
  CREATED = 'created',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed'
}
