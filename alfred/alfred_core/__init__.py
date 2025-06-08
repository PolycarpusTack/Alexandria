"""
ALFRED Core - Business logic and plugin system
"""

from .plugin_manager import PluginManager, Plugin, PluginMetadata
from .core import AlfredCore, get_alfred_instance, set_alfred_instance
from .security import SecurityManager
from .config import ConfigManager
from .ai_manager import AIManager

__version__ = "0.1.0"
__all__ = [
    "AlfredCore",
    "get_alfred_instance",
    "set_alfred_instance",
    "PluginManager",
    "Plugin",
    "PluginMetadata",
    "SecurityManager",
    "ConfigManager",
    "AIManager"
]