# Alexandria Platform

A modular AI-enhanced customer care and services platform with a microkernel architecture.

## Overview

The Alexandria Platform is a modular customer care solution built on a microkernel architecture pattern. It provides a minimal core system with well-defined extension points that allow for plugin-based functionality.

### Key Features

- **Microkernel Architecture**: Minimal core with stable extension points
- **Plugin System**: Discover, load, and manage plugins dynamically
- **Event-Based Communication**: Loosely coupled components communicating via events
- **Feature Flags**: Controlled rollout of features and plugins
- **AI Integration**: Local LLM support via Ollama for AI-powered functionality
- **Modular UI**: Extensible user interface with plugin contribution points

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 14+ (for data persistence)
- Ollama (for local LLM support)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/alexandria-platform.git
   cd alexandria-platform
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

   If you encounter platform-specific binary issues:
   ```bash
   # This will automatically fix Rollup binary issues
   npm install
   
   # Or run the fix script directly
   node fix-rollup.js
   
   # If you encounter missing UI component dependencies
   node fix-dependencies.js
   ```
   
   Windows users can use the provided setup script:
   ```
   setup-windows.bat
   ```

3. Configure environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. Database Configuration:
   - By default, the application uses an in-memory database
   - To use PostgreSQL, set `USE_POSTGRES=true` in your `.env` file
   - Configure the following PostgreSQL settings in your `.env` file:
     ```
     POSTGRES_HOST=localhost
     POSTGRES_PORT=5432
     POSTGRES_USER=postgres
     POSTGRES_PASSWORD=your_password
     POSTGRES_DB=alexandria
     POSTGRES_SSL=false  # Set to true for SSL connections
     ```
   - The application will automatically create tables on startup

5. Start the development server:
   ```bash
   npm run dev
   ```

   The project includes an automatic fix for the `@rollup/rollup-win32-x64-msvc` error that runs automatically. If you still experience issues, you can manually fix them:
   ```bash
   # Run the Rollup fix script
   npm run fix-rollup
   
   # Then start the development server
   npm run dev
   ```

## Core Architecture

### Core System

The core system provides minimal functionality required by the platform:
- Request handling
- Authentication/authorization
- Core data models
- UI shell

### Plugin Registry

The plugin registry discovers, installs, and manages plugins:
- Plugin discovery
- Lifecycle management (install, activate, deactivate, uninstall)
- Dependency resolution
- Permission management

### Event Bus

The event bus enables communication between the core and plugins:
- Pub/sub pattern
- Topic-based messaging
- Synchronous and asynchronous events
- Error handling

### Feature Flags

The feature flag service controls feature rollout:
- Context-based evaluation
- Gradual rollout (percentage-based)
- User segmentation
- Audit logging

## Plugins

The platform includes these core plugins:

### AI-Powered Crash Analyzer (MVP)

Analyzes crash logs using LLMs to identify root causes:
- Log ingestion and parsing
- Local LLM integration (Ollama)
- Root cause analysis
- Interactive visualization

### Log Visualization

Aggregates and visualizes log data:
- Multiple source adapters
- Search and filtering
- Pattern visualization
- Real-time streaming

### AI-Driven Ticket Analysis

Analyzes support tickets using NLP:
- Ticket categorization
- Priority suggestions
- Similar ticket identification
- Trend analysis

### Intelligent Knowledge Base (RAG)

Retrieval augmented generation for knowledge access:
- Multiple source connections
- Vector embedding storage
- Context-aware answers
- Source citations

## Development

### Building

```bash
npm run build
```

### Testing

```bash
npm test
```

### Linting

```bash
npm run lint
```

## Contributing

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/my-new-feature`
3. Commit your changes: `git commit -am 'Add some feature'`
4. Push to the branch: `git push origin feature/my-new-feature`
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.# Alexandria
