/**
 * Event System Type Definitions
 */
export interface EventHandler<T = any> {
    (payload: T): void | Promise<void>;
}
export interface EventSubscription {
    id: string;
    event: string;
    handler: EventHandler;
    once: boolean;
    priority: number;
}
export interface EventMetadata {
    timestamp: Date;
    source: string;
    correlationId?: string;
    userId?: string;
    sessionId?: string;
    traceId?: string;
}
export interface Event<T = any> {
    type: string;
    payload: T;
    metadata: EventMetadata;
}
export interface EventFilter {
    type?: string | RegExp;
    source?: string | RegExp;
    userId?: string;
    sessionId?: string;
    fromDate?: Date;
    toDate?: Date;
}
export type EventPriority = 'low' | 'normal' | 'high' | 'critical';
export interface EventBusOptions {
    maxListeners?: number;
    enableWildcards?: boolean;
    enableMetrics?: boolean;
    errorHandler?: (error: Error, event: Event) => void;
}
export interface PluginEvent {
    pluginId: string;
    action: 'install' | 'activate' | 'deactivate' | 'uninstall' | 'error';
    details?: Record<string, any>;
}
export interface UserEvent {
    userId: string;
    action: 'login' | 'logout' | 'register' | 'update' | 'delete';
    details?: Record<string, any>;
}
export interface SystemEvent {
    component: string;
    action: 'start' | 'stop' | 'error' | 'health_check';
    details?: Record<string, any>;
}
