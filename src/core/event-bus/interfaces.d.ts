/**
 * Event Bus interfaces for the Alexandria Platform
 *
 * These interfaces define the event-driven communication system used by
 * the core platform and plugins.
 */
/**
 * Event data type - structured data with known types
 */
export type EventData = Record<string, any>;
/**
 * Event message with topic and data
 */
export interface Event {
    topic: string;
    data: EventData;
    timestamp: Date;
    source?: string;
}
/**
 * Event handler function type
 */
export type EventHandler = (event: Event) => void | Promise<void>;
/**
 * Subscription options
 */
export interface SubscriptionOptions {
    /**
     * Handler will be automatically removed after processing this many events
     */
    maxEvents?: number;
    /**
     * Subscription will automatically expire after this time
     */
    expiresIn?: number;
    /**
     * If true, errors in this handler won't be propagated to the caller
     * regardless of the ignoreErrors setting in PublicationOptions.
     *
     * Errors will still be:
     * - Added to the errors array in PublicationResult
     * - Logged appropriately (at WARN level instead of ERROR)
     * - Available for inspection after the publish operation completes
     */
    isolateErrors?: boolean;
    /**
     * Priority of the handler (higher numbers executed first)
     */
    priority?: number;
    /**
     * Filter function to conditionally process events
     */
    filter?: (event: Event) => boolean;
    /**
     * Custom metadata associated with this subscription
     */
    metadata?: Record<string, any>;
}
/**
 * Subscription object returned when subscribing to events
 */
export interface Subscription {
    id: string;
    topic: string;
    options: SubscriptionOptions;
    unsubscribe: () => void;
}
/**
 * Publication options
 */
export interface PublicationOptions {
    /**
     * Controls whether to wait for handlers to complete before resolving
     *
     * If true:
     * - The publish method will await all handler promises
     * - Errors from all handlers will be properly handled
     * - Can be combined with timeout for bounded wait times
     *
     * If false (default):
     * - The publish method returns immediately after dispatching events
     * - Handler errors are still collected, but may occur after publish returns
     * - The PublicationResult may not include all errors at return time
     */
    waitForHandlers?: boolean;
    /**
     * If provided, only deliver to handlers with priority >= this value
     */
    minPriority?: number;
    /**
     * Maximum time to wait for handlers to complete (in milliseconds)
     */
    timeout?: number;
    /**
     * Controls error propagation for all handlers
     *
     * If true:
     * - All errors are caught and not propagated
     * - Errors are still collected in the PublicationResult.errors array
     * - Errors are still logged appropriately
     *
     * This setting can be overridden at the individual subscription level
     * using the isolateErrors option in SubscriptionOptions.
     */
    ignoreErrors?: boolean;
    /**
     * The source of the event (typically a component or service name)
     */
    source?: string;
}
/**
 * Result returned from the publish operation
 */
export interface PublicationResult {
    /**
     * Number of handlers that received the event
     */
    deliveredToCount: number;
    /**
     * List of errors from all handlers
     *
     * This array contains all errors that occurred during event processing,
     * regardless of whether they were propagated or not. It includes:
     *
     * - Errors from handlers that were not propagated due to isolateErrors
     * - Errors from handlers that were not propagated due to ignoreErrors
     * - Timeout errors when using waitForHandlers with timeout
     *
     * An empty array indicates that no errors occurred during event processing.
     */
    errors: Error[];
}
/**
 * Event Bus interface
 */
export interface EventBus {
    /**
     * Subscribe to events on a specific topic
     */
    subscribe(topic: string, handler: EventHandler, options?: SubscriptionOptions): Subscription;
    /**
     * Subscribe to events that match a topic pattern (supports wildcards)
     */
    subscribePattern(topicPattern: string, handler: EventHandler, options?: SubscriptionOptions): Subscription;
    /**
     * Publish an event to a specific topic
     */
    publish(topic: string, data: EventData, options?: PublicationOptions): Promise<PublicationResult>;
    /**
     * Unsubscribe a handler using its subscription ID
     */
    unsubscribe(subscriptionId: string): boolean;
    /**
     * Unsubscribe a handler using topic and handler
     */
    unsubscribe(topic: string, handler: EventHandler): boolean;
    /**
     * Get the number of subscribers for a specific topic
     */
    getSubscriberCount(topic: string): number;
    /**
     * Get a list of all active topics (topics with at least one subscriber)
     */
    getActiveTopics(): string[];
    /**
     * Remove all subscriptions
     */
    clearAllSubscriptions(): void;
    /**
     * Destroy the event bus and clean up all resources
     */
    destroy(): void;
}
