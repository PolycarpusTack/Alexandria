/**
 * Tests for Alert Manager
 */

import { AlertManager } from '../alert-manager';
import { AlertRule, AlertSeverity } from '../../../interfaces/alerts';
import { container } from 'tsyringe';
import { IDataService } from '../../../../../core/data/interfaces';
import { EventBus } from '../../../../../core/event-bus/event-bus';

// Mock implementations
const mockDataService: Partial<IDataService> = {
  query: jest.fn()
};

const mockEventBus: Partial<EventBus> = {
  emit: jest.fn(),
  on: jest.fn(),
  off: jest.fn()
};

describe('AlertManager', () => {
  let alertManager: AlertManager;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Register mocks
    container.register<IDataService>('DataService', { useValue: mockDataService as IDataService });
    container.register<EventBus>('EventBus', { useValue: mockEventBus as EventBus });
    
    alertManager = new AlertManager(
      mockDataService as IDataService,
      mockEventBus as EventBus
    );
    
    // Stop automatic monitoring for tests
    alertManager.stopMonitoring();
  });

  describe('Rule Management', () => {
    it('should register a valid alert rule', () => {
      const rule: AlertRule = {
        id: 'test_rule',
        name: 'Test Rule',
        metric: 'crash_rate',
        condition: { operator: 'greater_than', value: 100 },
        timeWindow: '5m',
        severity: 'warning',
        channels: ['email'],
        enabled: true
      };

      alertManager.registerRule(rule);
      
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'alert:rule_registered',
        { rule }
      );
    });

    it('should reject invalid alert rule', () => {
      const invalidRule = {
        id: 'invalid',
        name: 'Invalid Rule'
        // Missing required fields
      } as any;

      expect(() => alertManager.registerRule(invalidRule))
        .toThrow('Invalid alert rule');
    });

    it('should update existing rule', () => {
      const rule: AlertRule = {
        id: 'test_rule',
        name: 'Test Rule',
        metric: 'crash_rate',
        condition: { operator: 'greater_than', value: 100 },
        timeWindow: '5m',
        severity: 'warning',
        channels: ['email'],
        enabled: true
      };

      alertManager.registerRule(rule);
      alertManager.updateRule('test_rule', { enabled: false });
      
      const rules = alertManager['rules'];
      expect(rules.get('test_rule')?.enabled).toBe(false);
    });

    it('should delete rule', () => {
      const rule: AlertRule = {
        id: 'test_rule',
        name: 'Test Rule',
        metric: 'crash_rate',
        condition: { operator: 'greater_than', value: 100 },
        timeWindow: '5m',
        severity: 'warning',
        channels: ['email'],
        enabled: true
      };

      alertManager.registerRule(rule);
      alertManager.deleteRule('test_rule');
      
      const rules = alertManager['rules'];
      expect(rules.has('test_rule')).toBe(false);
    });
  });

  describe('Alert Checking', () => {
    it('should trigger alert when condition is met', async () => {
      const rule: AlertRule = {
        id: 'high_crash_rate',
        name: 'High Crash Rate',
        metric: 'crash_rate',
        condition: { operator: 'greater_than', value: 50 },
        timeWindow: '5m',
        severity: 'warning',
        channels: ['email'],
        enabled: true
      };

      alertManager.registerRule(rule);
      
      // Mock high crash rate
      (mockDataService.query as jest.Mock).mockResolvedValue([
        { value: 75 } // Above threshold
      ]);

      await alertManager.checkAlerts();

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'alert:triggered',
        expect.objectContaining({
          alert: expect.objectContaining({
            ruleId: 'high_crash_rate',
            severity: 'warning',
            value: 75,
            threshold: 50
          })
        })
      );
    });

    it('should not trigger alert when condition is not met', async () => {
      const rule: AlertRule = {
        id: 'high_crash_rate',
        name: 'High Crash Rate',
        metric: 'crash_rate',
        condition: { operator: 'greater_than', value: 100 },
        timeWindow: '5m',
        severity: 'warning',
        channels: ['email'],
        enabled: true
      };

      alertManager.registerRule(rule);
      
      // Mock normal crash rate
      (mockDataService.query as jest.Mock).mockResolvedValue([
        { value: 25 } // Below threshold
      ]);

      await alertManager.checkAlerts();

      const activeAlerts = alertManager.getActiveAlerts();
      expect(activeAlerts).toHaveLength(0);
    });

    it('should skip disabled rules', async () => {
      const rule: AlertRule = {
        id: 'disabled_rule',
        name: 'Disabled Rule',
        metric: 'crash_rate',
        condition: { operator: 'greater_than', value: 10 },
        timeWindow: '5m',
        severity: 'warning',
        channels: ['email'],
        enabled: false // Disabled
      };

      alertManager.registerRule(rule);
      
      (mockDataService.query as jest.Mock).mockResolvedValue([
        { value: 50 }
      ]);

      await alertManager.checkAlerts();

      expect(mockDataService.query).not.toHaveBeenCalled();
    });
  });

  describe('Alert Management', () => {
    beforeEach(async () => {
      // Setup a triggered alert
      const rule: AlertRule = {
        id: 'test_alert',
        name: 'Test Alert',
        metric: 'crash_rate',
        condition: { operator: 'greater_than', value: 50 },
        timeWindow: '5m',
        severity: 'warning',
        channels: ['email'],
        enabled: true
      };

      alertManager.registerRule(rule);
      
      (mockDataService.query as jest.Mock).mockResolvedValue([
        { value: 75 }
      ]);

      await alertManager.checkAlerts();
    });

    it('should acknowledge alert', () => {
      const activeAlerts = alertManager.getActiveAlerts();
      expect(activeAlerts).toHaveLength(1);
      
      const alertId = activeAlerts[0].id;
      alertManager.acknowledgeAlert(alertId, 'test_user');
      
      const updatedAlert = alertManager.getActiveAlerts()[0];
      expect(updatedAlert.acknowledged).toBe(true);
      expect(updatedAlert.acknowledgedBy).toBe('test_user');
      expect(updatedAlert.acknowledgedAt).toBeDefined();
    });

    it('should resolve alert', () => {
      const activeAlerts = alertManager.getActiveAlerts();
      const alertId = activeAlerts[0].id;
      
      alertManager.resolveAlert(alertId, 'test_user', 'Fixed the issue');
      
      expect(alertManager.getActiveAlerts()).toHaveLength(0);
      
      const history = alertManager.getAlertHistory();
      expect(history).toHaveLength(1);
      expect(history[0].resolved).toBe(true);
      expect(history[0].resolvedBy).toBe('test_user');
      expect(history[0].resolution).toBe('Fixed the issue');
    });

    it('should auto-resolve alert when condition no longer met', async () => {
      // First check - alert is active
      let activeAlerts = alertManager.getActiveAlerts();
      expect(activeAlerts).toHaveLength(1);
      
      // Mock normal crash rate for second check
      (mockDataService.query as jest.Mock).mockResolvedValue([
        { value: 25 } // Below threshold
      ]);

      await alertManager.checkAlerts();
      
      // Alert should be auto-resolved
      activeAlerts = alertManager.getActiveAlerts();
      expect(activeAlerts).toHaveLength(0);
      
      const history = alertManager.getAlertHistory();
      expect(history[0].resolution).toBe('Condition no longer met');
    });
  });

  describe('Alert History', () => {
    it('should filter history by severity', async () => {
      // Create alerts with different severities
      const rules: AlertRule[] = [
        {
          id: 'critical_rule',
          name: 'Critical Rule',
          metric: 'crash_rate',
          condition: { operator: 'greater_than', value: 10 },
          timeWindow: '5m',
          severity: 'critical',
          channels: ['email'],
          enabled: true
        },
        {
          id: 'info_rule',
          name: 'Info Rule',
          metric: 'response_time_p95',
          condition: { operator: 'greater_than', value: 1000 },
          timeWindow: '5m',
          severity: 'info',
          channels: ['email'],
          enabled: true
        }
      ];

      rules.forEach(rule => alertManager.registerRule(rule));
      
      (mockDataService.query as jest.Mock).mockResolvedValue([
        { value: 100 }
      ]);

      await alertManager.checkAlerts();
      
      // Resolve all alerts to move to history
      alertManager.getActiveAlerts().forEach(alert => {
        alertManager.resolveAlert(alert.id, 'test_user');
      });

      const criticalHistory = alertManager.getAlertHistory({ 
        severity: 'critical' 
      });
      expect(criticalHistory).toHaveLength(1);
      expect(criticalHistory[0].severity).toBe('critical');
    });

    it('should limit history results', () => {
      // Add multiple alerts to history
      for (let i = 0; i < 10; i++) {
        const alert: any = {
          id: `alert_${i}`,
          ruleId: 'test_rule',
          ruleName: 'Test Rule',
          severity: 'info',
          timestamp: new Date(),
          value: 100,
          threshold: 50,
          message: 'Test alert',
          context: {},
          acknowledged: false,
          resolved: true
        };
        alertManager['alertHistory'].push(alert);
      }

      const limitedHistory = alertManager.getAlertHistory({ limit: 5 });
      expect(limitedHistory).toHaveLength(5);
    });
  });
});
