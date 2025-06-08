/**
 * Represents a crash log entry in the system
 */
export interface CrashLog {
  id: string;
  title: string;
  content: string;
  uploadedAt: Date;
  userId: string;
  metadata: {
    source: string;
    appVersion?: string;
    platform?: string;
    device?: string;
    [key: string]: string | number | boolean | null;
  };
  parsedData?: ParsedCrashData;
  analysis?: CrashAnalysisResult;
}

/**
 * Structured data extracted from a raw crash log
 */
export interface ParsedCrashData {
  timestamps: LogTimestamp[];
  errorMessages: ErrorMessage[];
  stackTraces: StackTrace[];
  systemInfo: SystemInfo;
  logLevel?: Record<string, number>; // Count of log levels (e.g., ERROR: 5, WARN: 10)
  metadata: Record<string, string | number | boolean | null>;
}

/**
 * Timestamp information extracted from logs
 */
export interface LogTimestamp {
  timestamp: Date;
  content: string;
  level?: string;
}

/**
 * Error message extracted from logs
 */
export interface ErrorMessage {
  message: string;
  level: string;
  timestamp?: Date;
  code?: string;
  context?: string;
}

/**
 * Stack trace extracted from logs
 */
export interface StackTrace {
  message?: string;
  frames: StackFrame[];
  thread?: string;
  timestamp?: Date;
}

/**
 * Individual stack frame information
 */
export interface StackFrame {
  functionName?: string;
  fileName?: string;
  lineNumber?: number;
  columnNumber?: number;
  isNative?: boolean;
  moduleId?: string;
}

/**
 * System information extracted from logs
 */
export interface SystemInfo {
  osType?: string;
  osVersion?: string;
  deviceModel?: string;
  appVersion?: string;
  memoryUsage?: string;
  cpuUsage?: string;
  otherHardwareInfo?: Record<string, string | number | boolean>;
  otherSoftwareInfo?: Record<string, string | number | boolean>;
}

/**
 * Result of analyzing a crash log with the LLM
 */
export interface CrashAnalysisResult {
  id: string;
  crashLogId: string;
  timestamp: Date;
  primaryError: string;
  failingComponent?: string;
  potentialRootCauses: RootCause[];
  troubleshootingSteps?: string[];
  summary: string;
  llmModel: string;
  confidence: number;
  inferenceTime: number;
}

/**
 * A potential root cause identified by the analysis
 */
export interface RootCause {
  cause: string;
  confidence: number;
  explanation: string;
  supportingEvidence: Evidence[];
  category?: string;
}

/**
 * Evidence supporting a root cause hypothesis
 */
export interface Evidence {
  description: string;
  location: string; // Reference to a line number or section in the log
  snippet?: string; // The actual text snippet from the log
}

/**
 * Interface for the Crash Analyzer Service
 */
export interface ICrashAnalyzerService {
  analyzeLog(logId: string, content: string, metadata: Record<string, string | number | boolean | null>): Promise<CrashAnalysisResult>;
  getCrashLogById(id: string): Promise<CrashLog | null>;
  getAllCrashLogs(): Promise<CrashLog[]>;
  getCrashLogsByUser(userId: string): Promise<CrashLog[]>;
  deleteCrashLog(id: string): Promise<boolean>;
  getAnalysisById(analysisId: string): Promise<CrashAnalysisResult | null>;
  
  /**
   * Get access to the LLM service for UI components
   */
  getLlmService(): ILlmService;
}

/**
 * Interface for the Log Parser Service
 */
export interface ILogParser {
  parse(content: string, metadata?: Record<string, string | number | boolean | null>): Promise<ParsedCrashData>;
  supportsFormat(content: string, metadata?: Record<string, string | number | boolean | null>): boolean;
}

/**
 * Interface for the LLM Service
 */
export interface ILlmService {
  /**
   * Analyze a crash log using the LLM
   * @param parsedData Structured data from the crash log
   * @param rawContent Raw content of the crash log
   * @param customModel Optional model to use instead of the default
   */
  analyzeLog(parsedData: ParsedCrashData, rawContent: string, customModel?: string): Promise<CrashAnalysisResult>;
  
  /**
   * Analyze a code snippet for potential issues and improvements
   * @param code The code snippet to analyze
   * @param language The programming language of the code
   * @param customModel Optional model to use instead of the default
   * @returns Analysis result with issues and recommendations
   */
  analyzeCodeSnippet?(code: string, language: string, customModel?: string): Promise<CodeAnalysisResult>;
  
  /**
   * Get a list of all available Ollama models
   */
  getAvailableModels(): Promise<string[]>;
  
  /**
   * Get status information for a specific model
   */
  getModelStatus(modelId: string): Promise<ModelStatus>;
  
  /**
   * Check if the Ollama service is available
   * @returns true if Ollama is reachable and working, false otherwise
   */
  checkAvailability(): Promise<boolean>;
}

/**
 * Type for model tier classification
 */
export type ModelTier = 'small' | 'medium' | 'large' | 'xl';

/**
 * Result of analyzing a code snippet
 */
export interface CodeAnalysisResult {
  id: string;
  code: string;
  language: string;
  timestamp: Date;
  issues: CodeIssue[];
  recommendations: string[];
  complexity: number; // 1-10 scale
  quality: number; // 1-10 scale
  llmModel: string;
  confidence: number;
  inferenceTime: number;
}

/**
 * A code issue identified during analysis
 */
export interface CodeIssue {
  type: 'bug' | 'performance' | 'security' | 'style' | 'maintainability';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  line: number;
  column?: number;
  suggestion?: string;
  ruleId?: string;
}

/**
 * Status of an LLM model
 */
export interface ModelStatus {
  id: string;
  name: string;
  isAvailable: boolean;
  size: number;
  isDownloaded: boolean;
  parameters: number;
  quantization?: string;
  tier?: ModelTier;
}

/**
 * Feature Flag Service interface
 */
export interface FeatureFlagService {
  /**
   * Get the value of a feature flag
   */
  getValue(key: string): Promise<string | number | boolean | null>;
  
  /**
   * Set the value of a feature flag
   */
  setValue(key: string, value: string | number | boolean | null): Promise<void>;
  
  /**
   * Check if a feature flag is enabled
   */
  isEnabled(key: string): Promise<boolean>;
}

/**
 * Collection-based Data Service Interface
 * This interface is used by plugins that need to work with collections
 */
export interface CollectionDataService {
  createCollectionIfNotExists(collectionName: string): Promise<void>;
  createIndex(collectionName: string, field: string): Promise<void>;
  upsert(collectionName: string, id: string, data: Record<string, unknown>): Promise<Record<string, unknown>>;
  findById(collectionName: string, id: string): Promise<Record<string, unknown> | null>;
  find(collectionName: string, filter: Record<string, unknown>): Promise<Record<string, unknown>[]>;
  delete(collectionName: string, id: string): Promise<boolean>;
}

/**
 * Filter options for querying crash logs
 */
export interface CrashLogFilterOptions {
  userId?: string;
  sessionId?: string;
  startDate?: Date;
  endDate?: Date;
  searchTerm?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'uploadedAt' | 'title' | 'userId';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Interface for the Crash Repository
 */
export interface ICrashRepository {
  initialize(): Promise<void>;
  saveCrashLog(log: CrashLog): Promise<CrashLog>;
  getCrashLogById(id: string): Promise<CrashLog | null>;
  getAllCrashLogs(): Promise<CrashLog[]>;
  getCrashLogsByUser(userId: string): Promise<CrashLog[]>;
  getFilteredCrashLogs(options: CrashLogFilterOptions): Promise<CrashLog[]>;
  deleteCrashLog(id: string): Promise<boolean>;
  saveAnalysisResult(analysis: CrashAnalysisResult): Promise<CrashAnalysisResult>;
  getAnalysisById(id: string): Promise<CrashAnalysisResult | null>;
  getAnalysesByCrashLogId(crashLogId: string): Promise<CrashAnalysisResult[]>;
}