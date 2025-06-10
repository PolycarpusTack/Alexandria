/**
 * Template Engine Interfaces
 * 
 * Core types and interfaces for the secure template system
 */

export interface TemplateManifest {
  schemaVersion: string;
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  license: string;
  category: string;
  tags: string[];
  
  security: {
    signature?: string;
    checksum: string;
    trustedPublisher?: boolean;
  };
  
  requirements: {
    projectTypes: string[];
    dependencies?: string[];
    minNodeVersion?: string;
  };
  
  variables: VariableSchema[];
  files: TemplateFile[];
  hooks?: TemplateHooks;
  limits: TemplateLimits;
}

export interface VariableSchema {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'array' | 'object';
  description: string;
  required: boolean;
  default?: any;
  validation?: VariableValidation;
  aiPrompt?: string;
  dependencies?: string[];
  condition?: ConditionExpression;
}

export interface VariableValidation {
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  options?: string[];
}

export interface TemplateFile {
  path: string;
  template: string;
  condition?: ConditionExpression;
  executable?: boolean;
}

export interface TemplateHooks {
  beforeGenerate?: string;
  afterGenerate?: string;
  onConflict?: string;
}

export interface TemplateLimits {
  maxFiles: number;
  maxTotalSize: string;
  allowedPaths: string[];
}

// Safe Domain-Specific Language for Conditions
export type ConditionExpression = 
  | { type: 'equals'; variable: string; value: any }
  | { type: 'notEquals'; variable: string; value: any }
  | { type: 'contains'; variable: string; value: string }
  | { type: 'startsWith'; variable: string; value: string }
  | { type: 'endsWith'; variable: string; value: string }
  | { type: 'greater'; variable: string; value: number }
  | { type: 'less'; variable: string; value: number }
  | { type: 'and'; conditions: ConditionExpression[] }
  | { type: 'or'; conditions: ConditionExpression[] }
  | { type: 'not'; condition: ConditionExpression };

export interface VariableMap {
  [key: string]: any;
}

export interface TemplateContext {
  variables: VariableMap;
  projectPath: string;
  projectContext?: any;
  metadata: {
    generatedAt: Date;
    templateId: string;
    templateVersion: string;
  };
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: string[];
}

export interface ValidationError {
  code: string;
  message: string;
  field?: string;
  severity: 'error' | 'warning';
}

export interface SecurityScanResult {
  safe: boolean;
  violations: SecurityViolation[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface SecurityViolation {
  type: 'secret' | 'vulnerability' | 'malicious-code' | 'path-traversal';
  description: string;
  file?: string;
  line?: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface PerformanceMetrics {
  parseTime: number;
  renderTime: number;
  totalTime: number;
  memoryUsage: number;
  filesGenerated: number;
  cacheHits: number;
  cacheMisses: number;
}

export interface RenderedTemplate {
  files: Map<string, RenderedFile>;
  conflicts: FileConflict[];
  metadata: RenderMetadata;
  performance: PerformanceMetrics;
}

export interface RenderedFile {
  path: string;
  content: string;
  language: string;
  size: number;
  executable?: boolean;
  checksum: string;
}

export interface FileConflict {
  filePath: string;
  existingContent: string;
  newContent: string;
  conflictType: 'overwrite' | 'merge' | 'append';
}

export interface RenderMetadata {
  templateId: string;
  templateVersion: string;
  renderedAt: Date;
  variables: VariableMap;
  performance: PerformanceMetrics;
}

// Add missing interfaces for Alfred integration
export interface GenerationResult {
  success: boolean;
  filesGenerated: string[];
  conflicts: FileConflict[];
  errors: string[];
  warnings: string[];
  duration: number;
  metadata?: RenderMetadata;
}

export interface TemplateEngineOptions {
  maxFileSize: number;
  allowedExtensions: string[];
  securityLevel: 'strict' | 'normal' | 'permissive';
  enableCaching: boolean;
}