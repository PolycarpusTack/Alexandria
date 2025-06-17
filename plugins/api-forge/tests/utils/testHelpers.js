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