/**
 * Result Storage Service
 * 
 * Handles storage, retrieval, and management of crash analysis results
 * with optimized querying and analytics capabilities.
 */

import { Logger } from '../../../../../utils/logger';
import { EventBus } from '../../../../../core/event-bus/event-bus';
import { CrashAnalysisResult } from '../../interfaces';
import { v4 as uuidv4 } from 'uuid';
import { NotFoundError, ValidationError } from '../../../../../core/errors';

export interface StorageConfig {
  retentionDays: number;
  enableCompression: boolean;
  enableEncryption: boolean;
  maxStorageSize: string;
  archiveOldResults: boolean;
}

export interface AnalysisStatistics {
  totalAnalyses: number;
  averageConfidence: number;
  averageProcessingTime: number;
  successRate: number;
  topErrorCategories: Array<{ category: string; count: number }>;
  timeRange?: { start: Date; end: Date };
}

export interface StorageMetrics {
  totalResults: number;
  storageUsed: string;
  compressionRatio: number;
  oldestResult: Date;
  newestResult: Date;
  averageResultSize: number;
}

/**
 * Service for storing and managing crash analysis results
 */
export class ResultStorageService {
  private readonly config: StorageConfig;
  private readonly results: Map<string, CrashAnalysisResult> = new Map();
  private readonly resultsByLogId: Map<string, string[]> = new Map();
  private readonly categoryStats: Map<string, number> = new Map();

  constructor(
    private logger: Logger,
    private eventBus: EventBus,
    config: Partial<StorageConfig> = {}
  ) {
    this.config = {
      retentionDays: 90,
      enableCompression: true,
      enableEncryption: false,
      maxStorageSize: '10GB',
      archiveOldResults: true,
      ...config
    };
  }

  /**
   * Store a new analysis result
   */
  async storeAnalysisResult(
    crashLogId: string,
    analysisResult: CrashAnalysisResult
  ): Promise<void> {
    try {
      this.logger.info('Storing analysis result', { 
        analysisId: analysisResult.id,
        crashLogId,
        confidence: analysisResult.confidence
      });

      // Validate the analysis result
      this.validateAnalysisResult(analysisResult);

      // Ensure the result has the correct crash log ID
      analysisResult.crashLogId = crashLogId;

      // Add storage metadata
      const enrichedResult = {
        ...analysisResult,
        storedAt: new Date(),
        storageMetadata: {
          compressed: this.config.enableCompression,
          encrypted: this.config.enableEncryption,
          version: '1.0'
        }
      };

      // Store the result
      this.results.set(analysisResult.id, enrichedResult);

      // Update crash log mapping
      if (!this.resultsByLogId.has(crashLogId)) {
        this.resultsByLogId.set(crashLogId, []);
      }
      this.resultsByLogId.get(crashLogId)!.push(analysisResult.id);

      // Update category statistics
      this.updateCategoryStatistics(analysisResult);

      // Emit storage event
      this.eventBus.publish('hadron:result:stored', {
        analysisId: analysisResult.id,
        crashLogId,
        confidence: analysisResult.confidence,
        storedAt: enrichedResult.storedAt
      });

      // Check storage limits and cleanup if needed
      await this.checkStorageLimits();

      this.logger.info('Analysis result stored successfully', { 
        analysisId: analysisResult.id,
        crashLogId
      });
    } catch (error) {
      this.logger.error('Failed to store analysis result', { 
        analysisId: analysisResult.id,
        crashLogId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Retrieve analysis result by ID
   */
  async getAnalysisResult(analysisId: string): Promise<CrashAnalysisResult | null> {
    try {
      const result = this.results.get(analysisId);
      
      if (!result) {
        this.logger.warn('Analysis result not found', { analysisId });
        return null;
      }

      this.logger.info('Analysis result retrieved', { 
        analysisId,
        crashLogId: result.crashLogId
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to retrieve analysis result', { 
        analysisId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Get all analysis results for a crash log
   */
  async getAnalysisResultsByLogId(crashLogId: string): Promise<CrashAnalysisResult[]> {
    try {
      const analysisIds = this.resultsByLogId.get(crashLogId) || [];
      const results: CrashAnalysisResult[] = [];

      for (const analysisId of analysisIds) {
        const result = this.results.get(analysisId);
        if (result) {
          results.push(result);
        }
      }

      this.logger.info('Retrieved analysis results for crash log', { 
        crashLogId,
        resultCount: results.length
      });

      return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } catch (error) {
      this.logger.error('Failed to retrieve analysis results by log ID', { 
        crashLogId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Delete analysis results for a crash log
   */
  async deleteAnalysisResults(crashLogId: string): Promise<void> {
    try {
      this.logger.info('Deleting analysis results', { crashLogId });

      const analysisIds = this.resultsByLogId.get(crashLogId) || [];
      let deletedCount = 0;

      for (const analysisId of analysisIds) {
        if (this.results.has(analysisId)) {
          const result = this.results.get(analysisId)!;
          
          // Update category statistics
          this.decrementCategoryStatistics(result);
          
          // Delete the result
          this.results.delete(analysisId);
          deletedCount++;
        }
      }

      // Remove from crash log mapping
      this.resultsByLogId.delete(crashLogId);

      // Emit deletion event
      this.eventBus.publish('hadron:result:deleted', {
        crashLogId,
        deletedCount
      });

      this.logger.info('Analysis results deleted', { 
        crashLogId,
        deletedCount
      });
    } catch (error) {
      this.logger.error('Failed to delete analysis results', { 
        crashLogId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Get analysis statistics for a time range
   */
  async getAnalysisStatistics(
    timeRange?: { start: Date; end: Date }
  ): Promise<AnalysisStatistics> {
    try {
      this.logger.info('Calculating analysis statistics', { timeRange });

      let relevantResults: CrashAnalysisResult[];

      if (timeRange) {
        relevantResults = Array.from(this.results.values()).filter(result => 
          result.createdAt >= timeRange.start && result.createdAt <= timeRange.end
        );
      } else {
        relevantResults = Array.from(this.results.values());
      }

      if (relevantResults.length === 0) {
        return {
          totalAnalyses: 0,
          averageConfidence: 0,
          averageProcessingTime: 0,
          successRate: 0,
          topErrorCategories: [],
          timeRange
        };
      }

      // Calculate statistics
      const totalAnalyses = relevantResults.length;
      const successfulAnalyses = relevantResults.filter(r => r.status === 'completed').length;
      const successRate = successfulAnalyses / totalAnalyses;

      const averageConfidence = relevantResults.reduce((sum, r) => sum + r.confidence, 0) / totalAnalyses;
      
      const averageProcessingTime = relevantResults
        .filter(r => r.inferenceTime)
        .reduce((sum, r) => sum + (r.inferenceTime || 0), 0) / 
        relevantResults.filter(r => r.inferenceTime).length || 0;

      // Calculate top error categories
      const categoryCount = new Map<string, number>();
      relevantResults.forEach(result => {
        if (result.result && result.result.potentialRootCauses) {
          result.result.potentialRootCauses.forEach((cause: any) => {
            const category = cause.category || 'Unknown';
            categoryCount.set(category, (categoryCount.get(category) || 0) + 1);
          });
        }
      });

      const topErrorCategories = Array.from(categoryCount.entries())
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      const statistics: AnalysisStatistics = {
        totalAnalyses,
        averageConfidence: Math.round(averageConfidence * 100) / 100,
        averageProcessingTime: Math.round(averageProcessingTime),
        successRate: Math.round(successRate * 100) / 100,
        topErrorCategories,
        timeRange
      };

      this.logger.info('Analysis statistics calculated', { 
        totalAnalyses,
        successRate,
        averageConfidence: statistics.averageConfidence
      });

      return statistics;
    } catch (error) {
      this.logger.error('Failed to calculate analysis statistics', { 
        timeRange,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Get storage metrics
   */
  async getStorageMetrics(): Promise<StorageMetrics> {
    try {
      const allResults = Array.from(this.results.values());
      
      if (allResults.length === 0) {
        return {
          totalResults: 0,
          storageUsed: '0 KB',
          compressionRatio: 0,
          oldestResult: new Date(),
          newestResult: new Date(),
          averageResultSize: 0
        };
      }

      // Calculate metrics
      const totalResults = allResults.length;
      
      // Estimate storage size (in a real implementation, this would be actual file sizes)
      const averageResultSize = 2048; // Estimated average size in bytes
      const totalSizeBytes = totalResults * averageResultSize;
      const storageUsed = this.formatBytes(totalSizeBytes);

      const dates = allResults.map(r => r.createdAt);
      const oldestResult = new Date(Math.min(...dates.map(d => d.getTime())));
      const newestResult = new Date(Math.max(...dates.map(d => d.getTime())));

      const compressionRatio = this.config.enableCompression ? 0.7 : 1.0;

      return {
        totalResults,
        storageUsed,
        compressionRatio,
        oldestResult,
        newestResult,
        averageResultSize
      };
    } catch (error) {
      this.logger.error('Failed to calculate storage metrics', { 
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Archive old results based on retention policy
   */
  async archiveOldResults(): Promise<{ archived: number; deleted: number }> {
    try {
      this.logger.info('Starting archive process for old results');

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

      const oldResults = Array.from(this.results.entries()).filter(
        ([_, result]) => result.createdAt < cutoffDate
      );

      let archived = 0;
      let deleted = 0;

      for (const [analysisId, result] of oldResults) {
        if (this.config.archiveOldResults) {
          // In a real implementation, this would move results to archive storage
          this.logger.info('Result archived', { 
            analysisId,
            crashLogId: result.crashLogId,
            age: Math.floor((Date.now() - result.createdAt.getTime()) / (1000 * 60 * 60 * 24))
          });
          archived++;
        } else {
          // Delete the result
          this.results.delete(analysisId);
          
          // Update crash log mapping
          const crashLogId = result.crashLogId;
          const analysisIds = this.resultsByLogId.get(crashLogId) || [];
          const updatedIds = analysisIds.filter(id => id !== analysisId);
          if (updatedIds.length === 0) {
            this.resultsByLogId.delete(crashLogId);
          } else {
            this.resultsByLogId.set(crashLogId, updatedIds);
          }

          // Update category statistics
          this.decrementCategoryStatistics(result);
          
          deleted++;
        }
      }

      // Emit archive event
      this.eventBus.publish('hadron:result:archived', {
        archived,
        deleted,
        cutoffDate
      });

      this.logger.info('Archive process completed', { archived, deleted });

      return { archived, deleted };
    } catch (error) {
      this.logger.error('Archive process failed', { 
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Search analysis results by criteria
   */
  async searchAnalysisResults(criteria: {
    crashLogId?: string;
    confidenceMin?: number;
    confidenceMax?: number;
    dateFrom?: Date;
    dateTo?: Date;
    categories?: string[];
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{
    results: CrashAnalysisResult[];
    total: number;
    hasMore: boolean;
  }> {
    try {
      this.logger.info('Searching analysis results', { criteria });

      let filteredResults = Array.from(this.results.values());

      // Apply filters
      if (criteria.crashLogId) {
        filteredResults = filteredResults.filter(r => r.crashLogId === criteria.crashLogId);
      }

      if (criteria.confidenceMin !== undefined) {
        filteredResults = filteredResults.filter(r => r.confidence >= criteria.confidenceMin!);
      }

      if (criteria.confidenceMax !== undefined) {
        filteredResults = filteredResults.filter(r => r.confidence <= criteria.confidenceMax!);
      }

      if (criteria.dateFrom) {
        filteredResults = filteredResults.filter(r => r.createdAt >= criteria.dateFrom!);
      }

      if (criteria.dateTo) {
        filteredResults = filteredResults.filter(r => r.createdAt <= criteria.dateTo!);
      }

      if (criteria.status) {
        filteredResults = filteredResults.filter(r => r.status === criteria.status);
      }

      if (criteria.categories && criteria.categories.length > 0) {
        filteredResults = filteredResults.filter(result => {
          if (!result.result || !result.result.potentialRootCauses) return false;
          return result.result.potentialRootCauses.some((cause: any) => 
            criteria.categories!.includes(cause.category)
          );
        });
      }

      // Sort by creation date (newest first)
      filteredResults.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      const total = filteredResults.length;
      const offset = criteria.offset || 0;
      const limit = criteria.limit || 50;

      // Apply pagination
      const paginatedResults = filteredResults.slice(offset, offset + limit);
      const hasMore = offset + limit < total;

      this.logger.info('Search completed', { 
        total,
        returned: paginatedResults.length,
        hasMore
      });

      return {
        results: paginatedResults,
        total,
        hasMore
      };
    } catch (error) {
      this.logger.error('Search failed', { 
        criteria,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Validate analysis result before storage
   */
  private validateAnalysisResult(result: CrashAnalysisResult): void {
    if (!result.id || typeof result.id !== 'string') {
      throw new ValidationError('Analysis result must have a valid ID');
    }

    if (!result.crashLogId || typeof result.crashLogId !== 'string') {
      throw new ValidationError('Analysis result must have a valid crash log ID');
    }

    if (typeof result.confidence !== 'number' || result.confidence < 0 || result.confidence > 1) {
      throw new ValidationError('Confidence must be a number between 0 and 1');
    }

    if (!result.createdAt || !(result.createdAt instanceof Date)) {
      throw new ValidationError('Analysis result must have a valid creation date');
    }

    if (!result.result || typeof result.result !== 'object') {
      throw new ValidationError('Analysis result must contain a valid result object');
    }
  }

  /**
   * Update category statistics when storing results
   */
  private updateCategoryStatistics(result: CrashAnalysisResult): void {
    if (result.result && result.result.potentialRootCauses) {
      result.result.potentialRootCauses.forEach((cause: any) => {
        const category = cause.category || 'Unknown';
        this.categoryStats.set(category, (this.categoryStats.get(category) || 0) + 1);
      });
    }
  }

  /**
   * Decrement category statistics when deleting results
   */
  private decrementCategoryStatistics(result: CrashAnalysisResult): void {
    if (result.result && result.result.potentialRootCauses) {
      result.result.potentialRootCauses.forEach((cause: any) => {
        const category = cause.category || 'Unknown';
        const currentCount = this.categoryStats.get(category) || 0;
        if (currentCount > 1) {
          this.categoryStats.set(category, currentCount - 1);
        } else {
          this.categoryStats.delete(category);
        }
      });
    }
  }

  /**
   * Check storage limits and cleanup if needed
   */
  private async checkStorageLimits(): Promise<void> {
    const metrics = await this.getStorageMetrics();
    
    // In a real implementation, this would check actual storage limits
    if (metrics.totalResults > 10000) { // Arbitrary limit for this example
      this.logger.warn('Storage limit approaching, archiving old results', {
        totalResults: metrics.totalResults
      });
      
      await this.archiveOldResults();
    }
  }

  /**
   * Format bytes to human readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}