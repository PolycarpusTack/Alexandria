/**
 * Test script for Dynamic AI Model Configuration
 * 
 * Run this to see the automatic model detection in action
 */

import { AIServiceFactory } from '../src/core/services/ai-service';
import { Logger } from '../src/utils/logger';
import * as path from 'path';

async function testDynamicAIConfiguration() {
  const logger = new Logger('ai-test');
  
  console.log('🚀 Testing Dynamic AI Model Configuration\n');
  
  // Create factory with custom config path
  const factory = new AIServiceFactory(logger, {
    configPath: path.join(process.cwd(), 'config', 'ai-models.json')
  });
  
  // Set up event listeners
  factory.on('model:discovered', ({ model }) => {
    console.log(`✅ Discovered: ${model.name} (${model.provider})`);
  });
  
  factory.on('provider:connected', ({ providerId }) => {
    console.log(`🔗 Provider connected: ${providerId}`);
  });
  
  factory.on('provider:disconnected', ({ providerId, error }) => {
    console.log(`❌ Provider disconnected: ${providerId} - ${error}`);
  });
  
  try {
    // Initialize and detect models
    console.log('\n📡 Initializing and detecting models...\n');
    await factory.initialize();
    
    // Get model registry
    const registry = factory.getModelRegistry();
    
    // Display all detected models
    console.log('\n📋 All Detected Models:\n');
    const allModels = registry.getAllModels();
    
    allModels.forEach(model => {
      const status = model.available ? '✅ Available' : '❌ Unavailable';
      console.log(`  ${status} ${model.id} - ${model.name} (${model.type})`);
      if (!model.available && model.error) {
        console.log(`    └─ Error: ${model.error}`);
      }
    });
    
    // Display available models
    console.log('\n🟢 Available Models:\n');
    const availableModels = registry.getAvailableModels();
    
    if (availableModels.length === 0) {
      console.log('  No models available. Please install Ollama models or configure API keys.');
    } else {
      availableModels.forEach(model => {
        console.log(`  - ${model.id} (${model.provider})`);
      });
    }
    
    // Get default model
    const defaultModel = registry.getDefaultModel();
    if (defaultModel) {
      console.log(`\n⭐ Default Model: ${defaultModel.id}`);
    }
    
    // Test using the default service
    const defaultService = factory.getDefaultService();
    if (defaultService) {
      console.log('\n🧪 Testing default service with a simple completion...\n');
      
      try {
        const response = await defaultService.complete('Say hello in a creative way!', {
          maxTokens: 50,
          temperature: 0.8
        });
        
        console.log('Response:', response.text);
        console.log(`Model used: ${response.model}`);
        console.log(`Tokens: ${response.usage.totalTokens}`);
      } catch (error) {
        console.error('Completion failed:', error.message);
      }
    }
    
    // Display configuration info
    const configManager = factory.getConfigManager();
    const preferences = configManager.getPreferences();
    
    console.log('\n⚙️  Configuration:\n');
    console.log(`  Config Path: ${path.join(process.cwd(), 'config', 'ai-models.json')}`);
    console.log(`  Default Model: ${preferences.defaultModel || 'Auto-detected'}`);
    console.log(`  Fallback Models: ${preferences.fallbackModels?.join(', ') || 'None configured'}`);
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    // Cleanup
    factory.shutdown();
    console.log('\n✨ Test complete!\n');
  }
}

// Run the test
testDynamicAIConfiguration().catch(console.error);
