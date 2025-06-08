#!/usr/bin/env python3
"""
ALFRED Enhanced - AI-Linked Framework for Rapid Engineering Development
Enhanced version with security, performance, and UX improvements
"""

import os
import sys
import json
import threading
import queue
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any, Callable
import hashlib
from dataclasses import dataclass, field, asdict
from collections import defaultdict

# Import core Alfred components
from alfred import (
    ChatMessage, ChatSession, Project, OllamaClient,
    TKINTER_AVAILABLE
)
from alfred_constants import *
from alfred_exceptions import *
from alfred_logger import get_logger

# Import enhancement modules
from alfred_security_fixes import (
    safe_path_join, validate_path, safe_json_load, safe_json_save,
    sanitize_filename, safe_subprocess_run
)
from alfred_validators import (
    ProjectNameValidator, FilePathValidator, URLValidator,
    ConfigValidator, sanitize_input
)
from ui_update_queue import UIUpdateQueue
from alfred_config import ConfigManager
from alfred_command_palette import CommandPalette

# Try to import customtkinter for better UI
try:
    import customtkinter as ctk
    ctk.set_appearance_mode("dark")
    ctk.set_default_color_theme("blue")
    CUSTOM_TK_AVAILABLE = True
except ImportError:
    CUSTOM_TK_AVAILABLE = False
    if TKINTER_AVAILABLE:
        import tkinter as tk
        from tkinter import ttk, scrolledtext, messagebox, filedialog

# Try to import resource monitoring
try:
    from alfred_resource_monitor import ResourceMonitor, ResourceAwareOllamaClient
    RESOURCE_MONITOR_AVAILABLE = True
except ImportError:
    RESOURCE_MONITOR_AVAILABLE = False


class EnhancedOllamaClient(OllamaClient):
    """Enhanced Ollama client with resource awareness and better error handling"""
    
    def __init__(self, base_url: str = "http://localhost:11434"):
        super().__init__(base_url)
        self.logger = get_logger()
        
        # Use resource-aware client if available
        if RESOURCE_MONITOR_AVAILABLE:
            self.resource_client = ResourceAwareOllamaClient(base_url)
        else:
            self.resource_client = None
    
    def generate(self, prompt: str, model: str = "deepseek-coder:latest", 
                 context: Optional[List[str]] = None) -> str:
        """Generate with resource awareness"""
        if self.resource_client:
            return self.resource_client.generate(prompt, model, context)
        else:
            return super().generate(prompt, model, context)


class EnhancedAlfredApp:
    """Enhanced ALFRED with security, performance, and UX improvements"""
    
    def __init__(self, root=None, ui_mode='tkinter'):
        """Initialize enhanced Alfred"""
        self.ui_mode = ui_mode
        self.logger = get_logger()
        
        # Initialize configuration
        self.config = ConfigManager()
        self.config.load()
        
        # Initialize validators
        self.validators = {
            'project_name': ProjectNameValidator(),
            'file_path': FilePathValidator(),
            'url': URLValidator(),
            'config': ConfigValidator()
        }
        
        # Initialize UI update queue for thread safety
        self.ui_queue = UIUpdateQueue()
        
        # Core components
        self.ollama_client = EnhancedOllamaClient(
            self.config.get('ollama.base_url', 'http://localhost:11434')
        )
        self.current_project = None
        self.projects_dir = Path.home() / ".alfred" / "projects"
        self.projects_dir.mkdir(parents=True, exist_ok=True)
        
        # Initialize UI based on mode
        if ui_mode == 'tkinter':
            self._init_tkinter_ui(root)
        elif ui_mode == 'web':
            self._init_web_ui()
        else:
            raise ValueError(f"Unknown UI mode: {ui_mode}")
        
        # Start UI update processor
        self.ui_queue.start()
        
        # Initialize resource monitor if available
        if RESOURCE_MONITOR_AVAILABLE:
            self.resource_monitor = ResourceMonitor()
            self.resource_monitor.start_monitoring()
        
        # Load last project if configured
        if self.config.get('general.auto_load_last_project', True):
            self._load_last_project()
    
    def _init_tkinter_ui(self, root):
        """Initialize tkinter-based UI"""
        if CUSTOM_TK_AVAILABLE:
            self.root = root or ctk.CTk()
            self.root.title("ALFRED Enhanced - AI Development Assistant")
            self.root.geometry("1400x900")
            self._build_custom_tk_ui()
        elif TKINTER_AVAILABLE:
            self.root = root or tk.Tk()
            self.root.title("ALFRED Enhanced - AI Development Assistant")
            self.root.geometry("1400x900")
            self._build_standard_tk_ui()
        else:
            raise ImportError("No UI library available (tkinter or customtkinter)")
        
        # Initialize command palette
        self.command_palette = CommandPalette(self)
        
        # Bind global shortcuts
        self._bind_shortcuts()
    
    def _build_custom_tk_ui(self):
        """Build UI with customtkinter for modern look"""
        # Top toolbar
        self.toolbar = ctk.CTkFrame(self.root, height=50)
        self.toolbar.pack(fill='x', padx=5, pady=5)
        
        # Buttons with icons (if available)
        ctk.CTkButton(
            self.toolbar, text="New Project", 
            command=self.new_project,
            width=120
        ).pack(side='left', padx=2)
        
        ctk.CTkButton(
            self.toolbar, text="Open Project",
            command=self.open_project,
            width=120
        ).pack(side='left', padx=2)
        
        ctk.CTkButton(
            self.toolbar, text="Command Palette",
            command=self.show_command_palette,
            width=120
        ).pack(side='left', padx=2)
        
        # Connection status
        self.connection_var = tk.StringVar(value="⚪ Checking...")
        self.connection_label = ctk.CTkLabel(
            self.toolbar, textvariable=self.connection_var
        )
        self.connection_label.pack(side='left', padx=20)
        
        # Model selector
        self.model_var = tk.StringVar(value="deepseek-coder:latest")
        self.model_combo = ctk.CTkComboBox(
            self.toolbar, variable=self.model_var,
            values=["deepseek-coder:latest"],
            width=200
        )
        self.model_combo.pack(side='right', padx=5)
        
        ctk.CTkLabel(self.toolbar, text="Model:").pack(side='right', padx=5)
        
        # Main content area with panels
        self.main_frame = ctk.CTkFrame(self.root)
        self.main_frame.pack(fill='both', expand=True, padx=5, pady=5)
        
        # Left panel - Project tree
        self.left_panel = ctk.CTkFrame(self.main_frame, width=250)
        self.left_panel.pack(side='left', fill='y', padx=(0, 5))
        
        # Right panel - Chat interface
        self.right_panel = ctk.CTkFrame(self.main_frame)
        self.right_panel.pack(side='right', fill='both', expand=True)
        
        # Chat display
        self.chat_display = ctk.CTkTextbox(
            self.right_panel,
            height=400,
            font=("Consolas", 11)
        )
        self.chat_display.pack(fill='both', expand=True, pady=(0, 5))
        
        # Input area
        self.input_frame = ctk.CTkFrame(self.right_panel)
        self.input_frame.pack(fill='x')
        
        self.input_text = ctk.CTkTextbox(
            self.input_frame,
            height=80,
            font=("Consolas", 11)
        )
        self.input_text.pack(side='left', fill='both', expand=True, padx=(0, 5))
        
        self.send_button = ctk.CTkButton(
            self.input_frame,
            text="Send",
            command=self.send_message,
            width=80,
            height=80
        )
        self.send_button.pack(side='right')
        
        # Status bar
        self.status_frame = ctk.CTkFrame(self.root, height=30)
        self.status_frame.pack(side='bottom', fill='x')
        
        self.status_var = tk.StringVar(value="Ready")
        self.status_label = ctk.CTkLabel(
            self.status_frame, textvariable=self.status_var
        )
        self.status_label.pack(side='left', padx=10)
        
        # Resource monitor display if available
        if RESOURCE_MONITOR_AVAILABLE:
            self.resource_frame = ctk.CTkFrame(self.status_frame)
            self.resource_frame.pack(side='right', padx=10)
            
            self.cpu_var = tk.StringVar(value="CPU: --")
            self.mem_var = tk.StringVar(value="MEM: --")
            
            ctk.CTkLabel(
                self.resource_frame, textvariable=self.cpu_var
            ).pack(side='left', padx=5)
            
            ctk.CTkLabel(
                self.resource_frame, textvariable=self.mem_var
            ).pack(side='left', padx=5)
            
            # Update resource display periodically
            self._update_resource_display()
    
    def _build_standard_tk_ui(self):
        """Build UI with standard tkinter (fallback)"""
        # Similar to custom tk but with ttk widgets
        # (Implementation similar to original alfred.py)
        pass
    
    def _bind_shortcuts(self):
        """Bind keyboard shortcuts"""
        shortcuts = {
            '<Control-Shift-P>': self.show_command_palette,
            '<Control-n>': self.new_project,
            '<Control-o>': self.open_project,
            '<Control-s>': self.save_project,
            '<Control-Return>': self.send_message,
            '<F1>': self.show_help
        }
        
        for key, command in shortcuts.items():
            self.root.bind(key, lambda e, cmd=command: cmd())
    
    def show_command_palette(self):
        """Show the command palette"""
        if hasattr(self, 'command_palette'):
            self.command_palette.show()
    
    def _update_resource_display(self):
        """Update resource monitor display"""
        if RESOURCE_MONITOR_AVAILABLE and hasattr(self, 'resource_monitor'):
            stats = self.resource_monitor.get_current_stats()
            self.cpu_var.set(f"CPU: {stats['cpu_percent']:.1f}%")
            self.mem_var.set(f"MEM: {stats['memory_percent']:.1f}%")
            
            # Change color based on usage
            if stats['cpu_percent'] > 80 or stats['memory_percent'] > 80:
                # High usage - would set color to red if supported
                pass
        
        # Schedule next update
        self.root.after(2000, self._update_resource_display)
    
    def new_project(self):
        """Create new project with enhanced validation"""
        # Implementation with validators and security checks
        pass
    
    def open_project(self):
        """Open existing project with validation"""
        # Implementation with path validation
        pass
    
    def save_project(self):
        """Save project with atomic writes"""
        if not self.current_project:
            return
        
        try:
            # Use safe path join and atomic save
            project_path = safe_path_join(
                str(self.projects_dir),
                sanitize_filename(self.current_project.name) + ".json"
            )
            
            if not safe_json_save(self.current_project.to_dict(), project_path):
                raise Exception("Failed to save project")
                
            self.status_var.set("Project saved")
            self.logger.log_operation("project_save", "success", 
                                    {"project": self.current_project.name})
            
        except Exception as e:
            self.logger.log_error("Failed to save project", error=e)
            self.status_var.set(f"Save failed: {str(e)}")
    
    def send_message(self):
        """Send message with enhanced error handling"""
        # Get input with validation
        user_input = self.input_text.get("1.0", "end-1c").strip()
        if not user_input:
            return
        
        # Sanitize input
        user_input = sanitize_input(user_input)
        
        # Clear input
        self.input_text.delete("1.0", "end")
        
        # Process in thread with UI queue
        threading.Thread(
            target=self._process_message,
            args=(user_input,),
            daemon=True
        ).start()
    
    def _process_message(self, user_input: str):
        """Process message in background thread"""
        try:
            # Update UI through queue
            self.ui_queue.put(
                lambda: self.status_var.set("AI is thinking..."),
                priority=1
            )
            
            # Generate response
            response = self.ollama_client.generate(
                prompt=user_input,
                model=self.model_var.get()
            )
            
            # Update chat display through queue
            self.ui_queue.put(
                lambda: self._append_to_chat(f"You: {user_input}\n\nAI: {response}\n\n"),
                priority=2
            )
            
            self.ui_queue.put(
                lambda: self.status_var.set("Ready"),
                priority=1
            )
            
        except Exception as e:
            self.ui_queue.put(
                lambda: self.status_var.set(f"Error: {str(e)}"),
                priority=0
            )
    
    def _append_to_chat(self, text: str):
        """Append text to chat display"""
        if CUSTOM_TK_AVAILABLE:
            self.chat_display.insert("end", text)
            self.chat_display.see("end")
        else:
            self.chat_display.insert("end", text)
            self.chat_display.see("end")
    
    def _load_last_project(self):
        """Load the last opened project"""
        last_project = self.config.get('general.last_project')
        if last_project and os.path.exists(last_project):
            try:
                # Load project safely
                project_data = safe_json_load(last_project)
                if project_data:
                    # Convert to Project instance
                    pass
            except Exception as e:
                self.logger.log_error("Failed to load last project", error=e)
    
    def show_help(self):
        """Show help dialog"""
        help_text = """
ALFRED Enhanced - Keyboard Shortcuts

Ctrl+Shift+P : Command Palette
Ctrl+N       : New Project  
Ctrl+O       : Open Project
Ctrl+S       : Save Project
Ctrl+Enter   : Send Message
F1           : Show Help

Enhanced Features:
• Secure file operations
• Thread-safe UI updates
• Resource monitoring
• Input validation
• Command palette
"""
        if CUSTOM_TK_AVAILABLE:
            # Custom dialog
            pass
        else:
            messagebox.showinfo("Help", help_text)
    
    def cleanup(self):
        """Cleanup resources on exit"""
        self.ui_queue.stop()
        if RESOURCE_MONITOR_AVAILABLE and hasattr(self, 'resource_monitor'):
            self.resource_monitor.stop_monitoring()
        self.config.save()
    
    def run(self):
        """Run the application"""
        try:
            self.root.protocol("WM_DELETE_WINDOW", self._on_closing)
            self.root.mainloop()
        except KeyboardInterrupt:
            self.cleanup()
    
    def _on_closing(self):
        """Handle window closing"""
        self.cleanup()
        self.root.destroy()


def main():
    """Run enhanced ALFRED"""
    # Check for UI availability
    if not TKINTER_AVAILABLE and not CUSTOM_TK_AVAILABLE:
        print("Error: No UI library available")
        print("Install tkinter: sudo apt-get install python3-tk")
        print("Or install customtkinter: pip install customtkinter")
        return
    
    # Use custom tkinter if available
    if CUSTOM_TK_AVAILABLE:
        root = ctk.CTk()
    else:
        root = tk.Tk()
    
    app = EnhancedAlfredApp(root)
    app.run()


if __name__ == "__main__":
    main()