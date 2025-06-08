#!/usr/bin/env python3
"""
ALFRED Enhanced Preview
Demonstrates key optimizations and enhancements
"""

import os
import json
import time
import queue
import threading
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Callable, Any
from dataclasses import dataclass, field
from collections import OrderedDict, defaultdict
import tkinter as tk
from tkinter import ttk, scrolledtext

# Import base ALFRED components
from alfred import ChatMessage, ChatSession, Project, OllamaClient, AlfredApp

# Enhancement 1: Thread-Safe UI Updates
class ThreadSafeUpdater:
    """Manages UI updates from background threads safely"""
    
    def __init__(self, root: tk.Tk):
        self.root = root
        self.update_queue = queue.Queue()
        self.processing = False
        self.start_processing()
        
    def queue_update(self, func: Callable, *args, **kwargs):
        """Queue a UI update for main thread execution"""
        self.update_queue.put((func, args, kwargs))
        
    def start_processing(self):
        """Start processing queued updates"""
        self.process_updates()
        
    def process_updates(self):
        """Process all queued updates in main thread"""
        processed = 0
        max_updates_per_cycle = 10  # Prevent UI freezing
        
        while not self.update_queue.empty() and processed < max_updates_per_cycle:
            try:
                func, args, kwargs = self.update_queue.get_nowait()
                func(*args, **kwargs)
                processed += 1
            except queue.Empty:
                break
        
        # Schedule next processing cycle
        self.root.after(50, self.process_updates)

# Enhancement 2: Event System
@dataclass
class Event:
    name: str
    data: Dict[str, Any]
    timestamp: datetime = field(default_factory=datetime.now)

class EventBus:
    """Simple event bus for decoupled communication"""
    
    def __init__(self):
        self._handlers: Dict[str, List[Callable]] = defaultdict(list)
        
    def on(self, event_name: str, handler: Callable[[Event], None]):
        """Register event handler"""
        self._handlers[event_name].append(handler)
        
    def emit(self, event_name: str, **data):
        """Emit event to all registered handlers"""
        event = Event(event_name, data)
        for handler in self._handlers[event_name]:
            try:
                handler(event)
            except Exception as e:
                print(f"Error in event handler for {event_name}: {e}")

# Enhancement 3: Code Block Cache
class CodeBlockCache:
    """LRU cache for code blocks to manage memory"""
    
    def __init__(self, max_size: int = 100):
        self.cache = OrderedDict()
        self.max_size = max_size
        
    def add(self, block_id: str, block: Any, widget: Optional[tk.Widget] = None):
        """Add block with automatic eviction"""
        if len(self.cache) >= self.max_size:
            # Remove oldest
            oldest_id, (_, old_widget) = self.cache.popitem(last=False)
            if old_widget and hasattr(old_widget, 'destroy'):
                try:
                    old_widget.destroy()
                except:
                    pass
        
        self.cache[block_id] = (block, widget)
        
    def get(self, block_id: str) -> Optional[Tuple[Any, tk.Widget]]:
        """Get block and move to end (most recently used)"""
        if block_id in self.cache:
            self.cache.move_to_end(block_id)
            return self.cache[block_id]
        return None

# Enhancement 4: Command Palette
@dataclass
class Command:
    name: str
    action: Callable
    keywords: List[str]
    shortcut: Optional[str] = None
    category: str = "General"

class CommandPalette:
    """Quick command access with fuzzy search"""
    
    def __init__(self, app):
        self.app = app
        self.commands: List[Command] = []
        self._register_default_commands()
        
    def _register_default_commands(self):
        """Register built-in commands"""
        # File commands
        self.register(Command(
            "New Project",
            self.app.new_project,
            ["new", "create", "project"],
            "Ctrl+N",
            "File"
        ))
        
        self.register(Command(
            "Open Project", 
            self.app.open_project,
            ["open", "load", "project"],
            "Ctrl+O",
            "File"
        ))
        
        # Chat commands
        self.register(Command(
            "New Chat",
            self.app.new_chat,
            ["chat", "session", "conversation"],
            "Ctrl+T",
            "Chat"
        ))
        
        # View commands
        self.register(Command(
            "Toggle Sidebar",
            lambda: self.app.toggle_sidebar(),
            ["sidebar", "toggle", "hide"],
            "Ctrl+B",
            "View"
        ))
        
        # AI commands
        self.register(Command(
            "Change Model",
            lambda: self.app.show_model_selector(),
            ["model", "change", "select"],
            "Ctrl+M",
            "AI"
        ))
        
    def register(self, command: Command):
        """Register a new command"""
        self.commands.append(command)
        
    def show(self):
        """Show command palette dialog"""
        dialog = tk.Toplevel(self.app.root)
        dialog.title("")
        dialog.geometry("600x400")
        dialog.configure(bg='#2b2b2b')
        dialog.overrideredirect(True)  # Remove window decorations
        
        # Center on screen
        dialog.update_idletasks()
        x = (dialog.winfo_screenwidth() - 600) // 2
        y = (dialog.winfo_screenheight() - 400) // 2 - 100
        dialog.geometry(f"600x400+{x}+{y}")
        
        # Make modal
        dialog.transient(self.app.root)
        dialog.grab_set()
        
        # Search entry with custom style
        search_frame = tk.Frame(dialog, bg='#2b2b2b')
        search_frame.pack(fill='x', padx=1, pady=1)
        
        search_var = tk.StringVar()
        search_entry = tk.Entry(
            search_frame,
            textvariable=search_var,
            font=('Consolas', 12),
            bg='#3c3c3c',
            fg='white',
            insertbackground='white',
            relief='flat',
            bd=10
        )
        search_entry.pack(fill='x')
        search_entry.focus()
        
        # Results frame
        results_frame = tk.Frame(dialog, bg='#2b2b2b')
        results_frame.pack(fill='both', expand=True)
        
        # Custom listbox
        self.results_listbox = tk.Listbox(
            results_frame,
            font=('Consolas', 10),
            bg='#2b2b2b',
            fg='#cccccc',
            selectbackground='#094771',
            selectforeground='white',
            relief='flat',
            bd=0,
            highlightthickness=0
        )
        self.results_listbox.pack(fill='both', expand=True, padx=10, pady=5)
        
        # Store commands with indices
        self.filtered_commands = []
        
        def fuzzy_match(query: str, text: str) -> int:
            """Fuzzy matching with score"""
            query = query.lower()
            text = text.lower()
            
            # Exact match
            if query == text:
                return 1000
            
            # Starts with
            if text.startswith(query):
                return 900
            
            # Contains
            if query in text:
                return 800
            
            # Character sequence match
            query_idx = 0
            match_positions = []
            for i, char in enumerate(text):
                if query_idx < len(query) and char == query[query_idx]:
                    match_positions.append(i)
                    query_idx += 1
                    
            if query_idx == len(query):
                # Score based on compactness of match
                score = 700 - (match_positions[-1] - match_positions[0])
                return max(score, 100)
            
            return 0
        
        def update_results(*args):
            """Update search results with fuzzy matching"""
            query = search_var.get()
            self.results_listbox.delete(0, 'end')
            self.filtered_commands.clear()
            
            if not query:
                # Show all commands grouped by category
                categories = defaultdict(list)
                for cmd in self.commands:
                    categories[cmd.category].append(cmd)
                
                for category, cmds in sorted(categories.items()):
                    # Category header
                    self.results_listbox.insert('end', f"  {category}")
                    self.results_listbox.itemconfig('end', fg='#808080')
                    
                    for cmd in cmds:
                        display = f"    {cmd.name}"
                        if cmd.shortcut:
                            display += f" ({cmd.shortcut})"
                        self.results_listbox.insert('end', display)
                        self.filtered_commands.append(cmd)
            else:
                # Fuzzy search with scoring
                matches = []
                for cmd in self.commands:
                    # Search in name and keywords
                    name_score = fuzzy_match(query, cmd.name)
                    keyword_scores = [fuzzy_match(query, kw) for kw in cmd.keywords]
                    max_score = max([name_score] + keyword_scores)
                    
                    if max_score > 0:
                        matches.append((cmd, max_score))
                
                # Sort by score
                matches.sort(key=lambda x: x[1], reverse=True)
                
                for cmd, score in matches:
                    display = f"  {cmd.name}"
                    if cmd.shortcut:
                        display += f" ({cmd.shortcut})"
                    self.results_listbox.insert('end', display)
                    self.filtered_commands.append(cmd)
            
            # Select first item
            if self.results_listbox.size() > 0:
                self.results_listbox.selection_set(0)
                self.results_listbox.see(0)
        
        def execute_command(event=None):
            """Execute selected command"""
            selection = self.results_listbox.curselection()
            if selection:
                idx = selection[0]
                if idx < len(self.filtered_commands):
                    cmd = self.filtered_commands[idx]
                    dialog.destroy()
                    # Emit event
                    if hasattr(self.app, 'event_bus'):
                        self.app.event_bus.emit('command.executed', 
                                              command=cmd.name)
                    # Execute command
                    cmd.action()
        
        def navigate_list(event):
            """Navigate list with arrow keys"""
            current = self.results_listbox.curselection()
            if not current:
                self.results_listbox.selection_set(0)
                return
                
            idx = current[0]
            if event.keysym == 'Down':
                if idx < self.results_listbox.size() - 1:
                    self.results_listbox.selection_clear(idx)
                    self.results_listbox.selection_set(idx + 1)
                    self.results_listbox.see(idx + 1)
            elif event.keysym == 'Up':
                if idx > 0:
                    self.results_listbox.selection_clear(idx)
                    self.results_listbox.selection_set(idx - 1)
                    self.results_listbox.see(idx - 1)
        
        # Bindings
        search_var.trace('w', update_results)
        search_entry.bind('<Return>', execute_command)
        search_entry.bind('<Down>', navigate_list)
        search_entry.bind('<Up>', navigate_list)
        search_entry.bind('<Escape>', lambda e: dialog.destroy())
        self.results_listbox.bind('<Double-Button-1>', execute_command)
        self.results_listbox.bind('<Return>', execute_command)
        
        # Initialize
        update_results()

# Enhancement 5: Progress Tracker
class ProgressTracker:
    """Enhanced progress feedback for long operations"""
    
    def __init__(self, parent: tk.Widget):
        self.frame = ttk.Frame(parent)
        self.tasks = {}
        self.current_task = None
        
        # Main progress bar
        self.main_progress = ttk.Progressbar(
            self.frame,
            mode='determinate',
            length=300
        )
        self.main_progress.pack(side='left', padx=5)
        
        # Status label
        self.status_label = ttk.Label(
            self.frame,
            text="Ready",
            width=40
        )
        self.status_label.pack(side='left', padx=5)
        
        # Cancel button
        self.cancel_button = ttk.Button(
            self.frame,
            text="Cancel",
            state='disabled',
            width=10
        )
        self.cancel_button.pack(side='right', padx=5)
        
    def start_task(self, task_id: str, description: str, 
                   total_steps: int = 100, cancellable: bool = False):
        """Start tracking a new task"""
        self.tasks[task_id] = {
            'description': description,
            'total': total_steps,
            'current': 0,
            'start_time': time.time(),
            'cancellable': cancellable,
            'cancelled': False
        }
        
        self.current_task = task_id
        self.main_progress['maximum'] = total_steps
        self.main_progress['value'] = 0
        self.status_label['text'] = description
        
        if cancellable:
            self.cancel_button['state'] = 'normal'
            self.cancel_button['command'] = lambda: self.cancel_task(task_id)
        
    def update_progress(self, task_id: str, current: int, status: str = None):
        """Update task progress"""
        if task_id not in self.tasks:
            return
            
        task = self.tasks[task_id]
        task['current'] = current
        
        if task_id == self.current_task:
            self.main_progress['value'] = current
            
            # Calculate ETA
            elapsed = time.time() - task['start_time']
            if current > 0:
                total_time = elapsed * task['total'] / current
                remaining = total_time - elapsed
                eta_str = f" (ETA: {int(remaining)}s)"
            else:
                eta_str = ""
            
            if status:
                self.status_label['text'] = f"{status}{eta_str}"
            else:
                percent = int(current * 100 / task['total'])
                self.status_label['text'] = f"{task['description']} - {percent}%{eta_str}"
    
    def complete_task(self, task_id: str):
        """Mark task as complete"""
        if task_id in self.tasks:
            self.update_progress(task_id, self.tasks[task_id]['total'], "Complete")
            del self.tasks[task_id]
            
            if task_id == self.current_task:
                self.current_task = None
                self.cancel_button['state'] = 'disabled'
                self.main_progress['value'] = 0
                self.status_label['text'] = "Ready"

# Enhanced ALFRED App
class EnhancedAlfredApp(AlfredApp):
    """ALFRED with performance and UX enhancements"""
    
    def __init__(self, root):
        # Initialize enhancements before parent
        self.ui_updater = ThreadSafeUpdater(root)
        self.event_bus = EventBus()
        self.code_cache = CodeBlockCache()
        
        # Call parent init
        super().__init__(root)
        
        # Add command palette
        self.command_palette = CommandPalette(self)
        
        # Add progress tracker
        self.progress_tracker = ProgressTracker(self.root)
        self.progress_tracker.frame.pack(side='bottom', fill='x', before=self.status_bar)
        
        # Register enhanced keyboard shortcuts
        self.root.bind('<Control-Shift-p>', lambda e: self.command_palette.show())
        self.root.bind('<Control-Shift-P>', lambda e: self.command_palette.show())
        
        # Register event handlers
        self.setup_event_handlers()
        
    def setup_event_handlers(self):
        """Setup event-driven behaviors"""
        self.event_bus.on('project.loaded', self.on_project_loaded)
        self.event_bus.on('message.sent', self.on_message_sent)
        self.event_bus.on('response.received', self.on_response_received)
        
    def on_project_loaded(self, event: Event):
        """Handle project loaded event"""
        project_name = event.data.get('project_name')
        print(f"Project loaded: {project_name}")
        
    def on_message_sent(self, event: Event):
        """Handle message sent event"""
        # Could trigger analytics, logging, etc.
        pass
        
    def on_response_received(self, event: Event):
        """Handle AI response received event"""
        # Could trigger code extraction, analysis, etc.
        pass
    
    def _get_ai_response(self, message: str, session: ChatSession):
        """Enhanced AI response with progress tracking"""
        task_id = f"ai_response_{datetime.now().timestamp()}"
        
        # Use UI updater for thread-safe updates
        self.ui_updater.queue_update(
            self.progress_tracker.start_task,
            task_id,
            "Getting AI response...",
            100,
            True
        )
        
        try:
            # Update progress stages
            self.ui_updater.queue_update(
                self.progress_tracker.update_progress,
                task_id,
                20,
                "Building context..."
            )
            
            # Build conversation history
            history = "\n\n".join([
                f"{msg.role.upper()}: {msg.content}"
                for msg in session.messages[-10:]
            ])
            
            # Check context files
            if session.context_files:
                self.ui_updater.queue_update(
                    self.progress_tracker.update_progress,
                    task_id,
                    40,
                    f"Loading {len(session.context_files)} context files..."
                )
            
            # Call AI
            self.ui_updater.queue_update(
                self.progress_tracker.update_progress,
                task_id,
                60,
                "Waiting for AI response..."
            )
            
            response = self.ollama_client.generate(
                prompt=history,
                model=self.model_var.get(),
                context=session.context_files
            )
            
            # Process response
            self.ui_updater.queue_update(
                self.progress_tracker.update_progress,
                task_id,
                80,
                "Processing response..."
            )
            
            # Add to session
            assistant_msg = ChatMessage(role="assistant", content=response)
            session.messages.append(assistant_msg)
            
            # Update UI
            self.ui_updater.queue_update(self.append_message, assistant_msg)
            self.ui_updater.queue_update(self.save_project)
            
            # Emit event
            self.event_bus.emit('response.received', 
                              message=response,
                              session_id=session.id)
            
            # Complete task
            self.ui_updater.queue_update(
                self.progress_tracker.complete_task,
                task_id
            )
            
        except Exception as e:
            self.ui_updater.queue_update(
                self.progress_tracker.complete_task,
                task_id
            )
            self.ui_updater.queue_update(
                self.status_var.set,
                f"Error: {str(e)}"
            )
    
    def toggle_sidebar(self):
        """Toggle sidebar visibility"""
        if hasattr(self, 'sidebar_visible'):
            self.sidebar_visible = not self.sidebar_visible
        else:
            self.sidebar_visible = False
            
        if self.sidebar_visible:
            # Show sidebar
            if hasattr(self, 'sidebar'):
                self.sidebar.pack(side='left', fill='y', padx=(0, 5))
            else:
                # Create sidebar if it doesn't exist
                self.sidebar = ttk.Frame(self.main_frame, width=200)
                self.sidebar.pack(side='left', fill='y', padx=(0, 5))
                self.sidebar.pack_propagate(False)
                
                # Add sidebar content
                ttk.Label(self.sidebar, text="Quick Actions", font=('Arial', 10, 'bold')).pack(pady=10)
                ttk.Button(self.sidebar, text="New Chat", command=self.new_chat_session).pack(fill='x', padx=10, pady=2)
                ttk.Button(self.sidebar, text="Export Chat", command=self.export_chat).pack(fill='x', padx=10, pady=2)
                ttk.Button(self.sidebar, text="Clear Chat", command=self.clear_chat).pack(fill='x', padx=10, pady=2)
                ttk.Separator(self.sidebar, orient='horizontal').pack(fill='x', pady=10)
                ttk.Button(self.sidebar, text="Settings", command=self.show_settings).pack(fill='x', padx=10, pady=2)
        else:
            # Hide sidebar
            if hasattr(self, 'sidebar'):
                self.sidebar.pack_forget()
    
    def show_model_selector(self):
        """Show model selection dialog"""
        dialog = tk.Toplevel(self.root)
        dialog.title("Select Model")
        dialog.geometry("400x300")
        dialog.transient(self.root)
        dialog.grab_set()
        
        # Center the dialog
        dialog.update_idletasks()
        x = (dialog.winfo_screenwidth() // 2) - (dialog.winfo_width() // 2)
        y = (dialog.winfo_screenheight() // 2) - (dialog.winfo_height() // 2)
        dialog.geometry(f"+{x}+{y}")
        
        ttk.Label(dialog, text="Select AI Model:", font=('Arial', 10, 'bold')).pack(pady=10)
        
        # Model list
        model_frame = ttk.Frame(dialog)
        model_frame.pack(fill='both', expand=True, padx=20, pady=10)
        
        # Create listbox with scrollbar
        scrollbar = ttk.Scrollbar(model_frame)
        scrollbar.pack(side='right', fill='y')
        
        model_listbox = tk.Listbox(model_frame, yscrollcommand=scrollbar.set, height=10)
        model_listbox.pack(side='left', fill='both', expand=True)
        scrollbar.config(command=model_listbox.yview)
        
        # Get available models
        models = self.ollama_client.list_models() if hasattr(self, 'ollama_client') else []
        if not models:
            models = ['deepseek-coder:latest', 'llama2:latest', 'mistral:latest']
        
        for model in models:
            model_listbox.insert('end', model)
        
        # Select current model
        if hasattr(self, 'model_var'):
            current_model = self.model_var.get()
            for i, model in enumerate(models):
                if model == current_model:
                    model_listbox.selection_set(i)
                    model_listbox.see(i)
                    break
        
        # Buttons
        button_frame = ttk.Frame(dialog)
        button_frame.pack(pady=10)
        
        def select_model():
            selection = model_listbox.curselection()
            if selection:
                selected_model = models[selection[0]]
                if hasattr(self, 'model_var'):
                    self.model_var.set(selected_model)
                if hasattr(self, 'model_combo'):
                    self.model_combo.set(selected_model)
                dialog.destroy()
        
        ttk.Button(button_frame, text="Select", command=select_model).pack(side='left', padx=5)
        ttk.Button(button_frame, text="Cancel", command=dialog.destroy).pack(side='left', padx=5)
        
        # Double-click to select
        model_listbox.bind('<Double-Button-1>', lambda e: select_model())
        
        dialog.wait_window()
    
    def new_chat_session(self):
        """Create a new chat session"""
        if hasattr(self, 'new_chat'):
            self.new_chat()
        else:
            messagebox.showinfo("New Chat", "This feature requires a project to be loaded")
    
    def export_chat(self):
        """Export current chat"""
        if hasattr(self, 'export_current_chat'):
            self.export_current_chat()
        else:
            messagebox.showinfo("Export Chat", "No chat to export")
    
    def clear_chat(self):
        """Clear current chat"""
        if hasattr(self, 'chat_display'):
            if messagebox.askyesno("Clear Chat", "Are you sure you want to clear the chat?"):
                self.chat_display.delete('1.0', 'end')
                if hasattr(self, 'current_session') and self.current_session:
                    self.current_session.messages.clear()
    
    def show_settings(self):
        """Show settings dialog"""
        dialog = tk.Toplevel(self.root)
        dialog.title("Settings")
        dialog.geometry("400x300")
        dialog.transient(self.root)
        dialog.grab_set()
        
        # Center the dialog
        dialog.update_idletasks()
        x = (dialog.winfo_screenwidth() // 2) - (dialog.winfo_width() // 2)
        y = (dialog.winfo_screenheight() // 2) - (dialog.winfo_height() // 2)
        dialog.geometry(f"+{x}+{y}")
        
        notebook = ttk.Notebook(dialog)
        notebook.pack(fill='both', expand=True, padx=10, pady=10)
        
        # General settings
        general_frame = ttk.Frame(notebook)
        notebook.add(general_frame, text="General")
        
        ttk.Label(general_frame, text="Theme:").grid(row=0, column=0, padx=10, pady=10, sticky='w')
        theme_var = tk.StringVar(value="default")
        ttk.Combobox(general_frame, textvariable=theme_var, values=['default', 'dark', 'light'], state='readonly').grid(row=0, column=1, padx=10, pady=10)
        
        ttk.Label(general_frame, text="Font Size:").grid(row=1, column=0, padx=10, pady=10, sticky='w')
        font_size_var = tk.IntVar(value=10)
        ttk.Spinbox(general_frame, from_=8, to=16, textvariable=font_size_var, width=10).grid(row=1, column=1, padx=10, pady=10, sticky='w')
        
        # Ollama settings
        ollama_frame = ttk.Frame(notebook)
        notebook.add(ollama_frame, text="Ollama")
        
        ttk.Label(ollama_frame, text="Base URL:").grid(row=0, column=0, padx=10, pady=10, sticky='w')
        url_var = tk.StringVar(value="http://localhost:11434")
        ttk.Entry(ollama_frame, textvariable=url_var, width=30).grid(row=0, column=1, padx=10, pady=10)
        
        ttk.Label(ollama_frame, text="Timeout (seconds):").grid(row=1, column=0, padx=10, pady=10, sticky='w')
        timeout_var = tk.IntVar(value=300)
        ttk.Spinbox(ollama_frame, from_=30, to=600, textvariable=timeout_var, width=10).grid(row=1, column=1, padx=10, pady=10, sticky='w')
        
        # Buttons
        button_frame = ttk.Frame(dialog)
        button_frame.pack(pady=10)
        
        ttk.Button(button_frame, text="Save", command=lambda: messagebox.showinfo("Settings", "Settings saved (not implemented)")).pack(side='left', padx=5)
        ttk.Button(button_frame, text="Cancel", command=dialog.destroy).pack(side='left', padx=5)

def main():
    """Run enhanced ALFRED"""
    root = tk.Tk()
    app = EnhancedAlfredApp(root)
    root.mainloop()

if __name__ == "__main__":
    main()