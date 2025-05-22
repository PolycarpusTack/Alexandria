/**
 * Custom event types for the log visualization plugin
 */

import { Event } from '../../../../core/event-bus/interfaces';

/**
 * Log source connected event data
 */
export interface LogSourceConnectedData {
  sourceId: string;
  sourceType: string;
}

/**
 * Log source connected event
 */
export interface LogSourceConnectedEvent extends Event {
  topic: 'log:source:connected';
  data: LogSourceConnectedData;
}

/**
 * System initialized event
 */
export interface SystemInitializedEvent extends Event {
  topic: 'system:initialized';
  data: Record<string, never>; // Empty data object
}

/**
 * Type guard to check if an event is a log source connected event
 */
export function isLogSourceConnectedEvent(event: Event): event is LogSourceConnectedEvent {
  return event.topic === 'log:source:connected' && 
    typeof event.data === 'object' &&
    'sourceId' in event.data &&
    'sourceType' in event.data;
}

/**
 * Type guard to check if an event is a system initialized event
 */
export function isSystemInitializedEvent(event: Event): event is SystemInitializedEvent {
  return event.topic === 'system:initialized';
}