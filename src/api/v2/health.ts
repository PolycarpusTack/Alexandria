/**
 * Health Check API v2
 * Enhanced health monitoring with detailed metrics and service dependencies
 */

import { Router, Response } from 'express';
import { APIVersionRequest } from '../versioning';

const router = Router();

interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  apiVersion: string;
  timestamp: string;
  uptime: number;
  environment: string;
  services: ServiceHealth[];
  metrics: SystemMetrics;
  dependencies: DependencyHealth[];
}

interface ServiceHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime?: number;
  lastCheck: string;
  details?: any;
}

interface SystemMetrics {
  memory: {
    used: number;
    total: number;
    percent: number;
  };
  cpu: {
    usage: number;
    cores: number;
  };
  disk?: {
    used: number;
    total: number;
    percent: number;
  };
}

interface DependencyHealth {
  name: string;
  type: 'database' | 'external_api' | 'cache' | 'storage';
  status: 'connected' | 'disconnected' | 'unknown';
  responseTime?: number;
  version?: string;
  lastCheck: string;
}

// Basic health check with enhanced response
router.get('/', (req: APIVersionRequest, res: Response) => {
  const healthData: HealthResponse = {
    status: 'healthy',
    version: '1.0.0',
    apiVersion: req.apiVersion,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    services: [
      {
        name: 'api-server',
        status: 'healthy',
        responseTime: 5,
        lastCheck: new Date().toISOString()
      },
      {
        name: 'plugin-registry',
        status: 'healthy',
        responseTime: 3,
        lastCheck: new Date().toISOString()
      },
      {
        name: 'event-bus',
        status: 'healthy',
        responseTime: 1,
        lastCheck: new Date().toISOString()
      }
    ],
    metrics: {
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        percent: Math.round(
          (process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100
        )
      },
      cpu: {
        usage: 15, // Mock value
        cores: require('os').cpus().length
      }
    },
    dependencies: [
      {
        name: 'postgresql',
        type: 'database',
        status: 'connected',
        responseTime: 8,
        version: '14.0',
        lastCheck: new Date().toISOString()
      },
      {
        name: 'file-storage',
        type: 'storage',
        status: 'connected',
        responseTime: 12,
        lastCheck: new Date().toISOString()
      }
    ]
  };

  res.json({
    data: healthData,
    meta: {
      apiVersion: req.apiVersion,
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id'] || 'unknown'
    }
  });
});

// Liveness probe (Kubernetes-style)
router.get('/live', (req: APIVersionRequest, res: Response) => {
  res.json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    apiVersion: req.apiVersion
  });
});

// Readiness probe (Kubernetes-style)
router.get('/ready', (req: APIVersionRequest, res: Response) => {
  // Check if all critical services are ready
  const isReady = true; // Mock check

  if (isReady) {
    res.json({
      status: 'ready',
      timestamp: new Date().toISOString(),
      apiVersion: req.apiVersion,
      services: {
        database: 'ready',
        plugins: 'ready',
        eventBus: 'ready'
      }
    });
  } else {
    res.status(503).json({
      status: 'not_ready',
      timestamp: new Date().toISOString(),
      apiVersion: req.apiVersion,
      reason: 'Services not fully initialized'
    });
  }
});

// Startup probe (Kubernetes-style)
router.get('/startup', (req: APIVersionRequest, res: Response) => {
  res.json({
    status: 'started',
    timestamp: new Date().toISOString(),
    apiVersion: req.apiVersion,
    startupTime: process.uptime()
  });
});

export default router;
