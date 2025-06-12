/**
 * Log Processor Service
 * Processes and enriches log entries
 */

import { Logger } from '@utils/logger';
import { EventBus } from '@core/event-bus/interfaces';
import { HeimdallLogEntry } from '../interfaces';
import { StorageManager } from './storage-manager';

export class LogProcessor {
  private readonly storageManager: StorageManager;
  private readonly eventBus: EventBus;
  private readonly logger: Logger;

  constructor(storageManager: StorageManager, eventBus: EventBus, logger: Logger) {
    this.storageManager = storageManager;
    this.eventBus = eventBus;
    this.logger = logger;
  }

  async processLog(log: HeimdallLogEntry): Promise<void> {
    try {
      // Validate log
      this.validateLog(log);

      // Enrich log
      const enrichedLog = await this.enrichLog(log);

      // Determine storage tier
      const tier = this.determineStorageTier(enrichedLog);

      // Store log
      await this.storageManager.store(enrichedLog, tier);

      // Emit event
      await this.eventBus.publish('heimdall:log:stored', {
        logId: enrichedLog.id,
        tier
      });
    } catch (error) {
      this.logger.error('Failed to process log', {
        logId: log.id,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  async processBatch(logs: HeimdallLogEntry[]): Promise<void> {
    try {
      // Validate all logs
      logs.forEach((log) => this.validateLog(log));

      // Enrich logs in parallel
      const enrichedLogs = await Promise.all(logs.map((log) => this.enrichLog(log)));

      // Group by storage tier
      const tierGroups = this.groupByStorageTier(enrichedLogs);

      // Store each group
      for (const [tier, group] of tierGroups.entries()) {
        await this.storageManager.storeBatch(group, tier);
      }

      // Emit batch event
      await this.eventBus.publish('heimdall:batch:stored', {
        count: logs.length,
        tiers: Array.from(tierGroups.keys())
      });
    } catch (error) {
      this.logger.error('Failed to process batch', {
        count: logs.length,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  private validateLog(log: HeimdallLogEntry): void {
    if (!log.id || !log.timestamp || !log.level || !log.source || !log.message) {
      throw new Error('Invalid log entry: missing required fields');
    }
  }

  private async enrichLog(log: HeimdallLogEntry): Promise<HeimdallLogEntry> {
    // TODO: Add enrichment logic
    return {
      ...log,
      storage: {
        tier: 'hot',
        compressed: false,
        indexed: true
      }
    };
  }

  private determineStorageTier(log: HeimdallLogEntry): 'hot' | 'warm' | 'cold' {
    // Recent logs go to hot storage
    const ageMs = Date.now() - Number(log.timestamp) / 1000000;
    const ageHours = ageMs / (60 * 60 * 1000);

    if (ageHours < 24) return 'hot';
    if (ageHours < 7 * 24) return 'warm';
    return 'cold';
  }

  private groupByStorageTier(logs: HeimdallLogEntry[]): Map<string, HeimdallLogEntry[]> {
    const groups = new Map<string, HeimdallLogEntry[]>();

    for (const log of logs) {
      const tier = this.determineStorageTier(log);
      const group = groups.get(tier) || [];
      group.push(log);
      groups.set(tier, group);
    }

    return groups;
  }
}
