/**
 * Analytics interfaces and types
 */

export interface TimeRange {
  start: Date;
  end: Date;
  granularity: 'hour' | 'day' | 'week' | 'month';
}

export interface TimeSeriesData {
  series: Array<{
    timestamp: string;
    count: number;
    metadata?: Record<string, any>;
  }>;
  granularity: string;
  totalCount: number;
  comparisonSeries?: Array<{
    timestamp: string;
    count: number;
  }>;
}

export interface RootCauseCategory {
  category: string;
  count: number;
  percentage: number;
  trend: number;
  avgConfidence?: number;
}

export interface RootCauseDistribution {
  categories: RootCauseCategory[];
  totalCount: number;
  insights: Array<{
    title: string;
    description: string;
    recommendation?: string;
  }>;
  lastUpdated?: Date;
}

export interface ModelPerformanceData {
  modelName: string;
  requestCount: number;
  successRate: number;
  accuracy: number;
  averageLatency: number;
  latencyPercentiles: {
    p50: number;
    p90: number;
    p95: number;
    p99: number;
  };
  costPerRequest?: number;
  lastUsed?: Date;
}

export interface SeverityDistribution {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface SeverityTrend {
  timestamp: string;
  distribution: SeverityDistribution;
}

export interface SeverityPrediction extends SeverityTrend {
  confidence: number;
}

export interface SeverityTrendData {
  trends: SeverityTrend[];
  predictions: SeverityPrediction[];
  insights: string[];
  metadata?: {
    timeRange: TimeRange;
    dataPoints: number;
    lastUpdated: Date;
  };
}

export interface AnalyticsOptions {
  includeComparison?: boolean;
  includeMetadata?: boolean;
  includePredictions?: boolean;
  filters?: {
    platform?: string;
    severity?: string;
    model?: string;
    [key: string]: any;
  };
  cacheOptions?: {
    skipCache?: boolean;
    ttl?: number;
  };
}

export interface IAnalyticsService {
  getTimeSeriesData(
    timeRange: TimeRange,
    options?: AnalyticsOptions
  ): Promise<TimeSeriesData>;
  
  getRootCauseDistribution(
    timeRange: TimeRange,
    options?: AnalyticsOptions
  ): Promise<RootCauseDistribution>;
  
  getModelPerformance(
    modelName?: string,
    timeRange?: TimeRange
  ): Promise<ModelPerformanceData[]>;
  
  getSeverityTrends(
    timeRange: TimeRange,
    options?: AnalyticsOptions
  ): Promise<SeverityTrendData>;
  
  warmupCache?(): Promise<void>;
}

export interface AnalyticsEvent {
  type: 'crash_logged' | 'analysis_completed' | 'model_performance_update';
  data: any;
  timestamp: Date;
}

export interface AnalyticsMetrics {
  responseTime: number;
  cacheHitRate: number;
  queryCount: number;
  errorRate: number;
}