"""Chat session data model."""

from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import List, Optional
import json

from .message import Message, MessageType


@dataclass
class ChatSession:
    """Represents a chat session within a project."""
    id: str
    project_id: str
    name: str
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    messages: List[Message] = field(default_factory=list)
    context_files: List[str] = field(default_factory=list)  # File paths
    model: str = "deepseek-coder:latest"
    
    def add_message(self, message: Message) -> None:
        """Add a message to the session."""
        self.messages.append(message)
        self.updated_at = datetime.now()
        
    def add_context_file(self, filepath: str) -> None:
        """Add a context file to the session."""
        if filepath not in self.context_files:
            self.context_files.append(filepath)
            self.updated_at = datetime.now()
            
    def remove_context_file(self, filepath: str) -> None:
        """Remove a context file from the session."""
        if filepath in self.context_files:
            self.context_files.remove(filepath)
            self.updated_at = datetime.now()
            
    def get_context(self) -> str:
        """Get formatted context for AI requests."""
        context_parts = []
        
        # Add context files
        for filepath in self.context_files:
            path = Path(filepath)
            if path.exists():
                try:
                    content = path.read_text()
                    context_parts.append(f"File: {filepath}\n```\n{content}\n```\n")
                except Exception:
                    pass
                    
        # Add recent messages
        recent_messages = self.messages[-10:]  # Last 10 messages
        for msg in recent_messages:
            role = "User" if msg.is_user else "Assistant"
            context_parts.append(f"{role}: {msg.content}\n")
            
        return "\n".join(context_parts)
        
    def to_dict(self) -> dict:
        """Convert to dictionary for serialization."""
        return {
            "id": self.id,
            "project_id": self.project_id,
            "name": self.name,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "messages": [msg.to_dict() for msg in self.messages],
            "context_files": self.context_files,
            "model": self.model
        }
        
    @classmethod
    def from_dict(cls, data: dict) -> "ChatSession":
        """Create from dictionary."""
        session = cls(
            id=data["id"],
            project_id=data["project_id"],
            name=data["name"],
            created_at=datetime.fromisoformat(data["created_at"]),
            updated_at=datetime.fromisoformat(data["updated_at"]),
            context_files=data.get("context_files", []),
            model=data.get("model", "deepseek-coder:latest")
        )
        
        # Load messages
        for msg_data in data.get("messages", []):
            session.messages.append(Message.from_dict(msg_data))
            
        return session
        
    def save_to_file(self, filepath: Path) -> None:
        """Save session to JSON file."""
        with open(filepath, 'w') as f:
            json.dump(self.to_dict(), f, indent=2)
            
    @classmethod
    def load_from_file(cls, filepath: Path) -> "ChatSession":
        """Load session from JSON file."""
        with open(filepath, 'r') as f:
            data = json.load(f)
        return cls.from_dict(data)


# Alias for compatibility
ChatMessage = Message