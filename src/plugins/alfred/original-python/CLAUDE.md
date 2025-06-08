# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

The **Enterprise Code Factory 9000 Pro** is a Python-based IDE-like application with AI-powered code generation and analysis capabilities. It features a cyberpunk-themed GUI built with tkinter and integrates with Ollama for local LLM functionality.

**ALFRED (AI-Linked Framework for Rapid Engineering Development)**: The `alfred.py` file provides a clean, focused implementation with project management and linked chat sessions for any Ollama model. Named after Batman's faithful butler, ALFRED is your AI assistant for software development.

## Checkpoints

- Checkpoint added for tracking project progress and key milestones
- Project status: Active development, ongoing feature integration and refinement

## Commands

### Running the Application

```bash
# ALFRED - Your AI Development Butler (recommended)
./alfred                  # Main launcher with ASCII art
python start_alfred.py    # Checks dependencies and starts the app
# Or directly:
python alfred.py          # GUI version
python alfred_cli.py      # CLI version

# Legacy versions:
python main.py            # Cyberpunk-themed version with full GUI
python app.py             # Alternative enterprise-focused version

# Test Ollama integration
python test_ollama_integration.py
```

[Rest of the file remains unchanged]