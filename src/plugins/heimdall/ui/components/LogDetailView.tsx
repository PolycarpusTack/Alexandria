/**
 * Log Detail View
 * 
 * Component for displaying detailed information about a log entry
 */

import React, { useEffect, useState } from 'react';
import { LogEntry } from '../../src/interfaces';
import { Card, Tabs, Badge } from '../../../../ui/components';
import { LoadingSpinner } from '../../../../ui/components/LoadingSpinner';

/**
 * Props for LogDetailView component
 */
interface LogDetailViewProps {
  // The service will be injected by the plugin framework
  service: any; // This would be properly typed in a real implementation
  logId?: string;
  sourceId?: string;
}

/**
 * Log Entry Detail View Component
 */
export const LogDetailView: React.FC<LogDetailViewProps> = ({ 
  service, 
  logId, 
  sourceId 
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [log, setLog] = useState<LogEntry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('details');

  // Load log entry when logId changes
  useEffect(() => {
    if (!logId || !sourceId) {
      setLoading(false);
      return;
    }

    const loadLogEntry = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // In a real implementation, we would call a service method to get the log entry
        // For now, we'll simulate loading a log entry
        setTimeout(() => {
          // This is a mock log entry
          const mockLog: LogEntry = {
            id: logId,
            timestamp: new Date(),
            level: 'error',
            message: 'Application encountered an unexpected error',
            source: 'Application Server',
            serviceName: 'backend-api',
            hostName: 'srv-backend-prod-01',
            threadId: 'thread-123',
            traceId: 'trace-abc-123',
            spanId: 'span-456',
            userId: 'user-789',
            sessionId: 'session-xyz',
            metadata: {
              errorCode: 'E1001',
              component: 'AuthService',
              duration: 345
            },
            tags: ['auth', 'error', 'production'],
            context: {
              request: {
                method: 'POST',
                path: '/api/auth/login',
                ip: '192.168.1.1'
              },
              exception: {
                name: 'DatabaseError',
                message: 'Connection timeout',
                stackTrace: 'Error: Connection timeout\n at AuthService.authenticate (auth.js:123)\n at LoginController.handleLogin (login.js:45)'
              }
            },
            originalEntry: {
              // Raw log entry from source
              timestamp: '2023-08-01T10:15:30.123Z',
              level: 'ERROR',
              message: 'Application encountered an unexpected error',
              logger_name: 'com.example.api.AuthService',
              thread_name: 'http-nio-8080-exec-1',
              // ... other fields
            }
          };
          
          setLog(mockLog);
          setLoading(false);
        }, 1000);
      } catch (err) {
        setError('Failed to load log entry details');
        console.error('Error loading log entry:', err);
        setLoading(false);
      }
    };
    
    loadLogEntry();
  }, [logId, sourceId, service]);

  // Handle tab change
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
  };

  // Render loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner size="medium" />
        <span className="ml-2">Loading log details...</span>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="bg-red-50 border border-red-300 rounded p-4">
        <h2 className="text-lg font-semibold text-red-800">Error</h2>
        <p className="text-red-700">{error}</p>
      </div>
    );
  }

  // Render no log selected state
  if (!log) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">No log entry selected</p>
      </div>
    );
  }

  // Helper function to get level badge color
  const getLevelColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'trace':
        return 'gray';
      case 'debug':
        return 'blue';
      case 'info':
        return 'green';
      case 'warn':
        return 'yellow';
      case 'error':
        return 'red';
      case 'fatal':
        return 'purple';
      default:
        return 'gray';
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="border-b pb-4 mb-4">
        <div className="flex items-center mb-2">
          <Badge variant={getLevelColor(log.level)}>
            {log.level.toUpperCase()}
          </Badge>
          <span className="ml-2 text-gray-500">
            {log.timestamp.toLocaleString()}
          </span>
        </div>
        <h1 className="text-xl font-semibold">{log.message}</h1>
        <div className="flex mt-2 text-sm text-gray-500">
          <span className="mr-4">Source: {log.source}</span>
          {log.serviceName && (
            <span className="mr-4">Service: {log.serviceName}</span>
          )}
          {log.hostName && <span>Host: {log.hostName}</span>}
        </div>
      </div>
      
      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="flex-grow"
      >
        <Tabs.List>
          <Tabs.Trigger value="details">Details</Tabs.Trigger>
          <Tabs.Trigger value="context">Context</Tabs.Trigger>
          <Tabs.Trigger value="metadata">Metadata</Tabs.Trigger>
          <Tabs.Trigger value="raw">Raw</Tabs.Trigger>
        </Tabs.List>
        
        <Tabs.Content value="details" className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-4">
              <h3 className="text-lg font-semibold mb-2">Log Information</h3>
              <table className="w-full">
                <tbody>
                  <tr>
                    <td className="py-1 pr-4 font-medium text-gray-500">ID</td>
                    <td>{log.id}</td>
                  </tr>
                  <tr>
                    <td className="py-1 pr-4 font-medium text-gray-500">Timestamp</td>
                    <td>{log.timestamp.toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td className="py-1 pr-4 font-medium text-gray-500">Level</td>
                    <td>
                      <Badge variant={getLevelColor(log.level)}>
                        {log.level.toUpperCase()}
                      </Badge>
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1 pr-4 font-medium text-gray-500">Message</td>
                    <td>{log.message}</td>
                  </tr>
                  <tr>
                    <td className="py-1 pr-4 font-medium text-gray-500">Source</td>
                    <td>{log.source}</td>
                  </tr>
                </tbody>
              </table>
            </Card>
            
            <Card className="p-4">
              <h3 className="text-lg font-semibold mb-2">Service Information</h3>
              <table className="w-full">
                <tbody>
                  <tr>
                    <td className="py-1 pr-4 font-medium text-gray-500">Service</td>
                    <td>{log.serviceName || 'N/A'}</td>
                  </tr>
                  <tr>
                    <td className="py-1 pr-4 font-medium text-gray-500">Host</td>
                    <td>{log.hostName || 'N/A'}</td>
                  </tr>
                  <tr>
                    <td className="py-1 pr-4 font-medium text-gray-500">Thread ID</td>
                    <td>{log.threadId || 'N/A'}</td>
                  </tr>
                  <tr>
                    <td className="py-1 pr-4 font-medium text-gray-500">Trace ID</td>
                    <td>{log.traceId || 'N/A'}</td>
                  </tr>
                  <tr>
                    <td className="py-1 pr-4 font-medium text-gray-500">Span ID</td>
                    <td>{log.spanId || 'N/A'}</td>
                  </tr>
                </tbody>
              </table>
            </Card>
            
            <Card className="p-4">
              <h3 className="text-lg font-semibold mb-2">User Information</h3>
              <table className="w-full">
                <tbody>
                  <tr>
                    <td className="py-1 pr-4 font-medium text-gray-500">User ID</td>
                    <td>{log.userId || 'N/A'}</td>
                  </tr>
                  <tr>
                    <td className="py-1 pr-4 font-medium text-gray-500">Session ID</td>
                    <td>{log.sessionId || 'N/A'}</td>
                  </tr>
                </tbody>
              </table>
            </Card>
            
            <Card className="p-4">
              <h3 className="text-lg font-semibold mb-2">Tags</h3>
              {log.tags && log.tags.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {log.tags.map((tag, index) => (
                    <Badge key={index} variant="outline">
                      {tag}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">No tags</p>
              )}
            </Card>
          </div>
        </Tabs.Content>
        
        <Tabs.Content value="context" className="p-4">
          {log.context ? (
            <div className="grid grid-cols-1 gap-4">
              {Object.entries(log.context).map(([key, value]) => (
                <Card key={key} className="p-4">
                  <h3 className="text-lg font-semibold mb-2 capitalize">{key}</h3>
                  <pre className="bg-gray-100 p-3 rounded text-sm overflow-auto">
                    {JSON.stringify(value, null, 2)}
                  </pre>
                </Card>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">No context information available</p>
          )}
        </Tabs.Content>
        
        <Tabs.Content value="metadata" className="p-4">
          {log.metadata && Object.keys(log.metadata).length > 0 ? (
            <Card className="p-4">
              <h3 className="text-lg font-semibold mb-2">Metadata</h3>
              <pre className="bg-gray-100 p-3 rounded text-sm overflow-auto">
                {JSON.stringify(log.metadata, null, 2)}
              </pre>
            </Card>
          ) : (
            <p className="text-gray-500">No metadata available</p>
          )}
        </Tabs.Content>
        
        <Tabs.Content value="raw" className="p-4">
          <Card className="p-4">
            <h3 className="text-lg font-semibold mb-2">Raw Log Entry</h3>
            <pre className="bg-gray-100 p-3 rounded text-sm overflow-auto">
              {JSON.stringify(log.originalEntry, null, 2)}
            </pre>
          </Card>
        </Tabs.Content>
      </Tabs>
    </div>
  );
};