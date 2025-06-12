import { LlmService } from '../../src/services/llm-service';
import { sampleCrashLog } from '../test-utils';

describe('LlmService', () => {
  let llmService: LlmService;
  let mockFeatureFlagService: any;
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    // Store the original fetch
    originalFetch = global.fetch;

    // Mock fetch
    global.fetch = jest.fn();

    // Mock feature flag service
    mockFeatureFlagService = {
      getValue: jest.fn().mockResolvedValue(null)
    };

    // Create LLM service instance
    llmService = new LlmService(mockFeatureFlagService);
  });

  afterEach(() => {
    // Restore the original fetch
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  describe('checkAvailability', () => {
    it('should return true when Ollama is available', async () => {
      // Mock successful fetch
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ models: [] })
      });

      const result = await llmService.checkAvailability();

      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/tags'),
        expect.any(Object)
      );
    });

    it('should return false when Ollama API returns error', async () => {
      // Mock failed fetch
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });

      const result = await llmService.checkAvailability();

      expect(result).toBe(false);
    });

    it('should return false when fetch throws', async () => {
      // Mock fetch that throws
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await llmService.checkAvailability();

      expect(result).toBe(false);
    });
  });

  describe('getAvailableModels', () => {
    it('should return a list of available models', async () => {
      // Mock response with models
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            models: [{ name: 'llama2:latest' }, { name: 'llama2:8b' }, { name: 'llama2:13b' }]
          })
      });

      const models = await llmService.getAvailableModels();

      expect(models).toEqual(['llama2:latest', 'llama2:8b', 'llama2:13b']);
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/tags'));
    });

    it('should return empty array when API call fails', async () => {
      // Mock failed fetch
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const models = await llmService.getAvailableModels();

      expect(models).toEqual([]);
    });

    it('should return empty array when API returns no models', async () => {
      // Mock response with no models
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ models: [] })
      });

      const models = await llmService.getAvailableModels();

      expect(models).toEqual([]);
    });
  });

  describe('getModelStatus', () => {
    it('should return model status when the model is available', async () => {
      // Mock available models
      (global.fetch as jest.Mock).mockImplementation((url, options) => {
        if (url.includes('/api/tags')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                models: [{ name: 'llama2:8b' }]
              })
          });
        } else if (url.includes('/api/show')) {
          // Mock show API
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                name: 'llama2:8b',
                size: 4000000000,
                parameter_size: '8'
              })
          });
        }
        return Promise.resolve({ ok: false });
      });

      const status = await llmService.getModelStatus('llama2:8b');

      expect(status).toEqual({
        id: 'llama2:8b',
        name: 'llama2:8b',
        isAvailable: true,
        isDownloaded: true,
        size: 4000000000,
        parameters: 8,
        quantization: undefined
      });
    });

    it('should detect quantization level from model name', async () => {
      // Mock available models with quantized model
      (global.fetch as jest.Mock).mockImplementation((url, options) => {
        if (url.includes('/api/tags')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                models: [{ name: 'llama2:8b-chat-q4' }]
              })
          });
        } else if (url.includes('/api/show')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                name: 'llama2:8b-chat-q4',
                size: 2000000000,
                parameter_size: '8'
              })
          });
        }
        return Promise.resolve({ ok: false });
      });

      const status = await llmService.getModelStatus('llama2:8b-chat-q4');

      expect(status).toEqual({
        id: 'llama2:8b-chat-q4',
        name: 'llama2:8b-chat-q4',
        isAvailable: true,
        isDownloaded: true,
        size: 2000000000,
        parameters: 8,
        quantization: '4'
      });
    });

    it('should return unavailable status when model is not found', async () => {
      // Mock available models (none match)
      (global.fetch as jest.Mock).mockImplementation((url) => {
        if (url.includes('/api/tags')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                models: [{ name: 'different-model' }]
              })
          });
        }
        return Promise.resolve({ ok: false });
      });

      const status = await llmService.getModelStatus('llama2:8b');

      expect(status).toEqual({
        id: 'llama2:8b',
        name: 'llama2:8b',
        isAvailable: false,
        isDownloaded: false,
        size: 0,
        parameters: 0
      });
    });

    it('should handle API errors gracefully', async () => {
      // Mock API error
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const status = await llmService.getModelStatus('llama2:8b');

      expect(status).toEqual({
        id: 'llama2:8b',
        name: 'llama2:8b',
        isAvailable: false,
        isDownloaded: false,
        size: 0,
        parameters: 0
      });
    });
  });

  describe('analyzeLog', () => {
    it('should analyze a crash log using the Ollama API', async () => {
      // Mock successful model check and generate
      (global.fetch as jest.Mock).mockImplementation((url) => {
        if (url.includes('/api/tags')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                models: [{ name: 'llama2:7b-chat-q4' }]
              })
          });
        } else if (url.includes('/api/generate')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                response: `{
                "primaryError": "NullPointerException",
                "failingComponent": "app.js",
                "potentialRootCauses": [
                  {
                    "cause": "Missing null check",
                    "confidence": 80,
                    "explanation": "The code is trying to access a property of an undefined object",
                    "category": "code-error",
                    "supportingEvidence": [
                      {
                        "description": "Error in log",
                        "location": "Line 10",
                        "snippet": "TypeError: Cannot read property of undefined"
                      }
                    ]
                  }
                ],
                "troubleshootingSteps": ["Add null check"],
                "summary": "Test summary"
              }`,
                model: 'llama2:7b-chat-q4',
                done: true
              })
          });
        } else if (url.includes('/api/show')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                name: 'llama2:7b-chat-q4',
                size: 4000000000,
                parameter_size: '7'
              })
          });
        }
        return Promise.resolve({ ok: false });
      });

      const result = await llmService.analyzeLog(sampleCrashLog.parsedData, sampleCrashLog.content);

      expect(result).toEqual(
        expect.objectContaining({
          summary: 'Test summary',
          primaryError: 'NullPointerException',
          failingComponent: 'app.js',
          potentialRootCauses: [
            expect.objectContaining({
              cause: 'Missing null check',
              confidence: 0.8, // Should be normalized to 0-1 scale
              category: 'code-error'
            })
          ],
          troubleshootingSteps: ['Add null check'],
          llmModel: 'llama2:7b-chat-q4'
        })
      );

      // Verify API call to generate
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/generate'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          }),
          body: expect.stringContaining('analyze')
        })
      );
    });

    it('should use a custom model when specified', async () => {
      // Setup mock for model check and generate
      (global.fetch as jest.Mock).mockImplementation((url, options) => {
        if (url.includes('/api/tags')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                models: [{ name: 'llama2:7b-chat-q4' }, { name: 'custom-model:latest' }]
              })
          });
        } else if (url.includes('/api/generate')) {
          // Extract the model from the request body
          const body = JSON.parse(options.body as string);
          const modelUsed = body.model;

          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                response: `{
                "primaryError": "Error",
                "potentialRootCauses": [
                  {
                    "cause": "Analysis from ${modelUsed}",
                    "confidence": 80,
                    "explanation": "Test explanation",
                    "supportingEvidence": []
                  }
                ],
                "troubleshootingSteps": [],
                "summary": "Analysis from ${modelUsed}"
              }`,
                model: modelUsed,
                done: true
              })
          });
        }
        return Promise.resolve({ ok: false });
      });

      // Use custom model
      const result = await llmService.analyzeLog(
        sampleCrashLog.parsedData,
        sampleCrashLog.content,
        'custom-model:latest'
      );

      expect(result.summary).toBe('Analysis from custom-model:latest');
      expect(result.llmModel).toBe('custom-model:latest');

      // Verify the model in the request
      const lastCall = (global.fetch as jest.Mock).mock.calls.find((call) =>
        call[0].includes('/api/generate')
      );

      const requestBody = JSON.parse(lastCall[1].body);
      expect(requestBody.model).toBe('custom-model:latest');
    });

    it('should return a fallback analysis when API call fails', async () => {
      // Mock failed API call
      (global.fetch as jest.Mock).mockImplementation((url) => {
        if (url.includes('/api/tags')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                models: [{ name: 'llama2:7b-chat-q4' }]
              })
          });
        } else if (url.includes('/api/generate')) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve({ ok: false });
      });

      // Still should return a result (fallback)
      const result = await llmService.analyzeLog(sampleCrashLog.parsedData, sampleCrashLog.content);

      // Verify fallback has expected structure
      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('primaryError');
      expect(result).toHaveProperty('potentialRootCauses');
      expect(result).toHaveProperty('troubleshootingSteps');

      // Should have low confidence
      expect(result.confidence).toBe(0);

      // Should indicate analysis failed
      expect(result.potentialRootCauses[0].cause).toContain('failed');
    });

    it('should handle malformed LLM responses', async () => {
      // Mock response with invalid JSON
      (global.fetch as jest.Mock).mockImplementation((url) => {
        if (url.includes('/api/tags')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                models: [{ name: 'llama2:7b-chat-q4' }]
              })
          });
        } else if (url.includes('/api/generate')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                response: 'This is not valid JSON',
                model: 'llama2:7b-chat-q4',
                done: true
              })
          });
        }
        return Promise.resolve({ ok: false });
      });

      const result = await llmService.analyzeLog(sampleCrashLog.parsedData, sampleCrashLog.content);

      // Should return fallback for parsing error
      expect(result.potentialRootCauses[0].cause).toContain('parse');
      expect(result.confidence).toBe(0);
    });
  });

  describe('analyzeCodeSnippet', () => {
    it('should analyze a code snippet', async () => {
      // Mock successful model check and generate
      (global.fetch as jest.Mock).mockImplementation((url) => {
        if (url.includes('/api/tags')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                models: [{ name: 'llama2:7b-chat-q4' }]
              })
          });
        } else if (url.includes('/api/generate')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                response: `{
                "primaryIssue": "Memory leak",
                "problematicComponent": "Memory management",
                "potentialIssues": [
                  {
                    "issue": "Unclosed resource",
                    "confidence": 90,
                    "explanation": "File handle not closed",
                    "codeReferences": [
                      {
                        "description": "Missing close",
                        "location": "Line 15",
                        "codeSnippet": "open(file)"
                      }
                    ]
                  }
                ],
                "improvementSuggestions": ["Use with statement"],
                "summary": "Code has resource leak issues",
                "overallScore": 65
              }`,
                model: 'llama2:7b-chat-q4',
                done: true,
                total_duration: 1500
              })
          });
        }
        return Promise.resolve({ ok: false });
      });

      const sampleCodeSnippet = {
        content: 'def test():\n  file = open("test.txt")\n  data = file.read()\n  return data',
        language: 'python'
      };

      const result = await llmService.analyzeCodeSnippet(
        sampleCodeSnippet.content,
        sampleCodeSnippet.language
      );

      expect(result).toEqual(
        expect.objectContaining({
          primaryIssue: 'Memory leak',
          problematicComponent: 'Memory management',
          potentialIssues: [
            expect.objectContaining({
              issue: 'Unclosed resource',
              confidence: 90
            })
          ],
          improvementSuggestions: ['Use with statement'],
          summary: 'Code has resource leak issues',
          overallScore: 65,
          llmModel: 'llama2:7b-chat-q4',
          codeLanguage: 'python',
          inferenceTime: 1500
        })
      );

      // Verify API call to generate
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/generate'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          }),
          body: expect.stringContaining('code reviewer')
        })
      );
    });

    it('should handle API errors during code analysis', async () => {
      // Mock failed API call
      (global.fetch as jest.Mock).mockImplementation((url) => {
        if (url.includes('/api/tags')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                models: [{ name: 'llama2:7b-chat-q4' }]
              })
          });
        } else if (url.includes('/api/generate')) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve({ ok: false });
      });

      const sampleCodeSnippet = {
        content: 'function test() { return 5; }',
        language: 'javascript'
      };

      // Should still return a fallback result
      const result = await llmService.analyzeCodeSnippet(
        sampleCodeSnippet.content,
        sampleCodeSnippet.language
      );

      // Verify fallback analysis
      expect(result).toHaveProperty('primaryIssue');
      expect(result).toHaveProperty('potentialIssues');
      expect(result).toHaveProperty('improvementSuggestions');

      // Should have error information
      expect(result.primaryIssue).toContain('failed');
      expect(result.overallScore).toBe(0);
    });
  });

  describe('getModelToUse', () => {
    it('should use feature flag value if available', async () => {
      // Setup feature flag to return a model
      mockFeatureFlagService.getValue.mockResolvedValue('custom-model:latest');

      // Mock models API
      (global.fetch as jest.Mock).mockImplementation((url, options) => {
        if (url.includes('/api/tags')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                models: [{ name: 'llama2:7b-chat-q4' }, { name: 'custom-model:latest' }]
              })
          });
        } else if (url.includes('/api/show')) {
          const body = JSON.parse((options?.body as string) || '{}');
          const modelName = body?.name;

          if (modelName === 'custom-model:latest') {
            return Promise.resolve({
              ok: true,
              json: () =>
                Promise.resolve({
                  name: 'custom-model:latest',
                  size: 3000000000,
                  parameter_size: '7'
                })
            });
          }
        }
        return Promise.resolve({ ok: false });
      });

      // Private method test using prototype access
      const result = await (llmService as any).getModelToUse();

      expect(result).toBe('custom-model:latest');
      expect(mockFeatureFlagService.getValue).toHaveBeenCalledWith('crash-analyzer.llm.model');
    });

    it('should fall back to default model when feature flag is not set', async () => {
      // Feature flag returns null (not set)
      mockFeatureFlagService.getValue.mockResolvedValue(null);

      // Mock API with available models including the default
      (global.fetch as jest.Mock).mockImplementation((url, options) => {
        if (url.includes('/api/tags')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                models: [
                  { name: 'llama2:8b-chat-q4' }, // Should match DEFAULT_MODEL
                  { name: 'llama2:7b-chat-q4' }
                ]
              })
          });
        } else if (url.includes('/api/show')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                name: 'llama2:8b-chat-q4',
                size: 4000000000,
                parameter_size: '8'
              })
          });
        }
        return Promise.resolve({ ok: false });
      });

      const result = await (llmService as any).getModelToUse();

      // Should use default model - default model is llama2:8b-chat-q4 in the implementation
      expect(result).toBe('llama2:8b-chat-q4');
    });

    it('should fall back to any available model when default is not available', async () => {
      // Feature flag returns null
      mockFeatureFlagService.getValue.mockResolvedValue(null);

      // Mock API with available models but not including the default
      (global.fetch as jest.Mock).mockImplementation((url, options) => {
        if (url.includes('/api/tags')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                models: [
                  { name: 'different-model:latest' } // Default not available
                ]
              })
          });
        } else if (url.includes('/api/show')) {
          return Promise.resolve({
            ok: false // Default model show would fail
          });
        }
        return Promise.resolve({ ok: false });
      });

      const result = await (llmService as any).getModelToUse();

      // Should pick the first available model
      expect(result).toBe('different-model:latest');
    });

    it('should handle when no models are available', async () => {
      // Feature flag returns null
      mockFeatureFlagService.getValue.mockResolvedValue(null);

      // Mock API with no models
      (global.fetch as jest.Mock).mockImplementation((url) => {
        if (url.includes('/api/tags')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ models: [] })
          });
        }
        return Promise.resolve({ ok: false });
      });

      const result = await (llmService as any).getModelToUse();

      // Should use fallback model
      expect(result).toBe('llama2:7b-chat-q4'); // The FALLBACK_MODEL constant
    });
  });
});
