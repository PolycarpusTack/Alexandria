/**
 * Visualization Grid Component
 * 
 * Renders a grid of visualization widgets for a dashboard
 */

import React, { useEffect, useState } from 'react';
import { Dashboard, LogQuery, LogQueryResult } from '../../src/interfaces';
import { Card } from '../../../../ui/components';
import { LoadingSpinner } from '../../../../ui/components/LoadingSpinner';
import { LogChart } from './LogChart';
import { LogTable } from './LogTable';
import { MetricsCard } from './MetricsCard';
import { AlertPanel } from './AlertPanel';

interface VisualizationGridProps {
  dashboard: Dashboard;
  service: any;
}

export const VisualizationGrid: React.FC<VisualizationGridProps> = ({
  dashboard,
  service
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<Record<string, LogQueryResult>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadDashboardData = async () => {
      if (!dashboard.widgets || dashboard.widgets.length === 0) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Execute queries for all widgets in parallel
        const queries = dashboard.widgets.map(async (widget) => {
          if (widget.query) {
            const result = await service.query(widget.query);
            return { widgetId: widget.id, result };
          }
          return { widgetId: widget.id, result: null };
        });

        const results = await Promise.all(queries);
        
        // Convert results to a map
        const dataMap: Record<string, LogQueryResult> = {};
        results.forEach(({ widgetId, result }) => {
          if (result) {
            dataMap[widgetId] = result;
          }
        });

        setData(dataMap);
      } catch (err) {
        setError('Failed to load dashboard data');
        console.error('Error loading dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, [dashboard, service]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="large" />
        <span className="ml-2">Loading dashboard...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-300 rounded p-4">
        <h3 className="text-lg font-semibold text-red-800">Error</h3>
        <p className="text-red-700">{error}</p>
      </div>
    );
  }

  if (!dashboard.widgets || dashboard.widgets.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-300 rounded p-8 text-center">
        <h3 className="text-lg font-semibold text-gray-700">Empty Dashboard</h3>
        <p className="text-gray-600 mt-2">
          This dashboard doesn't have any widgets yet. Add some widgets to start visualizing your logs.
        </p>
      </div>
    );
  }

  const renderWidget = (widget: any) => {
    const widgetData = data[widget.id];

    switch (widget.type) {
      case 'chart':
        return (
          <LogChart
            title={widget.title}
            data={widgetData}
            chartType={widget.chartType || 'line'}
            timeField={widget.timeField || 'timestamp'}
            valueField={widget.valueField}
          />
        );

      case 'table':
        return (
          <LogTable
            title={widget.title}
            data={widgetData}
            columns={widget.columns}
            pageSize={widget.pageSize || 10}
          />
        );

      case 'metrics':
        return (
          <MetricsCard
            title={widget.title}
            data={widgetData}
            metrics={widget.metrics}
          />
        );

      case 'alerts':
        return (
          <AlertPanel
            title={widget.title}
            alerts={widget.alerts || []}
            service={service}
          />
        );

      default:
        return (
          <Card className="p-4">
            <h4 className="text-lg font-semibold">{widget.title}</h4>
            <p className="text-gray-600">Unsupported widget type: {widget.type}</p>
          </Card>
        );
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {dashboard.widgets.map((widget) => (
        <div
          key={widget.id}
          className={`${widget.size === 'large' ? 'md:col-span-2 lg:col-span-3' : 
                     widget.size === 'medium' ? 'md:col-span-2' : ''}`}
        >
          {renderWidget(widget)}
        </div>
      ))}
    </div>
  );
};