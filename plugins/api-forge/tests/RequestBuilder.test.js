import { describe, it, expect, beforeEach } from '@jest/globals';
import { RequestBuilder } from '../src/components/RequestBuilder.js';
import { AuthTypes } from '../src/constants.js';

describe('RequestBuilder', () => {
  let requestBuilder;
  let mockPlugin;

  beforeEach(() => {
    mockPlugin = {};
    requestBuilder = new RequestBuilder(mockPlugin);
  });

  describe('Request Construction', () => {
    it('should initialize with default values', () => {
      const request = requestBuilder.build();
      
      expect(request).toEqual({
        method: 'GET',
        url: '',
        headers: {},
        params: {},
        body: null,
        auth: { type: AuthTypes.NONE }
      });
    });

    it('should set method correctly', () => {
      requestBuilder.setMethod('POST');
      const request = requestBuilder.build();
      
      expect(request.method).toBe('POST');
    });

    it('should parse URL parameters', () => {
      requestBuilder.setUrl('https://api.example.com/users?page=1&limit=10');
      const request = requestBuilder.build();
      
      expect(request.url).toBe('https://api.example.com/users?page=1&limit=10');
      expect(request.params).toEqual({ page: '1', limit: '10' });
    });
  });
  describe('Headers Management', () => {
    it('should add headers', () => {
      requestBuilder.addHeader('Content-Type', 'application/json');
      requestBuilder.addHeader('Authorization', 'Bearer token');
      const request = requestBuilder.build();
      
      expect(request.headers).toEqual({
        'Content-Type': 'application/json',
        'Authorization': 'Bearer token'
      });
    });

    it('should remove headers', () => {
      requestBuilder.addHeader('Content-Type', 'application/json');
      requestBuilder.addHeader('Authorization', 'Bearer token');
      requestBuilder.removeHeader('Content-Type');
      const request = requestBuilder.build();
      
      expect(request.headers).toEqual({
        'Authorization': 'Bearer token'
      });
    });

    it('should not add empty headers', () => {
      requestBuilder.addHeader('', 'value');
      requestBuilder.addHeader('key', '');
      const request = requestBuilder.build();
      
      expect(request.headers).toEqual({});
    });
  });
  describe('Authentication', () => {
    it('should set Bearer token authentication', () => {
      requestBuilder.setAuth(AuthTypes.BEARER, { token: 'abc123' });
      const request = requestBuilder.build();
      
      expect(request.auth.type).toBe(AuthTypes.BEARER);
      expect(request.headers.Authorization).toBe('Bearer abc123');
    });

    it('should set Basic authentication', () => {
      requestBuilder.setAuth(AuthTypes.BASIC, {
        username: 'user',
        password: 'pass'
      });
      const request = requestBuilder.build();
      
      expect(request.auth.type).toBe(AuthTypes.BASIC);
      expect(request.headers.Authorization).toBe('Basic dXNlcjpwYXNz');
    });

    it('should set API key in header', () => {
      requestBuilder.setAuth(AuthTypes.API_KEY, {
        addTo: 'header',
        key: 'X-API-Key',
        value: 'secret123'
      });
      const request = requestBuilder.build();
      
      expect(request.auth.type).toBe(AuthTypes.API_KEY);
      expect(request.headers['X-API-Key']).toBe('secret123');
    });
  });

  describe('Body Management', () => {
    it('should set body with content type', () => {
      const body = { name: 'Test', value: 123 };
      requestBuilder.setBody(body, 'application/json');
      const request = requestBuilder.build();
      
      expect(request.body).toEqual(body);
      expect(request.headers['Content-Type']).toBe('application/json');
    });
  });
});