/**
 * Alfred AI Adapter
 * 
 * Adapts Alfred to use the shared Alexandria AI service (Ollama)
 * instead of its own Ollama client, ensuring consistency across plugins.
 */

import { AIService, CompletionOptions, StreamOptions } from '../../../../core/services/ai-service/interfaces';
import { EventEmitter } from 'events';
import { Logger } from '../../../../utils/logger';

export interface AlfredAIOptions {
  aiService: AIService;
  logger: Logger;
  defaultModel?: string;
  codeModel?: string;
}

export class AlfredAIAdapter extends EventEmitter {
  private aiService: AIService;
  private logger: Logger;
  private defaultModel: string;
  private codeModel: string;

  constructor(options: AlfredAIOptions) {
    super();
    this.aiService = options.aiService;
    this.logger = options.logger;
    this.defaultModel = options.defaultModel || 'llama2';
    this.codeModel = options.codeModel || 'deepseek-coder:latest';
  }

  /**
   * Send a chat message and get a response
   */
  async chat(
    message: string, 
    history: Array<{ role: string; content: string }> = [],
    options: CompletionOptions = {}
  ): Promise<string> {
    try {
      // Build messages array
      const messages = [
        ...history,
        { role: 'user', content: message }
      ];

      // Use the shared AI service
      const response = await this.aiService.completeChat({
        messages,
        model: options.model || this.defaultModel,
        temperature: options.temperature || 0.7,
        maxTokens: options.maxTokens
      });

      return response.message.content;
    } catch (error) {
      this.logger.error('Chat completion failed', { error });
      throw error;
    }
  }

  /**
   * Stream a chat response
   */
  async *streamChat(
    message: string,
    history: Array<{ role: string; content: string }> = [],
    options: StreamOptions = {}
  ): AsyncGenerator<string> {
    try {
      // Build full prompt with history
      let prompt = '';
      for (const msg of history) {
        prompt += `${msg.role}: ${msg.content}\n\n`;
      }
      prompt += `user: ${message}\n\nassistant: `;

      // Stream using the shared AI service
      const stream = this.aiService.stream(prompt, {
        model: options.model || this.defaultModel,
        temperature: options.temperature || 0.7
      });

      for await (const chunk of stream) {
        yield chunk;
      }
    } catch (error) {
      this.logger.error('Chat streaming failed', { error });
      throw error;
    }
  }

  /**
   * Generate code with the code-specific model
   */
  async generateCode(
    prompt: string,
    context?: string,
    options: CompletionOptions = {}
  ): Promise<string> {
    try {
      // Build a code-focused prompt
      let fullPrompt = '';
      if (context) {
        fullPrompt = `Context:\n${context}\n\n`;
      }
      fullPrompt += `Task: ${prompt}\n\nCode:`;

      const response = await this.aiService.complete(fullPrompt, {
        model: options.model || this.codeModel,
        temperature: options.temperature || 0.2, // Lower temperature for code
        maxTokens: options.maxTokens || 2000
      });

      return response.text;
    } catch (error) {
      this.logger.error('Code generation failed', { error });
      throw error;
    }
  }

  /**
   * Stream code generation
   */
  async *streamCode(
    prompt: string,
    context?: string,
    options: StreamOptions = {}
  ): AsyncGenerator<string> {
    try {
      // Build a code-focused prompt
      let fullPrompt = '';
      if (context) {
        fullPrompt = `Context:\n${context}\n\n`;
      }
      fullPrompt += `Task: ${prompt}\n\nCode:`;

      const stream = this.aiService.stream(fullPrompt, {
        model: options.model || this.codeModel,
        temperature: options.temperature || 0.2
      });

      for await (const chunk of stream) {
        yield chunk;
      }
    } catch (error) {
      this.logger.error('Code streaming failed', { error });
      throw error;
    }
  }

  /**
   * Analyze code and provide insights
   */
  async analyzeCode(
    code: string,
    question?: string,
    options: CompletionOptions = {}
  ): Promise<string> {
    try {
      let prompt = `Analyze the following code:\n\n\`\`\`\n${code}\n\`\`\`\n\n`;
      
      if (question) {
        prompt += `Question: ${question}\n\n`;
      } else {
        prompt += 'Provide a comprehensive analysis including:\n';
        prompt += '1. What the code does\n';
        prompt += '2. Potential issues or improvements\n';
        prompt += '3. Best practices recommendations\n\n';
      }
      
      prompt += 'Analysis:';

      const response = await this.aiService.complete(prompt, {
        model: options.model || this.codeModel,
        temperature: options.temperature || 0.5,
        maxTokens: options.maxTokens || 1500
      });

      return response.text;
    } catch (error) {
      this.logger.error('Code analysis failed', { error });
      throw error;
    }
  }

  /**
   * Generate embeddings for semantic search
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      return await this.aiService.embed(text);
    } catch (error) {
      this.logger.error('Embedding generation failed', { error });
      throw error;
    }
  }

  /**
   * Check if the AI service is healthy
   */
  async checkHealth(): Promise<boolean> {
    try {
      return await this.aiService.isHealthy();
    } catch (error) {
      this.logger.error('Health check failed', { error });
      return false;
    }
  }

  /**
   * Get available models
   */
  async getAvailableModels(): Promise<Array<{ id: string; name: string }>> {
    try {
      const models = await this.aiService.listModels();
      return models.map(m => ({
        id: m.id,
        name: m.name || m.id
      }));
    } catch (error) {
      this.logger.error('Failed to list models', { error });
      return [];
    }
  }

  /**
   * Load a specific model
   */
  async loadModel(modelId: string): Promise<void> {
    try {
      await this.aiService.loadModel(modelId);
      this.logger.info(`Model ${modelId} loaded successfully`);
    } catch (error) {
      this.logger.error(`Failed to load model ${modelId}`, { error });
      throw error;
    }
  }
}