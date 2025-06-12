/**
 * Model-Specific Optimizations for Crash Analysis
 *
 * Optimizes prompts and parameters for different LLM models
 */

export interface ModelOptimization {
  modelPattern: RegExp; // Pattern to match model names
  name: string;
  description: string;
  parameterRange: {
    min: number;
    max: number;
  };
  promptOptimizations: {
    maxTokens?: number;
    temperature?: number;
    topP?: number;
    topK?: number;
    repeatPenalty?: number;
    systemPrompt?: string;
    formatHints?: string[];
    avoidPatterns?: string[];
  };
  capabilities: {
    supportsJSON: boolean;
    supportsChainOfThought: boolean;
    maxContextLength: number;
    preferredExampleCount: number;
  };
}

export class ModelOptimizations {
  private static optimizations: ModelOptimization[] = [];

  static {
    this.initializeOptimizations();
  }

  /**
   * Initialize model-specific optimizations
   */
  private static initializeOptimizations(): void {
    // Small models (1B-3B parameters)
    this.addOptimization({
      modelPattern: /^(phi|tinyllama|stablelm).*[1-3]b/i,
      name: 'Small Models (1-3B)',
      description: 'Optimizations for very small models',
      parameterRange: { min: 1e9, max: 3e9 },
      promptOptimizations: {
        maxTokens: 512,
        temperature: 0.1,
        topP: 0.9,
        repeatPenalty: 1.1,
        formatHints: [
          'Respond with simple JSON only',
          'Be concise and direct',
          'Focus on the primary issue'
        ],
        avoidPatterns: ['complex reasoning chains', 'detailed explanations', 'multiple hypotheses']
      },
      capabilities: {
        supportsJSON: true,
        supportsChainOfThought: false,
        maxContextLength: 2048,
        preferredExampleCount: 1
      }
    });

    // Medium models (7B parameters)
    this.addOptimization({
      modelPattern: /^(llama2?|mistral|vicuna|zephyr).*7b/i,
      name: 'Medium Models (7B)',
      description: 'Optimizations for 7B parameter models',
      parameterRange: { min: 6e9, max: 8e9 },
      promptOptimizations: {
        maxTokens: 1024,
        temperature: 0.15,
        topP: 0.95,
        topK: 40,
        repeatPenalty: 1.05,
        systemPrompt:
          'You are a technical expert analyzing software crashes. Be precise and structured.',
        formatHints: [
          'Provide analysis in clean JSON format',
          'Include confidence scores',
          'List 2-3 root causes maximum'
        ]
      },
      capabilities: {
        supportsJSON: true,
        supportsChainOfThought: true,
        maxContextLength: 4096,
        preferredExampleCount: 2
      }
    });

    // Large models (13B parameters)
    this.addOptimization({
      modelPattern: /^(llama2?|vicuna|wizard).*13b/i,
      name: 'Large Models (13B)',
      description: 'Optimizations for 13B parameter models',
      parameterRange: { min: 12e9, max: 14e9 },
      promptOptimizations: {
        maxTokens: 2048,
        temperature: 0.2,
        topP: 0.95,
        topK: 50,
        repeatPenalty: 1.02,
        systemPrompt:
          'You are an expert software engineer specializing in crash analysis and debugging. Provide thorough technical analysis.',
        formatHints: [
          'Use structured JSON with detailed fields',
          'Include supporting evidence for each finding',
          'Provide comprehensive troubleshooting steps'
        ]
      },
      capabilities: {
        supportsJSON: true,
        supportsChainOfThought: true,
        maxContextLength: 8192,
        preferredExampleCount: 3
      }
    });

    // Code-specialized models
    this.addOptimization({
      modelPattern: /^(codellama|deepseek-coder|starcoder)/i,
      name: 'Code-Specialized Models',
      description: 'Optimizations for code-focused models',
      parameterRange: { min: 1e9, max: 70e9 },
      promptOptimizations: {
        maxTokens: 2048,
        temperature: 0.1,
        topP: 0.95,
        repeatPenalty: 1.0,
        systemPrompt:
          'Analyze this code crash with focus on implementation details and code-level fixes.',
        formatHints: [
          'Include code snippets in solutions',
          'Reference specific functions and lines',
          'Suggest concrete code changes'
        ]
      },
      capabilities: {
        supportsJSON: true,
        supportsChainOfThought: true,
        maxContextLength: 16384,
        preferredExampleCount: 2
      }
    });

    // Instruction-tuned models
    this.addOptimization({
      modelPattern: /(instruct|chat|alpaca)/i,
      name: 'Instruction-Tuned Models',
      description: 'Optimizations for instruction-following models',
      parameterRange: { min: 1e9, max: 100e9 },
      promptOptimizations: {
        maxTokens: 1536,
        temperature: 0.15,
        topP: 0.9,
        systemPrompt: 'Follow the analysis format exactly. Be systematic and thorough.',
        formatHints: [
          'Follow the specified JSON schema precisely',
          'Complete all required fields',
          'Maintain consistent formatting'
        ]
      },
      capabilities: {
        supportsJSON: true,
        supportsChainOfThought: true,
        maxContextLength: 4096,
        preferredExampleCount: 2
      }
    });

    // Quantized models
    this.addOptimization({
      modelPattern: /-(q[2-5]|gguf|ggml)/i,
      name: 'Quantized Models',
      description: 'Optimizations for quantized models',
      parameterRange: { min: 1e9, max: 100e9 },
      promptOptimizations: {
        maxTokens: 1024,
        temperature: 0.1, // Lower temp for quantized models
        topP: 0.9,
        repeatPenalty: 1.1,
        formatHints: [
          'Keep analysis focused and direct',
          'Avoid overly complex reasoning',
          'Prioritize accuracy over creativity'
        ]
      },
      capabilities: {
        supportsJSON: true,
        supportsChainOfThought: false, // Simplified for quantized
        maxContextLength: 2048,
        preferredExampleCount: 1
      }
    });
  }

  /**
   * Add a new optimization
   */
  static addOptimization(optimization: ModelOptimization): void {
    this.optimizations.push(optimization);
  }

  /**
   * Get optimization for a model
   */
  static getOptimization(modelName: string): ModelOptimization | null {
    // Find first matching optimization
    for (const opt of this.optimizations) {
      if (opt.modelPattern.test(modelName)) {
        return opt;
      }
    }

    // Return default optimization
    return this.getDefaultOptimization();
  }

  /**
   * Get default optimization for unknown models
   */
  private static getDefaultOptimization(): ModelOptimization {
    return {
      modelPattern: /.*/,
      name: 'Default',
      description: 'Default settings for unknown models',
      parameterRange: { min: 1e9, max: 100e9 },
      promptOptimizations: {
        maxTokens: 1024,
        temperature: 0.2,
        topP: 0.95,
        formatHints: ['Provide structured JSON output']
      },
      capabilities: {
        supportsJSON: true,
        supportsChainOfThought: false,
        maxContextLength: 4096,
        preferredExampleCount: 1
      }
    };
  }

  /**
   * Optimize prompt for specific model
   */
  static optimizePrompt(prompt: string, modelName: string): string {
    const optimization = this.getOptimization(modelName);
    if (!optimization) return prompt;

    let optimizedPrompt = prompt;

    // Add system prompt if available
    if (optimization.promptOptimizations.systemPrompt) {
      optimizedPrompt = `${optimization.promptOptimizations.systemPrompt}\n\n${optimizedPrompt}`;
    }

    // Add format hints
    if (optimization.promptOptimizations.formatHints?.length) {
      const hints = optimization.promptOptimizations.formatHints.join('\n- ');
      optimizedPrompt += `\n\nFormatting requirements:\n- ${hints}`;
    }

    // Simplify for models that don't support chain-of-thought
    if (!optimization.capabilities.supportsChainOfThought && prompt.includes('Step ')) {
      optimizedPrompt = this.simplifyChainOfThought(optimizedPrompt);
    }

    // Truncate if needed
    if (optimization.capabilities.maxContextLength < optimizedPrompt.length) {
      optimizedPrompt = this.intelligentTruncate(
        optimizedPrompt,
        optimization.capabilities.maxContextLength * 0.8 // Leave room for response
      );
    }

    return optimizedPrompt;
  }

  /**
   * Get model parameters for Ollama
   */
  static getModelParameters(modelName: string): Record<string, any> {
    const optimization = this.getOptimization(modelName);
    if (!optimization) return {};

    const params: Record<string, any> = {};
    const opts = optimization.promptOptimizations;

    if (opts.temperature !== undefined) params.temperature = opts.temperature;
    if (opts.topP !== undefined) params.top_p = opts.topP;
    if (opts.topK !== undefined) params.top_k = opts.topK;
    if (opts.repeatPenalty !== undefined) params.repeat_penalty = opts.repeatPenalty;
    if (opts.maxTokens !== undefined) params.num_predict = opts.maxTokens;

    return params;
  }

  /**
   * Simplify chain-of-thought for smaller models
   */
  private static simplifyChainOfThought(prompt: string): string {
    // Remove step-by-step instructions
    let simplified = prompt.replace(/Step \d+:.*?\n/g, '');

    // Consolidate the ask
    simplified = simplified.replace(/Follow these steps.*?:\n/i, 'Analyze and provide:\n');

    // Remove complex reasoning requirements
    simplified = simplified.replace(
      /Think through.*?systematically.*?\./gi,
      'Provide your analysis.'
    );

    return simplified;
  }

  /**
   * Intelligently truncate prompt preserving key information
   */
  private static intelligentTruncate(prompt: string, maxLength: number): string {
    if (prompt.length <= maxLength) return prompt;

    // Priority sections to preserve
    const sections = [
      { pattern: /Your Task:[\s\S]*?(?=\n## |$)/i, priority: 1 },
      { pattern: /Error Messages:[\s\S]*?(?=\n## |$)/i, priority: 2 },
      { pattern: /Stack Trace:[\s\S]*?(?=\n## |$)/i, priority: 3 },
      { pattern: /JSON format:[\s\S]*?}$/i, priority: 1 }
    ];

    // Extract priority content
    let priorityContent = '';
    for (const section of sections.sort((a, b) => a.priority - b.priority)) {
      const match = prompt.match(section.pattern);
      if (match) {
        priorityContent += match[0] + '\n\n';
      }
    }

    // If priority content fits, use it
    if (priorityContent.length <= maxLength) {
      return priorityContent.trim();
    }

    // Otherwise, simple truncate with ellipsis
    return prompt.substring(0, maxLength - 20) + '\n\n[Content truncated...]';
  }

  /**
   * Check if model supports a feature
   */
  static modelSupports(
    modelName: string,
    feature: keyof ModelOptimization['capabilities']
  ): boolean {
    const optimization = this.getOptimization(modelName);
    return optimization?.capabilities[feature] ?? false;
  }

  /**
   * Get recommended example count for model
   */
  static getRecommendedExampleCount(modelName: string): number {
    const optimization = this.getOptimization(modelName);
    return optimization?.capabilities.preferredExampleCount ?? 1;
  }
}
