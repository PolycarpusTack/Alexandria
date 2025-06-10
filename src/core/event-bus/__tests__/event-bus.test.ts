import { EventBusImpl } from '../event-bus';
import { Event, EventData, Subscription } from '../interfaces';

// Mock logger
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

describe('EventBus', () => {
  let eventBus: EventBusImpl;

  beforeEach(() => {
    eventBus = new EventBusImpl(mockLogger as any);
    jest.clearAllMocks();
  });

  afterEach(() => {
    eventBus.clearAllSubscriptions();
  });

  describe('subscribe', () => {
    it('should register a subscription', () => {
      const handler = jest.fn();
      const subscription = eventBus.subscribe('test.topic', handler);

      expect(subscription).toBeDefined();
      expect(subscription.id).toBeDefined();
      expect(subscription.topic).toBe('test.topic');
      expect(eventBus.getSubscriberCount('test.topic')).toBe(1);
    });

    it('should throw error with invalid parameters', () => {
      expect(() => eventBus.subscribe('', jest.fn())).toThrow('Topic is required');
      expect(() => eventBus.subscribe('test.topic', null as any)).toThrow('Handler must be a function');
    });

    it('should support subscription with expiration', async () => {
      const handler = jest.fn();
      eventBus.subscribe('test.topic', handler, { expiresIn: 50 });
      
      expect(eventBus.getSubscriberCount('test.topic')).toBe(1);
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Publish after expiration
      await eventBus.publish('test.topic', { value: 'test' });
      expect(handler).not.toHaveBeenCalled();
      expect(eventBus.getSubscriberCount('test.topic')).toBe(0);
    });

    it('should support subscription with max events', async () => {
      const handler = jest.fn();
      eventBus.subscribe('test.topic', handler, { maxEvents: 2 });
      
      await eventBus.publish('test.topic', { value: 'test1' });
      await eventBus.publish('test.topic', { value: 'test2' });
      
      expect(handler).toHaveBeenCalledTimes(2);
      expect(eventBus.getSubscriberCount('test.topic')).toBe(0);
      
      // Publish after max events reached
      await eventBus.publish('test.topic', { value: 'test3' });
      expect(handler).toHaveBeenCalledTimes(2);
    });
  });

  describe('subscribePattern', () => {
    it('should register a pattern subscription', () => {
      const handler = jest.fn();
      const subscription = eventBus.subscribePattern('test.*', handler);

      expect(subscription).toBeDefined();
      expect(subscription.id).toBeDefined();
      expect(subscription.topic).toBe('test.*');
    });

    it('should throw error with invalid parameters', () => {
      expect(() => eventBus.subscribePattern('', jest.fn())).toThrow('Topic pattern is required');
      expect(() => eventBus.subscribePattern('test.*', null as any)).toThrow('Handler must be a function');
    });

    it('should match events according to pattern', async () => {
      const handler = jest.fn();
      eventBus.subscribePattern('test.*', handler);
      
      await eventBus.publish('test.one', { value: 'test1' });
      await eventBus.publish('test.two', { value: 'test2' });
      await eventBus.publish('other.topic', { value: 'test3' });
      
      expect(handler).toHaveBeenCalledTimes(2);
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ topic: 'test.one' }));
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ topic: 'test.two' }));
    });
  });

  describe('publish', () => {
    it('should deliver events to all matching subscribers', async () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      
      eventBus.subscribe('test.topic', handler1);
      eventBus.subscribe('test.topic', handler2);
      
      const result = await eventBus.publish('test.topic', { value: 'test' });
      
      expect(result.deliveredToCount).toBe(2);
      expect(result.errors.length).toBe(0);
      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it('should throw error if topic is not provided', async () => {
      await expect(eventBus.publish('', { value: 'test' })).rejects.toThrow('Topic is required');
    });

    it('should honor priority order', async () => {
      const executionOrder: number[] = [];
      
      const handler1 = jest.fn(() => { executionOrder.push(1); });
      const handler2 = jest.fn(() => { executionOrder.push(2); });
      const handler3 = jest.fn(() => { executionOrder.push(3); });
      
      eventBus.subscribe('test.topic', handler1, { priority: 5 });
      eventBus.subscribe('test.topic', handler2, { priority: 10 });
      eventBus.subscribe('test.topic', handler3, { priority: 1 });
      
      await eventBus.publish('test.topic', { value: 'test' });
      
      expect(executionOrder).toEqual([2, 1, 3]);
    });

    it('should handle minPriority in publish options', async () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      const handler3 = jest.fn();
      
      eventBus.subscribe('test.topic', handler1, { priority: 5 });
      eventBus.subscribe('test.topic', handler2, { priority: 10 });
      eventBus.subscribe('test.topic', handler3, { priority: 1 });
      
      const result = await eventBus.publish('test.topic', { value: 'test' }, { minPriority: 5 });
      
      expect(result.deliveredToCount).toBe(2);
      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
      expect(handler3).not.toHaveBeenCalled();
    });

    it('should handle errors in handlers', async () => {
      const goodHandler = jest.fn();
      const badHandler = jest.fn().mockImplementation(() => {
        throw new Error('Test error');
      });
      
      eventBus.subscribe('test.topic', goodHandler);
      eventBus.subscribe('test.topic', badHandler, { isolateErrors: true });
      
      const result = await eventBus.publish('test.topic', { value: 'test' }, { ignoreErrors: true });
      
      expect(result.deliveredToCount).toBe(2);
      expect(result.errors.length).toBe(1);
      expect(goodHandler).toHaveBeenCalledTimes(1);
      expect(badHandler).toHaveBeenCalledTimes(1);
    });

    it('should respect filter functions', async () => {
      const handler = jest.fn();
      
      const filter = (event: Event) => event.data.value > 5;
      
      eventBus.subscribe('test.topic', handler, { filter });
      
      await eventBus.publish('test.topic', { value: 3 });
      expect(handler).not.toHaveBeenCalled();
      
      await eventBus.publish('test.topic', { value: 10 });
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should wait for async handlers when waitForHandlers is true', async () => {
      let asyncOperationCompleted = false;
      
      const asyncHandler = jest.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(() => {
          asyncOperationCompleted = true;
          resolve(undefined);
        }, 50));
      });
      
      eventBus.subscribe('test.topic', asyncHandler);
      
      await eventBus.publish('test.topic', { value: 'test' }, { waitForHandlers: true });
      
      expect(asyncHandler).toHaveBeenCalledTimes(1);
      expect(asyncOperationCompleted).toBe(true);
    });
  });

  describe('unsubscribe', () => {
    it('should remove a subscription by ID', () => {
      const handler = jest.fn();
      const subscription = eventBus.subscribe('test.topic', handler);
      
      expect(eventBus.getSubscriberCount('test.topic')).toBe(1);
      
      const result = eventBus.unsubscribe(subscription.id);
      
      expect(result).toBe(true);
      expect(eventBus.getSubscriberCount('test.topic')).toBe(0);
    });

    it('should return false if subscription ID is invalid', () => {
      const result = eventBus.unsubscribe('invalid-id');
      expect(result).toBe(false);
    });

    it('should allow unsubscribing through subscription object', () => {
      const handler = jest.fn();
      const subscription = eventBus.subscribe('test.topic', handler);
      
      expect(eventBus.getSubscriberCount('test.topic')).toBe(1);
      
      subscription.unsubscribe();
      
      expect(eventBus.getSubscriberCount('test.topic')).toBe(0);
    });
  });

  describe('getSubscriberCount', () => {
    it('should return the number of subscribers for a topic', () => {
      expect(eventBus.getSubscriberCount('test.topic')).toBe(0);
      
      eventBus.subscribe('test.topic', jest.fn());
      expect(eventBus.getSubscriberCount('test.topic')).toBe(1);
      
      eventBus.subscribe('test.topic', jest.fn());
      expect(eventBus.getSubscriberCount('test.topic')).toBe(2);
    });

    it('should return 0 for empty topic', () => {
      expect(eventBus.getSubscriberCount('')).toBe(0);
    });
  });

  describe('getActiveTopics', () => {
    it('should return a list of all active topics', () => {
      expect(eventBus.getActiveTopics()).toEqual([]);
      
      eventBus.subscribe('test.topic1', jest.fn());
      eventBus.subscribe('test.topic2', jest.fn());
      eventBus.subscribe('test.topic2', jest.fn());
      
      const activeTopics = eventBus.getActiveTopics();
      expect(activeTopics).toContain('test.topic1');
      expect(activeTopics).toContain('test.topic2');
      expect(activeTopics.length).toBe(2);
    });

    it('should not include pattern topics', () => {
      eventBus.subscribe('test.topic1', jest.fn());
      eventBus.subscribePattern('test.*', jest.fn());
      
      const activeTopics = eventBus.getActiveTopics();
      expect(activeTopics).toContain('test.topic1');
      expect(activeTopics).not.toContain('test.*');
      expect(activeTopics.length).toBe(1);
    });
  });

  describe('clearAllSubscriptions', () => {
    it('should remove all subscriptions', () => {
      eventBus.subscribe('test.topic1', jest.fn());
      eventBus.subscribe('test.topic2', jest.fn());
      
      expect(eventBus.getActiveTopics().length).toBe(2);
      
      eventBus.clearAllSubscriptions();
      
      expect(eventBus.getActiveTopics().length).toBe(0);
      expect(eventBus.getSubscriberCount('test.topic1')).toBe(0);
      expect(eventBus.getSubscriberCount('test.topic2')).toBe(0);
    });
  });

  describe('Performance and Concurrency', () => {
    it('should handle many subscribers efficiently', async () => {
      const handlers = Array(100).fill(null).map(() => jest.fn());
      handlers.forEach(handler => eventBus.subscribe('test.topic', handler));
      
      const start = Date.now();
      await eventBus.publish('test.topic', { value: 'test' });
      const duration = Date.now() - start;
      
      expect(duration).toBeLessThan(100); // Should complete in < 100ms
      handlers.forEach(handler => expect(handler).toHaveBeenCalledTimes(1));
    });

    it('should handle concurrent publishes', async () => {
      const handler = jest.fn();
      eventBus.subscribe('test.topic', handler);
      
      const promises = Array(50).fill(null).map((_, i) => 
        eventBus.publish('test.topic', { value: i })
      );
      
      const results = await Promise.all(promises);
      
      expect(handler).toHaveBeenCalledTimes(50);
      results.forEach(result => {
        expect(result.deliveredToCount).toBe(1);
        expect(result.errors).toHaveLength(0);
      });
    });

    it('should handle many different topics', async () => {
      const topics = Array(50).fill(null).map((_, i) => `test.topic.${i}`);
      const handlers = new Map();
      
      topics.forEach(topic => {
        const handler = jest.fn();
        handlers.set(topic, handler);
        eventBus.subscribe(topic, handler);
      });
      
      const promises = topics.map(topic => 
        eventBus.publish(topic, { value: topic })
      );
      
      await Promise.all(promises);
      
      handlers.forEach((handler, topic) => {
        expect(handler).toHaveBeenCalledWith(
          expect.objectContaining({
            topic,
            data: { value: topic }
          })
        );
      });
    });
  });

  describe('Memory Management', () => {
    it('should clean up expired subscriptions', async () => {
      const handler = jest.fn();
      
      // Create multiple expiring subscriptions
      for (let i = 0; i < 10; i++) {
        eventBus.subscribe('test.topic', handler, { expiresIn: 50 });
      }
      
      expect(eventBus.getSubscriberCount('test.topic')).toBe(10);
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Trigger cleanup by publishing
      await eventBus.publish('test.topic', { value: 'test' });
      
      expect(eventBus.getSubscriberCount('test.topic')).toBe(0);
      expect(handler).not.toHaveBeenCalled();
    });

    it('should handle subscription lifecycle correctly', () => {
      const handler = jest.fn();
      const subscription = eventBus.subscribe('test.topic', handler);
      
      // Subscription should have correct properties
      expect(subscription.id).toBeDefined();
      expect(subscription.topic).toBe('test.topic');
      expect(subscription.unsubscribe).toBeInstanceOf(Function);
      
      // Double unsubscribe should be safe
      subscription.unsubscribe();
      subscription.unsubscribe(); // Should not throw
      
      expect(eventBus.getSubscriberCount('test.topic')).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined data gracefully', async () => {
      const handler = jest.fn();
      eventBus.subscribe('test.topic', handler);
      
      const result = await eventBus.publish('test.topic', undefined as any);
      
      expect(result.deliveredToCount).toBe(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          data: undefined
        })
      );
    });

    it('should handle circular reference in event data', async () => {
      const handler = jest.fn();
      eventBus.subscribe('test.topic', handler);
      
      const data: any = { a: 1 };
      data.circular = data;
      
      const result = await eventBus.publish('test.topic', data);
      
      expect(result.deliveredToCount).toBe(1);
      expect(handler).toHaveBeenCalled();
    });

    it('should handle pattern with special regex characters', async () => {
      const handler = jest.fn();
      eventBus.subscribePattern('test.*.end', handler);
      
      await eventBus.publish('test.middle.end', { value: 'match' });
      await eventBus.publish('test.other.notend', { value: 'nomatch' });
      
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          topic: 'test.middle.end'
        })
      );
    });

    it('should handle subscription removal during event handling', async () => {
      let subscription: Subscription;
      
      const handler1 = jest.fn(() => {
        subscription.unsubscribe();
      });
      const handler2 = jest.fn();
      
      subscription = eventBus.subscribe('test.topic', handler1);
      eventBus.subscribe('test.topic', handler2);
      
      await eventBus.publish('test.topic', { value: 'test' });
      
      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
      expect(eventBus.getSubscriberCount('test.topic')).toBe(1);
    });
  });

  describe('Priority and Filtering', () => {
    it('should execute filters before handlers', async () => {
      const handler = jest.fn();
      const filter = jest.fn((event: Event) => event.data.value > 5);
      
      eventBus.subscribe('test.topic', handler, { filter });
      
      await eventBus.publish('test.topic', { value: 3 });
      expect(filter).toHaveBeenCalledTimes(1);
      expect(handler).not.toHaveBeenCalled();
      
      await eventBus.publish('test.topic', { value: 10 });
      expect(filter).toHaveBeenCalledTimes(2);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should handle errors in filter functions', async () => {
      const handler = jest.fn();
      const filter = jest.fn(() => {
        throw new Error('Filter error');
      });
      
      eventBus.subscribe('test.topic', handler, { filter, isolateErrors: true });
      
      const result = await eventBus.publish('test.topic', { value: 'test' });
      
      expect(result.errors).toHaveLength(1);
      expect(handler).not.toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should respect priority with mixed subscription types', async () => {
      const executionOrder: string[] = [];
      
      const handler1 = () => executionOrder.push('pattern');
      const handler2 = () => executionOrder.push('high');
      const handler3 = () => executionOrder.push('low');
      
      eventBus.subscribePattern('test.*', handler1, { priority: 5 });
      eventBus.subscribe('test.topic', handler2, { priority: 10 });
      eventBus.subscribe('test.topic', handler3, { priority: 1 });
      
      await eventBus.publish('test.topic', { value: 'test' });
      
      expect(executionOrder).toEqual(['high', 'pattern', 'low']);
    });
  });

  describe('Metadata and Context', () => {
    it('should include metadata in events', async () => {
      const handler = jest.fn();
      eventBus.subscribe('test.topic', handler);
      
      await eventBus.publish('test.topic', { value: 'test' });
      
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.any(String),
          topic: 'test.topic',
          timestamp: expect.any(Date),
          data: { value: 'test' }
        })
      );
    });

    it('should propagate source information', async () => {
      const handler = jest.fn();
      eventBus.subscribe('test.topic', handler);
      
      const source = { component: 'TestComponent', version: '1.0.0' };
      await eventBus.publish('test.topic', { value: 'test' }, { source });
      
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          source
        })
      );
    });
  });

  describe('Wildcard Patterns', () => {
    it('should support complex wildcard patterns', async () => {
      const handler = jest.fn();
      
      // Test various wildcard patterns
      eventBus.subscribePattern('system.*.error', handler);
      
      await eventBus.publish('system.auth.error', { value: 'auth error' });
      await eventBus.publish('system.db.error', { value: 'db error' });
      await eventBus.publish('system.auth.success', { value: 'not error' });
      await eventBus.publish('app.auth.error', { value: 'wrong prefix' });
      
      expect(handler).toHaveBeenCalledTimes(2);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ topic: 'system.auth.error' })
      );
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ topic: 'system.db.error' })
      );
    });

    it('should handle multiple wildcards', async () => {
      const handler = jest.fn();
      
      eventBus.subscribePattern('*.*.info', handler);
      
      await eventBus.publish('app.module.info', { value: 'match' });
      await eventBus.publish('system.auth.info', { value: 'match' });
      await eventBus.publish('app.info', { value: 'no match' });
      
      expect(handler).toHaveBeenCalledTimes(2);
    });
  });
});