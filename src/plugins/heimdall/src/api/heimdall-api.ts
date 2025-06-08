/**
 * Heimdall API
 * REST and WebSocket endpoints for log intelligence platform
 */

import express, { Router, Request, Response, NextFunction } from 'express';
import { WebSocketServer } from 'ws';
import { HeimdallPluginContext } from '../interfaces';
import { HeimdallService } from '../services/heimdall-service';
import { Logger } from '@utils/logger';
import { 
  HeimdallQuery,
  HeimdallLogEntry,
  LogLevel,
  StreamOptions,
  Alert,
  SecurityPolicy,
  AggregationType
} from '../interfaces';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

// Request validation schemas
const QuerySchema = z.object({
  timeRange: z.object({
    from: z.string().transform(s => new Date(s)),
    to: z.string().transform(s => new Date(s)),
    timezone: z.string().optional()
  }),
  naturalLanguage: z.string().optional(),
  structured: z.object({
    levels: z.array(z.string()).optional(),
    sources: z.array(z.string()).optional(),
    search: z.string().optional(),
    filters: z.array(z.any()).optional(),
    aggregations: z.array(z.any()).optional(),
    correlations: z.array(z.any()).optional(),
    sort: z.array(z.any()).optional(),
    limit: z.number().min(1).max(10000).optional(),
    offset: z.number().min(0).optional()
  }).optional(),
  mlFeatures: z.object({
    similaritySearch: z.any().optional(),
    anomalyDetection: z.any().optional(),
    predictive: z.any().optional(),
    clustering: z.any().optional()
  }).optional(),
  hints: z.object({
    preferredStorage: z.enum(['hot', 'warm', 'cold']).optional(),
    cacheStrategy: z.enum(['aggressive', 'normal', 'bypass']).optional(),
    timeout: z.number().optional(),
    maxMemory: z.number().optional(),
    parallelism: z.number().optional()
  }).optional()
});

const StreamOptionsSchema = z.object({
  batchSize: z.number().min(1).max(1000).optional(),
  batchInterval: z.number().min(100).max(60000).optional(),
  includeHistorical: z.boolean().optional(),
  compression: z.boolean().optional(),
  quality: z.enum(['realtime', 'near-realtime', 'batch']).optional()
});

export class HeimdallAPI {
  private readonly context: HeimdallPluginContext;
  private readonly service: HeimdallService;
  private readonly logger: Logger;
  private router?: Router;
  private wsServer?: WebSocketServer;

  constructor(context: HeimdallPluginContext, service: HeimdallService) {
    this.context = context;
    this.service = service;
    this.logger = context.getLogger();
  }

  async registerRoutes(): Promise<void> {
    this.router = Router();
    
    // Health check
    this.router.get('/health', this.handleHealth.bind(this));
    
    // Query endpoints
    this.router.post('/query', this.validateQuery, this.handleQuery.bind(this));
    this.router.post('/query/export', this.validateQuery, this.handleExport.bind(this));
    
    // Natural language search
    this.router.post('/search', this.handleNaturalLanguageSearch.bind(this));
    
    // Saved queries
    this.router.get('/queries', this.handleListQueries.bind(this));
    this.router.get('/queries/:id', this.handleGetQuery.bind(this));
    this.router.post('/queries', this.handleSaveQuery.bind(this));
    this.router.put('/queries/:id', this.handleUpdateQuery.bind(this));
    this.router.delete('/queries/:id', this.handleDeleteQuery.bind(this));
    
    // Patterns
    this.router.get('/patterns', this.handleListPatterns.bind(this));
    this.router.post('/patterns/detect', this.handleDetectPatterns.bind(this));
    
    // Alerts
    this.router.get('/alerts', this.handleListAlerts.bind(this));
    this.router.get('/alerts/:id', this.handleGetAlert.bind(this));
    this.router.post('/alerts', this.handleCreateAlert.bind(this));
    this.router.put('/alerts/:id', this.handleUpdateAlert.bind(this));
    this.router.delete('/alerts/:id', this.handleDeleteAlert.bind(this));
    
    // ML endpoints
    this.router.post('/ml/anomalies', this.handleDetectAnomalies.bind(this));
    this.router.post('/ml/predict', this.handlePredict.bind(this));
    this.router.post('/ml/cluster', this.handleCluster.bind(this));
    
    // Storage management
    this.router.get('/storage/stats', this.handleStorageStats.bind(this));
    this.router.post('/storage/migrate', this.handleStorageMigration.bind(this));
    
    // Security policies
    this.router.get('/security/policies', this.handleListPolicies.bind(this));
    this.router.post('/security/policies', this.handleCreatePolicy.bind(this));
    
    // Register with API gateway
    await this.context.registerAPI('heimdall', this.router);
    
    // Initialize WebSocket server for streaming
    this.initializeWebSocketServer();
    
    this.logger.info('Heimdall API routes registered');
  }

  async unregisterRoutes(): Promise<void> {
    if (this.router) {
      await this.context.unregisterAPI('heimdall');
      this.router = undefined;
    }
    
    if (this.wsServer) {
      this.wsServer.close();
      this.wsServer = undefined;
    }
    
    this.logger.info('Heimdall API routes unregistered');
  }

  /**
   * Health check endpoint
   */
  private async handleHealth(req: Request, res: Response): Promise<void> {
    try {
      const health = await this.service.health();
      res.json(health);
    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Query execution endpoint
   */
  private async handleQuery(req: Request, res: Response): Promise<void> {
    try {
      const query = req.body as HeimdallQuery;
      
      // Check permissions
      await this.checkPermission(req, 'logs:read', {
        timeRange: query.timeRange,
        sources: query.structured?.sources
      });
      
      const result = await this.service.query(query);
      res.json(result);
    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Export query results
   */
  private async handleExport(req: Request, res: Response): Promise<void> {
    try {
      const query = req.body as HeimdallQuery;
      const format = req.query.format as string || 'json';
      
      await this.checkPermission(req, 'logs:export', {
        format,
        timeRange: query.timeRange
      });
      
      const result = await this.service.query(query);
      
      switch (format) {
        case 'csv':
          res.setHeader('Content-Type', 'text/csv');
          res.setHeader('Content-Disposition', 'attachment; filename=logs.csv');
          res.send(this.convertToCSV(result));
          break;
        
        case 'json':
        default:
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Content-Disposition', 'attachment; filename=logs.json');
          res.json(result);
          break;
      }
    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Natural language search
   */
  private async handleNaturalLanguageSearch(req: Request, res: Response): Promise<void> {
    try {
      const { query, timeRange } = req.body;
      
      await this.checkPermission(req, 'logs:search');
      
      // Process natural language query if ML service is available
      let heimdallQuery: HeimdallQuery;
      
      if (this.context.ml) {
        // Use ML service to process natural language
        const mlService = await this.service.getMLService();
        if (mlService) {
          heimdallQuery = await mlService.processNaturalLanguageQuery(query);
          
          // Override time range if provided
          if (timeRange) {
            heimdallQuery.timeRange = {
              from: new Date(timeRange.from),
              to: new Date(timeRange.to)
            };
          }
        } else {
          // Fallback to basic query
          heimdallQuery = {
            timeRange: {
              from: new Date(timeRange?.from || Date.now() - 3600000),
              to: new Date(timeRange?.to || Date.now())
            },
            naturalLanguage: query,
            structured: {
              search: query
            }
          };
        }
      } else {
        // No ML service, use basic search
        heimdallQuery = {
          timeRange: {
            from: new Date(timeRange?.from || Date.now() - 3600000),
            to: new Date(timeRange?.to || Date.now())
          },
          naturalLanguage: query,
          structured: {
            search: query
          }
        };
      }
      
      const result = await this.service.query(heimdallQuery);
      res.json(result);
    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Saved queries endpoints
   */
  private async handleListQueries(req: Request, res: Response): Promise<void> {
    try {
      await this.checkPermission(req, 'queries:read');
      
      const userId = (req as any).user?.id;
      const queries = await this.context.getDataService().query(
        'SELECT * FROM heimdall_queries WHERE user_id = $1 OR is_public = true ORDER BY created_at DESC',
        [userId]
      );
      
      res.json(queries);
    } catch (error) {
      this.handleError(error, res);
    }
  }

  private async handleGetQuery(req: Request, res: Response): Promise<void> {
    try {
      await this.checkPermission(req, 'queries:read');
      
      const { id } = req.params;
      const query = await this.context.getDataService().findOne(
        'heimdall_queries',
        { id }
      );
      
      if (!query) {
        res.status(404).json({ error: 'Query not found' });
        return;
      }
      
      res.json(query);
    } catch (error) {
      this.handleError(error, res);
    }
  }

  private async handleSaveQuery(req: Request, res: Response): Promise<void> {
    try {
      await this.checkPermission(req, 'queries:write');
      
      const userId = (req as any).user?.id;
      const { name, description, query, isPublic, tags } = req.body;
      
      const savedQuery = await this.context.getDataService().create('heimdall_queries', {
        user_id: userId,
        name,
        description,
        query,
        is_public: isPublic || false,
        tags: tags || [],
        ml_enhanced: !!query.mlFeatures
      });
      
      res.status(201).json(savedQuery);
    } catch (error) {
      this.handleError(error, res);
    }
  }

  private async handleUpdateQuery(req: Request, res: Response): Promise<void> {
    try {
      await this.checkPermission(req, 'queries:write');
      
      const { id } = req.params;
      const updates = req.body;
      
      const updatedQuery = await this.context.getDataService().update(
        'heimdall_queries',
        { id },
        updates
      );
      
      if (!updatedQuery) {
        res.status(404).json({ error: 'Query not found' });
        return;
      }
      
      res.json(updatedQuery);
    } catch (error) {
      this.handleError(error, res);
    }
  }

  private async handleDeleteQuery(req: Request, res: Response): Promise<void> {
    try {
      await this.checkPermission(req, 'queries:delete');
      
      const { id } = req.params;
      await this.context.getDataService().delete('heimdall_queries', { id });
      
      res.status(204).send();
    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Pattern detection endpoints
   */
  private async handleListPatterns(req: Request, res: Response): Promise<void> {
    try {
      await this.checkPermission(req, 'patterns:read');
      
      const patternDetector = this.service.getPatternDetector();
      const patterns = patternDetector.getAllPatterns();
      
      res.json(patterns);
    } catch (error) {
      this.handleError(error, res);
    }
  }

  private async handleDetectPatterns(req: Request, res: Response): Promise<void> {
    try {
      await this.checkPermission(req, 'patterns:detect');
      
      const { timeRange, minSupport, minConfidence, includeMetadata } = req.body;
      
      // Query logs in time range
      const query: HeimdallQuery = {
        timeRange: {
          from: new Date(timeRange.from),
          to: new Date(timeRange.to)
        },
        structured: {
          limit: 10000 // Limit for pattern detection
        }
      };
      
      const result = await this.service.query(query);
      
      // Detect patterns
      const patternDetector = this.service.getPatternDetector();
      const patterns = await patternDetector.detectPatterns(result.logs, {
        minSupport,
        minConfidence,
        includeMetadata
      });
      
      // Save significant patterns
      for (const pattern of patterns.filter(p => p.confidence > 0.8)) {
        await this.context.getDataService().create('heimdall_patterns', {
          id: pattern.id,
          pattern: pattern.pattern,
          type: pattern.type,
          confidence: pattern.confidence,
          support: pattern.support,
          occurrences: pattern.occurrences,
          metadata: pattern.metadata,
          created_at: new Date()
        });
      }
      
      res.json({
        patterns,
        timeRange,
        logsAnalyzed: result.logs.length
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Alert management endpoints
   */
  private async handleListAlerts(req: Request, res: Response): Promise<void> {
    try {
      await this.checkPermission(req, 'alerts:read');
      
      const alerts = await this.context.getDataService().query(
        'SELECT * FROM heimdall_alerts ORDER BY created_at DESC'
      );
      
      res.json(alerts);
    } catch (error) {
      this.handleError(error, res);
    }
  }

  private async handleGetAlert(req: Request, res: Response): Promise<void> {
    try {
      await this.checkPermission(req, 'alerts:read');
      
      const { id } = req.params;
      const alert = await this.context.getDataService().findOne(
        'heimdall_alerts',
        { id }
      );
      
      if (!alert) {
        res.status(404).json({ error: 'Alert not found' });
        return;
      }
      
      res.json(alert);
    } catch (error) {
      this.handleError(error, res);
    }
  }

  private async handleCreateAlert(req: Request, res: Response): Promise<void> {
    try {
      await this.checkPermission(req, 'alerts:write');
      
      const alert: Alert = req.body;
      
      const createdAlert = await this.context.getDataService().create('heimdall_alerts', {
        name: alert.name,
        condition: alert.condition,
        actions: alert.actions,
        schedule: alert.schedule,
        enabled: alert.enabled !== false,
        metadata: alert.metadata
      });
      
      res.status(201).json(createdAlert);
    } catch (error) {
      this.handleError(error, res);
    }
  }

  private async handleUpdateAlert(req: Request, res: Response): Promise<void> {
    try {
      await this.checkPermission(req, 'alerts:write');
      
      const { id } = req.params;
      const updates = req.body;
      
      const updatedAlert = await this.context.getDataService().update(
        'heimdall_alerts',
        { id },
        updates
      );
      
      if (!updatedAlert) {
        res.status(404).json({ error: 'Alert not found' });
        return;
      }
      
      res.json(updatedAlert);
    } catch (error) {
      this.handleError(error, res);
    }
  }

  private async handleDeleteAlert(req: Request, res: Response): Promise<void> {
    try {
      await this.checkPermission(req, 'alerts:delete');
      
      const { id } = req.params;
      await this.context.getDataService().delete('heimdall_alerts', { id });
      
      res.status(204).send();
    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * ML endpoints
   */
  private async handleDetectAnomalies(req: Request, res: Response): Promise<void> {
    try {
      await this.checkPermission(req, 'ml:anomalies');
      
      const { timeRange, sensitivity } = req.body;
      
      // TODO: Implement anomaly detection
      res.json({
        anomalies: [],
        timeRange,
        sensitivity
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  private async handlePredict(req: Request, res: Response): Promise<void> {
    try {
      await this.checkPermission(req, 'ml:predict');
      
      const { horizon, confidence } = req.body;
      
      // TODO: Implement prediction
      res.json({
        predictions: [],
        horizon,
        confidence
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  private async handleCluster(req: Request, res: Response): Promise<void> {
    try {
      await this.checkPermission(req, 'ml:cluster');
      
      const { algorithm, numClusters } = req.body;
      
      // TODO: Implement clustering
      res.json({
        clusters: [],
        algorithm,
        numClusters
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Storage management endpoints
   */
  private async handleStorageStats(req: Request, res: Response): Promise<void> {
    try {
      await this.checkPermission(req, 'storage:read');
      
      // TODO: Get storage stats from service
      res.json({
        hot: { used: 0, available: 0, documentCount: 0 },
        warm: { used: 0, available: 0, documentCount: 0 },
        cold: { used: 0, available: 0, documentCount: 0 }
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  private async handleStorageMigration(req: Request, res: Response): Promise<void> {
    try {
      await this.checkPermission(req, 'storage:admin');
      
      const { fromTier, toTier, timeRange } = req.body;
      
      // TODO: Implement storage migration
      res.json({
        status: 'initiated',
        fromTier,
        toTier,
        timeRange
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Security policy endpoints
   */
  private async handleListPolicies(req: Request, res: Response): Promise<void> {
    try {
      await this.checkPermission(req, 'security:read');
      
      // TODO: Get policies from context
      res.json([]);
    } catch (error) {
      this.handleError(error, res);
    }
  }

  private async handleCreatePolicy(req: Request, res: Response): Promise<void> {
    try {
      await this.checkPermission(req, 'security:admin');
      
      const policy: SecurityPolicy = req.body;
      
      // TODO: Create policy
      res.status(201).json(policy);
    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * WebSocket server for streaming
   */
  private initializeWebSocketServer(): void {
    this.wsServer = new WebSocketServer({ noServer: true });
    
    this.wsServer.on('connection', (ws, req) => {
      this.logger.info('WebSocket client connected');
      
      ws.on('message', async (message) => {
        try {
          const data = JSON.parse(message.toString());
          
          switch (data.type) {
            case 'subscribe':
              await this.handleStreamSubscribe(ws, data);
              break;
            
            case 'unsubscribe':
              await this.handleStreamUnsubscribe(ws, data);
              break;
            
            case 'ping':
              ws.send(JSON.stringify({ type: 'pong' }));
              break;
          }
        } catch (error) {
          ws.send(JSON.stringify({
            type: 'error',
            error: error instanceof Error ? error.message : String(error)
          }));
        }
      });
      
      ws.on('close', () => {
        this.logger.info('WebSocket client disconnected');
      });
    });
    
    // Attach to HTTP server
    this.context.getHTTPServer()?.on('upgrade', (request, socket, head) => {
      if (request.url === '/heimdall/stream') {
        this.wsServer!.handleUpgrade(request, socket, head, (ws) => {
          this.wsServer!.emit('connection', ws, request);
        });
      }
    });
  }

  private async handleStreamSubscribe(ws: any, data: any): Promise<void> {
    const query = QuerySchema.parse(data.query);
    const options = StreamOptionsSchema.parse(data.options || {});
    
    const subscription = await this.service.subscribe(query, options, (event) => {
      ws.send(JSON.stringify(event));
    });
    
    ws.send(JSON.stringify({
      type: 'subscribed',
      subscriptionId: subscription.id
    }));
  }

  private async handleStreamUnsubscribe(ws: any, data: any): Promise<void> {
    await this.service.unsubscribe(data.subscriptionId);
    
    ws.send(JSON.stringify({
      type: 'unsubscribed',
      subscriptionId: data.subscriptionId
    }));
  }

  /**
   * Validation middleware
   */
  private validateQuery(req: Request, res: Response, next: NextFunction): void {
    try {
      req.body = QuerySchema.parse(req.body);
      next();
    } catch (error) {
      res.status(400).json({
        error: 'Invalid query',
        details: error instanceof z.ZodError ? error.errors : undefined
      });
    }
  }

  /**
   * Permission checking
   */
  private async checkPermission(
    req: Request,
    action: string,
    resource?: any
  ): Promise<void> {
    const user = (req as any).user;
    
    if (!user) {
      throw new Error('Authentication required');
    }
    
    // Implement proper permission checking with resource validation
    try {
      const hasPermission = await this.context.hasPermission(user.id, action, resource);
      
      if (!hasPermission) {
        this.logger.warn('Permission denied', {
          userId: user.id,
          action,
          resource: resource ? JSON.stringify(resource) : undefined,
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });
        throw new Error(`Permission denied: ${action}`);
      }
      
      // Log successful permission check for audit
      this.logger.debug('Permission granted', {
        userId: user.id,
        action,
        resource: resource ? JSON.stringify(resource) : undefined
      });
    } catch (error) {
      this.logger.error('Permission check failed', {
        userId: user.id,
        action,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Error handling
   */
  private handleError(error: any, res: Response): void {
    this.logger.error('API error', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    
    if (error.message?.includes('Permission denied')) {
      res.status(403).json({ error: error.message });
    } else if (error.message?.includes('Authentication required')) {
      res.status(401).json({ error: error.message });
    } else if (error.message?.includes('not found')) {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Convert query results to CSV
   */
  private convertToCSV(result: any): string {
    if (!result.logs || result.logs.length === 0) {
      return '';
    }
    
    const headers = ['timestamp', 'level', 'service', 'message'];
    const rows = result.logs.map((log: any) => [
      new Date(Number(log.timestamp) / 1000000).toISOString(),
      log.level,
      log.source.service,
      log.message.raw
    ]);
    
    return [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
  }
}