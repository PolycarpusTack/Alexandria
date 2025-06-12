/**
 * Log Visualization Dashboard
 *
 * Main entry point for the Log Visualization plugin UI
 */

import React, { useEffect, useState } from 'react';
import { LogSourceConfig, Dashboard } from '../../src/interfaces';
import { Button, Card, Select, Tabs } from '../../../../ui/components';
import { LoadingSpinner } from '../../../../ui/components/LoadingSpinner';
import { SourceSelector } from './SourceSelector';
import { VisualizationGrid } from './VisualizationGrid';
import { QueryBuilder } from './QueryBuilder';

/**
 * Props for LogDashboard component
 */
interface LogDashboardProps {
  // The service will be injected by the plugin framework
  service: any; // This would be properly typed in a real implementation
}

/**
 * Log Visualization Dashboard Component
 */
export const LogDashboard: React.FC<LogDashboardProps> = ({ service }) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [sources, setSources] = useState<LogSourceConfig[]>([]);
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [selectedDashboard, setSelectedDashboard] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('dashboards');
  const [error, setError] = useState<string | null>(null);

  // Load sources and dashboards on component mount
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Load sources and dashboards in parallel
        const [sourcesResult, dashboardsResult] = await Promise.all([
          service.getSources(),
          service.getDashboards()
        ]);

        setSources(sourcesResult);
        setDashboards(dashboardsResult);

        // Select first source and dashboard if available
        if (sourcesResult.length > 0) {
          setSelectedSource(sourcesResult[0].id);
        }

        if (dashboardsResult.length > 0) {
          setSelectedDashboard(dashboardsResult[0].id);
        }
      } catch (err) {
        setError('Failed to load log visualization data');
        console.error('Error loading log visualization data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [service]);

  // Handle source selection
  const handleSourceChange = (sourceId: string) => {
    setSelectedSource(sourceId);
  };

  // Handle dashboard selection
  const handleDashboardChange = (dashboardId: string) => {
    setSelectedDashboard(dashboardId);
  };

  // Handle tab change
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
  };

  // Create a new dashboard
  const handleCreateDashboard = () => {
    // This would open a modal to create a new dashboard
  };

  // Render loading state
  if (loading) {
    return (
      <div className='flex items-center justify-center h-full'>
        <LoadingSpinner size='large' />
        <span className='ml-2'>Loading log visualization...</span>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className='bg-red-50 border border-red-300 rounded p-4'>
        <h2 className='text-lg font-semibold text-red-800'>Error</h2>
        <p className='text-red-700'>{error}</p>
        <Button onClick={() => window.location.reload()} className='mt-2'>
          Retry
        </Button>
      </div>
    );
  }

  // Render no sources state
  if (sources.length === 0) {
    return (
      <div className='bg-blue-50 border border-blue-300 rounded p-4'>
        <h2 className='text-lg font-semibold text-blue-800'>No Log Sources</h2>
        <p className='text-blue-700'>
          No log sources have been configured yet. Please add a log source to start visualizing
          logs.
        </p>
        <Button onClick={() => setActiveTab('sources')} className='mt-2'>
          Add Log Source
        </Button>
      </div>
    );
  }

  // Get the selected dashboard
  const dashboard = selectedDashboard ? dashboards.find((d) => d.id === selectedDashboard) : null;

  return (
    <div className='h-full flex flex-col'>
      <div className='border-b pb-4 mb-4 flex justify-between items-center'>
        <h1 className='text-2xl font-semibold'>Log Visualization</h1>

        <div className='flex space-x-2'>
          <SourceSelector
            sources={sources}
            selectedSource={selectedSource}
            onSourceChange={handleSourceChange}
          />

          <Button onClick={handleCreateDashboard} variant='outline'>
            Create Dashboard
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className='flex-grow'>
        <Tabs.List>
          <Tabs.Trigger value='dashboards'>Dashboards</Tabs.Trigger>
          <Tabs.Trigger value='search'>Search</Tabs.Trigger>
          <Tabs.Trigger value='sources'>Log Sources</Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value='dashboards' className='h-full'>
          {dashboards.length === 0 ? (
            <div className='flex flex-col items-center justify-center h-full'>
              <p className='text-gray-500 mb-4'>No dashboards have been created yet.</p>
              <Button onClick={handleCreateDashboard}>Create Dashboard</Button>
            </div>
          ) : (
            <>
              <div className='mb-4'>
                <Select
                  value={selectedDashboard || ''}
                  onValueChange={handleDashboardChange}
                  placeholder='Select a dashboard'
                >
                  {dashboards.map((d) => (
                    <Select.Item key={d.id} value={d.id}>
                      {d.name}
                    </Select.Item>
                  ))}
                </Select>
              </div>

              {dashboard && <VisualizationGrid dashboard={dashboard} service={service} />}
            </>
          )}
        </Tabs.Content>

        <Tabs.Content value='search' className='h-full'>
          {selectedSource && <QueryBuilder sourceId={selectedSource} service={service} />}
        </Tabs.Content>

        <Tabs.Content value='sources' className='h-full'>
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
            {sources.map((source) => (
              <Card key={source.id} className='p-4'>
                <h3 className='text-lg font-semibold'>{source.name}</h3>
                <p className='text-sm text-gray-500'>{source.type}</p>
                <p className='text-sm mt-2'>{source.url}</p>
                <div className='mt-4 flex justify-end space-x-2'>
                  <Button variant='outline' size='small'>
                    Edit
                  </Button>
                  <Button variant='outline' size='small'>
                    Test
                  </Button>
                </div>
              </Card>
            ))}

            <Card className='p-4 border-dashed flex flex-col items-center justify-center'>
              <p className='text-gray-500 mb-2'>Add new log source</p>
              <Button variant='outline'>Add Source</Button>
            </Card>
          </div>
        </Tabs.Content>
      </Tabs>
    </div>
  );
};
