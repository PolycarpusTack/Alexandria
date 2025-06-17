// Jest setup file for Apicarus tests

// Add custom matchers if needed
expect.extend({
  toBeValidRequest(received) {
    const pass = received &&
      received.method &&
      received.url &&
      typeof received.headers === 'object' &&
      typeof received.params === 'object';
    
    return {
      pass,
      message: () => pass
        ? `expected ${received} not to be a valid request`
        : `expected ${received} to be a valid request`
    };
  }
});

// Mock global objects
global.fetch = jest.fn();
global.localStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
};