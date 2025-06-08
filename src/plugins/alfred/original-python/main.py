#!/usr/bin/env python
"""
Enterprise Code Factory 9000 Pro – Unified Code Analysis, AI Enhancement & Project Management

This application merges core file editing and analysis features along with advanced 
AI enhancements, project management, live code analysis, and an Ollama LLM drop‐down.
The drop‐down shows the available LLM models and a traffic light indicator (●)
reflects the service status (green if available, red if not).

Author: Enhanced by Claude
Date: April 10, 2025
"""

import os
import sys
import time
import uuid
import logging
import configparser
import threading
import queue
from datetime import datetime
from pathlib import Path

import tkinter as tk
from tkinter import ttk, filedialog, messagebox, scrolledtext, simpledialog
from PIL import Image, ImageTk  # You'll need to install pillow: pip install pillow

# -- Import local modules (assumed available) --
try:
    from integration import initialize_enhancements, shutdown_and_exit
    from code_analyzer import (
        QualityConfig, Language, CodeAnalyzer, PythonAnalyzer, 
        JavaScriptAnalyzer, CodeIssue, ValidationResult, CodeAnalysisDisplay
    )
    from project_manager import ProjectManager
    from project_tree_manager import ProjectTreeManager
    from unified_code_analyzer import CodeEnforcer
    from ai_logger import AILogger
    from accessibility_manager import create_accessibility_manager
    from ollama_integration import OllamaClient
except ImportError as e:
    print(f"Error importing modules: {e}")
    sys.exit(1)


# A simple API client for simulated AI code generation (can be replaced with OllamaClient in production)
class ApiClient:
    def __init__(self, config):
        self.model = config.get("api", "model_name", fallback="deepseek-coder:33b-instruct")
        self.url = config.get("api", "url", fallback="http://localhost:11434/api/generate")
        self.timeout = config.getint("api", "timeout", fallback=300)
    def generate_code(self, prompt):
        # Simulate AI code generation with a 2-second delay.
        time.sleep(2)
        return f"# Generated code based on prompt:\n# {prompt}\n\nprint('Hello, enterprise world!')"


# Custom UI theme for cyberpunk aesthetic
class CyberpunkTheme:
    def __init__(self):
        # Primary colors
        self.bg_dark = "#0a0a12"
        self.bg_main = "#121218"
        self.bg_light = "#1a1a24"
        self.text_normal = "#ccccff"
        self.text_dim = "#8a8aa8"
        self.accent_primary = "#00ffff"   # Cyan
        self.accent_secondary = "#ff00ff" # Magenta
        self.accent_tertiary = "#7700ff"  # Purple
        self.warning = "#ffcc00"
        self.error = "#ff3366"
        self.success = "#00ff99"
        
        # Glow effects (to be used in specific widgets)
        self.glow_cyan = "#00ffff20"
        self.glow_magenta = "#ff00ff20"
        
        # Editor syntax highlighting
        self.comment = "#666688"
        self.keyword = "#ff00ff"
        self.string = "#00ff99"
        self.number = "#00ccff"
        self.function = "#ffcc00"
        self.class_name = "#ff66ff"
        
    def apply_to_ttk(self, root):
        # Create custom styles for the application
        style = ttk.Style(root)
        
        # Configure the main styles
        style.configure("TFrame", background=self.bg_main)
        style.configure("TLabel", background=self.bg_main, foreground=self.text_normal)
        style.configure("TButton", 
                      background=self.bg_dark, 
                      foreground=self.accent_primary,
                      borderwidth=1,
                      relief="raised",
                      highlightthickness=1,
                      highlightbackground=self.accent_primary,
                      highlightcolor=self.accent_primary)
                      
        # Configure specific button styles
        style.configure("Accent.TButton", 
                      background=self.bg_dark, 
                      foreground=self.accent_secondary)
        
        # Configure entry and combobox
        style.configure("TEntry", 
                      fieldbackground=self.bg_dark, 
                      foreground=self.text_normal,
                      bordercolor=self.accent_primary,
                      insertcolor=self.accent_primary)
                      
        style.configure("TCombobox", 
                      background=self.bg_dark, 
                      fieldbackground=self.bg_dark,
                      foreground=self.text_normal,
                      arrowcolor=self.accent_primary)
        
        # Configure notebook and tabs
        style.configure("TNotebook", 
                      background=self.bg_dark,
                      borderwidth=0)
                      
        style.configure("TNotebook.Tab", 
                      background=self.bg_dark,
                      foreground=self.text_dim,
                      padding=[10, 3],
                      borderwidth=0)
                      
        style.map("TNotebook.Tab",
                foreground=[('selected', self.accent_primary)],
                background=[('selected', self.bg_main)])
        
        # Configure treeview
        style.configure("Treeview", 
                      background=self.bg_dark,
                      foreground=self.text_normal,
                      fieldbackground=self.bg_dark)
                      
        style.map("Treeview", 
                background=[('selected', self.accent_tertiary)],
                foreground=[('selected', self.text_normal)])
        
        # Configure scrollbars
        style.configure("TScrollbar", 
                      background=self.bg_dark,
                      troughcolor=self.bg_main,
                      arrowcolor=self.accent_primary)
        
        # Configure progressbar
        style.configure("TProgressbar", 
                      background=self.accent_primary,
                      troughcolor=self.bg_dark)
        
        # Configure other elements
        style.configure("Separator.TSeparator", background=self.accent_primary)


class EnterpriseCodeFactoryApp:
    def __init__(self, root):
        self.root = root
        self.root.title("ENTERPRISE CODE FACTORY 9000 PRO")
        self.root.geometry("1400x900")
        self.root.minsize(800, 600)
        
        # Apply cyberpunk theme
        self.theme = CyberpunkTheme()
        self.root.configure(bg=self.theme.bg_main)
        self.theme.apply_to_ttk(self.root)
        
        # Set application icon
        self._setup_icon()
        
        self._setup_logging()
        
        # Load configuration with default settings for demo purposes
        self.config = configparser.ConfigParser()
        self.config.read_dict({
            "api": {
                "url": "http://localhost:11434/api/generate",
                "model_name": "deepseek-coder:33b-instruct",
                "timeout": "300"
            },
            "app": {
                "window_size": "1400x900",
                "theme": "cyberpunk",
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
        })
        
        # Initialize quality configuration for analyzers
        config_path = Path(__file__).parent / "config" / "quality_config.ini"
        self.quality_config = QualityConfig(str(config_path) if config_path.exists() else None)
        
        # Initialize local modules
        self.api_client = ApiClient(self.config)
        self.project_manager = ProjectManager(self.config.get("projects", "base_dir"))
        self.code_enforcer = CodeEnforcer()  # Unified code analyzer/live analysis module
        self.ai_logger = AILogger(project_root=self.project_manager.projects_dir, user="developer")
        self.integration = initialize_enhancements(self)  # Pass self for integration modules to access full state
        self.accessibility_manager = create_accessibility_manager(self.root)
        
        # NEW: Instantiate OllamaClient and store as self.ollama_client.
        self.ollama_client = OllamaClient()
        
        # For AI chat conversation memory
        self.chat_history = []  # List of (sender, message)
        
        # Initialize analyzers
        self._init_analyzers()
        
        # Set up background task processing
        self.task_queue = queue.Queue()
        self._start_worker()
        
        # Build the UI
        self._setup_ui()
        self._setup_menu()
        self._setup_toolbar()
        self._setup_bindings()
        
        # Populate Ollama models and check connection status
        self._populate_ollama_models()
        self._update_ollama_status()
        
        # Process any command-line file to open
        self._process_args()
        
        # Create animation effects
        self._setup_cyber_animations()
        
        self.logger.info("Enterprise Code Factory 9000 Pro initialized successfully")
    
    def _setup_icon(self):
        # For production, save the SVG to a file and convert to ICO format
        # For now, we'll assume an icon.ico file exists in the resources directory
        icon_path = Path(__file__).parent / "resources" / "icon.ico"
        if icon_path.exists():
            self.root.iconbitmap(icon_path)
    
    def _setup_logging(self):
        log_dir = Path.home() / ".ecf" / "logs"
        log_dir.mkdir(parents=True, exist_ok=True)
        log_file = log_dir / f"ecf_{datetime.now().strftime('%Y%m%d')}.log"
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            handlers=[logging.FileHandler(log_file), logging.StreamHandler(sys.stdout)]
        )
        self.logger = logging.getLogger(__name__)
        self.logger.info("Logging is set up.")
    
    def _init_analyzers(self):
        self.analyzers = {
            Language.PYTHON: PythonAnalyzer(self.quality_config),
            Language.JAVASCRIPT: JavaScriptAnalyzer(self.quality_config),
        }
    
    def _start_worker(self):
        def worker():
            while True:
                try:
                    task, args, kwargs, callback = self.task_queue.get()
                    try:
                        result = task(*args, **kwargs)
                        if callback:
                            self.root.after(0, lambda: callback(result))
                    except Exception as e:
                        self.logger.error(f"Error in worker task: {e}")
                        self.root.after(0, lambda: self._show_error(f"Task error: {str(e)}"))
                    self.task_queue.task_done()
                except Exception as e:
                    self.logger.error(f"Worker error: {e}")
        self.worker_thread = threading.Thread(target=worker, daemon=True)
        self.worker_thread.start()
    
    def _process_args(self):
        if len(sys.argv) > 1:
            file_path = sys.argv[1]
            if os.path.isfile(file_path):
                self._load_file(file_path)
    
    def _setup_ui(self):
        # Create a container frame with gradient effect
        main_container = tk.Frame(self.root, bg=self.theme.bg_main)
        main_container.pack(fill=tk.BOTH, expand=True)
        
        # Title bar with cyberpunk styling
        title_frame = tk.Frame(main_container, bg=self.theme.bg_dark, height=40)
        title_frame.pack(fill=tk.X, side=tk.TOP)
        
        title_label = tk.Label(
            title_frame, 
            text="// ENTERPRISE CODE FACTORY 9000 PRO //", 
            bg=self.theme.bg_dark,
            fg=self.theme.accent_primary,
            font=("Courier New", 14, "bold")
        )
        title_label.pack(side=tk.LEFT, padx=20, pady=8)
        
        # System time display with cyberpunk styling
        self.time_var = tk.StringVar()
        time_label = tk.Label(
            title_frame, 
            textvariable=self.time_var,
            bg=self.theme.bg_dark,
            fg=self.theme.accent_secondary,
            font=("Courier New", 12)
        )
        time_label.pack(side=tk.RIGHT, padx=20, pady=8)
        self._update_time()
        
        main_frame = ttk.Frame(main_container)
        main_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        
        # Use a panedwindow for resizable panels
        self.paned_window = ttk.PanedWindow(main_frame, orient=tk.HORIZONTAL)
        self.paned_window.pack(fill=tk.BOTH, expand=True)
        
        # Left panel (collapsible)
        self.left_panel = ttk.Frame(self.paned_window, width=300)
        self.paned_window.add(self.left_panel, weight=1)
        
        # Left panel header
        left_header = tk.Frame(self.left_panel, bg=self.theme.bg_dark, height=30)
        left_header.pack(fill=tk.X)
        
        left_header_label = tk.Label(
            left_header, 
            text="SYSTEM INTERFACE", 
            bg=self.theme.bg_dark,
            fg=self.theme.accent_primary,
            font=("Courier New", 10, "bold")
        )
        left_header_label.pack(side=tk.LEFT, padx=10, pady=5)
        
        # Left panel notebook with cyberpunk styling
        self.left_notebook = ttk.Notebook(self.left_panel)
        self.left_notebook.pack(fill=tk.BOTH, expand=True)
        
        # Project explorer tab
        self.project_explorer_frame = ttk.Frame(self.left_notebook)
        self.left_notebook.add(self.project_explorer_frame, text="PROJECT EXPLORER")
        self._setup_project_explorer(self.project_explorer_frame)
        
        # AI Chat tab
        self.chat_frame = ttk.Frame(self.left_notebook)
        self.left_notebook.add(self.chat_frame, text="AI INTERFACE")
        self._setup_chat_panel(self.chat_frame)
        
        # Right panel (editor area)
        self.right_panel = ttk.Frame(self.paned_window)
        self.paned_window.add(self.right_panel, weight=3)
        
        # Right panel header
        right_header = tk.Frame(self.right_panel, bg=self.theme.bg_dark, height=30)
        right_header.pack(fill=tk.X)
        
        self.file_path_var = tk.StringVar(value="// NO FILE LOADED //")
        right_header_label = tk.Label(
            right_header, 
            textvariable=self.file_path_var, 
            bg=self.theme.bg_dark,
            fg=self.theme.accent_primary,
            font=("Courier New", 10, "bold")
        )
        right_header_label.pack(side=tk.LEFT, padx=10, pady=5)
        
        self._setup_editor()
        
        # Status bar with cyberpunk styling
        status_frame = tk.Frame(self.root, bg=self.theme.bg_dark, height=30)
        status_frame.pack(fill=tk.X, side=tk.BOTTOM)
        
        self.status_var = tk.StringVar(value="SYSTEM READY")
        self.status_bar = tk.Label(
            status_frame, 
            textvariable=self.status_var, 
            bg=self.theme.bg_dark,
            fg=self.theme.accent_primary,
            font=("Courier New", 10),
            anchor=tk.W,
        )
        self.status_bar.pack(fill=tk.X, side=tk.LEFT, padx=10, pady=5)
        
        # Animated cyberpunk indicator in status bar
        self.indicator_canvas = tk.Canvas(status_frame, width=20, height=20, bg=self.theme.bg_dark, highlightthickness=0)
        self.indicator_canvas.pack(side=tk.RIGHT, padx=10)
        self.indicator = self.indicator_canvas.create_oval(5, 5, 15, 15, fill=self.theme.accent_primary, outline="")
        
    def _update_time(self):
        current_time = datetime.now().strftime("%H:%M:%S")
        self.time_var.set(f"SYS TIME: {current_time}")
        self.root.after(1000, self._update_time)
    
    def _setup_cyber_animations(self):
        # Pulsing indicator in status bar
        def pulse_indicator():
            alpha = 0.5 + 0.5 * abs(math.sin(time.time() * 2))
            r = int(int(self.theme.accent_primary[1:3], 16) * alpha)
            g = int(int(self.theme.accent_primary[3:5], 16) * alpha)
            b = int(int(self.theme.accent_primary[5:7], 16) * alpha)
            color = f'#{r:02x}{g:02x}{b:02x}'
            self.indicator_canvas.itemconfig(self.indicator, fill=color)
            self.root.after(50, pulse_indicator)
        
        # Random "tech" updates in status bar
        def random_status_update():
            messages = [
                "SCANNING CODE MATRIX",
                "NEURAL NET ENGAGED",
                "QUANTUM COMPILATION READY",
                "SECURITY PROTOCOLS ACTIVE",
                "SYSTEM DIAGNOSTICS NORMAL",
                "AI CORE OPERATIONAL"
            ]
            current = self.status_var.get()
            if "SYSTEM" not in current and "SCANNING" not in current:
                # Don't override important status messages
                return
            self.status_var.set(random.choice(messages))
            # Schedule next update between 8-15 seconds
            self.root.after(random.randint(8000, 15000), random_status_update)
        
        # Initialize the animations
        self.root.after(100, pulse_indicator)
        self.root.after(5000, random_status_update)
    
    def _setup_menu(self):
        # Create a modern, angular menu with cyberpunk styling
        self.menu = tk.Menu(self.root, bg=self.theme.bg_dark, fg=self.theme.text_normal, 
                          activebackground=self.theme.accent_tertiary, 
                          activeforeground=self.theme.text_normal,
                          relief=tk.FLAT, borderwidth=0)
        self.root.config(menu=self.menu)
        
        file_menu = tk.Menu(self.menu, tearoff=0, bg=self.theme.bg_dark, fg=self.theme.text_normal,
                          activebackground=self.theme.accent_tertiary, activeforeground=self.theme.text_normal)
        file_menu.add_command(label="New File", command=self._new_file, accelerator="Ctrl+N")
        file_menu.add_command(label="Open File...", command=self._open_file, accelerator="Ctrl+O")
        file_menu.add_command(label="Save", command=self._save_file, accelerator="Ctrl+S")
        file_menu.add_command(label="Save As...", command=self._save_as, accelerator="Ctrl+Shift+S")
        file_menu.add_separator()
        file_menu.add_command(label="Exit", command=self._on_close, accelerator="Alt+F4")
        self.menu.add_cascade(label="FILE", menu=file_menu)
        
        edit_menu = tk.Menu(self.menu, tearoff=0, bg=self.theme.bg_dark, fg=self.theme.text_normal,
                         activebackground=self.theme.accent_tertiary, activeforeground=self.theme.text_normal)
        edit_menu.add_command(label="Undo", command=self._undo, accelerator="Ctrl+Z")
        edit_menu.add_command(label="Redo", command=self._redo, accelerator="Ctrl+Y")
        edit_menu.add_separator()
        edit_menu.add_command(label="Cut", command=self._cut, accelerator="Ctrl+X")
        edit_menu.add_command(label="Copy", command=self._copy, accelerator="Ctrl+C")
        edit_menu.add_command(label="Paste", command=self._paste, accelerator="Ctrl+V")
        self.menu.add_cascade(label="EDIT", menu=edit_menu)
        
        analysis_menu = tk.Menu(self.menu, tearoff=0, bg=self.theme.bg_dark, fg=self.theme.text_normal,
                              activebackground=self.theme.accent_tertiary, activeforeground=self.theme.text_normal)
        analysis_menu.add_command(label="Analyze Code", command=self._analyze_code, accelerator="F5")
        analysis_menu.add_command(label="Fix All Issues", command=self._fix_all_issues)
        analysis_menu.add_separator()
        analysis_menu.add_command(label="Settings...", command=self._open_settings)
        self.menu.add_cascade(label="ANALYSIS", menu=analysis_menu)
        
        ai_menu = tk.Menu(self.menu, tearoff=0, bg=self.theme.bg_dark, fg=self.theme.text_normal,
                        activebackground=self.theme.accent_tertiary, activeforeground=self.theme.text_normal)
        ai_menu.add_command(label="Optimize Code", command=self._optimize_code)
        ai_menu.add_command(label="Explain Code", command=self._explain_code)
        ai_menu.add_command(label="Generate Documentation", command=self._generate_docs)
        self.menu.add_cascade(label="AI ENHANCE", menu=ai_menu)
        
        project_menu = tk.Menu(self.menu, tearoff=0, bg=self.theme.bg_dark, fg=self.theme.text_normal,
                             activebackground=self.theme.accent_tertiary, activeforeground=self.theme.text_normal)
        project_menu.add_command(label="New Project", command=self._create_new_project)
        project_menu.add_command(label="Open Project", command=self._open_project)
        project_menu.add_command(label="Refresh Project Tree", command=self._update_project_tree)
        self.menu.add_cascade(label="PROJECT", menu=project_menu)
        
        help_menu = tk.Menu(self.menu, tearoff=0, bg=self.theme.bg_dark, fg=self.theme.text_normal,
                          activebackground=self.theme.accent_tertiary, activeforeground=self.theme.text_normal)
        help_menu.add_command(label="Documentation", command=self._show_docs)
        help_menu.add_command(label="About", command=self._show_about)
        self.menu.add_cascade(label="HELP", menu=help_menu)
    
    def _setup_toolbar(self):
        # Create a modern, angular toolbar with cyberpunk styling
        toolbar = tk.Frame(self.root, bg=self.theme.bg_dark, height=40)
        toolbar.pack(fill=tk.X, pady=(0,5))
        
        # Create custom button style for toolbar
        button_font = ("Courier New", 9, "bold")
        button_style = {
            "bg": self.theme.bg_dark,
            "fg": self.theme.accent_primary,
            "activebackground": self.theme.bg_light,
            "activeforeground": self.theme.accent_primary,
            "relief": tk.FLAT,
            "borderwidth": 0,
            "padx": 10,
            "pady": 5,
            "font": button_font,
            "highlightthickness": 1,
            "highlightbackground": self.theme.bg_dark,
            "highlightcolor": self.theme.accent_primary
        }
        
        # Create toolbar buttons with cyberpunk styling
        self.new_btn = tk.Button(toolbar, text="NEW", command=self._new_file, **button_style)
        self.new_btn.pack(side=tk.LEFT, padx=2)
        
        self.open_btn = tk.Button(toolbar, text="OPEN", command=self._open_file, **button_style)
        self.open_btn.pack(side=tk.LEFT, padx=2)
        
        self.save_btn = tk.Button(toolbar, text="SAVE", command=self._save_file, **button_style)
        self.save_btn.pack(side=tk.LEFT, padx=2)
        
        # Separator with glow effect
        separator1 = tk.Frame(toolbar, width=2, bg=self.theme.accent_primary)
        separator1.pack(side=tk.LEFT, fill=tk.Y, padx=10, pady=5)
        
        self.analyze_btn = tk.Button(toolbar, text="ANALYZE", command=self._analyze_code, **button_style)
        self.analyze_btn.pack(side=tk.LEFT, padx=2)
        
        self.fix_btn = tk.Button(toolbar, text="FIX ALL", command=self._fix_all_issues, **button_style)
        self.fix_btn.pack(side=tk.LEFT, padx=2)
        
        # Separator with glow effect
        separator2 = tk.Frame(toolbar, width=2, bg=self.theme.accent_primary)
        separator2.pack(side=tk.LEFT, fill=tk.Y, padx=10, pady=5)
        
        # Language selector with cyberpunk styling
        lang_label = tk.Label(toolbar, text="LANGUAGE:", bg=self.theme.bg_dark, fg=self.theme.text_normal, font=button_font)
        lang_label.pack(side=tk.LEFT, padx=2)
        
        self.language_var = tk.StringVar(value="auto")
        languages = ["auto", "python", "javascript", "typescript", "java", "c++", "c#"]
        
        # Custom styled combobox (since ttk styling is limited)
        self.language_combo = ttk.Combobox(
            toolbar, 
            textvariable=self.language_var, 
            values=languages, 
            width=10, 
            state="readonly"
        )
        self.language_combo.pack(side=tk.LEFT, padx=2)
        
        # --- Ollama LLM Drop-Down with Traffic Light Indicator ---
        # Separator with glow effect
        separator3 = tk.Frame(toolbar, width=2, bg=self.theme.accent_secondary)
        separator3.pack(side=tk.LEFT, fill=tk.Y, padx=10, pady=5)
        
        ollama_label = tk.Label(toolbar, text="NEURAL NET:", bg=self.theme.bg_dark, fg=self.theme.text_normal, font=button_font)
        ollama_label.pack(side=tk.LEFT, padx=2)
        
        self.ollama_combo = ttk.Combobox(toolbar, state="readonly", width=25)
        self.ollama_combo.pack(side=tk.LEFT, padx=5)
        
        # Traffic light with custom styling
        self.ollama_status_label = tk.Label(
            toolbar, 
            text="●", 
            foreground="red",
            background=self.theme.bg_dark,
            font=("Courier New", 14)
        )
        self.ollama_status_label.pack(side=tk.LEFT, padx=3)
    
    def _setup_editor(self):
        # Create a container for the editor with cyberpunk styling
        editor_frame = tk.Frame(self.right_panel, bg=self.theme.bg_main)
        editor_frame.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
        
        # Create a header for the editor
        editor_header = tk.Frame(editor_frame, bg=self.theme.bg_dark, height=25)
        editor_header.pack(fill=tk.X)
        
        editor_title = tk.Label(
            editor_header, 
            text="CODE MATRIX", 
            bg=self.theme.bg_dark, 
            fg=self.theme.accent_primary,
            font=("Courier New", 9, "bold")
        )
        editor_title.pack(side=tk.LEFT, padx=10, pady=2)
        
        # Container for the editor and line numbers
        editor_container = tk.Frame(editor_frame, bg=self.theme.bg_main)
        editor_container.pack(fill=tk.BOTH, expand=True)
        
        # Line numbers with cyberpunk styling
        self.line_numbers = tk.Text(
            editor_container, 
            width=4, 
            padx=3, 
            pady=5, 
            takefocus=0,
            border=0, 
            background=self.theme.bg_dark, 
            foreground=self.theme.accent_secondary,
            font=("Courier New", 10),
            state='disabled'
        )
        self.line_numbers.pack(side=tk.LEFT, fill=tk.Y)
        
        # Main editor with cyberpunk styling
        self.editor = tk.Text(
            editor_container, 
            wrap=tk.NONE, 
            undo=True, 
            padx=5, 
            pady=5,
            background=self.theme.bg_light,
            foreground=self.theme.text_normal,
            insertbackground=self.theme.accent_primary,  # Cursor color
            selectbackground=self.theme.accent_tertiary,
            selectforeground=self.theme.text_normal,
            font=("Courier New", 10)
        )
        self.editor.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        
        # Custom scrollbars with cyberpunk styling
        y_scroll = tk.Scrollbar(
            editor_container, 
            command=self.editor.yview,
            bg=self.theme.bg_dark,
            troughcolor=self.theme.bg_main,
            activebackground=self.theme.accent_primary,
            relief=tk.FLAT
        )
        y_scroll.pack(side=tk.RIGHT, fill=tk.Y)
        
        x_scroll = tk.Scrollbar(
            editor_frame, 
            orient=tk.HORIZONTAL, 
            command=self.editor.xview,
            bg=self.theme.bg_dark,
            troughcolor=self.theme.bg_main,
            activebackground=self.theme.accent_primary,
            relief=tk.FLAT
        )
        x_scroll.pack(side=tk.BOTTOM, fill=tk.X)
        
        # Configure scrolling
        self.editor.configure(yscrollcommand=y_scroll.set, xscrollcommand=x_scroll.set)
        self.line_numbers.configure(yscrollcommand=y_scroll.set)
        
        # Bind events
        self.editor.bind("<<Modified>>", self._update_line_numbers)
        self.editor.bind("<KeyRelease>", self._on_key_release)
        self.editor.bind("<MouseWheel>", self._on_editor_scroll)
        
        # Setup syntax highlighting tags
        self._setup_tags()
        
        # Initialize editor state
        self.current_file = None
        self.current_language = None
        
        # Analysis display panel with cyberpunk styling
        analysis_frame = tk.Frame(self.right_panel, bg=self.theme.bg_dark)
        analysis_frame.pack(side=tk.BOTTOM, fill=tk.X, before=x_scroll)
        
        analysis_header = tk.Label(
            analysis_frame, 
            text="CODE ANALYSIS MATRIX", 
            bg=self.theme.bg_dark, 
            fg=self.theme.accent_primary,
            font=("Courier New", 9, "bold"),
            anchor=tk.W
        )
        analysis_header.pack(fill=tk.X, padx=10, pady=2)
        
        # Create the analysis display panel
        self.analysis_display = CodeAnalysisDisplay(analysis_frame)
        self.analysis_display.set_fix_handler(self._handle_fix_issue)
        
        # Apply custom styling to the analysis display (assuming it's a custom widget)
        # This would need to be implemented in the CodeAnalysisDisplay class
    
    def _setup_tags(self):
        # Configure cyberpunk-styled syntax highlighting
        self.editor.tag_configure("error", background="#330011", foreground=self.theme.error, underline=True)
        self.editor.tag_configure("warning", background="#332200", foreground=self.theme.warning, underline=True)
        self.editor.tag_configure("info", background="#001133", foreground=self.theme.text_normal)
        
        # Syntax highlighting
        self.editor.tag_configure("keyword", foreground=self.theme.keyword)
        self.editor.tag_configure("string", foreground=self.theme.string)
        self.editor.tag_configure("comment", foreground=self.theme.comment)
        self.editor.tag_configure("function", foreground=self.theme.function)
        self.editor.tag_configure("class", foreground=self.theme.class_name)
        self.editor.tag_configure("number", foreground=self.theme.number)
    
    def _setup_project_explorer(self, parent):
        # Create project explorer with cyberpunk styling
        frame = tk.Frame(parent, bg=self.theme.bg_light)
        frame.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
        
        # Project explorer header
        header = tk.Label(
            frame, 
            text="ASSET DIRECTORY", 
            bg=self.theme.bg_dark, 
            fg=self.theme.accent_primary,
            font=("Courier New", 9, "bold"),
            anchor=tk.W
        )
        header.pack(fill=tk.X, pady=(0, 5))
        
        # Treeview container
        tree_container = tk.Frame(frame, bg=self.theme.bg_light)
        tree_container.pack(fill=tk.BOTH, expand=True)
        
        # Custom scrollbar
        tree_scroll = tk.Scrollbar(
            tree_container,
            bg=self.theme.bg_dark,
            troughcolor=self.theme.bg_main,
            activebackground=self.theme.accent_primary,
            relief=tk.FLAT
        )
        tree_scroll.pack(side=tk.RIGHT, fill=tk.Y)
        
        # Project tree (treeview)
        self.project_tree = ttk.Treeview(tree_container, yscrollcommand=tree_scroll.set)
        self.project_tree.pack(fill=tk.BOTH, expand=True)
        tree_scroll.config(command=self.project_tree.yview)
        
        # Configure columns
        self.project_tree["columns"] = ("type", "modified")
        self.project_tree.heading("#0", text="Name")
        self.project_tree.heading("type", text="Type")
        self.project_tree.heading("modified", text="Modified")
        
        # Bind events
        self.project_tree.bind("<Double-1>", self._on_tree_item_double_click)
        
        # Initialize tree manager
        self.tree_manager = ProjectTreeManager(self.project_tree)
    
    def _on_tree_item_double_click(self, event):
        """Handle double-click on project tree items"""
        item_id = self.project_tree.focus()
        if not item_id:
            return
            
        file_path = self.project_manager.get_project_file(item_id)
        if file_path and os.path.isfile(file_path):
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    content = f.read()
                self._load_file(file_path)
                self.status_var.set(f"FILE LOADED: {os.path.basename(file_path)}")
            except Exception as e:
                self._show_error(f"ERROR OPENING FILE: {str(e)}")
    
    def _setup_chat_panel(self, parent):
        # Create chat panel with cyberpunk styling
        top_frame = tk.Frame(parent, bg=self.theme.bg_light)
        top_frame.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
        
        # Chat header
        chat_header = tk.Label(
            top_frame, 
            text="AI NEURAL INTERFACE", 
            bg=self.theme.bg_dark, 
            fg=self.theme.accent_secondary,
            font=("Courier New", 9, "bold"),
            anchor=tk.W
        )
        chat_header.pack(fill=tk.X, pady=(0, 5))
        
        # Chat history with cyberpunk styling
        self.chat_history_box = tk.Text(
            top_frame, 
            wrap="word", 
            height=15,
            bg=self.theme.bg_dark,
            fg=self.theme.text_normal,
            insertbackground=self.theme.accent_secondary,
            selectbackground=self.theme.accent_tertiary,
            selectforeground=self.theme.text_normal,
            font=("Courier New", 9),
            state="disabled"
        )
        self.chat_history_box.pack(fill=tk.BOTH, expand=True)
        
        # Chat history scrollbar
        chat_scroll = tk.Scrollbar(
            self.chat_history_box,
            command=self.chat_history_box.yview,
            bg=self.theme.bg_dark,
            troughcolor=self.theme.bg_main,
            activebackground=self.theme.accent_secondary,
            relief=tk.FLAT
        )
        chat_scroll.pack(side=tk.RIGHT, fill=tk.Y)
        self.chat_history_box.configure(yscrollcommand=chat_scroll.set)
        
        # Input frame
        input_frame = tk.Frame(parent, bg=self.theme.bg_light)
        input_frame.pack(fill=tk.X, padx=5, pady=5)
        
        # Chat prompt label
        prompt_label = tk.Label(
            input_frame, 
            text="CMD>", 
            bg=self.theme.bg_light, 
            fg=self.theme.accent_secondary,
            font=("Courier New", 10, "bold")
        )
        prompt_label.pack(side=tk.LEFT, padx=(0, 5))
        
        # Chat input with cyberpunk styling
        self.chat_input = tk.Entry(
            input_frame,
            bg=self.theme.bg_dark,
            fg=self.theme.text_normal,
            insertbackground=self.theme.accent_secondary,
            relief=tk.FLAT,
            highlightthickness=1,
            highlightbackground=self.theme.accent_secondary,
            highlightcolor=self.theme.accent_secondary,
            font=("Courier New", 10)
        )
        self.chat_input.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 5))
        self.chat_input.bind("<Return>", lambda evt: self._send_chat_prompt())
        
        # Send button with cyberpunk styling
        send_btn = tk.Button(
            input_frame, 
            text="SEND", 
            command=self._send_chat_prompt,
            bg=self.theme.bg_dark,
            fg=self.theme.accent_secondary,
            activebackground=self.theme.bg_light,
            activeforeground=self.theme.accent_secondary,
            relief=tk.FLAT,
            borderwidth=0,
            padx=10,
            pady=2,
            font=("Courier New", 9, "bold"),
            highlightthickness=1,
            highlightbackground=self.theme.accent_secondary,
            highlightcolor=self.theme.accent_primary
        )
        send_btn.pack(side=tk.LEFT)
    
    def _setup_bindings(self):
        self.root.bind("<Control-n>", lambda e: self._new_file())
        self.root.bind("<Control-o>", lambda e: self._open_file())
        self.root.bind("<Control-s>", lambda e: self._save_file())
        self.root.bind("<Control-Shift-S>", lambda e: self._save_as())
        self.root.bind("<F5>", lambda e: self._analyze_code())
    
    #########################
    # File and Editor Methods
    #########################
    
    def _new_file(self):
        if self._check_unsaved_changes():
            self.editor.delete("1.0", tk.END)
            self.current_file = None
            self.current_language = None
            self.language_var.set("auto")
            self.root.title("ENTERPRISE CODE FACTORY 9000 PRO - UNTITLED")
            self.file_path_var.set("// NEW FILE //")
            self._update_line_numbers()
            self.analysis_display.update_issues([])
            self.status_var.set("NEW FILE INITIALIZED")
    
    def _open_file(self):
        if not self._check_unsaved_changes():
            return
        file_path = filedialog.askopenfilename(
            title="OPEN FILE",
            filetypes=[("All Code Files", "*.py;*.js;*.java;*.ts;*.cpp;*.cs;*.go;*.rb"),
                       ("Python Files", "*.py"),
                       ("JavaScript Files", "*.js"),
                       ("TypeScript Files", "*.ts"),
                       ("Java Files", "*.java"),
                       ("C++ Files", "*.cpp;*.cc;*.h;*.hpp"),
                       ("C# Files", "*.cs"),
                       ("All Files", "*.*")]
        )
        if file_path:
            self._load_file(file_path)
    
    def _load_file(self, file_path):
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            self.editor.delete("1.0", tk.END)
            self.editor.insert("1.0", content)
            self.current_file = file_path
            self.current_language = self._get_language_from_file(file_path)
            if self.current_language != Language.UNKNOWN:
                self.language_var.set(self.current_language.value)
            else:
                self.language_var.set("auto")
            self.root.title(f"ENTERPRISE CODE FACTORY 9000 PRO - {os.path.basename(file_path)}")
            self.file_path_var.set(f"// {os.path.basename(file_path)} //")
            self._update_line_numbers()
            self.analysis_display.update_issues([])
            self.status_var.set(f"FILE LOADED: {os.path.basename(file_path)}")
            self.root.after(500, self._analyze_code)
        except Exception as e:
            self._show_error(f"ERROR LOADING FILE: {str(e)}")
    
    def _save_file(self):
        if not self.current_file:
            return self._save_as()
        try:
            content = self.editor.get("1.0", "end-1c")
            with open(self.current_file, 'w', encoding='utf-8') as f:
                f.write(content)
            self.root.title(f"ENTERPRISE CODE FACTORY 9000 PRO - {os.path.basename(self.current_file)}")
            self.file_path_var.set(f"// {os.path.basename(self.current_file)} //")
            self.status_var.set(f"FILE SAVED: {os.path.basename(self.current_file)}")
            return True
        except Exception as e:
            self._show_error(f"ERROR SAVING FILE: {str(e)}")
            return False
    
    def _save_as(self):
        file_path = filedialog.asksaveasfilename(
            title="SAVE FILE AS",
            defaultextension=".py",
            filetypes=[("Python Files", "*.py"), ("JavaScript Files", "*.js"),
                       ("TypeScript Files", "*.ts"), ("Java Files", "*.java"),
                       ("C++ Files", "*.cpp"), ("C# Files", "*.cs"), ("All Files", "*.*")]
        )
        if not file_path:
            return False
        self.current_file = file_path
        self.current_language = self._get_language_from_file(file_path)
        if self.current_language != Language.UNKNOWN:
            self.language_var.set(self.current_language.value)
        return self._save_file()
    
    def _check_unsaved_changes(self):
        if "* " in self.root.title():
            response = messagebox.askyesnocancel("UNSAVED CHANGES", "There are unsaved changes. Do you want to save them?")
            if response is None:
                return False
            elif response:
                if not self._save_file():
                    return False
        return True
    
    def _get_language_from_file(self, file_path):
        ext = os.path.splitext(file_path)[1].lower()
        return Language.from_file_extension(ext)
    
    def _detect_language_from_content(self):
        content = self.editor.get("1.0", tk.END)
        return Language.from_code_content(content)
    
    def _update_line_numbers(self, event=None):
        if event:
            self.editor.edit_modified(False)
        line_count = int(self.editor.index('end-1c').split('.')[0])
        self.line_numbers.config(state='normal')
        self.line_numbers.delete('1.0', tk.END)
        for i in range(1, line_count + 1):
            self.line_numbers.insert(tk.END, f"{i}\n")
        self.line_numbers.config(state='disabled')
    
    def _on_key_release(self, event=None):
        if self.current_file:
            title = f"ENTERPRISE CODE FACTORY 9000 PRO - {os.path.basename(self.current_file)} *"
            self.root.title(title)
            # Add cyberpunk "modified" indicator
            if "*" not in self.file_path_var.get():
                self.file_path_var.set(f"// {os.path.basename(self.current_file)} * //")
    
    def _on_editor_scroll(self, event=None):
        self.line_numbers.yview_moveto(self.editor.yview()[0])
    
    # The rest of the methods remain functionally the same, but with cyberpunk styled
    # UI elements and text. The methods are not included to keep this response concise.

# Import statement at the top for the animation
import math
import random

def main():
    try:
        root = tk.Tk()
        app = EnterpriseCodeFactoryApp(root)
        root.mainloop()
    except Exception as e:
        logging.critical(f"Application error: {e}", exc_info=True)
        try:
            messagebox.showerror("CRITICAL ERROR", f"A critical error has occurred:\n\n{str(e)}\n\nCheck the log file for details.")
        except:
            pass

if __name__ == "__main__":
    main()
