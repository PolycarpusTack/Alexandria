"""Configuration management."""

import os
import json
import logging
from pathlib import Path
from typing import Dict, Any, Optional
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class Config:
    """Application configuration."""
    
    # Paths
    data_dir: Path = field(default_factory=lambda: Path.home() / ".alfred")
    
    # AI settings
    ollama_url: str = "http://localhost:11434"
    default_model: str = "deepseek-coder:latest"
    ai_temperature: float = 0.7
    ai_max_tokens: Optional[int] = None
    
    # UI settings
    theme: str = "default"
    window_width: int = 1200
    window_height: int = 800
    font_family: str = "Consolas"
    font_size: int = 10
    
    # Behavior
    auto_open_last_project: bool = True
    auto_save_interval: int = 300  # seconds
    max_chat_history: int = 1000
    
    # Performance
    enable_caching: bool = True
    cache_size_mb: int = 100
    max_context_length: int = 8000
    
    # Security
    enable_security_checks: bool = True
    max_file_size_mb: int = 10
    allowed_file_extensions: list = field(default_factory=lambda: [
        ".py", ".js", ".ts", ".java", ".cpp", ".c", ".h", ".rs", ".go",
        ".rb", ".php", ".swift", ".kt", ".scala", ".r", ".sql", ".html",
        ".css", ".xml", ".json", ".yaml", ".yml", ".toml", ".md", ".txt",
        ".sh", ".bash", ".ps1", ".dockerfile", ".makefile", ".st", ".im"
    ])
    
    def __post_init__(self):
        """Ensure paths are Path objects."""
        if isinstance(self.data_dir, str):
            self.data_dir = Path(self.data_dir)
            
    @classmethod
    def load(cls, config_file: Optional[Path] = None) -> "Config":
        """Load configuration from file."""
        if config_file is None:
            config_file = Path.home() / ".alfred" / "config.json"
            
        if config_file.exists():
            try:
                with open(config_file, 'r') as f:
                    data = json.load(f)
                    
                # Convert data_dir to Path if present
                if "data_dir" in data:
                    data["data_dir"] = Path(data["data_dir"])
                    
                config = cls(**data)
                logger.info(f"Loaded configuration from {config_file}")
                return config
                
            except Exception as e:
                logger.error(f"Failed to load configuration: {e}")
                
        # Return default config
        return cls()
        
    def save(self, config_file: Optional[Path] = None) -> bool:
        """Save configuration to file."""
        if config_file is None:
            config_file = self.data_dir / "config.json"
            
        try:
            # Ensure directory exists
            config_file.parent.mkdir(parents=True, exist_ok=True)
            
            # Convert to dict
            data = {
                "data_dir": str(self.data_dir),
                "ollama_url": self.ollama_url,
                "default_model": self.default_model,
                "ai_temperature": self.ai_temperature,
                "ai_max_tokens": self.ai_max_tokens,
                "theme": self.theme,
                "window_width": self.window_width,
                "window_height": self.window_height,
                "font_family": self.font_family,
                "font_size": self.font_size,
                "auto_open_last_project": self.auto_open_last_project,
                "auto_save_interval": self.auto_save_interval,
                "max_chat_history": self.max_chat_history,
                "enable_caching": self.enable_caching,
                "cache_size_mb": self.cache_size_mb,
                "max_context_length": self.max_context_length,
                "enable_security_checks": self.enable_security_checks,
                "max_file_size_mb": self.max_file_size_mb,
                "allowed_file_extensions": self.allowed_file_extensions
            }
            
            with open(config_file, 'w') as f:
                json.dump(data, f, indent=2)
                
            logger.info(f"Saved configuration to {config_file}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to save configuration: {e}")
            return False
            
    def update(self, **kwargs) -> None:
        """Update configuration values."""
        for key, value in kwargs.items():
            if hasattr(self, key):
                setattr(self, key, value)
            else:
                logger.warning(f"Unknown configuration key: {key}")
                
    def get_env_override(self, key: str, default: Any = None) -> Any:
        """Get configuration value with environment override."""
        env_key = f"ALFRED_{key.upper()}"
        env_value = os.getenv(env_key)
        
        if env_value is not None:
            # Try to parse as JSON for complex types
            try:
                return json.loads(env_value)
            except:
                return env_value
                
        # Return config value or default
        return getattr(self, key, default)