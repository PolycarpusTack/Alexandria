/**
 * System Metrics API v1
 * Provides system performance and monitoring data
 */

import { Router, Response } from 'express';
import { APIVersionRequest } from '../versioning';
import * as os from 'os';

const router = Router();

// Get system metrics
router.get('/', (req: APIVersionRequest, res: Response) => {
  const metrics = {
    timestamp: new Date().toISOString(),
    apiVersion: req.apiVersion,
    system: {
      uptime: os.uptime(),
      loadavg: os.loadavg(),
      totalmem: os.totalmem(),
      freemem: os.freemem(),
      cpus: os.cpus().length,
      platform: os.platform(),
      arch: os.arch()
    },
    process: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      version: process.version,
      pid: process.pid
    },
    application: {
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0'
    }
  };

  res.json(metrics);
});

// Get memory usage details
router.get('/memory', (req: APIVersionRequest, res: Response) => {
  const memoryUsage = process.memoryUsage();
  const systemMemory = {
    total: os.totalmem(),
    free: os.freemem(),
    used: os.totalmem() - os.freemem()
  };

  res.json({
    timestamp: new Date().toISOString(),
    apiVersion: req.apiVersion,
    process: {
      heapUsed: memoryUsage.heapUsed,
      heapTotal: memoryUsage.heapTotal,
      external: memoryUsage.external,
      arrayBuffers: memoryUsage.arrayBuffers,
      rss: memoryUsage.rss
    },
    system: systemMemory,
    usage: {
      processHeapPercent: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100),
      systemMemoryPercent: Math.round((systemMemory.used / systemMemory.total) * 100)
    }
  });
});

// Get CPU usage
router.get('/cpu', (req: APIVersionRequest, res: Response) => {
  const cpuUsage = process.cpuUsage();
  const cpus = os.cpus();
  const loadavg = os.loadavg();

  res.json({
    timestamp: new Date().toISOString(),
    apiVersion: req.apiVersion,
    process: {
      user: cpuUsage.user,
      system: cpuUsage.system
    },
    system: {
      cores: cpus.length,
      model: cpus[0]?.model || 'Unknown',
      speed: cpus[0]?.speed || 0,
      loadavg: {
        '1m': loadavg[0],
        '5m': loadavg[1],
        '15m': loadavg[2]
      }
    }
  });
});

export default router;
