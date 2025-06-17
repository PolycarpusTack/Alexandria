import { describe, it, expect, beforeEach } from '@jest/globals';
import { 
  escapeHtml, 
  SecurityValidator, 
  CSRFProtection, 
  ContentSecurity, 
  SecureStorage 
} from '../src/utils/security.js';

describe('Security Utilities', () => {
  describe('escapeHtml', () => {
    it('should escape HTML special characters', () => {
      expect(escapeHtml('<script>alert("XSS")</script>')).toBe('&lt;script&gt;alert("XSS")&lt;/script&gt;');
      expect(escapeHtml('Hello & "World"')).toBe('Hello &amp; "World"');
      expect(escapeHtml("It's <b>bold</b>")).toBe("It's &lt;b&gt;bold&lt;/b&gt;");
    });

    it('should handle non-string input', () => {
      expect(escapeHtml(null)).toBe(null);
      expect(escapeHtml(undefined)).toBe(undefined);
      expect(escapeHtml(123)).toBe(123);
    });

    it('should handle empty strings', () => {
      expect(escapeHtml('')).toBe('');
    });
  });

  describe('SecurityValidator', () => {
    describe('validateUrl', () => {
      it('should accept valid HTTP/HTTPS URLs', () => {
        expect(() => SecurityValidator.validateUrl('https://api.example.com')).not.toThrow();
        expect(() => SecurityValidator.validateUrl('http://api.example.com')).not.toThrow();
        expect(() => SecurityValidator.validateUrl('https://api.example.com:8080/path')).not.toThrow();
      });

      it('should reject non-HTTP protocols', () => {
        expect(() => SecurityValidator.validateUrl('file:///etc/passwd')).toThrow('Protocol \'file:\' is not allowed');
        expect(() => SecurityValidator.validateUrl('ftp://example.com')).toThrow('Protocol \'ftp:\' is not allowed');
        expect(() => SecurityValidator.validateUrl('javascript:alert(1)')).toThrow('Protocol \'javascript:\' is not allowed');
      });

      it('should reject localhost and private IPs', () => {
        expect(() => SecurityValidator.validateUrl('http://localhost/api')).toThrow('Requests to \'localhost\' are not allowed');
        expect(() => SecurityValidator.validateUrl('http://127.0.0.1/api')).toThrow('Requests to \'127.0.0.1\' are not allowed');
        expect(() => SecurityValidator.validateUrl('http://0.0.0.0/api')).toThrow('Requests to \'0.0.0.0\' are not allowed');
        expect(() => SecurityValidator.validateUrl('http://169.254.169.254/latest/meta-data')).toThrow('Requests to \'169.254.169.254\' are not allowed');
      });

      it('should reject private IP ranges', () => {
        expect(() => SecurityValidator.validateUrl('http://10.0.0.1/api')).toThrow('Requests to private IP addresses are not allowed');
        expect(() => SecurityValidator.validateUrl('http://172.16.0.1/api')).toThrow('Requests to private IP addresses are not allowed');
        expect(() => SecurityValidator.validateUrl('http://192.168.1.1/api')).toThrow('Requests to private IP addresses are not allowed');
      });

      it('should reject URLs with suspicious characters', () => {
        expect(() => SecurityValidator.validateUrl('http://user@example.com/api')).toThrow('URL contains suspicious characters');
        expect(() => SecurityValidator.validateUrl('http://example.com\\@attacker.com')).toThrow('URL contains suspicious characters');
      });

      it('should reject invalid URLs', () => {
        expect(() => SecurityValidator.validateUrl('not-a-url')).toThrow('Invalid URL format');
        expect(() => SecurityValidator.validateUrl('')).toThrow('URL is required');
        expect(() => SecurityValidator.validateUrl(null)).toThrow('URL is required');
      });
    });

    describe('sanitizeHeaders', () => {
      it('should remove dangerous headers', () => {
        const headers = {
          'Content-Type': 'application/json',
          'Cookie': 'session=abc123',
          'Authorization': 'Bearer token',
          'X-Custom-Header': 'value'
        };

        const sanitized = SecurityValidator.sanitizeHeaders(headers);
        
        expect(sanitized['Content-Type']).toBe('application/json');
        expect(sanitized['X-Custom-Header']).toBe('value');
        expect(sanitized['Cookie']).toBeUndefined();
        expect(sanitized['Authorization']).toBeUndefined();
      });

      it('should validate header names', () => {
        const headers = {
          'Valid-Header': 'value',
          'Invalid Header': 'value', // contains space
          'Invalid\nHeader': 'value', // contains newline
          'Valid_Header_2': 'value'
        };

        const sanitized = SecurityValidator.sanitizeHeaders(headers);
        
        expect(sanitized['Valid-Header']).toBe('value');
        expect(sanitized['Valid_Header_2']).toBe('value');
        expect(sanitized['Invalid Header']).toBeUndefined();
        expect(sanitized['Invalid\nHeader']).toBeUndefined();
      });

      it('should sanitize header values', () => {
        const headers = {
          'Header1': 'value\r\nInjection',
          'Header2': 'normal value',
          'Header3': 'value\0null'
        };

        const sanitized = SecurityValidator.sanitizeHeaders(headers);
        
        expect(sanitized['Header1']).toBe('valueInjection'); // CRLF removed
        expect(sanitized['Header2']).toBe('normal value');
        expect(sanitized['Header3']).toBeUndefined(); // null byte rejected
      });

      it('should handle edge cases', () => {
        expect(SecurityValidator.sanitizeHeaders(null)).toEqual({});
        expect(SecurityValidator.sanitizeHeaders(undefined)).toEqual({});
        expect(SecurityValidator.sanitizeHeaders({})).toEqual({});
      });
    });

    describe('validateRequestBody', () => {
      it('should accept valid JSON bodies', () => {
        expect(() => SecurityValidator.validateRequestBody('{"key": "value"}', 'application/json')).not.toThrow();
        expect(() => SecurityValidator.validateRequestBody({key: 'value'}, 'application/json')).not.toThrow();
      });

      it('should reject invalid JSON', () => {
        expect(() => SecurityValidator.validateRequestBody('{invalid json}', 'application/json')).toThrow('Invalid JSON in request body');
      });

      it('should reject oversized bodies', () => {
        const largeBody = 'x'.repeat(11 * 1024 * 1024); // 11MB
        expect(() => SecurityValidator.validateRequestBody(largeBody, 'text/plain')).toThrow('Request body is too large');
      });

      it('should accept empty bodies', () => {
        expect(() => SecurityValidator.validateRequestBody(null, 'application/json')).not.toThrow();
        expect(() => SecurityValidator.validateRequestBody('', 'application/json')).not.toThrow();
      });
    });
  });

  describe('CSRFProtection', () => {
    beforeEach(() => {
      CSRFProtection.tokens.clear();
    });

    it('should generate unique tokens', () => {
      const token1 = CSRFProtection.generateToken();
      const token2 = CSRFProtection.generateToken();
      
      expect(token1).toHaveLength(64); // 32 bytes in hex
      expect(token2).toHaveLength(64);
      expect(token1).not.toBe(token2);
    });

    it('should validate and consume tokens', () => {
      const token = CSRFProtection.generateToken();
      
      expect(CSRFProtection.validateToken(token)).toBe(true);
      expect(CSRFProtection.validateToken(token)).toBe(false); // Already consumed
    });

    it('should reject invalid tokens', () => {
      expect(CSRFProtection.validateToken('invalid-token')).toBe(false);
      expect(CSRFProtection.validateToken('')).toBe(false);
      expect(CSRFProtection.validateToken(null)).toBe(false);
    });

    it('should add token to request', () => {
      const request = { method: 'POST' };
      CSRFProtection.addToRequest(request);
      
      expect(request.headers).toBeDefined();
      expect(request.headers['X-CSRF-Token']).toBeDefined();
      expect(request.headers['X-CSRF-Token']).toHaveLength(64);
    });

    it('should clean up expired tokens', () => {
      // Mock expired token
      const expiredToken = {
        token: 'expired',
        expires: Date.now() - 1000
      };
      CSRFProtection.tokens.add(expiredToken);
      
      const newToken = CSRFProtection.generateToken();
      
      // Expired token should be removed
      expect([...CSRFProtection.tokens].some(t => t.token === 'expired')).toBe(false);
    });
  });

  describe('ContentSecurity', () => {
    describe('sanitizeHtml', () => {
      it('should escape HTML when DOMPurify is not available', () => {
        const html = '<script>alert("XSS")</script><p>Safe content</p>';
        const sanitized = ContentSecurity.sanitizeHtml(html);
        
        expect(sanitized).toContain('&lt;script&gt;');
        expect(sanitized).toContain('&lt;p&gt;');
      });
    });

    describe('createSafeIframe', () => {
      it('should create sandboxed iframe with escaped content', () => {
        const content = '<script>alert("XSS")</script>';
        const iframe = ContentSecurity.createSafeIframe(content);
        
        expect(iframe).toContain('sandbox="allow-same-origin"');
        expect(iframe).toContain('&lt;script&gt;');
        expect(iframe).not.toContain('<script>');
      });
    });

    describe('sanitizeFilename', () => {
      it('should sanitize dangerous filenames', () => {
        expect(ContentSecurity.sanitizeFilename('../../../etc/passwd')).toBe('etcpasswd');
        expect(ContentSecurity.sanitizeFilename('..\\windows\\system32\\config')).toBe('windowssystem32config');
        expect(ContentSecurity.sanitizeFilename('file<name>.txt')).toBe('file_name_.txt');
      });

      it('should handle hidden files', () => {
        expect(ContentSecurity.sanitizeFilename('.hidden')).toBe('_.hidden');
        expect(ContentSecurity.sanitizeFilename('..')).toBe('_._');
      });

      it('should limit filename length', () => {
        const longName = 'a'.repeat(300) + '.txt';
        const sanitized = ContentSecurity.sanitizeFilename(longName);
        expect(sanitized.length).toBe(255);
      });

      it('should handle edge cases', () => {
        expect(ContentSecurity.sanitizeFilename('')).toBe('download');
        expect(ContentSecurity.sanitizeFilename(null)).toBe('download');
        expect(ContentSecurity.sanitizeFilename('!!!***')).toBe('______');
      });
    });
  });

  describe('SecureStorage', () => {
    let mockContext;
    let secureStorage;

    beforeEach(() => {
      mockContext = {
        secureStorage: {
          set: jest.fn().mockResolvedValue(undefined),
          get: jest.fn().mockResolvedValue(null),
          remove: jest.fn().mockResolvedValue(undefined)
        }
      };
      secureStorage = new SecureStorage(mockContext);
    });

    it('should save credentials with prefixed key', async () => {
      await secureStorage.saveCredentials('test-id', { username: 'user', password: 'pass' });
      
      expect(mockContext.secureStorage.set).toHaveBeenCalledWith(
        'cred_test-id',
        { username: 'user', password: 'pass' }
      );
    });

    it('should retrieve credentials', async () => {
      mockContext.secureStorage.get.mockResolvedValue({ username: 'user' });
      
      const creds = await secureStorage.getCredentials('test-id');
      
      expect(mockContext.secureStorage.get).toHaveBeenCalledWith('cred_test-id');
      expect(creds).toEqual({ username: 'user' });
    });

    it('should remove credentials', async () => {
      await secureStorage.removeCredentials('test-id');
      
      expect(mockContext.secureStorage.remove).toHaveBeenCalledWith('cred_test-id');
    });

    it('should handle missing storage gracefully', async () => {
      const noStorageContext = { storage: {} };
      const storage = new SecureStorage(noStorageContext);
      
      await expect(storage.saveCredentials('id', {})).rejects.toThrow('Secure storage not available');
    });

    it('should validate inputs', async () => {
      await expect(secureStorage.saveCredentials(null, {})).rejects.toThrow('ID and credentials are required');
      await expect(secureStorage.saveCredentials('id', null)).rejects.toThrow('ID and credentials are required');
    });
  });
});

describe('Security Integration Tests', () => {
  it('should properly sanitize a complete request', () => {
    const url = 'https://api.example.com/users';
    const headers = {
      'Content-Type': 'application/json',
      'X-API-Key': 'secret123',
      'Cookie': 'session=abc', // Should be removed
      'Bad Header': 'value', // Should be removed (space in name)
      'Good-Header': 'value\r\ninjection' // Should be sanitized
    };
    const body = JSON.stringify({ name: 'Test User' });

    // Validate URL
    expect(() => SecurityValidator.validateUrl(url)).not.toThrow();

    // Sanitize headers
    const sanitizedHeaders = SecurityValidator.sanitizeHeaders(headers);
    expect(sanitizedHeaders['Content-Type']).toBe('application/json');
    expect(sanitizedHeaders['X-API-Key']).toBe('secret123');
    expect(sanitizedHeaders['Cookie']).toBeUndefined();
    expect(sanitizedHeaders['Bad Header']).toBeUndefined();
    expect(sanitizedHeaders['Good-Header']).toBe('valueinjection');

    // Validate body
    expect(() => SecurityValidator.validateRequestBody(body, 'application/json')).not.toThrow();
  });

  it('should handle XSS in response rendering', () => {
    const maliciousResponse = {
      data: '<img src=x onerror="alert(\'XSS\')">',
      headers: { 'content-type': 'text/html' }
    };

    // Should escape HTML
    const escaped = escapeHtml(maliciousResponse.data);
    expect(escaped).not.toContain('<img');
    expect(escaped).toContain('&lt;img');

    // Should create safe iframe
    const iframe = ContentSecurity.createSafeIframe(maliciousResponse.data);
    expect(iframe).toContain('sandbox=');
    expect(iframe).not.toContain('onerror="alert');
  });
});