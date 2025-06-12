/**
 * Plugins API v1
 * Provides plugin management and information
 */

import { Router, Response } from 'express';
import { APIVersionRequest } from '../versioning';

const router = Router();

// Get all plugins
router.get('/', (req: APIVersionRequest, res: Response) => {
  // Mock plugin data for v1 API
  const plugins = [
    {
      id: 'alfred',
      name: 'Alfred AI Assistant',
      version: '1.0.0',
      status: 'active',
      description: 'AI-powered coding assistant and project manager',
      capabilities: ['code-generation', 'project-analysis', 'documentation']
    },
    {
      id: 'hadron',
      name: 'Hadron Crash Analyzer',
      version: '1.2.0',
      status: 'active',
      description: 'Advanced crash log analysis and debugging tools',
      capabilities: ['crash-analysis', 'log-parsing', 'debugging']
    },
    {
      id: 'heimdall',
      name: 'Heimdall Log Visualization',
      version: '0.9.0',
      status: 'beta',
      description: 'Real-time log visualization and monitoring',
      capabilities: ['log-visualization', 'monitoring', 'alerting']
    }
  ];

  res.json({
    apiVersion: req.apiVersion,
    timestamp: new Date().toISOString(),
    plugins,
    total: plugins.length,
    active: plugins.filter((p) => p.status === 'active').length
  });
});

// Get specific plugin
router.get('/:pluginId', (req: APIVersionRequest, res: Response) => {
  const { pluginId } = req.params;

  // Mock plugin lookup
  const plugins = {
    alfred: {
      id: 'alfred',
      name: 'Alfred AI Assistant',
      version: '1.0.0',
      status: 'active',
      description: 'AI-powered coding assistant and project manager',
      capabilities: ['code-generation', 'project-analysis', 'documentation'],
      config: {
        aiProvider: 'ollama',
        model: 'codellama',
        maxTokens: 4096
      },
      routes: ['/alfred/*'],
      permissions: ['read', 'write', 'execute']
    },
    hadron: {
      id: 'hadron',
      name: 'Hadron Crash Analyzer',
      version: '1.2.0',
      status: 'active',
      description: 'Advanced crash log analysis and debugging tools',
      capabilities: ['crash-analysis', 'log-parsing', 'debugging'],
      config: {
        maxFileSize: '50MB',
        supportedFormats: ['log', 'crash', 'dump']
      },
      routes: ['/crash-analyzer/*'],
      permissions: ['read', 'write']
    },
    heimdall: {
      id: 'heimdall',
      name: 'Heimdall Log Visualization',
      version: '0.9.0',
      status: 'beta',
      description: 'Real-time log visualization and monitoring',
      capabilities: ['log-visualization', 'monitoring', 'alerting'],
      config: {
        refreshInterval: 30,
        maxLogLines: 10000
      },
      routes: ['/heimdall/*'],
      permissions: ['read']
    }
  };

  const plugin = plugins[pluginId as keyof typeof plugins];

  if (!plugin) {
    return res.status(404).json({
      error: 'PLUGIN_NOT_FOUND',
      message: `Plugin '${pluginId}' not found`,
      availablePlugins: Object.keys(plugins)
    });
  }

  res.json({
    apiVersion: req.apiVersion,
    timestamp: new Date().toISOString(),
    plugin
  });
});

// Get plugin status
router.get('/:pluginId/status', (req: APIVersionRequest, res: Response) => {
  const { pluginId } = req.params;

  // Mock status check
  const statuses = {
    alfred: { status: 'active', health: 'healthy', lastActivity: new Date().toISOString() },
    hadron: { status: 'active', health: 'healthy', lastActivity: new Date().toISOString() },
    heimdall: { status: 'beta', health: 'warning', lastActivity: new Date().toISOString() }
  };

  const status = statuses[pluginId as keyof typeof statuses];

  if (!status) {
    return res.status(404).json({
      error: 'PLUGIN_NOT_FOUND',
      message: `Plugin '${pluginId}' not found`
    });
  }

  res.json({
    apiVersion: req.apiVersion,
    timestamp: new Date().toISOString(),
    pluginId,
    ...status
  });
});

export default router;
