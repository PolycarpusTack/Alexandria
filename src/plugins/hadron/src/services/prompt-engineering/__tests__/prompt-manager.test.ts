/**
 * Tests for the Prompt Manager and prompt engineering system
 */

import { PromptManager } from '../prompt-manager';
import { PromptTemplates } from '../prompt-templates';
import { FewShotExamples } from '../few-shot-examples';
import { ChainOfThoughtReasoning } from '../chain-of-thought';
import { ModelOptimizations } from '../model-optimizations';
import { PromptVersioning } from '../prompt-versioning';
import { ABTestingSystem } from '../ab-testing';
import { ParsedCrashData } from '../../../interfaces';

describe('PromptManager', () => {
  beforeEach(() => {
    // Initialize the prompt manager
    PromptManager.initialize();
  });

  describe('generatePrompt', () => {
    it('should generate a basic prompt for simple crash', () => {
      const crashData: ParsedCrashData = {
        errorMessages: [
          {
            message: 'NullPointerException at com.app.UserService.getUser',
            level: 'ERROR',
            timestamp: new Date()
          }
        ],
        stackTraces: [
          {
            message: 'NullPointerException',
            frames: [
              {
                functionName: 'getUser',
                fileName: 'UserService.java',
                lineNumber: 45
              }
            ]
          }
        ],
        systemInfo: {
          os: 'Linux',
          version: '5.0'
        },
        timestamps: [new Date()],
        logLevel: { ERROR: 1 },
        metadata: {
          detectedLogType: 'java',
          parseWarnings: []
        },
        additionalContext: {}
      };

      const result = PromptManager.generatePrompt(crashData, {
        modelName: 'llama2:7b',
        includeExamples: false,
        useChainOfThought: false
      });

      expect(result.prompt).toBeDefined();
      expect(result.prompt).toContain('NullPointerException');
      expect(result.metadata.template).toBeDefined();
      expect(result.metadata.template?.id).toBe('null-pointer-analysis');
    });

    it('should include few-shot examples when requested', () => {
      const crashData: ParsedCrashData = {
        errorMessages: [
          {
            message: 'java.lang.OutOfMemoryError: Java heap space',
            level: 'ERROR',
            timestamp: new Date()
          }
        ],
        stackTraces: [],
        systemInfo: {},
        timestamps: [],
        logLevel: { ERROR: 1 },
        metadata: { detectedLogType: 'java', parseWarnings: [] },
        additionalContext: {}
      };

      const result = PromptManager.generatePrompt(crashData, {
        modelName: 'llama2:13b',
        includeExamples: true,
        exampleCount: 2
      });

      expect(result.prompt).toContain('similar examples');
      expect(result.metadata.examples).toBeDefined();
      expect(result.metadata.examples!.length).toBeGreaterThan(0);
    });

    it('should use chain-of-thought for complex crashes', () => {
      const crashData: ParsedCrashData = {
        errorMessages: [
          {
            message: 'Deadlock detected',
            level: 'ERROR',
            timestamp: new Date()
          }
        ],
        stackTraces: Array(5).fill({
          message: 'Thread blocked',
          frames: Array(20).fill({
            functionName: 'lock',
            fileName: 'Sync.java',
            lineNumber: 100
          })
        }),
        systemInfo: {},
        timestamps: Array(100).fill(new Date()),
        logLevel: { ERROR: 10, WARN: 20 },
        metadata: { detectedLogType: 'java', parseWarnings: [] },
        additionalContext: {
          threads: { count: 50, blocked: 10 }
        }
      };

      const result = PromptManager.generatePrompt(crashData, {
        modelName: 'llama2:13b',
        useChainOfThought: true
      });

      expect(result.prompt).toContain('Step');
      expect(result.metadata.chainOfThought).toBeDefined();
      expect(result.metadata.chainOfThought?.id).toBe('concurrency-debugging');
    });
  });

  describe('Template Selection', () => {
    it('should select memory leak template for OOM errors', () => {
      const crashData: ParsedCrashData = {
        errorMessages: [
          {
            message: 'java.lang.OutOfMemoryError: unable to create new native thread',
            level: 'ERROR',
            timestamp: new Date()
          }
        ],
        stackTraces: [],
        systemInfo: {},
        timestamps: [],
        logLevel: { ERROR: 1 },
        metadata: { detectedLogType: 'java', parseWarnings: [] },
        additionalContext: {}
      };

      const template = PromptTemplates.findBestTemplate(crashData);
      expect(template).toBeDefined();
      expect(template?.id).toBe('memory-leak-analysis');
    });

    it('should select deadlock template for concurrency issues', () => {
      const crashData: ParsedCrashData = {
        errorMessages: [
          {
            message: 'Deadlock detected in thread pool',
            level: 'ERROR',
            timestamp: new Date()
          }
        ],
        stackTraces: [],
        systemInfo: {},
        timestamps: [],
        logLevel: { ERROR: 1 },
        metadata: { detectedLogType: 'java', parseWarnings: [] },
        additionalContext: {}
      };

      const template = PromptTemplates.findBestTemplate(crashData);
      expect(template).toBeDefined();
      expect(template?.id).toBe('concurrency-deadlock');
    });
  });

  describe('Model Optimizations', () => {
    it('should optimize prompts for small models', () => {
      const longPrompt =
        'Step 1: Analyze this\nStep 2: Think about that\n' +
        'Follow these steps carefully:\n' +
        'x'.repeat(5000);

      const optimized = ModelOptimizations.optimizePrompt(longPrompt, 'phi:2b');

      expect(optimized.length).toBeLessThan(longPrompt.length);
      expect(optimized).not.toContain('Step 1:');
      expect(optimized).toContain('Analyze');
    });

    it('should get correct parameters for quantized models', () => {
      const params = ModelOptimizations.getModelParameters('llama2:7b-q4');

      expect(params.temperature).toBe(0.1);
      expect(params.top_p).toBe(0.9);
      expect(params.repeat_penalty).toBe(1.1);
    });

    it('should recommend fewer examples for small models', () => {
      const count = ModelOptimizations.getRecommendedExampleCount('phi:2b');
      expect(count).toBe(1);
    });
  });

  describe('Prompt Versioning', () => {
    it('should create and activate new versions', () => {
      const version1 = PromptVersioning.createVersion('test-prompt', 'Initial prompt content', {
        description: 'First version'
      });

      expect(version1.version).toBe(1);
      expect(version1.status).toBe('draft');

      PromptVersioning.activateVersion(version1.id);
      const active = PromptVersioning.getActiveVersion('test-prompt');

      expect(active?.id).toBe(version1.id);
      expect(active?.status).toBe('active');
    });

    it('should track metrics correctly', () => {
      const version = PromptVersioning.createVersion('test-prompt-metrics', 'Test prompt', {});

      // Record multiple results
      PromptVersioning.updateMetrics(version.id, {
        success: true,
        confidence: 0.8,
        inferenceTime: 1000
      });

      PromptVersioning.updateMetrics(version.id, {
        success: false,
        confidence: 0.4,
        inferenceTime: 2000
      });

      const updated = PromptVersioning.getVersion(version.id);
      expect(updated?.metrics.usageCount).toBe(2);
      expect(updated?.metrics.successRate).toBe(0.5);
      expect(updated?.metrics.avgConfidence).toBe(0.6);
      expect(updated?.metrics.avgInferenceTime).toBe(1500);
    });
  });

  describe('A/B Testing', () => {
    it('should create and run experiments', () => {
      // Create two prompt versions
      const versionA = PromptVersioning.createVersion('ab-test-prompt', 'Prompt A', {});
      const versionB = PromptVersioning.createVersion('ab-test-prompt', 'Prompt B', {});

      const experiment = ABTestingSystem.createExperiment({
        name: 'Test Experiment',
        description: 'Testing prompt variations',
        variants: [
          { name: 'Control', promptVersionId: versionA.id, trafficPercentage: 50 },
          { name: 'Treatment', promptVersionId: versionB.id, trafficPercentage: 50 }
        ],
        targetSampleSize: 100,
        successMetrics: ['successRate', 'confidence']
      });

      expect(experiment.status).toBe('draft');

      ABTestingSystem.startExperiment(experiment.id);
      const running = ABTestingSystem.getExperiment(experiment.id);
      expect(running?.status).toBe('running');

      // Simulate traffic allocation
      const selections = new Map<string, number>();
      for (let i = 0; i < 100; i++) {
        const variant = ABTestingSystem.selectVariant(experiment.id);
        if (variant) {
          selections.set(variant.id, (selections.get(variant.id) || 0) + 1);
        }
      }

      // Should be roughly 50/50 split
      const counts = Array.from(selections.values());
      expect(counts.length).toBe(2);
      counts.forEach((count) => {
        expect(count).toBeGreaterThan(30);
        expect(count).toBeLessThan(70);
      });
    });
  });

  describe('Integration', () => {
    it('should handle full prompt generation with A/B testing', () => {
      // Setup A/B test
      const templateId = 'memory-leak-analysis';
      const versions = PromptVersioning.getVersionHistory(templateId);

      if (versions.length >= 1) {
        const newVersion = PromptVersioning.createVersion(
          templateId,
          PromptTemplates.getTemplate(templateId)!.template + '\n\nOptimized version.',
          { description: 'Optimized prompt' }
        );

        const experiment = ABTestingSystem.createExperiment({
          name: 'Memory Leak Prompt Test',
          description: 'Testing optimized memory leak prompts',
          variants: [
            { name: 'Original', promptVersionId: versions[0].id, trafficPercentage: 50 },
            { name: 'Optimized', promptVersionId: newVersion.id, trafficPercentage: 50 }
          ],
          targetSampleSize: 50,
          successMetrics: ['successRate', 'inferenceTime']
        });

        ABTestingSystem.startExperiment(experiment.id);

        // Generate prompts and record results
        const crashData: ParsedCrashData = {
          errorMessages: [
            {
              message: 'java.lang.OutOfMemoryError: Java heap space',
              level: 'ERROR',
              timestamp: new Date()
            }
          ],
          stackTraces: [],
          systemInfo: {},
          timestamps: [],
          logLevel: { ERROR: 1 },
          metadata: { detectedLogType: 'java', parseWarnings: [] },
          additionalContext: {}
        };

        for (let i = 0; i < 10; i++) {
          const result = PromptManager.generatePrompt(crashData, {
            modelName: 'llama2:7b',
            experimentId: experiment.id
          });

          // Simulate analysis result
          PromptManager.recordResult(result.metadata, {
            success: Math.random() > 0.3,
            confidence: Math.random() * 0.5 + 0.5,
            inferenceTime: Math.random() * 2000 + 1000
          });
        }

        // Check experiment progress
        const updatedExperiment = ABTestingSystem.getExperiment(experiment.id);
        expect(updatedExperiment?.currentSampleSize).toBeGreaterThan(0);
      }
    });
  });
});
