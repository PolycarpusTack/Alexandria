// Enhanced UI Components for Alfred
export { CodeBlock } from './CodeBlock';
export { EnhancedChatInterface } from './EnhancedChatInterface';
export { TemplateWizard } from './TemplateWizard';
export { CommandPalette, createDefaultCommands, useCommandPalette } from './CommandPalette';

// Component types
export type { Command } from './CommandPalette';

// Re-export commonly used interfaces
export type {
  ChatMessage,
  StreamChunk,
  ProjectContext,
  CodeTemplate,
  TemplateVariable
} from '../../../src/interfaces';