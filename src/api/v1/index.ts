/**
 * API v1 Router
 * Contains all v1 API endpoints for backward compatibility
 */

import { Router, Response, NextFunction } from 'express';
import { APIVersionRequest } from '../versioning';
import authRoutes from './auth';
import healthRoutes from './health';
import systemMetricsRoutes from './system-metrics';
import pluginRoutes from './plugins';

const v1Router = Router();

// Mount v1 routes
v1Router.use('/auth', authRoutes);
v1Router.use('/health', healthRoutes);
v1Router.use('/system', systemMetricsRoutes);
v1Router.use('/plugins', pluginRoutes);

// v1 specific middleware
v1Router.use((req: APIVersionRequest, res: Response, next: NextFunction) => {
  // Add v1 specific headers or processing
  res.set('API-Version-Details', 'v1-stable');
  next();
});

export default v1Router;
