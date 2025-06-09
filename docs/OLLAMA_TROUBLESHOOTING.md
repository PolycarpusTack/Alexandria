# Ollama Integration Troubleshooting Guide

## Common Issues and Solutions

### 1. Connection Issues

**Problem**: "Failed to load default AI model" or connection refused errors

**Solutions**:
```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# Start Ollama (varies by OS)
# macOS/Linux:
ollama serve

# Windows:
# Start from system tray or run:
ollama serve
```

**Custom Host**:
```bash
# If Ollama runs on different port/host
export OLLAMA_HOST=http://192.168.1.100:11434
```

### 2. No Models Available

**Problem**: System detects Ollama but finds no models

**Solutions**:
```bash
# Install some models
ollama pull llama2
ollama pull mistral
ollama pull codellama
ollama pull nomic-embed-text  # For embeddings

# Verify models installed
ollama list
```

### 3. Model Loading Issues

**Problem**: Model detected but fails to load

**Possible Causes**:
- Insufficient memory
- Model corrupted
- Ollama service issues

**Solutions**:
```bash
# Check running models
curl http://localhost:11434/api/ps

# Remove and re-pull model
ollama rm llama2
ollama pull llama2

# Check system resources
free -h  # Linux/Mac
# or Task Manager on Windows
```

### 4. Streaming Not Working

**Problem**: Completions work but streaming fails

**Debug**:
```javascript
// Test streaming directly
const response = await fetch('http://localhost:11434/api/generate', {
  method: 'POST',
  body: JSON.stringify({
    model: 'llama2',
    prompt: 'Hello',
    stream: true
  })
});

const reader = response.body.getReader();
// Process stream...
```

### 5. Embeddings Not Supported

**Problem**: "Model doesn't support embeddings"

**Solution**:
```bash
# Install embedding model
ollama pull nomic-embed-text
ollama pull all-minilm

# Configure as default embedding model
# In config/ai-models.json:
{
  "preferences": {
    "defaultEmbeddingModel": "ollama:nomic-embed-text"
  }
}
```

## Performance Optimization

### 1. Slow Response Times

**Optimize Ollama**:
```bash
# Allocate more threads
export OLLAMA_NUM_THREADS=8

# Increase context window
export OLLAMA_MAX_LOADED_MODELS=2

# GPU acceleration (if available)
export OLLAMA_CUDA_VISIBLE_DEVICES=0
```

### 2. Memory Issues

**Monitor and Adjust**:
```bash
# Check model memory usage
curl http://localhost:11434/api/ps

# Unload unused models
curl -X DELETE http://localhost:11434/api/generate \
  -d '{"model": "unused-model", "keep_alive": 0}'
```

### 3. Concurrent Request Limits

**Configure in code**:
```typescript
const factory = new AIServiceFactory(logger, {
  maxConcurrentRequests: 3  // Reduce for stability
});
```

## Edge Cases

### 1. Model Name Variations

Ollama models can have tags:
- `llama2` (default/latest)
- `llama2:7b`
- `llama2:13b`
- `llama2:70b`

The system handles all variations correctly.

### 2. Custom/Fine-tuned Models

**Using custom models**:
```bash
# Create custom model
ollama create mymodel -f Modelfile

# It will be detected as:
# ollama:mymodel
```

### 3. Network Proxies

**Behind corporate proxy**:
```bash
export HTTP_PROXY=http://proxy:8080
export HTTPS_PROXY=http://proxy:8080
export NO_PROXY=localhost,127.0.0.1
```

### 4. Docker Deployment

**Running Ollama in Docker**:
```yaml
# docker-compose.yml
services:
  ollama:
    image: ollama/ollama
    ports:
      - "11434:11434"
    volumes:
      - ollama:/root/.ollama
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
```

**Configure Alexandria**:
```bash
export OLLAMA_HOST=http://ollama:11434
```

## Version Compatibility

### Minimum Ollama Version
- **Recommended**: v0.1.20 or later
- **Minimum**: v0.1.0

### API Changes
The implementation uses stable Ollama APIs that have been consistent across versions:
- `/api/tags` - Stable since v0.1.0
- `/api/generate` - Stable since v0.1.0
- `/api/embeddings` - Added in v0.1.7
- `/api/pull` - Stable since v0.1.0

## Debugging Tools

### 1. Quick Check Script
```bash
node scripts/quick-ollama-check.js
```

### 2. Full Compatibility Test
```bash
npm run test:ollama-compat
```

### 3. Manual API Test
```bash
# Test model list
curl http://localhost:11434/api/tags | jq

# Test generation
curl http://localhost:11434/api/generate -d '{
  "model": "llama2",
  "prompt": "Hello",
  "stream": false
}' | jq
```

### 4. Enable Debug Logging
```typescript
// Set log level
const logger = new Logger('ai-service', { level: 'debug' });
```

## Security Considerations

### 1. Local Network Access
```bash
# Restrict to localhost only (default)
OLLAMA_HOST=http://127.0.0.1:11434

# Or bind to specific interface
ollama serve --host 127.0.0.1
```

### 2. Authentication
Ollama doesn't support authentication by default. For production:
- Use reverse proxy with auth
- Restrict network access
- Run in isolated environment

### 3. Resource Limits
```bash
# Limit CPU usage
ollama serve --max-procs 4

# Limit memory
ulimit -v 8388608  # 8GB limit
```

## Getting Help

1. **Check Ollama logs**:
   ```bash
   journalctl -u ollama -f  # Linux systemd
   # Or check console output
   ```

2. **Alexandria AI logs**:
   - Check `logs/` directory
   - Enable debug mode
   - Run compatibility tests

3. **Community Resources**:
   - Ollama GitHub: https://github.com/ollama/ollama
   - Ollama Discord
   - Alexandria documentation

## Summary

The Alexandria-Ollama integration is robust and handles most edge cases gracefully. The dynamic model detection ensures compatibility with any Ollama setup, and the system provides clear error messages for troubleshooting.
