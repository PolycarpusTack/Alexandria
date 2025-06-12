/**
 * Notification Service
 * Handles sending alerts through various channels
 */

import { EventBus } from '../../../../core/event-bus/event-bus';
import { createLogger } from '../../../../core/services/logging-service';
import { AlertEvent, AlertChannel, NotificationTemplate } from '../../interfaces/alerts';

const logger = createLogger({ serviceName: 'NotificationService' });

export class NotificationService {
  private channelHandlers: Map<AlertChannel, ChannelHandler> = new Map();
  private templates: Map<string, NotificationTemplate> = new Map();
  private rateLimiter: Map<string, number> = new Map();

  constructor(private eventBus: EventBus) {
    this.initializeChannels();
    this.initializeTemplates();
  }

  /**
   * Send alert through specified channels
   */
  async sendAlert(alert: AlertEvent, channels: AlertChannel[]): Promise<void> {
    const sendPromises = channels.map((channel) => this.sendToChannel(alert, channel));

    const results = await Promise.allSettled(sendPromises);

    // Log any failures
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        logger.error('Failed to send notification', {
          channel: channels[index],
          error: result.reason,
          alertId: alert.id
        });
      }
    });
  }

  /**
   * Send to specific channel
   */
  private async sendToChannel(alert: AlertEvent, channel: AlertChannel): Promise<void> {
    // Check rate limit
    if (this.isRateLimited(alert.ruleId, channel)) {
      logger.debug('Notification rate limited', {
        ruleId: alert.ruleId,
        channel
      });
      return;
    }

    const handler = this.channelHandlers.get(channel);
    if (!handler) {
      logger.warn('No handler for channel', { channel });
      return;
    }

    try {
      const notification = this.formatNotification(alert, channel);
      await handler(notification);

      this.updateRateLimit(alert.ruleId, channel);

      logger.info('Notification sent', {
        alertId: alert.id,
        channel,
        severity: alert.severity
      });

      // Emit event
      this.eventBus.emit('notification:sent', {
        alert,
        channel,
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Failed to send notification', {
        channel,
        error,
        alertId: alert.id
      });
      throw error;
    }
  }

  /**
   * Format notification based on channel and template
   */
  private formatNotification(alert: AlertEvent, channel: AlertChannel): FormattedNotification {
    const template =
      this.templates.get(`${channel}_${alert.severity}`) ||
      this.templates.get(`${channel}_default`)!;

    const formatted: FormattedNotification = {
      channel,
      severity: alert.severity,
      title: this.interpolate(template.title, alert),
      message: this.interpolate(template.message, alert),
      timestamp: alert.timestamp,
      metadata: {
        alertId: alert.id,
        ruleId: alert.ruleId,
        ruleName: alert.ruleName,
        value: alert.value,
        threshold: alert.threshold,
        ...alert.context
      }
    };

    // Add channel-specific formatting
    switch (channel) {
      case 'slack':
        formatted.color = this.getSeverityColor(alert.severity);
        formatted.fields = [
          { title: 'Metric', value: alert.context.metric, short: true },
          { title: 'Value', value: alert.value.toFixed(2), short: true },
          { title: 'Threshold', value: alert.threshold.toFixed(2), short: true },
          { title: 'Time Window', value: alert.context.timeWindow, short: true }
        ];
        break;
      case 'email':
        formatted.html = this.generateEmailHTML(alert, template);
        break;
      case 'webhook':
        formatted.json = JSON.stringify(alert);
        break;
    }

    return formatted;
  }

  /**
   * Initialize channel handlers
   */
  private initializeChannels(): void {
    // Email handler
    this.channelHandlers.set('email', async (notification) => {
      // In production, integrate with email service
      logger.info('Email notification (simulated)', {
        to: process.env.ALERT_EMAIL || 'admin@example.com',
        subject: notification.title,
        severity: notification.severity
      });

      // Emit event for email service to handle
      this.eventBus.emit('email:send', {
        to: process.env.ALERT_EMAIL || 'admin@example.com',
        subject: notification.title,
        html: notification.html,
        priority: notification.severity === 'critical' ? 'high' : 'normal'
      });
    });

    // Slack handler
    this.channelHandlers.set('slack', async (notification) => {
      // In production, integrate with Slack API
      logger.info('Slack notification (simulated)', {
        channel: process.env.SLACK_ALERT_CHANNEL || '#alerts',
        title: notification.title
      });

      // Emit event for Slack integration
      this.eventBus.emit('slack:send', {
        channel: process.env.SLACK_ALERT_CHANNEL || '#alerts',
        text: notification.title,
        attachments: [
          {
            color: notification.color,
            text: notification.message,
            fields: notification.fields,
            ts: Math.floor(notification.timestamp.getTime() / 1000)
          }
        ]
      });
    });

    // Webhook handler
    this.channelHandlers.set('webhook', async (notification) => {
      const webhookUrl = process.env.ALERT_WEBHOOK_URL;
      if (!webhookUrl) {
        logger.warn('Webhook URL not configured');
        return;
      }

      // In production, make actual HTTP request
      logger.info('Webhook notification (simulated)', {
        url: webhookUrl,
        payload: notification.json
      });

      // Emit event for webhook service
      this.eventBus.emit('webhook:send', {
        url: webhookUrl,
        payload: notification.json,
        headers: {
          'Content-Type': 'application/json',
          'X-Alert-Severity': notification.severity
        }
      });
    });

    // PagerDuty handler
    this.channelHandlers.set('pagerduty', async (notification) => {
      logger.info('PagerDuty notification (simulated)', {
        severity: notification.severity,
        title: notification.title
      });

      // Emit event for PagerDuty integration
      this.eventBus.emit('pagerduty:trigger', {
        severity: notification.severity === 'critical' ? 'critical' : 'warning',
        summary: notification.title,
        details: notification.message,
        source: 'alexandria-analytics',
        custom_details: notification.metadata
      });
    });

    // In-app notification handler
    this.channelHandlers.set('in_app', async (notification) => {
      // Send through EventBus for UI to display
      this.eventBus.emit('ui:notification', {
        type: 'alert',
        severity: notification.severity,
        title: notification.title,
        message: notification.message,
        timestamp: notification.timestamp,
        actions: [
          { label: 'View Details', action: 'view_alert', data: notification.metadata },
          {
            label: 'Acknowledge',
            action: 'acknowledge_alert',
            data: { alertId: notification.metadata.alertId }
          }
        ]
      });
    });
  }

  /**
   * Initialize notification templates
   */
  private initializeTemplates(): void {
    // Email templates
    this.templates.set('email_critical', {
      title: '🚨 Critical Alert: {{ruleName}}',
      message: `
A critical alert has been triggered:

{{message}}

Details:
- Alert ID: {{id}}
- Time: {{timestamp}}
- Metric: {{context.metric}}
- Current Value: {{value}}
- Threshold: {{threshold}}
- Time Window: {{context.timeWindow}}

Please investigate immediately.
      `
    });

    this.templates.set('email_warning', {
      title: '⚠️ Warning: {{ruleName}}',
      message: `
A warning alert has been triggered:

{{message}}

Details:
- Alert ID: {{id}}
- Time: {{timestamp}}
- Metric: {{context.metric}}
- Current Value: {{value}}
- Threshold: {{threshold}}
- Time Window: {{context.timeWindow}}

This may require attention.
      `
    });

    this.templates.set('email_default', {
      title: 'ℹ️ Alert: {{ruleName}}',
      message: '{{message}}\n\nValue: {{value}}, Threshold: {{threshold}}'
    });

    // Slack templates
    this.templates.set('slack_critical', {
      title: '🚨 *Critical Alert*: {{ruleName}}',
      message: '{{message}}\n_Immediate action required_'
    });

    this.templates.set('slack_warning', {
      title: '⚠️ *Warning*: {{ruleName}}',
      message: '{{message}}'
    });

    this.templates.set('slack_default', {
      title: 'ℹ️ {{ruleName}}',
      message: '{{message}}'
    });

    // Webhook templates
    this.templates.set('webhook_default', {
      title: '{{ruleName}}',
      message: '{{message}}'
    });
  }

  /**
   * Interpolate template variables
   */
  private interpolate(template: string, data: any): string {
    return template.replace(/{{([^}]+)}}/g, (match, path) => {
      const keys = path.split('.');
      let value = data;

      for (const key of keys) {
        value = value?.[key];
      }

      if (value instanceof Date) {
        return value.toISOString();
      }

      return value?.toString() || match;
    });
  }

  /**
   * Get severity color for Slack
   */
  private getSeverityColor(severity: string): string {
    const colors = {
      critical: '#dc3545',
      warning: '#ffc107',
      info: '#17a2b8'
    };
    return colors[severity as keyof typeof colors] || '#6c757d';
  }

  /**
   * Generate HTML email content
   */
  private generateEmailHTML(alert: AlertEvent, template: NotificationTemplate): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .alert-box { 
      border: 2px solid ${this.getSeverityColor(alert.severity)}; 
      padding: 20px; 
      margin: 20px 0;
      border-radius: 5px;
    }
    .metric { 
      background: #f4f4f4; 
      padding: 10px; 
      margin: 10px 0;
      border-radius: 3px;
    }
    .metric-label { font-weight: bold; }
    .footer { 
      margin-top: 30px; 
      padding-top: 20px; 
      border-top: 1px solid #ddd;
      font-size: 0.9em;
      color: #666;
    }
  </style>
</head>
<body>
  <h2>${this.interpolate(template.title, alert)}</h2>
  <div class="alert-box">
    <p>${this.interpolate(template.message, alert).replace(/\n/g, '<br>')}</p>
  </div>
  
  <div class="metrics">
    <div class="metric">
      <span class="metric-label">Metric:</span> ${alert.context.metric}
    </div>
    <div class="metric">
      <span class="metric-label">Current Value:</span> ${alert.value.toFixed(2)}
    </div>
    <div class="metric">
      <span class="metric-label">Threshold:</span> ${alert.threshold.toFixed(2)}
    </div>
    <div class="metric">
      <span class="metric-label">Time Window:</span> ${alert.context.timeWindow}
    </div>
  </div>
  
  <div class="footer">
    <p>Alert ID: ${alert.id}</p>
    <p>Generated by Alexandria Analytics Alert System</p>
  </div>
</body>
</html>
    `;
  }

  /**
   * Check if notification is rate limited
   */
  private isRateLimited(ruleId: string, channel: AlertChannel): boolean {
    const key = `${ruleId}_${channel}`;
    const lastSent = this.rateLimiter.get(key);

    if (!lastSent) return false;

    // Different rate limits per channel
    const limits: Record<AlertChannel, number> = {
      email: 5 * 60 * 1000, // 5 minutes
      slack: 2 * 60 * 1000, // 2 minutes
      webhook: 60 * 1000, // 1 minute
      pagerduty: 10 * 60 * 1000, // 10 minutes
      in_app: 30 * 1000 // 30 seconds
    };

    const limit = limits[channel] || 60 * 1000;
    return Date.now() - lastSent < limit;
  }

  /**
   * Update rate limit timestamp
   */
  private updateRateLimit(ruleId: string, channel: AlertChannel): void {
    const key = `${ruleId}_${channel}`;
    this.rateLimiter.set(key, Date.now());

    // Clean up old entries
    if (this.rateLimiter.size > 1000) {
      const entries = Array.from(this.rateLimiter.entries());
      const cutoff = Date.now() - 60 * 60 * 1000; // 1 hour

      entries.forEach(([k, timestamp]) => {
        if (timestamp < cutoff) {
          this.rateLimiter.delete(k);
        }
      });
    }
  }
}

type ChannelHandler = (notification: FormattedNotification) => Promise<void>;

interface FormattedNotification {
  channel: AlertChannel;
  severity: string;
  title: string;
  message: string;
  timestamp: Date;
  metadata: Record<string, any>;
  color?: string;
  fields?: Array<{ title: string; value: string; short?: boolean }>;
  html?: string;
  json?: string;
}
