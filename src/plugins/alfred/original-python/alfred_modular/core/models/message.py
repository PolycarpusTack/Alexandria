"""Message data model."""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional, Dict, Any


class MessageType(Enum):
    """Message types."""
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"
    ERROR = "error"


@dataclass
class Message:
    """Represents a message in a chat session."""
    id: str
    type: MessageType
    content: str
    timestamp: datetime = field(default_factory=datetime.now)
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    @property
    def is_user(self) -> bool:
        """Check if message is from user."""
        return self.type == MessageType.USER
        
    @property
    def is_assistant(self) -> bool:
        """Check if message is from assistant."""
        return self.type == MessageType.ASSISTANT
        
    def to_dict(self) -> dict:
        """Convert to dictionary for serialization."""
        return {
            "id": self.id,
            "type": self.type.value,
            "content": self.content,
            "timestamp": self.timestamp.isoformat(),
            "metadata": self.metadata
        }
        
    @classmethod
    def from_dict(cls, data: dict) -> "Message":
        """Create from dictionary."""
        return cls(
            id=data["id"],
            type=MessageType(data["type"]),
            content=data["content"],
            timestamp=datetime.fromisoformat(data["timestamp"]),
            metadata=data.get("metadata", {})
        )