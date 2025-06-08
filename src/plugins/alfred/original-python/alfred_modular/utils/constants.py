"""Application constants."""

from pathlib import Path


class Constants:
    """Application-wide constants."""
    
    # Application info
    APP_NAME = "Alfred"
    APP_VERSION = "2.0.0"
    APP_DESCRIPTION = "AI-Linked Framework for Rapid Engineering Development"
    
    # Paths
    DEFAULT_DATA_DIR = Path.home() / ".alfred"
    TEMPLATES_DIR = "templates"
    PLUGINS_DIR = "plugins"
    
    # UI Constants
    MIN_WINDOW_WIDTH = 800
    MIN_WINDOW_HEIGHT = 600
    DEFAULT_PADDING = 10
    
    # Colors (default theme)
    COLORS = {
        "primary": "#007ACC",
        "secondary": "#40E0D0",
        "background": "#1E1E1E",
        "surface": "#252526",
        "error": "#F44336",
        "warning": "#FF9800",
        "info": "#2196F3",
        "success": "#4CAF50",
        "text": "#CCCCCC",
        "text_secondary": "#969696",
        "border": "#464647"
    }
    
    # Timeouts (seconds)
    AI_REQUEST_TIMEOUT = 300
    CONNECTION_TIMEOUT = 30
    RETRY_DELAY = 2
    MAX_RETRIES = 3
    
    # Limits
    MAX_MESSAGE_LENGTH = 50000
    MAX_CONTEXT_FILES = 10
    MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
    MAX_CHAT_HISTORY = 1000
    
    # File patterns
    CODE_EXTENSIONS = {
        ".py", ".js", ".ts", ".java", ".cpp", ".c", ".h", ".hpp",
        ".rs", ".go", ".rb", ".php", ".swift", ".kt", ".scala",
        ".r", ".m", ".mm", ".cs", ".vb", ".f90", ".jl", ".lua",
        ".pl", ".sh", ".bash", ".ps1", ".bat", ".cmd"
    }
    
    TEXT_EXTENSIONS = {
        ".txt", ".md", ".rst", ".tex", ".log", ".csv", ".json",
        ".xml", ".yaml", ".yml", ".toml", ".ini", ".cfg", ".conf"
    }
    
    # Keyboard shortcuts
    SHORTCUTS = {
        "new_project": "Ctrl+N",
        "open_project": "Ctrl+O",
        "save": "Ctrl+S",
        "new_chat": "Ctrl+T",
        "close_chat": "Ctrl+W",
        "send_message": "Ctrl+Enter",
        "command_palette": "Ctrl+Shift+P",
        "settings": "Ctrl+,",
        "quit": "Ctrl+Q"
    }
    
    # Plugin events
    PLUGIN_EVENTS = {
        "before_project_create",
        "after_project_create",
        "before_message_send",
        "after_message_receive",
        "before_code_save",
        "after_code_save"
    }
    
    # Templates
    DEFAULT_TEMPLATES = {
        "python_cli": {
            "name": "Python CLI Application",
            "description": "Command-line application with argparse",
            "language": "python"
        },
        "python_web": {
            "name": "Python Web Application", 
            "description": "Flask web application with blueprints",
            "language": "python"
        },
        "python_fastapi": {
            "name": "FastAPI Application",
            "description": "Modern async API with FastAPI",
            "language": "python"
        },
        "javascript_node": {
            "name": "Node.js Application",
            "description": "Node.js application with Express",
            "language": "javascript"
        },
        "javascript_react": {
            "name": "React Application",
            "description": "React application with modern tooling",
            "language": "javascript"
        }
    }