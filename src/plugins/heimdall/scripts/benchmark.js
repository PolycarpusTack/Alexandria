/**
 * Heimdall Performance Benchmarks
 */

const { performance } = require('perf_hooks');

// Mock implementations for benchmarking
const mockKafkaService = {
  sendLog: async () => new Promise(resolve => setTimeout(resolve, 1)),
  sendBatch: async (logs) => new Promise(resolve => setTimeout(resolve, logs.length * 0.1))
};

const mockStorageManager = {
  store: async () => new Promise(resolve => setTimeout(resolve, 2)),
  storeBatch: async (logs) => new Promise(resolve => setTimeout(resolve, logs.length * 0.5))
};

const mockMLService = {
  enrichLog: async () => new Promise(resolve => setTimeout(() => resolve({
    anomalyScore: Math.random(),
    predictedCategory: 'general'
  }), 5)),
  detectBatchAnomalies: async (logs) => new Promise(resolve => {
    const anomalies = new Map();
    logs.forEach(log => anomalies.set(log.id, Math.random()));
    setTimeout(() => resolve(anomalies), logs.length * 0.2);
  })
};

// Benchmark utilities
class Benchmark {
  constructor(name) {
    this.name = name;
    this.results = [];
  }

  async run(fn, iterations = 1000) {
    console.log(`\nRunning benchmark: ${this.name}`);
    console.log(`Iterations: ${iterations}`);

    const startTime = performance.now();
    
    for (let i = 0; i < iterations; i++) {
      const iterStart = performance.now();
      await fn(i);
      const iterEnd = performance.now();
      this.results.push(iterEnd - iterStart);
    }

    const endTime = performance.now();
    const totalTime = endTime - startTime;

    this.printResults(totalTime, iterations);
  }

  printResults(totalTime, iterations) {
    const avgTime = totalTime / iterations;
    const sorted = [...this.results].sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.5)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];
    const min = sorted[0];
    const max = sorted[sorted.length - 1];

    console.log(`\nResults for ${this.name}:`);
    console.log(`  Total time: ${totalTime.toFixed(2)}ms`);
    console.log(`  Average: ${avgTime.toFixed(3)}ms`);
    console.log(`  Min: ${min.toFixed(3)}ms`);
    console.log(`  Max: ${max.toFixed(3)}ms`);
    console.log(`  P50: ${p50.toFixed(3)}ms`);
    console.log(`  P95: ${p95.toFixed(3)}ms`);
    console.log(`  P99: ${p99.toFixed(3)}ms`);
    console.log(`  Throughput: ${(iterations / (totalTime / 1000)).toFixed(0)} ops/sec`);
  }
}

// Create test data
function createMockLog(index) {
  return {
    id: `bench-${index}`,
    timestamp: BigInt(Date.now() * 1000000),
    version: 1,
    level: index % 10 === 0 ? 'ERROR' : 'INFO',
    source: {
      service: `service-${index % 5}`,
      instance: `instance-${index % 10}`,
      environment: 'benchmark',
      version: '1.0.0'
    },
    message: {
      raw: `Benchmark log message ${index}`,
      structured: {
        index,
        timestamp: new Date().toISOString(),
        random: Math.random()
      }
    },
    metrics: {
      duration: Math.random() * 1000,
      cpu: Math.random() * 100,
      memory: Math.random() * 100
    },
    security: {
      classification: 'public',
      sanitized: false
    }
  };
}

// Benchmarks
async function runBenchmarks() {
  console.log('=== Heimdall Performance Benchmarks ===\n');

  // 1. Single log ingestion
  const singleLogBench = new Benchmark('Single Log Ingestion');
  await singleLogBench.run(async (i) => {
    const log = createMockLog(i);
    await Promise.all([
      mockKafkaService.sendLog(log),
      mockStorageManager.store(log),
      mockMLService.enrichLog(log)
    ]);
  }, 1000);

  // 2. Batch log ingestion
  const batchSizes = [10, 50, 100, 500];
  for (const batchSize of batchSizes) {
    const batchBench = new Benchmark(`Batch Log Ingestion (${batchSize} logs)`);
    await batchBench.run(async (i) => {
      const logs = Array.from({ length: batchSize }, (_, j) => 
        createMockLog(i * batchSize + j)
      );
      await Promise.all([
        mockKafkaService.sendBatch(logs),
        mockStorageManager.storeBatch(logs),
        mockMLService.detectBatchAnomalies(logs)
      ]);
    }, 100);
  }

  // 3. ML enrichment performance
  const mlBench = new Benchmark('ML Enrichment Only');
  await mlBench.run(async (i) => {
    const log = createMockLog(i);
    await mockMLService.enrichLog(log);
  }, 1000);

  // 4. Storage write performance
  const storageBench = new Benchmark('Storage Write Only');
  await storageBench.run(async (i) => {
    const log = createMockLog(i);
    await mockStorageManager.store(log);
  }, 1000);

  // 5. Kafka publish performance
  const kafkaBench = new Benchmark('Kafka Publish Only');
  await kafkaBench.run(async (i) => {
    const log = createMockLog(i);
    await mockKafkaService.sendLog(log);
  }, 1000);

  // 6. Memory usage test
  console.log('\n=== Memory Usage Test ===');
  const initialMemory = process.memoryUsage();
  
  const largeBatch = Array.from({ length: 10000 }, (_, i) => createMockLog(i));
  
  const afterCreation = process.memoryUsage();
  console.log(`Memory after creating 10,000 logs:`);
  console.log(`  Heap Used: ${((afterCreation.heapUsed - initialMemory.heapUsed) / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  RSS: ${((afterCreation.rss - initialMemory.rss) / 1024 / 1024).toFixed(2)} MB`);

  // 7. Concurrent processing
  const concurrentBench = new Benchmark('Concurrent Processing (100 concurrent logs)');
  await concurrentBench.run(async (i) => {
    const promises = Array.from({ length: 100 }, (_, j) => {
      const log = createMockLog(i * 100 + j);
      return Promise.all([
        mockKafkaService.sendLog(log),
        mockStorageManager.store(log),
        mockMLService.enrichLog(log)
      ]);
    });
    await Promise.all(promises);
  }, 10);

  // 8. JSON serialization performance
  const serializationBench = new Benchmark('JSON Serialization');
  const testLog = createMockLog(0);
  await serializationBench.run(async () => {
    JSON.stringify(testLog);
  }, 10000);

  console.log('\n=== Benchmark Complete ===');
}

// Run benchmarks
runBenchmarks().catch(console.error);