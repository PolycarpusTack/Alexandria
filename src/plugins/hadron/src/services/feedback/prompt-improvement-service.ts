/**
 * Prompt Improvement Service
 * 
 * Uses feedback data to automatically improve prompts over time
 */

import { FeedbackService, AnalysisFeedback } from './feedback-service';
import { PromptManager } from '../prompt-engineering/prompt-manager';
import { PromptVersioning } from '../prompt-engineering/prompt-versioning';
import { ABTestingSystem } from '../prompt-engineering/ab-testing';
import { Logger } from '@utils/logger';

interface PromptImprovementConfig {
  minFeedbackForImprovement: number;
  improvementThreshold: number;
  experimentDuration: number; // days
  confidenceLevel: number;
}

interface ImprovementSuggestion {
  promptId: string;
  currentPerformance: {
    avgRating: number;
    avgAccuracy: number;
    sampleSize: number;
  };
  suggestedChanges: string[];
  expectedImprovement: number;
  confidence: number;
}

export class PromptImprovementService {
  private readonly config: PromptImprovementConfig = {
    minFeedbackForImprovement: 50,
    improvementThreshold: 0.7, // Improve prompts with < 70% satisfaction
    experimentDuration: 14, // 2 weeks
    confidenceLevel: 0.95
  };

  constructor(
    private feedbackService: FeedbackService,
    private logger: Logger,
    config?: Partial<PromptImprovementConfig>
  ) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  /**
   * Analyze feedback and suggest prompt improvements
   */
  async analyzeAndSuggestImprovements(): Promise<ImprovementSuggestion[]> {
    try {
      // Get feedback statistics
      const stats = await this.feedbackService.getFeedbackStats();
      
      if (stats.totalFeedback < this.config.minFeedbackForImprovement) {
        this.logger.info('Insufficient feedback for improvement analysis', {
          currentFeedback: stats.totalFeedback,
          required: this.config.minFeedbackForImprovement
        });
        return [];
      }

      // Analyze feedback patterns
      const patterns = await this.feedbackService.analyzeFeedbackPatterns({
        minSampleSize: 10
      });

      // Get all active prompts
      const activePrompts = this.getActivePrompts();
      const suggestions: ImprovementSuggestion[] = [];

      for (const promptId of activePrompts) {
        const performance = await this.analyzePromptPerformance(promptId);
        
        if (performance.avgRating < this.config.improvementThreshold * 5) {
          const suggestion = await this.generateImprovementSuggestion(
            promptId,
            performance,
            patterns
          );
          
          if (suggestion) {
            suggestions.push(suggestion);
          }
        }
      }

      return suggestions;
    } catch (error) {
      this.logger.error('Error analyzing prompt improvements:', error);
      return [];
    }
  }

  /**
   * Automatically implement and test prompt improvements
   */
  async implementImprovements(
    suggestions: ImprovementSuggestion[],
    autoApprove: boolean = false
  ): Promise<void> {
    for (const suggestion of suggestions) {
      try {
        // Create improved version
        const improvedPrompt = await this.createImprovedPrompt(suggestion);
        
        // Set up A/B test
        const experiment = await this.setupExperiment(
          suggestion.promptId,
          improvedPrompt.id,
          suggestion
        );

        this.logger.info('Created prompt improvement experiment', {
          promptId: suggestion.promptId,
          experimentId: experiment.id,
          expectedImprovement: suggestion.expectedImprovement
        });

        // If auto-approve is enabled, start the experiment immediately
        if (autoApprove) {
          ABTestingSystem.startExperiment(experiment.id);
        }
      } catch (error) {
        this.logger.error('Error implementing improvement:', {
          promptId: suggestion.promptId,
          error
        });
      }
    }
  }

  /**
   * Monitor ongoing experiments and apply successful improvements
   */
  async monitorAndApplyImprovements(): Promise<void> {
    try {
      const activeExperiments = ABTestingSystem.getActiveExperiments();

      for (const experiment of activeExperiments) {
        // Check if experiment has enough data
        if (experiment.currentSampleSize >= experiment.targetSampleSize) {
          const results = ABTestingSystem.analyzeResults(experiment.id);

          if (results.isSignificant && results.winner) {
            // Apply the winning variant
            await this.applyWinningVariant(experiment, results);
          } else if (results.shouldStop) {
            // Stop experiment if it's not showing improvement
            ABTestingSystem.stopExperiment(experiment.id);
          }
        }
      }
    } catch (error) {
      this.logger.error('Error monitoring improvements:', error);
    }
  }

  /**
   * Generate specific improvement suggestions based on feedback
   */
  private async generateImprovementSuggestion(
    promptId: string,
    performance: any,
    patterns: any
  ): Promise<ImprovementSuggestion | null> {
    const suggestions: string[] = [];
    let expectedImprovement = 0;

    // Analyze common failure patterns
    const lowRatedFeedback = await this.getLowRatedFeedbackForPrompt(promptId);
    
    // Check for specific issues
    const issues = this.analyzeCommonIssues(lowRatedFeedback);

    if (issues.missingContext > 0.3) {
      suggestions.push('Add more context about the system environment');
      expectedImprovement += 0.1;
    }

    if (issues.vagueInstructions > 0.3) {
      suggestions.push('Make instructions more specific and actionable');
      expectedImprovement += 0.15;
    }

    if (issues.incorrectFormat > 0.2) {
      suggestions.push('Improve output format specification');
      expectedImprovement += 0.1;
    }

    if (issues.missingExamples > 0.4) {
      suggestions.push('Add relevant examples to guide analysis');
      expectedImprovement += 0.2;
    }

    if (suggestions.length === 0) {
      return null;
    }

    return {
      promptId,
      currentPerformance: performance,
      suggestedChanges: suggestions,
      expectedImprovement: Math.min(expectedImprovement, 0.3), // Cap at 30%
      confidence: this.calculateConfidence(performance.sampleSize)
    };
  }

  /**
   * Create an improved prompt based on suggestions
   */
  private async createImprovedPrompt(
    suggestion: ImprovementSuggestion
  ): Promise<any> {
    const currentPrompt = PromptVersioning.getActiveVersion(suggestion.promptId);
    if (!currentPrompt) {
      throw new Error(`No active version found for prompt ${suggestion.promptId}`);
    }

    let improvedContent = currentPrompt.content;

    // Apply suggested improvements
    for (const change of suggestion.suggestedChanges) {
      improvedContent = this.applyImprovement(improvedContent, change);
    }

    // Create new version
    const newVersion = PromptVersioning.createVersion(
      suggestion.promptId,
      improvedContent,
      {
        description: `Automated improvement based on feedback: ${suggestion.suggestedChanges.join(', ')}`,
        metadata: {
          baseVersion: currentPrompt.id,
          suggestedImprovements: suggestion.suggestedChanges,
          expectedImprovement: suggestion.expectedImprovement
        }
      }
    );

    return newVersion;
  }

  /**
   * Apply specific improvement to prompt content
   */
  private applyImprovement(content: string, improvement: string): string {
    switch (improvement) {
      case 'Add more context about the system environment':
        return content.replace(
          /## Your Task/,
          '## System Context\nConsider the system environment, resource constraints, and deployment context when analyzing.\n\n## Your Task'
        );

      case 'Make instructions more specific and actionable':
        return content.replace(
          /Analyze this crash/gi,
          'Analyze this crash by following these specific steps:\n1. Identify the primary error type and location\n2. Trace the error propagation through the stack\n3. Determine the root cause based on code patterns\n4. Suggest concrete fixes with code examples'
        );

      case 'Improve output format specification':
        return content + '\n\nEnsure your response strictly follows the JSON format without any additional text or markdown formatting.';

      case 'Add relevant examples to guide analysis':
        // This would be handled by the few-shot example system
        return content;

      default:
        return content;
    }
  }

  /**
   * Set up an A/B test experiment
   */
  private async setupExperiment(
    originalPromptId: string,
    improvedPromptId: string,
    suggestion: ImprovementSuggestion
  ): Promise<any> {
    const experiment = ABTestingSystem.createExperiment({
      name: `Automated Improvement: ${originalPromptId}`,
      description: `Testing improvements: ${suggestion.suggestedChanges.join(', ')}`,
      variants: [
        {
          name: 'Control',
          promptVersionId: originalPromptId,
          trafficPercentage: 50
        },
        {
          name: 'Improved',
          promptVersionId: improvedPromptId,
          trafficPercentage: 50
        }
      ],
      targetSampleSize: Math.max(100, suggestion.currentPerformance.sampleSize * 2),
      successMetrics: ['rating', 'accuracy', 'usefulness'],
      metadata: {
        automated: true,
        expectedImprovement: suggestion.expectedImprovement,
        baselinePerformance: suggestion.currentPerformance
      }
    });

    return experiment;
  }

  /**
   * Apply winning variant from experiment
   */
  private async applyWinningVariant(experiment: any, results: any): Promise<void> {
    const winningVariant = experiment.variants.find((v: any) => v.id === results.winner);
    
    if (!winningVariant) {
      throw new Error('Winning variant not found');
    }

    // Activate the winning version
    PromptVersioning.activateVersion(winningVariant.promptVersionId);

    // Complete the experiment
    ABTestingSystem.completeExperiment(experiment.id, {
      winner: results.winner,
      improvement: results.improvementPercentage,
      confidence: results.confidence
    });

    this.logger.info('Applied winning prompt variant', {
      experimentId: experiment.id,
      winningVersion: winningVariant.promptVersionId,
      improvement: `${results.improvementPercentage}%`
    });
  }

  /**
   * Get active prompt IDs
   */
  private getActivePrompts(): string[] {
    // This would be retrieved from the prompt manager
    return [
      'memory-leak-analysis',
      'null-pointer-analysis',
      'concurrency-deadlock',
      'database-connection',
      'performance-degradation'
    ];
  }

  /**
   * Analyze prompt performance from feedback
   */
  private async analyzePromptPerformance(promptId: string): Promise<any> {
    // This would aggregate feedback data for a specific prompt
    // For now, return mock data
    return {
      avgRating: 3.5,
      avgAccuracy: 0.7,
      sampleSize: 100
    };
  }

  /**
   * Get low-rated feedback for a prompt
   */
  private async getLowRatedFeedbackForPrompt(promptId: string): Promise<AnalysisFeedback[]> {
    // This would filter feedback by prompt ID and low ratings
    return [];
  }

  /**
   * Analyze common issues in feedback
   */
  private analyzeCommonIssues(feedback: AnalysisFeedback[]): any {
    const issues = {
      missingContext: 0,
      vagueInstructions: 0,
      incorrectFormat: 0,
      missingExamples: 0
    };

    // Analyze feedback comments for patterns
    feedback.forEach(f => {
      if (f.comments) {
        const comment = f.comments.toLowerCase();
        
        if (comment.includes('context') || comment.includes('environment')) {
          issues.missingContext++;
        }
        if (comment.includes('vague') || comment.includes('unclear')) {
          issues.vagueInstructions++;
        }
        if (comment.includes('format') || comment.includes('json')) {
          issues.incorrectFormat++;
        }
        if (comment.includes('example') || comment.includes('sample')) {
          issues.missingExamples++;
        }
      }
    });

    // Convert to percentages
    const total = feedback.length || 1;
    return {
      missingContext: issues.missingContext / total,
      vagueInstructions: issues.vagueInstructions / total,
      incorrectFormat: issues.incorrectFormat / total,
      missingExamples: issues.missingExamples / total
    };
  }

  /**
   * Calculate confidence based on sample size
   */
  private calculateConfidence(sampleSize: number): number {
    // Simple confidence calculation based on sample size
    if (sampleSize < 30) return 0.5;
    if (sampleSize < 50) return 0.7;
    if (sampleSize < 100) return 0.85;
    return 0.95;
  }

  /**
   * Schedule periodic improvement analysis
   */
  startPeriodicImprovement(intervalHours: number = 24): void {
    setInterval(async () => {
      try {
        this.logger.info('Running periodic prompt improvement analysis');
        
        // Analyze and suggest improvements
        const suggestions = await this.analyzeAndSuggestImprovements();
        
        if (suggestions.length > 0) {
          this.logger.info(`Found ${suggestions.length} improvement opportunities`);
          
          // Implement improvements with auto-approval
          await this.implementImprovements(suggestions, true);
        }

        // Monitor ongoing experiments
        await this.monitorAndApplyImprovements();
      } catch (error) {
        this.logger.error('Error in periodic improvement:', error);
      }
    }, intervalHours * 60 * 60 * 1000);
  }
}