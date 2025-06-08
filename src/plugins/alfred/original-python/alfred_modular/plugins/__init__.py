"""Plugin system for Alfred."""

from .base import Plugin, PluginMetadata
from .manager import PluginManager
from .registry import PluginRegistry

__all__ = ["Plugin", "PluginMetadata", "PluginManager", "PluginRegistry"]