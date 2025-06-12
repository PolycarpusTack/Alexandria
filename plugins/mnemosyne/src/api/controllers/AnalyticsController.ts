import { Request, Response } from 'express';
import { MnemosyneContext } from '../../types/MnemosyneContext';
import { NodeService } from '../../services/implementations/NodeService';
import { RelationshipService } from '../../services/implementations/RelationshipService';
import { SearchService } from '../../services/implementations/SearchService';
import { MnemosyneError, MnemosyneErrorCode } from '../../errors/MnemosyneErrors';

/**
 * Analytics data interfaces
 */
interface KnowledgeGraphMetrics {
  totalNodes: number;
  totalRelationships: number;
  avgRelationshipsPerNode: number;
  maxDepth: number;
  clusteringCoefficient: number;
  networkDensity: number;
  stronglyConnectedComponents: number;
  mostConnectedNodes: Array<{
    id: string;
    title: string;
    connectionCount: number;
  }>;
}

interface NodeTypeDistribution {
  [nodeType: string]: {
    count: number;
    percentage: number;
  };
}

interface RelationshipTypeDistribution {
  [relationshipType: string]: {
    count: number;
    percentage: number;
  };
}

interface GrowthMetrics {
  nodesCreatedLastWeek: number;
  nodesCreatedLastMonth: number;
  relationshipsCreatedLastWeek: number;
  relationshipsCreatedLastMonth: number;
  growthRate: {
    nodes: number;
    relationships: number;
  };
}

interface SearchAnalytics {
  totalSearches: number;
  topSearchTerms: Array<{
    term: string;
    count: number;
  }>;
  searchSuccessRate: number;
  avgResultCount: number;
}

/**
 * API Controller for Analytics operations
 */
export class AnalyticsController {
  private nodeService: NodeService;
  private relationshipService: RelationshipService;
  private searchService: SearchService;
  private context: MnemosyneContext;

  constructor(context: MnemosyneContext) {
    this.context = context;
    this.nodeService = new NodeService(context);
    this.relationshipService = new RelationshipService(context);
    this.searchService = new SearchService(context);
  }

  /**
   * Get comprehensive knowledge graph overview
   * GET /api/mnemosyne/analytics/overview
   */
  async getOverview(req: Request, res: Response): Promise<void> {
    try {
      const [
        graphMetrics,
        nodeDistribution,
        relationshipDistribution,
        growthMetrics
      ] = await Promise.all([
        this.getKnowledgeGraphMetrics(),
        this.getNodeTypeDistribution(),
        this.getRelationshipTypeDistribution(),
        this.getGrowthMetrics()
      ]);

      res.status(200).json({
        success: true,
        data: {
          graphMetrics,
          nodeDistribution,
          relationshipDistribution,
          growthMetrics,
          generatedAt: new Date().toISOString()
        }
      });

    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Get detailed knowledge graph metrics
   * GET /api/mnemosyne/analytics/graph-metrics
   */
  async getGraphMetrics(req: Request, res: Response): Promise<void> {
    try {
      const metrics = await this.getKnowledgeGraphMetrics();

      res.status(200).json({
        success: true,
        data: metrics
      });

    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Get node type distribution
   * GET /api/mnemosyne/analytics/node-distribution
   */
  async getNodeDistribution(req: Request, res: Response): Promise<void> {
    try {
      const distribution = await this.getNodeTypeDistribution();

      res.status(200).json({
        success: true,
        data: distribution
      });

    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Get relationship type distribution
   * GET /api/mnemosyne/analytics/relationship-distribution
   */
  async getRelationshipDistribution(req: Request, res: Response): Promise<void> {
    try {
      const distribution = await this.getRelationshipTypeDistribution();

      res.status(200).json({
        success: true,
        data: distribution
      });

    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Get growth metrics over time
   * GET /api/mnemosyne/analytics/growth
   */
  async getGrowthAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const { period } = req.query;
      const periodDays = period ? parseInt(period as string) : 30;

      if (isNaN(periodDays) || periodDays < 1 || periodDays > 365) {
        res.status(400).json({
          error: 'Period must be a number between 1 and 365 days'
        });
        return;
      }

      const growthMetrics = await this.getGrowthMetrics(periodDays);

      res.status(200).json({
        success: true,
        data: growthMetrics,
        period: periodDays
      });

    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Get search analytics
   * GET /api/mnemosyne/analytics/search
   */
  async getSearchAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const searchAnalytics = await this.getSearchMetrics();

      res.status(200).json({
        success: true,
        data: searchAnalytics
      });

    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Get content popularity metrics
   * GET /api/mnemosyne/analytics/content-popularity
   */
  async getContentPopularity(req: Request, res: Response): Promise<void> {
    try {
      const { limit } = req.query;
      const resultLimit = limit ? parseInt(limit as string) : 10;

      if (isNaN(resultLimit) || resultLimit < 1 || resultLimit > 100) {
        res.status(400).json({
          error: 'Limit must be a number between 1 and 100'
        });
        return;
      }

      const popularity = await this.getContentPopularityMetrics(resultLimit);

      res.status(200).json({
        success: true,
        data: popularity,
        limit: resultLimit
      });

    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Get network analysis metrics
   * GET /api/mnemosyne/analytics/network-analysis
   */
  async getNetworkAnalysis(req: Request, res: Response): Promise<void> {
    try {
      const analysis = await this.getNetworkAnalysisMetrics();

      res.status(200).json({
        success: true,
        data: analysis
      });

    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Get temporal analysis of knowledge graph evolution
   * GET /api/mnemosyne/analytics/temporal
   */
  async getTemporalAnalysis(req: Request, res: Response): Promise<void> {
    try {
      const { granularity } = req.query;
      const timeGranularity = granularity as 'day' | 'week' | 'month' || 'week';

      if (!['day', 'week', 'month'].includes(timeGranularity)) {
        res.status(400).json({
          error: 'Granularity must be one of: day, week, month'
        });
        return;
      }

      const temporalData = await this.getTemporalAnalysisData(timeGranularity);

      res.status(200).json({
        success: true,
        data: temporalData,
        granularity: timeGranularity
      });

    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Export analytics data in various formats
   * GET /api/mnemosyne/analytics/export
   */
  async exportAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const { format } = req.query;
      const exportFormat = format as 'json' | 'csv' | 'xlsx' || 'json';

      if (!['json', 'csv', 'xlsx'].includes(exportFormat)) {
        res.status(400).json({
          error: 'Format must be one of: json, csv, xlsx'
        });
        return;
      }

      const analyticsData = await this.getAllAnalyticsData();

      if (exportFormat === 'json') {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename="mnemosyne-analytics.json"');
        res.status(200).json(analyticsData);
      } else if (exportFormat === 'csv') {
        const csvData = this.convertToCSV(analyticsData);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="mnemosyne-analytics.csv"');
        res.status(200).send(csvData);
      } else {
        res.status(501).json({
          error: 'XLSX export not implemented yet'
        });
      }

    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Private helper methods
   */

  private async getKnowledgeGraphMetrics(): Promise<KnowledgeGraphMetrics> {
    // Implementation would use actual database queries
    // This is a placeholder implementation
    return {
      totalNodes: 0,
      totalRelationships: 0,
      avgRelationshipsPerNode: 0,
      maxDepth: 0,
      clusteringCoefficient: 0,
      networkDensity: 0,
      stronglyConnectedComponents: 0,
      mostConnectedNodes: []
    };
  }

  private async getNodeTypeDistribution(): Promise<NodeTypeDistribution> {
    // Placeholder implementation
    return {};
  }

  private async getRelationshipTypeDistribution(): Promise<RelationshipTypeDistribution> {
    // Placeholder implementation
    return {};
  }

  private async getGrowthMetrics(periodDays = 30): Promise<GrowthMetrics> {
    // Placeholder implementation
    return {
      nodesCreatedLastWeek: 0,
      nodesCreatedLastMonth: 0,
      relationshipsCreatedLastWeek: 0,
      relationshipsCreatedLastMonth: 0,
      growthRate: {
        nodes: 0,
        relationships: 0
      }
    };
  }

  private async getSearchMetrics(): Promise<SearchAnalytics> {
    // Placeholder implementation
    return {
      totalSearches: 0,
      topSearchTerms: [],
      searchSuccessRate: 0,
      avgResultCount: 0
    };
  }

  private async getContentPopularityMetrics(limit: number): Promise<any> {
    // Placeholder implementation
    return {
      mostViewedNodes: [],
      mostReferencedNodes: [],
      mostEditedNodes: []
    };
  }

  private async getNetworkAnalysisMetrics(): Promise<any> {
    // Placeholder implementation
    return {
      centralityMetrics: {},
      communityDetection: {},
      pathAnalysis: {}
    };
  }

  private async getTemporalAnalysisData(granularity: 'day' | 'week' | 'month'): Promise<any> {
    // Placeholder implementation
    return {
      timeSeries: [],
      trends: {},
      seasonality: {}
    };
  }

  private async getAllAnalyticsData(): Promise<any> {
    const [
      overview,
      networkAnalysis,
      temporalData
    ] = await Promise.all([
      this.getKnowledgeGraphMetrics(),
      this.getNetworkAnalysisMetrics(),
      this.getTemporalAnalysisData('week')
    ]);

    return {
      overview,
      networkAnalysis,
      temporalData,
      exportedAt: new Date().toISOString()
    };
  }

  private convertToCSV(data: any): string {
    // Simple CSV conversion - in production, use a proper CSV library
    const headers = Object.keys(data);
    const csvRows = [headers.join(',')];
    
    // This is a simplified implementation
    // Real implementation would handle nested objects properly
    csvRows.push(headers.map(header => JSON.stringify(data[header])).join(','));
    
    return csvRows.join('\n');
  }

  /**
   * Handle errors and send appropriate response
   */
  private handleError(error: any, res: Response): void {
    this.context.logger.error('API error in AnalyticsController', { error });

    if (error instanceof MnemosyneError) {
      const statusCode = this.getStatusCodeForError(error.code);
      res.status(statusCode).json({
        error: error.message,
        code: error.code,
        context: error.context
      });
    } else {
      res.status(500).json({
        error: 'Internal server error',
        message: 'An unexpected error occurred during analytics processing'
      });
    }
  }

  /**
   * Map error codes to HTTP status codes
   */
  private getStatusCodeForError(errorCode: string): number {
    switch (errorCode) {
      case MnemosyneErrorCode.NODE_NOT_FOUND:
      case MnemosyneErrorCode.RELATIONSHIP_NOT_FOUND:
        return 404;
      case MnemosyneErrorCode.INVALID_SEARCH_QUERY:
        return 400;
      case MnemosyneErrorCode.SEARCH_SERVICE_ERROR:
      case MnemosyneErrorCode.GRAPH_ANALYSIS_FAILED:
        return 422;
      case MnemosyneErrorCode.SERVICE_UNAVAILABLE:
        return 503;
      default:
        return 500;
    }
  }
}