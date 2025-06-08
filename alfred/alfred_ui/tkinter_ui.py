"""
Tkinter UI - Classic tkinter interface for ALFRED
"""

import tkinter as tk
from tkinter import ttk, scrolledtext, messagebox
import asyncio
import threading
from typing import Optional
import queue

from .base_ui import BaseUI, UICapabilities


class TkinterUI(BaseUI):
    """Classic tkinter UI implementation"""
    
    @property
    def capabilities(self) -> UICapabilities:
        return UICapabilities(
            supports_themes=False,
            supports_plugins=True,
            supports_shortcuts=True,
            supports_notifications=True,
            supports_markdown=False,
            supports_syntax_highlighting=False,
            supports_tabs=False,
            supports_split_view=False,
            is_graphical=True,
            is_web_based=False
        )
    
    def __init__(self, core: 'AlfredCore'):
        super().__init__(core)
        self.root: Optional[tk.Tk] = None
        self.chat_display: Optional[scrolledtext.ScrolledText] = None
        self.input_field: Optional[tk.Entry] = None
        self.send_button: Optional[ttk.Button] = None
        self.status_label: Optional[ttk.Label] = None
        
        # Thread-safe queue for UI updates
        self.ui_queue = queue.Queue()
        self._ui_thread_id = None
        
    async def initialize(self) -> None:
        """Initialize the tkinter UI"""
        # Create UI in a separate thread
        self._ui_thread = threading.Thread(target=self._run_ui_thread)
        self._ui_thread.daemon = True
        self._ui_thread.start()
        
        # Wait for UI to be ready
        await asyncio.sleep(0.5)
        
    def _run_ui_thread(self):
        """Run the UI in a separate thread"""
        self._ui_thread_id = threading.get_ident()
        self._create_ui()
        self._process_queue()
        self.root.mainloop()
        
    def _create_ui(self):
        """Create the tkinter UI elements"""
        self.root = tk.Tk()
        self.root.title("ALFRED - AI Assistant")
        self.root.geometry("800x600")
        
        # Configure grid
        self.root.grid_rowconfigure(0, weight=1)
        self.root.grid_columnconfigure(0, weight=1)
        
        # Main frame
        main_frame = ttk.Frame(self.root, padding="10")
        main_frame.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        main_frame.grid_rowconfigure(1, weight=1)
        main_frame.grid_columnconfigure(0, weight=1)
        
        # Header
        header_frame = ttk.Frame(main_frame)
        header_frame.grid(row=0, column=0, columnspan=2, sticky=(tk.W, tk.E), pady=(0, 10))
        
        title_label = ttk.Label(header_frame, text="ALFRED", font=('Arial', 16, 'bold'))
        title_label.pack(side=tk.LEFT)
        
        # Menu bar
        menubar = tk.Menu(self.root)
        self.root.config(menu=menubar)
        
        # File menu
        file_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="File", menu=file_menu)
        file_menu.add_command(label="New Chat", command=self._on_new_chat, accelerator="Ctrl+N")
        file_menu.add_command(label="Clear Chat", command=self._on_clear_chat, accelerator="Ctrl+L")
        file_menu.add_separator()
        file_menu.add_command(label="Settings", command=self._on_settings, accelerator="Ctrl+,")
        file_menu.add_separator()
        file_menu.add_command(label="Exit", command=self._on_exit, accelerator="Ctrl+Q")
        
        # Plugins menu
        plugins_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="Plugins", menu=plugins_menu)
        plugins_menu.add_command(label="Manage Plugins", command=self._on_manage_plugins)
        
        # Help menu
        help_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="Help", menu=help_menu)
        help_menu.add_command(label="About", command=self._on_about)
        
        # Chat display
        self.chat_display = scrolledtext.ScrolledText(
            main_frame, 
            wrap=tk.WORD, 
            width=60, 
            height=20,
            font=('Consolas', 10)
        )
        self.chat_display.grid(row=1, column=0, columnspan=2, sticky=(tk.W, tk.E, tk.N, tk.S))
        self.chat_display.config(state=tk.DISABLED)
        
        # Configure tags for formatting
        self.chat_display.tag_config("user", foreground="blue", font=('Consolas', 10, 'bold'))
        self.chat_display.tag_config("ai", foreground="green", font=('Consolas', 10, 'bold'))
        self.chat_display.tag_config("system", foreground="red", font=('Consolas', 10, 'italic'))
        
        # Input frame
        input_frame = ttk.Frame(main_frame)
        input_frame.grid(row=2, column=0, columnspan=2, sticky=(tk.W, tk.E), pady=(10, 0))
        input_frame.grid_columnconfigure(0, weight=1)
        
        # Input field
        self.input_field = ttk.Entry(input_frame, font=('Arial', 10))
        self.input_field.grid(row=0, column=0, sticky=(tk.W, tk.E), padx=(0, 5))
        self.input_field.bind("<Return>", lambda e: self._on_send())
        self.input_field.focus()
        
        # Send button
        self.send_button = ttk.Button(input_frame, text="Send", command=self._on_send)
        self.send_button.grid(row=0, column=1)
        
        # Status bar
        status_frame = ttk.Frame(main_frame)
        status_frame.grid(row=3, column=0, columnspan=2, sticky=(tk.W, tk.E), pady=(5, 0))
        
        self.status_label = ttk.Label(status_frame, text="Ready")
        self.status_label.pack(side=tk.LEFT)
        
        # Register shortcuts
        self.root.bind("<Control-n>", lambda e: self._on_new_chat())
        self.root.bind("<Control-l>", lambda e: self._on_clear_chat())
        self.root.bind("<Control-comma>", lambda e: self._on_settings())
        self.root.bind("<Control-q>", lambda e: self._on_exit())
        
        # Handle window close
        self.root.protocol("WM_DELETE_WINDOW", self._on_exit)
        
    def _process_queue(self):
        """Process UI update queue"""
        try:
            while True:
                try:
                    func, args = self.ui_queue.get_nowait()
                    func(*args)
                except queue.Empty:
                    break
        finally:
            # Schedule next queue processing
            if self.root:
                self.root.after(100, self._process_queue)
    
    def _thread_safe_call(self, func, *args):
        """Execute a function in the UI thread"""
        if threading.get_ident() == self._ui_thread_id:
            # Already in UI thread
            func(*args)
        else:
            # Queue for UI thread
            self.ui_queue.put((func, args))
    
    def _on_send(self):
        """Handle send button click"""
        message = self.input_field.get().strip()
        if not message:
            return
            
        # Clear input
        self.input_field.delete(0, tk.END)
        
        # Display user message
        self._append_message(f"You: {message}", "user")
        
        # Update status
        self._set_status("Thinking...")
        
        # Send message to core in background
        asyncio.run_coroutine_threadsafe(
            self._process_message(message),
            asyncio.get_event_loop()
        )
        
    async def _process_message(self, message: str):
        """Process user message"""
        try:
            response = await self.core.send_message(message)
            self._thread_safe_call(self._append_message, f"AI: {response}", "ai")
            self._thread_safe_call(self._set_status, "Ready")
        except Exception as e:
            self._thread_safe_call(self._append_message, f"Error: {str(e)}", "system")
            self._thread_safe_call(self._set_status, "Error")
    
    def _append_message(self, message: str, tag: str = None):
        """Append message to chat display"""
        self.chat_display.config(state=tk.NORMAL)
        self.chat_display.insert(tk.END, message + "\n\n", tag)
        self.chat_display.see(tk.END)
        self.chat_display.config(state=tk.DISABLED)
        
    def _set_status(self, status: str):
        """Update status label"""
        self.status_label.config(text=status)
    
    def _on_new_chat(self):
        """Handle new chat"""
        asyncio.run_coroutine_threadsafe(self.clear_chat(), asyncio.get_event_loop())
        
    def _on_clear_chat(self):
        """Handle clear chat"""
        asyncio.run_coroutine_threadsafe(self.clear_chat(), asyncio.get_event_loop())
        
    def _on_settings(self):
        """Handle settings menu"""
        messagebox.showinfo("Settings", "Settings dialog not implemented yet")
        
    def _on_manage_plugins(self):
        """Handle manage plugins menu"""
        plugins = self.core.plugin_manager.list_plugins()
        plugin_list = "\n".join([
            f"{'[Active]' if p['active'] else '[Inactive]'} {p['name']} v{p['version']}"
            for p in plugins
        ])
        messagebox.showinfo("Plugins", f"Available plugins:\n\n{plugin_list}")
        
    def _on_about(self):
        """Handle about menu"""
        messagebox.showinfo(
            "About ALFRED",
            "ALFRED - AI-Linked Framework for Rapid Engineering Development\n\n"
            "Version 0.1.0\n\n"
            "An extensible AI assistant with plugin support"
        )
        
    def _on_exit(self):
        """Handle exit"""
        self._running = False
        if self.root:
            self.root.quit()
    
    async def run(self) -> None:
        """Run the UI (this blocks in the UI thread)"""
        self._running = True
        # UI is already running in separate thread
        # Just wait for it to finish
        while self._running:
            await asyncio.sleep(0.1)
            
    async def stop(self) -> None:
        """Stop the UI"""
        self._running = False
        if self.root:
            self._thread_safe_call(self.root.quit)
            
    async def show_message(self, message: str, sender: str = "AI") -> None:
        """Display a message in the chat"""
        tag = "ai" if sender == "AI" else "user"
        self._thread_safe_call(self._append_message, f"{sender}: {message}", tag)
        
    async def get_user_input(self, prompt: str = "") -> str:
        """Get input from the user (not used in GUI mode)"""
        return ""
        
    async def clear_chat(self) -> None:
        """Clear the chat display"""
        def clear():
            self.chat_display.config(state=tk.NORMAL)
            self.chat_display.delete(1.0, tk.END)
            self.chat_display.config(state=tk.DISABLED)
        self._thread_safe_call(clear)
        
    async def show_notification(self, title: str, message: str, type: str = "info") -> None:
        """Show a notification"""
        if type == "error":
            self._thread_safe_call(messagebox.showerror, title, message)
        elif type == "warning":
            self._thread_safe_call(messagebox.showwarning, title, message)
        else:
            self._thread_safe_call(messagebox.showinfo, title, message)