/**
 * Prompt Manager - Central coordinator for prompt engineering
 * 
 * Integrates all prompt engineering components
 */

import { ParsedCrashData } from '../../interfaces';
import { PromptTemplates, PromptTemplate } from './prompt-templates';
import { FewShotExamples, FewShotExample } from './few-shot-examples';
import { ChainOfThoughtReasoning, ChainOfThoughtTemplate } from './chain-of-thought';
import { ModelOptimizations } from './model-optimizations';
import { PromptVersioning, PromptVersion } from './prompt-versioning';
import { ABTestingSystem, ABTestVariant } from './ab-testing';

export interface PromptGenerationOptions {
  modelName: string;
  includeExamples?: boolean;
  exampleCount?: number;
  useChainOfThought?: boolean;
  experimentId?: string; // For A/B testing
  customTemplate?: string;
  additionalContext?: Record<string, any>;
}

export interface GeneratedPrompt {
  prompt: string;
  metadata: {
    template?: PromptTemplate;
    examples?: FewShotExample[];
    chainOfThought?: ChainOfThoughtTemplate;
    version?: PromptVersion;
    variant?: ABTestVariant;
    modelOptimizations?: Record<string, any>;
  };
}

export class PromptManager {
  private static initialized = false;

  /**
   * Initialize the prompt manager
   */
  static initialize(): void {
    if (this.initialized) return;

    // Create default prompt versions for each template
    const templates = PromptTemplates.getAllTemplates();
    for (const template of templates) {
      PromptVersioning.createVersion(
        template.id,
        template.template,
        {
          description: `Initial version of ${template.name}`,
          tags: template.crashTypes
        }
      );
      
      // Activate the first version
      const versions = PromptVersioning.getVersionHistory(template.id);
      if (versions.length > 0) {
        PromptVersioning.activateVersion(versions[0].id);
      }
    }

    this.initialized = true;
  }

  /**
   * Generate an optimized prompt for crash analysis
   */
  static generatePrompt(
    crashData: ParsedCrashData,
    options: PromptGenerationOptions
  ): GeneratedPrompt {
    this.initialize();

    const metadata: GeneratedPrompt['metadata'] = {
      modelOptimizations: ModelOptimizations.getModelParameters(options.modelName)
    };

    // Handle A/B testing if experiment is active
    let promptTemplate: PromptTemplate | null = null;
    let promptVersion: PromptVersion | null = null;

    if (options.experimentId) {
      const variant = ABTestingSystem.selectVariant(options.experimentId);
      if (variant) {
        metadata.variant = variant;
        promptVersion = PromptVersioning.getVersion(variant.promptVersionId);
        if (promptVersion) {
          metadata.version = promptVersion;
          // Extract template from version
          const templateId = promptVersion.promptId;
          promptTemplate = PromptTemplates.getTemplate(templateId) || null;
        }
      }
    }

    // If no A/B test or it failed, use normal selection
    if (!promptTemplate) {
      if (options.customTemplate) {
        // Use custom template directly
        return {
          prompt: options.customTemplate,
          metadata
        };
      }

      // Find best template for crash type
      promptTemplate = PromptTemplates.findBestTemplate(crashData);
      
      if (promptTemplate) {
        metadata.template = promptTemplate;
        
        // Get active version for this template
        promptVersion = PromptVersioning.getActiveVersion(promptTemplate.id);
        if (promptVersion) {
          metadata.version = promptVersion;
        }
      }
    }

    // Build base prompt
    let prompt = '';
    
    if (promptTemplate && promptVersion) {
      prompt = PromptTemplates.fillTemplate(
        promptTemplate, 
        crashData, 
        options.additionalContext
      );
    } else {
      // Fallback to generic prompt
      prompt = this.buildGenericPrompt(crashData);
    }

    // Add few-shot examples if requested
    if (options.includeExamples) {
      const examples = this.selectExamples(crashData, options);
      if (examples.length > 0) {
        metadata.examples = examples;
        prompt = this.addExamplesToPrompt(prompt, examples);
      }
    }

    // Apply chain-of-thought if requested and model supports it
    if (options.useChainOfThought && 
        ModelOptimizations.modelSupports(options.modelName, 'supportsChainOfThought')) {
      const cotTemplate = this.selectChainOfThought(crashData);
      if (cotTemplate) {
        metadata.chainOfThought = cotTemplate;
        prompt = ChainOfThoughtReasoning.buildReasoningPrompt(
          cotTemplate.id,
          crashData
        );
      }
    }

    // Apply model-specific optimizations
    prompt = ModelOptimizations.optimizePrompt(prompt, options.modelName);

    return { prompt, metadata };
  }

  /**
   * Record the result of a prompt execution
   */
  static recordResult(
    metadata: GeneratedPrompt['metadata'],
    result: {
      success: boolean;
      confidence: number;
      inferenceTime: number;
      userFeedback?: 'helpful' | 'not-helpful';
      leadToResolution?: boolean;
    }
  ): void {
    // Update version metrics
    if (metadata.version) {
      PromptVersioning.updateMetrics(metadata.version.id, result);
    }

    // Update A/B test metrics
    if (metadata.variant) {
      const experimentId = this.findExperimentId(metadata.variant.id);
      if (experimentId) {
        ABTestingSystem.recordResult(
          experimentId,
          metadata.variant.id,
          result
        );
      }
    }
  }

  /**
   * Select few-shot examples
   */
  private static selectExamples(
    crashData: ParsedCrashData,
    options: PromptGenerationOptions
  ): FewShotExample[] {
    const maxExamples = options.exampleCount || 
      ModelOptimizations.getRecommendedExampleCount(options.modelName);

    // Get relevant examples
    const errorMessage = crashData.errorMessages[0]?.message || '';
    const stackTrace = crashData.stackTraces[0]?.frames
      .map(f => `at ${f.functionName} (${f.fileName}:${f.lineNumber})`)
      .join('\n') || '';

    return FewShotExamples.findRelevantExamples(
      errorMessage,
      stackTrace,
      maxExamples
    );
  }

  /**
   * Select chain-of-thought template
   */
  private static selectChainOfThought(crashData: ParsedCrashData): ChainOfThoughtTemplate | null {
    // Determine error type
    const errorType = this.detectErrorType(crashData);
    return ChainOfThoughtReasoning.getTemplateForError(errorType);
  }

  /**
   * Detect error type from crash data
   */
  private static detectErrorType(crashData: ParsedCrashData): string {
    const errorMessage = crashData.errorMessages[0]?.message.toLowerCase() || '';
    
    if (errorMessage.includes('outofmemory') || errorMessage.includes('heap')) {
      return 'OutOfMemoryError';
    }
    if (errorMessage.includes('nullpointer') || errorMessage.includes('null reference')) {
      return 'NullPointerException';
    }
    if (errorMessage.includes('deadlock')) {
      return 'Deadlock';
    }
    if (errorMessage.includes('timeout') || errorMessage.includes('connection')) {
      return 'ConnectionTimeout';
    }
    
    return 'default';
  }

  /**
   * Add examples to prompt
   */
  private static addExamplesToPrompt(prompt: string, examples: FewShotExample[]): string {
    const examplesText = FewShotExamples.formatExamplesForPrompt(examples);
    
    return `Here are some similar examples to guide your analysis:

${examplesText}

Now analyze the following crash:

${prompt}`;
  }

  /**
   * Build generic fallback prompt
   */
  private static buildGenericPrompt(crashData: ParsedCrashData): string {
    const errorMessages = crashData.errorMessages.map(e => e.message).join('\n');
    const stackTraces = crashData.stackTraces.map(st => {
      const frames = st.frames.map(f => 
        `  at ${f.functionName || 'unknown'} (${f.fileName || 'unknown'}:${f.lineNumber || '?'})`
      ).join('\n');
      return `${st.message || 'Stack Trace'}:\n${frames}`;
    }).join('\n\n');

    return `Analyze this software crash and provide a structured analysis.

## Error Messages
${errorMessages || 'No error messages found'}

## Stack Traces  
${stackTraces || 'No stack traces found'}

## Analysis Required
1. Identify the primary error and failing component
2. Determine 2-3 potential root causes with confidence levels
3. Provide specific troubleshooting steps
4. Summarize the issue concisely

Format your response as JSON with these fields:
{
  "primaryError": "string",
  "failingComponent": "string", 
  "potentialRootCauses": [{
    "cause": "string",
    "confidence": number (0-1),
    "explanation": "string",
    "supportingEvidence": ["string"]
  }],
  "troubleshootingSteps": ["string"],
  "summary": "string"
}`;
  }

  /**
   * Find experiment ID for a variant
   */
  private static findExperimentId(variantId: string): string | null {
    const experiments = ABTestingSystem.getAllExperiments();
    for (const exp of experiments) {
      if (exp.variants.some(v => v.id === variantId)) {
        return exp.id;
      }
    }
    return null;
  }

  /**
   * Create a new prompt template
   */
  static createTemplate(template: PromptTemplate): void {
    PromptTemplates.registerTemplate(template);
    
    // Create initial version
    const version = PromptVersioning.createVersion(
      template.id,
      template.template,
      {
        description: `Initial version of ${template.name}`,
        tags: template.crashTypes
      }
    );
    
    // Activate it
    PromptVersioning.activateVersion(version.id);
  }

  /**
   * Update a prompt template
   */
  static updateTemplate(
    templateId: string, 
    newContent: string,
    changelog: string
  ): PromptVersion {
    const version = PromptVersioning.createVersion(
      templateId,
      newContent,
      {
        changelog,
        description: `Updated: ${changelog}`
      }
    );
    
    return version;
  }

  /**
   * Get prompt performance report
   */
  static getPerformanceReport(templateId: string): any {
    const versions = PromptVersioning.getVersionHistory(templateId);
    const template = PromptTemplates.getTemplate(templateId);
    
    return {
      template: {
        id: templateId,
        name: template?.name,
        crashTypes: template?.crashTypes
      },
      versions: versions.map(v => ({
        version: v.version,
        status: v.status,
        metrics: v.metrics,
        createdAt: v.createdAt
      })),
      bestVersion: PromptVersioning.getBestVersion(templateId),
      activeVersion: PromptVersioning.getActiveVersion(templateId)
    };
  }
}