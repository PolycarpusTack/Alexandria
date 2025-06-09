/**
 * Alert System API endpoints
 */

import { Router } from 'express';
import { container } from 'tsyringe';
import { AlertManager } from '../services/analytics/alert-manager';
import { createLogger } from '../../../core/services/logging-service';
import { authMiddleware } from '../../../core/security/auth-middleware';
import { validateRequest } from '../../../core/middleware/validation-middleware';
import { AlertRule, AlertEvent } from '../interfaces/alerts';
import { IRequestUser } from '../types/llm-types';

const logger = createLogger({ serviceName: 'AlertsAPI' });
const router = Router();

// Apply authentication to all alert routes
router.use(authMiddleware);

/**
 * Get active alerts
 */
router.get('/active', async (req, res) => {
  try {
    const alertManager = container.resolve(AlertManager);
    const alerts = alertManager.getActiveAlerts();
    
    res.json({
      success: true,
      alerts,
      count: alerts.length
    });
  } catch (error) {
    logger.error('Failed to get active alerts', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve active alerts'
    });
  }
});

/**
 * Get alert history
 */
router.get('/history', async (req, res) => {
  try {
    const alertManager = container.resolve(AlertManager);
    const { limit = 100, severity, startTime, endTime } = req.query;
    
    const options = {
      limit: parseInt(limit as string),
      severity: severity as 'critical' | 'warning' | 'info',
      startTime: startTime ? new Date(startTime as string) : undefined,
      endTime: endTime ? new Date(endTime as string) : undefined
    };
    
    const alerts = alertManager.getAlertHistory(options);
    
    res.json({
      success: true,
      alerts,
      count: alerts.length
    });
  } catch (error) {
    logger.error('Failed to get alert history', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve alert history'
    });
  }
});

/**
 * Get alert rules
 */
router.get('/rules', async (req, res) => {
  try {
    const alertManager = container.resolve(AlertManager);
    const rules = Array.from(alertManager['rules'].values()); // Access private property
    
    res.json({
      success: true,
      rules,
      count: rules.length
    });
  } catch (error) {
    logger.error('Failed to get alert rules', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve alert rules'
    });
  }
});

/**
 * Create alert rule
 */
router.post('/rules', 
  validateRequest({
    body: {
      name: { required: true, type: 'string' },
      metric: { required: true, type: 'string' },
      condition: { required: true, type: 'object' },
      timeWindow: { required: true, type: 'string' },
      severity: { required: true, enum: ['critical', 'warning', 'info'] },
      channels: { required: true, type: 'array' }
    }
  }),
  async (req, res) => {
    try {
      const alertManager = container.resolve(AlertManager);
      const rule: AlertRule = {
        id: `rule_${Date.now()}`,
        enabled: true,
        ...req.body
      };
      
      alertManager.registerRule(rule);
      
      res.json({
        success: true,
        rule
      });
    } catch (error) {
      logger.error('Failed to create alert rule', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to create alert rule'
      });
    }
  }
);

/**
 * Update alert rule
 */
router.put('/rules/:ruleId', async (req, res) => {
  try {
    const alertManager = container.resolve(AlertManager);
    const { ruleId } = req.params;
    
    alertManager.updateRule(ruleId, req.body);
    
    res.json({
      success: true,
      message: 'Rule updated successfully'
    });
  } catch (error) {
    logger.error('Failed to update alert rule', { error, ruleId: req.params.ruleId });
    res.status(500).json({
      success: false,
      error: 'Failed to update alert rule'
    });
  }
});

/**
 * Delete alert rule
 */
router.delete('/rules/:ruleId', async (req, res) => {
  try {
    const alertManager = container.resolve(AlertManager);
    const { ruleId } = req.params;
    
    alertManager.deleteRule(ruleId);
    
    res.json({
      success: true,
      message: 'Rule deleted successfully'
    });
  } catch (error) {
    logger.error('Failed to delete alert rule', { error, ruleId: req.params.ruleId });
    res.status(500).json({
      success: false,
      error: 'Failed to delete alert rule'
    });
  }
});

/**
 * Acknowledge alert
 */
router.post('/:alertId/acknowledge', async (req, res) => {
  try {
    const alertManager = container.resolve(AlertManager);
    const { alertId } = req.params;
    const { acknowledgedBy } = req.body;
    
    alertManager.acknowledgeAlert(alertId, acknowledgedBy || req.user?.username || 'system');
    
    res.json({
      success: true,
      message: 'Alert acknowledged successfully'
    });
  } catch (error) {
    logger.error('Failed to acknowledge alert', { error, alertId: req.params.alertId });
    res.status(500).json({
      success: false,
      error: 'Failed to acknowledge alert'
    });
  }
});

/**
 * Resolve alert
 */
router.post('/:alertId/resolve', async (req, res) => {
  try {
    const alertManager = container.resolve(AlertManager);
    const { alertId } = req.params;
    const { resolvedBy, resolution } = req.body;
    
    alertManager.resolveAlert(
      alertId,
      resolvedBy || req.user?.username || 'system',
      resolution
    );
    
    res.json({
      success: true,
      message: 'Alert resolved successfully'
    });
  } catch (error) {
    logger.error('Failed to resolve alert', { error, alertId: req.params.alertId });
    res.status(500).json({
      success: false,
      error: 'Failed to resolve alert'
    });
  }
});

/**
 * Get alert metrics
 */
router.get('/metrics', async (req, res) => {
  try {
    const alertManager = container.resolve(AlertManager);
    const activeAlerts = alertManager.getActiveAlerts();
    const history = alertManager.getAlertHistory({ limit: 1000 });
    
    // Calculate metrics
    const now = new Date();
    const todayStart = new Date(now.setHours(0, 0, 0, 0));
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    const metrics = {
      totalAlerts: history.length,
      activeAlerts: activeAlerts.length,
      acknowledgedAlerts: activeAlerts.filter(a => a.acknowledged).length,
      resolvedAlerts: history.filter(a => 
        a.resolved && a.resolvedAt && new Date(a.resolvedAt) >= todayStart
      ).length,
      alertsByRule: history.reduce((acc, alert) => {
        acc[alert.ruleId] = (acc[alert.ruleId] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      alertsBySeverity: {
        critical: history.filter(a => a.severity === 'critical').length,
        warning: history.filter(a => a.severity === 'warning').length,
        info: history.filter(a => a.severity === 'info').length
      },
      averageResolutionTime: calculateAverageResolutionTime(history),
      alertsPerHour: history.filter(a => new Date(a.timestamp) >= hourAgo).length
    };
    
    res.json({
      success: true,
      metrics
    });
  } catch (error) {
    logger.error('Failed to get alert metrics', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve alert metrics'
    });
  }
});

/**
 * Trigger manual alert check
 */
router.post('/check', async (req, res) => {
  try {
    const alertManager = container.resolve(AlertManager);
    await alertManager.checkAlerts();
    
    res.json({
      success: true,
      message: 'Alert check triggered successfully'
    });
  } catch (error) {
    logger.error('Failed to trigger alert check', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to trigger alert check'
    });
  }
});

// Helper function to calculate average resolution time
function calculateAverageResolutionTime(alerts: AlertEvent[]): number {
  const resolvedAlerts = alerts.filter(a => a.resolved && a.resolvedAt);
  if (resolvedAlerts.length === 0) return 0;
  
  const totalTime = resolvedAlerts.reduce((sum, alert) => {
    const resolutionTime = new Date(alert.resolvedAt).getTime() - new Date(alert.timestamp).getTime();
    return sum + resolutionTime;
  }, 0);
  
  return Math.round(totalTime / resolvedAlerts.length / 1000); // Return in seconds
}

export default router;