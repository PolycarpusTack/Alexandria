/**
 * Alert system interfaces and types
 */

export type AlertSeverity = 'critical' | 'warning' | 'info';
export type AlertChannel = 'email' | 'slack' | 'webhook' | 'pagerduty' | 'in_app';
export type ComparisonOperator =
  | 'greater_than'
  | 'greater_than_or_equal'
  | 'less_than'
  | 'less_than_or_equal'
  | 'equal'
  | 'not_equal';

export interface AlertCondition {
  operator: ComparisonOperator;
  value: number;
  metric?: string; // For composite conditions
}

export interface AlertRule {
  id: string;
  name: string;
  description?: string;
  metric: string;
  condition: AlertCondition;
  timeWindow: string; // e.g., '5m', '1h', '1d'
  severity: AlertSeverity;
  channels: AlertChannel[];
  enabled: boolean;
  cooldown?: number; // Milliseconds between alerts
  autoResolve?: boolean;
  tags?: string[];
  metadata?: Record<string, any>;
  version?: number;
}

export interface AlertEvent {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: AlertSeverity;
  timestamp: Date;
  value: number;
  threshold: number;
  message: string;
  context: Record<string, any>;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: Date;
  resolution?: string;
  autoResolve?: boolean;
}

export interface NotificationTemplate {
  title: string;
  message: string;
}

export interface AlertMetrics {
  totalAlerts: number;
  activeAlerts: number;
  acknowledgedAlerts: number;
  resolvedAlerts: number;
  alertsByRule: Record<string, number>;
  alertsBySeverity: Record<AlertSeverity, number>;
  averageResolutionTime: number;
  alertsPerHour: number;
}

export interface AlertConfiguration {
  rules: AlertRule[];
  globalSettings: {
    enableNotifications: boolean;
    defaultChannels: AlertChannel[];
    quietHours?: {
      enabled: boolean;
      start: string; // HH:MM
      end: string; // HH:MM
      timezone: string;
    };
    maintenanceMode?: {
      enabled: boolean;
      suppressAllAlerts: boolean;
      allowedSeverities: AlertSeverity[];
    };
  };
}

export interface IAlertService {
  // Rule management
  registerRule(rule: AlertRule): void;
  updateRule(ruleId: string, updates: Partial<AlertRule>): void;
  deleteRule(ruleId: string): void;
  getRules(): AlertRule[];
  getRule(ruleId: string): AlertRule | undefined;

  // Alert management
  getActiveAlerts(): AlertEvent[];
  getAlertHistory(options?: {
    startTime?: Date;
    endTime?: Date;
    severity?: AlertSeverity;
    limit?: number;
  }): AlertEvent[];
  acknowledgeAlert(alertId: string, acknowledgedBy: string): void;
  resolveAlert(alertId: string, resolvedBy: string, resolution?: string): void;

  // Monitoring
  checkAlerts(): Promise<void>;
  getMetrics(): AlertMetrics;

  // Configuration
  updateConfiguration(config: Partial<AlertConfiguration>): void;
  getConfiguration(): AlertConfiguration;
}
