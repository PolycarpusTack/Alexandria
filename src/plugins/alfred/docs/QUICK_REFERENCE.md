# Alfred Plugin - Quick Reference

## Quick Start

```bash
# Start Alfred
1. Open Alexandria Dashboard
2. Click Alfred tile or press Ctrl+K / ⌘K
3. Start chatting!
```

## Essential Commands

### Chat Commands
- **New Session**: `Ctrl+N` / `⌘N`
- **Send Message**: `Enter`
- **New Line**: `Shift+Enter`
- **Copy Message**: Click copy icon or select text + `Ctrl+C` / `⌘C`

### Quick Actions (Empty Input)
- 🔧 **Generate Code**: Start code generation
- 💡 **Explain Code**: Get code explanations
- ✨ **Refactor**: Improve existing code
- 🧪 **Add Tests**: Generate unit tests
- 📚 **Documentation**: Create docs
- ⚡ **Optimize**: Performance improvements

## Common Prompts

### Code Generation
```
"Create a React component for [description]"
"Generate a REST API endpoint for [resource]"
"Write a function to [task]"
"Create a [language] class for [purpose]"
```

### Debugging
```
"Help me fix this error: [error message]"
"Why is this code not working: [code]"
"Debug this function: [code]"
"Explain this error message: [error]"
```

### Learning
```
"Explain [concept] in simple terms"
"What's the difference between [A] and [B]"
"Show me best practices for [topic]"
"How do I implement [pattern/feature]"
```

### Code Review
```
"Review this code: [code]"
"Suggest improvements for: [code]"
"Is this secure: [code]"
"Optimize this function: [code]"
```

## Template Variables

When using templates, these variables are commonly available:

- `{{className}}` - Class name
- `{{functionName}}` - Function name
- `{{parameters}}` - Function parameters
- `{{returnType}}` - Return type
- `{{description}}` - Description/comment
- `{{imports}}` - Import statements
- `{{body}}` - Main content

## Project Context

Alfred understands these project files:
- `package.json` - Node.js dependencies
- `requirements.txt` - Python dependencies
- `pom.xml` / `build.gradle` - Java projects
- `.csproj` - C# projects
- `go.mod` - Go modules
- `Cargo.toml` - Rust projects

## Keyboard Shortcuts

### Navigation
| Action | Windows/Linux | Mac |
|--------|--------------|-----|
| Quick Access | `Ctrl+K` | `⌘K` |
| New Session | `Ctrl+N` | `⌘N` |
| Toggle Sidebar | `Ctrl+B` | `⌘B` |
| Focus Chat | `Ctrl+L` | `⌘L` |
| Switch Tab | `Ctrl+Tab` | `⌘Tab` |

### Editor
| Action | Windows/Linux | Mac |
|--------|--------------|-----|
| Format Code | `Shift+Alt+F` | `⇧⌥F` |
| Comment Line | `Ctrl+/` | `⌘/` |
| Find | `Ctrl+F` | `⌘F` |
| Replace | `Ctrl+H` | `⌘H` |
| Go to Line | `Ctrl+G` | `⌘G` |

## AI Model Selection

Default model: `deepseek-coder:latest`

To change:
1. Go to Settings
2. Select AI Model
3. Choose from available models

Popular models:
- `deepseek-coder`: Best for code
- `codellama`: Good balance
- `mistral`: General purpose
- `gpt-4`: Premium features

## Tips for Better Results

### ✅ DO:
- Be specific about requirements
- Include language/framework
- Provide examples
- Ask follow-up questions
- Use project context

### ❌ DON'T:
- Use vague descriptions
- Assume context
- Request entire applications
- Ignore error messages
- Skip testing generated code

## File Size Limits

- **Code Generation**: No limit (streamed)
- **File Upload**: 10MB
- **Project Analysis**: 100MB total
- **Template Size**: 1MB
- **Session Export**: 50MB

## Performance Tips

1. **Large Projects**: Select specific subdirectories
2. **Long Sessions**: Start new session after 100+ messages
3. **Slow Responses**: Check AI service status
4. **Memory Issues**: Clear browser cache
5. **Offline Mode**: Some features work offline

## Error Messages

| Error | Solution |
|-------|----------|
| "Session not found" | Create new session |
| "AI service unavailable" | Check connection/settings |
| "Request timeout" | Simplify prompt or retry |
| "Invalid template" | Check template syntax |
| "Permission denied" | Check file permissions |

## Getting Help

- **In-app Help**: Click `?` icon
- **Documentation**: `/alfred/docs`
- **Report Issues**: GitHub issues
- **Community**: Discord `#alfred-help`

---

*Last updated: v1.0.0*