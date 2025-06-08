/**
 * Unit tests for the Event Bus
 */

import { EventBus } from '../event-bus/event-bus';
import { IEventEmitter, IEventData } from '../event-bus/interfaces';
import { Logger } from '@utils/logger';

class MockLogger implements Logger {
  info = jest.fn();
  warn = jest.fn();
  error = jest.fn();
  debug = jest.fn();
}

interface TestEventData extends IEventData {
  testValue: string;
  timestamp: Date;
}

describe('EventBus', () => {
  let eventBus: EventBus;
  let logger: MockLogger;

  beforeEach(() => {
    logger = new MockLogger();
    eventBus = new EventBus(logger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('on', () => {
    it('should register event handler', () => {
      const handler = jest.fn();
      eventBus.on('test:event', handler);
      
      eventBus.emit('test:event', { testValue: 'test', timestamp: new Date() });
      
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ testValue: 'test' })
      );
    });

    it('should register multiple handlers for same event', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      
      eventBus.on('test:event', handler1);
      eventBus.on('test:event', handler2);
      
      eventBus.emit('test:event', { testValue: 'test', timestamp: new Date() });
      
      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it('should support wildcard handlers', () => {
      const wildcardHandler = jest.fn();
      eventBus.on('*', wildcardHandler);
      
      eventBus.emit('test:event1', { testValue: 'test1', timestamp: new Date() });
      eventBus.emit('test:event2', { testValue: 'test2', timestamp: new Date() });
      
      expect(wildcardHandler).toHaveBeenCalledTimes(2);
    });

    it('should support namespace wildcard handlers', () => {
      const namespaceHandler = jest.fn();
      eventBus.on('plugin:*', namespaceHandler);
      
      eventBus.emit('plugin:loaded', { testValue: 'loaded', timestamp: new Date() });
      eventBus.emit('plugin:unloaded', { testValue: 'unloaded', timestamp: new Date() });
      eventBus.emit('system:ready', { testValue: 'ready', timestamp: new Date() });
      
      expect(namespaceHandler).toHaveBeenCalledTimes(2);
    });
  });

  describe('once', () => {
    it('should register handler that fires only once', () => {
      const handler = jest.fn();
      eventBus.once('test:event', handler);
      
      eventBus.emit('test:event', { testValue: 'test1', timestamp: new Date() });
      eventBus.emit('test:event', { testValue: 'test2', timestamp: new Date() });
      
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ testValue: 'test1' })
      );
    });
  });

  describe('off', () => {
    it('should remove specific handler', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      
      eventBus.on('test:event', handler1);
      eventBus.on('test:event', handler2);
      
      eventBus.off('test:event', handler1);
      
      eventBus.emit('test:event', { testValue: 'test', timestamp: new Date() });
      
      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it('should remove all handlers for event if no handler specified', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      
      eventBus.on('test:event', handler1);
      eventBus.on('test:event', handler2);
      
      eventBus.off('test:event');
      
      eventBus.emit('test:event', { testValue: 'test', timestamp: new Date() });
      
      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).not.toHaveBeenCalled();
    });
  });

  describe('emit', () => {
    it('should emit event to all handlers', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      const wildcardHandler = jest.fn();
      
      eventBus.on('test:event', handler1);
      eventBus.on('test:event', handler2);
      eventBus.on('*', wildcardHandler);
      
      const eventData: TestEventData = { testValue: 'test', timestamp: new Date() };
      eventBus.emit('test:event', eventData);
      
      expect(handler1).toHaveBeenCalledWith(eventData);
      expect(handler2).toHaveBeenCalledWith(eventData);
      expect(wildcardHandler).toHaveBeenCalledWith(eventData);
    });

    it('should log emitted events', () => {
      eventBus.emit('test:event', { testValue: 'test', timestamp: new Date() });
      
      expect(logger.debug).toHaveBeenCalledWith(
        'Event emitted',
        expect.objectContaining({ event: 'test:event' })
      );
    });

    it('should handle handler errors gracefully', () => {
      const errorHandler = jest.fn(() => {
        throw new Error('Handler error');
      });
      const normalHandler = jest.fn();
      
      eventBus.on('test:event', errorHandler);
      eventBus.on('test:event', normalHandler);
      
      eventBus.emit('test:event', { testValue: 'test', timestamp: new Date() });
      
      expect(errorHandler).toHaveBeenCalled();
      expect(normalHandler).toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(
        'Error in event handler',
        expect.objectContaining({ event: 'test:event' })
      );
    });
  });

  describe('emitAsync', () => {
    it('should emit event asynchronously', async () => {
      const asyncHandler = jest.fn().mockResolvedValue('result');
      eventBus.on('test:event', asyncHandler);
      
      await eventBus.emitAsync('test:event', { testValue: 'test', timestamp: new Date() });
      
      expect(asyncHandler).toHaveBeenCalled();
    });

    it('should wait for all async handlers', async () => {
      const results: number[] = [];
      
      const handler1 = jest.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        results.push(1);
      });
      
      const handler2 = jest.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 5));
        results.push(2);
      });
      
      eventBus.on('test:event', handler1);
      eventBus.on('test:event', handler2);
      
      await eventBus.emitAsync('test:event', { testValue: 'test', timestamp: new Date() });
      
      expect(results).toEqual([2, 1]); // handler2 finishes first
    });

    it('should handle async handler errors', async () => {
      const errorHandler = jest.fn().mockRejectedValue(new Error('Async error'));
      const normalHandler = jest.fn().mockResolvedValue('success');
      
      eventBus.on('test:event', errorHandler);
      eventBus.on('test:event', normalHandler);
      
      await eventBus.emitAsync('test:event', { testValue: 'test', timestamp: new Date() });
      
      expect(errorHandler).toHaveBeenCalled();
      expect(normalHandler).toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(
        'Error in async event handler',
        expect.objectContaining({ event: 'test:event' })
      );
    });
  });

  describe('hasListeners', () => {
    it('should return true if event has listeners', () => {
      eventBus.on('test:event', jest.fn());
      
      expect(eventBus.hasListeners('test:event')).toBe(true);
    });

    it('should return false if event has no listeners', () => {
      expect(eventBus.hasListeners('test:event')).toBe(false);
    });

    it('should consider wildcard listeners', () => {
      eventBus.on('*', jest.fn());
      
      expect(eventBus.hasListeners('any:event')).toBe(true);
    });
  });

  describe('listenerCount', () => {
    it('should return correct listener count', () => {
      eventBus.on('test:event', jest.fn());
      eventBus.on('test:event', jest.fn());
      eventBus.on('other:event', jest.fn());
      
      expect(eventBus.listenerCount('test:event')).toBe(2);
      expect(eventBus.listenerCount('other:event')).toBe(1);
      expect(eventBus.listenerCount('no:event')).toBe(0);
    });
  });

  describe('clear', () => {
    it('should remove all event listeners', () => {
      eventBus.on('test:event1', jest.fn());
      eventBus.on('test:event2', jest.fn());
      eventBus.on('*', jest.fn());
      
      eventBus.clear();
      
      expect(eventBus.hasListeners('test:event1')).toBe(false);
      expect(eventBus.hasListeners('test:event2')).toBe(false);
      expect(eventBus.hasListeners('*')).toBe(false);
    });
  });

  describe('event ordering', () => {
    it('should execute handlers in registration order', () => {
      const order: number[] = [];
      
      eventBus.on('test:event', () => order.push(1));
      eventBus.on('test:event', () => order.push(2));
      eventBus.on('test:event', () => order.push(3));
      
      eventBus.emit('test:event', { testValue: 'test', timestamp: new Date() });
      
      expect(order).toEqual([1, 2, 3]);
    });
  });

  describe('memory management', () => {
    it('should not leak memory when handlers are removed', () => {
      const handler = jest.fn();
      
      // Add and remove handler multiple times
      for (let i = 0; i < 100; i++) {
        eventBus.on('test:event', handler);
        eventBus.off('test:event', handler);
      }
      
      expect(eventBus.listenerCount('test:event')).toBe(0);
    });
  });
});