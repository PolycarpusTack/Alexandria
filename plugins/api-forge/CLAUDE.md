# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Apicarus Plugin - Alexandria Platform

Apicarus is an AI-enhanced API development and testing plugin for the Alexandria platform. It provides comprehensive HTTP/REST API testing capabilities with AI assistance for request generation, analysis, and code export.

## Development Commands

### Essential Commands
```bash
# Install dependencies
npm install

# Run development build with watch mode
npm run dev

# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run a specific test file
npm test -- RequestBuilder.test.js

# Check code style
npm run lint

# Auto-fix linting issues
npm run lint -- --fix

# Format code with Prettier
npm run format

# Production build
npm run build
```

## Architecture Overview

### Plugin Structure
The plugin follows Alexandria's microkernel architecture pattern:

1. **Main Entry (index.js)**: 
   - `ApicarusPlugin` class extends Alexandria's base `Plugin` class
   - Manages plugin lifecycle via `onActivate()` and `onDeactivate()` hooks
   - Orchestrates all components and maintains global state
   - Registers UI panels, commands, and keyboard shortcuts

2. **Component Architecture**:
   - Each component in `src/components/` is self-contained with its own responsibilities
   - Components communicate through the main plugin instance
   - State flows top-down from ApicarusPlugin to components
   - Events bubble up through callbacks

3. **Alexandria SDK Integration**:
   - Uses `alexandria-sdk` for platform integration
   - Leverages platform services: UI panels, commands, storage, AI inference
   - Follows platform conventions for event handling and lifecycle management

### Key Components and Their Interactions

- **RequestBuilder** → Constructs HTTP requests, validates inputs, handles authentication
- **ResponseViewer** → Displays and formats API responses with syntax highlighting
- **CollectionManager** → Persists and organizes saved requests using Alexandria's storage
- **EnvironmentManager** → Manages variable substitution across environments
- **CodeGenerator** → Exports requests to multiple programming languages
- **AIAssistant** → Integrates with Alexandria's AI service for intelligent features

### Testing Strategy

The codebase uses Jest with the following patterns:
- Mock the Alexandria SDK in `tests/setup.js`
- Custom matchers like `toBeValidRequest()` for domain-specific assertions
- Test files mirror source structure (e.g., `RequestBuilder.js` → `RequestBuilder.test.js`)
- Focus on unit tests with some integration testing for complex workflows

### State Management

- Plugin state is centralized in the ApicarusPlugin instance
- Components receive state and callbacks as constructor parameters
- State updates flow through the main plugin class
- Persistent state uses Alexandria's storage service

### Event Flow

1. User interactions trigger component methods
2. Components call plugin methods or emit events
3. Plugin updates state and notifies other components
4. UI updates are handled by Alexandria's panel system

## Important Implementation Details

### Authentication Handling
The plugin supports multiple auth types (Bearer, Basic, API Key). Authentication logic is handled in `RequestBuilder.buildRequest()` which adds appropriate headers based on the selected auth type.

### Environment Variables
Variables use `{{variableName}}` syntax and are replaced recursively in requests. The `EnvironmentManager` handles variable storage and substitution across all request fields.

### AI Integration Points
- Natural language to request conversion in `AIAssistant.generateRequestFromNL()`
- Response analysis uses structured prompts to extract insights
- Test generation creates Jest/Mocha compatible test cases

### Error Handling
All components implement try-catch blocks with user-friendly error messages. Network errors, parsing errors, and validation errors are handled separately with appropriate feedback.

## Development Guidelines

1. **Adding New Features**: Create new components in `src/components/` following existing patterns
2. **Modifying Requests**: Changes to request structure should update both `RequestBuilder` and associated tests
3. **AI Features**: Use Alexandria's AI service through `this.ai.generateText()` with structured prompts
4. **UI Updates**: Register new panels/commands in `onActivate()` and clean up in `onDeactivate()`
5. **Testing**: Write tests for all new functionality, aim for >80% coverage

## Common Pitfalls to Avoid

- Don't access DOM directly - use Alexandria's UI services
- Always clean up event listeners in `onDeactivate()`
- Handle async operations with proper error handling
- Validate all user inputs before processing
- Use the platform's storage service for persistence, not localStorage