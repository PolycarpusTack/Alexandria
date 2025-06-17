import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import ApicarusPlugin from '../index.js';

// Mock Alexandria SDK
global.Alexandria = {
  plugins: {
    get: () => mockPlugin
  },
  ui: {
    showNotification: jest.fn(),
    showDialog: jest.fn(),
    registerPanel: jest.fn(),
    registerCommand: jest.fn()
  }
};

let mockPlugin;

describe('Security Integration Tests', () => {
  beforeEach(() => {
    // Create fresh plugin instance
    mockPlugin = new ApicarusPlugin();
    mockPlugin.ui = global.Alexandria.ui;
    mockPlugin.storage = {
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn()
    };
    mockPlugin.logger = {
      info: jest.fn(),
      error: jest.fn()
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('URL Validation in sendRequest', () => {
    beforeEach(() => {
      // Mock DOM elements
      document.body.innerHTML = `
        <div id="apicarus-method">
          <option value="GET" selected>GET</option>
        </div>
        <input id="apicarus-url" value="" />
        <div id="apicarus-responseContent"></div>
        <div id="apicarus-params-list"></div>
        <div id="apicarus-headers-list"></div>
      `;
    });

    it('should reject requests to localhost', async () => {
      document.getElementById('apicarus-url').value = 'http://localhost/api';
      
      await mockPlugin.sendRequest();
      
      expect(mockPlugin.ui.showNotification).toHaveBeenCalledWith({
        type: 'error',
        title: 'Invalid URL',
        message: expect.stringContaining('localhost'),
        duration: 5000
      });
    });

    it('should reject requests to private IPs', async () => {
      document.getElementById('apicarus-url').value = 'http://192.168.1.1/api';
      
      await mockPlugin.sendRequest();
      
      expect(mockPlugin.ui.showNotification).toHaveBeenCalledWith({
        type: 'error',
        title: 'Invalid URL',
        message: expect.stringContaining('private IP'),
        duration: 5000
      });
    });

    it('should reject non-HTTP protocols', async () => {
      document.getElementById('apicarus-url').value = 'file:///etc/passwd';
      
      await mockPlugin.sendRequest();
      
      expect(mockPlugin.ui.showNotification).toHaveBeenCalledWith({
        type: 'error',
        title: 'Invalid URL',
        message: expect.stringContaining('Protocol'),
        duration: 5000
      });
    });

    it('should allow valid external URLs', async () => {
      document.getElementById('apicarus-url').value = 'https://api.example.com/users';
      
      // Mock fetch to prevent actual network request
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'application/json']]),
        json: () => Promise.resolve({ success: true })
      });
      
      await mockPlugin.sendRequest();
      
      // Should not show error notification
      expect(mockPlugin.ui.showNotification).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error', title: 'Invalid URL' })
      );
    });
  });

  describe('Header Sanitization', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <div id="apicarus-headers-list">
          <div class="kv-row">
            <input name="key" value="Content-Type" />
            <input name="value" value="application/json" />
          </div>
          <div class="kv-row">
            <input name="key" value="Cookie" />
            <input name="value" value="session=abc123" />
          </div>
          <div class="kv-row">
            <input name="key" value="X-Custom" />
            <input name="value" value="value\r\nInjection: test" />
          </div>
        </div>
      `;
    });

    it('should sanitize headers before sending request', () => {
      const headers = mockPlugin.getHeaders();
      
      expect(headers['Content-Type']).toBe('application/json');
      expect(headers['Cookie']).toBeUndefined(); // Dangerous header removed
      expect(headers['X-Custom']).toBe('valueInjection: test'); // CRLF removed
    });
  });

  describe('CSRF Protection', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <select id="apicarus-method">
          <option value="POST" selected>POST</option>
        </select>
        <input id="apicarus-url" value="https://api.example.com/users" />
        <div id="apicarus-responseContent"></div>
        <div id="apicarus-params-list"></div>
        <div id="apicarus-headers-list"></div>
        <textarea id="apicarus-body-content">{"name": "test"}</textarea>
      `;

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 201,
        statusText: 'Created',
        headers: new Map([['content-type', 'application/json']]),
        json: () => Promise.resolve({ id: 1, name: 'test' })
      });
    });

    it('should add CSRF token to state-changing requests', async () => {
      await mockPlugin.sendRequest();
      
      const fetchCall = global.fetch.mock.calls[0];
      const options = fetchCall[1];
      
      expect(options.headers['X-CSRF-Token']).toBeDefined();
      expect(options.headers['X-CSRF-Token']).toHaveLength(64);
    });

    it('should not add CSRF token to GET requests', async () => {
      document.getElementById('apicarus-method').value = 'GET';
      
      await mockPlugin.sendRequest();
      
      const fetchCall = global.fetch.mock.calls[0];
      const options = fetchCall[1];
      
      expect(options.headers['X-CSRF-Token']).toBeUndefined();
    });
  });

  describe('Request Body Validation', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <select id="apicarus-method">
          <option value="POST" selected>POST</option>
        </select>
        <input id="apicarus-url" value="https://api.example.com/users" />
        <div id="apicarus-responseContent"></div>
        <div id="apicarus-params-list"></div>
        <div id="apicarus-headers-list">
          <div class="kv-row">
            <input name="key" value="Content-Type" />
            <input name="value" value="application/json" />
          </div>
        </div>
        <textarea id="apicarus-body-content"></textarea>
      `;
    });

    it('should validate JSON body', async () => {
      document.getElementById('apicarus-body-content').value = '{invalid json}';
      
      await mockPlugin.sendRequest();
      
      expect(mockPlugin.ui.showNotification).toHaveBeenCalledWith({
        type: 'error',
        title: 'Invalid Request Body',
        message: expect.stringContaining('Invalid JSON')
      });
    });

    it('should reject oversized bodies', async () => {
      // Create 11MB string
      const largeBody = JSON.stringify({ data: 'x'.repeat(11 * 1024 * 1024) });
      document.getElementById('apicarus-body-content').value = largeBody;
      
      await mockPlugin.sendRequest();
      
      expect(mockPlugin.ui.showNotification).toHaveBeenCalledWith({
        type: 'error',
        title: 'Invalid Request Body',
        message: expect.stringContaining('too large')
      });
    });
  });

  describe('Environment Manager Security', () => {
    beforeEach(async () => {
      await mockPlugin.onActivate({
        ui: global.Alexandria.ui,
        dataService: mockPlugin.storage,
        logger: mockPlugin.logger,
        secureStorage: {
          set: jest.fn(),
          get: jest.fn(),
          remove: jest.fn()
        }
      });
    });

    it('should detect and secure sensitive variables', async () => {
      const envManager = mockPlugin.environmentManager;
      const env = envManager.create('Test Environment');
      
      // Set a sensitive variable
      await envManager.setVariable(env.id, 'API_TOKEN', 'secret123');
      
      // Check that it's stored securely
      expect(env.variables.API_TOKEN).toMatch(/^__secure__/);
      expect(mockPlugin.context.secureStorage.set).toHaveBeenCalledWith(
        expect.stringContaining('API_TOKEN'),
        { value: 'secret123' }
      );
    });

    it('should detect various sensitive patterns', () => {
      const envManager = mockPlugin.environmentManager;
      
      expect(envManager.isSensitiveVariable('password')).toBe(true);
      expect(envManager.isSensitiveVariable('user_password')).toBe(true);
      expect(envManager.isSensitiveVariable('api_secret')).toBe(true);
      expect(envManager.isSensitiveVariable('auth_token')).toBe(true);
      expect(envManager.isSensitiveVariable('private_key')).toBe(true);
      expect(envManager.isSensitiveVariable('username')).toBe(false);
      expect(envManager.isSensitiveVariable('endpoint')).toBe(false);
    });

    it('should interpolate secure variables', async () => {
      const envManager = mockPlugin.environmentManager;
      const env = envManager.create('Test Environment');
      
      // Mock secure storage retrieval
      mockPlugin.context.secureStorage.get.mockResolvedValue({ value: 'secret123' });
      
      // Set secure variable
      env.variables.API_KEY = '__secure__env_123_API_KEY';
      envManager.activeEnvironment = env.id;
      
      // Test interpolation
      const result = await envManager.interpolateVariables('Bearer {{API_KEY}}');
      expect(result).toBe('Bearer secret123');
    });
  });

  describe('Response Viewer XSS Protection', () => {
    beforeEach(async () => {
      await mockPlugin.onActivate({
        ui: global.Alexandria.ui,
        dataService: mockPlugin.storage,
        logger: mockPlugin.logger
      });
      
      document.body.innerHTML = `
        <div id="apicarus-responseContent"></div>
        <div id="apicarus-responseStats"></div>
      `;
    });

    it('should escape HTML in JSON responses', () => {
      const maliciousData = {
        message: '<script>alert("XSS")</script>',
        html: '<img src=x onerror="alert(1)">'
      };
      
      mockPlugin.responseViewer.display({
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        data: maliciousData,
        size: 100
      }, 100);
      
      const content = document.getElementById('apicarus-responseContent').innerHTML;
      expect(content).not.toContain('<script>');
      expect(content).not.toContain('<img src=x');
      expect(content).toContain('&lt;script&gt;');
      expect(content).toContain('&lt;img');
    });

    it('should sandbox HTML responses', () => {
      const htmlResponse = '<h1>Title</h1><script>alert("XSS")</script>';
      
      mockPlugin.responseViewer.display({
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'text/html' },
        data: htmlResponse,
        size: 100
      }, 100);
      
      const content = document.getElementById('apicarus-responseContent').innerHTML;
      expect(content).toContain('sandbox="allow-same-origin"');
      expect(content).toContain('&lt;script&gt;');
      expect(content).not.toContain('alert("XSS")');
    });

    it('should escape HTML in text responses', () => {
      const textResponse = 'Hello <script>alert("XSS")</script> World';
      
      mockPlugin.responseViewer.display({
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'text/plain' },
        data: textResponse,
        size: 100
      }, 100);
      
      const content = document.getElementById('apicarus-responseContent').innerHTML;
      expect(content).toContain('&lt;script&gt;');
      expect(content).not.toContain('<script>');
    });
  });

  describe('Authentication Security', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <select id="apicarus-method">
          <option value="GET" selected>GET</option>
        </select>
        <input id="apicarus-url" value="https://api.example.com/users" />
        <select id="apicarus-auth-type">
          <option value="bearer" selected>Bearer</option>
        </select>
        <input id="apicarus-bearer-token" value="my-secret-token" />
        <div id="apicarus-responseContent"></div>
        <div id="apicarus-params-list"></div>
        <div id="apicarus-headers-list"></div>
      `;

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'application/json']]),
        json: () => Promise.resolve({ success: true })
      });
    });

    it('should not expose auth tokens in dangerous headers', async () => {
      // Add authorization header manually (should be filtered)
      document.getElementById('apicarus-headers-list').innerHTML = `
        <div class="kv-row">
          <input name="key" value="Authorization" />
          <input name="value" value="Bearer manual-token" />
        </div>
      `;
      
      await mockPlugin.sendRequest();
      
      const fetchCall = global.fetch.mock.calls[0];
      const options = fetchCall[1];
      
      // Manual auth header should be filtered, only auth from UI should be present
      expect(options.headers['Authorization']).toBe('Bearer my-secret-token');
    });
  });
});