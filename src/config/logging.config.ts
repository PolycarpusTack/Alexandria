/**
 * Logging Configuration for Alexandria Platform
 * 
 * This module provides centralized logging configuration to ensure
 * appropriate log levels in different environments.
 */

export interface LoggingConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
  format: 'simple' | 'json' | 'pretty';
  timestamp: boolean;
  colorize: boolean;
  maxFiles?: number;
  maxSize?: string;
  filters?: LogFilter[];
}

export interface LogFilter {
  component?: string;
  level?: 'debug' | 'info' | 'warn' | 'error';
  action: 'allow' | 'deny';
}

/**
 * Get logging configuration based on environment
 */
export function getLoggingConfig(): LoggingConfig {
  const environment = process.env.NODE_ENV || 'development';
  
  // Base configuration
  const baseConfig: LoggingConfig = {
    level: 'info',
    format: 'json',
    timestamp: true,
    colorize: false
  };

  // Environment-specific overrides
  switch (environment) {
    case 'production':
      return {
        ...baseConfig,
        level: process.env.LOG_LEVEL as any || 'warn',
        format: 'json',
        colorize: false,
        maxFiles: 30, // Keep 30 days of logs
        maxSize: '100m', // 100MB per file
        filters: [
          // Suppress debug logs in production
          { level: 'debug', action: 'deny' },
          // Allow specific components to log at info level
          { component: 'security', level: 'info', action: 'allow' },
          { component: 'authentication', level: 'info', action: 'allow' },
          { component: 'audit', level: 'info', action: 'allow' }
        ]
      };

    case 'staging':
      return {
        ...baseConfig,
        level: process.env.LOG_LEVEL as any || 'info',
        format: 'json',
        colorize: false,
        maxFiles: 14, // Keep 14 days of logs
        maxSize: '50m'
      };

    case 'test':
      return {
        ...baseConfig,
        level: process.env.LOG_LEVEL as any || 'error',
        format: 'simple',
        colorize: false,
        // Suppress all logs except errors in tests
        filters: [
          { level: 'debug', action: 'deny' },
          { level: 'info', action: 'deny' },
          { level: 'warn', action: 'deny' }
        ]
      };

    case 'development':
    default:
      return {
        ...baseConfig,
        level: process.env.LOG_LEVEL as any || 'debug',
        format: process.env.LOG_FORMAT as any || 'pretty',
        colorize: true,
        maxFiles: 7, // Keep 7 days of logs
        maxSize: '20m'
      };
  }
}

/**
 * Check if a log should be filtered based on configuration
 */
export function shouldLog(
  level: string,
  component: string,
  config: LoggingConfig
): boolean {
  // Check global level first
  const levels = ['debug', 'info', 'warn', 'error'];
  const configLevelIndex = levels.indexOf(config.level);
  const messageLevelIndex = levels.indexOf(level);
  
  if (messageLevelIndex < configLevelIndex) {
    return false;
  }

  // Apply filters
  if (config.filters) {
    for (const filter of config.filters) {
      // Check if filter applies
      const componentMatch = !filter.component || filter.component === component;
      const levelMatch = !filter.level || filter.level === level;
      
      if (componentMatch && levelMatch) {
        return filter.action === 'allow';
      }
    }
  }

  return true;
}

/**
 * Production log sanitizer - removes sensitive data
 */
export function sanitizeLogData(data: any): any {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const sensitiveKeys = [
    'password',
    'token',
    'secret',
    'apiKey',
    'api_key',
    'authorization',
    'cookie',
    'session',
    'creditCard',
    'credit_card',
    'ssn',
    'social_security',
    'private_key',
    'privateKey'
  ];

  const sanitized = { ...data };

  for (const key in sanitized) {
    // Check if key contains sensitive data
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.some(sensitive => lowerKey.includes(sensitive))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof sanitized[key] === 'object') {
      // Recursively sanitize nested objects
      sanitized[key] = sanitizeLogData(sanitized[key]);
    }
  }

  return sanitized;
}

/**
 * Get client-side logging configuration
 */
export function getClientLoggingConfig(): {
  enabled: boolean;
  level: string;
  sendToServer: boolean;
  maxBufferSize: number;
} {
  const environment = process.env.NODE_ENV || 'development';
  
  switch (environment) {
    case 'production':
      return {
        enabled: true,
        level: 'warn',
        sendToServer: true,
        maxBufferSize: 100 // Buffer up to 100 logs before sending
      };

    case 'staging':
      return {
        enabled: true,
        level: 'info',
        sendToServer: true,
        maxBufferSize: 50
      };

    case 'development':
    default:
      return {
        enabled: true,
        level: 'debug',
        sendToServer: false,
        maxBufferSize: 0 // No buffering in development
      };
  }
}