import { Router, Request, Response, NextFunction } from 'express';
import { Logger } from '../../../../utils/logger';
import { AnalyticsService } from '../services/analytics/analytics-service';
import { TimeRange } from '../interfaces/analytics';
import { ITimeRange } from '../types/llm-types';
import { EnhancedLlmService } from '../services/enhanced-llm-service';

export function createAnalyticsRouter(
  analyticsService: AnalyticsService,
  logger: Logger,
  llmService?: EnhancedLlmService
): Router {
  const router = Router();

  // Middleware to validate time range
  const validateTimeRange = (req: Request, res: Response, next: NextFunction) => {
    const { start, end, granularity } = req.query;

    if (!start || !end || !granularity) {
      return res.status(400).json({
        error: 'Missing required parameters: start, end, granularity'
      });
    }

    const validGranularities = ['hour', 'day', 'week', 'month'];
    if (!validGranularities.includes(granularity as string)) {
      return res.status(400).json({
        error: `Invalid granularity. Must be one of: ${validGranularities.join(', ')}`
      });
    }

    // Parse dates
    const startDate = new Date(start as string);
    const endDate = new Date(end as string);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({
        error: 'Invalid date format'
      });
    }

    if (startDate >= endDate) {
      return res.status(400).json({
        error: 'Start date must be before end date'
      });
    }

    // Add parsed time range to request
    (req as any).timeRange = {
      start: startDate,
      end: endDate,
      granularity: granularity as 'hour' | 'day' | 'week' | 'month'
    };

    next();
  };

  // GET /api/hadron/analytics/time-series
  router.get('/time-series', validateTimeRange, async (req: Request, res: Response) => {
    try {
      const timeRange = (req as any).timeRange as ITimeRange;
      const data = await analyticsService.getTimeSeriesData(timeRange);
      res.json(data);
    } catch (error) {
      logger.error('Failed to get time series data', { error });
      res.status(500).json({ error: 'Failed to get time series data' });
    }
  });

  // GET /api/hadron/analytics/root-causes
  router.get('/root-causes', validateTimeRange, async (req: Request, res: Response) => {
    try {
      const timeRange = (req as any).timeRange as ITimeRange;
      const data = await analyticsService.getRootCauseDistribution(timeRange);
      res.json(data);
    } catch (error) {
      logger.error('Failed to get root cause distribution', { error });
      res.status(500).json({ error: 'Failed to get root cause distribution' });
    }
  });

  // GET /api/hadron/analytics/model-performance
  router.get('/model-performance', async (req: Request, res: Response) => {
    try {
      const { model, start, end, granularity } = req.query;
      
      let timeRange: TimeRange | undefined;
      if (start && end && granularity) {
        timeRange = {
          start: new Date(start as string),
          end: new Date(end as string),
          granularity: granularity as 'hour' | 'day' | 'week' | 'month'
        };
      }

      const data = await analyticsService.getModelPerformance(
        model as string | undefined,
        timeRange
      );
      res.json(data);
    } catch (error) {
      logger.error('Failed to get model performance', { error });
      res.status(500).json({ error: 'Failed to get model performance' });
    }
  });

  // GET /api/hadron/analytics/severity-trends
  router.get('/severity-trends', validateTimeRange, async (req: Request, res: Response) => {
    try {
      const timeRange = (req as any).timeRange as ITimeRange;
      const data = await analyticsService.getSeverityTrends(timeRange);
      res.json(data);
    } catch (error) {
      logger.error('Failed to get severity trends', { error });
      res.status(500).json({ error: 'Failed to get severity trends' });
    }
  });

  // GET /api/hadron/analytics/summary
  router.get('/summary', async (req: Request, res: Response) => {
    try {
      const { start, end } = req.query;
      
      const timeRange: TimeRange = {
        start: start ? new Date(start as string) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        end: end ? new Date(end as string) : new Date(),
        granularity: 'day'
      };

      // Fetch all analytics data in parallel
      const [timeSeries, rootCauses, modelPerf, severity] = await Promise.all([
        analyticsService.getTimeSeriesData(timeRange),
        analyticsService.getRootCauseDistribution(timeRange),
        analyticsService.getModelPerformance(),
        analyticsService.getSeverityTrends(timeRange)
      ]);

      res.json({
        timeRange,
        timeSeries,
        rootCauses,
        modelPerformance: modelPerf,
        severityTrends: severity
      });
    } catch (error) {
      logger.error('Failed to get analytics summary', { error });
      res.status(500).json({ error: 'Failed to get analytics summary' });
    }
  });

  /**
   * Get LLM cache metrics
   */
  router.get('/cache-metrics', async (req, res) => {
    try {
      if (!llmService || !llmService['llmCacheService']) {
        return res.json({
          success: true,
          data: {
            cacheEnabled: false,
            message: 'LLM caching is not enabled'
          }
        });
      }
      
      const cacheService = llmService['llmCacheService'];
      const stats = await cacheService.getCacheStats();
      
      res.json({
        success: true,
        data: {
          cacheEnabled: true,
          ...stats
        }
      });
    } catch (error) {
      logger.error('Failed to get LLM cache metrics', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve LLM cache metrics'
      });
    }
  });
  
  return router;
}