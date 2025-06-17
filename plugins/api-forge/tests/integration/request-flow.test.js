import ApicarusPlugin from '../../index.js';
import { mockAlexandriaContext } from '../mocks/alexandria-sdk.js';

describe('Request Flow Integration', () => {
  let plugin;
  let context;
  
  beforeEach(async () => {
    context = mockAlexandriaContext();
    plugin = new ApicarusPlugin();
    await plugin.onActivate(context);
    
    // Mock fetch
    global.fetch = jest.fn();
    
    // Mock DOM
    document.body.innerHTML = `
      <div id="apicarus-container">
        <input id="apicarus-method" value="GET" />
        <input id="apicarus-url" value="" />
        <div id="apicarus-responseContent"></div>
      </div>
    `;
  });

  afterEach(async () => {
    await plugin.onDeactivate();
    jest.restoreAllMocks();
  });

  test('should execute complete request flow', async () => {
    // Setup mock response
    fetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ success: true }),
      text: async () => JSON.stringify({ success: true })
    });
    
    // Setup request
    document.getElementById('apicarus-method').value = 'POST';
    document.getElementById('apicarus-url').value = 'https://api.test/users';
    
    plugin.currentRequest = {
      method: 'POST',
      url: 'https://api.test/users',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test User' })
    };
    
    // Execute request
    await plugin.sendRequest();
    
    // Verify fetch was called correctly
    expect(fetch).toHaveBeenCalledWith(
      'https://api.test/users',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json'
        })
      })
    );
    
    // Verify history was updated
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
    
    // Setup request with variables
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
      json: async () => ({ cached: false }),
      text: async () => JSON.stringify({ cached: false })
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
    expect(context.ui.showNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Cached Response'
      })
    );
  });

  test('should handle request errors gracefully', async () => {
    fetch.mockRejectedValue(new Error('Network error'));
    
    plugin.currentRequest = {
      method: 'GET',
      url: 'https://api.test/error'
    };
    
    await expect(plugin.sendRequest()).rejects.toThrow('Network error');
    
    // Should display error in UI
    const responseContent = document.getElementById('apicarus-responseContent');
    expect(responseContent.innerHTML).toContain('Error');
  });

  test('should handle timeout scenarios', async () => {
    // Mock a long-running request
    fetch.mockImplementation(() => 
      new Promise(resolve => setTimeout(resolve, 2000))
    );
    
    plugin.requestTimeout = 1000; // 1 second timeout
    plugin.currentRequest = {
      method: 'GET',
      url: 'https://api.test/slow'
    };
    
    await expect(plugin.sendRequest()).rejects.toThrow();
  });

  test('should integrate with performance monitoring', async () => {
    fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: 'test' })
    });
    
    plugin.currentRequest = {
      method: 'GET',
      url: 'https://api.test/monitored'
    };
    
    const spy = jest.spyOn(plugin.performanceMonitor, 'start');
    
    await plugin.sendRequest();
    
    expect(spy).toHaveBeenCalledWith('http-request');
  });

  test('should handle request deduplication', async () => {
    fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: 'test' })
    });
    
    plugin.currentRequest = {
      method: 'GET',
      url: 'https://api.test/dedupe'
    };
    
    // Start two identical requests simultaneously
    const [result1, result2] = await Promise.all([
      plugin.sendRequest(),
      plugin.sendRequest()
    ]);
    
    // Should only make one actual network request
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  test('should update store state during request flow', async () => {
    if (!plugin.store) return; // Skip if store not available
    
    fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: 'test' })
    });
    
    plugin.currentRequest = {
      method: 'GET',
      url: 'https://api.test/store'
    };
    
    const dispatchSpy = jest.spyOn(plugin.store, 'dispatch');
    
    await plugin.sendRequest();
    
    // Should dispatch loading and response actions
    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: expect.stringContaining('LOADING')
      })
    );
  });

  test('should handle authentication in request flow', async () => {
    fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ authenticated: true })
    });
    
    plugin.currentRequest = {
      method: 'GET',
      url: 'https://api.test/protected',
      auth: {
        type: 'bearer',
        token: 'test-token'
      }
    };
    
    await plugin.sendRequest();
    
    expect(fetch).toHaveBeenCalledWith(
      'https://api.test/protected',
      expect.objectContaining({
        headers: expect.objectContaining({
          'Authorization': 'Bearer test-token'
        })
      })
    );
  });

  test('should handle large response payloads', async () => {
    const largeData = Array(10000).fill().map((_, i) => ({ id: i, data: 'test' }));
    
    fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => largeData,
      text: async () => JSON.stringify(largeData)
    });
    
    plugin.currentRequest = {
      method: 'GET',
      url: 'https://api.test/large'
    };
    
    const startTime = performance.now();
    await plugin.sendRequest();
    const endTime = performance.now();
    
    // Should handle large responses efficiently
    expect(endTime - startTime).toBeLessThan(1000);
  });

  test('should integrate with AI analysis when enabled', async () => {
    plugin.aiAnalysisEnabled = true;
    
    fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: 'analyzed' })
    });
    
    plugin.currentRequest = {
      method: 'GET',
      url: 'https://api.test/ai-analysis'
    };
    
    const aiSpy = jest.spyOn(plugin.aiAssistant, 'analyzeResponse');
    
    await plugin.sendRequest();
    
    expect(aiSpy).toHaveBeenCalled();
  });

  test('should handle concurrent requests with different methods', async () => {
    fetch.mockImplementation((url, options) => 
      Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ method: options.method, url })
      })
    );
    
    const requests = [
      { method: 'GET', url: 'https://api.test/get' },
      { method: 'POST', url: 'https://api.test/post' },
      { method: 'PUT', url: 'https://api.test/put' }
    ];
    
    const results = await Promise.all(
      requests.map(req => {
        plugin.currentRequest = req;
        return plugin.sendRequest();
      })
    );
    
    expect(results).toHaveLength(3);
    expect(fetch).toHaveBeenCalledTimes(3);
  });
});