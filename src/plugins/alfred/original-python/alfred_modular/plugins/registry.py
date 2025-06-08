"""Plugin registry for tracking available plugins."""

import logging
from typing import Dict, List, Type, Optional

from .base import Plugin, PluginMetadata

logger = logging.getLogger(__name__)


class PluginRegistry:
    """Registry for available plugins."""
    
    def __init__(self):
        self._plugins: Dict[str, Dict] = {}
        
    def register(self, plugin_class: Type[Plugin], metadata: PluginMetadata) -> None:
        """Register a plugin."""
        if metadata.name in self._plugins:
            logger.warning(f"Plugin {metadata.name} already registered, overwriting")
            
        self._plugins[metadata.name] = {
            "class": plugin_class,
            "metadata": metadata
        }
        
        logger.debug(f"Registered plugin: {metadata.name} v{metadata.version}")
        
    def unregister(self, name: str) -> bool:
        """Unregister a plugin."""
        if name in self._plugins:
            del self._plugins[name]
            logger.debug(f"Unregistered plugin: {name}")
            return True
        return False
        
    def get(self, name: str) -> Optional[Dict]:
        """Get plugin info by name."""
        return self._plugins.get(name)
        
    def list_plugins(self) -> List[PluginMetadata]:
        """List all registered plugins."""
        return [info["metadata"] for info in self._plugins.values()]
        
    def find_by_author(self, author: str) -> List[PluginMetadata]:
        """Find plugins by author."""
        return [
            info["metadata"] 
            for info in self._plugins.values()
            if info["metadata"].author == author
        ]
        
    def find_by_dependency(self, dependency: str) -> List[PluginMetadata]:
        """Find plugins that depend on a specific plugin."""
        return [
            info["metadata"]
            for info in self._plugins.values()
            if dependency in info["metadata"].dependencies
        ]
        
    def clear(self) -> None:
        """Clear the registry."""
        self._plugins.clear()
        
    def __len__(self) -> int:
        """Number of registered plugins."""
        return len(self._plugins)
        
    def __contains__(self, name: str) -> bool:
        """Check if a plugin is registered."""
        return name in self._plugins