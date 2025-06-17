import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { AIAssistant } from '../src/components/AIAssistant.js';
import { AI, UI } from 'alexandria-sdk';

jest.mock('alexandria-sdk', () => ({
  AI: {
    getModel: jest.fn(() => ({
      complete: jest.fn()
    }))
  },
  UI: {
    showNotification: jest.fn()
  }
}));

describe('AIAssistant', () => {
  let aiAssistant;
  let mockPlugin;
  let mockModel;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockPlugin = {
      name: 'Apicarus',
      context: {}
    };
    
    mockModel = {
      complete: jest.fn()
    };
    
    AI.getModel.mockReturnValue(mockModel);
    aiAssistant = new AIAssistant(mockPlugin);
  });

  describe('Request Analysis', () => {
    it('should analyze a request and provide suggestions', async () => {
      const request = {
        method: 'POST',
        url: 'https://api.example.com/users',
        headers: { 'Content-Type': 'application/json' }
      };      
      const mockAnalysis = 'Consider adding authentication headers...';
      mockModel.complete.mockResolvedValue({ text: mockAnalysis });
      
      const result = await aiAssistant.analyzeRequest(request);
      
      expect(mockModel.complete).toHaveBeenCalledWith({
        prompt: expect.stringContaining('Analyze this API request'),
        maxTokens: 500,
        temperature: 0.7
      });
      
      expect(result).toBe(mockAnalysis);
    });

    it('should handle analysis errors gracefully', async () => {
      mockModel.complete.mockRejectedValue(new Error('AI service unavailable'));
      
      const result = await aiAssistant.analyzeRequest({
        method: 'GET',
        url: 'https://api.example.com'
      });
      
      expect(result).toBe('Unable to analyze request at this time.');
    });
  });

  describe('Request Generation', () => {
    it('should generate request from natural language', async () => {
      const description = 'Create a user with name John Doe';
      const mockRequest = {
        method: 'POST',
        url: '/api/users',
        headers: { 'Content-Type': 'application/json' },
        body: { name: 'John Doe' },
        description: 'Creates a new user'
      };      
      mockModel.complete.mockResolvedValue({ 
        text: JSON.stringify(mockRequest) 
      });
      
      const result = await aiAssistant.generateRequestFromDescription(description);
      
      expect(mockModel.complete).toHaveBeenCalledWith({
        prompt: expect.stringContaining(description),
        maxTokens: 300,
        temperature: 0.5
      });
      
      expect(result).toEqual(mockRequest);
    });

    it('should return null on generation failure', async () => {
      mockModel.complete.mockResolvedValue({ 
        text: 'invalid json' 
      });
      
      const result = await aiAssistant.generateRequestFromDescription('test');
      
      expect(result).toBeNull();
    });
  });

  describe('Test Case Suggestions', () => {
    it('should suggest test cases for an endpoint', async () => {
      const endpoint = '/api/users/:id';
      const mockTestCases = 'Test cases: 1. Valid user ID...';
      
      mockModel.complete.mockResolvedValue({ text: mockTestCases });
      
      const result = await aiAssistant.suggestTestCases(endpoint);
      
      expect(result).toBe(mockTestCases);
    });
  });
});