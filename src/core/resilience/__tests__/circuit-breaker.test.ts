/**
 * Comprehensive test suite for Circuit Breaker
 * 
 * Tests cover circuit states, failure handling, timeouts, metrics,
 * and the circuit breaker factory.
 */

import { CircuitBreaker, CircuitBreakerFactory, CircuitState, CircuitBreakerConfig } from '../circuit-breaker';
import { Logger } from '../../../utils/logger';
import { EventBus } from '../../event-bus/event-bus';

describe('CircuitBreaker', () => {
  let circuitBreaker: CircuitBreaker;
  let mockLogger: jest.Mocked<Logger>;
  let mockEventBus: jest.Mocked<EventBus>;

  const defaultConfig: Partial<CircuitBreakerConfig> = {
    failureThreshold: 3,
    resetTimeout: 1000,
    successThreshold: 2,
    timeout: 500,
    volumeThreshold: 5,
    errorThresholdPercentage: 50
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    } as any;

    mockEventBus = {
      emit: jest.fn(),
      on: jest.fn(),
      off: jest.fn(),
      once: jest.fn()
    } as any;

    circuitBreaker = new CircuitBreaker(
      'test-breaker',
      mockLogger,
      mockEventBus,
      defaultConfig
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Circuit States', () => {
    it('should start in CLOSED state', () => {
      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
    });

    it('should execute successful calls in CLOSED state', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');
      
      const result = await circuitBreaker.execute(mockFn);
      
      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
    });

    it('should open circuit after failure threshold', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('Failed'));
      
      // Fail 3 times (failure threshold)
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(mockFn)).rejects.toThrow('Failed');
      }
      
      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Circuit breaker opened for test-breaker',
        expect.objectContaining({
          failures: 3
        })
      );
    });

    it('should reject calls when circuit is OPEN', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');
      
      // Force open the circuit
      circuitBreaker.forceOpen();
      
      await expect(circuitBreaker.execute(mockFn)).rejects.toThrow(
        'Circuit breaker is OPEN for test-breaker'
      );
      
      expect(mockFn).not.toHaveBeenCalled();
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'circuit-breaker:rejected',
        expect.objectContaining({
          name: 'test-breaker'
        })
      );
    });

    it('should transition to HALF_OPEN after reset timeout', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');
      
      // Force open the circuit
      circuitBreaker.forceOpen();
      
      // Advance time past reset timeout
      jest.advanceTimersByTime(1001);
      
      // Should transition to HALF_OPEN and execute
      const result = await circuitBreaker.execute(mockFn);
      
      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(circuitBreaker.getState()).toBe(CircuitState.HALF_OPEN);
    });

    it('should close circuit after success threshold in HALF_OPEN', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');
      
      // Force to HALF_OPEN state
      circuitBreaker.forceOpen();
      jest.advanceTimersByTime(1001);
      
      // Execute successfully twice (success threshold)
      await circuitBreaker.execute(mockFn);
      expect(circuitBreaker.getState()).toBe(CircuitState.HALF_OPEN);
      
      await circuitBreaker.execute(mockFn);
      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Circuit breaker closed for test-breaker'
      );
    });

    it('should reopen circuit on failure in HALF_OPEN', async () => {
      const mockFn = jest.fn()
        .mockResolvedValueOnce('success')
        .mockRejectedValueOnce(new Error('Failed'));
      
      // Force to HALF_OPEN state
      circuitBreaker.forceOpen();
      jest.advanceTimersByTime(1001);
      
      // First call succeeds
      await circuitBreaker.execute(mockFn);
      expect(circuitBreaker.getState()).toBe(CircuitState.HALF_OPEN);
      
      // Second call fails
      await expect(circuitBreaker.execute(mockFn)).rejects.toThrow('Failed');
      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);
      
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Circuit breaker opened for test-breaker (half-open failure)'
      );
    });
  });

  describe('Timeout Handling', () => {
    it('should timeout long-running calls', async () => {
      const mockFn = jest.fn().mockImplementation(() => {
        return new Promise(resolve => {
          setTimeout(() => resolve('success'), 1000);
        });
      });
      
      const promise = circuitBreaker.execute(mockFn);
      
      // Advance time past timeout
      jest.advanceTimersByTime(501);
      
      await expect(promise).rejects.toThrow('Call timeout after 500ms');
    });

    it('should count timeouts as failures', async () => {
      const mockFn = jest.fn().mockImplementation(() => {
        return new Promise(resolve => {
          setTimeout(() => resolve('success'), 1000);
        });
      });
      
      // Cause 3 timeouts
      for (let i = 0; i < 3; i++) {
        const promise = circuitBreaker.execute(mockFn);
        jest.advanceTimersByTime(501);
        await expect(promise).rejects.toThrow('Call timeout');
      }
      
      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);
    });
  });

  describe('Volume-based Opening', () => {
    it('should open based on error percentage when volume threshold met', async () => {
      const mockFn = jest.fn()
        .mockResolvedValueOnce('success')
        .mockResolvedValueOnce('success')
        .mockRejectedValueOnce(new Error('Failed'))
        .mockRejectedValueOnce(new Error('Failed'))
        .mockRejectedValueOnce(new Error('Failed'));
      
      // 5 calls total (volume threshold), 3 failures = 60% error rate
      for (let i = 0; i < 5; i++) {
        try {
          await circuitBreaker.execute(mockFn);
        } catch (e) {
          // Expected failures
        }
      }
      
      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);
    });

    it('should not open if volume threshold not met', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('Failed'));
      
      // Only 2 calls (below volume threshold of 5)
      for (let i = 0; i < 2; i++) {
        await expect(circuitBreaker.execute(mockFn)).rejects.toThrow('Failed');
      }
      
      // Should still be closed (not enough volume)
      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
    });
  });

  describe('Metrics', () => {
    it('should track metrics correctly', async () => {
      const mockFn = jest.fn()
        .mockResolvedValueOnce('success')
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce('success');
      
      // Execute calls
      await circuitBreaker.execute(mockFn);
      await expect(circuitBreaker.execute(mockFn)).rejects.toThrow();
      await circuitBreaker.execute(mockFn);
      
      const metrics = circuitBreaker.getMetrics();
      
      expect(metrics.totalCalls).toBe(3);
      expect(metrics.successfulCalls).toBe(2);
      expect(metrics.failedCalls).toBe(1);
      expect(metrics.state).toBe(CircuitState.CLOSED);
      expect(metrics.averageResponseTime).toBeGreaterThan(0);
      expect(metrics.lastFailureTime).toBeDefined();
    });

    it('should calculate average response time', async () => {
      const delays = [100, 200, 300];
      const mockFn = jest.fn();
      
      for (const delay of delays) {
        mockFn.mockImplementationOnce(() => {
          return new Promise(resolve => {
            setTimeout(() => resolve('success'), delay);
          });
        });
        
        const promise = circuitBreaker.execute(mockFn);
        jest.advanceTimersByTime(delay);
        await promise;
      }
      
      const metrics = circuitBreaker.getMetrics();
      // Average should be around 200ms (100+200+300)/3
      expect(metrics.averageResponseTime).toBeGreaterThan(150);
      expect(metrics.averageResponseTime).toBeLessThan(250);
    });
  });

  describe('Reset Functionality', () => {
    it('should reset all state', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('Failed'));
      
      // Cause failures to open circuit
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(mockFn)).rejects.toThrow();
      }
      
      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);
      
      // Reset
      circuitBreaker.reset();
      
      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
      const metrics = circuitBreaker.getMetrics();
      expect(metrics.failedCalls).toBe(0);
      expect(metrics.lastFailureTime).toBeUndefined();
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Circuit breaker reset for test-breaker'
      );
    });
  });

  describe('Force Open', () => {
    it('should force circuit to open state', () => {
      circuitBreaker.forceOpen();
      
      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Circuit breaker forced open for test-breaker'
      );
    });
  });

  describe('Event Emissions', () => {
    it('should emit state change events', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('Failed'));
      
      // Cause circuit to open
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(mockFn)).rejects.toThrow();
      }
      
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'circuit-breaker:state-change',
        expect.objectContaining({
          name: 'test-breaker',
          newState: CircuitState.OPEN
        })
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle synchronous errors', async () => {
      const mockFn = jest.fn().mockImplementation(() => {
        throw new Error('Sync error');
      });
      
      await expect(circuitBreaker.execute(mockFn)).rejects.toThrow('Sync error');
      
      const metrics = circuitBreaker.getMetrics();
      expect(metrics.failedCalls).toBe(1);
    });

    it('should handle functions returning non-promises', async () => {
      const mockFn = jest.fn().mockReturnValue('sync-value');
      
      const result = await circuitBreaker.execute(mockFn as any);
      
      expect(result).toBe('sync-value');
    });

    it('should clean old metrics data', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');
      
      // Execute many calls
      for (let i = 0; i < 150; i++) {
        await circuitBreaker.execute(mockFn);
      }
      
      // Should only keep last 100 response times
      const metrics = circuitBreaker.getMetrics();
      expect(metrics).toBeDefined();
    });
  });
});

describe('CircuitBreakerFactory', () => {
  let factory: CircuitBreakerFactory;
  let mockLogger: jest.Mocked<Logger>;
  let mockEventBus: jest.Mocked<EventBus>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    } as any;

    mockEventBus = {
      emit: jest.fn(),
      on: jest.fn(),
      off: jest.fn(),
      once: jest.fn()
    } as any;

    factory = new CircuitBreakerFactory(mockLogger, mockEventBus);
  });

  it('should create new circuit breaker', () => {
    const breaker = factory.getBreaker('test-service');
    
    expect(breaker).toBeDefined();
    expect(breaker.getState()).toBe(CircuitState.CLOSED);
  });

  it('should return existing circuit breaker', () => {
    const breaker1 = factory.getBreaker('test-service');
    const breaker2 = factory.getBreaker('test-service');
    
    expect(breaker1).toBe(breaker2);
  });

  it('should create breaker with custom config', () => {
    const config = { failureThreshold: 10 };
    const breaker = factory.getBreaker('test-service', config);
    
    expect(breaker).toBeDefined();
  });

  it('should get all breakers', () => {
    factory.getBreaker('service-1');
    factory.getBreaker('service-2');
    factory.getBreaker('service-3');
    
    const allBreakers = factory.getAllBreakers();
    
    expect(allBreakers.size).toBe(3);
    expect(allBreakers.has('service-1')).toBe(true);
    expect(allBreakers.has('service-2')).toBe(true);
    expect(allBreakers.has('service-3')).toBe(true);
  });

  it('should get metrics for all breakers', () => {
    factory.getBreaker('service-1');
    factory.getBreaker('service-2');
    
    const allMetrics = factory.getAllMetrics();
    
    expect(Object.keys(allMetrics)).toHaveLength(2);
    expect(allMetrics['service-1']).toBeDefined();
    expect(allMetrics['service-2']).toBeDefined();
    expect(allMetrics['service-1'].state).toBe(CircuitState.CLOSED);
  });

  it('should reset all breakers', () => {
    const breaker1 = factory.getBreaker('service-1');
    const breaker2 = factory.getBreaker('service-2');
    
    // Force open both
    breaker1.forceOpen();
    breaker2.forceOpen();
    
    expect(breaker1.getState()).toBe(CircuitState.OPEN);
    expect(breaker2.getState()).toBe(CircuitState.OPEN);
    
    // Reset all
    factory.resetAll();
    
    expect(breaker1.getState()).toBe(CircuitState.CLOSED);
    expect(breaker2.getState()).toBe(CircuitState.CLOSED);
  });
});