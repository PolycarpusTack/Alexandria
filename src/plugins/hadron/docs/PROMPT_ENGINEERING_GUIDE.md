# Prompt Engineering Guide for Crash Analyzer

## Overview

The Crash Analyzer plugin includes a sophisticated prompt engineering system designed to optimize LLM analysis of crash logs. This system provides:

- **Specialized Templates**: Pre-built prompts for different crash types
- **Few-Shot Learning**: Curated examples to improve accuracy
- **Chain-of-Thought Reasoning**: Step-by-step analysis for complex issues
- **Model Optimizations**: Tailored prompts for different model sizes
- **Version Control**: Track and compare prompt performance
- **A/B Testing**: Experiment with prompt variations

## Architecture

```
prompt-engineering/
├── prompt-manager.ts       # Central coordinator
├── prompt-templates.ts     # Specialized crash templates  
├── few-shot-examples.ts    # Curated example library
├── chain-of-thought.ts     # Reasoning frameworks
├── model-optimizations.ts  # Model-specific tuning
├── prompt-versioning.ts    # Version tracking
└── ab-testing.ts          # Experimentation system
```

## Using the Prompt Engineering System

### Basic Usage

```typescript
import { PromptManager } from './prompt-engineering/prompt-manager';

// Generate an optimized prompt
const generatedPrompt = PromptManager.generatePrompt(parsedCrashData, {
  modelName: 'llama2:7b',
  includeExamples: true,
  useChainOfThought: false
});

// Use the generated prompt
const llmResponse = await callLLM(generatedPrompt.prompt);

// Record performance metrics
PromptManager.recordResult(generatedPrompt.metadata, {
  success: true,
  confidence: 0.85,
  inferenceTime: 1500,
  userFeedback: 'helpful'
});
```

### Specialized Templates

The system includes templates for common crash scenarios:

#### Memory Issues
- **Template ID**: `memory-leak-analysis`
- **Detects**: OutOfMemoryError, heap dumps, GC issues
- **Focus**: Object retention, allocation patterns, memory growth

#### Null Pointer Exceptions
- **Template ID**: `null-pointer-analysis`
- **Detects**: NPE, null references, uninitialized variables
- **Focus**: Null source tracking, defensive programming gaps

#### Concurrency Problems
- **Template ID**: `concurrency-deadlock`
- **Detects**: Deadlocks, race conditions, thread starvation
- **Focus**: Lock ordering, synchronization issues

#### Database/Connection Issues
- **Template ID**: `database-connection`
- **Detects**: Connection timeouts, pool exhaustion
- **Focus**: Pool configuration, query performance

#### Performance Degradation
- **Template ID**: `performance-degradation`
- **Detects**: Slow responses, CPU spikes, timeouts
- **Focus**: Bottlenecks, resource contention

### Few-Shot Learning

Include relevant examples to improve analysis accuracy:

```typescript
const result = PromptManager.generatePrompt(crashData, {
  modelName: 'llama2:13b',
  includeExamples: true,
  exampleCount: 3  // Will select most relevant examples
});
```

Examples are automatically selected based on:
- Error message similarity
- Stack trace patterns
- Crash type matching

### Chain-of-Thought Reasoning

For complex crashes, enable step-by-step analysis:

```typescript
const result = PromptManager.generatePrompt(crashData, {
  modelName: 'llama2:13b',
  useChainOfThought: true  // Enables systematic reasoning
});
```

Available reasoning templates:
- `complex-crash-analysis`: General multi-step analysis
- `memory-leak-investigation`: Memory-specific investigation
- `concurrency-debugging`: Thread and lock analysis

### Model-Specific Optimizations

The system automatically optimizes prompts based on model capabilities:

#### Small Models (1-3B)
- Simplified prompts without complex reasoning
- Single example maximum
- Focused on primary issue only
- Temperature: 0.1

#### Medium Models (7B)
- Standard templates with 2-3 examples
- Basic chain-of-thought support
- Multiple root causes
- Temperature: 0.15

#### Large Models (13B+)
- Full reasoning chains
- Multiple examples (3+)
- Comprehensive analysis
- Temperature: 0.2

#### Code-Specialized Models
- Enhanced code references
- Concrete fix suggestions
- Language-specific analysis

## Creating Custom Templates

### Define a New Template

```typescript
import { PromptManager, PromptTemplate } from './prompt-engineering';

const customTemplate: PromptTemplate = {
  id: 'custom-crash-type',
  name: 'Custom Crash Analysis',
  description: 'Template for specific crash pattern',
  crashTypes: ['CustomError', 'SpecificException'],
  template: `Analyze this {{errorType}} crash:

Error: {{errorMessage}}
Context: {{contextInfo}}

Identify:
1. Root cause
2. Impact
3. Solution

Format as JSON.`,
  variables: ['errorType', 'errorMessage', 'contextInfo'],
  modelRequirements: {
    minParameters: 7000000000,
    recommendedModels: ['llama2:7b', 'mistral:7b']
  }
};

// Register the template
PromptManager.createTemplate(customTemplate);
```

### Add Few-Shot Examples

```typescript
import { FewShotExamples } from './prompt-engineering';

FewShotExamples.addExample({
  id: 'custom-example-1',
  crashType: 'CustomError',
  input: {
    errorMessage: 'CustomError: Resource unavailable',
    stackTrace: 'at ResourceManager.acquire()...',
    context: { resourceType: 'database', poolSize: 10 }
  },
  output: {
    primaryError: 'Resource pool exhaustion',
    rootCause: 'Insufficient pool size for load',
    confidence: 0.9,
    fixes: [
      'Increase pool size to 50',
      'Implement connection timeout',
      'Add resource monitoring'
    ]
  }
});
```

## Version Management

### Creating Versions

```typescript
// Create a new version of a prompt
const newVersion = PromptManager.updateTemplate(
  'memory-leak-analysis',
  'Updated prompt content with improvements...',
  'Added better memory pattern detection'
);

// Activate the new version
PromptVersioning.activateVersion(newVersion.id);
```

### Comparing Versions

```typescript
const comparison = PromptVersioning.compareVersions(
  oldVersionId,
  newVersionId
);

console.log(`Success rate improvement: ${comparison.metrics.successRateDiff}%`);
console.log(`Confidence improvement: ${comparison.metrics.confidenceDiff}`);
```

## A/B Testing

### Setting Up an Experiment

```typescript
import { ABTestingSystem } from './prompt-engineering';

// Create experiment
const experiment = ABTestingSystem.createExperiment({
  name: 'Memory Prompt Optimization',
  description: 'Testing new memory leak detection prompts',
  variants: [
    {
      name: 'Control',
      promptVersionId: currentVersionId,
      trafficPercentage: 50
    },
    {
      name: 'Treatment', 
      promptVersionId: newVersionId,
      trafficPercentage: 50
    }
  ],
  targetSampleSize: 1000,
  successMetrics: ['successRate', 'confidence', 'inferenceTime']
});

// Start the experiment
ABTestingSystem.startExperiment(experiment.id);
```

### Using Experiments in Analysis

```typescript
const result = PromptManager.generatePrompt(crashData, {
  modelName: 'llama2:7b',
  experimentId: experiment.id  // Automatically selects variant
});
```

### Analyzing Results

```typescript
const experiment = ABTestingSystem.getExperiment(experimentId);

if (experiment.status === 'completed') {
  console.log(`Winner: ${experiment.results.winner}`);
  console.log(`Improvement: ${experiment.results.improvementPercentage}%`);
  console.log(`Confidence: ${experiment.results.confidence}%`);
}
```

## Performance Monitoring

### View Template Performance

```typescript
const report = PromptManager.getPerformanceReport('memory-leak-analysis');

console.log(`Active version: v${report.activeVersion.version}`);
console.log(`Success rate: ${report.activeVersion.metrics.successRate}`);
console.log(`Avg confidence: ${report.activeVersion.metrics.avgConfidence}`);
console.log(`Avg inference time: ${report.activeVersion.metrics.avgInferenceTime}ms`);
```

### Best Practices

1. **Start Simple**: Use basic templates before enabling advanced features
2. **Monitor Metrics**: Track success rates and confidence scores
3. **Iterate Gradually**: Make small changes and test thoroughly
4. **Model Matching**: Use appropriate features for model capabilities
5. **User Feedback**: Incorporate user ratings into optimization

## Troubleshooting

### Low Success Rates

1. Check if examples are relevant to crash types
2. Verify model has sufficient parameters
3. Simplify prompts for smaller models
4. Add more specific templates

### High Inference Times

1. Reduce prompt length for small models
2. Disable chain-of-thought for simple crashes
3. Limit example count
4. Use model-specific optimizations

### Poor Analysis Quality

1. Add more few-shot examples
2. Enable chain-of-thought reasoning
3. Create specialized templates
4. Use larger models for complex crashes

## Future Enhancements

- **Automatic Template Generation**: Learn templates from successful analyses
- **Dynamic Example Selection**: ML-based example matching
- **Multi-Model Ensemble**: Combine outputs from multiple models
- **Prompt Compression**: Automatic prompt optimization for token limits
- **Cross-Language Support**: Templates for different programming languages