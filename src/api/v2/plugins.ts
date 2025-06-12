/**
 * Plugins API v2
 * Enhanced plugin management with pagination, filtering, and detailed metadata
 */

import { Router, Response } from 'express';
import { APIVersionRequest } from '../versioning';

const router = Router();

interface Plugin {
  id: string;
  name: string;
  version: string;
  status: 'active' | 'inactive' | 'beta' | 'deprecated';
  description: string;
  capabilities: string[];
  metadata: {
    author: string;
    license: string;
    homepage?: string;
    repository?: string;
    tags: string[];
    category: string;
  };
  config: any;
  routes: string[];
  permissions: string[];
  dependencies: string[];
  createdAt: string;
  updatedAt: string;
  stats?: {
    downloads: number;
    usage: number;
    rating: number;
  };
}

interface PluginsResponse {
  data: Plugin[];
  meta: {
    apiVersion: string;
    timestamp: string;
    requestId: string;
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
    filters?: any;
  };
}

// Mock plugins data
const mockPlugins: Plugin[] = [
  {
    id: 'alfred',
    name: 'Alfred AI Assistant',
    version: '1.0.0',
    status: 'active',
    description:
      'AI-powered coding assistant and project manager with advanced code generation capabilities',
    capabilities: ['code-generation', 'project-analysis', 'documentation', 'refactoring'],
    metadata: {
      author: 'Alexandria Team',
      license: 'MIT',
      homepage: 'https://alexandria.local/plugins/alfred',
      repository: 'https://github.com/alexandria/alfred',
      tags: ['ai', 'coding', 'assistant', 'productivity'],
      category: 'development'
    },
    config: {
      aiProvider: 'ollama',
      model: 'codellama',
      maxTokens: 4096,
      temperature: 0.7,
      enableCodeCompletion: true,
      enableDocGeneration: true
    },
    routes: ['/alfred/*', '/api/*/alfred/*'],
    permissions: ['read', 'write', 'execute', 'ai:generate'],
    dependencies: ['@types/node', 'typescript', 'ollama'],
    createdAt: '2024-01-15T10:30:00Z',
    updatedAt: '2024-12-01T14:20:00Z',
    stats: {
      downloads: 1250,
      usage: 95,
      rating: 4.8
    }
  },
  {
    id: 'hadron',
    name: 'Hadron Crash Analyzer',
    version: '1.2.0',
    status: 'active',
    description:
      'Advanced crash log analysis and debugging tools with ML-powered pattern recognition',
    capabilities: ['crash-analysis', 'log-parsing', 'debugging', 'pattern-recognition'],
    metadata: {
      author: 'Alexandria Team',
      license: 'Apache-2.0',
      homepage: 'https://alexandria.local/plugins/hadron',
      repository: 'https://github.com/alexandria/hadron',
      tags: ['debugging', 'crash-analysis', 'logs', 'ml'],
      category: 'debugging'
    },
    config: {
      maxFileSize: '50MB',
      supportedFormats: ['log', 'crash', 'dump', 'minidump'],
      enableMLAnalysis: true,
      retentionDays: 30,
      alertThreshold: 10
    },
    routes: ['/crash-analyzer/*', '/api/*/hadron/*'],
    permissions: ['read', 'write', 'upload:crash-logs'],
    dependencies: ['multer', 'file-type', 'stream-parser'],
    createdAt: '2024-02-01T09:15:00Z',
    updatedAt: '2024-11-28T16:45:00Z',
    stats: {
      downloads: 890,
      usage: 78,
      rating: 4.6
    }
  },
  {
    id: 'heimdall',
    name: 'Heimdall Log Visualization',
    version: '0.9.0',
    status: 'beta',
    description: 'Real-time log visualization and monitoring with advanced filtering and alerting',
    capabilities: ['log-visualization', 'monitoring', 'alerting', 'real-time-streaming'],
    metadata: {
      author: 'Alexandria Team',
      license: 'GPL-3.0',
      homepage: 'https://alexandria.local/plugins/heimdall',
      repository: 'https://github.com/alexandria/heimdall',
      tags: ['logs', 'visualization', 'monitoring', 'real-time'],
      category: 'monitoring'
    },
    config: {
      refreshInterval: 30,
      maxLogLines: 10000,
      enableRealTimeStream: true,
      alertChannels: ['email', 'slack'],
      logRetentionHours: 168
    },
    routes: ['/heimdall/*', '/api/*/heimdall/*'],
    permissions: ['read', 'monitor:logs'],
    dependencies: ['socket.io', 'chart.js', 'moment'],
    createdAt: '2024-03-10T11:00:00Z',
    updatedAt: '2024-12-15T13:30:00Z',
    stats: {
      downloads: 340,
      usage: 45,
      rating: 4.2
    }
  }
];

// Get all plugins with enhanced filtering and pagination
router.get('/', (req: APIVersionRequest, res: Response) => {
  const requestId = (req.headers['x-request-id'] as string) || 'unknown';

  // Parse query parameters
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 10, 100); // Max 100 per page
  const status = req.query.status as string;
  const category = req.query.category as string;
  const search = req.query.search as string;
  const sortBy = (req.query.sortBy as string) || 'name';
  const sortOrder = (req.query.sortOrder as string) || 'asc';

  // Filter plugins
  let filteredPlugins = [...mockPlugins];

  if (status) {
    filteredPlugins = filteredPlugins.filter((plugin) => plugin.status === status);
  }

  if (category) {
    filteredPlugins = filteredPlugins.filter((plugin) => plugin.metadata.category === category);
  }

  if (search) {
    const searchLower = search.toLowerCase();
    filteredPlugins = filteredPlugins.filter(
      (plugin) =>
        plugin.name.toLowerCase().includes(searchLower) ||
        plugin.description.toLowerCase().includes(searchLower) ||
        plugin.metadata.tags.some((tag) => tag.toLowerCase().includes(searchLower))
    );
  }

  // Sort plugins
  filteredPlugins.sort((a, b) => {
    let aValue = a[sortBy as keyof Plugin] as any;
    let bValue = b[sortBy as keyof Plugin] as any;

    if (sortBy === 'rating') {
      aValue = a.stats?.rating || 0;
      bValue = b.stats?.rating || 0;
    } else if (sortBy === 'usage') {
      aValue = a.stats?.usage || 0;
      bValue = b.stats?.usage || 0;
    }

    if (typeof aValue === 'string') {
      aValue = aValue.toLowerCase();
      bValue = bValue.toLowerCase();
    }

    if (sortOrder === 'desc') {
      return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
    } else {
      return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
    }
  });

  // Pagination
  const total = filteredPlugins.length;
  const pages = Math.ceil(total / limit);
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  const paginatedPlugins = filteredPlugins.slice(startIndex, endIndex);

  const response: PluginsResponse = {
    data: paginatedPlugins,
    meta: {
      apiVersion: req.apiVersion,
      timestamp: new Date().toISOString(),
      requestId,
      pagination: {
        page,
        limit,
        total,
        pages,
        hasNext: page < pages,
        hasPrev: page > 1
      },
      filters: {
        status,
        category,
        search,
        sortBy,
        sortOrder
      }
    }
  };

  res.json(response);
});

// Get specific plugin with detailed information
router.get('/:pluginId', (req: APIVersionRequest, res: Response) => {
  const { pluginId } = req.params;
  const requestId = (req.headers['x-request-id'] as string) || 'unknown';

  const plugin = mockPlugins.find((p) => p.id === pluginId);

  if (!plugin) {
    return res.status(404).json({
      error: {
        code: 'PLUGIN_NOT_FOUND',
        message: `Plugin '${pluginId}' not found`,
        details: `The requested plugin does not exist or has been removed`,
        availablePlugins: mockPlugins.map((p) => ({ id: p.id, name: p.name }))
      },
      meta: {
        apiVersion: req.apiVersion,
        timestamp: new Date().toISOString(),
        requestId
      }
    });
  }

  res.json({
    data: plugin,
    meta: {
      apiVersion: req.apiVersion,
      timestamp: new Date().toISOString(),
      requestId
    }
  });
});

// Get plugin status with health metrics
router.get('/:pluginId/status', (req: APIVersionRequest, res: Response) => {
  const { pluginId } = req.params;
  const requestId = (req.headers['x-request-id'] as string) || 'unknown';

  const plugin = mockPlugins.find((p) => p.id === pluginId);

  if (!plugin) {
    return res.status(404).json({
      error: {
        code: 'PLUGIN_NOT_FOUND',
        message: `Plugin '${pluginId}' not found`
      },
      meta: {
        apiVersion: req.apiVersion,
        timestamp: new Date().toISOString(),
        requestId
      }
    });
  }

  // Mock status data with health metrics
  const statusData = {
    pluginId: plugin.id,
    name: plugin.name,
    version: plugin.version,
    status: plugin.status,
    health: {
      overall: plugin.status === 'active' ? 'healthy' : 'degraded',
      checks: [
        {
          name: 'service_availability',
          status: 'passing',
          message: 'Plugin service is responding',
          lastCheck: new Date().toISOString()
        },
        {
          name: 'dependency_check',
          status: 'passing',
          message: 'All dependencies are available',
          lastCheck: new Date().toISOString()
        },
        {
          name: 'memory_usage',
          status: plugin.id === 'heimdall' ? 'warning' : 'passing',
          message: plugin.id === 'heimdall' ? 'Memory usage is elevated' : 'Memory usage is normal',
          lastCheck: new Date().toISOString()
        }
      ]
    },
    metrics: {
      requestCount: Math.floor(Math.random() * 1000) + 100,
      errorRate: Math.random() * 0.05, // 0-5% error rate
      averageResponseTime: Math.floor(Math.random() * 100) + 50, // 50-150ms
      uptime: Math.random() * 0.02 + 0.98 // 98-100% uptime
    },
    lastActivity: new Date(Date.now() - Math.random() * 3600000).toISOString(), // Within last hour
    configuration: {
      loadedAt: plugin.updatedAt,
      configHash: 'abc123def456',
      environment: process.env.NODE_ENV || 'development'
    }
  };

  res.json({
    data: statusData,
    meta: {
      apiVersion: req.apiVersion,
      timestamp: new Date().toISOString(),
      requestId
    }
  });
});

// Get plugin categories
router.get('/categories', (req: APIVersionRequest, res: Response) => {
  const requestId = (req.headers['x-request-id'] as string) || 'unknown';

  const categories = [...new Set(mockPlugins.map((p) => p.metadata.category))].map((category) => ({
    name: category,
    count: mockPlugins.filter((p) => p.metadata.category === category).length,
    description: getCategoryDescription(category)
  }));

  res.json({
    data: categories,
    meta: {
      apiVersion: req.apiVersion,
      timestamp: new Date().toISOString(),
      requestId
    }
  });
});

function getCategoryDescription(category: string): string {
  const descriptions: { [key: string]: string } = {
    development: 'Tools and utilities for software development',
    debugging: 'Debugging and troubleshooting tools',
    monitoring: 'System and application monitoring tools'
  };
  return descriptions[category] || 'Miscellaneous tools and utilities';
}

export default router;
