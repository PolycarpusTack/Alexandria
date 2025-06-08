// Jest setup for Heimdall plugin tests

// Mock external dependencies
jest.mock('kafkajs', () => ({
  Kafka: jest.fn().mockImplementation(() => ({
    producer: () => ({
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined),
      send: jest.fn().mockResolvedValue([{ topicName: 'heimdall-logs', partition: 0 }])
    }),
    consumer: () => ({
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined),
      subscribe: jest.fn().mockResolvedValue(undefined),
      run: jest.fn().mockResolvedValue(undefined)
    })
  }))
}));

jest.mock('@elastic/elasticsearch', () => ({
  Client: jest.fn().mockImplementation(() => ({
    ping: jest.fn().mockResolvedValue(true),
    indices: {
      exists: jest.fn().mockResolvedValue({ body: false }),
      create: jest.fn().mockResolvedValue({ body: { acknowledged: true } }),
      putTemplate: jest.fn().mockResolvedValue({ body: { acknowledged: true } })
    },
    index: jest.fn().mockResolvedValue({ body: { _id: 'test-id' } }),
    bulk: jest.fn().mockResolvedValue({ body: { errors: false } }),
    search: jest.fn().mockResolvedValue({ body: { hits: { hits: [] } } })
  }))
}));

jest.mock('@clickhouse/client', () => ({
  createClient: jest.fn().mockReturnValue({
    ping: jest.fn().mockResolvedValue({ success: true }),
    command: jest.fn().mockResolvedValue(undefined),
    insert: jest.fn().mockResolvedValue(undefined),
    query: jest.fn().mockResolvedValue({ rows: [] })
  })
}));

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({})),
  PutObjectCommand: jest.fn(),
  GetObjectCommand: jest.fn(),
  ListObjectsV2Command: jest.fn()
}));

// Mock WebSocket
global.WebSocket = jest.fn().mockImplementation(() => ({
  on: jest.fn(),
  send: jest.fn(),
  close: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn()
}));

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // Reduce log noise in tests

// Global test utilities
global.testUtils = {
  // Create mock log entry
  createMockLog: (overrides = {}) => ({
    id: `test-${Date.now()}`,
    timestamp: BigInt(Date.now() * 1000000),
    version: 1,
    level: 'INFO',
    source: {
      service: 'test-service',
      instance: 'test-instance',
      environment: 'test',
      version: '1.0.0'
    },
    message: {
      raw: 'Test log message',
      structured: {}
    },
    security: {
      classification: 'public',
      sanitized: false
    },
    ...overrides
  }),
  
  // Wait for async operations
  waitFor: (condition, timeout = 5000) => {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const interval = setInterval(() => {
        if (condition()) {
          clearInterval(interval);
          resolve();
        } else if (Date.now() - startTime > timeout) {
          clearInterval(interval);
          reject(new Error('Timeout waiting for condition'));
        }
      }, 100);
    });
  }
};

// Increase timeout for integration tests
jest.setTimeout(30000);