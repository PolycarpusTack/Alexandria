"""
ALFRED Core - Main application class that coordinates all components
"""

import logging
import asyncio
from typing import Dict, Any, Optional, List, Callable
from pathlib import Path
import json

from .plugin_manager import PluginManager
from .security import SecurityManager
from .config import ConfigManager
from .ai_manager import AIManager
from .event_bus import EventBus, Event

logger = logging.getLogger(__name__)


class CommandRegistry:
    """Registry for command palette commands"""
    
    def __init__(self):
        self.commands: Dict[str, Dict[str, Any]] = {}
        
    def register(self, command_id: str, command_info: Dict[str, Any]) -> None:
        """Register a command"""
        self.commands[command_id] = command_info
        logger.debug(f"Registered command: {command_id}")
        
    def unregister(self, command_id: str) -> None:
        """Unregister a command"""
        if command_id in self.commands:
            del self.commands[command_id]
            logger.debug(f"Unregistered command: {command_id}")
            
    def get_command(self, command_id: str) -> Optional[Dict[str, Any]]:
        """Get command info"""
        return self.commands.get(command_id)
        
    def list_commands(self) -> List[Dict[str, Any]]:
        """List all registered commands"""
        return [
            {
                "id": cmd_id,
                "description": cmd_info.get("description", ""),
                "plugin": cmd_info.get("plugin", "core")
            }
            for cmd_id, cmd_info in self.commands.items()
        ]
        
    def execute(self, command_id: str, *args, **kwargs) -> Any:
        """Execute a command"""
        command = self.get_command(command_id)
        if not command:
            raise ValueError(f"Command not found: {command_id}")
            
        handler = command.get("handler")
        if not handler:
            raise ValueError(f"Command has no handler: {command_id}")
            
        return handler(*args, **kwargs)


class AlfredCore:
    """Core ALFRED application"""
    
    VERSION = "0.1.0"
    
    def __init__(self, config_path: Optional[str] = None):
        """Initialize ALFRED core"""
        # Core components
        self.config = ConfigManager(config_path)
        self.security = SecurityManager(self.config.get("security.config_dir", ".alfred"))
        self.event_bus = EventBus()
        self.plugin_manager = PluginManager(self.config.get("plugins.directory", "plugins"))
        self.ai_manager = AIManager(self.config)
        self.command_registry = CommandRegistry()
        
        # Application state
        self._running = False
        self._ui = None
        self._loop = None
        
        # Register core events
        self._register_core_events()
        
        # Initialize components
        self.plugin_manager.initialize(self)
        
        logger.info(f"ALFRED Core v{self.VERSION} initialized")
        
    def _register_core_events(self) -> None:
        """Register core event handlers"""
        # Core events that plugins can listen to
        core_events = [
            "app.started",
            "app.stopping",
            "app.stopped",
            "ui.connected",
            "ui.disconnected",
            "chat.message.sent",
            "chat.response.received",
            "error.occurred",
            "config.changed"
        ]
        
        # Log all core events in debug mode
        if self.config.get("debug", False):
            for event in core_events:
                self.event_bus.subscribe(event, self._log_event)
                
    def _log_event(self, event: Event) -> None:
        """Log events for debugging"""
        logger.debug(f"Event: {event.name} - {event.data}")
        
    def set_ui(self, ui: Any) -> None:
        """Set the UI implementation"""
        self._ui = ui
        self.event_bus.emit("ui.connected", {"ui_type": type(ui).__name__})
        
    async def start(self) -> None:
        """Start the application"""
        if self._running:
            logger.warning("Application already running")
            return
            
        logger.info("Starting ALFRED...")
        self._running = True
        self._loop = asyncio.get_running_loop()
        
        # Load and activate plugins based on config
        await self._load_configured_plugins()
        
        # Start AI manager
        await self.ai_manager.initialize()
        
        # Emit start event
        self.event_bus.emit("app.started")
        
        logger.info("ALFRED started successfully")
        
    async def stop(self) -> None:
        """Stop the application"""
        if not self._running:
            return
            
        logger.info("Stopping ALFRED...")
        self._running = False
        
        # Emit stopping event
        self.event_bus.emit("app.stopping")
        
        # Deactivate all plugins
        for plugin_name in list(self.plugin_manager.active_plugins.keys()):
            try:
                self.plugin_manager.deactivate_plugin(plugin_name)
            except Exception as e:
                logger.error(f"Error deactivating plugin {plugin_name}: {e}")
                
        # Stop AI manager
        await self.ai_manager.shutdown()
        
        # Save config
        self.config.save()
        
        # Emit stopped event
        self.event_bus.emit("app.stopped")
        
        logger.info("ALFRED stopped")
        
    async def _load_configured_plugins(self) -> None:
        """Load plugins based on configuration"""
        # Discover available plugins
        available = self.plugin_manager.discover_plugins()
        
        # Get list of plugins to activate from config
        auto_activate = self.config.get("plugins.auto_activate", [])
        
        for plugin_name in auto_activate:
            if plugin_name in available:
                try:
                    # Check if UI supports this plugin
                    plugin_info = self.plugin_manager.get_plugin_info(plugin_name)
                    if self._ui and hasattr(self._ui, 'ui_type'):
                        if self._ui.ui_type not in plugin_info.get("ui_support", []):
                            logger.warning(
                                f"Plugin {plugin_name} does not support {self._ui.ui_type} UI"
                            )
                            continue
                            
                    # Load plugin configuration
                    plugin_config = self.config.get(f"plugins.config.{plugin_name}", {})
                    if plugin_config:
                        self.plugin_manager.configure_plugin(plugin_name, plugin_config)
                        
                    # Activate plugin
                    self.plugin_manager.activate_plugin(plugin_name)
                    
                except Exception as e:
                    logger.error(f"Failed to activate plugin {plugin_name}: {e}")
                    
    async def send_message(self, message: str, context: Optional[Dict[str, Any]] = None) -> str:
        """Send a message to the AI"""
        # Validate input
        if not self.security.validate_input(message):
            raise ValueError("Invalid input detected")
            
        # Check rate limit
        user_id = context.get("user_id", "default") if context else "default"
        if not self.security.check_rate_limit(f"chat:{user_id}"):
            raise RuntimeError("Rate limit exceeded")
            
        # Emit message event
        self.event_bus.emit("chat.message.sent", {
            "message": message,
            "context": context
        })
        
        try:
            # Get AI response
            response = await self.ai_manager.query(message, context)
            
            # Sanitize output
            response = self.security.sanitize_output(response)
            
            # Emit response event
            self.event_bus.emit("chat.response.received", {
                "message": message,
                "response": response,
                "context": context
            })
            
            return response
            
        except Exception as e:
            logger.error(f"Error processing message: {e}")
            self.event_bus.emit("error.occurred", {
                "error": str(e),
                "context": "chat"
            })
            raise
            
    def execute_command(self, command_id: str, *args, **kwargs) -> Any:
        """Execute a registered command"""
        try:
            result = self.command_registry.execute(command_id, *args, **kwargs)
            self.event_bus.emit("command.executed", {
                "command": command_id,
                "success": True
            })
            return result
        except Exception as e:
            logger.error(f"Command execution failed: {e}")
            self.event_bus.emit("command.executed", {
                "command": command_id,
                "success": False,
                "error": str(e)
            })
            raise
            
    def get_plugin_api(self, plugin_name: str) -> Optional[Any]:
        """Get a plugin's public API"""
        if plugin_name in self.plugin_manager.active_plugins:
            plugin = self.plugin_manager.active_plugins[plugin_name]
            if hasattr(plugin, 'get_api'):
                return plugin.get_api()
        return None
        
    def update_config(self, key: str, value: Any) -> None:
        """Update configuration value"""
        old_value = self.config.get(key)
        self.config.set(key, value)
        self.config.save()
        
        self.event_bus.emit("config.changed", {
            "key": key,
            "old_value": old_value,
            "new_value": value
        })


# Global instance management
_alfred_instance: Optional[AlfredCore] = None

def get_alfred_instance() -> Optional[AlfredCore]:
    """Get the global ALFRED instance"""
    return _alfred_instance

def set_alfred_instance(instance: AlfredCore) -> None:
    """Set the global ALFRED instance"""
    global _alfred_instance
    _alfred_instance = instance