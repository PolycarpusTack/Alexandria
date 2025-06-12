/**
 * Event Sourcing Implementation - Event Store
 * Handles storage and retrieval of domain events for state reconstruction
 */

import { DomainEvent, EventStore } from '../hexagonal/ports';
import { Logger } from '../../../utils/logger';
import { BaseError, createErrorContext } from '@alexandria/shared';

export class EventStoreError extends BaseError {
  constructor(message: string, operation: string, originalError?: Error) {
    super(
      message,
      'EVENT_STORE_ERROR',
      500,
      createErrorContext('event_store', undefined, {
        operation,
        originalError: originalError?.message
      })
    );
  }
}

export class InMemoryEventStore implements EventStore {
  private events: Map<string, DomainEvent[]> = new Map();
  private eventsByType: Map<string, DomainEvent[]> = new Map();
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  async append(event: DomainEvent): Promise<void> {
    try {
      this.logger.debug('Appending event to store', {
        eventId: event.id,
        eventType: event.type,
        aggregateId: event.aggregateId
      });

      // Validate event
      this.validateEvent(event);

      // Store by aggregate ID
      if (!this.events.has(event.aggregateId)) {
        this.events.set(event.aggregateId, []);
      }
      this.events.get(event.aggregateId)!.push(event);

      // Store by event type
      if (!this.eventsByType.has(event.type)) {
        this.eventsByType.set(event.type, []);
      }
      this.eventsByType.get(event.type)!.push(event);

      this.logger.info('Event appended successfully', {
        eventId: event.id,
        eventType: event.type,
        aggregateId: event.aggregateId,
        version: event.version
      });
    } catch (error) {
      this.logger.error('Failed to append event', {
        eventId: event.id,
        error: error instanceof Error ? error.message : String(error)
      });
      throw new EventStoreError(
        'Failed to append event to store',
        'append',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  async getEvents(aggregateId: string, fromVersion?: number): Promise<DomainEvent[]> {
    try {
      this.logger.debug('Retrieving events', { aggregateId, fromVersion });

      const events = this.events.get(aggregateId) || [];
      const filteredEvents =
        fromVersion !== undefined ? events.filter((event) => event.version >= fromVersion) : events;

      // Sort by version to ensure correct order
      const sortedEvents = filteredEvents.sort((a, b) => a.version - b.version);

      this.logger.debug('Events retrieved', {
        aggregateId,
        eventCount: sortedEvents.length,
        fromVersion
      });

      return sortedEvents;
    } catch (error) {
      this.logger.error('Failed to retrieve events', {
        aggregateId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw new EventStoreError(
        'Failed to retrieve events from store',
        'getEvents',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  async getEventsByType(eventType: string, fromTimestamp?: Date): Promise<DomainEvent[]> {
    try {
      this.logger.debug('Retrieving events by type', { eventType, fromTimestamp });

      const events = this.eventsByType.get(eventType) || [];
      const filteredEvents = fromTimestamp
        ? events.filter((event) => event.timestamp >= fromTimestamp)
        : events;

      // Sort by timestamp
      const sortedEvents = filteredEvents.sort(
        (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
      );

      this.logger.debug('Events by type retrieved', {
        eventType,
        eventCount: sortedEvents.length,
        fromTimestamp
      });

      return sortedEvents;
    } catch (error) {
      this.logger.error('Failed to retrieve events by type', {
        eventType,
        error: error instanceof Error ? error.message : String(error)
      });
      throw new EventStoreError(
        'Failed to retrieve events by type from store',
        'getEventsByType',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Get aggregate version (highest event version)
   */
  async getAggregateVersion(aggregateId: string): Promise<number> {
    const events = await this.getEvents(aggregateId);
    return events.length > 0 ? Math.max(...events.map((e) => e.version)) : 0;
  }

  /**
   * Get event store statistics
   */
  getStatistics() {
    const totalAggregates = this.events.size;
    const totalEvents = Array.from(this.events.values()).reduce(
      (sum, events) => sum + events.length,
      0
    );
    const eventTypes = this.eventsByType.size;

    return {
      totalAggregates,
      totalEvents,
      eventTypes,
      averageEventsPerAggregate: totalAggregates > 0 ? totalEvents / totalAggregates : 0
    };
  }

  /**
   * Clear all events (useful for testing)
   */
  clear(): void {
    this.events.clear();
    this.eventsByType.clear();
    this.logger.info('Event store cleared');
  }

  private validateEvent(event: DomainEvent): void {
    if (!event.id) {
      throw new EventStoreError('Event ID is required', 'validation');
    }
    if (!event.type) {
      throw new EventStoreError('Event type is required', 'validation');
    }
    if (!event.aggregateId) {
      throw new EventStoreError('Aggregate ID is required', 'validation');
    }
    if (event.version < 1) {
      throw new EventStoreError('Event version must be positive', 'validation');
    }
    if (!event.timestamp) {
      throw new EventStoreError('Event timestamp is required', 'validation');
    }
  }
}

// ==================== EVENT SOURCING AGGREGATE ====================

export abstract class EventSourcedAggregate {
  protected _id: string;
  protected _version: number = 0;
  private _uncommittedEvents: DomainEvent[] = [];

  constructor(id: string) {
    this._id = id;
  }

  get id(): string {
    return this._id;
  }

  get version(): number {
    return this._version;
  }

  /**
   * Get uncommitted events for persistence
   */
  getUncommittedEvents(): DomainEvent[] {
    return [...this._uncommittedEvents];
  }

  /**
   * Mark events as committed
   */
  markEventsAsCommitted(): void {
    this._uncommittedEvents = [];
  }

  /**
   * Load aggregate from events
   */
  loadFromHistory(events: DomainEvent[]): void {
    events.forEach((event) => {
      this.applyEvent(event, false);
      this._version = Math.max(this._version, event.version);
    });
  }

  /**
   * Apply event to aggregate
   */
  protected applyEvent(event: DomainEvent, isNew: boolean = true): void {
    // Apply the event to change state
    this.when(event);

    if (isNew) {
      this._version++;
      event.version = this._version;
      this._uncommittedEvents.push(event);
    }
  }

  /**
   * Create and apply a new event
   */
  protected raiseEvent(eventType: string, payload: any): void {
    const event: DomainEvent = {
      id: this.generateEventId(),
      type: eventType,
      aggregateId: this._id,
      payload,
      timestamp: new Date(),
      version: 0 // Will be set in applyEvent
    };

    this.applyEvent(event);
  }

  /**
   * Handle different event types (to be implemented by subclasses)
   */
  protected abstract when(event: DomainEvent): void;

  private generateEventId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ==================== EXAMPLE AGGREGATE IMPLEMENTATION ====================

export interface UserCreatedEvent {
  email: string;
  name: string;
  role: string;
}

export interface UserUpdatedEvent {
  name?: string;
  role?: string;
}

export interface UserDeactivatedEvent {
  reason: string;
}

export class UserAggregate extends EventSourcedAggregate {
  private email: string = '';
  private name: string = '';
  private role: string = '';
  private isActive: boolean = true;

  static createNew(id: string, email: string, name: string, role: string): UserAggregate {
    const user = new UserAggregate(id);
    user.raiseEvent('UserCreated', { email, name, role });
    return user;
  }

  updateProfile(name?: string, role?: string): void {
    if (!this.isActive) {
      throw new Error('Cannot update deactivated user');
    }

    const updates: UserUpdatedEvent = {};
    if (name && name !== this.name) updates.name = name;
    if (role && role !== this.role) updates.role = role;

    if (Object.keys(updates).length > 0) {
      this.raiseEvent('UserUpdated', updates);
    }
  }

  deactivate(reason: string): void {
    if (!this.isActive) {
      throw new Error('User is already deactivated');
    }

    this.raiseEvent('UserDeactivated', { reason });
  }

  protected when(event: DomainEvent): void {
    switch (event.type) {
      case 'UserCreated':
        this.applyUserCreated(event.payload as UserCreatedEvent);
        break;
      case 'UserUpdated':
        this.applyUserUpdated(event.payload as UserUpdatedEvent);
        break;
      case 'UserDeactivated':
        this.applyUserDeactivated(event.payload as UserDeactivatedEvent);
        break;
      default:
        throw new Error(`Unknown event type: ${event.type}`);
    }
  }

  private applyUserCreated(event: UserCreatedEvent): void {
    this.email = event.email;
    this.name = event.name;
    this.role = event.role;
    this.isActive = true;
  }

  private applyUserUpdated(event: UserUpdatedEvent): void {
    if (event.name) this.name = event.name;
    if (event.role) this.role = event.role;
  }

  private applyUserDeactivated(event: UserDeactivatedEvent): void {
    this.isActive = false;
  }

  // Getters for current state
  getEmail(): string {
    return this.email;
  }
  getName(): string {
    return this.name;
  }
  getRole(): string {
    return this.role;
  }
  getIsActive(): boolean {
    return this.isActive;
  }
}

// ==================== REPOSITORY WITH EVENT SOURCING ====================

export class EventSourcedUserRepository {
  constructor(
    private eventStore: EventStore,
    private logger: Logger
  ) {}

  async save(user: UserAggregate): Promise<void> {
    const events = user.getUncommittedEvents();

    for (const event of events) {
      await this.eventStore.append(event);
    }

    user.markEventsAsCommitted();

    this.logger.info('User aggregate saved', {
      userId: user.id,
      eventsCount: events.length,
      version: user.version
    });
  }

  async findById(id: string): Promise<UserAggregate | null> {
    try {
      const events = await this.eventStore.getEvents(id);

      if (events.length === 0) {
        return null;
      }

      const user = new UserAggregate(id);
      user.loadFromHistory(events);

      return user;
    } catch (error) {
      this.logger.error('Failed to load user aggregate', {
        userId: id,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  async getVersion(id: string): Promise<number> {
    const events = await this.eventStore.getEvents(id);
    return events.length > 0 ? Math.max(...events.map((e) => e.version)) : 0;
  }
}
