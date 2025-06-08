#!/usr/bin/env python3
"""
Configuration management system for ALFRED
Provides centralized configuration with defaults and user overrides
"""

import json
import os
from pathlib import Path
from typing import Any, Dict, Optional, List
from dataclasses import dataclass, field, asdict
from alfred_constants import *
from alfred_exceptions import ConfigurationError
import threading


@dataclass
class ThemeConfig:
    """Theme configuration"""
    name: str = "default"
    colors: Dict[str, str] = field(default_factory=lambda: COLORS.copy())
    fonts: Dict[str, Tuple[str, int]] = field(default_factory=lambda: {
        'chat_display': CHAT_DISPLAY_FONT,
        'input_text': INPUT_TEXT_FONT,
        'code': ('Consolas', 9)
    })


@dataclass
class ModelConfig:
    """AI model configuration"""
    default_model: str = "deepseek-coder:latest"
    ollama_url: str = "http://localhost:11434"
    timeout: int = OLLAMA_TIMEOUT_DEFAULT
    max_retries: int = 3
    retry_delay: float = 1.0


@dataclass
class UIConfig:
    """UI configuration"""
    window_size: str = DEFAULT_WINDOW_SIZE
    window_title: str = DEFAULT_WINDOW_TITLE
    chat_display_height: int = CHAT_DISPLAY_HEIGHT
    input_text_height: int = INPUT_TEXT_HEIGHT
    listbox_height: int = LISTBOX_HEIGHT
    show_tooltips: bool = True
    auto_save_interval: int = 300  # seconds
    
    
@dataclass 
class ProjectConfig:
    """Project-related configuration"""
    default_project_dir: str = str(Path.home() / "Projects")
    auto_load_last: bool = True
    max_recent_projects: int = 10
    project_templates: List[str] = field(default_factory=lambda: [
        "python", "javascript", "web", "api", "data-science"
    ])


@dataclass
class SecurityConfig:
    """Security configuration"""
    max_file_size: int = MAX_CONTEXT_FILE_SIZE
    allowed_file_extensions: List[str] = field(default_factory=lambda: [
        '.py', '.js', '.ts', '.java', '.cpp', '.c', '.h', '.cs', '.go',
        '.rs', '.rb', '.php', '.swift', '.kt', '.scala', '.r', '.m',
        '.txt', '.md', '.json', '.xml', '.yaml', '.yml', '.toml',
        '.html', '.css', '.scss', '.sql', '.sh', '.bash'
    ])
    warn_external_files: bool = True
    sanitize_filenames: bool = True


@dataclass
class PerformanceConfig:
    """Performance configuration"""
    cache_enabled: bool = True
    cache_size: int = CACHE_MAX_MEMORY_ENTRIES
    connection_check_interval: int = CONNECTION_CHECK_INTERVAL_MS
    structure_refresh_interval: int = STRUCTURE_REFRESH_INTERVAL_MS
    ui_update_batch_size: int = 10
    max_chat_history: int = MAX_CHAT_HISTORY


@dataclass
class Config:
    """Main configuration container"""
    theme: ThemeConfig = field(default_factory=ThemeConfig)
    model: ModelConfig = field(default_factory=ModelConfig)
    ui: UIConfig = field(default_factory=UIConfig)
    project: ProjectConfig = field(default_factory=ProjectConfig)
    security: SecurityConfig = field(default_factory=SecurityConfig)
    performance: PerformanceConfig = field(default_factory=PerformanceConfig)
    
    # User preferences
    preferences: Dict[str, Any] = field(default_factory=dict)


class ConfigManager:
    """Manages application configuration with file persistence"""
    
    def __init__(self, config_dir: Optional[Path] = None):
        self.config_dir = config_dir or Path.home() / ".alfred"
        self.config_file = self.config_dir / "config.json"
        self.config = Config()
        self._lock = threading.RLock()
        self._observers = []
        
        # Ensure config directory exists
        self.config_dir.mkdir(parents=True, exist_ok=True)
        
        # Load configuration
        self.load()
    
    def load(self) -> bool:
        """Load configuration from file"""
        try:
            if self.config_file.exists():
                with open(self.config_file, 'r') as f:
                    data = json.load(f)
                    self._update_config_from_dict(data)
                return True
        except Exception as e:
            print(f"Failed to load config: {e}")
        return False
    
    def save(self) -> bool:
        """Save configuration to file"""
        try:
            with self._lock:
                # Convert to dict
                data = self._config_to_dict()
                
                # Write to temp file first
                temp_file = self.config_file.with_suffix('.tmp')
                with open(temp_file, 'w') as f:
                    json.dump(data, f, indent=2)
                
                # Atomic rename
                temp_file.replace(self.config_file)
                
                # Notify observers
                self._notify_observers('save')
                return True
                
        except Exception as e:
            raise ConfigurationError(f"Failed to save config: {e}")
    
    def get(self, path: str, default: Any = None) -> Any:
        """Get configuration value by dot-separated path"""
        with self._lock:
            try:
                parts = path.split('.')
                value = self.config
                
                for part in parts:
                    if hasattr(value, part):
                        value = getattr(value, part)
                    elif isinstance(value, dict) and part in value:
                        value = value[part]
                    else:
                        return default
                
                return value
            except:
                return default
    
    def set(self, path: str, value: Any) -> bool:
        """Set configuration value by dot-separated path"""
        with self._lock:
            try:
                parts = path.split('.')
                if not parts:
                    return False
                
                # Navigate to parent
                parent = self.config
                for part in parts[:-1]:
                    if hasattr(parent, part):
                        parent = getattr(parent, part)
                    elif isinstance(parent, dict):
                        if part not in parent:
                            parent[part] = {}
                        parent = parent[part]
                    else:
                        return False
                
                # Set value
                last_part = parts[-1]
                if hasattr(parent, last_part):
                    setattr(parent, last_part, value)
                elif isinstance(parent, dict):
                    parent[last_part] = value
                else:
                    return False
                
                # Auto-save
                self.save()
                
                # Notify observers
                self._notify_observers('change', path, value)
                return True
                
            except Exception as e:
                print(f"Failed to set config value: {e}")
                return False
    
    def reset(self, section: Optional[str] = None):
        """Reset configuration to defaults"""
        with self._lock:
            if section:
                # Reset specific section
                if hasattr(self.config, section):
                    if section == 'theme':
                        self.config.theme = ThemeConfig()
                    elif section == 'model':
                        self.config.model = ModelConfig()
                    elif section == 'ui':
                        self.config.ui = UIConfig()
                    elif section == 'project':
                        self.config.project = ProjectConfig()
                    elif section == 'security':
                        self.config.security = SecurityConfig()
                    elif section == 'performance':
                        self.config.performance = PerformanceConfig()
            else:
                # Reset everything
                self.config = Config()
            
            self.save()
            self._notify_observers('reset', section)
    
    def export_config(self, export_file: Path) -> bool:
        """Export configuration to file"""
        try:
            data = self._config_to_dict()
            with open(export_file, 'w') as f:
                json.dump(data, f, indent=2)
            return True
        except Exception as e:
            print(f"Failed to export config: {e}")
            return False
    
    def import_config(self, import_file: Path) -> bool:
        """Import configuration from file"""
        try:
            with open(import_file, 'r') as f:
                data = json.load(f)
            
            self._update_config_from_dict(data)
            self.save()
            self._notify_observers('import')
            return True
            
        except Exception as e:
            print(f"Failed to import config: {e}")
            return False
    
    def add_observer(self, callback: callable):
        """Add configuration change observer"""
        self._observers.append(callback)
    
    def remove_observer(self, callback: callable):
        """Remove configuration change observer"""
        if callback in self._observers:
            self._observers.remove(callback)
    
    def _notify_observers(self, event: str, *args):
        """Notify all observers of configuration change"""
        for observer in self._observers:
            try:
                observer(event, *args)
            except Exception as e:
                print(f"Observer error: {e}")
    
    def _config_to_dict(self) -> Dict[str, Any]:
        """Convert config object to dictionary"""
        return {
            'theme': asdict(self.config.theme),
            'model': asdict(self.config.model),
            'ui': asdict(self.config.ui),
            'project': asdict(self.config.project),
            'security': asdict(self.config.security),
            'performance': asdict(self.config.performance),
            'preferences': self.config.preferences
        }
    
    def _update_config_from_dict(self, data: Dict[str, Any]):
        """Update config object from dictionary"""
        if 'theme' in data:
            self.config.theme = ThemeConfig(**data['theme'])
        if 'model' in data:
            self.config.model = ModelConfig(**data['model'])
        if 'ui' in data:
            self.config.ui = UIConfig(**data['ui'])
        if 'project' in data:
            self.config.project = ProjectConfig(**data['project'])
        if 'security' in data:
            self.config.security = SecurityConfig(**data['security'])
        if 'performance' in data:
            self.config.performance = PerformanceConfig(**data['performance'])
        if 'preferences' in data:
            self.config.preferences = data['preferences']


# Global configuration instance
_config_manager: Optional[ConfigManager] = None


def get_config() -> ConfigManager:
    """Get global configuration manager"""
    global _config_manager
    if _config_manager is None:
        _config_manager = ConfigManager()
    return _config_manager


def config_value(path: str, default: Any = None) -> Any:
    """Shortcut to get configuration value"""
    return get_config().get(path, default)