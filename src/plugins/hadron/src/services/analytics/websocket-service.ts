/**
 * WebSocket service for real-time alert notifications
 */

import WebSocket from 'ws';
import { EventBus } from '../../../../../core/event-bus/event-bus';
import { AlertEvent } from '../../interfaces/alerts';
import { inject, injectable } from 'tsyringe';
import { createLogger } from '../../../../core/services/logging-service';

const logger = createLogger({ serviceName: 'WebSocketService' });

@injectable()
export class WebSocketService {
  private wss: WebSocket.Server | null = null;
  private clients: Set<WebSocket> = new Set();
  
  constructor(
    @inject('EventBus') private eventBus: EventBus
  ) {
    this.setupEventListeners();
  }
  
  /**
   * Initialize WebSocket server
   */
  initialize(server: any): void {
    this.wss = new WebSocket.Server({ 
      server,
      path: '/ws/alerts' 
    });
    
    this.wss.on('connection', (ws: WebSocket) => {
      logger.info('New WebSocket client connected');
      this.clients.add(ws);
      
      // Send initial connection message
      ws.send(JSON.stringify({
        type: 'connection',
        message: 'Connected to alert service'
      }));
      
      // Handle client disconnect
      ws.on('close', () => {
        logger.info('WebSocket client disconnected');
        this.clients.delete(ws);
      });
      
      // Handle errors
      ws.on('error', (error) => {
        logger.error('WebSocket error', { error });
        this.clients.delete(ws);
      });
      
      // Ping/pong to keep connection alive
      ws.on('pong', () => {
        (ws as any).isAlive = true;
      });
    });
    
    // Setup ping interval
    const pingInterval = setInterval(() => {
      this.wss?.clients.forEach((ws) => {
        if ((ws as any).isAlive === false) {
          ws.terminate();
          this.clients.delete(ws);
          return;
        }
        
        (ws as any).isAlive = false;
        ws.ping();
      });
    }, 30000); // 30 seconds
    
    // Clean up on server close
    this.wss.on('close', () => {
      clearInterval(pingInterval);
    });
  }
  
  /**
   * Setup event listeners for alert events
   */
  private setupEventListeners(): void {
    // Listen for alert triggered events
    this.eventBus.on('alert:triggered', ({ alert }: { alert: AlertEvent }) => {
      this.broadcast({
        type: 'alert:triggered',
        alert
      });
    });
    
    // Listen for alert acknowledged events
    this.eventBus.on('alert:acknowledged', ({ alertId }: { alertId: string }) => {
      this.broadcast({
        type: 'alert:acknowledged',
        alertId
      });
    });
    
    // Listen for alert resolved events
    this.eventBus.on('alert:resolved', ({ alertId }: { alertId: string }) => {
      this.broadcast({
        type: 'alert:resolved',
        alertId
      });
    });
    
    // Listen for rule changes
    this.eventBus.on('alert:rule_registered', ({ rule }: any) => {
      this.broadcast({
        type: 'alert:rule_registered',
        rule
      });
    });
    
    this.eventBus.on('alert:rule_updated', ({ ruleId, updates }: any) => {
      this.broadcast({
        type: 'alert:rule_updated',
        ruleId,
        updates
      });
    });
    
    this.eventBus.on('alert:rule_deleted', ({ ruleId }: any) => {
      this.broadcast({
        type: 'alert:rule_deleted',
        ruleId
      });
    });
  }
  
  /**
   * Broadcast message to all connected clients
   */
  private broadcast(data: any): void {
    const message = JSON.stringify(data);
    
    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(message);
        } catch (error) {
          logger.error('Failed to send message to client', { error });
          this.clients.delete(client);
        }
      }
    });
  }
  
  /**
   * Send alert to specific clients (future enhancement)
   */
  sendToUser(userId: string, data: any): void {
    // TODO: Implement user-specific messaging
    // For now, broadcast to all
    this.broadcast(data);
  }
  
  /**
   * Cleanup resources
   */
  shutdown(): void {
    this.clients.forEach((client) => {
      client.close();
    });
    this.clients.clear();
    
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }
  }
}