/**
 * Security utilities for Apicarus
 * @module utils/security
 */

/**
 * Escapes HTML to prevent XSS attacks
 * @param {string} str - String to escape
 * @returns {string} Escaped HTML string
 */
export function escapeHtml(str) {
  if (typeof str !== 'string') return str;
  
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Security validator for URLs and headers
 */
export class SecurityValidator {
  // Blocked hosts to prevent SSRF attacks
  static BLOCKED_HOSTS = [
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
    '169.254.169.254', // AWS metadata endpoint
    '::1', // IPv6 localhost
    '[::1]',
  ];

  // Dangerous headers that should not be set by user
  static DANGEROUS_HEADERS = [
    'host',
    'cookie', 
    'authorization',
    'proxy-authorization',
    'origin',
    'referer',
    'content-length',
    'connection',
    'transfer-encoding',
    'upgrade'
  ];

  // Valid header name pattern
  static HEADER_NAME_PATTERN = /^[\w-]+$/;

  /**
   * Validates a URL for security issues
   * @param {string} url - URL to validate
   * @returns {boolean} True if URL is safe
   * @throws {Error} If URL is potentially dangerous
   */
  static validateUrl(url) {
    if (!url || typeof url !== 'string') {
      throw new Error('URL is required');
    }

    let urlObj;
    try {
      urlObj = new URL(url);
    } catch (error) {
      throw new Error('Invalid URL format');
    }

    // Only allow HTTP/HTTPS protocols
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      throw new Error(`Protocol '${urlObj.protocol}' is not allowed. Only HTTP/HTTPS are permitted.`);
    }

    // Check for blocked hosts (SSRF prevention)
    const hostname = urlObj.hostname.toLowerCase();
    if (this.BLOCKED_HOSTS.includes(hostname)) {
      throw new Error(`Requests to '${hostname}' are not allowed for security reasons`);
    }

    // Check for private IP ranges (RFC 1918)
    if (this.isPrivateIP(hostname)) {
      throw new Error('Requests to private IP addresses are not allowed');
    }

    // Check for suspicious patterns
    if (url.includes('@') || url.includes('\\')) {
      throw new Error('URL contains suspicious characters');
    }

    return true;
  }

  /**
   * Checks if an IP address is in private range
   * @param {string} hostname - Hostname or IP to check
   * @returns {boolean} True if private IP
   */
  static isPrivateIP(hostname) {
    // Check if it's an IP address
    const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipPattern.test(hostname)) {
      return false;
    }

    const parts = hostname.split('.').map(Number);
    
    // 10.0.0.0/8
    if (parts[0] === 10) return true;
    
    // 172.16.0.0/12
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    
    // 192.168.0.0/16
    if (parts[0] === 192 && parts[1] === 168) return true;
    
    return false;
  }

  /**
   * Sanitizes headers by removing dangerous ones
   * @param {Object} headers - Headers object
   * @returns {Object} Sanitized headers
   */
  static sanitizeHeaders(headers) {
    if (!headers || typeof headers !== 'object') {
      return {};
    }

    const sanitized = {};
    
    for (const [key, value] of Object.entries(headers)) {
      const lowerKey = key.toLowerCase();
      
      // Skip dangerous headers
      if (this.DANGEROUS_HEADERS.includes(lowerKey)) {
        console.warn(`Header '${key}' was removed for security reasons`);
        continue;
      }
      
      // Validate header name format
      if (!this.HEADER_NAME_PATTERN.test(key)) {
        console.warn(`Invalid header name '${key}' - must contain only letters, numbers, hyphens, and underscores`);
        continue;
      }
      
      // Validate header value (no line breaks)
      const sanitizedValue = this.sanitizeHeaderValue(value);
      if (sanitizedValue !== null) {
        sanitized[key] = sanitizedValue;
      }
    }
    
    return sanitized;
  }

  /**
   * Sanitizes a header value
   * @param {string} value - Header value
   * @returns {string|null} Sanitized value or null if invalid
   */
  static sanitizeHeaderValue(value) {
    if (value === null || value === undefined) {
      return null;
    }

    const stringValue = String(value);
    
    // Remove line breaks (CRLF injection prevention)
    if (/[\r\n]/.test(stringValue)) {
      console.warn('Header value contains line breaks and was sanitized');
      return stringValue.replace(/[\r\n]/g, '');
    }
    
    // Check for null bytes
    if (stringValue.includes('\0')) {
      console.warn('Header value contains null bytes and was rejected');
      return null;
    }
    
    return stringValue;
  }

  /**
   * Validates request body
   * @param {string|Object} body - Request body
   * @param {string} contentType - Content type
   * @returns {boolean} True if valid
   * @throws {Error} If body is invalid
   */
  static validateRequestBody(body, contentType) {
    if (!body) return true;

    if (contentType && contentType.includes('application/json')) {
      if (typeof body === 'string') {
        try {
          JSON.parse(body);
        } catch (error) {
          throw new Error('Invalid JSON in request body');
        }
      }
    }

    // Check for suspicious patterns in body
    const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
    if (bodyStr.length > 10 * 1024 * 1024) { // 10MB limit
      throw new Error('Request body is too large (max 10MB)');
    }

    return true;
  }
}

/**
 * CSRF Protection utilities
 */
export class CSRFProtection {
  static tokens = new Set();
  static TOKEN_LENGTH = 32;
  static TOKEN_EXPIRY = 3600000; // 1 hour

  /**
   * Generates a CSRF token
   * @returns {string} CSRF token
   */
  static generateToken() {
    const array = new Uint8Array(this.TOKEN_LENGTH);
    crypto.getRandomValues(array);
    const token = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    
    // Store token with expiry
    const tokenData = {
      token,
      expires: Date.now() + this.TOKEN_EXPIRY
    };
    
    this.tokens.add(tokenData);
    
    // Clean up expired tokens
    this.cleanupExpiredTokens();
    
    return token;
  }

  /**
   * Validates a CSRF token
   * @param {string} token - Token to validate
   * @returns {boolean} True if valid
   */
  static validateToken(token) {
    if (!token) return false;
    
    this.cleanupExpiredTokens();
    
    for (const tokenData of this.tokens) {
      if (tokenData.token === token) {
        // Remove used token (one-time use)
        this.tokens.delete(tokenData);
        return true;
      }
    }
    
    return false;
  }

  /**
   * Removes expired tokens
   */
  static cleanupExpiredTokens() {
    const now = Date.now();
    for (const tokenData of this.tokens) {
      if (tokenData.expires < now) {
        this.tokens.delete(tokenData);
      }
    }
  }

  /**
   * Adds CSRF token to request
   * @param {Object} request - Request object
   * @returns {Object} Request with CSRF token
   */
  static addToRequest(request) {
    const token = this.generateToken();
    
    if (!request.headers) {
      request.headers = {};
    }
    
    request.headers['X-CSRF-Token'] = token;
    
    return request;
  }
}

/**
 * Content Security Policy helper
 */
export class ContentSecurity {
  /**
   * Sanitizes HTML content for safe rendering
   * @param {string} html - HTML to sanitize
   * @returns {string} Sanitized HTML
   */
  static sanitizeHtml(html) {
    // If DOMPurify is available, use it
    if (typeof DOMPurify !== 'undefined') {
      return DOMPurify.sanitize(html, {
        ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'a', 'pre', 'code', 'ul', 'ol', 'li'],
        ALLOWED_ATTR: ['href', 'title'],
        ALLOW_DATA_ATTR: false
      });
    }
    
    // Fallback to basic escaping
    return escapeHtml(html);
  }

  /**
   * Creates a safe iframe for rendering untrusted content
   * @param {string} content - Content to render
   * @returns {string} Safe iframe HTML
   */
  static createSafeIframe(content) {
    const escapedContent = escapeHtml(content);
    
    return `
      <iframe 
        srcdoc="${escapedContent}"
        sandbox="allow-same-origin"
        style="width: 100%; height: 400px; border: 1px solid var(--color-border-dark);"
        title="Response preview"
      ></iframe>
    `;
  }

  /**
   * Validates and sanitizes a download filename
   * @param {string} filename - Filename to sanitize
   * @returns {string} Safe filename
   */
  static sanitizeFilename(filename) {
    if (!filename) {
      return 'download';
    }
    
    // Remove path traversal attempts
    let safe = filename.replace(/[\/\\]/g, '');
    
    // Remove special characters except dots and hyphens
    safe = safe.replace(/[^a-zA-Z0-9.-]/g, '_');
    
    // Ensure it doesn't start with a dot (hidden file)
    if (safe.startsWith('.')) {
      safe = '_' + safe;
    }
    
    // Limit length
    if (safe.length > 255) {
      safe = safe.substring(0, 255);
    }
    
    return safe || 'download';
  }
}

/**
 * Secure storage wrapper
 */
export class SecureStorage {
  constructor(context) {
    this.storage = context.secureStorage || context.storage;
  }

  /**
   * Stores credentials securely
   * @param {string} id - Credential ID
   * @param {Object} credentials - Credentials to store
   * @returns {Promise<void>}
   */
  async saveCredentials(id, credentials) {
    if (!id || !credentials) {
      throw new Error('ID and credentials are required');
    }
    
    // Never store in plain text
    const key = `cred_${id}`;
    
    // Use secure storage if available
    if (this.storage.set) {
      await this.storage.set(key, credentials);
    } else {
      throw new Error('Secure storage not available');
    }
  }

  /**
   * Retrieves credentials
   * @param {string} id - Credential ID
   * @returns {Promise<Object|null>}
   */
  async getCredentials(id) {
    if (!id) return null;
    
    const key = `cred_${id}`;
    
    if (this.storage.get) {
      return await this.storage.get(key);
    }
    
    return null;
  }

  /**
   * Removes credentials
   * @param {string} id - Credential ID
   * @returns {Promise<void>}
   */
  async removeCredentials(id) {
    if (!id) return;
    
    const key = `cred_${id}`;
    
    if (this.storage.remove) {
      await this.storage.remove(key);
    }
  }
}