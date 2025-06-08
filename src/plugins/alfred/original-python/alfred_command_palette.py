#!/usr/bin/env python3
"""
ALFRED Command Palette Implementation
Quick access to all commands with fuzzy search (Ctrl+Shift+P)
"""

import tkinter as tk
from tkinter import ttk
from dataclasses import dataclass
from typing import List, Callable, Optional, Dict, Any
import re
from collections import defaultdict


@dataclass
class Command:
    """Represents a command in the palette"""
    name: str
    action: Callable
    category: str = "General"
    description: str = ""
    shortcut: Optional[str] = None
    keywords: List[str] = None
    icon: str = ""  # Unicode icon
    
    def __post_init__(self):
        if self.keywords is None:
            # Auto-generate keywords from name
            self.keywords = self.name.lower().split()


class FuzzyMatcher:
    """Fuzzy string matching for command search"""
    
    @staticmethod
    def score(query: str, text: str, keywords: List[str] = None) -> int:
        """
        Calculate fuzzy match score
        Higher score = better match
        """
        query = query.lower()
        text = text.lower()
        
        # Exact match
        if query == text:
            return 1000
        
        # Starts with query
        if text.startswith(query):
            return 900
        
        # Contains query as substring
        if query in text:
            # Bonus for match at word boundary
            words = text.split()
            for word in words:
                if word.startswith(query):
                    return 850
            return 800
        
        # Check keywords
        if keywords:
            for keyword in keywords:
                if query in keyword.lower():
                    return 750
        
        # Character sequence match (sublime-style)
        query_idx = 0
        match_positions = []
        
        for i, char in enumerate(text):
            if query_idx < len(query) and char == query[query_idx]:
                match_positions.append(i)
                query_idx += 1
        
        if query_idx == len(query):
            # All characters matched
            # Score based on match density (closer together = better)
            if len(match_positions) > 1:
                spread = match_positions[-1] - match_positions[0]
                density_score = 100 - spread
                return max(400 + density_score, 100)
            return 400
        
        return 0


class CommandPalette:
    """Command palette widget for ALFRED"""
    
    def __init__(self, app):
        self.app = app
        self.commands: List[Command] = []
        self.categories: Dict[str, str] = {}  # category -> icon
        self.recent_commands: List[str] = []  # Recently used command names
        self.max_recent = 5
        
        # Register default categories with icons
        self.register_category("File", "📁")
        self.register_category("Edit", "✏️")
        self.register_category("View", "👁️")
        self.register_category("Project", "📦")
        self.register_category("Chat", "💬")
        self.register_category("AI", "🤖")
        self.register_category("Tools", "🔧")
        self.register_category("Help", "❓")
        
        # Register default commands
        self._register_default_commands()
    
    def register_category(self, name: str, icon: str = ""):
        """Register a command category with optional icon"""
        self.categories[name] = icon
    
    def register_command(self, command: Command):
        """Register a new command"""
        self.commands.append(command)
    
    def _register_default_commands(self):
        """Register ALFRED's built-in commands"""
        
        # File commands
        self.register_command(Command(
            name="New Project",
            action=lambda: self.app.new_project(),
            category="File",
            description="Create a new ALFRED project",
            shortcut="Ctrl+N",
            keywords=["create", "project", "new", "start"]
        ))
        
        self.register_command(Command(
            name="Open Project",
            action=lambda: self.app.open_project(),
            category="File",
            description="Open an existing project",
            shortcut="Ctrl+O",
            keywords=["open", "load", "existing"]
        ))
        
        self.register_command(Command(
            name="Save Project",
            action=lambda: self.app.save_project(),
            category="File",
            description="Save the current project",
            shortcut="Ctrl+S",
            keywords=["save", "store"]
        ))
        
        # Chat commands
        self.register_command(Command(
            name="New Chat Session",
            action=lambda: self.app.new_chat(),
            category="Chat",
            description="Create a new chat session",
            shortcut="Ctrl+T",
            keywords=["chat", "conversation", "session", "tab"]
        ))
        
        self.register_command(Command(
            name="Delete Current Chat",
            action=lambda: self.app.delete_chat(),
            category="Chat",
            description="Delete the active chat session",
            keywords=["delete", "remove", "close", "chat"]
        ))
        
        self.register_command(Command(
            name="Clear Chat History",
            action=lambda: self.app.clear_chat_display(),
            category="Chat",
            description="Clear the current chat display",
            keywords=["clear", "clean", "reset", "history"]
        ))
        
        # AI commands
        self.register_command(Command(
            name="Change AI Model",
            action=lambda: self._show_model_selector(),
            category="AI",
            description="Select a different AI model",
            shortcut="Ctrl+M",
            keywords=["model", "change", "select", "ollama", "ai"]
        ))
        
        self.register_command(Command(
            name="Refresh Models",
            action=lambda: self.app.refresh_models(),
            category="AI",
            description="Refresh available AI models",
            keywords=["refresh", "reload", "models", "update"]
        ))
        
        self.register_command(Command(
            name="Test Ollama Connection",
            action=lambda: self.app.check_connection(),
            category="AI",
            description="Test connection to Ollama",
            keywords=["test", "check", "connection", "ollama", "status"]
        ))
        
        # View commands
        self.register_command(Command(
            name="View Logs",
            action=lambda: self.app.show_log_viewer() if hasattr(self.app, 'show_log_viewer') else None,
            category="View",
            description="Open the log viewer",
            keywords=["logs", "debug", "errors", "history"]
        ))
        
        self.register_command(Command(
            name="Toggle Full Screen",
            action=lambda: self._toggle_fullscreen(),
            category="View",
            description="Toggle fullscreen mode",
            shortcut="F11",
            keywords=["fullscreen", "maximize", "full"]
        ))
        
        # Tools commands
        self.register_command(Command(
            name="Add Context File",
            action=lambda: self.app.add_context_file(),
            category="Tools",
            description="Add a file to chat context",
            keywords=["context", "file", "add", "include"]
        ))
        
        self.register_command(Command(
            name="Remove Context File",
            action=lambda: self.app.remove_context_file(),
            category="Tools",
            description="Remove selected context file",
            keywords=["context", "remove", "delete", "file"]
        ))
        
        # Help commands
        self.register_command(Command(
            name="About ALFRED",
            action=lambda: self.app.show_about(),
            category="Help",
            description="Show about dialog",
            keywords=["about", "info", "version"]
        ))
        
        self.register_command(Command(
            name="Keyboard Shortcuts",
            action=lambda: self._show_shortcuts(),
            category="Help",
            description="Show all keyboard shortcuts",
            keywords=["shortcuts", "keys", "keyboard", "hotkeys"]
        ))
    
    def show(self, event=None):
        """Show the command palette dialog"""
        # Create dialog
        dialog = tk.Toplevel(self.app.root)
        dialog.title("")
        dialog.geometry("700x500")
        
        # Remove window decorations for cleaner look
        dialog.overrideredirect(True)
        dialog.configure(bg='#2b2b2b')
        
        # Center on parent window
        dialog.transient(self.app.root)
        dialog.update_idletasks()
        
        # Get parent window position and size
        parent_x = self.app.root.winfo_x()
        parent_y = self.app.root.winfo_y()
        parent_width = self.app.root.winfo_width()
        parent_height = self.app.root.winfo_height()
        
        # Calculate centered position
        dialog_width = 700
        dialog_height = 500
        x = parent_x + (parent_width - dialog_width) // 2
        y = parent_y + (parent_height - dialog_height) // 2 - 50
        
        dialog.geometry(f"{dialog_width}x{dialog_height}+{x}+{y}")
        
        # Make modal
        dialog.grab_set()
        
        # Main container with border
        main_frame = tk.Frame(dialog, bg='#3c3c3c', highlightbackground='#555', 
                             highlightthickness=1)
        main_frame.pack(fill='both', expand=True, padx=1, pady=1)
        
        # Search entry
        search_frame = tk.Frame(main_frame, bg='#3c3c3c')
        search_frame.pack(fill='x', padx=1, pady=1)
        
        search_var = tk.StringVar()
        search_entry = tk.Entry(
            search_frame,
            textvariable=search_var,
            font=('Segoe UI', 14),
            bg='#3c3c3c',
            fg='white',
            insertbackground='white',
            relief='flat',
            bd=10
        )
        search_entry.pack(fill='x', padx=10, pady=10)
        search_entry.focus()
        
        # Results container
        results_frame = tk.Frame(main_frame, bg='#2b2b2b')
        results_frame.pack(fill='both', expand=True)
        
        # Create canvas for scrolling
        canvas = tk.Canvas(results_frame, bg='#2b2b2b', highlightthickness=0)
        scrollbar = ttk.Scrollbar(results_frame, orient='vertical', command=canvas.yview)
        scrollable_frame = tk.Frame(canvas, bg='#2b2b2b')
        
        scrollable_frame.bind(
            "<Configure>",
            lambda e: canvas.configure(scrollregion=canvas.bbox("all"))
        )
        
        canvas.create_window((0, 0), window=scrollable_frame, anchor="nw")
        canvas.configure(yscrollcommand=scrollbar.set)
        
        canvas.pack(side='left', fill='both', expand=True)
        scrollbar.pack(side='right', fill='y')
        
        # Store widgets for updates
        self.result_widgets = []
        self.selected_index = 0
        self.filtered_commands = []
        
        def create_command_widget(command: Command, index: int) -> tk.Frame:
            """Create a widget for a command"""
            frame = tk.Frame(scrollable_frame, bg='#2b2b2b', cursor='hand2')
            frame.pack(fill='x', padx=10, pady=1)
            
            # Main content frame
            content = tk.Frame(frame, bg='#2b2b2b')
            content.pack(fill='x', padx=10, pady=5)
            
            # Icon and name
            name_frame = tk.Frame(content, bg='#2b2b2b')
            name_frame.pack(fill='x')
            
            icon = self.categories.get(command.category, "")
            name_text = f"{icon} {command.name}" if icon else command.name
            
            name_label = tk.Label(
                name_frame,
                text=name_text,
                font=('Segoe UI', 11),
                bg='#2b2b2b',
                fg='white',
                anchor='w'
            )
            name_label.pack(side='left')
            
            # Shortcut
            if command.shortcut:
                shortcut_label = tk.Label(
                    name_frame,
                    text=command.shortcut,
                    font=('Segoe UI', 9),
                    bg='#2b2b2b',
                    fg='#888',
                    anchor='e'
                )
                shortcut_label.pack(side='right', padx=10)
            
            # Description
            if command.description:
                desc_label = tk.Label(
                    content,
                    text=command.description,
                    font=('Segoe UI', 9),
                    bg='#2b2b2b',
                    fg='#aaa',
                    anchor='w'
                )
                desc_label.pack(fill='x')
            
            # Hover and click handlers
            def on_enter(e):
                if index != self.selected_index:
                    frame.configure(bg='#3c3c3c')
                    for child in frame.winfo_children():
                        child.configure(bg='#3c3c3c')
                        for subchild in child.winfo_children():
                            subchild.configure(bg='#3c3c3c')
            
            def on_leave(e):
                if index != self.selected_index:
                    frame.configure(bg='#2b2b2b')
                    for child in frame.winfo_children():
                        child.configure(bg='#2b2b2b')
                        for subchild in child.winfo_children():
                            subchild.configure(bg='#2b2b2b')
            
            def on_click(e):
                execute_command(index)
            
            frame.bind("<Enter>", on_enter)
            frame.bind("<Leave>", on_leave)
            frame.bind("<Button-1>", on_click)
            
            # Make all child widgets clickable too
            for child in frame.winfo_children():
                child.bind("<Button-1>", on_click)
                for subchild in child.winfo_children():
                    subchild.bind("<Button-1>", on_click)
            
            return frame
        
        def update_selection():
            """Update visual selection"""
            for i, (widget, _) in enumerate(self.result_widgets):
                if i == self.selected_index:
                    widget.configure(bg='#094771')
                    for child in widget.winfo_children():
                        child.configure(bg='#094771')
                        for subchild in child.winfo_children():
                            subchild.configure(bg='#094771')
                else:
                    widget.configure(bg='#2b2b2b')
                    for child in widget.winfo_children():
                        child.configure(bg='#2b2b2b')
                        for subchild in child.winfo_children():
                            subchild.configure(bg='#2b2b2b')
            
            # Scroll to selected item
            if self.result_widgets and 0 <= self.selected_index < len(self.result_widgets):
                widget = self.result_widgets[self.selected_index][0]
                canvas.see(widget)
        
        def update_results(*args):
            """Update search results"""
            query = search_var.get().strip()
            
            # Clear existing results
            for widget, _ in self.result_widgets:
                widget.destroy()
            self.result_widgets.clear()
            self.filtered_commands.clear()
            self.selected_index = 0
            
            if not query:
                # Show recent commands first, then all by category
                commands_to_show = []
                
                # Add recent commands
                for cmd_name in self.recent_commands:
                    for cmd in self.commands:
                        if cmd.name == cmd_name:
                            commands_to_show.append(cmd)
                            break
                
                # Add separator if we have recent commands
                if commands_to_show:
                    sep = tk.Frame(scrollable_frame, height=1, bg='#555')
                    sep.pack(fill='x', padx=20, pady=5)
                    self.result_widgets.append((sep, None))
                
                # Group by category
                by_category = defaultdict(list)
                for cmd in self.commands:
                    if cmd not in commands_to_show:  # Skip if already in recent
                        by_category[cmd.category].append(cmd)
                
                # Add all commands by category
                for category in sorted(by_category.keys()):
                    # Category header
                    cat_frame = tk.Frame(scrollable_frame, bg='#2b2b2b')
                    cat_frame.pack(fill='x', padx=10, pady=(10, 5))
                    
                    icon = self.categories.get(category, "")
                    cat_text = f"{icon} {category}" if icon else category
                    
                    cat_label = tk.Label(
                        cat_frame,
                        text=cat_text,
                        font=('Segoe UI', 9, 'bold'),
                        bg='#2b2b2b',
                        fg='#888'
                    )
                    cat_label.pack(anchor='w')
                    
                    self.result_widgets.append((cat_frame, None))
                    
                    # Add commands in category
                    for cmd in by_category[category]:
                        commands_to_show.append(cmd)
                
                self.filtered_commands = commands_to_show
            else:
                # Fuzzy search
                matches = []
                for cmd in self.commands:
                    score = FuzzyMatcher.score(query, cmd.name, cmd.keywords)
                    if score > 0:
                        matches.append((cmd, score))
                
                # Sort by score (highest first)
                matches.sort(key=lambda x: x[1], reverse=True)
                
                # Add to filtered commands
                self.filtered_commands = [cmd for cmd, _ in matches]
            
            # Create widgets for filtered commands
            for i, cmd in enumerate(self.filtered_commands):
                if isinstance(cmd, Command):  # Skip separators
                    widget = create_command_widget(cmd, len(self.result_widgets))
                    self.result_widgets.append((widget, cmd))
            
            # Update selection
            if self.result_widgets:
                update_selection()
        
        def execute_command(index=None):
            """Execute the selected command"""
            if index is None:
                index = self.selected_index
            
            if 0 <= index < len(self.result_widgets):
                _, command = self.result_widgets[index]
                if command and isinstance(command, Command):
                    # Add to recent commands
                    if command.name in self.recent_commands:
                        self.recent_commands.remove(command.name)
                    self.recent_commands.insert(0, command.name)
                    self.recent_commands = self.recent_commands[:self.max_recent]
                    
                    # Close dialog
                    dialog.destroy()
                    
                    # Execute command
                    try:
                        command.action()
                    except Exception as e:
                        print(f"Error executing command '{command.name}': {e}")
        
        def on_key(event):
            """Handle keyboard navigation"""
            if event.keysym == 'Down':
                if self.selected_index < len(self.result_widgets) - 1:
                    self.selected_index += 1
                    # Skip non-command items
                    while (self.selected_index < len(self.result_widgets) and 
                           self.result_widgets[self.selected_index][1] is None):
                        self.selected_index += 1
                    update_selection()
                return 'break'
            
            elif event.keysym == 'Up':
                if self.selected_index > 0:
                    self.selected_index -= 1
                    # Skip non-command items
                    while (self.selected_index >= 0 and 
                           self.result_widgets[self.selected_index][1] is None):
                        self.selected_index -= 1
                    if self.selected_index < 0:
                        self.selected_index = 0
                    update_selection()
                return 'break'
            
            elif event.keysym == 'Return':
                execute_command()
                return 'break'
            
            elif event.keysym == 'Escape':
                dialog.destroy()
                return 'break'
        
        # Bind events
        search_var.trace('w', update_results)
        search_entry.bind('<Down>', on_key)
        search_entry.bind('<Up>', on_key)
        search_entry.bind('<Return>', on_key)
        search_entry.bind('<Escape>', on_key)
        
        # Also bind to dialog for when focus is elsewhere
        dialog.bind('<Escape>', lambda e: dialog.destroy())
        
        # Initialize with all commands
        update_results()
        
        # For mouse wheel scrolling
        def on_mousewheel(event):
            canvas.yview_scroll(int(-1*(event.delta/120)), "units")
        
        canvas.bind_all("<MouseWheel>", on_mousewheel)
        
        # Cleanup mouse wheel binding when dialog closes
        def on_close():
            canvas.unbind_all("<MouseWheel>")
        
        dialog.protocol("WM_DELETE_WINDOW", on_close)
    
    def _show_model_selector(self):
        """Show model selection dialog"""
        if hasattr(self.app, 'model_combo') and self.app.model_combo['values']:
            # Simple model selector
            dialog = tk.Toplevel(self.app.root)
            dialog.title("Select AI Model")
            dialog.geometry("400x300")
            dialog.transient(self.app.root)
            dialog.grab_set()
            
            ttk.Label(dialog, text="Select AI Model:", font=('Arial', 12)).pack(pady=10)
            
            models = self.app.model_combo['values']
            
            listbox = tk.Listbox(dialog, font=('Consolas', 10))
            listbox.pack(fill='both', expand=True, padx=20, pady=10)
            
            for model in models:
                listbox.insert('end', model)
            
            # Select current model
            current = self.app.model_var.get()
            for i, model in enumerate(models):
                if model == current:
                    listbox.selection_set(i)
                    listbox.see(i)
                    break
            
            def select_model():
                selection = listbox.curselection()
                if selection:
                    model = listbox.get(selection[0])
                    self.app.model_var.set(model)
                    dialog.destroy()
            
            ttk.Button(dialog, text="Select", command=select_model).pack(pady=10)
            
            listbox.bind('<Double-Button-1>', lambda e: select_model())
            listbox.bind('<Return>', lambda e: select_model())
    
    def _toggle_fullscreen(self):
        """Toggle fullscreen mode"""
        current_state = self.app.root.attributes('-fullscreen')
        self.app.root.attributes('-fullscreen', not current_state)
    
    def _show_shortcuts(self):
        """Show keyboard shortcuts dialog"""
        dialog = tk.Toplevel(self.app.root)
        dialog.title("Keyboard Shortcuts")
        dialog.geometry("500x600")
        dialog.transient(self.app.root)
        
        # Create scrolled text widget
        text = tk.Text(dialog, font=('Consolas', 10), wrap='word')
        scroll = ttk.Scrollbar(dialog, command=text.yview)
        text.configure(yscrollcommand=scroll.set)
        
        text.pack(side='left', fill='both', expand=True)
        scroll.pack(side='right', fill='y')
        
        # Add shortcuts
        shortcuts_text = "ALFRED Keyboard Shortcuts\n" + "=" * 40 + "\n\n"
        
        # Group shortcuts by category
        by_category = defaultdict(list)
        for cmd in self.commands:
            if cmd.shortcut:
                by_category[cmd.category].append(cmd)
        
        for category in sorted(by_category.keys()):
            shortcuts_text += f"\n{category}:\n"
            for cmd in by_category[category]:
                shortcuts_text += f"  {cmd.shortcut:<20} {cmd.name}\n"
        
        # Add special shortcuts
        shortcuts_text += "\nSpecial:\n"
        shortcuts_text += f"  {'Ctrl+Shift+P':<20} Open Command Palette\n"
        shortcuts_text += f"  {'Ctrl+Enter':<20} Send Message\n"
        shortcuts_text += f"  {'F11':<20} Toggle Fullscreen\n"
        
        text.insert('1.0', shortcuts_text)
        text.configure(state='disabled')
        
        ttk.Button(dialog, text="Close", command=dialog.destroy).pack(pady=10)


# Extension function to add to existing ALFRED app
def add_command_palette(app):
    """Add command palette to existing ALFRED app"""
    # Create command palette
    app.command_palette = CommandPalette(app)
    
    # Bind keyboard shortcut
    app.root.bind('<Control-Shift-P>', app.command_palette.show)
    app.root.bind('<Control-Shift-p>', app.command_palette.show)  # Handle lowercase too
    
    # Add to menu if there's a menu bar
    if hasattr(app, 'menubar'):
        app.menubar.add_command(label="Command Palette", 
                               command=app.command_palette.show,
                               accelerator="Ctrl+Shift+P")
    
    return app.command_palette


if __name__ == "__main__":
    # Demo the command palette
    from alfred import AlfredApp
    
    root = tk.Tk()
    app = AlfredApp(root)
    
    # Add command palette
    palette = add_command_palette(app)
    
    # Add some custom commands for demo
    palette.register_command(Command(
        name="Custom Command 1",
        action=lambda: print("Custom command 1 executed!"),
        category="Tools",
        description="This is a custom command",
        keywords=["custom", "demo", "test"]
    ))
    
    palette.register_command(Command(
        name="Custom Command 2",
        action=lambda: app.status_var.set("Custom command 2 executed!"),
        category="Tools",
        description="Another custom command",
        shortcut="Ctrl+Alt+2"
    ))
    
    print("ALFRED with Command Palette")
    print("Press Ctrl+Shift+P to open the command palette")
    
    root.mainloop()