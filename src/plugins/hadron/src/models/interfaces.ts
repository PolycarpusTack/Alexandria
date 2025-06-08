/**
 * Database model interfaces for Hadron Crash Analyzer
 */

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
  preferences?: Record<string, any>;
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
  metadata?: Record<string, any>;
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
  metadata?: Record<string, any>;
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
  metadata?: Record<string, any>;
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
  metadata?: Record<string, any>;
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