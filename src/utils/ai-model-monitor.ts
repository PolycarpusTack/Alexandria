import { createLogger } from './logger';
import { createDataService } from '../core/data/data-service-factory';

const logger = createLogger({
  serviceName: 'ai-model-monitor',
  level: 'info',
  format: 'simple'
});

export interface AIModelMetrics {
  modelId: string;
  provider?: string;
  requestCount: number;
  errorCount: number;
  totalTokens: number;
  avgResponseTime: number;
  lastActive: Date;
}

interface AIModelStatus {
  id: string;
  name: string;
  provider: string;
  status: 'online' | 'offline' | 'degraded';
  load: number; // percentage 0-100
  requestsPerHour: number;
  avgResponseTime?: number;
  errorRate?: number;
}

// In-memory metrics storage (should be replaced with persistent storage in production)
const modelMetrics = new Map<string, AIModelMetrics>();

// Update interval (5 minutes)
const UPDATE_INTERVAL = 5 * 60 * 1000;
let lastUpdateTime = Date.now();

/**
 * Track an AI model request
 */
export function trackModelRequest(
  modelId: string,
  responseTime: number,
  tokens: number,
  error?: boolean,
  provider?: string
): void {
  const metrics = modelMetrics.get(modelId) || {
    modelId,
    provider,
    requestCount: 0,
    errorCount: 0,
    totalTokens: 0,
    avgResponseTime: 0,
    lastActive: new Date()
  };

  metrics.requestCount++;
  if (error) {
    metrics.errorCount++;
  }
  metrics.totalTokens += tokens;
  
  // Update average response time
  metrics.avgResponseTime = (
    (metrics.avgResponseTime * (metrics.requestCount - 1) + responseTime) / 
    metrics.requestCount
  );
  
  metrics.lastActive = new Date();
  modelMetrics.set(modelId, metrics);
}

/**
 * Get model status with load calculations
 */
export async function getAIModelStatus(): Promise<AIModelStatus[]> {
  // Get unique models from metrics
  const metricsModels = Array.from(modelMetrics.entries()).map(([id, metrics]) => ({
    id,
    name: formatModelName(id),
    provider: formatProviderName(metrics.provider || 'unknown')
  }));

  // Default models to show even if no metrics
  const defaultModels = [
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'OpenAI' },
    { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'OpenAI' },
    { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', provider: 'Anthropic' },
    { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet', provider: 'Anthropic' },
    { id: 'llama2', name: 'Llama 2', provider: 'Ollama' },
    { id: 'codellama', name: 'CodeLlama', provider: 'Ollama' },
    { id: 'mistral', name: 'Mistral', provider: 'Ollama' }
  ];

  // Merge metrics models with default models, avoiding duplicates
  const modelMap = new Map<string, any>();
  metricsModels.forEach(m => modelMap.set(m.id, m));
  defaultModels.forEach(m => {
    if (!modelMap.has(m.id)) {
      modelMap.set(m.id, m);
    }
  });

  const models = Array.from(modelMap.values());

  const currentTime = Date.now();
  const hourAgo = currentTime - 60 * 60 * 1000;

  // Try to get metrics from database
  try {
    const dataService = createDataService({}, logger);
    await dataService.initialize();

    // Get recent AI requests from logs
    const recentLogs = await dataService.logs.findByTimeRange(
      new Date(hourAgo),
      new Date()
    );

    // Filter for AI model requests
    const aiRequests = recentLogs.filter(log => 
      log.source === 'ai-service' && log.context?.modelId
    );

    // Calculate metrics from logs
    for (const log of aiRequests) {
      const modelId = log.context.modelId;
      const responseTime = log.context.responseTime || 0;
      const tokens = log.context.tokens || 0;
      const isError = log.level === 'error' || log.context.error;

      trackModelRequest(modelId, responseTime, tokens, isError);
    }
  } catch (error) {
    logger.warn('Failed to get AI metrics from database', {
      error: error instanceof Error ? error.message : String(error)
    });
  }

  // Calculate status for each model
  return models.map(model => {
    const metrics = modelMetrics.get(model.id);
    
    if (!metrics) {
      return {
        ...model,
        status: 'online' as const,
        load: 0,
        requestsPerHour: 0
      };
    }

    // Calculate requests per hour
    const timeSinceLastUpdate = (currentTime - lastUpdateTime) / 1000 / 60 / 60; // hours
    const requestsPerHour = Math.round(
      metrics.requestCount / Math.max(timeSinceLastUpdate, 1)
    );

    // Calculate load (based on request rate, assuming 1000 req/hour = 100% load)
    const load = Math.min(100, Math.round((requestsPerHour / 1000) * 100));

    // Calculate error rate
    const errorRate = metrics.requestCount > 0 
      ? metrics.errorCount / metrics.requestCount 
      : 0;

    // Determine status
    let status: 'online' | 'offline' | 'degraded' = 'online';
    if (errorRate > 0.5) {
      status = 'offline';
    } else if (errorRate > 0.1 || load > 80) {
      status = 'degraded';
    }

    // Check if model is inactive (no requests in last hour)
    const isInactive = metrics.lastActive.getTime() < hourAgo;
    if (isInactive && metrics.requestCount === 0) {
      status = 'online'; // Model available but not used
    }

    return {
      ...model,
      status,
      load,
      requestsPerHour,
      avgResponseTime: Math.round(metrics.avgResponseTime),
      errorRate: Math.round(errorRate * 100) / 100
    };
  });
}

/**
 * Reset metrics periodically
 */
export function resetMetrics(): void {
  const currentTime = Date.now();
  const hourAgo = currentTime - 60 * 60 * 1000;

  // Keep only recent metrics
  for (const [modelId, metrics] of modelMetrics.entries()) {
    if (metrics.lastActive.getTime() < hourAgo) {
      modelMetrics.delete(modelId);
    }
  }

  lastUpdateTime = currentTime;
}

// Reset metrics every hour
setInterval(resetMetrics, 60 * 60 * 1000);

/**
 * Format model ID to display name
 */
function formatModelName(modelId: string): string {
  // Handle common model naming patterns
  if (modelId.includes('gpt-4')) return 'GPT-4';
  if (modelId.includes('gpt-3.5')) return 'GPT-3.5';
  if (modelId.includes('claude-3-opus')) return 'Claude 3 Opus';
  if (modelId.includes('claude-3-sonnet')) return 'Claude 3 Sonnet';
  if (modelId.includes('claude-3-haiku')) return 'Claude 3 Haiku';
  if (modelId.includes('claude-2')) return 'Claude 2';
  if (modelId.includes('claude-instant')) return 'Claude Instant';
  if (modelId === 'llama2') return 'Llama 2';
  if (modelId === 'codellama') return 'CodeLlama';
  if (modelId === 'mistral') return 'Mistral';
  
  // Default: capitalize first letter of each word
  return modelId
    .split(/[-_]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Format provider name
 */
function formatProviderName(provider: string): string {
  switch (provider.toLowerCase()) {
    case 'openai': return 'OpenAI';
    case 'anthropic': return 'Anthropic';
    case 'ollama': return 'Ollama';
    case 'meta': return 'Meta';
    default: return provider.charAt(0).toUpperCase() + provider.slice(1);
  }
}

/**
 * Initialize AI model monitoring
 */
export async function initializeAIModelMonitoring(): Promise<void> {
  logger.info('Initializing AI model monitoring');
  
  // Load initial metrics from database if available
  try {
    await getAIModelStatus();
  } catch (error) {
    logger.warn('Failed to load initial AI metrics', {
      error: error instanceof Error ? error.message : String(error)
    });
  }
}