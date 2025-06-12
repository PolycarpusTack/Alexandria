/**
 * Anomaly Detection Model
 * Detects anomalies in log patterns using statistical and ML methods
 */

import { HeimdallLogEntry, MLEnrichment, LogLevel } from '../../interfaces';

interface AnomalyContext {
  baselineStats: {
    avgLogsPerMinute: number;
    errorRate: number;
    commonPatterns: Map<string, number>;
    serviceBaselines: Map<string, ServiceBaseline>;
  };
  recentWindow: LogWindow[];
}

interface ServiceBaseline {
  avgResponseTime: number;
  errorThreshold: number;
  normalPatterns: string[];
}

interface LogWindow {
  timestamp: Date;
  count: number;
  errorCount: number;
  services: Map<string, number>;
}

export class AnomalyDetector {
  private context: AnomalyContext;
  private readonly windowSize = 60; // 60 minutes of history
  private readonly anomalyThreshold = 0.7;

  constructor() {
    this.context = {
      baselineStats: {
        avgLogsPerMinute: 1000,
        errorRate: 0.02, // 2% baseline error rate
        commonPatterns: new Map(),
        serviceBaselines: new Map([
          [
            'auth',
            {
              avgResponseTime: 150,
              errorThreshold: 0.01,
              normalPatterns: ['login', 'logout', 'token']
            }
          ],
          [
            'api',
            { avgResponseTime: 200, errorThreshold: 0.03, normalPatterns: ['GET', 'POST', 'PUT'] }
          ],
          [
            'worker',
            {
              avgResponseTime: 500,
              errorThreshold: 0.05,
              normalPatterns: ['process', 'queue', 'complete']
            }
          ]
        ])
      },
      recentWindow: []
    };
  }

  /**
   * Detect anomalies in a single log entry
   */
  async detectAnomaly(log: HeimdallLogEntry): Promise<number> {
    const anomalyScores: number[] = [];

    // 1. Error spike detection
    if (log.level === LogLevel.ERROR || log.level === LogLevel.FATAL) {
      anomalyScores.push(this.detectErrorSpike(log));
    }

    // 2. Response time anomaly
    if (log.metrics?.duration) {
      anomalyScores.push(this.detectResponseTimeAnomaly(log));
    }

    // 3. Pattern anomaly
    anomalyScores.push(this.detectPatternAnomaly(log));

    // 4. Volume anomaly
    anomalyScores.push(this.detectVolumeAnomaly(log));

    // 5. Service-specific anomalies
    anomalyScores.push(this.detectServiceAnomaly(log));

    // Combine scores using weighted average
    const weights = [0.3, 0.2, 0.2, 0.15, 0.15];
    const weightedScore = anomalyScores.reduce(
      (sum, score, index) => sum + score * weights[index],
      0
    );

    return Math.min(weightedScore, 1.0);
  }

  /**
   * Detect anomalies in a batch of logs
   */
  async detectBatchAnomalies(logs: HeimdallLogEntry[]): Promise<Map<string, number>> {
    const anomalyScores = new Map<string, number>();

    // Update context with batch information
    this.updateContext(logs);

    // Detect anomalies for each log
    for (const log of logs) {
      const score = await this.detectAnomaly(log);
      anomalyScores.set(log.id, score);
    }

    // Detect collective anomalies
    const collectiveAnomalies = this.detectCollectiveAnomalies(logs);

    // Merge individual and collective scores
    for (const [logId, collectiveScore] of collectiveAnomalies.entries()) {
      const individualScore = anomalyScores.get(logId) || 0;
      anomalyScores.set(logId, Math.max(individualScore, collectiveScore));
    }

    return anomalyScores;
  }

  /**
   * Generate ML enrichment for a log
   */
  async enrichLog(log: HeimdallLogEntry): Promise<MLEnrichment> {
    const anomalyScore = await this.detectAnomaly(log);

    const enrichment: MLEnrichment = {
      anomalyScore,
      confidence: this.calculateConfidence(anomalyScore),
      predictedCategory: this.predictCategory(log),
      suggestedActions: this.generateSuggestedActions(log, anomalyScore),
      relatedPatterns: this.findRelatedPatterns(log)
    };

    return enrichment;
  }

  /**
   * Private helper methods
   */

  private detectErrorSpike(log: HeimdallLogEntry): number {
    const baseline = this.context.baselineStats.serviceBaselines.get(log.source.service);
    const errorThreshold = baseline?.errorThreshold || this.context.baselineStats.errorRate;

    // Check recent error rate
    const recentErrors = this.context.recentWindow
      .slice(-10) // Last 10 minutes
      .reduce((sum, window) => sum + window.errorCount, 0);

    const recentTotal = this.context.recentWindow
      .slice(-10)
      .reduce((sum, window) => sum + window.count, 0);

    const currentErrorRate = recentTotal > 0 ? recentErrors / recentTotal : 0;

    // Calculate anomaly score based on deviation from baseline
    const deviation = Math.abs(currentErrorRate - errorThreshold) / errorThreshold;
    return Math.min(deviation / 5, 1.0); // Normalize to 0-1
  }

  private detectResponseTimeAnomaly(log: HeimdallLogEntry): number {
    if (!log.metrics?.duration) return 0;

    const baseline = this.context.baselineStats.serviceBaselines.get(log.source.service);
    const expectedDuration = baseline?.avgResponseTime || 200;

    // Calculate z-score
    const deviation = Math.abs(log.metrics.duration - expectedDuration);
    const stdDev = expectedDuration * 0.3; // Assume 30% standard deviation
    const zScore = deviation / stdDev;

    // Convert z-score to anomaly score
    return Math.min(zScore / 4, 1.0); // z-score > 4 is highly anomalous
  }

  private detectPatternAnomaly(log: HeimdallLogEntry): number {
    const message = log.message.raw.toLowerCase();
    const baseline = this.context.baselineStats.serviceBaselines.get(log.source.service);

    if (!baseline) return 0.3; // Unknown service is mildly anomalous

    // Check if message contains any normal patterns
    const containsNormalPattern = baseline.normalPatterns.some((pattern) =>
      message.includes(pattern.toLowerCase())
    );

    if (containsNormalPattern) return 0;

    // Check for suspicious patterns
    const suspiciousPatterns = [
      'exception',
      'error',
      'failed',
      'timeout',
      'refused',
      'denied',
      'unauthorized',
      'forbidden',
      'crash',
      'panic'
    ];

    const suspiciousCount = suspiciousPatterns.filter((pattern) =>
      message.includes(pattern)
    ).length;

    return Math.min(suspiciousCount * 0.2, 1.0);
  }

  private detectVolumeAnomaly(log: HeimdallLogEntry): number {
    if (this.context.recentWindow.length < 10) return 0;

    const recentAvg =
      this.context.recentWindow.slice(-10).reduce((sum, window) => sum + window.count, 0) / 10;

    const baseline = this.context.baselineStats.avgLogsPerMinute;
    const deviation = Math.abs(recentAvg - baseline) / baseline;

    return Math.min(deviation / 3, 1.0);
  }

  private detectServiceAnomaly(log: HeimdallLogEntry): number {
    // Check if service is appearing for the first time
    const serviceHistory = this.context.recentWindow.flatMap((window) =>
      Array.from(window.services.keys())
    );

    if (!serviceHistory.includes(log.source.service)) {
      return 0.5; // New service is moderately anomalous
    }

    // Check service communication patterns
    // TODO: Implement graph-based anomaly detection for service dependencies

    return 0;
  }

  private detectCollectiveAnomalies(logs: HeimdallLogEntry[]): Map<string, number> {
    const anomalies = new Map<string, number>();

    // 1. Detect coordinated failures across services
    const serviceErrors = new Map<string, number>();
    logs.forEach((log) => {
      if (log.level === LogLevel.ERROR || log.level === LogLevel.FATAL) {
        serviceErrors.set(log.source.service, (serviceErrors.get(log.source.service) || 0) + 1);
      }
    });

    // If multiple services are failing simultaneously, it's anomalous
    if (serviceErrors.size > 3) {
      logs.forEach((log) => {
        if (serviceErrors.has(log.source.service)) {
          anomalies.set(log.id, 0.8);
        }
      });
    }

    // 2. Detect cascading failures
    // TODO: Implement temporal correlation analysis

    return anomalies;
  }

  private updateContext(logs: HeimdallLogEntry[]): void {
    // Group logs by minute
    const minuteGroups = new Map<number, HeimdallLogEntry[]>();

    logs.forEach((log) => {
      const minute = Math.floor(Number(log.timestamp) / (60 * 1000 * 1000000));
      const group = minuteGroups.get(minute) || [];
      group.push(log);
      minuteGroups.set(minute, group);
    });

    // Update recent window
    minuteGroups.forEach((groupLogs, minute) => {
      const window: LogWindow = {
        timestamp: new Date(minute * 60 * 1000),
        count: groupLogs.length,
        errorCount: groupLogs.filter(
          (l) => l.level === LogLevel.ERROR || l.level === LogLevel.FATAL
        ).length,
        services: new Map()
      };

      groupLogs.forEach((log) => {
        window.services.set(log.source.service, (window.services.get(log.source.service) || 0) + 1);
      });

      this.context.recentWindow.push(window);
    });

    // Keep only recent windows
    if (this.context.recentWindow.length > this.windowSize) {
      this.context.recentWindow = this.context.recentWindow.slice(-this.windowSize);
    }
  }

  private calculateConfidence(anomalyScore: number): number {
    // Higher anomaly scores have higher confidence
    // But very low scores also have high confidence (definitely normal)
    if (anomalyScore < 0.2) return 0.95;
    if (anomalyScore > 0.8) return 0.9;

    // Medium scores have lower confidence
    return 0.7 - Math.abs(anomalyScore - 0.5) * 0.4;
  }

  private predictCategory(log: HeimdallLogEntry): string {
    const message = log.message.raw.toLowerCase();

    // Simple keyword-based categorization
    if (message.includes('auth') || message.includes('login')) return 'authentication';
    if (message.includes('database') || message.includes('query')) return 'database';
    if (message.includes('api') || message.includes('request')) return 'api';
    if (message.includes('error') || message.includes('exception')) return 'error';
    if (message.includes('performance') || message.includes('slow')) return 'performance';

    return 'general';
  }

  private generateSuggestedActions(log: HeimdallLogEntry, anomalyScore: number): string[] {
    const actions: string[] = [];

    if (anomalyScore > this.anomalyThreshold) {
      actions.push('Investigate immediately');

      if (log.level === LogLevel.ERROR || log.level === LogLevel.FATAL) {
        actions.push('Check service health');
        actions.push('Review recent deployments');
      }

      if (log.metrics?.duration && log.metrics.duration > 1000) {
        actions.push('Analyze performance bottlenecks');
        actions.push('Check database queries');
      }
    }

    return actions;
  }

  private findRelatedPatterns(log: HeimdallLogEntry): string[] {
    const patterns: string[] = [];

    // Extract key patterns from the message
    const message = log.message.raw;

    // Extract error codes
    const errorCodeMatch = message.match(/error[:\s]+(\w+)/i);
    if (errorCodeMatch) {
      patterns.push(`error:${errorCodeMatch[1]}`);
    }

    // Extract HTTP status codes
    const statusMatch = message.match(/\b[45]\d{2}\b/);
    if (statusMatch) {
      patterns.push(`http:${statusMatch[0]}`);
    }

    // Extract service patterns
    patterns.push(`service:${log.source.service}`);

    return patterns;
  }
}
