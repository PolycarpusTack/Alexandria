# ALFRED Development Roadmap

## Phase 1: Code Block Extraction & File Saving ✅ In Progress

### Features:
1. **Automatic Code Block Detection**
   - Parse AI responses for code blocks (```language format)
   - Identify file names from comments or context
   - Support multiple code blocks in one response

2. **Code Block UI**
   - Add "Save" button to each code block
   - Show detected language and suggested filename
   - Preview before saving

3. **File Operations**
   - Save to project directory
   - Create subdirectories as needed
   - Overwrite protection with diff view
   - Undo/redo capability

### Implementation Plan:
- [ ] Add code block parser
- [ ] Create code block UI component
- [ ] Implement file save dialog
- [ ] Add diff viewer for existing files
- [ ] Create undo mechanism

## Phase 2: Code Execution

### Features:
1. **Safe Execution Environment**
   - Sandboxed Python execution
   - Shell command execution with confirmation
   - Resource limits (CPU, memory, time)
   - Output capture and display

2. **Execution UI**
   - "Run" button for code blocks
   - Output panel in chat
   - Error highlighting
   - Process management (stop/kill)

3. **Virtual Environment Support**
   - Create/activate venvs per project
   - Dependency management
   - Environment variable handling

### Implementation Plan:
- [ ] Create execution sandbox
- [ ] Add execution UI components
- [ ] Implement output streaming
- [ ] Add safety controls
- [ ] Virtual environment manager

## Phase 3: Git Integration

### Features:
1. **Repository Status**
   - Show git status in UI
   - Branch indicator
   - Modified files count
   - Uncommitted changes warning

2. **Git Operations**
   - Stage/unstage files
   - Commit with AI-generated messages
   - Branch creation/switching
   - Push/pull with remote

3. **Diff Viewer**
   - Show changes in UI
   - Stage individual hunks
   - Merge conflict resolution
   - History browser

### Implementation Plan:
- [ ] Add git status panel
- [ ] Implement GitPython integration
- [ ] Create diff viewer component
- [ ] Add commit dialog
- [ ] Build history browser

## Phase 4: Split View Editor

### Features:
1. **Editor Component**
   - Syntax highlighting (Pygments)
   - Line numbers
   - Code folding
   - Find/replace

2. **Layout Management**
   - Resizable panes
   - Multiple view modes
   - Tab support for multiple files
   - Synchronized scrolling with chat

3. **Live Features**
   - Real-time AI suggestions
   - Error highlighting
   - Auto-completion
   - Format on save

### Implementation Plan:
- [ ] Create editor widget
- [ ] Implement syntax highlighting
- [ ] Add pane management
- [ ] Build file tabs
- [ ] Add live features

## Technical Architecture

### Core Components:
```
AlfredApp
├── CodeManager (new)
│   ├── CodeBlockExtractor
│   ├── FileOperations
│   └── DiffViewer
├── ExecutionEngine (new)
│   ├── PythonExecutor
│   ├── ShellExecutor
│   └── OutputCapture
├── GitManager (new)
│   ├── RepoStatus
│   ├── GitOperations
│   └── DiffProcessor
└── EditorComponent (new)
    ├── SyntaxHighlighter
    ├── FileEditor
    └── PaneManager
```

### Safety Considerations:
- File operations require confirmation
- Execution is sandboxed by default
- Git operations are reversible
- All actions are logged

### UI Mockup:
```
┌─────────────────────────────────────────────────────┐
│ ALFRED - Project: MyApp                    [Git: main*] │
├─────────────┬───────────────────┬──────────────────┤
│ Projects    │ Chat              │ Editor           │
│ ├─ MyApp    │ User: Create a    │ app.py          │
│ │  ├─ app.py│ Flask app         │ ─────────────── │
│ │  └─ ...   │                   │ from flask ...  │
│ └─ Chats    │ AI: Here's a      │                 │
│    ├─ Main  │ Flask app:        │                 │
│    └─ API   │ ```python         │                 │
│             │ from flask...     │                 │
│             │ [Save] [Run]       │                 │
│             │ ```               │                 │
├─────────────┴───────────────────┴──────────────────┤
│ 🟢 Connected │ Ready            │ 2 changes       │
└─────────────────────────────────────────────────────┘
```

## Timeline:
- Phase 1: 2-3 days
- Phase 2: 3-4 days  
- Phase 3: 2-3 days
- Phase 4: 3-4 days

Total: ~2 weeks for full implementation