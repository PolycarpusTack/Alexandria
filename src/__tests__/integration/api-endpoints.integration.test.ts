/**
 * Comprehensive API Integration Test Suite
 *
 * This test suite provides complete integration testing for all Alexandria Platform APIs,
 * testing authentication, authorization, plugin endpoints, system metrics, and error handling.
 */

import request from 'supertest';
import { Express } from 'express';
import { initializeCore } from '../../index';
import { Logger } from '../../utils/logger';
import { DataService } from '../../core/data/interfaces';
import { InMemoryDataService } from '../../core/data/in-memory-data-service';
import { AuthenticationService } from '../../core/security/interfaces';
import { User } from '../../core/system/interfaces';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('API Integration Tests', () => {
  let app: Express;
  let dataService: DataService;
  let authService: AuthenticationService;
  let mockLogger: jest.Mocked<Logger>;
  let adminToken: string;
  let userToken: string;
  let testUser: User;
  let adminUser: User;

  // Test users for different scenarios
  const testUsers = {
    admin: {
      username: 'admin',
      password: 'admin123',
      email: 'admin@test.com',
      roles: ['admin'],
      permissions: ['*']
    },
    user: {
      username: 'testuser',
      password: 'password123',
      email: 'user@test.com',
      roles: ['user'],
      permissions: ['system:read', 'logs:read']
    },
    developer: {
      username: 'developer',
      password: 'dev123',
      email: 'dev@test.com',
      roles: ['developer'],
      permissions: ['plugin:*', 'database:access', 'code:generate']
    }
  };

  beforeAll(async () => {
    // Setup test environment
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test-secret-key';
    process.env.DISABLE_RATE_LIMITING = 'true';

    // Initialize core system with in-memory data service
    dataService = new InMemoryDataService();
    await dataService.initialize();

    // Setup mock logger
    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      child: jest.fn(() => mockLogger)
    } as any;

    // Initialize the application
    const coreSystem = await initializeCore(dataService, mockLogger);
    app = coreSystem.getApp();
    authService = coreSystem.getAuthenticationService();

    // Create test users
    for (const userData of Object.values(testUsers)) {
      const user = await authService.createUser(userData);
      if (userData.username === 'testuser') testUser = user;
      if (userData.username === 'admin') adminUser = user;
    }

    // Generate auth tokens
    adminToken = await authService.generateToken(adminUser);
    userToken = await authService.generateToken(testUser);
  }, 30000);

  afterAll(async () => {
    if (dataService) {
      await dataService.shutdown();
    }
  });

  describe('Authentication Endpoints', () => {
    describe('POST /api/auth/login', () => {
      it('should authenticate valid user credentials', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            username: 'testuser',
            password: 'password123'
          })
          .expect(200);

        expect(response.body).toHaveProperty('token');
        expect(response.body).toHaveProperty('user');
        expect(response.body.user.username).toBe('testuser');
        expect(response.body.user.email).toBe('user@test.com');
        expect(response.body.user.roles).toContain('user');
        expect(response.body.user).not.toHaveProperty('password');
      });

      it('should reject invalid credentials', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            username: 'testuser',
            password: 'wrongpassword'
          })
          .expect(401);

        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toContain('Invalid credentials');
      });

      it('should reject missing username', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            password: 'password123'
          })
          .expect(400);

        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toContain('Username and password are required');
      });

      it('should reject missing password', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            username: 'testuser'
          })
          .expect(400);

        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toContain('Username and password are required');
      });

      it('should handle demo login', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            username: 'demo',
            password: 'demo'
          })
          .expect(200);

        expect(response.body).toHaveProperty('token');
        expect(response.body.user.username).toBe('demo');
      });

      it('should enforce rate limiting on auth endpoints', async () => {
        // Temporarily enable rate limiting
        delete process.env.DISABLE_RATE_LIMITING;

        // Make multiple failed login attempts
        const requests = Array(6)
          .fill(null)
          .map(() =>
            request(app).post('/api/auth/login').send({
              username: 'testuser',
              password: 'wrongpassword'
            })
          );

        const responses = await Promise.all(requests);

        // First 5 should be 401 (unauthorized), 6th should be 429 (rate limited)
        expect(responses.slice(0, 5).every((r) => r.status === 401)).toBe(true);
        expect(responses[5].status).toBe(429);

        // Re-enable for other tests
        process.env.DISABLE_RATE_LIMITING = 'true';
      });
    });

    describe('Token Validation', () => {
      it('should accept valid JWT token', async () => {
        const response = await request(app)
          .get('/api/system/metrics')
          .set('Authorization', `Bearer ${userToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('cpu');
        expect(response.body).toHaveProperty('memory');
      });

      it('should reject invalid JWT token', async () => {
        const response = await request(app)
          .get('/api/system/metrics')
          .set('Authorization', 'Bearer invalid-token')
          .expect(401);

        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toContain('Invalid token');
      });

      it('should reject missing authorization header', async () => {
        const response = await request(app).get('/api/system/metrics').expect(401);

        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toContain('Authorization header required');
      });

      it('should reject malformed authorization header', async () => {
        const response = await request(app)
          .get('/api/system/metrics')
          .set('Authorization', 'InvalidFormat token')
          .expect(401);

        expect(response.body).toHaveProperty('error');
      });
    });
  });

  describe('System Health & Metrics Endpoints', () => {
    describe('GET /api/health', () => {
      it('should return system health status', async () => {
        const response = await request(app).get('/api/health').expect(200);

        expect(response.body).toEqual({
          status: 'ok',
          version: '1.0.0'
        });
      });

      it('should not require authentication', async () => {
        const response = await request(app).get('/api/health').expect(200);

        expect(response.body.status).toBe('ok');
      });
    });

    describe('POST /api/test', () => {
      it('should echo back test data', async () => {
        const testData = { message: 'Hello World', number: 42 };

        const response = await request(app).post('/api/test').send(testData).expect(200);

        expect(response.body).toEqual({
          received: testData,
          message: 'Test successful'
        });
      });

      it('should handle empty request body', async () => {
        const response = await request(app).post('/api/test').send({}).expect(200);

        expect(response.body.received).toEqual({});
        expect(response.body.message).toBe('Test successful');
      });
    });

    describe('GET /api/system/metrics', () => {
      it('should return system metrics for authenticated user', async () => {
        const response = await request(app)
          .get('/api/system/metrics')
          .set('Authorization', `Bearer ${userToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('cpu');
        expect(response.body).toHaveProperty('memory');
        expect(response.body).toHaveProperty('disk');
        expect(response.body).toHaveProperty('network');
        expect(response.body).toHaveProperty('uptime');
        expect(response.body).toHaveProperty('timestamp');

        expect(typeof response.body.cpu).toBe('number');
        expect(typeof response.body.uptime).toBe('number');
        expect(response.body.memory).toHaveProperty('total');
        expect(response.body.memory).toHaveProperty('used');
        expect(response.body.memory).toHaveProperty('free');
      });

      it('should require authentication', async () => {
        const response = await request(app).get('/api/system/metrics').expect(401);

        expect(response.body).toHaveProperty('error');
      });
    });

    describe('GET /api/stats/summary', () => {
      it('should return platform usage statistics', async () => {
        const response = await request(app)
          .get('/api/stats/summary')
          .set('Authorization', `Bearer ${userToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('totalRequests');
        expect(response.body).toHaveProperty('totalErrors');
        expect(response.body).toHaveProperty('activeUsers');
        expect(response.body).toHaveProperty('avgResponseTime');
        expect(response.body).toHaveProperty('period');

        expect(typeof response.body.totalRequests).toBe('number');
        expect(typeof response.body.totalErrors).toBe('number');
        expect(typeof response.body.activeUsers).toBe('number');
        expect(typeof response.body.avgResponseTime).toBe('number');
      });
    });

    describe('GET /api/stats/timeline', () => {
      it('should return 24-hour timeline data', async () => {
        const response = await request(app)
          .get('/api/stats/timeline')
          .set('Authorization', `Bearer ${userToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBe(24);

        response.body.forEach((item: any) => {
          expect(item).toHaveProperty('time');
          expect(item).toHaveProperty('requests');
          expect(item).toHaveProperty('errors');
          expect(item).toHaveProperty('avgResponseTime');
          expect(typeof item.requests).toBe('number');
          expect(typeof item.errors).toBe('number');
        });
      });
    });

    describe('GET /api/plugins', () => {
      it('should return plugin status list', async () => {
        const response = await request(app)
          .get('/api/plugins')
          .set('Authorization', `Bearer ${userToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);

        response.body.forEach((plugin: any) => {
          expect(plugin).toHaveProperty('id');
          expect(plugin).toHaveProperty('name');
          expect(plugin).toHaveProperty('version');
          expect(plugin).toHaveProperty('status');
          expect(plugin).toHaveProperty('metrics');
          expect(['active', 'inactive'].includes(plugin.status)).toBe(true);
        });
      });
    });

    describe('GET /api/ai/models/status', () => {
      it('should return AI models status', async () => {
        const response = await request(app)
          .get('/api/ai/models/status')
          .set('Authorization', `Bearer ${userToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);

        response.body.forEach((model: any) => {
          expect(model).toHaveProperty('id');
          expect(model).toHaveProperty('name');
          expect(model).toHaveProperty('provider');
          expect(model).toHaveProperty('status');
          expect(model).toHaveProperty('load');
          expect(model).toHaveProperty('requestsPerHour');
          expect(['online', 'offline'].includes(model.status)).toBe(true);
          expect(typeof model.load).toBe('number');
          expect(typeof model.requestsPerHour).toBe('number');
        });
      });
    });
  });

  describe('AI Service Endpoints', () => {
    describe('GET /ai/models', () => {
      it('should return available AI models', async () => {
        const response = await request(app)
          .get('/ai/models')
          .set('Authorization', `Bearer ${userToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('models');
        expect(Array.isArray(response.body.models)).toBe(true);
      });
    });

    describe('POST /ai/complete', () => {
      it('should generate text completion', async () => {
        const response = await request(app)
          .post('/ai/complete')
          .set('Authorization', `Bearer ${userToken}`)
          .send({
            prompt: 'Hello, how are you?',
            maxTokens: 50
          })
          .expect(200);

        expect(response.body).toHaveProperty('completion');
        expect(typeof response.body.completion).toBe('string');
      });

      it('should validate required prompt field', async () => {
        const response = await request(app)
          .post('/ai/complete')
          .set('Authorization', `Bearer ${userToken}`)
          .send({
            maxTokens: 50
          })
          .expect(400);

        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toContain('prompt is required');
      });
    });

    describe('POST /ai/chat', () => {
      it('should handle chat completion', async () => {
        const response = await request(app)
          .post('/ai/chat')
          .set('Authorization', `Bearer ${userToken}`)
          .send({
            messages: [
              { role: 'user', content: 'Hello!' },
              { role: 'assistant', content: 'Hi there!' },
              { role: 'user', content: 'How can you help me?' }
            ]
          })
          .expect(200);

        expect(response.body).toHaveProperty('response');
        expect(typeof response.body.response).toBe('string');
      });

      it('should validate messages format', async () => {
        const response = await request(app)
          .post('/ai/chat')
          .set('Authorization', `Bearer ${userToken}`)
          .send({
            messages: 'invalid format'
          })
          .expect(400);

        expect(response.body).toHaveProperty('error');
      });
    });

    describe('POST /ai/embed', () => {
      it('should generate embeddings for single text', async () => {
        const response = await request(app)
          .post('/ai/embed')
          .set('Authorization', `Bearer ${userToken}`)
          .send({
            text: 'This is a test sentence for embedding.'
          })
          .expect(200);

        expect(response.body).toHaveProperty('embedding');
        expect(Array.isArray(response.body.embedding)).toBe(true);
        expect(response.body.embedding.every((n: any) => typeof n === 'number')).toBe(true);
      });

      it('should generate embeddings for multiple texts', async () => {
        const response = await request(app)
          .post('/ai/embed')
          .set('Authorization', `Bearer ${userToken}`)
          .send({
            texts: ['First sentence.', 'Second sentence.', 'Third sentence.']
          })
          .expect(200);

        expect(response.body).toHaveProperty('embeddings');
        expect(Array.isArray(response.body.embeddings)).toBe(true);
        expect(response.body.embeddings).toHaveLength(3);
        response.body.embeddings.forEach((embedding: number[]) => {
          expect(Array.isArray(embedding)).toBe(true);
          expect(embedding.every((n) => typeof n === 'number')).toBe(true);
        });
      });

      it('should require either text or texts field', async () => {
        const response = await request(app)
          .post('/ai/embed')
          .set('Authorization', `Bearer ${userToken}`)
          .send({})
          .expect(400);

        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toContain('text or texts is required');
      });
    });

    describe('GET /ai/health', () => {
      it('should return AI service health', async () => {
        const response = await request(app)
          .get('/ai/health')
          .set('Authorization', `Bearer ${userToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('healthy');
        expect(response.body).toHaveProperty('activeModels');
        expect(typeof response.body.healthy).toBe('boolean');
        expect(Array.isArray(response.body.activeModels)).toBe(true);
      });
    });
  });

  describe('Authorization & Permissions', () => {
    describe('Admin-only endpoints', () => {
      it('should allow admin access to admin endpoints', async () => {
        const response = await request(app)
          .get('/api/admin/users')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
      });

      it('should deny regular user access to admin endpoints', async () => {
        const response = await request(app)
          .get('/api/admin/users')
          .set('Authorization', `Bearer ${userToken}`)
          .expect(403);

        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toContain('Insufficient permissions');
      });
    });

    describe('Plugin management permissions', () => {
      it('should allow developer to access plugin endpoints', async () => {
        const devUser = testUsers.developer;
        const devToken = await authService.generateToken(
          await authService.authenticateUser(devUser.username, devUser.password)
        );

        const response = await request(app)
          .post('/api/plugins/install')
          .set('Authorization', `Bearer ${devToken}`)
          .send({ pluginId: 'test-plugin' })
          .expect(200);

        expect(response.body).toHaveProperty('status');
      });

      it('should deny regular user access to plugin management', async () => {
        const response = await request(app)
          .post('/api/plugins/install')
          .set('Authorization', `Bearer ${userToken}`)
          .send({ pluginId: 'test-plugin' })
          .expect(403);

        expect(response.body).toHaveProperty('error');
      });
    });
  });

  describe('Error Handling', () => {
    describe('404 Not Found', () => {
      it('should return 404 for non-existent endpoints', async () => {
        const response = await request(app)
          .get('/api/nonexistent/endpoint')
          .set('Authorization', `Bearer ${userToken}`)
          .expect(404);

        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toContain('Not found');
      });
    });

    describe('Method Not Allowed', () => {
      it('should return 405 for wrong HTTP method', async () => {
        const response = await request(app).put('/api/health').expect(405);

        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toContain('Method not allowed');
      });
    });

    describe('Content Type Validation', () => {
      it('should reject invalid content type for JSON endpoints', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .set('Content-Type', 'text/plain')
          .send('username=test&password=test')
          .expect(400);

        expect(response.body).toHaveProperty('error');
      });
    });

    describe('Request Size Limits', () => {
      it('should reject requests exceeding size limit', async () => {
        const largePayload = {
          data: 'x'.repeat(10 * 1024 * 1024) // 10MB payload
        };

        const response = await request(app).post('/api/test').send(largePayload).expect(413);

        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toContain('too large');
      });
    });

    describe('Malformed JSON', () => {
      it('should handle malformed JSON gracefully', async () => {
        const response = await request(app)
          .post('/api/test')
          .set('Content-Type', 'application/json')
          .send('{"invalid": json}')
          .expect(400);

        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toContain('Invalid JSON');
      });
    });
  });

  describe('Security Headers', () => {
    it('should include security headers in responses', async () => {
      const response = await request(app).get('/api/health').expect(200);

      // Check for security headers
      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers).toHaveProperty('x-frame-options');
      expect(response.headers).toHaveProperty('x-xss-protection');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
    });

    it('should include CORS headers', async () => {
      const response = await request(app)
        .options('/api/health')
        .set('Origin', 'http://localhost:3000')
        .expect(200);

      expect(response.headers).toHaveProperty('access-control-allow-origin');
      expect(response.headers).toHaveProperty('access-control-allow-methods');
      expect(response.headers).toHaveProperty('access-control-allow-headers');
    });

    it('should set CSP headers', async () => {
      const response = await request(app).get('/api/health').expect(200);

      expect(response.headers).toHaveProperty('content-security-policy');
      expect(response.headers['content-security-policy']).toContain("default-src 'self'");
    });
  });

  describe('Performance & Monitoring', () => {
    describe('Response Times', () => {
      it('should respond to health check quickly', async () => {
        const start = Date.now();

        await request(app).get('/api/health').expect(200);

        const duration = Date.now() - start;
        expect(duration).toBeLessThan(100); // Should be very fast
      });

      it('should handle concurrent requests efficiently', async () => {
        const requests = Array(10)
          .fill(null)
          .map(() => request(app).get('/api/health').expect(200));

        const start = Date.now();
        const responses = await Promise.all(requests);
        const duration = Date.now() - start;

        expect(responses).toHaveLength(10);
        expect(responses.every((r) => r.status === 200)).toBe(true);
        expect(duration).toBeLessThan(1000); // 10 concurrent requests in < 1 second
      });
    });

    describe('Memory Usage', () => {
      it('should not leak memory during requests', async () => {
        const initialMemory = process.memoryUsage();

        // Make many requests
        for (let i = 0; i < 100; i++) {
          await request(app).get('/api/health').expect(200);
        }

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }

        const finalMemory = process.memoryUsage();
        const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

        // Memory increase should be reasonable (less than 10MB)
        expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
      });
    });
  });

  describe('Input Validation', () => {
    describe('SQL Injection Protection', () => {
      it('should protect against SQL injection in login', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            username: "'; DROP TABLE users; --",
            password: 'password'
          })
          .expect(401);

        expect(response.body).toHaveProperty('error');
        expect(response.body.error).not.toContain('DROP TABLE');
      });
    });

    describe('XSS Protection', () => {
      it('should sanitize XSS attempts in input', async () => {
        const response = await request(app)
          .post('/api/test')
          .send({
            message: '<script>alert("xss")</script>'
          })
          .expect(200);

        const received = JSON.stringify(response.body.received);
        expect(received).not.toContain('<script>');
        expect(received).not.toContain('alert');
      });
    });

    describe('Path Traversal Protection', () => {
      it('should prevent path traversal attacks', async () => {
        const response = await request(app)
          .get('/api/files/../../../etc/passwd')
          .set('Authorization', `Bearer ${userToken}`)
          .expect(404);

        expect(response.body).toHaveProperty('error');
      });
    });
  });
});
