/**
 * Request Service - Handles HTTP request business logic
 * @module services/RequestService
 */

import { 
  NetworkError, 
  ValidationError, 
  TimeoutError,
  ApiResponseError 
} from '../utils/errors.js';
import { SecurityValidator, CSRFProtection } from '../utils/security.js';
import { ValidationUtils } from '../utils/validation.js';

export class RequestService {
  constructor(plugin) {
    this.plugin = plugin;
    this.activeRequest = null;
  }

  /**
   * Execute a complete HTTP request
   * @param {Object} config - Request configuration
   * @returns {Promise<Object>} Response data
   */
  async execute(config) {
    // Prepare request
    const request = await this.prepare(config);
    
    // Execute request
    const response = await this.send(request);
    
    // Process response
    return await this.process(response, request);
  }

  /**
   * Prepare request for sending
   * @param {Object} config - Raw request configuration
   * @returns {Promise<Object>} Prepared request
   */
  async prepare(config) {
    const prepared = {
      method: config.method || 'GET',
      url: config.url,
      headers: { ...config.headers },
      params: { ...config.params },
      body: config.body,
      auth: config.auth,
      timeout: config.timeout || this.plugin.requestTimeout
    };

    // Validate request
    this.validate(prepared);

    // Apply environment variables
    if (this.plugin.environmentManager) {
      prepared.url = await this.plugin.environmentManager.interpolateVariables(prepared.url);
      prepared.headers = await this.applyVariablesToHeaders(prepared.headers);
      prepared.params = await this.applyVariablesToParams(prepared.params);
      
      if (typeof prepared.body === 'string') {
        prepared.body = await this.plugin.environmentManager.interpolateVariables(prepared.body);
      }
    }

    // Apply authentication
    this.applyAuthentication(prepared);

    // Add CSRF protection for state-changing methods
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(prepared.method)) {
      CSRFProtection.addToRequest(prepared);
    }

    // Sanitize headers
    prepared.headers = SecurityValidator.sanitizeHeaders(prepared.headers);

    return prepared;
  }

  /**
   * Validate request configuration
   * @param {Object} request - Request to validate
   * @throws {ValidationError} If validation fails
   */
  validate(request) {
    // Validate URL
    if (!request.url) {
      throw new ValidationError('URL is required', 'url', '');
    }

    try {
      SecurityValidator.validateUrl(request.url);
    } catch (error) {
      throw new ValidationError(error.message, 'url', request.url);
    }

    // Validate method
    if (!ValidationUtils.isValidHttpMethod(request.method)) {
      throw new ValidationError('Invalid HTTP method', 'method', request.method);
    }

    // Validate headers
    for (const [key, value] of Object.entries(request.headers || {})) {
      if (!ValidationUtils.isValidHeaderName(key)) {
        throw new ValidationError(`Invalid header name: ${key}`, 'header', key);
      }
      if (!ValidationUtils.isValidHeaderValue(value)) {
        throw new ValidationError(`Invalid header value for ${key}`, 'header', value);
      }
    }

    // Validate body
    if (request.body && ['POST', 'PUT', 'PATCH'].includes(request.method)) {
      const contentType = request.headers['Content-Type'] || request.headers['content-type'] || '';
      
      try {
        SecurityValidator.validateRequestBody(request.body, contentType);
      } catch (error) {
        throw new ValidationError(error.message, 'body', request.body);
      }
    }
  }

  /**
   * Apply authentication to request
   * @param {Object} request - Request object
   */
  applyAuthentication(request) {
    const authType = request.auth?.type;
    if (!authType || authType === 'none') return;

    const authHandlers = {
      'bearer': () => this.applyBearerAuth(request),
      'basic': () => this.applyBasicAuth(request),
      'api-key': () => this.applyApiKeyAuth(request)
    };

    const handler = authHandlers[authType];
    if (handler) {
      handler();
    }
  }

  /**
   * Apply Bearer token authentication
   * @param {Object} request - Request object
   */
  applyBearerAuth(request) {
    const token = request.auth.token;
    if (token) {
      request.headers['Authorization'] = `Bearer ${token}`;
    }
  }

  /**
   * Apply Basic authentication
   * @param {Object} request - Request object
   */
  applyBasicAuth(request) {
    const { username, password } = request.auth;
    if (username && password) {
      const encoded = btoa(`${username}:${password}`);
      request.headers['Authorization'] = `Basic ${encoded}`;
    }
  }

  /**
   * Apply API Key authentication
   * @param {Object} request - Request object
   */
  applyApiKeyAuth(request) {
    const { keyName, keyValue, location } = request.auth;
    if (keyName && keyValue) {
      if (location === 'header') {
        request.headers[keyName] = keyValue;
      } else {
        request.params[keyName] = keyValue;
      }
    }
  }

  /**
   * Send HTTP request
   * @param {Object} request - Prepared request
   * @returns {Promise<Response>} Fetch response
   */
  async send(request) {
    // Cancel any active request
    if (this.activeRequest) {
      this.activeRequest.abort();
    }

    // Create abort controller for timeout
    const controller = new AbortController();
    this.activeRequest = controller;

    const timeoutId = setTimeout(() => {
      controller.abort();
    }, request.timeout);

    try {
      // Build URL with params
      const url = this.buildUrlWithParams(request.url, request.params);

      // Build fetch options
      const fetchOptions = {
        method: request.method,
        headers: request.headers,
        signal: controller.signal
      };

      // Add body for methods that support it
      if (['POST', 'PUT', 'PATCH'].includes(request.method) && request.body) {
        if (typeof request.body === 'object') {
          fetchOptions.body = JSON.stringify(request.body);
          fetchOptions.headers['Content-Type'] = fetchOptions.headers['Content-Type'] || 'application/json';
        } else {
          fetchOptions.body = request.body;
        }
      }

      // Execute request
      const response = await fetch(url, fetchOptions);
      
      clearTimeout(timeoutId);
      this.activeRequest = null;

      return response;

    } catch (error) {
      clearTimeout(timeoutId);
      this.activeRequest = null;

      // Transform errors
      if (error.name === 'AbortError') {
        throw new TimeoutError('Request timed out', request.timeout);
      }

      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        throw new NetworkError('Failed to connect to server', { url: request.url });
      }

      throw error;
    }
  }

  /**
   * Process HTTP response
   * @param {Response} response - Fetch response
   * @param {Object} request - Original request
   * @returns {Promise<Object>} Processed response data
   */
  async process(response, request) {
    const startTime = Date.now();

    // Parse response body
    const responseData = await this.parseResponseBody(response);
    
    // Calculate size
    const responseText = typeof responseData === 'string' 
      ? responseData 
      : JSON.stringify(responseData);
    const responseSize = new Blob([responseText]).size;

    // Build response object
    const processedResponse = {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      data: responseData,
      size: responseSize,
      duration: Date.now() - startTime,
      request: {
        method: request.method,
        url: request.url
      }
    };

    // Check for HTTP errors
    if (!response.ok) {
      throw new ApiResponseError(
        `${response.status} ${response.statusText}`,
        response.status,
        response.statusText,
        responseData
      );
    }

    return processedResponse;
  }

  /**
   * Parse response body based on content type
   * @param {Response} response - Fetch response
   * @returns {Promise<any>} Parsed response data
   */
  async parseResponseBody(response) {
    const contentType = response.headers.get('content-type') || '';

    try {
      if (contentType.includes('application/json')) {
        return await response.json();
      } else if (contentType.includes('text/')) {
        return await response.text();
      } else if (contentType.includes('application/xml')) {
        return await response.text();
      } else {
        // For binary content, return blob
        return await response.blob();
      }
    } catch (error) {
      // If parsing fails, try to get as text
      try {
        return await response.text();
      } catch {
        return null;
      }
    }
  }

  /**
   * Build URL with query parameters
   * @param {string} baseUrl - Base URL
   * @param {Object} params - Query parameters
   * @returns {string} Complete URL
   */
  buildUrlWithParams(baseUrl, params) {
    if (!params || Object.keys(params).length === 0) {
      return baseUrl;
    }

    const url = new URL(baseUrl);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.append(key, value);
      }
    });

    return url.toString();
  }

  /**
   * Apply environment variables to headers
   * @param {Object} headers - Headers object
   * @returns {Promise<Object>} Headers with variables replaced
   */
  async applyVariablesToHeaders(headers) {
    const processed = {};
    
    for (const [key, value] of Object.entries(headers)) {
      const processedKey = await this.plugin.environmentManager.interpolateVariables(key);
      const processedValue = await this.plugin.environmentManager.interpolateVariables(value);
      processed[processedKey] = processedValue;
    }
    
    return processed;
  }

  /**
   * Apply environment variables to params
   * @param {Object} params - Parameters object
   * @returns {Promise<Object>} Params with variables replaced
   */
  async applyVariablesToParams(params) {
    const processed = {};
    
    for (const [key, value] of Object.entries(params)) {
      const processedKey = await this.plugin.environmentManager.interpolateVariables(key);
      const processedValue = await this.plugin.environmentManager.interpolateVariables(String(value));
      processed[processedKey] = processedValue;
    }
    
    return processed;
  }

  /**
   * Cancel active request
   */
  cancel() {
    if (this.activeRequest) {
      this.activeRequest.abort();
      this.activeRequest = null;
    }
  }
}