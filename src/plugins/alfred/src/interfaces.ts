/**
 * ALFRED Plugin Interfaces and Types
 */

// Chat Related
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    model?: string;
    tokensUsed?: number;
    processingTime?: number;
  };
}

export interface ChatSession {
  id: string;
  name: string;
  projectId?: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
  metadata: {
    totalTokens: number;
    model: string;
    context?: ProjectContext;
  };
}

// Project Related
export interface ProjectContext {
  projectPath: string;
  projectName: string;
  projectType: ProjectType;
  structure: ProjectStructure;
  preferredModel?: string;
  analyzedAt: Date;
}

export enum ProjectType {
  PYTHON = 'python',
  JAVASCRIPT = 'javascript',
  TYPESCRIPT = 'typescript',
  JAVA = 'java',
  CSHARP = 'csharp',
  GO = 'go',
  RUST = 'rust',
  SMALLTALK = 'smalltalk',
  MIXED = 'mixed',
  UNKNOWN = 'unknown'
}

export interface ProjectStructure {
  rootPath: string;
  files: FileNode[];
  statistics: ProjectStatistics;
  dependencies?: DependencyInfo[];
}

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
  size?: number;
  extension?: string;
  language?: string;
}

export interface ProjectStatistics {
  totalFiles: number;
  totalDirectories: number;
  totalSize: number;
  languageBreakdown: Record<string, number>;
  largestFiles: Array<{ path: string; size: number }>;
}

export interface DependencyInfo {
  name: string;
  version: string;
  type: 'runtime' | 'dev';
  source: string; // package.json, requirements.txt, etc.
}

// Code Generation Related
export interface CodeTemplate {
  id: string;
  name: string;
  description: string;
  language: string;
  category: string;
  variables: TemplateVariable[];
  template: string;
  examples?: TemplateExample[];
  createdAt: Date;
  updatedAt: Date;
}

export interface TemplateVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required: boolean;
  default?: any;
  validation?: string; // regex or validation rule
}

export interface TemplateExample {
  name: string;
  variables: Record<string, any>;
  output: string;
}

export interface CodeGenerationRequest {
  templateId?: string;
  prompt: string;
  language?: string;
  context?: string | Record<string, any>;
  variables?: Record<string, any>;
  temperature?: number;
  maxTokens?: number;
  sessionId?: string;
  saveToStorage?: boolean;
}

export interface CodeGenerationResponse {
  id: string;
  code: string;
  language: string;
  explanation?: string;
  dependencies?: string[];
  warnings?: string[];
  timestamp: Date;
}

// Service Interfaces
export interface IAlfredService {
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  createNewSession(projectContext?: ProjectContext): Promise<ChatSession>;
  sendMessage(sessionId: string, message: string): Promise<ChatMessage>;
  getSessions(): Promise<ChatSession[]>;
  getSession(sessionId: string): Promise<ChatSession | null>;
  deleteSession(sessionId: string): Promise<void>;
}

export interface IProjectAnalyzerService {
  analyzeProject(projectPath: string): Promise<ProjectContext>;
  analyzeCurrentProject(): Promise<ProjectContext | null>;
  updateProjectStructure(filePath: string, changeType: string): Promise<void>;
  detectProjectType(projectPath: string): Promise<ProjectType>;
  extractProjectStructure(projectPath: string): Promise<ProjectStructure>;
}

export interface ICodeGeneratorService {
  generateCode(request: CodeGenerationRequest): Promise<CodeGenerationResponse>;
  showGenerateDialog(): Promise<void>;
  validateTemplate(template: CodeTemplate): Promise<boolean>;
  previewGeneration(request: CodeGenerationRequest): Promise<string>;
}

export interface ITemplateManagerService {
  getTemplates(): Promise<CodeTemplate[]>;
  getTemplate(id: string): Promise<CodeTemplate | null>;
  createTemplate(template: Omit<CodeTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<CodeTemplate>;
  updateTemplate(id: string, updates: Partial<CodeTemplate>): Promise<CodeTemplate>;
  deleteTemplate(id: string): Promise<void>;
  importTemplate(templateData: string): Promise<CodeTemplate>;
  exportTemplate(id: string): Promise<string>;
}

// API Request/Response Types
export interface SendMessageRequest {
  sessionId: string;
  message: string;
}

export interface CreateSessionRequest {
  name?: string;
  projectPath?: string;
}

export interface GenerateCodeRequest {
  templateId?: string;
  prompt: string;
  language: string;
  variables?: Record<string, any>;
}

// Event Types
export interface AlfredEvent {
  type: string;
  timestamp: Date;
  data: any;
}

export interface ProjectAnalyzedEvent extends AlfredEvent {
  type: 'alfred:project-analyzed';
  data: {
    projectPath: string;
    projectType: ProjectType;
    fileCount: number;
    languages: string[];
  };
}

export interface CodeGeneratedEvent extends AlfredEvent {
  type: 'alfred:code-generated';
  data: {
    sessionId: string;
    language: string;
    linesOfCode: number;
    templateUsed?: string;
  };
}

// Configuration Types
export interface AlfredConfiguration {
  defaultModel: string;
  enableAutoSave: boolean;
  codeExtractionDepth: number;
  maxSessionHistory: number;
  enableTemplateSharing: boolean;
}

// Type aliases for backward compatibility with service layer
export type AlfredMessage = ChatMessage;
export type AlfredSession = ChatSession;
export type ProjectAnalysis = ProjectContext;

// Streaming response types
export interface StreamChunk {
  type: 'chunk' | 'complete';
  data: string | AlfredMessage;
}

// Health check response
export interface ServiceHealth {
  status: 'healthy' | 'unhealthy';
  aiService: boolean;
  repository: boolean;
  activeSessions: number;
}

// Main service interface
export interface AlfredServiceInterface {
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  createSession(projectPath?: string): Promise<AlfredSession>;
  createSessionWithContext(projectPath: string, projectContext?: ProjectContext): Promise<AlfredSession>;
  sendMessage(sessionId: string, message: string): Promise<AlfredMessage>;
  sendMessageStream(sessionId: string, content: string): Promise<AsyncGenerator<StreamChunk>>;
  getSession(sessionId: string): Promise<AlfredSession | undefined>;
  getSessions(): Promise<AlfredSession[]>;
  updateSession(sessionId: string, updates: Partial<AlfredSession>): Promise<AlfredSession>;
  deleteSession(sessionId: string): Promise<void>;
  cleanupInactiveSessions(maxAge?: number): Promise<number>;
  generateCode(request: CodeGenerationRequest): Promise<CodeGenerationResponse>;
  analyzeProject(projectPath: string): Promise<ProjectAnalysis>;
  getProjectFiles(projectPath: string): Promise<Array<{
    path: string;
    name: string;
    type: 'file' | 'directory';
    size?: number;
    language?: string;
    lastModified?: Date;
  }>>;
  getFileContent(projectPath: string, filePath: string): Promise<string>;
  createFile(projectPath: string, filePath: string, content: string): Promise<void>;
  updateFile(projectPath: string, filePath: string, content: string): Promise<void>;
  deleteFile(projectPath: string, filePath: string): Promise<void>;
  checkHealth(): Promise<ServiceHealth>;
}

// Additional interfaces for template engine compatibility
export interface TemplateFile {
  name: string;
  path: string;
  content?: string;
  type?: string;
}

export interface CompletionOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
}

export interface TemplateEngine {
  generateTemplate?(request: any): Promise<any>;
}
