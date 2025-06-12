/**
 * Validation Utilities
 * Common validation functions for Heimdall
 */

import { HeimdallLogEntry, LogLevel } from '../interfaces';
import { z } from 'zod';

/**
 * Validate log entry
 */
export function validateLogEntry(log: any): HeimdallLogEntry {
  const schema = z.object({
    id: z.string().min(1),
    timestamp: z.bigint(),
    version: z.number().int().positive(),
    level: z.nativeEnum(LogLevel),
    source: z.object({
      service: z.string().min(1),
      instance: z.string().min(1),
      environment: z.string().min(1),
      version: z.string().min(1),
      hostname: z.string().optional(),
      region: z.string().optional()
    }),
    message: z.object({
      raw: z.string(),
      structured: z.record(z.any()).optional(),
      template: z.string().optional()
    }),
    trace: z
      .object({
        traceId: z.string(),
        spanId: z.string(),
        parentSpanId: z.string().optional(),
        flags: z.string().optional()
      })
      .optional(),
    entities: z
      .object({
        userId: z.string().optional(),
        sessionId: z.string().optional(),
        organizationId: z.string().optional(),
        requestId: z.string().optional(),
        resourceId: z.string().optional(),
        custom: z.record(z.string()).optional()
      })
      .optional(),
    metrics: z
      .object({
        duration: z.number().optional(),
        cpu: z.number().optional(),
        memory: z.number().optional(),
        custom: z.record(z.number()).optional()
      })
      .optional(),
    security: z.object({
      classification: z.string(),
      sanitized: z.boolean(),
      compliance: z.array(z.string()).optional(),
      redactedFields: z.array(z.string()).optional()
    }),
    ml: z
      .object({
        anomalyScore: z.number().min(0).max(1).optional(),
        confidence: z.number().min(0).max(1).optional(),
        predictedCategory: z.string().optional(),
        suggestedActions: z.array(z.string()).optional(),
        relatedPatterns: z.array(z.string()).optional()
      })
      .optional(),
    storage: z
      .object({
        tier: z.string().optional(),
        compressed: z.boolean().optional(),
        indexed: z.boolean().optional()
      })
      .optional()
  });

  return schema.parse(log);
}

/**
 * Validate time range
 */
export function validateTimeRange(from: any, to: any): { from: Date; to: Date } {
  const fromDate = new Date(from);
  const toDate = new Date(to);

  if (isNaN(fromDate.getTime())) {
    throw new Error('Invalid from date');
  }

  if (isNaN(toDate.getTime())) {
    throw new Error('Invalid to date');
  }

  if (fromDate >= toDate) {
    throw new Error('From date must be before to date');
  }

  // Don't allow queries spanning more than 30 days
  const maxRange = 30 * 24 * 60 * 60 * 1000;
  if (toDate.getTime() - fromDate.getTime() > maxRange) {
    throw new Error('Time range cannot exceed 30 days');
  }

  return { from: fromDate, to: toDate };
}

/**
 * Validate storage tier
 */
export function validateStorageTier(tier: string): 'hot' | 'warm' | 'cold' {
  const validTiers = ['hot', 'warm', 'cold'];

  if (!validTiers.includes(tier)) {
    throw new Error(`Invalid storage tier: ${tier}. Must be one of: ${validTiers.join(', ')}`);
  }

  return tier as 'hot' | 'warm' | 'cold';
}

/**
 * Sanitize log message
 */
export function sanitizeLogMessage(message: string, fields?: string[]): string {
  let sanitized = message;

  // Default sensitive patterns
  const patterns = [
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Email
    /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
    /\b\d{16}\b/g, // Credit card
    /Bearer\s+[A-Za-z0-9\-._~+\/]+=*/g, // Bearer token
    /api[_-]?key[\s:=]+[A-Za-z0-9\-._~+\/]+=*/gi // API key
  ];

  // Replace sensitive patterns
  patterns.forEach((pattern) => {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  });

  // Redact specific fields if provided
  if (fields) {
    fields.forEach((field) => {
      const regex = new RegExp(`${field}[\s:=]+[^\s,;}]+`, 'gi');
      sanitized = sanitized.replace(regex, `${field}=[REDACTED]`);
    });
  }

  return sanitized;
}

/**
 * Validate query limit
 */
export function validateQueryLimit(limit?: number): number {
  if (limit === undefined) {
    return 100; // Default
  }

  if (limit < 1) {
    throw new Error('Limit must be at least 1');
  }

  if (limit > 10000) {
    throw new Error('Limit cannot exceed 10000');
  }

  return limit;
}

/**
 * Validate aggregation interval
 */
export function validateAggregationInterval(interval: string): string {
  const validIntervals = ['1m', '5m', '10m', '30m', '1h', '6h', '12h', '1d', '7d', '30d'];

  if (!validIntervals.includes(interval)) {
    throw new Error(`Invalid interval: ${interval}. Must be one of: ${validIntervals.join(', ')}`);
  }

  return interval;
}
