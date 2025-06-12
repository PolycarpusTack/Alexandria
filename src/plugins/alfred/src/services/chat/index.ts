// Chat Services
export { 
  ChatService, 
  ChatServiceConfig, 
  StreamingChatOptions, 
  ChatAnalytics 
} from './chat-service';

export { 
  SessionManager, 
  SessionFilter, 
  SessionStats, 
  ExportOptions 
} from './session-manager';

// Re-export commonly used chat-related interfaces
export type {
  ChatSession,
  ChatMessage,
  StreamChunk,
  ProjectContext
} from '../../interfaces';