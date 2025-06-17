import { useEffect, useRef, useState, useCallback } from 'react';
import { mnemosyneAPI } from '../api/client';
import { useMnemosyneStore } from '../store';

interface WebSocketMessage {
  type: 'node-update' | 'node-delete' | 'node-create' | 'user-presence' | 'cursor-position';
  payload: any;
  userId?: string;
  timestamp: string;
}

interface UserPresence {
  userId: string;
  userName: string;
  nodeId?: string;
  cursorPosition?: { line: number; column: number };
  color: string;
}

export const useWebSocket = (nodeId?: string) => {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [activeUsers, setActiveUsers] = useState<Map<string, UserPresence>>(new Map());
  const { updateNodeInCache, removeNodeFromCache } = useMnemosyneStore();
  
  // Reconnection logic
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectDelay = 1000; // Start with 1 second

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      const ws = mnemosyneAPI.connectWebSocket((event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          handleMessage(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      });

      ws.onopen = () => {
        console.log('WebSocket connected');
        setConnected(true);
        reconnectAttempts.current = 0;
        
        // Subscribe to node updates if nodeId is provided
        if (nodeId) {
          ws.send(JSON.stringify({
            type: 'subscribe',
            nodeId,
            timestamp: new Date().toISOString()
          }));
        }
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setConnected(false);
        wsRef.current = null;
        
        // Attempt to reconnect
        if (reconnectAttempts.current < maxReconnectAttempts) {
          const delay = reconnectDelay * Math.pow(2, reconnectAttempts.current);
          reconnectAttempts.current++;
          
          console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current})`);
          reconnectTimeoutRef.current = setTimeout(connect, delay);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
    }
  }, [nodeId]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    setConnected(false);
    setActiveUsers(new Map());
  }, []);

  const handleMessage = useCallback((message: WebSocketMessage) => {
    switch (message.type) {
      case 'node-update':
        // Update node in cache
        updateNodeInCache(message.payload);
        break;
        
      case 'node-delete':
        // Remove node from cache
        removeNodeFromCache(message.payload.nodeId);
        break;
        
      case 'node-create':
        // New node created - could trigger a refresh
        console.log('New node created:', message.payload);
        break;
        
      case 'user-presence':
        // Update user presence
        if (message.userId) {
          const presence: UserPresence = message.payload;
          setActiveUsers(prev => {
            const updated = new Map(prev);
            if (presence.nodeId) {
              updated.set(message.userId, presence);
            } else {
              updated.delete(message.userId);
            }
            return updated;
          });
        }
        break;
        
      case 'cursor-position':
        // Update cursor position for collaborative editing
        if (message.userId) {
          setActiveUsers(prev => {
            const updated = new Map(prev);
            const user = updated.get(message.userId);
            if (user) {
              user.cursorPosition = message.payload;
            }
            return updated;
          });
        }
        break;
    }
  }, [updateNodeInCache, removeNodeFromCache]);

  const sendMessage = useCallback((type: WebSocketMessage['type'], payload: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type,
        payload,
        timestamp: new Date().toISOString()
      }));
    }
  }, []);

  const updateCursorPosition = useCallback((line: number, column: number) => {
    sendMessage('cursor-position', { line, column });
  }, [sendMessage]);

  const joinNode = useCallback((nodeId: string) => {
    sendMessage('user-presence', { 
      nodeId, 
      action: 'join',
      userName: 'Current User', // TODO: Get from auth context
      color: '#' + Math.floor(Math.random()*16777215).toString(16)
    });
  }, [sendMessage]);

  const leaveNode = useCallback(() => {
    sendMessage('user-presence', { action: 'leave' });
  }, [sendMessage]);

  // Connect on mount
  useEffect(() => {
    connect();
    return disconnect;
  }, [connect, disconnect]);

  // Join/leave node on nodeId change
  useEffect(() => {
    if (connected && nodeId) {
      joinNode(nodeId);
      return () => {
        leaveNode();
      };
    }
  }, [connected, nodeId, joinNode, leaveNode]);

  return {
    connected,
    activeUsers: Array.from(activeUsers.values()),
    sendMessage,
    updateCursorPosition,
    reconnect: connect,
    disconnect
  };
};

// Hook for collaborative editing
export const useCollaborativeEditing = (nodeId: string, content: string) => {
  const { activeUsers, updateCursorPosition } = useWebSocket(nodeId);
  const [collaborativeCursors, setCollaborativeCursors] = useState<Map<string, any>>(new Map());
  
  useEffect(() => {
    // Transform user cursor positions to editor positions
    const cursors = new Map();
    activeUsers.forEach(user => {
      if (user.cursorPosition) {
        cursors.set(user.userId, {
          ...user.cursorPosition,
          color: user.color,
          userName: user.userName
        });
      }
    });
    setCollaborativeCursors(cursors);
  }, [activeUsers]);

  const handleCursorChange = useCallback((line: number, column: number) => {
    updateCursorPosition(line, column);
  }, [updateCursorPosition]);

  return {
    activeUsers,
    collaborativeCursors,
    handleCursorChange
  };
};