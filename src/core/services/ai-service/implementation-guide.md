# AI Service Implementation Guide

## Quick Start: Implementing the Shared Ollama Service

This guide shows how to implement the core AI service that all plugins will use.

## 1. Core AI Service Interface

```typescript
// src/core/services/ai-service/interfaces.ts
export interface AIModel {
  id: string;
  name: string;
  size: string;
  quantization?: string;
  context_length: number;
  capabilities: string[];
}

export interface CompletionOptions {
  model?: string;
  temperature?: number;
  max_tokens?: number;
  system_prompt?: string;
  stop_sequences?: string[];
}

export interface StreamOptions extends CompletionOptions {
  on_token?: (token: string) => void;
}

export interface AIService {
  // Model management
  listModels(): Promise<AIModel[]>;
  loadModel(modelId: string): Promise<void>;
  unloadModel(modelId: string): Promise<void>;
  getActiveModels(): AIModel[];
  
  // Inference
  complete(prompt: string, options?: CompletionOptions): Promise<string>;
  stream(prompt: string, options?: StreamOptions): AsyncGenerator<string>;
  
  // Embeddings
  embed(text: string, model?: string): Promise<number[]>;
  
  // Health check
  isHealthy(): Promise<boolean>;
}
```

## 2. Ollama Implementation

```typescript
// src/core/services/ai-service/ollama-service.ts
import axios from 'axios';
import { EventEmitter } from 'events';
import { AIService, AIModel, CompletionOptions, StreamOptions } from './interfaces';
import { Logger } from '../../../utils/logger';

export class OllamaService implements AIService {
  private baseUrl: string;
  private activeModels: Map<string, AIModel> = new Map();
  private events: EventEmitter;
  private logger: Logger;
  
  constructor(
    baseUrl: string = process.env.OLLAMA_HOST || 'http://localhost:11434',
    logger: Logger
  ) {
    this.baseUrl = baseUrl;
    this.logger = logger;
    this.events = new EventEmitter();
  }
  
  async listModels(): Promise<AIModel[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/tags`);
      return response.data.models.map((model: any) => ({
        id: model.name,
        name: model.name,
        size: model.size,
        context_length: model.context_length || 4096,
        capabilities: this.inferCapabilities(model.name)
      }));
    } catch (error) {
      this.logger.error('Failed to list models', { error });
      throw error;
    }
  }
  
  async loadModel(modelId: string): Promise<void> {
    try {
      // Pull model if not available
      await axios.post(`${this.baseUrl}/api/pull`, {
        name: modelId,
        stream: false
      });
      
      // Load into memory
      await axios.post(`${this.baseUrl}/api/generate`, {
        model: modelId,
        prompt: ' ', // Empty prompt to load model
        stream: false
      });
      
      const models = await this.listModels();
      const model = models.find(m => m.id === modelId);
      if (model) {
        this.activeModels.set(modelId, model);
        this.events.emit('model:loaded', { modelId });
      }
      
      this.logger.info(`Model loaded: ${modelId}`);
    } catch (error) {
      this.logger.error(`Failed to load model: ${modelId}`, { error });
      throw error;
    }
  }
  
  async complete(prompt: string, options?: CompletionOptions): Promise<string> {
    const model = options?.model || this.getDefaultModel();
    
    try {
      const response = await axios.post(`${this.baseUrl}/api/generate`, {
        model,
        prompt,
        stream: false,
        options: {
          temperature: options?.temperature || 0.7,
          num_predict: options?.max_tokens || 2048,
          stop: options?.stop_sequences
        },
        system: options?.system_prompt
      });
      
      return response.data.response;
    } catch (error) {
      this.logger.error('Completion failed', { error, model });
      throw error;
    }
  }
  
  async *stream(prompt: string, options?: StreamOptions): AsyncGenerator<string> {
    const model = options?.model || this.getDefaultModel();
    
    try {
      const response = await axios.post(`${this.baseUrl}/api/generate`, {
        model,
        prompt,
        stream: true,
        options: {
          temperature: options?.temperature || 0.7,
          num_predict: options?.max_tokens || 2048,
          stop: options?.stop_sequences
        },
        system: options?.system_prompt
      }, {
        responseType: 'stream'
      });
      
      for await (const chunk of response.data) {
        const lines = chunk.toString().split('\n').filter(Boolean);
        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            if (data.response) {
              yield data.response;
              options?.on_token?.(data.response);
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    } catch (error) {
      this.logger.error('Stream failed', { error, model });
      throw error;
    }
  }
  
  async embed(text: string, model?: string): Promise<number[]> {
    const embeddingModel = model || 'nomic-embed-text';
    
    try {
      const response = await axios.post(`${this.baseUrl}/api/embeddings`, {
        model: embeddingModel,
        prompt: text
      });
      
      return response.data.embedding;
    } catch (error) {
      this.logger.error('Embedding failed', { error, model: embeddingModel });
      throw error;
    }
  }
  
  private inferCapabilities(modelName: string): string[] {
    const capabilities = [];
    
    if (modelName.includes('code') || modelName.includes('deepseek')) {
      capabilities.push('code');
    }
    if (modelName.includes('embed')) {
      capabilities.push('embeddings');
    }
    if (modelName.includes('chat') || modelName.includes('llama')) {
      capabilities.push('chat');
    }
    
    return capabilities;
  }
  
  private getDefaultModel(): string {
    // Return first active model or default
    const firstActive = Array.from(this.activeModels.keys())[0];
    return firstActive || 'llama2';
  }
}
```

## 3. Service Factory with Caching

```typescript
// src/core/services/ai-service/ai-service-factory.ts
import { OllamaService } from './ollama-service';
import { CachedAIService } from './cached-ai-service';
import { Logger } from '../../../utils/logger';

export function createAIService(logger: Logger): AIService {
  // Create base Ollama service
  const ollamaService = new OllamaService(
    process.env.OLLAMA_HOST || 'http://localhost:11434',
    logger
  );
  
  // Wrap with caching layer
  return new CachedAIService(ollamaService, {
    ttl: 3600, // 1 hour cache
    maxSize: 100 // Max 100 cached responses
  });
}
```

## 4. Integration in Core System

```typescript
// src/core/index.ts
import { createAIService } from './services/ai-service/ai-service-factory';

export async function initializeCore(options: CoreOptions): Promise<CoreServices> {
  // ... existing code ...
  
  // Initialize AI service
  const aiService = createAIService(logger);
  
  // Auto-load default models
  try {
    await aiService.loadModel('llama2');
    await aiService.loadModel('deepseek-coder:latest');
    logger.info('Default AI models loaded');
  } catch (error) {
    logger.warn('Failed to load default models', { error });
  }
  
  return {
    coreSystem,
    eventBus,
    pluginRegistry,
    featureFlags,
    dataService,
    securityService,
    aiService // Add to core services
  };
}
```

## 5. Plugin Usage Example

```typescript
// src/plugins/alfred/src/services/alfred-service-enhanced.ts
export class EnhancedAlfredService {
  constructor(
    private aiService: AIService,
    private eventBus: EventBus
  ) {}
  
  async generateCode(request: CodeGenRequest): Promise<void> {
    const prompt = this.buildPrompt(request);
    
    // Use shared AI service for streaming
    const stream = this.aiService.stream(prompt, {
      model: 'deepseek-coder:latest',
      temperature: 0.7,
      system_prompt: 'You are an expert programmer...'
    });
    
    let fullCode = '';
    for await (const chunk of stream) {
      fullCode += chunk;
      // Emit events for UI updates
      this.eventBus.emit('alfred:code-chunk', { 
        sessionId: request.sessionId,
        chunk 
      });
    }
    
    // Post-process and save
    const processed = await this.postProcessCode(fullCode);
    await this.saveGeneratedCode(request.sessionId, processed);
  }
}
```

## 6. REST API Endpoints

```typescript
// src/core/services/ai-service/ai-api.ts
import { Router } from 'express';
import { AIService } from './interfaces';

export function createAIRouter(aiService: AIService): Router {
  const router = Router();
  
  // List available models
  router.get('/models', async (req, res) => {
    const models = await aiService.listModels();
    res.json({ models });
  });
  
  // Load a model
  router.post('/models/:modelId/load', async (req, res) => {
    await aiService.loadModel(req.params.modelId);
    res.json({ status: 'loaded' });
  });
  
  // Generate completion
  router.post('/complete', async (req, res) => {
    const { prompt, ...options } = req.body;
    const response = await aiService.complete(prompt, options);
    res.json({ response });
  });
  
  // Stream completion
  router.post('/stream', async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    
    const { prompt, ...options } = req.body;
    const stream = aiService.stream(prompt, options);
    
    for await (const chunk of stream) {
      res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
    }
    
    res.end();
  });
  
  return router;
}
```

## Next Steps

1. Install required dependencies:
```bash
pnpm add axios
```

2. Create the service files following this structure

3. Add AI service to the core initialization

4. Update plugins to use the shared service

5. Add caching and rate limiting

6. Create UI for model management

This shared service approach ensures all plugins use the same AI infrastructure, avoiding duplication and making it easy to switch models or providers in the future.