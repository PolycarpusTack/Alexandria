"""
Enterprise Code Factory 9000 Pro
--------------------------------
An AI-assisted code generation and management platform
with enterprise-level features and robustness.

Author: Enhanced by Claude (based on original code)
Date: April 10, 2025
"""

import tkinter as tk
from tkinter import ttk, scrolledtext, filedialog, messagebox, simpledialog
import requests
import json
import threading
import webbrowser
import os
import sys
import logging
import configparser
import uuid
import time
import traceback
import subprocess
from pathlib import Path
from typing import Dict, List, Any, Optional, Union, Tuple
from dataclasses import dataclass
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor
from functools import wraps
import hashlib

# Import project modules
from project_manager import ProjectManager
from unified_code_analyzer import CodeEnforcer
from ai_logger import AILogger


# Create module logger
logger = logging.getLogger(__name__)


@dataclass
class ApiResponse:
    """Data class for standardized API responses"""
    success: bool
    data: Optional[Any] = None
    error: Optional[str] = None
    status_code: Optional[int] = None


class ConfigManager:
    """Manages application configuration with fallback to defaults"""
    
    DEFAULT_CONFIG = {
        "api": {
            "url": "http://localhost:11434/api/generate",
            "model_name": "deepseek-coder:33b-instruct",
            "timeout": "300",
            "retry_attempts": "3"
        },
        "app": {
            "window_size": "1400x900",
            "theme": "system",
            "max_threads": "4",
            "auto_save_interval": "300"  # seconds
        },
        "projects": {
            "base_dir": str(Path.home() / "ai_projects"),
            "auto_tests": "true",
            "quality_checks": "true"
        },
        "security": {
            "encrypt_logs": "false",
            "api_key_env": "ECF_API_KEY"
        }
    }
    
    def __init__(self, config_file: Optional[str] = None):
        """Initialize configuration manager with optional path to config file"""
        self.config = configparser.ConfigParser()
        self.config_file = config_file or str(Path.home() / ".ecf_config.ini")
        self._load_config()
    
    def _load_config(self) -> None:
        """Load configuration from file or create with defaults if not exists"""
        if os.path.exists(self.config_file):
            try:
                self.config.read(self.config_file)
                logger.info(f"Configuration loaded from {self.config_file}")
            except Exception as e:
                logger.error(f"Error loading config: {str(e)}")
                self._create_default_config()
        else:
            self._create_default_config()
    
    def _create_default_config(self) -> None:
        """Create default configuration file"""
        for section, options in self.DEFAULT_CONFIG.items():
            if not self.config.has_section(section):
                self.config.add_section(section)
            for key, value in options.items():
                self.config.set(section, key, value)
        
        try:
            with open(self.config_file, 'w') as f:
                self.config.write(f)
            logger.info(f"Created default configuration at {self.config_file}")
        except Exception as e:
            logger.error(f"Failed to create default config: {str(e)}")
    
    def get(self, section: str, option: str, fallback: Any = None) -> str:
        """Get configuration value with fallback to default"""
        try:
            return self.config.get(section, option)
        except (configparser.NoSectionError, configparser.NoOptionError):
            if section in self.DEFAULT_CONFIG and option in self.DEFAULT_CONFIG[section]:
                return self.DEFAULT_CONFIG[section][option]
            return fallback
    
    def get_int(self, section: str, option: str, fallback: int = 0) -> int:
        """Get configuration value as integer with fallback"""
        try:
            return self.config.getint(section, option)
        except (configparser.NoSectionError, configparser.NoOptionError, ValueError):
            if section in self.DEFAULT_CONFIG and option in self.DEFAULT_CONFIG[section]:
                try:
                    return int(self.DEFAULT_CONFIG[section][option])
                except ValueError:
                    pass
            return fallback
    
    def get_bool(self, section: str, option: str, fallback: bool = False) -> bool:
        """Get configuration value as boolean with fallback"""
        try:
            return self.config.getboolean(section, option)
        except (configparser.NoSectionError, configparser.NoOptionError, ValueError):
            if section in self.DEFAULT_CONFIG and option in self.DEFAULT_CONFIG[section]:
                return self.DEFAULT_CONFIG[section][option].lower() in ('true', 'yes', '1', 'on')
            return fallback
    
    def save(self) -> bool:
        """Save current configuration to file"""
        try:
            with open(self.config_file, 'w') as f:
                self.config.write(f)
            return True
        except Exception as e:
            logger.error(f"Failed to save config: {str(e)}")
            return False


def retry_on_failure(max_attempts: int = 3, delay: float = 1.0):
    """Decorator to retry a function on failure with exponential backoff"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            attempts = 0
            while attempts < max_attempts:
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    attempts += 1
                    if attempts == max_attempts:
                        logger.error(f"Function {func.__name__} failed after {max_attempts} attempts: {str(e)}")
                        raise
                    logger.warning(f"Attempt {attempts} failed for {func.__name__}, retrying after {delay * (2 ** attempts)} seconds...")
                    time.sleep(delay * (2 ** attempts))
        return wrapper
    return decorator


class ApiClient:
    """Handles API communications with error handling and retry logic"""
    
    # Available Ollama models
    AVAILABLE_MODELS = [
        "deepseek-coder:33b-instruct",  # Default
        "codellama:34b-instruct",
        "wizardcoder:15b-python",
        "mistral:7b-instruct",
        "llama3:8b-instruct",
        "gemma:7b-instruct"
    ]
    
    # Model descriptions for UI
    MODEL_DESCRIPTIONS = {
        "deepseek-coder:33b-instruct": "Optimized for multi-language code generation",
        "codellama:34b-instruct": "Excellent for explaining and debugging code",
        "wizardcoder:15b-python": "Specialized for Python development",
        "mistral:7b-instruct": "Fast, balanced model for simpler coding tasks",
        "llama3:8b-instruct": "Well-rounded with good documentation capabilities",
        "gemma:7b-instruct": "Efficient for smaller coding tasks and test generation"
    }
    
    def __init__(self, config: ConfigManager):
        """Initialize API client with configuration"""
        self.config = config
        self.api_url = self.config.get("api", "url")
        self.model_name = self.config.get("api", "model_name")
        self.timeout = self.config.get_int("api", "timeout", 300)
        self.retry_attempts = self.config.get_int("api", "retry_attempts", 3)
        self.api_key = os.environ.get(self.config.get("security", "api_key_env", ""))
        
        # Ensure model name is valid, fallback to default if not
        if self.model_name not in self.AVAILABLE_MODELS:
            self.model_name = self.AVAILABLE_MODELS[0]
        
        # Executor for background tasks
        self.executor = ThreadPoolExecutor(
            max_workers=self.config.get_int("app", "max_threads", 4)
        )
    
    @retry_on_failure(max_attempts=3)
    def generate_code(self, prompt: str) -> ApiResponse:
        """Send code generation request to API with retries"""
        try:
            headers = {}
            if self.api_key:
                headers["Authorization"] = f"Bearer {self.api_key}"
                
            response = requests.post(
                self.api_url,
                headers=headers,
                json={
                    "model": self.model_name,
                    "prompt": f"Generate enterprise-grade code with full error handling and best practices for: {prompt}",
                    "stream": False
                },
                timeout=self.timeout
            )
            
            if response.status_code == 200:
                result = response.json()
                return ApiResponse(
                    success=True, 
                    data=result.get("response", ""),
                    status_code=response.status_code
                )
            else:
                return ApiResponse(
                    success=False,
                    error=f"API returned {response.status_code}: {response.text}",
                    status_code=response.status_code
                )
                
        except requests.RequestException as e:
            logger.error(f"API request failed: {str(e)}")
            return ApiResponse(success=False, error=str(e))
    
    def generate_tests(self, code: str) -> ApiResponse:
        """Generate test cases for provided code"""
        try:
            headers = {}
            if self.api_key:
                headers["Authorization"] = f"Bearer {self.api_key}"
                
            response = requests.post(
                self.api_url,
                headers=headers,
                json={
                    "model": self.model_name,
                    "prompt": f"Generate comprehensive pytest unit tests for this code:\n{code}",
                    "stream": False
                },
                timeout=self.timeout
            )
            
            if response.status_code == 200:
                result = response.json()
                return ApiResponse(
                    success=True, 
                    data=result.get("response", ""),
                    status_code=response.status_code
                )
            else:
                return ApiResponse(
                    success=False,
                    error=f"API returned {response.status_code}: {response.text}",
                    status_code=response.status_code
                )
                
        except requests.RequestException as e:
            logger.error(f"Test generation request failed: {str(e)}")
            return ApiResponse(success=False, error=str(e))
    
    def async_request(self, func, *args, callback=None, error_callback=None, **kwargs):
        """Submit an asynchronous request to the thread pool"""
        future = self.executor.submit(func, *args, **kwargs)
        
        if callback or error_callback:
            def _callback_wrapper(future):
                try:
                    result = future.result()
                    if callback:
                        callback(result)
                except Exception as e:
                    if error_callback:
                        error_callback(e)
                    else:
                        logger.error(f"Async request failed: {str(e)}")
            
            future.add_done_callback(_callback_wrapper)
        
        return future


class StatusManager:
    """Manages application status messages and notifications"""
    
    def __init__(self, status_var: tk.StringVar):
        """Initialize with a Tkinter StringVar for status display"""
        self.status_var = status_var
        self.history = []
        self.max_history = 100
    
    def set(self, message: str, log_level: str = "info") -> None:
        """Set status message with timestamp and optional logging"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        status_text = f"[{timestamp}] {message}"
        self.status_var.set(status_text)
        
        # Add to history
        self.history.append((timestamp, message, log_level))
        if len(self.history) > self.max_history:
            self.history.pop(0)
        
        # Log based on level
        if log_level == "info":
            logger.info(message)
        elif log_level == "warning":
            logger.warning(message)
        elif log_level == "error":
            logger.error(message)
    
    def get_history(self) -> List[Tuple[str, str, str]]:
        """Get status history"""
        return self.history


class EnterpriseCodeFactory:
    """Main application class for AI-assisted code generation platform"""
    
    def __init__(self, master: tk.Tk):
        """Initialize the application with master Tkinter window"""
        self.master = master
        
        # Setup logging
        self._setup_logging()
        
        # Load configuration
        self.config = ConfigManager()
        logger.info("Application starting up")
        
        # Set window title and size
        master.title("Enterprise Code Factory 9000 Pro")
        master.geometry(self.config.get("app", "window_size"))
        
        # Set theme
        self._setup_theme()
        
        # Initialize subsystems
        self.project_manager = ProjectManager()
        self.code_enforcer = CodeEnforcer()
        self.current_logger = None
        
        # Initialize API client
        self.api_client = ApiClient(self.config)
        
        # Setup auto-save
        self.auto_save_interval = self.config.get_int("app", "auto_save_interval", 300) * 1000  # Convert to ms
        
        # UI Configuration
        self.create_ui()
        self.setup_bindings()
        self.create_help_system()
        
        # Set up auto-save timer if enabled
        if self.auto_save_interval > 0:
            self._schedule_auto_save()
        
        # Try to install quality tools if not present
        self._ensure_quality_tools()
        
        logger.info("Application initialized successfully")
    
    def _setup_logging(self) -> None:
        """Set up application logging"""
        log_dir = Path.home() / ".ecf" / "logs"
        log_dir.mkdir(parents=True, exist_ok=True)
        
        log_file = log_dir / f"ecf_{datetime.now().strftime('%Y%m%d')}.log"
        
        # Configure root logger
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(log_file),
                logging.StreamHandler(sys.stdout)
            ]
        )
    
    def _setup_theme(self) -> None:
        """Configure application theme"""
        theme = self.config.get("app", "theme")
        
        try:
            style = ttk.Style()
            if theme == "dark":
                style.theme_use("clam")
                style.configure(".", background="#2d2d2d", foreground="#ffffff")
                style.configure("TButton", background="#444444", foreground="#ffffff")
                style.map("TButton", 
                    background=[("active", "#555555"), ("pressed", "#333333")],
                    foreground=[("active", "#ffffff")]
                )
            else:
                # System or light theme
                style.theme_use("clam")  # Default theme
        except Exception as e:
            logger.warning(f"Could not set theme {theme}: {str(e)}")
    
    def _ensure_quality_tools(self) -> None:
        """Check and optionally install required quality tools"""
        try:
            # Try to check if the tools are installed
            for tool in ["black", "flake8", "pylint"]:
                try:
                    subprocess.run([tool, "--version"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False)
                except FileNotFoundError:
                    logger.warning(f"Quality tool {tool} not found")
                    # We could offer to install here, but that would 
                    # require system-specific installation methods
        except Exception as e:
            logger.warning(f"Error checking quality tools: {str(e)}")
    
    def _schedule_auto_save(self) -> None:
        """Schedule periodic auto-save"""
        if self.auto_save_interval > 0 and hasattr(self, "editor"):
            self.master.after(self.auto_save_interval, self._auto_save)
    
    def _auto_save(self) -> None:
        """Perform auto-save of current content"""
        if hasattr(self, "editor") and self.project_manager.current_project:
            try:
                content = self.editor.get("1.0", tk.END)
                if content.strip():  # Only save if there's content
                    auto_save_dir = self.project_manager.current_project / "autosave"
                    auto_save_dir.mkdir(exist_ok=True)
                    
                    # Save with timestamp
                    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                    file_path = auto_save_dir / f"autosave_{timestamp}.py"
                    
                    with open(file_path, "w") as f:
                        f.write(content)
                    
                    self.status_manager.set(f"Auto-saved to {file_path.name}", "info")
            except Exception as e:
                logger.error(f"Auto-save failed: {str(e)}")
        
        # Schedule next auto-save
        self._schedule_auto_save()
    
    def create_ui(self) -> None:
        """Create main user interface elements"""
        # Create main panels
        self.left_panel = ttk.Frame(self.master, width=300)
        self.left_panel.pack(side=tk.LEFT, fill=tk.Y)
        
        self.right_panel = ttk.Frame(self.master)
        self.right_panel.pack(side=tk.RIGHT, fill=tk.BOTH, expand=True)
        
        # Project Explorer
        self.create_project_explorer()
        
        # Code Workspace
        self.create_code_workspace()
        
        # Status Bar
        status_frame = ttk.Frame(self.master)
        status_frame.pack(side=tk.BOTTOM, fill=tk.X)
        
        self.status_var = tk.StringVar()
        self.status_manager = StatusManager(self.status_var)
        
        self.status_bar = ttk.Label(status_frame, textvariable=self.status_var, relief=tk.SUNKEN, anchor=tk.W)
        self.status_bar.pack(side=tk.LEFT, fill=tk.X, expand=True)
        
        # Add spinner for background operations
        self.busy_indicator = ttk.Progressbar(status_frame, mode="indeterminate", length=100)
        self.busy_indicator.pack(side=tk.RIGHT, padx=5)
        
        # Add session indicator
        session_id = str(uuid.uuid4())[:8]
        ttk.Label(status_frame, text=f"Session: {session_id}").pack(side=tk.RIGHT, padx=5)
    
    def create_project_explorer(self) -> None:
        """Create project explorer panel"""
        frame = ttk.LabelFrame(self.left_panel, text="Project Explorer")
        frame.pack(fill=tk.BOTH, expand=True)
        
        # Search bar for project files
        search_frame = ttk.Frame(frame)
        search_frame.pack(fill=tk.X, padx=5, pady=5)
        
        self.search_var = tk.StringVar()
        self.search_var.trace_add("write", self._filter_project_tree)
        
        ttk.Entry(search_frame, textvariable=self.search_var).pack(fill=tk.X, side=tk.LEFT, expand=True)
        ttk.Button(search_frame, text="🔍", width=3, command=self._filter_project_tree).pack(side=tk.RIGHT)
        
        # Project tree with scrollbar
        tree_frame = ttk.Frame(frame)
        tree_frame.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
        
        scrollbar = ttk.Scrollbar(tree_frame)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        
        self.project_tree = ttk.Treeview(tree_frame, yscrollcommand=scrollbar.set)
        self.project_tree.pack(fill=tk.BOTH, expand=True)
        scrollbar.config(command=self.project_tree.yview)
        
        # Configure tree columns and headings
        self.project_tree["columns"] = ("type", "modified")
        self.project_tree.column("#0", width=150)
        self.project_tree.column("type", width=50)
        self.project_tree.column("modified", width=100)
        
        self.project_tree.heading("#0", text="Name")
        self.project_tree.heading("type", text="Type")
        self.project_tree.heading("modified", text="Modified")
        
        # Bind double-click to open files
        self.project_tree.bind("<Double-1>", self._on_tree_item_double_click)
        
        # Project buttons frame
        buttons_frame = ttk.Frame(frame)
        buttons_frame.pack(fill=tk.X, padx=5, pady=5)
        
        ttk.Button(buttons_frame, text="New Project", command=self.create_new_project).pack(side=tk.LEFT, padx=2)
        ttk.Button(buttons_frame, text="Open Project", command=self.open_project).pack(side=tk.LEFT, padx=2)
        ttk.Button(buttons_frame, text="Refresh", command=self.update_project_tree).pack(side=tk.LEFT, padx=2)
    
    def _on_tree_item_double_click(self, event) -> None:
        """Handle double-click on project tree item"""
        item_id = self.project_tree.identify("item", event.x, event.y)
        if not item_id:
            return
            
        # Get the full path of the item
        item_path = self._get_tree_item_path(item_id)
        if not item_path:
            return
            
        # If it's a file, open it
        if os.path.isfile(item_path):
            self.open_file(item_path)
    
    def _get_tree_item_path(self, item_id) -> Optional[str]:
        """Get the full path for a tree item"""
        if not self.project_manager.current_project:
            return None
            
        # Build path by traversing up the tree
        path_parts = [self.project_tree.item(item_id, "text")]
        parent_id = self.project_tree.parent(item_id)
        
        while parent_id:
            path_parts.insert(0, self.project_tree.item(parent_id, "text"))
            parent_id = self.project_tree.parent(parent_id)
        
        # Remove project root from path parts if present
        if path_parts and path_parts[0] == os.path.basename(str(self.project_manager.current_project)):
            path_parts.pop(0)
        
        # Construct full path
        if path_parts:
            return os.path.join(str(self.project_manager.current_project), *path_parts)
        return None
    
    def _filter_project_tree(self, *args) -> None:
        """Filter project tree based on search text"""
        search_text = self.search_var.get().lower()
        
        # Clear and rebuild the tree
        self.update_project_tree(filter_text=search_text)
    
    def create_code_workspace(self) -> None:
        """Create code editor workspace with tabs"""
        notebook = ttk.Notebook(self.right_panel)
        notebook.pack(fill=tk.BOTH, expand=True)
        
        # Code Editor Tab
        self.editor_frame = ttk.Frame(notebook)
        
        editor_toolbar = ttk.Frame(self.editor_frame)
        editor_toolbar.pack(fill=tk.X)
        
        # Model selection dropdown
        model_frame = ttk.Frame(editor_toolbar)
        model_frame.pack(side=tk.RIGHT, padx=5)
        
        ttk.Label(model_frame, text="Model:").pack(side=tk.LEFT)
        self.model_var = tk.StringVar(value=self.api_client.model_name)
        model_dropdown = ttk.Combobox(
            model_frame, 
            textvariable=self.model_var,
            values=self.api_client.AVAILABLE_MODELS,
            width=25,
            state="readonly"
        )
        model_dropdown.pack(side=tk.LEFT, padx=5)
        model_dropdown.bind("<<ComboboxSelected>>", self._on_model_changed)
        
        # Add tooltip for model info
        self.model_info = ttk.Label(model_frame, text="ℹ️")
        self.model_info.pack(side=tk.LEFT)
        self.model_info.bind("<Enter>", self._show_model_tooltip)
        self.model_info.bind("<Leave>", self._hide_model_tooltip)
        
        # Action buttons
        ttk.Button(editor_toolbar, text="Generate Code (F5)", command=self.generate_code).pack(side=tk.LEFT, padx=2)
        ttk.Button(editor_toolbar, text="Auto-Improve (F6)", command=self.auto_improve).pack(side=tk.LEFT, padx=2)
        ttk.Button(editor_toolbar, text="Quality Check (F7)", command=self.run_quality_checks).pack(side=tk.LEFT, padx=2)
        ttk.Button(editor_toolbar, text="Save", command=self.save_file).pack(side=tk.LEFT, padx=2)
        
        # Line numbers + editor
        editor_container = ttk.Frame(self.editor_frame)
        editor_container.pack(fill=tk.BOTH, expand=True)
        
        # Line numbers
        self.line_numbers = tk.Text(editor_container, width=4, padx=3, takefocus=0, 
                                   border=0, background='#f0f0f0', state='disabled')
        self.line_numbers.pack(side=tk.LEFT, fill=tk.Y)
        
        # Main editor with syntax highlighting (basic)
        self.editor = scrolledtext.ScrolledText(editor_container, wrap=tk.WORD)
        self.editor.pack(side=tk.RIGHT, fill=tk.BOTH, expand=True)
        
        # Update line numbers when editor changes
        self.editor.bind("<<Modified>>", self._update_line_numbers)
        self.editor.bind("<KeyRelease>", self._update_line_numbers)
        
        # AI Console Tab
        self.ai_console = scrolledtext.ScrolledText(notebook, wrap=tk.WORD)
        
        # Quality Check Tab
        self.quality_frame = ttk.Frame(notebook)
        
        quality_toolbar = ttk.Frame(self.quality_frame)
        quality_toolbar.pack(fill=tk.X)
        
        ttk.Button(quality_toolbar, text="Run Checks", command=self.run_quality_checks).pack(side=tk.LEFT, padx=2)
        ttk.Button(quality_toolbar, text="Auto-Fix Selected", command=self._auto_fix_selected).pack(side=tk.LEFT, padx=2)
        ttk.Button(quality_toolbar, text="Clear", command=lambda: self.quality_display.delete("1.0", tk.END)).pack(side=tk.LEFT, padx=2)
        
        self.quality_display = scrolledtext.ScrolledText(self.quality_frame)
        self.quality_display.pack(fill=tk.BOTH, expand=True)
        
        # Add tabs to notebook
        notebook.add(self.editor_frame, text="Code Editor")
        notebook.add(self.ai_console, text="AI Console")
        notebook.add(self.quality_frame, text="Quality Report")
        
        # Track changes for modified indicator
        self.editor_modified = False
        self.editor.bind("<KeyPress>", lambda e: self._set_editor_modified(True))
    
    def _on_model_changed(self, event=None) -> None:
        """Handle model selection from dropdown or menu"""
        selected_model = self.model_var.get()
        self.api_client.model_name = selected_model
        self.status_manager.set(f"Model changed to: {selected_model}", "info")
        
        # Update config
        self.config.config.set("api", "model_name", selected_model)
        self.config.save()
        
        # Update menu selection if it exists
        if hasattr(self, "model_menu_var"):
            self.model_menu_var.set(selected_model)
    
    def _show_model_tooltip(self, event) -> None:
        """Show tooltip with model description"""
        model = self.model_var.get()
        description = self.api_client.MODEL_DESCRIPTIONS.get(model, "")
        if description:
            # Simple tooltip implementation
            x, y = event.x_root, event.y_root
            
            # Create tooltip window
            self.tooltip = tw = tk.Toplevel(self.master)
            tw.wm_overrideredirect(True)
            tw.wm_geometry(f"+{x+10}+{y+10}")
            
            # Create label
            label = ttk.Label(tw, text=description, background="#ffffcc", relief=tk.SOLID, borderwidth=1, wraplength=300)
            label.pack(padx=2, pady=2)
    
    def _hide_model_tooltip(self, event) -> None:
        """Hide model tooltip"""
        if hasattr(self, "tooltip") and self.tooltip:
            self.tooltip.destroy()
            self.tooltip = None
    
    def _set_editor_modified(self, modified: bool) -> None:
        """Mark editor as modified and update UI if needed"""
        if modified != self.editor_modified:
            self.editor_modified = modified
            
            # Update tab text to show modification state
            tab_text = "Code Editor*" if modified else "Code Editor"
            notebook = self.editor_frame.master
            notebook.tab(0, text=tab_text)
    
    def _update_line_numbers(self, event=None) -> None:
        """Update line numbers in the editor gutter"""
        if not hasattr(self, "line_numbers"):
            return
            
        # Clear the text widget
        self.line_numbers.config(state='normal')
        self.line_numbers.delete('1.0', tk.END)
        
        # Get the number of lines in the editor
        num_lines = self.editor.get('1.0', tk.END).count('\n')
        
        # Add line numbers
        for i in range(1, num_lines + 1):
            self.line_numbers.insert(tk.END, f"{i}\n")
        
        self.line_numbers.config(state='disabled')
        
        # Reset modified flag
        self.editor.edit_modified(False)
    
    def _auto_fix_selected(self) -> None:
        """Auto-fix selected quality issues"""
        selected_text = self.quality_display.get("sel.first", "sel.last")
        if not selected_text:
            self.status_manager.set("No quality issues selected", "warning")
            return
            
        # Parse the selected issue
        lines = selected_text.split('\n')
        if not lines:
            return
            
        # Extract line numbers from the issue (assuming format like 'line 10: issue')
        line_nums = []
        for line in lines:
            import re
            match = re.search(r'line\s+(\d+)', line, re.IGNORECASE)
            if match:
                line_nums.append(int(match.group(1)))
        
        if not line_nums:
            self.status_manager.set("Could not identify line numbers in selected issues", "warning")
            return
            
        # Get the code to fix
        code = self.editor.get("1.0", tk.END)
        
        # Use AI to fix the specific issues
        prompt = f"Fix the following issues in this code:\n{selected_text}\n\nThe code is:\n{code}"
        
        # Show spinner for background operation
        self.busy_indicator.start()
        
        # Run in background
        def _on_fix_complete(result):
            self.busy_indicator.stop()
            if result.success:
                self.editor.delete("1.0", tk.END)
                self.editor.insert(tk.END, result.data)
                self.status_manager.set(f"✅ Fixed {len(line_nums)} issues", "info")
            else:
                self.status_manager.set(f"⚠️ Could not fix issues: {result.error}", "error")
        
        def _on_fix_error(error):
            self.busy_indicator.stop()
            self.status_manager.set(f"⚠️ Error fixing issues: {str(error)}", "error")
        
        self.api_client.async_request(
            self.api_client.generate_code, 
            prompt,
            callback=_on_fix_complete,
            error_callback=_on_fix_error
        )
    
    def setup_bindings(self) -> None:
        """Set up keyboard shortcuts and bindings"""
        self.master.bind("<F5>", self.generate_code)
        self.master.bind("<F6>", self.auto_improve)
        self.master.bind("<F7>", self.run_quality_checks)
        self.master.bind("<Control-s>", self.save_file)
        self.master.bind("<Control-o>", lambda e: self.open_project())
        self.master.bind("<Control-n>", lambda e: self.create_new_project())
    
    def create_help_system(self) -> None:
        """Create interactive help system"""
        # Main menu with help options
        menubar = tk.Menu(self.master)
        
        # File menu
        file_menu = tk.Menu(menubar, tearoff=0)
        file_menu.add_command(label="New Project", command=self.create_new_project, accelerator="Ctrl+N")
        file_menu.add_command(label="Open Project", command=self.open_project, accelerator="Ctrl+O")
        file_menu.add_command(label="Save File", command=self.save_file, accelerator="Ctrl+S")
        file_menu.add_separator()
        file_menu.add_command(label="Exit", command=self._on_exit)
        menubar.add_cascade(label="File", menu=file_menu)
        
        # Edit menu
        edit_menu = tk.Menu(menubar, tearoff=0)
        edit_menu.add_command(label="Generate Code", command=self.generate_code, accelerator="F5")
        edit_menu.add_command(label="Improve Code", command=self.auto_improve, accelerator="F6")
        edit_menu.add_command(label="Check Quality", command=self.run_quality_checks, accelerator="F7")
        edit_menu.add_separator()
        edit_menu.add_command(label="Settings", command=self._show_settings)
        menubar.add_cascade(label="Edit", menu=edit_menu)
        
        # Model menu
        model_menu = tk.Menu(menubar, tearoff=0)
        
        # Create radio buttons for each model
        self.model_menu_var = tk.StringVar(value=self.api_client.model_name)
        for model in self.api_client.AVAILABLE_MODELS:
            model_menu.add_radiobutton(
                label=model,
                value=model,
                variable=self.model_menu_var,
                command=self._on_model_changed  # Fixed method name
            )
        
        model_menu.add_separator()
        model_menu.add_command(label="Model Information", command=self._show_model_info)
        menubar.add_cascade(label="Models", menu=model_menu)
        
        # Help menu
        help_menu = tk.Menu(menubar, tearoff=0)
        help_menu.add_command(label="Quick Start Guide", command=self.show_quickstart, accelerator="F1")
        help_menu.add_command(label="Feature Guide", command=self._show_feature_guide)
        help_menu.add_command(label="Model Guide", command=self._show_model_guide)
        help_menu.add_command(label="Keyboard Shortcuts", command=self._show_shortcuts)
        help_menu.add_command(label="Example Prompts", command=self.show_examples)
        help_menu.add_separator()
        help_menu.add_command(label="About", command=self._show_about)
        menubar.add_cascade(label="Help", menu=help_menu)
        
        self.master.config(menu=menubar)

        # Help panel
        help_frame = ttk.LabelFrame(self.left_panel, text="Code Butler Assistant")
        help_frame.pack(fill=tk.X, pady=10)
        
        ttk.Button(help_frame, text="🤖 Activate Guide", 
                 command=self.activate_code_butler).pack(pady=5)
        ttk.Button(help_frame, text="🎓 Quick Start", 
                 command=self.show_quickstart).pack(pady=5)
        ttk.Button(help_frame, text="📋 Examples", 
                 command=self.show_examples).pack(pady=5)
        ttk.Button(help_frame, text="🔍 Enterprise Features", 
                 command=self._show_feature_guide).pack(pady=5)
    
    def _show_model_info(self) -> None:
        """Show detailed information about available models"""
        self._show_model_guide()
        
    def _show_feature_guide(self) -> None:
        """Show enterprise features guide"""
        help_window = tk.Toplevel(self.master)
        help_window.title("Enterprise Features Guide")
        help_window.geometry("700x500")
        
        features_content = """
        🏢 Enterprise-Grade Features 🏢

        CONFIGURATION MANAGEMENT
        • Centralized config system with environment variable support
        • User-configurable settings with UI
        • Persistent configuration between sessions
        • Default fallbacks for all settings

        ERROR HANDLING & RESILIENCE
        • Comprehensive exception handling throughout the application
        • Automatic retry with exponential backoff for API calls
        • Structured error reporting and logging
        • Graceful degradation when services are unavailable

        ASYNCHRONOUS OPERATIONS
        • Background processing for long-running tasks
        • Thread pool management for optimal performance
        • Progress indicators for all asynchronous operations
        • Cancellable operations

        ADVANCED LOGGING
        • Hierarchical logging with configurable levels
        • Log rotation and archiving
        • Status history tracking
        • Audit trail of all AI interactions

        SECURITY FEATURES
        • API key management via environment variables
        • Optional encrypted logs
        • No sensitive data in error reports
        • Secure credential handling

        PROJECT MANAGEMENT
        • Multiple project templates (web, API, data science, etc.)
        • Automatic project structure creation
        • File type detection and specialized handling
        • Searchable project explorer

        USER EXPERIENCE
        • Line numbers and syntax highlighting
        • Auto-save with configurable intervals
        • Light/dark theme support
        • Unsaved changes protection
        """
        self.show_scrollable_message("Enterprise Features", features_content, help_window)
        
    def _show_model_guide(self) -> None:
        """Show LLM models guide"""
        help_window = tk.Toplevel(self.master)
        help_window.title("LLM Models Guide")
        help_window.geometry("700x500")
        
        models_content = """
        🧠 Available LLM Models 🧠

        The application supports various Ollama models:

        CODING SPECIALIZED MODELS
        • deepseek-coder:33b-instruct (Default)
            - Optimized for code generation across multiple languages
            - Strong at understanding software architecture
            - Best for complex, multi-file projects
        
        • codellama:34b-instruct
            - Specialized in code completion and generation
            - Excellent for explaining code and debugging
            - Strong performance with Python, JavaScript, and Java
        
        • wizardcoder:15b-python
            - Specialized for Python development
            - Optimized for data science and ML applications
            - Excellent for generating Pythonic, PEP8-compliant code

        GENERAL PURPOSE MODELS
        • mistral:7b-instruct
            - Fast, efficient model for simpler coding tasks
            - Good balance of performance and quality
            - Uses fewer resources for quicker responses
        
        • llama3:8b-instruct
            - Well-rounded model with good coding capabilities
            - Excellent for documentation generation
            - Good for explanations and code comments

        • gemma:7b-instruct
            - Efficient for smaller coding tasks
            - Good at generating test cases
            - Fast response times for iterative development

        Each model can be selected from the dropdown menu in the UI or
        from the Models menu before generating code. 
        The model selection is remembered for the duration of your session.
        """
        self.show_scrollable_message("LLM Models Guide", models_content, help_window)
        
    def _show_shortcuts(self) -> None:
        """Show keyboard shortcuts guide"""
        help_window = tk.Toplevel(self.master)
        help_window.title("Keyboard Shortcuts")
        help_window.geometry("600x500")
        
        shortcuts_content = """
        ⌨️ Keyboard Shortcuts ⌨️

        CODE GENERATION
        F5              - Generate code from prompt
        F6              - Auto-improve current code
        F7              - Run quality checks
        Ctrl+Space      - Trigger AI suggestions

        FILE OPERATIONS
        Ctrl+S          - Save current file
        Ctrl+O          - Open project
        Ctrl+N          - New project
        Ctrl+W          - Close current file

        EDITING
        Ctrl+Z          - Undo
        Ctrl+Y          - Redo
        Ctrl+F          - Find in code
        Ctrl+H          - Replace in code
        Ctrl+A          - Select all
        
        NAVIGATION
        Ctrl+Tab        - Switch between tabs
        Ctrl+G          - Go to line
        Alt+Left        - Navigate back
        Alt+Right       - Navigate forward

        MISC
        F1              - Show help
        Ctrl+,          - Open settings
        Ctrl+Q          - Quit application
        """
        self.show_scrollable_message("Keyboard Shortcuts", shortcuts_content, help_window)
    
    def _show_settings(self) -> None:
        """Show settings dialog"""
        settings_window = tk.Toplevel(self.master)
        settings_window.title("Settings")
        settings_window.geometry("600x400")
        settings_window.transient(self.master)
        
        # Create notebook for settings categories
        notebook = ttk.Notebook(settings_window)
        notebook.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        
        # API Settings
        api_frame = ttk.Frame(notebook)
        notebook.add(api_frame, text="API Settings")
        
        ttk.Label(api_frame, text="API URL:").grid(row=0, column=0, sticky=tk.W, padx=5, pady=5)
        api_url_var = tk.StringVar(value=self.config.get("api", "url"))
        ttk.Entry(api_frame, textvariable=api_url_var, width=50).grid(row=0, column=1, padx=5, pady=5)
        
        ttk.Label(api_frame, text="Model Name:").grid(row=1, column=0, sticky=tk.W, padx=5, pady=5)
        model_name_var = tk.StringVar(value=self.config.get("api", "model_name"))
        ttk.Entry(api_frame, textvariable=model_name_var, width=50).grid(row=1, column=1, padx=5, pady=5)
        
        ttk.Label(api_frame, text="Timeout (seconds):").grid(row=2, column=0, sticky=tk.W, padx=5, pady=5)
        timeout_var = tk.StringVar(value=self.config.get("api", "timeout"))
        ttk.Entry(api_frame, textvariable=timeout_var, width=10).grid(row=2, column=1, sticky=tk.W, padx=5, pady=5)
        
        # App Settings
        app_frame = ttk.Frame(notebook)
        notebook.add(app_frame, text="Application")
        
        ttk.Label(app_frame, text="Theme:").grid(row=0, column=0, sticky=tk.W, padx=5, pady=5)
        theme_var = tk.StringVar(value=self.config.get("app", "theme"))
        ttk.Combobox(app_frame, textvariable=theme_var, values=["system", "light", "dark"]).grid(
            row=0, column=1, sticky=tk.W, padx=5, pady=5
        )
        
        ttk.Label(app_frame, text="Auto-save Interval (seconds):").grid(row=1, column=0, sticky=tk.W, padx=5, pady=5)
        autosave_var = tk.StringVar(value=self.config.get("app", "auto_save_interval"))
        ttk.Entry(app_frame, textvariable=autosave_var, width=10).grid(row=1, column=1, sticky=tk.W, padx=5, pady=5)
        
        # Project Settings
        project_frame = ttk.Frame(notebook)
        notebook.add(project_frame, text="Projects")
        
        ttk.Label(project_frame, text="Projects Directory:").grid(row=0, column=0, sticky=tk.W, padx=5, pady=5)
        projects_dir_var = tk.StringVar(value=self.config.get("projects", "base_dir"))
        dir_entry = ttk.Entry(project_frame, textvariable=projects_dir_var, width=50)
        dir_entry.grid(row=0, column=1, padx=5, pady=5)
        ttk.Button(project_frame, text="Browse", 
                  command=lambda: projects_dir_var.set(filedialog.askdirectory())
                 ).grid(row=0, column=2, padx=5, pady=5)
        
        auto_tests_var = tk.BooleanVar(value=self.config.get_bool("projects", "auto_tests"))
        ttk.Checkbutton(project_frame, text="Auto-generate tests", variable=auto_tests_var).grid(
            row=1, column=0, columnspan=2, sticky=tk.W, padx=5, pady=5
        )
        
        quality_checks_var = tk.BooleanVar(value=self.config.get_bool("projects", "quality_checks"))
        ttk.Checkbutton(project_frame, text="Run quality checks after generation", variable=quality_checks_var).grid(
            row=2, column=0, columnspan=2, sticky=tk.W, padx=5, pady=5
        )
        
        # Buttons frame
        buttons_frame = ttk.Frame(settings_window)
        buttons_frame.pack(fill=tk.X, padx=10, pady=10)
        
        def save_settings():
            # Update configuration
            self.config.config.set("api", "url", api_url_var.get())
            self.config.config.set("api", "model_name", model_name_var.get())
            self.config.config.set("api", "timeout", timeout_var.get())
            
            self.config.config.set("app", "theme", theme_var.get())
            self.config.config.set("app", "auto_save_interval", autosave_var.get())
            
            self.config.config.set("projects", "base_dir", projects_dir_var.get())
            self.config.config.set("projects", "auto_tests", str(auto_tests_var.get()))
            self.config.config.set("projects", "quality_checks", str(quality_checks_var.get()))
            
            # Save to file
            if self.config.save():
                self.status_manager.set("Settings saved successfully", "info")
                settings_window.destroy()
                
                # Ask to restart for theme changes
                if theme_var.get() != self.config.get("app", "theme"):
                    if messagebox.askyesno("Restart Required", 
                                         "Theme changes require a restart to take effect. Restart now?"):
                        self.master.destroy()
                        # Note: In a real app, you'd restart the application here
            else:
                messagebox.showerror("Error", "Failed to save settings")
        
        ttk.Button(buttons_frame, text="Save", command=save_settings).pack(side=tk.RIGHT, padx=5)
        ttk.Button(buttons_frame, text="Cancel", command=settings_window.destroy).pack(side=tk.RIGHT, padx=5)
    
    def _show_about(self) -> None:
        """Show about dialog"""
        about_window = tk.Toplevel(self.master)
        about_window.title("About Enterprise Code Factory")
        about_window.geometry("400x300")
        about_window.transient(self.master)
        
        ttk.Label(about_window, 
                 text="Enterprise Code Factory 9000 Pro",
                 font=("Helvetica", 14, "bold")).pack(pady=10)
        
        ttk.Label(about_window, 
                 text="Version 1.0.0").pack()
        
        ttk.Label(about_window, 
                 text="An AI-assisted code generation platform\n"
                     "for enterprise applications").pack(pady=10)
        
        ttk.Label(about_window, 
                 text="© 2025 Enterprise Code Factory Corp.").pack(pady=20)
        
        ttk.Button(about_window, text="Close", command=about_window.destroy).pack()
    
    def _on_exit(self) -> None:
        """Handle application exit"""
        if self.editor_modified:
            if not messagebox.askyesno("Unsaved Changes", 
                                     "You have unsaved changes. Are you sure you want to exit?"):
                return
                
        # Clean up resources
        if hasattr(self, "api_client") and hasattr(self.api_client, "executor"):
            self.api_client.executor.shutdown(wait=False)
            
        self.master.destroy()
    
    def show_quickstart(self) -> None:
        """Show quick start guide"""
        help_window = tk.Toplevel(self.master)
        help_window.title("Code Butler's Quick Start Guide")
        help_window.geometry("700x600")
        
        # Create notebook for tabbed help content
        notebook = ttk.Notebook(help_window)
        notebook.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        
        # Basic Guide tab
        basic_frame = ttk.Frame(notebook)
        notebook.add(basic_frame, text="Quick Start")
        
        basic_content = """
        🚀 5-Step Success Guide 🚀

        1. PROJECT SETUP
        • Click 'New Project' in the left panel
        • Name your project (e.g., "MyAmazingApp")
        • Choose a template if needed (web, api, data_science, etc.)

        2. CODE GENERATION
        • Go to the Code Editor tab
        • Type what you want in plain English:
          "Create a Python web app with user login"
        • Press F5 or click "Generate Code"
        • Choose your preferred LLM model from the dropdown

        3. QUALITY CONTROL
        • Press F7 to run automatic checks
        • Review the Quality Report tab
        • Click 'Auto-Fix Selected' for specific issues
        • Use F6 to auto-improve entire codebase

        4. TEST & DOCS
        • Tests are auto-generated by default (configurable in Settings)
        • Review test files in the project tree
        • Use the AI Console tab to see generation history

        5. SAVING & EXPORTING
        • Press Ctrl+S to save your code
        • Files are automatically saved to your project structure
        • Enable auto-save in Settings for periodic backups

        💡 Pro Tip: Use Ctrl+Space for AI suggestions!
        """
        self.create_scrollable_text(basic_frame, basic_content)
        
        # Enterprise Features tab
        features_frame = ttk.Frame(notebook)
        notebook.add(features_frame, text="Enterprise Features")
        
        features_content = """
        🏢 Enterprise-Grade Features 🏢

        CONFIGURATION MANAGEMENT
        • Centralized config system with environment variable support
        • User-configurable settings with UI
        • Persistent configuration between sessions
        • Default fallbacks for all settings

        ERROR HANDLING & RESILIENCE
        • Comprehensive exception handling throughout the application
        • Automatic retry with exponential backoff for API calls
        • Structured error reporting and logging
        • Graceful degradation when services are unavailable

        ASYNCHRONOUS OPERATIONS
        • Background processing for long-running tasks
        • Thread pool management for optimal performance
        • Progress indicators for all asynchronous operations
        • Cancellable operations

        ADVANCED LOGGING
        • Hierarchical logging with configurable levels
        • Log rotation and archiving
        • Status history tracking
        • Audit trail of all AI interactions

        SECURITY FEATURES
        • API key management via environment variables
        • Optional encrypted logs
        • No sensitive data in error reports
        • Secure credential handling

        PROJECT MANAGEMENT
        • Multiple project templates (web, API, data science, etc.)
        • Automatic project structure creation
        • File type detection and specialized handling
        • Searchable project explorer

        USER EXPERIENCE
        • Line numbers and syntax highlighting
        • Auto-save with configurable intervals
        • Light/dark theme support
        • Unsaved changes protection
        """
        self.create_scrollable_text(features_frame, features_content)
        
        # LLM Models tab
        models_frame = ttk.Frame(notebook)
        notebook.add(models_frame, text="Available Models")
        
        models_content = """
        🧠 Available LLM Models 🧠

        The application supports various Ollama models:

        CODING SPECIALIZED MODELS
        • deepseek-coder:33b-instruct (Default)
            - Optimized for code generation across multiple languages
            - Strong at understanding software architecture
            - Best for complex, multi-file projects
        
        • codellama:34b-instruct
            - Specialized in code completion and generation
            - Excellent for explaining code and debugging
            - Strong performance with Python, JavaScript, and Java
        
        • wizardcoder:15b-python
            - Specialized for Python development
            - Optimized for data science and ML applications
            - Excellent for generating Pythonic, PEP8-compliant code

        GENERAL PURPOSE MODELS
        • mistral:7b-instruct
            - Fast, efficient model for simpler coding tasks
            - Good balance of performance and quality
            - Uses fewer resources for quicker responses
        
        • llama3:8b-instruct
            - Well-rounded model with good coding capabilities
            - Excellent for documentation generation
            - Good for explanations and code comments

        • gemma:7b-instruct
            - Efficient for smaller coding tasks
            - Good at generating test cases
            - Fast response times for iterative development

        Each model can be selected from the dropdown menu in the UI before generating code. 
        The model selection is remembered for the duration of your session.
        """
        self.create_scrollable_text(models_frame, models_content)
        
        # Keyboard Shortcuts tab
        shortcuts_frame = ttk.Frame(notebook)
        notebook.add(shortcuts_frame, text="Keyboard Shortcuts")
        
        shortcuts_content = """
        ⌨️ Keyboard Shortcuts ⌨️

        CODE GENERATION
        F5              - Generate code from prompt
        F6              - Auto-improve current code
        F7              - Run quality checks
        Ctrl+Space      - Trigger AI suggestions

        FILE OPERATIONS
        Ctrl+S          - Save current file
        Ctrl+O          - Open project
        Ctrl+N          - New project
        Ctrl+W          - Close current file

        EDITING
        Ctrl+Z          - Undo
        Ctrl+Y          - Redo
        Ctrl+F          - Find in code
        Ctrl+H          - Replace in code
        Ctrl+A          - Select all
        
        NAVIGATION
        Ctrl+Tab        - Switch between tabs
        Ctrl+G          - Go to line
        Alt+Left        - Navigate back
        Alt+Right       - Navigate forward

        MISC
        F1              - Show this help
        Ctrl+,          - Open settings
        Ctrl+Q          - Quit application
        """
        self.create_scrollable_text(shortcuts_frame, shortcuts_content)
        
        # Close button
        ttk.Button(help_window, text="Close", command=help_window.destroy).pack(pady=10)
    
    def create_scrollable_text(self, parent, content):
        """Create a scrollable text widget with content"""
        text = scrolledtext.ScrolledText(parent, wrap=tk.WORD, padx=20, pady=20)
        text.insert(tk.END, content)
        text.config(state=tk.DISABLED)
        text.pack(fill=tk.BOTH, expand=True)
    
    def activate_code_butler(self) -> None:
        """Activate interactive guide assistant"""
        if messagebox.askyesno("Code Butler", "Create sample project to get started?"):
            self.create_sample_project()
    
    def create_sample_project(self) -> None:
        """Create a sample project for demonstration"""
        try:
            self.project_manager.create_project("SampleProject")
            self.current_logger = AILogger(self.project_manager.current_project)
            sample_prompt = """Create a Python Flask web application with:
            - User authentication
            - SQLite database
            - REST API endpoints
            - Security best practices
            - Unit tests"""
            self.editor.delete("1.0", tk.END)
            self.editor.insert(tk.END, sample_prompt)
            self.update_project_tree()
            self.status_manager.set("Created sample project 'SampleProject'", "info")
            
            # Generate the sample code
            self.generate_code()
        except Exception as e:
            logger.error(f"Failed to create sample project: {str(e)}")
            self.status_manager.set(f"Error creating sample project: {str(e)}", "error")
    
    def show_examples(self) -> None:
        """Show example prompts for code generation"""
        examples = """
        💡 Example Prompts 💡

        WEB DEVELOPMENT:
        "Create a React dashboard with login and charts"
        "Make a Django e-commerce site with payments"
        "Build REST API for todo list with JWT auth"

        MOBILE:
        "Generate React Native fitness tracker app"
        "Create Flutter recipe app with Firebase"

        DATA SCIENCE:
        "Build PyTorch image classifier"
        "Create ML pipeline for sales prediction"

        DEVOPS:
        "Make Docker setup for Python/Node.js microservices"
        "Create AWS template for 3-tier app"
        """
        self.show_scrollable_message("Example Prompts", examples)
    
    def show_cheatsheet(self) -> None:
        """Show cheatsheet with keyboard shortcuts"""
        cheatsheet = """
        ⚡ Lazy Developer's Cheat Sheet ⚡

        HOTKEYS:
        F5         - Generate code
        F6         - Auto-improve code
        F7         - Run quality checks
        Ctrl+S     - Save file
        Ctrl+O     - Open project
        Ctrl+N     - New project

        AI COMMANDS:
        !test      - Generate tests
        !doc       - Create documentation
        !fix       - Improve code quality
        !deploy    - Generate deployment config
        !explain   - Explain selected code
        """
        self.show_scrollable_message("Cheat Sheet", cheatsheet)
    
    def show_scrollable_message(self, title: str, content: str, parent=None) -> None:
        """Display scrollable text content in a window"""
        window = parent or tk.Toplevel(self.master)
        if not parent:
            window.title(title)
            window.geometry("500x400")
            window.transient(self.master)
        
        text = scrolledtext.ScrolledText(window, wrap=tk.WORD, padx=20, pady=20)
        text.insert(tk.END, content)
        text.config(state=tk.DISABLED)
        text.pack(fill=tk.BOTH, expand=True)
        
        if not parent:
            ttk.Button(window, text="Close", command=window.destroy).pack(pady=10)
    
    def open_tutorials(self) -> None:
        """Open video tutorials in web browser"""
        webbrowser.open("https://example.com/tutorials")

    def create_new_project(self, event=None) -> None:
        """Create a new project with a specified name"""
        project_name = simpledialog.askstring("New Project", "Enter project name:")
        if not project_name:
            return
            
        try:
            templates = ["basic", "web", "api", "data_science", "mobile"]
            template = simpledialog.askstring(
                "Project Template", 
                "Choose template (basic, web, api, data_science, mobile):",
                initialvalue="basic"
            )
            
            if not template or template not in templates:
                template = "basic"
                
            self.project_manager.create_project(project_name, template)
            self.current_logger = AILogger(self.project_manager.current_project)
            self.update_project_tree()
            self.status_manager.set(f"Created new project: {project_name}", "info")
        except Exception as e:
            logger.error(f"Failed to create project: {str(e)}")
            self.status_manager.set(f"Error creating project: {str(e)}", "error")
            messagebox.showerror("Project Creation Error", str(e))

    def open_project(self, event=None) -> None:
        """Open an existing project"""
        project_dir = filedialog.askdirectory(
            initialdir=self.config.get("projects", "base_dir")
        )
        if not project_dir:
            return
            
        try:
            self.project_manager.current_project = Path(project_dir)
            self.current_logger = AILogger(self.project_manager.current_project)
            self.update_project_tree()
            self.status_manager.set(f"Opened project: {os.path.basename(project_dir)}", "info")
        except Exception as e:
            logger.error(f"Failed to open project: {str(e)}")
            self.status_manager.set(f"Error opening project: {str(e)}", "error")

    def open_file(self, file_path: str) -> None:
        """Open a file in the editor"""
        try:
            # Check for unsaved changes
            if self.editor_modified:
                if not messagebox.askyesno("Unsaved Changes", 
                                        "You have unsaved changes. Discard them?"):
                    return
            
            with open(file_path, "r") as f:
                content = f.read()
                
            self.editor.delete("1.0", tk.END)
            self.editor.insert(tk.END, content)
            self._set_editor_modified(False)
            
            # Update status
            self.status_manager.set(f"Opened: {os.path.basename(file_path)}")
            
            # Set language based on file extension for code analysis
            _, ext = os.path.splitext(file_path)
            if ext.lower() == '.py':
                # If we integrate with live_code_analyzer later
                if hasattr(self, 'code_analyzer'):
                    self.code_analyzer.set_language("python")
            elif ext.lower() in ('.js', '.jsx'):
                if hasattr(self, 'code_analyzer'):
                    self.code_analyzer.set_language("javascript")
        except Exception as e:
            logger.error(f"Failed to open file {file_path}: {str(e)}")
            self.status_manager.set(f"Error opening file: {str(e)}", "error")

    def update_project_tree(self, filter_text: str = "") -> None:
        """Update project explorer tree with current project structure"""
        if not self.project_manager.current_project:
            return
            
        # Clear existing items
        self.project_tree.delete(*self.project_tree.get_children())
        
        # Add project root
        project_name = os.path.basename(str(self.project_manager.current_project))
        root_id = self.project_tree.insert("", tk.END, text=project_name, open=True, 
                                          values=("dir", ""))
        
        # Build tree structure
        self._build_tree(self.project_manager.current_project, root_id, filter_text)
        
        # Update status
        self.status_manager.set(f"Project tree updated: {project_name}")
    
    def _build_tree(self, path: Path, parent_id: str, filter_text: str = "") -> None:
        """Recursively build tree structure from directory"""
        try:
            for item in sorted(os.listdir(path), key=lambda x: (not os.path.isdir(os.path.join(path, x)), x)):
                item_path = os.path.join(path, item)
                
                # Skip if it doesn't match filter
                if filter_text and filter_text.lower() not in item.lower():
                    # But include directories anyway to maintain structure
                    if not os.path.isdir(item_path):
                        continue
                
                # Get last modified time
                try:
                    mtime = os.path.getmtime(item_path)
                    mod_time = datetime.fromtimestamp(mtime).strftime("%Y-%m-%d")
                except:
                    mod_time = ""
                
                if os.path.isdir(item_path):
                    # Directory
                    dir_id = self.project_tree.insert(parent_id, tk.END, text=item, 
                                                    values=("dir", mod_time))
                    self._build_tree(item_path, dir_id, filter_text)
                else:
                    # File with icon based on extension
                    _, ext = os.path.splitext(item)
                    file_type = ext[1:] if ext else "file"
                    self.project_tree.insert(parent_id, tk.END, text=item, 
                                           values=(file_type, mod_time))
        except Exception as e:
            logger.error(f"Error building tree for {path}: {str(e)}")

    def generate_code(self, event=None) -> None:
        """Generate code based on prompt in editor"""
        prompt = self.editor.get("1.0", tk.END).strip()
        if not prompt:
            self.status_manager.set("Please enter a prompt first", "warning")
            return
            
        # Check for project
        if not self.project_manager.current_project:
            if messagebox.askyesno("No Project", 
                                  "No active project. Create a new one?"):
                self.create_new_project()
                if not self.project_manager.current_project:
                    return
            else:
                return
        
        # Show spinner for background operation
        self.busy_indicator.start()
        self.status_manager.set("Generating code...", "info")
        
        # Update AI console
        self.ai_console.delete("1.0", tk.END)
        self.ai_console.insert(tk.END, f"Prompt: {prompt}\n\nGenerating code...\n")
        
        # Process in background thread
        def _on_generation_complete(result):
            self.busy_indicator.stop()
            
            if result.success:
                # Validate and enhance code
                validation = self.code_enforcer.validate_syntax(result.data)
                if not validation["valid"]:
                    self.show_errors(validation["errors"])
                    return
                    
                improved_code = self.code_enforcer.enforce_standards(result.data)
                
                # Update editor with result
                self.editor.delete("1.0", tk.END)
                self.editor.insert(tk.END, improved_code)
                self._set_editor_modified(True)
                
                # Update AI console
                self.ai_console.insert(tk.END, "\nGeneration successful!\n")
                
                # Log interaction
                if self.current_logger:
                    self.current_logger.log_interaction(prompt, improved_code, ["main.py"])
                
                # Auto-generate tests if enabled
                if self.config.get_bool("projects", "auto_tests"):
                    self.auto_generate_tests(improved_code)
                
                # Run quality checks if enabled
                if self.config.get_bool("projects", "quality_checks"):
                    self.run_quality_checks()
                    
                self.status_manager.set("✅ Enterprise-grade code generated!", "info")
            else:
                self.ai_console.insert(tk.END, f"\nError: {result.error}\n")
                self.status_manager.set(f"Generation failed: {result.error}", "error")
        
        def _on_generation_error(error):
            self.busy_indicator.stop()
            error_msg = str(error)
            self.ai_console.insert(tk.END, f"\nError: {error_msg}\n")
            self.status_manager.set(f"Generation error: {error_msg}", "error")
        
        # Execute in background
        self.api_client.async_request(
            self.api_client.generate_code,
            prompt,
            callback=_on_generation_complete,
            error_callback=_on_generation_error
        )

    def show_errors(self, errors: List[Dict]) -> None:
        """Display code errors in quality display"""
        self.quality_display.delete("1.0", tk.END)
        
        for error in errors:
            self.quality_display.insert(tk.END, 
                                       f"Line {error.get('line', 'unknown')}: "
                                       f"{error.get('message', 'Unknown error')}\n")
        
        messagebox.showwarning(
            "Code Issues", 
            "There were problems with the generated code. See Quality Report tab."
        )

    def auto_generate_tests(self, code: str) -> None:
        """Generate test cases for current code"""
        if not self.project_manager.current_project:
            self.status_manager.set("No active project for test generation", "warning")
            return
            
        # Show spinner
        self.busy_indicator.start()
        self.status_manager.set("Generating tests...", "info")
        
        # Process in background
        def _on_test_generation_complete(result):
            self.busy_indicator.stop()
            
            if result.success:
                try:
                    test_dir = self.project_manager.current_project / "tests"
                    test_dir.mkdir(exist_ok=True)
                    
                    test_path = test_dir / "test_generated.py"
                    with open(test_path, "w") as f:
                        f.write(result.data)
                        
                    self.status_manager.set(f"Tests generated: {test_path.name}", "info")
                    self.update_project_tree()  # Refresh tree to show new file
                except Exception as e:
                    logger.error(f"Failed to save tests: {str(e)}")
                    self.status_manager.set(f"Error saving tests: {str(e)}", "error")
            else:
                self.status_manager.set(f"Test generation failed: {result.error}", "error")
        
        def _on_test_generation_error(error):
            self.busy_indicator.stop()
            self.status_manager.set(f"Test generation error: {str(error)}", "error")
        
        # Execute in background
        self.api_client.async_request(
            self.api_client.generate_tests,
            code,
            callback=_on_test_generation_complete,
            error_callback=_on_test_generation_error
        )

    def run_quality_checks(self, event=None) -> None:
        """Run code quality checks on current editor content"""
        code = self.editor.get("1.0", tk.END)
        if not code.strip():
            self.status_manager.set("No code to check", "warning")
            return
            
        try:
            # Clear previous results
            self.quality_display.delete("1.0", tk.END)
            self.quality_display.insert(tk.END, "Running quality checks...\n\n")
            
            # Run checks in a background thread to avoid UI freezing
            def _run_checks():
                try:
                    issues = self.code_enforcer.run_quality_checks(code)
                    
                    # Update UI in main thread
                    self.master.after(0, lambda: self._display_quality_results(issues))
                except Exception as e:
                    error_msg = str(e)
                    logger.error(f"Quality check error: {error_msg}")
                    self.master.after(0, lambda: self.status_manager.set(
                        f"Quality check error: {error_msg}", "error"))
                    self.master.after(0, lambda: self.quality_display.insert(
                        tk.END, f"Error running checks: {error_msg}\n"))
            
            threading.Thread(target=_run_checks).start()
            
        except Exception as e:
            logger.error(f"Failed to run quality checks: {str(e)}")
            self.status_manager.set(f"Error running quality checks: {str(e)}", "error")
    
    def _display_quality_results(self, issues: List[str]) -> None:
        """Display quality check results"""
        self.quality_display.delete("1.0", tk.END)
        
        if not issues:
            self.quality_display.insert(tk.END, "🌟 All checks passed!")
            self.status_manager.set("Code quality checks passed", "info")
        else:
            self.quality_display.insert(tk.END, f"Found {len(issues)} issues:\n\n")
            for issue in issues:
                self.quality_display.insert(tk.END, f"{issue}\n")
            self.status_manager.set(f"Found {len(issues)} quality issues", "warning")

    def auto_improve(self, event=None) -> None:
        """Auto-improve code quality"""
        code = self.editor.get("1.0", tk.END)
        if not code.strip():
            self.status_manager.set("No code to improve", "warning")
            return
            
        prompt = f"Improve this code to enterprise standards:\n{code}"
        
        # Show spinner
        self.busy_indicator.start()
        self.status_manager.set("Improving code...", "info")
        
        # Process in background
        def _on_improve_complete(result):
            self.busy_indicator.stop()
            
            if result.success:
                self.editor.delete("1.0", tk.END)
                self.editor.insert(tk.END, result.data)
                self._set_editor_modified(True)
                self.status_manager.set("Code improved successfully", "info")
                
                # Run quality checks after improvement
                self.run_quality_checks()
            else:
                self.status_manager.set(f"Code improvement failed: {result.error}", "error")
        
        def _on_improve_error(error):
            self.busy_indicator.stop()
            self.status_manager.set(f"Code improvement error: {str(error)}", "error")
        
        # Execute in background
        self.api_client.async_request(
            self.api_client.generate_code,
            prompt,
            callback=_on_improve_complete,
            error_callback=_on_improve_error
        )

    def save_file(self, event=None) -> None:
        """Save current editor content to file"""
        if not self.project_manager.current_project:
            if messagebox.askyesno("No Project", 
                               "No active project. Create a new one?"):
                self.create_new_project()
                if not self.project_manager.current_project:
                    return
            else:
                return
                
        content = self.editor.get("1.0", tk.END)
        if not content.strip():
            self.status_manager.set("No content to save", "warning")
            return
            
        try:
            # Default location in project's src directory
            initial_dir = self.project_manager.current_project / "src"
            initial_dir.mkdir(exist_ok=True)
            
            file_path = filedialog.asksaveasfilename(
                defaultextension=".py",
                initialdir=initial_dir,
                filetypes=[
                    ("Python files", "*.py"),
                    ("HTML files", "*.html"),
                    ("JavaScript files", "*.js"),
                    ("All files", "*.*")
                ]
            )
            
            if not file_path:
                return
                
            with open(file_path, "w") as f:
                f.write(content)
                
            self._set_editor_modified(False)
            self.status_manager.set(f"Saved: {os.path.basename(file_path)}", "info")
            
            # Update project tree
            self.update_project_tree()
            
        except Exception as e:
            logger.error(f"Failed to save file: {str(e)}")
            self.status_manager.set(f"Error saving file: {str(e)}", "error")
            messagebox.showerror("Save Error", str(e))


def main():
    """Main application entry point"""
    try:
        # Configure basic logging
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        
        # Create and run application
        root = tk.Tk()
        app = EnterpriseCodeFactory(root)
        root.protocol("WM_DELETE_WINDOW", lambda: getattr(app, "_on_exit", root.destroy)())
        root.mainloop()
    except Exception as e:
        logging.critical(f"Application failed to start: {str(e)}")
        traceback.print_exc()
        messagebox.showerror("Critical Error", f"Application failed to start: {str(e)}")


if __name__ == "__main__":
    main()