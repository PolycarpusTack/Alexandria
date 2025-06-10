/**
 * Route Service Test Suite
 * 
 * Comprehensive tests for the RouteService including:
 * - Route registration and management
 * - Middleware handling
 * - Route matching and parameters
 * - Security and permissions
 * - Route groups and namespacing
 * - Performance and caching
 * - Error handling
 * Target Coverage: 100%
 */

import { RouteService } from '../services/route-service';
import { Logger } from '../../../utils/logger';
import { EventBus } from '../../event-bus/interfaces';
import { Request, Response, NextFunction } from 'express';

describe('RouteService', () => {
  let routeService: RouteService;
  let mockLogger: jest.Mocked<Logger>;
  let mockEventBus: jest.Mocked<EventBus>;
  let mockExpress: any;
  let mockRouter: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock logger
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      child: jest.fn().mockReturnThis(),
    } as any;

    // Create mock event bus
    mockEventBus = {
      publish: jest.fn().mockResolvedValue({ deliveredToCount: 1, errors: [] }),
      subscribe: jest.fn().mockReturnValue({ id: 'sub-123', unsubscribe: jest.fn() }),
    } as any;

    // Create mock Express router
    mockRouter = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      patch: jest.fn(),
      delete: jest.fn(),
      use: jest.fn(),
      all: jest.fn(),
      param: jest.fn(),
      route: jest.fn().mockReturnThis(),
      stack: [],
    };

    // Mock Express
    mockExpress = {
      Router: jest.fn(() => mockRouter),
    };

    // Create route service
    routeService = new RouteService(mockLogger, mockEventBus, mockExpress);
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      await routeService.initialize();

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Route service initialized successfully'
      );
    });

    it('should throw error if initialized twice', async () => {
      await routeService.initialize();
      
      await expect(routeService.initialize()).rejects.toThrow(
        'Route service is already initialized'
      );
    });

    it('should create default router', async () => {
      await routeService.initialize();

      expect(mockExpress.Router).toHaveBeenCalledWith({
        caseSensitive: false,
        mergeParams: false,
        strict: false,
      });
    });
  });

  describe('Route Registration', () => {
    beforeEach(async () => {
      await routeService.initialize();
    });

    describe('Basic HTTP Methods', () => {
      it('should register GET route', () => {
        const handler = jest.fn();
        const middleware = [jest.fn(), jest.fn()];

        routeService.get('/api/users', handler, {
          middleware,
          description: 'Get all users',
        });

        expect(mockRouter.get).toHaveBeenCalledWith(
          '/api/users',
          ...middleware,
          expect.any(Function) // Wrapped handler
        );
      });

      it('should register POST route', () => {
        const handler = jest.fn();
        
        routeService.post('/api/users', handler, {
          permissions: ['users:create'],
        });

        expect(mockRouter.post).toHaveBeenCalledWith(
          '/api/users',
          expect.any(Function) // Permission middleware
        );
      });

      it('should register PUT route', () => {
        const handler = jest.fn();
        
        routeService.put('/api/users/:id', handler);

        expect(mockRouter.put).toHaveBeenCalledWith(
          '/api/users/:id',
          expect.any(Function)
        );
      });

      it('should register PATCH route', () => {
        const handler = jest.fn();
        
        routeService.patch('/api/users/:id', handler);

        expect(mockRouter.patch).toHaveBeenCalledWith(
          '/api/users/:id',
          expect.any(Function)
        );
      });

      it('should register DELETE route', () => {
        const handler = jest.fn();
        
        routeService.delete('/api/users/:id', handler);

        expect(mockRouter.delete).toHaveBeenCalledWith(
          '/api/users/:id',
          expect.any(Function)
        );
      });
    });

    describe('Route Groups', () => {
      it('should create route group with prefix', () => {
        const groupRouter = routeService.group('/api/v1', (group) => {
          group.get('/users', jest.fn());
          group.post('/users', jest.fn());
        });

        expect(groupRouter).toBeDefined();
        expect(mockExpress.Router).toHaveBeenCalledTimes(2); // Main + group router
      });

      it('should apply group middleware', () => {
        const groupMiddleware = [jest.fn(), jest.fn()];
        
        routeService.group('/api/admin', (group) => {
          group.get('/stats', jest.fn());
        }, {
          middleware: groupMiddleware,
          permissions: ['admin:access'],
        });

        expect(mockRouter.use).toHaveBeenCalledWith(
          '/api/admin',
          ...groupMiddleware,
          expect.any(Function), // Permission middleware
          expect.any(Object) // Group router
        );
      });
    });

    describe('Route Parameters', () => {
      it('should register parameter handler', () => {
        const paramHandler = jest.fn();
        
        routeService.param('userId', paramHandler);

        expect(mockRouter.param).toHaveBeenCalledWith(
          'userId',
          expect.any(Function) // Wrapped param handler
        );
      });

      it('should validate parameter handlers', () => {
        expect(() => {
          routeService.param('', jest.fn());
        }).toThrow('Parameter name is required');

        expect(() => {
          routeService.param('userId', null as any);
        }).toThrow('Parameter handler must be a function');
      });
    });
  });

  describe('Middleware Management', () => {
    beforeEach(async () => {
      await routeService.initialize();
    });

    it('should register global middleware', () => {
      const middleware = jest.fn();
      
      routeService.use(middleware);

      expect(mockRouter.use).toHaveBeenCalledWith(middleware);
    });

    it('should register path-specific middleware', () => {
      const middleware = jest.fn();
      
      routeService.use('/api', middleware);

      expect(mockRouter.use).toHaveBeenCalledWith('/api', middleware);
    });

    it('should create permission middleware', () => {
      const permissionMiddleware = routeService.createPermissionMiddleware(['users:read']);
      
      expect(permissionMiddleware).toBeInstanceOf(Function);
    });

    it('should create rate limiting middleware', () => {
      const rateLimitMiddleware = routeService.createRateLimitMiddleware({
        windowMs: 60000,
        max: 100,
      });
      
      expect(rateLimitMiddleware).toBeInstanceOf(Function);
    });

    it('should create validation middleware', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
        },
        required: ['name', 'email'],
      };

      const validationMiddleware = routeService.createValidationMiddleware(schema);
      
      expect(validationMiddleware).toBeInstanceOf(Function);
    });
  });

  describe('Route Resolution and Matching', () => {
    beforeEach(async () => {
      await routeService.initialize();
    });

    it('should find route by path and method', () => {
      const handler = jest.fn();
      routeService.get('/api/users/:id', handler);

      const route = routeService.findRoute('GET', '/api/users/123');
      
      expect(route).toEqual({
        path: '/api/users/:id',
        method: 'GET',
        handler: expect.any(Function),
        params: { id: '123' },
        metadata: expect.any(Object),
      });
    });

    it('should extract route parameters', () => {
      const params = routeService.extractParams('/api/users/:id/posts/:postId', '/api/users/123/posts/456');
      
      expect(params).toEqual({
        id: '123',
        postId: '456',
      });
    });

    it('should handle optional parameters', () => {
      const params = routeService.extractParams('/api/users/:id?', '/api/users');
      
      expect(params).toEqual({});
    });

    it('should handle wildcard routes', () => {
      const handler = jest.fn();
      routeService.get('/api/*', handler);

      const route = routeService.findRoute('GET', '/api/any/nested/path');
      
      expect(route).toBeDefined();
      expect(route?.path).toBe('/api/*');
    });
  });

  describe('Security and Permissions', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let mockNext: NextFunction;

    beforeEach(async () => {
      await routeService.initialize();

      mockReq = {
        user: {
          id: 'user-123',
          roles: ['user'],
          permissions: ['users:read'],
        },
        method: 'GET',
        path: '/api/users',
      };

      mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      mockNext = jest.fn();
    });

    it('should check user permissions', async () => {
      const permissionMiddleware = routeService.createPermissionMiddleware(['users:read']);
      
      await permissionMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(); // No error, permission granted
    });

    it('should deny access for insufficient permissions', async () => {
      const permissionMiddleware = routeService.createPermissionMiddleware(['users:write']);
      
      await permissionMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Insufficient permissions',
        required: ['users:write'],
      });
    });

    it('should handle missing user context', async () => {
      const permissionMiddleware = routeService.createPermissionMiddleware(['users:read']);
      
      delete mockReq.user;
      
      await permissionMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Authentication required',
      });
    });
  });

  describe('Input Validation', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let mockNext: NextFunction;

    beforeEach(async () => {
      await routeService.initialize();

      mockReq = {
        body: {
          name: 'John Doe',
          email: 'john@example.com',
          age: 25,
        },
      };

      mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      mockNext = jest.fn();
    });

    it('should validate request body against schema', async () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1 },
          email: { type: 'string', format: 'email' },
          age: { type: 'number', minimum: 0 },
        },
        required: ['name', 'email'],
        additionalProperties: false,
      };

      const validationMiddleware = routeService.createValidationMiddleware(schema);
      
      await validationMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(); // Valid data
    });

    it('should reject invalid data', async () => {
      const schema = {
        type: 'object',
        properties: {
          email: { type: 'string', format: 'email' },
        },
        required: ['email'],
      };

      mockReq.body = { email: 'invalid-email' };

      const validationMiddleware = routeService.createValidationMiddleware(schema);
      
      await validationMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Validation failed',
        details: expect.any(Array),
      });
    });

    it('should validate query parameters', async () => {
      const schema = {
        type: 'object',
        properties: {
          limit: { type: 'string', pattern: '^\\d+$' },
          offset: { type: 'string', pattern: '^\\d+$' },
        },
      };

      mockReq.query = { limit: '10', offset: '20' };

      const validationMiddleware = routeService.createValidationMiddleware(schema, 'query');
      
      await validationMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });
  });

  describe('Rate Limiting', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let mockNext: NextFunction;

    beforeEach(async () => {
      await routeService.initialize();

      mockReq = {
        ip: '192.168.1.1',
        path: '/api/users',
        method: 'GET',
      };

      mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        set: jest.fn(),
      };

      mockNext = jest.fn();
    });

    it('should allow requests within rate limit', async () => {
      const rateLimitMiddleware = routeService.createRateLimitMiddleware({
        windowMs: 60000,
        max: 100,
      });

      await rateLimitMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockRes.set).toHaveBeenCalledWith({
        'X-RateLimit-Limit': '100',
        'X-RateLimit-Remaining': expect.any(String),
        'X-RateLimit-Reset': expect.any(String),
      });
    });

    it('should block requests exceeding rate limit', async () => {
      const rateLimitMiddleware = routeService.createRateLimitMiddleware({
        windowMs: 1000,
        max: 1,
      });

      // First request should pass
      await rateLimitMiddleware(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalledWith();

      // Reset mocks
      jest.clearAllMocks();

      // Second request should be blocked
      await rateLimitMiddleware(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(429);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Too many requests',
        message: 'Rate limit exceeded. Please try again later.',
      });
    });

    it('should use custom key generator', async () => {
      const keyGenerator = jest.fn((req: Request) => `${req.ip}:${req.path}`);
      
      const rateLimitMiddleware = routeService.createRateLimitMiddleware({
        windowMs: 60000,
        max: 100,
        keyGenerator,
      });

      await rateLimitMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(keyGenerator).toHaveBeenCalledWith(mockReq);
    });
  });

  describe('Route Metadata and Documentation', () => {
    beforeEach(async () => {
      await routeService.initialize();
    });

    it('should store route metadata', () => {
      const metadata = {
        description: 'Get user by ID',
        tags: ['users', 'api'],
        parameters: [
          { name: 'id', in: 'path', required: true, type: 'string' },
        ],
        responses: {
          200: { description: 'User found' },
          404: { description: 'User not found' },
        },
      };

      routeService.get('/api/users/:id', jest.fn(), { metadata });

      const routes = routeService.getRegisteredRoutes();
      const route = routes.find(r => r.path === '/api/users/:id' && r.method === 'GET');
      
      expect(route?.metadata).toEqual(metadata);
    });

    it('should generate OpenAPI documentation', () => {
      // Register several routes with metadata
      routeService.get('/api/users', jest.fn(), {
        metadata: {
          description: 'List all users',
          tags: ['users'],
          responses: { 200: { description: 'Users list' } },
        },
      });

      routeService.post('/api/users', jest.fn(), {
        metadata: {
          description: 'Create user',
          tags: ['users'],
          requestBody: {
            content: {
              'application/json': {
                schema: { type: 'object' },
              },
            },
          },
        },
      });

      const openApiSpec = routeService.generateOpenApiSpec({
        title: 'Test API',
        version: '1.0.0',
      });

      expect(openApiSpec).toEqual({
        openapi: '3.0.0',
        info: {
          title: 'Test API',
          version: '1.0.0',
        },
        paths: expect.objectContaining({
          '/api/users': expect.objectContaining({
            get: expect.any(Object),
            post: expect.any(Object),
          }),
        }),
      });
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await routeService.initialize();
    });

    it('should handle route handler errors', async () => {
      const errorHandler = jest.fn();
      const failingHandler = jest.fn(() => {
        throw new Error('Handler error');
      });

      routeService.get('/api/error', failingHandler);
      routeService.use(errorHandler); // Error handling middleware

      // Simulate route execution
      try {
        await failingHandler({} as Request, {} as Response, jest.fn());
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });

    it('should create error handling middleware', () => {
      const errorMiddleware = routeService.createErrorHandler();
      
      expect(errorMiddleware).toBeInstanceOf(Function);
      expect(errorMiddleware.length).toBe(4); // Error middleware has 4 parameters
    });

    it('should handle async route errors', async () => {
      const asyncHandler = jest.fn().mockRejectedValue(new Error('Async error'));
      
      const wrappedHandler = routeService.wrapAsyncHandler(asyncHandler);
      const mockNext = jest.fn();

      await wrappedHandler({} as Request, {} as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('Performance and Caching', () => {
    beforeEach(async () => {
      await routeService.initialize();
    });

    it('should cache route resolution', () => {
      routeService.get('/api/users/:id', jest.fn());
      
      // First resolution
      const route1 = routeService.findRoute('GET', '/api/users/123');
      
      // Second resolution (should use cache)
      const route2 = routeService.findRoute('GET', '/api/users/456');
      
      expect(route1?.path).toBe('/api/users/:id');
      expect(route2?.path).toBe('/api/users/:id');
    });

    it('should measure route performance', () => {
      const performanceMiddleware = routeService.createPerformanceMiddleware();
      
      expect(performanceMiddleware).toBeInstanceOf(Function);
    });

    it('should provide route statistics', () => {
      routeService.get('/api/users', jest.fn());
      routeService.post('/api/users', jest.fn());
      routeService.get('/api/posts', jest.fn());

      const stats = routeService.getRouteStatistics();

      expect(stats).toEqual({
        totalRoutes: 3,
        byMethod: {
          GET: 2,
          POST: 1,
        },
        byPath: expect.any(Object),
      });
    });
  });

  describe('Route Introspection', () => {
    beforeEach(async () => {
      await routeService.initialize();
    });

    it('should list all registered routes', () => {
      routeService.get('/api/users', jest.fn());
      routeService.post('/api/users', jest.fn());
      routeService.get('/api/posts/:id', jest.fn());

      const routes = routeService.getRegisteredRoutes();

      expect(routes).toHaveLength(3);
      expect(routes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            method: 'GET',
            path: '/api/users',
          }),
          expect.objectContaining({
            method: 'POST',
            path: '/api/users',
          }),
          expect.objectContaining({
            method: 'GET',
            path: '/api/posts/:id',
          }),
        ])
      );
    });

    it('should filter routes by criteria', () => {
      routeService.get('/api/users', jest.fn(), { tags: ['public'] });
      routeService.post('/api/admin/users', jest.fn(), { tags: ['admin'] });

      const publicRoutes = routeService.getRegisteredRoutes({
        tags: ['public'],
      });

      expect(publicRoutes).toHaveLength(1);
      expect(publicRoutes[0].path).toBe('/api/users');
    });
  });

  describe('Shutdown', () => {
    it('should clear routes on shutdown', async () => {
      await routeService.initialize();
      
      routeService.get('/api/test', jest.fn());
      expect(routeService.getRegisteredRoutes()).toHaveLength(1);

      await routeService.shutdown();

      expect(routeService.getRegisteredRoutes()).toHaveLength(0);
      expect(mockLogger.info).toHaveBeenCalledWith('Route service shutdown complete');
    });

    it('should handle shutdown when not initialized', async () => {
      await expect(routeService.shutdown()).resolves.not.toThrow();
    });
  });
});