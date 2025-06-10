# Alfred AI Assistant - User Guide

## Table of Contents
1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
3. [Features](#features)
4. [User Interface](#user-interface)
5. [Chat Sessions](#chat-sessions)
6. [Code Generation](#code-generation)
7. [Project Analysis](#project-analysis)
8. [Templates](#templates)
9. [Keyboard Shortcuts](#keyboard-shortcuts)
10. [Tips & Best Practices](#tips--best-practices)
11. [Troubleshooting](#troubleshooting)

## Introduction

Alfred is an AI-powered coding assistant integrated into the Alexandria platform. It helps developers by providing intelligent code suggestions, project analysis, and automated code generation capabilities.

### Key Features
- 🤖 AI-powered chat interface for coding questions
- 📁 Project structure analysis and understanding
- 🚀 Code generation with customizable templates
- 💾 Persistent chat sessions
- 🎨 Integrated code editor with syntax highlighting
- 🔍 Smart context awareness

## Getting Started

### Accessing Alfred

1. **From the Dashboard**: Click on the Alfred tile in the main Alexandria dashboard
2. **From the Sidebar**: Select the Alfred icon (🤖) in the activity bar
3. **Quick Access**: Press `Ctrl+K` (Windows/Linux) or `⌘K` (Mac) to open quick access

### First Time Setup

When you first open Alfred:

1. A default chat session will be created automatically
2. You can optionally select a project folder for context
3. Start chatting immediately - no additional configuration required!

## Features

### 1. AI Chat Assistant

The chat interface is your primary way to interact with Alfred:

- **Ask coding questions**: Get explanations, best practices, and solutions
- **Request code reviews**: Paste code and ask for improvements
- **Debug assistance**: Describe errors and get troubleshooting help
- **Architecture advice**: Discuss design patterns and system architecture

#### Example Prompts:
```
"How do I implement authentication in React?"
"Review this function and suggest improvements"
"Explain the difference between async/await and promises"
"Help me debug this TypeError"
```

### 2. Code Generation

Alfred can generate code based on your requirements:

1. Click the **Generate** tab or use a quick action
2. Describe what you need in natural language
3. Select the target programming language
4. Choose a template (optional)
5. Review and copy the generated code

#### Supported Languages:
- JavaScript/TypeScript
- Python
- Java
- C#
- Go
- Rust
- And more...

### 3. Project Analysis

Alfred can analyze your project structure to provide better context:

1. Click the **Project** tab
2. Select your project folder
3. Alfred will scan and understand:
   - File structure
   - Dependencies
   - Code patterns
   - Technology stack

This context improves the relevance of AI responses.

### 4. Template Management

Create and manage reusable code templates:

1. Navigate to the **Templates** tab
2. Browse existing templates or create new ones
3. Templates can include:
   - Variable placeholders
   - Default values
   - Documentation
   - Language-specific formatting

## User Interface

### Layout Overview

```
┌─────────────────────────────────────────────────────┐
│  Title Bar                                    [- □ x]│
├─────┬───────────────────────────────────────────────┤
│  A  │  Alfred AI Assistant                          │
│  C  ├─────────────────────┬─────────────────────────┤
│  T  │                     │                         │
│  I  │   Navigation        │     Main Content        │
│  V  │   Sidebar           │      Area               │
│  I  │                     │                         │
│  T  │                     │                         │
│  Y  │                     │                         │
│     │                     │                         │
│ BAR │                     │                         │
└─────┴─────────────────────┴─────────────────────────┘
```

### Components

1. **Activity Bar**: Quick access to main features
   - Chat (💬)
   - Editor (📝)
   - Generate (⚡)
   - Sessions (📁)
   - Project (🗂️)
   - Templates (📋)

2. **Sidebar**: Contextual navigation and information
   - Session list
   - Project files
   - Quick stats

3. **Content Area**: Main interaction space
   - Chat messages
   - Code editor
   - Forms and settings

## Chat Sessions

### Managing Sessions

#### Creating a New Session
1. Click **"New Chat"** button in the header
2. Or use `Ctrl+N` / `⌘N`
3. Optionally associate with a project

#### Switching Between Sessions
- Click on any session in the sidebar
- Sessions are sorted by last activity
- Active session is highlighted

#### Deleting Sessions
1. Hover over a session in the list
2. Click the trash icon (🗑️)
3. Confirm deletion

### Session Features

- **Auto-save**: All messages are saved automatically
- **History**: Full conversation history is preserved
- **Search**: Find messages within sessions
- **Export**: Download session as text file

## Code Generation

### Basic Code Generation

1. **Describe Your Need**:
   ```
   "Create a React component for a user profile card with avatar, name, and bio"
   ```

2. **Specify Requirements**:
   - Language/Framework
   - Styling preferences
   - Additional features

3. **Review Output**:
   - Syntax-highlighted code
   - Copy button for easy use
   - Explanation of the code

### Using Templates

1. Select **"Use Template"** when generating code
2. Choose from available templates
3. Fill in template variables
4. Generate customized code

### Advanced Options

- **Context Mode**: Include project context for better results
- **Style Guide**: Apply your project's coding standards
- **Test Generation**: Automatically create unit tests

## Project Analysis

### Analyzing a Project

1. Click **"Select Project"** in the Project tab
2. Navigate to your project root folder
3. Alfred will analyze:
   - Directory structure
   - File types and languages
   - Dependencies (package.json, requirements.txt, etc.)
   - Code patterns

### Using Project Context

Once analyzed, Alfred will:
- Understand your tech stack
- Suggest stack-appropriate solutions
- Reference existing code patterns
- Maintain consistency with your codebase

### Refreshing Analysis

- Click **"Refresh"** to re-analyze after changes
- Analysis is cached for performance
- Updated automatically on significant changes

## Templates

### Creating Templates

1. Go to Templates tab
2. Click **"New Template"**
3. Fill in:
   - **Name**: Descriptive template name
   - **Category**: Organization category
   - **Language**: Target programming language
   - **Content**: Template code with variables

#### Template Variables

Use double curly braces for variables:
```javascript
class {{className}} extends {{baseClass}} {
  constructor({{constructorParams}}) {
    super();
    {{constructorBody}}
  }
}
```

### Using Templates

1. When generating code, select **"From Template"**
2. Choose your template
3. Fill in variable values
4. Generate and customize

### Sharing Templates

- Export templates as JSON
- Import templates from files
- Share with team members

## Keyboard Shortcuts

### Global Shortcuts

| Action | Windows/Linux | Mac |
|--------|--------------|-----|
| Quick Access | `Ctrl+K` | `⌘K` |
| New Session | `Ctrl+N` | `⌘N` |
| Toggle Sidebar | `Ctrl+B` | `⌘B` |
| Focus Chat | `Ctrl+L` | `⌘L` |

### Chat Shortcuts

| Action | Shortcut |
|--------|----------|
| Send Message | `Enter` |
| New Line | `Shift+Enter` |
| Previous Message | `↑` |
| Next Message | `↓` |
| Copy Message | `Ctrl/⌘+C` |

### Editor Shortcuts

| Action | Windows/Linux | Mac |
|--------|--------------|-----|
| Format Code | `Shift+Alt+F` | `⇧⌥F` |
| Comment Line | `Ctrl+/` | `⌘/` |
| Find | `Ctrl+F` | `⌘F` |
| Replace | `Ctrl+H` | `⌘H` |

## Tips & Best Practices

### Effective Prompting

1. **Be Specific**: 
   - ❌ "Make a function"
   - ✅ "Create a TypeScript function that validates email addresses using regex"

2. **Provide Context**:
   - Mention frameworks/libraries you're using
   - Specify constraints or requirements
   - Include error messages when debugging

3. **Iterative Refinement**:
   - Start with basic requirements
   - Add details based on initial output
   - Ask for specific improvements

### Project Organization

- Keep sessions organized by project
- Name sessions descriptively
- Clean up old sessions regularly
- Use templates for repeated patterns

### Performance Tips

- Select appropriate project folders (not too large)
- Clear chat history in very long sessions
- Use specific file references when possible
- Enable streaming for faster responses

## Troubleshooting

### Common Issues

#### "AI Service Unavailable"
- Check your internet connection
- Verify AI service configuration
- Try refreshing the page

#### "Session Not Found"
- Session may have been deleted
- Try creating a new session
- Check browser storage limits

#### "Code Generation Failed"
- Provide more specific requirements
- Check template syntax if using templates
- Try a simpler prompt first

### Getting Help

1. **Built-in Help**: Click the help icon (❓) in the interface
2. **Documentation**: Access full docs from Settings
3. **Community**: Join the Alexandria Discord
4. **Support**: Contact support@alexandria.dev

### Debug Mode

Enable debug mode for detailed logging:
1. Go to Settings
2. Enable "Debug Mode"
3. Check browser console for logs

## Advanced Features

### API Integration

Alfred can help with API development:
- Generate API endpoints
- Create documentation
- Test API calls
- Mock data generation

### Database Queries

Get help with:
- SQL query optimization
- Schema design
- Migration scripts
- ORM usage

### DevOps Support

Alfred understands:
- Docker configurations
- CI/CD pipelines
- Kubernetes manifests
- Infrastructure as Code

---

## Updates & Changelog

Alfred is continuously improved. Check the changelog for:
- New features
- Model updates
- Bug fixes
- Performance improvements

---

*Alfred AI Assistant is part of the Alexandria Platform. For platform-wide documentation, visit the main Alexandria docs.*