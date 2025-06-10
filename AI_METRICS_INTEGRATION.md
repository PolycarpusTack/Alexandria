# AI Metrics Integration

## Overview

I've successfully integrated AI request metrics tracking into the Alexandria platform. This allows real-time monitoring of AI model usage, performance, and health status.

## Implementation Details

### 1. **MetricsAIService Wrapper**
- Created a new `MetricsAIService` class that wraps any AI service implementation
- Automatically tracks:
  - Request count per model
  - Response times
  - Token usage
  - Error rates
  - Provider information (OpenAI, Anthropic, Ollama)

### 2. **AI Model Monitor**
- Enhanced the `ai-model-monitor.ts` utility to track detailed metrics
- Calculates:
  - Requests per hour
  - Average response time
  - Model load percentage
  - Error rates
- Supports multiple providers with proper formatting

### 3. **Automatic Integration**
- The AIServiceFactory automatically wraps services with metrics tracking
- Metrics are enabled by default (can be disabled with `enableMetrics: false`)
- Works seamlessly with existing caching layer

## API Endpoint

The metrics are exposed through the existing system metrics API:

```
GET /api/system/ai/models/status
```

Returns:
```json
[
  {
    "id": "gpt-3.5-turbo",
    "name": "GPT-3.5 Turbo",
    "provider": "OpenAI",
    "status": "online",
    "load": 25,
    "requestsPerHour": 250,
    "avgResponseTime": 450,
    "errorRate": 0.02
  },
  {
    "id": "claude-3-sonnet-20240229",
    "name": "Claude 3 Sonnet",
    "provider": "Anthropic",
    "status": "online",
    "load": 15,
    "requestsPerHour": 150,
    "avgResponseTime": 380,
    "errorRate": 0.01
  }
]
```

## Usage

### Basic Usage (Metrics Enabled by Default)
```typescript
const aiService = await createDynamicAIService(logger);
// Metrics are automatically tracked
const response = await aiService.complete('Hello world');
```

### Disable Metrics
```typescript
const aiService = await createDynamicAIService(logger, {
  enableMetrics: false
});
```

### Legacy API (Also Supports Metrics)
```typescript
const aiService = createAIService(config, logger);
// Metrics enabled unless AI_METRICS_ENABLED=false
```

## Testing

Run the test script to verify metrics tracking:
```bash
node test-ai-metrics.js
```

## Dashboard Integration

The metrics are already integrated with the LiveDashboard component, which displays:
- Real-time AI model status
- Request rates and performance metrics
- Health indicators (online/offline/degraded)
- Provider information

## Benefits

1. **Performance Monitoring**: Track response times and identify slow models
2. **Usage Analytics**: Understand which models are being used most
3. **Error Tracking**: Quickly identify models with high error rates
4. **Cost Optimization**: Monitor token usage for cost management
5. **Load Balancing**: See model load to distribute requests effectively

## Future Enhancements

1. **Persistent Storage**: Currently metrics are in-memory; could be persisted to database
2. **Historical Data**: Track metrics over time for trend analysis
3. **Alerts**: Set up alerts for high error rates or slow response times
4. **Model Comparison**: Compare performance across different models
5. **Token Cost Tracking**: Calculate estimated costs based on token usage