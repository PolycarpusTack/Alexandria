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
  createTemplate(
    template: Omit<CodeTemplate, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<CodeTemplate>;
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

// Enhanced Streaming response types
export interface StreamChunk {
  content: string;
  done: boolean;
  type?: 'chunk' | 'complete';
  data?: string | AlfredMessage; // backward compatibility
  metadata?: {
    hasCode?: boolean;
    language?: string;
    tokenCount?: number;
    provider?: string;
    model?: string;
    [key: string]: any;
  };
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
  createSessionWithContext(
    projectPath: string,
    projectContext?: ProjectContext
  ): Promise<AlfredSession>;
  sendMessage(sessionId: string, message: string): Promise<AlfredMessage>;
  sendMessageStream(sessionId: string, content: string): Promise<AsyncGenerator<StreamChunk>>;
  getSession(sessionId: string): Promise<AlfredSession | undefined>;
  getSessions(): Promise<AlfredSession[]>;
  updateSession(sessionId: string, updates: Partial<AlfredSession>): Promise<AlfredSession>;
  deleteSession(sessionId: string): Promise<void>;
  cleanupInactiveSessions(maxAge?: number): Promise<number>;
  generateCode(request: CodeGenerationRequest): Promise<CodeGenerationResponse>;
  analyzeProject(projectPath: string): Promise<ProjectAnalysis>;
  getProjectFiles(projectPath: string): Promise<
    Array<{
      path: string;
      name: string;
      type: 'file' | 'directory';
      size?: number;
      language?: string;
      lastModified?: Date;
    }>
  >;
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

// Enhanced AI Provider Interface
export interface AIProvider {
  streamChat(messages: ChatMessage[], options?: any): AsyncIterableIterator<StreamChunk>;
  generateCode(prompt: string, options?: any): Promise<CodeGenerationResponse>;
  getCodeSuggestions(
    code: string, 
    cursorPosition: { line: number; column: number }, 
    options?: any
  ): Promise<Array<{ suggestion: string; confidence: number; type: string }>>;
  continueConversation(sessionId: string, message: string, options?: any): Promise<{ response: string; metadata: any }>;
  healthCheck(): Promise<void>;
}

// Enhanced Template System
export interface ProcessedTemplate {
  content: string;
  files: ProcessedFile[];
  errors: TemplateError[];
  metadata: {
    variablesUsed: string[];
    filesGenerated: number;
    totalSize: number;
  };
}

export interface ProcessedFile {
  path: string;
  content: string;
  language: string;
  action: 'create' | 'update' | 'merge';
  conflicts?: string[];
}

export interface TemplateError {
  type: 'missing_variable' | 'invalid_value' | 'syntax_error' | 'security_violation';
  variable?: string;
  message: string;
  line?: number;
  column?: number;
}

export interface GenerationResult {
  success: boolean;
  files: GeneratedFile[];
  errors: string[];
  warnings: string[];
  metadata: {
    timeElapsed: number;
    filesCreated: number;
    linesGenerated: number;
  };
}

export interface GeneratedFile {
  path: string;
  content: string;
  language: string;
  created: boolean;
  backed_up?: boolean;
  size: number;
}

// Enhanced Code Analysis
export interface CodeContext {
  currentFunction?: {
    name: string;
    parameters: string[];
    returnType?: string;
    startLine: number;
    endLine: number;
  };
  imports: Array<{
    module: string;
    imports: string[];
    isDefault: boolean;
  }>;
  exports: Array<{
    name: string;
    type: 'function' | 'class' | 'variable' | 'default';
  }>;
  classes: Array<{
    name: string;
    methods: string[];
    properties: string[];
  }>;
  interfaces?: Array<{
    name: string;
    properties: string[];
  }>;
  dependencies: string[];
  relatedFiles: string[];
  scope?: 'global' | 'module' | 'function' | 'class';
}

export interface CodeSuggestion {
  suggestion: string;
  confidence: number;
  type: 'completion' | 'import' | 'refactor' | 'fix' | 'test';
  description?: string;
  insertPosition?: { line: number; column: number };
  replaceRange?: { start: { line: number; column: number }; end: { line: number; column: number } };
  metadata?: {
    language?: string;
    framework?: string;
    pattern?: string;
  };
}

// Enhanced Hook Interfaces
export interface UseAlfredServiceReturn {
  sendMessage: (content: string) => Promise<void>;
  sendMessageStream: (content: string) => AsyncGenerator<StreamChunk>;
  generateCode: (prompt: string, options?: any) => Promise<CodeGenerationResponse>;
  getSuggestions: (code: string, cursor: { line: number; column: number }) => Promise<CodeSuggestion[]>;
  isStreaming: boolean;
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
}

export interface UseProjectContextReturn {
  projectPath: string | null;
  projectStructure: ProjectStructure | null;
  currentFile: FileNode | null;
  isLoading: boolean;
  error: string | null;
  setProjectPath: (path: string) => void;
  setCurrentFile: (file: FileNode) => void;
  refreshStructure: () => Promise<void>;
}

export interface UseTemplateEngineReturn {
  templates: CodeTemplate[];
  currentTemplate: CodeTemplate | null;
  variables: Record<string, any>;
  preview: ProcessedTemplate | null;
  isGenerating: boolean;
  error: string | null;
  loadTemplate: (templateId: string) => Promise<void>;
  updateVariable: (key: string, value: any) => void;
  resetVariables: () => void;
  generatePreview: () => Promise<void>;
  generateFiles: (outputPath: string) => Promise<GenerationResult>;
}

// Enhanced UI Component Props
export interface ChatInterfaceProps {
  sessionId: string;
  projectContext?: ProjectContext;
  onSessionChange?: (sessionId: string) => void;
  enableSyntaxHighlighting?: boolean;
  enableCopyToClipboard?: boolean;
  enableKeyboardShortcuts?: boolean;
  className?: string;
}

export interface TemplateWizardProps {
  templateId?: string;
  onComplete: (result: GenerationResult) => void;
  onCancel: () => void;
  initialValues?: Record<string, any>;
  projectContext?: ProjectContext;
  readonly?: boolean;
  enablePreview?: boolean;
  className?: string;
}

export interface ProjectExplorerProps {
  projectPath?: string;
  onFileSelect?: (filePath: string) => void;
  onDirectoryChange?: (directoryPath: string) => void;
  expandedNodes?: Set<string>;
  selectedFile?: string;
  showHidden?: boolean;
  enableDragDrop?: boolean;
  className?: string;
}

export interface SessionListProps {
  sessions: ChatSession[];
  activeSessionId?: string;
  onSessionSelect: (sessionId: string) => void;
  onSessionDelete: (sessionId: string) => void;
  onSessionRename: (sessionId: string, newName: string) => void;
  onSessionExport?: (sessionId: string, format: 'json' | 'markdown' | 'text') => void;
  enableSearch?: boolean;
  enableAutoSave?: boolean;
  className?: string;
}

// Enhanced Context Interfaces
export interface AlfredContextValue {
  service: AIProvider;
  currentSession: ChatSession | null;
  sessions: ChatSession[];
  projectContext: ProjectContext | null;
  isLoading: boolean;
  error: string | null;
  createSession: (options?: any) => Promise<ChatSession>;
  switchSession: (sessionId: string) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  updateSession: (sessionId: string, updates: Partial<ChatSession>) => Promise<void>;
  setProjectContext: (context: ProjectContext) => void;
}

// Search and Analytics
export interface SearchOptions {
  query: string;
  sessionId?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
  messageType?: 'user' | 'assistant' | 'all';
  hasCode?: boolean;
  language?: string;
}

export interface SearchResult {
  message: ChatMessage;
  sessionId: string;
  sessionName: string;
  relevance: number;
  context: {
    before: ChatMessage[];
    after: ChatMessage[];
  };
}

export interface UsageAnalytics {
  sessionsCreated: number;
  messagesExchanged: number;
  codeGenerated: number;
  templatesUsed: number;
  averageResponseTime: number;
  topLanguages: Array<{ language: string; count: number }>;
  topFeatures: Array<{ feature: string; usage: number }>;
}

// Error Types
export class AlfredError extends Error {
  constructor(
    message: string,
    public code: string,
    public context?: any
  ) {
    super(message);
    this.name = 'AlfredError';
  }
}

export class ProviderError extends AlfredError {
  constructor(message: string, public provider: string, context?: any) {
    super(message, 'PROVIDER_ERROR', { provider, ...context });
  }
}

export class TemplateError extends AlfredError {
  constructor(message: string, public templateId?: string, context?: any) {
    super(message, 'TEMPLATE_ERROR', { templateId, ...context });
  }
}

export class ValidationError extends AlfredError {
  constructor(message: string, public field?: string, context?: any) {
    super(message, 'VALIDATION_ERROR', { field, ...context });
  }
}
