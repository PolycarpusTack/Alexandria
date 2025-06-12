// Mock AI providers for testing

export const mockOpenAIProvider = {
  query: jest.fn(),
  streamQuery: jest.fn(),
  getAvailableModels: jest.fn(() => Promise.resolve(['gpt-4', 'gpt-3.5-turbo'])),
  healthCheck: jest.fn(() => Promise.resolve({ status: 'healthy' })),
  
  // Mock streaming response
  streamChat: jest.fn().mockImplementation(async function* (messages: any[], options: any = {}) {
    const chunks = [
      'I understand you want help with coding. ',
      'Let me assist you with that. ',
      'Here\'s what I can do for you...'
    ];
    
    for (const chunk of chunks) {
      yield {
        content: chunk,
        done: false,
        metadata: {
          provider: 'openai',
          model: options.model || 'gpt-4',
          tokenCount: chunk.length
        }
      };
      
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    yield {
      content: '',
      done: true,
      metadata: {
        provider: 'openai',
        model: options.model || 'gpt-4',
        totalTokens: chunks.join('').length
      }
    };
  })
};

export const mockAnthropicProvider = {
  query: jest.fn(),
  streamQuery: jest.fn(),
  getAvailableModels: jest.fn(() => Promise.resolve(['claude-2', 'claude-instant'])),
  healthCheck: jest.fn(() => Promise.resolve({ status: 'healthy' })),
  
  streamChat: jest.fn().mockImplementation(async function* (messages: any[], options: any = {}) {
    const response = 'I\'m Claude, an AI assistant created by Anthropic. How can I help you today?';
    
    for (const char of response) {
      yield {
        content: char,
        done: false,
        metadata: {
          provider: 'anthropic',
          model: options.model || 'claude-2'
        }
      };
      
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    yield {
      content: '',
      done: true,
      metadata: {
        provider: 'anthropic',
        model: options.model || 'claude-2',
        totalTokens: response.length
      }
    };
  })
};

export const mockOllamaProvider = {
  query: jest.fn(),
  streamQuery: jest.fn(),
  getAvailableModels: jest.fn(() => Promise.resolve(['llama2', 'codellama'])),
  healthCheck: jest.fn(() => Promise.resolve({ status: 'healthy' })),
  
  streamChat: jest.fn().mockImplementation(async function* (messages: any[], options: any = {}) {
    const response = 'Hello! I\'m running locally on Ollama. How can I assist you with coding?';
    
    const words = response.split(' ');
    for (const word of words) {
      yield {
        content: word + ' ',
        done: false,
        metadata: {
          provider: 'ollama',
          model: options.model || 'llama2'
        }
      };
      
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    yield {
      content: '',
      done: true,
      metadata: {
        provider: 'ollama',
        model: options.model || 'llama2',
        totalTokens: words.length
      }
    };
  })
};

// Mock AI service that simulates Alexandria's shared AI service
export const mockAIService = {
  query: jest.fn().mockImplementation(async (prompt: string, options: any = {}) => {
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return {
      content: `Mock response to: ${prompt}`,
      provider: options.provider || 'openai',
      model: options.model || 'gpt-4',
      tokensUsed: prompt.length + 50,
      metadata: {
        requestId: 'mock-request-' + Date.now(),
        timestamp: new Date()
      }
    };
  }),
  
  streamQuery: jest.fn().mockImplementation(async function* (prompt: string, options: any = {}) {
    const response = `Mock streaming response to: ${prompt}`;
    const words = response.split(' ');
    
    for (const word of words) {
      yield {
        content: word + ' ',
        done: false,
        provider: options.provider || 'openai',
        model: options.model || 'gpt-4',
        tokenCount: 1
      };
      
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    yield {
      content: '',
      done: true,
      provider: options.provider || 'openai',
      model: options.model || 'gpt-4',
      tokenCount: 0,
      metadata: {
        totalTokens: words.length,
        requestId: 'mock-stream-' + Date.now()
      }
    };
  }),
  
  getAvailableModels: jest.fn(() => ['gpt-4', 'gpt-3.5-turbo', 'claude-2', 'llama2']),
  
  healthCheck: jest.fn(() => Promise.resolve({
    status: 'healthy',
    providers: {
      openai: { status: 'healthy', latency: 150 },
      anthropic: { status: 'healthy', latency: 200 },
      ollama: { status: 'healthy', latency: 100 }
    }
  }))
};

// Helper to reset all mocks
export const resetAIProviderMocks = () => {
  jest.clearAllMocks();
  
  mockOpenAIProvider.query.mockClear();
  mockOpenAIProvider.streamChat.mockClear();
  mockAnthropicProvider.query.mockClear();
  mockAnthropicProvider.streamChat.mockClear();
  mockOllamaProvider.query.mockClear();
  mockOllamaProvider.streamChat.mockClear();
  mockAIService.query.mockClear();
  mockAIService.streamQuery.mockClear();
};