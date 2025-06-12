/**
 * Feedback API endpoints for crash analysis feedback
 */

import { Router } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { FeedbackService } from '../services/feedback/feedback-service';
import { Logger } from '@utils/logger';
import { authMiddleware } from '@core/security/auth-middleware';
import { permissionMiddleware } from './permission-middleware';

export function createFeedbackRouter(feedbackService: FeedbackService, logger: Logger): Router {
  const router = Router();

  // Apply authentication to all feedback routes
  router.use(authMiddleware);

  /**
   * Submit feedback for an analysis
   * POST /api/feedback
   */
  router.post(
    '/',
    [
      body('analysisId').isString().notEmpty(),
      body('crashLogId').isString().notEmpty(),
      body('rating').isInt({ min: 1, max: 5 }),
      body('accuracy').isObject(),
      body('accuracy.rootCauseAccurate').isBoolean(),
      body('accuracy.suggestionsHelpful').isBoolean(),
      body('accuracy.confidenceAppropriate').isBoolean(),
      body('accuracy.nothingMissed').isBoolean(),
      body('usefulness').isObject(),
      body('usefulness.savedTime').isBoolean(),
      body('usefulness.learnedSomething').isBoolean(),
      body('usefulness.wouldUseAgain').isBoolean(),
      body('usefulness.betterThanManual').isBoolean(),
      body('comments').optional().isString(),
      body('correctRootCause').optional().isString(),
      body('missedIssues').optional().isArray(),
      body('incorrectSuggestions').optional().isArray(),
      body('helpfulSuggestions').optional().isArray(),
      body('metadata').optional().isObject()
    ],
    async (req, res) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }

        const userId = req.user?.id || 'anonymous';
        const feedbackData = {
          ...req.body,
          userId
        };

        const feedback = await feedbackService.submitFeedback(feedbackData);

        logger.info('Feedback submitted', {
          feedbackId: feedback.id,
          analysisId: feedback.analysisId,
          userId
        });

        res.status(201).json({
          success: true,
          data: feedback
        });
      } catch (error) {
        logger.error('Error submitting feedback:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to submit feedback'
        });
      }
    }
  );

  /**
   * Get feedback for a specific analysis
   * GET /api/feedback/analysis/:analysisId
   */
  router.get(
    '/analysis/:analysisId',
    [param('analysisId').isString().notEmpty()],
    permissionMiddleware('feedback:read'),
    async (req, res) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }

        const { analysisId } = req.params;
        const feedback = await feedbackService.getFeedbackForAnalysis(analysisId);

        res.json({
          success: true,
          data: feedback
        });
      } catch (error) {
        logger.error('Error retrieving feedback:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to retrieve feedback'
        });
      }
    }
  );

  /**
   * Get feedback statistics
   * GET /api/feedback/stats
   */
  router.get(
    '/stats',
    [
      query('startDate').optional().isISO8601(),
      query('endDate').optional().isISO8601(),
      query('llmModel').optional().isString(),
      query('minFeedbackCount').optional().isInt({ min: 1 })
    ],
    permissionMiddleware('feedback:stats'),
    async (req, res) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }

        const options = {
          startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
          endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
          llmModel: req.query.llmModel as string | undefined,
          minFeedbackCount: req.query.minFeedbackCount
            ? parseInt(req.query.minFeedbackCount as string)
            : undefined
        };

        const stats = await feedbackService.getFeedbackStats(options);

        res.json({
          success: true,
          data: stats
        });
      } catch (error) {
        logger.error('Error calculating feedback stats:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to calculate feedback statistics'
        });
      }
    }
  );

  /**
   * Analyze feedback patterns
   * GET /api/feedback/patterns
   */
  router.get(
    '/patterns',
    [
      query('minSampleSize').optional().isInt({ min: 1 }),
      query('focusArea').optional().isIn(['accuracy', 'usefulness', 'performance'])
    ],
    permissionMiddleware('feedback:analyze'),
    async (req, res) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }

        const options = {
          minSampleSize: req.query.minSampleSize
            ? parseInt(req.query.minSampleSize as string)
            : undefined,
          focusArea: req.query.focusArea as 'accuracy' | 'usefulness' | 'performance' | undefined
        };

        const analysis = await feedbackService.analyzeFeedbackPatterns(options);

        res.json({
          success: true,
          data: analysis
        });
      } catch (error) {
        logger.error('Error analyzing feedback patterns:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to analyze feedback patterns'
        });
      }
    }
  );

  /**
   * Get recommendations for a crash type
   * GET /api/feedback/recommendations/:crashType
   */
  router.get(
    '/recommendations/:crashType',
    [param('crashType').isString().notEmpty()],
    async (req, res) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }

        const { crashType } = req.params;
        const recommendations = await feedbackService.getRecommendations(crashType);

        res.json({
          success: true,
          data: recommendations
        });
      } catch (error) {
        logger.error('Error getting recommendations:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to get recommendations'
        });
      }
    }
  );

  /**
   * Export feedback data for training
   * GET /api/feedback/export
   */
  router.get(
    '/export',
    [
      query('minRating').optional().isInt({ min: 1, max: 5 }),
      query('includeNegative').optional().isBoolean(),
      query('format').optional().isIn(['json', 'csv'])
    ],
    permissionMiddleware('feedback:export'),
    async (req, res) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }

        const options = {
          minRating: req.query.minRating ? parseInt(req.query.minRating as string) : undefined,
          includeNegative: req.query.includeNegative === 'true',
          format: (req.query.format as 'json' | 'csv') || 'json'
        };

        const exportData = await feedbackService.exportTrainingData(options);

        const contentType = options.format === 'csv' ? 'text/csv' : 'application/json';
        const filename = `feedback-export-${new Date().toISOString()}.${options.format}`;

        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(exportData);
      } catch (error) {
        logger.error('Error exporting feedback data:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to export feedback data'
        });
      }
    }
  );

  return router;
}
