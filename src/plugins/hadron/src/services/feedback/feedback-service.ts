/**
 * Feedback Service for AI Analysis
 *
 * Manages user feedback collection, storage, and analysis for improving AI crash analysis
 */

import { IDataService } from '@core/data/interfaces';
import { Logger } from '@utils/logger';

export interface AnalysisFeedback {
  id: string;
  analysisId: string;
  crashLogId: string;
  userId: string;
  timestamp: Date;
  rating: FeedbackRating;
  accuracy: AccuracyRating;
  usefulness: UsefulnessRating;
  comments?: string;
  correctRootCause?: string;
  missedIssues?: string[];
  incorrectSuggestions?: string[];
  helpfulSuggestions?: string[];
  metadata?: {
    llmModel?: string;
    promptVersion?: string;
    analysisTime?: number;
    userExperience?: 'beginner' | 'intermediate' | 'expert';
  };
}

export enum FeedbackRating {
  VeryPoor = 1,
  Poor = 2,
  Neutral = 3,
  Good = 4,
  Excellent = 5
}

export interface AccuracyRating {
  rootCauseAccurate: boolean;
  suggestionsHelpful: boolean;
  confidenceAppropriate: boolean;
  nothingMissed: boolean;
}

export interface UsefulnessRating {
  savedTime: boolean;
  learnedSomething: boolean;
  wouldUseAgain: boolean;
  betterThanManual: boolean;
}

export interface FeedbackStats {
  totalFeedback: number;
  averageRating: number;
  accuracyScore: number;
  usefulnessScore: number;
  commonIssues: Array<{
    issue: string;
    count: number;
    percentage: number;
  }>;
  modelPerformance: Record<
    string,
    {
      count: number;
      avgRating: number;
      avgAccuracy: number;
    }
  >;
  improvementTrends: Array<{
    date: Date;
    rating: number;
    accuracy: number;
  }>;
}

export interface FeedbackAnalysis {
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  trainingDataSuggestions: Array<{
    crashType: string;
    examples: string[];
  }>;
}

export class FeedbackService {
  private readonly FEEDBACK_COLLECTION = 'analysis_feedback';
  private readonly FEEDBACK_STATS_COLLECTION = 'feedback_stats';

  constructor(
    private dataService: IDataService,
    private logger: Logger
  ) {}

  /**
   * Submit feedback for an analysis
   */
  async submitFeedback(
    feedback: Omit<AnalysisFeedback, 'id' | 'timestamp'>
  ): Promise<AnalysisFeedback> {
    try {
      const fullFeedback: AnalysisFeedback = {
        ...feedback,
        id: uuidv4(),
        timestamp: new Date()
      };

      // Store feedback
      await this.dataService.create(this.FEEDBACK_COLLECTION, fullFeedback);

      // Update statistics asynchronously
      this.updateStatistics(fullFeedback).catch((err) =>
        this.logger.error('Failed to update feedback statistics:', err)
      );

      // Trigger analysis quality update
      this.updateAnalysisQuality(feedback.analysisId, fullFeedback).catch((err) =>
        this.logger.error('Failed to update analysis quality:', err)
      );

      this.logger.info('Feedback submitted successfully', {
        feedbackId: fullFeedback.id,
        analysisId: feedback.analysisId,
        rating: feedback.rating
      });

      return fullFeedback;
    } catch (error) {
      this.logger.error('Error submitting feedback:', error);
      throw new Error('Failed to submit feedback');
    }
  }

  /**
   * Get feedback for a specific analysis
   */
  async getFeedbackForAnalysis(analysisId: string): Promise<AnalysisFeedback[]> {
    try {
      return await this.dataService.find<AnalysisFeedback>(
        this.FEEDBACK_COLLECTION,
        { analysisId },
        { orderBy: 'timestamp', orderDirection: 'DESC' }
      );
    } catch (error) {
      this.logger.error('Error retrieving feedback:', error);
      return [];
    }
  }

  /**
   * Get feedback statistics
   */
  async getFeedbackStats(options?: {
    startDate?: Date;
    endDate?: Date;
    llmModel?: string;
    minFeedbackCount?: number;
  }): Promise<FeedbackStats> {
    try {
      // Build query criteria
      const criteria: any = {};
      if (options?.startDate || options?.endDate) {
        criteria.timestamp = {};
        if (options.startDate) criteria.timestamp.$gte = options.startDate;
        if (options.endDate) criteria.timestamp.$lte = options.endDate;
      }
      if (options?.llmModel) {
        criteria['metadata.llmModel'] = options.llmModel;
      }

      // Fetch all feedback matching criteria
      const allFeedback = await this.dataService.find<AnalysisFeedback>(
        this.FEEDBACK_COLLECTION,
        criteria
      );

      // Calculate statistics
      const stats = this.calculateStats(allFeedback);

      // Cache stats for quick retrieval
      await this.cacheStats(stats);

      return stats;
    } catch (error) {
      this.logger.error('Error calculating feedback stats:', error);
      throw new Error('Failed to calculate feedback statistics');
    }
  }

  /**
   * Analyze feedback patterns to identify improvement areas
   */
  async analyzeFeedbackPatterns(options?: {
    minSampleSize?: number;
    focusArea?: 'accuracy' | 'usefulness' | 'performance';
  }): Promise<FeedbackAnalysis> {
    try {
      const minSample = options?.minSampleSize || 50;
      const allFeedback = await this.dataService.find<AnalysisFeedback>(
        this.FEEDBACK_COLLECTION,
        {},
        { limit: 1000, orderBy: 'timestamp', orderDirection: 'DESC' }
      );

      if (allFeedback.length < minSample) {
        return {
          strengths: ['Insufficient data for pattern analysis'],
          weaknesses: ['Need more feedback samples'],
          recommendations: ['Collect more user feedback'],
          trainingDataSuggestions: []
        };
      }

      return this.performPatternAnalysis(allFeedback, options?.focusArea);
    } catch (error) {
      this.logger.error('Error analyzing feedback patterns:', error);
      throw new Error('Failed to analyze feedback patterns');
    }
  }

  /**
   * Get feedback-based recommendations for a crash type
   */
  async getRecommendations(crashType: string): Promise<{
    recommendedApproach: string;
    commonPitfalls: string[];
    successfulPatterns: string[];
    confidence: number;
  }> {
    try {
      // Find feedback for similar crash types
      const similarFeedback = await this.findSimilarCrashFeedback(crashType);

      if (similarFeedback.length < 5) {
        return {
          recommendedApproach: 'Standard analysis approach',
          commonPitfalls: [],
          successfulPatterns: [],
          confidence: 0.3
        };
      }

      // Analyze successful vs unsuccessful analyses
      const successful = similarFeedback.filter((f) => f.rating >= 4);
      const unsuccessful = similarFeedback.filter((f) => f.rating <= 2);

      // Extract patterns
      const commonPitfalls = this.extractCommonIssues(unsuccessful);
      const successfulPatterns = this.extractSuccessPatterns(successful);

      return {
        recommendedApproach: this.generateRecommendedApproach(successfulPatterns),
        commonPitfalls,
        successfulPatterns,
        confidence: Math.min(0.9, similarFeedback.length / 50)
      };
    } catch (error) {
      this.logger.error('Error getting recommendations:', error);
      throw new Error('Failed to get feedback-based recommendations');
    }
  }

  /**
   * Export feedback data for training improvement
   */
  async exportTrainingData(options?: {
    minRating?: number;
    includeNegative?: boolean;
    format?: 'json' | 'csv';
  }): Promise<string> {
    try {
      const criteria: any = {};
      if (options?.minRating && !options?.includeNegative) {
        criteria.rating = { $gte: options.minRating };
      }

      const feedback = await this.dataService.find<AnalysisFeedback>(
        this.FEEDBACK_COLLECTION,
        criteria
      );

      // Format feedback for training
      const trainingData = await this.formatForTraining(feedback);

      if (options?.format === 'csv') {
        return this.convertToCSV(trainingData);
      }

      return JSON.stringify(trainingData, null, 2);
    } catch (error) {
      this.logger.error('Error exporting training data:', error);
      throw new Error('Failed to export training data');
    }
  }

  /**
   * Update statistics based on new feedback
   */
  private async updateStatistics(feedback: AnalysisFeedback): Promise<void> {
    // This would typically update aggregated statistics in a separate collection
    // For now, we'll recalculate on demand
  }

  /**
   * Update analysis quality metrics
   */
  private async updateAnalysisQuality(
    analysisId: string,
    feedback: AnalysisFeedback
  ): Promise<void> {
    try {
      // Update the analysis record with quality metrics
      const existingAnalysis = await this.dataService.findById('crash_analyses', analysisId);
      if (!existingAnalysis) return;

      const qualityMetrics = {
        userRating: feedback.rating,
        accuracyScore: this.calculateAccuracyScore(feedback.accuracy),
        usefulnessScore: this.calculateUsefulnessScore(feedback.usefulness),
        feedbackCount: (existingAnalysis.feedbackCount || 0) + 1,
        averageRating: this.calculateNewAverage(
          existingAnalysis.averageRating || 0,
          existingAnalysis.feedbackCount || 0,
          feedback.rating
        )
      };

      await this.dataService.update('crash_analyses', analysisId, {
        qualityMetrics,
        lastFeedbackAt: new Date()
      });
    } catch (error) {
      this.logger.error('Error updating analysis quality:', error);
    }
  }

  /**
   * Calculate statistics from feedback data
   */
  private calculateStats(feedback: AnalysisFeedback[]): FeedbackStats {
    if (feedback.length === 0) {
      return {
        totalFeedback: 0,
        averageRating: 0,
        accuracyScore: 0,
        usefulnessScore: 0,
        commonIssues: [],
        modelPerformance: {},
        improvementTrends: []
      };
    }

    // Calculate averages
    const totalRating = feedback.reduce((sum, f) => sum + f.rating, 0);
    const averageRating = totalRating / feedback.length;

    // Calculate accuracy score
    const accuracyScores = feedback.map((f) => this.calculateAccuracyScore(f.accuracy));
    const accuracyScore = accuracyScores.reduce((sum, s) => sum + s, 0) / accuracyScores.length;

    // Calculate usefulness score
    const usefulnessScores = feedback.map((f) => this.calculateUsefulnessScore(f.usefulness));
    const usefulnessScore =
      usefulnessScores.reduce((sum, s) => sum + s, 0) / usefulnessScores.length;

    // Extract common issues
    const issueMap = new Map<string, number>();
    feedback.forEach((f) => {
      if (f.missedIssues) {
        f.missedIssues.forEach((issue) => {
          issueMap.set(issue, (issueMap.get(issue) || 0) + 1);
        });
      }
      if (f.incorrectSuggestions) {
        f.incorrectSuggestions.forEach((suggestion) => {
          const issue = `Incorrect: ${suggestion}`;
          issueMap.set(issue, (issueMap.get(issue) || 0) + 1);
        });
      }
    });

    const commonIssues = Array.from(issueMap.entries())
      .map(([issue, count]) => ({
        issue,
        count,
        percentage: (count / feedback.length) * 100
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Calculate model performance
    const modelPerformance: Record<string, any> = {};
    const modelGroups = this.groupBy(feedback, (f) => f.metadata?.llmModel || 'unknown');

    for (const [model, modelFeedback] of Object.entries(modelGroups)) {
      const modelRating =
        modelFeedback.reduce((sum, f) => sum + f.rating, 0) / modelFeedback.length;
      const modelAccuracy =
        modelFeedback
          .map((f) => this.calculateAccuracyScore(f.accuracy))
          .reduce((sum, s) => sum + s, 0) / modelFeedback.length;

      modelPerformance[model] = {
        count: modelFeedback.length,
        avgRating: modelRating,
        avgAccuracy: modelAccuracy
      };
    }

    // Calculate improvement trends (last 30 days)
    const trends = this.calculateTrends(feedback);

    return {
      totalFeedback: feedback.length,
      averageRating,
      accuracyScore,
      usefulnessScore,
      commonIssues,
      modelPerformance,
      improvementTrends: trends
    };
  }

  /**
   * Calculate accuracy score from accuracy rating
   */
  private calculateAccuracyScore(accuracy: AccuracyRating): number {
    const scores = [
      accuracy.rootCauseAccurate ? 1 : 0,
      accuracy.suggestionsHelpful ? 1 : 0,
      accuracy.confidenceAppropriate ? 1 : 0,
      accuracy.nothingMissed ? 1 : 0
    ];
    return scores.reduce((sum, s) => sum + s, 0) / scores.length;
  }

  /**
   * Calculate usefulness score from usefulness rating
   */
  private calculateUsefulnessScore(usefulness: UsefulnessRating): number {
    const scores = [
      usefulness.savedTime ? 1 : 0,
      usefulness.learnedSomething ? 1 : 0,
      usefulness.wouldUseAgain ? 1 : 0,
      usefulness.betterThanManual ? 1 : 0
    ];
    return scores.reduce((sum, s) => sum + s, 0) / scores.length;
  }

  /**
   * Calculate new average rating
   */
  private calculateNewAverage(oldAvg: number, oldCount: number, newValue: number): number {
    return (oldAvg * oldCount + newValue) / (oldCount + 1);
  }

  /**
   * Group feedback by a key function
   */
  private groupBy<T>(array: T[], keyFn: (item: T) => string): Record<string, T[]> {
    return array.reduce(
      (groups, item) => {
        const key = keyFn(item);
        if (!groups[key]) groups[key] = [];
        groups[key].push(item);
        return groups;
      },
      {} as Record<string, T[]>
    );
  }

  /**
   * Calculate improvement trends
   */
  private calculateTrends(
    feedback: AnalysisFeedback[]
  ): Array<{ date: Date; rating: number; accuracy: number }> {
    // Group by day
    const dailyGroups = this.groupBy(feedback, (f) => f.timestamp.toISOString().split('T')[0]);

    return Object.entries(dailyGroups)
      .map(([date, dayFeedback]) => ({
        date: new Date(date),
        rating: dayFeedback.reduce((sum, f) => sum + f.rating, 0) / dayFeedback.length,
        accuracy:
          dayFeedback
            .map((f) => this.calculateAccuracyScore(f.accuracy))
            .reduce((sum, s) => sum + s, 0) / dayFeedback.length
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(-30); // Last 30 days
  }

  /**
   * Cache statistics for quick retrieval
   */
  private async cacheStats(stats: FeedbackStats): Promise<void> {
    try {
      await this.dataService.create(this.FEEDBACK_STATS_COLLECTION, {
        id: `stats_${new Date().toISOString()}`,
        timestamp: new Date(),
        stats
      });
    } catch (error) {
      this.logger.error('Error caching stats:', error);
    }
  }

  /**
   * Perform pattern analysis on feedback
   */
  private performPatternAnalysis(
    feedback: AnalysisFeedback[],
    focusArea?: 'accuracy' | 'usefulness' | 'performance'
  ): FeedbackAnalysis {
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    const recommendations: string[] = [];
    const trainingDataSuggestions: Array<{ crashType: string; examples: string[] }> = [];

    // Analyze high-rated feedback for strengths
    const highRated = feedback.filter((f) => f.rating >= 4);
    if (highRated.length > 0) {
      const commonStrengths = this.extractCommonStrengths(highRated);
      strengths.push(...commonStrengths);
    }

    // Analyze low-rated feedback for weaknesses
    const lowRated = feedback.filter((f) => f.rating <= 2);
    if (lowRated.length > 0) {
      const commonWeaknesses = this.extractCommonWeaknesses(lowRated);
      weaknesses.push(...commonWeaknesses);
    }

    // Generate recommendations based on patterns
    if (focusArea === 'accuracy') {
      const accuracyIssues = feedback.filter((f) => !f.accuracy.rootCauseAccurate);
      if (accuracyIssues.length > feedback.length * 0.3) {
        recommendations.push('Improve root cause identification accuracy');
        recommendations.push('Add more training examples for edge cases');
      }
    }

    if (focusArea === 'usefulness') {
      const notUseful = feedback.filter((f) => !f.usefulness.betterThanManual);
      if (notUseful.length > feedback.length * 0.2) {
        recommendations.push('Provide more actionable suggestions');
        recommendations.push('Include code examples in fixes');
      }
    }

    // Identify crash types needing more training data
    const crashTypeGroups = this.groupBy(lowRated, (f) => f.correctRootCause || 'unknown');
    for (const [crashType, crashes] of Object.entries(crashTypeGroups)) {
      if (crashes.length >= 3) {
        trainingDataSuggestions.push({
          crashType,
          examples: crashes.map((c) => c.correctRootCause || '').filter(Boolean)
        });
      }
    }

    return {
      strengths,
      weaknesses,
      recommendations,
      trainingDataSuggestions
    };
  }

  /**
   * Extract common strengths from high-rated feedback
   */
  private extractCommonStrengths(feedback: AnalysisFeedback[]): string[] {
    const strengths: string[] = [];

    const accurateRootCause = feedback.filter((f) => f.accuracy.rootCauseAccurate).length;
    if (accurateRootCause > feedback.length * 0.8) {
      strengths.push('Excellent root cause identification');
    }

    const helpfulSuggestions = feedback.filter((f) => f.accuracy.suggestionsHelpful).length;
    if (helpfulSuggestions > feedback.length * 0.8) {
      strengths.push('Provides helpful troubleshooting suggestions');
    }

    const savedTime = feedback.filter((f) => f.usefulness.savedTime).length;
    if (savedTime > feedback.length * 0.7) {
      strengths.push('Significantly reduces debugging time');
    }

    return strengths;
  }

  /**
   * Extract common weaknesses from low-rated feedback
   */
  private extractCommonWeaknesses(feedback: AnalysisFeedback[]): string[] {
    const weaknesses: string[] = [];

    const missedIssues = feedback.filter((f) => f.missedIssues && f.missedIssues.length > 0);
    if (missedIssues.length > feedback.length * 0.5) {
      weaknesses.push('Frequently misses important issues');
    }

    const incorrectRoot = feedback.filter((f) => !f.accuracy.rootCauseAccurate).length;
    if (incorrectRoot > feedback.length * 0.5) {
      weaknesses.push('Root cause identification needs improvement');
    }

    const notBetterThanManual = feedback.filter((f) => !f.usefulness.betterThanManual).length;
    if (notBetterThanManual > feedback.length * 0.6) {
      weaknesses.push('Not providing sufficient value over manual analysis');
    }

    return weaknesses;
  }

  /**
   * Find feedback for similar crash types
   */
  private async findSimilarCrashFeedback(crashType: string): Promise<AnalysisFeedback[]> {
    // This would ideally use semantic search or classification
    // For now, use simple string matching
    const allFeedback = await this.dataService.find<AnalysisFeedback>(
      this.FEEDBACK_COLLECTION,
      {},
      { limit: 1000 }
    );

    return allFeedback.filter(
      (f) =>
        f.correctRootCause?.toLowerCase().includes(crashType.toLowerCase()) ||
        f.comments?.toLowerCase().includes(crashType.toLowerCase())
    );
  }

  /**
   * Extract common issues from unsuccessful analyses
   */
  private extractCommonIssues(feedback: AnalysisFeedback[]): string[] {
    const issues: Map<string, number> = new Map();

    feedback.forEach((f) => {
      if (f.missedIssues) {
        f.missedIssues.forEach((issue) => {
          issues.set(issue, (issues.get(issue) || 0) + 1);
        });
      }
    });

    return Array.from(issues.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([issue]) => issue);
  }

  /**
   * Extract success patterns from successful analyses
   */
  private extractSuccessPatterns(feedback: AnalysisFeedback[]): string[] {
    const patterns: string[] = [];

    // Look for common helpful suggestions
    const allHelpful = feedback.flatMap((f) => f.helpfulSuggestions || []);
    const suggestionCounts = new Map<string, number>();

    allHelpful.forEach((suggestion) => {
      suggestionCounts.set(suggestion, (suggestionCounts.get(suggestion) || 0) + 1);
    });

    const topSuggestions = Array.from(suggestionCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([suggestion]) => suggestion);

    patterns.push(...topSuggestions);

    return patterns;
  }

  /**
   * Generate recommended approach based on patterns
   */
  private generateRecommendedApproach(patterns: string[]): string {
    if (patterns.length === 0) {
      return 'Standard analysis approach with focus on common issues';
    }

    return `Focus on: ${patterns.slice(0, 3).join(', ')}. These approaches have been most successful for similar crashes.`;
  }

  /**
   * Format feedback for training data export
   */
  private async formatForTraining(feedback: AnalysisFeedback[]): Promise<any[]> {
    // Format would depend on the training system requirements
    return feedback.map((f) => ({
      input: {
        analysisId: f.analysisId,
        crashLogId: f.crashLogId,
        model: f.metadata?.llmModel
      },
      output: {
        rating: f.rating,
        accuracy: f.accuracy,
        usefulness: f.usefulness,
        correctRootCause: f.correctRootCause,
        issues: {
          missed: f.missedIssues,
          incorrect: f.incorrectSuggestions
        }
      },
      metadata: {
        timestamp: f.timestamp,
        userId: f.userId,
        comments: f.comments
      }
    }));
  }

  /**
   * Convert data to CSV format
   */
  private convertToCSV(data: any[]): string {
    if (data.length === 0) return '';

    // Extract headers
    const headers = Object.keys(this.flattenObject(data[0]));
    const csv = [headers.join(',')];

    // Add rows
    data.forEach((item) => {
      const flat = this.flattenObject(item);
      const row = headers.map((h) => `"${flat[h] || ''}"`).join(',');
      csv.push(row);
    });

    return csv.join('\n');
  }

  /**
   * Flatten nested object for CSV export
   */
  private flattenObject(obj: any, prefix = ''): Record<string, any> {
    const flattened: Record<string, any> = {};

    for (const [key, value] of Object.entries(obj)) {
      const newKey = prefix ? `${prefix}_${key}` : key;

      if (value === null || value === undefined) {
        flattened[newKey] = '';
      } else if (typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
        Object.assign(flattened, this.flattenObject(value, newKey));
      } else if (Array.isArray(value)) {
        flattened[newKey] = value.join(';');
      } else if (value instanceof Date) {
        flattened[newKey] = value.toISOString();
      } else {
        flattened[newKey] = value;
      }
    }

    return flattened;
  }
}
