"""Main UI application for Alfred."""

import tkinter as tk
from tkinter import ttk, messagebox
import asyncio
import threading
import logging
from typing import Optional

logger = logging.getLogger(__name__)


class AlfredUI:
    """Main UI application."""
    
    def __init__(self, app):
        self.app = app
        self.root = None
        self._running = False
        
    async def run(self):
        """Run the UI application."""
        # Create event loop for UI thread
        loop = asyncio.new_event_loop()
        
        # Run UI in main thread
        self._create_ui()
        
        # Start async tasks in background
        threading.Thread(target=self._run_async_tasks, args=(loop,), daemon=True).start()
        
        # Run tkinter mainloop
        self.root.mainloop()
        
    def _create_ui(self):
        """Create the UI."""
        self.root = tk.Tk()
        self.root.title("Alfred - Modular Edition")
        self.root.geometry("1200x800")
        
        # Create main frame
        main_frame = ttk.Frame(self.root)
        main_frame.pack(fill=tk.BOTH, expand=True)
        
        # Create label for now
        label = ttk.Label(
            main_frame, 
            text="Alfred Modular UI - Implementation in progress\n\nPlease use alfred_unified.py for the full experience.",
            font=('Arial', 14)
        )
        label.pack(expand=True)
        
        # Setup close handler
        self.root.protocol("WM_DELETE_WINDOW", self._on_close)
        
    def _run_async_tasks(self, loop):
        """Run async tasks in background."""
        asyncio.set_event_loop(loop)
        # Run any async tasks here
        
    def _on_close(self):
        """Handle window close."""
        self.root.destroy()