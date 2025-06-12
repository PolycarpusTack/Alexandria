# Alexandria Platform Architecture Modernization Training

## Overview

This training guide covers the modernized architecture patterns implemented in the Alexandria Platform, including Hexagonal Architecture, CQRS, Event Sourcing, and Repository patterns.

## Learning Objectives

By the end of this training, developers will:
- Understand the hexagonal architecture principles and implementation
- Know how to use CQRS for command and query separation
- Be able to implement event sourcing for audit trails and state reconstruction
- Master the repository pattern with specifications
- Apply these patterns in plugin development

## Module 1: Hexagonal Architecture (Ports and Adapters)

### What is Hexagonal Architecture?

Hexagonal Architecture (also known as Ports and Adapters) isolates the core business logic from external concerns through well-defined interfaces.

### Key Concepts

#### Ports (Interfaces)
```typescript
// Primary Port (driving) - what the application can do
export interface UserManagementPort {
  createUser(userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User>;
  getUserById(id: string): Promise<User | null>;
  authenticateUser(email: string, password: string): Promise<User | null>;
}

// Secondary Port (driven) - what the application needs
export interface UserRepositoryPort {
  save(user: User): Promise<User>;
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
}
```

#### Adapters (Implementations)
```typescript
// Database Adapter (implements secondary port)
export class PostgresUserRepository implements UserRepositoryPort {
  async save(user: User): Promise<User> {
    // Database-specific implementation
  }
}

// REST API Adapter (uses primary port)
export class UserController {
  constructor(private userService: UserManagementPort) {}
  
  async createUser(req: Request, res: Response) {
    const user = await this.userService.createUser(req.body);
    res.json(user);
  }
}
```

### Benefits
- **Testability**: Easy to mock dependencies
- **Flexibility**: Swap implementations without changing core logic
- **Independence**: Core logic doesn't depend on frameworks

### Implementation Exercise

1. Create a `PluginManagementPort` interface
2. Implement a `FileSystemPluginRepository` adapter
3. Write unit tests using mock adapters

## Module 2: CQRS (Command Query Responsibility Segregation)

### What is CQRS?

CQRS separates read and write operations, allowing for optimized data models and operations.

### Commands vs Queries

```typescript
// Command - Changes state, returns void
interface CreateUserCommand extends Command {
  type: 'CreateUser';
  payload: {
    email: string;
    name: string;
    role: string;
  };
}

// Query - Reads state, returns data
interface GetUserByEmailQuery extends Query {
  type: 'GetUserByEmail';
  parameters: {
    email: string;
  };
}
```

### Command Bus Implementation

```typescript
// Register command handler
commandBus.register('CreateUser', new CreateUserHandler(userRepository));

// Dispatch command
const command: CreateUserCommand = {
  id: generateId(),
  type: 'CreateUser',
  payload: { email: 'user@example.com', name: 'John Doe', role: 'user' },
  timestamp: new Date(),
  userId: 'admin-123'
};

await commandBus.dispatch(command);
```

### Query Bus Implementation

```typescript
// Register query handler
queryBus.register('GetUserByEmail', new GetUserByEmailHandler(userRepository));

// Dispatch query
const query: GetUserByEmailQuery = {
  id: generateId(),
  type: 'GetUserByEmail',
  parameters: { email: 'user@example.com' },
  timestamp: new Date()
};

const user = await queryBus.dispatch(query);
```

### Benefits
- **Scalability**: Separate read/write optimization
- **Clarity**: Clear separation of intent
- **Flexibility**: Different models for commands and queries

### Implementation Exercise

1. Create a `UpdatePluginConfigCommand` and handler
2. Create a `GetActivePluginsQuery` and handler
3. Add middleware for logging and validation

## Module 3: Event Sourcing

### What is Event Sourcing?

Event Sourcing stores all changes as a sequence of events, allowing state reconstruction and complete audit trails.

### Event Store

```typescript
// Domain Event
interface UserCreatedEvent extends DomainEvent {
  type: 'UserCreated';
  aggregateId: string; // User ID
  payload: {
    email: string;
    name: string;
    role: string;
  };
}

// Append event
const event: UserCreatedEvent = {
  id: generateId(),
  type: 'UserCreated',
  aggregateId: 'user-123',
  payload: { email: 'user@example.com', name: 'John', role: 'user' },
  timestamp: new Date(),
  version: 1
};

await eventStore.append(event);
```

### Event Sourced Aggregate

```typescript
export class UserAggregate extends EventSourcedAggregate {
  private email: string = '';
  private name: string = '';
  private role: string = '';

  static createNew(id: string, email: string, name: string, role: string): UserAggregate {
    const user = new UserAggregate(id);
    user.raiseEvent('UserCreated', { email, name, role });
    return user;
  }

  updateProfile(name: string): void {
    this.raiseEvent('UserProfileUpdated', { name });
  }

  protected when(event: DomainEvent): void {
    switch (event.type) {
      case 'UserCreated':
        this.applyUserCreated(event.payload);
        break;
      case 'UserProfileUpdated':
        this.applyUserProfileUpdated(event.payload);
        break;
    }
  }
}
```

### State Reconstruction

```typescript
// Load aggregate from events
const events = await eventStore.getEvents('user-123');
const user = new UserAggregate('user-123');
user.loadFromHistory(events);

// Current state is reconstructed from all events
console.log(user.getName()); // Current name after all updates
```

### Benefits
- **Audit Trail**: Complete history of changes
- **Time Travel**: Reconstruct state at any point
- **Debugging**: See exactly what happened

### Implementation Exercise

1. Create a `PluginAggregate` with install/activate/deactivate events
2. Implement event handlers for each event type
3. Create a repository that loads aggregates from events

## Module 4: Repository Pattern with Specifications

### What is the Repository Pattern?

The Repository pattern encapsulates data access logic and provides a uniform interface for accessing domain objects.

### Basic Repository

```typescript
interface Repository<T extends Entity> {
  findById(id: string): Promise<T | null>;
  findAll(options?: QueryOptions): Promise<QueryResult<T>>;
  create(entity: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T>;
  update(id: string, updates: Partial<T>): Promise<T>;
  delete(id: string): Promise<void>;
}
```

### Specifications Pattern

```typescript
// Business rules as specifications
export class ActiveUserSpecification extends BaseSpecification<User> {
  isSatisfiedBy(user: User): boolean {
    return user.isActive;
  }

  toQuery(): QueryCriteria {
    return {
      field: 'isActive',
      operator: 'eq',
      value: true
    };
  }
}

// Combine specifications
const activeAdmins = activeSpec.and(adminSpec);
const users = await userRepository.findBySpecification(activeAdmins);
```

### Repository Implementation

```typescript
export class UserRepository extends InMemoryRepository<User> {
  async findActiveAdmins(): Promise<User[]> {
    const activeSpec = new ActiveUserSpecification();
    const adminSpec = new UserByRoleSpecification('admin');
    const combinedSpec = activeSpec.and(adminSpec);
    
    const result = await this.findBySpecification(combinedSpec);
    return result.data;
  }
}
```

### Benefits
- **Separation of Concerns**: Data access logic is encapsulated
- **Testability**: Easy to mock for unit tests
- **Flexibility**: Swap implementations (in-memory, database, etc.)
- **Reusability**: Specifications can be combined and reused

### Implementation Exercise

1. Create a `PluginRepository` with specifications for status and permissions
2. Implement `ActivePluginSpecification` and `PluginByTypeSpecification`
3. Create a service that uses combined specifications

## Module 5: Putting It All Together

### Full Architecture Flow

```typescript
// 1. API receives request
app.post('/api/users', async (req, res) => {
  // 2. Create command
  const command: CreateUserCommand = {
    id: generateId(),
    type: 'CreateUser',
    payload: req.body,
    timestamp: new Date(),
    userId: req.user.id
  };
  
  // 3. Dispatch through command bus
  await commandBus.dispatch(command);
  
  res.status(201).json({ success: true });
});

// 4. Command handler executes business logic
export class CreateUserHandler implements CommandHandler<CreateUserCommand> {
  constructor(
    private userRepository: EventSourcedUserRepository,
    private eventBus: EventBus
  ) {}
  
  async handle(command: CreateUserCommand): Promise<void> {
    // 5. Create aggregate with events
    const user = UserAggregate.createNew(
      generateId(),
      command.payload.email,
      command.payload.name,
      command.payload.role
    );
    
    // 6. Save to event store
    await this.userRepository.save(user);
    
    // 7. Publish domain events
    const events = user.getUncommittedEvents();
    for (const event of events) {
      await this.eventBus.publish(event.type, event);
    }
  }
}
```

### Architecture Layers

1. **Presentation Layer**: API controllers, UI components
2. **Application Layer**: Command/query handlers, application services
3. **Domain Layer**: Aggregates, domain services, specifications
4. **Infrastructure Layer**: Repositories, event stores, external services

## Module 6: Best Practices and Common Pitfalls

### Best Practices

1. **Keep aggregates small**: Focus on consistency boundaries
2. **Use events for integration**: Decouple bounded contexts
3. **Validate early**: Use specifications and command validation
4. **Test each layer**: Unit tests for domain, integration tests for infrastructure
5. **Monitor performance**: Track command/query execution times

### Common Pitfalls

1. **Over-engineering**: Don't use patterns where simple CRUD suffices
2. **Large aggregates**: Avoid aggregates that span multiple entities
3. **Synchronous event handling**: Use async events for cross-aggregate operations
4. **Missing error handling**: Always handle and log errors appropriately
5. **Ignoring consistency**: Understand eventual consistency implications

### Code Review Checklist

- [ ] Commands are validated before execution
- [ ] Events contain all necessary information
- [ ] Aggregates maintain consistency invariants
- [ ] Repository specifications are composable
- [ ] Error handling is comprehensive
- [ ] Tests cover business logic scenarios

## Module 7: Migration Strategy

### Gradual Migration Approach

1. **Start with new features**: Implement new functionality using modern patterns
2. **Extract services**: Gradually extract existing logic into services
3. **Add event sourcing**: Begin with audit-critical aggregates
4. **Introduce CQRS**: Split complex read/write operations
5. **Refactor repositories**: Replace direct data access with repositories

### Migration Timeline

**Phase 1 (2 weeks)**: Core infrastructure and patterns
**Phase 2 (4 weeks)**: Migrate user management and authentication
**Phase 3 (6 weeks)**: Migrate plugin system and core services
**Phase 4 (4 weeks)**: Add event sourcing for audit trails
**Phase 5 (2 weeks)**: Performance optimization and monitoring

## Module 8: Testing Strategies

### Unit Testing

```typescript
// Test specifications
describe('ActiveUserSpecification', () => {
  it('should return true for active users', () => {
    const spec = new ActiveUserSpecification();
    const user = { isActive: true } as User;
    
    expect(spec.isSatisfiedBy(user)).toBe(true);
  });
});

// Test aggregates
describe('UserAggregate', () => {
  it('should create user with UserCreated event', () => {
    const user = UserAggregate.createNew('123', 'test@example.com', 'Test', 'user');
    const events = user.getUncommittedEvents();
    
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('UserCreated');
  });
});
```

### Integration Testing

```typescript
// Test command handlers
describe('CreateUserHandler', () => {
  let handler: CreateUserHandler;
  let repository: MockUserRepository;
  
  beforeEach(() => {
    repository = new MockUserRepository();
    handler = new CreateUserHandler(repository);
  });
  
  it('should create user and save to repository', async () => {
    const command: CreateUserCommand = {
      id: '123',
      type: 'CreateUser',
      payload: { email: 'test@example.com', name: 'Test', role: 'user' },
      timestamp: new Date()
    };
    
    await handler.handle(command);
    
    const savedUsers = repository.getSavedUsers();
    expect(savedUsers).toHaveLength(1);
  });
});
```

### End-to-End Testing

```typescript
// Test full flow
describe('User Management Flow', () => {
  it('should create, update, and retrieve user', async () => {
    // Create user
    const createCommand = new CreateUserCommand(/* ... */);
    await commandBus.dispatch(createCommand);
    
    // Query user
    const query = new GetUserByEmailQuery(/* ... */);
    const user = await queryBus.dispatch(query);
    
    expect(user).toBeDefined();
    expect(user.email).toBe('test@example.com');
  });
});
```

## Resources and References

### Documentation
- [Hexagonal Architecture Ports](../api/core-api.md#hexagonal-architecture)
- [CQRS Command Bus](../api/core-api.md#cqrs)
- [Event Sourcing Guide](../api/core-api.md#event-sourcing)
- [Repository Patterns](../api/core-api.md#repository-pattern)

### External Resources
- [Martin Fowler on CQRS](https://martinfowler.com/bliki/CQRS.html)
- [Event Sourcing by Greg Young](https://www.eventstore.com/blog/what-is-event-sourcing)
- [Hexagonal Architecture by Alistair Cockburn](https://alistair.cockburn.us/hexagonal-architecture/)

### Sample Projects
- `examples/user-management/` - Complete user management implementation
- `examples/plugin-system/` - Plugin system with all patterns
- `examples/event-sourcing/` - Event sourcing examples

## Assessment and Certification

### Practical Assignment

Implement a complete "Project Management" bounded context using all patterns:

1. **Entities**: Project, Task, Team Member
2. **Commands**: CreateProject, AssignTask, UpdateProjectStatus
3. **Queries**: GetProjectsByStatus, GetTasksForUser
4. **Events**: ProjectCreated, TaskAssigned, ProjectCompleted
5. **Specifications**: ActiveProjectSpec, TaskByPrioritySpec

### Evaluation Criteria

- Proper separation of concerns
- Comprehensive error handling
- Well-designed aggregates and events
- Effective use of specifications
- Complete test coverage
- Clear documentation

### Next Steps

After completing this training:
1. Practice with sample projects
2. Contribute to existing Alexandria modules
3. Mentor other developers
4. Stay updated with architecture evolution

For questions or support, contact the Architecture Team at architecture@alexandria.local