"""
Base UI Interface - Abstract base class for all UI implementations
"""

from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, List, Callable
from dataclasses import dataclass
import asyncio


@dataclass
class UICapabilities:
    """Defines what a UI implementation can do"""
    supports_themes: bool = True
    supports_plugins: bool = True
    supports_shortcuts: bool = True
    supports_notifications: bool = True
    supports_markdown: bool = True
    supports_syntax_highlighting: bool = True
    supports_tabs: bool = False
    supports_split_view: bool = False
    is_graphical: bool = True
    is_web_based: bool = False


class BaseUI(ABC):
    """Abstract base class for ALFRED UI implementations"""
    
    def __init__(self, core: 'AlfredCore'):
        self.core = core
        self.ui_type = self.__class__.__name__
        self._running = False
        self._event_handlers: Dict[str, List[Callable]] = {}
        
    @property
    @abstractmethod
    def capabilities(self) -> UICapabilities:
        """Return UI capabilities"""
        pass
        
    @abstractmethod
    async def initialize(self) -> None:
        """Initialize the UI"""
        pass
        
    @abstractmethod
    async def run(self) -> None:
        """Run the UI main loop"""
        pass
        
    @abstractmethod
    async def stop(self) -> None:
        """Stop the UI"""
        pass
        
    @abstractmethod
    async def show_message(self, message: str, sender: str = "AI") -> None:
        """Display a message in the chat"""
        pass
        
    @abstractmethod
    async def get_user_input(self, prompt: str = "") -> str:
        """Get input from the user"""
        pass
        
    @abstractmethod
    async def clear_chat(self) -> None:
        """Clear the chat display"""
        pass
        
    @abstractmethod
    async def show_notification(self, title: str, message: str, type: str = "info") -> None:
        """Show a notification to the user"""
        pass
        
    async def show_settings(self) -> None:
        """Show settings dialog (optional)"""
        if self.capabilities.supports_plugins:
            raise NotImplementedError("Settings not implemented for this UI")
            
    async def show_command_palette(self) -> None:
        """Show command palette (optional)"""
        if self.capabilities.supports_shortcuts:
            raise NotImplementedError("Command palette not implemented for this UI")
            
    def register_shortcut(self, shortcut: str, callback: Callable) -> None:
        """Register a keyboard shortcut"""
        if not self.capabilities.supports_shortcuts:
            return
        # Implementation depends on UI toolkit
        
    def register_event_handler(self, event: str, handler: Callable) -> None:
        """Register an event handler"""
        if event not in self._event_handlers:
            self._event_handlers[event] = []
        self._event_handlers[event].append(handler)
        
    def emit_event(self, event: str, data: Any = None) -> None:
        """Emit a UI event"""
        if event in self._event_handlers:
            for handler in self._event_handlers[event]:
                try:
                    if asyncio.iscoroutinefunction(handler):
                        asyncio.create_task(handler(data))
                    else:
                        handler(data)
                except Exception as e:
                    print(f"Error in event handler: {e}")
                    
    async def handle_plugin_ui(self, plugin_name: str, ui_data: Dict[str, Any]) -> Any:
        """Handle plugin UI requests"""
        # Default implementation does nothing
        return None
        
    def get_theme(self) -> Dict[str, Any]:
        """Get current theme settings"""
        return self.core.config.get("ui.theme_settings", {})
        
    def set_theme(self, theme: Dict[str, Any]) -> None:
        """Set theme settings"""
        self.core.update_config("ui.theme_settings", theme)