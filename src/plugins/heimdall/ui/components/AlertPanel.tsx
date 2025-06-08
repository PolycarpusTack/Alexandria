/**
 * Alert Panel Component
 * 
 * Manages and displays log-based alerts and notifications
 */

import React, { useEffect, useState } from 'react';
import { LogAlert } from '../../src/interfaces';
import { Card, Button } from '../../../../ui/components';
import { LoadingSpinner } from '../../../../ui/components/LoadingSpinner';

interface AlertPanelProps {
  title: string;
  alerts: LogAlert[];
  service: any;
}

export const AlertPanel: React.FC<AlertPanelProps> = ({
  title,
  alerts: initialAlerts,
  service
}) => {
  const [alerts, setAlerts] = useState<LogAlert[]>(initialAlerts);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState<boolean>(false);

  // Load alerts from service
  useEffect(() => {
    const loadAlerts = async () => {
      try {
        setLoading(true);
        const loadedAlerts = await service.getAlerts();
        setAlerts(loadedAlerts);
      } catch (err) {
        setError('Failed to load alerts');
        console.error('Error loading alerts:', err);
      } finally {
        setLoading(false);
      }
    };

    if (service && !initialAlerts.length) {
      loadAlerts();
    }
  }, [service, initialAlerts.length]);

  // Toggle alert enabled/disabled
  const toggleAlert = async (alertId: string, enabled: boolean) => {
    try {
      await service.updateAlert(alertId, { enabled });
      setAlerts(alerts.map(alert => 
        alert.id === alertId ? { ...alert, enabled } : alert
      ));
    } catch (err) {
      console.error('Error updating alert:', err);
    }
  };

  // Delete alert
  const deleteAlert = async (alertId: string) => {
    if (!confirm('Are you sure you want to delete this alert?')) {
      return;
    }

    try {
      await service.deleteAlert(alertId);
      setAlerts(alerts.filter(alert => alert.id !== alertId));
    } catch (err) {
      console.error('Error deleting alert:', err);
    }
  };

  // Get alert severity color
  const getAlertSeverityColor = (alert: LogAlert): string => {
    // Determine severity based on condition
    const condition = alert.condition;
    if (condition.query?.levels?.includes('error' as any) || 
        condition.query?.levels?.includes('fatal' as any)) {
      return 'border-red-200 bg-red-50';
    } else if (condition.query?.levels?.includes('warn' as any)) {
      return 'border-yellow-200 bg-yellow-50';
    }
    return 'border-blue-200 bg-blue-50';
  };

  // Format last triggered time
  const formatLastTriggered = (date: Date | undefined): string => {
    if (!date) return 'Never';
    
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  // Get condition summary
  const getConditionSummary = (alert: LogAlert): string => {
    const { condition } = alert;
    const { threshold, query } = condition;
    
    let summary = `${threshold.type} ${threshold.operator} ${threshold.value}`;
    
    if (query?.levels?.length) {
      summary += ` for ${query.levels.join(', ')} logs`;
    }
    
    if (query?.search) {
      summary += ` containing "${query.search}"`;
    }
    
    return summary;
  };

  if (loading) {
    return (
      <Card className="p-4">
        <h4 className="text-lg font-semibold mb-4">{title}</h4>
        <div className="flex items-center justify-center h-32">
          <LoadingSpinner size="large" />
          <span className="ml-2">Loading alerts...</span>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h4 className="text-lg font-semibold">{title}</h4>
        <Button
          onClick={() => setShowCreateForm(true)}
          size="small"
        >
          Create Alert
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-300 rounded p-3 mb-4">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {alerts.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>No alerts configured</p>
          <Button
            onClick={() => setShowCreateForm(true)}
            variant="outline"
            className="mt-2"
          >
            Create your first alert
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`border rounded-lg p-4 ${getAlertSeverityColor(alert)}`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    <h5 className="font-medium text-gray-900">{alert.name}</h5>
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        alert.enabled 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {alert.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  
                  <p className="text-sm text-gray-600 mt-1">
                    {getConditionSummary(alert)}
                  </p>
                  
                  <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                    <span>Last triggered: {formatLastTriggered(alert.lastTriggered)}</span>
                    <span>Actions: {alert.actions.length}</span>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Button
                    size="small"
                    variant="outline"
                    onClick={() => toggleAlert(alert.id, !alert.enabled)}
                  >
                    {alert.enabled ? 'Disable' : 'Enable'}
                  </Button>
                  
                  <Button
                    size="small"
                    variant="outline"
                    onClick={() => deleteAlert(alert.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    Delete
                  </Button>
                </div>
              </div>

              {/* Alert actions */}
              {alert.actions.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <h6 className="text-xs font-medium text-gray-700 mb-2">Actions:</h6>
                  <div className="space-y-1">
                    {alert.actions.map((action, index) => (
                      <div key={index} className="text-xs text-gray-600">
                        <span className="font-medium">{action.type}:</span>
                        {action.type === 'notification' && action.config.message && (
                          <span className="ml-1">{action.config.message}</span>
                        )}
                        {action.type === 'email' && action.config.to && (
                          <span className="ml-1">to {action.config.to}</span>
                        )}
                        {action.type === 'webhook' && action.config.url && (
                          <span className="ml-1">POST to {action.config.url}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Quick Stats */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-lg font-semibold text-gray-900">
              {alerts.length}
            </div>
            <div className="text-xs text-gray-500">Total Alerts</div>
          </div>
          
          <div>
            <div className="text-lg font-semibold text-green-600">
              {alerts.filter(a => a.enabled).length}
            </div>
            <div className="text-xs text-gray-500">Active</div>
          </div>
          
          <div>
            <div className="text-lg font-semibold text-orange-600">
              {alerts.filter(a => a.lastTriggered && 
                new Date().getTime() - a.lastTriggered.getTime() < 24 * 60 * 60 * 1000
              ).length}
            </div>
            <div className="text-xs text-gray-500">Triggered Today</div>
          </div>
        </div>
      </div>

      {/* Simple Create Form Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full m-4">
            <h3 className="text-lg font-semibold mb-4">Create Alert</h3>
            <p className="text-gray-600 mb-4">
              Alert creation form would be implemented here with proper form handling.
            </p>
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => setShowCreateForm(false)}
              >
                Cancel
              </Button>
              <Button onClick={() => setShowCreateForm(false)}>
                Create
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};