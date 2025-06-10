import { EventBus, EventHandler, Subscription, SubscriptionOptions, PublicationOptions, PublicationResult, EventData } from './interfaces';
import { Logger } from '../../utils/logger';
/**
 * Implementation of the EventBus interface
 */
export declare class EventBusImpl implements EventBus {
    private subscriptions;
    private logger;
    private cleanupTimer;
    private readonly CLEANUP_INTERVAL;
    private readonly MAX_SUBSCRIPTIONS;
    private readonly MAX_SUBSCRIPTIONS_PER_TOPIC;
    private topicSubscriptionCounts;
    constructor(logger: Logger);
    /**
     * Start periodic cleanup of expired subscriptions
     */
    private startCleanupTimer;
    /**
     * Clean up expired subscriptions
     */
    private cleanupExpiredSubscriptions;
    /**
     * Destroy the event bus and clean up resources
     */
    destroy(): void;
    /**
     * Subscribe to events on a specific topic
     */
    subscribe(topic: string, handler: EventHandler, options?: SubscriptionOptions): Subscription;
    /**
     * Subscribe to events that match a topic pattern
     */
    subscribePattern(topicPattern: string, handler: EventHandler, options?: SubscriptionOptions): Subscription;
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
    publish(topic: string, data: EventData, options?: PublicationOptions): Promise<PublicationResult>;
    /**
     * Unsubscribe a handler using its subscription ID or topic and handler
     */
    unsubscribe(subscriptionIdOrTopic: string, handler?: EventHandler): boolean;
    /**
     * Get the number of subscribers for a specific topic
     */
    getSubscriberCount(topic: string): number;
    /**
     * Get a list of all active topics
     */
    getActiveTopics(): string[];
    /**
     * Remove all subscriptions
     */
    clearAllSubscriptions(): void;
    /**
     * Get all subscriptions matching a topic
     */
    private getMatchingSubscriptions;
    /**
     * Invoke a subscription handler
     */
    private invokeHandler;
}
export { EventBusImpl as EventBus };
