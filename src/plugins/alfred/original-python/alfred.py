#!/usr/bin/env python3
"""
ALFRED - AI-Linked Framework for Rapid Engineering Development
Clean, lean project creation with linked AI chats
"""

import os
import json
from datetime import datetime
from pathlib import Path
import threading
import requests
from typing import Dict, List, Optional, Tuple
import hashlib
from dataclasses import dataclass, field, asdict
from collections import defaultdict
from code_extractor import CodeExtractor, CodeFileManager, CodeBlock, generate_diff
from project_structure import ProjectStructureManager
from alfred_logger import get_logger
from alfred_constants import (
    DEFAULT_WINDOW_SIZE, DEFAULT_WINDOW_TITLE, 
    CHAT_DISPLAY_HEIGHT, CHAT_DISPLAY_FONT, INPUT_TEXT_HEIGHT, INPUT_TEXT_FONT,
    CONNECTION_CHECK_INTERVAL_MS, STRUCTURE_REFRESH_INTERVAL_MS, UI_UPDATE_DELAY_MS,
    CONNECTION_STATUS, COLORS, MAX_CHAT_HISTORY, OLLAMA_TIMEOUT_DEFAULT,
    ERROR_MESSAGES, SUCCESS_MESSAGES, SHORTCUTS
)
from alfred_exceptions import (
    OllamaConnectionError, OllamaTimeoutError, OllamaModelError,
    ProjectError, ProjectLoadError, FileOperationError,
    ChatSessionError, ContextFileError, retry_on_error
)

try:
    import tkinter as tk
    from tkinter import ttk, scrolledtext, messagebox, filedialog
    from tkinter import simpledialog
    TKINTER_AVAILABLE = True
except ImportError:
    TKINTER_AVAILABLE = False
    print("Warning: tkinter not available. Install python3-tk package.")
    print("On Ubuntu/Debian: sudo apt-get install python3-tk")
    print("On Fedora: sudo dnf install python3-tkinter")
    print("On macOS: tkinter should be included with Python")


@dataclass
class ChatMessage:
    role: str
    content: str
    timestamp: datetime = field(default_factory=datetime.now)
    
    def to_dict(self):
        return {
            "role": self.role,
            "content": self.content,
            "timestamp": self.timestamp.isoformat()
        }


@dataclass
class ChatSession:
    id: str
    name: str
    messages: List[ChatMessage] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.now)
    context_files: List[str] = field(default_factory=list)
    
    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "messages": [msg.to_dict() for msg in self.messages],
            "created_at": self.created_at.isoformat(),
            "context_files": self.context_files
        }


@dataclass
class Project:
    name: str
    path: str
    created_at: datetime = field(default_factory=datetime.now)
    chat_sessions: Dict[str, ChatSession] = field(default_factory=dict)
    active_session_id: Optional[str] = None
    project_type: Optional[str] = None
    
    def to_dict(self):
        return {
            "name": self.name,
            "path": self.path,
            "created_at": self.created_at.isoformat(),
            "chat_sessions": {k: v.to_dict() for k, v in self.chat_sessions.items()},
            "active_session_id": self.active_session_id,
            "project_type": self.project_type
        }


class OllamaClient:
    """Simplified Ollama client for DeepSeekCoder"""
    
    def __init__(self, base_url: str = "http://localhost:11434", timeout: int = 600):
        self.base_url = base_url
        self.timeout = timeout  # Default 10 minutes
        self.logger = get_logger()
        
    def generate(self, prompt: str, model: str = "deepseek-coder:latest", 
                 context: Optional[List[str]] = None) -> str:
        """Generate response from model with detailed logging"""
        # Start logging
        request_id = self.logger.log_request_start(
            request_type="generate",
            model=model,
            prompt_preview=prompt,
            context_files=context
        )
        
        start_time = datetime.now()
        
        try:
            # Log context processing
            self.logger.log_request_progress(request_id, "CONTEXT_PROCESSING", {
                "has_context": context is not None,
                "context_files_count": len(context) if context else 0
            })
            
            # Add context files to prompt if provided
            if context:
                context_content = "\n\n".join([
                    f"=== File: {file} ===\n{self._read_file(file)}"
                    for file in context if os.path.exists(file)
                ])
                if context_content:
                    prompt = f"Context files:\n{context_content}\n\nUser request:\n{prompt}"
                    self.logger.log_request_progress(request_id, "CONTEXT_ADDED", {
                        "context_length": len(context_content),
                        "total_prompt_length": len(prompt)
                    })
            
            # Log API call
            self.logger.log_request_progress(request_id, "API_CALL_START", {
                "url": f"{self.base_url}/api/generate",
                "model": model,
                "timeout": self.timeout,
                "prompt_length": len(prompt)
            })
            
            response = requests.post(
                f"{self.base_url}/api/generate",
                json={
                    "model": model,
                    "prompt": prompt,
                    "stream": False,
                    "options": {
                        "temperature": 0.7,
                        "top_p": 0.9,
                    }
                },
                timeout=self.timeout
            )
            
            # Log response received
            duration = (datetime.now() - start_time).total_seconds()
            self.logger.log_request_progress(request_id, "API_RESPONSE_RECEIVED", {
                "status_code": response.status_code,
                "response_time_seconds": duration
            })
            
            if response.status_code == 200:
                result = response.json().get("response", "")
                self.logger.log_request_end(
                    request_id=request_id,
                    success=True,
                    response_preview=result,
                    duration=duration
                )
                return result
            else:
                error_msg = f"Error: {response.status_code} - {response.text}"
                self.logger.log_request_end(
                    request_id=request_id,
                    success=False,
                    error=error_msg,
                    duration=duration
                )
                return error_msg
                
        except requests.exceptions.ConnectionError as e:
            duration = (datetime.now() - start_time).total_seconds()
            error_msg = f"Cannot connect to Ollama at {self.base_url}"
            self.logger.log_error("Connection error", error=e, data={
                "request_id": request_id,
                "url": self.base_url
            })
            self.logger.log_request_end(
                request_id=request_id,
                success=False,
                error=error_msg,
                duration=duration
            )
            raise OllamaConnectionError(error_msg) from e
            
        except requests.exceptions.ReadTimeout as e:
            duration = (datetime.now() - start_time).total_seconds()
            error_msg = f"Request timed out after {self.timeout}s"
            self.logger.log_error("Request timeout", error=e, data={
                "request_id": request_id,
                "timeout": self.timeout,
                "duration": duration
            })
            self.logger.log_request_end(
                request_id=request_id,
                success=False,
                error=error_msg,
                duration=duration
            )
            raise OllamaTimeoutError(error_msg) from e
            
        except Exception as e:
            duration = (datetime.now() - start_time).total_seconds()
            error_msg = f"Error: {str(e)}"
            self.logger.log_error("Unexpected error during generation", error=e, data={
                "request_id": request_id
            })
            self.logger.log_request_end(
                request_id=request_id,
                success=False,
                error=error_msg,
                duration=duration
            )
            return error_msg
    
    def _read_file(self, filepath: str) -> str:
        """Read file content with error handling"""
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                return f.read()
        except Exception as e:
            return f"Error reading file: {str(e)}"
    
    def list_models(self) -> List[str]:
        """List available models"""
        try:
            response = requests.get(f"{self.base_url}/api/tags")
            if response.status_code == 200:
                models = response.json().get("models", [])
                return [model["name"] for model in models]
            return []
        except:
            return []


class AlfredApp:
    """ALFRED - Your AI butler for software development"""
    
    def __init__(self, root):
        self.root = root
        self.root.title(DEFAULT_WINDOW_TITLE)
        self.root.geometry(DEFAULT_WINDOW_SIZE)
        
        # Set application icon
        try:
            icon_path = Path(__file__).parent / "ALFRED.png"
            if icon_path.exists():
                # For Linux/Unix
                img = tk.PhotoImage(file=str(icon_path))
                self.root.iconphoto(True, img)
        except Exception as e:
            print(f"Could not load icon: {e}")
        
        # Initialize
        self.ollama_client = OllamaClient(timeout=OLLAMA_TIMEOUT_DEFAULT)
        self.current_project: Optional[Project] = None
        self.projects_dir = Path.home() / ".alfred" / "projects"
        self.projects_dir.mkdir(parents=True, exist_ok=True)
        
        # Initialize code extractor
        self.code_extractor = CodeExtractor()
        self.code_blocks: List[Tuple[CodeBlock, tk.Frame]] = []  # Track code blocks and their frames
        self.structure_manager: Optional[ProjectStructureManager] = None
        
        # Initialize logger
        self.logger = get_logger()
        self.logger.log_info("ALFRED started", {"version": "1.0"})
        
        # Initialize thread-safe UI update queue
        from ui_update_queue import create_ui_updater
        self.ui_queue, self.safe_ui = create_ui_updater(self.root)
        
        # Initialize project tree cache
        from project_tree_cache import create_tree_cache
        self.tree_cache = create_tree_cache()
        
        # UI Style
        self.setup_style()
        
        # Build UI
        self.build_ui()
        
        # Load last project if exists
        self.load_last_project()
        
        # Check for Smalltalk overlay
        self.smalltalk_overlay = None
        self.check_smalltalk_overlay()
        
        # Initialize command palette
        self.init_command_palette()
        
        # Set up cleanup on window close
        self.root.protocol("WM_DELETE_WINDOW", self.on_close)
        
    def on_close(self):
        """Clean up before closing"""
        try:
            # Stop UI update queue
            if hasattr(self, 'ui_queue'):
                self.ui_queue.stop()
            
            # Stop tree cache
            if hasattr(self, 'tree_cache'):
                self.tree_cache.stop()
            
            # Log shutdown
            if hasattr(self, 'logger'):
                self.logger.log_info("ALFRED shutting down", {
                    "ui_stats": self.ui_queue.get_stats() if hasattr(self, 'ui_queue') else None,
                    "cache_stats": self.tree_cache.get_stats() if hasattr(self, 'tree_cache') else None
                })
        except Exception as e:
            print(f"Error during cleanup: {e}")
        finally:
            self.root.destroy()
    
    def init_command_palette(self):
        """Initialize the command palette"""
        try:
            from alfred_command_palette import add_command_palette
            self.command_palette = add_command_palette(self)
            self.logger.log_info("Command palette initialized", {
                "shortcuts": "Ctrl+Shift+P"
            })
        except Exception as e:
            self.logger.log_error("Failed to initialize command palette", error=e)
    
    def check_smalltalk_overlay(self):
        """Check if Smalltalk overlay should be loaded"""
        if self.current_project and self.structure_manager:
            if self.structure_manager.structure.type == 'smalltalk':
                # Load Smalltalk overlay
                try:
                    from alfred_st_overlay import AlfredSTOverlay
                    self.smalltalk_overlay = AlfredSTOverlay(self)
                    self.logger.log_info("Smalltalk overlay activated", {
                        "project": self.current_project.name,
                        "project_type": "smalltalk"
                    })
                except Exception as e:
                    self.logger.log_error("Failed to load Smalltalk overlay", error=e)
        
    def setup_style(self):
        """Simple, clean styling"""
        style = ttk.Style()
        style.theme_use('clam')
        
        # Use constants for colors
        self.colors = COLORS
        
        self.root.configure(bg=self.colors['bg'])
        
    def build_ui(self):
        """Build the main UI"""
        # Top toolbar
        self.toolbar = ttk.Frame(self.root)
        self.toolbar.pack(fill='x', padx=5, pady=5)
        
        ttk.Button(self.toolbar, text="New Project", command=self.new_project).pack(side='left', padx=2)
        ttk.Button(self.toolbar, text="Open Project", command=self.open_project).pack(side='left', padx=2)
        ttk.Button(self.toolbar, text="About", command=self.show_about).pack(side='left', padx=2)
        
        # Connection test button
        ttk.Button(self.toolbar, text="Test Connection", command=self.check_connection).pack(side='left', padx=(10, 2))
        
        # Log viewer button
        ttk.Button(self.toolbar, text="View Logs", command=self.show_log_viewer).pack(side='left', padx=2)
        
        # Model selector
        ttk.Label(self.toolbar, text="Model:").pack(side='left', padx=(20, 5))
        self.model_var = tk.StringVar(value="deepseek-coder:latest")
        self.model_combo = ttk.Combobox(self.toolbar, textvariable=self.model_var, width=30)
        self.model_combo.pack(side='left', padx=2)
        self.refresh_models()
        
        ttk.Button(self.toolbar, text="Refresh Models", command=self.refresh_models).pack(side='left', padx=2)
        
        # Main content
        main_frame = ttk.Frame(self.root)
        main_frame.pack(fill='both', expand=True, padx=5, pady=5)
        
        # Left panel - Project & Chats
        left_panel = ttk.Frame(main_frame, width=300)
        left_panel.pack(side='left', fill='y', padx=(0, 5))
        left_panel.pack_propagate(False)
        
        # Project info
        project_info_frame = ttk.Frame(left_panel)
        project_info_frame.pack(fill='x', padx=5, pady=5)
        
        self.project_label = ttk.Label(project_info_frame, text="No project loaded", 
                                      font=('Arial', 10, 'bold'))
        self.project_label.pack(anchor='w')
        
        self.project_type_label = ttk.Label(project_info_frame, text="", 
                                          font=('Arial', 9), foreground='#666666')
        self.project_type_label.pack(anchor='w')
        
        # Project structure view
        ttk.Label(left_panel, text="Project Structure:").pack(anchor='w', padx=5, pady=(10, 0))
        
        structure_frame = ttk.Frame(left_panel)
        structure_frame.pack(fill='x', padx=5, pady=5)
        
        self.structure_text = tk.Text(structure_frame, height=8, width=30,
                                    font=('Consolas', 9), state='disabled')
        self.structure_text.pack(side='left', fill='both', expand=True)
        
        structure_scroll = ttk.Scrollbar(structure_frame, command=self.structure_text.yview)
        structure_scroll.pack(side='right', fill='y')
        self.structure_text.config(yscrollcommand=structure_scroll.set)
        
        # Chat sessions
        ttk.Label(left_panel, text="Chat Sessions:").pack(anchor='w', padx=5)
        
        sessions_frame = ttk.Frame(left_panel)
        sessions_frame.pack(fill='both', expand=True, padx=5, pady=5)
        
        self.sessions_listbox = tk.Listbox(sessions_frame, height=10)
        self.sessions_listbox.pack(side='left', fill='both', expand=True)
        self.sessions_listbox.bind('<<ListboxSelect>>', self.on_session_select)
        
        sessions_scroll = ttk.Scrollbar(sessions_frame, command=self.sessions_listbox.yview)
        sessions_scroll.pack(side='right', fill='y')
        self.sessions_listbox.config(yscrollcommand=sessions_scroll.set)
        
        # Session buttons
        session_buttons = ttk.Frame(left_panel)
        session_buttons.pack(fill='x', padx=5, pady=5)
        
        ttk.Button(session_buttons, text="New Chat", command=self.new_chat).pack(side='left', padx=2)
        ttk.Button(session_buttons, text="Delete", command=self.delete_chat).pack(side='left', padx=2)
        
        # Context files
        ttk.Label(left_panel, text="Context Files:").pack(anchor='w', padx=5, pady=(10, 0))
        
        context_frame = ttk.Frame(left_panel)
        context_frame.pack(fill='x', padx=5, pady=5)
        
        self.context_listbox = tk.Listbox(context_frame, height=5)
        self.context_listbox.pack(side='left', fill='both', expand=True)
        
        context_buttons = ttk.Frame(context_frame)
        context_buttons.pack(side='right', fill='y', padx=(5, 0))
        
        ttk.Button(context_buttons, text="+", width=3, command=self.add_context_file).pack(pady=2)
        ttk.Button(context_buttons, text="-", width=3, command=self.remove_context_file).pack(pady=2)
        
        # Right panel - Chat
        self.right_panel = ttk.Frame(main_frame)
        self.right_panel.pack(side='right', fill='both', expand=True)
        
        # Chat display
        self.chat_display = scrolledtext.ScrolledText(
            self.right_panel, 
            wrap='word',
            height=CHAT_DISPLAY_HEIGHT,
            font=CHAT_DISPLAY_FONT
        )
        self.chat_display.pack(fill='both', expand=True, pady=(0, 5))
        
        # Configure tags for formatting
        self.chat_display.tag_config('user', foreground=COLORS['user_message'], 
                                   font=(CHAT_DISPLAY_FONT[0], CHAT_DISPLAY_FONT[1], 'bold'))
        self.chat_display.tag_config('assistant', foreground=COLORS['assistant_message'], 
                                   font=(CHAT_DISPLAY_FONT[0], CHAT_DISPLAY_FONT[1], 'bold'))
        self.chat_display.tag_config('code', background='#f0f0f0', 
                                   font=(CHAT_DISPLAY_FONT[0], CHAT_DISPLAY_FONT[1] - 1))
        
        # Input area
        input_frame = ttk.Frame(self.right_panel)
        input_frame.pack(fill='x')
        
        self.input_text = scrolledtext.ScrolledText(
            input_frame,
            wrap='word',
            height=INPUT_TEXT_HEIGHT,
            font=INPUT_TEXT_FONT
        )
        self.input_text.pack(side='left', fill='both', expand=True, padx=(0, 5))
        
        send_button = ttk.Button(input_frame, text="Send\n(Ctrl+Enter)", 
                                command=self.send_message, width=12)
        send_button.pack(side='right', fill='y')
        
        # Bind keyboard shortcuts
        self.input_text.bind('<Control-Return>', lambda e: self.send_message())
        
        # Status bar with connection indicator
        status_frame = ttk.Frame(self.root)
        status_frame.pack(side='bottom', fill='x')
        
        # Connection status
        self.connection_var = tk.StringVar(value=CONNECTION_STATUS['disconnected'])
        self.connection_label = ttk.Label(status_frame, textvariable=self.connection_var, 
                                        relief='sunken', width=20)
        self.connection_label.pack(side='left', padx=2)
        
        # Processing status
        self.processing_var = tk.StringVar(value="")
        self.processing_label = ttk.Label(status_frame, textvariable=self.processing_var,
                                        relief='sunken', width=30)
        self.processing_label.pack(side='left', padx=2, fill='x', expand=True)
        
        # General status
        self.status_var = tk.StringVar(value="Ready")
        status_bar = ttk.Label(status_frame, textvariable=self.status_var, relief='sunken')
        status_bar.pack(side='right', fill='x', expand=True)
        
        # Check connection on startup
        self.check_connection()
        
        # Periodic connection check every 30 seconds
        self.periodic_check()
        
        # Periodic structure refresh
        self.periodic_structure_refresh()
        
    def new_project(self):
        """Create a new project"""
        dialog = tk.Toplevel(self.root)
        dialog.title("New Project")
        dialog.geometry("400x200")
        
        ttk.Label(dialog, text="Project Name:").pack(pady=10)
        name_entry = ttk.Entry(dialog, width=40)
        name_entry.pack(pady=5)
        
        ttk.Label(dialog, text="Project Path:").pack(pady=10)
        
        path_frame = ttk.Frame(dialog)
        path_frame.pack(pady=5)
        
        path_var = tk.StringVar()
        path_entry = ttk.Entry(path_frame, textvariable=path_var, width=30)
        path_entry.pack(side='left', padx=(0, 5))
        
        def browse():
            folder = filedialog.askdirectory()
            if folder:
                path_var.set(folder)
        
        ttk.Button(path_frame, text="Browse", command=browse).pack(side='left')
        
        def create():
            name = name_entry.get().strip()
            path = path_var.get().strip()
            
            if not name or not path:
                messagebox.showerror("Error", "Please provide both name and path")
                return
            
            try:
                # Create project directory if it doesn't exist
                project_path = Path(path)
                if not project_path.exists():
                    project_path.mkdir(parents=True, exist_ok=True)
                
                # Create project
                self.current_project = Project(name=name, path=path)
                
                # Initialize structure manager with tree cache
                self.structure_manager = ProjectStructureManager(path, self.tree_cache)
                self.current_project.project_type = self.structure_manager.structure.type
                
                # Ask if user wants to create initial structure
                if self.structure_manager.structure.type != 'generic':
                    if messagebox.askyesno("Project Structure", 
                                         f"Detected {self.structure_manager.structure.type} project.\n"
                                         f"Create standard directory structure?"):
                        self.structure_manager.create_initial_structure()
                
                # Create initial chat
                session_id = self._generate_id()
                session = ChatSession(id=session_id, name="Main Chat")
                self.current_project.chat_sessions[session_id] = session
                self.current_project.active_session_id = session_id
                
                # Save project
                self.save_project()
                
                # Update UI
                self.update_project_display()
                self.refresh_sessions()
                
                # Check for Smalltalk overlay
                self.check_smalltalk_overlay()
                
                dialog.destroy()
                self.status_var.set(f"Created project: {name}")
                
            except Exception as e:
                messagebox.showerror("Error", f"Failed to create project: {str(e)}")
                self.status_var.set(f"Error: {str(e)}")
        
        ttk.Button(dialog, text="Create", command=create).pack(pady=20)
        
    def open_project(self):
        """Open existing project"""
        # List available projects
        project_files = list(self.projects_dir.glob("*.json"))
        
        if not project_files:
            messagebox.showinfo("No Projects", "No saved projects found")
            return
        
        dialog = tk.Toplevel(self.root)
        dialog.title("Open Project")
        dialog.geometry("400x300")
        
        ttk.Label(dialog, text="Select Project:").pack(pady=10)
        
        listbox = tk.Listbox(dialog, height=10)
        listbox.pack(fill='both', expand=True, padx=20, pady=10)
        
        for pf in project_files:
            listbox.insert('end', pf.stem)
        
        def open_selected():
            selection = listbox.curselection()
            if not selection:
                return
            
            project_name = listbox.get(selection[0])
            self.load_project(project_name)
            dialog.destroy()
        
        ttk.Button(dialog, text="Open", command=open_selected).pack(pady=10)
        
    def new_chat(self):
        """Create new chat session"""
        if not self.current_project:
            messagebox.showinfo("No Project", "Please create or open a project first")
            return
        
        name = tk.simpledialog.askstring("New Chat", "Chat name:")
        if not name:
            return
        
        session_id = self._generate_id()
        session = ChatSession(id=session_id, name=name)
        self.current_project.chat_sessions[session_id] = session
        self.current_project.active_session_id = session_id
        
        self.save_project()
        self.refresh_sessions()
        self.clear_chat_display()
        
    def delete_chat(self):
        """Delete selected chat session"""
        selection = self.sessions_listbox.curselection()
        if not selection or not self.current_project:
            return
        
        session_name = self.sessions_listbox.get(selection[0])
        
        # Find session by name
        session_id = None
        for sid, session in self.current_project.chat_sessions.items():
            if session.name == session_name:
                session_id = sid
                break
        
        if session_id and messagebox.askyesno("Delete Chat", f"Delete '{session_name}'?"):
            del self.current_project.chat_sessions[session_id]
            
            # Select another session if this was active
            if self.current_project.active_session_id == session_id:
                if self.current_project.chat_sessions:
                    self.current_project.active_session_id = list(self.current_project.chat_sessions.keys())[0]
                else:
                    self.current_project.active_session_id = None
            
            self.save_project()
            self.refresh_sessions()
            self.refresh_chat_display()
    
    def add_context_file(self):
        """Add file to context"""
        if not self.current_project or not self.current_project.active_session_id:
            return
        
        filename = filedialog.askopenfilename(
            initialdir=self.current_project.path,
            title="Select context file"
        )
        
        if filename:
            from alfred_security_fixes import validate_path, safe_file_read, SecurityError
            from alfred_constants import MAX_CONTEXT_FILE_SIZE
            
            try:
                # Validate the file is within project directory or a safe location
                file_path = Path(filename)
                
                # Check file size first
                if file_path.stat().st_size > MAX_CONTEXT_FILE_SIZE:
                    messagebox.showerror("File Too Large", 
                        f"File exceeds maximum size of {MAX_CONTEXT_FILE_SIZE // (1024*1024)}MB")
                    return
                
                # For now, just warn if file is outside project directory
                try:
                    validate_path(filename, self.current_project.path)
                except SecurityError:
                    if not messagebox.askyesno("Security Warning", 
                        "This file is outside the project directory. Continue?"):
                        return
                
                session = self.current_project.chat_sessions[self.current_project.active_session_id]
                if filename not in session.context_files:
                    session.context_files.append(filename)
                    self.save_project()
                    self.refresh_context_files()
                    
            except Exception as e:
                messagebox.showerror("Error", f"Failed to add file: {str(e)}")
    
    def remove_context_file(self):
        """Remove selected context file"""
        selection = self.context_listbox.curselection()
        if not selection or not self.current_project or not self.current_project.active_session_id:
            return
        
        session = self.current_project.chat_sessions[self.current_project.active_session_id]
        del session.context_files[selection[0]]
        self.save_project()
        self.refresh_context_files()
    
    def send_message(self):
        """Send message to AI"""
        if not self.current_project or not self.current_project.active_session_id:
            messagebox.showinfo("No Chat", "Please create a chat session first")
            return
        
        message = self.input_text.get("1.0", "end-1c").strip()
        if not message:
            return
        
        # Log user message
        self.logger.log_info("User message sent", {
            "project": self.current_project.name,
            "session": self.current_project.active_session_id,
            "message_preview": message[:100]
        })
        
        # Clear input
        self.input_text.delete("1.0", "end")
        
        # Get current session
        session = self.current_project.chat_sessions[self.current_project.active_session_id]
        
        # Add user message
        user_msg = ChatMessage(role="user", content=message)
        session.messages.append(user_msg)
        
        # Update display
        self.append_message(user_msg)
        
        # Get AI response in thread
        self.status_var.set("Sending message...")
        self.processing_var.set(f"Processing: {message[:50]}{'...' if len(message) > 50 else ''}")
        threading.Thread(target=self._get_ai_response, args=(message, session), daemon=True).start()
    
    def _get_ai_response(self, message: str, session: ChatSession):
        """Get AI response in background"""
        try:
            # Update status
            self.safe_ui.update(self.processing_var.set, "Building conversation context...")
            
            # Build conversation history
            history = "\n\n".join([
                f"{msg.role.upper()}: {msg.content}"
                for msg in session.messages[-10:]  # Last 10 messages for context
            ])
            
            # Check if we have context files
            if session.context_files:
                self.safe_ui.update(self.processing_var.set, f"Loading {len(session.context_files)} context files...")
            
            # Update status before API call
            self.safe_ui.update(self.processing_var.set, f"Waiting for {self.model_var.get()}...")
            self.safe_ui.update(self.status_var.set, "AI is thinking...")
            
            # Generate response
            start_time = datetime.now()
            try:
                response = self.ollama_client.generate(
                    prompt=history,
                    model=self.model_var.get(),
                    context=session.context_files
                )
                elapsed = (datetime.now() - start_time).total_seconds()
            except OllamaConnectionError:
                self.safe_ui.update_now(self.connection_var.set, CONNECTION_STATUS['disconnected'])
                self.safe_ui.update_now(self.processing_var.set, "Cannot connect to Ollama")
                self.safe_ui.update_now(self.status_var.set, ERROR_MESSAGES['no_ollama'])
                self.root.after(5000, lambda: self.safe_ui.update(self.processing_var.set, ""))
                return
            except OllamaTimeoutError:
                self.safe_ui.update_now(self.connection_var.set, CONNECTION_STATUS['error'])
                self.safe_ui.update_now(self.processing_var.set, "Request timed out")
                self.safe_ui.update_now(self.status_var.set, "Try a shorter prompt")
                self.root.after(5000, lambda: self.safe_ui.update(self.processing_var.set, ""))
                return
            
            # Check for errors in response (backward compatibility)
            if response.startswith("Error:"):
                self.safe_ui.update_now(self.connection_var.set, CONNECTION_STATUS['error'])
                self.safe_ui.update_now(self.processing_var.set, response[:50])
                self.safe_ui.update_now(self.status_var.set, "Response failed")
                self.root.after(5000, lambda: self.safe_ui.update(self.processing_var.set, ""))
                return
            
            # Add assistant message
            assistant_msg = ChatMessage(role="assistant", content=response)
            session.messages.append(assistant_msg)
            
            # Update UI in main thread
            self.safe_ui.update(self.append_message, assistant_msg)
            self.safe_ui.update(self.processing_var.set, f"Response received in {elapsed:.1f}s")
            self.safe_ui.update(self.status_var.set, "Ready")
            self.safe_ui.update(self.save_project)
            
            # Clear processing message after 3 seconds
            self.root.after(3000, lambda: self.safe_ui.update(self.processing_var.set, ""))
            
        except Exception as e:
            error_msg = str(e)
            self.safe_ui.update_now(self.connection_var.set, CONNECTION_STATUS['error'])
            self.safe_ui.update_now(self.processing_var.set, f"Error: {error_msg[:50]}")
            self.safe_ui.update_now(self.status_var.set, "Failed to get response")
            # Clear processing message after 5 seconds
            self.root.after(5000, lambda: self.safe_ui.update(self.processing_var.set, ""))
    
    def append_message(self, message: ChatMessage):
        """Append message to chat display with code block detection"""
        self.chat_display.insert('end', f"\n{message.role.upper()}: ", message.role)
        
        if message.role == "assistant":
            # Extract code blocks
            code_blocks = self.code_extractor.extract_code_blocks(message.content)
            
            if code_blocks:
                # Process content with code blocks
                last_pos = 0
                content = message.content
                
                for match in self.code_extractor.CODE_BLOCK_PATTERN.finditer(content):
                    # Insert text before code block
                    before_text = content[last_pos:match.start()]
                    if before_text:
                        self.chat_display.insert('end', before_text)
                    
                    # Get the code block
                    language = match.group(1) or 'text'
                    code_content = match.group(2).strip()
                    
                    # Find corresponding CodeBlock object
                    code_block = None
                    for cb in code_blocks:
                        if cb.content == code_content:
                            code_block = cb
                            break
                    
                    if code_block:
                        # Create code block frame
                        self._insert_code_block(code_block)
                    
                    last_pos = match.end()
                
                # Insert remaining text
                remaining = content[last_pos:]
                if remaining:
                    self.chat_display.insert('end', remaining)
            else:
                # No code blocks, insert as plain text
                self.chat_display.insert('end', message.content)
        else:
            # User message, insert as plain text
            self.chat_display.insert('end', message.content)
        
        self.chat_display.insert('end', "\n")
        self.chat_display.see('end')
    
    def on_session_select(self, event):
        """Handle session selection"""
        selection = self.sessions_listbox.curselection()
        if not selection or not self.current_project:
            return
        
        session_name = self.sessions_listbox.get(selection[0])
        
        # Find and activate session
        for sid, session in self.current_project.chat_sessions.items():
            if session.name == session_name:
                self.current_project.active_session_id = sid
                self.save_project()
                self.refresh_chat_display()
                self.refresh_context_files()
                break
    
    def refresh_sessions(self):
        """Refresh sessions list"""
        self.sessions_listbox.delete(0, 'end')
        
        if self.current_project:
            for session in self.current_project.chat_sessions.values():
                self.sessions_listbox.insert('end', session.name)
            
            # Select active session
            if self.current_project.active_session_id:
                for i, (sid, session) in enumerate(self.current_project.chat_sessions.items()):
                    if sid == self.current_project.active_session_id:
                        self.sessions_listbox.selection_set(i)
                        break
    
    def refresh_context_files(self):
        """Refresh context files list"""
        self.context_listbox.delete(0, 'end')
        
        if self.current_project and self.current_project.active_session_id:
            session = self.current_project.chat_sessions[self.current_project.active_session_id]
            for file in session.context_files:
                # Show relative path if within project
                try:
                    rel_path = os.path.relpath(file, self.current_project.path)
                    self.context_listbox.insert('end', rel_path)
                except:
                    self.context_listbox.insert('end', os.path.basename(file))
    
    def refresh_chat_display(self):
        """Refresh chat display with current session"""
        self.clear_chat_display()
        
        if self.current_project and self.current_project.active_session_id:
            session = self.current_project.chat_sessions[self.current_project.active_session_id]
            for message in session.messages:
                self.append_message(message)
    
    def clear_chat_display(self):
        """Clear chat display"""
        self.chat_display.delete("1.0", "end")
        self.code_blocks.clear()  # Clear tracked code blocks
    
    def refresh_models(self):
        """Refresh available models with error handling"""
        try:
            models = self.ollama_client.list_models()
            
            # Handle empty model list
            if not models:
                self.model_combo['values'] = ['No models available']
                self.model_var.set('No models available')
                self.connection_var.set(CONNECTION_STATUS['disconnected'])
                self.status_var.set("No models found. Install models with: ollama pull <model>")
                return
            
            # Update combo box with models
            self.model_combo['values'] = models
            
            # Select appropriate model
            current_model = self.model_var.get()
            if current_model in models:
                # Keep current selection if it's still available
                pass
            elif "deepseek-coder:latest" in models:
                self.model_var.set("deepseek-coder:latest")
            elif models:
                self.model_var.set(models[0])
                
        except Exception as e:
            # Handle connection errors gracefully
            self.model_combo['values'] = ['Connection failed']
            self.model_var.set('Connection failed')
            self.connection_var.set(CONNECTION_STATUS['disconnected'])
            self.status_var.set(f"Failed to refresh models: {str(e)[:50]}")
    
    def save_project(self):
        """Save current project"""
        if not self.current_project:
            return
        
        try:
            from alfred_security_fixes import safe_json_save, sanitize_filename
            
            # Ensure projects directory exists
            self.projects_dir.mkdir(parents=True, exist_ok=True)
            
            # Sanitize project name for filename
            safe_name = sanitize_filename(self.current_project.name)
            project_file = self.projects_dir / f"{safe_name}.json"
            
            # Use safe JSON save with atomic write
            if not safe_json_save(self.current_project.to_dict(), project_file):
                raise Exception("Failed to save project file")
            
            # Save last project reference
            last_project_file = self.projects_dir / ".last_project"
            if not safe_json_save({"name": self.current_project.name}, last_project_file):
                # Non-critical, just log
                self.logger.log_warning("Could not save last project reference")
                
            print(f"Project saved to: {project_file}")
            
        except Exception as e:
            error_msg = f"Failed to save project: {str(e)}"
            print(error_msg)
            if hasattr(self, 'status_var'):
                self.status_var.set(error_msg)
            messagebox.showerror("Save Error", error_msg)
    
    def load_project(self, name: str):
        """Load project by name"""
        from alfred_security_fixes import safe_json_load, sanitize_filename
        
        try:
            safe_name = sanitize_filename(name)
            project_file = self.projects_dir / f"{safe_name}.json"
            
            if not project_file.exists():
                # Try with original name if sanitized doesn't exist
                project_file = self.projects_dir / f"{name}.json"
                if not project_file.exists():
                    raise ProjectLoadError(f"Project '{name}' not found")
            
            data = safe_json_load(project_file)
            if not data:
                raise ProjectLoadError(f"Invalid project file: {project_file}")
        
            # Reconstruct project
            self.current_project = Project(
                name=data['name'],
                path=data['path'],
                created_at=datetime.fromisoformat(data['created_at']),
                project_type=data.get('project_type')
            )
        
            # Initialize structure manager with tree cache
            self.structure_manager = ProjectStructureManager(self.current_project.path, self.tree_cache)
        
            # Reconstruct chat sessions
            for sid, sdata in data['chat_sessions'].items():
                session = ChatSession(
                id=sdata['id'],
                name=sdata['name'],
                created_at=datetime.fromisoformat(sdata['created_at']),
                context_files=sdata.get('context_files', [])
            )
                
                # Reconstruct messages
                for mdata in sdata['messages']:
                    msg = ChatMessage(
                        role=mdata['role'],
                        content=mdata['content'],
                        timestamp=datetime.fromisoformat(mdata['timestamp'])
                    )
                    session.messages.append(msg)
                
                self.current_project.chat_sessions[sid] = session
            
            self.current_project.active_session_id = data.get('active_session_id')
            
            # Update UI
            self.update_project_display()
            self.refresh_sessions()
            self.refresh_chat_display()
            self.refresh_context_files()
            self.status_var.set(SUCCESS_MESSAGES['project_loaded'].format(name=name))
            
            # Check for Smalltalk overlay
            self.check_smalltalk_overlay()
            
        except ProjectLoadError as e:
            self.logger.log_error("Failed to load project", error=e)
            messagebox.showerror("Load Error", str(e))
        except Exception as e:
            self.logger.log_error("Unexpected error loading project", error=e)
            messagebox.showerror("Load Error", f"Failed to load project: {str(e)}")
    
    def load_last_project(self):
        """Load the last opened project"""
        from alfred_security_fixes import safe_json_load
        
        try:
            last_project_file = self.projects_dir / ".last_project"
            if last_project_file.exists():
                data = safe_json_load(last_project_file)
                if data and 'name' in data:
                    self.load_project(data['name'])
        except Exception as e:
            # Non-critical error, just log it
            self.logger.log_warning("Could not load last project", {"error": str(e)})
    
    def _generate_id(self) -> str:
        """Generate unique ID"""
        return hashlib.md5(str(datetime.now().timestamp()).encode()).hexdigest()[:8]
    
    def show_about(self):
        """Show about dialog with logo"""
        about = tk.Toplevel(self.root)
        about.title("About ALFRED")
        about.geometry("500x600")
        about.resizable(False, False)
        
        # Center the window
        about.transient(self.root)
        about.grab_set()
        
        # Load and display logo
        try:
            logo_path = Path(__file__).parent / "ALFRED.png"
            if logo_path.exists():
                logo_img = tk.PhotoImage(file=str(logo_path))
                # Resize if too large
                if logo_img.width() > 400:
                    subsample = logo_img.width() // 400 + 1
                    logo_img = logo_img.subsample(subsample, subsample)
                
                logo_label = ttk.Label(about, image=logo_img)
                logo_label.image = logo_img  # Keep a reference
                logo_label.pack(pady=20)
        except Exception as e:
            print(f"Could not load logo: {e}")
        
        # Title
        title_label = ttk.Label(
            about, 
            text="ALFRED",
            font=('Arial', 24, 'bold')
        )
        title_label.pack(pady=10)
        
        # Subtitle
        subtitle_label = ttk.Label(
            about,
            text="AI-Linked Framework for Rapid Engineering Development",
            font=('Arial', 10)
        )
        subtitle_label.pack()
        
        # Quote
        quote_label = ttk.Label(
            about,
            text='"At your service, Master Wayne."',
            font=('Arial', 12, 'italic'),
            foreground='#666666'
        )
        quote_label.pack(pady=20)
        
        # Info
        info_text = """Your AI butler for software development
        
Version 1.0
        
Powered by Ollama
Supporting multiple AI models for
code generation and assistance"""
        
        info_label = ttk.Label(about, text=info_text, justify='center')
        info_label.pack(pady=10)
        
        # Close button
        ttk.Button(about, text="Close", command=about.destroy).pack(pady=20)
    
    def check_connection(self):
        """Check connection to Ollama"""
        self.connection_var.set("🟡 Checking...")
        self.processing_var.set("Testing Ollama connection...")
        
        def check():
            try:
                self.logger.log_connection_status("CHECKING", {
                    "url": self.ollama_client.base_url
                })
                
                response = requests.get(f"{self.ollama_client.base_url}/api/tags", timeout=5)
                if response.status_code == 200:
                    models = response.json().get("models", [])
                    self.safe_ui.update(self.connection_var.set, "🟢 Connected")
                    self.safe_ui.update(self.processing_var.set, f"Found {len(models)} models")
                    self.safe_ui.update(self.status_var.set, "Ollama is running")
                    
                    self.logger.log_connection_status("CONNECTED", {
                        "models_count": len(models),
                        "models": [m["name"] for m in models]
                    })
                    
                    # Auto-clear processing message after 3 seconds
                    self.root.after(3000, lambda: self.safe_ui.update(self.processing_var.set, ""))
                else:
                    self.safe_ui.update_now(self.connection_var.set, CONNECTION_STATUS['error'])
                    self.safe_ui.update_now(self.processing_var.set, f"Status code: {response.status_code}")
                    self.safe_ui.update_now(self.status_var.set, "Connection error")
                    
                    self.logger.log_connection_status("ERROR", {
                        "status_code": response.status_code,
                        "response": response.text[:200]
                    })
                    
            except requests.exceptions.ConnectionError as e:
                self.safe_ui.update_now(self.connection_var.set, "🔴 Disconnected")
                self.safe_ui.update_now(self.processing_var.set, "Cannot reach Ollama")
                self.safe_ui.update_now(self.status_var.set, "Ollama not running")
                
                self.logger.log_connection_status("DISCONNECTED", {
                    "error": str(e)
                })
                
            except Exception as e:
                self.safe_ui.update_now(self.connection_var.set, CONNECTION_STATUS['error'])
                self.safe_ui.update_now(self.processing_var.set, str(e)[:50])
                self.safe_ui.update_now(self.status_var.set, "Connection failed")
                
                self.logger.log_error("Connection check failed", error=e)
        
        # Run in thread
        threading.Thread(target=check, daemon=True).start()
    
    def periodic_check(self):
        """Periodically check connection status"""
        def silent_check():
            try:
                response = requests.get(f"{self.ollama_client.base_url}/api/tags", timeout=5)
                if response.status_code == 200:
                    if self.connection_var.get() != "🟢 Connected":
                        self.safe_ui.update(self.connection_var.set, "🟢 Connected")
                else:
                    if self.connection_var.get() != "🔴 Error":
                        self.safe_ui.update(self.connection_var.set, CONNECTION_STATUS['error'])
            except:
                if self.connection_var.get() != "🔴 Disconnected":
                    self.safe_ui.update(self.connection_var.set, "🔴 Disconnected")
        
        # Run check in background
        threading.Thread(target=silent_check, daemon=True).start()
        
        # Schedule next check
        self.root.after(CONNECTION_CHECK_INTERVAL_MS, self.periodic_check)
    
    def _insert_code_block(self, code_block: CodeBlock):
        """Insert a code block with save functionality into the chat display"""
        # Create frame for code block
        frame = ttk.Frame(self.chat_display, relief='solid', borderwidth=1)
        
        # Header with language and actions
        header = ttk.Frame(frame)
        header.pack(fill='x', padx=5, pady=2)
        
        # Language label
        lang_label = ttk.Label(header, text=f"Language: {code_block.language}", 
                              font=('Consolas', 9, 'bold'))
        lang_label.pack(side='left', padx=5)
        
        # Suggested filename
        if code_block.suggested_filename:
            file_label = ttk.Label(header, text=f"Suggested: {code_block.suggested_filename}",
                                  font=('Consolas', 9))
            file_label.pack(side='left', padx=10)
        
        # Action buttons
        button_frame = ttk.Frame(header)
        button_frame.pack(side='right', padx=5)
        
        # Save button
        save_btn = ttk.Button(button_frame, text="💾 Save", 
                             command=lambda: self.save_code_block(code_block))
        save_btn.pack(side='left', padx=2)
        
        # Copy button
        copy_btn = ttk.Button(button_frame, text="📋 Copy",
                             command=lambda: self.copy_code_block(code_block))
        copy_btn.pack(side='left', padx=2)
        
        # Code display
        code_text = tk.Text(frame, wrap='none', height=min(20, len(code_block.content.split('\n'))),
                           font=('Consolas', 10), background='#f8f8f8')
        code_text.pack(fill='both', expand=True, padx=5, pady=5)
        
        # Add scrollbars
        v_scroll = ttk.Scrollbar(code_text, orient='vertical', command=code_text.yview)
        h_scroll = ttk.Scrollbar(code_text, orient='horizontal', command=code_text.xview)
        code_text.configure(yscrollcommand=v_scroll.set, xscrollcommand=h_scroll.set)
        
        # Insert code with syntax highlighting (basic)
        code_text.insert('1.0', code_block.content)
        code_text.configure(state='disabled')  # Make read-only
        
        # Configure basic syntax highlighting
        self._apply_basic_highlighting(code_text, code_block.language)
        
        # Insert frame into chat display
        self.chat_display.window_create('end', window=frame)
        self.chat_display.insert('end', '\n')
        
        # Track this code block
        self.code_blocks.append((code_block, frame))
    
    def _apply_basic_highlighting(self, text_widget, language: str):
        """Apply basic syntax highlighting to code"""
        # Define some basic colors
        text_widget.tag_configure('keyword', foreground='#0000FF')
        text_widget.tag_configure('string', foreground='#008000')
        text_widget.tag_configure('comment', foreground='#808080')
        text_widget.tag_configure('number', foreground='#FF4500')
        
        content = text_widget.get('1.0', 'end-1c')
        
        # Basic keyword highlighting for Python
        if language.lower() == 'python':
            keywords = ['def', 'class', 'import', 'from', 'if', 'else', 'elif', 
                       'for', 'while', 'return', 'try', 'except', 'with', 'as',
                       'lambda', 'yield', 'None', 'True', 'False', 'and', 'or', 'not']
            
            for keyword in keywords:
                start = '1.0'
                while True:
                    pos = text_widget.search(rf'\b{keyword}\b', start, 'end', regexp=True)
                    if not pos:
                        break
                    end_pos = f"{pos}+{len(keyword)}c"
                    text_widget.tag_add('keyword', pos, end_pos)
                    start = end_pos
    
    def save_code_block(self, code_block: CodeBlock):
        """Save a code block to file"""
        if not self.current_project:
            messagebox.showwarning("No Project", "Please create or open a project first")
            return
        
        # Create file manager
        file_manager = CodeFileManager(self.current_project.path)
        
        # Get filename and suggested directory
        suggested_filename = code_block.suggested_filename or f"code{code_block.get_extension()}"
        
        # Get suggested directory from structure manager
        suggested_dir = ""
        if self.structure_manager:
            suggested_path = self.structure_manager.structure.get_suggested_path(
                suggested_filename, code_block.content
            )
            suggested_dir = suggested_path
        
        # Create save dialog
        dialog = tk.Toplevel(self.root)
        dialog.title("Save Code Block")
        dialog.geometry("600x400")
        dialog.transient(self.root)
        dialog.grab_set()
        
        # Filename entry
        ttk.Label(dialog, text="Filename:").pack(pady=5)
        filename_var = tk.StringVar(value=suggested_filename)
        filename_entry = ttk.Entry(dialog, textvariable=filename_var, width=50)
        filename_entry.pack(pady=5)
        
        # Directory selection
        dir_frame = ttk.Frame(dialog)
        dir_frame.pack(fill='x', padx=20, pady=5)
        
        ttk.Label(dir_frame, text="Directory:").pack(side='left', padx=(0, 10))
        
        # Combo box with common directories
        subdir_var = tk.StringVar(value=suggested_dir)
        dir_combo = ttk.Combobox(dir_frame, textvariable=subdir_var, width=40)
        
        # Get available directories from structure
        if self.structure_manager:
            dirs = [''] + list(set(self.structure_manager.structure.directories.values()))
            dir_combo['values'] = dirs
        else:
            dir_combo['values'] = ['', 'src', 'tests', 'docs']
        
        dir_combo.pack(side='left', fill='x', expand=True)
        
        # Preview
        ttk.Label(dialog, text="Preview:").pack(pady=5)
        preview_text = scrolledtext.ScrolledText(dialog, height=10, width=60,
                                               font=('Consolas', 9))
        preview_text.pack(pady=5, padx=10, fill='both', expand=True)
        preview_text.insert('1.0', code_block.content[:500] + "..." if len(code_block.content) > 500 else code_block.content)
        preview_text.configure(state='disabled')
        
        # Buttons
        button_frame = ttk.Frame(dialog)
        button_frame.pack(pady=10)
        
        def do_save():
            filename = filename_var.get().strip()
            subdir = subdir_var.get().strip() or None
            
            if not filename:
                messagebox.showerror("Error", "Please enter a filename")
                return
            
            # Get safe filename
            safe_filename = file_manager.get_safe_filename(filename, code_block.language)
            
            # Try to save
            success, message, old_content = file_manager.save_or_update_file(
                code_block, safe_filename, subdir
            )
            
            if success:
                self.status_var.set(message)
                dialog.destroy()
                # Update project structure view after saving
                self.update_project_display()
            elif old_content is not None:
                # File exists with different content, show diff
                if messagebox.askyesno("File Exists", 
                                     f"{message}\n\nDo you want to view the differences?"):
                    self.show_diff_dialog(old_content, code_block.content, safe_filename,
                                        lambda: self.force_save_code_block(code_block, safe_filename, subdir))
            else:
                messagebox.showerror("Error", message)
        
        ttk.Button(button_frame, text="Save", command=do_save).pack(side='left', padx=5)
        ttk.Button(button_frame, text="Cancel", command=dialog.destroy).pack(side='left', padx=5)
        
        # Focus on filename entry
        filename_entry.focus()
        filename_entry.selection_range(0, 'end')
    
    def force_save_code_block(self, code_block: CodeBlock, filename: str, subdir: Optional[str]):
        """Force save a code block"""
        if not self.current_project:
            return
        
        file_manager = CodeFileManager(self.current_project.path)
        success, message, _ = file_manager.save_or_update_file(
            code_block, filename, subdir, force=True
        )
        
        if success:
            self.status_var.set(message)
        else:
            messagebox.showerror("Error", message)
    
    def copy_code_block(self, code_block: CodeBlock):
        """Copy code block to clipboard"""
        self.root.clipboard_clear()
        self.root.clipboard_append(code_block.content)
        self.status_var.set("Code copied to clipboard")
    
    def show_diff_dialog(self, old_content: str, new_content: str, 
                        filename: str, on_overwrite):
        """Show diff dialog for file changes"""
        dialog = tk.Toplevel(self.root)
        dialog.title(f"File Differences: {filename}")
        dialog.geometry("800x600")
        dialog.transient(self.root)
        dialog.grab_set()
        
        # Create diff
        diff_lines = generate_diff(old_content, new_content)
        
        # Display diff
        diff_text = scrolledtext.ScrolledText(dialog, font=('Consolas', 10))
        diff_text.pack(fill='both', expand=True, padx=10, pady=10)
        
        # Configure tags for diff colors
        diff_text.tag_configure('add', foreground='green', background='#e6ffed')
        diff_text.tag_configure('remove', foreground='red', background='#ffeef0')
        diff_text.tag_configure('header', foreground='blue', font=('Consolas', 10, 'bold'))
        
        # Insert diff with colors
        for line in diff_lines:
            if line.startswith('+') and not line.startswith('+++'):
                diff_text.insert('end', line + '\n', 'add')
            elif line.startswith('-') and not line.startswith('---'):
                diff_text.insert('end', line + '\n', 'remove')
            elif line.startswith('@@'):
                diff_text.insert('end', line + '\n', 'header')
            else:
                diff_text.insert('end', line + '\n')
        
        diff_text.configure(state='disabled')
        
        # Buttons
        button_frame = ttk.Frame(dialog)
        button_frame.pack(pady=10)
        
        def do_overwrite():
            on_overwrite()
            dialog.destroy()
        
        ttk.Button(button_frame, text="Overwrite", command=do_overwrite).pack(side='left', padx=5)
        ttk.Button(button_frame, text="Cancel", command=dialog.destroy).pack(side='left', padx=5)
    
    def update_project_display(self):
        """Update project display with structure"""
        if not self.current_project:
            return
        
        # Update labels
        self.project_label.config(text=f"Project: {self.current_project.name}")
        
        if self.current_project.project_type:
            self.project_type_label.config(text=f"Type: {self.current_project.project_type}")
        
        # Update structure view
        if self.structure_manager:
            tree_data = self.structure_manager.get_project_tree()
            
            self.structure_text.config(state='normal')
            self.structure_text.delete('1.0', 'end')
            
            # Insert tree
            for line in tree_data['tree']:
                self.structure_text.insert('end', line + '\n')
            
            self.structure_text.config(state='disabled')
    
    def periodic_structure_refresh(self):
        """Periodically refresh project structure view"""
        if self.current_project and self.structure_manager:
            self.update_project_display()
        
        # Schedule next refresh
        self.root.after(STRUCTURE_REFRESH_INTERVAL_MS * 2, self.periodic_structure_refresh)  # Double interval for less frequent updates
    
    def show_log_viewer(self):
        """Show log viewer dialog"""
        dialog = tk.Toplevel(self.root)
        dialog.title("ALFRED Log Viewer")
        dialog.geometry("1000x700")
        dialog.transient(self.root)
        
        # Create notebook for different log types
        notebook = ttk.Notebook(dialog)
        notebook.pack(fill='both', expand=True, padx=5, pady=5)
        
        # Recent activity tab
        activity_frame = ttk.Frame(notebook)
        notebook.add(activity_frame, text="Recent Activity")
        
        # Create activity log view
        activity_text = scrolledtext.ScrolledText(activity_frame, font=('Consolas', 9))
        activity_text.pack(fill='both', expand=True, padx=5, pady=5)
        
        # Get recent requests
        recent_requests = self.logger.get_request_history(hours=24)
        
        activity_text.insert('end', "=== Recent API Requests (Last 24 Hours) ===\n\n")
        
        for req in recent_requests[-50:]:  # Last 50 requests
            timestamp = req.get('timestamp', 'Unknown')
            message = req.get('message', '')
            data = req.get('data', {})
            
            activity_text.insert('end', f"[{timestamp}] {message}\n")
            
            if 'request_id' in data:
                activity_text.insert('end', f"  Request ID: {data['request_id']}\n")
            if 'model' in data:
                activity_text.insert('end', f"  Model: {data['model']}\n")
            if 'stage' in data:
                activity_text.insert('end', f"  Stage: {data['stage']}\n")
            if 'duration_seconds' in data:
                activity_text.insert('end', f"  Duration: {data['duration_seconds']:.2f}s\n")
            if 'error' in data:
                activity_text.insert('end', f"  Error: {data['error']}\n", 'error')
            
            activity_text.insert('end', "\n")
        
        activity_text.config(state='disabled')
        activity_text.tag_config('error', foreground='red')
        
        # Errors tab
        errors_frame = ttk.Frame(notebook)
        notebook.add(errors_frame, text="Errors")
        
        errors_text = scrolledtext.ScrolledText(errors_frame, font=('Consolas', 9))
        errors_text.pack(fill='both', expand=True, padx=5, pady=5)
        
        # Get recent errors
        recent_errors = self.logger.get_recent_errors(hours=24)
        
        errors_text.insert('end', f"=== Recent Errors (Last 24 Hours) - Total: {len(recent_errors)} ===\n\n")
        
        for error in recent_errors:
            timestamp = error.get('timestamp', 'Unknown')
            message = error.get('message', '')
            data = error.get('data', {})
            
            errors_text.insert('end', f"[{timestamp}] {message}\n", 'error_header')
            
            if 'error_type' in data:
                errors_text.insert('end', f"  Type: {data['error_type']}\n")
            if 'error_message' in data:
                errors_text.insert('end', f"  Message: {data['error_message']}\n")
            if 'request_id' in data:
                errors_text.insert('end', f"  Request ID: {data['request_id']}\n")
            if 'traceback' in data:
                errors_text.insert('end', "  Traceback:\n")
                for line in data['traceback'].split('\n'):
                    if line.strip():
                        errors_text.insert('end', f"    {line}\n", 'traceback')
            
            errors_text.insert('end', "\n")
        
        errors_text.config(state='disabled')
        errors_text.tag_config('error_header', foreground='red', font=('Consolas', 9, 'bold'))
        errors_text.tag_config('traceback', foreground='#666666', font=('Consolas', 8))
        
        # Analysis tab
        analysis_frame = ttk.Frame(notebook)
        notebook.add(analysis_frame, text="Analysis")
        
        analysis_text = scrolledtext.ScrolledText(analysis_frame, font=('Consolas', 10))
        analysis_text.pack(fill='both', expand=True, padx=5, pady=5)
        
        # Analyze failures
        analysis = self.logger.analyze_recent_failures()
        
        analysis_text.insert('end', "=== Failure Analysis (Last 24 Hours) ===\n\n")
        
        summary = analysis['summary']
        analysis_text.insert('end', "Summary:\n", 'header')
        analysis_text.insert('end', f"  Total Requests: {summary['total_requests']}\n")
        analysis_text.insert('end', f"  Failed Requests: {summary['failed_requests']}\n")
        analysis_text.insert('end', f"  Success Rate: {summary['success_rate']:.1f}%\n")
        analysis_text.insert('end', f"  Total Errors: {summary['total_errors']}\n")
        analysis_text.insert('end', f"  Timeout Errors: {summary['timeout_errors']}\n")
        analysis_text.insert('end', f"  Connection Errors: {summary['connection_errors']}\n\n")
        
        if analysis['error_types']:
            analysis_text.insert('end', "Error Types:\n", 'header')
            for error_type, count in sorted(analysis['error_types'].items(), key=lambda x: x[1], reverse=True):
                analysis_text.insert('end', f"  {error_type}: {count}\n")
            analysis_text.insert('end', "\n")
        
        if analysis['recent_errors']:
            analysis_text.insert('end', "Most Recent Errors:\n", 'header')
            for error in analysis['recent_errors']:
                timestamp = error.get('timestamp', 'Unknown')
                message = error.get('message', '')
                analysis_text.insert('end', f"  [{timestamp}] {message}\n")
        
        analysis_text.config(state='disabled')
        analysis_text.tag_config('header', font=('Consolas', 10, 'bold'))
        
        # Buttons at bottom
        button_frame = ttk.Frame(dialog)
        button_frame.pack(fill='x', padx=5, pady=5)
        
        def refresh_logs():
            """Refresh all log views"""
            # This would re-populate all tabs with fresh data
            self.status_var.set("Logs refreshed")
        
        def export_logs():
            """Export logs to file"""
            filename = filedialog.asksaveasfilename(
                defaultextension=".txt",
                filetypes=[("Text files", "*.txt"), ("All files", "*.*")]
            )
            if filename:
                try:
                    with open(filename, 'w', encoding='utf-8') as f:
                        f.write("=== ALFRED Log Export ===\n")
                        f.write(f"Exported: {datetime.now()}\n\n")
                        
                        # Export analysis
                        f.write(analysis_text.get('1.0', 'end'))
                        f.write("\n\n")
                        
                        # Export recent activity
                        f.write(activity_text.get('1.0', 'end'))
                        f.write("\n\n")
                        
                        # Export errors
                        f.write(errors_text.get('1.0', 'end'))
                    
                    messagebox.showinfo("Export Complete", f"Logs exported to: {filename}")
                except Exception as e:
                    messagebox.showerror("Export Error", f"Failed to export logs: {str(e)}")
        
        def open_log_directory():
            """Open log directory in file explorer"""
            log_dir = Path.home() / ".alfred" / "logs"
            if log_dir.exists():
                from alfred_security_fixes import safe_open_directory
                if not safe_open_directory(log_dir):
                    messagebox.showwarning("Warning", "Could not open log directory")
        
        ttk.Button(button_frame, text="Refresh", command=refresh_logs).pack(side='left', padx=5)
        ttk.Button(button_frame, text="Export", command=export_logs).pack(side='left', padx=5)
        ttk.Button(button_frame, text="Open Log Directory", command=open_log_directory).pack(side='left', padx=5)
        ttk.Button(button_frame, text="Close", command=dialog.destroy).pack(side='right', padx=5)


def main():
    if not TKINTER_AVAILABLE:
        print("\nError: tkinter is required for the GUI.")
        print("Please install it and try again.")
        return
    
    root = tk.Tk()
    app = AlfredApp(root)
    root.mainloop()


if __name__ == "__main__":
    main()