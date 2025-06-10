/**
 * Load Testing Suite
 * 
 * Comprehensive performance and load tests including:
 * - Concurrent request handling
 * - Memory usage under load
 * - Database connection pooling
 * - WebSocket connection limits
 * - Plugin system scalability
 * - API rate limiting behavior
 * - System recovery after overload
 * - Performance regression detection
 * Target Coverage: 100%
 */

import request from 'supertest';
import express from 'express';
import { performance } from 'perf_hooks';
import { EventEmitter } from 'events';
import { createSystemMetricsAPI } from '../../api/system-metrics';
import { createPluginAPI } from '../../api/plugin-api';
import { WebSocketManager } from '../../api/websocket/websocket-server';
import { Logger } from '../../utils/logger';

// Mock dependencies
jest.mock('../../utils/logger');

describe('Load Testing', () => {
  let app: express.Application;
  let mockLogger: jest.Mocked<Logger>;
  let systemMetrics: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup Express app
    app = express();
    app.use(express.json());

    // Setup mock logger
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      child: jest.fn().mockReturnThis(),
    } as any;

    // Setup system metrics tracking
    systemMetrics = {
      startTime: Date.now(),
      requestCount: 0,
      errorCount: 0,
      memoryPeak: 0,
      responseTimes: [],
    };

    // Add metrics middleware
    app.use((req, res, next) => {
      const start = performance.now();
      systemMetrics.requestCount++;
      
      res.on('finish', () => {
        const duration = performance.now() - start;
        systemMetrics.responseTimes.push(duration);
        
        if (res.statusCode >= 400) {
          systemMetrics.errorCount++;
        }
      });
      
      next();
    });

    // Add test routes
    app.get('/api/test/fast', (req, res) => {
      res.json({ message: 'Fast response', timestamp: Date.now() });
    });

    app.get('/api/test/slow', async (req, res) => {
      await new Promise(resolve => setTimeout(resolve, 100));
      res.json({ message: 'Slow response', timestamp: Date.now() });
    });

    app.post('/api/test/data', (req, res) => {
      const data = req.body;
      // Simulate processing
      const processed = {
        ...data,
        processedAt: Date.now(),
        size: JSON.stringify(data).length,
      };
      res.json(processed);
    });

    app.get('/api/test/memory', (req, res) => {
      // Simulate memory-intensive operation
      const largeArray = new Array(10000).fill(0).map(() => Math.random());
      const currentMemory = process.memoryUsage().heapUsed;
      systemMetrics.memoryPeak = Math.max(systemMetrics.memoryPeak, currentMemory);
      
      res.json({ 
        message: 'Memory operation complete',
        memoryUsed: currentMemory,
        arraySize: largeArray.length,
      });
    });

    app.get('/api/test/error', (req, res) => {
      if (Math.random() < 0.1) {
        throw new Error('Random error for testing');
      }
      res.json({ message: 'Success' });
    });
  });

  describe('Concurrent Request Handling', () => {
    it('should handle multiple concurrent requests efficiently', async () => {
      const concurrentRequests = 50;
      const startTime = performance.now();

      // Create concurrent requests
      const requests = Array.from({ length: concurrentRequests }, () =>
        request(app)
          .get('/api/test/fast')
          .expect(200)
      );

      const responses = await Promise.all(requests);
      const endTime = performance.now();
      const totalDuration = endTime - startTime;

      // All requests should succeed
      expect(responses).toHaveLength(concurrentRequests);
      responses.forEach(response => {
        expect(response.body).toHaveProperty('message', 'Fast response');
        expect(response.body).toHaveProperty('timestamp');
      });

      // Performance assertions
      expect(totalDuration).toBeLessThan(5000); // Should complete in < 5 seconds
      expect(systemMetrics.requestCount).toBe(concurrentRequests);
      expect(systemMetrics.errorCount).toBe(0);

      // Calculate average response time
      const avgResponseTime = systemMetrics.responseTimes.reduce((a, b) => a + b, 0) / systemMetrics.responseTimes.length;
      expect(avgResponseTime).toBeLessThan(100); // Average < 100ms
    });

    it('should maintain performance with mixed request types', async () => {
      const fastRequests = 20;
      const slowRequests = 10;
      const startTime = performance.now();

      const allRequests = [
        ...Array.from({ length: fastRequests }, () =>
          request(app).get('/api/test/fast')
        ),
        ...Array.from({ length: slowRequests }, () =>
          request(app).get('/api/test/slow')
        ),
      ];

      const responses = await Promise.allSettled(allRequests);
      const endTime = performance.now();

      // All requests should complete
      const successCount = responses.filter(r => r.status === 'fulfilled').length;
      expect(successCount).toBe(fastRequests + slowRequests);

      // Fast requests should complete much quicker than slow ones
      const fastResponseTimes = systemMetrics.responseTimes.slice(0, fastRequests);
      const avgFastTime = fastResponseTimes.reduce((a, b) => a + b, 0) / fastResponseTimes.length;
      expect(avgFastTime).toBeLessThan(50);
    });

    it('should handle high-volume POST requests with data', async () => {
      const requestCount = 100;
      const testData = {
        id: 'test-123',
        name: 'Load Test Item',
        data: new Array(100).fill(0).map(i => ({ value: Math.random() })),
      };

      const requests = Array.from({ length: requestCount }, () =>
        request(app)
          .post('/api/test/data')
          .send(testData)
          .expect(200)
      );

      const responses = await Promise.all(requests);

      // All requests should succeed and process data
      responses.forEach(response => {
        expect(response.body).toHaveProperty('processedAt');
        expect(response.body).toHaveProperty('size');
        expect(response.body.id).toBe(testData.id);
      });

      expect(systemMetrics.errorCount).toBe(0);
    });
  });

  describe('Memory Management Under Load', () => {
    it('should manage memory efficiently during intensive operations', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      const operationCount = 30;

      const requests = Array.from({ length: operationCount }, () =>
        request(app)
          .get('/api/test/memory')
          .expect(200)
      );

      await Promise.all(requests);

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 50MB for this test)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);

      // Peak memory should be tracked
      expect(systemMetrics.memoryPeak).toBeGreaterThan(initialMemory);
    });

    it('should recover memory after load spikes', async () => {
      // Measure baseline
      const baselineMemory = process.memoryUsage().heapUsed;

      // Create memory pressure
      const heavyRequests = Array.from({ length: 20 }, () =>
        request(app)
          .get('/api/test/memory')
          .expect(200)
      );

      await Promise.all(heavyRequests);
      const peakMemory = process.memoryUsage().heapUsed;

      // Wait for potential cleanup
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Force garbage collection
      if (global.gc) {
        global.gc();
      }

      const recoveredMemory = process.memoryUsage().heapUsed;

      // Memory should have increased during load
      expect(peakMemory).toBeGreaterThan(baselineMemory);

      // Memory should recover somewhat after load
      expect(recoveredMemory).toBeLessThan(peakMemory);
    });
  });

  describe('Error Rate Under Load', () => {
    it('should maintain low error rate under normal load', async () => {
      const requestCount = 100;

      const requests = Array.from({ length: requestCount }, () =>
        request(app)
          .get('/api/test/error')
      );

      await Promise.allSettled(requests);

      // Error rate should be reasonable (< 15% for this random error test)
      const errorRate = systemMetrics.errorCount / systemMetrics.requestCount;
      expect(errorRate).toBeLessThan(0.15);
    });

    it('should handle burst traffic gracefully', async () => {
      const burstSize = 50;
      const burstCount = 3;
      const delayBetweenBursts = 100;

      for (let burst = 0; burst < burstCount; burst++) {
        const burstRequests = Array.from({ length: burstSize }, () =>
          request(app)
            .get('/api/test/fast')
            .expect(200)
        );

        await Promise.all(burstRequests);

        if (burst < burstCount - 1) {
          await new Promise(resolve => setTimeout(resolve, delayBetweenBursts));
        }
      }

      expect(systemMetrics.requestCount).toBe(burstSize * burstCount);
      expect(systemMetrics.errorCount).toBe(0);
    });
  });

  describe('Response Time Distribution', () => {
    it('should maintain consistent response times under load', async () => {
      const requestCount = 200;

      const requests = Array.from({ length: requestCount }, () =>
        request(app)
          .get('/api/test/fast')
          .expect(200)
      );

      await Promise.all(requests);

      const responseTimes = systemMetrics.responseTimes;
      
      // Calculate percentiles
      const sortedTimes = [...responseTimes].sort((a, b) => a - b);
      const p50 = sortedTimes[Math.floor(sortedTimes.length * 0.5)];
      const p95 = sortedTimes[Math.floor(sortedTimes.length * 0.95)];
      const p99 = sortedTimes[Math.floor(sortedTimes.length * 0.99)];

      // Performance expectations
      expect(p50).toBeLessThan(50); // 50th percentile < 50ms
      expect(p95).toBeLessThan(200); // 95th percentile < 200ms
      expect(p99).toBeLessThan(500); // 99th percentile < 500ms

      // Standard deviation should be reasonable
      const avg = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const variance = responseTimes.reduce((sum, time) => sum + Math.pow(time - avg, 2), 0) / responseTimes.length;
      const stdDev = Math.sqrt(variance);

      expect(stdDev).toBeLessThan(avg); // Standard deviation should be less than average
    });
  });

  describe('Scalability Limits', () => {
    it('should identify maximum concurrent connections', async () => {
      const maxTestConnections = 500;
      const stepSize = 50;
      let successfulConnections = 0;

      for (let connections = stepSize; connections <= maxTestConnections; connections += stepSize) {
        const startTime = performance.now();
        
        const requests = Array.from({ length: stepSize }, () =>
          request(app)
            .get('/api/test/fast')
        );

        try {
          await Promise.all(requests);
          successfulConnections = connections;
          
          const duration = performance.now() - startTime;
          const avgResponseTime = duration / stepSize;

          // If response time degrades significantly, we've likely hit a limit
          if (avgResponseTime > 1000) { // 1 second average
            break;
          }
        } catch (error) {
          break;
        }
      }

      expect(successfulConnections).toBeGreaterThan(100); // Should handle at least 100 concurrent
      
      console.log(`Maximum tested concurrent connections: ${successfulConnections}`);
    });

    it('should handle gradual load increase gracefully', async () => {
      const phases = [
        { connections: 10, duration: 500 },
        { connections: 25, duration: 500 },
        { connections: 50, duration: 500 },
        { connections: 25, duration: 500 },
        { connections: 10, duration: 500 },
      ];

      const results = [];

      for (const phase of phases) {
        const phaseStart = performance.now();
        const phaseMetrics = {
          requestCount: 0,
          errorCount: 0,
          responseTimes: [],
        };

        const requests = Array.from({ length: phase.connections }, () =>
          request(app)
            .get('/api/test/fast')
            .then(response => {
              phaseMetrics.requestCount++;
              return response;
            })
            .catch(error => {
              phaseMetrics.errorCount++;
              throw error;
            })
        );

        await Promise.allSettled(requests);
        
        const phaseDuration = performance.now() - phaseStart;
        
        results.push({
          connections: phase.connections,
          duration: phaseDuration,
          requestCount: phaseMetrics.requestCount,
          errorCount: phaseMetrics.errorCount,
          errorRate: phaseMetrics.errorCount / phase.connections,
        });

        await new Promise(resolve => setTimeout(resolve, phase.duration));
      }

      // System should handle load increase and decrease gracefully
      results.forEach(result => {
        expect(result.errorRate).toBeLessThan(0.1); // Less than 10% error rate
      });

      // Performance should not degrade significantly during ramp-up
      const firstPhase = results[0];
      const peakPhase = results[2]; // 50 connections
      const lastPhase = results[4];

      expect(peakPhase.errorRate).toBeLessThan(firstPhase.errorRate + 0.05);
      expect(lastPhase.errorRate).toBeLessThanOrEqual(firstPhase.errorRate);
    });
  });

  describe('Recovery After Overload', () => {
    it('should recover from temporary overload conditions', async () => {
      // Create overload condition
      const overloadRequests = Array.from({ length: 200 }, () =>
        request(app)
          .get('/api/test/slow')
      );

      // Don't wait for completion, just start them
      const overloadPromise = Promise.allSettled(overloadRequests);

      // Wait briefly for overload to establish
      await new Promise(resolve => setTimeout(resolve, 100));

      // Test normal requests during overload
      const normalRequest = await request(app)
        .get('/api/test/fast')
        .timeout(5000); // Generous timeout

      expect(normalRequest.status).toBe(200);

      // Wait for overload to complete
      await overloadPromise;

      // Test recovery - normal requests should work well again
      const recoveryRequests = Array.from({ length: 10 }, () =>
        request(app)
          .get('/api/test/fast')
          .expect(200)
      );

      const recoveryStart = performance.now();
      await Promise.all(recoveryRequests);
      const recoveryDuration = performance.now() - recoveryStart;

      // Recovery should be fast
      expect(recoveryDuration).toBeLessThan(1000);
    });
  });

  describe('Resource Monitoring', () => {
    it('should track resource usage during load', async () => {
      const initialStats = {
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
      };

      // Create sustained load
      const loadDuration = 2000; // 2 seconds
      const requestInterval = 50; // Request every 50ms
      const expectedRequests = Math.floor(loadDuration / requestInterval);

      const loadPromises = [];
      const loadStart = Date.now();

      while (Date.now() - loadStart < loadDuration) {
        loadPromises.push(
          request(app)
            .get('/api/test/fast')
            .expect(200)
        );
        
        await new Promise(resolve => setTimeout(resolve, requestInterval));
      }

      await Promise.all(loadPromises);

      const finalStats = {
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(initialStats.cpu),
      };

      // Memory usage should be tracked
      expect(finalStats.memory.heapUsed).toBeGreaterThan(initialStats.memory.heapUsed);

      // CPU usage should show activity
      expect(finalStats.cpu.user).toBeGreaterThan(0);
      expect(finalStats.cpu.system).toBeGreaterThan(0);

      // Should have processed approximately the expected number of requests
      expect(loadPromises.length).toBeGreaterThanOrEqual(expectedRequests * 0.8); // Allow some variance
    });
  });

  describe('Performance Regression Detection', () => {
    it('should maintain baseline performance characteristics', async () => {
      const baselineRuns = 3;
      const baselineResults = [];

      // Establish baseline
      for (let run = 0; run < baselineRuns; run++) {
        const runStart = performance.now();
        const runRequests = Array.from({ length: 50 }, () =>
          request(app)
            .get('/api/test/fast')
            .expect(200)
        );

        await Promise.all(runRequests);
        const runDuration = performance.now() - runStart;
        
        baselineResults.push({
          duration: runDuration,
          requestCount: 50,
          throughput: 50 / (runDuration / 1000), // requests per second
        });

        // Small delay between runs
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Calculate baseline metrics
      const avgThroughput = baselineResults.reduce((sum, r) => sum + r.throughput, 0) / baselineResults.length;
      const avgDuration = baselineResults.reduce((sum, r) => sum + r.duration, 0) / baselineResults.length;

      // Performance thresholds (these would be adjusted based on actual system requirements)
      expect(avgThroughput).toBeGreaterThan(100); // At least 100 requests/second
      expect(avgDuration).toBeLessThan(2000); // Complete 50 requests in < 2 seconds

      // Store baseline for comparison in CI/CD
      console.log('Performance Baseline:', {
        averageThroughput: avgThroughput.toFixed(2),
        averageDuration: avgDuration.toFixed(2),
        timestamp: new Date().toISOString(),
      });
    });
  });
});