// Validation utilities for Apicarus

export const ValidationUtils = {
  // URL validation
  isValidUrl(url) {
    if (!url || typeof url !== 'string') return false;
    
    try {
      const urlObj = new URL(url);
      return ['http:', 'https:', 'ws:', 'wss:'].includes(urlObj.protocol);
    } catch (error) {
      return false;
    }
  },
  
  // JSON validation
  isValidJson(str) {
    if (!str || typeof str !== 'string') return false;
    
    try {
      JSON.parse(str);
      return true;
    } catch (error) {
      return false;
    }
  },
  
  // Email validation
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },
  
  // Header validation
  isValidHeaderName(name) {
    if (!name || typeof name !== 'string') return false;
    
    // RFC 7230 compliant header names
    const headerRegex = /^[!#$%&'*+\-.0-9A-Z^_`a-z|~]+$/;
    return headerRegex.test(name);
  },
  
  // Header value validation
  isValidHeaderValue(value) {
    if (typeof value !== 'string') return false;
    
    // Check for invalid characters
    const invalidChars = /[\r\n\0]/;
    return !invalidChars.test(value);
  },
  
  // HTTP method validation
  isValidHttpMethod(method) {
    const validMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS', 'TRACE', 'CONNECT'];
    return validMethods.includes(method);
  },
  
  // Port validation
  isValidPort(port) {
    const portNum = parseInt(port, 10);
    return !isNaN(portNum) && portNum > 0 && portNum <= 65535;
  },
  
  // Validate request body based on content type
  validateRequestBody(body, contentType) {
    if (!body) return { valid: true };
    
    switch (contentType) {
      case 'application/json':
        if (typeof body === 'string') {
          return { 
            valid: this.isValidJson(body), 
            error: 'Invalid JSON format' 
          };
        }
        return { valid: true };
        
      case 'application/xml':
      case 'text/xml':
        if (typeof body === 'string') {
          return { 
            valid: this.isValidXml(body), 
            error: 'Invalid XML format' 
          };
        }
        return { valid: false, error: 'XML must be a string' };
        
      case 'application/x-www-form-urlencoded':
        return { valid: true }; // URLSearchParams handles validation
        
      default:
        return { valid: true };
    }
  },
  
  // Basic XML validation
  isValidXml(str) {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(str, 'text/xml');
      return !xmlDoc.getElementsByTagName('parsererror').length;
    } catch (error) {
      return false;
    }
  },
  
  // Validate collection name
  isValidCollectionName(name) {
    if (!name || typeof name !== 'string') return false;
    
    // Allow alphanumeric, spaces, hyphens, underscores
    const nameRegex = /^[a-zA-Z0-9\s\-_]+$/;
    return nameRegex.test(name) && name.length <= 100;
  },
  
  // Validate environment variable name
  isValidVariableName(name) {
    if (!name || typeof name !== 'string') return false;
    
    // Must start with letter, can contain alphanumeric and underscore
    const varRegex = /^[a-zA-Z][a-zA-Z0-9_]*$/;
    return varRegex.test(name);
  }
};

export const ErrorMessages = {
  INVALID_URL: 'Please enter a valid URL (http://, https://, ws://, or wss://)',
  INVALID_JSON: 'Invalid JSON format. Please check your syntax',
  INVALID_HEADER_NAME: 'Invalid header name. Use only alphanumeric characters and standard symbols',
  INVALID_HEADER_VALUE: 'Invalid header value. Cannot contain line breaks',
  INVALID_METHOD: 'Invalid HTTP method',
  INVALID_PORT: 'Port must be between 1 and 65535',
  NETWORK_ERROR: 'Network error. Please check your connection and try again',
  TIMEOUT_ERROR: 'Request timed out. The server took too long to respond',
  CORS_ERROR: 'CORS error. The server doesn\'t allow requests from this origin',
  AUTH_ERROR: 'Authentication failed. Please check your credentials',
  SERVER_ERROR: 'Server error. The server returned an error response',
  UNKNOWN_ERROR: 'An unexpected error occurred. Please try again',
  
  // Helper to get user-friendly error message
  getErrorMessage(error) {
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      return this.NETWORK_ERROR;
    }
    
    if (error.name === 'AbortError') {
      return this.TIMEOUT_ERROR;
    }
    
    if (error.message && error.message.toLowerCase().includes('cors')) {
      return this.CORS_ERROR;
    }
    
    if (error.status === 401 || error.status === 403) {
      return this.AUTH_ERROR;
    }
    
    if (error.status >= 500) {
      return this.SERVER_ERROR;
    }
    
    return error.message || this.UNKNOWN_ERROR;
  },
  
  // Get troubleshooting tips for common errors
  getTroubleshootingTips(error) {
    const tips = [];
    
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      tips.push('Check if the server is running and accessible');
      tips.push('Verify the URL is correct');
      tips.push('Check your internet connection');
      tips.push('Try disabling any VPN or proxy');
    }
    
    if (error.message && error.message.toLowerCase().includes('cors')) {
      tips.push('The server needs to allow CORS from your origin');
      tips.push('Try using a proxy server or browser extension for development');
      tips.push('Contact the API provider about CORS configuration');
    }
    
    if (error.status === 401) {
      tips.push('Verify your authentication credentials');
      tips.push('Check if the token has expired');
      tips.push('Ensure you\'re using the correct auth method');
    }
    
    if (error.status === 404) {
      tips.push('Check if the endpoint URL is correct');
      tips.push('Verify the API documentation for the correct path');
      tips.push('Ensure you\'re using the right HTTP method');
    }
    
    if (error.status === 429) {
      tips.push('You\'ve hit the rate limit');
      tips.push('Wait before making more requests');
      tips.push('Consider implementing request throttling');
    }
    
    return tips;
  }
};