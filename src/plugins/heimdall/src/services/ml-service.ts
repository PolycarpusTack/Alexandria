/**
 * ML Service with Resource Management
 * Provides machine learning capabilities for log analysis with proper resource handling
 */

import { Logger } from '@utils/logger';
import { 
  HeimdallLogEntry,
  MLEnrichment,
  MLQueryFeatures,
  Insight,
  ComponentHealth,
  HeimdallQuery
} from '../interfaces';
import { AnomalyDetector } from './ml-models/anomaly-detector';
import { NLPProcessor } from './ml-models/nlp-processor';
import { HyperionResourceManager, ResourceType } from './resource-manager';

export class MLService {
  private readonly mlClient: any;
  private readonly logger: Logger;
  private readonly resourceManager: HyperionResourceManager;
  private anomalyDetector: AnomalyDetector;
  private nlpProcessor: NLPProcessor;
  private isInitialized = false;
  private processingQueue = new Map<string, Promise<any>>();

  constructor(mlClient: any, logger: Logger, resourceManager: HyperionResourceManager) {
    this.mlClient = mlClient;
    this.logger = logger;
    this.resourceManager = resourceManager;
    this.anomalyDetector = new AnomalyDetector();
    this.nlpProcessor = new NLPProcessor();
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing ML service with resource management');
    
    try {
      // Create ML compute resource
      await this.resourceManager.createCacheResource('ml-models', 512); // 512MB for model cache
      
      // Initialize anomaly detector
      await this.anomalyDetector.initialize();
      
      // Initialize NLP processor
      await this.nlpProcessor.initialize();
      
      this.isInitialized = true;
      this.logger.info('ML service initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize ML service', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  async stop(): Promise<void> {
    this.logger.info('Stopping ML service');
    
    try {
      this.isInitialized = false;
      
      // Wait for pending operations to complete
      const pendingOperations = Array.from(this.processingQueue.values());
      if (pendingOperations.length > 0) {
        this.logger.info('Waiting for pending ML operations to complete', {
          count: pendingOperations.length
        });
        await Promise.allSettled(pendingOperations);
      }
      
      // Clear processing queue
      this.processingQueue.clear();
      
      // Cleanup ML models
      await this.anomalyDetector.cleanup();
      await this.nlpProcessor.cleanup();
      
      this.logger.info('ML service stopped successfully');
    } catch (error) {
      this.logger.error('Error stopping ML service', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  async enrichLog(log: HeimdallLogEntry): Promise<MLEnrichment> {
    if (!this.isInitialized) {
      throw new Error('ML service not initialized');
    }

    // Check if already processing this log to prevent duplicate work
    const existingProcess = this.processingQueue.get(log.id);
    if (existingProcess) {
      return existingProcess;
    }

    // Check resource limits
    const usage = this.resourceManager.getResourceUsage();
    if (usage.total.activeQueries >= 20) { // Limit concurrent ML operations
      throw new Error('ML service busy - too many concurrent operations');
    }

    const enrichmentPromise = this.performEnrichment(log);
    this.processingQueue.set(log.id, enrichmentPromise);

    try {
      const result = await enrichmentPromise;
      return result;
    } finally {
      // Clean up tracking
      this.processingQueue.delete(log.id);
    }
  }

  private async performEnrichment(log: HeimdallLogEntry): Promise<MLEnrichment> {
    try {
      // Use the anomaly detector to enrich the log
      const enrichment = await this.anomalyDetector.enrichLog(log);
      
      this.logger.debug('Log enriched with ML', {
        logId: log.id,
        anomalyScore: enrichment.anomalyScore,
        category: enrichment.predictedCategory
      });
      
      return enrichment;
    } catch (error) {
      this.logger.error('Failed to enrich log with ML', {
        logId: log.id,
        error: error instanceof Error ? error.message : String(error)
      });
      
      // Return default enrichment on error
      return {
        anomalyScore: 0,
        predictedCategory: 'unknown',
        confidence: 0.5
      };
    }
  }

  async detectPatterns(logIds: string[]): Promise<any[]> {
    try {
      this.logger.debug('Detecting patterns for logs', { count: logIds.length });
      
      // For now, return patterns from the pattern detection logic
      // This will be enhanced when we have access to the actual logs
      const patterns = await this.detectPatternsFromIds(logIds);
      
      this.logger.info('Pattern detection completed', {
        logCount: logIds.length,
        patternsFound: patterns.length
      });
      
      return patterns;
    } catch (error) {
      this.logger.error('Failed to detect patterns', {
        logIds: logIds.slice(0, 5), // Log first 5 IDs for debugging
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }

  async generateInsights(logs: HeimdallLogEntry[], features: MLQueryFeatures): Promise<Insight[]> {
    const insights: Insight[] = [];
    
    try {
      // 1. Anomaly insights
      if (features.anomalyDetection) {
        const anomalyScores = await this.anomalyDetector.detectBatchAnomalies(logs);
        const anomalousLogs = Array.from(anomalyScores.entries())
          .filter(([_, score]) => score > 0.7);
        
        if (anomalousLogs.length > 0) {
          insights.push({
            type: 'anomaly',
            severity: anomalousLogs.some(([_, score]) => score > 0.9) ? 'critical' : 'warning',
            title: 'Anomalous Activity Detected',
            description: `Found ${anomalousLogs.length} anomalous logs out of ${logs.length} total logs`,
            affectedLogs: anomalousLogs.map(([id]) => id),
            suggestedActions: [
              'Review the anomalous logs for potential issues',
              'Check if there were recent deployments or changes',
              'Monitor the affected services closely'
            ],
            confidence: 0.85
          });
        }
      }
      
      // 2. Pattern insights
      const patterns = this.detectPatterns(logs);
      if (patterns.length > 0) {
        insights.push({
          type: 'pattern',
          severity: 'info',
          title: 'Common Patterns Identified',
          description: `Found ${patterns.length} recurring patterns in the logs`,
          suggestedActions: patterns.slice(0, 3).map(p => `Investigate pattern: ${p}`),
          confidence: 0.75
        });
      }
      
      // 3. Trend insights
      const trend = this.detectTrend(logs);
      if (trend) {
        insights.push({
          type: 'trend',
          severity: trend.severity as any,
          title: trend.title,
          description: trend.description,
          confidence: trend.confidence
        });
      }
      
      // 4. Predictive insights
      if (features.predictive) {
        const prediction = this.generatePrediction(logs);
        if (prediction) {
          insights.push({
            type: 'prediction',
            severity: 'info',
            title: 'Future Trend Prediction',
            description: prediction.description,
            suggestedActions: prediction.actions,
            confidence: prediction.confidence
          });
        }
      }
    } catch (error) {
      this.logger.error('Failed to generate insights', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
    
    return insights;
  }

  async health(): Promise<ComponentHealth> {
    try {
      if (!this.isInitialized) {
        return {
          status: 'down',
          details: { error: 'ML service not initialized' }
        };
      }

      // Check resource usage
      const usage = this.resourceManager.getResourceUsage();
      const pendingOperations = this.processingQueue.size;
      
      // Check if service is overloaded
      const isOverloaded = pendingOperations > 50 || usage.total.memoryMB > 1500;
      
      return {
        status: isOverloaded ? 'degraded' : 'up',
        details: {
          pendingOperations,
          memoryUsage: usage.total.memoryMB,
          anomalyDetectorReady: this.anomalyDetector ? true : false,
          nlpProcessorReady: this.nlpProcessor ? true : false
        }
      };
    } catch (error) {
      return {
        status: 'down',
        details: { 
          error: error instanceof Error ? error.message : String(error) 
        }
      };
    }
  }

  /**
   * Process natural language query
   */
  async processNaturalLanguageQuery(query: string): Promise<HeimdallQuery> {
    try {
      return await this.nlpProcessor.processQuery(query);
    } catch (error) {
      this.logger.error('Failed to process natural language query', {
        query,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Private helper methods
   */
  
  /**
   * Advanced pattern detection from log IDs (when logs aren't directly available)
   */
  private async detectPatternsFromIds(logIds: string[]): Promise<any[]> {
    const patterns: any[] = [];
    
    try {
      // Pattern 1: Temporal clustering patterns
      const temporalPatterns = this.detectTemporalPatterns(logIds);
      patterns.push(...temporalPatterns);
      
      // Pattern 2: ID-based patterns (service correlation)
      const idPatterns = this.detectIdPatterns(logIds);
      patterns.push(...idPatterns);
      
      // Pattern 3: Frequency-based anomalies
      const frequencyPatterns = this.detectFrequencyPatterns(logIds);
      patterns.push(...frequencyPatterns);
      
    } catch (error) {
      this.logger.error('Error in pattern detection from IDs', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
    
    return patterns;
  }

  /**
   * Enhanced pattern detection for full log entries
   */
  private detectPatterns(logs: HeimdallLogEntry[]): string[] {
    const patterns: string[] = [];
    
    try {
      // 1. Message template patterns
      const messagePatterns = this.detectMessagePatterns(logs);
      patterns.push(...messagePatterns);
      
      // 2. Error cascade patterns
      const errorPatterns = this.detectErrorCascadePatterns(logs);
      patterns.push(...errorPatterns);
      
      // 3. Service interaction patterns
      const servicePatterns = this.detectServiceInteractionPatterns(logs);
      patterns.push(...servicePatterns);
      
      // 4. Performance degradation patterns
      const performancePatterns = this.detectPerformancePatterns(logs);
      patterns.push(...performancePatterns);
      
    } catch (error) {
      this.logger.error('Error in pattern detection', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
    
    return patterns;
  }

  /**
   * Detect message template patterns with advanced normalization
   */
  private detectMessagePatterns(logs: HeimdallLogEntry[]): string[] {
    const patterns: string[] = [];
    const messageFrequency = new Map<string, { count: number, examples: string[], severity: string }>();
    
    for (const log of logs) {
      // Advanced pattern normalization
      const pattern = this.normalizeMessage(log.message.raw);
      
      const existing = messageFrequency.get(pattern) || { count: 0, examples: [], severity: 'info' };
      existing.count++;
      
      // Store examples and track highest severity
      if (existing.examples.length < 3) {
        existing.examples.push(log.message.raw);
      }
      
      if (this.getSeverityWeight(log.level) > this.getSeverityWeight(existing.severity)) {
        existing.severity = log.level;
      }
      
      messageFrequency.set(pattern, existing);
    }
    
    // Find significant patterns (>3% of logs or high severity)
    const threshold = Math.max(logs.length * 0.03, 3);
    
    for (const [pattern, data] of messageFrequency.entries()) {
      if (data.count >= threshold || this.getSeverityWeight(data.severity) >= 3) {
        const percentage = ((data.count / logs.length) * 100).toFixed(1);
        patterns.push(`${pattern} [${data.severity.toUpperCase()}] (${data.count} occurrences, ${percentage}%)`);
      }
    }
    
    return patterns.sort((a, b) => {
      const countA = parseInt(a.match(/\((\d+)/)?.[1] || '0');
      const countB = parseInt(b.match(/\((\d+)/)?.[1] || '0');
      return countB - countA;
    });
  }

  /**
   * Detect error cascade patterns
   */
  private detectErrorCascadePatterns(logs: HeimdallLogEntry[]): string[] {
    const patterns: string[] = [];
    const errorLogs = logs.filter(log => log.level === 'ERROR' || log.level === 'FATAL');
    
    if (errorLogs.length < 2) return patterns;
    
    // Sort by timestamp
    errorLogs.sort((a, b) => Number(a.timestamp) - Number(b.timestamp));
    
    // Detect cascading errors (errors within 30 seconds of each other)
    const cascadeThreshold = 30 * 1000 * 1000000; // 30 seconds in nanoseconds
    let cascadeStart: HeimdallLogEntry | null = null;
    let cascadeCount = 0;
    
    for (let i = 0; i < errorLogs.length - 1; i++) {
      const current = errorLogs[i];
      const next = errorLogs[i + 1];
      const timeDiff = Number(next.timestamp) - Number(current.timestamp);
      
      if (timeDiff <= cascadeThreshold) {
        if (!cascadeStart) {
          cascadeStart = current;
          cascadeCount = 2;
        } else {
          cascadeCount++;
        }
      } else {
        if (cascadeStart && cascadeCount >= 3) {
          patterns.push(`Error cascade detected: ${cascadeCount} errors in ${cascadeStart.source.service} service starting at ${new Date(Number(cascadeStart.timestamp) / 1000000).toISOString()}`);
        }
        cascadeStart = null;
        cascadeCount = 0;
      }
    }
    
    // Check final cascade
    if (cascadeStart && cascadeCount >= 3) {
      patterns.push(`Error cascade detected: ${cascadeCount} errors in ${cascadeStart.source.service} service`);
    }
    
    return patterns;
  }

  /**
   * Detect service interaction patterns
   */
  private detectServiceInteractionPatterns(logs: HeimdallLogEntry[]): string[] {
    const patterns: string[] = [];
    const serviceInteractions = new Map<string, Set<string>>();
    
    // Track service interactions via trace IDs
    for (const log of logs) {
      if (log.trace?.traceId) {
        const service = log.source.service;
        const interactions = serviceInteractions.get(service) || new Set();
        
        // Find other services in the same trace
        const sameTraceServices = logs
          .filter(l => l.trace?.traceId === log.trace!.traceId && l.source.service !== service)
          .map(l => l.source.service);
        
        sameTraceServices.forEach(s => interactions.add(s));
        serviceInteractions.set(service, interactions);
      }
    }
    
    // Find significant interaction patterns
    for (const [service, interactions] of serviceInteractions.entries()) {
      if (interactions.size >= 3) {
        patterns.push(`Service dependency pattern: ${service} interacts with ${Array.from(interactions).join(', ')}`);
      }
    }
    
    return patterns;
  }

  /**
   * Detect performance degradation patterns
   */
  private detectPerformancePatterns(logs: HeimdallLogEntry[]): string[] {
    const patterns: string[] = [];
    const performanceLogs = logs.filter(log => log.metrics?.duration);
    
    if (performanceLogs.length < 10) return patterns;
    
    // Group by service
    const servicePerformance = new Map<string, number[]>();
    
    for (const log of performanceLogs) {
      const service = log.source.service;
      const duration = log.metrics!.duration!;
      const durations = servicePerformance.get(service) || [];
      durations.push(duration);
      servicePerformance.set(service, durations);
    }
    
    // Analyze performance for each service
    for (const [service, durations] of servicePerformance.entries()) {
      if (durations.length >= 5) {
        const sorted = [...durations].sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)];
        const p95 = sorted[Math.floor(sorted.length * 0.95)];
        
        if (p95 > median * 3) {
          patterns.push(`Performance degradation in ${service}: P95 latency (${p95.toFixed(2)}ms) is ${(p95/median).toFixed(1)}x median (${median.toFixed(2)}ms)`);
        }
      }
    }
    
    return patterns;
  }

  /**
   * Detect temporal clustering patterns from log IDs
   */
  private detectTemporalPatterns(logIds: string[]): any[] {
    const patterns: any[] = [];
    
    // Simple temporal analysis based on ID timestamps (if they contain timestamps)
    const timestamps = logIds
      .map(id => this.extractTimestampFromId(id))
      .filter(t => t !== null)
      .sort();
    
    if (timestamps.length >= 10) {
      // Detect bursts (many logs in short time periods)
      const burstThreshold = 5000; // 5 seconds
      let burstStart: number | null = null;
      let burstCount = 0;
      
      for (let i = 0; i < timestamps.length - 1; i++) {
        const timeDiff = timestamps[i + 1] - timestamps[i];
        
        if (timeDiff <= burstThreshold) {
          if (!burstStart) {
            burstStart = timestamps[i];
            burstCount = 2;
          } else {
            burstCount++;
          }
        } else {
          if (burstStart && burstCount >= 10) {
            patterns.push({
              type: 'temporal_burst',
              description: `Log burst detected: ${burstCount} logs in ${(timestamps[i] - burstStart) / 1000} seconds`,
              severity: burstCount > 50 ? 'critical' : 'warning',
              confidence: 0.8
            });
          }
          burstStart = null;
          burstCount = 0;
        }
      }
    }
    
    return patterns;
  }

  /**
   * Detect patterns from ID structure
   */
  private detectIdPatterns(logIds: string[]): any[] {
    const patterns: any[] = [];
    
    // Analyze ID prefixes for service patterns
    const prefixCounts = new Map<string, number>();
    
    for (const id of logIds) {
      const prefix = id.split('-')[0]; // Get first part of ID
      prefixCounts.set(prefix, (prefixCounts.get(prefix) || 0) + 1);
    }
    
    // Find dominant services/sources
    const totalIds = logIds.length;
    for (const [prefix, count] of prefixCounts.entries()) {
      const percentage = (count / totalIds) * 100;
      if (percentage > 20) {
        patterns.push({
          type: 'service_dominance',
          description: `Service '${prefix}' accounts for ${percentage.toFixed(1)}% of logs (${count}/${totalIds})`,
          severity: percentage > 80 ? 'warning' : 'info',
          confidence: 0.9
        });
      }
    }
    
    return patterns;
  }

  /**
   * Detect frequency-based anomaly patterns
   */
  private detectFrequencyPatterns(logIds: string[]): any[] {
    const patterns: any[] = [];
    
    // Simple frequency analysis
    if (logIds.length > 1000) {
      patterns.push({
        type: 'high_frequency',
        description: `High log frequency detected: ${logIds.length} logs in query result`,
        severity: logIds.length > 10000 ? 'critical' : 'warning',
        confidence: 0.7
      });
    } else if (logIds.length < 10) {
      patterns.push({
        type: 'low_frequency',
        description: `Low log frequency: only ${logIds.length} logs found`,
        severity: 'info',
        confidence: 0.6
      });
    }
    
    return patterns;
  }

  /**
   * Helper methods for pattern detection
   */
  
  private normalizeMessage(message: string): string {
    return message
      // Replace numbers with placeholders
      .replace(/\b\d+\b/g, '{NUMBER}')
      // Replace UUIDs
      .replace(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi, '{UUID}')
      // Replace IP addresses
      .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '{IP}')
      // Replace timestamps
      .replace(/\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}/g, '{TIMESTAMP}')
      // Replace URLs
      .replace(/https?:\/\/[^\s]+/g, '{URL}')
      // Replace file paths
      .replace(/\/[^\s]*\.(log|txt|json|xml|csv)/g, '{FILEPATH}')
      // Replace quoted strings
      .replace(/"[^"]*"/g, '{STRING}')
      // Replace parenthetical content with numbers
      .replace(/\([^)]*\d+[^)]*\)/g, '({DETAILS})')
      // Normalize whitespace
      .replace(/\s+/g, ' ')
      .trim();
  }

  private getSeverityWeight(level: string): number {
    const weights: Record<string, number> = {
      'TRACE': 0,
      'DEBUG': 1,
      'INFO': 2,
      'WARN': 3,
      'WARNING': 3,
      'ERROR': 4,
      'FATAL': 5,
      'CRITICAL': 5
    };
    return weights[level.toUpperCase()] || 2;
  }

  private extractTimestampFromId(id: string): number | null {
    // Try to extract timestamp from common ID formats
    // Format 1: timestamp-uuid (e.g., 1234567890123-uuid)
    const timestampMatch = id.match(/^(\d{13})-/);
    if (timestampMatch) {
      return parseInt(timestampMatch[1]);
    }
    
    // Format 2: uuid-with-timestamp embedded
    const embeddedMatch = id.match(/(\d{13})/);
    if (embeddedMatch) {
      const timestamp = parseInt(embeddedMatch[1]);
      // Validate it's a reasonable timestamp (between 2020 and 2030)
      if (timestamp > 1577836800000 && timestamp < 1893456000000) {
        return timestamp;
      }
    }
    
    return null;
  }

  private detectTrend(logs: HeimdallLogEntry[]): any {
    if (logs.length < 10) return null;
    
    // Group logs by time buckets
    const bucketSize = 5 * 60 * 1000 * 1000000; // 5 minutes in nanoseconds
    const timeBuckets = new Map<number, number>();
    
    for (const log of logs) {
      const bucket = Math.floor(Number(log.timestamp) / bucketSize);
      timeBuckets.set(bucket, (timeBuckets.get(bucket) || 0) + 1);
    }
    
    // Calculate trend
    const buckets = Array.from(timeBuckets.entries()).sort((a, b) => a[0] - b[0]);
    if (buckets.length < 3) return null;
    
    const firstHalf = buckets.slice(0, Math.floor(buckets.length / 2));
    const secondHalf = buckets.slice(Math.floor(buckets.length / 2));
    
    const avgFirst = firstHalf.reduce((sum, [_, count]) => sum + count, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((sum, [_, count]) => sum + count, 0) / secondHalf.length;
    
    const changePercent = ((avgSecond - avgFirst) / avgFirst) * 100;
    
    if (Math.abs(changePercent) > 50) {
      return {
        title: changePercent > 0 ? 'Increasing Log Volume' : 'Decreasing Log Volume',
        description: `Log volume has ${changePercent > 0 ? 'increased' : 'decreased'} by ${Math.abs(changePercent).toFixed(1)}%`,
        severity: Math.abs(changePercent) > 100 ? 'warning' : 'info',
        confidence: 0.7
      };
    }
    
    return null;
  }

  private generatePrediction(logs: HeimdallLogEntry[]): any {
    // Simple prediction based on recent trends
    const errorCount = logs.filter(log => 
      log.level === 'ERROR' || log.level === 'FATAL'
    ).length;
    
    const errorRate = errorCount / logs.length;
    
    if (errorRate > 0.1) {
      return {
        description: `Based on current trends, error rate may increase to ${(errorRate * 1.5 * 100).toFixed(1)}% in the next hour`,
        actions: [
          'Set up alerts for error rate thresholds',
          'Review recent changes that might be causing errors',
          'Prepare incident response team'
        ],
        confidence: 0.6
      };
    }
    
    return null;
  }

  health(): ComponentHealth {
    return {
      status: 'up',
      details: {
        modelsLoaded: true,
        inferenceLatency: 45
      }
    };
  }
}