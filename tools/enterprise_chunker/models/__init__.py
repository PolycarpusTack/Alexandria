"""
enterprise_chunker: Data Models Package
=======================================

This package contains data models used throughout the enterprise chunker application.
Models define the structure for chunking strategies, metadata, and content features.

Usage:
    from enterprise_chunker.models import ChunkingStrategy, ChunkMetadata
    
    strategy = ChunkingStrategy.SEMANTIC
    metadata = ChunkMetadata(id="chunk-123", text="Sample text")
"""

from __future__ import annotations

# Version information
__version__ = "0.1.0"

# Import models for easier access with type annotations
from enterprise_chunker.models.enums import (
    ChunkingStrategy,
    TokenEstimationStrategy,
    ContentFormat,
)
from enterprise_chunker.models.chunk_metadata import ChunkMetadata, ChunkingResult
from enterprise_chunker.models.content_features import ContentFeatures
from enterprise_chunker.models.user import User

# List available models for introspection and auto-import capabilities
__all__ = [
    "ChunkingStrategy",
    "TokenEstimationStrategy",
    "ContentFormat",
    "ChunkMetadata",
    "ChunkingResult",
    "ContentFeatures",
    "User"
]