/**
 * Batch Processor Service
 * 
 * Handles batch processing of multiple crash logs with intelligent scheduling,
 * resource management, and progress tracking.
 */

import { Logger } from '../../../../../utils/logger';
import { EventBus } from '../../../../../core/event-bus/event-bus';
import { CrashAnalysisOrchestrator } from './crash-analysis-orchestrator';
import { CrashLog, CrashAnalysisResult } from '../../interfaces';
import { v4 as uuidv4 } from 'uuid';

export interface BatchProcessingConfig {
  maxConcurrentJobs: number;
  maxBatchSize: number;
  priorityQueues: boolean;
  retryAttempts: number;
  processingTimeout: number;
  enableLoadBalancing: boolean;
  resourceThrottling: boolean;
}

export interface BatchJob {
  id: string;
  crashLogIds: string[];
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  progress: {
    total: number;
    completed: number;
    failed: number;
    inProgress: number;
  };
  results: {
    successful: CrashAnalysisResult[];
    failed: Array<{ logId: string; error: string }>;
  };
  metadata: {
    requestedBy: string;
    estimatedTime?: number;
    actualTime?: number;
    resourceUsage?: {
      peakMemory: number;
      averageCpu: number;
    };
  };
}

export interface BatchProcessingMetrics {
  totalJobs: number;
  queuedJobs: number;
  processingJobs: number;
  completedJobs: number;
  failedJobs: number;
  averageJobTime: number;
  throughputPerHour: number;
  resourceUtilization: {
    cpu: number;
    memory: number;
    concurrentSlots: number;
  };
}

/**
 * Service for managing batch processing of crash logs
 */
export class BatchProcessor {
  private readonly config: BatchProcessingConfig;
  private readonly jobQueue: Map<string, BatchJob> = new Map();
  private readonly priorityQueues: Map<string, string[]> = new Map([
    ['critical', []],
    ['high', []],
    ['medium', []],
    ['low', []]
  ]);
  private readonly activeJobs: Set<string> = new Set();
  private readonly completedJobs: Map<string, BatchJob> = new Map();
  private processingIntervalId: NodeJS.Timeout | null = null;

  constructor(
    private crashAnalyzer: CrashAnalysisOrchestrator,
    private logger: Logger,
    private eventBus: EventBus,
    config: Partial<BatchProcessingConfig> = {}
  ) {
    this.config = {
      maxConcurrentJobs: 3,
      maxBatchSize: 50,
      priorityQueues: true,
      retryAttempts: 3,
      processingTimeout: 1800000, // 30 minutes
      enableLoadBalancing: true,
      resourceThrottling: true,
      ...config
    };

    this.startProcessingLoop();
  }

  /**
   * Submit a batch job for processing
   */
  async submitBatchJob(
    crashLogIds: string[],
    options: {
      priority?: 'low' | 'medium' | 'high' | 'critical';
      requestedBy: string;
      metadata?: Record<string, any>;
    }
  ): Promise<string> {
    try {
      this.logger.info('Submitting batch job', { 
        crashLogCount: crashLogIds.length,
        priority: options.priority || 'medium',
        requestedBy: options.requestedBy
      });

      // Validate batch size
      if (crashLogIds.length === 0) {
        throw new Error('Batch job must contain at least one crash log');
      }

      if (crashLogIds.length > this.config.maxBatchSize) {
        throw new Error(`Batch size ${crashLogIds.length} exceeds maximum allowed size ${this.config.maxBatchSize}`);
      }

      // Create batch job
      const jobId = uuidv4();
      const priority = options.priority || 'medium';
      
      const batchJob: BatchJob = {
        id: jobId,
        crashLogIds: [...crashLogIds], // Create a copy
        priority,
        status: 'queued',
        createdAt: new Date(),
        progress: {
          total: crashLogIds.length,
          completed: 0,
          failed: 0,
          inProgress: 0
        },
        results: {
          successful: [],
          failed: []
        },
        metadata: {
          requestedBy: options.requestedBy,
          estimatedTime: this.estimateProcessingTime(crashLogIds.length),
          ...options.metadata
        }
      };

      // Add to queue
      this.jobQueue.set(jobId, batchJob);

      // Add to priority queue if enabled
      if (this.config.priorityQueues) {
        this.priorityQueues.get(priority)?.push(jobId);
      }

      // Emit job submitted event
      this.eventBus.publish('hadron:batch:job-submitted', {
        jobId,
        crashLogCount: crashLogIds.length,
        priority,
        requestedBy: options.requestedBy,
        estimatedTime: batchJob.metadata.estimatedTime
      });

      this.logger.info('Batch job submitted', { 
        jobId,
        crashLogCount: crashLogIds.length,
        priority,
        estimatedTime: batchJob.metadata.estimatedTime
      });

      return jobId;
    } catch (error) {
      this.logger.error('Failed to submit batch job', { 
        crashLogCount: crashLogIds.length,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Get batch job status
   */
  async getBatchJobStatus(jobId: string): Promise<BatchJob | null> {
    const job = this.jobQueue.get(jobId) || this.completedJobs.get(jobId);
    
    if (!job) {
      this.logger.warn('Batch job not found', { jobId });
      return null;
    }

    return { ...job }; // Return a copy to prevent external modification
  }

  /**
   * Cancel a batch job
   */
  async cancelBatchJob(jobId: string): Promise<boolean> {
    try {
      this.logger.info('Cancelling batch job', { jobId });

      const job = this.jobQueue.get(jobId);
      
      if (!job) {
        this.logger.warn('Cannot cancel job - not found', { jobId });
        return false;
      }

      if (job.status === 'completed' || job.status === 'failed') {
        this.logger.warn('Cannot cancel job - already finished', { jobId, status: job.status });
        return false;
      }

      // Update job status
      job.status = 'cancelled';
      job.completedAt = new Date();

      // Remove from priority queues
      if (this.config.priorityQueues) {
        for (const [_, queue] of this.priorityQueues) {
          const index = queue.indexOf(jobId);
          if (index !== -1) {
            queue.splice(index, 1);
            break;
          }
        }
      }

      // Move to completed jobs
      this.completedJobs.set(jobId, job);
      this.jobQueue.delete(jobId);
      this.activeJobs.delete(jobId);

      // Emit cancellation event
      this.eventBus.publish('hadron:batch:job-cancelled', {
        jobId,
        progress: job.progress
      });

      this.logger.info('Batch job cancelled', { jobId });
      return true;
    } catch (error) {
      this.logger.error('Failed to cancel batch job', { 
        jobId,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * Get batch processing metrics
   */
  async getBatchProcessingMetrics(): Promise<BatchProcessingMetrics> {
    const allJobs = Array.from(this.jobQueue.values()).concat(Array.from(this.completedJobs.values()));
    
    const totalJobs = allJobs.length;
    const queuedJobs = allJobs.filter(job => job.status === 'queued').length;
    const processingJobs = allJobs.filter(job => job.status === 'processing').length;
    const completedJobs = allJobs.filter(job => job.status === 'completed').length;
    const failedJobs = allJobs.filter(job => job.status === 'failed').length;

    // Calculate average job time
    const finishedJobs = allJobs.filter(job => job.completedAt && job.startedAt);
    const averageJobTime = finishedJobs.length > 0 
      ? finishedJobs.reduce((sum, job) => {
          const duration = job.completedAt!.getTime() - job.startedAt!.getTime();
          return sum + duration;
        }, 0) / finishedJobs.length
      : 0;

    // Calculate throughput per hour
    const lastHour = new Date(Date.now() - 3600000);
    const recentCompletedJobs = allJobs.filter(job => 
      job.status === 'completed' && job.completedAt && job.completedAt > lastHour
    ).length;

    // Resource utilization (simplified estimates)
    const resourceUtilization = {
      cpu: Math.min((processingJobs / this.config.maxConcurrentJobs) * 100, 100),
      memory: this.estimateMemoryUsage(processingJobs),
      concurrentSlots: this.config.maxConcurrentJobs - processingJobs
    };

    return {
      totalJobs,
      queuedJobs,
      processingJobs,
      completedJobs,
      failedJobs,
      averageJobTime: Math.round(averageJobTime),
      throughputPerHour: recentCompletedJobs,
      resourceUtilization
    };
  }

  /**
   * Get list of batch jobs with filtering
   */
  async getBatchJobs(filters: {
    status?: string;
    priority?: string;
    requestedBy?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{
    jobs: BatchJob[];
    total: number;
    hasMore: boolean;
  }> {
    const allJobs = Array.from(this.jobQueue.values()).concat(Array.from(this.completedJobs.values()));
    
    let filteredJobs = allJobs;

    // Apply filters
    if (filters.status) {
      filteredJobs = filteredJobs.filter(job => job.status === filters.status);
    }

    if (filters.priority) {
      filteredJobs = filteredJobs.filter(job => job.priority === filters.priority);
    }

    if (filters.requestedBy) {
      filteredJobs = filteredJobs.filter(job => job.metadata.requestedBy === filters.requestedBy);
    }

    // Sort by creation date (newest first)
    filteredJobs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const total = filteredJobs.length;
    const offset = filters.offset || 0;
    const limit = filters.limit || 20;

    // Apply pagination
    const paginatedJobs = filteredJobs.slice(offset, offset + limit);
    const hasMore = offset + limit < total;

    return {
      jobs: paginatedJobs,
      total,
      hasMore
    };
  }

  /**
   * Start the processing loop
   */
  private startProcessingLoop(): void {
    if (this.processingIntervalId) {
      clearInterval(this.processingIntervalId);
    }

    this.processingIntervalId = setInterval(() => {
      this.processNextJob().catch(error => {
        this.logger.error('Error in processing loop', {
          error: error instanceof Error ? error.message : String(error)
        });
      });
    }, 5000); // Check every 5 seconds

    this.logger.info('Batch processing loop started');
  }

  /**
   * Process the next job in the queue
   */
  private async processNextJob(): Promise<void> {
    // Check if we can start a new job
    if (this.activeJobs.size >= this.config.maxConcurrentJobs) {
      return;
    }

    // Get next job from queue
    const nextJobId = this.getNextJobFromQueue();
    if (!nextJobId) {
      return;
    }

    const job = this.jobQueue.get(nextJobId);
    if (!job) {
      return;
    }

    // Start processing the job
    await this.processJob(job);
  }

  /**
   * Get the next job from the priority queue or regular queue
   */
  private getNextJobFromQueue(): string | null {
    if (this.config.priorityQueues) {
      // Check priority queues in order
      for (const priority of ['critical', 'high', 'medium', 'low']) {
        const queue = this.priorityQueues.get(priority);
        if (queue && queue.length > 0) {
          return queue.shift()!;
        }
      }
    } else {
      // Get oldest queued job
      const queuedJobs = Array.from(this.jobQueue.values())
        .filter(job => job.status === 'queued')
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      
      return queuedJobs.length > 0 ? queuedJobs[0].id : null;
    }

    return null;
  }

  /**
   * Process a batch job
   */
  private async processJob(job: BatchJob): Promise<void> {
    try {
      this.logger.info('Starting batch job processing', { 
        jobId: job.id,
        crashLogCount: job.crashLogIds.length,
        priority: job.priority
      });

      // Update job status
      job.status = 'processing';
      job.startedAt = new Date();
      this.activeJobs.add(job.id);

      // Emit processing started event
      this.eventBus.publish('hadron:batch:job-started', {
        jobId: job.id,
        crashLogCount: job.crashLogIds.length,
        priority: job.priority
      });

      // Process crash logs in smaller batches for better resource management
      const batchSize = Math.min(this.config.maxConcurrentJobs, 10);
      const processingPromises: Promise<void>[] = [];

      for (let i = 0; i < job.crashLogIds.length; i += batchSize) {
        const batch = job.crashLogIds.slice(i, i + batchSize);
        const promise = this.processCrashLogBatch(job, batch);
        processingPromises.push(promise);

        // Limit concurrent batches
        if (processingPromises.length >= this.config.maxConcurrentJobs) {
          await Promise.allSettled(processingPromises);
          processingPromises.length = 0;
        }
      }

      // Wait for remaining batches
      if (processingPromises.length > 0) {
        await Promise.allSettled(processingPromises);
      }

      // Complete the job
      job.status = 'completed';
      job.completedAt = new Date();
      job.metadata.actualTime = job.completedAt.getTime() - job.startedAt!.getTime();

      // Move to completed jobs
      this.completedJobs.set(job.id, job);
      this.jobQueue.delete(job.id);
      this.activeJobs.delete(job.id);

      // Emit completion event
      this.eventBus.publish('hadron:batch:job-completed', {
        jobId: job.id,
        progress: job.progress,
        actualTime: job.metadata.actualTime,
        successfulCount: job.results.successful.length,
        failedCount: job.results.failed.length
      });

      this.logger.info('Batch job completed', { 
        jobId: job.id,
        actualTime: job.metadata.actualTime,
        successfulCount: job.results.successful.length,
        failedCount: job.results.failed.length
      });
    } catch (error) {
      // Handle job failure
      job.status = 'failed';
      job.completedAt = new Date();
      
      // Move to completed jobs
      this.completedJobs.set(job.id, job);
      this.jobQueue.delete(job.id);
      this.activeJobs.delete(job.id);

      // Emit failure event
      this.eventBus.publish('hadron:batch:job-failed', {
        jobId: job.id,
        error: error instanceof Error ? error.message : String(error),
        progress: job.progress
      });

      this.logger.error('Batch job failed', { 
        jobId: job.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Process a batch of crash logs
   */
  private async processCrashLogBatch(job: BatchJob, crashLogIds: string[]): Promise<void> {
    const promises = crashLogIds.map(async (logId) => {
      try {
        job.progress.inProgress++;
        
        // Emit progress update
        this.eventBus.publish('hadron:batch:progress', {
          jobId: job.id,
          progress: job.progress
        });

        const result = await this.crashAnalyzer.analyzeLog(logId);
        
        job.results.successful.push(result);
        job.progress.completed++;
        job.progress.inProgress--;
      } catch (error) {
        job.results.failed.push({
          logId,
          error: error instanceof Error ? error.message : String(error)
        });
        job.progress.failed++;
        job.progress.inProgress--;

        this.logger.warn('Failed to analyze crash log in batch', {
          jobId: job.id,
          logId,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    });

    await Promise.allSettled(promises);
  }

  /**
   * Estimate processing time for a batch
   */
  private estimateProcessingTime(crashLogCount: number): number {
    const avgTimePerLog = 30000; // 30 seconds per log (estimate)
    const concurrency = Math.min(this.config.maxConcurrentJobs, crashLogCount);
    return Math.ceil(crashLogCount / concurrency) * avgTimePerLog;
  }

  /**
   * Estimate memory usage for concurrent jobs
   */
  private estimateMemoryUsage(concurrentJobs: number): number {
    const memoryPerJob = 10; // 10% per job (estimate)
    return Math.min(concurrentJobs * memoryPerJob, 90); // Cap at 90%
  }

  /**
   * Cleanup completed jobs older than retention period
   */
  async cleanupOldJobs(retentionDays: number = 7): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      let cleanedCount = 0;
      
      for (const [jobId, job] of this.completedJobs) {
        if (job.completedAt && job.completedAt < cutoffDate) {
          this.completedJobs.delete(jobId);
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        this.logger.info('Cleaned up old batch jobs', { 
          cleanedCount,
          retentionDays
        });

        this.eventBus.publish('hadron:batch:cleanup', {
          cleanedCount,
          retentionDays
        });
      }

      return cleanedCount;
    } catch (error) {
      this.logger.error('Failed to cleanup old jobs', {
        error: error instanceof Error ? error.message : String(error)
      });
      return 0;
    }
  }

  /**
   * Stop the batch processor
   */
  stop(): void {
    if (this.processingIntervalId) {
      clearInterval(this.processingIntervalId);
      this.processingIntervalId = null;
    }

    this.logger.info('Batch processor stopped');
  }
}