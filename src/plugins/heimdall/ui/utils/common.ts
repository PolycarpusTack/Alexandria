/**
 * Heimdall Common Utilities
 * Shared functions and utilities to reduce code duplication
 */

import { HeimdallLogEntry, LogLevel } from '../../src/interfaces';
import { toast } from '@/client/components/ui/use-toast';

// ============= Date and Time Utilities =============

export const formatTimestamp = (timestamp: bigint | string | Date): string => {
  let date: Date;
  
  if (typeof timestamp === 'bigint') {
    // Convert nanoseconds to milliseconds
    date = new Date(Number(timestamp) / 1000000);
  } else if (typeof timestamp === 'string') {
    date = new Date(timestamp);
  } else {
    date = timestamp;
  }
  
  return date.toLocaleString([], { 
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit', 
    minute: '2-digit',
    second: '2-digit'
  });
};

export const formatRelativeTime = (timestamp: bigint | string | Date): string => {
  const date = typeof timestamp === 'bigint' 
    ? new Date(Number(timestamp) / 1000000)
    : new Date(timestamp);
  
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return formatTimestamp(timestamp);
};

// ============= Log Level Utilities =============

export const getLogLevelColor = (level: LogLevel): string => {
  switch (level) {
    case LogLevel.FATAL:
    case LogLevel.ERROR:
      return 'destructive';
    case LogLevel.WARN:
      return 'warning';
    case LogLevel.INFO:
      return 'default';
    case LogLevel.DEBUG:
      return 'secondary';
    case LogLevel.TRACE:
      return 'outline';
    default:
      return 'secondary';
  }
};

export const getLogLevelIcon = (level: LogLevel): string => {
  switch (level) {
    case LogLevel.FATAL:
    case LogLevel.ERROR:
      return '🔴';
    case LogLevel.WARN:
      return '🟡';
    case LogLevel.INFO:
      return '🔵';
    case LogLevel.DEBUG:
      return '🟣';
    case LogLevel.TRACE:
      return '⚪';
    default:
      return '⚫';
  }
};

// ============= Data Processing Utilities =============

export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

export const formatBytes = (bytes: number): string => {
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  if (bytes === 0) return '0 B';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
};

export const formatNumber = (num: number): string => {
  if (num >= 1e9) return (num / 1e9).toFixed(1) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
  return num.toString();
};

export const formatPercentage = (value: number, total?: number): string => {
  const percentage = total ? (value / total) * 100 : value;
  return `${percentage.toFixed(1)}%`;
};

// ============= API Utilities =============

export const createApiUrl = (endpoint: string): string => {
  const baseUrl = '/api/heimdall';
  return `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
};

export const handleApiError = (error: unknown, context?: string): void => {
  const message = error instanceof Error ? error.message : 'Unknown error occurred';
  const title = context ? `${context} Failed` : 'Operation Failed';
  
  console.error('API Error:', { context, error });
  
  toast({
    title,
    description: message,
    variant: 'destructive'
  });
};

export const downloadFile = (data: string, filename: string, mimeType: string = 'application/json'): void => {
  try {
    const blob = new Blob([data], { type: mimeType });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(link);
    
    toast({
      title: 'Download Started',
      description: `Downloading ${filename}`
    });
  } catch (error) {
    handleApiError(error, 'File Download');
  }
};

// ============= Filter Utilities =============

export const filterLogs = (
  logs: HeimdallLogEntry[],
  searchTerm: string,
  levels: LogLevel[] = [],
  sources: string[] = []
): HeimdallLogEntry[] => {
  return logs.filter(log => {
    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const matchesMessage = log.message.raw.toLowerCase().includes(searchLower);
      const matchesService = log.source.service.toLowerCase().includes(searchLower);
      const matchesHost = log.source.hostname?.toLowerCase().includes(searchLower);
      
      if (!matchesMessage && !matchesService && !matchesHost) {
        return false;
      }
    }
    
    // Level filter
    if (levels.length > 0 && !levels.includes(log.level)) {
      return false;
    }
    
    // Source filter
    if (sources.length > 0) {
      const matchesService = sources.includes(log.source.service);
      const matchesHost = log.source.hostname && sources.includes(log.source.hostname);
      if (!matchesService && !matchesHost) {
        return false;
      }
    }
    
    return true;
  });
};

export const sortLogs = (
  logs: HeimdallLogEntry[],
  field: keyof HeimdallLogEntry | string,
  direction: 'asc' | 'desc' = 'desc'
): HeimdallLogEntry[] => {
  return [...logs].sort((a, b) => {
    let aValue: any;
    let bValue: any;
    
    // Handle nested field access (e.g., 'source.service')
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      aValue = (a as any)[parent]?.[child];
      bValue = (b as any)[parent]?.[child];
    } else {
      aValue = (a as any)[field];
      bValue = (b as any)[field];
    }
    
    // Handle timestamp comparison
    if (field === 'timestamp') {
      const aTime = typeof aValue === 'bigint' ? Number(aValue) : new Date(aValue).getTime();
      const bTime = typeof bValue === 'bigint' ? Number(bValue) : new Date(bValue).getTime();
      return direction === 'desc' ? bTime - aTime : aTime - bTime;
    }
    
    // Handle string comparison
    const aStr = String(aValue || '');
    const bStr = String(bValue || '');
    const comparison = aStr.localeCompare(bStr);
    
    return direction === 'desc' ? -comparison : comparison;
  });
};

// ============= Validation Utilities =============

export const isValidTimeRange = (from: Date, to: Date): boolean => {
  return from < to && from.getTime() > 0 && to.getTime() <= Date.now();
};

export const sanitizeInput = (input: string): string => {
  return input
    .replace(/[<>]/g, '') // Remove potential XSS characters
    .trim()
    .substring(0, 1000); // Limit length
};

// ============= Debounce Utility =============

export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): T => {
  let timeout: NodeJS.Timeout;
  
  return ((...args: any[]) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(undefined, args), wait);
  }) as T;
};

// ============= Local Storage Utilities =============

export const saveToLocalStorage = (key: string, value: any): void => {
  try {
    localStorage.setItem(`heimdall_${key}`, JSON.stringify(value));
  } catch (error) {
    console.warn('Failed to save to localStorage:', error);
  }
};

export const loadFromLocalStorage = <T>(key: string, defaultValue: T): T => {
  try {
    const stored = localStorage.getItem(`heimdall_${key}`);
    return stored ? JSON.parse(stored) : defaultValue;
  } catch (error) {
    console.warn('Failed to load from localStorage:', error);
    return defaultValue;
  }
};

export const removeFromLocalStorage = (key: string): void => {
  try {
    localStorage.removeItem(`heimdall_${key}`);
  } catch (error) {
    console.warn('Failed to remove from localStorage:', error);
  }
};

// ============= Performance Utilities =============

export const measurePerformance = <T>(
  name: string,
  fn: () => T
): T => {
  const start = performance.now();
  const result = fn();
  const end = performance.now();
  
  console.debug(`Performance: ${name} took ${(end - start).toFixed(2)}ms`);
  return result;
};

export const batchProcess = async <T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  batchSize: number = 10
): Promise<R[]> => {
  const results: R[] = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(processor));
    results.push(...batchResults);
  }
  
  return results;
};

// ============= Constants =============

export const HEIMDALL_CONSTANTS = {
  MAX_LOG_LENGTH: 10000,
  DEFAULT_PAGE_SIZE: 50,
  MAX_PAGE_SIZE: 1000,
  DEBOUNCE_DELAY: 300,
  AUTO_REFRESH_INTERVAL: 30000,
  MAX_EXPORT_RECORDS: 10000,
  LOCAL_STORAGE_PREFIX: 'heimdall_'
} as const;