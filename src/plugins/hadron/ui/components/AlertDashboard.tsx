/**
 * Alert Dashboard Component
 * Displays active alerts, alert history, and alert configuration
 */

import React, { useState, useEffect } from 'react';

import {
  Bell,
  BellOff,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle,
  Clock,
  Settings,
  Plus,
  Edit,
  Trash2,
  RefreshCw,
  Download,
  Filter
} from 'lucide-react';
import { useAlertService } from '../hooks/useAlertService';
import { AlertRule, AlertEvent, AlertSeverity } from '../../src/interfaces/alerts';
import { format } from 'date-fns';
import { cn } from '../../../../client/lib/utils';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../client/components/ui/card';
import { Button } from '../../../../client/components/ui/button';
import { Badge } from '../../../../client/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../../client/components/ui/table';
import { Input } from '../../../../client/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../client/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../../client/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '../../../../client/components/ui/dialog';
import { Switch } from '../../../../client/components/ui/switch';
import { useToast } from '../../../../client/components/ui/use-toast'
export const AlertDashboard: React.FC = () => {
  const { toast } = useToast();
  const {
    activeAlerts,
    alertHistory,
    rules,
    metrics,
    loading,
    acknowledgeAlert,
    resolveAlert,
    updateRule,
    deleteRule,
    refreshAlerts
  } = useAlertService();

  const [selectedTab, setSelectedTab] = useState('active');
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);
  const [filterSeverity, setFilterSeverity] = useState<AlertSeverity | 'all'>('all');
  const [showResolveModal, setShowResolveModal] = useState<AlertEvent | null>(null);
  const [resolution, setResolution] = useState('');

  // Severity icons and colors
  const severityConfig = {
    critical: {
      icon: AlertCircle,
      color: 'text-red-600 dark:text-red-400',
      bgColor: 'bg-red-100 dark:bg-red-900/20'
    },
    warning: {
      icon: AlertTriangle,
      color: 'text-yellow-600 dark:text-yellow-400',
      bgColor: 'bg-yellow-100 dark:bg-yellow-900/20'
    },
    info: {
      icon: Info,
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-100 dark:bg-blue-900/20'
    }
  };

  // Filter alerts by severity
  const filteredActiveAlerts = filterSeverity === 'all' 
    ? activeAlerts 
    : activeAlerts.filter(alert => alert.severity === filterSeverity);

  const filteredHistory = filterSeverity === 'all'
    ? alertHistory
    : alertHistory.filter(alert => alert.severity === filterSeverity);

  const handleAcknowledge = async (alert: AlertEvent) => {
    try {
      await acknowledgeAlert(alert.id, 'current-user'); // In real app, get from auth
      toast({
        title: 'Alert Acknowledged',
        description: `Alert "${alert.ruleName}" has been acknowledged`
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to acknowledge alert',
        variant: 'destructive'
      });
    }
  };

  const handleResolve = async () => {
    if (!showResolveModal) return;

    try {
      await resolveAlert(
        showResolveModal.id,
        'current-user',
        resolution
      );
      toast({
        title: 'Alert Resolved',
        description: `Alert "${showResolveModal.ruleName}" has been resolved`
      });
      setShowResolveModal(null);
      setResolution('');
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to resolve alert',
        variant: 'destructive'
      });
    }
  };

  const handleToggleRule = async (rule: AlertRule) => {
    try {
      await updateRule(rule.id, { enabled: !rule.enabled });
      toast({
        title: rule.enabled ? 'Rule Disabled' : 'Rule Enabled',
        description: `Alert rule "${rule.name}" has been ${rule.enabled ? 'disabled' : 'enabled'}`
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update rule',
        variant: 'destructive'
      });
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!confirm('Are you sure you want to delete this rule?')) return;

    try {
      await deleteRule(ruleId);
      toast({
        title: 'Rule Deleted',
        description: 'Alert rule has been deleted successfully'
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete rule',
        variant: 'destructive'
      });
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bell className="h-6 w-6" />
            Alert Management
          </h1>
          <p className="text-muted-foreground">
            Monitor and manage analytics alerts
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={refreshAlerts}
            disabled={loading}
          >
            <RefreshCw className={cn('h-4 w-4 mr-1', loading && 'animate-spin')} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setEditingRule(null);
              setShowRuleModal(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1" />
            New Rule
          </Button>
        </div>
      </div>

      {/* Metrics Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard
          title="Active Alerts"
          value={metrics.activeAlerts}
          icon={Bell}
          color="red"
          trend={metrics.activeAlerts > 0 ? 'up' : 'stable'}
        />
        <MetricCard
          title="Acknowledged"
          value={metrics.acknowledgedAlerts}
          icon={CheckCircle}
          color="yellow"
        />
        <MetricCard
          title="Resolved Today"
          value={metrics.resolvedAlerts}
          icon={CheckCircle}
          color="green"
        />
        <MetricCard
          title="Avg Resolution Time"
          value={`${Math.round(metrics.averageResolutionTime / 60)}m`}
          icon={Clock}
          color="blue"
        />
      </div>

      {/* Alert Tabs */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Alerts</CardTitle>
            <Select
              value={filterSeverity}
              onValueChange={(value) => setFilterSeverity(value as any)}
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="warning">Warning</option>
              <option value="info">Info</option>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={selectedTab} onValueChange={setSelectedTab}>
            <TabsList>
              <TabsTrigger value="active">
                Active ({filteredActiveAlerts.length})
              </TabsTrigger>
              <TabsTrigger value="history">
                History
              </TabsTrigger>
              <TabsTrigger value="rules">
                Rules ({rules.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="mt-4">
              {filteredActiveAlerts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                  <p>No active alerts</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredActiveAlerts.map(alert => (
                    <AlertCard
                      key={alert.id}
                      alert={alert}
                      onAcknowledge={() => handleAcknowledge(alert)}
                      onResolve={() => {
                        setShowResolveModal(alert);
                      }}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="history" className="mt-4">
              <div className="space-y-2">
                <Table>
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Rule</th>
                      <th>Severity</th>
                      <th>Value</th>
                      <th>Status</th>
                      <th>Resolution Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHistory.slice(0, 20).map(alert => (
                      <tr key={alert.id}>
                        <td>{format(alert.timestamp, 'MMM dd HH:mm')}</td>
                        <td>{alert.ruleName}</td>
                        <td>
                          <Badge className={severityConfig[alert.severity].bgColor}>
                            {alert.severity}
                          </Badge>
                        </td>
                        <td>{alert.value.toFixed(2)}</td>
                        <td>
                          {alert.resolved ? (
                            <Badge variant="outline" className="text-green-600">
                              Resolved
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-yellow-600">
                              Acknowledged
                            </Badge>
                          )}
                        </td>
                        <td>
                          {alert.resolvedAt && alert.timestamp ? (
                            `${Math.round(
                              (new Date(alert.resolvedAt).getTime() - 
                               new Date(alert.timestamp).getTime()) / 60000
                            )}m`
                          ) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="rules" className="mt-4">
              <div className="space-y-3">
                {rules.map(rule => (
                  <RuleCard
                    key={rule.id}
                    rule={rule}
                    onToggle={() => handleToggleRule(rule)}
                    onEdit={() => {
                      setEditingRule(rule);
                      setShowRuleModal(true);
                    }}
                    onDelete={() => handleDeleteRule(rule.id)}
                  />
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Resolve Alert Modal */}
      <Dialog open={!!showResolveModal} onOpenChange={() => setShowResolveModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve Alert</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Resolution Notes</label>
              <textarea
                className="w-full mt-1 p-2 border rounded-md"
                rows={4}
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                placeholder="Describe how the alert was resolved..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResolveModal(null)}>
              Cancel
            </Button>
            <Button onClick={handleResolve}>
              Resolve Alert
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Sub-components
const MetricCard: React.FC<{
  title: string;
  value: number | string;
  icon: any;
  color: string;
  trend?: 'up' | 'down' | 'stable';
}> = ({ title, value, icon: Icon, color }) => (
  <Card>
    <CardContent className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
        </div>
        <div className={cn(
          'p-3 rounded-lg',
          color === 'red' && 'bg-red-100 dark:bg-red-900/20',
          color === 'yellow' && 'bg-yellow-100 dark:bg-yellow-900/20',
          color === 'green' && 'bg-green-100 dark:bg-green-900/20',
          color === 'blue' && 'bg-blue-100 dark:bg-blue-900/20'
        )}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </CardContent>
  </Card>
);

const AlertCard: React.FC<{
  alert: AlertEvent;
  onAcknowledge: () => void;
  onResolve: () => void;
}> = ({ alert, onAcknowledge, onResolve }) => {
  const severityConfig = {
    critical: {
      icon: AlertCircle,
      color: 'border-red-500 bg-red-50 dark:bg-red-900/10'
    },
    warning: {
      icon: AlertTriangle,
      color: 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/10'
    },
    info: {
      icon: Info,
      color: 'border-blue-500 bg-blue-50 dark:bg-blue-900/10'
    }
  };

  const config = severityConfig[alert.severity];
  const Icon = config.icon;

  return (
    <Card className={cn('border-l-4', config.color)}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <Icon className="h-5 w-5 mt-0.5" />
            <div>
              <h4 className="font-medium">{alert.ruleName}</h4>
              <p className="text-sm text-muted-foreground mt-1">
                {alert.message}
              </p>
              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                <span>{format(alert.timestamp, 'MMM dd HH:mm:ss')}</span>
                <span>Value: {alert.value.toFixed(2)}</span>
                <span>Threshold: {alert.threshold.toFixed(2)}</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            {!alert.acknowledged && (
              <Button
                size="sm"
                variant="outline"
                onClick={onAcknowledge}
              >
                Acknowledge
              </Button>
            )}
            {alert.acknowledged && !alert.resolved && (
              <Button
                size="sm"
                onClick={onResolve}
              >
                Resolve
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const RuleCard: React.FC<{
  rule: AlertRule;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}> = ({ rule, onToggle, onEdit, onDelete }) => (
  <Card>
    <CardContent className="p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Switch
            checked={rule.enabled}
            onCheckedChange={onToggle}
          />
          <div>
            <h4 className="font-medium">{rule.name}</h4>
            <p className="text-sm text-muted-foreground">
              {rule.metric} {rule.condition.operator} {rule.condition.value} 
              (last {rule.timeWindow})
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{rule.severity}</Badge>
          <Button
            size="icon"
            variant="ghost"
            onClick={onEdit}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </CardContent>
  </Card>
);