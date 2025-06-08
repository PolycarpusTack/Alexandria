# ALFRED Plugin for Alexandria

## AI-Linked Framework for Rapid Engineering Development

ALFRED is a powerful AI coding assistant plugin for the Alexandria platform that helps developers with rapid engineering development through intelligent code generation, project analysis, and interactive AI assistance.

## Features

### 🤖 AI-Powered Chat Interface
- Interactive conversations with AI models
- Context-aware responses based on your project
- Multiple AI model support (Ollama, OpenAI, etc.)
- Session management with history

### 📁 Project Analysis
- Automatic project structure analysis
- Language detection and statistics
- Dependency scanning
- Real-time file change tracking

### 💻 Code Generation
- Template-based code generation
- Custom template creation and management
- Variable substitution and validation
- Multi-language support

### 🎯 Smart Features
- Command palette integration (Ctrl+Alt+P)
- Keyboard shortcuts for common actions
- Real-time project context awareness
- Code extraction and analysis

## Installation

ALFRED is included as a core plugin in Alexandria. To activate it:

1. Navigate to Alexandria's plugin settings
2. Find "ALFRED - AI Coding Assistant"
3. Click "Activate"

## Usage

### Starting a New Chat Session

1. Click on the ALFRED icon in the sidebar
2. Click "New Chat" or press `Ctrl+Alt+N`
3. Start typing your questions or requests

### Loading a Project

1. Click "Open Project" in the ALFRED dashboard
2. Select your project directory
3. ALFRED will automatically analyze the project structure

### Generating Code

1. Use the command palette (`Ctrl+Alt+P`) and search for "Generate Code"
2. Or click the "Generate" button in the chat interface
3. Select a template or describe what you want to generate
4. Fill in any required variables
5. Review and insert the generated code

### Managing Templates

1. Navigate to the Templates tab in ALFRED
2. Create custom templates for your common patterns
3. Share templates with your team
4. Import templates from the community

## API Endpoints

ALFRED exposes the following REST API endpoints:

- `POST /api/plugins/alfred/sessions` - Create a new chat session
- `GET /api/plugins/alfred/sessions` - List all sessions
- `GET /api/plugins/alfred/sessions/:id` - Get session details
- `POST /api/plugins/alfred/sessions/:id/messages` - Send a message
- `DELETE /api/plugins/alfred/sessions/:id` - Delete a session
- `POST /api/plugins/alfred/generate` - Generate code
- `GET /api/plugins/alfred/templates` - List templates
- `POST /api/plugins/alfred/analyze` - Analyze a project

## Configuration

ALFRED can be configured through Alexandria's settings:

```json
{
  "alfred": {
    "defaultModel": "deepseek-coder:latest",
    "enableAutoSave": true,
    "codeExtractionDepth": 3,
    "maxSessionHistory": 100,
    "enableTemplateSharing": true
  }
}
```

## Keyboard Shortcuts

- `Ctrl+Alt+N` - New chat session
- `Ctrl+Alt+A` - Analyze current project
- `Ctrl+Alt+G` - Generate code
- `Ctrl+Alt+S` - Save current session
- `Ctrl+L` - Clear chat

## Development

### Building from Source

```bash
# Navigate to the plugin directory
cd src/plugins/alfred

# Install dependencies
npm install

# Build the plugin
npm run build

# Run tests
npm test
```

### Contributing

We welcome contributions! Please see the main Alexandria contributing guide.

### Plugin Architecture

ALFRED follows Alexandria's plugin architecture:

- **Services**: Business logic and AI integration
- **Repositories**: Data persistence layer
- **API**: REST endpoints for external access
- **UI Components**: React components for the interface

## Migration from Standalone Alfred

If you're migrating from the standalone Alfred application:

1. Export your sessions from the old Alfred
2. Import them into Alexandria's ALFRED plugin
3. Your templates and settings will be automatically migrated

## Support

For issues or questions:
- Check the Alexandria documentation
- Open an issue on GitHub
- Join our Discord community

## License

MIT License - see LICENSE file for details