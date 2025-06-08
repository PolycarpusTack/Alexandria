"""Plugin manager for loading and managing plugins."""

import importlib
import importlib.util
import logging
import asyncio
from pathlib import Path
from typing import Dict, List, Optional, Type

from .base import Plugin, PluginMetadata
from .registry import PluginRegistry
from ..core.events import event_bus, Event

logger = logging.getLogger(__name__)


class PluginManager:
    """Manages plugin lifecycle."""
    
    def __init__(self, app):
        self.app = app
        self.registry = PluginRegistry()
        self.plugins: Dict[str, Plugin] = {}
        self._loading = False
        
    async def load_plugins(self) -> None:
        """Load all plugins."""
        if self._loading:
            return
            
        self._loading = True
        
        try:
            # Load built-in plugins
            await self._load_builtin_plugins()
            
            # Load user plugins
            await self._load_user_plugins()
            
            # Initialize all plugins
            await self._initialize_plugins()
            
            logger.info(f"Loaded {len(self.plugins)} plugins")
            
        finally:
            self._loading = False
            
    async def _load_builtin_plugins(self) -> None:
        """Load built-in plugins."""
        builtin_dir = Path(__file__).parent / "builtin"
        if not builtin_dir.exists():
            return
            
        for plugin_dir in builtin_dir.iterdir():
            if plugin_dir.is_dir() and (plugin_dir / "__init__.py").exists():
                await self._load_plugin_from_path(plugin_dir)
                
    async def _load_user_plugins(self) -> None:
        """Load user plugins."""
        plugins_dir = self.app.persistence.base_path / "plugins"
        if not plugins_dir.exists():
            return
            
        for plugin_dir in plugins_dir.iterdir():
            if plugin_dir.is_dir() and (plugin_dir / "__init__.py").exists():
                await self._load_plugin_from_path(plugin_dir)
                
    async def _load_plugin_from_path(self, path: Path) -> Optional[Plugin]:
        """Load a plugin from a directory path."""
        try:
            # Load the module
            module_name = f"alfred_plugin_{path.name}"
            spec = importlib.util.spec_from_file_location(
                module_name,
                path / "__init__.py"
            )
            
            if spec and spec.loader:
                module = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(module)
                
                # Find plugin class
                plugin_class = None
                for attr_name in dir(module):
                    attr = getattr(module, attr_name)
                    if (isinstance(attr, type) and 
                        issubclass(attr, Plugin) and 
                        attr != Plugin):
                        plugin_class = attr
                        break
                        
                if plugin_class:
                    # Create plugin instance
                    plugin = plugin_class(self.app)
                    
                    # Register plugin
                    self.registry.register(plugin_class, plugin.metadata)
                    self.plugins[plugin.metadata.name] = plugin
                    
                    logger.info(f"Loaded plugin: {plugin.metadata.name}")
                    return plugin
                    
        except Exception as e:
            logger.error(f"Failed to load plugin from {path}: {e}")
            
        return None
        
    async def _initialize_plugins(self) -> None:
        """Initialize all loaded plugins."""
        tasks = []
        for plugin in self.plugins.values():
            tasks.append(self._initialize_plugin(plugin))
            
        await asyncio.gather(*tasks, return_exceptions=True)
        
    async def _initialize_plugin(self, plugin: Plugin) -> None:
        """Initialize a single plugin."""
        try:
            # Check dependencies
            for dep in plugin.metadata.dependencies:
                if dep not in self.plugins:
                    logger.warning(
                        f"Plugin {plugin.metadata.name} missing dependency: {dep}"
                    )
                    return
                    
            # Initialize
            await plugin.initialize()
            
            # Enable by default
            await plugin.enable()
            
            # Emit event
            event_bus.emit(Event("plugin.loaded", plugin))
            
        except Exception as e:
            logger.error(f"Failed to initialize plugin {plugin.metadata.name}: {e}")
            
    async def unload_plugins(self) -> None:
        """Unload all plugins."""
        tasks = []
        for plugin in self.plugins.values():
            tasks.append(self._unload_plugin(plugin))
            
        await asyncio.gather(*tasks, return_exceptions=True)
        
        self.plugins.clear()
        self.registry.clear()
        
    async def _unload_plugin(self, plugin: Plugin) -> None:
        """Unload a single plugin."""
        try:
            # Disable first
            await plugin.disable()
            
            # Shutdown
            await plugin.shutdown()
            
            # Emit event
            event_bus.emit(Event("plugin.unloaded", plugin))
            
        except Exception as e:
            logger.error(f"Failed to unload plugin {plugin.metadata.name}: {e}")
            
    async def reload_plugin(self, plugin_name: str) -> bool:
        """Reload a plugin."""
        plugin = self.plugins.get(plugin_name)
        if not plugin:
            return False
            
        # Unload
        await self._unload_plugin(plugin)
        del self.plugins[plugin_name]
        
        # Reload from registry
        plugin_info = self.registry.get(plugin_name)
        if plugin_info:
            plugin_class = plugin_info["class"]
            new_plugin = plugin_class(self.app)
            self.plugins[plugin_name] = new_plugin
            await self._initialize_plugin(new_plugin)
            return True
            
        return False
        
    def get_plugin(self, name: str) -> Optional[Plugin]:
        """Get a plugin by name."""
        return self.plugins.get(name)
        
    def list_plugins(self) -> List[Plugin]:
        """List all loaded plugins."""
        return list(self.plugins.values())
        
    def is_enabled(self, name: str) -> bool:
        """Check if a plugin is enabled."""
        plugin = self.plugins.get(name)
        return plugin.enabled if plugin else False
        
    async def enable_plugin(self, name: str) -> bool:
        """Enable a plugin."""
        plugin = self.plugins.get(name)
        if plugin:
            await plugin.enable()
            return True
        return False
        
    async def disable_plugin(self, name: str) -> bool:
        """Disable a plugin."""
        plugin = self.plugins.get(name)
        if plugin:
            await plugin.disable()
            return True
        return False