"""Base AI provider interface."""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import List, Optional, Dict, Any, AsyncIterator
from datetime import datetime


@dataclass
class AIRequest:
    """AI request data."""
    prompt: str
    model: str
    context: Optional[str] = None
    temperature: float = 0.7
    max_tokens: Optional[int] = None
    stream: bool = True
    metadata: Dict[str, Any] = None
    
    def __post_init__(self):
        if self.metadata is None:
            self.metadata = {}


@dataclass
class AIResponse:
    """AI response data."""
    content: str
    model: str
    request_id: Optional[str] = None
    created_at: datetime = None
    metadata: Dict[str, Any] = None
    
    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.now()
        if self.metadata is None:
            self.metadata = {}


class AIProvider(ABC):
    """Abstract base class for AI providers."""
    
    @abstractmethod
    async def list_models(self) -> List[str]:
        """List available models."""
        pass
        
    @abstractmethod
    async def generate(self, request: AIRequest) -> AIResponse:
        """Generate a response (non-streaming)."""
        pass
        
    @abstractmethod
    async def generate_stream(self, request: AIRequest) -> AsyncIterator[str]:
        """Generate a streaming response."""
        pass
        
    @abstractmethod
    async def health_check(self) -> bool:
        """Check if the provider is healthy."""
        pass
        
    @property
    @abstractmethod
    def name(self) -> str:
        """Provider name."""
        pass
        
    @property
    @abstractmethod
    def default_model(self) -> str:
        """Default model name."""
        pass