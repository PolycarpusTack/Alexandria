"""Base plugin interface."""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional, List, Dict, Any
from pathlib import Path


@dataclass
class PluginMetadata:
    """Plugin metadata."""
    name: str
    version: str
    description: str
    author: str
    dependencies: List[str] = None
    config_schema: Dict[str, Any] = None
    
    def __post_init__(self):
        if self.dependencies is None:
            self.dependencies = []
        if self.config_schema is None:
            self.config_schema = {}


class Plugin(ABC):
    """Base plugin class."""
    
    def __init__(self, app):
        """Initialize plugin with app reference."""
        self.app = app
        self._enabled = False
        
    @property
    @abstractmethod
    def metadata(self) -> PluginMetadata:
        """Plugin metadata."""
        pass
        
    @abstractmethod
    async def initialize(self) -> None:
        """Initialize the plugin."""
        pass
        
    @abstractmethod
    async def shutdown(self) -> None:
        """Shutdown the plugin."""
        pass
        
    async def enable(self) -> None:
        """Enable the plugin."""
        if not self._enabled:
            await self.on_enable()
            self._enabled = True
            
    async def disable(self) -> None:
        """Disable the plugin."""
        if self._enabled:
            await self.on_disable()
            self._enabled = False
            
    async def on_enable(self) -> None:
        """Called when plugin is enabled."""
        pass
        
    async def on_disable(self) -> None:
        """Called when plugin is disabled."""
        pass
        
    @property
    def enabled(self) -> bool:
        """Check if plugin is enabled."""
        return self._enabled
        
    def get_config(self) -> Dict[str, Any]:
        """Get plugin configuration."""
        config_file = self.app.persistence.get_config_file(f"plugin_{self.metadata.name}")
        data = self.app.persistence.load_json(config_file)
        return data or {}
        
    def save_config(self, config: Dict[str, Any]) -> bool:
        """Save plugin configuration."""
        config_file = self.app.persistence.get_config_file(f"plugin_{self.metadata.name}")
        return self.app.persistence.save_json(config, config_file)
        
    def subscribe_event(self, event_name: str, handler: callable) -> None:
        """Subscribe to an application event."""
        self.app.event_bus.subscribe(event_name, handler)
        
    def unsubscribe_event(self, event_name: str, handler: callable) -> None:
        """Unsubscribe from an application event."""
        self.app.event_bus.unsubscribe(event_name, handler)
        
    def emit_event(self, event_name: str, data: Any = None) -> None:
        """Emit an event."""
        from ..core.events import Event
        self.app.event_bus.emit(Event(event_name, data))


class UIPlugin(Plugin):
    """Base class for plugins that provide UI components."""
    
    @abstractmethod
    def get_menu_items(self) -> List[Dict[str, Any]]:
        """Get menu items to add to the application menu."""
        pass
        
    @abstractmethod
    def get_toolbar_items(self) -> List[Dict[str, Any]]:
        """Get toolbar items to add to the application toolbar."""
        pass
        
    @abstractmethod
    def get_panels(self) -> List[Dict[str, Any]]:
        """Get panels to add to the application."""
        pass


class FeaturePlugin(Plugin):
    """Base class for plugins that add features."""
    
    @abstractmethod
    def get_commands(self) -> List[Dict[str, Any]]:
        """Get commands to register with the command palette."""
        pass
        
    @abstractmethod
    def get_templates(self) -> List[Dict[str, Any]]:
        """Get project templates provided by this plugin."""
        pass


class IntegrationPlugin(Plugin):
    """Base class for plugins that integrate with external services."""
    
    @abstractmethod
    async def test_connection(self) -> bool:
        """Test connection to the external service."""
        pass
        
    @abstractmethod
    def get_status(self) -> Dict[str, Any]:
        """Get integration status."""
        pass