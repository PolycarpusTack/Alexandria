#!/usr/bin/env python3
"""
Constants for ALFRED application
Centralizes all magic numbers and configuration values
"""

# Window and UI Constants
DEFAULT_WINDOW_SIZE = "1400x900"
DEFAULT_WINDOW_TITLE = "ALFRED - AI Development Assistant"

# UI Component Sizes
CHAT_DISPLAY_HEIGHT = 30
CHAT_DISPLAY_FONT = ('Consolas', 10)
INPUT_TEXT_HEIGHT = 4
INPUT_TEXT_FONT = ('Consolas', 10)
BUTTON_WIDTH = 12
LISTBOX_HEIGHT = 5

# Colors
COLORS = {
    'bg': '#f5f5f5',
    'fg': '#333333',
    'select': '#0078d4',
    'button': '#0078d4',
    'button_text': '#ffffff',
    'code_bg': '#1e1e1e',
    'code_fg': '#d4d4d4',
    'user_message': '#0078d4',
    'assistant_message': '#107c10',
    'error': '#d83b01',
    'success': '#107c10',
    'warning': '#faa61a'
}

# Connection Status Icons
CONNECTION_STATUS = {
    'connected': '🟢 Connected',
    'disconnected': '🔴 Disconnected',
    'error': '🔴 Error',
    'checking': '🟡 Checking...'
}

# Timing Constants (milliseconds)
CONNECTION_CHECK_INTERVAL_MS = 30000  # 30 seconds
STRUCTURE_REFRESH_INTERVAL_MS = 5000  # 5 seconds
UI_UPDATE_DELAY_MS = 3000  # 3 seconds
UI_UPDATE_CLEAR_DELAY_MS = 5000  # 5 seconds
UI_BATCH_UPDATE_INTERVAL_MS = 16  # ~60fps

# Network Timeouts (seconds)
OLLAMA_TIMEOUT_DEFAULT = 600  # 10 minutes
OLLAMA_TIMEOUT_QUICK = 5  # For connection checks
HTTP_TIMEOUT_DEFAULT = 30

# File Size Limits
MAX_CONTEXT_FILE_SIZE = 10 * 1024 * 1024  # 10MB
MAX_PROJECT_FILE_SIZE = 50 * 1024 * 1024  # 50MB
MAX_LOG_FILE_SIZE = 100 * 1024 * 1024  # 100MB

# Chat and History Limits
MAX_CHAT_HISTORY = 10  # Messages to include in context
MAX_CHAT_SESSIONS = 100  # Maximum sessions per project
MAX_CONTEXT_FILES = 20  # Maximum context files per session
MAX_RECENT_COMMANDS = 5  # Recent commands in palette

# Cache Settings
CACHE_MAX_MEMORY_ENTRIES = 100
CACHE_MAX_AGE_MINUTES = 5
CACHE_CLEANUP_INTERVAL_MINUTES = 5
CACHE_DISK_CLEANUP_HOURS = 24

# Default Paths
DEFAULT_PROJECTS_DIR = "~/.alfred/projects"
DEFAULT_CACHE_DIR = "~/.alfred/cache"
DEFAULT_LOGS_DIR = "~/.alfred/logs"
DEFAULT_PLUGINS_DIR = "~/.alfred/plugins"

# File Patterns
IGNORE_PATTERNS = [
    ".git",
    "__pycache__",
    "*.pyc",
    ".DS_Store",
    "node_modules",
    ".venv",
    "venv",
    "env",
    ".env",
    "dist",
    "build",
    ".idea",
    ".vscode",
    "*.egg-info",
    ".pytest_cache",
    ".mypy_cache"
]

# Supported Languages for Code Analysis
SUPPORTED_LANGUAGES = {
    'python': ['.py'],
    'javascript': ['.js', '.jsx'],
    'typescript': ['.ts', '.tsx'],
    'java': ['.java'],
    'cpp': ['.cpp', '.cc', '.cxx', '.hpp', '.h'],
    'csharp': ['.cs'],
    'go': ['.go'],
    'rust': ['.rs'],
    'ruby': ['.rb'],
    'php': ['.php'],
    'swift': ['.swift'],
    'kotlin': ['.kt'],
    'scala': ['.scala'],
    'markdown': ['.md'],
    'json': ['.json'],
    'yaml': ['.yml', '.yaml'],
    'xml': ['.xml'],
    'html': ['.html', '.htm'],
    'css': ['.css', '.scss', '.sass'],
    'sql': ['.sql'],
    'shell': ['.sh', '.bash'],
    'smalltalk': ['.st', '.cs']
}

# Project Types
PROJECT_TYPES = {
    'python': {
        'files': ['requirements.txt', 'setup.py', 'pyproject.toml'],
        'dirs': ['src', 'tests', 'docs']
    },
    'javascript': {
        'files': ['package.json'],
        'dirs': ['src', 'tests', 'public']
    },
    'web': {
        'files': ['index.html'],
        'dirs': ['css', 'js', 'images']
    },
    'smalltalk': {
        'files': ['.st', '.cs', '.im'],
        'dirs': ['sources', 'fileouts', 'images']
    }
}

# Ollama Models
DEFAULT_MODELS = [
    "deepseek-coder:latest",
    "codellama:latest",
    "mistral:latest",
    "llama2:latest",
    "mixtral:latest"
]

# Command Palette Categories
COMMAND_CATEGORIES = {
    "File": "📁",
    "Edit": "✏️",
    "View": "👁️",
    "Project": "📦",
    "Chat": "💬",
    "AI": "🤖",
    "Tools": "🔧",
    "Help": "❓"
}

# Error Messages
ERROR_MESSAGES = {
    'no_ollama': "Cannot connect to Ollama. Please ensure Ollama is running.",
    'no_project': "Please create or open a project first.",
    'invalid_path': "Invalid path. Please select a valid directory.",
    'file_too_large': "File is too large to process.",
    'permission_denied': "Permission denied. Check file permissions.",
    'network_error': "Network error. Please check your connection."
}

# Success Messages
SUCCESS_MESSAGES = {
    'project_created': "Project created successfully!",
    'project_saved': "Project saved successfully!",
    'project_loaded': "Loaded project: {name}",
    'file_added': "File added to context.",
    'connection_ok': "Connected to Ollama successfully!"
}

# Keyboard Shortcuts
SHORTCUTS = {
    'command_palette': '<Control-Shift-P>',
    'send_message': '<Control-Return>',
    'new_project': '<Control-n>',
    'open_project': '<Control-o>',
    'save_project': '<Control-s>',
    'new_chat': '<Control-t>',
    'fullscreen': '<F11>'
}

# Logging Levels
LOG_LEVELS = {
    'debug': 'DEBUG',
    'info': 'INFO',
    'warning': 'WARNING',
    'error': 'ERROR',
    'critical': 'CRITICAL'
}

# API Endpoints
OLLAMA_ENDPOINTS = {
    'generate': '/api/generate',
    'tags': '/api/tags',
    'show': '/api/show',
    'pull': '/api/pull'
}