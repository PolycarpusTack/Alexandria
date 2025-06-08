/**
 * ML Service Tests
 */

import { MLService } from '../ml-service';
import { Logger } from '@utils/logger';
import { HeimdallLogEntry, LogLevel, MLEnrichment, MLQueryFeatures } from '../../interfaces';
import { AnomalyDetector } from '../ml-models/anomaly-detector';
import { NLPProcessor } from '../ml-models/nlp-processor';

jest.mock('../ml-models/anomaly-detector');
jest.mock('../ml-models/nlp-processor');

describe('MLService', () => {
  let mlService: MLService;
  let mockLogger: jest.Mocked<Logger>;
  let mockMLClient: any;
  let mockAnomalyDetector: jest.Mocked<AnomalyDetector>;
  let mockNLPProcessor: jest.Mocked<NLPProcessor>;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn()
    } as any;

    mockMLClient = {};

    mockAnomalyDetector = {
      detectAnomaly: jest.fn().mockResolvedValue(0.2),
      detectBatchAnomalies: jest.fn().mockResolvedValue(new Map()),
      enrichLog: jest.fn().mockResolvedValue({
        anomalyScore: 0.2,
        confidence: 0.85,
        predictedCategory: 'general',
        suggestedActions: [],
        relatedPatterns: []
      })
    } as any;

    mockNLPProcessor = {
      processQuery: jest.fn().mockResolvedValue({
        timeRange: {
          from: new Date(Date.now() - 3600000),
          to: new Date()
        },
        naturalLanguage: 'show me all errors',
        structured: {
          levels: ['ERROR'],
          search: 'errors'
        }
      })
    } as any;

    (AnomalyDetector as jest.MockedClass<typeof AnomalyDetector>)
      .mockImplementation(() => mockAnomalyDetector);
    (NLPProcessor as jest.MockedClass<typeof NLPProcessor>)
      .mockImplementation(() => mockNLPProcessor);

    mlService = new MLService(mockMLClient, mockLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialize', () => {
    it('should initialize successfully', async () => {
      await mlService.initialize();

      expect(mockLogger.info).toHaveBeenCalledWith('Initializing ML service');
    });
  });

  describe('enrichLog', () => {
    const mockLog: HeimdallLogEntry = {
      id: 'test-id',
      timestamp: BigInt(Date.now() * 1000000),
      version: 1,
      level: LogLevel.INFO,
      source: {
        service: 'test-service',
        instance: 'test-instance',
        environment: 'test',
        version: '1.0.0'
      },
      message: {
        raw: 'Test log message',
        structured: { key: 'value' }
      },
      security: {
        classification: 'public',
        sanitized: false
      }
    };

    it('should enrich log with ML data', async () => {
      const enrichment = await mlService.enrichLog(mockLog);

      expect(mockAnomalyDetector.enrichLog).toHaveBeenCalledWith(mockLog);
      expect(enrichment).toEqual({
        anomalyScore: 0.2,
        confidence: 0.85,
        predictedCategory: 'general',
        suggestedActions: [],
        relatedPatterns: []
      });

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Log enriched with ML',
        expect.objectContaining({
          logId: 'test-id',
          anomalyScore: 0.2,
          category: 'general'
        })
      );
    });

    it('should handle enrichment errors gracefully', async () => {
      mockAnomalyDetector.enrichLog.mockRejectedValue(new Error('Enrichment failed'));

      const enrichment = await mlService.enrichLog(mockLog);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to enrich log with ML',
        expect.objectContaining({
          logId: 'test-id',
          error: 'Enrichment failed'
        })
      );

      expect(enrichment).toEqual({
        anomalyScore: 0,
        predictedCategory: 'unknown',
        confidence: 0.5
      });
    });
  });

  describe('generateInsights', () => {
    const mockLogs: HeimdallLogEntry[] = [
      {
        id: 'test-1',
        timestamp: BigInt(Date.now() * 1000000),
        version: 1,
        level: LogLevel.ERROR,
        source: {
          service: 'test-service',
          instance: 'test-instance',
          environment: 'test',
          version: '1.0.0'
        },
        message: {
          raw: 'Error occurred',
          structured: {}
        },
        security: {
          classification: 'public',
          sanitized: false
        }
      },
      {
        id: 'test-2',
        timestamp: BigInt(Date.now() * 1000000),
        version: 1,
        level: LogLevel.INFO,
        source: {
          service: 'test-service',
          instance: 'test-instance',
          environment: 'test',
          version: '1.0.0'
        },
        message: {
          raw: 'Normal operation',
          structured: {}
        },
        security: {
          classification: 'public',
          sanitized: false
        }
      }
    ];

    const features: MLQueryFeatures = {
      anomalyDetection: {
        enabled: true,
        sensitivity: 0.7
      },
      predictive: {
        enabled: true,
        horizon: '1h'
      }
    };

    it('should generate insights from logs', async () => {
      const anomalyMap = new Map([['test-1', 0.85]]);
      mockAnomalyDetector.detectBatchAnomalies.mockResolvedValue(anomalyMap);

      const insights = await mlService.generateInsights(mockLogs, features);

      expect(mockAnomalyDetector.detectBatchAnomalies).toHaveBeenCalledWith(mockLogs);
      expect(insights).toHaveLength(2); // Anomaly and pattern insights

      const anomalyInsight = insights.find(i => i.type === 'anomaly');
      expect(anomalyInsight).toBeDefined();
      expect(anomalyInsight?.severity).toBe('warning');
      expect(anomalyInsight?.affectedLogs).toContain('test-1');
    });

    it('should handle insight generation errors', async () => {
      mockAnomalyDetector.detectBatchAnomalies.mockRejectedValue(
        new Error('Anomaly detection failed')
      );

      const insights = await mlService.generateInsights(mockLogs, features);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to generate insights',
        expect.objectContaining({
          error: 'Anomaly detection failed'
        })
      );

      expect(insights).toEqual([]);
    });
  });

  describe('processNaturalLanguageQuery', () => {
    it('should process natural language query', async () => {
      const query = 'show me all errors from auth service in the last hour';
      const result = await mlService.processNaturalLanguageQuery(query);

      expect(mockNLPProcessor.processQuery).toHaveBeenCalledWith(query);
      expect(result).toHaveProperty('timeRange');
      expect(result).toHaveProperty('naturalLanguage', 'show me all errors');
      expect(result.structured?.levels).toContain('ERROR');
    });

    it('should handle NLP processing errors', async () => {
      const query = 'invalid query';
      mockNLPProcessor.processQuery.mockRejectedValue(new Error('NLP failed'));

      await expect(
        mlService.processNaturalLanguageQuery(query)
      ).rejects.toThrow('NLP failed');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to process natural language query',
        expect.objectContaining({
          query,
          error: 'NLP failed'
        })
      );
    });
  });

  describe('detectPatterns', () => {
    it('should return empty array (not implemented)', async () => {
      const patterns = await mlService.detectPatterns(['log1', 'log2']);
      expect(patterns).toEqual([]);
    });
  });

  describe('health', () => {
    it('should return health status', () => {
      const health = mlService.health();

      expect(health).toEqual({
        status: 'up',
        details: {
          modelsLoaded: true,
          inferenceLatency: 45
        }
      });
    });
  });
});