/**
 * A/B Testing System for Prompt Effectiveness
 *
 * Manages experiments to compare prompt variations
 */

export interface ABTestExperiment {
  id: string;
  name: string;
  description: string;
  status: 'draft' | 'running' | 'completed' | 'stopped';
  variants: ABTestVariant[];
  startDate?: Date;
  endDate?: Date;
  targetSampleSize: number;
  currentSampleSize: number;
  trafficAllocation: TrafficAllocation;
  successMetrics: string[];
  results?: ExperimentResults;
}

export interface ABTestVariant {
  id: string;
  name: string;
  promptVersionId: string;
  trafficPercentage: number;
  metrics: VariantMetrics;
}

export interface VariantMetrics {
  sampleSize: number;
  successRate: number;
  avgConfidence: number;
  avgInferenceTime: number;
  errorRate: number;
  userSatisfaction?: number;
  conversions?: number; // Successful analyses leading to problem resolution
}

export interface TrafficAllocation {
  method: 'random' | 'sequential' | 'weighted';
  seed?: number;
}

export interface ExperimentResults {
  winner?: string; // variant ID
  confidence: number; // Statistical confidence
  improvementPercentage?: number;
  analysis: string;
  rawData: Record<string, any>;
}

export class ABTestingSystem {
  private static experiments: Map<string, ABTestExperiment> = new Map();
  private static activeExperiments: Set<string> = new Set();

  /**
   * Create a new A/B test experiment
   */
  static createExperiment(config: {
    name: string;
    description: string;
    variants: Array<{
      name: string;
      promptVersionId: string;
      trafficPercentage: number;
    }>;
    targetSampleSize: number;
    successMetrics: string[];
    trafficAllocation?: TrafficAllocation;
  }): ABTestExperiment {
    // Validate traffic percentages sum to 100
    const totalTraffic = config.variants.reduce((sum, v) => sum + v.trafficPercentage, 0);
    if (Math.abs(totalTraffic - 100) > 0.01) {
      throw new Error('Traffic percentages must sum to 100');
    }

    const experiment: ABTestExperiment = {
      id: uuidv4(),
      name: config.name,
      description: config.description,
      status: 'draft',
      variants: config.variants.map((v) => ({
        id: uuidv4(),
        name: v.name,
        promptVersionId: v.promptVersionId,
        trafficPercentage: v.trafficPercentage,
        metrics: {
          sampleSize: 0,
          successRate: 0,
          avgConfidence: 0,
          avgInferenceTime: 0,
          errorRate: 0,
          userSatisfaction: 0,
          conversions: 0
        }
      })),
      targetSampleSize: config.targetSampleSize,
      currentSampleSize: 0,
      trafficAllocation: config.trafficAllocation || { method: 'random' },
      successMetrics: config.successMetrics
    };

    this.experiments.set(experiment.id, experiment);
    return experiment;
  }

  /**
   * Start an experiment
   */
  static startExperiment(experimentId: string): void {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) {
      throw new Error(`Experiment ${experimentId} not found`);
    }

    if (experiment.status !== 'draft') {
      throw new Error(`Experiment must be in draft status to start`);
    }

    experiment.status = 'running';
    experiment.startDate = new Date();
    this.activeExperiments.add(experimentId);
  }

  /**
   * Stop an experiment
   */
  static stopExperiment(experimentId: string): void {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) {
      throw new Error(`Experiment ${experimentId} not found`);
    }

    experiment.status = 'stopped';
    experiment.endDate = new Date();
    this.activeExperiments.delete(experimentId);

    // Calculate results if enough data
    if (experiment.currentSampleSize >= experiment.targetSampleSize * 0.5) {
      this.calculateResults(experimentId);
    }
  }

  /**
   * Select variant for a new analysis
   */
  static selectVariant(experimentId: string): ABTestVariant | null {
    const experiment = this.experiments.get(experimentId);
    if (!experiment || experiment.status !== 'running') {
      return null;
    }

    // Check if we've reached target sample size
    if (experiment.currentSampleSize >= experiment.targetSampleSize) {
      this.completeExperiment(experimentId);
      return null;
    }

    // Select variant based on traffic allocation
    return this.allocateTraffic(experiment);
  }

  /**
   * Allocate traffic to variants
   */
  private static allocateTraffic(experiment: ABTestExperiment): ABTestVariant {
    const random = Math.random() * 100;
    let cumulative = 0;

    for (const variant of experiment.variants) {
      cumulative += variant.trafficPercentage;
      if (random <= cumulative) {
        return variant;
      }
    }

    // Fallback to first variant
    return experiment.variants[0];
  }

  /**
   * Record analysis result for a variant
   */
  static recordResult(
    experimentId: string,
    variantId: string,
    result: {
      success: boolean;
      confidence: number;
      inferenceTime: number;
      userFeedback?: 'helpful' | 'not-helpful';
      leadToResolution?: boolean;
    }
  ): void {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) return;

    const variant = experiment.variants.find((v) => v.id === variantId);
    if (!variant) return;

    // Update variant metrics
    const metrics = variant.metrics;
    metrics.sampleSize++;
    experiment.currentSampleSize++;

    // Update success rate
    if (result.success) {
      metrics.successRate =
        (metrics.successRate * (metrics.sampleSize - 1) + 1) / metrics.sampleSize;
    } else {
      metrics.successRate = (metrics.successRate * (metrics.sampleSize - 1)) / metrics.sampleSize;
      metrics.errorRate = 1 - metrics.successRate;
    }

    // Update confidence
    metrics.avgConfidence =
      (metrics.avgConfidence * (metrics.sampleSize - 1) + result.confidence) / metrics.sampleSize;

    // Update inference time
    metrics.avgInferenceTime =
      (metrics.avgInferenceTime * (metrics.sampleSize - 1) + result.inferenceTime) /
      metrics.sampleSize;

    // Update user satisfaction
    if (result.userFeedback) {
      const satisfactionScore = result.userFeedback === 'helpful' ? 1 : 0;
      metrics.userSatisfaction =
        ((metrics.userSatisfaction || 0) * (metrics.sampleSize - 1) + satisfactionScore) /
        metrics.sampleSize;
    }

    // Update conversions
    if (result.leadToResolution) {
      metrics.conversions = (metrics.conversions || 0) + 1;
    }

    // Check if experiment should complete
    if (experiment.currentSampleSize >= experiment.targetSampleSize) {
      this.completeExperiment(experimentId);
    }
  }

  /**
   * Complete an experiment and calculate results
   */
  private static completeExperiment(experimentId: string): void {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) return;

    experiment.status = 'completed';
    experiment.endDate = new Date();
    this.activeExperiments.delete(experimentId);

    this.calculateResults(experimentId);
  }

  /**
   * Calculate experiment results
   */
  private static calculateResults(experimentId: string): void {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) return;

    // Find best performing variant
    let bestVariant: ABTestVariant | null = null;
    let bestScore = -1;

    for (const variant of experiment.variants) {
      // Skip variants with insufficient data
      if (variant.metrics.sampleSize < 30) continue;

      // Calculate composite score based on success metrics
      const score = this.calculateVariantScore(variant, experiment.successMetrics);

      if (score > bestScore) {
        bestScore = score;
        bestVariant = variant;
      }
    }

    if (!bestVariant) {
      experiment.results = {
        confidence: 0,
        analysis: 'Insufficient data to determine winner',
        rawData: this.gatherRawData(experiment)
      };
      return;
    }

    // Calculate statistical significance
    const significance = this.calculateStatisticalSignificance(experiment, bestVariant);

    // Calculate improvement over control (first variant)
    const control = experiment.variants[0];
    const improvementPercentage =
      control.metrics.successRate > 0
        ? ((bestVariant.metrics.successRate - control.metrics.successRate) /
            control.metrics.successRate) *
          100
        : 0;

    experiment.results = {
      winner: bestVariant.id,
      confidence: significance,
      improvementPercentage,
      analysis: this.generateAnalysis(experiment, bestVariant),
      rawData: this.gatherRawData(experiment)
    };
  }

  /**
   * Calculate variant score based on success metrics
   */
  private static calculateVariantScore(variant: ABTestVariant, successMetrics: string[]): number {
    let score = 0;
    const metrics = variant.metrics;

    for (const metric of successMetrics) {
      switch (metric) {
        case 'successRate':
          score += metrics.successRate * 30; // Weight: 30%
          break;
        case 'confidence':
          score += metrics.avgConfidence * 25; // Weight: 25%
          break;
        case 'inferenceTime':
          // Lower is better, normalize to 0-1 range
          const normalizedTime = Math.max(0, 1 - metrics.avgInferenceTime / 30000);
          score += normalizedTime * 20; // Weight: 20%
          break;
        case 'userSatisfaction':
          score += (metrics.userSatisfaction || 0) * 15; // Weight: 15%
          break;
        case 'conversions':
          const conversionRate =
            metrics.sampleSize > 0 ? (metrics.conversions || 0) / metrics.sampleSize : 0;
          score += conversionRate * 10; // Weight: 10%
          break;
      }
    }

    return score;
  }

  /**
   * Calculate statistical significance using Chi-square test
   */
  private static calculateStatisticalSignificance(
    experiment: ABTestExperiment,
    winner: ABTestVariant
  ): number {
    // Simplified significance calculation
    // In production, use proper statistical tests
    const control = experiment.variants[0];

    if (control.id === winner.id) {
      return 100; // Control won, 100% confidence
    }

    const n1 = control.metrics.sampleSize;
    const n2 = winner.metrics.sampleSize;
    const p1 = control.metrics.successRate;
    const p2 = winner.metrics.successRate;

    // Pooled proportion
    const p = (n1 * p1 + n2 * p2) / (n1 + n2);

    // Standard error
    const se = Math.sqrt(p * (1 - p) * (1 / n1 + 1 / n2));

    // Z-score
    const z = Math.abs(p2 - p1) / se;

    // Convert to confidence percentage (simplified)
    const confidence = Math.min(99.9, z * 20);

    return confidence;
  }

  /**
   * Generate analysis text
   */
  private static generateAnalysis(experiment: ABTestExperiment, winner: ABTestVariant): string {
    const control = experiment.variants[0];
    const improvement = winner.metrics.successRate - control.metrics.successRate;
    const relativeImprovement =
      control.metrics.successRate > 0 ? (improvement / control.metrics.successRate) * 100 : 0;

    return `Variant "${winner.name}" performed best with:
- Success rate: ${(winner.metrics.successRate * 100).toFixed(1)}%
- Average confidence: ${(winner.metrics.avgConfidence * 100).toFixed(1)}%
- Average inference time: ${winner.metrics.avgInferenceTime.toFixed(0)}ms
- User satisfaction: ${((winner.metrics.userSatisfaction || 0) * 100).toFixed(1)}%

This represents a ${relativeImprovement.toFixed(1)}% improvement over the control variant.`;
  }

  /**
   * Gather raw data for analysis
   */
  private static gatherRawData(experiment: ABTestExperiment): Record<string, any> {
    return {
      variants: experiment.variants.map((v) => ({
        id: v.id,
        name: v.name,
        metrics: v.metrics
      })),
      duration:
        experiment.endDate && experiment.startDate
          ? experiment.endDate.getTime() - experiment.startDate.getTime()
          : 0,
      totalSampleSize: experiment.currentSampleSize
    };
  }

  /**
   * Get active experiments
   */
  static getActiveExperiments(): ABTestExperiment[] {
    return Array.from(this.activeExperiments)
      .map((id) => this.experiments.get(id))
      .filter((exp): exp is ABTestExperiment => exp !== undefined);
  }

  /**
   * Get experiment by ID
   */
  static getExperiment(experimentId: string): ABTestExperiment | null {
    return this.experiments.get(experimentId) || null;
  }

  /**
   * Get all experiments
   */
  static getAllExperiments(): ABTestExperiment[] {
    return Array.from(this.experiments.values());
  }
}
