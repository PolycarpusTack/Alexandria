import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ApicarusPlugin from '../index.js';
import { UI, Storage, AI, Network } from 'alexandria-sdk';

// Mock Alexandria SDK
jest.mock('alexandria-sdk', () => ({
  Plugin: class Plugin {
    constructor() {
      this.name = '';
      this.version = '';
    }
  },
  UI: {
    registerPanel: jest.fn(),
    registerCommand: jest.fn(),
    showNotification: jest.fn(),
    openModal: jest.fn(),
    selectFile: jest.fn()
  },
  Storage: {
    get: jest.fn(),
    set: jest.fn()
  },
  AI: {
    getModel: jest.fn(() => ({
      complete: jest.fn(),
      stream: jest.fn()
    }))
  },
  Network: {
    request: jest.fn()
  }
}));

describe('ApicarusPlugin', () => {
  let plugin;
  let mockContext;
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Create mock context
    mockContext = {
      id: 'apicarus',
      version: '1.0.0',
      storage: {
        get: jest.fn(),
        set: jest.fn(),
        remove: jest.fn()
      },
      settings: {
        get: jest.fn(),
        set: jest.fn(),
        onChange: jest.fn()
      }
    };
    
    // Create plugin instance
    plugin = new ApicarusPlugin();
  });

  describe('Plugin Lifecycle', () => {
    it('should initialize correctly', () => {
      expect(plugin.name).toBe('Apicarus');
      expect(plugin.version).toBe('1.0.0');
      expect(plugin.currentRequest).toBeNull();
      expect(plugin.history).toEqual([]);
      expect(plugin.collections).toEqual([]);
    });

    it('should activate successfully', async () => {
      await plugin.onActivate(mockContext);      
      // Verify UI components registered
      expect(UI.registerPanel).toHaveBeenCalledTimes(3);
      expect(UI.registerCommand).toHaveBeenCalledTimes(4);
      
      // Verify AI model initialized
      expect(AI.getModel).toHaveBeenCalledWith('llama2');
      
      // Verify notification shown
      expect(UI.showNotification).toHaveBeenCalledWith({
        type: 'success',
        title: 'Apicarus Ready',
        message: 'Start testing APIs with AI-powered insights',
        duration: 3000
      });
    });

    it('should load saved data on activation', async () => {
      const mockData = {
        collections: [{ id: '1', name: 'Test Collection' }],
        history: [{ method: 'GET', url: 'https://api.test.com' }],
        environments: [{ id: '1', name: 'Production' }]
      };
      
      mockContext.storage.get.mockImplementation((key) => {
        return Promise.resolve(mockData[key]);
      });
      
      await plugin.onActivate(mockContext);
      
      expect(plugin.collections).toEqual(mockData.collections);
      expect(plugin.history).toEqual(mockData.history);
      expect(plugin.environments).toEqual(mockData.environments);
    });
  });
  describe('Request Handling', () => {
    beforeEach(async () => {
      await plugin.onActivate(mockContext);
    });

    it('should send a simple GET request', async () => {
      // Mock DOM elements
      document.body.innerHTML = `
        <select id="apicarus-method"><option value="GET" selected>GET</option></select>
        <input id="apicarus-url" value="https://api.example.com/users" />
        <div id="apicarus-responseContent"></div>
        <div id="apicarus-responseStats"></div>
      `;
      
      // Mock network response
      const mockResponse = {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        data: { users: [{ id: 1, name: 'Test User' }] },
        size: 1024
      };
      
      Network.request.mockResolvedValue(mockResponse);
      
      // Send request
      await plugin.sendRequest();
      
      // Verify request made
      expect(Network.request).toHaveBeenCalledWith(
        'https://api.example.com/users',
        expect.objectContaining({ method: 'GET' })
      );
    });
    it('should handle request errors', async () => {
      document.body.innerHTML = `
        <select id="apicarus-method"><option value="GET" selected>GET</option></select>
        <input id="apicarus-url" value="https://api.example.com/error" />
        <div id="apicarus-responseContent"></div>
        <div id="apicarus-responseStats"></div>
      `;
      
      // Mock network error
      Network.request.mockRejectedValue(new Error('Network error'));
      
      // Send request
      await plugin.sendRequest();
      
      // Verify error handling
      expect(Network.request).toHaveBeenCalled();
    });

    it('should validate URL before sending', async () => {
      document.body.innerHTML = `
        <select id="apicarus-method"><option value="GET" selected>GET</option></select>
        <input id="apicarus-url" value="" />
      `;
      
      await plugin.sendRequest();
      
      expect(UI.showNotification).toHaveBeenCalledWith({
        type: 'warning',
        title: 'URL Required',
        message: 'Please enter a request URL'
      });
      
      expect(Network.request).not.toHaveBeenCalled();
    });
  });
});