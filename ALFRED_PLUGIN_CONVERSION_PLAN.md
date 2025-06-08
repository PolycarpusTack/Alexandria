# Alfred to Alexandria Plugin Conversion Plan

## Overview
Convert Alfred from a standalone application to a powerful plugin within the Alexandria platform.

## Phase 1: Analysis & Preparation

### Alfred Core Features to Preserve:
1. **AI Chat Interface** - Interactive coding assistant
2. **Project Management** - Load/analyze project structures
3. **Code Generation** - AI-powered code creation
4. **Multi-Model Support** - Ollama, OpenAI, etc.
5. **Session Management** - Save/load chat sessions
6. **Code Extraction** - Extract and analyze code from projects
7. **Template System** - Code generation templates

### Alexandria Integration Points:
- Use Alexandria's AI infrastructure instead of direct Ollama calls
- Leverage Alexandria's UI components (React/TypeScript)
- Integrate with Alexandria's event bus
- Use Alexandria's security/permission system

## Phase 2: Plugin Structure

```
src/plugins/alfred/
├── plugin.json                 # Plugin manifest
├── CLAUDE.md                   # Plugin-specific instructions
├── README.md                   # Documentation
├── src/
│   ├── index.ts               # Plugin entry point
│   ├── interfaces.ts          # TypeScript interfaces
│   ├── services/
│   │   ├── alfred-service.ts  # Core Alfred logic
│   │   ├── project-analyzer.ts
│   │   ├── code-generator.ts
│   │   └── template-manager.ts
│   ├── api/
│   │   ├── index.ts          # API routes
│   │   └── alfred-api.ts     # REST endpoints
│   └── repositories/
│       ├── session-repository.ts
│       └── template-repository.ts
└── ui/
    ├── index.ts
    └── components/
        ├── AlfredDashboard.tsx    # Main UI
        ├── ChatInterface.tsx      # Chat component
        ├── ProjectExplorer.tsx    # Project tree
        ├── CodeEditor.tsx         # Code display
        └── TemplateManager.tsx    # Template UI
```

## Phase 3: Implementation Steps

### Step 1: Create Plugin Structure
```bash
# Create Alfred plugin directory
mkdir -p src/plugins/alfred/{src/{services,api,repositories},ui/components}
```

### Step 2: Create Plugin Manifest
```json
{
  "id": "alexandria-alfred",
  "name": "ALFRED - AI Coding Assistant",
  "version": "2.0.0",
  "description": "AI-powered coding assistant for rapid engineering development",
  "permissions": [
    "file:read",
    "file:write",
    "llm:access",
    "database:access",
    "event:subscribe",
    "event:publish",
    "project:analyze"
  ],
  "uiEntryPoints": [
    {
      "id": "alfred-dashboard",
      "name": "ALFRED Assistant",
      "location": "sidebar",
      "icon": "mdi-robot-happy",
      "component": "ui/components/AlfredDashboard"
    }
  ]
}
```

### Step 3: Core Service Migration

#### From Python to TypeScript:
```typescript
// alfred-service.ts
import { Injectable } from '@alexandria/core';
import { AIService } from '@alexandria/core/services';

@Injectable()
export class AlfredService {
  constructor(
    private ai: AIService,
    private eventBus: EventBus
  ) {}

  async processMessage(message: string, context: ProjectContext): Promise<string> {
    // Migrate Alfred's chat logic
    const response = await this.ai.query(message, {
      model: context.preferredModel,
      systemPrompt: this.buildSystemPrompt(context)
    });
    
    this.eventBus.emit('alfred:message-processed', {
      message,
      response,
      timestamp: new Date()
    });
    
    return response;
  }
}
```

### Step 4: UI Components (React/TypeScript)

```typescript
// AlfredDashboard.tsx
import React, { useState } from 'react';
import { Card, Tabs, TabsContent } from '@alexandria/ui';
import { ChatInterface } from './ChatInterface';
import { ProjectExplorer } from './ProjectExplorer';

export const AlfredDashboard: React.FC = () => {
  const [activeProject, setActiveProject] = useState(null);
  
  return (
    <div className="alfred-dashboard">
      <Card>
        <Tabs defaultValue="chat">
          <TabsList>
            <TabsTrigger value="chat">Chat</TabsTrigger>
            <TabsTrigger value="project">Project</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
          </TabsList>
          
          <TabsContent value="chat">
            <ChatInterface project={activeProject} />
          </TabsContent>
          
          <TabsContent value="project">
            <ProjectExplorer onProjectSelect={setActiveProject} />
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
};
```

## Phase 4: Feature Mapping

| Alfred Feature | Alexandria Implementation |
|---------------|---------------------------|
| Ollama Integration | Use Alexandria's AIService |
| Tkinter UI | React Components with ShadCN |
| File Operations | Alexandria's FileService with permissions |
| Project Analysis | New ProjectAnalyzerService |
| Templates | Store in Alexandria's database |
| Sessions | Use Alexandria's data persistence |
| Logging | Alexandria's logging system |

## Phase 5: Migration Checklist

- [ ] Copy Alfred's core logic files
- [ ] Create TypeScript interfaces for Alfred's data structures
- [ ] Implement AlfredService with core functionality
- [ ] Create React components for UI
- [ ] Integrate with Alexandria's AI service
- [ ] Set up API endpoints
- [ ] Migrate templates to database
- [ ] Test chat functionality
- [ ] Test project analysis
- [ ] Test code generation
- [ ] Documentation update

## Benefits After Conversion

1. **Unified Platform** - Single app for all AI-enhanced tools
2. **Better Performance** - Shared resources and caching
3. **Enhanced Security** - Alexandria's permission system
4. **Modern UI** - React with beautiful components
5. **Team Collaboration** - Multi-user support
6. **Extensibility** - Other plugins can use Alfred's services

## Next Steps

1. Copy Alfred project files to Alexandria
2. Begin TypeScript conversion
3. Create UI components
4. Test integration