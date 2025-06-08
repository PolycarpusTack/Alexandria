"""
Configuration Manager - Handles ALFRED configuration
"""

import json
import os
import logging
from typing import Any, Dict, Optional, Union
from pathlib import Path
import yaml

logger = logging.getLogger(__name__)


class ConfigManager:
    """Manages application configuration"""
    
    DEFAULT_CONFIG = {
        "app": {
            "name": "ALFRED",
            "version": "0.1.0",
            "debug": False
        },
        "ui": {
            "default": "auto",  # auto, tkinter, custom, web
            "theme": "dark",
            "font_size": 12
        },
        "ai": {
            "default_model": "ollama",
            "ollama": {
                "url": "http://localhost:11434",
                "model": "llama2",
                "timeout": 30,
                "max_retries": 3
            },
            "openai": {
                "api_key": "",
                "model": "gpt-3.5-turbo",
                "temperature": 0.7,
                "max_tokens": 2000
            }
        },
        "plugins": {
            "directory": "plugins",
            "auto_activate": ["chat_enhanced", "command_palette"],
            "config": {}
        },
        "security": {
            "config_dir": ".alfred",
            "rate_limit": 60,
            "max_input_length": 10000,
            "enable_audit_log": True
        },
        "shortcuts": {
            "command_palette": "Ctrl+Shift+P",
            "new_chat": "Ctrl+N",
            "clear_chat": "Ctrl+L",
            "settings": "Ctrl+,",
            "quit": "Ctrl+Q"
        }
    }
    
    def __init__(self, config_path: Optional[str] = None):
        """Initialize configuration manager"""
        self.config_path = self._resolve_config_path(config_path)
        self.config: Dict[str, Any] = {}
        self._observers: Dict[str, list] = {}
        
        # Load configuration
        self.load()
        
    def _resolve_config_path(self, config_path: Optional[str]) -> Path:
        """Resolve configuration file path"""
        if config_path:
            return Path(config_path)
            
        # Check multiple locations in order
        locations = [
            Path.cwd() / "alfred.config.json",
            Path.cwd() / "alfred.config.yaml",
            Path.home() / ".alfred" / "config.json",
            Path.home() / ".alfred" / "config.yaml",
            Path.home() / ".config" / "alfred" / "config.json",
            Path.home() / ".config" / "alfred" / "config.yaml"
        ]
        
        for location in locations:
            if location.exists():
                logger.info(f"Found config at: {location}")
                return location
                
        # Default to home directory
        default_path = Path.home() / ".alfred" / "config.json"
        default_path.parent.mkdir(parents=True, exist_ok=True)
        return default_path
        
    def load(self) -> None:
        """Load configuration from file"""
        if self.config_path.exists():
            try:
                with open(self.config_path, 'r') as f:
                    if self.config_path.suffix == '.yaml' or self.config_path.suffix == '.yml':
                        self.config = yaml.safe_load(f) or {}
                    else:
                        self.config = json.load(f)
                        
                logger.info(f"Loaded config from: {self.config_path}")
                
                # Merge with defaults
                self.config = self._merge_configs(self.DEFAULT_CONFIG, self.config)
                
            except Exception as e:
                logger.error(f"Failed to load config: {e}")
                self.config = self.DEFAULT_CONFIG.copy()
        else:
            logger.info("No config file found, using defaults")
            self.config = self.DEFAULT_CONFIG.copy()
            self.save()  # Save default config
            
    def save(self) -> None:
        """Save configuration to file"""
        try:
            self.config_path.parent.mkdir(parents=True, exist_ok=True)
            
            with open(self.config_path, 'w') as f:
                if self.config_path.suffix == '.yaml' or self.config_path.suffix == '.yml':
                    yaml.dump(self.config, f, default_flow_style=False, indent=2)
                else:
                    json.dump(self.config, f, indent=2)
                    
            logger.info(f"Saved config to: {self.config_path}")
            
        except Exception as e:
            logger.error(f"Failed to save config: {e}")
            
    def get(self, key: str, default: Any = None) -> Any:
        """Get configuration value using dot notation"""
        keys = key.split('.')
        value = self.config
        
        for k in keys:
            if isinstance(value, dict) and k in value:
                value = value[k]
            else:
                return default
                
        return value
        
    def set(self, key: str, value: Any) -> None:
        """Set configuration value using dot notation"""
        keys = key.split('.')
        config = self.config
        
        # Navigate to the parent of the target key
        for k in keys[:-1]:
            if k not in config:
                config[k] = {}
            config = config[k]
            
        # Set the value
        old_value = config.get(keys[-1])
        config[keys[-1]] = value
        
        # Notify observers
        self._notify_observers(key, old_value, value)
        
    def update(self, updates: Dict[str, Any], prefix: str = "") -> None:
        """Update multiple configuration values"""
        for key, value in updates.items():
            full_key = f"{prefix}.{key}" if prefix else key
            if isinstance(value, dict):
                self.update(value, full_key)
            else:
                self.set(full_key, value)
                
    def observe(self, key: str, callback: callable) -> None:
        """Register a callback for configuration changes"""
        if key not in self._observers:
            self._observers[key] = []
        self._observers[key].append(callback)
        
    def unobserve(self, key: str, callback: callable) -> None:
        """Unregister a callback"""
        if key in self._observers:
            self._observers[key].remove(callback)
            if not self._observers[key]:
                del self._observers[key]
                
    def _notify_observers(self, key: str, old_value: Any, new_value: Any) -> None:
        """Notify observers of configuration changes"""
        # Exact key observers
        if key in self._observers:
            for callback in self._observers[key]:
                try:
                    callback(key, old_value, new_value)
                except Exception as e:
                    logger.error(f"Observer callback error: {e}")
                    
        # Wildcard observers (e.g., "plugins.*")
        parts = key.split('.')
        for i in range(len(parts)):
            wildcard_key = '.'.join(parts[:i+1]) + '.*'
            if wildcard_key in self._observers:
                for callback in self._observers[wildcard_key]:
                    try:
                        callback(key, old_value, new_value)
                    except Exception as e:
                        logger.error(f"Wildcard observer callback error: {e}")
                        
    def _merge_configs(self, default: Dict[str, Any], custom: Dict[str, Any]) -> Dict[str, Any]:
        """Deep merge two configuration dictionaries"""
        result = default.copy()
        
        for key, value in custom.items():
            if key in result and isinstance(result[key], dict) and isinstance(value, dict):
                result[key] = self._merge_configs(result[key], value)
            else:
                result[key] = value
                
        return result
        
    def export_schema(self) -> Dict[str, Any]:
        """Export configuration schema for UI generation"""
        return {
            "type": "object",
            "properties": {
                "ui": {
                    "type": "object",
                    "properties": {
                        "default": {
                            "type": "string",
                            "enum": ["auto", "tkinter", "custom", "web"],
                            "description": "Default UI mode"
                        },
                        "theme": {
                            "type": "string",
                            "enum": ["light", "dark", "auto"],
                            "description": "UI theme"
                        },
                        "font_size": {
                            "type": "integer",
                            "minimum": 8,
                            "maximum": 24,
                            "description": "Base font size"
                        }
                    }
                },
                "ai": {
                    "type": "object",
                    "properties": {
                        "default_model": {
                            "type": "string",
                            "enum": ["ollama", "openai", "anthropic"],
                            "description": "Default AI model provider"
                        }
                    }
                },
                "security": {
                    "type": "object",
                    "properties": {
                        "rate_limit": {
                            "type": "integer",
                            "minimum": 1,
                            "maximum": 1000,
                            "description": "Requests per minute"
                        },
                        "enable_audit_log": {
                            "type": "boolean",
                            "description": "Enable audit logging"
                        }
                    }
                }
            }
        }
        
    def reset_to_defaults(self, section: Optional[str] = None) -> None:
        """Reset configuration to defaults"""
        if section:
            if section in self.DEFAULT_CONFIG:
                old_value = self.config.get(section)
                self.config[section] = self.DEFAULT_CONFIG[section].copy()
                self._notify_observers(section, old_value, self.config[section])
        else:
            old_config = self.config.copy()
            self.config = self.DEFAULT_CONFIG.copy()
            self._notify_observers("*", old_config, self.config)
            
        self.save()