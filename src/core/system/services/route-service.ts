/**
 * Route Service - Handles route registration and management
 */

import { Route, Request, Response } from '../interfaces';
import { Logger } from '../../../utils/logger';
import { ConflictError, NotFoundError } from '../../errors';

export interface RouteServiceOptions {
  logger: Logger;
}

export class RouteService {
  private routes: Map<string, Route> = new Map();
  private readonly logger: Logger;

  constructor(options: RouteServiceOptions) {
    this.logger = options.logger;
  }

  /**
   * Register a route in the system
   */
  registerRoute(route: Route): void {
    const routeKey = `${route.method}:${route.path}`;
    if (this.routes.has(routeKey)) {
      throw new ConflictError('Route', `Route already registered: ${routeKey}`);
    }
    
    this.routes.set(routeKey, route);
    this.logger.debug(`Registered route: ${routeKey}`, { component: 'RouteService' });
  }

  /**
   * Remove a route from the system
   */
  removeRoute(path: string, method: string): void {
    const routeKey = `${method}:${path}`;
    if (!this.routes.has(routeKey)) {
      throw new NotFoundError('Route', routeKey);
    }
    
    this.routes.delete(routeKey);
    this.logger.debug(`Removed route: ${routeKey}`, { component: 'RouteService' });
  }

  /**
   * Get a route by path and method
   */
  getRoute(path: string, method: string): Route | undefined {
    const routeKey = `${method}:${path}`;
    return this.routes.get(routeKey);
  }

  /**
   * Get all registered routes
   */
  getAllRoutes(): Route[] {
    return Array.from(this.routes.values());
  }

  /**
   * Register core routes
   */
  registerCoreRoutes(): void {
    // Register health check route
    this.registerRoute({
      path: '/api/health',
      method: 'GET',
      handler: {
        handle: (_request: Request, response: Response) => {
          response.json({ status: 'ok', version: '0.1.0' });
        }
      }
    });

    // Register system info route
    this.registerRoute({
      path: '/api/system/info',
      method: 'GET',
      handler: {
        handle: (_request: Request, response: Response) => {
          response.json({
            name: 'Alexandria Platform',
            version: '0.1.0',
            environment: process.env.NODE_ENV || 'development',
            uptime: process.uptime()
          });
        }
      }
    });
  }

  /**
   * Clear all routes (useful for testing)
   */
  clearRoutes(): void {
    this.routes.clear();
    this.logger.debug('Cleared all routes', { component: 'RouteService' });
  }
}