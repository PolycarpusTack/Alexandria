"""Project data model."""

from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional
import json


@dataclass
class Project:
    """Represents an Alfred project."""
    id: str
    name: str
    path: Path
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    metadata: Dict[str, any] = field(default_factory=dict)
    chat_sessions: List[str] = field(default_factory=list)  # Chat session IDs
    
    def __post_init__(self):
        """Ensure path is a Path object."""
        if isinstance(self.path, str):
            self.path = Path(self.path)
            
    @property
    def exists(self) -> bool:
        """Check if project directory exists."""
        return self.path.exists()
        
    @property
    def project_type(self) -> str:
        """Detect project type based on files."""
        if not self.exists:
            return "unknown"
            
        # Check for specific project files
        if (self.path / "package.json").exists():
            return "javascript"
        elif (self.path / "requirements.txt").exists() or (self.path / "setup.py").exists():
            return "python"
        elif any(self.path.glob("*.st")) or any(self.path.glob("*.im")):
            return "smalltalk"
        elif (self.path / "Cargo.toml").exists():
            return "rust"
        elif (self.path / "go.mod").exists():
            return "go"
        else:
            return "generic"
            
    def to_dict(self) -> dict:
        """Convert to dictionary for serialization."""
        return {
            "id": self.id,
            "name": self.name,
            "path": str(self.path),
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "metadata": self.metadata,
            "chat_sessions": self.chat_sessions
        }
        
    @classmethod
    def from_dict(cls, data: dict) -> "Project":
        """Create from dictionary."""
        return cls(
            id=data["id"],
            name=data["name"],
            path=Path(data["path"]),
            created_at=datetime.fromisoformat(data["created_at"]),
            updated_at=datetime.fromisoformat(data["updated_at"]),
            metadata=data.get("metadata", {}),
            chat_sessions=data.get("chat_sessions", [])
        )
        
    def save_to_file(self, filepath: Path) -> None:
        """Save project to JSON file."""
        with open(filepath, 'w') as f:
            json.dump(self.to_dict(), f, indent=2)
            
    @classmethod
    def load_from_file(cls, filepath: Path) -> "Project":
        """Load project from JSON file."""
        with open(filepath, 'r') as f:
            data = json.load(f)
        return cls.from_dict(data)