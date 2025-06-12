/**
 * Alert Rule Engine
 * Evaluates alert conditions and manages rule logic
 */

import { AlertRule, AlertCondition, ComparisonOperator } from '../../interfaces/alerts';
import { createLogger } from '../../../../core/services/logging-service';

const logger = createLogger({ serviceName: 'AlertRuleEngine' });

export class AlertRuleEngine {
  private ruleCache: Map<string, CompiledRule> = new Map();

  /**
   * Validate an alert rule
   */
  validateRule(rule: AlertRule): boolean {
    try {
      // Check required fields
      if (!rule.id || !rule.name || !rule.metric || !rule.condition) {
        logger.error('Invalid rule: missing required fields', { rule });
        return false;
      }

      // Validate condition
      if (!this.isValidCondition(rule.condition)) {
        logger.error('Invalid rule condition', { condition: rule.condition });
        return false;
      }

      // Validate time window
      if (!this.isValidTimeWindow(rule.timeWindow)) {
        logger.error('Invalid time window', { timeWindow: rule.timeWindow });
        return false;
      }

      // Validate severity
      const validSeverities = ['critical', 'warning', 'info'];
      if (!validSeverities.includes(rule.severity)) {
        logger.error('Invalid severity', { severity: rule.severity });
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Rule validation failed', { error, rule });
      return false;
    }
  }

  /**
   * Evaluate a condition against a value
   */
  evaluateCondition(value: number, condition: AlertCondition): boolean {
    const { operator, value: threshold } = condition;

    switch (operator) {
      case 'greater_than':
        return value > threshold;
      case 'greater_than_or_equal':
        return value >= threshold;
      case 'less_than':
        return value < threshold;
      case 'less_than_or_equal':
        return value <= threshold;
      case 'equal':
        return Math.abs(value - threshold) < 0.0001; // Float comparison
      case 'not_equal':
        return Math.abs(value - threshold) >= 0.0001;
      default:
        logger.warn('Unknown operator', { operator });
        return false;
    }
  }

  /**
   * Compile a rule for faster evaluation
   */
  compileRule(rule: AlertRule): CompiledRule {
    const cached = this.ruleCache.get(rule.id);
    if (cached && cached.version === rule.version) {
      return cached;
    }

    const compiled: CompiledRule = {
      id: rule.id,
      version: rule.version || 1,
      evaluator: this.createEvaluator(rule.condition),
      metadata: {
        metric: rule.metric,
        timeWindow: rule.timeWindow,
        severity: rule.severity
      }
    };

    this.ruleCache.set(rule.id, compiled);
    return compiled;
  }

  /**
   * Evaluate multiple conditions (AND/OR logic)
   */
  evaluateCompositeCondition(
    values: Record<string, number>,
    conditions: AlertCondition[],
    logic: 'AND' | 'OR' = 'AND'
  ): boolean {
    if (logic === 'AND') {
      return conditions.every((condition) => {
        const value = values[condition.metric || 'default'];
        return this.evaluateCondition(value, condition);
      });
    } else {
      return conditions.some((condition) => {
        const value = values[condition.metric || 'default'];
        return this.evaluateCondition(value, condition);
      });
    }
  }

  /**
   * Calculate alert severity based on value deviation
   */
  calculateDynamicSeverity(
    value: number,
    baseline: number,
    thresholds: {
      warning: number;
      critical: number;
    }
  ): 'info' | 'warning' | 'critical' {
    const deviation = Math.abs((value - baseline) / baseline);

    if (deviation >= thresholds.critical) {
      return 'critical';
    } else if (deviation >= thresholds.warning) {
      return 'warning';
    }
    return 'info';
  }

  /**
   * Check if alert should be suppressed (cooldown period)
   */
  shouldSuppress(rule: AlertRule, lastAlertTime?: Date): boolean {
    if (!lastAlertTime || !rule.cooldown) {
      return false;
    }

    const timeSinceLastAlert = Date.now() - lastAlertTime.getTime();
    return timeSinceLastAlert < rule.cooldown;
  }

  /**
   * Evaluate trend-based conditions
   */
  evaluateTrendCondition(
    values: number[],
    trendType: 'increasing' | 'decreasing' | 'stable',
    threshold: number = 0.1
  ): boolean {
    if (values.length < 3) {
      return false; // Need at least 3 points for trend
    }

    // Calculate linear regression slope
    const n = values.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = values.reduce((sum, y, x) => sum + x * y, 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const avgValue = sumY / n;
    const normalizedSlope = avgValue !== 0 ? slope / avgValue : 0;

    switch (trendType) {
      case 'increasing':
        return normalizedSlope > threshold;
      case 'decreasing':
        return normalizedSlope < -threshold;
      case 'stable':
        return Math.abs(normalizedSlope) <= threshold;
      default:
        return false;
    }
  }

  /**
   * Private helper methods
   */
  private isValidCondition(condition: AlertCondition): boolean {
    const validOperators: ComparisonOperator[] = [
      'greater_than',
      'greater_than_or_equal',
      'less_than',
      'less_than_or_equal',
      'equal',
      'not_equal'
    ];

    return (
      validOperators.includes(condition.operator) &&
      typeof condition.value === 'number' &&
      !isNaN(condition.value)
    );
  }

  private isValidTimeWindow(window: string): boolean {
    // Valid formats: 5m, 1h, 2d
    const pattern = /^\d+[mhd]$/;
    return pattern.test(window);
  }

  private createEvaluator(condition: AlertCondition): (value: number) => boolean {
    return (value: number) => this.evaluateCondition(value, condition);
  }
}

interface CompiledRule {
  id: string;
  version: number;
  evaluator: (value: number) => boolean;
  metadata: {
    metric: string;
    timeWindow: string;
    severity: string;
  };
}
