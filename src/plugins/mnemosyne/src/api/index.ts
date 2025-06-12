/**
 * Mnemosyne API Module
 *
 * Main entry point for the comprehensive REST API layer
 * Integrates all controllers, middleware, and route configurations
 */

import { Router, Express } from 'express';
import { Logger } from '@alexandria/plugin-interface';
import { MnemosyneCore } from '../core/MnemosyneCore';
import { MnemosyneAPIRoutes } from './routes';
import { MnemosyneAPIController } from './MnemosyneAPIController';
import { APIMiddleware } from './middleware/APIMiddleware';
import { AuthenticationMiddleware } from './middleware/AuthenticationMiddleware';
import { ValidationMiddleware } from './middleware/ValidationMiddleware';
import { RateLimitMiddleware } from './middleware/RateLimitMiddleware';

export interface APIConfiguration {
  basePath?: string;
  enableDocs?: boolean;
  enableMetrics?: boolean;
  enableCors?: boolean;
  maxRequestSize?: string;
  requestTimeout?: number;
  rateLimiting?: {
    enabled: boolean;
    store?: 'memory' | 'redis';
    redis?: {
      host: string;
      port: number;
      password?: string;
    };
  };
  authentication?: {
    required: boolean;
    jwtSecret?: string;
    apiKeyHeader?: string;
  };
  logging?: {
    level: 'debug' | 'info' | 'warn' | 'error';
    includeRequestBody?: boolean;
    includeResponseBody?: boolean;
  };
}

export interface APIMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  requestsByEndpoint: Record<string, number>;
  requestsByStatusCode: Record<string, number>;
  activeConnections: number;
  rateLimitHits: number;
  authenticationFailures: number;
  lastResetTime: Date;
}

/**
 * Mnemosyne API Manager
 *
 * Central management class for the entire API layer
 * Handles initialization, configuration, and lifecycle management
 */
export class MnemosyneAPI {
  private readonly core: MnemosyneCore;
  private readonly logger: Logger;
  private readonly config: APIConfiguration;

  private router: Router;
  private routes: MnemosyneAPIRoutes;
  private controller: MnemosyneAPIController;
  private middleware: APIMiddleware;
  private authMiddleware: AuthenticationMiddleware;
  private validationMiddleware: ValidationMiddleware;
  private rateLimitMiddleware: RateLimitMiddleware;

  private metrics: APIMetrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageResponseTime: 0,
    requestsByEndpoint: {},
    requestsByStatusCode: {},
    activeConnections: 0,
    rateLimitHits: 0,
    authenticationFailures: 0,
    lastResetTime: new Date()
  };

  constructor(core: MnemosyneCore, logger: Logger, config: APIConfiguration = {}) {
    this.core = core;
    this.logger = logger.child({ component: 'MnemosyneAPI' });
    this.config = {
      basePath: '/api/mnemosyne',
      enableDocs: true,
      enableMetrics: true,
      enableCors: true,
      maxRequestSize: '10mb',
      requestTimeout: 30000,
      rateLimiting: { enabled: true, store: 'memory' },
      authentication: { required: true },
      logging: { level: 'info', includeRequestBody: false, includeResponseBody: false },
      ...config
    };

    this.initializeComponents();
  }

  /**
   * Initialize API components
   */
  private initializeComponents(): void {
    this.logger.info('Initializing Mnemosyne API components...');

    // Initialize middleware components
    this.middleware = new APIMiddleware(this.logger);
    this.authMiddleware = new AuthenticationMiddleware(this.core, this.logger);
    this.validationMiddleware = new ValidationMiddleware(this.logger);
    this.rateLimitMiddleware = new RateLimitMiddleware(this.logger);

    // Initialize controller and routes
    this.controller = new MnemosyneAPIController(this.core, this.logger);
    this.routes = new MnemosyneAPIRoutes(this.core, this.logger);

    // Get configured router
    this.router = this.routes.getRouter();

    this.logger.info('Mnemosyne API components initialized successfully');
  }

  /**
   * Mount API routes on Express application
   */
  public mount(app: Express): void {
    try {
      this.logger.info(`Mounting Mnemosyne API at ${this.config.basePath}`);

      // Apply global API middleware
      if (this.config.enableCors) {
        app.use(this.config.basePath!, this.middleware.corsHandler);
      }

      app.use(this.config.basePath!, this.middleware.requestLogger);
      app.use(this.config.basePath!, this.middleware.securityHeaders);
      app.use(this.config.basePath!, this.middleware.contentNegotiation);
      app.use(this.config.basePath!, this.middleware.requestIdInjection);

      // Apply request timeout if configured
      if (this.config.requestTimeout) {
        app.use(this.config.basePath!, this.middleware.requestTimeout(this.config.requestTimeout));
      }

      // Apply request size limiting
      if (this.config.maxRequestSize) {
        app.use(
          this.config.basePath!,
          this.middleware.requestSizeLimiter(this.config.maxRequestSize)
        );
      }

      // Mount the router
      app.use(this.config.basePath!, this.router);

      // Apply error handling middleware last
      app.use(this.config.basePath!, this.middleware.errorHandler);

      this.logger.info('Mnemosyne API mounted successfully');
    } catch (error) {
      this.logger.error('Failed to mount Mnemosyne API', { error: error.message });
      throw error;
    }
  }

  /**
   * Get API router for custom mounting
   */
  public getRouter(): Router {
    return this.router;
  }

  /**
   * Get API route definitions for documentation
   */
  public getRouteDefinitions(): any[] {
    return this.routes.getRouteDefinitions();
  }

  /**
   * Get API metrics
   */
  public getMetrics(): APIMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset API metrics
   */
  public resetMetrics(): void {
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      requestsByEndpoint: {},
      requestsByStatusCode: {},
      activeConnections: 0,
      rateLimitHits: 0,
      authenticationFailures: 0,
      lastResetTime: new Date()
    };

    this.logger.info('API metrics reset');
  }

  /**
   * Update API configuration
   */
  public updateConfiguration(newConfig: Partial<APIConfiguration>): void {
    Object.assign(this.config, newConfig);
    this.logger.info('API configuration updated', { config: newConfig });
  }

  /**
   * Get current API configuration
   */
  public getConfiguration(): APIConfiguration {
    return { ...this.config };
  }

  /**
   * Health check for the API layer
   */
  public async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    components: Record<string, boolean>;
    metrics: APIMetrics;
    uptime: number;
  }> {
    try {
      // Check core services
      const coreHealth = await this.core.getHealth();

      // Check middleware components
      const middlewareHealth = {
        authentication: true, // Would check auth service connectivity
        rateLimit: true, // Would check rate limit store connectivity
        validation: true // Always healthy for validation middleware
      };

      const allHealthy =
        Object.values(coreHealth).every((healthy) => healthy) &&
        Object.values(middlewareHealth).every((healthy) => healthy);

      return {
        status: allHealthy ? 'healthy' : 'unhealthy',
        components: {
          ...coreHealth,
          ...middlewareHealth
        },
        metrics: this.getMetrics(),
        uptime: process.uptime()
      };
    } catch (error) {
      this.logger.error('API health check failed', { error: error.message });
      return {
        status: 'unhealthy',
        components: {},
        metrics: this.getMetrics(),
        uptime: process.uptime()
      };
    }
  }

  /**
   * Generate OpenAPI specification
   */
  public generateOpenAPISpec(): any {
    return {
      openapi: '3.0.0',
      info: {
        title: 'Mnemosyne API',
        version: '1.0.0',
        description: 'Enterprise knowledge management and graph analytics API',
        contact: {
          name: 'Alexandria Platform',
          url: 'https://alexandria.app'
        },
        license: {
          name: 'MIT',
          url: 'https://opensource.org/licenses/MIT'
        }
      },
      servers: [
        {
          url: this.config.basePath,
          description: 'Mnemosyne API Server'
        }
      ],
      paths: this.generateOpenAPIPaths(),
      components: {
        securitySchemes: {
          BearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT'
          },
          ApiKeyAuth: {
            type: 'apiKey',
            in: 'header',
            name: 'X-API-Key'
          }
        },
        schemas: this.generateSchemas(),
        responses: this.generateCommonResponses()
      },
      security: [{ BearerAuth: [] }, { ApiKeyAuth: [] }],
      tags: [
        { name: 'documents', description: 'Document management operations' },
        { name: 'knowledge-graph', description: 'Knowledge graph operations' },
        { name: 'search', description: 'Search operations' },
        { name: 'algorithms', description: 'Graph algorithm operations' },
        { name: 'templates', description: 'Template management' },
        { name: 'health', description: 'Health and monitoring' }
      ]
    };
  }

  /**
   * Graceful shutdown
   */
  public async shutdown(): Promise<void> {
    try {
      this.logger.info('Shutting down Mnemosyne API...');

      // Cleanup rate limiting resources
      this.rateLimitMiddleware.destroy();

      // Save final metrics
      this.logger.info('Final API metrics', { metrics: this.getMetrics() });

      this.logger.info('Mnemosyne API shutdown complete');
    } catch (error) {
      this.logger.error('Error during API shutdown', { error: error.message });
      throw error;
    }
  }

  // Private helper methods

  private generateOpenAPIPaths(): any {
    const paths: any = {};
    const routeDefinitions = this.getRouteDefinitions();

    for (const route of routeDefinitions) {
      if (!paths[route.path]) {
        paths[route.path] = {};
      }

      paths[route.path][route.method.toLowerCase()] = {
        summary: route.description,
        tags: route.tags,
        security: route.authentication?.required ? [{ BearerAuth: [] }] : [],
        responses: {
          200: { $ref: '#/components/responses/Success' },
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
          429: { $ref: '#/components/responses/TooManyRequests' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      };
    }

    return paths;
  }

  private generateSchemas(): any {
    return {
      Document: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          title: { type: 'string' },
          content: { type: 'string' },
          contentType: { type: 'string', enum: ['markdown', 'html', 'text'] },
          status: { type: 'string', enum: ['draft', 'published', 'archived'] },
          tags: { type: 'array', items: { type: 'string' } },
          created: { type: 'string', format: 'date-time' },
          modified: { type: 'string', format: 'date-time' },
          author: { type: 'string' }
        }
      },
      KnowledgeNode: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          type: { type: 'string' },
          title: { type: 'string' },
          content: { type: 'string' },
          weight: { type: 'number', minimum: 0, maximum: 10 },
          centrality: { type: 'number' },
          tags: { type: 'array', items: { type: 'string' } },
          created: { type: 'string', format: 'date-time' },
          modified: { type: 'string', format: 'date-time' }
        }
      },
      Error: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
              details: { type: 'object' }
            }
          },
          meta: {
            type: 'object',
            properties: {
              requestId: { type: 'string' },
              timestamp: { type: 'string', format: 'date-time' }
            }
          }
        }
      }
    };
  }

  private generateCommonResponses(): any {
    return {
      Success: {
        description: 'Successful response',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean', example: true },
                data: { type: 'object' },
                meta: {
                  type: 'object',
                  properties: {
                    requestId: { type: 'string' },
                    timestamp: { type: 'string', format: 'date-time' },
                    executionTime: { type: 'number' }
                  }
                }
              }
            }
          }
        }
      },
      BadRequest: {
        description: 'Bad request',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' }
          }
        }
      },
      Unauthorized: {
        description: 'Unauthorized',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' }
          }
        }
      },
      Forbidden: {
        description: 'Forbidden',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' }
          }
        }
      },
      NotFound: {
        description: 'Not found',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' }
          }
        }
      },
      TooManyRequests: {
        description: 'Too many requests',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' }
          }
        }
      },
      InternalServerError: {
        description: 'Internal server error',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' }
          }
        }
      }
    };
  }
}

// Export all API components
export * from './MnemosyneAPIController';
export * from './routes';
export * from './middleware/APIMiddleware';
export * from './middleware/AuthenticationMiddleware';
export * from './middleware/ValidationMiddleware';
export * from './middleware/RateLimitMiddleware';

// Default export
export default MnemosyneAPI;
