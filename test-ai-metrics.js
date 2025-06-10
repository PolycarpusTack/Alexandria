/**
 * Test script to verify AI metrics tracking
 */

const { createDynamicAIService } = require('./dist/core/services/ai-service');
const { createLogger } = require('./dist/utils/logger');
const { getAIModelStatus } = require('./dist/utils/ai-model-monitor');

async function testAIMetrics() {
  const logger = createLogger({
    serviceName: 'ai-metrics-test',
    level: 'info',
    format: 'simple'
  });

  console.log('Creating AI service with metrics enabled...');
  
  // Create AI service with metrics enabled (default)
  const aiService = await createDynamicAIService(logger, {
    enableMetrics: true,
    enableCache: false // Disable caching for clearer metrics
  });

  if (!aiService) {
    console.error('Failed to create AI service. Make sure Ollama or another AI provider is running.');
    return;
  }

  console.log('\n1. Testing simple completion...');
  try {
    const response = await aiService.complete('Say hello in 5 words', {
      maxTokens: 50,
      temperature: 0.7
    });
    console.log('Response:', response.text);
    console.log('Tokens used:', response.usage);
  } catch (error) {
    console.error('Completion failed:', error.message);
  }

  console.log('\n2. Testing chat completion...');
  try {
    const chatResponse = await aiService.completeChat({
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'What is 2+2?' }
      ],
      maxTokens: 50
    });
    console.log('Chat response:', chatResponse.text);
    console.log('Tokens used:', chatResponse.usage);
  } catch (error) {
    console.error('Chat completion failed:', error.message);
  }

  // Wait a moment for metrics to be recorded
  await new Promise(resolve => setTimeout(resolve, 1000));

  console.log('\n3. Checking AI model metrics...');
  const modelStatus = await getAIModelStatus();
  console.log('\nModel Status Report:');
  console.log('==================');
  
  modelStatus.forEach(model => {
    console.log(`\n${model.name} (${model.provider})`);
    console.log(`  Status: ${model.status}`);
    console.log(`  Load: ${model.load}%`);
    console.log(`  Requests/hour: ${model.requestsPerHour}`);
    if (model.avgResponseTime) {
      console.log(`  Avg Response Time: ${model.avgResponseTime}ms`);
    }
    if (model.errorRate !== undefined) {
      console.log(`  Error Rate: ${(model.errorRate * 100).toFixed(2)}%`);
    }
  });

  console.log('\n4. Testing error tracking...');
  try {
    // This should fail with an invalid model
    await aiService.complete('Test', {
      model: 'non-existent-model',
      maxTokens: 10
    });
  } catch (error) {
    console.log('Expected error caught:', error.message);
  }

  // Wait and check metrics again
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  console.log('\n5. Final metrics check...');
  const finalStatus = await getAIModelStatus();
  const activeModels = finalStatus.filter(m => m.requestsPerHour > 0);
  
  console.log('\nActive Models:');
  activeModels.forEach(model => {
    console.log(`- ${model.name}: ${model.requestsPerHour} requests/hour, ${model.load}% load`);
  });

  console.log('\nTest completed!');
}

// Run the test
testAIMetrics().catch(console.error);