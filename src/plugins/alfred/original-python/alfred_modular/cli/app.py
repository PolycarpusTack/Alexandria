"""CLI application for Alfred."""

import asyncio
import logging
from typing import Optional

logger = logging.getLogger(__name__)


class AlfredCLI:
    """CLI interface for Alfred."""
    
    def __init__(self, app):
        self.app = app
        self._running = False
        
    async def run(self):
        """Run the CLI application."""
        print("Alfred CLI - Coming soon!")
        print("Please use alfred_unified.py for the full experience.")
        
        # Basic CLI loop
        self._running = True
        while self._running:
            try:
                command = input("\nAlfred> ")
                if command.lower() in ['exit', 'quit', 'q']:
                    break
                elif command.lower() == 'help':
                    self._show_help()
                else:
                    print(f"Command '{command}' not implemented yet.")
            except KeyboardInterrupt:
                break
                
        print("\nGoodbye!")
        
    def _show_help(self):
        """Show help message."""
        print("""
Available commands:
  help  - Show this help
  exit  - Exit Alfred
  quit  - Exit Alfred
  q     - Exit Alfred
        
Full CLI implementation coming soon!
        """)