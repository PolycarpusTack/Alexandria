# Alfred Plugin - Developer Guide

## Architecture Overview

Alfred is built as a modular plugin for the Alexandria platform, following a microkernel architecture with clear separation of concerns.

```
alfred/
├── src/                    # Core business logic
│   ├── api/               # REST API endpoints
│   ├── bridge/            # Python integration bridge
│   ├── interfaces.ts      # TypeScript interfaces
│   ├── repositories/      # Data persistence layer
│   └── services/          # Business logic services
├── ui/                    # React UI components
│   ├── components/        # UI components
│   ├── hooks/            # Custom React hooks
│   └── styles/           # Component styles
└── docs/                 # Documentation
```

## Core Components

### 1. Services

#### AlfredService
Main orchestration service that coordinates all Alfred functionality.

```typescript
class AlfredService {
  // Session management
  createSession(projectPath?: string): Promise<AlfredSession>
  sendMessage(sessionId: string, content: string): Promise<AlfredMessage>
  
  // Code generation
  generateCode(request: CodeGenerationRequest): Promise<CodeGenerationResponse>
  
  // Project analysis
  analyzeProject(projectPath: string): Promise<ProjectAnalysis>
}
```

#### SessionRepository
Handles persistence of chat sessions using PostgreSQL with JSONB storage.

```typescript
class SessionRepository {
  saveSession(session: ChatSession): Promise<void>
  getSession(sessionId: string): Promise<ChatSession | null>
  deleteSession(sessionId: string): Promise<void>
  cleanOldSessions(daysToKeep: number): Promise<number>
}
```

#### AI Integration
Alfred uses Alexandria's shared AI service with adapters for specific functionality.

```typescript
class AlfredAIAdapter {
  chat(prompt: string, history: MessageHistory[]): Promise<string>
  streamChat(prompt: string, history: MessageHistory[]): AsyncGenerator<string>
}
```

### 2. Data Models

#### Session Structure
```typescript
interface ChatSession {
  id: string;
  name: string;
  projectId?: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
  metadata: {
    model: string;
    totalTokens: number;
    context?: ProjectContext;
  };
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    model?: string;
    tokensUsed?: number;
    processingTime?: number;
  };
}
```

### 3. UI Components

#### Component Hierarchy
```
AlfredDashboard
├── AlfredEnhancedLayout      # Main layout wrapper
├── ChatInterface              # Chat UI
│   ├── MessageList
│   ├── MessageInput
│   └── QuickActions
├── ProjectExplorer            # File browser
├── TemplateManager            # Template CRUD
├── SessionList                # Session management
└── SplitPaneEditor           # Code editor
```

## API Endpoints

### REST API

```typescript
// Session endpoints
GET    /api/alfred/sessions              // List all sessions
POST   /api/alfred/sessions              // Create new session
GET    /api/alfred/sessions/:id          // Get session details
DELETE /api/alfred/sessions/:id          // Delete session

// Message endpoints  
POST   /api/alfred/sessions/:id/messages // Send message
GET    /api/alfred/sessions/:id/stream   // Stream response

// Code generation
POST   /api/alfred/generate              // Generate code
GET    /api/alfred/templates             // List templates
POST   /api/alfred/templates             // Create template

// Project analysis
POST   /api/alfred/analyze               // Analyze project
GET    /api/alfred/projects/:id/context  // Get project context
```

## Database Schema

### PostgreSQL Tables

```sql
-- Alfred sessions stored as JSONB
CREATE TABLE alfred_sessions (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  project_id VARCHAR(36),
  messages JSONB DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  user_id VARCHAR(36)
);

-- Templates
CREATE TABLE alfred_templates (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  language VARCHAR(50),
  content TEXT NOT NULL,
  variables JSONB DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  is_public BOOLEAN DEFAULT true,
  user_id VARCHAR(36),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

## Development Setup

### Prerequisites

1. Node.js 18+ and pnpm
2. PostgreSQL 14+
3. Python 3.8+ (optional, for Python bridge)
4. Ollama or other AI service

### Installation

```bash
# Clone repository
git clone https://github.com/your-org/alexandria.git
cd alexandria

# Install dependencies
pnpm install

# Run migrations
pnpm run migrate

# Start development server
pnpm run dev
```

### Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/alexandria

# AI Service
AI_SERVICE_TYPE=ollama
OLLAMA_BASE_URL=http://localhost:11434
AI_MODEL=deepseek-coder:latest

# Optional Python bridge
ALFRED_PYTHON_PATH=/path/to/alfred/python
```

## Testing

### Running Tests

```bash
# All tests
pnpm test alfred

# Unit tests only
pnpm test:unit alfred

# Integration tests
pnpm test:integration alfred

# With coverage
pnpm test:coverage alfred
```

### Test Structure

```
__tests__/
├── unit/
│   ├── session-repository.test.ts
│   ├── alfred-service.test.ts
│   └── chat-interface.test.tsx
└── integration/
    └── alfred-plugin.integration.test.ts
```

## Plugin Integration

### Registering with Alexandria

Alfred follows the Alexandria plugin lifecycle:

```typescript
class AlfredPlugin implements PluginLifecycle {
  async onInstall() {
    // First-time setup
  }
  
  async onActivate(context: PluginContext) {
    // Initialize services
    // Register UI components
    // Setup event handlers
  }
  
  async onDeactivate() {
    // Cleanup resources
  }
  
  async onUninstall() {
    // Remove plugin data
  }
}
```

### Permission Requirements

Alfred requires these permissions:

```json
{
  "permissions": [
    "ai:query",          // AI service access
    "storage:read",      // Read files
    "storage:write",     // Save templates
    "database:read",     // Read sessions
    "database:write",    // Save sessions
    "network:http"       // External AI APIs
  ]
}
```

## Extending Alfred

### Adding New Features

1. **New Service Method**:
```typescript
// In alfred-service.ts
async suggestCode(context: CodeContext): Promise<Suggestion[]> {
  // Implementation
}
```

2. **New UI Component**:
```typescript
// In ui/components/
export function CodeSuggestions({ suggestions }: Props) {
  // Component implementation
}
```

3. **New API Endpoint**:
```typescript
// In api/alfred-api.ts
router.post('/suggest', async (req, res) => {
  // Endpoint implementation
});
```

### Creating Custom Templates

Templates use Handlebars-style variables:

```javascript
// Template content
export class {{className}} {
  constructor(private {{serviceName}}: {{serviceType}}) {}
  
  {{#each methods}}
  {{visibility}} {{name}}({{parameters}}): {{returnType}} {
    {{body}}
  }
  {{/each}}
}
```

### Integrating New AI Models

1. Implement the AI service interface
2. Register in the AI service factory
3. Update configuration options

## Performance Optimization

### Caching Strategy

- Session data cached in memory
- Project analysis results cached for 30 minutes
- Template compilation cached

### Database Optimization

- JSONB indexes for message search
- Partial indexes for active sessions
- Automatic cleanup of old sessions

### UI Performance

- Virtual scrolling for long conversations
- Lazy loading of session history
- Debounced search and input

## Security Considerations

### Input Validation

- All user inputs sanitized
- Code execution sandboxed
- File access restricted to project paths

### Authentication

- Session tokens validated
- User permissions checked
- API rate limiting applied

### Data Protection

- Sessions encrypted at rest
- PII data masked in logs
- Secure credential storage

## Troubleshooting

### Common Issues

1. **Python Bridge Not Starting**
   - Check Python path
   - Verify dependencies installed
   - Check process permissions

2. **AI Service Timeout**
   - Increase timeout settings
   - Check AI service health
   - Verify model availability

3. **Session Persistence Issues**
   - Check database connection
   - Verify table migrations
   - Check storage permissions

### Debug Mode

Enable debug logging:

```typescript
// In development
process.env.ALFRED_DEBUG = 'true';

// Logs will include:
// - AI prompts and responses
// - Database queries
// - Performance metrics
```

## Contributing

### Code Style

- Follow Alexandria's ESLint configuration
- Use TypeScript strict mode
- Write comprehensive tests
- Document public APIs

### Pull Request Process

1. Create feature branch
2. Write tests first (TDD)
3. Implement feature
4. Update documentation
5. Submit PR with description

### Review Checklist

- [ ] Tests pass
- [ ] Coverage maintained >80%
- [ ] Documentation updated
- [ ] No console errors
- [ ] Performance impact assessed

## Resources

- [Alexandria Plugin API](../../docs/plugin-development.md)
- [AI Service Documentation](../../core/services/ai-service/README.md)
- [UI Component Library](../../ui/README.md)
- [Testing Guide](../__tests__/README.md)

---

*For user-facing documentation, see [USER_GUIDE.md](./USER_GUIDE.md)*