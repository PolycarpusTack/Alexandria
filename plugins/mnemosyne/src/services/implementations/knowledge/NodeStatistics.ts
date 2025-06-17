/**
 * Node Statistics
 * Handles statistics collection and analysis for knowledge nodes
 */

import { NodeStatistics as NodeStatsInterface } from '../../interfaces/KnowledgeService';
import { NodeStatisticsData } from './types';
import { MnemosyneContext } from '../../../types/MnemosyneContext';

export class NodeStatistics {
  private context: MnemosyneContext;

  constructor(context: MnemosyneContext) {
    this.context = context;
  }

  /**
   * Get comprehensive node statistics
   */
  async getStatistics(): Promise<NodeStatsInterface> {
    try {
      const [typeStats, statusStats, tagStats, activityStats] = await Promise.all([
        this.getTypeStatistics(),
        this.getStatusStatistics(),
        this.getTagStatistics(),
        this.getActivityStatistics()
      ]);

      // Calculate total from active nodes (excluding deleted)
      const total = Object.entries(statusStats)
        .filter(([status]) => status !== 'deleted')
        .reduce((sum, [, count]) => sum + count, 0);

      return {
        total,
        byType: typeStats,
        byStatus: statusStats,
        topTags: tagStats,
        recentActivity: activityStats
      };

    } catch (error) {
      this.context.logger.error('Failed to get node statistics', { error });
      throw error;
    }
  }

  /**
   * Get statistics by node type
   */
  async getTypeStatistics(): Promise<Record<string, number>> {
    const query = `
      SELECT type, COUNT(*) as count 
      FROM knowledge_nodes 
      WHERE status != 'deleted' 
      GROUP BY type
    `;

    const result = await this.context.dataService.query(query);
    
    const stats: Record<string, number> = {};
    result.forEach((row: any) => {
      stats[row.type] = parseInt(row.count, 10);
    });

    return stats;
  }

  /**
   * Get statistics by node status
   */
  async getStatusStatistics(): Promise<Record<string, number>> {
    const query = `
      SELECT status, COUNT(*) as count 
      FROM knowledge_nodes 
      GROUP BY status
    `;

    const result = await this.context.dataService.query(query);
    
    const stats: Record<string, number> = {};
    result.forEach((row: any) => {
      stats[row.status] = parseInt(row.count, 10);
    });

    return stats;
  }

  /**
   * Get top tags statistics
   */
  async getTagStatistics(limit: number = 20): Promise<Array<{ tag: string; count: number }>> {
    const query = `
      SELECT jsonb_array_elements_text(tags) as tag, COUNT(*) as count
      FROM knowledge_nodes
      WHERE status != 'deleted' AND tags IS NOT NULL
      GROUP BY tag
      ORDER BY count DESC
      LIMIT $1
    `;

    const result = await this.context.dataService.query(query, [limit]);
    
    return result.map((row: any) => ({
      tag: row.tag,
      count: parseInt(row.count, 10)
    }));
  }

  /**
   * Get recent activity statistics
   */
  async getActivityStatistics(days: number = 30): Promise<Array<{ date: string; count: number }>> {
    const query = `
      SELECT DATE(created) as date, COUNT(*) as count
      FROM knowledge_nodes
      WHERE created >= NOW() - INTERVAL '${days} days'
      GROUP BY DATE(created)
      ORDER BY date DESC
    `;

    const result = await this.context.dataService.query(query);
    
    return result.map((row: any) => ({
      date: row.date,
      count: parseInt(row.count, 10)
    }));
  }

  /**
   * Get author statistics
   */
  async getAuthorStatistics(limit: number = 10): Promise<Array<{ author: string; count: number }>> {
    const query = `
      SELECT author, COUNT(*) as count
      FROM knowledge_nodes
      WHERE status != 'deleted'
      GROUP BY author
      ORDER BY count DESC
      LIMIT $1
    `;

    const result = await this.context.dataService.query(query, [limit]);
    
    return result.map((row: any) => ({
      author: row.author,
      count: parseInt(row.count, 10)
    }));
  }

  /**
   * Get content size statistics
   */
  async getContentSizeStatistics(): Promise<{
    totalSize: number;
    averageSize: number;
    largestNode: { id: string; size: number };
    distribution: Record<string, number>;
  }> {
    const query = `
      SELECT 
        id,
        LENGTH(content) as size,
        AVG(LENGTH(content)) OVER() as avg_size,
        SUM(LENGTH(content)) OVER() as total_size
      FROM knowledge_nodes
      WHERE status != 'deleted'
      ORDER BY LENGTH(content) DESC
    `;

    const result = await this.context.dataService.query(query);
    
    if (result.length === 0) {
      return {
        totalSize: 0,
        averageSize: 0,
        largestNode: { id: '', size: 0 },
        distribution: {}
      };
    }

    const totalSize = parseInt(result[0].total_size, 10);
    const averageSize = parseFloat(result[0].avg_size);
    const largestNode = {
      id: result[0].id,
      size: parseInt(result[0].size, 10)
    };

    // Calculate size distribution
    const distribution: Record<string, number> = {
      'small (< 1KB)': 0,
      'medium (1-10KB)': 0,
      'large (10-100KB)': 0,
      'very large (> 100KB)': 0
    };

    result.forEach((row: any) => {
      const size = parseInt(row.size, 10);
      if (size < 1024) {
        distribution['small (< 1KB)']++;
      } else if (size < 10240) {
        distribution['medium (1-10KB)']++;
      } else if (size < 102400) {
        distribution['large (10-100KB)']++;
      } else {
        distribution['very large (> 100KB)']++;
      }
    });

    return {
      totalSize,
      averageSize,
      largestNode,
      distribution
    };
  }

  /**
   * Get version statistics
   */
  async getVersionStatistics(): Promise<{
    totalVersions: number;
    averageVersionsPerNode: number;
    mostVersionedNode: { id: string; versions: number };
  }> {
    const query = `
      SELECT 
        n.id,
        COUNT(v.id) as version_count,
        AVG(COUNT(v.id)) OVER() as avg_versions,
        SUM(COUNT(v.id)) OVER() as total_versions
      FROM knowledge_nodes n
      LEFT JOIN node_versions v ON n.id = v.node_id
      WHERE n.status != 'deleted'
      GROUP BY n.id
      ORDER BY version_count DESC
    `;

    const result = await this.context.dataService.query(query);
    
    if (result.length === 0) {
      return {
        totalVersions: 0,
        averageVersionsPerNode: 0,
        mostVersionedNode: { id: '', versions: 0 }
      };
    }

    return {
      totalVersions: parseInt(result[0].total_versions, 10),
      averageVersionsPerNode: parseFloat(result[0].avg_versions),
      mostVersionedNode: {
        id: result[0].id,
        versions: parseInt(result[0].version_count, 10)
      }
    };
  }

  /**
   * Get growth statistics over time
   */
  async getGrowthStatistics(months: number = 12): Promise<Array<{
    month: string;
    created: number;
    updated: number;
    cumulative: number;
  }>> {
    const query = `
      WITH monthly_stats AS (
        SELECT 
          DATE_TRUNC('month', created) as month,
          COUNT(*) as created_count
        FROM knowledge_nodes
        WHERE created >= NOW() - INTERVAL '${months} months'
        GROUP BY DATE_TRUNC('month', created)
      ),
      monthly_updates AS (
        SELECT 
          DATE_TRUNC('month', updated) as month,
          COUNT(*) as updated_count
        FROM knowledge_nodes
        WHERE updated >= NOW() - INTERVAL '${months} months'
          AND updated != created
        GROUP BY DATE_TRUNC('month', updated)
      )
      SELECT 
        TO_CHAR(ms.month, 'YYYY-MM') as month,
        COALESCE(ms.created_count, 0) as created,
        COALESCE(mu.updated_count, 0) as updated,
        SUM(COALESCE(ms.created_count, 0)) OVER (
          ORDER BY ms.month
          ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        ) as cumulative
      FROM monthly_stats ms
      LEFT JOIN monthly_updates mu ON ms.month = mu.month
      ORDER BY ms.month
    `;

    const result = await this.context.dataService.query(query);
    
    return result.map((row: any) => ({
      month: row.month,
      created: parseInt(row.created, 10),
      updated: parseInt(row.updated, 10),
      cumulative: parseInt(row.cumulative, 10)
    }));
  }

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics(): Promise<{
    averageCreationTime: number;
    averageUpdateTime: number;
    peakUsageHours: Array<{ hour: number; activity: number }>;
  }> {
    // This would typically track actual performance metrics
    // For now, return placeholder data
    return {
      averageCreationTime: 0.5, // seconds
      averageUpdateTime: 0.3,   // seconds
      peakUsageHours: [
        { hour: 9, activity: 120 },
        { hour: 14, activity: 95 },
        { hour: 16, activity: 110 }
      ]
    };
  }

  /**
   * Export statistics to various formats
   */
  async exportStatistics(format: 'json' | 'csv' = 'json'): Promise<string> {
    const stats = await this.getStatistics();
    const contentStats = await this.getContentSizeStatistics();
    const versionStats = await this.getVersionStatistics();
    const growthStats = await this.getGrowthStatistics();
    const authorStats = await this.getAuthorStatistics();

    const fullStats = {
      summary: stats,
      content: contentStats,
      versions: versionStats,
      growth: growthStats,
      authors: authorStats,
      generatedAt: new Date().toISOString()
    };

    switch (format) {
      case 'json':
        return JSON.stringify(fullStats, null, 2);
      
      case 'csv':
        return this.convertToCsv(fullStats);
      
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Convert statistics to CSV format
   */
  private convertToCsv(stats: any): string {
    const lines: string[] = [];
    
    // Summary statistics
    lines.push('Summary Statistics');
    lines.push('Metric,Value');
    lines.push(`Total Nodes,${stats.summary.total}`);
    
    // Type distribution
    lines.push('');
    lines.push('Node Types');
    lines.push('Type,Count');
    Object.entries(stats.summary.byType).forEach(([type, count]) => {
      lines.push(`${type},${count}`);
    });
    
    // Status distribution
    lines.push('');
    lines.push('Node Status');
    lines.push('Status,Count');
    Object.entries(stats.summary.byStatus).forEach(([status, count]) => {
      lines.push(`${status},${count}`);
    });
    
    return lines.join('\n');
  }
}