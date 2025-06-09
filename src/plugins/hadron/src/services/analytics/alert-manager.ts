/**
 * Analytics Alert Manager
 * Monitors analytics metrics and triggers alerts based on configured rules
 */

import { injectable, inject } from 'tsyringe';
import { EventBus } from '../../../../core/event-bus/event-bus';
import { IDataService } from '../../../../core/data/interfaces';
import { createLogger } from '../../../../core/services/logging-service';
import { AlertRule, AlertEvent, AlertSeverity, AlertChannel } from '../../interfaces/alerts';
import { TimeRange } from '../../interfaces/analytics';
import { NotificationService } from './notification-service';
import { AlertRuleEngine } from './alert-rule-engine';

const logger = createLogger({ serviceName: 'AlertManager' });

@injectable()
export class AlertManager {
  private rules: Map<string, AlertRule> = new Map();
  private activeAlerts: Map<string, AlertEvent> = new Map();
  private ruleEngine: AlertRuleEngine;
  private notificationService: NotificationService;
  private checkInterval: NodeJS.Timeout | null = null;
  private alertHistory: AlertEvent[] = [];

  constructor(
    @inject('DataService') private dataService: IDataService,
    @inject('EventBus') private eventBus: EventBus
  ) {
    this.ruleEngine = new AlertRuleEngine();
    this.notificationService = new NotificationService(eventBus);
    this.initializeDefaultRules();
    this.startMonitoring();
  }

  /**
   * Register a new alert rule
   */
  registerRule(rule: AlertRule): void {
    logger.info('Registering alert rule', { ruleId: rule.id, name: rule.name });
    
    // Validate rule
    if (!this.ruleEngine.validateRule(rule)) {
      throw new Error(`Invalid alert rule: ${rule.name}`);
    }

    this.rules.set(rule.id, rule);
    
    // Emit event
    this.eventBus.emit('alert:rule_registered', { rule });
  }

  /**
   * Update an existing rule
   */
  updateRule(ruleId: string, updates: Partial<AlertRule>): void {
    const existingRule = this.rules.get(ruleId);
    if (!existingRule) {
      throw new Error(`Rule not found: ${ruleId}`);
    }

    const updatedRule = { ...existingRule, ...updates };
    
    if (!this.ruleEngine.validateRule(updatedRule)) {
      throw new Error(`Invalid rule update: ${updatedRule.name}`);
    }

    this.rules.set(ruleId, updatedRule);
    logger.info('Updated alert rule', { ruleId, updates });
  }

  /**
   * Disable a rule
   */
  disableRule(ruleId: string): void {
    const rule = this.rules.get(ruleId);
    if (rule) {
      rule.enabled = false;
      logger.info('Disabled alert rule', { ruleId });
    }
  }

  /**
   * Enable a rule
   */
  enableRule(ruleId: string): void {
    const rule = this.rules.get(ruleId);
    if (rule) {
      rule.enabled = true;
      logger.info('Enabled alert rule', { ruleId });
    }
  }

  /**
   * Delete a rule
   */
  deleteRule(ruleId: string): void {
    this.rules.delete(ruleId);
    this.activeAlerts.delete(ruleId);
    logger.info('Deleted alert rule', { ruleId });
  }

  /**
   * Check all rules and trigger alerts
   */
  async checkAlerts(): Promise<void> {
    const startTime = Date.now();
    logger.debug('Starting alert check cycle');

    const checkPromises = Array.from(this.rules.values())
      .filter(rule => rule.enabled)
      .map(rule => this.checkRule(rule));

    await Promise.all(checkPromises);

    const duration = Date.now() - startTime;
    logger.debug('Alert check cycle completed', { duration, rulesChecked: checkPromises.length });
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): AlertEvent[] {
    return Array.from(this.activeAlerts.values());
  }

  /**
   * Get alert history
   */
  getAlertHistory(options?: {
    startTime?: Date;
    endTime?: Date;
    severity?: AlertSeverity;
    limit?: number;
  }): AlertEvent[] {
    let filtered = [...this.alertHistory];

    if (options?.startTime) {
      filtered = filtered.filter(alert => 
        new Date(alert.timestamp) >= options.startTime!
      );
    }

    if (options?.endTime) {
      filtered = filtered.filter(alert => 
        new Date(alert.timestamp) <= options.endTime!
      );
    }

    if (options?.severity) {
      filtered = filtered.filter(alert => alert.severity === options.severity);
    }

    if (options?.limit) {
      filtered = filtered.slice(-options.limit);
    }

    return filtered;
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string, acknowledgedBy: string): void {
    const alert = this.activeAlerts.get(alertId);
    if (alert) {
      alert.acknowledged = true;
      alert.acknowledgedBy = acknowledgedBy;
      alert.acknowledgedAt = new Date();
      
      logger.info('Alert acknowledged', { alertId, acknowledgedBy });
      this.eventBus.emit('alert:acknowledged', { alert });
    }
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string, resolvedBy: string, resolution?: string): void {
    const alert = this.activeAlerts.get(alertId);
    if (alert) {
      alert.resolved = true;
      alert.resolvedBy = resolvedBy;
      alert.resolvedAt = new Date();
      alert.resolution = resolution;
      
      // Move to history
      this.alertHistory.push(alert);
      this.activeAlerts.delete(alertId);
      
      // Keep history size manageable
      if (this.alertHistory.length > 10000) {
        this.alertHistory = this.alertHistory.slice(-5000);
      }
      
      logger.info('Alert resolved', { alertId, resolvedBy, resolution });
      this.eventBus.emit('alert:resolved', { alert });
    }
  }

  /**
   * Private methods
   */
  private async checkRule(rule: AlertRule): Promise<void> {
    try {
      // Get metric value
      const value = await this.getMetricValue(rule.metric, rule.timeWindow);
      
      // Evaluate condition
      const triggered = this.ruleEngine.evaluateCondition(
        value,
        rule.condition
      );

      const alertKey = rule.id;
      const existingAlert = this.activeAlerts.get(alertKey);

      if (triggered && !existingAlert) {
        // New alert
        await this.triggerAlert(rule, value);
      } else if (!triggered && existingAlert && existingAlert.autoResolve) {
        // Auto-resolve
        this.resolveAlert(alertKey, 'system', 'Condition no longer met');
      }
    } catch (error) {
      logger.error('Failed to check rule', { ruleId: rule.id, error });
    }
  }

  private async getMetricValue(metric: string, timeWindow: string): Promise<number> {
    const now = new Date();
    const timeRange = this.parseTimeWindow(timeWindow, now);

    // Query based on metric type
    const query = this.buildMetricQuery(metric, timeRange);
    const result = await this.dataService.query(query);

    // Extract value based on metric
    return this.extractMetricValue(metric, result);
  }

  private buildMetricQuery(metric: string, timeRange: TimeRange): string {
    const metricQueries: Record<string, string> = {
      'crash_rate': `
        SELECT COUNT(*) as value 
        FROM crash_logs 
        WHERE created_at >= '${timeRange.start.toISOString()}' 
        AND created_at <= '${timeRange.end.toISOString()}'
      `,
      'error_rate': `
        SELECT 
          COUNT(CASE WHEN status = 'error' THEN 1 END)::float / 
          NULLIF(COUNT(*), 0) as value
        FROM analysis_results
        WHERE created_at >= '${timeRange.start.toISOString()}' 
        AND created_at <= '${timeRange.end.toISOString()}'
      `,
      'response_time_p95': `
        SELECT percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms) as value
        FROM analysis_results
        WHERE created_at >= '${timeRange.start.toISOString()}' 
        AND created_at <= '${timeRange.end.toISOString()}'
      `,
      'critical_crashes': `
        SELECT COUNT(*) as value
        FROM crash_logs
        WHERE severity = 'critical'
        AND created_at >= '${timeRange.start.toISOString()}' 
        AND created_at <= '${timeRange.end.toISOString()}'
      `,
      'unique_users_affected': `
        SELECT COUNT(DISTINCT user_id) as value
        FROM crash_logs
        WHERE created_at >= '${timeRange.start.toISOString()}' 
        AND created_at <= '${timeRange.end.toISOString()}'
      `,
      'model_accuracy': `
        SELECT AVG(confidence_score) as value
        FROM analysis_results
        WHERE created_at >= '${timeRange.start.toISOString()}' 
        AND created_at <= '${timeRange.end.toISOString()}'
      `
    };

    return metricQueries[metric] || metricQueries['crash_rate'];
  }

  private extractMetricValue(metric: string, result: any[]): number {
    if (!result || result.length === 0) return 0;
    return Number(result[0].value) || 0;
  }

  private async triggerAlert(rule: AlertRule, value: number): Promise<void> {
    const alert: AlertEvent = {
      id: `${rule.id}_${Date.now()}`,
      ruleId: rule.id,
      ruleName: rule.name,
      severity: rule.severity,
      timestamp: new Date(),
      value,
      threshold: rule.condition.value,
      message: this.formatAlertMessage(rule, value),
      context: {
        metric: rule.metric,
        condition: rule.condition,
        timeWindow: rule.timeWindow
      },
      acknowledged: false,
      resolved: false,
      autoResolve: rule.autoResolve ?? true
    };

    this.activeAlerts.set(rule.id, alert);
    
    // Send notifications
    await this.notificationService.sendAlert(alert, rule.channels);
    
    // Emit event
    this.eventBus.emit('alert:triggered', { alert });
    
    logger.warn('Alert triggered', {
      ruleName: rule.name,
      value,
      threshold: rule.condition.value,
      severity: rule.severity
    });
  }

  private formatAlertMessage(rule: AlertRule, value: number): string {
    const templates: Record<string, string> = {
      'crash_rate': `Crash rate (${value.toFixed(0)}) has ${rule.condition.operator} threshold (${rule.condition.value})`,
      'error_rate': `Error rate (${(value * 100).toFixed(1)}%) has ${rule.condition.operator} threshold (${rule.condition.value * 100}%)`,
      'response_time_p95': `95th percentile response time (${value.toFixed(0)}ms) has ${rule.condition.operator} threshold (${rule.condition.value}ms)`,
      'critical_crashes': `Critical crashes (${value}) have ${rule.condition.operator} threshold (${rule.condition.value})`,
      'unique_users_affected': `Unique users affected (${value}) has ${rule.condition.operator} threshold (${rule.condition.value})`,
      'model_accuracy': `Model accuracy (${(value * 100).toFixed(1)}%) has ${rule.condition.operator} threshold (${rule.condition.value * 100}%)`
    };

    return templates[rule.metric] || `${rule.metric} (${value}) ${rule.condition.operator} ${rule.condition.value}`;
  }

  private parseTimeWindow(window: string, now: Date): TimeRange {
    const matches = window.match(/(\d+)([mhd])/);
    if (!matches) {
      throw new Error(`Invalid time window: ${window}`);
    }

    const [, amount, unit] = matches;
    const value = parseInt(amount);
    const start = new Date(now);

    switch (unit) {
      case 'm':
        start.setMinutes(start.getMinutes() - value);
        break;
      case 'h':
        start.setHours(start.getHours() - value);
        break;
      case 'd':
        start.setDate(start.getDate() - value);
        break;
    }

    return {
      start,
      end: now,
      granularity: unit === 'm' ? 'hour' : 'day'
    };
  }

  private initializeDefaultRules(): void {
    const defaultRules: AlertRule[] = [
      {
        id: 'high_crash_rate',
        name: 'High Crash Rate',
        description: 'Alert when crash rate exceeds normal levels',
        metric: 'crash_rate',
        condition: { operator: 'greater_than', value: 100 },
        timeWindow: '1h',
        severity: 'warning',
        channels: ['email', 'slack'],
        enabled: true,
        cooldown: 3600000 // 1 hour
      },
      {
        id: 'critical_crash_spike',
        name: 'Critical Crash Spike',
        description: 'Alert on sudden increase in critical crashes',
        metric: 'critical_crashes',
        condition: { operator: 'greater_than', value: 10 },
        timeWindow: '30m',
        severity: 'critical',
        channels: ['email', 'slack', 'pagerduty'],
        enabled: true,
        cooldown: 1800000 // 30 minutes
      },
      {
        id: 'high_error_rate',
        name: 'High Error Rate',
        description: 'Alert when analysis error rate is high',
        metric: 'error_rate',
        condition: { operator: 'greater_than', value: 0.1 }, // 10%
        timeWindow: '15m',
        severity: 'warning',
        channels: ['slack'],
        enabled: true
      },
      {
        id: 'slow_response_time',
        name: 'Slow Response Time',
        description: 'Alert when 95th percentile response time is slow',
        metric: 'response_time_p95',
        condition: { operator: 'greater_than', value: 5000 }, // 5 seconds
        timeWindow: '5m',
        severity: 'warning',
        channels: ['slack'],
        enabled: true
      },
      {
        id: 'low_model_accuracy',
        name: 'Low Model Accuracy',
        description: 'Alert when model accuracy drops',
        metric: 'model_accuracy',
        condition: { operator: 'less_than', value: 0.8 }, // 80%
        timeWindow: '1h',
        severity: 'info',
        channels: ['email'],
        enabled: true
      }
    ];

    defaultRules.forEach(rule => this.registerRule(rule));
    logger.info('Initialized default alert rules', { count: defaultRules.length });
  }

  private startMonitoring(): void {
    // Check alerts every minute
    this.checkInterval = setInterval(() => {
      this.checkAlerts().catch(error => {
        logger.error('Alert check failed', { error });
      });
    }, 60000);

    logger.info('Alert monitoring started');
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      logger.info('Alert monitoring stopped');
    }
  }
}