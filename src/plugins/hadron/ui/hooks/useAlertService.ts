/**
 * React hook for alert service integration
 */

import { useState, useEffect, useCallback } from 'react';
import { AlertRule, AlertEvent, AlertMetrics } from '../../src/interfaces/alerts';
import { createClientLogger } from '../../../../client/utils/client-logger';

const logger = createClientLogger({ serviceName: 'useAlertService' });

const API_BASE = '/api/hadron/alerts';

export function useAlertService() {
  const [activeAlerts, setActiveAlerts] = useState<AlertEvent[]>([]);
  const [alertHistory, setAlertHistory] = useState<AlertEvent[]>([]);
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [metrics, setMetrics] = useState<AlertMetrics>({
    totalAlerts: 0,
    activeAlerts: 0,
    acknowledgedAlerts: 0,
    resolvedAlerts: 0,
    alertsByRule: {},
    alertsBySeverity: { critical: 0, warning: 0, info: 0 },
    averageResolutionTime: 0,
    alertsPerHour: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Fetch active alerts
   */
  const fetchActiveAlerts = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/active`);
      if (!response.ok) throw new Error('Failed to fetch active alerts');

      const data = await response.json();
      setActiveAlerts(data.alerts || []);
    } catch (err) {
      logger.error('Failed to fetch active alerts', { error: err });
      setError(err as Error);
    }
  }, []);

  /**
   * Fetch alert history
   */
  const fetchAlertHistory = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/history?limit=100`);
      if (!response.ok) throw new Error('Failed to fetch alert history');

      const data = await response.json();
      setAlertHistory(data.alerts || []);
    } catch (err) {
      logger.error('Failed to fetch alert history', { error: err });
    }
  }, []);

  /**
   * Fetch alert rules
   */
  const fetchRules = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/rules`);
      if (!response.ok) throw new Error('Failed to fetch alert rules');

      const data = await response.json();
      setRules(data.rules || []);
    } catch (err) {
      logger.error('Failed to fetch alert rules', { error: err });
    }
  }, []);

  /**
   * Fetch alert metrics
   */
  const fetchMetrics = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/metrics`);
      if (!response.ok) throw new Error('Failed to fetch alert metrics');

      const data = await response.json();
      setMetrics(data.metrics || metrics);
    } catch (err) {
      logger.error('Failed to fetch alert metrics', { error: err });
    }
  }, []);

  /**
   * Acknowledge an alert
   */
  const acknowledgeAlert = useCallback(async (alertId: string, acknowledgedBy: string) => {
    try {
      const response = await fetch(`${API_BASE}/${alertId}/acknowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acknowledgedBy })
      });

      if (!response.ok) throw new Error('Failed to acknowledge alert');

      // Update local state
      setActiveAlerts((prev) =>
        prev.map((alert) =>
          alert.id === alertId
            ? { ...alert, acknowledged: true, acknowledgedBy, acknowledgedAt: new Date() }
            : alert
        )
      );

      logger.info('Alert acknowledged', { alertId, acknowledgedBy });
    } catch (err) {
      logger.error('Failed to acknowledge alert', { error: err });
      throw err;
    }
  }, []);

  /**
   * Resolve an alert
   */
  const resolveAlert = useCallback(
    async (alertId: string, resolvedBy: string, resolution?: string) => {
      try {
        const response = await fetch(`${API_BASE}/${alertId}/resolve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resolvedBy, resolution })
        });

        if (!response.ok) throw new Error('Failed to resolve alert');

        // Update local state
        setActiveAlerts((prev) => prev.filter((alert) => alert.id !== alertId));

        // Refresh history to include resolved alert
        await fetchAlertHistory();

        logger.info('Alert resolved', { alertId, resolvedBy });
      } catch (err) {
        logger.error('Failed to resolve alert', { error: err });
        throw err;
      }
    },
    [fetchAlertHistory]
  );

  /**
   * Create or update alert rule
   */
  const saveRule = useCallback(
    async (rule: Partial<AlertRule>) => {
      try {
        const isUpdate = !!rule.id;
        const url = isUpdate ? `${API_BASE}/rules/${rule.id}` : `${API_BASE}/rules`;
        const method = isUpdate ? 'PUT' : 'POST';

        const response = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(rule)
        });

        if (!response.ok) throw new Error('Failed to save alert rule');

        // Refresh rules
        await fetchRules();

        logger.info('Alert rule saved', { ruleId: rule.id, isUpdate });
      } catch (err) {
        logger.error('Failed to save alert rule', { error: err });
        throw err;
      }
    },
    [fetchRules]
  );

  /**
   * Update alert rule
   */
  const updateRule = useCallback(
    async (ruleId: string, updates: Partial<AlertRule>) => {
      await saveRule({ ...updates, id: ruleId });
    },
    [saveRule]
  );

  /**
   * Delete alert rule
   */
  const deleteRule = useCallback(async (ruleId: string) => {
    try {
      const response = await fetch(`${API_BASE}/rules/${ruleId}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Failed to delete alert rule');

      // Update local state
      setRules((prev) => prev.filter((rule) => rule.id !== ruleId));

      logger.info('Alert rule deleted', { ruleId });
    } catch (err) {
      logger.error('Failed to delete alert rule', { error: err });
      throw err;
    }
  }, []);

  /**
   * Refresh all data
   */
  const refreshAlerts = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([fetchActiveAlerts(), fetchAlertHistory(), fetchRules(), fetchMetrics()]);
    } finally {
      setLoading(false);
    }
  }, [fetchActiveAlerts, fetchAlertHistory, fetchRules, fetchMetrics]);

  /**
   * Setup WebSocket for real-time alerts
   */
  useEffect(() => {
    const ws = new WebSocket(`ws://localhost:4000/ws/alerts`);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case 'alert:triggered':
            setActiveAlerts((prev) => [data.alert, ...prev]);
            logger.info('New alert received', { alert: data.alert });
            break;

          case 'alert:acknowledged':
            setActiveAlerts((prev) =>
              prev.map((alert) =>
                alert.id === data.alertId ? { ...alert, acknowledged: true } : alert
              )
            );
            break;

          case 'alert:resolved':
            setActiveAlerts((prev) => prev.filter((alert) => alert.id !== data.alertId));
            fetchAlertHistory(); // Refresh history
            break;
        }
      } catch (err) {
        logger.error('Failed to parse WebSocket message', { error: err });
      }
    };

    ws.onerror = (error) => {
      logger.error('WebSocket error', { error });
    };

    return () => {
      ws.close();
    };
  }, [fetchAlertHistory]);

  /**
   * Initial data load
   */
  useEffect(() => {
    refreshAlerts();
  }, [refreshAlerts]);

  /**
   * Periodic refresh
   */
  useEffect(() => {
    const interval = setInterval(() => {
      fetchMetrics();
    }, 60000); // Refresh metrics every minute

    return () => clearInterval(interval);
  }, [fetchMetrics]);

  return {
    // Data
    activeAlerts,
    alertHistory,
    rules,
    metrics,
    loading,
    error,

    // Actions
    acknowledgeAlert,
    resolveAlert,
    saveRule,
    updateRule,
    deleteRule,
    refreshAlerts
  };
}
