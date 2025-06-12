/**
 * React hook for real-time analytics updates via WebSocket
 */

import { useEffect, useRef, useCallback } from 'react';
import { createClientLogger } from '../../../../client/utils/client-logger';

const logger = createClientLogger({ serviceName: 'useAnalyticsRealtime' });

interface RealtimeEvent {
  type: 'crash_logged' | 'analysis_completed' | 'model_performance_update';
  data: any;
  timestamp: Date;
}

interface UseAnalyticsRealtimeOptions {
  enabled?: boolean;
  onEvent?: (event: RealtimeEvent) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  reconnectInterval?: number;
}

export function useAnalyticsRealtime(options: UseAnalyticsRealtimeOptions = {}) {
  const { enabled = true, onEvent, onConnect, onDisconnect, reconnectInterval = 5000 } = options;

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  const connect = useCallback(() => {
    if (!enabled || !mountedRef.current) return;

    // Determine WebSocket URL
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws/analytics`;

    logger.info('Connecting to WebSocket', { url: wsUrl });

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        logger.info('WebSocket connected');
        if (onConnect && mountedRef.current) {
          onConnect();
        }

        // Send authentication if needed
        const token = localStorage.getItem('auth_token');
        if (token) {
          ws.send(
            JSON.stringify({
              type: 'auth',
              token
            })
          );
        }

        // Subscribe to analytics events
        ws.send(
          JSON.stringify({
            type: 'subscribe',
            channels: ['analytics', 'crashes', 'models']
          })
        );
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          logger.debug('WebSocket message received', { message });

          if (message.type && onEvent && mountedRef.current) {
            onEvent({
              type: message.type,
              data: message.data,
              timestamp: new Date(message.timestamp || Date.now())
            });
          }
        } catch (error) {
          logger.error('Failed to parse WebSocket message', { error });
        }
      };

      ws.onerror = (error) => {
        logger.error('WebSocket error', { error });
      };

      ws.onclose = () => {
        logger.info('WebSocket disconnected');
        wsRef.current = null;

        if (onDisconnect && mountedRef.current) {
          onDisconnect();
        }

        // Attempt to reconnect
        if (enabled && mountedRef.current) {
          reconnectTimeoutRef.current = setTimeout(() => {
            logger.info('Attempting to reconnect WebSocket');
            connect();
          }, reconnectInterval);
        }
      };
    } catch (error) {
      logger.error('Failed to create WebSocket connection', { error });
    }
  }, [enabled, onConnect, onDisconnect, onEvent, reconnectInterval]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      logger.info('Closing WebSocket connection');
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const send = useCallback((data: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    } else {
      logger.warn('WebSocket not connected, cannot send message');
    }
  }, []);

  // Connect on mount
  useEffect(() => {
    if (enabled) {
      connect();
    }

    return () => {
      mountedRef.current = false;
      disconnect();
    };
  }, [enabled, connect, disconnect]);

  return {
    isConnected: wsRef.current?.readyState === WebSocket.OPEN,
    send,
    disconnect,
    reconnect: connect
  };
}
