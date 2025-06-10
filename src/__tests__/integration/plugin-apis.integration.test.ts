/**
 * Plugin API Integration Test Suite
 * 
 * This test suite provides comprehensive integration testing for plugin-specific APIs,
 * including Alfred, Hadron crash analyzer, file uploads, analytics, and streaming endpoints.
 */

import request from 'supertest';
import { Express } from 'express';
import { initializeCore } from '../../index';
import { Logger } from '../../utils/logger';
import { DataService } from '../../core/data/interfaces';
import { InMemoryDataService } from '../../core/data/in-memory-data-service';
import { AuthenticationService } from '../../core/security/interfaces';
import { User } from '../../core/system/interfaces';
import * as fs from 'fs';
import * as path from 'path';

describe('Plugin API Integration Tests', () => {
  let app: Express;
  let dataService: DataService;
  let authService: AuthenticationService;
  let mockLogger: jest.Mocked<Logger>;
  let userToken: string;
  let devToken: string;
  let testUser: User;
  let testDeveloper: User;
  let sessionId: string;
  let uploadedFileId: string;

  beforeAll(async () => {
    // Setup test environment
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test-secret-key';
    process.env.DISABLE_RATE_LIMITING = 'true';
    
    // Initialize core system
    dataService = new InMemoryDataService();
    await dataService.initialize();
    
    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      child: jest.fn(() => mockLogger)
    } as any;
    
    const coreSystem = await initializeCore(dataService, mockLogger);
    app = coreSystem.getApp();
    authService = coreSystem.getAuthenticationService();
    
    // Create test users
    testUser = await authService.createUser({
      username: 'testuser',
      password: 'password123',
      email: 'user@test.com',
      roles: ['user'],
      permissions: ['system:read', 'logs:read']
    });
    
    testDeveloper = await authService.createUser({
      username: 'developer',
      password: 'dev123',
      email: 'dev@test.com',
      roles: ['developer'],
      permissions: ['plugin:*', 'database:access', 'code:generate']
    });
    
    userToken = await authService.generateToken(testUser);
    devToken = await authService.generateToken(testDeveloper);
  }, 30000);

  afterAll(async () => {
    if (dataService) {
      await dataService.shutdown();
    }
  });

  describe('Alfred Plugin APIs', () => {
    describe('Session Management', () => {
      describe('POST /alfred/sessions', () => {
        it('should create new Alfred session', async () => {
          const response = await request(app)
            .post('/alfred/sessions')
            .set('Authorization', `Bearer ${userToken}`)
            .send({
              projectPath: '/test/project'
            })
            .expect(200);

          expect(response.body).toHaveProperty('id');
          expect(response.body).toHaveProperty('projectPath', '/test/project');
          expect(response.body).toHaveProperty('createdAt');
          expect(response.body).toHaveProperty('messages');
          expect(Array.isArray(response.body.messages)).toBe(true);
          
          sessionId = response.body.id; // Store for later tests
        });

        it('should create session without project path', async () => {
          const response = await request(app)
            .post('/alfred/sessions')
            .set('Authorization', `Bearer ${userToken}`)
            .send({})
            .expect(200);

          expect(response.body).toHaveProperty('id');
          expect(response.body.projectPath).toBeNull();
        });

        it('should require authentication', async () => {
          const response = await request(app)
            .post('/alfred/sessions')
            .send({})
            .expect(401);

          expect(response.body).toHaveProperty('error');
        });
      });

      describe('GET /alfred/sessions', () => {
        it('should get all user sessions', async () => {
          const response = await request(app)
            .get('/alfred/sessions')
            .set('Authorization', `Bearer ${userToken}`)
            .expect(200);

          expect(response.body).toHaveProperty('sessions');
          expect(Array.isArray(response.body.sessions)).toBe(true);
          expect(response.body.sessions.length).toBeGreaterThan(0);
          
          const session = response.body.sessions[0];
          expect(session).toHaveProperty('id');
          expect(session).toHaveProperty('createdAt');
          expect(session).toHaveProperty('messages');
        });
      });

      describe('GET /alfred/sessions/:sessionId', () => {
        it('should get specific session', async () => {
          const response = await request(app)
            .get(`/alfred/sessions/${sessionId}`)
            .set('Authorization', `Bearer ${userToken}`)
            .expect(200);

          expect(response.body).toHaveProperty('id', sessionId);
          expect(response.body).toHaveProperty('messages');
          expect(Array.isArray(response.body.messages)).toBe(true);
        });

        it('should return 404 for non-existent session', async () => {
          const response = await request(app)
            .get('/alfred/sessions/non-existent-id')
            .set('Authorization', `Bearer ${userToken}`)
            .expect(404);

          expect(response.body).toHaveProperty('error');
        });

        it('should deny access to other users sessions', async () => {
          // Create session with developer user
          const devSession = await request(app)
            .post('/alfred/sessions')
            .set('Authorization', `Bearer ${devToken}`)
            .send({})
            .expect(200);

          // Try to access with regular user
          const response = await request(app)
            .get(`/alfred/sessions/${devSession.body.id}`)
            .set('Authorization', `Bearer ${userToken}`)
            .expect(403);

          expect(response.body).toHaveProperty('error');
        });
      });

      describe('DELETE /alfred/sessions/:sessionId', () => {
        it('should delete session', async () => {
          // Create a session to delete
          const createResponse = await request(app)
            .post('/alfred/sessions')
            .set('Authorization', `Bearer ${userToken}`)
            .send({})
            .expect(200);

          const deleteResponse = await request(app)
            .delete(`/alfred/sessions/${createResponse.body.id}`)
            .set('Authorization', `Bearer ${userToken}`)
            .expect(204);

          // Verify it's deleted
          await request(app)
            .get(`/alfred/sessions/${createResponse.body.id}`)
            .set('Authorization', `Bearer ${userToken}`)
            .expect(404);
        });
      });
    });

    describe('Chat Operations', () => {
      describe('POST /alfred/sessions/:sessionId/messages', () => {
        it('should send message to session', async () => {
          const response = await request(app)
            .post(`/alfred/sessions/${sessionId}/messages`)
            .set('Authorization', `Bearer ${userToken}`)
            .send({
              content: 'Hello Alfred, can you help me with my code?'
            })
            .expect(200);

          expect(response.body).toHaveProperty('id');
          expect(response.body).toHaveProperty('content');
          expect(response.body).toHaveProperty('role');
          expect(response.body).toHaveProperty('timestamp');
          expect(response.body.role).toBe('assistant');
          expect(typeof response.body.content).toBe('string');
        });

        it('should validate message content', async () => {
          const response = await request(app)
            .post(`/alfred/sessions/${sessionId}/messages`)
            .set('Authorization', `Bearer ${userToken}`)
            .send({})
            .expect(400);

          expect(response.body).toHaveProperty('error');
          expect(response.body.error).toContain('content is required');
        });

        it('should handle long messages', async () => {
          const longMessage = 'x'.repeat(10000);
          
          const response = await request(app)
            .post(`/alfred/sessions/${sessionId}/messages`)
            .set('Authorization', `Bearer ${userToken}`)
            .send({
              content: longMessage
            })
            .expect(200);

          expect(response.body).toHaveProperty('content');
        });
      });

      describe('POST /alfred/sessions/:sessionId/stream', () => {
        it('should stream chat response', (done) => {
          const req = request(app)
            .post(`/alfred/sessions/${sessionId}/stream`)
            .set('Authorization', `Bearer ${userToken}`)
            .send({
              content: 'Write a simple hello world function'
            })
            .expect(200)
            .expect('Content-Type', /text\/event-stream/);

          let receivedData = false;
          
          req.on('data', (chunk) => {
            const data = chunk.toString();
            if (data.includes('data:')) {
              receivedData = true;
              try {
                const lines = data.split('\n').filter(line => line.startsWith('data:'));
                for (const line of lines) {
                  const jsonData = line.substring(5).trim();
                  if (jsonData && jsonData !== '[DONE]') {
                    const parsed = JSON.parse(jsonData);
                    expect(parsed).toHaveProperty('content');
                    expect(typeof parsed.content).toBe('string');
                  }
                }
              } catch (error) {
                // Ignore JSON parsing errors for partial chunks
              }
            }
          });

          req.on('end', () => {
            expect(receivedData).toBe(true);
            done();
          });

          req.on('error', done);
        });

        it('should handle stream cancellation', async () => {
          // Start a stream
          const streamReq = request(app)
            .post(`/alfred/sessions/${sessionId}/stream`)
            .set('Authorization', `Bearer ${userToken}`)
            .send({
              content: 'Generate a very long response'
            });

          // Cancel it immediately
          const cancelResponse = await request(app)
            .post(`/alfred/sessions/${sessionId}/cancel-stream`)
            .set('Authorization', `Bearer ${userToken}`)
            .expect(200);

          expect(cancelResponse.body).toEqual({
            status: 'cancelled'
          });
        });
      });
    });

    describe('Code Generation', () => {
      describe('POST /alfred/generate-code', () => {
        it('should generate code', async () => {
          const response = await request(app)
            .post('/alfred/generate-code')
            .set('Authorization', `Bearer ${devToken}`)
            .send({
              prompt: 'Create a simple React component',
              language: 'typescript',
              context: 'React functional component'
            })
            .expect(200);

          expect(response.body).toHaveProperty('code');
          expect(response.body).toHaveProperty('language');
          expect(response.body).toHaveProperty('explanation');
          expect(typeof response.body.code).toBe('string');
          expect(response.body.language).toBe('typescript');
        });

        it('should require developer permissions', async () => {
          const response = await request(app)
            .post('/alfred/generate-code')
            .set('Authorization', `Bearer ${userToken}`)
            .send({
              prompt: 'Create a function',
              language: 'javascript'
            })
            .expect(403);

          expect(response.body).toHaveProperty('error');
        });
      });

      describe('POST /alfred/stream-code', () => {
        it('should stream code generation', (done) => {
          const req = request(app)
            .post('/alfred/stream-code')
            .set('Authorization', `Bearer ${devToken}`)
            .send({
              prompt: 'Create a simple calculator function',
              language: 'python'
            })
            .expect(200)
            .expect('Content-Type', /text\/event-stream/);

          let receivedCode = false;
          
          req.on('data', (chunk) => {
            const data = chunk.toString();
            if (data.includes('data:')) {
              receivedCode = true;
              // Verify streaming format
              expect(data).toMatch(/data: {.*}/);
            }
          });

          req.on('end', () => {
            expect(receivedCode).toBe(true);
            done();
          });

          req.on('error', done);
        });
      });
    });

    describe('Project Analysis', () => {
      describe('POST /alfred/analyze-project', () => {
        it('should analyze project structure', async () => {
          const response = await request(app)
            .post('/alfred/analyze-project')
            .set('Authorization', `Bearer ${devToken}`)
            .send({
              projectPath: '/test/project'
            })
            .expect(200);

          expect(response.body).toHaveProperty('structure');
          expect(response.body).toHaveProperty('technologies');
          expect(response.body).toHaveProperty('summary');
          expect(Array.isArray(response.body.technologies)).toBe(true);
          expect(typeof response.body.summary).toBe('string');
        });

        it('should validate project path', async () => {
          const response = await request(app)
            .post('/alfred/analyze-project')
            .set('Authorization', `Bearer ${devToken}`)
            .send({})
            .expect(400);

          expect(response.body).toHaveProperty('error');
          expect(response.body.error).toContain('projectPath is required');
        });
      });
    });

    describe('GET /alfred/health', () => {
      it('should return Alfred service health', async () => {
        const response = await request(app)
          .get('/alfred/health')
          .set('Authorization', `Bearer ${userToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('status', 'healthy');
        expect(response.body).toHaveProperty('activeSessions');
        expect(response.body).toHaveProperty('activeStreams');
        expect(typeof response.body.activeSessions).toBe('number');
        expect(typeof response.body.activeStreams).toBe('number');
      });
    });
  });

  describe('Hadron Crash Analyzer APIs', () => {
    let crashLogId: string;

    describe('POST /api/crash-analyzer/upload', () => {
      it('should upload and analyze crash log', async () => {
        const crashLogContent = `
Exception in thread "main" java.lang.NullPointerException
	at com.example.MyClass.method(MyClass.java:42)
	at com.example.Main.main(Main.java:15)
        `;

        const response = await request(app)
          .post('/api/crash-analyzer/upload')
          .set('Authorization', `Bearer ${userToken}`)
          .send({
            content: crashLogContent,
            fileName: 'crash.log',
            metadata: {
              language: 'java',
              project: 'test-project'
            }
          })
          .expect(200);

        expect(response.body).toHaveProperty('logId');
        expect(response.body).toHaveProperty('analysis');
        expect(response.body.analysis).toHaveProperty('rootCause');
        expect(response.body.analysis).toHaveProperty('severity');
        expect(response.body.analysis).toHaveProperty('suggestions');
        
        crashLogId = response.body.logId;
      });

      it('should validate crash log content', async () => {
        const response = await request(app)
          .post('/api/crash-analyzer/upload')
          .set('Authorization', `Bearer ${userToken}`)
          .send({})
          .expect(400);

        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toContain('content is required');
      });
    });

    describe('GET /api/crash-analyzer/logs', () => {
      it('should get user crash logs', async () => {
        const response = await request(app)
          .get('/api/crash-analyzer/logs')
          .set('Authorization', `Bearer ${userToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBeGreaterThan(0);
        
        const log = response.body[0];
        expect(log).toHaveProperty('id');
        expect(log).toHaveProperty('fileName');
        expect(log).toHaveProperty('uploadedAt');
        expect(log).toHaveProperty('analysis');
      });
    });

    describe('GET /api/crash-analyzer/logs/:id', () => {
      it('should get specific crash log', async () => {
        const response = await request(app)
          .get(`/api/crash-analyzer/logs/${crashLogId}`)
          .set('Authorization', `Bearer ${userToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('id', crashLogId);
        expect(response.body).toHaveProperty('content');
        expect(response.body).toHaveProperty('analysis');
        expect(response.body.analysis).toHaveProperty('rootCause');
      });

      it('should return 404 for non-existent log', async () => {
        const response = await request(app)
          .get('/api/crash-analyzer/logs/non-existent')
          .set('Authorization', `Bearer ${userToken}`)
          .expect(404);

        expect(response.body).toHaveProperty('error');
      });
    });

    describe('POST /api/crash-analyzer/analyze', () => {
      it('should analyze crash log content', async () => {
        const response = await request(app)
          .post('/api/crash-analyzer/analyze')
          .set('Authorization', `Bearer ${userToken}`)
          .send({
            content: 'TypeError: Cannot read property "length" of undefined\n  at processArray (app.js:15:23)',
            metadata: {
              language: 'javascript'
            }
          })
          .expect(200);

        expect(response.body).toHaveProperty('rootCause');
        expect(response.body).toHaveProperty('severity');
        expect(response.body).toHaveProperty('suggestions');
        expect(response.body).toHaveProperty('confidence');
        expect(Array.isArray(response.body.suggestions)).toBe(true);
      });
    });

    describe('DELETE /api/crash-analyzer/logs/:id', () => {
      it('should delete owned crash log', async () => {
        const response = await request(app)
          .delete(`/api/crash-analyzer/logs/${crashLogId}`)
          .set('Authorization', `Bearer ${userToken}`)
          .expect(200);

        expect(response.body).toEqual({ success: true });

        // Verify it's deleted
        await request(app)
          .get(`/api/crash-analyzer/logs/${crashLogId}`)
          .set('Authorization', `Bearer ${userToken}`)
          .expect(404);
      });
    });
  });

  describe('Hadron Analytics APIs', () => {
    const startDate = '2024-01-01T00:00:00Z';
    const endDate = '2024-01-02T00:00:00Z';

    describe('GET /api/hadron/analytics/time-series', () => {
      it('should return time series data', async () => {
        const response = await request(app)
          .get('/api/hadron/analytics/time-series')
          .query({
            start: startDate,
            end: endDate,
            granularity: 'hour'
          })
          .set('Authorization', `Bearer ${userToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        response.body.forEach((item: any) => {
          expect(item).toHaveProperty('timestamp');
          expect(item).toHaveProperty('count');
          expect(typeof item.count).toBe('number');
        });
      });

      it('should validate required parameters', async () => {
        const response = await request(app)
          .get('/api/hadron/analytics/time-series')
          .set('Authorization', `Bearer ${userToken}`)
          .expect(400);

        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toContain('start, end, and granularity are required');
      });

      it('should validate date format', async () => {
        const response = await request(app)
          .get('/api/hadron/analytics/time-series')
          .query({
            start: 'invalid-date',
            end: endDate,
            granularity: 'hour'
          })
          .set('Authorization', `Bearer ${userToken}`)
          .expect(400);

        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toContain('Invalid date format');
      });
    });

    describe('GET /api/hadron/analytics/root-causes', () => {
      it('should return root cause distribution', async () => {
        const response = await request(app)
          .get('/api/hadron/analytics/root-causes')
          .query({
            start: startDate,
            end: endDate,
            granularity: 'day'
          })
          .set('Authorization', `Bearer ${userToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        response.body.forEach((item: any) => {
          expect(item).toHaveProperty('rootCause');
          expect(item).toHaveProperty('count');
          expect(typeof item.rootCause).toBe('string');
          expect(typeof item.count).toBe('number');
        });
      });
    });

    describe('GET /api/hadron/analytics/summary', () => {
      it('should return comprehensive analytics summary', async () => {
        const response = await request(app)
          .get('/api/hadron/analytics/summary')
          .query({
            start: startDate,
            end: endDate
          })
          .set('Authorization', `Bearer ${userToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('timeSeries');
        expect(response.body).toHaveProperty('rootCauses');
        expect(response.body).toHaveProperty('modelPerformance');
        expect(response.body).toHaveProperty('severityTrends');
        
        expect(Array.isArray(response.body.timeSeries)).toBe(true);
        expect(Array.isArray(response.body.rootCauses)).toBe(true);
      });
    });

    describe('GET /api/hadron/analytics/cache-metrics', () => {
      it('should return cache metrics', async () => {
        const response = await request(app)
          .get('/api/hadron/analytics/cache-metrics')
          .set('Authorization', `Bearer ${userToken}`)
          .expect(200);

        // Can return either cache metrics or "not enabled" message
        if (response.body.enabled) {
          expect(response.body).toHaveProperty('hitRate');
          expect(response.body).toHaveProperty('totalRequests');
          expect(response.body).toHaveProperty('cacheSize');
        } else {
          expect(response.body).toHaveProperty('message', 'Cache metrics not enabled');
        }
      });
    });
  });

  describe('File Upload APIs', () => {
    describe('POST /api/files/upload/:sessionId', () => {
      it('should upload text file', async () => {
        const testContent = 'This is a test file content';
        const buffer = Buffer.from(testContent, 'utf8');

        const response = await request(app)
          .post(`/api/files/upload/${sessionId}`)
          .set('Authorization', `Bearer ${userToken}`)
          .attach('file', buffer, 'test.txt')
          .expect(200);

        expect(response.body).toHaveProperty('fileId');
        expect(response.body).toHaveProperty('fileName', 'test.txt');
        expect(response.body).toHaveProperty('size');
        expect(response.body).toHaveProperty('mimeType');
        expect(response.body).toHaveProperty('securityScan');
        expect(response.body.securityScan).toHaveProperty('safe', true);
        
        uploadedFileId = response.body.fileId;
      });

      it('should reject large files', async () => {
        const largeBuffer = Buffer.alloc(60 * 1024 * 1024, 'x'); // 60MB

        const response = await request(app)
          .post(`/api/files/upload/${sessionId}`)
          .set('Authorization', `Bearer ${userToken}`)
          .attach('file', largeBuffer, 'large.txt')
          .expect(413);

        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toContain('File too large');
      });

      it('should reject binary files', async () => {
        const binaryBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47]); // PNG header

        const response = await request(app)
          .post(`/api/files/upload/${sessionId}`)
          .set('Authorization', `Bearer ${userToken}`)
          .attach('file', binaryBuffer, 'image.png')
          .expect(400);

        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toContain('file type not allowed');
      });

      it('should sanitize malicious filenames', async () => {
        const testContent = 'Safe content';
        const buffer = Buffer.from(testContent, 'utf8');

        const response = await request(app)
          .post(`/api/files/upload/${sessionId}`)
          .set('Authorization', `Bearer ${userToken}`)
          .attach('file', buffer, '../../malicious.txt')
          .expect(200);

        expect(response.body.fileName).not.toContain('../');
        expect(response.body.fileName).toBe('malicious.txt');
      });
    });

    describe('GET /api/files/:fileId', () => {
      it('should get file information', async () => {
        const response = await request(app)
          .get(`/api/files/${uploadedFileId}`)
          .set('Authorization', `Bearer ${userToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('id', uploadedFileId);
        expect(response.body).toHaveProperty('fileName');
        expect(response.body).toHaveProperty('size');
        expect(response.body).toHaveProperty('uploadedAt');
      });

      it('should get file with content', async () => {
        const response = await request(app)
          .get(`/api/files/${uploadedFileId}`)
          .query({ includeContent: 'true' })
          .set('Authorization', `Bearer ${userToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('content');
        expect(response.body.content).toContain('This is a test file content');
      });

      it('should return 404 for non-existent file', async () => {
        const response = await request(app)
          .get('/api/files/non-existent-id')
          .set('Authorization', `Bearer ${userToken}`)
          .expect(404);

        expect(response.body).toHaveProperty('error');
      });
    });

    describe('GET /api/files/session/:sessionId', () => {
      it('should get all files for session', async () => {
        const response = await request(app)
          .get(`/api/files/session/${sessionId}`)
          .set('Authorization', `Bearer ${userToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBeGreaterThan(0);
        
        const file = response.body[0];
        expect(file).toHaveProperty('id');
        expect(file).toHaveProperty('fileName');
        expect(file).toHaveProperty('size');
      });
    });

    describe('DELETE /api/files/:fileId', () => {
      it('should delete owned file', async () => {
        const response = await request(app)
          .delete(`/api/files/${uploadedFileId}`)
          .set('Authorization', `Bearer ${userToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);

        // Verify it's deleted
        await request(app)
          .get(`/api/files/${uploadedFileId}`)
          .set('Authorization', `Bearer ${userToken}`)
          .expect(404);
      });
    });
  });

  describe('Storage Service APIs', () => {
    let documentId: string;
    let vectorId: string;

    describe('Document Operations', () => {
      describe('POST /storage/documents', () => {
        it('should index document', async () => {
          const response = await request(app)
            .post('/storage/documents')
            .set('Authorization', `Bearer ${userToken}`)
            .send({
              title: 'Test Document',
              content: 'This is a test document for search indexing',
              tags: ['test', 'document'],
              metadata: {
                author: 'Test User',
                type: 'text'
              }
            })
            .expect(200);

          expect(response.body).toHaveProperty('id');
          expect(response.body).toHaveProperty('title', 'Test Document');
          expect(response.body).toHaveProperty('indexed', true);
          
          documentId = response.body.id;
        });
      });

      describe('GET /storage/documents/:id', () => {
        it('should retrieve document', async () => {
          const response = await request(app)
            .get(`/storage/documents/${documentId}`)
            .set('Authorization', `Bearer ${userToken}`)
            .expect(200);

          expect(response.body).toHaveProperty('id', documentId);
          expect(response.body).toHaveProperty('title', 'Test Document');
          expect(response.body).toHaveProperty('content');
        });
      });

      describe('GET /storage/documents/search', () => {
        it('should search documents', async () => {
          const response = await request(app)
            .get('/storage/documents/search')
            .query({
              q: 'test document',
              limit: 10
            })
            .set('Authorization', `Bearer ${userToken}`)
            .expect(200);

          expect(response.body).toHaveProperty('results');
          expect(response.body).toHaveProperty('query', 'test document');
          expect(Array.isArray(response.body.results)).toBe(true);
        });

        it('should require search query', async () => {
          const response = await request(app)
            .get('/storage/documents/search')
            .set('Authorization', `Bearer ${userToken}`)
            .expect(400);

          expect(response.body).toHaveProperty('error');
          expect(response.body.error).toContain('Query parameter "q" is required');
        });
      });
    });

    describe('Vector Operations', () => {
      describe('POST /storage/vectors', () => {
        it('should store vector embedding', async () => {
          const vector = Array(384).fill(0).map(() => Math.random()); // Random 384-dim vector

          const response = await request(app)
            .post('/storage/vectors')
            .set('Authorization', `Bearer ${userToken}`)
            .send({
              id: 'test-vector-1',
              vector: vector,
              metadata: {
                source: 'test',
                type: 'embedding'
              }
            })
            .expect(200);

          expect(response.body).toEqual({
            status: 'stored',
            id: 'test-vector-1'
          });
          
          vectorId = 'test-vector-1';
        });

        it('should validate vector format', async () => {
          const response = await request(app)
            .post('/storage/vectors')
            .set('Authorization', `Bearer ${userToken}`)
            .send({
              id: 'invalid-vector',
              vector: 'not an array'
            })
            .expect(400);

          expect(response.body).toHaveProperty('error');
        });
      });

      describe('POST /storage/vectors/search', () => {
        it('should perform similarity search', async () => {
          const queryVector = Array(384).fill(0).map(() => Math.random());

          const response = await request(app)
            .post('/storage/vectors/search')
            .set('Authorization', `Bearer ${userToken}`)
            .send({
              vector: queryVector,
              limit: 5
            })
            .expect(200);

          expect(response.body).toHaveProperty('results');
          expect(Array.isArray(response.body.results)).toBe(true);
          
          response.body.results.forEach((result: any) => {
            expect(result).toHaveProperty('id');
            expect(result).toHaveProperty('score');
            expect(typeof result.score).toBe('number');
          });
        });
      });
    });

    describe('GET /storage/stats', () => {
      it('should return storage statistics', async () => {
        const response = await request(app)
          .get('/storage/stats')
          .set('Authorization', `Bearer ${userToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('documents');
        expect(response.body).toHaveProperty('vectors');
        expect(response.body).toHaveProperty('files');
        expect(response.body).toHaveProperty('totalSize');
        
        expect(typeof response.body.documents.count).toBe('number');
        expect(typeof response.body.vectors.count).toBe('number');
        expect(typeof response.body.files.count).toBe('number');
      });
    });
  });

  describe('Streaming Endpoints', () => {
    describe('Server-Sent Events', () => {
      it('should handle SSE connection properly', (done) => {
        const req = request(app)
          .get('/api/events/stream')
          .set('Authorization', `Bearer ${userToken}`)
          .expect(200)
          .expect('Content-Type', /text\/event-stream/)
          .expect('Cache-Control', 'no-cache')
          .expect('Connection', 'keep-alive');

        let eventReceived = false;

        req.on('data', (chunk) => {
          const data = chunk.toString();
          if (data.includes('data:')) {
            eventReceived = true;
          }
        });

        req.on('end', () => {
          expect(eventReceived).toBe(true);
          done();
        });

        req.on('error', done);

        // Close connection after a short time
        setTimeout(() => {
          req.abort();
        }, 1000);
      });
    });
  });

  describe('Plugin Permission Validation', () => {
    it('should enforce plugin-specific permissions', async () => {
      // Try to access Alfred with insufficient permissions
      const limitedUser = await authService.createUser({
        username: 'limited',
        password: 'password',
        email: 'limited@test.com',
        roles: ['user'],
        permissions: ['system:read'] // Missing Alfred permissions
      });

      const limitedToken = await authService.generateToken(limitedUser);

      const response = await request(app)
        .post('/alfred/generate-code')
        .set('Authorization', `Bearer ${limitedToken}`)
        .send({
          prompt: 'Create a function',
          language: 'javascript'
        })
        .expect(403);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Insufficient permissions');
    });

    it('should allow access with wildcard permissions', async () => {
      const wildcardUser = await authService.createUser({
        username: 'wildcard',
        password: 'password',
        email: 'wildcard@test.com',
        roles: ['developer'],
        permissions: ['plugin:*'] // Wildcard plugin permissions
      });

      const wildcardToken = await authService.generateToken(wildcardUser);

      const response = await request(app)
        .post('/alfred/generate-code')
        .set('Authorization', `Bearer ${wildcardToken}`)
        .send({
          prompt: 'Create a function',
          language: 'javascript'
        })
        .expect(200);

      expect(response.body).toHaveProperty('code');
    });
  });
});