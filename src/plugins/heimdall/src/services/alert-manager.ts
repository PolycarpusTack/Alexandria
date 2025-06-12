/**
 * Alert Manager Service
 * Manages log-based alerts and notifications
 */

import { Logger } from '@utils/logger';
import { EventBus } from '@core/event-bus/interfaces';
import {
  HeimdallPluginContext,
  HeimdallLogEntry,
  Alert,
  AlertAction,
  ComponentHealth
} from '../interfaces';

export class AlertManager {
  private readonly context: HeimdallPluginContext;
  private readonly eventBus: EventBus;
  private readonly logger: Logger;
  private alerts: Map<string, Alert> = new Map();
  private checkInterval?: NodeJS.Timeout;

  constructor(context: HeimdallPluginContext, eventBus: EventBus, logger: Logger) {
    this.context = context;
    this.eventBus = eventBus;
    this.logger = logger;
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing alert manager');

    // Load alerts from database
    await this.loadAlerts();
  }

  async start(): Promise<void> {
    this.logger.info('Starting alert manager');

    // Start periodic alert checking
    this.checkInterval = setInterval(() => {
      this.checkActiveAlerts();
    }, 60000); // Check every minute
  }

  async stop(): Promise<void> {
    this.logger.info('Stopping alert manager');

    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = undefined;
    }
  }

  async checkLog(log: HeimdallLogEntry): Promise<void> {
    // Check if log triggers any alerts
    for (const [id, alert] of this.alerts) {
      if (!alert.enabled) continue;

      if (await this.evaluateCondition(alert, log)) {
        await this.triggerAlert(alert, [log]);
      }
    }
  }

  async checkBatch(logs: HeimdallLogEntry[]): Promise<void> {
    // Check batch against alerts in parallel for better performance
    const alertChecks = Array.from(this.alerts.entries())
      .filter(([, alert]) => alert.enabled)
      .map(async ([id, alert]) => {
        try {
          const matchingLogs = logs.filter((log) => this.evaluateCondition(alert, log));
          if (matchingLogs.length > 0) {
            await this.triggerAlert(alert, matchingLogs);
            this.logger.debug('Alert triggered for batch', {
              alertId: id,
              matchingLogsCount: matchingLogs.length
            });
          }
        } catch (error) {
          this.logger.error('Failed to check alert against batch', {
            alertId: id,
            alertName: alert.name,
            error
          });
          // Don't throw - let other alerts continue processing
        }
      });

    // Process all alerts in parallel
    await Promise.allSettled(alertChecks);
  }

  async handleAnomaly(data: any): Promise<void> {
    // Create alert for detected anomaly
    this.logger.warn('Anomaly detected', data);

    await this.eventBus.publish('heimdall:alert:anomaly', {
      anomalyId: data.id,
      severity: data.score > 0.8 ? 'critical' : 'warning',
      timestamp: new Date()
    });
  }

  health(): ComponentHealth {
    return {
      status: 'up',
      details: {
        activeAlerts: this.alerts.size,
        enabledAlerts: Array.from(this.alerts.values()).filter((a) => a.enabled).length,
        lastCheck: new Date().toISOString()
      }
    };
  }

  // Public API methods for alert management

  async createAlert(alertConfig: Omit<Alert, 'id'>): Promise<Alert> {
    const alert: Alert = {
      id: this.generateAlertId(),
      ...alertConfig
    };

    // Validate alert configuration
    this.validateAlert(alert);

    // Store in database
    await this.context.getDataService().insert('heimdall_alerts', {
      id: alert.id,
      name: alert.name,
      condition: JSON.stringify(alert.condition),
      actions: JSON.stringify(alert.actions),
      schedule: alert.schedule,
      enabled: alert.enabled,
      metadata: JSON.stringify(alert.metadata || {}),
      created_at: new Date(),
      updated_at: new Date()
    });

    // Add to memory
    this.alerts.set(alert.id, alert);

    this.logger.info('Alert created', {
      alertId: alert.id,
      alertName: alert.name
    });

    return alert;
  }

  async updateAlert(alertId: string, updates: Partial<Alert>): Promise<Alert> {
    const existingAlert = this.alerts.get(alertId);
    if (!existingAlert) {
      throw new Error(`Alert not found: ${alertId}`);
    }

    const updatedAlert: Alert = {
      ...existingAlert,
      ...updates,
      id: alertId // Ensure ID cannot be changed
    };

    // Validate updated alert
    this.validateAlert(updatedAlert);

    // Update in database
    await this.context.getDataService().update(
      'heimdall_alerts',
      { id: alertId },
      {
        name: updatedAlert.name,
        condition: JSON.stringify(updatedAlert.condition),
        actions: JSON.stringify(updatedAlert.actions),
        schedule: updatedAlert.schedule,
        enabled: updatedAlert.enabled,
        metadata: JSON.stringify(updatedAlert.metadata || {}),
        updated_at: new Date()
      }
    );

    // Update in memory
    this.alerts.set(alertId, updatedAlert);

    this.logger.info('Alert updated', {
      alertId,
      alertName: updatedAlert.name
    });

    return updatedAlert;
  }

  async deleteAlert(alertId: string): Promise<boolean> {
    const alert = this.alerts.get(alertId);
    if (!alert) {
      return false;
    }

    // Remove from database
    await this.context.getDataService().delete('heimdall_alerts', { id: alertId });

    // Remove from memory
    this.alerts.delete(alertId);

    this.logger.info('Alert deleted', {
      alertId,
      alertName: alert.name
    });

    return true;
  }

  async getAlert(alertId: string): Promise<Alert | null> {
    return this.alerts.get(alertId) || null;
  }

  async listAlerts(filters?: { enabled?: boolean; type?: string }): Promise<Alert[]> {
    let alerts = Array.from(this.alerts.values());

    if (filters?.enabled !== undefined) {
      alerts = alerts.filter((alert) => alert.enabled === filters.enabled);
    }

    if (filters?.type) {
      alerts = alerts.filter((alert) => alert.condition.type === filters.type);
    }

    return alerts;
  }

  async testAlert(alertId: string): Promise<{ success: boolean; message: string }> {
    const alert = this.alerts.get(alertId);
    if (!alert) {
      return { success: false, message: `Alert not found: ${alertId}` };
    }

    try {
      // Create a test log entry
      const testLog: HeimdallLogEntry = {
        id: 'test-log-' + Date.now(),
        timestamp: BigInt(Date.now()) * 1000000n,
        version: 1,
        level: 'ERROR' as any,
        source: {
          service: 'test-service',
          instance: 'test-instance',
          region: 'test-region',
          environment: 'dev' as any
        },
        message: {
          raw: 'Test alert message'
        },
        security: {
          classification: 'internal' as any,
          retentionPolicy: 'standard'
        },
        ml: {
          anomalyScore: 0.9
        }
      };

      // Test condition evaluation
      const conditionResult = await this.evaluateCondition(alert, testLog);

      if (conditionResult) {
        // Test actions without actually sending notifications
        for (const action of alert.actions) {
          this.logger.info('Would execute action in test mode', {
            alertId: alert.id,
            actionType: action.type
          });
        }

        return {
          success: true,
          message: `Alert test successful. Condition matched and ${alert.actions.length} actions would execute.`
        };
      } else {
        return {
          success: true,
          message: 'Alert test successful. Condition did not match test log.'
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Alert test failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  private async loadAlerts(): Promise<void> {
    try {
      const alerts = await this.context
        .getDataService()
        .query('SELECT * FROM heimdall_alerts WHERE enabled = true');

      for (const alert of alerts) {
        this.alerts.set(alert.id, alert);
      }

      this.logger.info('Loaded alerts', { count: alerts.length });
    } catch (error) {
      this.logger.error('Failed to load alerts', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async evaluateCondition(alert: Alert, log: HeimdallLogEntry): Promise<boolean> {
    try {
      switch (alert.condition.type) {
        case 'threshold':
          return await this.evaluateThresholdCondition(alert, log);

        case 'pattern':
          return await this.evaluatePatternCondition(alert, log);

        case 'anomaly':
          return await this.evaluateAnomalyCondition(alert, log);

        case 'absence':
          // Absence conditions are checked differently in periodic checks
          return false;

        default:
          this.logger.warn('Unknown alert condition type', {
            alertId: alert.id,
            conditionType: alert.condition.type
          });
          return false;
      }
    } catch (error) {
      this.logger.error('Error evaluating alert condition', {
        alertId: alert.id,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  private async evaluateThresholdCondition(alert: Alert, log: HeimdallLogEntry): Promise<boolean> {
    const { threshold } = alert.condition;
    if (!threshold) return false;

    // Extract numeric value from log based on the query field
    let value: number;

    // Common threshold fields
    if (log.metrics?.duration !== undefined) {
      value = log.metrics.duration;
    } else if (log.metrics?.errorRate !== undefined) {
      value = log.metrics.errorRate;
    } else if (log.metrics?.cpuUsage !== undefined) {
      value = log.metrics.cpuUsage;
    } else if (log.metrics?.memoryUsage !== undefined) {
      value = log.metrics.memoryUsage;
    } else if (log.ml?.anomalyScore !== undefined) {
      value = log.ml.anomalyScore;
    } else {
      // Try to extract numeric value from structured message
      const structured = log.message.structured;
      if (structured && typeof structured === 'object') {
        const keys = Object.keys(structured);
        const numericKey = keys.find((key) => typeof structured[key] === 'number');
        if (numericKey) {
          value = structured[numericKey] as number;
        } else {
          return false;
        }
      } else {
        return false;
      }
    }

    // Apply threshold operator
    switch (threshold.operator) {
      case 'gt':
        return value > threshold.value;
      case 'gte':
        return value >= threshold.value;
      case 'lt':
        return value < threshold.value;
      case 'lte':
        return value <= threshold.value;
      case 'eq':
        return value === threshold.value;
      default:
        return false;
    }
  }

  private async evaluatePatternCondition(alert: Alert, log: HeimdallLogEntry): Promise<boolean> {
    const { pattern } = alert.condition;
    if (!pattern) return false;

    try {
      const regex = new RegExp(pattern, 'i');

      // Check against raw message
      if (regex.test(log.message.raw)) {
        return true;
      }

      // Check against structured fields
      if (log.message.structured) {
        const structuredStr = JSON.stringify(log.message.structured);
        if (regex.test(structuredStr)) {
          return true;
        }
      }

      // Check against source information
      const sourceStr = `${log.source.service} ${log.source.instance} ${log.source.hostname || ''}`;
      if (regex.test(sourceStr)) {
        return true;
      }

      return false;
    } catch (error) {
      this.logger.error('Invalid regex pattern in alert condition', {
        alertId: alert.id,
        pattern,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  private async evaluateAnomalyCondition(alert: Alert, log: HeimdallLogEntry): Promise<boolean> {
    // Check if log has ML anomaly score
    if (!log.ml?.anomalyScore) return false;

    // Default threshold is 0.7, but can be configured
    const threshold = alert.condition.threshold?.value || 0.7;

    return log.ml.anomalyScore > threshold;
  }

  private async triggerAlert(alert: Alert, logs: HeimdallLogEntry[]): Promise<void> {
    this.logger.info('Triggering alert', {
      alertId: alert.id,
      alertName: alert.name,
      logCount: logs.length
    });

    // Execute alert actions
    for (const action of alert.actions) {
      try {
        await this.executeAction(action, alert, logs);
      } catch (error) {
        this.logger.error('Failed to execute alert action', {
          alertId: alert.id,
          actionType: action.type,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    // Update alert last triggered timestamp
    await this.context.getDataService().update(
      'heimdall_alerts',
      { id: alert.id },
      {
        last_triggered: new Date(),
        trigger_count: (alert as any).trigger_count + 1
      }
    );

    // Emit alert event
    await this.eventBus.publish('heimdall:alert:triggered', {
      alertId: alert.id,
      alertName: alert.name,
      logCount: logs.length,
      timestamp: new Date()
    });
  }

  private async executeAction(
    action: AlertAction,
    alert: Alert,
    logs: HeimdallLogEntry[]
  ): Promise<void> {
    // Check throttling
    if (await this.isActionThrottled(action, alert)) {
      this.logger.debug('Action throttled', {
        alertId: alert.id,
        actionType: action.type
      });
      return;
    }

    try {
      switch (action.type) {
        case 'email':
          await this.sendEmailNotification(action, alert, logs);
          break;

        case 'slack':
          await this.sendSlackNotification(action, alert, logs);
          break;

        case 'webhook':
          await this.callWebhook(action, alert, logs);
          break;

        case 'pagerduty':
          await this.createPagerDutyIncident(action, alert, logs);
          break;

        case 'custom':
          await this.executeCustomAction(action, alert, logs);
          break;

        default:
          this.logger.warn('Unknown action type', {
            alertId: alert.id,
            actionType: action.type
          });
      }

      // Update throttling record
      await this.updateActionThrottle(action, alert);
    } catch (error) {
      this.logger.error('Action execution failed', {
        alertId: alert.id,
        actionType: action.type,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  private async sendEmailNotification(
    action: AlertAction,
    alert: Alert,
    logs: HeimdallLogEntry[]
  ): Promise<void> {
    const config = action.config;

    if (!config.to || !config.smtp) {
      throw new Error('Email action missing required configuration (to, smtp)');
    }

    const subject = this.formatAlertSubject(alert, logs);
    const body = this.formatAlertBody(alert, logs, 'email');

    // Use nodemailer or similar email service
    try {
      // For now, log the email that would be sent
      this.logger.info('Email notification would be sent', {
        alertId: alert.id,
        to: config.to,
        subject,
        logCount: logs.length,
        smtp: config.smtp.host
      });

      // TODO: Implement actual email sending
      // const transporter = nodemailer.createTransporter(config.smtp);
      // await transporter.sendMail({
      //   from: config.from,
      //   to: config.to,
      //   subject,
      //   html: body
      // });
    } catch (error) {
      throw new Error(
        `Email notification failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async sendSlackNotification(
    action: AlertAction,
    alert: Alert,
    logs: HeimdallLogEntry[]
  ): Promise<void> {
    const config = action.config;

    if (!config.webhook_url && !config.token) {
      throw new Error('Slack action missing required configuration (webhook_url or token)');
    }

    const message = this.formatSlackMessage(alert, logs);

    try {
      if (config.webhook_url) {
        // Use webhook URL
        const response = await fetch(config.webhook_url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(message)
        });

        if (!response.ok) {
          throw new Error(`Slack webhook failed: ${response.status} ${response.statusText}`);
        }
      } else if (config.token) {
        // Use Slack API
        const response = await fetch('https://slack.com/api/chat.postMessage', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${config.token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            channel: config.channel || '#alerts',
            ...message
          })
        });

        const result = await response.json();
        if (!result.ok) {
          throw new Error(`Slack API failed: ${result.error}`);
        }
      }

      this.logger.info('Slack notification sent', {
        alertId: alert.id,
        channel: config.channel || '#alerts',
        logCount: logs.length
      });
    } catch (error) {
      throw new Error(
        `Slack notification failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async callWebhook(
    action: AlertAction,
    alert: Alert,
    logs: HeimdallLogEntry[]
  ): Promise<void> {
    const config = action.config;

    if (!config.url) {
      throw new Error('Webhook action missing required configuration (url)');
    }

    const payload = {
      alert: {
        id: alert.id,
        name: alert.name,
        condition: alert.condition,
        timestamp: new Date().toISOString()
      },
      logs: logs.map((log) => ({
        id: log.id,
        timestamp: new Date(Number(log.timestamp / 1000000n)).toISOString(), // Convert nanoseconds to milliseconds
        level: log.level,
        message: log.message.raw,
        source: log.source,
        metrics: log.metrics,
        ml: log.ml
      })),
      summary: {
        logCount: logs.length,
        severity: this.calculateAlertSeverity(logs),
        affectedServices: [...new Set(logs.map((log) => log.source.service))]
      }
    };

    try {
      const response = await fetch(config.url, {
        method: config.method || 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...config.headers
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(config.timeout || 10000)
      });

      if (!response.ok) {
        throw new Error(`Webhook failed: ${response.status} ${response.statusText}`);
      }

      this.logger.info('Webhook notification sent', {
        alertId: alert.id,
        url: config.url,
        logCount: logs.length,
        status: response.status
      });
    } catch (error) {
      throw new Error(
        `Webhook notification failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async createPagerDutyIncident(
    action: AlertAction,
    alert: Alert,
    logs: HeimdallLogEntry[]
  ): Promise<void> {
    const config = action.config;

    if (!config.integration_key) {
      throw new Error('PagerDuty action missing required configuration (integration_key)');
    }

    const payload = {
      routing_key: config.integration_key,
      event_action: 'trigger',
      dedup_key: `heimdall-alert-${alert.id}`,
      payload: {
        summary: `Heimdall Alert: ${alert.name}`,
        source: 'Heimdall Log Intelligence',
        severity: this.mapToPagerDutySeverity(logs),
        component: 'log-monitoring',
        group: 'heimdall',
        class: alert.condition.type,
        custom_details: {
          alert_id: alert.id,
          log_count: logs.length,
          affected_services: [...new Set(logs.map((log) => log.source.service))],
          time_range: this.getLogTimeRange(logs),
          sample_logs: logs.slice(0, 3).map((log) => ({
            timestamp: new Date(Number(log.timestamp / 1000000n)).toISOString(),
            level: log.level,
            message: log.message.raw,
            service: log.source.service
          }))
        }
      }
    };

    try {
      const response = await fetch('https://events.pagerduty.com/v2/enqueue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(`PagerDuty API failed: ${response.status} ${JSON.stringify(result)}`);
      }

      this.logger.info('PagerDuty incident created', {
        alertId: alert.id,
        dedupKey: payload.dedup_key,
        status: result.status,
        logCount: logs.length
      });
    } catch (error) {
      throw new Error(
        `PagerDuty notification failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async executeCustomAction(
    action: AlertAction,
    alert: Alert,
    logs: HeimdallLogEntry[]
  ): Promise<void> {
    const config = action.config;

    if (!config.script && !config.command) {
      throw new Error('Custom action missing required configuration (script or command)');
    }

    // For security, custom actions should be pre-approved scripts
    this.logger.info('Custom action would be executed', {
      alertId: alert.id,
      script: config.script,
      command: config.command,
      logCount: logs.length
    });

    // TODO: Implement custom action execution with proper sandboxing
    // This should run approved scripts only, with proper input validation
  }

  private async checkActiveAlerts(): Promise<void> {
    this.logger.debug('Checking active alerts');

    // Check absence-type alerts
    await this.checkAbsenceAlerts();

    // Check for any alerts that need periodic evaluation
    await this.checkPeriodicAlerts();
  }

  private async checkAbsenceAlerts(): Promise<void> {
    const absenceAlerts = Array.from(this.alerts.values()).filter(
      (alert) => alert.enabled && alert.condition.type === 'absence'
    );

    for (const alert of absenceAlerts) {
      try {
        const window = alert.condition.window || '5m';
        const windowMs = this.parseTimeWindow(window);
        const cutoffTime = BigInt(Date.now() - windowMs) * 1000000n; // Convert to nanoseconds

        // Check if expected logs are missing
        const recentLogs = await this.getRecentLogs(alert.condition.query, cutoffTime);

        if (recentLogs.length === 0) {
          // No logs found in the expected time window - trigger alert
          await this.triggerAlert(alert, []);
        }
      } catch (error) {
        this.logger.error('Error checking absence alert', {
          alertId: alert.id,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }

  private async checkPeriodicAlerts(): Promise<void> {
    // Check for alerts that need aggregation over time windows
    const periodicAlerts = Array.from(this.alerts.values()).filter(
      (alert) => alert.enabled && alert.condition.window && alert.condition.type !== 'absence'
    );

    for (const alert of periodicAlerts) {
      try {
        const window = alert.condition.window || '5m';
        const windowMs = this.parseTimeWindow(window);
        const cutoffTime = BigInt(Date.now() - windowMs) * 1000000n;

        const recentLogs = await this.getRecentLogs(alert.condition.query, cutoffTime);

        // Apply aggregation logic based on alert condition
        if (await this.evaluateAggregatedCondition(alert, recentLogs)) {
          await this.triggerAlert(alert, recentLogs);
        }
      } catch (error) {
        this.logger.error('Error checking periodic alert', {
          alertId: alert.id,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }

  private async evaluateAggregatedCondition(
    alert: Alert,
    logs: HeimdallLogEntry[]
  ): Promise<boolean> {
    const { condition } = alert;

    if (condition.type === 'threshold' && condition.threshold) {
      // Count-based threshold
      if (condition.threshold.operator === 'gt' && logs.length > condition.threshold.value) {
        return true;
      }
      if (condition.threshold.operator === 'gte' && logs.length >= condition.threshold.value) {
        return true;
      }
    }

    return false;
  }

  private async getRecentLogs(query: any, cutoffTime: bigint): Promise<HeimdallLogEntry[]> {
    // This would typically query the storage layer
    // For now, return empty array as placeholder
    return [];
  }

  private parseTimeWindow(window: string): number {
    const match = window.match(/^(\d+)([smhd])$/);
    if (!match) {
      throw new Error(`Invalid time window format: ${window}`);
    }

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's':
        return value * 1000;
      case 'm':
        return value * 60 * 1000;
      case 'h':
        return value * 60 * 60 * 1000;
      case 'd':
        return value * 24 * 60 * 60 * 1000;
      default:
        throw new Error(`Unknown time unit: ${unit}`);
    }
  }

  // Throttling and formatting helper methods

  private async isActionThrottled(action: AlertAction, alert: Alert): Promise<boolean> {
    if (!action.throttle) return false;

    const throttleKey = `${alert.id}-${action.type}`;
    const throttleMs = this.parseTimeWindow(action.throttle);

    // Check last execution time from storage or memory
    // For now, implement simple in-memory throttling
    const lastExecution = (this as any).lastActionExecution?.get(throttleKey);
    if (lastExecution && Date.now() - lastExecution < throttleMs) {
      return true;
    }

    return false;
  }

  private async updateActionThrottle(action: AlertAction, alert: Alert): Promise<void> {
    const throttleKey = `${alert.id}-${action.type}`;

    if (!(this as any).lastActionExecution) {
      (this as any).lastActionExecution = new Map();
    }

    (this as any).lastActionExecution.set(throttleKey, Date.now());
  }

  private formatAlertSubject(alert: Alert, logs: HeimdallLogEntry[]): string {
    const severity = this.calculateAlertSeverity(logs);
    const serviceList = [...new Set(logs.map((log) => log.source.service))].slice(0, 3).join(', ');

    return `[${severity.toUpperCase()}] Heimdall Alert: ${alert.name} (${logs.length} events from ${serviceList})`;
  }

  private formatAlertBody(
    alert: Alert,
    logs: HeimdallLogEntry[],
    format: 'email' | 'slack'
  ): string {
    const severity = this.calculateAlertSeverity(logs);
    const services = [...new Set(logs.map((log) => log.source.service))];
    const timeRange = this.getLogTimeRange(logs);

    if (format === 'email') {
      return `
        <h2>Alert: ${alert.name}</h2>
        <p><strong>Severity:</strong> ${severity}</p>
        <p><strong>Condition:</strong> ${alert.condition.type}</p>
        <p><strong>Log Count:</strong> ${logs.length}</p>
        <p><strong>Affected Services:</strong> ${services.join(', ')}</p>
        <p><strong>Time Range:</strong> ${timeRange}</p>
        
        <h3>Sample Log Entries:</h3>
        <ul>
          ${logs
            .slice(0, 5)
            .map(
              (log) => `
            <li>
              <strong>${new Date(Number(log.timestamp / 1000000n)).toISOString()}</strong>
              [${log.level}] ${log.source.service}: ${log.message.raw}
            </li>
          `
            )
            .join('')}
        </ul>
      `;
    }

    return `Alert: ${alert.name}\nSeverity: ${severity}\nLogs: ${logs.length}\nServices: ${services.join(', ')}`;
  }

  private formatSlackMessage(alert: Alert, logs: HeimdallLogEntry[]): any {
    const severity = this.calculateAlertSeverity(logs);
    const services = [...new Set(logs.map((log) => log.source.service))];

    const color = severity === 'critical' ? 'danger' : severity === 'warning' ? 'warning' : 'good';

    return {
      text: `Heimdall Alert: ${alert.name}`,
      attachments: [
        {
          color,
          fields: [
            { title: 'Severity', value: severity, short: true },
            { title: 'Log Count', value: logs.length.toString(), short: true },
            { title: 'Condition', value: alert.condition.type, short: true },
            { title: 'Services', value: services.join(', '), short: true }
          ],
          footer: 'Heimdall Log Intelligence',
          ts: Math.floor(Date.now() / 1000)
        }
      ]
    };
  }

  private calculateAlertSeverity(logs: HeimdallLogEntry[]): 'info' | 'warning' | 'critical' {
    const errorLogs = logs.filter((log) => log.level === 'ERROR' || log.level === 'FATAL');
    const warnLogs = logs.filter((log) => log.level === 'WARN');

    if (errorLogs.length > 0) return 'critical';
    if (warnLogs.length > logs.length * 0.5) return 'warning';
    return 'info';
  }

  private mapToPagerDutySeverity(
    logs: HeimdallLogEntry[]
  ): 'info' | 'warning' | 'error' | 'critical' {
    const severity = this.calculateAlertSeverity(logs);

    switch (severity) {
      case 'critical':
        return 'critical';
      case 'warning':
        return 'warning';
      default:
        return 'info';
    }
  }

  private getLogTimeRange(logs: HeimdallLogEntry[]): string {
    if (logs.length === 0) return 'No logs';

    const timestamps = logs.map((log) => Number(log.timestamp / 1000000n)); // Convert to milliseconds
    const earliest = new Date(Math.min(...timestamps));
    const latest = new Date(Math.max(...timestamps));

    return `${earliest.toISOString()} - ${latest.toISOString()}`;
  }

  // Utility methods for alert creation and validation

  private generateAlertId(): string {
    return `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private validateAlert(alert: Alert): void {
    if (!alert.name || alert.name.trim().length === 0) {
      throw new Error('Alert name is required');
    }

    if (!alert.condition) {
      throw new Error('Alert condition is required');
    }

    if (!['threshold', 'pattern', 'anomaly', 'absence'].includes(alert.condition.type)) {
      throw new Error(`Invalid alert condition type: ${alert.condition.type}`);
    }

    if (alert.condition.type === 'threshold' && !alert.condition.threshold) {
      throw new Error('Threshold condition requires threshold configuration');
    }

    if (alert.condition.type === 'pattern' && !alert.condition.pattern) {
      throw new Error('Pattern condition requires pattern configuration');
    }

    if (!Array.isArray(alert.actions) || alert.actions.length === 0) {
      throw new Error('Alert must have at least one action');
    }

    // Validate each action
    for (const action of alert.actions) {
      this.validateAction(action);
    }
  }

  private validateAction(action: AlertAction): void {
    if (!['email', 'slack', 'webhook', 'pagerduty', 'custom'].includes(action.type)) {
      throw new Error(`Invalid action type: ${action.type}`);
    }

    if (!action.config || typeof action.config !== 'object') {
      throw new Error('Action configuration is required');
    }

    switch (action.type) {
      case 'email':
        if (!action.config.to || !action.config.smtp) {
          throw new Error('Email action requires "to" and "smtp" configuration');
        }
        break;

      case 'slack':
        if (!action.config.webhook_url && !action.config.token) {
          throw new Error('Slack action requires "webhook_url" or "token" configuration');
        }
        break;

      case 'webhook':
        if (!action.config.url) {
          throw new Error('Webhook action requires "url" configuration');
        }
        break;

      case 'pagerduty':
        if (!action.config.integration_key) {
          throw new Error('PagerDuty action requires "integration_key" configuration');
        }
        break;

      case 'custom':
        if (!action.config.script && !action.config.command) {
          throw new Error('Custom action requires "script" or "command" configuration');
        }
        break;
    }

    // Validate throttle if present
    if (action.throttle) {
      try {
        this.parseTimeWindow(action.throttle);
      } catch (error) {
        throw new Error(`Invalid throttle format: ${action.throttle}`);
      }
    }
  }

  // Alert statistics and monitoring

  async getAlertStats(): Promise<{
    total: number;
    enabled: number;
    disabled: number;
    byType: Record<string, number>;
    recentTriggers: number;
  }> {
    const alerts = Array.from(this.alerts.values());
    const enabled = alerts.filter((a) => a.enabled);
    const disabled = alerts.filter((a) => !a.enabled);

    const byType: Record<string, number> = {};
    for (const alert of alerts) {
      byType[alert.condition.type] = (byType[alert.condition.type] || 0) + 1;
    }

    // Get recent triggers from the last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    let recentTriggers = 0;
    try {
      const result = await this.context
        .getDataService()
        .query('SELECT COUNT(*) as count FROM heimdall_alert_triggers WHERE triggered_at > ?', [
          oneDayAgo
        ]);
      recentTriggers = result[0]?.count || 0;
    } catch (error) {
      this.logger.warn('Failed to get recent trigger count', {
        error: error instanceof Error ? error.message : String(error)
      });
    }

    return {
      total: alerts.length,
      enabled: enabled.length,
      disabled: disabled.length,
      byType,
      recentTriggers
    };
  }

  // Integration with other Heimdall services

  async setStorageAdapter(adapter: any): Promise<void> {
    // This would integrate with storage adapters for querying logs
    this.logger.info('Storage adapter configured for alert manager');
  }

  async setMLService(mlService: any): Promise<void> {
    // This would integrate with ML service for anomaly detection
    this.logger.info('ML service configured for alert manager');
  }
}
