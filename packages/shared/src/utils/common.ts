/**
 * Common Utility Functions
 * Shared utilities used across the Alexandria Platform
 */

import { v4 as uuidv4 } from 'uuid';

// Type utilities
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type NonNullable<T> = T extends null | undefined ? never : T;

export type Awaited<T> = T extends Promise<infer U> ? U : T;

// String utilities
export const stringUtils = {
  /**
   * Convert string to kebab-case
   */
  kebabCase: (str: string): string => {
    return str
      .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
      .replace(/[\s_]+/g, '-')
      .toLowerCase();
  },

  /**
   * Convert string to camelCase
   */
  camelCase: (str: string): string => {
    return str
      .replace(/[-_\s]+(.)/g, (_, char) => char.toUpperCase())
      .replace(/^[A-Z]/, char => char.toLowerCase());
  },

  /**
   * Convert string to PascalCase
   */
  pascalCase: (str: string): string => {
    const camelCased = stringUtils.camelCase(str);
    return camelCased.charAt(0).toUpperCase() + camelCased.slice(1);
  },

  /**
   * Truncate string with ellipsis
   */
  truncate: (str: string, length: number, suffix = '...'): string => {
    if (str.length <= length) return str;
    return str.substring(0, length - suffix.length) + suffix;
  },

  /**
   * Generate a random string
   */
  random: (length = 8, charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'): string => {
    let result = '';
    for (let i = 0; i < length; i++) {
      result += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return result;
  },

  /**
   * Generate a URL-safe slug
   */
  slugify: (str: string): string => {
    return str
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  },

  /**
   * Escape HTML characters
   */
  escapeHtml: (str: string): string => {
    const htmlEscapes: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };
    return str.replace(/[&<>"']/g, char => htmlEscapes[char]);
  }
};

// Array utilities
export const arrayUtils = {
  /**
   * Remove duplicates from array
   */
  unique: <T>(arr: T[]): T[] => [...new Set(arr)],

  /**
   * Group array elements by key
   */
  groupBy: <T, K extends keyof T>(arr: T[], key: K): Record<string, T[]> => {
    return arr.reduce((groups, item) => {
      const groupKey = String(item[key]);
      groups[groupKey] = groups[groupKey] || [];
      groups[groupKey].push(item);
      return groups;
    }, {} as Record<string, T[]>);
  },

  /**
   * Chunk array into smaller arrays
   */
  chunk: <T>(arr: T[], size: number): T[][] => {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  },

  /**
   * Get random element from array
   */
  random: <T>(arr: T[]): T | undefined => {
    return arr.length > 0 ? arr[Math.floor(Math.random() * arr.length)] : undefined;
  },

  /**
   * Shuffle array (Fisher-Yates algorithm)
   */
  shuffle: <T>(arr: T[]): T[] => {
    const shuffled = [...arr];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  },

  /**
   * Find intersection of arrays
   */
  intersection: <T>(...arrays: T[][]): T[] => {
    if (arrays.length === 0) return [];
    return arrays.reduce((acc, arr) => acc.filter(item => arr.includes(item)));
  },

  /**
   * Find difference between arrays
   */
  difference: <T>(arr1: T[], arr2: T[]): T[] => {
    return arr1.filter(item => !arr2.includes(item));
  }
};

// Object utilities
export const objectUtils = {
  /**
   * Deep clone object
   */
  deepClone: <T>(obj: T): T => {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj.getTime()) as any;
    if (obj instanceof Array) return obj.map(item => objectUtils.deepClone(item)) as any;
    if (typeof obj === 'object') {
      const cloned: any = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          cloned[key] = objectUtils.deepClone(obj[key]);
        }
      }
      return cloned;
    }
    return obj;
  },

  /**
   * Deep merge objects
   */
  deepMerge: <T extends Record<string, any>>(target: T, ...sources: Partial<T>[]): T => {
    if (!sources.length) return target;
    const source = sources.shift();

    if (objectUtils.isObject(target) && objectUtils.isObject(source)) {
      for (const key in source) {
        if (objectUtils.isObject(source[key])) {
          if (!target[key]) Object.assign(target, { [key]: {} });
          objectUtils.deepMerge(target[key], source[key] as any);
        } else {
          Object.assign(target, { [key]: source[key] });
        }
      }
    }

    return objectUtils.deepMerge(target, ...sources);
  },

  /**
   * Check if value is object
   */
  isObject: (obj: any): obj is Record<string, any> => {
    return obj !== null && typeof obj === 'object' && !Array.isArray(obj);
  },

  /**
   * Get nested property value
   */
  get: <T>(obj: any, path: string, defaultValue?: T): T => {
    const keys = path.split('.');
    let result = obj;

    for (const key of keys) {
      result = result?.[key];
      if (result === undefined) return defaultValue as T;
    }

    return result;
  },

  /**
   * Set nested property value
   */
  set: (obj: any, path: string, value: any): void => {
    const keys = path.split('.');
    const lastKey = keys.pop();
    let current = obj;

    for (const key of keys) {
      if (!(key in current) || !objectUtils.isObject(current[key])) {
        current[key] = {};
      }
      current = current[key];
    }

    if (lastKey) {
      current[lastKey] = value;
    }
  },

  /**
   * Pick properties from object
   */
  pick: <T extends Record<string, any>, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> => {
    const result = {} as Pick<T, K>;
    for (const key of keys) {
      if (key in obj) {
        result[key] = obj[key];
      }
    }
    return result;
  },

  /**
   * Omit properties from object
   */
  omit: <T extends Record<string, any>, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> => {
    const result = { ...obj };
    for (const key of keys) {
      delete result[key];
    }
    return result;
  }
};

// Date utilities
export const dateUtils = {
  /**
   * Format date to ISO string with timezone
   */
  toISOString: (date: Date = new Date()): string => {
    return date.toISOString();
  },

  /**
   * Get date range
   */
  getRange: (start: Date, end: Date): Date[] => {
    const dates: Date[] = [];
    const current = new Date(start);

    while (current <= end) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    return dates;
  },

  /**
   * Add time to date
   */
  add: (date: Date, amount: number, unit: 'minutes' | 'hours' | 'days' | 'weeks' | 'months' | 'years'): Date => {
    const result = new Date(date);

    switch (unit) {
      case 'minutes':
        result.setMinutes(result.getMinutes() + amount);
        break;
      case 'hours':
        result.setHours(result.getHours() + amount);
        break;
      case 'days':
        result.setDate(result.getDate() + amount);
        break;
      case 'weeks':
        result.setDate(result.getDate() + amount * 7);
        break;
      case 'months':
        result.setMonth(result.getMonth() + amount);
        break;
      case 'years':
        result.setFullYear(result.getFullYear() + amount);
        break;
    }

    return result;
  },

  /**
   * Get time ago string
   */
  timeAgo: (date: Date): string => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return `${seconds} second${seconds > 1 ? 's' : ''} ago`;
  }
};

// Number utilities
export const numberUtils = {
  /**
   * Format number with commas
   */
  format: (num: number): string => {
    return new Intl.NumberFormat().format(num);
  },

  /**
   * Format as currency
   */
  currency: (amount: number, currency = 'USD', locale = 'en-US'): string => {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency
    }).format(amount);
  },

  /**
   * Format as percentage
   */
  percentage: (value: number, decimals = 2): string => {
    return `${(value * 100).toFixed(decimals)}%`;
  },

  /**
   * Format bytes
   */
  bytes: (bytes: number, decimals = 2): string => {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  },

  /**
   * Generate random number in range
   */
  random: (min: number, max: number): number => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  },

  /**
   * Clamp number to range
   */
  clamp: (value: number, min: number, max: number): number => {
    return Math.min(Math.max(value, min), max);
  }
};

// Promise utilities
export const promiseUtils = {
  /**
   * Delay execution
   */
  delay: (ms: number): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  /**
   * Timeout promise
   */
  timeout: <T>(promise: Promise<T>, ms: number): Promise<T> => {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Promise timed out after ${ms}ms`)), ms)
      )
    ]);
  },

  /**
   * Retry promise
   */
  retry: async <T>(
    fn: () => Promise<T>,
    attempts = 3,
    delay = 1000
  ): Promise<T> => {
    try {
      return await fn();
    } catch (error) {
      if (attempts <= 1) throw error;
      await promiseUtils.delay(delay);
      return promiseUtils.retry(fn, attempts - 1, delay * 2);
    }
  },

  /**
   * Batch promises with concurrency limit
   */
  batch: async <T, R>(
    items: T[],
    fn: (item: T) => Promise<R>,
    concurrency = 5
  ): Promise<R[]> => {
    const results: R[] = [];
    const chunks = arrayUtils.chunk(items, concurrency);

    for (const chunk of chunks) {
      const chunkResults = await Promise.all(chunk.map(fn));
      results.push(...chunkResults);
    }

    return results;
  }
};

// ID generation utilities
export const idUtils = {
  /**
   * Generate UUID v4
   */
  uuid: (): string => uuidv4(),

  /**
   * Generate short ID
   */
  shortId: (length = 8): string => stringUtils.random(length, 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'),

  /**
   * Generate nanoid-style ID
   */
  nanoid: (length = 21): string => stringUtils.random(length, 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-')
};