# TASK-001: Critical Security Fixes

**Priority**: P0 - Critical  
**Estimated Time**: 4-6 hours  
**Assignee**: _________________  
**Status**: [ ] Not Started

## Overview
Address critical security vulnerabilities identified in the technical debt scan. These fixes are required before any production deployment.

## Issues to Fix

### 1. XSS Vulnerability in Response Rendering
**Location**: `src/components/ResponseViewer.js`, `index.js:736-762`

**Current Issue**:
```javascript
// Unsafe HTML rendering
responseContent.innerHTML = responseData;
```

**Required Fix**:
```javascript
// Create utility function
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Apply to all HTML rendering
responseContent.textContent = responseData; // For plain text
// OR
responseContent.innerHTML = DOMPurify.sanitize(responseData); // For HTML content
```

### 2. Input Validation for URLs and Headers
**Location**: `index.js:345-367`

**Required Implementation**:
```javascript
// Add to src/utils/security.js
export class SecurityValidator {
  static validateUrl(url) {
    // Prevent SSRF attacks
    const blockedHosts = ['localhost', '127.0.0.1', '0.0.0.0', '169.254.169.254'];
    const urlObj = new URL(url);
    
    if (blockedHosts.includes(urlObj.hostname)) {
      throw new Error('Requests to internal addresses are not allowed');
    }
    
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      throw new Error('Only HTTP/HTTPS protocols are allowed');
    }
  }
  
  static sanitizeHeaders(headers) {
    const dangerous = ['host', 'cookie', 'authorization', 'proxy-authorization'];
    const sanitized = {};
    
    for (const [key, value] of Object.entries(headers)) {
      if (!dangerous.includes(key.toLowerCase())) {
        // Validate header format
        if (!/^[\w-]+$/.test(key)) {
          console.warn(`Invalid header name: ${key}`);
          continue;
        }
        sanitized[key] = String(value).replace(/[\r\n]/g, '');
      }
    }
    
    return sanitized;
  }
}
```

### 3. Secure Credential Storage
**Location**: `src/components/EnvironmentManager.js`

**Required Changes**:
- Never store credentials in plain text
- Use Alexandria's secure storage API
- Implement credential masking in UI

```javascript
// Update credential handling
async saveCredentials(id, credentials) {
  // Use secure storage instead of regular storage
  const encrypted = await this.context.secureStorage.set(
    `cred_${id}`, 
    credentials
  );
  
  // Don't include in regular state
  delete this.environments[id].credentials;
}
```

### 4. CSRF Protection
**Location**: Throughout request handling

**Required Implementation**:
```javascript
// Add CSRF token generation
class CSRFProtection {
  static generateToken() {
    return crypto.randomUUID();
  }
  
  static validateToken(token) {
    return this.tokens.has(token);
  }
  
  static addToRequest(request) {
    const token = this.generateToken();
    request.headers['X-CSRF-Token'] = token;
    return request;
  }
}
```

## Testing Requirements

1. **Security Tests**:
```javascript
describe('Security Validations', () => {
  test('should prevent XSS in response rendering', () => {
    const maliciousResponse = '<script>alert("XSS")</script>';
    const sanitized = escapeHtml(maliciousResponse);
    expect(sanitized).not.toContain('<script>');
  });
  
  test('should block internal URLs', () => {
    expect(() => SecurityValidator.validateUrl('http://localhost/api'))
      .toThrow('internal addresses');
  });
  
  test('should sanitize dangerous headers', () => {
    const headers = {
      'Content-Type': 'application/json',
      'Cookie': 'session=abc123',
      'X-Custom': 'safe'
    };
    
    const sanitized = SecurityValidator.sanitizeHeaders(headers);
    expect(sanitized).not.toHaveProperty('Cookie');
    expect(sanitized).toHaveProperty('X-Custom');
  });
});
```

## Acceptance Criteria

- [ ] All XSS vulnerabilities patched
- [ ] URL validation prevents SSRF attacks
- [ ] Headers are properly sanitized
- [ ] Credentials use secure storage
- [ ] Security tests pass
- [ ] No regression in functionality

## Dependencies
- DOMPurify library for HTML sanitization
- Alexandria's secure storage API

## Notes
- These are blocking issues for production deployment
- Coordinate with security team for review
- Update security documentation after fixes