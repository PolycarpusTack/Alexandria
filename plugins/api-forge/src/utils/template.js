/**
 * Template utilities for safe HTML rendering
 * @module utils/template
 */

import { escapeHtml } from './security.js';

/**
 * Template literal tag functions
 */
export class Template {
  /**
   * HTML template with auto-escaping
   * @param {TemplateStringsArray} strings - Template strings
   * @param {...any} values - Template values
   * @returns {string} Safe HTML string
   */
  static html(strings, ...values) {
    return strings.reduce((result, string, i) => {
      const value = values[i - 1];
      const escaped = Template.escapeValue(value);
      return result + escaped + string;
    });
  }

  /**
   * Raw HTML template (no escaping)
   * @param {TemplateStringsArray} strings - Template strings
   * @param {...any} values - Template values
   * @returns {string} Raw HTML string
   */
  static raw(strings, ...values) {
    return strings.reduce((result, string, i) => {
      const value = values[i - 1];
      return result + (value ?? '') + string;
    });
  }

  /**
   * CSS template
   * @param {TemplateStringsArray} strings - Template strings
   * @param {...any} values - Template values
   * @returns {string} CSS string
   */
  static css(strings, ...values) {
    return strings.reduce((result, string, i) => {
      const value = values[i - 1];
      return result + (value ?? '') + string;
    });
  }

  /**
   * Escape a template value
   * @param {any} value - Value to escape
   * @returns {string} Escaped value
   */
  static escapeValue(value) {
    if (value == null) return '';
    
    if (value instanceof SafeString) {
      return value.toString();
    }
    
    if (Array.isArray(value)) {
      return value.map(v => Template.escapeValue(v)).join('');
    }
    
    if (typeof value === 'object') {
      return escapeHtml(JSON.stringify(value));
    }
    
    return escapeHtml(String(value));
  }

  /**
   * Conditionally render content
   * @param {boolean} condition - Condition
   * @param {any} content - Content to render if true
   * @param {any} elseContent - Content to render if false
   * @returns {string} Rendered content
   */
  static if(condition, content, elseContent = '') {
    return condition ? content : elseContent;
  }

  /**
   * Render content unless condition is true
   * @param {boolean} condition - Condition
   * @param {any} content - Content to render if false
   * @returns {string} Rendered content
   */
  static unless(condition, content) {
    return condition ? '' : content;
  }

  /**
   * Render array of items
   * @param {Array} items - Items to render
   * @param {Function} template - Template function for each item
   * @param {string} separator - Separator between items
   * @returns {string} Rendered items
   */
  static each(items, template, separator = '') {
    if (!Array.isArray(items) || items.length === 0) return '';
    return items.map(template).join(separator);
  }

  /**
   * Render object entries
   * @param {Object} obj - Object to render
   * @param {Function} template - Template function for each entry
   * @param {string} separator - Separator between entries
   * @returns {string} Rendered entries
   */
  static entries(obj, template, separator = '') {
    if (!obj || typeof obj !== 'object') return '';
    return Object.entries(obj).map(([key, value]) => template(key, value)).join(separator);
  }

  /**
   * Join array with separator
   * @param {Array} items - Items to join
   * @param {string} separator - Separator
   * @returns {string} Joined string
   */
  static join(items, separator = ', ') {
    if (!Array.isArray(items)) return '';
    return items.filter(Boolean).join(separator);
  }

  /**
   * Create CSS classes string
   * @param {...any} classes - Class names or objects
   * @returns {string} Classes string
   */
  static classNames(...classes) {
    const result = [];
    
    for (const cls of classes) {
      if (!cls) continue;
      
      if (typeof cls === 'string') {
        result.push(cls);
      } else if (Array.isArray(cls)) {
        result.push(Template.classNames(...cls));
      } else if (typeof cls === 'object') {
        for (const [key, value] of Object.entries(cls)) {
          if (value) result.push(key);
        }
      }
    }
    
    return result.filter(Boolean).join(' ');
  }

  /**
   * Create style string from object
   * @param {Object} styles - Style object
   * @returns {string} Style string
   */
  static styles(styles) {
    if (!styles || typeof styles !== 'object') return '';
    
    return Object.entries(styles)
      .filter(([, value]) => value != null)
      .map(([key, value]) => {
        const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
        return `${cssKey}: ${value}`;
      })
      .join('; ');
  }

  /**
   * Create data attributes string
   * @param {Object} data - Data attributes
   * @returns {string} Data attributes string
   */
  static dataAttrs(data) {
    if (!data || typeof data !== 'object') return '';
    
    return Object.entries(data)
      .filter(([, value]) => value != null)
      .map(([key, value]) => {
        const attrName = `data-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
        const attrValue = typeof value === 'object' ? JSON.stringify(value) : value;
        return `${attrName}="${escapeHtml(String(attrValue))}"`;
      })
      .join(' ');
  }

  /**
   * Pluralize word based on count
   * @param {number} count - Count
   * @param {string} singular - Singular form
   * @param {string} plural - Plural form (optional)
   * @returns {string} Pluralized word
   */
  static pluralize(count, singular, plural = null) {
    if (count === 1) return singular;
    return plural || `${singular}s`;
  }

  /**
   * Format number with separators
   * @param {number} num - Number to format
   * @param {string} locale - Locale (default: en-US)
   * @returns {string} Formatted number
   */
  static formatNumber(num, locale = 'en-US') {
    return new Intl.NumberFormat(locale).format(num);
  }

  /**
   * Format file size
   * @param {number} bytes - Size in bytes
   * @returns {string} Formatted size
   */
  static formatSize(bytes) {
    if (!bytes) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
  }

  /**
   * Format duration
   * @param {number} ms - Duration in milliseconds
   * @returns {string} Formatted duration
   */
  static formatDuration(ms) {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  }

  /**
   * Truncate text with ellipsis
   * @param {string} text - Text to truncate
   * @param {number} length - Maximum length
   * @param {string} suffix - Suffix to add
   * @returns {string} Truncated text
   */
  static truncate(text, length, suffix = '...') {
    if (!text || text.length <= length) return text;
    return text.substring(0, length - suffix.length) + suffix;
  }
}

/**
 * Safe string wrapper to bypass escaping
 */
export class SafeString {
  constructor(value) {
    this.value = value;
  }
  
  toString() {
    return this.value;
  }
}

/**
 * Mark string as safe (no escaping needed)
 * @param {string} value - HTML string
 * @returns {SafeString} Safe string
 */
export function safe(value) {
  return new SafeString(value);
}

/**
 * Template helper exports
 */
export const {
  html,
  raw,
  css,
  if: when,
  unless,
  each,
  entries,
  join,
  classNames,
  styles,
  dataAttrs,
  pluralize,
  formatNumber,
  formatSize,
  formatDuration,
  truncate
} = Template;