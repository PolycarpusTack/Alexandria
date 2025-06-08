# Alexandria Platform - Comprehensive Development Guide

## Table of Contents
1. [Platform Overview](#platform-overview)
2. [Architecture & Design Principles](#architecture--design-principles)
3. [Development Environment Setup](#development-environment-setup)
4. [Core System Components](#core-system-components)
5. [Plugin Development](#plugin-development)
6. [ALFRED Plugin Integration](#alfred-plugin-integration)
7. [UI Framework & Components](#ui-framework--components)
8. [Testing & Quality Assurance](#testing--quality-assurance)
9. [Development Workflow](#development-workflow)
10. [Best Practices & Guidelines](#best-practices--guidelines)

---

## Platform Overview

Alexandria is a **modular AI-enhanced customer care platform** built on a microkernel architecture. It serves dual purposes:

1. **Prompt Engineering Templates Collection** - Advanced templates for AI-assisted content generation
2. **Enterprise Customer Care Platform** - Modular application with plugin-based extensibility

### Key Features
- 🏛️ **Microkernel Architecture** - Minimal core with stable extension points
- 🔌 **Plugin System** - Dynamic discovery, loading, and lifecycle management
- 📡 **Event-Driven Communication** - Loosely coupled components via event bus
- 🚦 **Feature Flags** - Controlled feature rollout and experimentation
- 🤖 **AI Integration** - Native support for Ollama and other LLM providers
- 🎨 **Modern UI** - React + TypeScript with ShadCN components
- 🔒 **Enterprise Security** - Built-in authentication, authorization, and audit logging

### Current Status (January 2025)
- ✅ Phase 1 core infrastructure complete
- ✅ Crash Analyzer plugin functional
- ✅ ALFRED plugin integration in progress
- 🚧 Feedback mechanism 80% complete
- 📋 Comprehensive testing suite in development

---

## Architecture & Design Principles

### Microkernel Pattern
```
┌─────────────────────────────────────────────────────────┐
│                    UI Shell (React)                      │
├─────────────────────────────────────────────────────────┤
│                  Plugin UI Components                    │
├─────────────────────────────────────────────────────────┤
│                    Event Bus                             │
├──────────┬──────────┬──────────┬──────────┬────────────┤
│   Core   │  Plugin  │ Feature  │ Security │    Data    │
│  System  │ Registry │  Flags   │ Services │  Service   │
└──────────┴──────────┴──────────┴──────────┴────────────┘
```

### Core Design Principles
1. **Separation of Concerns** - Clear boundaries between core and plugins
2. **Event-Driven Architecture** - Components communicate via events, not direct calls
3. **Plugin Isolation** - Sandboxed execution with permission-based access
4. **Type Safety** - Full TypeScript implementation with strict typing
5. **Error Resilience** - Comprehensive error handling and recovery
6. **Performance First** - Optimized for enterprise scale

### Directory Structure
```
Alexandria/
├── src/
│   ├── core/                 # Core platform services
│   │   ├── system/          # Core system interfaces
│   │   ├── plugin-registry/ # Plugin lifecycle management
│   │   ├── event-bus/       # Event communication
│   │   ├── feature-flags/   # Feature control
│   │   ├── security/        # Auth & security services
│   │   └── data/            # Data persistence layer
│   ├── client/              # Frontend application
│   │   ├── components/      # Shared UI components
│   │   ├── pages/          # Page components
│   │   └── services/       # Client-side services
│   ├── plugins/            # Plugin implementations
│   │   ├── crash-analyzer/ # Crash analysis plugin
│   │   ├── alfred/        # AI coding assistant
│   │   └── [future plugins]
│   └── utils/             # Shared utilities
├── tools/                 # Development tools
├── docs/                  # Documentation
└── guidelines/           # Coding standards & templates
```

---

## Development Environment Setup

### Prerequisites
- **Node.js** 18+ (LTS recommended)
- **PostgreSQL** 14+ (optional, for persistent storage)
- **Ollama** (for AI functionality)
- **Git** for version control

### Initial Setup

1. **Clone the Repository**
   ```bash
   git clone https://github.com/your-org/alexandria-platform.git
   cd alexandria-platform
   ```

2. **Install Dependencies**
   ```bash
   npm install
   
   # Windows users:
   setup-windows.bat
   
   # If you encounter issues:
   node fix-rollup.js
   node fix-dependencies.js
   ```

3. **Configure Environment**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

   Key environment variables:
   ```env
   # Database Configuration
   USE_POSTGRES=false          # Set to true for PostgreSQL
   POSTGRES_HOST=localhost
   POSTGRES_PORT=5432
   POSTGRES_USER=postgres
   POSTGRES_PASSWORD=your_password
   POSTGRES_DB=alexandria
   
   # AI Configuration
   OLLAMA_URL=http://localhost:11434
   DEFAULT_MODEL=deepseek-coder:latest
   
   # Security
   JWT_SECRET=your-secret-key
   SESSION_TIMEOUT=3600000
   ```

4. **Start Development Server**
   ```bash
   npm run dev
   ```
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:4000

---

## Core System Components

### 1. Core System (`/src/core/system/`)
The foundation of Alexandria, providing:
- Route registration and management
- System initialization/shutdown
- Base data models (users, cases, logs)
- Platform state management

```typescript
// Example: Using the core system
const coreSystem = new CoreSystem({
  dataService,
  eventBus,
  featureFlags,
  securityService
});

await coreSystem.initialize();
```

### 2. Plugin Registry (`/src/core/plugin-registry/`)
Manages plugin lifecycle:
- Discovery and loading
- Dependency resolution
- Permission validation
- Sandboxed execution

```typescript
// Plugin lifecycle hooks
interface PluginLifecycle {
  install(): Promise<void>;
  activate(): Promise<void>;
  deactivate(): Promise<void>;
  uninstall(): Promise<void>;
}
```

### 3. Event Bus (`/src/core/event-bus/`)
Enables component communication:
- Topic-based pub/sub
- Pattern matching subscriptions
- Priority handling
- Error isolation

```typescript
// Publishing events
eventBus.publish('user:login', { userId, timestamp });

// Subscribing to events
eventBus.subscribe('user:*', (event) => {
  console.log('User event:', event);
});
```

### 4. Feature Flags (`/src/core/feature-flags/`)
Controls feature availability:
- Context-based evaluation
- Gradual rollout support
- A/B testing capabilities
- Override management

```typescript
// Check feature availability
if (await featureFlags.isEnabled('new-ui-component', context)) {
  // Show new component
}
```

### 5. Security Services (`/src/core/security/`)
Comprehensive security layer:
- JWT authentication
- Role-based authorization
- Input validation
- Encryption services
- Audit logging

### 6. Data Service (`/src/core/data/`)
Abstracted data persistence:
- In-memory implementation (default)
- PostgreSQL support
- Repository pattern
- Migration support

---

## Plugin Development

### Plugin Structure
```
src/plugins/my-plugin/
├── plugin.json          # Plugin manifest
├── CLAUDE.md           # Plugin-specific AI instructions
├── README.md           # Documentation
├── package.json        # Dependencies
├── src/
│   ├── index.ts       # Entry point
│   ├── interfaces.ts  # TypeScript types
│   ├── services/      # Business logic
│   ├── api/          # REST endpoints
│   └── repositories/ # Data access
└── ui/
    ├── index.ts      # UI exports
    └── components/   # React components
```

### Plugin Manifest (plugin.json)
```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "description": "Plugin description",
  "permissions": [
    "database:access",
    "event:subscribe",
    "file:read"
  ],
  "dependencies": [],
  "uiEntryPoints": [{
    "id": "my-plugin-main",
    "name": "My Plugin",
    "location": "sidebar",
    "icon": "mdi-puzzle",
    "component": "ui/components/Dashboard",
    "routes": ["/my-plugin"]
  }]
}
```

### Plugin Implementation
```typescript
// src/index.ts
import { Plugin, PluginContext } from '@alexandria/core';

export class MyPlugin implements Plugin {
  constructor(private context: PluginContext) {}

  async install(): Promise<void> {
    // One-time setup
    await this.context.dataService.createTables();
  }

  async activate(): Promise<void> {
    // Plugin activation
    this.context.eventBus.subscribe('system:ready', this.onSystemReady);
    this.context.api.register('/my-plugin', myApiRoutes);
  }

  async deactivate(): Promise<void> {
    // Cleanup
    this.context.eventBus.unsubscribe('system:ready', this.onSystemReady);
  }
}
```

### Plugin Best Practices
1. **Use the Plugin Context** - Don't access core services directly
2. **Handle Errors Gracefully** - Don't crash the platform
3. **Follow Permission Model** - Request only needed permissions
4. **Emit Events** - Let other plugins react to your actions
5. **Document APIs** - Make integration easy for others

---

## ALFRED Plugin Integration

ALFRED (AI-Linked Framework for Rapid Engineering Development) is being converted from a standalone Python application to an Alexandria plugin.

### ALFRED Features Being Migrated
1. **AI Chat Interface** - Interactive coding assistant
2. **Project Management** - Load and analyze project structures
3. **Code Generation** - Template-based code creation
4. **Multi-Model Support** - Ollama, OpenAI, etc.
5. **Session Management** - Persistent chat history
6. **Code Extraction** - Analyze existing codebases
7. **Template System** - Customizable code templates

### Integration Architecture
```
Python ALFRED → TypeScript Plugin
├── Core Logic → AlfredService
├── Tkinter UI → React Components
├── File Ops → Alexandria FileService
├── Direct Ollama → Alexandria AIService
├── Local Storage → Alexandria Database
└── Custom Events → Alexandria EventBus
```

### ALFRED Plugin Structure
```typescript
// alfred-service.ts
export class AlfredService {
  async processMessage(message: string, context: ProjectContext) {
    // Leverage Alexandria's AI infrastructure
    const response = await this.aiService.query(message, {
      model: context.preferredModel,
      systemPrompt: this.buildSystemPrompt(context),
      temperature: 0.7
    });
    
    // Emit events for other plugins
    this.eventBus.emit('alfred:code-generated', {
      sessionId: context.sessionId,
      language: detectLanguage(response),
      linesOfCode: countLines(response)
    });
    
    return response;
  }
}
```

### ALFRED UI Components
- **AlfredDashboard** - Main interface with tabs
- **ChatInterface** - Conversation view with syntax highlighting
- **ProjectExplorer** - File tree with analysis
- **TemplateManager** - Create and manage code templates
- **SessionList** - Browse chat history

---

## UI Framework & Components

### Technology Stack
- **React** 18+ with TypeScript
- **Tailwind CSS** for styling
- **ShadCN UI** component library
- **Radix UI** primitives for accessibility
- **Vite** for fast builds

### Component Library
Located in `/src/client/components/ui/`:

#### Core Components
- **Button** - Multiple variants (primary, secondary, ghost, etc.)
- **Card** - Content containers with consistent styling
- **Dialog** - Modal dialogs with portal rendering
- **Select** - Accessible dropdowns with search
- **Table** - Data tables with sorting/filtering
- **Tabs** - Tabbed interfaces
- **Input** - Form inputs with validation
- **Badge** - Status indicators

#### Advanced Components
- **CommandPalette** - VSCode-style command interface (Ctrl+K)
- **StatusIndicator** - Service health visualization
- **Collapsible** - Expandable content sections
- **Toaster** - Toast notifications
- **Tooltip** - Contextual information

### Creating UI Components
```typescript
// Example: Creating a plugin UI component
import { Card, Button, useToast } from '@/components/ui';
import { useAlfredService } from '../hooks/useAlfredService';

export function CodeGenerator() {
  const { generateCode } = useAlfredService();
  const { toast } = useToast();
  
  const handleGenerate = async () => {
    try {
      const code = await generateCode(template, variables);
      toast({
        title: "Code Generated!",
        description: `Generated ${code.lines} lines of ${code.language}`
      });
    } catch (error) {
      toast({
        title: "Generation Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  };
  
  return (
    <Card className="p-6">
      <h2 className="text-2xl font-bold mb-4">Code Generator</h2>
      {/* Component content */}
      <Button onClick={handleGenerate}>Generate</Button>
    </Card>
  );
}
```

---

## Testing & Quality Assurance

### Testing Strategy
- **Unit Tests** - Jest for isolated component testing
- **Integration Tests** - Test plugin interactions
- **E2E Tests** - Playwright for user workflows
- **Performance Tests** - Load and stress testing

### Running Tests
```bash
# Run all tests
npm test

# Run specific test suite
npm test -- --testNamePattern="PluginRegistry"

# Run with coverage
npm test -- --coverage

# E2E tests
npm run test:e2e
```

### Test Structure
```typescript
// Example: Plugin service test
describe('AlfredService', () => {
  let service: AlfredService;
  let mockAIService: jest.Mocked<AIService>;
  
  beforeEach(() => {
    mockAIService = createMockAIService();
    service = new AlfredService(mockAIService);
  });
  
  describe('processMessage', () => {
    it('should process messages with context', async () => {
      const message = "Generate a React component";
      const context = { projectType: 'react', language: 'typescript' };
      
      mockAIService.query.mockResolvedValue('component code...');
      
      const result = await service.processMessage(message, context);
      
      expect(mockAIService.query).toHaveBeenCalledWith(
        message,
        expect.objectContaining({
          systemPrompt: expect.stringContaining('React')
        })
      );
      expect(result).toContain('component');
    });
  });
});
```

### Quality Gates
- ✅ Zero TypeScript errors
- ✅ Zero ESLint errors
- ✅ 80% test coverage minimum
- ✅ All tests passing
- ✅ No security vulnerabilities
- ✅ Performance benchmarks met

---

## Development Workflow

### 1. Feature Development
```bash
# Create feature branch
git checkout -b feature/ALEX-123-new-feature

# Make changes and test
npm run dev
npm test

# Fix any issues
npm run lint:fix
npm run typecheck

# Commit with conventional commits
git commit -m "feat(alfred): add template validation"
```

### 2. Pre-commit Checks
Automatic checks run before commit:
- TypeScript compilation
- ESLint validation
- Prettier formatting
- Unit tests

### 3. Pull Request Process
1. Ensure all tests pass
2. Update documentation
3. Add/update tests for new code
4. Request review from team
5. Address feedback
6. Merge after approval

### 4. Debugging
```typescript
// Use the built-in logger
import { logger } from '@/utils/logger';

logger.debug('Processing request', { requestId, userId });
logger.info('Feature activated', { feature: 'alfred-templates' });
logger.error('Failed to generate code', { error, context });
```

### 5. Performance Profiling
```typescript
// Use performance markers
performance.mark('alfred-generation-start');
const result = await generateCode();
performance.mark('alfred-generation-end');
performance.measure('alfred-generation', 
  'alfred-generation-start', 
  'alfred-generation-end'
);
```

---

## Best Practices & Guidelines

### Code Style
1. **TypeScript First** - No implicit any, strict mode enabled
2. **Functional Components** - Use hooks for React components
3. **Async/Await** - Preferred over promise chains
4. **Named Exports** - Except for default React components
5. **Descriptive Names** - Clear, self-documenting code

### Error Handling
```typescript
// GOOD: Comprehensive error handling
try {
  const result = await riskyOperation();
  return { success: true, data: result };
} catch (error) {
  logger.error('Operation failed', { error, context });
  
  if (error instanceof ValidationError) {
    return { success: false, error: 'Invalid input', details: error.details };
  }
  
  if (error instanceof NetworkError) {
    // Retry logic
    return await retryWithBackoff(riskyOperation);
  }
  
  // Unknown error - don't expose internals
  return { success: false, error: 'Operation failed' };
}

// BAD: Generic handling
try {
  return await riskyOperation();
} catch (e) {
  throw e;
}
```

### Security Considerations
1. **Validate All Inputs** - Never trust user input
2. **Use Prepared Statements** - Prevent SQL injection
3. **Sanitize Outputs** - Prevent XSS attacks
4. **Check Permissions** - Every sensitive operation
5. **Audit Logging** - Track security events

### Performance Guidelines
1. **Lazy Loading** - Load plugins on demand
2. **Memoization** - Cache expensive computations
3. **Debouncing** - Limit API calls
4. **Virtual Scrolling** - For large lists
5. **Code Splitting** - Reduce bundle size

### Documentation Standards
- **Code Comments** - Explain "why", not "what"
- **JSDoc** - For public APIs
- **README** - For each plugin
- **CLAUDE.md** - AI-specific instructions
- **Examples** - Show real usage

### Git Commit Messages
Follow conventional commits:
```
feat(plugin-name): add new feature
fix(core): resolve memory leak
docs(alfred): update API documentation
test(crash-analyzer): add integration tests
refactor(ui): simplify component structure
perf(event-bus): optimize message routing
```

---

## Next Steps & Resources

### Immediate Priorities (Phase 1 Completion)
1. Complete feedback mechanism integration
2. Achieve 80% test coverage
3. Implement error recovery patterns
4. Optimize performance bottlenecks
5. Complete Zero to Hero documentation

### Learning Resources
- **Project Docs**: `/docs/` directory
- **Guidelines**: `/guidelines/` for templates
- **Example Code**: Crash Analyzer plugin
- **Test Examples**: `__tests__` directories

### Getting Help
1. Check CLAUDE.md for AI assistance context
2. Review existing plugins for patterns
3. Use the test suite for examples
4. Ask in development channels

### Contributing
1. Read the guidelines thoroughly
2. Start with small contributions
3. Write tests for your code
4. Document your changes
5. Be patient with reviews

---

*Remember: Alexandria is an enterprise platform. Every line of code should be production-ready, secure, and maintainable. When in doubt, ask for clarification rather than making assumptions.*

**Last Updated**: January 2025
**Version**: 1.0.0