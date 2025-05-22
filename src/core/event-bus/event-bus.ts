import { 
  EventBus, 
  Event, 
  EventHandler, 
  Subscription, 
  SubscriptionOptions, 
  PublicationOptions,
  PublicationResult, 
  EventData 
} from './interfaces';
import { Logger } from '../../utils/logger';
import { v4 as uuidv4 } from 'uuid';

/**
 * EventSubscription internal class to track subscriptions
 */
class EventSubscription implements Subscription {
  public id: string;
  public topic: string;
  public handler: EventHandler;
  public options: SubscriptionOptions;
  public eventCount: number = 0;
  public createdAt: Date;
  public expiresAt?: Date;
  public isPattern: boolean;
  public pattern?: RegExp;

  constructor(
    topic: string, 
    handler: EventHandler, 
    options: SubscriptionOptions = {},
    isPattern: boolean = false
  ) {
    this.id = uuidv4();
    this.topic = topic;
    this.handler = handler;
    this.options = options;
    this.createdAt = new Date();
    this.isPattern = isPattern;
    
    if (isPattern) {
      // Convert topic pattern to RegExp
      // Replace * with .* and escape other special characters
      const regexPattern = topic
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // Escape special characters
        .replace(/\*/g, '.*'); // Replace * with .*
      this.pattern = new RegExp(`^${regexPattern}$`);
    }
    
    if (options.expiresIn) {
      this.expiresAt = new Date(this.createdAt.getTime() + options.expiresIn);
    }
    
    // Bind unsubscribe method to EventBus instance
    this.unsubscribe = () => {
      // This will be set by the EventBusImpl class
      return false;
    };
  }

  /**
   * Check if subscription is expired
   */
  isExpired(): boolean {
    if (this.expiresAt && new Date() > this.expiresAt) {
      return true;
    }
    
    if (this.options.maxEvents && this.eventCount >= this.options.maxEvents) {
      return true;
    }
    
    return false;
  }

  /**
   * Check if subscription matches a topic
   */
  matchesTopic(topic: string): boolean {
    if (this.isPattern && this.pattern) {
      return this.pattern.test(topic);
    }
    
    return this.topic === topic;
  }

  /**
   * Placeholder for unsubscribe method
   * This will be overridden by the EventBusImpl class
   */
  unsubscribe(): boolean {
    return false;
  }
}

/**
 * Implementation of the EventBus interface
 */
export class EventBusImpl implements EventBus {
  private subscriptions: Map<string, EventSubscription> = new Map();
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Subscribe to events on a specific topic
   */
  subscribe(topic: string, handler: EventHandler, options: SubscriptionOptions = {}): Subscription {
    if (!topic) {
      throw new Error('Topic is required');
    }
    
    if (!handler || typeof handler !== 'function') {
      throw new Error('Handler must be a function');
    }
    
    const subscription = new EventSubscription(topic, handler, options);
    
    // Override the unsubscribe method to use the EventBus's unsubscribe
    subscription.unsubscribe = () => this.unsubscribe(subscription.id);
    
    this.subscriptions.set(subscription.id, subscription);
    
    this.logger.debug(`Subscribed to topic: ${topic}`, { 
      subscriptionId: subscription.id,
      options
    });
    
    return subscription;
  }

  /**
   * Subscribe to events that match a topic pattern
   */
  subscribePattern(topicPattern: string, handler: EventHandler, options: SubscriptionOptions = {}): Subscription {
    if (!topicPattern) {
      throw new Error('Topic pattern is required');
    }
    
    if (!handler || typeof handler !== 'function') {
      throw new Error('Handler must be a function');
    }
    
    const subscription = new EventSubscription(topicPattern, handler, options, true);
    
    // Override the unsubscribe method to use the EventBus's unsubscribe
    subscription.unsubscribe = () => this.unsubscribe(subscription.id);
    
    this.subscriptions.set(subscription.id, subscription);
    
    this.logger.debug(`Subscribed to topic pattern: ${topicPattern}`, { 
      subscriptionId: subscription.id,
      options
    });
    
    return subscription;
  }

  /**
   * Publish an event to a specific topic
   * 
   * Error handling behavior:
   * 1. All errors from handlers are collected and returned in the result.errors array
   * 2. Error propagation follows these rules:
   *    - If options.ignoreErrors is true: errors are never propagated
   *    - If subscription.options.isolateErrors is true: errors from this handler are not propagated
   *    - Otherwise: errors are propagated (default behavior)
   * 3. Proper logging is always performed:
   *    - Propagated errors are logged at ERROR level
   *    - Contained errors are logged at WARN level
   * 4. When using timeouts with waitForHandlers:
   *    - Timeout errors are added to the errors array
   *    - Timeout errors are only propagated if options.ignoreErrors is false
   */
  async publish(topic: string, data: EventData, options: PublicationOptions = {}): Promise<PublicationResult> {
    if (!topic) {
      throw new Error('Topic is required');
    }
    
    const event: Event = {
      topic,
      data,
      timestamp: new Date(),
      source: options.source
    };
    
    // Find all matching subscriptions
    const matchingSubscriptions = this.getMatchingSubscriptions(topic, options.minPriority);
    
    // Apply filters
    const filteredSubscriptions = matchingSubscriptions.filter(subscription => {
      if (subscription.options.filter) {
        return subscription.options.filter(event);
      }
      return true;
    });
    
    this.logger.debug(`Publishing to topic: ${topic}`, { 
      matchingSubscriptions: filteredSubscriptions.length
    });
    
    const errors: Error[] = [];
    const promises: Promise<void>[] = [];
    
    // Process each subscription
    for (const subscription of filteredSubscriptions) {
      const handlerPromise = this.invokeHandler(subscription, event)
        .catch(error => {
          // Always collect the error
          errors.push(error);
          
          // Determine if we should propagate the error
          const shouldPropagate = !options.ignoreErrors && !subscription.options.isolateErrors;
          
          if (shouldPropagate) {
            this.logger.error(`Error in event handler propagated for topic: ${event.topic}`, {
              subscriptionId: subscription.id,
              propagated: true,
              error: error instanceof Error ? error.message : String(error)
            });
            throw error;
          }
          
          // Log but don't propagate
          this.logger.warn(`Error in event handler contained for topic: ${event.topic}`, {
            subscriptionId: subscription.id,
            propagated: false,
            error: error instanceof Error ? error.message : String(error)
          });
        });
      
      // Create a wrapped promise that always completes event processing
      // regardless of whether we wait for handlers
      const promise = handlerPromise.finally(() => {
        // Increment event count
        subscription.eventCount++;
        
        // Remove if expired
        if (subscription.isExpired()) {
          this.unsubscribe(subscription.id);
        }
      });
      
      // Always track the promise for resource management
      promises.push(promise);
    }
    
    // Always process promises, but only wait if requested
    const processPromises = async () => {
      if (promises.length === 0) return;
      
      try {
        if (options.timeout) {
          // Add timeout
          const timeoutPromise = new Promise<void>((_, reject) => {
            setTimeout(() => {
              reject(new Error(`Timeout after ${options.timeout}ms waiting for event handlers`));
            }, options.timeout);
          });
          
          await Promise.race([Promise.all(promises), timeoutPromise]);
        } else {
          await Promise.all(promises);
        }
      } catch (error) {
        // Add timeout errors to the error list
        if (error instanceof Error) {
          errors.push(error);
        }
        
        // Only rethrow if we're not ignoring errors
        if (!options.ignoreErrors) {
          throw error;
        }
      }
    };
    
    // Wait for handlers if requested, otherwise just process in the background
    if (options.waitForHandlers) {
      await processPromises();
    } else {
      // Fire and forget - still process promises but don't wait
      // This ensures all event count tracking and unsubscribing works
      processPromises().catch(error => {
        // This should never happen since errors are handled inside processPromises
        // But we add an extra catch here as a safety measure
        this.logger.error('Unexpected error in background event processing', {
          topic,
          error: error instanceof Error ? error.message : String(error)
        });
      });
    }
    
    return {
      deliveredToCount: filteredSubscriptions.length,
      errors
    };
  }

  /**
   * Unsubscribe a handler using its subscription ID or topic and handler
   */
  unsubscribe(subscriptionIdOrTopic: string, handler?: EventHandler): boolean {
    // If only subscription ID is provided (single argument)
    if (!handler) {
      if (!subscriptionIdOrTopic) {
        return false;
      }
      
      const removed = this.subscriptions.delete(subscriptionIdOrTopic);
      
      if (removed) {
        this.logger.debug(`Unsubscribed by ID: ${subscriptionIdOrTopic}`);
      }
      
      return removed;
    }
    
    // If topic and handler are provided (two arguments)
    const topic = subscriptionIdOrTopic;
    let found = false;
    
    // Find subscriptions with matching topic and handler
    for (const [id, subscription] of this.subscriptions.entries()) {
      if (subscription.topic === topic && subscription.handler === handler) {
        this.subscriptions.delete(id);
        found = true;
        this.logger.debug(`Unsubscribed by topic and handler: ${topic}`);
      }
    }
    
    return found;
  }

  /**
   * Get the number of subscribers for a specific topic
   */
  getSubscriberCount(topic: string): number {
    if (!topic) {
      return 0;
    }
    
    return this.getMatchingSubscriptions(topic).length;
  }

  /**
   * Get a list of all active topics
   */
  getActiveTopics(): string[] {
    const topics = new Set<string>();
    
    for (const subscription of this.subscriptions.values()) {
      if (!subscription.isPattern) {
        topics.add(subscription.topic);
      }
    }
    
    return Array.from(topics);
  }

  /**
   * Remove all subscriptions
   */
  clearAllSubscriptions(): void {
    const count = this.subscriptions.size;
    this.subscriptions.clear();
    this.logger.debug(`Cleared all subscriptions`, { count });
  }

  /**
   * Get all subscriptions matching a topic
   */
  private getMatchingSubscriptions(topic: string, minPriority?: number): EventSubscription[] {
    const matching: EventSubscription[] = [];
    
    for (const subscription of this.subscriptions.values()) {
      if (
        subscription.matchesTopic(topic) && 
        !subscription.isExpired() &&
        (minPriority === undefined || (subscription.options.priority ?? 0) >= minPriority)
      ) {
        matching.push(subscription);
      }
    }
    
    // Sort by priority (highest first)
    return matching.sort((a, b) => (b.options.priority ?? 0) - (a.options.priority ?? 0));
  }

  /**
   * Invoke a subscription handler
   */
  private async invokeHandler(subscription: EventSubscription, event: Event): Promise<void> {
    try {
      const result = subscription.handler(event);
      
      // Handle async handlers
      if (result instanceof Promise) {
        await result;
      }
    } catch (error) {
      // Initial error logging moved to the publish method
      // This simplifies the error handling flow by centralizing it
      throw error;
    }
  }
}