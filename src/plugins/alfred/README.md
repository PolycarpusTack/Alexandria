# Alfred Plugin for Alexandria

🤖 **Alfred** is an AI-powered coding assistant plugin for the Alexandria platform that helps developers write better code faster through intelligent suggestions, code generation, and project understanding.

![Alfred Banner](docs/images/alfred-banner.png)

## Features

### 🎯 Core Capabilities

- **AI Chat Assistant** - Natural language coding help and explanations
- **Code Generation** - Generate code from descriptions with template support
- **Project Analysis** - Understand and work within your project context
- **Session Persistence** - All conversations saved and searchable
- **Multi-Model Support** - Works with Ollama, OpenAI, and other AI providers
- **Template System** - Create reusable code templates with variables

### 🛠️ Technical Features

- **PostgreSQL Storage** - Reliable session and template persistence
- **Real-time Streaming** - See AI responses as they're generated
- **Syntax Highlighting** - Beautiful code display with language detection
- **Project Context** - AI understands your codebase structure
- **Export/Import** - Share sessions and templates
- **Keyboard Shortcuts** - Efficient workflow with hotkeys

## Installation

Alfred comes pre-installed with Alexandria. To verify it's enabled:

```bash
# Check plugin status
alexandria plugins list

# Enable if needed
alexandria plugins enable alfred
```

## Quick Start

1. **Open Alfred**
   - Click the Alfred tile in Alexandria dashboard
   - Or press `Ctrl+K` (Windows/Linux) or `⌘K` (Mac)

2. **Start Chatting**
   ```
   "How do I create a REST API endpoint in Express?"
   "Help me refactor this function to be more efficient"
   "Generate unit tests for this React component"
   ```

3. **Generate Code**
   - Click "Generate" tab
   - Describe what you need
   - Select language and optional template
   - Copy generated code

## Documentation

- 📖 **[User Guide](docs/USER_GUIDE.md)** - Complete user documentation
- 🔧 **[Developer Guide](docs/DEVELOPER_GUIDE.md)** - Technical documentation
- 📋 **[Quick Reference](docs/QUICK_REFERENCE.md)** - Shortcuts and commands

## Project Structure

```
alfred/
├── src/                    # Core business logic
│   ├── api/               # REST API endpoints
│   ├── bridge/            # Python integration
│   ├── repositories/      # Data persistence
│   └── services/          # Business logic
├── ui/                    # React components
│   ├── components/        # UI components
│   ├── hooks/            # React hooks
│   └── styles/           # CSS styles
├── __tests__/            # Test suites
│   ├── unit/             # Unit tests
│   └── integration/      # Integration tests
└── docs/                 # Documentation
```

## Development

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Python 3.8+ (optional)
- pnpm package manager

### Setup

```bash
# Clone repository
git clone https://github.com/your-org/alexandria.git
cd alexandria

# Install dependencies
pnpm install

# Run tests
pnpm test alfred

# Start development
pnpm dev
```

### Testing

```bash
# Run all tests
pnpm test

# Unit tests only
pnpm test:unit

# With coverage
pnpm test:coverage

# Watch mode
pnpm test:watch
```

## Configuration

### Environment Variables

```env
# AI Service Configuration
AI_SERVICE_TYPE=ollama
OLLAMA_BASE_URL=http://localhost:11434
AI_MODEL=deepseek-coder:latest

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/alexandria

# Optional Python Bridge
ALFRED_PYTHON_PATH=/path/to/alfred/python
```

### Plugin Configuration

```json
{
  "alfred": {
    "defaultModel": "deepseek-coder:latest",
    "maxTokens": 4096,
    "temperature": 0.7,
    "streamingEnabled": true,
    "sessionRetentionDays": 30
  }
}
```

## API Reference

### Core Endpoints

```typescript
// Sessions
GET    /api/alfred/sessions
POST   /api/alfred/sessions
GET    /api/alfred/sessions/:id
DELETE /api/alfred/sessions/:id

// Messages
POST   /api/alfred/sessions/:id/messages
GET    /api/alfred/sessions/:id/stream

// Code Generation
POST   /api/alfred/generate

// Templates
GET    /api/alfred/templates
POST   /api/alfred/templates
```

### WebSocket Events

```typescript
// Client -> Server
'alfred:message'         // Send message
'alfred:generate'        // Generate code
'alfred:analyze'         // Analyze project

// Server -> Client
'alfred:response'        // AI response
'alfred:stream'          // Streaming chunk
'alfred:error'           // Error message
```

## Contributing

We welcome contributions! Please see our [Contributing Guide](../../CONTRIBUTING.md) for details.

### Development Workflow

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Write tests first (TDD)
4. Implement feature
5. Run tests (`pnpm test`)
6. Commit changes (`git commit -m 'Add amazing feature'`)
7. Push branch (`git push origin feature/amazing-feature`)
8. Open Pull Request

### Code Style

- TypeScript with strict mode
- ESLint + Prettier formatting
- Comprehensive JSDoc comments
- 80%+ test coverage required

## Troubleshooting

### Common Issues

**AI Service Not Responding**
- Check Ollama is running: `curl http://localhost:11434/api/tags`
- Verify model is downloaded: `ollama list`
- Check Alexandria logs: `alexandria logs alfred`

**Sessions Not Saving**
- Verify PostgreSQL connection
- Check database migrations: `pnpm migrate`
- Ensure proper permissions

**Python Bridge Issues**
- Verify Python path in config
- Check Python dependencies: `pip install -r requirements.txt`
- Run in TypeScript-only mode if needed

## License

This project is part of Alexandria and follows the same license terms. See the [LICENSE](../../LICENSE) file for details.

## Support

- 📧 **Email**: support@alexandria.dev
- 💬 **Discord**: [Join our community](https://discord.gg/alexandria)
- 🐛 **Issues**: [GitHub Issues](https://github.com/your-org/alexandria/issues)
- 📚 **Docs**: [Full Documentation](https://docs.alexandria.dev/plugins/alfred)

## Acknowledgments

- Built with ❤️ by the Alexandria team
- Powered by open-source AI models
- Special thanks to all contributors

---

<p align="center">
  <a href="https://alexandria.dev">Website</a> •
  <a href="https://docs.alexandria.dev">Documentation</a> •
  <a href="https://github.com/your-org/alexandria">GitHub</a>
</p>