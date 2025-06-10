# Alexandria Templates Plugin

## Overview
The Alexandria Templates Plugin is a powerful template and snippet management system designed specifically for the Alexandria Platform ecosystem. It integrates seamlessly with ALFRED (AI assistant), Crash Analyzer, and Heimdall monitoring.

## Architecture

```
alexandria-templates/
├── src/
│   ├── core/
│   │   ├── AlexandriaTemplateEngine.ts    # Main template engine
│   │   ├── PluginIntegration.ts           # Alexandria plugin bridge
│   │   └── ContextManager.ts              # Smart context detection
│   ├── providers/
│   │   ├── AlfredProvider.ts              # ALFRED AI integration
│   │   ├── CrashAnalyzerProvider.ts       # Crash log templates
│   │   └── HeimdallProvider.ts            # Monitoring templates
│   ├── ui/
│   │   ├── TemplateExplorer.tsx           # VS Code-style explorer
│   │   ├── SnippetPalette.tsx             # Command palette integration
│   │   └── TemplatePreview.tsx            # Live preview component
│   └── api/
│       ├── TemplateAPI.ts                 # REST API for external access
│       └── WebSocketSync.ts               # Real-time collaboration
├── templates/
│   ├── alfred/                            # AI-assisted templates
│   ├── crash-analysis/                    # Crash log templates
│   ├── monitoring/                        # Heimdall templates
│   └── platform/                          # Core platform templates
├── snippets/
│   ├── code-generation/                   # ALFRED code snippets
│   ├── log-patterns/                      # Common log patterns
│   └── api-responses/                     # API template responses
├── config/
│   ├── alexandria.config.json             # Platform integration config
│   └── template.schema.json               # Template validation schema
└── plugin.manifest.json                   # Alexandria plugin manifest
```

## Features

### 1. **Deep Alexandria Integration**
- Native integration with ALFRED for AI-powered template generation
- Automatic crash log parsing and template suggestion
- Heimdall monitoring alert templates
- Activity tracking in Alexandria's unified dashboard

### 2. **Smart Context Detection**
- Automatically detects active plugin context
- Suggests relevant templates based on current workflow
- Learns from usage patterns using Alexandria's analytics

### 3. **AI-Powered Features**
- ALFRED can generate custom templates on demand
- Intelligent variable extraction from existing documents
- Template optimization based on team usage patterns

### 4. **Version Control Integration**
- Git-based template versioning
- Team collaboration through Alexandria's workspace system
- Change tracking with Alexandria's activity monitor

## Installation

```bash
# Install through Alexandria Plugin Manager
alexandria plugin install alexandria-templates

# Or clone directly
git clone https://github.com/alexandria/templates-plugin
cd templates-plugin
npm install
alexandria plugin link .
```

## Usage

### Command Palette (Cmd/Ctrl + K)
- `Templates: Create from Template` - Open template selector
- `Templates: Insert Snippet` - Quick snippet insertion
- `Templates: Generate with ALFRED` - AI-powered template creation
- `Templates: Analyze Crash Log` - Generate crash report template

### Activity Bar Integration
The Templates plugin adds a new icon to Alexandria's activity bar for quick access to:
- Template Explorer
- Snippet Library
- Recent Templates
- Template Analytics

## Configuration

Configure in Alexandria's settings or through `alexandria.config.json`:

```json
{
  "alexandria-templates": {
    "defaultEngine": "handlebars",
    "enableAlfredIntegration": true,
    "autoSuggestTemplates": true,
    "syncWithCloud": true,
    "analyticsTracking": true
  }
}
```
