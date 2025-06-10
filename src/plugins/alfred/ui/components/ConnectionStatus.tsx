/**
 * Connection Status Indicator Component
 * 
 * Shows real-time AI service connection status
 * Based on original Alfred's connection status display
 */

import React, { useState, useEffect } from 'react';
import { Badge } from '../../../../client/components/ui/badge';
import { Tooltip } from '../../../../client/components/ui/tooltip';
import { 
  Wifi, 
  WifiOff, 
  AlertCircle, 
  CheckCircle,
  Clock,
  Loader2,
  Server,
  Zap
} from 'lucide-react';
import { useAlfredService } from '../hooks/useAlfredService';

export interface ConnectionInfo {
  status: 'connected' | 'disconnected' | 'connecting' | 'error';
  provider: string;
  model: string;
  latency?: number;
  lastChecked?: Date;
  error?: string;
  apiEndpoint?: string;
}

interface ConnectionStatusProps {
  className?: string;
  showDetails?: boolean;
  compact?: boolean;
  refreshInterval?: number;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  className = '',
  showDetails = true,
  compact = false,
  refreshInterval = 30000 // 30 seconds
}) => {
  const alfredService = useAlfredService();
  const [connectionInfo, setConnectionInfo] = useState<ConnectionInfo>({
    status: 'connecting',
    provider: 'Unknown',
    model: 'Unknown'
  });
  const [isChecking, setIsChecking] = useState(false);

  // Check connection status
  const checkConnection = async () => {
    if (isChecking) return;
    
    setIsChecking(true);
    const startTime = Date.now();

    try {
      // Ping the AI service
      const aiService = alfredService.getAIService();
      if (!aiService) {
        throw new Error('AI service not available');
      }

      // Try a simple test query
      const testResponse = await aiService.query('Test connection', {
        maxTokens: 1,
        temperature: 0
      });

      const latency = Date.now() - startTime;

      setConnectionInfo({
        status: 'connected',
        provider: aiService.getProvider() || 'Unknown',
        model: aiService.getCurrentModel() || 'Unknown',
        latency,
        lastChecked: new Date(),
        apiEndpoint: aiService.getEndpoint?.() || undefined
      });
    } catch (error) {
      setConnectionInfo(prev => ({
        ...prev,
        status: 'error',
        error: error.message || 'Connection failed',
        lastChecked: new Date()
      }));
    } finally {
      setIsChecking(false);
    }
  };

  // Initial check and periodic updates
  useEffect(() => {
    checkConnection();

    const interval = setInterval(checkConnection, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval]);

  // Listen for AI service events
  useEffect(() => {
    const handleConnected = (data: any) => {
      setConnectionInfo(prev => ({
        ...prev,
        status: 'connected',
        provider: data.provider,
        model: data.model
      }));
    };

    const handleDisconnected = () => {
      setConnectionInfo(prev => ({
        ...prev,
        status: 'disconnected'
      }));
    };

    const handleError = (data: any) => {
      setConnectionInfo(prev => ({
        ...prev,
        status: 'error',
        error: data.error
      }));
    };

    alfredService.on('ai:connected', handleConnected);
    alfredService.on('ai:disconnected', handleDisconnected);
    alfredService.on('ai:error', handleError);

    return () => {
      alfredService.off('ai:connected', handleConnected);
      alfredService.off('ai:disconnected', handleDisconnected);
      alfredService.off('ai:error', handleError);
    };
  }, [alfredService]);

  const getStatusIcon = () => {
    if (isChecking) {
      return <Loader2 className="h-4 w-4 animate-spin" />;
    }

    switch (connectionInfo.status) {
      case 'connected':
        return <Wifi className="h-4 w-4 text-green-500" />;
      case 'disconnected':
        return <WifiOff className="h-4 w-4 text-gray-500" />;
      case 'connecting':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const getStatusText = () => {
    switch (connectionInfo.status) {
      case 'connected':
        return 'Connected';
      case 'disconnected':
        return 'Disconnected';
      case 'connecting':
        return 'Connecting...';
      case 'error':
        return 'Error';
    }
  };

  const getStatusColor = () => {
    switch (connectionInfo.status) {
      case 'connected':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100';
      case 'disconnected':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-100';
      case 'connecting':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100';
      case 'error':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100';
    }
  };

  const formatLatency = (latency?: number) => {
    if (!latency) return 'N/A';
    if (latency < 1000) return `${latency}ms`;
    return `${(latency / 1000).toFixed(1)}s`;
  };

  const formatLastChecked = (date?: Date) => {
    if (!date) return 'Never';
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
  };

  if (compact) {
    return (
      <Tooltip>
        <Tooltip.Trigger asChild>
          <div className={`flex items-center gap-1 cursor-pointer ${className}`}>
            {getStatusIcon()}
          </div>
        </Tooltip.Trigger>
        <Tooltip.Content>
          <div className="text-sm">
            <div className="font-medium">{getStatusText()}</div>
            {connectionInfo.status === 'connected' && (
              <>
                <div>{connectionInfo.provider} - {connectionInfo.model}</div>
                <div>Latency: {formatLatency(connectionInfo.latency)}</div>
              </>
            )}
            {connectionInfo.error && (
              <div className="text-red-500">{connectionInfo.error}</div>
            )}
          </div>
        </Tooltip.Content>
      </Tooltip>
    );
  }

  return (
    <div className={`alfred-connection-status ${className}`}>
      <Badge 
        variant="outline" 
        className={`${getStatusColor()} cursor-pointer`}
        onClick={checkConnection}
      >
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <span className="font-medium">{getStatusText()}</span>
        </div>
      </Badge>

      {showDetails && connectionInfo.status === 'connected' && (
        <div className="mt-2 space-y-1 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Server className="h-3 w-3" />
            <span>{connectionInfo.provider}</span>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="h-3 w-3" />
            <span>{connectionInfo.model}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-3 w-3" />
            <span>Latency: {formatLatency(connectionInfo.latency)}</span>
          </div>
          {connectionInfo.apiEndpoint && (
            <div className="flex items-center gap-2">
              <CheckCircle className="h-3 w-3" />
              <span className="truncate text-xs">{connectionInfo.apiEndpoint}</span>
            </div>
          )}
          <div className="text-xs opacity-70">
            Last checked: {formatLastChecked(connectionInfo.lastChecked)}
          </div>
        </div>
      )}

      {connectionInfo.status === 'error' && connectionInfo.error && (
        <div className="mt-2 text-sm text-red-500">
          {connectionInfo.error}
        </div>
      )}
    </div>
  );
};

// Mini version for header/status bar
export const ConnectionStatusMini: React.FC = () => {
  return <ConnectionStatus compact showDetails={false} />;
};

// Detailed version for settings/dashboard
export const ConnectionStatusDetailed: React.FC = () => {
  const alfredService = useAlfredService();
  const [availableModels, setAvailableModels] = useState<string[]>([]);

  useEffect(() => {
    const fetchModels = async () => {
      try {
        const models = await alfredService.getAvailableModels();
        setAvailableModels(models);
      } catch (error) {
        console.error('Failed to fetch models:', error);
      }
    };

    fetchModels();
  }, [alfredService]);

  return (
    <div className="space-y-4">
      <ConnectionStatus showDetails refreshInterval={10000} />
      
      {availableModels.length > 0 && (
        <div className="border rounded-lg p-4">
          <h4 className="font-medium mb-2">Available Models</h4>
          <div className="space-y-1">
            {availableModels.map(model => (
              <div key={model} className="text-sm text-muted-foreground">
                • {model}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};