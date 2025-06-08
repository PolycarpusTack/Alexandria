"""
Plugin Manager - Core plugin system for ALFRED
"""

import os
import json
import importlib.util
import logging
from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional, Callable
from dataclasses import dataclass
from pathlib import Path
import inspect

logger = logging.getLogger(__name__)


@dataclass
class PluginMetadata:
    """Plugin metadata container"""
    name: str
    version: str
    author: str
    description: str
    ui_support: List[str]
    dependencies: List[str] = None
    permissions: List[str] = None
    
    def __post_init__(self):
        if self.dependencies is None:
            self.dependencies = []
        if self.permissions is None:
            self.permissions = []


class Plugin(ABC):
    """Base class for all ALFRED plugins"""
    
    def __init__(self):
        self._app: Optional['AlfredCore'] = None
        self._config: Dict[str, Any] = {}
        self._commands: Dict[str, Callable] = {}
        self._event_handlers: Dict[str, List[Callable]] = {}
        
    @property
    @abstractmethod
    def metadata(self) -> PluginMetadata:
        """Plugin metadata"""
        pass
    
    @abstractmethod
    def activate(self, app: 'AlfredCore') -> None:
        """Called when plugin is activated"""
        pass
    
    @abstractmethod
    def deactivate(self) -> None:
        """Called when plugin is deactivated"""
        pass
    
    def get_commands(self) -> Dict[str, Callable]:
        """Return command palette commands"""
        return self._commands
    
    def get_settings_schema(self) -> Dict[str, Any]:
        """Return plugin settings schema for UI generation"""
        return {}
    
    def configure(self, settings: Dict[str, Any]) -> None:
        """Apply configuration settings"""
        self._config.update(settings)
    
    def register_command(self, name: str, handler: Callable, description: str = "") -> None:
        """Register a command for the command palette"""
        self._commands[name] = {
            'handler': handler,
            'description': description,
            'plugin': self.metadata.name
        }
    
    def subscribe_event(self, event: str, handler: Callable) -> None:
        """Subscribe to an application event"""
        if event not in self._event_handlers:
            self._event_handlers[event] = []
        self._event_handlers[event].append(handler)
    
    def emit_event(self, event: str, data: Any = None) -> None:
        """Emit an event to the application"""
        if self._app:
            self._app.event_bus.emit(f"plugin.{self.metadata.name}.{event}", data)


class PluginManager:
    """Manages plugin lifecycle and operations"""
    
    def __init__(self, plugin_dir: str = "plugins"):
        self.plugin_dir = Path(plugin_dir)
        self.plugins: Dict[str, Plugin] = {}
        self.active_plugins: Dict[str, Plugin] = {}
        self._app: Optional['AlfredCore'] = None
        
    def initialize(self, app: 'AlfredCore') -> None:
        """Initialize the plugin manager with app reference"""
        self._app = app
        self.discover_plugins()
        
    def discover_plugins(self) -> List[str]:
        """Discover available plugins"""
        discovered = []
        
        if not self.plugin_dir.exists():
            logger.warning(f"Plugin directory {self.plugin_dir} does not exist")
            return discovered
            
        for item in self.plugin_dir.iterdir():
            if item.is_dir() and (item / "__init__.py").exists():
                plugin_name = item.name
                try:
                    self.load_plugin(plugin_name)
                    discovered.append(plugin_name)
                except Exception as e:
                    logger.error(f"Failed to load plugin {plugin_name}: {e}")
                    
        logger.info(f"Discovered {len(discovered)} plugins: {discovered}")
        return discovered
    
    def load_plugin(self, plugin_name: str) -> Plugin:
        """Load a plugin by name"""
        if plugin_name in self.plugins:
            return self.plugins[plugin_name]
            
        plugin_path = self.plugin_dir / plugin_name
        if not plugin_path.exists():
            raise FileNotFoundError(f"Plugin {plugin_name} not found")
            
        # Load plugin module
        spec = importlib.util.spec_from_file_location(
            f"plugins.{plugin_name}",
            plugin_path / "__init__.py"
        )
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        
        # Find Plugin subclass
        plugin_class = None
        for name, obj in inspect.getmembers(module):
            if (inspect.isclass(obj) and 
                issubclass(obj, Plugin) and 
                obj is not Plugin):
                plugin_class = obj
                break
                
        if not plugin_class:
            raise ValueError(f"No Plugin subclass found in {plugin_name}")
            
        # Instantiate plugin
        plugin_instance = plugin_class()
        self.plugins[plugin_name] = plugin_instance
        
        logger.info(f"Loaded plugin: {plugin_name} v{plugin_instance.metadata.version}")
        return plugin_instance
    
    def activate_plugin(self, plugin_name: str) -> None:
        """Activate a plugin"""
        if plugin_name in self.active_plugins:
            logger.warning(f"Plugin {plugin_name} is already active")
            return
            
        if plugin_name not in self.plugins:
            self.load_plugin(plugin_name)
            
        plugin = self.plugins[plugin_name]
        
        # Check dependencies
        for dep in plugin.metadata.dependencies:
            if dep not in self.active_plugins:
                logger.info(f"Activating dependency {dep} for {plugin_name}")
                self.activate_plugin(dep)
        
        # Check permissions
        if self._app and not self._app.security.check_plugin_permissions(
            plugin_name, 
            plugin.metadata.permissions
        ):
            raise PermissionError(f"Plugin {plugin_name} requires permissions: {plugin.metadata.permissions}")
        
        # Activate the plugin
        plugin.activate(self._app)
        self.active_plugins[plugin_name] = plugin
        
        # Register commands
        if self._app:
            for cmd_name, cmd_info in plugin.get_commands().items():
                self._app.command_registry.register(
                    f"{plugin_name}:{cmd_name}",
                    cmd_info
                )
        
        # Emit activation event
        if self._app:
            self._app.event_bus.emit("plugin.activated", {
                "name": plugin_name,
                "version": plugin.metadata.version
            })
            
        logger.info(f"Activated plugin: {plugin_name}")
    
    def deactivate_plugin(self, plugin_name: str) -> None:
        """Deactivate a plugin"""
        if plugin_name not in self.active_plugins:
            logger.warning(f"Plugin {plugin_name} is not active")
            return
            
        plugin = self.active_plugins[plugin_name]
        
        # Check if other plugins depend on this one
        dependents = []
        for name, p in self.active_plugins.items():
            if plugin_name in p.metadata.dependencies:
                dependents.append(name)
                
        if dependents:
            raise RuntimeError(f"Cannot deactivate {plugin_name}, required by: {dependents}")
        
        # Deactivate the plugin
        plugin.deactivate()
        del self.active_plugins[plugin_name]
        
        # Unregister commands
        if self._app:
            for cmd_name in plugin.get_commands():
                self._app.command_registry.unregister(f"{plugin_name}:{cmd_name}")
        
        # Emit deactivation event
        if self._app:
            self._app.event_bus.emit("plugin.deactivated", {"name": plugin_name})
            
        logger.info(f"Deactivated plugin: {plugin_name}")
    
    def get_plugin_info(self, plugin_name: str) -> Dict[str, Any]:
        """Get information about a plugin"""
        if plugin_name not in self.plugins:
            try:
                self.load_plugin(plugin_name)
            except Exception:
                return None
                
        plugin = self.plugins[plugin_name]
        return {
            "name": plugin.metadata.name,
            "version": plugin.metadata.version,
            "author": plugin.metadata.author,
            "description": plugin.metadata.description,
            "ui_support": plugin.metadata.ui_support,
            "dependencies": plugin.metadata.dependencies,
            "permissions": plugin.metadata.permissions,
            "active": plugin_name in self.active_plugins,
            "commands": list(plugin.get_commands().keys())
        }
    
    def list_plugins(self) -> List[Dict[str, Any]]:
        """List all available plugins"""
        plugins = []
        for name in self.plugins:
            info = self.get_plugin_info(name)
            if info:
                plugins.append(info)
        return plugins
    
    def configure_plugin(self, plugin_name: str, settings: Dict[str, Any]) -> None:
        """Configure a plugin's settings"""
        if plugin_name not in self.plugins:
            raise ValueError(f"Plugin {plugin_name} not found")
            
        plugin = self.plugins[plugin_name]
        plugin.configure(settings)
        
        # Save configuration
        config_file = self.plugin_dir / plugin_name / "config.json"
        with open(config_file, 'w') as f:
            json.dump(settings, f, indent=2)
            
        logger.info(f"Configured plugin: {plugin_name}")
    
    def get_plugin_config(self, plugin_name: str) -> Dict[str, Any]:
        """Get a plugin's configuration"""
        config_file = self.plugin_dir / plugin_name / "config.json"
        if config_file.exists():
            with open(config_file, 'r') as f:
                return json.load(f)
        return {}