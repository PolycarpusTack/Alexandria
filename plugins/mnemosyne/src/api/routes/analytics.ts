import { Router } from 'express';
import { AnalyticsController } from '../controllers/AnalyticsController';
import { MnemosyneContext } from '../../types/MnemosyneContext';
import { authMiddleware, requirePermissions } from '../middleware/authentication';
import { rateLimitMiddleware, searchRateLimit } from '../middleware/rateLimit';
import { validationMiddleware } from '../middleware/validation';

/**
 * Create analytics routes
 */
export function createAnalyticsRoutes(context: MnemosyneContext): Router {
  const router = Router();
  const analyticsController = new AnalyticsController(context);

  // Apply authentication and basic rate limiting to all routes
  router.use(authMiddleware(context));
  router.use(rateLimitMiddleware);

  // Require analytics permissions for all analytics endpoints
  router.use(requirePermissions(['data:read', 'analytics:view']));

  /**
   * Overview and summary endpoints
   */
  
  // Comprehensive analytics overview
  router.get('/overview',
    analyticsController.getOverview.bind(analyticsController)
  );

  // Knowledge graph metrics
  router.get('/graph-metrics',
    analyticsController.getGraphMetrics.bind(analyticsController)
  );

  /**
   * Distribution analysis endpoints
   */

  // Node type distribution
  router.get('/node-distribution',
    analyticsController.getNodeDistribution.bind(analyticsController)
  );

  // Relationship type distribution
  router.get('/relationship-distribution',
    analyticsController.getRelationshipDistribution.bind(analyticsController)
  );

  /**
   * Growth and temporal analysis endpoints
   */

  // Growth metrics over time
  router.get('/growth',
    validationMiddleware((req) => {
      const { period } = req.query;
      const errors: string[] = [];

      if (period !== undefined) {
        const periodNum = parseInt(period as string);
        if (isNaN(periodNum) || periodNum < 1 || periodNum > 365) {
          errors.push('period must be a number between 1 and 365');
        }
      }

      return { isValid: errors.length === 0, errors };
    }),
    analyticsController.getGrowthAnalytics.bind(analyticsController)
  );

  // Temporal analysis with different granularities
  router.get('/temporal',
    validationMiddleware((req) => {
      const { granularity } = req.query;
      const errors: string[] = [];

      if (granularity !== undefined && !['day', 'week', 'month'].includes(granularity as string)) {
        errors.push('granularity must be one of: day, week, month');
      }

      return { isValid: errors.length === 0, errors };
    }),
    analyticsController.getTemporalAnalysis.bind(analyticsController)
  );

  /**
   * Content and usage analysis endpoints
   */

  // Search analytics
  router.get('/search',
    searchRateLimit,
    analyticsController.getSearchAnalytics.bind(analyticsController)
  );

  // Content popularity metrics
  router.get('/content-popularity',
    validationMiddleware((req) => {
      const { limit } = req.query;
      const errors: string[] = [];

      if (limit !== undefined) {
        const limitNum = parseInt(limit as string);
        if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
          errors.push('limit must be a number between 1 and 100');
        }
      }

      return { isValid: errors.length === 0, errors };
    }),
    analyticsController.getContentPopularity.bind(analyticsController)
  );

  /**
   * Advanced network analysis endpoints
   */

  // Network analysis and graph theory metrics
  router.get('/network-analysis',
    searchRateLimit, // More resource intensive, so use search rate limit
    analyticsController.getNetworkAnalysis.bind(analyticsController)
  );

  /**
   * Export endpoints
   */

  // Export analytics data in various formats
  router.get('/export',
    requirePermissions(['data:read', 'analytics:export']),
    searchRateLimit, // Exports can be resource intensive
    validationMiddleware((req) => {
      const { format } = req.query;
      const errors: string[] = [];

      if (format !== undefined && !['json', 'csv', 'xlsx'].includes(format as string)) {
        errors.push('format must be one of: json, csv, xlsx');
      }

      return { isValid: errors.length === 0, errors };
    }),
    analyticsController.exportAnalytics.bind(analyticsController)
  );

  return router;
}