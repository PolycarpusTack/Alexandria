"""Persistence service for saving and loading data."""

import json
import logging
from pathlib import Path
from typing import Optional, Dict, Any
import os

logger = logging.getLogger(__name__)


class PersistenceService:
    """Handles data persistence for Alfred."""
    
    def __init__(self, base_path: Optional[Path] = None):
        if base_path is None:
            base_path = Path.home() / ".alfred"
        self.base_path = Path(base_path)
        self._ensure_directories()
        
    def _ensure_directories(self) -> None:
        """Ensure required directories exist."""
        directories = [
            self.base_path,
            self.projects_dir,
            self.chats_dir,
            self.config_dir,
            self.cache_dir,
            self.templates_dir,
        ]
        
        for directory in directories:
            directory.mkdir(parents=True, exist_ok=True)
            
    @property
    def projects_dir(self) -> Path:
        """Projects directory."""
        return self.base_path / "projects"
        
    @property
    def chats_dir(self) -> Path:
        """Chat sessions directory."""
        return self.base_path / "chats"
        
    @property
    def config_dir(self) -> Path:
        """Configuration directory."""
        return self.base_path / "config"
        
    @property
    def cache_dir(self) -> Path:
        """Cache directory."""
        return self.base_path / "cache"
        
    @property
    def templates_dir(self) -> Path:
        """Templates directory."""
        return self.base_path / "templates"
        
    def save_json(self, data: Dict[str, Any], filepath: Path) -> bool:
        """Save data as JSON."""
        try:
            # Ensure parent directory exists
            filepath.parent.mkdir(parents=True, exist_ok=True)
            
            # Write atomically
            temp_file = filepath.with_suffix('.tmp')
            with open(temp_file, 'w') as f:
                json.dump(data, f, indent=2, default=str)
                
            # Move to final location
            temp_file.replace(filepath)
            
            logger.debug(f"Saved data to {filepath}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to save data to {filepath}: {e}")
            return False
            
    def load_json(self, filepath: Path) -> Optional[Dict[str, Any]]:
        """Load data from JSON."""
        try:
            if not filepath.exists():
                logger.debug(f"File not found: {filepath}")
                return None
                
            with open(filepath, 'r') as f:
                data = json.load(f)
                
            logger.debug(f"Loaded data from {filepath}")
            return data
            
        except Exception as e:
            logger.error(f"Failed to load data from {filepath}: {e}")
            return None
            
    def delete(self, filepath: Path) -> bool:
        """Delete a file."""
        try:
            if filepath.exists():
                filepath.unlink()
                logger.debug(f"Deleted {filepath}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to delete {filepath}: {e}")
            return False
            
    def list_files(self, directory: Path, pattern: str = "*") -> list[Path]:
        """List files in a directory."""
        try:
            if not directory.exists():
                return []
            return sorted(directory.glob(pattern))
            
        except Exception as e:
            logger.error(f"Failed to list files in {directory}: {e}")
            return []
            
    def get_project_file(self, project_id: str) -> Path:
        """Get project file path."""
        return self.projects_dir / f"{project_id}.json"
        
    def get_chat_file(self, chat_id: str) -> Path:
        """Get chat session file path."""
        return self.chats_dir / f"{chat_id}.json"
        
    def get_config_file(self, name: str) -> Path:
        """Get configuration file path."""
        return self.config_dir / f"{name}.json"
        
    def get_cache_file(self, name: str) -> Path:
        """Get cache file path."""
        return self.cache_dir / name
        
    def clear_cache(self) -> bool:
        """Clear all cache files."""
        try:
            for file in self.cache_dir.iterdir():
                if file.is_file():
                    file.unlink()
            logger.info("Cache cleared")
            return True
            
        except Exception as e:
            logger.error(f"Failed to clear cache: {e}")
            return False