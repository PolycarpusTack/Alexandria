# Dynamic AI Model Configuration

This system automatically detects available Ollama models and allows configuration of API-based models without any hardcoded data.

## Features

- **Automatic Ollama Detection**: Discovers all locally installed Ollama models
- **API Model Configuration**: Support for OpenAI, Anthropic, Azure OpenAI, and custom providers
- **Dynamic Model Registry**: Models are detected and updated in real-time
- **No Hardcoded Models**: Everything is configuration-driven
- **Fallback Support**: Automatically falls back to available models if preferred model is unavailable

## Configuration

### 1. Environment Variables

```bash
# Ollama Configuration
OLLAMA_HOST=http://localhost:11434

# API Keys (optional - only if using API models)
OPENAI_API_KEY=your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key
AZURE_OPENAI_API_KEY=your-azure-key
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com

# Configuration Path (optional)
AI_CONFIG_PATH=config/ai-models.json
```

### 2. Model Configuration File

Copy `config/ai-models.example.json` to `config/ai-models.json` and configure your API models:

```json
{
  "providers": [
    {
      "id": "openai",
      "name": "OpenAI",
      "type": "openai",
      "enabled": true,  // Set to true to enable
      "apiKey": "sk-..."  // Or use environment variable
    }
  ],
  "apiModels": [
    // Add your API models here
  ]
}
```


## Usage

### Basic Usage

```typescript
import { createDynamicAIService } from './core/services/ai-service';
import { Logger } from './utils/logger';

const logger = new Logger('ai-service');

// Create AI service with automatic model detection
const aiService = await createDynamicAIService(logger, {
  configPath: 'config/ai-models.json',
  enableCache: true,
  cacheOptions: {
    ttl: 3600,
    maxSize: 100
  }
});

if (aiService) {
  // Use the service
  const response = await aiService.complete('Hello, world!');
  console.log(response.text);
}
```

### Using the AI Service Factory

```typescript
import { AIServiceFactory } from './core/services/ai-service';
import { Logger } from './utils/logger';

const logger = new Logger('ai-factory');
const factory = new AIServiceFactory(logger);

// Initialize and detect all models
await factory.initialize();

// Get available models
const models = factory.getModelRegistry().getAvailableModels();
console.log('Available models:', models);

// Get service for specific model
const service = factory.getService('ollama:llama2');

// Get default service
const defaultService = factory.getDefaultService();
```


## Model Detection

### Ollama Models

Ollama models are automatically detected by querying the local Ollama server. The system will:

1. Query `http://localhost:11434/api/tags` (or custom `OLLAMA_HOST`)
2. Discover all installed models
3. Make them available with the prefix `ollama:` (e.g., `ollama:llama2`, `ollama:codellama`)

### API Models

API models must be configured in the `ai-models.json` file:

1. Enable the provider by setting `enabled: true` and providing an API key
2. Add model configurations to the `apiModels` array
3. Models will be available with the prefix `providerId:model` (e.g., `openai:gpt-4`)

## Events

The system emits various events for monitoring:

```typescript
factory.on('model:available', ({ modelId }) => {
  console.log(`Model available: ${modelId}`);
});

factory.on('model:unavailable', ({ modelId, error }) => {
  console.log(`Model unavailable: ${modelId} - ${error}`);
});

factory.on('provider:connected', ({ providerId }) => {
  console.log(`Provider connected: ${providerId}`);
});
```

## Adding Custom Providers

To add support for new AI providers:

1. Implement the provider service (extending `AIService` interface)
2. Add the provider type to the configuration
3. Update `AIServiceFactory.createServiceForModel()` to handle the new provider

## Troubleshooting

- **No models detected**: Ensure Ollama is running and accessible
- **API models not available**: Check API keys and provider endpoints
- **Model not loading**: Check logs for specific error messages

## Benefits Over Static Configuration

1. **Dynamic Discovery**: No need to hardcode model names
2. **Real-time Updates**: Models are detected as they become available
3. **Provider Agnostic**: Easy to switch between Ollama and API models
4. **Configuration Driven**: All settings in one place
5. **Graceful Fallback**: Automatically uses available models
