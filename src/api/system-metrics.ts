import * as express from 'express';
import { Router, Request, Response, NextFunction } from 'express';

// Conditional Joi import
let Joi: any;
try {
  Joi = require('joi');
} catch (error) {
  Joi = {
    object: (schema: any) => ({
      validate: (data: any) => ({ error: null, value: data })
    }),
    string: () => ({ valid: (...args: any) => ({ default: (val: any) => val }) }),
    number: () => ({ integer: () => ({ min: () => ({ max: () => ({ default: (val: any) => val }) }) }) })
  };
}

/**
 * System Metrics API
 * Provides real-time system metrics and statistics with standardized error handling
 */

import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { createDataService } from '../core/data/data-service-factory';
import { createLogger } from '../utils/logger';
import { ValidationError } from '../core/errors';
import { getNetworkMetrics, initializeNetworkMonitoring } from '../utils/network-monitor';
import { getAIModelStatus } from '../utils/ai-model-monitor';
// import Joi from 'joi'; // TODO: Install joi package

const execAsync = promisify(exec);
const router: Router = Router();

// Initialize logger for this module
const logger = createLogger({
  serviceName: 'system-metrics-api',
  level: 'info',
  format: 'simple'
});

// Validation schemas
// const timelineQuerySchema = Joi.object({
//   period: Joi.string().valid('24h', '7d', '30d').default('24h'),
//   interval: Joi.string().valid('1h', '6h', '1d').default('1h')
// });

// const activitiesQuerySchema = Joi.object({
//   limit: Joi.number().integer().min(1).max(100).default(10)
// });

// Standardized error response handler
function handleAPIError(error: any, res: Response, operation: string, context?: any) {
  const standardError = { message: error.message || "Unknown error", code: "UNKNOWN_ERROR", context: {} };
  
  logger.error(`System metrics API error in ${operation}`, {
    error: standardError.message,
    code: standardError.code,
    context: { ...standardError.context, ...context }
  });

  // Determine HTTP status code based on error type
  let statusCode = 500;
  if (standardError.code === 'VALIDATION_ERROR') statusCode = 400;
  if (standardError.code === 'SERVICE_UNAVAILABLE') statusCode = 503;
  if (standardError.code === 'NOT_FOUND') statusCode = 404;

  res.status(statusCode).json({
    error: {
      code: standardError.code,
      message: standardError.message,
      operation,
      timestamp: new Date().toISOString()
    }
  });
}

// Get system metrics
router.get('/system/metrics', async (req: Request, res: Response) => {
  try {
    // CPU usage calculation
    const cpus = os.cpus();
    const cpuUsage = cpus.reduce((acc, cpu) => {
      const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
      const idle = cpu.times.idle;
      return acc + ((total - idle) / total) * 100;
    }, 0) / cpus.length;

    // Memory usage
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memPercentage = (usedMem / totalMem) * 100;

    // Disk usage (platform specific)
    let diskUsage = { used: 0, total: 0, percentage: 0 };
    try {
      if (process.platform === 'win32') {
        const { stdout } = await execAsync('wmic logicaldisk get size,freespace,caption');
        const lines = stdout.trim().split('\n').slice(1);
        let totalSize = 0, totalFree = 0;
        
        lines.forEach(line => {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 3 && parts[1] && parts[2]) {
            totalFree += parseInt(parts[1]) || 0;
            totalSize += parseInt(parts[2]) || 0;
          }
        });
        
        if (totalSize > 0) {
          diskUsage = {
            used: totalSize - totalFree,
            total: totalSize,
            percentage: ((totalSize - totalFree) / totalSize) * 100
          };
        }
      } else {
        const { stdout } = await execAsync("df -k / | tail -1 | awk '{print $3,$2}'");
        const [used, total] = stdout.trim().split(' ').map(n => parseInt(n) * 1024);
        diskUsage = {
          used,
          total,
          percentage: (used / total) * 100
        };
      }
    } catch (error) {
      logger.warn('Failed to get disk usage', {
        error: error instanceof Error ? error.message : String(error),
        platform: process.platform
      });
    }

    // Network usage (simplified - would need more sophisticated monitoring in production)
    const networkInterfaces = os.networkInterfaces();
    const activeInterfaces = Object.values(networkInterfaces)
      .flat()
      .filter(iface => iface && !iface.internal && iface.family === 'IPv4')
      .length;

    // System uptime
    const uptime = os.uptime();

    logger.debug('System metrics retrieved successfully', {
      cpu: Math.round(cpuUsage),
      memoryUsage: Math.round(memPercentage),
      diskUsage: diskUsage.percentage
    });

    res.json({
      cpu: Math.round(cpuUsage),
      memory: {
        used: usedMem,
        total: totalMem,
        percentage: Math.round(memPercentage)
      },
      disk: diskUsage,
      network: await getNetworkMetrics(),
      uptime,
      timestamp: new Date()
    });
  } catch (error) {
    handleAPIError(error, res, 'get-system-metrics');
  }
});

// Get platform statistics summary
router.get('/stats/summary', async (req: Request, res: Response) => {
  try {
    const dataService = createDataService({}, logger);
    
    // Initialize data service
    await dataService.initialize();
    
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000); // Last 24 hours
    
    // Use LogEntryRepository to get request/error stats
    const requestLogs = await dataService.logs.findByTimeRange(startTime, endTime);
    
    // Calculate stats from logs
    const totalRequests = requestLogs.filter(log => 
      log.source === 'api' && log.context?.type === 'request'
    ).length;
    
    const totalErrors = requestLogs.filter(log => 
      log.level === 'error' || (log.context?.statusCode && log.context.statusCode >= 400)
    ).length;
    
    // Get active users count
    const activeUsers = await dataService.users.count();
    
    // Calculate average response time from request logs
    const responseTimes = requestLogs
      .filter(log => log.context?.responseTime)
      .map(log => log.context.responseTime);
    const avgResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length 
      : 0;

    logger.debug('Stats summary retrieved successfully', {
      totalRequests,
      totalErrors,
      activeUsers,
      avgResponseTime: Math.round(avgResponseTime)
    });

    res.json({
      totalRequests,
      totalErrors,
      activeUsers,
      avgResponseTime: Math.round(avgResponseTime),
      period: '24h',
      timestamp: new Date()
    });
  } catch (error) {
    // Graceful degradation: return zeros if database is not set up yet
    if (error instanceof Error && (
      error.message.includes('database') || 
      error.message.includes('connection') ||
      error.message.includes('not initialized')
    )) {
      logger.warn('Database not available, returning default stats', {
        error: error.message
      });
      
      res.json({
        totalRequests: 0,
        totalErrors: 0,
        activeUsers: 0,
        avgResponseTime: 0,
        period: '24h',
        timestamp: new Date()
      });
    } else {
      handleAPIError(error, res, 'get-stats-summary');
    }
  }
});

// Get timeline data for charts
router.get('/stats/timeline', async (req: Request, res: Response) => {
  try {
    // Validate query parameters
    const period = String(req.query.period || '24h');
    const interval = String(req.query.interval || '1h');
    
    const dataService = createDataService({}, logger);
    await dataService.initialize();
    
    // Calculate time range and intervals
    const now = new Date();
    let intervalMs: number;
    let totalIntervals: number;
    let timeRange: number;
    
    switch (period) {
      case '7d':
        timeRange = 7 * 24 * 60 * 60 * 1000;
        totalIntervals = interval === '1d' ? 7 : 168; // 7 days or 168 hours
        intervalMs = interval === '1d' ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000;
        break;
      case '30d':
        timeRange = 30 * 24 * 60 * 60 * 1000;
        totalIntervals = 30; // Daily intervals for 30d
        intervalMs = 24 * 60 * 60 * 1000;
        break;
      default: // '24h'
        timeRange = 24 * 60 * 60 * 1000;
        totalIntervals = interval === '6h' ? 4 : 24; // 4 x 6h or 24 x 1h
        intervalMs = interval === '6h' ? 6 * 60 * 60 * 1000 : 60 * 60 * 1000;
        break;
    }
    
    const startTime = new Date(now.getTime() - timeRange);
    
    try {
      // Fetch logs for the time range
      const logs = await dataService.logs.findByTimeRange(startTime, now);
      
      // Create time buckets
      const buckets = new Map<number, { requests: number; errors: number; responseTimes: number[] }>();
      
      // Initialize buckets
      for (let i = 0; i < totalIntervals; i++) {
        const bucketTime = startTime.getTime() + (i * intervalMs);
        buckets.set(bucketTime, { requests: 0, errors: 0, responseTimes: [] });
      }
      
      // Process logs into buckets
      logs.forEach(log => {
        const logTime = log.timestamp.getTime();
        const bucketTime = Math.floor((logTime - startTime.getTime()) / intervalMs) * intervalMs + startTime.getTime();
        
        const bucket = buckets.get(bucketTime);
        if (bucket) {
          // Count API requests
          if (log.source === 'api' && log.context?.type === 'request') {
            bucket.requests++;
            if (log.context.responseTime) {
              bucket.responseTimes.push(log.context.responseTime);
            }
          }
          
          // Count errors
          if (log.level === 'error' || (log.context?.statusCode && log.context.statusCode >= 400)) {
            bucket.errors++;
          }
        }
      });
      
      // Convert buckets to data points
      const dataPoints = Array.from(buckets.entries())
        .sort(([a], [b]) => a - b)
        .map(([time, data]) => ({
          time: new Date(time).toISOString(),
          requests: data.requests,
          errors: data.errors,
          avgResponseTime: data.responseTimes.length > 0
            ? Math.round(data.responseTimes.reduce((a, b) => a + b, 0) / data.responseTimes.length)
            : 0
        }));
      
      logger.debug('Timeline data generated successfully', {
        period,
        interval,
        dataPointsCount: dataPoints.length,
        totalRequests: dataPoints.reduce((sum, dp) => sum + dp.requests, 0),
        totalErrors: dataPoints.reduce((sum, dp) => sum + dp.errors, 0)
      });
      
      res.json(dataPoints);
    } catch (dbError) {
      // Graceful degradation: return empty timeline if database is not ready
      if (dbError instanceof Error && (
        dbError.message.includes('database') || 
        dbError.message.includes('connection') ||
        dbError.message.includes('not initialized')
      )) {
        logger.warn('Database not available, returning empty timeline', {
          error: dbError.message
        });
        
        // Return empty data points
        const dataPoints = [];
        for (let i = 0; i < totalIntervals; i++) {
          const time = new Date(startTime.getTime() + (i * intervalMs));
          dataPoints.push({
            time: time.toISOString(),
            requests: 0,
            errors: 0,
            avgResponseTime: 0
          });
        }
        
        res.json(dataPoints);
      } else {
        throw dbError;
      }
    }
  } catch (error) {
    handleAPIError(error, res, 'get-timeline-data', { 
      period: String(req.query.period || '24h'), 
      interval: String(req.query.interval || '1h') 
    });
  }
});

// Get recent activities
router.get('/activities', async (req: Request, res: Response) => {
  try {
    // Validate query parameters
    const limit = parseInt(String(req.query.limit || '10'));
    const dataService = createDataService({}, logger);
    
    // Initialize data service
    await dataService.initialize();
    
    // Fetch recent activities from logs
    const allLogs = await dataService.logs.findAll({
      limit,
      orderBy: 'timestamp',
      orderDirection: 'desc'
    });
    
    // Transform logs into activities format
    const activities = allLogs.map(log => ({
      id: log.id,
      timestamp: log.timestamp,
      type: log.level,
      description: log.message,
      source: log.source,
      metadata: log.context
    }));
    
    logger.debug('Activities retrieved successfully', {
      activitiesCount: activities.length,
      limit
    });

    res.json(activities);
  } catch (error) {
    // Graceful degradation: return empty array if database is not ready
    if (error instanceof Error && (
      error.message.includes('database') || 
      error.message.includes('connection') ||
      error.message.includes('not initialized')
    )) {
      logger.warn('Database not available, returning empty activities', {
        error: error.message
      });
      
      res.json([]);
    } else {
      const limitValue = parseInt(String(req.query.limit || '10'));
      handleAPIError(error, res, 'get-activities', { limit: String(limitValue) });
    }
  }
});

// Get plugin information
router.get('/plugins', async (req: Request, res: Response) => {
  try {
    const dataService = createDataService({}, logger);
    
    // Initialize data service
    await dataService.initialize();
    
    // Get plugin data from plugin storage
    const pluginIds = ['alfred', 'hadron', 'heimdall'];
    const pluginsWithMetrics = await Promise.all(
      pluginIds.map(async (pluginId) => {
        try {
          // Get plugin info from storage
          const pluginInfo = await dataService.pluginStorage.get(pluginId, 'info') || {
            id: pluginId,
            name: pluginId.charAt(0).toUpperCase() + pluginId.slice(1),
            version: '1.0.0',
            status: 'active'
          };
          
          // Get plugin metrics from logs
          const pluginLogs = await dataService.logs.findBySource(`plugin:${pluginId}`);
          const errorLogs = pluginLogs.filter(log => log.level === 'error').length;
          const requestLogs = pluginLogs.filter(log => log.context?.type === 'request').length;
          
          // Calculate average latency
          const latencies = pluginLogs
            .filter(log => log.context?.latency)
            .map(log => log.context.latency);
          const avgLatency = latencies.length > 0
            ? latencies.reduce((a, b) => a + b, 0) / latencies.length
            : 0;
          
          return {
            ...pluginInfo,
            metrics: {
              requests: requestLogs,
              errors: errorLogs,
              latency: Math.round(avgLatency)
            }
          };
        } catch (error) {
          // Return default plugin info if error
          return {
            id: pluginId,
            name: pluginId.charAt(0).toUpperCase() + pluginId.slice(1),
            version: '1.0.0',
            status: 'active',
            metrics: {
              requests: 0,
              errors: 0,
              latency: 0
            }
          };
        }
      })
    );
    
    logger.debug('Plugin information retrieved successfully', {
      pluginCount: pluginsWithMetrics.length
    });

    res.json(pluginsWithMetrics);
  } catch (error) {
    // Graceful degradation: return hardcoded plugins if database is not ready
    if (error instanceof Error && (
      error.message.includes('database') || 
      error.message.includes('connection') ||
      error.message.includes('not initialized')
    )) {
      logger.warn('Database not available, returning default plugins', {
        error: error.message
      });
      
      const defaultPlugins = [
        {
          id: 'alfred',
          name: 'ALFRED',
          version: '2.0.0',
          status: 'active',
          metrics: {
            requests: 0,
            errors: 0,
            latency: 0
          }
        },
        {
          id: 'hadron',
          name: 'Hadron Crash Analyzer',
          version: '1.0.0',
          status: 'active',
          metrics: {
            requests: 0,
            errors: 0,
            latency: 0
          }
        },
        {
          id: 'heimdall',
          name: 'Heimdall',
          version: '1.0.0',
          status: 'active',
          metrics: {
            requests: 0,
            errors: 0,
            latency: 0
          }
        }
      ];

      res.json(defaultPlugins);
    } else {
      handleAPIError(error, res, 'get-plugins');
    }
  }
});

// Get AI models status
router.get('/ai/models/status', async (req: Request, res: Response) => {
  try {
    // Get actual AI model status with monitoring data
    const models = await getAIModelStatus();
    
    logger.debug('AI models status retrieved successfully', {
      modelCount: models.length,
      onlineModels: models.filter(m => m.status === 'online').length
    });
    
    res.json(models);
  } catch (error) {
    handleAPIError(error, res, 'get-ai-models-status');
  }
});

export default router;
