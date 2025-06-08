# ALFRED - AI-Linked Framework for Rapid Engineering Development

A modular, extensible AI assistant framework with plugin support and multiple UI options.

## 🚀 Quick Start

```bash
# Clone the repository
git clone <your-repo-url>
cd alfred

# Install dependencies
pip install -r requirements.txt

# Run ALFRED (auto-detects best UI)
python alfred.py

# Or specify a UI
python alfred.py --ui tkinter    # Classic UI
python alfred.py --ui custom     # Modern UI (requires customtkinter)
python alfred.py --ui web        # Web UI (requires fastapi, uvicorn)
```

## 📋 Features

- **Modular Architecture**: Clean separation between core logic and UI
- **Plugin System**: Extend functionality with custom plugins
- **Multiple UIs**: Choose between tkinter, modern desktop, or web interface
- **Security Built-in**: Input validation, rate limiting, and sandboxed plugins
- **AI Flexibility**: Support for multiple AI providers (Ollama, OpenAI, etc.)
- **Event-Driven**: Plugins can communicate via event bus
- **Configuration Management**: JSON/YAML config with live reload

## 🏗️ Architecture

```
alfred/
├── alfred_core/          # Core business logic
│   ├── core.py          # Main application class
│   ├── plugin_manager.py # Plugin system
│   ├── event_bus.py     # Event communication
│   ├── security.py      # Security layer
│   ├── config.py        # Configuration management
│   └── ai_manager.py    # AI provider management
├── alfred_ui/           # UI implementations
│   ├── base_ui.py       # Abstract UI interface
│   ├── tkinter_ui.py    # Classic tkinter UI
│   ├── custom_ui.py     # Modern CustomTkinter UI
│   └── web_ui.py        # Web-based UI
├── plugins/             # Plugin directory
│   └── hello_world/     # Example plugin
└── alfred.py            # Smart launcher
```

## 🔌 Plugin Development

Create a new plugin by extending the `Plugin` base class:

```python
from alfred_core import Plugin, PluginMetadata

class MyPlugin(Plugin):
    @property
    def metadata(self) -> PluginMetadata:
        return PluginMetadata(
            name="my_plugin",
            version="1.0.0",
            author="Your Name",
            description="What your plugin does",
            ui_support=["tkinter", "custom", "web"],
            dependencies=[],
            permissions=["filesystem.read"]  # Required permissions
        )
    
    def activate(self, app):
        """Called when plugin is activated"""
        # Register commands
        self.register_command("mycommand", self.my_handler, "Do something")
        
        # Subscribe to events
        self.subscribe_event("chat.message.sent", self.on_message)
    
    def deactivate(self):
        """Called when plugin is deactivated"""
        pass
```

## ⚙️ Configuration

Configuration is stored in `~/.alfred/config.json`:

```json
{
  "ui": {
    "default": "auto",
    "theme": "dark"
  },
  "ai": {
    "default_model": "ollama",
    "ollama": {
      "url": "http://localhost:11434",
      "model": "llama2"
    }
  },
  "plugins": {
    "auto_activate": ["hello_world", "command_palette"]
  }
}
```

## 🛡️ Security

ALFRED includes built-in security features:

- **Input Validation**: All user inputs are validated and sanitized
- **Permission System**: Plugins must request permissions for sensitive operations
- **Rate Limiting**: Prevents abuse and resource exhaustion
- **Sandboxing**: Plugins run with limited privileges

## 📝 Available Commands

- `--ui <type>`: Select UI type (auto, tkinter, custom, web)
- `--config <path>`: Specify config file location
- `--list-plugins`: List available plugins
- `--debug`: Enable debug logging
- `--version`: Show version

## 🧩 Core Plugins

### Hello World
A simple example plugin demonstrating the plugin API.

### Command Palette (Coming Soon)
Quick command execution with fuzzy search (Ctrl+Shift+P).

### Git Integration (Coming Soon)
Git operations directly from ALFRED.

### Enhanced Chat (Coming Soon)
Syntax highlighting and advanced chat features.

## 🚧 Roadmap

- [x] Core architecture
- [x] Plugin system
- [x] Basic tkinter UI
- [x] Event bus
- [x] Security layer
- [ ] Modern CustomTkinter UI
- [ ] Web UI with FastAPI
- [ ] Core plugins (Git, Command Palette, etc.)
- [ ] Plugin marketplace
- [ ] Multi-model AI support
- [ ] Context-aware AI

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🙏 Acknowledgments

Built with love for the developer community. Special thanks to all contributors!