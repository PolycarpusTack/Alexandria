# TASK-006: Comprehensive Test Coverage

**Priority**: P1 - High  
**Estimated Time**: 16-20 hours  
**Assignee**: _________________  
**Status**: [ ] Not Started

## Overview
Increase test coverage to 80%+ by adding unit, integration, and E2E tests. Currently only 3 test files exist for 7+ components.

## Current State
- **Current Coverage**: ~25% (estimated)
- **Test Files**: 3 (AIAssistant.test.js, CodeGenerator.test.js, RequestBuilder.test.js)
- **Missing Tests**: ResponseViewer, CollectionManager, EnvironmentManager, SharedRepository, main plugin

## Test Plan

### 1. Unit Tests - Components

#### ResponseViewer Tests
**File**: `tests/ResponseViewer.test.js`

```javascript
import { ResponseViewer } from '../src/components/ResponseViewer';

describe('ResponseViewer', () => {
  let viewer;
  let mockPlugin;

  beforeEach(() => {
    mockPlugin = {
      ui: {
        showNotification: jest.fn()
      }
    };
    viewer = new ResponseViewer(mockPlugin);
  });

  describe('display()', () => {
    test('should render JSON response', () => {
      const response = {
        status: 200,
        headers: { 'content-type': 'application/json' },
        data: { message: 'Success' },
        size: 1024
      };
      
      viewer.display(response, 150);
      const element = document.getElementById('apicarus-responseContent');
      
      expect(element.innerHTML).toContain('200');
      expect(element.innerHTML).toContain('Success');
      expect(element.innerHTML).toContain('150ms');
    });

    test('should render HTML response safely', () => {
      const response = {
        status: 200,
        headers: { 'content-type': 'text/html' },
        data: '<script>alert("XSS")</script><p>Safe content</p>'
      };
      
      viewer.display(response, 100);
      const element = document.getElementById('apicarus-responseContent');
      
      expect(element.innerHTML).not.toContain('<script>');
      expect(element.innerHTML).toContain('Safe content');
    });

    test('should handle error responses', () => {
      const response = {
        status: 404,
        statusText: 'Not Found',
        data: { error: 'Resource not found' }
      };
      
      viewer.display(response, 50);
      const element = document.getElementById('apicarus-responseContent');
      
      expect(element.innerHTML).toContain('404');
      expect(element.innerHTML).toContain('Not Found');
      expect(element.innerHTML).toContain('error');
    });

    test('should format large responses', () => {
      const largeData = Array(1000).fill({ id: 1, name: 'Test' });
      const response = {
        status: 200,
        data: largeData,
        size: 50000
      };
      
      viewer.display(response, 200);
      const element = document.getElementById('apicarus-responseContent');
      
      expect(element.innerHTML).toContain('48.8 KB'); // Size formatting
    });
  });

  describe('Tab Switching', () => {
    test('should switch between response tabs', () => {
      viewer.switchResponseTab('headers');
      expect(viewer.activeTab).toBe('headers');
      
      viewer.switchResponseTab('raw');
      expect(viewer.activeTab).toBe('raw');
    });

    test('should render headers tab correctly', () => {
      const response = {
        headers: {
          'content-type': 'application/json',
          'x-rate-limit': '100'
        }
      };
      
      const html = viewer.renderHeaders(response.headers);
      expect(html).toContain('content-type');
      expect(html).toContain('application/json');
      expect(html).toContain('x-rate-limit');
    });
  });

  describe('Download functionality', () => {
    test('should trigger download', () => {
      const response = {
        data: { test: 'data' }
      };
      
      // Mock createElement and click
      const mockAnchor = {
        click: jest.fn(),
        setAttribute: jest.fn()
      };
      jest.spyOn(document, 'createElement').mockReturnValue(mockAnchor);
      
      viewer.downloadResponse(response);
      
      expect(mockAnchor.click).toHaveBeenCalled();
      expect(mockAnchor.download).toMatch(/response.*\.json/);
    });
  });
});
```

#### CollectionManager Tests
**File**: `tests/CollectionManager.test.js`

```javascript
import { CollectionManager } from '../src/components/CollectionManager';

describe('CollectionManager', () => {
  let manager;
  let mockPlugin;
  let mockStorage;

  beforeEach(() => {
    mockStorage = {
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn()
    };
    
    mockPlugin = {
      storage: mockStorage,
      ui: {
        showNotification: jest.fn(),
        showDialog: jest.fn()
      }
    };
    
    manager = new CollectionManager(mockPlugin);
  });

  describe('CRUD Operations', () => {
    test('should create a new collection', async () => {
      const collection = {
        name: 'Test Collection',
        description: 'Test'
      };
      
      const created = await manager.create(collection);
      
      expect(created).toHaveProperty('id');
      expect(created.name).toBe('Test Collection');
      expect(created.createdAt).toBeDefined();
      expect(mockStorage.set).toHaveBeenCalled();
    });

    test('should update existing collection', async () => {
      const collection = { id: '123', name: 'Old Name' };
      manager.collections.set('123', collection);
      
      await manager.update('123', { name: 'New Name' });
      
      expect(manager.collections.get('123').name).toBe('New Name');
      expect(mockStorage.set).toHaveBeenCalled();
    });

    test('should delete collection', async () => {
      manager.collections.set('123', { id: '123' });
      
      await manager.delete('123');
      
      expect(manager.collections.has('123')).toBe(false);
      expect(mockStorage.set).toHaveBeenCalled();
    });

    test('should handle delete of non-existent collection', async () => {
      await expect(manager.delete('999')).rejects.toThrow();
    });
  });

  describe('Import/Export', () => {
    test('should export collection', async () => {
      const collection = {
        id: '123',
        name: 'Export Test',
        requests: [
          { method: 'GET', url: 'http://api.test' }
        ]
      };
      manager.collections.set('123', collection);
      
      const exported = await manager.exportCollection('123');
      
      expect(exported).toHaveProperty('version');
      expect(exported).toHaveProperty('collection');
      expect(exported.collection.name).toBe('Export Test');
    });

    test('should import collection', async () => {
      const importData = {
        version: '1.0',
        collection: {
          name: 'Imported',
          requests: []
        }
      };
      
      await manager.importCollection(JSON.stringify(importData));
      
      const imported = Array.from(manager.collections.values())
        .find(c => c.name === 'Imported');
      
      expect(imported).toBeDefined();
      expect(imported.imported).toBe(true);
    });

    test('should validate import format', async () => {
      const invalidData = { invalid: 'format' };
      
      await expect(
        manager.importCollection(JSON.stringify(invalidData))
      ).rejects.toThrow('Invalid collection format');
    });
  });

  describe('Request Management', () => {
    test('should add request to collection', async () => {
      manager.collections.set('123', {
        id: '123',
        requests: []
      });
      
      const request = {
        method: 'POST',
        url: 'http://api.test/users'
      };
      
      await manager.addRequest('123', request);
      
      const collection = manager.collections.get('123');
      expect(collection.requests).toHaveLength(1);
      expect(collection.requests[0]).toMatchObject(request);
    });

    test('should remove request from collection', async () => {
      manager.collections.set('123', {
        id: '123',
        requests: [
          { id: 'req1', method: 'GET' },
          { id: 'req2', method: 'POST' }
        ]
      });
      
      await manager.removeRequest('123', 'req1');
      
      const collection = manager.collections.get('123');
      expect(collection.requests).toHaveLength(1);
      expect(collection.requests[0].id).toBe('req2');
    });
  });
});
```

#### EnvironmentManager Tests
**File**: `tests/EnvironmentManager.test.js`

```javascript
import { EnvironmentManager } from '../src/components/EnvironmentManager';

describe('EnvironmentManager', () => {
  let manager;
  let mockPlugin;

  beforeEach(() => {
    mockPlugin = {
      storage: {
        get: jest.fn(),
        set: jest.fn()
      },
      environments: []
    };
    
    manager = new EnvironmentManager(mockPlugin);
  });

  describe('Environment CRUD', () => {
    test('should create environment', async () => {
      const env = await manager.createEnvironment({
        name: 'Production',
        variables: {
          baseUrl: 'https://api.prod.com',
          apiKey: 'prod-key'
        }
      });
      
      expect(env).toHaveProperty('id');
      expect(env.name).toBe('Production');
      expect(env.variables.baseUrl).toBe('https://api.prod.com');
    });

    test('should update environment variables', async () => {
      const env = { id: 'env1', variables: { foo: 'bar' } };
      mockPlugin.environments = [env];
      
      await manager.updateVariables('env1', {
        foo: 'updated',
        new: 'value'
      });
      
      expect(env.variables.foo).toBe('updated');
      expect(env.variables.new).toBe('value');
    });

    test('should activate environment', async () => {
      const env = { id: 'env1', name: 'Test' };
      mockPlugin.environments = [env];
      
      await manager.activateEnvironment('env1');
      
      expect(mockPlugin.activeEnvironment).toBe('env1');
    });
  });

  describe('Variable Substitution', () => {
    test('should substitute simple variables', () => {
      manager.activeVariables = {
        baseUrl: 'http://localhost:3000',
        token: 'abc123'
      };
      
      const result = manager.substituteVariables(
        '{{baseUrl}}/api/auth'
      );
      
      expect(result).toBe('http://localhost:3000/api/auth');
    });

    test('should handle nested variables', () => {
      manager.activeVariables = {
        env: 'prod',
        'prod.url': 'https://api.prod.com'
      };
      
      const result = manager.substituteVariables(
        '{{{{env}}.url}}/endpoint'
      );
      
      expect(result).toBe('https://api.prod.com/endpoint');
    });

    test('should handle missing variables', () => {
      manager.activeVariables = {};
      
      const result = manager.substituteVariables(
        '{{missing}}/api'
      );
      
      expect(result).toBe('{{missing}}/api');
    });

    test('should substitute in objects', () => {
      manager.activeVariables = {
        apiKey: 'secret123'
      };
      
      const obj = {
        headers: {
          'Authorization': 'Bearer {{apiKey}}',
          'Content-Type': 'application/json'
        }
      };
      
      const result = manager.substituteInObject(obj);
      
      expect(result.headers.Authorization).toBe('Bearer secret123');
    });
  });

  describe('Import/Export', () => {
    test('should export environment', () => {
      const env = {
        id: 'env1',
        name: 'Staging',
        variables: { url: 'staging.com' }
      };
      
      const exported = manager.exportEnvironment(env);
      
      expect(exported).toContain('Staging');
      expect(exported).toContain('staging.com');
    });

    test('should import environment file', async () => {
      const envFile = `
        # Production Environment
        BASE_URL=https://api.prod.com
        API_KEY=prod-key-123
        DEBUG=false
      `;
      
      const imported = await manager.importEnvironmentFile(envFile);
      
      expect(imported.variables.BASE_URL).toBe('https://api.prod.com');
      expect(imported.variables.API_KEY).toBe('prod-key-123');
      expect(imported.variables.DEBUG).toBe('false');
    });
  });
});
```

### 2. Integration Tests

**File**: `tests/integration/plugin-lifecycle.test.js`

```javascript
import { ApicarusPlugin } from '../../index';
import { mockAlexandriaContext } from '../mocks/alexandria';

describe('Plugin Lifecycle Integration', () => {
  let plugin;
  let context;

  beforeEach(() => {
    context = mockAlexandriaContext();
    plugin = new ApicarusPlugin();
  });

  test('should complete full activation cycle', async () => {
    await plugin.onActivate(context);
    
    expect(plugin.isReady).toBe(true);
    expect(plugin.requestBuilder).toBeDefined();
    expect(plugin.responseViewer).toBeDefined();
    expect(plugin.collectionManager).toBeDefined();
    expect(context.ui.registerPanel).toHaveBeenCalledTimes(3);
    expect(context.ui.registerCommand).toHaveBeenCalledTimes(6);
  });

  test('should handle activation errors gracefully', async () => {
    context.storage.get.mockRejectedValue(new Error('Storage error'));
    
    await plugin.onActivate(context);
    
    expect(plugin.isReady).toBe(true); // Should still activate
    expect(context.logger.error).toHaveBeenCalled();
  });

  test('should clean up on deactivation', async () => {
    await plugin.onActivate(context);
    await plugin.onDeactivate();
    
    expect(plugin.isReady).toBe(false);
    expect(context.storage.set).toHaveBeenCalled(); // Save state
  });

  test('should persist and restore state', async () => {
    // First activation
    await plugin.onActivate(context);
    plugin.collections = [{ id: '1', name: 'Test' }];
    await plugin.onDeactivate();
    
    // Second activation
    const newPlugin = new ApicarusPlugin();
    context.storage.get.mockResolvedValue({
      collections: [{ id: '1', name: 'Test' }]
    });
    
    await newPlugin.onActivate(context);
    
    expect(newPlugin.collections).toEqual([{ id: '1', name: 'Test' }]);
  });
});
```

**File**: `tests/integration/request-flow.test.js`

```javascript
describe('Request Flow Integration', () => {
  let plugin;
  
  beforeEach(async () => {
    plugin = new ApicarusPlugin();
    await plugin.onActivate(mockContext());
    
    // Mock fetch
    global.fetch = jest.fn();
  });

  test('should execute complete request flow', async () => {
    // Setup
    fetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ success: true })
    });
    
    // Build request
    plugin.currentRequest = {
      method: 'POST',
      url: 'https://api.test/users',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test User' })
    };
    
    // Execute
    await plugin.sendRequest();
    
    // Verify
    expect(fetch).toHaveBeenCalledWith(
      'https://api.test/users',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json'
        })
      })
    );
    
    expect(plugin.history).toHaveLength(1);
    expect(plugin.history[0]).toMatchObject({
      method: 'POST',
      url: 'https://api.test/users',
      status: 200
    });
  });

  test('should handle request with environment variables', async () => {
    // Setup environment
    plugin.environments = [{
      id: 'prod',
      variables: {
        baseUrl: 'https://api.prod.com',
        apiKey: 'secret123'
      }
    }];
    plugin.activeEnvironment = 'prod';
    
    // Request with variables
    plugin.currentRequest = {
      method: 'GET',
      url: '{{baseUrl}}/users',
      headers: {
        'X-API-Key': '{{apiKey}}'
      }
    };
    
    fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => []
    });
    
    await plugin.sendRequest();
    
    expect(fetch).toHaveBeenCalledWith(
      'https://api.prod.com/users',
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-API-Key': 'secret123'
        })
      })
    );
  });

  test('should cache GET requests', async () => {
    fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ cached: false })
    });
    
    // First request
    plugin.currentRequest = {
      method: 'GET',
      url: 'https://api.test/data'
    };
    
    await plugin.sendRequest();
    expect(fetch).toHaveBeenCalledTimes(1);
    
    // Second request (should use cache)
    await plugin.sendRequest();
    expect(fetch).toHaveBeenCalledTimes(1); // Still 1
    
    // Verify cache notification
    expect(plugin.ui.showNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Cached Response'
      })
    );
  });
});
```

### 3. E2E Tests

**File**: `tests/e2e/user-workflows.test.js`

```javascript
import { test, expect } from '@playwright/test';

test.describe('Apicarus E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.click('[data-plugin="apicarus"]');
  });

  test('Create and send a simple GET request', async ({ page }) => {
    // Enter URL
    await page.fill('#apicarus-url', 'https://jsonplaceholder.typicode.com/posts/1');
    
    // Send request
    await page.click('button:has-text("Send")');
    
    // Wait for response
    await page.waitForSelector('.response-json');
    
    // Verify response
    const responseText = await page.textContent('.response-json');
    expect(responseText).toContain('"userId": 1');
    expect(responseText).toContain('"id": 1');
  });

  test('Create collection and save request', async ({ page }) => {
    // Make a request first
    await page.fill('#apicarus-url', 'https://api.test/users');
    await page.click('button:has-text("Send")');
    
    // Save to collection
    await page.click('button:has-text("Save")');
    await page.fill('input[placeholder="Request name"]', 'Get Users');
    await page.fill('input[placeholder="Collection name"]', 'User API');
    await page.click('button:has-text("Create & Save")');
    
    // Verify collection appears
    await page.waitForSelector('.collection-item:has-text("User API")');
    
    // Click collection
    await page.click('.collection-item:has-text("User API")');
    
    // Verify request is loaded
    const urlValue = await page.inputValue('#apicarus-url');
    expect(urlValue).toBe('https://api.test/users');
  });

  test('Use environment variables', async ({ page }) => {
    // Open environments
    await page.click('button[title="Environments"]');
    
    // Create environment
    await page.click('button:has-text("New Environment")');
    await page.fill('input[name="name"]', 'Production');
    await page.fill('textarea', JSON.stringify({
      baseUrl: 'https://api.prod.com',
      apiKey: 'prod-key-123'
    }));
    await page.click('button:has-text("Save")');
    
    // Use variable in request
    await page.fill('#apicarus-url', '{{baseUrl}}/users');
    
    // Add header with variable
    await page.click('.tab-button:has-text("Headers")');
    await page.click('button:has-text("Add Header")');
    await page.fill('input[name="key"]', 'X-API-Key');
    await page.fill('input[name="value"]', '{{apiKey}}');
    
    // Send and verify substitution
    await page.click('button:has-text("Send")');
    
    // Check that URL was substituted (in history or UI)
    await page.waitForSelector('.history-item:has-text("https://api.prod.com/users")');
  });

  test('Import cURL command', async ({ page }) => {
    // Open import dialog
    await page.keyboard.press('Control+Shift+I');
    
    // Paste cURL command
    const curlCommand = `
      curl -X POST https://api.test/users \\
        -H "Content-Type: application/json" \\
        -H "Authorization: Bearer token123" \\
        -d '{"name": "John Doe", "email": "john@example.com"}'
    `;
    
    await page.fill('#curl-input', curlCommand);
    await page.click('button:has-text("Import")');
    
    // Verify imported values
    const method = await page.inputValue('#apicarus-method');
    expect(method).toBe('POST');
    
    const url = await page.inputValue('#apicarus-url');
    expect(url).toBe('https://api.test/users');
    
    // Check headers tab
    await page.click('.tab-button:has-text("Headers")');
    await page.waitForSelector('input[value="Content-Type"]');
    await page.waitForSelector('input[value="application/json"]');
    
    // Check auth tab
    await page.click('.tab-button:has-text("Authorization")');
    const authType = await page.inputValue('#apicarus-auth-type');
    expect(authType).toBe('bearer');
  });

  test('Generate code from request', async ({ page }) => {
    // Setup request
    await page.fill('#apicarus-url', 'https://api.test/posts');
    await page.selectOption('#apicarus-method', 'POST');
    
    // Add body
    await page.click('.tab-button:has-text("Body")');
    await page.fill('#apicarus-body-content', JSON.stringify({
      title: 'Test Post',
      content: 'Lorem ipsum'
    }));
    
    // Generate code
    await page.keyboard.press('Control+Shift+G');
    
    // Select JavaScript
    await page.click('.language-option:has-text("JavaScript")');
    
    // Verify generated code
    const code = await page.textContent('.generated-code');
    expect(code).toContain('fetch("https://api.test/posts"');
    expect(code).toContain('method: "POST"');
    expect(code).toContain('title: "Test Post"');
    
    // Copy code
    await page.click('button:has-text("Copy")');
    
    // Verify clipboard (if possible in test environment)
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText).toContain('fetch(');
  });
});
```

### 4. Test Utilities

**File**: `tests/utils/testHelpers.js`

```javascript
export class TestHelpers {
  static createMockPlugin() {
    return {
      ui: {
        showNotification: jest.fn(),
        showDialog: jest.fn(),
        registerPanel: jest.fn(),
        registerCommand: jest.fn()
      },
      storage: {
        get: jest.fn(),
        set: jest.fn(),
        remove: jest.fn(),
        clear: jest.fn()
      },
      logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
      },
      ai: {
        generateText: jest.fn()
      }
    };
  }
  
  static createMockRequest() {
    return {
      method: 'GET',
      url: 'https://api.test/endpoint',
      headers: {},
      params: {},
      body: null,
      auth: { type: 'none' }
    };
  }
  
  static createMockResponse(overrides = {}) {
    return {
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/json' },
      data: { success: true },
      size: 1024,
      time: 150,
      ...overrides
    };
  }
  
  static mockDOM() {
    document.body.innerHTML = `
      <div id="apicarus-container">
        <input id="apicarus-method" value="GET" />
        <input id="apicarus-url" value="" />
        <div id="apicarus-responseContent"></div>
        <div id="apicarus-tabContent"></div>
      </div>
    `;
  }
  
  static async waitFor(condition, timeout = 5000) {
    const start = Date.now();
    
    while (Date.now() - start < timeout) {
      if (condition()) return true;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    throw new Error('Timeout waiting for condition');
  }
}

// Custom matchers
expect.extend({
  toBeValidRequest(received) {
    const pass = 
      received &&
      received.method &&
      received.url &&
      ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(received.method);
    
    return {
      pass,
      message: () => 
        pass
          ? `expected ${received} not to be a valid request`
          : `expected ${received} to be a valid request`
    };
  },
  
  toBeValidResponse(received) {
    const pass = 
      received &&
      typeof received.status === 'number' &&
      received.status >= 100 &&
      received.status < 600;
    
    return {
      pass,
      message: () =>
        pass
          ? `expected ${received} not to be a valid response`
          : `expected ${received} to be a valid response`
    };
  }
});
```

### 5. Test Configuration

**File**: `jest.config.js` (update)

```javascript
module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    'index.js',
    '!src/**/*.test.js',
    '!**/node_modules/**'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  testMatch: [
    '**/tests/**/*.test.js',
    '**/tests/integration/**/*.test.js'
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^alexandria-sdk$': '<rootDir>/tests/mocks/alexandria-sdk.js'
  },
  transform: {
    '^.+\\.js$': 'babel-jest'
  },
  coverageReporters: ['text', 'lcov', 'html'],
  testTimeout: 10000
};
```

**File**: `package.json` (update scripts)

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:integration": "jest tests/integration",
    "test:e2e": "playwright test",
    "test:all": "npm run test:coverage && npm run test:e2e"
  }
}
```

## Acceptance Criteria

- [ ] Test coverage > 80% for all metrics
- [ ] All components have unit tests
- [ ] Critical user flows have E2E tests
- [ ] Integration tests for plugin lifecycle
- [ ] Tests run in < 30 seconds
- [ ] No flaky tests
- [ ] Clear test documentation
- [ ] CI/CD integration ready

## Testing Best Practices

1. **AAA Pattern**: Arrange, Act, Assert
2. **One assertion per test** (when possible)
3. **Descriptive test names**
4. **Mock external dependencies**
5. **Test edge cases and errors**
6. **Keep tests independent**
7. **Use test utilities for common operations**

## Next Steps

1. Implement tests incrementally
2. Run coverage reports regularly
3. Add tests for new features
4. Refactor code to be more testable
5. Set up continuous integration