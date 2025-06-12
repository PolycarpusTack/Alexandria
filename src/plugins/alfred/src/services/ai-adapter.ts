import { EventEmitter } from 'events';
import { ChatMessage, StreamChunk, CodeGenerationResponse, ProjectContext } from '../interfaces';
// Import Alexandria's shared AI service
import { AIService } from '@core/services/ai-service';
// Import helper methods
import { AlfredAIHelpers } from './ai-adapter-helpers';

export interface AlfredAIAdapterConfig {
  defaultModel?: string;
  fallbackEnabled?: boolean;
  retryAttempts?: number;
  timeoutMs?: number;
  enhancePromptsForCoding?: boolean;
}

export interface ChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  context?: ProjectContext;
  streamEnabled?: boolean;
}

export interface CodeGenerationOptions extends ChatOptions {
  language?: string;
  framework?: string;
  style?: 'functional' | 'class' | 'mixed';
  includeComments?: boolean;
  includeTests?: boolean;
}

export class AlfredAIAdapter extends EventEmitter {
  private aiService: AIService;
  private config: AlfredAIAdapterConfig;

  constructor(aiService: AIService, config: AlfredAIAdapterConfig = {}) {
    super();
    this.aiService = aiService;
    this.config = {
      fallbackEnabled: true,
      retryAttempts: 3,
      timeoutMs: 120000, // 2 minutes
      enhancePromptsForCoding: true,
      ...config
    };
  }

  async *streamChat(
    messages: ChatMessage[], 
    options: ChatOptions = {}
  ): AsyncIterableIterator<StreamChunk> {
    const model = options.model || this.config.defaultModel || 'gpt-4';
    const retryAttempts = this.config.retryAttempts || 3;
    
    for (let attempt = 1; attempt <= retryAttempts; attempt++) {
      try {
        this.emit('streamStart', { model, attempt });
        
        // Build enhanced system prompt for coding assistance
        const enhancedMessages = await this.enhanceMessagesForCoding(messages, options);
        
        // Use Alexandria's AI service for streaming
        const stream = await this.aiService.streamQuery(enhancedMessages, {
          model,
          temperature: options.temperature ?? 0.7,
          maxTokens: options.maxTokens || 2000,
          stream: true
        });
        
        for await (const chunk of stream) {
          // Transform Alexandria's stream format to Alfred's format
          const alfredChunk: StreamChunk = {
            content: chunk.content || '',
            done: chunk.done || false,
            metadata: {
              provider: chunk.provider,
              model: chunk.model || model,
              hasCode: chunk.content?.includes('```') || false,
              language: this.detectLanguage(chunk.content || '', options.context),
              tokenCount: chunk.tokenCount,
              ...chunk.metadata
            }
          };
          
          yield alfredChunk;
        }
        
        this.emit('streamComplete', { model });
        return;
        
      } catch (error) {
        this.emit('streamError', { model, error, attempt });
        
        if (attempt === retryAttempts) {
          throw new Error(`AI service temporarily unavailable: ${error.message}`);
        }
        
        // Exponential backoff
        await this.delay(Math.pow(2, attempt) * 1000);
      }
    }
  }

  async generateCode(
    prompt: string, 
    context: ProjectContext, 
    options: CodeGenerationOptions = {}
  ): Promise<CodeGenerationResponse> {
    const model = options.model || this.config.defaultModel || 'gpt-4';
    
    try {
      // Build enhanced code generation prompt using Alexandria's AI service
      const enhancedPrompt = this.buildCodePrompt(prompt, context, options);
      
      const response = await this.aiService.query(enhancedPrompt, {
        model,
        temperature: options.temperature || 0.2, // Lower temp for code generation
        maxTokens: options.maxTokens || 2000,
        systemPrompt: this.buildCodeSystemPrompt(options)
      });

      // Extract and process the generated code
      const { code, language, explanation } = this.extractCodeFromResponse(response.content);
      
      const result: CodeGenerationResponse = {
        id: `alfred-${Date.now()}`,
        code,
        language: language || options.language || 'text',
        explanation,
        dependencies: this.extractDependencies(code, language),
        warnings: this.detectWarnings(code, language),
        timestamp: new Date(),
        metadata: {
          model,
          provider: response.provider,
          tokensUsed: response.tokensUsed || 0,
          complexity: this.analyzeComplexity(code),
          hasTests: code.includes('test') || code.includes('spec'),
          hasComments: this.hasComments(code, language)
        }
      };
      
      this.emit('codeGenerated', { 
        model, 
        language: result.language,
        lines: result.code.split('\n').length
      });
      
      return result;
      
    } catch (error) {
      this.emit('codeGenerationError', { model, error });
      throw error;
    }
  }

  async getCodeSuggestions(
    code: string, 
    cursorPosition: { line: number; column: number }, 
    context: ProjectContext
  ): Promise<Array<{ suggestion: string; confidence: number; type: string }>> {
    const model = this.config.defaultModel || 'gpt-3.5-turbo'; // Use faster model for suggestions
    
    try {
      // Build context around cursor
      const suggestionPrompt = this.buildSuggestionPrompt(code, cursorPosition, context);
      
      const response = await this.aiService.query(suggestionPrompt, {
        model,
        temperature: 0.3,
        maxTokens: 500,
        systemPrompt: `You are a coding assistant providing intelligent code suggestions. Return suggestions as JSON array with format:
[{"suggestion": "code", "confidence": 0.9, "type": "completion|import|refactor|fix|test", "description": "..."}]`
      });
      
      try {
        // Try to parse JSON response
        const jsonMatch = response.content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const suggestions = JSON.parse(jsonMatch[0]);
          return Array.isArray(suggestions) ? suggestions.slice(0, 5) : [];
        }
        
        // Fallback parsing
        return this.extractSuggestionsFromText(response.content);
      } catch {
        return this.extractSuggestionsFromText(response.content);
      }
        
    } catch (error) {
      this.emit('suggestionError', { model, error });
      return [];
    }
  }

  // Enhanced method for multi-turn conversations with memory
  async continueConversation(
    sessionId: string,
    newMessage: string,
    history: ChatMessage[] = [],
    context?: ProjectContext
  ): Promise<{ response: string; metadata: any }> {
    const model = this.config.defaultModel || 'gpt-4';
    
    try {
      // Build conversation with context
      const messages = await this.buildConversationMessages(history, newMessage, context, sessionId);
      
      const response = await this.aiService.query(messages, {
        model,
        temperature: 0.7,
        maxTokens: 2000,
        systemPrompt: this.buildCodingAssistantSystemPrompt(context, sessionId)
      });
      
      return {
        response: response.content,
        metadata: {
          model,
          provider: response.provider,
          tokensUsed: response.tokensUsed || 0,
          sessionId,
          hasCode: response.content.includes('```'),
          timestamp: new Date()
        }
      };
      
    } catch (error) {
      this.emit('conversationError', { sessionId, error });
      throw error;
    }
  }

  // Helper methods for building prompts and processing responses
  
  private async enhanceMessagesForCoding(
    messages: ChatMessage[], 
    options: ChatOptions
  ): Promise<string> {
    if (!this.config.enhancePromptsForCoding) {
      return messages.map(m => `${m.role}: ${m.content}`).join('\n');
    }

    let prompt = '';
    
    // Add coding context if available
    if (options.context) {
      prompt += this.buildProjectContextPrompt(options.context) + '\n\n';
    }
    
    // Add conversation
    for (const message of messages) {
      const role = message.role === 'user' ? 'Human' : 'Assistant';
      prompt += `${role}: ${message.content}\n`;
    }
    
    return prompt;
  }

  private buildCodeSystemPrompt(options: CodeGenerationOptions): string {
    let prompt = `You are Alfred, an expert software engineer. Generate clean, production-ready code that follows best practices.

Requirements:
- Write syntactically correct code
- Include proper error handling
- Add meaningful comments
- Follow modern conventions
- Use descriptive names
- Consider performance and security`;

    if (options.language) {
      prompt += `\n- Generate code in ${options.language}`;
    }

    if (options.includeTests) {
      prompt += `\n- Include comprehensive unit tests`;
    }

    if (options.includeComments) {
      prompt += `\n- Add detailed documentation comments`;
    }

    if (options.style) {
      prompt += `\n- Follow ${options.style} programming style`;
    }

    return prompt;
  }

  private buildCodePrompt(
    prompt: string, 
    context: ProjectContext, 
    options: CodeGenerationOptions
  ): string {
    return AlfredAIHelpers.buildCodePrompt(prompt, context, options);
  }

  private buildSuggestionPrompt(
    code: string, 
    cursorPosition: { line: number; column: number }, 
    context: ProjectContext
  ): string {
    return AlfredAIHelpers.buildSuggestionPrompt(code, cursorPosition, context);
  }

  private buildProjectContextPrompt(context: ProjectContext): string {
    return AlfredAIHelpers.buildProjectContextPrompt(context);
  }

  private async buildConversationMessages(
    history: ChatMessage[], 
    newMessage: string, 
    context?: ProjectContext, 
    sessionId?: string
  ): Promise<string> {
    return AlfredAIHelpers.buildConversationMessages(history, newMessage, context, sessionId);
  }

  private buildCodingAssistantSystemPrompt(context?: ProjectContext, sessionId?: string): string {
    return AlfredAIHelpers.buildCodingAssistantSystemPrompt(context, sessionId);
  }

  private extractCodeFromResponse(content: string): { code: string; language: string; explanation?: string } {
    return AlfredAIHelpers.extractCodeFromResponse(content);
  }

  private extractDependencies(code: string, language: string): string[] {
    return AlfredAIHelpers.extractDependencies(code, language);
  }

  private detectWarnings(code: string, language: string): string[] {
    return AlfredAIHelpers.detectWarnings(code, language);
  }

  private hasComments(code: string, language: string): boolean {
    return AlfredAIHelpers.hasComments(code, language);
  }

  private analyzeComplexity(code: string): 'low' | 'medium' | 'high' {
    return AlfredAIHelpers.analyzeComplexity(code);
  }

  private detectLanguage(content: string, context?: ProjectContext): string | undefined {
    return AlfredAIHelpers.detectLanguage(content, context);
  }

  private extractSuggestionsFromText(text: string): Array<{ suggestion: string; confidence: number; type: string }> {
    return AlfredAIHelpers.extractSuggestionsFromText(text);
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Public API methods
  async healthCheck(): Promise<boolean> {
    try {
      // Use Alexandria's AI service health check
      const health = await this.aiService.healthCheck();
      return health.status === 'healthy';
    } catch (error) {
      this.emit('healthCheckError', { error });
      return false;
    }
  }

  getAvailableModels(): string[] {
    // Get available models from Alexandria's AI service
    return this.aiService.getAvailableModels() || [];
  }

  setDefaultModel(model: string): void {
    this.config.defaultModel = model;
    this.emit('modelChanged', { model });
  }

  getConfig(): AlfredAIAdapterConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<AlfredAIAdapterConfig>): void {
    this.config = { ...this.config, ...updates };
    this.emit('configUpdated', { config: this.config });
  }
}