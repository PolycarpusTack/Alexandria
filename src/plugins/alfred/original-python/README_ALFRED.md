# ALFRED - AI-Linked Framework for Rapid Engineering Development

> "At your service, Master Wayne."

ALFRED is your AI butler for software development - a clean, focused project management tool with AI-powered chat sessions via Ollama.

## Features

- 🎩 **Project Management**: Organize your coding projects with dedicated workspaces
- 💬 **Linked Chat Sessions**: Multiple conversations per project, each with its own context
- 📎 **Context Files**: Attach relevant code files to chats for better AI understanding
- 🤖 **Multi-Model Support**: Works with any Ollama model (DeepSeekCoder, Mixtral, Llama, etc.)
- 💾 **Persistent Storage**: All projects and conversations saved automatically
- 🖥️ **Dual Interface**: Both GUI and CLI versions available

## Quick Start

```bash
# Make sure Ollama is running first
ollama serve

# Start ALFRED
./alfred
# or
python start_alfred.py
```

## Installation

1. Install Python 3.8+
2. Install dependencies:
   ```bash
   pip install -r requirements_minimal.txt
   ```
3. Install Ollama from [ollama.ai](https://ollama.ai)
4. Pull your preferred model:
   ```bash
   ollama pull deepseek-coder:latest
   # or other recommended models:
   ollama pull mixtral:latest
   ollama pull llama3.1:latest
   ```

## Usage

### GUI Mode
- **New Project**: Click "New Project", enter name and select directory
- **Chat Sessions**: Create multiple chats per project for different features/tasks
- **Context Files**: Add relevant code files to each chat for better AI responses
- **Model Selection**: Switch between models on the fly

### CLI Mode
```bash
python alfred_cli.py

Commands:
  new [name]    - Create new project
  chat [name]   - Create new chat session
  context add   - Add file to current chat context
  model [name]  - Switch AI model
  help          - Show all commands
```

## Recommended Models

For coding tasks:
- **deepseek-coder:latest** - Optimized for code generation
- **codellama:latest** - Good for code understanding
- **qwen2.5-coder:latest** - Balanced coding abilities

For agentic/reasoning tasks:
- **mixtral:latest** - Excellent reasoning capabilities
- **llama3.1:latest** - Strong tool use and planning
- **nous-hermes:latest** - Trained for autonomous behavior

## Storage

Projects are stored in `~/.alfred/projects/` as JSON files. Each project contains:
- Project metadata
- All chat sessions
- Message history
- Context file references

## Why ALFRED?

Like Batman's faithful butler, ALFRED is:
- Always ready to assist
- Discreet with your data (local storage only)
- Knowledgeable about many topics
- Loyal to your development needs

---

*"Some men aren't looking for anything logical, like money. They can't be bought, bullied, reasoned, or negotiated with. Some men just want to code."*