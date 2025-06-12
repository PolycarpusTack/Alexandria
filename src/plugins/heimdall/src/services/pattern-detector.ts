/**
 * Pattern Detector Service
 * Detects recurring patterns and sequences in logs
 */

import { Logger } from '@utils/logger';
import { HeimdallLogEntry, LogLevel } from '../interfaces';

export interface LogPattern {
  id: string;
  pattern: string;
  type: 'sequence' | 'frequency' | 'correlation' | 'anomaly';
  confidence: number;
  support: number;
  occurrences: number;
  examples: string[];
  metadata: {
    services?: string[];
    levels?: LogLevel[];
    timeWindows?: Array<{ start: Date; end: Date }>;
    relatedPatterns?: string[];
  };
}

export interface PatternDetectionOptions {
  minSupport?: number;
  minConfidence?: number;
  maxPatternLength?: number;
  includeMetadata?: boolean;
}

export class PatternDetector {
  private readonly logger: Logger;
  private readonly patternCache: Map<string, LogPattern> = new Map();
  private readonly sequenceBuffer: HeimdallLogEntry[] = [];
  private readonly maxBufferSize = 10000;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Detect patterns in a batch of logs
   */
  async detectPatterns(
    logs: HeimdallLogEntry[],
    options: PatternDetectionOptions = {}
  ): Promise<LogPattern[]> {
    const {
      minSupport = 0.05,
      minConfidence = 0.7,
      maxPatternLength = 5,
      includeMetadata = true
    } = options;

    this.logger.info('Starting pattern detection', {
      logCount: logs.length,
      minSupport,
      minConfidence
    });

    const patterns: LogPattern[] = [];

    // Update sequence buffer
    this.updateSequenceBuffer(logs);

    // 1. Detect frequency patterns
    const frequencyPatterns = await this.detectFrequencyPatterns(logs, minSupport, minConfidence);
    patterns.push(...frequencyPatterns);

    // 2. Detect sequence patterns
    const sequencePatterns = await this.detectSequencePatterns(
      this.sequenceBuffer,
      minSupport,
      minConfidence,
      maxPatternLength
    );
    patterns.push(...sequencePatterns);

    // 3. Detect correlation patterns
    const correlationPatterns = await this.detectCorrelationPatterns(
      logs,
      minSupport,
      minConfidence
    );
    patterns.push(...correlationPatterns);

    // 4. Detect anomaly patterns
    const anomalyPatterns = await this.detectAnomalyPatterns(logs, minSupport);
    patterns.push(...anomalyPatterns);

    // Add metadata if requested
    if (includeMetadata) {
      for (const pattern of patterns) {
        this.enrichPatternMetadata(pattern, logs);
      }
    }

    // Update cache
    patterns.forEach((pattern) => {
      this.patternCache.set(pattern.id, pattern);
    });

    this.logger.info('Pattern detection completed', {
      patternsFound: patterns.length,
      types: {
        frequency: frequencyPatterns.length,
        sequence: sequencePatterns.length,
        correlation: correlationPatterns.length,
        anomaly: anomalyPatterns.length
      }
    });

    return patterns;
  }

  /**
   * Find similar patterns
   */
  async findSimilarPatterns(
    referencePattern: string,
    threshold: number = 0.7
  ): Promise<LogPattern[]> {
    const similar: LogPattern[] = [];
    const refTokens = this.tokenizePattern(referencePattern);

    for (const pattern of this.patternCache.values()) {
      const patternTokens = this.tokenizePattern(pattern.pattern);
      const similarity = this.calculateSimilarity(refTokens, patternTokens);

      if (similarity >= threshold) {
        similar.push(pattern);
      }
    }

    return similar.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Get pattern by ID
   */
  getPattern(id: string): LogPattern | undefined {
    return this.patternCache.get(id);
  }

  /**
   * Get all cached patterns
   */
  getAllPatterns(): LogPattern[] {
    return Array.from(this.patternCache.values());
  }

  /**
   * Clear pattern cache
   */
  clearCache(): void {
    this.patternCache.clear();
    this.sequenceBuffer.length = 0;
  }

  /**
   * Private helper methods
   */

  private updateSequenceBuffer(logs: HeimdallLogEntry[]): void {
    this.sequenceBuffer.push(...logs);

    // Maintain buffer size
    if (this.sequenceBuffer.length > this.maxBufferSize) {
      this.sequenceBuffer.splice(0, this.sequenceBuffer.length - this.maxBufferSize);
    }

    // Sort by timestamp
    this.sequenceBuffer.sort((a, b) => Number(a.timestamp - b.timestamp));
  }

  private async detectFrequencyPatterns(
    logs: HeimdallLogEntry[],
    minSupport: number,
    minConfidence: number
  ): Promise<LogPattern[]> {
    const patterns: LogPattern[] = [];
    const messagePatterns = new Map<string, number>();

    // Extract and normalize message patterns
    for (const log of logs) {
      const normalized = this.normalizeMessage(log.message.raw);
      messagePatterns.set(normalized, (messagePatterns.get(normalized) || 0) + 1);
    }

    // Find patterns meeting support threshold
    const threshold = logs.length * minSupport;

    for (const [pattern, count] of messagePatterns.entries()) {
      if (count >= threshold) {
        const support = count / logs.length;
        const confidence = this.calculatePatternConfidence(pattern, logs);

        if (confidence >= minConfidence) {
          patterns.push({
            id: `freq-${this.hashPattern(pattern)}`,
            pattern,
            type: 'frequency',
            confidence,
            support,
            occurrences: count,
            examples: this.getPatternExamples(pattern, logs, 3),
            metadata: {}
          });
        }
      }
    }

    return patterns;
  }

  private async detectSequencePatterns(
    logs: HeimdallLogEntry[],
    minSupport: number,
    minConfidence: number,
    maxLength: number
  ): Promise<LogPattern[]> {
    const patterns: LogPattern[] = [];
    const sequences = new Map<string, number>();

    // Generate sequences of different lengths
    for (let length = 2; length <= maxLength; length++) {
      for (let i = 0; i <= logs.length - length; i++) {
        const sequence = logs
          .slice(i, i + length)
          .map((log) => this.getLogSignature(log))
          .join(' -> ');

        sequences.set(sequence, (sequences.get(sequence) || 0) + 1);
      }
    }

    // Find significant sequences
    const threshold = logs.length * minSupport;

    for (const [sequence, count] of sequences.entries()) {
      if (count >= threshold) {
        const support = count / logs.length;
        const confidence = 0.8; // Simplified confidence for sequences

        if (confidence >= minConfidence) {
          patterns.push({
            id: `seq-${this.hashPattern(sequence)}`,
            pattern: sequence,
            type: 'sequence',
            confidence,
            support,
            occurrences: count,
            examples: [sequence],
            metadata: {}
          });
        }
      }
    }

    return patterns;
  }

  private async detectCorrelationPatterns(
    logs: HeimdallLogEntry[],
    minSupport: number,
    minConfidence: number
  ): Promise<LogPattern[]> {
    const patterns: LogPattern[] = [];
    const correlations = new Map<string, Map<string, number>>();

    // Find correlated events within time windows
    const timeWindow = 60000; // 1 minute

    for (let i = 0; i < logs.length; i++) {
      const log1 = logs[i];
      const sig1 = this.getLogSignature(log1);

      for (let j = i + 1; j < logs.length; j++) {
        const log2 = logs[j];
        const timeDiff = Number(log2.timestamp - log1.timestamp) / 1000000; // to ms

        if (timeDiff > timeWindow) break;

        const sig2 = this.getLogSignature(log2);
        const correlation = `${sig1} <=> ${sig2}`;

        if (!correlations.has(sig1)) {
          correlations.set(sig1, new Map());
        }

        const correlationMap = correlations.get(sig1)!;
        correlationMap.set(sig2, (correlationMap.get(sig2) || 0) + 1);
      }
    }

    // Extract significant correlations
    for (const [sig1, correlationMap] of correlations.entries()) {
      for (const [sig2, count] of correlationMap.entries()) {
        const support = count / logs.length;

        if (support >= minSupport) {
          patterns.push({
            id: `corr-${this.hashPattern(`${sig1}-${sig2}`)}`,
            pattern: `${sig1} correlates with ${sig2}`,
            type: 'correlation',
            confidence: minConfidence,
            support,
            occurrences: count,
            examples: [`${sig1} => ${sig2}`],
            metadata: {}
          });
        }
      }
    }

    return patterns;
  }

  private async detectAnomalyPatterns(
    logs: HeimdallLogEntry[],
    minSupport: number
  ): Promise<LogPattern[]> {
    const patterns: LogPattern[] = [];

    // Detect sudden changes in log patterns
    const timeSlots = this.groupByTimeSlot(logs, 300000); // 5 minute slots
    const baselineSize = Math.max(3, Math.floor(timeSlots.length * 0.3));

    for (let i = baselineSize; i < timeSlots.length; i++) {
      const baseline = timeSlots.slice(i - baselineSize, i);
      const current = timeSlots[i];

      // Compare current with baseline
      const anomalyScore = this.calculateAnomalyScore(baseline, current);

      if (anomalyScore > 0.7) {
        const pattern = this.describeAnomaly(baseline, current);

        patterns.push({
          id: `anom-${this.hashPattern(pattern)}`,
          pattern,
          type: 'anomaly',
          confidence: anomalyScore,
          support: minSupport,
          occurrences: 1,
          examples: [pattern],
          metadata: {
            timeWindows: [
              {
                start: new Date(Number(current.logs[0].timestamp) / 1000000),
                end: new Date(Number(current.logs[current.logs.length - 1].timestamp) / 1000000)
              }
            ]
          }
        });
      }
    }

    return patterns;
  }

  private normalizeMessage(message: string): string {
    return message
      .replace(/\d+/g, 'N') // Replace numbers
      .replace(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi, 'UUID') // UUIDs
      .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, 'IP') // IPs
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, 'EMAIL') // Emails
      .replace(/https?:\/\/[^\s]+/g, 'URL') // URLs
      .toLowerCase()
      .trim();
  }

  private getLogSignature(log: HeimdallLogEntry): string {
    return `${log.level}:${log.source.service}:${this.normalizeMessage(log.message.raw).substring(0, 50)}`;
  }

  private tokenizePattern(pattern: string): string[] {
    return pattern.toLowerCase().split(/\s+/);
  }

  private calculateSimilarity(tokens1: string[], tokens2: string[]): number {
    const set1 = new Set(tokens1);
    const set2 = new Set(tokens2);
    const intersection = new Set([...set1].filter((x) => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return intersection.size / union.size;
  }

  private calculatePatternConfidence(pattern: string, logs: HeimdallLogEntry[]): number {
    // Simple confidence based on consistency
    let matches = 0;
    let variations = new Set<string>();

    for (const log of logs) {
      const normalized = this.normalizeMessage(log.message.raw);
      if (normalized === pattern) {
        matches++;
        variations.add(log.message.raw);
      }
    }

    // Lower confidence if many variations
    const variationPenalty = Math.min(variations.size / matches, 0.5);
    return Math.max(0.5, 1 - variationPenalty);
  }

  private getPatternExamples(pattern: string, logs: HeimdallLogEntry[], count: number): string[] {
    const examples: string[] = [];

    for (const log of logs) {
      if (examples.length >= count) break;

      const normalized = this.normalizeMessage(log.message.raw);
      if (normalized === pattern && !examples.includes(log.message.raw)) {
        examples.push(log.message.raw);
      }
    }

    return examples;
  }

  private groupByTimeSlot(
    logs: HeimdallLogEntry[],
    slotSize: number
  ): Array<{ slot: number; logs: HeimdallLogEntry[] }> {
    const slots = new Map<number, HeimdallLogEntry[]>();

    for (const log of logs) {
      const slot = Math.floor(Number(log.timestamp) / 1000000 / slotSize);
      if (!slots.has(slot)) {
        slots.set(slot, []);
      }
      slots.get(slot)!.push(log);
    }

    return Array.from(slots.entries())
      .map(([slot, logs]) => ({ slot, logs }))
      .sort((a, b) => a.slot - b.slot);
  }

  private calculateAnomalyScore(
    baseline: Array<{ slot: number; logs: HeimdallLogEntry[] }>,
    current: { slot: number; logs: HeimdallLogEntry[] }
  ): number {
    // Calculate baseline statistics
    const baselineCounts = baseline.map((slot) => slot.logs.length);
    const baselineAvg = baselineCounts.reduce((a, b) => a + b, 0) / baselineCounts.length;
    const baselineStdDev = Math.sqrt(
      baselineCounts.reduce((sum, count) => sum + Math.pow(count - baselineAvg, 2), 0) /
        baselineCounts.length
    );

    // Calculate z-score
    const zScore = Math.abs((current.logs.length - baselineAvg) / (baselineStdDev || 1));

    // Check for pattern changes
    const baselinePatterns = new Set<string>();
    baseline.forEach((slot) => {
      slot.logs.forEach((log) => {
        baselinePatterns.add(this.getLogSignature(log));
      });
    });

    const currentPatterns = new Set<string>();
    current.logs.forEach((log) => {
      currentPatterns.add(this.getLogSignature(log));
    });

    const newPatterns = [...currentPatterns].filter((p) => !baselinePatterns.has(p));
    const patternAnomalyScore = newPatterns.length / currentPatterns.size;

    // Combine scores
    return Math.min(1, (zScore / 3 + patternAnomalyScore) / 2);
  }

  private describeAnomaly(
    baseline: Array<{ slot: number; logs: HeimdallLogEntry[] }>,
    current: { slot: number; logs: HeimdallLogEntry[] }
  ): string {
    const baselineAvg = baseline.reduce((sum, slot) => sum + slot.logs.length, 0) / baseline.length;
    const changePercent = (((current.logs.length - baselineAvg) / baselineAvg) * 100).toFixed(1);

    if (current.logs.length > baselineAvg * 1.5) {
      return `Spike in log volume: ${changePercent}% increase`;
    } else if (current.logs.length < baselineAvg * 0.5) {
      return `Drop in log volume: ${Math.abs(Number(changePercent))}% decrease`;
    } else {
      return `Unusual log patterns detected`;
    }
  }

  private hashPattern(pattern: string): string {
    let hash = 0;
    for (let i = 0; i < pattern.length; i++) {
      const char = pattern.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  private enrichPatternMetadata(pattern: LogPattern, logs: HeimdallLogEntry[]): void {
    const matchingLogs = logs.filter((log) => {
      const normalized = this.normalizeMessage(log.message.raw);
      return (
        normalized.includes(pattern.pattern) || this.getLogSignature(log).includes(pattern.pattern)
      );
    });

    // Extract services
    const services = new Set<string>();
    const levels = new Set<LogLevel>();

    matchingLogs.forEach((log) => {
      services.add(log.source.service);
      levels.add(log.level);
    });

    pattern.metadata.services = Array.from(services);
    pattern.metadata.levels = Array.from(levels);
  }
}
