/**
 * Cache warming utilities for Mnemosyne
 * Used to pre-populate caches during application startup or maintenance
 */

import { DatabaseKnowledgeNodeService, DatabaseRelationshipService } from '../services';
import { CacheWarmer, cacheService } from '../services/CacheService';
import { DatabaseAdapterFactory } from '../services/DatabaseAdapter';

export interface CacheWarmingOptions {
  warmPopularNodes?: boolean;
  warmRecentNodes?: boolean;
  warmStatistics?: boolean;
  warmNetworkMetrics?: boolean;
  popularNodesLimit?: number;
  recentNodesLimit?: number;
}

export class MnemosyneCacheWarmer {
  private nodeService: DatabaseKnowledgeNodeService;
  private relationshipService: DatabaseRelationshipService;

  constructor(
    nodeService: DatabaseKnowledgeNodeService,
    relationshipService: DatabaseRelationshipService
  ) {
    this.nodeService = nodeService;
    this.relationshipService = relationshipService;
  }

  /**
   * Warm all commonly accessed caches
   */
  async warmAllCaches(options: CacheWarmingOptions = {}): Promise<void> {
    const {
      warmPopularNodes = true,
      warmRecentNodes = true,
      warmStatistics = true,
      warmNetworkMetrics = true,
      popularNodesLimit = 20,
      recentNodesLimit = 10
    } = options;

    console.log('🔥 Starting cache warming process...');
    const startTime = Date.now();

    try {
      const promises: Promise<void>[] = [];

      if (warmPopularNodes) {
        promises.push(this.warmPopularNodes(popularNodesLimit));
      }

      if (warmRecentNodes) {
        promises.push(this.warmRecentNodes(recentNodesLimit));
      }

      if (warmStatistics) {
        promises.push(this.warmStatistics());
      }

      if (warmNetworkMetrics) {
        promises.push(this.warmNetworkMetrics());
      }

      await Promise.all(promises);

      const endTime = Date.now();
      const duration = endTime - startTime;
      const stats = cacheService.getStats();

      console.log('✅ Cache warming completed successfully');
      console.log(`📊 Duration: ${duration}ms`);
      console.log(`💾 Cache entries: ${stats.size}/${stats.maxSize}`);
      console.log(`📈 Memory usage: ${Math.round(stats.memoryUsage / 1024 / 1024 * 100) / 100}MB`);
    } catch (error) {
      console.error('❌ Cache warming failed:', error);
      throw error;
    }
  }

  /**
   * Warm popular nodes cache
   */
  private async warmPopularNodes(limit: number = 20): Promise<void> {
    console.log(`🔥 Warming popular nodes cache (limit: ${limit})...`);
    
    try {
      await CacheWarmer.warmPopularNodesCache(this.nodeService);
      console.log('✅ Popular nodes cache warmed');
    } catch (error) {
      console.warn('⚠️ Failed to warm popular nodes cache:', error.message);
    }
  }

  /**
   * Warm recent nodes cache
   */
  private async warmRecentNodes(limit: number = 10): Promise<void> {
    console.log(`🔥 Warming recent nodes cache (limit: ${limit})...`);
    
    try {
      // Get recent nodes and warm their individual caches
      const recentNodes = await this.nodeService.getRecentNodes(undefined, limit);
      const nodeIds = recentNodes.map(node => node.id);
      
      await CacheWarmer.warmNodeCache(this.nodeService, nodeIds);
      console.log(`✅ Recent nodes cache warmed (${nodeIds.length} nodes)`);
    } catch (error) {
      console.warn('⚠️ Failed to warm recent nodes cache:', error.message);
    }
  }

  /**
   * Warm statistics cache
   */
  private async warmStatistics(): Promise<void> {
    console.log('🔥 Warming statistics cache...');
    
    try {
      await CacheWarmer.warmStatsCache(this.nodeService);
      console.log('✅ Statistics cache warmed');
    } catch (error) {
      console.warn('⚠️ Failed to warm statistics cache:', error.message);
    }
  }

  /**
   * Warm network metrics cache
   */
  private async warmNetworkMetrics(): Promise<void> {
    console.log('🔥 Warming network metrics cache...');
    
    try {
      await this.relationshipService.getNetworkMetrics();
      console.log('✅ Network metrics cache warmed');
    } catch (error) {
      console.warn('⚠️ Failed to warm network metrics cache:', error.message);
    }
  }

  /**
   * Warm cache for specific nodes
   */
  async warmSpecificNodes(nodeIds: string[]): Promise<void> {
    console.log(`🔥 Warming cache for ${nodeIds.length} specific nodes...`);
    
    try {
      await CacheWarmer.warmNodeCache(this.nodeService, nodeIds);
      console.log(`✅ Specific nodes cache warmed (${nodeIds.length} nodes)`);
    } catch (error) {
      console.warn('⚠️ Failed to warm specific nodes cache:', error.message);
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStatistics(): {
    size: number;
    maxSize: number;
    hitRate: number;
    hitRatePercentage: number;
    memoryUsage: number;
    memoryUsageMB: number;
  } {
    const stats = cacheService.getStats();
    return {
      ...stats,
      hitRatePercentage: Math.round(stats.hitRate * 100 * 100) / 100,
      memoryUsageMB: Math.round(stats.memoryUsage / 1024 / 1024 * 100) / 100
    };
  }
}

/**
 * Factory function to create a cache warmer from database connection
 */
export async function createCacheWarmer(): Promise<MnemosyneCacheWarmer> {
  try {
    const dbConnection = await DatabaseAdapterFactory.createDirectConnection();
    const nodeService = new DatabaseKnowledgeNodeService(dbConnection);
    const relationshipService = new DatabaseRelationshipService(dbConnection);
    
    return new MnemosyneCacheWarmer(nodeService, relationshipService);
  } catch (error) {
    console.error('Failed to create cache warmer:', error);
    throw error;
  }
}

/**
 * Utility function to warm caches with default settings
 */
export async function warmMnemosyneCaches(options?: CacheWarmingOptions): Promise<void> {
  const warmer = await createCacheWarmer();
  await warmer.warmAllCaches(options);
}

/**
 * Utility function to schedule periodic cache warming
 */
export function scheduleCacheWarming(
  intervalMinutes: number = 60,
  options?: CacheWarmingOptions
): NodeJS.Timeout {
  console.log(`📅 Scheduling cache warming every ${intervalMinutes} minutes`);
  
  return setInterval(async () => {
    try {
      console.log('🕐 Scheduled cache warming starting...');
      await warmMnemosyneCaches(options);
    } catch (error) {
      console.error('❌ Scheduled cache warming failed:', error);
    }
  }, intervalMinutes * 60 * 1000);
}