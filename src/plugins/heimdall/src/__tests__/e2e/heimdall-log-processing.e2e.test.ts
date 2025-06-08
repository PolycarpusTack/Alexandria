/**
 * Heimdall End-to-End Log Processing Tests
 */

import { HeimdallPlugin } from '../../index';
import { CoreSystem } from '@core/system/core-system';
import { HeimdallLogEntry, LogLevel } from '../../interfaces';
import axios from 'axios';
import WebSocket from 'ws';

const API_BASE_URL = 'http://localhost:3001/api/heimdall';
const WS_URL = 'ws://localhost:3001/heimdall/stream';

describe('Heimdall E2E - Log Processing', () => {
  let coreSystem: CoreSystem;
  let plugin: HeimdallPlugin;
  let authToken: string;

  beforeAll(async () => {
    // Initialize core system
    coreSystem = new CoreSystem();
    await coreSystem.initialize();

    // Install and activate Heimdall plugin
    plugin = new HeimdallPlugin();
    const context = coreSystem.getPluginContext('heimdall');
    await plugin.install(context);
    await plugin.activate();

    // Get auth token for API requests
    const authResponse = await axios.post('http://localhost:3001/api/auth/login', {
      username: 'admin',
      password: 'admin123'
    });
    authToken = authResponse.data.token;
  }, 30000);

  afterAll(async () => {
    if (plugin) {
      await plugin.deactivate();
      await plugin.uninstall();
    }
    if (coreSystem) {
      await coreSystem.shutdown();
    }
  });

  describe('Log Ingestion', () => {
    it('should ingest single log via API', async () => {
      const log: HeimdallLogEntry = {
        id: `e2e-test-${Date.now()}`,
        timestamp: BigInt(Date.now() * 1000000),
        version: 1,
        level: LogLevel.INFO,
        source: {
          service: 'e2e-test-service',
          instance: 'test-instance-1',
          environment: 'test',
          version: '1.0.0'
        },
        message: {
          raw: 'E2E test log message',
          structured: {
            testId: 'single-log-test',
            timestamp: new Date().toISOString()
          }
        },
        security: {
          classification: 'public',
          sanitized: false
        }
      };

      const response = await axios.post(
        `${API_BASE_URL}/logs`,
        log,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('id', log.id);
      expect(response.data).toHaveProperty('status', 'ingested');
    });

    it('should ingest batch of logs', async () => {
      const logs: HeimdallLogEntry[] = Array.from({ length: 100 }, (_, i) => ({
        id: `e2e-batch-${Date.now()}-${i}`,
        timestamp: BigInt((Date.now() - i * 1000) * 1000000),
        version: 1,
        level: i % 10 === 0 ? LogLevel.ERROR : LogLevel.INFO,
        source: {
          service: 'e2e-test-service',
          instance: `test-instance-${i % 3}`,
          environment: 'test',
          version: '1.0.0'
        },
        message: {
          raw: `Batch test log ${i}`,
          structured: {
            batchId: 'batch-test',
            index: i
          }
        },
        security: {
          classification: 'public',
          sanitized: false
        }
      }));

      const response = await axios.post(
        `${API_BASE_URL}/logs/batch`,
        { logs },
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('count', 100);
      expect(response.data).toHaveProperty('status', 'ingested');
    });
  });

  describe('Log Querying', () => {
    beforeAll(async () => {
      // Ensure some test data exists
      const testLogs = Array.from({ length: 50 }, (_, i) => ({
        id: `e2e-query-${Date.now()}-${i}`,
        timestamp: BigInt((Date.now() - i * 60000) * 1000000),
        version: 1,
        level: i % 5 === 0 ? LogLevel.ERROR : LogLevel.INFO,
        source: {
          service: i % 2 === 0 ? 'auth-service' : 'api-service',
          instance: 'test-instance',
          environment: 'test',
          version: '1.0.0'
        },
        message: {
          raw: `Query test log ${i}`,
          structured: { queryTest: true }
        },
        security: {
          classification: 'public',
          sanitized: false
        }
      }));

      await axios.post(
        `${API_BASE_URL}/logs/batch`,
        { logs: testLogs },
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      // Wait for indexing
      await new Promise(resolve => setTimeout(resolve, 2000));
    });

    it('should query logs by time range', async () => {
      const response = await axios.post(
        `${API_BASE_URL}/query`,
        {
          timeRange: {
            from: new Date(Date.now() - 3600000).toISOString(),
            to: new Date().toISOString()
          },
          structured: {
            limit: 10
          }
        },
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('logs');
      expect(response.data.logs).toBeInstanceOf(Array);
      expect(response.data.logs.length).toBeGreaterThan(0);
      expect(response.data.logs.length).toBeLessThanOrEqual(10);
    });

    it('should filter logs by level', async () => {
      const response = await axios.post(
        `${API_BASE_URL}/query`,
        {
          timeRange: {
            from: new Date(Date.now() - 3600000).toISOString(),
            to: new Date().toISOString()
          },
          structured: {
            levels: [LogLevel.ERROR],
            limit: 20
          }
        },
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.logs).toBeInstanceOf(Array);
      
      // All returned logs should be ERROR level
      response.data.logs.forEach((log: any) => {
        expect(log.level).toBe(LogLevel.ERROR);
      });
    });

    it('should search logs by natural language', async () => {
      const response = await axios.post(
        `${API_BASE_URL}/search`,
        {
          query: 'show me all errors from auth service in the last hour'
        },
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('logs');
      
      // Verify results match natural language query
      response.data.logs.forEach((log: any) => {
        expect(log.level).toBe(LogLevel.ERROR);
        expect(log.source.service).toBe('auth-service');
      });
    });

    it('should aggregate logs by service', async () => {
      const response = await axios.post(
        `${API_BASE_URL}/query`,
        {
          timeRange: {
            from: new Date(Date.now() - 3600000).toISOString(),
            to: new Date().toISOString()
          },
          structured: {
            aggregations: [
              {
                type: 'terms',
                field: 'source.service',
                name: 'services'
              }
            ]
          }
        },
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('aggregations');
      expect(response.data.aggregations).toHaveProperty('services');
      expect(response.data.aggregations.services).toBeInstanceOf(Array);
      
      // Should have both test services
      const serviceNames = response.data.aggregations.services.map((s: any) => s.key);
      expect(serviceNames).toContain('auth-service');
      expect(serviceNames).toContain('api-service');
    });
  });

  describe('Real-time Streaming', () => {
    it('should stream logs via WebSocket', async (done) => {
      const ws = new WebSocket(WS_URL, {
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      });

      const receivedLogs: any[] = [];

      ws.on('open', () => {
        // Subscribe to log stream
        ws.send(JSON.stringify({
          type: 'subscribe',
          query: {
            timeRange: {
              from: new Date().toISOString(),
              to: new Date(Date.now() + 60000).toISOString()
            },
            structured: {
              levels: [LogLevel.INFO, LogLevel.ERROR]
            }
          },
          options: {
            batchSize: 5,
            batchInterval: 1000
          }
        }));
      });

      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'subscribed') {
          // Start sending test logs
          setTimeout(async () => {
            for (let i = 0; i < 10; i++) {
              await axios.post(
                `${API_BASE_URL}/logs`,
                {
                  id: `stream-test-${i}`,
                  timestamp: BigInt(Date.now() * 1000000),
                  version: 1,
                  level: LogLevel.INFO,
                  source: {
                    service: 'stream-test',
                    instance: 'test',
                    environment: 'test',
                    version: '1.0.0'
                  },
                  message: {
                    raw: `Stream test ${i}`,
                    structured: { streamTest: true }
                  },
                  security: {
                    classification: 'public',
                    sanitized: false
                  }
                },
                {
                  headers: {
                    Authorization: `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                  }
                }
              );
              await new Promise(resolve => setTimeout(resolve, 200));
            }
          }, 100);
        } else if (message.type === 'logs') {
          receivedLogs.push(...message.logs);
          
          if (receivedLogs.length >= 10) {
            ws.close();
            expect(receivedLogs.length).toBeGreaterThanOrEqual(10);
            done();
          }
        }
      });

      ws.on('error', (error) => {
        done(error);
      });
    }, 30000);
  });

  describe('ML-Enhanced Features', () => {
    it('should detect anomalies in logs', async () => {
      // Create anomalous pattern
      const anomalousLogs = Array.from({ length: 50 }, (_, i) => ({
        id: `anomaly-test-${i}`,
        timestamp: BigInt((Date.now() - i * 1000) * 1000000),
        version: 1,
        level: LogLevel.ERROR,
        source: {
          service: 'anomaly-service',
          instance: 'test',
          environment: 'test',
          version: '1.0.0'
        },
        message: {
          raw: 'Connection timeout error',
          structured: {
            error: 'ETIMEDOUT',
            duration: 30000 + i * 1000
          }
        },
        metrics: {
          duration: 30000 + i * 1000,
          cpu: 95,
          memory: 90
        },
        security: {
          classification: 'public',
          sanitized: false
        }
      }));

      await axios.post(
        `${API_BASE_URL}/logs/batch`,
        { logs: anomalousLogs },
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      // Wait for ML processing
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Query for anomalies
      const response = await axios.post(
        `${API_BASE_URL}/ml/anomalies`,
        {
          timeRange: {
            from: new Date(Date.now() - 60000).toISOString(),
            to: new Date().toISOString()
          },
          sensitivity: 0.7
        },
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('anomalies');
      expect(response.data.anomalies).toBeInstanceOf(Array);
      
      // Should detect high anomaly scores
      const highAnomalies = response.data.anomalies.filter(
        (a: any) => a.anomalyScore > 0.7
      );
      expect(highAnomalies.length).toBeGreaterThan(0);
    });

    it('should generate insights from log patterns', async () => {
      const response = await axios.post(
        `${API_BASE_URL}/query`,
        {
          timeRange: {
            from: new Date(Date.now() - 3600000).toISOString(),
            to: new Date().toISOString()
          },
          mlFeatures: {
            anomalyDetection: {
              enabled: true,
              sensitivity: 0.6
            },
            predictive: {
              enabled: true,
              horizon: '1h'
            }
          }
        },
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('insights');
      expect(response.data.insights).toBeInstanceOf(Array);
      
      // Should have various insight types
      const insightTypes = response.data.insights.map((i: any) => i.type);
      expect(insightTypes).toEqual(
        expect.arrayContaining(['anomaly', 'pattern', 'trend', 'prediction'])
      );
    });
  });

  describe('Performance and Scale', () => {
    it('should handle high-volume log ingestion', async () => {
      const batchSize = 1000;
      const numBatches = 10;
      const startTime = Date.now();
      
      const promises = [];
      
      for (let batch = 0; batch < numBatches; batch++) {
        const logs = Array.from({ length: batchSize }, (_, i) => ({
          id: `perf-test-${batch}-${i}`,
          timestamp: BigInt(Date.now() * 1000000),
          version: 1,
          level: LogLevel.INFO,
          source: {
            service: `perf-service-${batch % 5}`,
            instance: `instance-${i % 10}`,
            environment: 'perf-test',
            version: '1.0.0'
          },
          message: {
            raw: `Performance test log ${batch}-${i}`,
            structured: {
              batchId: batch,
              index: i
            }
          },
          security: {
            classification: 'public',
            sanitized: false
          }
        }));

        promises.push(
          axios.post(
            `${API_BASE_URL}/logs/batch`,
            { logs },
            {
              headers: {
                Authorization: `Bearer ${authToken}`,
                'Content-Type': 'application/json'
              }
            }
          )
        );
      }

      const results = await Promise.all(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;
      const totalLogs = batchSize * numBatches;
      const logsPerSecond = totalLogs / (duration / 1000);

      expect(results.every(r => r.status === 201)).toBe(true);
      expect(logsPerSecond).toBeGreaterThan(1000); // Should handle > 1000 logs/sec
      
      console.log(`Ingested ${totalLogs} logs in ${duration}ms (${logsPerSecond.toFixed(0)} logs/sec)`);
    }, 60000);

    it('should query large datasets efficiently', async () => {
      const startTime = Date.now();
      
      const response = await axios.post(
        `${API_BASE_URL}/query`,
        {
          timeRange: {
            from: new Date(Date.now() - 86400000).toISOString(), // Last 24 hours
            to: new Date().toISOString()
          },
          structured: {
            aggregations: [
              {
                type: 'date_histogram',
                field: 'timestamp',
                name: 'logs_over_time',
                options: { interval: '1h' }
              },
              {
                type: 'terms',
                field: 'source.service',
                name: 'top_services',
                options: { size: 10 }
              },
              {
                type: 'terms',
                field: 'level',
                name: 'log_levels'
              }
            ],
            limit: 0 // Only aggregations
          }
        },
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const queryTime = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('aggregations');
      expect(queryTime).toBeLessThan(5000); // Should complete within 5 seconds
      
      console.log(`Complex aggregation query completed in ${queryTime}ms`);
    });
  });
});