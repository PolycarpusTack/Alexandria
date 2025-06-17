import { describe, it, expect, beforeEach } from '@jest/globals';
import { CodeGenerator } from '../src/components/CodeGenerator.js';

describe('CodeGenerator', () => {
  let codeGenerator;
  let mockPlugin;

  beforeEach(() => {
    mockPlugin = {};
    codeGenerator = new CodeGenerator(mockPlugin);
  });

  describe('JavaScript Generation', () => {
    it('should generate fetch code for GET request', () => {
      const request = {
        method: 'GET',
        url: 'https://api.example.com/users',
        headers: { 'Authorization': 'Bearer token123' }
      };
      
      const code = codeGenerator.generate(request, 'javascript');
      
      expect(code).toContain("fetch('https://api.example.com/users'");
      expect(code).toContain("method: 'GET'");
      expect(code).toContain('"Authorization": "Bearer token123"');
      expect(code).toContain('.then(response => response.json())');
    });

    it('should generate fetch code for POST request with body', () => {
      const request = {
        method: 'POST',
        url: 'https://api.example.com/users',
        headers: { 'Content-Type': 'application/json' },
        body: { name: 'John Doe', email: 'john@example.com' }
      };      
      const code = codeGenerator.generate(request, 'javascript');
      
      expect(code).toContain('body: JSON.stringify(');
      expect(code).toContain('"name": "John Doe"');
      expect(code).toContain('"email": "john@example.com"');
    });
  });

  describe('Python Generation', () => {
    it('should generate requests code for GET request', () => {
      const request = {
        method: 'GET',
        url: 'https://api.example.com/users',
        headers: { 'Authorization': 'Bearer token123' }
      };
      
      const code = codeGenerator.generate(request, 'python');
      
      expect(code).toContain('import requests');
      expect(code).toContain('url = "https://api.example.com/users"');
      expect(code).toContain("'Authorization': 'Bearer token123'");
      expect(code).toContain('requests.get(url, headers=headers)');
    });

    it('should generate requests code for POST with body', () => {
      const request = {
        method: 'POST',
        url: 'https://api.example.com/users',
        headers: { 'Content-Type': 'application/json' },
        body: { name: 'John Doe' }
      };
      
      const code = codeGenerator.generate(request, 'python');
      
      expect(code).toContain("data = {'name': 'John Doe'}");
      expect(code).toContain('requests.post(url, headers=headers, json=data)');
    });
  });
  describe('cURL Generation', () => {
    it('should generate cURL command for simple GET', () => {
      const request = {
        method: 'GET',
        url: 'https://api.example.com/users'
      };
      
      const code = codeGenerator.generate(request, 'curl');
      
      expect(code).toBe("curl -X GET 'https://api.example.com/users'");
    });

    it('should generate cURL with headers and body', () => {
      const request = {
        method: 'POST',
        url: 'https://api.example.com/users',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer token123'
        },
        body: { name: 'John Doe' }
      };
      
      const code = codeGenerator.generate(request, 'curl');
      
      expect(code).toContain("curl -X POST 'https://api.example.com/users'");
      expect(code).toContain("-H 'Content-Type: application/json'");
      expect(code).toContain("-H 'Authorization: Bearer token123'");
      expect(code).toContain('-d \'{"name":"John Doe"}\'');
    });
  });

  describe('Unsupported Languages', () => {
    it('should return error message for unsupported language', () => {
      const request = { method: 'GET', url: 'https://api.example.com' };
      const code = codeGenerator.generate(request, 'unsupported');
      
      expect(code).toBe('Language not supported');
    });
  });
});