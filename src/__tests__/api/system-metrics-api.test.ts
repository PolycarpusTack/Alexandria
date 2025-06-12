/**
 * System Metrics API Test Suite
 *
 * Comprehensive tests for the System Metrics API including:
 * - System health endpoints
 * - Performance metrics collection
 * - Resource usage monitoring
 * - Real-time metrics streaming
 * - Historical data retrieval
 * - API authentication and authorization
 * - Rate limiting and throttling
 * - Error handling and validation
 * Target Coverage: 100%
 */

import request from 'supertest';
import express from 'express';
import { createSystemMetricsAPI } from '../../api/system-metrics';
import { Logger } from '../../utils/logger';
import { DataService } from '../../core/data/interfaces';
import { AuthenticationService } from '../../core/security/authentication-service';
import { AuthorizationService } from '../../core/security/authorization-service';

// Mock dependencies
jest.mock('../../utils/logger');
jest.mock('../../core/data/interfaces');
jest.mock('../../core/security/authentication-service');
jest.mock('../../core/security/authorization-service');

describe('System Metrics API', () => {
  let app: express.Application;
  let mockLogger: jest.Mocked<Logger>;
  let mockDataService: jest.Mocked<DataService>;
  let mockAuthService: jest.Mocked<AuthenticationService>;
  let mockAuthzService: jest.Mocked<AuthorizationService>;

  // Test data
  const mockUser = {
    id: 'user-123',
    username: 'testuser',
    roles: ['admin'],
    permissions: ['system:read', 'metrics:read']
  };

  const mockMetrics = {
    system: {
      cpuUsage: 45.2,
      memoryUsage: 68.1,
      diskUsage: 32.5,
      uptime: 86400000,
      loadAverage: [1.2, 1.1, 1.0]
    },
    application: {
      activeConnections: 150,
      requestsPerSecond: 25.5,
      responseTime: 120,
      errorRate: 0.02,
      activePlugins: 8
    },
    database: {
      connectionPool: 15,
      activeQueries: 3,
      queryResponseTime: 45,
      cacheHitRate: 0.92
    }
  };

  beforeEach(() => {
    // Create Express app
    app = express();
    app.use(express.json());

    // Setup mocks
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      child: jest.fn().mockReturnThis()
    } as any;

    mockDataService = {
      metrics: {
        create: jest.fn(),
        findByDateRange: jest.fn(),
        getLatest: jest.fn(),
        getAggregated: jest.fn()
      }
    } as any;

    mockAuthService = {
      validateToken: jest.fn(),
      getUserFromToken: jest.fn()
    } as any;

    mockAuthzService = {
      hasPermission: jest.fn(),
      hasAnyPermission: jest.fn()
    } as any;

    // Setup API routes
    const metricsAPI = createSystemMetricsAPI({
      logger: mockLogger,
      dataService: mockDataService,
      authService: mockAuthService,
      authzService: mockAuthzService
    });

    app.use('/api/metrics', metricsAPI);

    // Default auth setup
    mockAuthService.validateToken.mockResolvedValue({
      userId: mockUser.id,
      username: mockUser.username
    });
    mockAuthService.getUserFromToken.mockResolvedValue(mockUser);
    mockAuthzService.hasPermission.mockReturnValue({ granted: true });
  });

  describe('GET /api/metrics/health', () => {
    it('should return system health status', async () => {
      const response = await request(app)
        .get('/api/metrics/health')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(response.body).toEqual({
        status: 'healthy',
        timestamp: expect.any(String),
        uptime: expect.any(Number),
        version: expect.any(String),
        environment: expect.any(String),
        services: {
          database: 'healthy',
          cache: 'healthy',
          storage: 'healthy',
          plugins: 'healthy'
        }
      });
    });

    it('should return unhealthy status when services are down', async () => {
      // Mock service health checks to fail
      mockDataService.metrics.getLatest.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/metrics/health')
        .set('Authorization', 'Bearer valid-token')
        .expect(503);

      expect(response.body.status).toBe('unhealthy');
      expect(response.body.services.database).toBe('unhealthy');
    });

    it('should require authentication', async () => {
      mockAuthService.validateToken.mockRejectedValue(new Error('Invalid token'));

      await request(app)
        .get('/api/metrics/health')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    it('should require system:read permission', async () => {
      mockAuthzService.hasPermission.mockReturnValue({ granted: false });

      await request(app)
        .get('/api/metrics/health')
        .set('Authorization', 'Bearer valid-token')
        .expect(403);
    });
  });

  describe('GET /api/metrics/current', () => {
    beforeEach(() => {
      // Mock system metrics collection
      jest.spyOn(process, 'cpuUsage').mockReturnValue({ user: 1000000, system: 500000 });
      jest.spyOn(process, 'memoryUsage').mockReturnValue({
        rss: 100 * 1024 * 1024,
        heapTotal: 80 * 1024 * 1024,
        heapUsed: 60 * 1024 * 1024,
        external: 5 * 1024 * 1024,
        arrayBuffers: 2 * 1024 * 1024
      });
    });

    it('should return current system metrics', async () => {
      const response = await request(app)
        .get('/api/metrics/current')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(response.body).toEqual({
        timestamp: expect.any(String),
        system: expect.objectContaining({
          cpu: expect.any(Number),
          memory: expect.objectContaining({
            used: expect.any(Number),
            total: expect.any(Number),
            percentage: expect.any(Number)
          }),
          disk: expect.any(Object),
          uptime: expect.any(Number)
        }),
        application: expect.objectContaining({
          heap: expect.any(Object),
          connections: expect.any(Number),
          requests: expect.any(Object)
        }),
        database: expect.any(Object)
      });
    });

    it('should filter metrics by category', async () => {
      const response = await request(app)
        .get('/api/metrics/current?category=system')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(response.body).toHaveProperty('system');
      expect(response.body).not.toHaveProperty('application');
      expect(response.body).not.toHaveProperty('database');
    });

    it('should handle multiple categories', async () => {
      const response = await request(app)
        .get('/api/metrics/current?category=system,application')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(response.body).toHaveProperty('system');
      expect(response.body).toHaveProperty('application');
      expect(response.body).not.toHaveProperty('database');
    });

    it('should validate category parameter', async () => {
      await request(app)
        .get('/api/metrics/current?category=invalid')
        .set('Authorization', 'Bearer valid-token')
        .expect(400);
    });
  });

  describe('GET /api/metrics/history', () => {
    beforeEach(() => {
      const historicalData = Array.from({ length: 10 }, (_, i) => ({
        id: `metric-${i}`,
        timestamp: new Date(Date.now() - i * 60000),
        data: {
          ...mockMetrics,
          system: {
            ...mockMetrics.system,
            cpuUsage: 40 + i * 2
          }
        }
      }));

      mockDataService.metrics.findByDateRange.mockResolvedValue(historicalData);
    });

    it('should return historical metrics with default timeframe', async () => {
      const response = await request(app)
        .get('/api/metrics/history')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(response.body).toEqual({
        timeframe: '1h',
        interval: '1m',
        data: expect.arrayContaining([
          expect.objectContaining({
            timestamp: expect.any(String),
            data: expect.any(Object)
          })
        ]),
        aggregation: 'raw'
      });

      expect(mockDataService.metrics.findByDateRange).toHaveBeenCalledWith(
        expect.any(Date),
        expect.any(Date),
        expect.objectContaining({
          interval: '1m'
        })
      );
    });

    it('should support custom timeframes', async () => {
      await request(app)
        .get('/api/metrics/history?timeframe=24h&interval=5m')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(mockDataService.metrics.findByDateRange).toHaveBeenCalledWith(
        expect.any(Date),
        expect.any(Date),
        expect.objectContaining({
          interval: '5m'
        })
      );
    });

    it('should support aggregation options', async () => {
      mockDataService.metrics.getAggregated.mockResolvedValue([
        {
          timestamp: new Date(),
          avg_cpu: 45.2,
          max_cpu: 67.1,
          min_cpu: 23.4
        }
      ]);

      await request(app)
        .get('/api/metrics/history?aggregation=avg&timeframe=24h')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(mockDataService.metrics.getAggregated).toHaveBeenCalled();
    });

    it('should validate timeframe parameter', async () => {
      await request(app)
        .get('/api/metrics/history?timeframe=invalid')
        .set('Authorization', 'Bearer valid-token')
        .expect(400);
    });

    it('should validate interval parameter', async () => {
      await request(app)
        .get('/api/metrics/history?interval=30x')
        .set('Authorization', 'Bearer valid-token')
        .expect(400);
    });
  });

  describe('POST /api/metrics/custom', () => {
    it('should accept custom metrics', async () => {
      const customMetrics = {
        category: 'plugin',
        name: 'plugin-performance',
        value: 89.5,
        tags: {
          pluginId: 'test-plugin',
          version: '1.0.0'
        },
        timestamp: new Date().toISOString()
      };

      mockDataService.metrics.create.mockResolvedValue({
        id: 'custom-metric-123',
        ...customMetrics
      });

      const response = await request(app)
        .post('/api/metrics/custom')
        .set('Authorization', 'Bearer valid-token')
        .send(customMetrics)
        .expect(201);

      expect(response.body).toEqual({
        id: 'custom-metric-123',
        ...customMetrics
      });

      expect(mockDataService.metrics.create).toHaveBeenCalledWith(
        expect.objectContaining(customMetrics)
      );
    });

    it('should validate custom metric schema', async () => {
      const invalidMetric = {
        category: 'plugin',
        // Missing required 'name' field
        value: 'not-a-number',
        tags: 'invalid-tags'
      };

      await request(app)
        .post('/api/metrics/custom')
        .set('Authorization', 'Bearer valid-token')
        .send(invalidMetric)
        .expect(400);
    });

    it('should require metrics:write permission', async () => {
      mockAuthzService.hasPermission.mockImplementation((user, permission) => ({
        granted: permission !== 'metrics:write'
      }));

      await request(app)
        .post('/api/metrics/custom')
        .set('Authorization', 'Bearer valid-token')
        .send({
          category: 'test',
          name: 'test-metric',
          value: 100
        })
        .expect(403);
    });
  });

  describe('GET /api/metrics/alerts', () => {
    const mockAlerts = [
      {
        id: 'alert-1',
        type: 'threshold',
        metric: 'system.cpu',
        condition: '>',
        threshold: 80,
        value: 85.2,
        status: 'active',
        createdAt: new Date(),
        message: 'CPU usage is above 80%'
      },
      {
        id: 'alert-2',
        type: 'anomaly',
        metric: 'application.errorRate',
        status: 'resolved',
        createdAt: new Date(Date.now() - 3600000),
        resolvedAt: new Date(Date.now() - 1800000),
        message: 'Error rate anomaly detected'
      }
    ];

    beforeEach(() => {
      mockDataService.metrics.findByDateRange.mockResolvedValue(mockAlerts);
    });

    it('should return active alerts', async () => {
      const response = await request(app)
        .get('/api/metrics/alerts')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(response.body).toEqual({
        alerts: expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(String),
            type: expect.any(String),
            metric: expect.any(String),
            status: expect.any(String)
          })
        ]),
        total: expect.any(Number),
        active: expect.any(Number),
        resolved: expect.any(Number)
      });
    });

    it('should filter alerts by status', async () => {
      await request(app)
        .get('/api/metrics/alerts?status=active')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(mockDataService.metrics.findByDateRange).toHaveBeenCalledWith(
        expect.any(Date),
        expect.any(Date),
        expect.objectContaining({
          status: 'active'
        })
      );
    });

    it('should filter alerts by metric', async () => {
      await request(app)
        .get('/api/metrics/alerts?metric=system.cpu')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(mockDataService.metrics.findByDateRange).toHaveBeenCalledWith(
        expect.any(Date),
        expect.any(Date),
        expect.objectContaining({
          metric: 'system.cpu'
        })
      );
    });
  });

  describe('PUT /api/metrics/alerts/:id', () => {
    it('should acknowledge alert', async () => {
      const alertId = 'alert-123';
      mockDataService.metrics.update = jest.fn().mockResolvedValue({
        id: alertId,
        status: 'acknowledged',
        acknowledgedBy: mockUser.id,
        acknowledgedAt: new Date()
      });

      const response = await request(app)
        .put(`/api/metrics/alerts/${alertId}`)
        .set('Authorization', 'Bearer valid-token')
        .send({
          action: 'acknowledge',
          comment: 'Investigating the issue'
        })
        .expect(200);

      expect(response.body.status).toBe('acknowledged');
      expect(mockDataService.metrics.update).toHaveBeenCalledWith(
        alertId,
        expect.objectContaining({
          status: 'acknowledged',
          acknowledgedBy: mockUser.id,
          comment: 'Investigating the issue'
        })
      );
    });

    it('should resolve alert', async () => {
      const alertId = 'alert-123';
      mockDataService.metrics.update = jest.fn().mockResolvedValue({
        id: alertId,
        status: 'resolved',
        resolvedBy: mockUser.id,
        resolvedAt: new Date()
      });

      await request(app)
        .put(`/api/metrics/alerts/${alertId}`)
        .set('Authorization', 'Bearer valid-token')
        .send({
          action: 'resolve',
          resolution: 'Fixed by restarting service'
        })
        .expect(200);
    });

    it('should validate alert action', async () => {
      await request(app)
        .put('/api/metrics/alerts/alert-123')
        .set('Authorization', 'Bearer valid-token')
        .send({
          action: 'invalid-action'
        })
        .expect(400);
    });

    it('should require metrics:write permission', async () => {
      mockAuthzService.hasPermission.mockImplementation((user, permission) => ({
        granted: permission !== 'metrics:write'
      }));

      await request(app)
        .put('/api/metrics/alerts/alert-123')
        .set('Authorization', 'Bearer valid-token')
        .send({ action: 'acknowledge' })
        .expect(403);
    });
  });

  describe('WebSocket /api/metrics/stream', () => {
    let mockWebSocket: any;
    let mockServer: any;

    beforeEach(() => {
      mockWebSocket = {
        send: jest.fn(),
        close: jest.fn(),
        readyState: 1, // OPEN
        on: jest.fn()
      };

      mockServer = {
        clients: new Set([mockWebSocket]),
        on: jest.fn()
      };
    });

    it('should stream real-time metrics', (done) => {
      const metricsStream = {
        subscribe: (callback: any) => {
          // Simulate metrics updates
          setImmediate(() => {
            callback(mockMetrics);
            done();
          });
          return { unsubscribe: jest.fn() };
        }
      };

      // Test WebSocket message handling
      expect(mockWebSocket.send).toBeDefined();
    });

    it('should handle WebSocket connection errors', () => {
      mockWebSocket.readyState = 3; // CLOSED

      // Simulate error
      const errorHandler = mockWebSocket.on.mock.calls.find((call) => call[0] === 'error')?.[1];

      if (errorHandler) {
        errorHandler(new Error('Connection lost'));
      }

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('WebSocket error'),
        expect.any(Object)
      );
    });

    it('should authenticate WebSocket connections', () => {
      const messageHandler = mockWebSocket.on.mock.calls.find((call) => call[0] === 'message')?.[1];

      if (messageHandler) {
        // Test authentication message
        messageHandler(
          JSON.stringify({
            type: 'auth',
            token: 'valid-token'
          })
        );
      }

      expect(mockAuthService.validateToken).toHaveBeenCalledWith('valid-token');
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits', async () => {
      // Make multiple requests rapidly
      const requests = Array.from({ length: 100 }, () =>
        request(app).get('/api/metrics/current').set('Authorization', 'Bearer valid-token')
      );

      const responses = await Promise.allSettled(requests);
      const rateLimited = responses.filter(
        (r) => r.status === 'fulfilled' && r.value.status === 429
      );

      expect(rateLimited.length).toBeGreaterThan(0);
    });

    it('should have different limits for different endpoints', async () => {
      // Test that POST endpoints have stricter limits
      const postRequests = Array.from({ length: 20 }, () =>
        request(app).post('/api/metrics/custom').set('Authorization', 'Bearer valid-token').send({
          category: 'test',
          name: 'test-metric',
          value: 100
        })
      );

      const responses = await Promise.allSettled(postRequests);
      const rateLimited = responses.filter(
        (r) => r.status === 'fulfilled' && r.value.status === 429
      );

      // POST should be rate limited more aggressively
      expect(rateLimited.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      mockDataService.metrics.getLatest.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .get('/api/metrics/current')
        .set('Authorization', 'Bearer valid-token')
        .expect(500);

      expect(response.body).toEqual({
        error: 'Internal server error',
        message: 'Unable to retrieve metrics',
        code: 'METRICS_UNAVAILABLE'
      });

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to get current metrics'),
        expect.any(Object)
      );
    });

    it('should handle malformed requests', async () => {
      await request(app)
        .post('/api/metrics/custom')
        .set('Authorization', 'Bearer valid-token')
        .send('invalid json')
        .expect(400);
    });

    it('should handle missing authorization header', async () => {
      await request(app).get('/api/metrics/current').expect(401);
    });

    it('should handle expired tokens', async () => {
      mockAuthService.validateToken.mockRejectedValue(new Error('Token expired'));

      await request(app)
        .get('/api/metrics/current')
        .set('Authorization', 'Bearer expired-token')
        .expect(401);
    });
  });

  describe('Input Validation', () => {
    it('should validate query parameters', async () => {
      await request(app)
        .get('/api/metrics/history?timeframe=invalid&interval=bad')
        .set('Authorization', 'Bearer valid-token')
        .expect(400);
    });

    it('should validate request body schema', async () => {
      await request(app)
        .post('/api/metrics/custom')
        .set('Authorization', 'Bearer valid-token')
        .send({
          category: '', // Empty string not allowed
          name: null, // Null not allowed
          value: 'not-a-number', // Must be number
          tags: 'invalid' // Must be object
        })
        .expect(400);
    });

    it('should sanitize input data', async () => {
      const maliciousInput = {
        category: 'plugin',
        name: '<script>alert("xss")</script>',
        value: 100,
        tags: {
          description: 'Normal & <script>malicious</script> content'
        }
      };

      mockDataService.metrics.create.mockResolvedValue({
        id: 'metric-123',
        ...maliciousInput
      });

      const response = await request(app)
        .post('/api/metrics/custom')
        .set('Authorization', 'Bearer valid-token')
        .send(maliciousInput)
        .expect(201);

      // Should sanitize the script tags
      expect(response.body.name).not.toContain('<script>');
      expect(response.body.tags.description).not.toContain('<script>');
    });
  });

  describe('Performance', () => {
    it('should handle concurrent requests efficiently', async () => {
      const startTime = Date.now();

      const requests = Array.from({ length: 50 }, () =>
        request(app).get('/api/metrics/current').set('Authorization', 'Bearer valid-token')
      );

      await Promise.all(requests);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(5000); // Should complete in < 5 seconds
    });

    it('should cache frequently accessed data', async () => {
      // Make multiple requests for the same data
      await request(app)
        .get('/api/metrics/current')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      await request(app)
        .get('/api/metrics/current')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      // Should use cached data for subsequent requests within cache window
      expect(mockDataService.metrics.getLatest).toHaveBeenCalledTimes(1);
    });

    it('should handle large historical data requests', async () => {
      // Mock large dataset
      const largeDataset = Array.from({ length: 10000 }, (_, i) => ({
        id: `metric-${i}`,
        timestamp: new Date(Date.now() - i * 1000),
        data: mockMetrics
      }));

      mockDataService.metrics.findByDateRange.mockResolvedValue(largeDataset);

      const response = await request(app)
        .get('/api/metrics/history?timeframe=7d&interval=1m')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(response.body.data).toHaveLength(10000);
    });
  });
});
