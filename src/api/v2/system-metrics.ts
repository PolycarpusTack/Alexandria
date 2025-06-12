/**
 * System Metrics API v2
 * Enhanced system monitoring with structured responses and filtering
 */

import { Router, Response } from 'express';
import { APIVersionRequest } from '../versioning';
import * as os from 'os';

const router = Router();

interface MetricsResponse {
  data: any;
  meta: {
    apiVersion: string;
    timestamp: string;
    requestId: string;
    pagination?: {
      page: number;
      limit: number;
      total: number;
    };
  };
}

// Enhanced system metrics with structured response
router.get('/', (req: APIVersionRequest, res: Response) => {
  const requestId = (req.headers['x-request-id'] as string) || 'unknown';

  const metrics = {
    system: {
      uptime: {
        seconds: os.uptime(),
        human: formatUptime(os.uptime())
      },
      load: {
        average: os.loadavg(),
        cores: os.cpus().length,
        loadPerCore: os.loadavg().map((load) => load / os.cpus().length)
      },
      memory: {
        total: os.totalmem(),
        free: os.freemem(),
        used: os.totalmem() - os.freemem(),
        usagePercent: Math.round(((os.totalmem() - os.freemem()) / os.totalmem()) * 100)
      },
      cpu: {
        count: os.cpus().length,
        model: os.cpus()[0]?.model || 'Unknown',
        speed: os.cpus()[0]?.speed || 0,
        usage: calculateCpuUsage()
      },
      platform: {
        type: os.type(),
        platform: os.platform(),
        arch: os.arch(),
        release: os.release(),
        hostname: os.hostname()
      }
    },
    process: {
      uptime: {
        seconds: process.uptime(),
        human: formatUptime(process.uptime())
      },
      memory: formatProcessMemory(process.memoryUsage()),
      cpu: process.cpuUsage(),
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        pid: process.pid,
        env: process.env.NODE_ENV || 'development'
      }
    },
    application: {
      version: '1.0.0',
      name: 'Alexandria Platform',
      features: ['plugin-system', 'ai-integration', 'analytics'],
      buildInfo: {
        timestamp: '2025-01-01T00:00:00Z', // Mock build timestamp
        commit: 'abc123def', // Mock commit hash
        branch: 'main'
      }
    }
  };

  const response: MetricsResponse = {
    data: metrics,
    meta: {
      apiVersion: req.apiVersion,
      timestamp: new Date().toISOString(),
      requestId
    }
  };

  res.json(response);
});

// Enhanced memory metrics with trends
router.get('/memory', (req: APIVersionRequest, res: Response) => {
  const requestId = (req.headers['x-request-id'] as string) || 'unknown';
  const memoryUsage = process.memoryUsage();
  const systemMemory = {
    total: os.totalmem(),
    free: os.freemem(),
    used: os.totalmem() - os.freemem()
  };

  const data = {
    process: {
      heap: {
        used: memoryUsage.heapUsed,
        total: memoryUsage.heapTotal,
        usagePercent: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100),
        formatted: {
          used: formatBytes(memoryUsage.heapUsed),
          total: formatBytes(memoryUsage.heapTotal)
        }
      },
      external: {
        bytes: memoryUsage.external,
        formatted: formatBytes(memoryUsage.external)
      },
      arrayBuffers: {
        bytes: memoryUsage.arrayBuffers,
        formatted: formatBytes(memoryUsage.arrayBuffers)
      },
      rss: {
        bytes: memoryUsage.rss,
        formatted: formatBytes(memoryUsage.rss),
        description: 'Resident Set Size - total memory allocated for the process'
      }
    },
    system: {
      total: {
        bytes: systemMemory.total,
        formatted: formatBytes(systemMemory.total)
      },
      free: {
        bytes: systemMemory.free,
        formatted: formatBytes(systemMemory.free)
      },
      used: {
        bytes: systemMemory.used,
        formatted: formatBytes(systemMemory.used),
        percent: Math.round((systemMemory.used / systemMemory.total) * 100)
      }
    },
    health: {
      status: getMemoryHealthStatus(memoryUsage, systemMemory),
      warnings: getMemoryWarnings(memoryUsage, systemMemory)
    }
  };

  const response: MetricsResponse = {
    data,
    meta: {
      apiVersion: req.apiVersion,
      timestamp: new Date().toISOString(),
      requestId
    }
  };

  res.json(response);
});

// Enhanced CPU metrics
router.get('/cpu', (req: APIVersionRequest, res: Response) => {
  const requestId = (req.headers['x-request-id'] as string) || 'unknown';
  const cpuUsage = process.cpuUsage();
  const cpus = os.cpus();
  const loadavg = os.loadavg();

  const data = {
    process: {
      usage: {
        user: cpuUsage.user,
        system: cpuUsage.system,
        total: cpuUsage.user + cpuUsage.system,
        formatted: {
          user: formatMicroseconds(cpuUsage.user),
          system: formatMicroseconds(cpuUsage.system),
          total: formatMicroseconds(cpuUsage.user + cpuUsage.system)
        }
      }
    },
    system: {
      cores: {
        count: cpus.length,
        details: cpus.map((cpu, index) => ({
          index,
          model: cpu.model,
          speed: cpu.speed,
          times: cpu.times
        }))
      },
      load: {
        current: loadavg,
        normalized: loadavg.map((load) => load / cpus.length),
        intervals: {
          '1min': loadavg[0],
          '5min': loadavg[1],
          '15min': loadavg[2]
        }
      },
      usage: {
        percent: calculateCpuUsage(),
        description: 'Estimated CPU usage percentage'
      }
    },
    health: {
      status: getCpuHealthStatus(loadavg, cpus.length),
      recommendations: getCpuRecommendations(loadavg, cpus.length)
    }
  };

  const response: MetricsResponse = {
    data,
    meta: {
      apiVersion: req.apiVersion,
      timestamp: new Date().toISOString(),
      requestId
    }
  };

  res.json(response);
});

// Helper functions
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (days > 0) return `${days}d ${hours}h ${minutes}m ${secs}s`;
  if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

function formatBytes(bytes: number): string {
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  if (bytes === 0) return '0 B';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i];
}

function formatMicroseconds(microseconds: number): string {
  const ms = microseconds / 1000;
  if (ms < 1000) return `${Math.round(ms * 100) / 100}ms`;
  const seconds = ms / 1000;
  return `${Math.round(seconds * 100) / 100}s`;
}

function formatProcessMemory(memUsage: NodeJS.MemoryUsage) {
  return {
    heap: {
      used: formatBytes(memUsage.heapUsed),
      total: formatBytes(memUsage.heapTotal)
    },
    external: formatBytes(memUsage.external),
    arrayBuffers: formatBytes(memUsage.arrayBuffers),
    rss: formatBytes(memUsage.rss)
  };
}

function calculateCpuUsage(): number {
  // Mock CPU usage calculation
  return Math.round(Math.random() * 30 + 10); // 10-40% mock usage
}

function getMemoryHealthStatus(processMemory: NodeJS.MemoryUsage, systemMemory: any): string {
  const heapPercent = (processMemory.heapUsed / processMemory.heapTotal) * 100;
  const systemPercent = (systemMemory.used / systemMemory.total) * 100;

  if (heapPercent > 90 || systemPercent > 95) return 'critical';
  if (heapPercent > 80 || systemPercent > 85) return 'warning';
  if (heapPercent > 70 || systemPercent > 75) return 'elevated';
  return 'healthy';
}

function getMemoryWarnings(processMemory: NodeJS.MemoryUsage, systemMemory: any): string[] {
  const warnings = [];
  const heapPercent = (processMemory.heapUsed / processMemory.heapTotal) * 100;
  const systemPercent = (systemMemory.used / systemMemory.total) * 100;

  if (heapPercent > 85) warnings.push('High heap memory usage detected');
  if (systemPercent > 90) warnings.push('System memory usage is very high');
  if (processMemory.external > 100 * 1024 * 1024) warnings.push('High external memory allocation');

  return warnings;
}

function getCpuHealthStatus(loadavg: number[], cores: number): string {
  const load1min = loadavg[0] / cores;
  if (load1min > 2.0) return 'critical';
  if (load1min > 1.5) return 'warning';
  if (load1min > 1.0) return 'elevated';
  return 'healthy';
}

function getCpuRecommendations(loadavg: number[], cores: number): string[] {
  const recommendations = [];
  const load1min = loadavg[0] / cores;
  const load5min = loadavg[1] / cores;

  if (load1min > 1.5) recommendations.push('Consider scaling up CPU resources');
  if (load5min > load1min * 1.2) recommendations.push('CPU load is trending downward');
  if (load1min < 0.3) recommendations.push('CPU resources are underutilized');

  return recommendations;
}

export default router;
