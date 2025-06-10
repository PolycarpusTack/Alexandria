import { MnemosyneDocument } from '../../interfaces';

export interface TemplateVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object';
  description?: string;
  defaultValue?: any;
  required?: boolean;
  options?: string[]; // For enum-like variables
  validation?: {
    pattern?: string;
    min?: number;
    max?: number;
  };
}

export interface TemplateMetadata {
  category: string;
  tags: string[];
  author: string;
  version: string;
  description?: string;
  usage: UsageMetrics;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  estimatedTime?: number; // minutes
}

export interface UsageMetrics {
  totalUses: number;
  lastUsed: Date;
  averageCompletionTime: number;
  modificationRate: number;
  satisfactionScore: number;
  successRate: number;
}

export interface TemplateAnalytics {
  usageCount: number;
  averageCompletionTime: number;
  modificationRate: number;
  satisfactionScore: number;
  knowledgeImpact: number;
  evolutionScore: number;
  commonModifications: TemplateModification[];
  userFeedback: TemplateFeedback[];
}

export interface TemplateModification {
  section: string;
  changeType: 'add' | 'remove' | 'modify';
  frequency: number;
  content: string;
}

export interface TemplateFeedback {
  userId: string;
  rating: number;
  comment?: string;
  suggestions?: string[];
  timestamp: Date;
}

export interface KnowledgeRelationship {
  id: string;
  type: 'prerequisite' | 'related' | 'derived' | 'references';
  targetId: string;
  targetTitle: string;
  strength: number; // 0-1
  context?: string;
}

export interface MnemosyneTemplate {
  id: string;
  name: string;
  content: string;
  type: 'document' | 'snippet';
  metadata: TemplateMetadata;
  variables: TemplateVariable[];
  relationships: KnowledgeRelationship[];
  analytics: TemplateAnalytics;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  isPublic: boolean;
  isOfficial?: boolean; // Organization-approved templates
}

export interface TemplateContext {
  // Core Mnemosyne variables
  mnemosyne: {
    id: string;
    version: number;
    created: Date;
    updated: Date;
    related: Array<{ id: string; title: string; estimatedTime?: number }>;
    prerequisites: Array<{ id: string; title: string; estimatedTime: number }>;
    learningPath: string;
    knowledgeScore: number;
    collaborativeNotes: Array<{ author: string; note: string; timestamp: Date }>;
  };
  
  // AI-enhanced variables
  alfred?: {
    available: boolean;
    summary?: string;
    codeExamples?: string[];
    suggestions?: string[];
    relatedConcepts?: string[];
  };
  
  // User context
  user: {
    id: string;
    name: string;
    expertise: string[];
    preferences: Record<string, any>;
  };
  
  // Project context
  project?: {
    name: string;
    type: string;
    technologies: string[];
    team: string[];
  };
  
  // Custom variables from user input
  variables: Record<string, any>;
}

export interface TemplateGenerationRequest {
  prompt: string;
  type: 'document' | 'snippet';
  category?: string;
  context?: Partial<TemplateContext>;
  constraints?: {
    maxLength?: number;
    includeVariables?: boolean;
    includeExamples?: boolean;
    targetAudience?: string;
  };
}

export interface TemplateRenderOptions {
  context: TemplateContext;
  preserveUnresolved?: boolean; // Keep {{variable}} if not found
  strict?: boolean; // Throw error on missing required variables
  formatOutput?: boolean; // Auto-format code blocks, etc.
}

export interface TemplateSearchCriteria {
  query?: string;
  category?: string;
  tags?: string[];
  type?: 'document' | 'snippet';
  author?: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  relatedTo?: string; // Document ID
  minRating?: number;
  recentlyUsed?: boolean;
  official?: boolean;
}

export interface TemplateEvolutionSuggestion {
  type: 'add_variable' | 'remove_variable' | 'add_section' | 'remove_section' | 'modify_content';
  description: string;
  impact: 'low' | 'medium' | 'high';
  evidence: {
    usagePatterns: string[];
    userFeedback: string[];
    successMetrics: Record<string, number>;
  };
  suggestedChange: string;
}

export interface Snippet {
  id: string;
  name: string;
  content: string;
  description?: string;
  category: string;
  tags: string[];
  language?: string;
  variables: TemplateVariable[];
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  usageCount: number;
  isPublic: boolean;
}

export interface SnippetCategory {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  snippetCount: number;
}

export interface TemplateImportOptions {
  source: 'obsidian' | 'notion' | 'roam' | 'markdown' | 'json';
  preserveFormatting?: boolean;
  extractVariables?: boolean;
  categorize?: boolean;
}

export interface TemplateExportOptions {
  format: 'markdown' | 'json' | 'html' | 'pdf';
  includeMetadata?: boolean;
  includeAnalytics?: boolean;
  bundleAssets?: boolean;
}