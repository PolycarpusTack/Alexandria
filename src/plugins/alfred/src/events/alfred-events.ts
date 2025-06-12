/**
 * Alfred Plugin Event Definitions
 * 
 * Standardized event interfaces for the Alfred plugin to ensure consistency
 * and type safety across the plugin's event-driven architecture.
 */

import { EventData } from '../../../../core/event-bus/interfaces';

// Alfred Event Topics - Standardized naming convention
export const ALFRED_EVENTS = {
  // Session Events
  SESSION_CREATED: 'alfred:session:created',
  SESSION_UPDATED: 'alfred:session:updated', 
  SESSION_DELETED: 'alfred:session:deleted',
  
  // Message Events
  MESSAGE_SENT: 'alfred:message:sent',
  MESSAGE_RECEIVED: 'alfred:message:received',
  
  // Code Generation Events
  CODE_GENERATED: 'alfred:code:generated',
  CODE_GENERATION_STARTED: 'alfred:code:generation:started',
  CODE_GENERATION_FAILED: 'alfred:code:generation:failed',
  
  // Template Events  
  TEMPLATE_CREATED: 'alfred:template:created',
  TEMPLATE_UPDATED: 'alfred:template:updated',
  TEMPLATE_DELETED: 'alfred:template:deleted',
  TEMPLATE_GENERATED: 'alfred:template:generated',
  TEMPLATE_GENERATION_PROGRESS: 'alfred:template:generation:progress',
  TEMPLATE_USAGE_RECORDED: 'alfred:template:usage:recorded',
  TEMPLATE_INSTALLED: 'alfred:template:installed',
  TEMPLATE_UNINSTALLED: 'alfred:template:uninstalled',
  
  // File Events
  FILE_CREATED: 'alfred:file:created',
  FILE_UPDATED: 'alfred:file:updated', 
  FILE_DELETED: 'alfred:file:deleted',
  FILE_WRITTEN: 'alfred:file:written',
  
  // Project Events
  PROJECT_ANALYZED: 'alfred:project:analyzed',
  PROJECT_CHANGED: 'alfred:project:changed',
  
  // Cache Events
  TREE_CACHED: 'alfred:tree:cached',
  CACHE_INVALIDATED: 'alfred:cache:invalidated',
  
  // Error Events
  ERROR: 'alfred:error',
  
  // UI Events
  SHOW_GENERATE_DIALOG: 'alfred:ui:show:generate:dialog',
  
  // Resource Events
  RESOURCE_ALERT: 'alfred:resource:alert',
  RESOURCE_CLEANUP: 'alfred:resource:cleanup'
} as const;

// Event Data Interfaces - Type-safe event payloads

export interface SessionCreatedEventData extends EventData {
  session: {
    id: string;
    userId: string;
    projectContext?: any;
    createdAt: Date;
  };
}

export interface SessionUpdatedEventData extends EventData {
  session: {
    id: string;
    userId: string;
    updatedAt: Date;
  };
}

export interface SessionDeletedEventData extends EventData {
  sessionId: string;
}

export interface MessageSentEventData extends EventData {
  message: {
    id: string;
    sessionId: string;
    content: string;
    role: 'user' | 'assistant';
    timestamp: Date;
  };
}

export interface CodeGeneratedEventData extends EventData {
  language: string;
  linesOfCode: number;
  templateUsed?: string;
  duration: number;
  response?: any;
}

export interface CodeGenerationStartedEventData extends EventData {
  sessionId: string;
  request: any;
  timestamp: Date;
}

export interface CodeGenerationFailedEventData extends EventData {
  sessionId: string;
  error: string;
  request: any;
}

export interface TemplateCreatedEventData extends EventData {
  templateId: string;
  template: any;
  userId: string;
}

export interface TemplateUpdatedEventData extends EventData {
  templateId: string;
  changes: Record<string, any>;
  userId: string;
}

export interface TemplateDeletedEventData extends EventData {
  templateId: string;
  userId: string;
}

export interface TemplateGeneratedEventData extends EventData {
  templateId: string;
  outputPath: string;
  variables: Record<string, any>;
  success: boolean;
  generatedFiles: string[];
}

export interface TemplateGenerationProgressEventData extends EventData {
  templateId: string;
  step: string;
  progress: number; // 0-100
  message?: string;
}

export interface TemplateUsageRecordedEventData extends EventData {
  templateId: string;
  stats: {
    usageCount: number;
    lastUsed: Date;
    averageRating?: number;
  };
}

export interface TemplateInstalledEventData extends EventData {
  templateId: string;
  source: string;
  version: string;
}

export interface TemplateUninstalledEventData extends EventData {
  templateId: string;
  reason?: string;
}

export interface FileCreatedEventData extends EventData {
  projectPath: string;
  filePath: string;
  content?: string;
  language?: string;
}

export interface FileUpdatedEventData extends EventData {
  projectPath: string;
  filePath: string;
  content?: string;
  changes?: any;
}

export interface FileDeletedEventData extends EventData {
  projectPath: string;
  filePath: string;
}

export interface FileWrittenEventData extends EventData {
  filepath: string;
  content: string;
  size: number;
}

export interface ProjectAnalyzedEventData extends EventData {
  projectPath: string;
  analysis: any;
  duration: number;
  statistics?: any;
}

export interface ProjectChangedEventData extends EventData {
  path: string;
  changeType: 'file_added' | 'file_removed' | 'file_modified' | 'structure_changed';
  affectedFiles?: string[];
}

export interface TreeCachedEventData extends EventData {
  path: string;
  nodeCount: number;
  cacheSize: number;
  cacheDuration: number;
}

export interface CacheInvalidatedEventData extends EventData {
  path: string;
  reason?: string;
}

export interface ErrorEventData extends EventData {
  sessionId?: string;
  error: Error | string;
  context?: Record<string, any>;
  severity?: 'low' | 'medium' | 'high' | 'critical';
}

export interface ShowGenerateDialogEventData extends EventData {
  context?: any;
  initialTemplate?: string;
}

export interface ResourceAlertEventData extends EventData {
  quotaId: string;
  resourceType: 'memory' | 'files' | 'size';
  currentUsage: number;
  limit: number;
  usagePercent: number;
}

export interface ResourceCleanupEventData extends EventData {
  quotaId: string;
  cleanedResources?: {
    memory?: number;
    files?: number;
    size?: number;
  };
}

// Type guards for event data validation
export const isSessionCreatedEvent = (data: EventData): data is SessionCreatedEventData => {
  return typeof data === 'object' && 'session' in data;
};

export const isCodeGeneratedEvent = (data: EventData): data is CodeGeneratedEventData => {
  return typeof data === 'object' && 'language' in data && 'linesOfCode' in data;
};

export const isErrorEvent = (data: EventData): data is ErrorEventData => {
  return typeof data === 'object' && 'error' in data;
};

// Event utility functions
export const createAlfredEvent = <T extends EventData>(topic: string, data: T) => ({
  topic,
  data,
  timestamp: new Date(),
  source: 'alfred-plugin'
});

export const validateEventTopic = (topic: string): boolean => {
  return Object.values(ALFRED_EVENTS).includes(topic as any);
};