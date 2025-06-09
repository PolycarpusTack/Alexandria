/**
 * Ollama Compatibility Test Suite
 * 
 * Comprehensive tests for Ollama API compatibility
 */

import axios from 'axios';
import { OllamaService } from '../src/core/services/ai-service/ollama-service';
import { Logger } from '../src/utils/logger';

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';

interface OllamaAPITest {
  name: string;
  endpoint: string;
  method: 'GET' | 'POST' | 'DELETE';
  data?: any;
  expected: (response: any) => boolean;
}

class OllamaCompatibilityChecker {
  private client: any;
  private logger: Logger;

  constructor() {
    this.logger = new Logger('ollama-compat');
    this.client = axios.create({
      baseURL: OLLAMA_HOST,
      timeout: 10000
    });
  }

  /**
   * Test all Ollama API endpoints used by the system
   */
  async runCompatibilityTests(): Promise<void> {
    console.log('🔍 Ollama Compatibility Check\n');
    console.log(`Host: ${OLLAMA_HOST}\n`);

    // Check if Ollama is running
    const isRunning = await this.checkOllamaRunning();
    if (!isRunning) {
      console.error('❌ Ollama is not running or not accessible');
      console.log('\nPlease ensure Ollama is running:');
      console.log('  - Linux/Mac: ollama serve');
      console.log('  - Windows: Start Ollama from system tray');
      return;
    }

    console.log('✅ Ollama is running\n');

    // Define API tests
    const apiTests: OllamaAPITest[] = [
      {
        name: 'List Models (GET /api/tags)',
        endpoint: '/api/tags',
        method: 'GET',
        expected: (res) => res.data && Array.isArray(res.data.models)
      },
      {
        name: 'List Running Models (GET /api/ps)',
        endpoint: '/api/ps',
        method: 'GET',
        expected: (res) => res.data && Array.isArray(res.data.models)
      },
      {
        name: 'Show Model Info (POST /api/show)',
        endpoint: '/api/show',
        method: 'POST',
        data: { name: 'llama2' }, // Will be dynamic
        expected: (res) => res.data && res.data.modelfile
      },
      {
        name: 'Generate Completion (POST /api/generate)',
        endpoint: '/api/generate',
        method: 'POST',
        data: {
          model: 'llama2', // Will be dynamic
          prompt: 'Hello',
          stream: false,
          options: { num_predict: 1 }
        },
        expected: (res) => res.data && res.data.response
      },
      {
        name: 'Chat Completion (POST /api/chat)',
        endpoint: '/api/chat',
        method: 'POST',
        data: {
          model: 'llama2', // Will be dynamic
          messages: [{ role: 'user', content: 'Hi' }],
          stream: false
        },
        expected: (res) => res.data && res.data.message
      },
      {
        name: 'Embeddings (POST /api/embeddings)',
        endpoint: '/api/embeddings',
        method: 'POST',
        data: {
          model: 'llama2', // Will be dynamic
          prompt: 'test'
        },
        expected: (res) => res.data && Array.isArray(res.data.embedding)
      }
    ];

    // Get first available model for tests
    const models = await this.getAvailableModels();
    const testModel = models[0]?.name;

    if (!testModel) {
      console.log('⚠️  No models installed in Ollama');
      console.log('\nInstall a model first:');
      console.log('  ollama pull llama2');
      console.log('  ollama pull mistral');
      console.log('  ollama pull codellama');
      return;
    }

    console.log(`Using model for tests: ${testModel}\n`);

    // Update test data with actual model
    apiTests.forEach(test => {
      if (test.data?.model) {
        test.data.model = testModel;
      }
      if (test.data?.name) {
        test.data.name = testModel;
      }
    });

    // Run API tests
    console.log('📋 API Endpoint Tests:\n');
    for (const test of apiTests) {
      await this.runAPITest(test);
    }

    // Test service integration
    console.log('\n🔧 Service Integration Tests:\n');
    await this.testServiceIntegration(testModel);

    // Test model capabilities
    console.log('\n🎯 Model Capability Detection:\n');
    await this.testModelCapabilities();

    // Test streaming
    console.log('\n🌊 Streaming Tests:\n');
    await this.testStreaming(testModel);

    // Performance tests
    console.log('\n⚡ Performance Tests:\n');
    await this.testPerformance(testModel);

    console.log('\n✨ Compatibility check complete!\n');
  }

  private async checkOllamaRunning(): Promise<boolean> {
    try {
      await this.client.get('/');
      return true;
    } catch (error) {
      return false;
    }
  }

  private async getAvailableModels(): Promise<any[]> {
    try {
      const response = await this.client.get('/api/tags');
      return response.data.models || [];
    } catch (error) {
      return [];
    }
  }

  private async runAPITest(test: OllamaAPITest): Promise<void> {
    try {
      const response = await this.client[test.method.toLowerCase()](
        test.endpoint,
        test.data
      );
      
      if (test.expected(response)) {
        console.log(`  ✅ ${test.name}`);
      } else {
        console.log(`  ❌ ${test.name} - Unexpected response format`);
      }
    } catch (error) {
      const status = error.response?.status;
      const message = error.response?.data?.error || error.message;
      
      // Some endpoints might not be available in all Ollama versions
      if (status === 404) {
        console.log(`  ⚠️  ${test.name} - Not available (404)`);
      } else if (test.endpoint === '/api/embeddings' && status === 400) {
        console.log(`  ⚠️  ${test.name} - Model doesn't support embeddings`);
      } else {
        console.log(`  ❌ ${test.name} - ${message}`);
      }
    }
  }

  private async testServiceIntegration(modelName: string): Promise<void> {
    const service = new OllamaService(
      { defaultModel: modelName },
      this.logger
    );

    // Test listing models
    try {
      const models = await service.listModels();
      console.log(`  ✅ Service can list models (found ${models.length})`);
    } catch (error) {
      console.log(`  ❌ Service failed to list models: ${error.message}`);
    }

    // Test completion
    try {
      const response = await service.complete('Hello', {
        model: modelName,
        maxTokens: 10
      });
      console.log(`  ✅ Service can generate completions`);
    } catch (error) {
      console.log(`  ❌ Service failed to generate completion: ${error.message}`);
    }

    // Test model loading
    try {
      await service.loadModel(modelName);
      console.log(`  ✅ Service can load models`);
    } catch (error) {
      console.log(`  ❌ Service failed to load model: ${error.message}`);
    }
  }

  private async testModelCapabilities(): Promise<void> {
    const models = await this.getAvailableModels();
    
    for (const model of models.slice(0, 3)) { // Test first 3 models
      const capabilities = this.detectCapabilities(model.name);
      console.log(`  ${model.name}:`);
      console.log(`    - Capabilities: ${capabilities.join(', ')}`);
      console.log(`    - Size: ${this.formatBytes(model.size)}`);
      console.log(`    - Family: ${model.details?.family || 'unknown'}`);
    }
  }

  private detectCapabilities(modelName: string): string[] {
    const capabilities: string[] = [];
    const name = modelName.toLowerCase();

    if (name.includes('chat') || name.includes('llama') || name.includes('mistral')) {
      capabilities.push('chat');
    }
    if (name.includes('code')) {
      capabilities.push('code');
    }
    if (name.includes('embed')) {
      capabilities.push('embeddings');
    }
    if (name.includes('vision') || name.includes('llava')) {
      capabilities.push('vision');
    }
    if (name.includes('instruct')) {
      capabilities.push('instruct');
    }

    if (capabilities.length === 0) {
      capabilities.push('chat'); // Default
    }

    return capabilities;
  }

  private async testStreaming(modelName: string): Promise<void> {
    try {
      const response = await this.client.post('/api/generate', {
        model: modelName,
        prompt: 'Count to 3',
        stream: true
      }, {
        responseType: 'stream'
      });

      let tokenCount = 0;
      const startTime = Date.now();

      response.data.on('data', (chunk: Buffer) => {
        const lines = chunk.toString().split('\n').filter(Boolean);
        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            if (data.response) {
              tokenCount++;
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      });

      await new Promise((resolve) => {
        response.data.on('end', resolve);
      });

      const duration = Date.now() - startTime;
      console.log(`  ✅ Streaming works (${tokenCount} tokens in ${duration}ms)`);
    } catch (error) {
      console.log(`  ❌ Streaming failed: ${error.message}`);
    }
  }

  private async testPerformance(modelName: string): Promise<void> {
    const prompts = [
      'Hello',
      'What is 2+2?',
      'Tell me a joke'
    ];

    let totalTime = 0;
    let successCount = 0;

    for (const prompt of prompts) {
      try {
        const startTime = Date.now();
        await this.client.post('/api/generate', {
          model: modelName,
          prompt,
          stream: false,
          options: { num_predict: 20 }
        });
        const duration = Date.now() - startTime;
        totalTime += duration;
        successCount++;
      } catch (error) {
        // Skip
      }
    }

    if (successCount > 0) {
      const avgTime = Math.round(totalTime / successCount);
      console.log(`  ✅ Average response time: ${avgTime}ms`);
      console.log(`  ✅ Success rate: ${successCount}/${prompts.length}`);
    } else {
      console.log(`  ❌ All performance tests failed`);
    }
  }

  private formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }
}

// Run the compatibility check
async function main() {
  const checker = new OllamaCompatibilityChecker();
  await checker.runCompatibilityTests();
}

main().catch(console.error);
