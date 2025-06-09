/**
 * Migration Guide: From Static to Dynamic AI Configuration
 * 
 * This guide helps migrate from the old hardcoded system to the new dynamic system
 */

# AI Model Configuration Migration Guide

## Overview

The Alexandria AI system has been upgraded from a static, hardcoded model configuration to a dynamic detection system that:
- Automatically discovers Ollama models
- Allows configuration of API models through JSON
- Provides real-time model availability updates
- Removes all hardcoded model references

## Migration Steps

### 1. Update Environment Variables

Remove old static variables:
```bash
# OLD (remove these)
OLLAMA_MODEL=llama2
DEFAULT_AI_MODEL=llama2
```

Keep only:
```bash
# NEW (keep these)
OLLAMA_HOST=http://localhost:11434
OPENAI_API_KEY=your-key      # Optional
ANTHROPIC_API_KEY=your-key   # Optional
```

### 2. Create Configuration File

Copy the example configuration:
```bash
cp config/ai-models.example.json config/ai-models.json
```

Edit `config/ai-models.json` to enable your API providers:
```json
{
  "providers": [
    {
      "id": "openai",
      "enabled": true,  // Set to true
      "apiKey": "sk-..." // Add your key
    }
  ]
}
```


### 3. Update Code References

#### Old Code (Static):
```typescript
import { createAIService } from './core/services/ai-service';

const aiService = createAIService({
  provider: 'ollama',
  defaultModel: 'llama2'  // Hardcoded model
}, logger);
```

#### New Code (Dynamic):
```typescript
import { createDynamicAIService } from './core/services/ai-service';

const aiService = await createDynamicAIService(logger, {
  configPath: 'config/ai-models.json'
});
// Models are detected automatically!
```

### 4. Update Plugin Code

If your plugins directly reference models:

#### Old:
```typescript
const response = await aiService.complete(prompt, {
  model: 'llama2'  // Hardcoded
});
```

#### New:
```typescript
// Let the system choose the best available model
const response = await aiService.complete(prompt);

// Or use a detected model
const models = await aiService.listModels();
const response = await aiService.complete(prompt, {
  model: models[0].id  // Dynamic
});
```

### 5. Handle Model Availability

The new system provides better error handling:

```typescript
import { AIServiceFactory } from './core/services/ai-service';

const factory = new AIServiceFactory(logger);
await factory.initialize();

// Check if any models are available
const models = factory.getModelRegistry().getAvailableModels();
if (models.length === 0) {
  logger.error('No AI models available. Please install Ollama models or configure API keys.');
  // Graceful degradation
}
```


## Benefits of Migration

1. **No More "Model not found" Errors**: Models are detected dynamically
2. **Easy Model Switching**: Change models without code changes
3. **Multi-Provider Support**: Use Ollama, OpenAI, Anthropic in the same app
4. **Cost Optimization**: Configure costs and choose models based on budget
5. **Better Monitoring**: Real-time model availability events

## Testing Your Migration

Run the test script to verify everything works:

```bash
npm run test:ai-models
# or
ts-node scripts/test-ai-models.ts
```

Expected output:
```
🚀 Testing Dynamic AI Model Configuration

🔗 Provider connected: ollama
✅ Discovered: llama2 (ollama)
✅ Discovered: codellama (ollama)

📋 All Detected Models:
  ✅ Available ollama:llama2 - llama2 (local)
  ✅ Available ollama:codellama - codellama (local)
  ❌ Unavailable openai:gpt-4 - GPT-4 (api)
    └─ Error: API key not configured

🟢 Available Models:
  - ollama:llama2 (ollama)
  - ollama:codellama (ollama)

⭐ Default Model: ollama:llama2
```

## Troubleshooting

### No Models Detected

1. **Check Ollama is running**:
   ```bash
   curl http://localhost:11434/api/tags
   ```

2. **Install Ollama models**:
   ```bash
   ollama pull llama2
   ollama pull codellama
   ```

3. **Check configuration file exists**:
   ```bash
   ls config/ai-models.json
   ```

### API Models Not Working

1. **Verify API keys are set**:
   - In environment variables
   - Or in `config/ai-models.json`

2. **Enable the provider**:
   ```json
   {
     "enabled": true  // Must be true
   }
   ```

3. **Check connectivity**:
   - Network access to API endpoints
   - Valid API keys

## Rollback Plan

If you need to rollback to the old system:

1. Use the deprecated `createAIService` function
2. Set `OLLAMA_MODEL` environment variable
3. The old code still works but shows deprecation warnings

## Need Help?

- Check logs for detailed error messages
- Review the example configuration file
- Run the test script to diagnose issues
- The system will always try to use available models

## Summary

The new dynamic AI configuration system eliminates hardcoded models and provides a flexible, provider-agnostic solution. Migration is straightforward and brings immediate benefits in terms of reliability and flexibility.
