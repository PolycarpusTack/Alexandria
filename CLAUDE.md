# CLAUDE.md - Essential Guide for Working with Alexandria

## 🚨 TOP 5 NON-NEGOTIABLE RULES - MUST READ FIRST

1. **NEVER REPLACE COMPLEX COMPONENTS WITH SIMPLIFIED VERSIONS** — Always fix the actual problem in existing code, never create a "simplified" replacement.

2. **ALWAYS FIX ROOT CAUSES** — Diagnose and address the underlying issue, don't create workarounds or patches that mask it.

3. **WHEN REQUIREMENTS ARE AMBIGUOUS, ASK FOR CLARIFICATION** — If any part of the request is unclear, always ask specific questions rather than making assumptions.

4. **CODE MUST EXACTLY MATCH REQUIREMENTS** — Implement precisely what was requested, no extra features, no altered behavior unless explicitly approved.

5. **EVERY FUNCTION MUST HANDLE ERRORS AND EDGE CASES** — No exceptions. All code must validate inputs, handle errors gracefully, and consider edge conditions.

> ⚠️ **Remember: When in doubt, ASK. It's always better to clarify requirements than to make incorrect assumptions.**

---

## Repository Overview

The Alexandria repository serves two primary purposes:

1. **Collection of Advanced Prompt Engineering Templates** designed for AI-assisted content generation:

   - Software architecture design (Alexandria_Plan)
   - API documentation generation (ULTIMATE API DOCUMENTATION GENERATOR)
   - Code explanation templates (Files For Dummies)
   - Educational content creation (Ultimate Zero-to-Hero Textbook Generator)
   - AI programming guidelines (Ultimate AI Coding Guidelines)

2. **Modular AI-Enhanced Customer Care Platform** - An enterprise application being actively developed:

   - Follows microkernel architecture with plugin system
   - Includes the Crash File Analyzer application as a core plugin
   - Built with modern web technologies (React, TypeScript, ShadCN UI components)

---

## Working with this Repository

### Core Development Principles

1. **Follow Microkernel Architecture**: Maintain strict separation of core and plugin functionalities
2. **Event-Driven Communication**: Use the event bus for cross-component communication
3. **Strong Typing**: Leverage TypeScript for type safety throughout the codebase
4. **Plugin Lifecycle**: Follow the proper lifecycle hooks for plugins (install, activate, deactivate, uninstall)
5. **Error Handling**: Implement comprehensive error handling with context-rich information

---

## Current Project Status

The Alexandria platform is an advanced, modular AI-enhanced customer care platform currently in active development. The project follows a microkernel architecture with a plugin system, utilizing modern web technologies including React, TypeScript, and ShadCN UI components.

**Key components:**

1. **Core Architecture**: Microkernel design with plugin registry, event bus, and core services
2. **Plugins**: Crash Analyzer plugin implemented with Ollama LLM integration
3. **UI Framework**: Modern responsive interface using React, TypeScript, and ShadCN UI components
4. **Development Status**: In progress, following the EPICs defined in the Alexandria_Plan documents

---

## Code Quality Standards

### Error Handling Requirements

1. **Input Validation**: Validate all function inputs at the start of each function
2. **Try/Catch Patterns**: Use proper try/catch blocks for operations that may fail
3. **Error Propagation**: Create specific error types and propagate with context
4. **Resource Cleanup**: Always use finally blocks to ensure resource cleanup
5. **Error Logging**: Log errors with appropriate severity and context

### TypeScript and Linting

1. **Explicit Types**: Add explicit types to all function parameters, variables, and return types
2. **Interface-First Design**: Define interfaces before implementing classes
3. **No 'any' Types**: Avoid using 'any' type; use proper typing or unknown + type guards
4. **Fix Linting Issues**: Resolve all linting errors before submitting code

### UI Component Development

1. **Follow Design System**: Use existing UI components from the library
2. **Component Composition**: Compose from smaller, single-responsibility components
3. **State Management**: Keep state as close to where it's used as possible
4. **Accessibility**: Ensure all components are accessible (ARIA attributes, keyboard navigation)
5. **Responsiveness**: Design for mobile and desktop viewports

### Testing Standards

1. **Test Coverage**: Aim for 80%+ coverage on core functionality
2. **Test Types**: Include unit, integration, and UI component tests
3. **Mock Dependencies**: Use proper mocking for external dependencies
4. **Edge Cases**: Test error paths and edge conditions
5. **Component Testing**: Test UI components in isolation and within context

### Security Practices

1. **Input Sanitization**: Validate and sanitize all user inputs
2. **Authentication**: Verify authentication for protected operations
3. **Authorization**: Check permissions before performing sensitive actions
4. **Data Protection**: Encrypt sensitive data at rest and in transit
5. **Dependency Security**: Keep dependencies updated and scan for vulnerabilities

---

## Common Edge Cases to Handle

1. **Network Failures**: All external API calls should include timeout and retry logic
2. **User Authentication**: Check for expired tokens and handle re-authentication
3. **Empty Data**: Handle cases where expected data is null, undefined, or empty
4. **Large Data Sets**: Implement pagination or virtualization for large collections
5. **Concurrent Operations**: Account for race conditions in asynchronous operations

---

## Repository Structure

- **Alexandria_Plan_part1.md and Alexandria_Plan_part2.md**: Detailed JIRA-style action plan for creating a modular AI-enhanced customer care platform
- **ULTIMATE API DOCUMENTATION GENERATOR.md**: Framework for creating comprehensive API documentation
- **Files For Dummies.md** and variations: Templates for explaining code files in a beginner-friendly manner
- **Ultimate Zero-to-Hero Textbook Generator Prompt.md**: Framework for creating comprehensive educational content
- **Ultimate AI Coding Guidelines.md**: Best practices for AI-assisted code generation
- **PROJECT_STATUS.md**: Current status of the Alexandria platform implementation

---

## Alexandria Platform Implementation

The Alexandria platform is centered around a microkernel architecture with a plugin system:

1. **Core System**: Central kernel managing plugins, messaging, and core services
2. **Plugin System**: Extendable architecture allowing additional functionality through plugins
3. **Crash File Analyzer Plugin**: Key plugin implemented with Ollama LLM integration for analyzing software crash files
4. **Event Bus**: Communication mechanism between components
5. **UI Framework**: Modern frontend built with React, TypeScript, and ShadCN UI components

---

## Crash File Analyzer Plugin Details

The Crash File Analyzer is a plugin designed to analyze software crash files:

1. **Purpose**: Automates the analysis of software crash files to reduce debugging time
2. **LLM Integration**: Uses locally deployed Ollama for AI-powered analysis
3. **Core Features**:

   - Secure file upload
   - Code snippet input
   - Various analysis options (explain crash, suggest fixes)
   - Storage of analysis history
   - Database integration for persistent storage

---

## Development Debugging Memories

### Vite and TypeScript Module Resolution Error

```
Error: Cannot find module 'C:\Projects\Alexandria\src\core\system\core-system' imported from C:\Projects\Alexandria\src\index.ts
```

**Possible Causes and Debugging Notes**:

- Module resolution error likely due to incorrect import path or missing module
- Potential TypeScript configuration issue
- Verify the exact path and existence of 'core-system' module
- Check tsconfig.json for module resolution settings
- Ensure the file exists at the specified path
- Potential ESM vs CommonJS module compatibility problem

---

## Coding Standards and Process

### Foundational Principles

- **Enterprise-Grade Mindset**: Prioritize stability, robustness, security, and maintainability
- **Clarity and Simplicity**: Follow KISS, DRY, and YAGNI principles
- **Correctness**: Implement requirements accurately and completely
- **Maintainability**: Create modular, loosely coupled code with high cohesion
- **Efficiency**: Balance performance with maintainability

### Robustness & Error Handling

- **Validate all inputs** at the start of each function
- **Use try/catch blocks** for operations that may fail
- **Provide graceful degradation** for partial system failures
- **Ensure proper resource management** (connections, files, memory)

### Code Generation Protocol

- **Requirement Decomposition**: Break down complex tasks into smaller, manageable steps
- **Clarification**: Ask questions immediately if any part of the request is ambiguous
- **Structured Process**: Follow a systematic approach to code generation
- **Self-Documenting Code**: Write code that is as self-explanatory as possible

### Self-Correction and Review Loop

- **Requirements Check**: Verify that code fully satisfies the original request
- **No Regressions**: Ensure modifications don't break existing functionality
- **Minimal Changes**: Make only necessary modifications
- **Quality Review**: Verify code cleanliness, readability, and architecture consistency
- **Security Review**: Check for common vulnerabilities and follow security best practices

---

## Additional Resources

When working with these prompt templates, useful external references include:

1. [Claude Documentation](https://docs.anthropic.com/claude/docs)
2. [Claude Prompt Engineering Guide](https://docs.anthropic.com/claude/docs/introduction-to-prompt-design)
3. [Anthropic's Constitutional AI framework](https://www.anthropic.com/research)

---

> ⚠️ **FINAL REMINDER: When faced with ambiguity, ALWAYS ask for clarification rather than proceeding with assumptions.**
