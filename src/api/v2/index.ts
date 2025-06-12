/**
 * API v2 Router
 * Contains enhanced v2 API endpoints with improved data structures
 */

import { Router, Response, NextFunction } from 'express';
import { APIVersionRequest } from '../versioning';
import authRoutes from './auth';
import healthRoutes from './health';
import systemMetricsRoutes from './system-metrics';
import pluginRoutes from './plugins';

const v2Router = Router();

// Mount v2 routes
v2Router.use('/auth', authRoutes);
v2Router.use('/health', healthRoutes);
v2Router.use('/system', systemMetricsRoutes);
v2Router.use('/plugins', pluginRoutes);

// v2 specific middleware
v2Router.use((req: APIVersionRequest, res: Response, next: NextFunction) => {
  // Add v2 specific headers
  res.set({
    'API-Version-Details': 'v2-enhanced',
    'API-Features': 'enhanced-responses,pagination,filtering',
    'Content-Type': 'application/json; charset=utf-8'
  });
  next();
});

// v2 Error handling with enhanced error responses
v2Router.use((err: Error, req: APIVersionRequest, res: Response, next: NextFunction) => {
  const errorResponse = {
    error: {
      code: 'INTERNAL_ERROR',
      message: err.message,
      timestamp: new Date().toISOString(),
      apiVersion: req.apiVersion,
      requestId: req.headers['x-request-id'] || 'unknown'
    }
  };

  res.status(500).json(errorResponse);
});

export default v2Router;
