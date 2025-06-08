# CLAUDE.md - Alfred Plugin Development Guidelines

## Overview

The Alfred plugin is a core component of Alexandria that provides AI-powered coding assistance. When working on this plugin, follow these specific guidelines in addition to Alexandria's general guidelines.

## Key Principles

1. **Maintain Python Alfred Compatibility**: Ensure that features from the original Python Alfred are preserved or enhanced, never removed without explicit approval.

2. **AI Model Agnostic**: The plugin should work with multiple AI providers (Ollama, OpenAI, etc.) through Alexandria's AI service layer.

3. **Project Context Awareness**: Always maintain and utilize project context for more accurate AI responses.

4. **Template Integrity**: Never modify user-created templates without explicit permission.

5. **Session Preservation**: Chat sessions must be safely persisted and recoverable.

## Architecture Guidelines

### Service Layer
- `AlfredService` is the main orchestrator - keep it focused on coordination
- Each service should have a single responsibility
- Services should communicate through events, not direct calls
- All AI calls must go through Alexandria's AI service

### Data Layer
- Use repositories for all data access
- Sessions and templates are stored in Alexandria's database
- File operations must use Alexandria's file service with proper permissions

### UI Components
- Follow Alexandria's React component patterns
- Use ShadCN UI components for consistency
- Implement proper loading and error states
- Support both light and dark themes

## Code Patterns

### AI Integration
```typescript
// GOOD - Using Alexandria's AI service
const response = await this.aiService.query(prompt, {
  model: userPreferredModel,
  context: projectContext
});

// BAD - Direct API calls
const response = await fetch('http://localhost:11434/api/generate', {...});
```

### Event Handling
```typescript
// GOOD - Using event bus
this.eventBus.emit('alfred:code-generated', {
  sessionId,
  language,
  linesOfCode
});

// BAD - Direct component coupling
this.uiComponent.onCodeGenerated(code);
```

### Error Handling
```typescript
// GOOD - Comprehensive error handling
try {
  const result = await this.generateCode(request);
  return result;
} catch (error) {
  this.logger.error('Code generation failed', { error, request });
  
  if (error instanceof TemplateNotFoundError) {
    throw new UserError('Template not found. Please select a valid template.');
  }
  
  throw new SystemError('Code generation failed. Please try again.');
}

// BAD - Generic error handling
try {
  return await this.generateCode(request);
} catch (error) {
  throw error;
}
```

## Feature Implementation Checklist

When implementing new features:

- [ ] Preserves existing Alfred functionality
- [ ] Uses Alexandria's service layer appropriately
- [ ] Includes comprehensive error handling
- [ ] Emits appropriate events
- [ ] Updates TypeScript interfaces
- [ ] Includes unit tests
- [ ] Updates documentation
- [ ] Supports all UI themes
- [ ] Handles offline/error states gracefully

## Testing Requirements

1. **Unit Tests**: Every service method must have tests
2. **Integration Tests**: Test interaction with Alexandria's core services
3. **UI Tests**: Test all user interactions
4. **AI Mock Tests**: Test with mocked AI responses

## Common Pitfalls to Avoid

1. **Don't bypass Alexandria's permission system** - Always check permissions for file operations
2. **Don't store sensitive data in sessions** - API keys, passwords, etc.
3. **Don't hardcode AI models** - Always use configuration
4. **Don't ignore project context** - It significantly improves AI responses
5. **Don't modify the file system directly** - Use Alexandria's file service

## Performance Considerations

1. **Session Loading**: Lazy load old messages, show recent first
2. **Project Analysis**: Cache results and update incrementally
3. **Template Rendering**: Pre-compile templates for faster generation
4. **AI Responses**: Stream responses when possible
5. **Search Operations**: Use indexed search for templates and sessions

## Security Guidelines

1. **Validate all user inputs** - Especially code templates and file paths
2. **Sanitize AI responses** - Prevent XSS in chat display
3. **Check file permissions** - Ensure users can only access allowed directories
4. **Rate limit AI calls** - Prevent abuse and cost overruns
5. **Audit sensitive operations** - Log project access and code generation

## Remember

Alfred is a tool to enhance developer productivity. Every feature should:
- Save time
- Reduce errors
- Improve code quality
- Be intuitive to use

When in doubt, ask: "Would this help a developer write better code faster?"